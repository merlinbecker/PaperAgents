# OCR Agent – Fehlerbehebung

**Datum:** 2026-03-10

---

## Problembeschreibung

### A) HITL-Bestätigung zu unübersichtlich

Nach dem Aufruf von `split_and_read_pdf` (Metadaten-Phase) erzeugte der Agent eine extrem lange, repetitive Textnachricht, in der er wiederholt nach einer Bestätigung des Ausgabepfads fragte. Dabei verwendete er **nicht** das `ask_user`-Tool, sondern schrieb den Bestätigungstext direkt als Assistenznachricht – hunderte Male wiederholt. Dies blockierte den gesamten weiteren Ablauf.

Ursache: Die System-Prompt-Regel `"Use ask_user if the path is unclear or a file already exists"` war zu unpräzise und führte dazu, dass der Agent jeden Aufruf ohne expliziten Ausgabepfad als „unklar" interpretierte und eine Bestätigung anforderte.

### B) Split PDF speichert kein Ergebnis / kein Markdown

Da der Agent nach der Metadaten-Phase in einer Bestätigungsschleife hängen blieb, wurden die Chunks mit `chunkIndex=0, 1, …` nie verarbeitet. Das Markdown wurde daher nie erzeugt und gespeichert.

Ursache: Folge von Problem A – der Agent startete die eigentliche OCR-Verarbeitung nicht, weil er auf eine Nutzerantwort wartete, die über den `ask_user`-Weg nie ankam.

---

## Geänderte Dateien

| Datei | Änderung |
|---|---|
| `examples/agents/ocr-agent.md` | System-Prompt überarbeitet: Pfad wird automatisch abgeleitet; OCR startet sofort nach Metadaten; `ask_user` nur bei bereits existierender Datei (einmalig); Workflow auf chunk-weises Speichern umgestellt |
| `src/ui/sidebar-examples.ts` | Gleiche System-Prompt-Änderungen in der eingebetteten OCR-Agent-Definition |

---

## Lösung

Die System-Prompts in `examples/agents/ocr-agent.md` und `src/ui/sidebar-examples.ts` wurden wie folgt aktualisiert:

### Entfernte / ersetzte Regeln

**Vorher:**
```
- If no output path is specified, use the same path as the input file with the extension `.md`
- Only overwrite existing files if the user explicitly confirms
- Use `ask_user` if the path is unclear or a file already exists
```

**Nachher:**
```
- If no output path is specified, use the same path as the input file with the extension `.md` — derive it automatically, do NOT ask
- Start OCR processing immediately after receiving metadata — do NOT wait for user confirmation
- Only use `ask_user` if the output file already exists and you need to confirm overwriting; use it exactly once
```

### Wirkung

- Der Agent leitet den Ausgabepfad automatisch aus dem Dateinamen ab (z. B. `DA_2026_11.pdf` → `DA_2026_11_part_1.md`, `DA_2026_11_part_2.md`, …).
- Nach Erhalt der Metadaten startet der Agent **sofort** mit `chunkIndex=0` und verarbeitet alle Chunks sequenziell.
- `ask_user` wird **nur noch einmal** und **nur** dann aufgerufen, wenn die Ausgabedatei bereits existiert.
- Kein repetitiver Bestätigungstext mehr in der Assistenznachricht.

### Weiteres

`examples/agents/ocr-agent.md` wurde außerdem auf den aktuellen Stand der `sidebar-examples.ts`-Version gebracht:
- `maxIterations: 10` → `maxIterations: 20`
- Workflow auf chunk-weises Speichern umgestellt (statt alle Chunks in Speicher halten und dann kombinieren)
- Metadaten-Header `# PDF OCR Agent` ergänzt
