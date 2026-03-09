# Plan: PDF-Splitting für mobile Geräte bei Binärdateien über 20 MB

## Ziel

Wenn auf einem **mobilen Gerät** eine **PDF-Datei über 20 MB** über das `read_binary_file`-Tool geladen werden soll, soll die PDF automatisch in kleinere Teile aufgeteilt werden. Jeder Teil wird separat base64-kodiert und in einem iterativen Prozess an das LLM gesendet. Die Teilergebnisse werden am Ende zusammengeführt.

---

## Hintergrund

Das bestehende `ReadBinaryFileTool` lehnt auf mobilen Geräten Dateien über 20 MB ab:

```
File too large: /pdfs/bigpaper.pdf (32.1 MB).
Maximum supported size on this platform is 20 MB.
```

Der Grund ist die hohe Speicherbelastung durch mehrfache In-Memory-Kopien bei der Base64-Konvertierung (ArrayBuffer + Binary String + Base64 + JSON-Body). Auf Mobilgeräten kann dies zum Absturz der App führen.

**Lösung**: PDFs seitenweise in Teile aufteilen, jeden Teil separat konvertieren und einzeln an das LLM senden. Da PDF ein binäres Format mit einer Seitenstruktur ist, ist eine seitenbasierte Aufteilung der natürlichste Ansatz.

---

## Bedingungen für PDF-Splitting

Das Splitting wird **ausschließlich** unter allen folgenden Bedingungen aktiviert:

| Bedingung | Wert |
|-----------|------|
| Plattform | `Platform.isMobile === true` |
| Dateityp | MIME-Type `application/pdf` (Endung `.pdf`) |
| Dateigröße | `> MAX_BINARY_FILE_BYTES_MOBILE` (20 MB) |

Auf Desktop-Geräten gelten weiterhin die 50 MB Grenze ohne Splitting.

---

## Bibliothek

**`pdf-lib`** (npm-Paket `pdf-lib`, MIT-Lizenz) wird als reine TypeScript/JavaScript-Bibliothek verwendet. Sie läuft ohne native Abhängigkeiten im Browser und in Capacitor (iOS/Android) und erlaubt das Auslesen der Seitenanzahl sowie das Erstellen von Teil-PDFs.

- Keine nativen Module
- Läuft im Browser/Capacitor-Kontext (Obsidian Mobile)
- Erzeugt gültige PDF-Dokumente aus Seitenbereichen des Originals

> **Alternative (ohne Bibliothek):** Byte-basiertes Aufteilen nach dem PDF-Cross-Reference-Tabellen-Offset. Diese Methode ist fehleranfälliger und schwerer zu implementieren. Bevorzugt wird `pdf-lib`.

---

## Architektur

### Neues Tool: `split_and_read_pdf`

Ein neues Predefined Tool `split_and_read_pdf` übernimmt das Splitting-Verhalten. Dadurch bleibt `read_binary_file` unverändert und abwärtskompatibel.

**Alternative:** Erweiterung von `read_binary_file` mit optionalem Parameter `splitOnMobile: boolean`. Weniger bevorzugt, da es die bestehende API verändert.

### Neue Konstante

```typescript
// src/utils/constants.ts
PREDEFINED_TOOL_IDS.SPLIT_AND_READ_PDF = "split_and_read_pdf"
```

### Neues Tool-Parameter-Schema

```typescript
// Parameter für split_and_read_pdf
{
  filePath: string;       // Pflichtfeld: Pfad zur PDF im Vault
  pagesPerChunk?: number; // Optional: Seiten pro Teilpaket (Default: automatisch berechnet)
}
```

---

## Komponenten

### 1. Konstanten (`src/utils/constants.ts`)

```typescript
PREDEFINED_TOOL_IDS.SPLIT_AND_READ_PDF = "split_and_read_pdf"
```

### 2. Predefined Tools (`src/tools/predefined.ts`)

#### `SplitAndReadPdfTool`

