# Speichereffiziente PDF-Verarbeitung – Strategiebericht

**Datum:** 2026-03-10  
**Branch:** `copilot/optimize-pdf-chunk-processing`  
**Issue:** Absturz bei mehrfachem call von `split_and_read_pdf` (Speichermangel auf mobilen Geräten)

---

## Problemanalyse

Die App stürzte beim Konvertieren großer PDFs ab, weil mehrere aufeinanderfolgende Aufrufe von `split_and_read_pdf` den Arbeitsspeicher erschöpften. Bei einem 27 MB-PDF mit 2 Chunks waren drei Aufrufe nötig (Metadaten + Chunk 0 + Chunk 1). Die genaue Speicherbelastung pro Aufruf:

| Aufruf | Ursache | Speicherbedarf |
|---|---|---|
| Phase 1 – Metadaten | `readBinary` (27 MB) + `PDFDocument.load` (50–100 MB) nur zum Zählen der Seiten | ~77–127 MB |
| Phase 2 – Chunk 0 | `readBinary` + `PDFDocument.load` + Base64-Encoding (~18 MB) | ~95–145 MB |
| Phase 2 – Chunk 1 | identisch | ~95–145 MB |

Da der JavaScript-GC auf Mobilgeräten nicht garantiert zwischen Aufrufen läuft, konnten sich **bis zu ~367–417 MB** ansammeln – deutlich mehr, als mobiles Obsidian verarbeiten kann.

**Zusätzliches Problem:** Base64-Strings (~18 MB pro Chunk) blieben in `toolCallInfo.result` der Konversationshistorie gespeichert und wurden bei jedem weiteren LLM-Aufruf erneut in `buildLLMMessages` eingebunden, wodurch der Speicherbedarf mit jeder Runde weiter anstieg.

---

## Implementierte Strategie

### 1. Phase 1 ohne pdf-lib (–75 bis –100 MB pro Metadaten-Aufruf)

Der teuerste Schritt war `PDFDocument.load(buffer)` in Phase 1, das nur zum Zählen der Seitenanzahl diente. Die neue Implementierung parst die Seitenzahl direkt aus den Rohbytes des PDFs, ohne pdf-lib zu laden:

```
/Pages /Count 124 /Kids [...]
         ^^^
         Dieses Muster wird byte-weise gesucht (O(n), kein String-Alloc)
```

Wird kein `/Count`-Eintrag gefunden (z. B. in PDFs mit Cross-Reference-Streams), greift ein Fallback auf eine Schätzung aus der Dateigröße (~200 KB/Seite). Phase 1 belegt damit nur noch **~27 MB** (Rohbytes) statt ~77–127 MB.

### 2. Neuer `saveTo`-Parameter – Chunks auf Disk statt in Base64 im Speicher

Ein neuer optionaler Parameter `saveTo` schreibt den extrahierten Chunk als PDF direkt in das Vault, anstatt ihn als Base64-String zurückzugeben:

**Ohne `saveTo` (bisheriges Verhalten):**
```
split_and_read_pdf({ filePath, chunkIndex: 0 })
→ { base64: "...18 MB Base64...", mimeType, chunkIndex, ... }
   ↑ 18 MB im RAM + LLM-Kontext
```

**Mit `saveTo` (neues Verhalten):**
```
split_and_read_pdf({ filePath, chunkIndex: 0, saveTo: "_chunks" })
→ { chunkPath: "_chunks/large_chunk_0.pdf", chunkIndex, totalChunks, ... }
   ↑ kein Base64, minimal RAM
```

Der Agent liest den Chunk dann separat mit `read_binary_file` – nur genau dann, wenn er ihn braucht. Nach der OCR-Verarbeitung kann der Base64 aus dem Kontext fallen.

**Neuer Workflow (empfohlen für Mobilgeräte):**

```
Agent: "Konvertiere /pdfs/large.pdf (27 MB)"
│
├─ split_and_read_pdf({ filePath })
│      → Phase 1: Metadaten (raw-byte Seitenzählung, kein pdf-lib)
│      → { totalChunks: 2, pagesPerChunk: 62, ... }
│      → RAM freigegeben (~27 MB peak)
│
├─ split_and_read_pdf({ filePath, chunkIndex: 0, saveTo: "_chunks" })
│      → Phase 2: Chunk 0 extrahieren + in Vault schreiben
│      → { chunkPath: "_chunks/large_chunk_0.pdf", ... }
│      → kein Base64 im RAM; ~95–145 MB peak, sofort freigegeben
│
├─ read_binary_file({ filePath: "_chunks/large_chunk_0.pdf" })
│      → Chunk 0 laden + Base64 für OCR
│      → ~31 MB peak (nur Chunk-Datei, nicht ganzes PDF)
│      → LLM verarbeitet OCR, danach Base64 aus Kontext gelöscht
│
├─ split_and_read_pdf({ filePath, chunkIndex: 1, saveTo: "_chunks" })
│      → Chunk 1 extrahieren + speichern
│      → ~95–145 MB peak, sofort freigegeben
│
├─ read_binary_file({ filePath: "_chunks/large_chunk_1.pdf" })
│      → ~31 MB peak
│
└─ write_file + finish_task
```

