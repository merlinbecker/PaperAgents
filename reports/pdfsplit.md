# PDF-Splitting – Implementierungsstand

**Datum:** 2026-03-09  
**Branch:** `copilot/implement-pdfsplit-plan`  
**Plan:** `plans/pdfSplit.md`

---

## Erledigte Tätigkeiten

### 1. Abhängigkeit `pdf-lib` hinzugefügt ✅

- `package.json`: `pdf-lib@^1.17.1` als Laufzeit-Abhängigkeit ergänzt
- Vor Hinzufügung Sicherheitsprüfung via `gh-advisory-database` – keine bekannten Sicherheitslücken

### 2. Konstante `PREDEFINED_TOOL_IDS.SPLIT_AND_READ_PDF` ✅

- `src/utils/constants.ts`: `SPLIT_AND_READ_PDF: "split_and_read_pdf"` in `PREDEFINED_TOOL_IDS` ergänzt

### 3. Typ `PdfChunkResult` ✅

- `src/types.ts`: Interface `PdfChunkResult` hinzugefügt:
  ```typescript
  export interface PdfChunkResult {
    chunkIndex: number;
    totalChunks: number;
    startPage: number;   // 1-basiert
    endPage: number;     // 1-basiert
    base64: string;
    mimeType: "application/pdf";
    filePath: string;
    size: number;
  }
  ```

### 4. `SplitAndReadPdfTool` + `SplitAndReadPdfFactory` ✅

- `src/tools/predefined.ts`: Neues Tool `split_and_read_pdf` implementiert
- **Splitting-Bedingungen**: mobil + PDF + > 20 MB (sonst Delegation an `ReadBinaryFileTool`)
- **Chunking-Strategie**: `pagesPerChunk = ceil(totalPages / ceil(fileSize / 15 MB))`
- **pdf-lib** wird per dynamic import geladen (`await import("pdf-lib")`) – kein Overhead bei Nichtbenutzung
- Fehlerfall bei 1-seitiger, zu großer PDF: sprechende Fehlermeldung mit Hinweis auf Desktop
- Optionaler Parameter `pagesPerChunk` für manuelle Steuerung
- `PredefinedToolsFactory` um `splitAndReadPdf` erweitert

### 5. Orchestrator: Chunk-Handling ✅

- `src/core/orchestrator.ts`:
  - **`executeToolCall`**: Bei `SPLIT_AND_READ_PDF` wird `base64` aus jedem Chunk für `msg.content` entfernt (nur Metadaten), das vollständige Ergebnis bleibt in `toolCallInfo.result`
  - **`buildLLMMessages`**: Für `SPLIT_AND_READ_PDF` werden alle Chunks als einzelne `{ role: "user", content: [text, file] }`-Nachrichten in aufsteigender Reihenfolge formatiert; Kontexthinweis (Teil X von N, Seitenbereich) wird vorangestellt

### 6. Konversations-Persistenz ✅

- `src/core/conversation.ts` – `formatMessageLines`:
  - Bei `SPLIT_AND_READ_PDF` wird `base64` aus allen Chunks entfernt
  - Wikilink `[[filePath]]` wird gespeichert
  - Jeder Chunk erhält ein `_binaryRef`-Feld (Pfad zur Original-PDF) für die spätere Wiederherstellung

### 7. Chunk-Wiederherstellung beim Laden ✅

- `src/core/conversation-file-manager.ts`:
  - `restoreBinaryResults` um `split_and_read_pdf`-Handling erweitert
  - Neue Methode `restorePdfChunks`: Lädt die Original-PDF einmalig, erzeugt alle Chunks per `pdf-lib` neu und injiziert `base64` zurück in den In-Memory-Zustand
  - Fehlerbehandlung: fehlende PDF → graceful degradation (Chunks ohne `base64`), kein Absturz

### 8. OCR-Agenten-Beispiel aktualisiert ✅

- `examples/agents/ocr-agent.md`:
  - `split_and_read_pdf` als weiteres Tool ergänzt
  - System-Prompt erweitert: Workflow für große PDFs und Chunk-Verarbeitung beschrieben

### 9. Registrierung in `main.ts` ✅

- `src/main.ts`: `PredefinedToolsFactory.splitAndReadPdf` in `registerPredefinedTools` ergänzt
- Tool-Zähler von 9 auf 10 aktualisiert

### 10. Tests ✅