```
Aufruf: split_and_read_pdf({ filePath: "/pdfs/large.pdf" })

Verhalten:
1. Dateigröße und Plattform prüfen
2. Wenn NICHT (mobile + PDF + >20 MB): Delegiere an ReadBinaryFileTool (kein Splitting)
3. Wenn Splitting nötig:
   a. PDF mit pdf-lib laden (PDFDocument.load)
   b. Gesamtseitenanzahl bestimmen
   c. Falls Seitenanzahl == 1: Fehler zurückgeben mit Meldung:
      "PDF too large for mobile: file is X MB but contains only 1 page and
       cannot be split further. Please reduce the file size or use a desktop device."
   d. pagesPerChunk berechnen (Ziel: jeder Chunk < 15 MB)
   e. Chunks erzeugen: PDFDocument kopieren, Teilbereich der Seiten extrahieren
   f. Jeden Chunk als ArrayBuffer serialisieren, base64 kodieren
4. Rückgabe: Array von Chunk-Objekten mit jeweils:
   {
     chunkIndex: number,
     totalChunks: number,
     startPage: number,
     endPage: number,
     base64: string,
     mimeType: "application/pdf",
     filePath: string,
     size: number,
   }
```

**Chunking-Strategie:**
```
pagesPerChunk = ceil(totalPages / ceil(fileSize / TARGET_CHUNK_SIZE))
TARGET_CHUNK_SIZE = 15 * 1024 * 1024  // 15 MB Zielgröße pro Chunk
```

### 3. Orchestrator (`src/core/orchestrator.ts`)

#### Anpassung in `executeToolCall`

Wenn `toolName === PREDEFINED_TOOL_IDS.SPLIT_AND_READ_PDF` und das Ergebnis ein Array von Chunks enthält:
- Jeden Chunk als separates Nachrichten-Paar (tool-result + user-file) in den Konversationsverlauf aufnehmen
- Jeder Chunk bekommt einen eigenen `toolCallInfo` mit `chunkIndex`/`totalChunks` als Metadaten

#### Anpassung in `buildLLMMessages`

Für `toolCallId === SPLIT_AND_READ_PDF`:
- Wenn Ergebnis ein Array: Für jeden Chunk ein `{ type: "file", ... }` Content-Part erzeugen
- Chunks in aufsteigender Reihenfolge an das LLM senden
- Kontext-Nachricht hinzufügen: `"PDF wurde in {N} Teile aufgeteilt (Seiten {x}–{y}). Verarbeite jeden Teil einzeln."`

### 4. Typen (`src/types.ts`)

```typescript
export interface PdfChunkResult {
  chunkIndex: number;
  totalChunks: number;
  startPage: number;
  endPage: number;
  base64: string;
  mimeType: "application/pdf";
  filePath: string;
  size: number;
}
```

### 5. Conversation-Persistenz (`src/core/conversation.ts`)

Analog zu `READ_BINARY_FILE`: Bei `SPLIT_AND_READ_PDF` wird beim Speichern der Konversation die `base64`-Daten aller Chunks entfernt und durch `_binaryRef` + `chunkIndex` ersetzt.

Beim Laden (`ConversationFileManager`) werden alle Chunks aus der Original-PDF re-generiert.

### 6. Beispiel-Agent (`examples/agents/ocr-agent.md`)

Der bestehende OCR-Agent kann optional um `split_and_read_pdf` erweitert werden:

```yaml
tools:
  - split_and_read_pdf    # Ersetzt read_binary_file für große PDFs
  - write_file
  - file_parser
```

System-Prompt-Erweiterung:
```
Wenn eine PDF zu groß ist, wird sie automatisch in Teile aufgeteilt.
Verarbeite jeden Teil mit dem file_parser-Plugin und kombiniere die Ergebnisse.
```

---

## Workflow

