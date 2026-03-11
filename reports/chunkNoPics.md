# PDF OCR – Bilder aus Chunks entfernen

## Zusammenfassung

Der `pdf_ocr`-Tool überträgt PDF-Dokumente per OCR an ein LLM. Mistral-OCR bettete
Seiten-Bilder standardmäßig als Base64-Data-URLs in das erzeugte Markdown ein, was zu
unnötig großen Markdown-Dateien führte und Bildinhalt ans LLM weitergab, der dort nicht
benötigt wird. Dieses Feature entfernt Bilder aus dem OCR-Output, bevor die Markdown-Datei
gespeichert und ans LLM weitergegeben wird.

---

## Analyse der Möglichkeiten

### 1. PDF-Vorverarbeitung mit pdf-lib: Bilder vor der OCR entfernen

Die wichtigste Änderung: Bilder werden aus den PDF-Bytes entfernt, **bevor** das Dokument an die OCR-API gesendet wird. Dazu wird die bereits im Projekt enthaltene `pdf-lib`-Bibliothek verwendet.

Jede Seite eines PDF enthält ein `Resources`-Dictionary mit einem `XObject`-Subdictionary, das alle Bild-Referenzen des Typs `/Subtype /Image` enthält. Diese werden vor der Serialisierung gelöscht:

```typescript
for (const page of pdfDoc.getPages()) {
  const xObjects = /* Resources/XObject */;
  for (const key of xObjects.keys()) {
    const xobj = /* resolve ref */;
    if (xobj.dict.get(PDFName.of('Subtype')) === PDFName.of('Image')) {
      xObjects.delete(key); // Bild aus dem PDF entfernen
    }
  }
}
const strippedBytes = await pdfDoc.save({ useObjectStreams: false });
// → strippedBytes enthält kein Bild mehr
```

**Anwendung:**
- **Einzeldatei-Pfad** (Desktop/Mobile, kleines PDF): PDF wird mit pdf-lib geladen, Bilder werden entfernt, dann re-serialisiert und an die OCR-API gesendet.
- **Multi-Chunk-Pfad** (Mobile, großes PDF): Die Quelldatei (`pdfDoc`) wird einmalig vor der Chunk-Schleife bereinigt. Alle mit `copyPages()` kopierten Chunk-Seiten erben die bildfreien Resources.

**Hinweis:** Dieses Verfahren entfernt *referenzierte* XObject-Bilder — der häufigste Typ in wissenschaftlichen PDFs. Direkt in den Content-Streams eingebettete Inline-Bilder (`BI`/`EI`-Operatoren) werden nicht bereinigt; sie sind selten und werden durch die nachgelagerten Mechanismen (s.u.) abgedeckt.

### 2. API-seitig: `include_image_base64: false`

OpenRouter leitet den Option-Parameter `include_image_base64: false` an das
Mistral-OCR-Engine weiter:

```json
{
  "id": "file-parser",
  "pdf": {
    "engine": "mistral-ocr",
    "include_image_base64": false
  }
}
```

Damit signalisiert der Client dem OCR-Engine bereits beim API-Call, keine Base64-Bilddaten
in die Antwort einzubetten. Das reduziert Bandbreite und verhindert große Antwort-Payloads.

### 2. Instruktions-Prompting

Das System-Prompt an das LLM wird so formuliert, dass es ausdrücklich keine Bildbeschreibungen
oder Bild-Platzhalter zurückliefern soll:

> *"Extract and return only the text content of this document. Do not include images,
> image placeholders, or descriptions of images. Preserve the original text structure
> and formatting as faithfully as possible."*

Das ergänzt die API-Option: Auch wenn ein Modell trotzdem Bildtexte erzeugt, teilt das
Prompt dem Modell explizit mit, das nicht zu tun.

### 3. Post-Processing: Regex-Filterung im Markdown-Output

