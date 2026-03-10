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

## Abwärtskompatibilität

- Aufrufe **ohne** `saveTo` verhalten sich identisch wie bisher (Base64 wird zurückgegeben).
- Die Base64-Löschung in `buildLLMMessages` ist transparent: Das Verhalten aus Sicht der LLM ist unverändert.
- Bestehende Konversationsdateien auf Disk werden korrekt wiederhergestellt (Restore-Logik unverändert).

---

## Offene Arbeiten

- [ ] **Temporäre Chunk-Dateien aufräumen**: Die unter `saveTo` gespeicherten Chunk-PDFs (`_chunks/*.pdf`) werden nach der OCR-Verarbeitung nicht automatisch gelöscht. Der Agent oder ein separater Cleanup-Schritt sollte sie nach der Konvertierung entfernen.
- [ ] **`ConversationFileManager.restorePdfChunks` für `PdfChunkSavedResult` erweitern**: Wenn eine gespeicherte Konversation einen `chunkPath`-Eintrag enthält (saveTo-Modus), sollte beim Laden automatisch `read_binary_file` auf diesem Pfad aufgerufen werden – analog zur bestehenden Restore-Logik.
- [ ] **Vault-Mock für `modifyBinary` verbessern**: Der aktuelle Mock speichert Binärdaten als Sentinel-String. Für Tests, die den tatsächlichen Binärinhalt prüfen, sollte ein vollwertiger `ArrayBuffer`-Store implementiert werden.
- [ ] **Maximale Chunk-Größe in Mobileinstellungen konfigurierbar machen**: Aktuell ist `TARGET_CHUNK_SIZE = 15 MB` fest verdrahtet. Ein konfigurierbarer Wert (z. B. aus den Plugin-Einstellungen) würde die Anpassung an ältere oder eingeschränktere Geräte erleichtern.