```
User: "Konvertiere /pdfs/large.pdf (32 MB) in Markdown"
  │
  ├─ Agent: split_and_read_pdf("/pdfs/large.pdf")
  │         → Plattform: mobile, Größe: 32 MB > 20 MB, Typ: PDF
  │         → pdf-lib lädt PDF: 120 Seiten
  │         → pagesPerChunk: 60 (2 Chunks à ~16 MB)
  │         → Chunk 1: Seiten 1–60 → base64 (ca. 16 MB)
  │         → Chunk 2: Seiten 61–120 → base64 (ca. 16 MB)
  │         → Rückgabe: [{ chunkIndex: 0, ... }, { chunkIndex: 1, ... }]
  │
  ├─ Orchestrator: sendet Chunk 1 an LLM (file-parser Plugin)
  │         → Mistral OCR: verarbeitet Seiten 1–60 → Markdown (Teil 1)
  │
  ├─ Orchestrator: sendet Chunk 2 an LLM (file-parser Plugin)
  │         → Mistral OCR: verarbeitet Seiten 61–120 → Markdown (Teil 2)
  │
  ├─ Agent: kombiniert Markdown Teil 1 + Teil 2
  │
  ├─ Agent: write_file("/notes/large.md", kombiniertes Markdown, overwrite: true)
  │
  └─ Agent: finish_task("PDF wurde in 2 Teilen konvertiert und gespeichert unter /notes/large.md")
```

---

## Speicherverwaltung

Um Speicherüberlastung zu vermeiden, werden Chunks sequenziell verarbeitet:

1. Chunk 1 erzeugen → an LLM senden → base64 aus Speicher freigeben
2. Chunk 2 erzeugen → an LLM senden → base64 aus Speicher freigeben
3. ...

Kein gleichzeitiges Halten aller Chunks im Arbeitsspeicher.

**Ziel-Chunk-Größe**: 15 MB (vor base64-Kodierung), ca. 20 MB nach base64-Kodierung.

---

## Nicht im Scope (Initial-Implementation)

- Splitting für andere Binärformate als PDF (JPEG, PNG, DOCX)
- Splitting auf Desktop-Geräten
- Parallele (gleichzeitige) Verarbeitung mehrerer Chunks
- Fortschrittsanzeige während des Splittings
- Manuelle Angabe von Seitenbereichen durch den Nutzer
- Caching gespaltener Chunks auf dem Dateisystem

---

## Abhängigkeiten

| Paket | Version | Lizenz | Zweck |
|-------|---------|--------|-------|
| `pdf-lib` | `^1.17.1` | MIT | PDF laden, Seiten extrahieren, Teil-PDFs erzeugen |

Vor der Implementierung: Sicherheitsprüfung via `gh-advisory-database`.

---

## Implementierungsreihenfolge

1. **`package.json`** – `pdf-lib` als Abhängigkeit hinzufügen
2. **`src/utils/constants.ts`** – `PREDEFINED_TOOL_IDS.SPLIT_AND_READ_PDF` ergänzen
3. **`src/types.ts`** – `PdfChunkResult`-Interface
4. **`src/tools/predefined.ts`** – `SplitAndReadPdfTool` + `SplitAndReadPdfFactory`
5. **`src/core/orchestrator.ts`** – Chunk-Handling in `executeToolCall` + `buildLLMMessages`
6. **`src/core/conversation.ts`** – Persistenz: base64-Stripping für Chunks
7. **`src/core/conversation-file-manager.ts`** – Chunk-Wiederherstellung beim Laden
8. **`examples/agents/ocr-agent.md`** – Optionale Erweiterung des OCR-Agenten
9. **Tests** – Unit-Tests für Chunking-Logik, Orchestrator-Integration

---

## Testfälle

| Szenario | Erwartetes Verhalten |
|----------|---------------------|
| Desktop + PDF > 20 MB | Kein Splitting, ReadBinaryFileTool-Verhalten |
| Mobile + PDF < 20 MB | Kein Splitting, ReadBinaryFileTool-Verhalten |
| Mobile + nicht-PDF > 20 MB | Fehler (wie bisher), kein Splitting |
| Mobile + PDF > 20 MB | Splitting aktiv, Chunks werden einzeln verarbeitet |
| Mobile + PDF > 20 MB (1 Seite) | Fehlermeldung: `"PDF too large for mobile: file is X MB but contains only 1 page and cannot be split further. Please reduce file size or use a desktop device."` – kein Absturz, klarer Hinweis an den Nutzer |
| Mobile + PDF > 20 MB (N Seiten) | Chunks werden korrekt aufgeteilt (Chunk-Größen < 15 MB) |
| Konversation laden nach Splitting | Chunks werden aus Original-PDF re-generiert |