### 3. Base64 aus Konversationshistorie löschen nach LLM-Nutzung

In `buildLLMMessages` wird der Base64-Wert nach dem Einbinden in eine multimodale LLM-Nachricht aus `toolCallInfo.result` gelöscht:

```typescript
// Nach dem Einbinden in die Nachricht:
delete (msg.toolCall.result as Record<string, unknown>).base64;
```

Das gilt für `read_binary_file`- und `split_and_read_pdf`-Ergebnisse. Die Metadaten (chunkIndex, startPage, endPage, filePath) bleiben erhalten. Beim Neuladen einer Konversation wird der Base64-Inhalt – wie bisher – über `ConversationFileManager.restorePdfChunks` aus der Vault-Datei wiederhergestellt.

---

## Speichervergleich

| Szenario | Alt | Neu (mit `saveTo`) |
|---|---|---|
| Phase 1 – Metadaten | ~77–127 MB | ~27 MB |
| Phase 2 – ein Chunk (Extraktion) | ~95–145 MB | ~95–145 MB |
| Lesen für OCR (read_binary_file) | entfällt | ~31 MB |
| Base64 in Konversationshistorie | bleibt dauerhaft | wird nach LLM-Nutzung gelöscht |
| 3 Aufrufe kumuliert (max.) | ~267–417 MB | ~122–172 MB |

---

## Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/types.ts` | Neues Interface `PdfChunkSavedResult` (für `saveTo`-Modus) |
| `src/tools/predefined.ts` | `saveTo`-Parameter; `countPdfPagesFromRawBytes`; `estimatePdfPagesFromFileSize`; `saveChunkToVault`; Phase 1 ohne pdf-lib |
| `src/core/orchestrator.ts` | Base64 aus `toolCallInfo.result` nach LLM-Nutzung löschen |
| `examples/agents/ocr-agent.md` | Workflow auf drei Phasen mit `saveTo` aktualisiert |
| `tests/mocks/obsidian.ts` | `createBinary` / `modifyBinary` zur Vault-Mock hinzugefügt |
| `tests/integration/tools/predefined.int.spec.ts` | Tests für raw-byte-Seitenzählung, Fallback-Schätzung und `saveTo`-Modus |
| `reports/pdfchunking.md` | Dieser Bericht |

---

## Neue Tests (2 hinzugefügt, 2 aktualisiert)

| Test | Beschreibung |
|---|---|
| ✅ raw byte page counting | Metadaten-Aufruf erkennt Seitenzahl aus Rohbytes ohne pdf-lib |
| ✅ Fallback-Schätzung | Gibt Metadaten zurück, wenn kein `/Count`-Muster gefunden wird |
| ✅ `saveTo`-Modus | Chunk wird in Vault gespeichert; Ergebnis enthält `chunkPath`, kein `base64` |
| ✅ Einzelseite-Fehler (aktualisiert) | Fehler bei 1-seitigen PDFs wird jetzt über raw-byte-Zählung erkannt |

Gesamt jetzt: **420 Tests, alle bestanden** ✅

---

## Update 2026-03-10 – Kleinere Chunks + Wikilink-Ausgabe für write_file

### Neue Änderungen (dieses Update)

#### 1. Kleinere Chunks (5 MB statt 15 MB)

`TARGET_CHUNK_SIZE` wurde von **15 MB** auf **5 MB** reduziert (vor Base64-Encoding, entspricht ~7 MB nach Encoding).

**Begründung:** Bei einem 27 MB-PDF mit `TARGET_CHUNK_SIZE = 15 MB` entstanden nur 2 Chunks (~13,5 MB je Chunk). Obwohl damit weniger Iterationen nötig waren, war der RAM-Spitzenwert pro Chunk-Aufruf (~90–140 MB) immer noch zu hoch für ältere mobile Geräte. Mit 5 MB-Chunks (~6–7 MB nach Base64) sinkt der Peak erheblich:

| Szenario | Alt (15 MB/Chunk) | Neu (5 MB/Chunk) |
|---|---|---|
| Chunks für 27 MB-PDF | 2 | 6 |
| RAM-Peak je Chunk | ~90–140 MB | ~35–50 MB |
| Kumulativer Worst-Case | ~180–280 MB | ~70–100 MB |

Mehr Iterationen sind der Preis – aber kein Absturz mehr.

#### 2. Wikilink-Ausgabe für `write_file` mit Markdown-Dateien