Als letzte Sicherheitsstufe wird der OCR-Text nach dem API-Call gefiltert. Die Funktion
`stripMarkdownImages` entfernt alle Markdown-Bildreferenzen mit einem Regex:

```
![alt text](url)
![](data:image/png;base64,…)
![Beschreibung](https://example.com/bild.jpg)
```

Der reguläre Ausdruck `!\[[^\]]*\]\([^)]*\)` matcht diese Muster sicher, ohne Base64-Daten
im Speicher verarbeiten zu müssen (Base64 enthält keine `)`, sodass `[^)]*` keine Backtracking-
Gefahr darstellt). Mehrfach aufeinanderfolgende Leerzeilen, die durch das Entfernen entstehen,
werden auf eine einzelne Leerzeile reduziert.

---

## Implementierung

### Neuer Parameter `stripImages`

```typescript
{
  name: "stripImages",
  type: "boolean",
  description:
    "When true (default), removes all image references and embedded image data …",
  required: false,
}
```

- **Default: `true`** – Bilder werden standardmäßig entfernt.
- `stripImages: false` behält das bisherige Verhalten (Bilder bleiben im Output).

### Verarbeitungsablauf bei `stripImages: true` (4 Ebenen)

1. **PDF-Vorverarbeitung** *(neu)*: pdf-lib entfernt alle XObject-Images aus dem PDF, bevor es kodiert und gesendet wird.
2. **API-Plugin-Option**: `include_image_base64: false` wird an den Mistral-OCR-Engine übergeben.
3. **Instruktions-Prompt**: Das LLM-Prompt fordert explizit nur Textinhalt an.
4. **Post-Processing**: `stripMarkdownImages()` entfernt alle verbleibenden `![…](…)` -Blöcke aus dem OCR-Ergebnis.

### Betroffene Dateien

| Datei | Änderung |
|---|---|
| `src/tools/pdf-ocr.ts` | Neuer Parameter `stripImages`; Hilfsfunktionen `stripImageXObjects` (pdf-lib) und `stripMarkdownImages` (Regex); `callOcr` akzeptiert und verarbeitet `stripImages` |
| `tests/integration/tools/pdf-ocr.int.spec.ts` | 7 neue Tests für das `stripImages`-Feature inkl. Pre-OCR-PDF-Stripping |

---

## Testergebnisse

```
Tests  25 passed (25)
```

Neue Tests:

- `calls PDFDocument.load and stripImageXObjects before encoding when stripImages is true` – Pre-OCR PDF-Strip wird aufgerufen.
- `skips PDFDocument.load when stripImages is false` – kein pdf-lib-Load wenn `stripImages: false`.
- `strips Markdown image syntax from OCR output by default (stripImages not set)` – Bilder werden standardmäßig entfernt.
- `strips images when stripImages is explicitly true` – explizit `true`; `include_image_base64: false` wird gesetzt.
- `keeps images in OCR output when stripImages is false` – `false` behält alle Bilder.
- `uses image-free OCR instruction when stripping images (default)` – korrekte Prompt-Formulierung.
- `uses full-content OCR instruction when stripImages is false` – ursprüngliche Prompt-Formulierung.

---

## Fazit

Die Implementierung kombiniert vier sich ergänzende Mechanismen:

1. **PDF-Vorverarbeitung** (pdf-lib): Image-XObjects werden direkt aus dem PDF entfernt, bevor es an die OCR-API gesendet wird — die Hauptmaßnahme.
2. **API-Option** (`include_image_base64: false`): Verhindert, dass der OCR-Engine Bild-Base64-Daten zurückgibt.
3. **Prompt-Instruktion**: Das LLM wird explizit angewiesen, keine Bilder zurückzuliefern.
4. **Post-Processing** (`stripMarkdownImages`): Entfernt alle verbleibenden `![…](…)`-Syntax als letzte Sicherheitsstufe.

Da `stripImages` standardmäßig `true` ist, ist das gewünschte Verhalten automatisch aktiv, ohne dass der Agent den Parameter explizit setzen muss.
