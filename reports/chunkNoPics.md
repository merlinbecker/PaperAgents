# PDF OCR – Bilder aus Chunks entfernen

## Zusammenfassung

Der `pdf_ocr`-Tool überträgt PDF-Dokumente per OCR an ein LLM. Mistral-OCR bettete
Seiten-Bilder standardmäßig als Base64-Data-URLs in das erzeugte Markdown ein, was zu
unnötig großen Markdown-Dateien führte und Bildinhalt ans LLM weitergab, der dort nicht
benötigt wird. Dieses Feature entfernt Bilder aus dem OCR-Output, bevor die Markdown-Datei
gespeichert und ans LLM weitergegeben wird.

---

## Analyse der Möglichkeiten

### 1. API-seitig: `include_image_base64: false`

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

### Verarbeitungsablauf bei `stripImages: true`

1. **API-Plugin-Option**: `include_image_base64: false` wird an den Mistral-OCR-Engine übergeben.
2. **Instruktions-Prompt**: Das LLM-Prompt fordert explizit nur Textinhalt an.
3. **Post-Processing**: `stripMarkdownImages()` entfernt alle verbleibenden `![…](…)` -Blöcke aus dem OCR-Ergebnis.

### Betroffene Dateien

| Datei | Änderung |
|---|---|
| `src/tools/pdf-ocr.ts` | Neuer Parameter `stripImages`; Hilfsfunktion `stripMarkdownImages`; `callOcr` akzeptiert und verarbeitet `stripImages` |
| `tests/integration/tools/pdf-ocr.int.spec.ts` | 5 neue Tests für das `stripImages`-Feature |

---

## Testergebnisse

```
Tests  23 passed (23)
```

Neue Tests:

- `strips Markdown image syntax from OCR output by default (stripImages not set)` – Bilder werden standardmäßig entfernt.
- `strips images when stripImages is explicitly true` – explizit `true`; `include_image_base64: false` wird gesetzt.
- `keeps images in OCR output when stripImages is false` – `false` behält alle Bilder.
- `uses image-free OCR instruction when stripping images (default)` – korrekte Prompt-Formulierung.
- `uses full-content OCR instruction when stripImages is false` – ursprüngliche Prompt-Formulierung.

---

## Fazit

Die Implementierung kombiniert drei sich ergänzende Mechanismen (API-Option, Prompt-Instruktion,
Post-Processing), um sicherzustellen, dass kein Bildinhalt in das gespeicherte Markdown und
damit in den LLM-Kontext gelangt. Da `stripImages` standardmäßig `true` ist, ist das gewünschte
Verhalten automatisch aktiv, ohne dass der Agent den Parameter explizit setzen muss.
