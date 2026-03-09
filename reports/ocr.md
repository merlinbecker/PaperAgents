# OCR Agent – Arbeitsstand und Fix

**Datum:** 2026-03-09  
**Branch:** `copilot/fix-ocr-agent-base64-sending`

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

### Ablauf des Fehlers

1. Das LLM rief `read_binary_file("DA_2026_11.pdf")` auf.
2. Das Tool lief erfolgreich und gab zurück:
   ```json
   { "filePath": "...", "base64": "<mehrere MB Base64>", "mimeType": "application/pdf", "size": ... }
   ```
3. **`executeToolCall` in `orchestrator.ts`** speicherte das vollständige Ergebnis als Konversationsnachricht:
   ```typescript
   content: JSON.stringify(result.data)  // enthält das gesamte Base64-Payload!
   ```
4. **`getMessagesForContext` in `conversation.ts`** schätzt die Token-Anzahl einer Nachricht anhand von `msg.content`. Das Token-Budget beträgt standardmäßig `DEFAULT_MAX_TOKENS = 4000` (≈ 16 000 Zeichen). Ein realistisches PDF erzeugt jedoch ein Base64-Payload von typischerweise mehreren Hundert KB bis hin zu einigen MB – also hundertfach mehr als das Budget erlaubt.
5. Da `msgTokens > availableTokens`, trat der `break` im Iterationsschritt von `getMessagesForContext` ein. Die `read_binary_file`-Ergebnisnachricht **wurde aus dem Kontextfenster verworfen**.
6. In der nächsten Runde fehlte die Nachricht in `buildLLMMessages`. Der Code, der das Base64-Ergebnis als multimodales `file`-ContentPart formatiert, wurde **nie ausgeführt**.
7. Das LLM erhielt keine Dateidaten und produzierte eine fehlerhafte Ausgabe.

### Kernproblem

Das Base64-Payload gehört **nicht** in `msg.content` – der Konversationsspeicher ist nicht für mehrere MB Rohdaten ausgelegt. Das Payload wird ausschließlich von `buildLLMMessages` benötigt, das direkt auf `msg.toolCall.result` zugreift.

---

## Lösung

### Änderung: `src/core/orchestrator.ts` – `executeToolCall`

Beim Speichern des Ergebnisses eines `READ_BINARY_FILE`-Tool-Aufrufs wird der `base64`-Schlüssel aus `msg.content` herausgehalten. Das vollständige Ergebnis (inklusive Base64) verbleibt in `toolCallInfo.result` und wird von `buildLLMMessages` wie gehabt korrekt als multimodales `file`-ContentPart an das LLM übermittelt.

**Vorher:**
```typescript
this.conversationManager.addMessage(
  conversationId,
  "tool",
  JSON.stringify(result.data || result.error || "No output"),
  toolCallInfo
);
```

**Nachher:**
```typescript
let messageContent: string;
if (toolName === PREDEFINED_TOOL_IDS.READ_BINARY_FILE && result.data) {
  const { base64: _omit, ...metadata } = result.data as { base64?: string } & Record<string, unknown>;
  messageContent = JSON.stringify(metadata);
} else {
  messageContent = JSON.stringify(result.data || result.error || "No output");
}

this.conversationManager.addMessage(
  conversationId,
  "tool",
  messageContent,
  toolCallInfo
);
```

`msg.content` enthält nun nur noch `{ filePath, mimeType, size }` (wenige Hundert Bytes) statt mehrerer MB Base64-Daten. Damit bleibt die Token-Schätzung weit unterhalb des Limits, die Nachricht verbleibt im Kontextfenster, und das Base64-Payload wird in der nächsten Runde korrekt als `data:<mimeType>;base64,<base64>` an das LLM übermittelt.

---

## Neuer Test

In `tests/unit/core/orchestrator.spec.ts` wurde ein dritter Test zur `read_binary_file`-Testgruppe hinzugefügt:

> **„sends file data even when base64 payload exceeds the default token budget"**
>
> Simuliert ein großes Base64-Payload (> 16 000 Zeichen, entspricht > 4 000 geschätzten Tokens) und prüft, dass das `file`-ContentPart trotzdem korrekt in den zweiten LLM-Request injiziert wird.

Dieser Test würde **ohne den Fix fehlschlagen** und belegt die korrekte Funktion nach der Änderung.

---

## Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/core/orchestrator.ts` | `executeToolCall`: Base64 wird nicht in `msg.content` gespeichert |
| `tests/unit/core/orchestrator.spec.ts` | Neuer Test für große Base64-Payloads |

---

## Technischer Kontext: OCR-Datenfluss nach dem Fix

```
User: "Bitte konvertiere DA_2026_11.pdf in Markdown"
  │
  ├─ LLM: ruft read_binary_file("DA_2026_11.pdf") auf
  │
  ├─ Tool: liest PDF als ArrayBuffer → Base64
  │        Ergebnis: { filePath, base64, mimeType, size }
  │
  ├─ executeToolCall speichert in Konversation:
  │   msg.content     = { filePath, mimeType, size }   ← klein, kein Base64!
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
  └─ Agent: write_file → finish_task
```