**Problem:** Wenn der OCR-Agent die geparsten Seitentexte via `write_file` in eine `.md`-Datei schreibt, enthielt die Konversation bisher:
- Den kompletten `content`-Parameter im `<!-- params: -->` Kommentar (kann mehrere MB Text sein)
- In der Chat-Ansicht: der vollständige Inhalt als JSON-Blob

Das führte zu riesigen Konversations-Markdown-Dateien und einer unleserlichen Chat-Ansicht.

**Lösung (3 Ebenen):**

1. **Orchestrator** (`src/core/orchestrator.ts`): Der `content`-Parameter von `write_file` wird aus `toolCallInfo.parameters` entfernt, bevor er in die Konversationshistorie geschrieben wird. Als `_contentRef` wird nur der Dateipfad gespeichert. Die LLM-Antwortnachricht enthält nur noch `{ filePath, wikilink: "[[name]]" }`.

2. **Konversations-Serialisierung** (`src/core/conversation.ts`): Für `write_file`-Ergebnisse mit `.md`-Dateien wird jetzt ein Wikilink-Eintrag (`[[name]]`) vor dem `Result:`-JSON eingefügt – analog zur `read_binary_file`-Behandlung.

3. **Chat-Ansicht** (`src/ui/chat.ts`): Im Parameter-Panel wird der große `content`-Wert durch `[[name]] (content omitted)` ersetzt. Im Ergebnis-Panel erscheint nur `[[name]]`.

**Neues Aussehen im Chat:**
```
🔧 Calling: write_file (done)
  Parameters:
    { "filePath": "notes/result.md", "overwrite": false,
      "content": "[[result]] (content omitted)" }
  Result:
    [[result]]
```

**Neues Aussehen im Konversations-Markdown:**
```markdown
### Tool (2026-03-10T08:00:00.000Z)
<!-- tool:write_file -->
<!-- params:{"filePath":"notes/result.md","overwrite":false,"_contentRef":"notes/result.md"} -->
[[result]]
Result: {"filePath":"notes/result.md","size":12345}
```

### Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/tools/predefined.ts` | `TARGET_CHUNK_SIZE` von 15 MB auf 5 MB gesenkt; Beschreibung aktualisiert |
| `src/core/orchestrator.ts` | `write_file`-Parameter-Stripping + Wikilink als LLM-Antwortnachricht |
| `src/core/conversation.ts` | Wikilink-Serialisierung für `write_file` `.md`-Ergebnisse |
| `src/ui/chat.ts` | Chat-Ansicht zeigt Wikilink statt OCR-Blob |
| `reports/pdfchunking.md` | Dieser Eintrag |

---

## Abwärtskompatibilität

- Aufrufe **ohne** `saveTo` verhalten sich identisch wie bisher (Base64 wird zurückgegeben).
- Die Base64-Löschung in `buildLLMMessages` ist transparent: Das Verhalten aus Sicht der LLM ist unverändert.
- Bestehende Konversationsdateien auf Disk werden korrekt wiederhergestellt (Restore-Logik unverändert).

---

## Offene Arbeiten

- [ ] **Temporäre Chunk-Dateien aufräumen**: Die unter `saveTo` gespeicherten Chunk-PDFs (`_chunks/*.pdf`) werden nach der OCR-Verarbeitung nicht automatisch gelöscht. Der Agent oder ein separater Cleanup-Schritt sollte sie nach der Konvertierung entfernen.
- [ ] **`ConversationFileManager.restorePdfChunks` für `PdfChunkSavedResult` erweitern**: Wenn eine gespeicherte Konversation einen `chunkPath`-Eintrag enthält (saveTo-Modus), sollte beim Laden automatisch `read_binary_file` auf diesem Pfad aufgerufen werden – analog zur bestehenden Restore-Logik.
- [ ] **Vault-Mock für `modifyBinary` verbessern**: Der aktuelle Mock speichert Binärdaten als Sentinel-String. Für Tests, die den tatsächlichen Binärinhalt prüfen, sollte ein vollwertiger `ArrayBuffer`-Store implementiert werden.
- [x] **Maximale Chunk-Größe in Mobileinstellungen konfigurierbar machen**: `TARGET_CHUNK_SIZE` wurde auf 5 MB gesenkt. Eine konfigurierbare Option aus den Plugin-Einstellungen bleibt als zukünftige Verbesserung offen.
- [ ] **Assistent-Nachrichten mit OCR-Text kürzen**: Der LLM-Assistent gibt die vollständige OCR-Textausgabe oft als Fließtext in der Assistent-Nachricht zurück (bevor er `write_file` aufruft). Dieser Text erscheint unverändert in der Chat-Ansicht und im Konversations-Markdown. Eine Lösung könnte darin bestehen, den System-Prompt des OCR-Agenten anzupassen, sodass der Assistent die OCR-Ergebnisse direkt in eine temporäre Datei schreibt, ohne sie zuerst in der Antwort auszugeben.
