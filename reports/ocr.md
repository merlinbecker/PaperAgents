# OCR Agent – Arbeitsstand und Fix

**Datum:** 2026-03-09  
**Branch:** `copilot/update-ocr-agent-workflow`

---

## Problem

Der OCR-Agent hat die Binärdatei (PDF) zwar korrekt eingelesen, jedoch wurde der Base64-kodierte Inhalt **nicht an das LLM übermittelt**. Dadurch brach der agentic Loop mit einer ungültigen Completion ab, anstatt den OCR-Schritt auszuführen:

```json
{
  "completion": "read_binary_file{\"filePath\": \"DA_2026_11.pdf\"}"
}
```

---

## Ursache

### Phase 1: Base64 landet in `msg.content` → Nachricht fällt aus Kontextfenster (vorheriger Fix)

1. Das LLM rief `read_binary_file("DA_2026_11.pdf")` auf.
2. Das Tool lief erfolgreich und gab zurück:
   ```json
   { "filePath": "...", "base64": "<mehrere MB Base64>", "mimeType": "application/pdf", "size": ... }
   ```
3. **`executeToolCall` in `orchestrator.ts`** speicherte das vollständige Ergebnis als Konversationsnachricht:
   ```typescript
   content: JSON.stringify(result.data)  // enthält das gesamte Base64-Payload!
   ```
4. **`getMessagesForContext` in `conversation.ts`** schätzt die Token-Anzahl anhand von `msg.content`. Das Token-Budget beträgt standardmäßig `DEFAULT_MAX_TOKENS = 4000` (≈ 16 000 Zeichen). Ein realistisches PDF erzeugt ein Base64-Payload von mehreren Hundert KB – die Nachricht wurde **aus dem Kontextfenster verworfen**.
5. Das LLM erhielt keine Dateidaten und produzierte eine fehlerhafte Ausgabe.

### Phase 2: Base64 landet in Markdown-Persistenz (dieser Fix)

Selbst nach dem Phase-1-Fix – der Base64 aus `msg.content` herausgehalten hat – verblieb das vollständige `toolCallInfo.result` (inklusive Base64) in der Konversation. Beim Speichern als Markdown-Datei über `formatMessageLines` wurde dieses Ergebnis vollständig serialisiert:

```typescript
lines.push(`Result: ${JSON.stringify(msg.toolCall.result)}`);
// → Result: {"filePath":"...", "base64":"<mehrere MB>", "mimeType":..., "size":...}
```

Das bedeutete: Die Markdown-Datei enthielt mehrere Megabytes Base64-Rohdaten, die für eine lesbare Konversationsdatei völlig ungeeignet sind.

---

## Lösung

### Fix 1 (bereits vorhanden): `src/core/orchestrator.ts` – `executeToolCall`

`msg.content` enthält nur noch Metadaten `{ filePath, mimeType, size }`, niemals Base64. Das vollständige Ergebnis bleibt in `toolCallInfo.result` für `buildLLMMessages`.

### Fix 2 (dieser PR): `src/core/conversation.ts` – `formatMessageLines`

Beim Serialisieren eines `read_binary_file`-Tool-Ergebnisses als Markdown wird der `base64`-Schlüssel aus dem `Result:` herausgehalten. Stattdessen wird:
- Ein **Wikilink** `[[filePath]]` eingefügt (lesbar in Obsidian)
- Ein `_binaryRef`-Feld im `Result:` gespeichert, das den Pfad der Binary referenziert

**Vorher:**
```typescript
lines.push(`Result: ${JSON.stringify(msg.toolCall.result)}`);
// → mehrere MB Base64 in der Markdown-Datei
```

**Nachher:**
```typescript
const { base64: _omit, ...metadata } = result;
const filePath = metadata["filePath"] as string;
lines.push(`[[${filePath}]]`);
lines.push(`Result: ${JSON.stringify({ ...metadata, _binaryRef: filePath })}`);
// → nur Metadaten + Wikilink, keine Base64
```