- **`tests/integration/tools/predefined.int.spec.ts`**: 7 neue Tests für `split_and_read_pdf`:
  - Delegation auf Desktop (kein Splitting)
  - Delegation auf Mobilgerät bei PDF < 20 MB
  - Delegation auf Mobilgerät bei Nicht-PDF
  - Fehler bei fehlender Datei
  - Kein HITL erforderlich
  - Splitting-Logik (pdf-lib gemockt): Chunk-Array mit korrekter Struktur
  - Fehler bei 1-seitiger großer PDF (pdf-lib gemockt)

- **`tests/unit/core/conversation.spec.ts`**: 1 neuer Test:
  - `split_and_read_pdf`-Chunks ohne `base64` persistieren, `_binaryRef` vorhanden

- **`tests/unit/core/conversation-file-manager.spec.ts`**: 3 neue Tests:
  - `base64` wird beim Speichern von Chunks entfernt
  - Fehlende Original-PDF beim Laden: graceful degradation
  - (vorhandener Test für `read_binary_file` unverändert beibehalten)

**Testergebnis:** 412 Tests, alle bestanden ✅

---

## Offene Tätigkeiten (nicht im Scope der Initialimplementierung)

Folgende Punkte wurden bewusst ausgeschlossen (vgl. Plan, Abschnitt „Nicht im Scope"):

- [ ] Splitting für andere Binärformate als PDF (JPEG, PNG, DOCX)
- [ ] Splitting auf Desktop-Geräten
- [ ] Parallele (gleichzeitige) Verarbeitung mehrerer Chunks
- [ ] Fortschrittsanzeige während des Splittings
- [ ] Manuelle Angabe von Seitenbereichen durch den Nutzer
- [ ] Caching gespaltener Chunks auf dem Dateisystem

---

## Geänderte Dateien

| Datei | Änderung |
|---|---|
| `package.json` | `pdf-lib@^1.17.1` als Abhängigkeit |
| `src/utils/constants.ts` | `PREDEFINED_TOOL_IDS.SPLIT_AND_READ_PDF` |
| `src/types.ts` | Interface `PdfChunkResult` |
| `src/tools/predefined.ts` | `SplitAndReadPdfTool`, `SplitAndReadPdfFactory`, Export |
| `src/core/orchestrator.ts` | Chunk-Handling in `executeToolCall` + `buildLLMMessages` |
| `src/core/conversation.ts` | `formatMessageLines`: base64-Stripping für Chunks |
| `src/core/conversation-file-manager.ts` | `restoreBinaryResults` + `restorePdfChunks` |
| `examples/agents/ocr-agent.md` | `split_and_read_pdf` ergänzt, System-Prompt erweitert |
| `src/main.ts` | `splitAndReadPdf` in `registerPredefinedTools` |
| `tests/integration/tools/predefined.int.spec.ts` | 7 neue Tests |
| `tests/unit/core/conversation.spec.ts` | 1 neuer Test |
| `tests/unit/core/conversation-file-manager.spec.ts` | 3 neue Tests |
| `reports/pdfsplit.md` | Dieser Bericht |

---

## Technischer Datenfluss (nach Implementierung)

```
User (mobil): "Konvertiere /pdfs/large.pdf (32 MB)"
  │
  ├─ Agent: split_and_read_pdf("/pdfs/large.pdf")
  │         → Plattform: mobile, Größe: 32 MB > 20 MB, Typ: PDF
  │         → pdf-lib lädt PDF: z. B. 120 Seiten
  │         → pagesPerChunk: 60 (2 Chunks à ~16 MB)
  │         → Chunk 1: Seiten 1–60 → base64
  │         → Chunk 2: Seiten 61–120 → base64
  │         → Ergebnis: [{ chunkIndex:0, ... }, { chunkIndex:1, ... }]
  │
  ├─ executeToolCall: speichert Metadaten in msg.content (kein base64)
  │   toolCallInfo.result = vollständige Chunks (mit base64)
  │
  ├─ buildLLMMessages: Chunk 1 → { role:"user", content:[text, file] }
  │                    Chunk 2 → { role:"user", content:[text, file] }
  │
  ├─ file_parser-Plugin: verarbeitet jeden Chunk → Markdown (Teil 1 + 2)
  │
  ├─ Agent: write_file + finish_task
  │
  ├─ Konversation gespeichert:
  │   → [[pdfs/large.pdf]] Wikilink, kein base64
  │   → _binaryRef pro Chunk gesetzt
  │
  └─ Beim Laden der Konversation:
      → restorePdfChunks re-generiert alle Chunks aus Original-PDF
      → base64 in-memory wiederhergestellt
```
