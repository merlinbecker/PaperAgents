# PaperAgents Tool Notation Manual

**Handbuch für Ersteller von Markdown-basierten Tools**

Dieses Handbuch beschreibt die Markdown-Notation für Tools in PaperAgents. Es extrahiert bewährte Praktiken aus der bestehenden Dokumentation, Beispielen und Tests.

---

## Inhaltsverzeichnis

1. [Grundstruktur eines Tools](#grundstruktur-eines-tools)
2. [YAML Frontmatter](#yaml-frontmatter)
3. [Tool-Typen](#tool-typen)
4. [Parameter-Definitionen](#parameter-definitionen)
5. [Pre-Processing](#pre-processing)
6. [Tool-Ausführung](#tool-ausführung)
7. [Post-Processing](#post-processing)
8. [Platzhalter-Syntax](#platzhalter-syntax)
9. [Chain-Tools](#chain-tools)
10. [Sicherheit und Validierung](#sicherheit-und-validierung)
11. [Vollständige Beispiele](#vollständige-beispiele)
12. [Best Practices](#best-practices)

---

## Grundstruktur eines Tools

Ein Tool wird als Markdown-Datei (.md) definiert und besteht aus drei Hauptteilen:

```markdown
---
# YAML Frontmatter: Tool-Metadaten
---

#### **Pre-Processing** (optional)
```javascript
// JavaScript-Code für Input-Transformation
```

#### **Tool-Ausführung** oder **Steps**
```yaml
# Tool-Ausführungslogik
```

#### **Post-Processing** (optional)
```javascript
// JavaScript-Code für Output-Transformation
```
```

---

## YAML Frontmatter

Das YAML Frontmatter definiert die Metadaten und Konfiguration des Tools.

### Pflichtfelder

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `tool` | boolean | Muss `true` sein, um als Tool erkannt zu werden |
| `id` | string | Eindeutige Tool-ID (z.B. `format_list`, `search_and_count`) |
| `name` | string | Anzeigename des Tools |
| `type` | string | Tool-Typ: `single` oder `chain` |
| `description` | string | Beschreibung der Tool-Funktionalität |

### Optionale Felder

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `parameters` | array | Array von Parameter-Definitionen (siehe unten) |

### Beispiel

```yaml
---
tool: true
id: my_custom_tool
name: "My Custom Tool"
type: single
description: "A custom tool that does something useful"
parameters:
  - name: input_text
    type: string
    required: true
    description: "The text to process"
---
```

---

## Tool-Typen

### Single Tool (`type: single`)

Ein Single Tool führt eine einzelne Operation aus, optional mit Pre- und Post-Processing.

**Struktur:**
```markdown
---
tool: true
id: single_tool_example
name: "Single Tool Example"
type: single
parameters:
  - name: input
    type: string
    required: true
---

#### **Tool-Ausführung**
```yaml
tool: "read_file"
parameters:
  filePath: "{{input}}"
```
```

### Chain Tool (`type: chain`)

Ein Chain Tool führt mehrere Schritte nacheinander aus und kann Ausgaben vorheriger Schritte verwenden.

**Struktur:**
```markdown
---
tool: true
id: chain_tool_example
name: "Chain Tool Example"
type: chain
parameters:
  - name: query
    type: string
    required: true
---

#### **Steps**
```yaml
steps:
  - name: "step1"
    tool: "search_files"
    parameters:
      query: "{{query}}"
      
  - name: "step2"
    tool: "read_file"
    parameters:
      filePath: "{{prev_step.output.results[0].path}}"
```
```

---

## Parameter-Definitionen

Parameter definieren die Eingaben, die ein Tool akzeptiert.

### Parameter-Struktur

```yaml
parameters:
  - name: parameter_name      # Name des Parameters
    type: string|number|boolean|array|object  # Datentyp
    required: true|false      # Pflichtfeld?
    default: "value"          # Standardwert (optional)
    description: "Description" # Beschreibung (optional)
```

### Unterstützte Datentypen

| Typ | Beschreibung | Beispielwert |
|-----|--------------|--------------|
| `string` | Textstring | `"hello world"` |
| `number` | Numerischer Wert | `42`, `3.14` |
| `boolean` | Wahrheitswert | `true`, `false` |
| `array` | Array von Werten | `["a", "b", "c"]` |
| `object` | JSON-Objekt | `{"key": "value"}` |

### Beispiel: Mehrere Parameter

```yaml
parameters:
  - name: items
    type: string
    description: "Comma-separated items to format"
    required: true
    
  - name: numbered
    type: boolean
    description: "Use numbered list instead of bullets"
    required: false
    default: false
    
  - name: max_items
    type: number
    description: "Maximum number of items to process"
    required: false
    default: 10
```

---

## Pre-Processing

Pre-Processing transformiert die Eingabeparameter **vor** der Tool-Ausführung.

### Syntax

```markdown
#### **Pre-Processing**
```javascript
// @preprocess
// JavaScript-Code hier
// 'input' Objekt steht zur Verfügung
// MUSS ein 'input' Objekt zurückgeben
return input;
```
```

### Verfügbare Variablen

- `input`: Objekt mit allen Input-Parametern
- Alle Standard-JavaScript-Funktionen (außer blockierten Patterns)

### Platzhalter im Pre-Processing

Pre-Processing-Code kann spezielle Platzhalter verwenden:

- `{{date}}` - Aktuelles Datum (YYYY-MM-DD)
- `{{time}}` - Aktuelle Zeit (HH:mm:ss)
- `{{random_id}}` - Zufällige ID

**Beispiel:**
```javascript
// @preprocess
const today = "{{date}}";
input.filePath = `daily-notes/${today}.md`;
return input;
```

### Anwendungsfälle

1. **Input-Normalisierung:**
```javascript
// @preprocess
input.query = input.query.trim().toLowerCase();
return input;
```

2. **Felder hinzufügen:**
```javascript
// @preprocess
input.timestamp = "{{date}} {{time}}";
input.processedBy = "PaperAgents";
return input;
```

3. **Daten-Transformation:**
```javascript
// @preprocess
// Split comma-separated string into array
input.itemsArray = input.items
  .split(',')
  .map(item => item.trim())
  .filter(item => item.length > 0);
return input;
```

4. **Berechnete Werte:**
```javascript
// @preprocess
if (!input.filePath.startsWith("/")) {
  input.filePath = "/" + input.filePath;
}
return input;
```

---

## Tool-Ausführung

Die Tool-Ausführung definiert, welches Tool aufgerufen wird und mit welchen Parametern.

### Syntax für Single Tools

```markdown
#### **Tool-Ausführung**
```yaml
tool: "tool_name"
parameters:
  param1: "value1"
  param2: "{{placeholder}}"
```
```

### Vordefinierte Tools

PaperAgents bietet vier vordefinierte Tools:

#### 1. `search_files` - Dateien suchen

```yaml
tool: "search_files"
parameters:
  query: "search term"    # Suchbegriff
  path: "/"               # Pfad zum Durchsuchen
```

**Output:**
```json
{
  "results": [
    {
      "name": "file.md",
      "path": "/path/to/file.md",
      "size": 1024
    }
  ]
}
```

#### 2. `read_file` - Datei lesen

```yaml
tool: "read_file"
parameters:
  filePath: "/path/to/file.md"
```

**Output:**
```json
{
  "filePath": "/path/to/file.md",
  "content": "file content",
  "size": 1024,
  "modified": "2026-01-12T10:00:00Z"
}
```

#### 3. `write_file` - Datei schreiben

```yaml
tool: "write_file"
parameters:
  filePath: "/path/to/file.md"
  content: "content to write"
  overwrite: false   # Optional: true um existierende Dateien zu überschreiben
```

**Output:**
```json
{
  "filePath": "/path/to/file.md",
  "success": true
}
```

**⚠️ Hinweis:** Erfordert Human-in-the-Loop (HITL) Bestätigung!

#### 4. `rest_request` - REST API Aufruf

```yaml
tool: "rest_request"
parameters:
  url: "https://api.example.com/endpoint"
  method: "GET"      # GET, POST, PUT, DELETE, PATCH
  headers: {}        # Optional
  body: {}           # Optional (für POST/PUT/PATCH)
```

**Output:**
```json
{
  "status": 200,
  "headers": {},
  "body": {},
  "text": "response text"
}
```

**⚠️ Hinweis:** POST/PUT/DELETE erfordern HITL-Bestätigung!

---

## Post-Processing

Post-Processing transformiert die Ausgabe **nach** der Tool-Ausführung.

### Syntax

```markdown
#### **Post-Processing**
```javascript
// @postprocess
// 'output' Variable enthält die Tool-Ausgabe
// MUSS ein transformiertes Objekt zurückgeben
return transformedOutput;
```
```

### Verfügbare Variablen

- `output`: Die Ausgabe des ausgeführten Tools (oder vorherigen Schritts)
- `input`: Das ursprüngliche Input-Objekt (inkl. Pre-Processing-Änderungen)

### Anwendungsfälle

1. **Felder extrahieren:**
```javascript
// @postprocess
return {
  path: output.filePath,
  content: output.content,
  size: output.size,
  log: []
};
```

2. **Daten aggregieren:**
```javascript
// @postprocess
const results = output.results || [];
const fileTypes = {};

results.forEach(file => {
  const ext = file.path.split('.').pop() || 'no-extension';
  fileTypes[ext] = (fileTypes[ext] || 0) + 1;
});

return {
  summary: {
    total_files: results.length,
    file_types: fileTypes
  },
  files: results,
  log: []
};
```

3. **Formatierung:**
```javascript
// @postprocess
return {
  result: output.content.toUpperCase(),
  log: []
};
```

4. **Markdown-Generierung:**
```javascript
// @postprocess
const marker = output.numbered ? '1. ' : '- ';
const formattedList = output.itemsArray
  .map((item, index) => {
    if (output.numbered) {
      return `${index + 1}. ${item}`;
    }
    return `${marker}${item}`;
  })
  .join('\n');

return {
  formatted: formattedList,
  count: output.itemsArray.length,
  log: []
};
```

---

## Platzhalter-Syntax

Platzhalter ermöglichen dynamische Werte in Tool-Parametern und Pre-Processing.

### Basis-Platzhalter

| Platzhalter | Beschreibung | Beispielwert |
|-------------|--------------|--------------|
| `{{date}}` | Aktuelles Datum | `2026-01-12` |
| `{{time}}` | Aktuelle Zeit | `15:30:45` |
| `{{random_id}}` | Zufällige UUID | `a1b2c3d4-...` |

### Parameter-Platzhalter

Auf Input-Parameter zugreifen:

```yaml
parameters:
  filePath: "{{input_param}}"
  content: "{{another_param}}"
```

**Beispiel:**
```yaml
tool: "write_file"
parameters:
  filePath: "{{filePath}}"     # Verwendet input.filePath
  content: "{{content}}"       # Verwendet input.content
```

### Verschachtelte Objekt-Zugriffe

Auf verschachtelte Objekteigenschaften zugreifen:

```yaml
parameters:
  filePath: "{{prev_step.output.results[0].path}}"
  name: "{{user.profile.name}}"
```

**Beispiel aus Chain:**
```yaml
steps:
  - name: "search_files"
    tool: "search_files"
    parameters:
      query: "{{query}}"
      
  - name: "read_file"
    tool: "read_file"
    parameters:
      # Greift auf results[0].path aus search_files Output zu
      filePath: "{{prev_step.output.results[0].path}}"
```

### Platzhalter in Pre-Processing

```javascript
// @preprocess
const today = "{{date}}";          // Aktuelles Datum
const now = "{{time}}";            // Aktuelle Zeit
const id = "{{random_id}}";        // Zufällige ID

input.timestamp = `${today} ${now}`;
input.uniqueId = id;
return input;
```

---

## Chain-Tools

Chain-Tools führen mehrere Schritte sequenziell aus.

### Steps-Syntax

```markdown
#### **Steps**
```yaml
steps:
  - name: "step_name"       # Eindeutiger Step-Name
    tool: "tool_name"       # Tool-ID
    parameters:             # Tool-Parameter
      param1: "value1"
      param2: "{{placeholder}}"
```
```

### Zugriff auf vorherige Schritte

Verwende `{{prev_step.output}}` um auf die Ausgabe des vorherigen Schritts zuzugreifen:

```yaml
steps:
  - name: "search"
    tool: "search_files"
    parameters:
      query: "{{query}}"
      path: "/"
      
  - name: "read"
    tool: "read_file"
    parameters:
      # Verwendet das Ergebnis von 'search'
      filePath: "{{prev_step.output.results[0].path}}"
```

### Benannte Step-Outputs

Zugriff auf spezifische Steps über deren Namen:

```yaml
steps:
  - name: "find_config"
    tool: "search_files"
    parameters:
      query: "config"
      
  - name: "find_data"
    tool: "search_files"
    parameters:
      query: "data"
      
  - name: "process"
    tool: "custom_processor"
    parameters:
      # Greift auf 'find_config' Step zu
      configPath: "{{outputs.find_config.results[0].path}}"
      # Greift auf 'find_data' Step zu
      dataPath: "{{outputs.find_data.results[0].path}}"
```

### Pre/Post-Processing in Chains

Chains können ebenfalls Pre- und Post-Processing haben:

```markdown
---
tool: true
id: chain_with_processing
name: "Chain with Processing"
type: chain
parameters:
  - name: query
    type: string
    required: true
---

#### **Pre-Processing**
```javascript
// @preprocess
input.query = input.query.trim().toLowerCase();
return input;
```

#### **Steps**
```yaml
steps:
  - name: "search"
    tool: "search_files"
    parameters:
      query: "{{query}}"
```

#### **Post-Processing**
```javascript
// @postprocess
return {
  files_found: output.results?.length || 0,
  results: output.results || [],
  log: []
};
```
```

---

## Sicherheit und Validierung

### Blockierte Patterns im JavaScript-Code

Aus Sicherheitsgründen sind folgende Patterns in Pre/Post-Processing **verboten**:

| Pattern | Grund |
|---------|-------|
| `require()` | Kein Modul-Import erlaubt |
| `eval()` | Kein Code-Evaluation |
| `process.` | Kein Prozess-Zugriff |
| `global.` | Kein Global-Scope-Zugriff |
| `Function()` | Kein Function-Constructor |

**Beispiel - Ungültiger Code:**
```javascript
// @preprocess
// ❌ FEHLER: Blockiert
const fs = require('fs');
eval('dangerous code');
process.exit(1);
global.someVar = "bad";
new Function('return 1')();
```

### Erforderlich: Return Statement

Jeder Pre/Post-Processing Block **muss** ein `return` Statement enthalten:

```javascript
// @preprocess
// ✅ KORREKT
input.processed = true;
return input;
```

```javascript
// @postprocess
// ❌ FEHLER: Kein return
output.formatted = true;
// Fehlt: return output;
```

### Human-in-the-Loop (HITL)

Bestimmte Operationen erfordern eine manuelle Bestätigung:

| Tool | Operation | HITL erforderlich? |
|------|-----------|-------------------|
| `write_file` | Alle | ✅ Ja, immer |
| `rest_request` | GET | ❌ Nein |
| `rest_request` | POST/PUT/DELETE/PATCH | ✅ Ja |
| `read_file` | Alle | ❌ Nein |
| `search_files` | Alle | ❌ Nein |

---

## Vollständige Beispiele

### Beispiel 1: Format List (Single Tool)

**Zweck:** Konvertiert comma-separated Text in eine Markdown-Liste

**Datei:** `format_list.md`

```markdown
---
tool: true
id: format_list
name: "Format as Markdown List"
type: single
parameters:
  - name: items
    type: string
    description: "Comma-separated items to format"
    required: true
  - name: numbered
    type: boolean
    description: "Use numbered list instead of bullets"
    required: false
    default: false
description: "Converts comma-separated text into a formatted Markdown list"
---

#### **Pre-Processing**
```javascript
// @preprocess
// Split comma-separated string into array and clean each item
input.itemsArray = input.items
  .split(',')
  .map(item => item.trim())
  .filter(item => item.length > 0);
return input;
```

#### **Post-Processing**
```javascript
// @postprocess
// Format array as markdown list
const marker = output.numbered ? '1. ' : '- ';
const formattedList = output.itemsArray
  .map((item, index) => {
    if (output.numbered) {
      return `${index + 1}. ${item}`;
    }
    return `${marker}${item}`;
  })
  .join('\n');

return {
  formatted: formattedList,
  count: output.itemsArray.length,
  log: []
};
```
```

**Verwendung:**
```json
{
  "items": "apple, banana, cherry",
  "numbered": false
}
```

**Output:**
```
- apple
- banana
- cherry
```

---

### Beispiel 2: Search and Count (Chain Tool)

**Zweck:** Sucht Dateien und liefert detaillierte Statistiken

**Datei:** `search_and_count.md`

```markdown
---
tool: true
id: search_and_count
name: "Search Files and Count Results"
type: chain
parameters:
  - name: query
    type: string
    description: "Search query"
    required: true
  - name: folder
    type: string
    description: "Folder to search in"
    required: false
    default: "/"
description: "Searches for files and provides statistics about the results"
---

#### **Pre-Processing**
```javascript
// @preprocess
// Clean and prepare search query
input.query = input.query.trim().toLowerCase();
input.folder = input.folder || "/";
// Add timestamp for audit trail
input.searchTimestamp = "{{date}} {{time}}";
return input;
```

#### **Steps**
```yaml
steps:
  - name: "search_files"
    tool: "search_files"
    parameters:
      query: "{{query}}"
      path: "{{folder}}"
```

#### **Post-Processing**
```javascript
// @postprocess
// Transform raw search results into structured summary
const results = output.results || [];
const fileTypes = {};

// Count files by extension
results.forEach(file => {
  const ext = file.path.split('.').pop() || 'no-extension';
  fileTypes[ext] = (fileTypes[ext] || 0) + 1;
});

// Calculate total size
const totalSize = results.reduce((sum, file) => sum + (file.size || 0), 0);

return {
  summary: {
    total_files: results.length,
    file_types: fileTypes,
    total_size_bytes: totalSize,
    largest_file: results.length > 0
      ? results.reduce((max, f) => (f.size || 0) > (max.size || 0) ? f : max)
      : null
  },
  files: results.map(f => ({
    name: f.name,
    path: f.path,
    size: f.size || 0
  })),
  log: []
};
```
```

**Verwendung:**
```json
{
  "query": "meeting notes",
  "folder": "/projects"
}
```

**Output:**
```json
{
  "summary": {
    "total_files": 5,
    "file_types": {
      "md": 5
    },
    "total_size_bytes": 12500,
    "largest_file": {
      "name": "meeting-2026-01-10.md",
      "path": "/projects/meeting-2026-01-10.md",
      "size": 3200
    }
  },
  "files": [...]
}
```

---

### Beispiel 3: Create Daily Note (Single Tool mit Template)

**Zweck:** Erstellt eine tägliche Notiz mit Template-Struktur

**Datei:** `create_daily_note.md`

```markdown
---
tool: true
id: create_daily_note
name: "Create Daily Note with Template"
type: single
parameters:
  - name: tags
    type: string
    description: "Comma-separated tags for the note"
    required: false
    default: ""
  - name: mood
    type: string
    description: "Today's mood"
    required: false
    default: "neutral"
description: "Creates a daily note with a template structure using write_file"
---

#### **Pre-Processing**
```javascript
// @preprocess
// Prepare daily note filename and content
const today = "{{date}}";
input.filePath = `daily-notes/${today}.md`;

// Parse tags
const tagList = input.tags
  ? input.tags.split(',').map(t => `#${t.trim()}`).join(' ')
  : '';

// Build note content
input.content = `# Daily Note - ${today}

## Metadata
- Date: ${today}
- Mood: ${input.mood}
- Tags: ${tagList}

## Tasks
- [ ] Review yesterday's notes
- [ ] Plan today's priorities

## Notes

## Reflections

---
Created with PaperAgents on ${today} at {{time}}
`;

return input;
```

#### **Tool-Ausführung**
```yaml
tool: "write_file"
parameters:
  filePath: "{{filePath}}"
  content: "{{content}}"
  overwrite: false
```

#### **Post-Processing**
```javascript
// @postprocess
// Format success message
return {
  message: `Daily note created successfully`,
  path: output.filePath || "unknown",
  timestamp: "{{date}} {{time}}",
  log: []
};
```
```

**Verwendung:**
```json
{
  "tags": "personal, reflection",
  "mood": "productive"
}
```

---

### Beispiel 4: Chain Reader (Multi-Step Chain)

**Zweck:** Sucht Dateien und liest das erste Ergebnis

**Datei:** `chain_reader.md`

```markdown
---
tool: true
id: chain_reader
name: "Chain Reader"
type: chain
parameters:
  - name: query
    type: string
    required: true
description: "Chain tool: search files and read first result"
---

#### **Pre-Processing**
```javascript
// @preprocess
input.query = input.query.trim();
return input;
```

#### **Steps**
```yaml
steps:
  - name: "search_files"
    tool: "search_files"
    parameters:
      query: "{{query}}"
      path: "/"
    
  - name: "read_file"
    tool: "read_file"
    parameters:
      filePath: "{{prev_step.output.results[0].path}}"
```

#### **Post-Processing**
```javascript
// @postprocess
return {
  files_found: output.files_found || 0,
  content: output.content || "",
  log: []
};
```
```

---

### Beispiel 5: Custom Read (Einfaches Single Tool)

**Zweck:** Liest eine Datei mit automatischer Pfad-Normalisierung

**Datei:** `custom_read.md`

```markdown
---
tool: true
id: custom_read
name: "Custom Read"
type: single
parameters:
  - name: filePath
    type: string
    required: true
description: "Read a file from disk"
---

#### **Pre-Processing**
```javascript
// @preprocess
if (!input.filePath.startsWith("/")) {
  input.filePath = "/" + input.filePath;
}
return input;
```

#### **Tool-Ausführung**
```yaml
tool: "read_file"
parameters:
  path: "input.filePath"
```

#### **Post-Processing**
```javascript
// @postprocess
return {
  path: output.filePath,
  content: output.content,
  size: output.size,
  log: []
};
```
```

---

## Best Practices

### Pre-Processing

✅ **DO:**
- Input-Daten normalisieren (trim, lowercase, etc.)
- Berechnete Felder hinzufügen
- Parameter validieren und transformieren
- Daten für Tool-Ausführung vorbereiten

❌ **DON'T:**
- Keine API-Calls oder Dateioperationen
- Nicht die Tool-Funktionalität replizieren
- Keine externen Abhängigkeiten verwenden

### Post-Processing

✅ **DO:**
- Relevante Felder aus komplexem Output extrahieren
- Daten aggregieren und zusammenfassen
- Output für Anzeige formatieren
- Metadaten und Timestamps hinzufügen

❌ **DON'T:**
- Nicht das ursprüngliche Tool-Verhalten ändern
- Keine Dateioperationen durchführen
- Keine externen Abhängigkeiten verwenden

### Allgemein

✅ **DO:**
- Aussagekräftige IDs und Namen verwenden
- Beschreibungen für alle Parameter hinzufügen
- `required` und `default` Werte klar definieren
- Immer ein `return` Statement verwenden
- Code kommentieren für Lesbarkeit

❌ **DON'T:**
- Keine blockierten Patterns verwenden (require, eval, etc.)
- Nicht ohne `return` Statement
- Keine zu komplexe Logik in Pre/Post-Processing
- Keine Secrets oder sensiblen Daten hardcoden

---

## Fehlerbehebung

### Häufige Fehler

**1. Tool wird nicht erkannt**
```yaml
# ❌ FALSCH
tool: false
```
```yaml
# ✅ RICHTIG
tool: true
```

**2. Fehlende return Statement**
```javascript
// ❌ FALSCH
// @preprocess
input.processed = true;
```
```javascript
// ✅ RICHTIG
// @preprocess
input.processed = true;
return input;
```

**3. Blockierte Patterns verwendet**
```javascript
// ❌ FALSCH
// @preprocess
const fs = require('fs');
return input;
```
```javascript
// ✅ RICHTIG
// @preprocess
// Nutze vordefinierte Tools statt direktem require
input.shouldReadFile = true;
return input;
```

**4. Falscher Platzhalter-Zugriff**
```yaml
# ❌ FALSCH (nur im Code, nicht in YAML)
parameters:
  filePath: "prev_step.output.path"
```
```yaml
# ✅ RICHTIG
parameters:
  filePath: "{{prev_step.output.path}}"
```

**5. Fehlender Tool-Typ**
```yaml
# ❌ FALSCH
---
tool: true
id: my_tool
---
```
```yaml
# ✅ RICHTIG
---
tool: true
id: my_tool
type: single  # oder 'chain'
---
```

---

## Weiterführende Ressourcen

- **Beispiele:** `/examples/` Verzeichnis im Repository
- **Test-Fixtures:** `/tests/fixtures/markdown/` für weitere Beispiele
- **Unit-Tests:** `/tests/unit/core/` für technische Details
- **E2E-Tests:** `/tests/integration/e2e/` für vollständige Workflows
- **Dokumentation:** `/reports/Phase_werkzeuge.md` für Implementation-Details

---

## Zusammenfassung

Ein vollständiges Tool in PaperAgents besteht aus:

1. **YAML Frontmatter** - Metadaten (tool: true, id, name, type, parameters)
2. **Pre-Processing** (optional) - Input-Transformation mit JavaScript
3. **Tool-Ausführung** (single) oder **Steps** (chain) - Tool-Logik in YAML
4. **Post-Processing** (optional) - Output-Transformation mit JavaScript

**Minimales Beispiel:**
```markdown
---
tool: true
id: simple_tool
name: "Simple Tool"
type: single
parameters:
  - name: input
    type: string
    required: true
---

#### **Tool-Ausführung**
```yaml
tool: "read_file"
parameters:
  filePath: "{{input}}"
```
```

**Viel Erfolg beim Erstellen eigener Tools! 🚀**