Das gespeicherte Markdown sieht nun so aus:
```markdown
### Tool (2026-03-09T10:00:00.000Z)
<!-- tool:read_binary_file -->
<!-- params:{"filePath":"pdfs/report.pdf"} -->
[[pdfs/report.pdf]]
Result: {"filePath":"pdfs/report.pdf","mimeType":"application/pdf","size":2048,"_binaryRef":"pdfs/report.pdf"}
```

### Fix 3 (dieser PR): `src/core/conversation-file-manager.ts` – `loadConversation`

Beim Laden einer Konversation aus einer Markdown-Datei wird `restoreBinaryResults` aufgerufen. Diese Methode:
1. Durchsucht alle Nachrichten nach `read_binary_file`-Tool-Ergebnissen mit `_binaryRef`
2. Liest die referenzierte Binärdatei erneut aus dem Vault
3. Konvertiert sie in Base64 und injiziert das Payload zurück in `toolCallInfo.result`
4. Entfernt das `_binaryRef`-Feld aus dem In-Memory-Ergebnis

So hat der Agent nach dem Laden einer Konversation wieder vollen Zugriff auf die Binärdaten, ohne dass diese je auf Disk geschrieben wurden.

---

## Neue Tests

### `tests/unit/core/conversation.spec.ts`

- **„should NOT include base64 payload for read_binary_file tool results"** – prüft, dass base64 nicht in `toMarkdown` landet
- **„should include a wikilink for read_binary_file and store _binaryRef in Result"** – prüft Wikilink und `_binaryRef`
- **„should persist read_binary_file result with _binaryRef and no base64 via toConversationFile"** – prüft den vollständigen Serialisierungsweg inkl. `loadFromConversationFile`

### `tests/unit/core/conversation-file-manager.spec.ts`

- **„should restore base64 for read_binary_file tool results when loading"** – prüft den vollständigen Round-Trip: Speichern → kein Base64 auf Disk → Laden → Base64 wiederhergestellt
- **„should gracefully handle a missing binary file during restore"** – prüft, dass fehlende Binärdateien keine Exception auslösen

---

## Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/core/conversation.ts` | `formatMessageLines`: Base64 wird nicht serialisiert; Wikilink + `_binaryRef` werden gespeichert |
| `src/core/conversation-file-manager.ts` | `loadConversation`: `restoreBinaryResults` stellt Base64 beim Laden wieder her |
| `tests/unit/core/conversation.spec.ts` | 3 neue Tests für Serialisierung/Deserialisierung |
| `tests/unit/core/conversation-file-manager.spec.ts` | 2 neue Tests für Round-Trip und Fehlerbehandlung |

---

## Technischer Kontext: OCR-Datenfluss nach allen Fixes

```
User: "Bitte konvertiere DA_2026_11.pdf in Markdown"
  │
  ├─ LLM: ruft read_binary_file("DA_2026_11.pdf") auf
  │
  ├─ Tool: liest PDF als ArrayBuffer → Base64
  │        Ergebnis: { filePath, base64, mimeType, size }
  │
  ├─ executeToolCall (orchestrator.ts) speichert in Konversation:
  │   msg.content     = { filePath, mimeType, size }   ← klein, kein Base64 (Fix 1)
  │   toolCallInfo.result = { filePath, base64, mimeType, size }  ← vollständig
  │
  ├─ getMessagesForContext: msg bleibt im Kontextfenster (Token-Budget ok)
  │
  ├─ buildLLMMessages: erkennt READ_BINARY_FILE-Nachricht, liest base64 aus
  │   toolCallInfo.result und erzeugt:
  │   { role: "user", content: [{ type: "file", file: { data: "data:application/pdf;base64,..." } }] }
  │
  ├─ OpenRouter: sendet Datei mit file-parser Plugin an Mistral OCR
  │
  ├─ LLM: gibt Markdown-Text zurück
  │
  ├─ Agent: write_file → finish_task
  │
  ├─ Konversation wird als Markdown gespeichert:
  │   → [[DA_2026_11.pdf]] Wikilink, kein Base64 (Fix 2)
  │   → Result: { filePath, mimeType, size, _binaryRef: "DA_2026_11.pdf" }
  │
  └─ Beim Laden der Konversation:
      → Binary wird automatisch aus Vault re-gelesen (Fix 3)
      → base64 wird in-memory wiederhergestellt
      → _binaryRef wird entfernt
```

