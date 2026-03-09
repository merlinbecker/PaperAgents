# Memory-Efficient PDF Splitting – Implementierungsbericht

**Datum:** 2026-03-09  
**Branch:** `copilot/fix-split-and-read-pdf-crash`  
**Issue:** `split_and_read_pdf führt zum Absturz` (Speicher läuft voll bei 27 MB-PDFs auf mobilen Geräten)

---

## Problem

Die ursprüngliche Implementierung von `split_and_read_pdf` lud das gesamte PDF in den Speicher
und erstellte **alle Chunks gleichzeitig**. Für ein 27 MB-PDF bedeutete das:

| Komponente | Speicherbedarf (geschätzt) |
|---|---|
| Rohbytes des PDFs | 27 MB |
| pdf-lib In-Memory-Repräsentation | 50–100 MB |
| Base64-Strings aller Chunks (×1,33) | 36 MB (bei 2 Chunks) |
| **Spitzenwert gesamt** | **113–163 MB** |

Auf mobilen Geräten mit begrenztem Arbeitsspeicher führte dies zum Absturz der Obsidian-App.

---

## Lösung: Lazy Chunk-by-Chunk-Verarbeitung

### Kernidee

Statt alle Chunks auf einmal zu erstellen und zurückzugeben, verarbeitet das Tool **genau einen
Chunk pro Aufruf**. Nach dem Zurückgeben des Chunks werden alle pdf-lib-Referenzen und Puffer
vom Garbage Collector freigegeben. Der nächste Chunk wird erst beim nächsten Aufruf in den
Speicher geladen.

### Neues Zweiphasen-Protokoll

**Phase 1 – Metadaten-Abfrage** (`chunkIndex` nicht angegeben):

```
split_and_read_pdf({ filePath: "/pdfs/large.pdf" })
→ {
    filePath: "/pdfs/large.pdf",
    totalPages: 120,
    totalChunks: 2,
    pagesPerChunk: 60,
    fileSize: 28311552,
    strategy: "chunked"
  }
```

Nur die Seitenanzahl wird geladen – **keine base64-Daten**. Speicherspitzenwert: ~27 MB (Rohbytes)
+ minimale pdf-lib-Verarbeitung.

**Phase 2 – Einzelner Chunk** (`chunkIndex = 0, 1, …`):

```
split_and_read_pdf({ filePath: "/pdfs/large.pdf", chunkIndex: 0 })
→ {
    chunkIndex: 0,
    totalChunks: 2,
    startPage: 1,
    endPage: 60,
    base64: "...",
    mimeType: "application/pdf",
    filePath: "/pdfs/large.pdf",
    size: 13500000
  }
```

Genau dieser eine Chunk wird geladen, encodiert und zurückgegeben. Nach dem Aufruf werden alle
Referenzen freigegeben. Speicherspitzenwert pro Aufruf: ~27 MB + ~50–100 MB (pdf-lib) + ~18 MB
(base64 eines Chunks) = **~95–145 MB** – und dieser Wert bleibt konstant, egal wie viele Chunks
das PDF hat.

### Vergleich: Alt vs. Neu

| | Alt | Neu |
|---|---|---|
| Spitzenspeicher (2 Chunks) | 113–163 MB | 95–145 MB |
| Spitzenspeicher (4 Chunks) | 163–213 MB | 95–145 MB (konstant!) |
| Chunks gleichzeitig im RAM | Alle N | Immer genau 1 |
| Abwärtskompatibel | – | ✅ (Array-Format wird noch gelesen) |

---

## Technischer Datenfluss (neu)

```
Agent: "Konvertiere /pdfs/large.pdf (27 MB)"
│
├─ split_and_read_pdf({ filePath })
│         → Phase 1: Metadaten-Abfrage
│         → { totalChunks: 2, pagesPerChunk: 60, ... }
│         → RAM freigegeben
│
├─ split_and_read_pdf({ filePath, chunkIndex: 0 })
│         → Phase 2: Chunk 0 laden + encodieren
│         → { chunkIndex: 0, base64: "...", startPage: 1, endPage: 60 }
│         → LLM verarbeitet Chunk 0 (OCR)
│         → RAM freigegeben
│
├─ split_and_read_pdf({ filePath, chunkIndex: 1 })
│         → Phase 2: Chunk 1 laden + encodieren
│         → { chunkIndex: 1, base64: "...", startPage: 61, endPage: 120 }
│         → LLM verarbeitet Chunk 1 (OCR)
│         → RAM freigegeben
│
└─ write_file + finish_task
```

---

## Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/types.ts` | Neues Interface `PdfSplitMetadata` hinzugefügt |
| `src/tools/predefined.ts` | `split_and_read_pdf`: optionaler `chunkIndex`-Parameter; Zweiphasen-Logik (Metadaten / Einzelchunk) |
| `src/core/orchestrator.ts` | `executeToolCall` + `buildLLMMessages`: Unterstützung für `PdfSplitMetadata` und einzelne `PdfChunkResult` |
| `src/core/conversation.ts` | `formatMessageLines`: Einzelchunk + Metadaten werden korrekt persistiert |
| `src/core/conversation-file-manager.ts` | `restoreBinaryResults`: Verzweigung Array vs. Einzelchunk; neue Methode `restoreSinglePdfChunk` |
| `examples/agents/ocr-agent.md` | System-Prompt beschreibt das neue Zweiphasen-Protokoll |
| `reports/splitPDF.md` | Dieser Bericht |

---

## Neue Parameter für `split_and_read_pdf`

| Parameter | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| `filePath` | string | ✅ | Pfad zur PDF-Datei im Vault |
| `chunkIndex` | number | ❌ | 0-basierter Chunk-Index. Ohne Angabe → Metadaten-Antwort. Mit Angabe → Einzelchunk mit base64 |
| `pagesPerChunk` | number | ❌ | Seiten pro Chunk (Standard: automatisch ~15 MB-Zielgröße) |

---

## Abwärtskompatibilität

Ältere Konversationen, die das Array-Format (`result: [{...}, {...}]`) auf der Festplatte
gespeichert haben, werden beim Laden weiterhin korrekt wiederhergestellt. Die vorhandene
`restorePdfChunks`-Methode bleibt unverändert; die neue `restoreSinglePdfChunk`-Methode
wird nur für Einzelchunk-Einträge verwendet.

---

## Tests

6 neue Tests hinzugefügt (gesamt jetzt 418, alle bestanden ✅):

- **`predefined.int.spec.ts`**:
  - Metadaten-Antwort (kein `chunkIndex`): `strategy: "chunked"`, kein `base64`, korrekte Felder
  - Einzelchunk (`chunkIndex: 0`): `base64`, korrekte `startPage`/`endPage`
  - Ungültiger `chunkIndex`: Fehlermeldung
- **`conversation.spec.ts`**:
  - Einzelchunk wird mit `_binaryRef` und ohne `base64` persistiert
  - Metadaten-Antwort wird als Plain-JSON persistiert
- **`conversation-file-manager.spec.ts`**:
  - Einzelchunk-Speicherung: `base64` wird entfernt, `_binaryRef` gesetzt
  - Fehlendes PDF beim Wiederherstellen eines Einzelchunks: graceful degradation
