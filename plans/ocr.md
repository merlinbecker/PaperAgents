# Plan: OCR Plugin – Mistral OCR via OpenRouter

## Ziel

Implementierung eines OpenRouter-Plugins für die PDF-zu-Markdown-Konvertierung mittels **Mistral OCR** (`mistralai/mistral-ocr-latest`), analog zum bereits vorhandenen `websearch`-Plugin. Der Nutzer soll die Möglichkeit haben, PDFs in Markdown zu konvertieren und die Ergebnisse als Dateien zu speichern sowie im Chat zu verwenden.

---

## Hintergrund

OpenRouter bietet einen `file-parser`-Plugin (Plugin-ID: `"file-parser"`), der serverseitig PDF-Dateien verarbeitet und als Markdown-Text zurückgibt. Das Plugin funktioniert analog zum `web`-Plugin für Websuche:

- Plugin wird im API-Request als `plugins: [{ id: "file-parser" }]` übergeben
- Das Modell (`mistralai/mistral-ocr-latest`) verarbeitet PDFs, die als Base64-kodierte Daten in der Nachricht enthalten sind
- Referenz: https://openrouter.ai/docs/guides/overview/multimodal/pdfs

---

## Komponenten

### 1. Konstanten (`src/utils/constants.ts`)

- `PREDEFINED_TOOL_IDS.FILE_PARSER = "file_parser"` – Plugin-Tool-ID für den Agent
- `PREDEFINED_TOOL_IDS.READ_BINARY_FILE = "read_binary_file"` – Neues Tool zum Lesen von Binärdateien (PDFs) als Base64

### 2. Predefined Tools (`src/tools/predefined.ts`)

#### `ReadBinaryFileTool`
- Liest eine Binärdatei (z.B. PDF) aus dem Vault
- Gibt den Inhalt als Base64-kodierten String zurück
- Parameter: `filePath` (string, required)

#### `OcrFileParserFactory`
- Analogon zu `WebSearchFactory`
- `isPlugin: true` → wird nicht als Funktions-Tool an das LLM übergeben
- Signalisiert dem Orchestrator, dass das `file-parser`-Plugin aktiviert werden soll

### 3. Typen (`src/types.ts`)

```typescript
export interface OcrConfig {
  model?: string; // Default: "mistralai/mistral-ocr-latest"
}
```

- Erweiterung von `AgentDefinition` um `ocrConfig?: OcrConfig`
- Erweiterung von `AgentFrontmatter` um `ocrConfig?`

### 4. Agent Parser (`src/parser/agent-parser.ts`)

- `nestedKeys` um `"ocrConfig:"` erweitern
- `toAgentDefinition` gibt `ocrConfig` aus

### 5. Orchestrator (`src/core/orchestrator.ts`)

#### `buildToolDefinitions`
- Überspringt `file_parser` (wie `websearch`) – es ist ein Plugin, kein Funktions-Tool

#### `buildPluginList`
- Fügt `{ id: "file-parser" }` hinzu, wenn `file_parser` in `agent.tools` enthalten ist
- Setzt optional `model` auf den konfigurierten OCR-Modellnamen

### 6. Beispiel-Agent (`examples/agents/ocr-agent.md`)

```yaml
---
agent: true
id: ocr_agent
name: "PDF OCR Agent"
description: "Konvertiert PDFs in Markdown mittels Mistral OCR"
model: mistralai/mistral-ocr-latest
tools:
  - read_binary_file
  - write_file
  - file_parser
memory:
  type: conversation
  maxMessages: 20
temperature: 0.1
agenticLoop:
  enabled: true
  maxIterations: 5
  terminationCheck: tool
---
```

**System Prompt:**
- Agent liest PDF als Base64
- Sendet es über das `file_parser`-Plugin an Mistral OCR
- Speichert das Markdown-Ergebnis als Datei

### 7. Sidebar-Beispiel (`src/ui/sidebar-examples.ts`)

- Neuer Eintrag `"ocr-agent"` in `SIDEBAR_EXAMPLES`
- Gruppe: `"AI Agents"`
- Dateiname: `ocr-agent.md`

---

## Workflow des OCR-Agenten

```
User: "Bitte konvertiere /pdfs/paper.pdf in Markdown"
  │
  ├─ Agent: read_binary_file("/pdfs/paper.pdf") → base64 string
  │
  ├─ Agent: sendet base64 an OpenRouter mit file-parser Plugin
  │         → Mistral OCR verarbeitet PDF → Markdown zurück
  │
  ├─ Agent: write_file("/notes/paper.md", markdown, overwrite: true)
  │
  └─ Agent: finish_task("PDF wurde konvertiert und gespeichert unter /notes/paper.md")
```

---

## Nicht im Scope (Initial-Implementation)

- Batch-Verarbeitung mehrerer PDFs
- Fortschrittsanzeige während der OCR
- Unterstützung für Bilder (JPEG, PNG) – kann später hinzugefügt werden
- Annotation-Extraktion (separate Feature-Anfrage)

---

## Implementierungsreihenfolge

1. `constants.ts` – neue Tool-IDs
2. `types.ts` – `OcrConfig`, `AgentDefinition`, `AgentFrontmatter`
3. `predefined.ts` – `ReadBinaryFileTool` + `OcrFileParserFactory`
4. `agent-parser.ts` – `ocrConfig` parsen
5. `orchestrator.ts` – Plugin-Liste und Tool-Definitionen
6. `examples/agents/ocr-agent.md`
7. `sidebar-examples.ts` – OCR-Agent als Sidebar-Beispiel
