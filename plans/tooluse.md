# Paper Agents Plugin - Detailplan: Tool-System Implementierung

**Status:** 🎯 Detailplanungs-Phase  
**Datum:** 11. Januar 2026  
**Basiert auf:** [plans/architecture.md](architecture.md)  
**Fokus:** Tool-Definition, Sidebar, HITL-Workflow  

---

## 1. Feature-Übersicht

### 1.1 User-Flow
```
1. Plugin lädt alle Tool-Definitionen aus Vault-Ordner
   ↓
2. Nutzer öffnet "Tools"-Panel in Sidebar
   ↓
3. Nutzer wählt Tool → sieht Name, Description, Parameter
   ↓
4. Nutzer gibt Parameter ein + klickt "Run"
   ↓
5. Plugin führt Tool aus
   ↓
6. Falls HITL erforderlich → Modal für Bestätigung
   ↓
7. Nutzer bestätigt/lehnt ab
   ↓
8. Ergebnis wird angezeigt (in Modal oder Inline)
```

### 1.2 Zu implementierende Komponenten

| Komponente | Verantwortung | Schicht |
|-----------|--------------|---------|
| **YAML-Loader** | Tool-Dateien laden & parsen | Parser |
| **Tool-Registry** | Vordefinierte + Custom Tools verwalten | Core |
| **Sidebar-UI** | Tool-Auswahl & Anzeige | UI |
| **Formular-Generator** | Dynamische Eingabe-Formulare | UI |
| **HITL-Modal** | Bestätigungen anzeigen | UI |
| **Tool-Factory** | Tool-Instanzen erzeugen | Tools |
| **Predefined Tools** | search_files, read_file, write_file, rest_request | Tools |

---

## 2. YAML Tool-Definition - Deep Dive

### 2.1 Tool-Datei-Struktur

**Speicherort:** `vault/.obsidian/plugins/paper-agents/tools/` oder `vault/paper-agents-tools/`

**Dateiname:** `{tool-id}.md`

**Beispiel-Tool (single):**
```markdown
---
tool: true
id: "format_markdown"
name: "Format Markdown"
description: "Formatiert Text als Markdown-Liste"
type: "single"
parameters:
  - name: "input_text"
    type: "string"
    description: "Text zum Formatieren"
    required: true
  - name: "format_type"
    type: "string"
    description: "Listentyp: 'bullet' oder 'numbered'"
    required: true
    default: "bullet"
---

\`\`\`javascript
function processText(input) {
  const lines = input.input_text.split('\n').filter(l => l.trim());
  const prefix = input.format_type === 'numbered' ? '1. ' : '- ';
  return {
    result: lines.map(l => prefix + l).join('\n')
  };
}
return processText(input);
\`\`\`
```

**Beispiel-Tool (chain):**
```markdown
---
tool: true
id: "backup_and_transform"
name: "Backup & Transform"
description: "Sichert Datei und transformiert Inhalt"
type: "chain"
parameters:
  - name: "file_path"
    type: "string"
    required: true
---

\`\`\`yaml
steps:
  - name: "read_file"
    parameters:
      filePath: "{{file_path}}"
  
  - name: "custom_transform"
    parameters:
      content: "{{prev_step.output}}"
  
  - name: "write_file"
    parameters:
      filePath: "{{file_path}}.backup"
      content: "{{prev_step.output}}"
      overwrite: false
\`\`\`
```

### 2.2 YAML-Schema (Referenz aus prePlan-Tools.md)

```yaml
tool: true                              # Pflicht: Kennzeichnet als Tool
id: "unique_id"                         # Pflicht: Eindeutige ID
name: "Human-Readable Name"             # Pflicht: Anzeigename
description: "Was tut dieses Tool"      # Optional: Kurzbeschreibung
type: "single" | "chain"                # Pflicht: Tooltyp
parameters:                             # Pflicht: Array
  - name: "param_name"
    type: "string|number|boolean|array|object"
    description: "Erklärung"
    required: true|false
    default: <value>                    # Optional
custom_function: |                      # Nur bei type: single
  <JavaScript-Code>
steps:                                  # Nur bei type: chain
  - name: "tool_name"
    parameters:
      param: "{{placeholder}}"
```

---

## 3. Sidebar-UI Architektur

### 3.1 UI-Schichtung

```
┌─────────────────────────────────────────────┐
│  Sidebar (tool-sidebar.ts)                  │
│  - Tool-Liste anzeigen                      │
│  - Auswahl Listener                         │
└────────────┬────────────────────────────────┘
             ↓
┌─────────────────────────────────────────────┐
│  Tool-Detail-View (tool-detail-view.ts)     │
│  - Name, Description, Parameter             │
│  - "Run" Button                             │
└────────────┬────────────────────────────────┘
             ↓
┌─────────────────────────────────────────────┐
│  Form-Generator (form-generator.ts)         │
│  - Dynamische Input-Felder                  │
│  - Validierung                              │
└────────────┬────────────────────────────────┘
             ↓
┌─────────────────────────────────────────────┐
│  Execution Handler (tool-executor.ts)       │
│  - Tool ausführen                           │
│  - HITL-Check                               │
│  - Ergebnis anzeigen                        │
└────────────┬────────────────────────────────┘
             ↓
┌─────────────────────────────────────────────┐
│  HITL-Modal (hitl-modal.ts)                 │
│  - Bestätigung / Ablehnung                  │
│  - Kontext-Info (z.B. "Will write to file") │
└─────────────────────────────────────────────┘
```

### 3.2 Sidebar-Komponente (tool-sidebar.ts)

**Struktur:**
```typescript
class ToolSidebarView extends ItemView {
  // Zeigt:
  // 1. Suchfeld (Filter Tools)
  // 2. Tool-Liste (sortiert, mit Icons)
  // 3. Beim Klick → Tool-Detail-View laden
}
```

**Elemente:**
- Search-Input (Filter nach Name/Description)
- Tool-List (mit Category-Icons)
  - System Tools (🔧)
  - Custom Tools (📝)
  - Chains (🔗)
- Loader-Spinner während Tool-Ausführung

### 3.3 Tool-Detail-View (tool-detail-view.ts)

**Zeigt:**
```
┌─────────────────────────────────────┐
│ Tool: "Format Markdown"             │
│ ─────────────────────────────────── │
│ Formatiert Text als Markdown-Liste  │
│                                     │
│ PARAMETER:                          │
│ ┌─────────────────────────────────┐ │
│ │ input_text*                     │ │
│ │ [_____________________]          │ │
│ │ Text zum Formatieren             │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ format_type                     │ │
│ │ [dropdown: bullet/numbered]      │ │
│ │ Default: bullet                  │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [Run] [Cancel]                      │
└─────────────────────────────────────┘
```

### 3.4 Form-Generator (form-generator.ts)

**Generiert Input-Felder basierend auf Parameter-Type:**

| ParameterType | UI-Element | Validierung |
|---------------|-----------|------------|
| `string` | Text-Input | Min/Max-Länge |
| `number` | Number-Input | Min/Max-Wert |
| `boolean` | Checkbox | – |
| `array` | Textarea (JSON) | JSON-Parse |
| `object` | Textarea (JSON) | JSON-Parse |

**Spezial-Features:**
- Red-Highlighting für `required: true` (mit `*`)
- Placeholder mit `description`
- Default-Wert vorausfüllen
- Real-time JSON-Validierung für array/object

---

## 4. Vordefinierte Tools (Predefined Tools)

### 4.1 Tool-Set Definition

Alle 4 Tools folgen dem **Factory Pattern**:

```typescript
// tools/predefined.ts
export const PredefinedToolsFactory = {
  searchFiles: createSearchFilesTool,
  readFile: createReadFileTool,
  writeFile: createWriteFileTool,
  restRequest: createRestRequestTool,
};
```

### 4.2 Tool 1: search_files

**Zweck:** Dateien im Vault durchsuchen

```yaml
id: "search_files"
name: "Search Files"
type: "single"
parameters:
  - name: "query"
    type: "string"
    description: "Suchtext oder Glob-Pattern"
    required: true
  - name: "path"
    type: "string"
    description: "Ordner (z.B. '/notes')"
    required: false
    default: "/"
```

**Execution:**
- Nutzt `this.app.vault.getMarkdownFiles()` + Filter
- Keine HITL erforderlich (read-only)
- Output: `{ results: [{ name, path, size }, ...] }`

### 4.3 Tool 2: read_file

**Zweck:** Datei-Inhalt lesen

```yaml
id: "read_file"
name: "Read File"
type: "single"
parameters:
  - name: "filePath"
    type: "string"
    description: "Pfad zur Datei (z.B. '/notes/file.md')"
    required: true
```

**Execution:**
- Nutzt `this.app.vault.read(file)`
- Keine HITL erforderlich (read-only)
- Output: `{ content: "...", size, modified }`

### 4.4 Tool 3: write_file

**Zweck:** Datei schreiben/ändern

```yaml
id: "write_file"
name: "Write File"
type: "single"
parameters:
  - name: "filePath"
    type: "string"
    description: "Ziel-Pfad"
    required: true
  - name: "content"
    type: "string"
    description: "Inhalt zu schreiben"
    required: true
  - name: "overwrite"
    type: "boolean"
    description: "Bestehende Datei überschreiben?"
    required: false
    default: false
```

**Execution:**
- ✅ **HITL erforderlich** (destruktiv)
- HITL-Modal zeigt: Datei-Pfad, Größe (vorher/nachher), Snippet des Inhalts
- Nutzer bestätigt → `this.app.vault.create()` oder `this.app.vault.modify()`
- Output: `{ success: true, filePath, size }`

### 4.5 Tool 4: rest_request

**Zweck:** HTTP-Requests (API-Aufrufe)

```yaml
id: "rest_request"
name: "REST Request"
type: "single"
parameters:
  - name: "url"
    type: "string"
    description: "Ziel-URL"
    required: true
  - name: "method"
    type: "string"
    description: "HTTP-Methode (GET, POST, PUT, DELETE)"
    required: true
    default: "GET"
  - name: "headers"
    type: "object"
    description: "HTTP-Header (JSON-Format)"
    required: false
    default: {}
  - name: "body"
    type: "string"
    description: "Request-Body (JSON-String)"
    required: false
```

**Execution:**
- ✅ **HITL erforderlich für PUT/POST/DELETE** (destruktiv)
- GET-Requests: Optional HITL (Audit-Trail)
- Nutzt `obsidian.requestUrl()`
- HITL-Modal: URL, Methode, Body-Preview
- Output: `{ status, statusText, body }`

---

## 5. Human-in-the-Loop (HITL) Workflow

### 5.1 HITL-Entscheidungslogik

```typescript
interface IExecutableTool {
  shouldRequireHITL(parameters: Record<string, any>): boolean;
}

// Beispiele:
writeFile.shouldRequireHITL() → true (immer)
readFile.shouldRequireHITL() → false (immer)
restRequest.shouldRequireHITL(params) → {
  if (['PUT', 'POST', 'DELETE'].includes(params.method)) return true;
  return false; // GET nur optional
}
```

### 5.2 HITL-Modal Komponente (hitl-modal.ts)

**Design:**
```
┌─────────────────────────────────────────┐
│ ⚠️  CONFIRM ACTION                      │
│ ─────────────────────────────────────── │
│                                         │
│ Tool: "Write File"                      │
│ Action: Write to /notes/document.md     │
│                                         │
│ DETAILS:                                │
│ ┌─────────────────────────────────────┐ │
│ │ File Size:   0 KB → 2.5 KB          │ │
│ │ Overwrite:   No                     │ │
│ │ Preview:                            │ │
│ │ # New Header                        │ │
│ │ Some content...                     │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [✓ Confirm]  [✗ Cancel]                │
└─────────────────────────────────────────┘
```

**Konfigurierbar pro Tool:**
- ℹ️ Info-Text (z.B. "Achtung: Überschreiben")
- Preview-Länge (z.B. max. 500 Zeichen)
- Checkboxes für "Nicht mehr fragen" (optional)

### 5.3 HITL-Flow im Tool-Executor

```
Tool.execute() aufgerufen
  ↓
Tool.shouldRequireHITL() prüfen
  ├─→ nein → direkt ausführen
  └─→ ja  → HITL-Modal anzeigen
            Nutzer: Confirm / Cancel?
            ├─→ Confirm → Tool-Ausführung
            └─→ Cancel  → Abbruch + Fehler-Meldung
  ↓
Ergebnis zurückgeben
```

---

## 6. Tool-Registry & Loader

### 6.1 Tool-Registry (tool-registry.ts)

**Funktion:** Zentrale Verwaltung aller Tools

```typescript
class ToolRegistry {
  private predefinedTools: Map<string, ToolFactory>;
  private customTools: Map<string, Agent>;

  // Alle verfügbaren Tools auflisten
  listTools(): ToolMetadata[] { }

  // Tool nach ID laden
  getTool(id: string): IExecutableTool | null { }

  // Custom Tools aus Vault laden
  loadCustomTools(): Promise<void> { }

  // Vordefinierte Tools registrieren
  registerPredefined(): void { }
}
```

### 6.2 Custom Tool Loader (tool-loader.ts)

**Funktion:** YAML-Dateien laden und konvertieren zu `Agent`-Objekte

```typescript
class CustomToolLoader {
  // Sucht alle .md-Dateien mit `tool: true` im Vault
  async discoverTools(basePath: string): Promise<ToolFile[]> { }

  // Parst YAML-Frontmatter
  async parseToolFile(file: TFile): Promise<Agent> { }

  // Konvertiert `Agent` zu `IExecutableTool`
  toExecutable(agent: Agent): IExecutableTool { }
}
```

**Workflow:**
1. Plugin lädt auf Startup
2. Sucht `vault/paper-agents-tools/` (konfigurierbar)
3. Findet alle `.md`-Dateien mit `tool: true`
4. Parst YAML + validiert
5. Registriert in `ToolRegistry`

---

## 7. Tool-Executor (Orchestrierung)

### 7.1 Tool-Executor Struktur

```typescript
class ToolExecutor {
  private registry: ToolRegistry;
  private hitlModal: HITLModal;
  private logger: Logger;

  async execute(toolId: string, parameters: Record<string, any>): Promise<ExecutionResult> {
    // 1. Tool laden
    const tool = this.registry.getTool(toolId);
    
    // 2. Parameter validieren
    await this.validateParameters(tool.parameters, parameters);
    
    // 3. HITL prüfen
    if (tool.shouldRequireHITL(parameters)) {
      const confirmed = await this.showHITLModal(tool, parameters);
      if (!confirmed) return { success: false, error: "User denied" };
    }
    
    // 4. Ausführen
    const result = await tool.execute(this.createContext(parameters));
    
    // 5. Ergebnis zeigen
    await this.showResult(result);
    
    return result;
  }
}
```

---

## 8. Modul-Struktur (Detailansicht)

### 8.1 Neue Dateien für Tool-Features

```
src/
├── types.ts                          # ⭐ ZENTRAL (bestehend)
│   └── Agent, Parameter, ExecutionContext, IExecutableTool, ...
│
├── core/
│   ├── agent-engine.ts               # Orchestrierung (bestehend)
│   ├── tool-registry.ts              # Tool-Verwaltung
│   └── tool-executor.ts              # Tool-Ausführungs-Handler
│
├── parser/
│   ├── yaml-parser.ts                # YAML → Agent
│   ├── placeholder.ts                # {{}} Ersetzung
│   ├── validator.ts                  # Parameter-Validierung
│   └── tool-loader.ts                # Custom-Tools laden
│
├── tools/
│   ├── predefined.ts                 # Factory für 4 Standard-Tools
│   └── sandbox.ts                    # QuickJS-Integration
│
├── ui/
│   ├── tool-sidebar.ts               # Sidebar-Panel
│   ├── tool-detail-view.ts           # Detail-Anzeige
│   ├── form-generator.ts             # Dynamische Formulare
│   ├── hitl-modal.ts                 # HITL-Bestätigung
│   └── result-display.ts             # Ergebnis-Anzeige
│
└── utils/
    ├── logger.ts                     # Logging
    └── constants.ts                  # Shared Konstanten
```

### 8.2 Abhängigkeitsdiagramm (keine Zirkularität)

```
types.ts (Basis)
  ↓
parser/ (YAML-Parse, Validierung)
  ↓
tools/ (Tool-Impl.)
  ↓
core/ (Registry, Engine)
  ↓
ui/ (UI-Komponenten)
```

---

## 9. Feature-Details: Sidebar-Integration

### 9.1 Sidebar-Registration (in main.ts)

```typescript
class PaperAgentsPlugin extends Plugin {
  async onload() {
    // Sidebar registrieren
    this.registerView(
      TOOL_SIDEBAR_TYPE,
      leaf => new ToolSidebarView(leaf, this.toolRegistry)
    );

    // Command zum Öffnen
    this.addCommand({
      id: "open-tool-sidebar",
      name: "Open Tool Sidebar",
      callback: () => this.activateToolSidebar(),
    });

    // Tool-Registry laden
    await this.toolRegistry.loadCustomTools();
  }
}
```

### 9.2 Sidebar-Panel Aufbau

**HTML-Struktur:**
```html
<div class="tool-sidebar">
  <!-- Suchfeld -->
  <input class="tool-search" placeholder="Filter Tools..."/>
  
  <!-- Tool-Liste -->
  <div class="tool-list">
    <div class="tool-item predefined">
      <span class="tool-icon">🔧</span>
      <span class="tool-name">Search Files</span>
      <span class="tool-status">ready</span>
    </div>
    <!-- mehr Items -->
  </div>
  
  <!-- Detail-Panel (rechts) -->
  <div class="tool-detail">
    <!-- wird dynamisch gefüllt -->
  </div>
</div>
```

---

## 10. User-Workflows: Detailbeispiele

### 10.1 Workflow 1: Custom Tool ausführen

```
Nutzer:
1. Öffnet Sidebar → sieht "My Custom Tool"
2. Klick auf Tool
3. Sieht Parameter-Formular
4. Gibt "path: /notes" ein
5. Klick "Run"
6. Tool startet (evtl. HITL-Modal)
7. Ergebnis wird angezeigt
```

### 10.2 Workflow 2: write_file mit HITL

```
Nutzer:
1. Wählt "Write File" Tool
2. Gibt ein:
   - filePath: /backups/file.md
   - content: "# New Content"
   - overwrite: true
3. Klick "Run"
4. HITL-Modal öffnet:
   ┌─────────────────────────┐
   │ ⚠️  CONFIRM: Write File │
   │ Path: /backups/file.md  │
   │ Size: 0 → 15 bytes      │
   │                         │
   │ [✓ Confirm] [✗ Cancel] │
   └─────────────────────────┘
5. Nutzer klick "Confirm"
6. Datei wird geschrieben
7. Erfolgsmeldung
```

### 10.3 Workflow 3: Chain mit {{prev_step.output}}

```
Chain "backup_and_transform":
1. Step 1 (read_file): Liest /notes/file.md
   → output: "# Original Content"
2. Step 2 (custom_transform): Nutzt {{prev_step.output}}
   → input: "# Original Content"
   → output: "# TRANSFORMED Content"
3. Step 3 (write_file): Schreibt zu /backups/file.md mit {{prev_step.output}}
   → HITL-Modal zeigt transformierten Content
4. Nutzer bestätigt
5. Backup erstellt
```

---

## 11. Mobile-Kompatibilität: Spezifische Anforderungen

### 11.1 UI-Constraints für Mobile

| Element | Desktop | Mobile |
|---------|---------|--------|
| Sidebar | Seitenpanel | Bottom-Sheet oder Modal |
| Formular | Spalten-Layout | Single-Column |
| Modal | Overlay | Full-Screen |
| Preview | Scrollbar | Touch-Scroll |

### 11.2 Mobile-Optimierte Komponenten

**Tool-Sidebar auf Mobile:**
- Wird als **Bottom-Sheet** dargestellt (höher schiebbar)
- Oder als **Modal** mit Close-Button
- Suchfeld mit Mobile-Keyboard

**Formular auf Mobile:**
- Full-Width Inputs
- Größere Touch-Targets (mind. 44px)
- Keyboard-aware (Inputs scrollbar über Keyboard)

### 11.3 Performance-Optimierungen

- Lazy-Loading von Custom-Tool-Details
- Virtualisierte Tool-Liste (nur sichtbare Items rendern)
- Keine großen File-Previews auf Mobile

---

## 12. Fehlerbehandlung & Edge Cases

### 12.1 Fehlerszenarien

| Fehler | Handling | Nutzer-Feedback |
|--------|----------|-----------------|
| YAML-Parse Error | Exception catchen | "Invalid tool format in {filename}" |
| Parameter-Validierung | Form-Fehler | "Required field missing: {param}" |
| Tool-Ausführung Timeout | Abort + Error | "Tool timed out after 5s" |
| File-Not-Found | Tool-Error | "File not found: {path}" |
| API-Fehler | HTTP-Status zeigen | "API error: 404 Not Found" |
| HITL-Timeout | Abbruch | "Confirmation timeout" |

### 12.2 Edge Cases

- **Leerer Tool-Ordner:** Nur vordefinierte Tools laden
- **Duplizierte Tool-IDs:** Warnung loggen, letzte gewinnt
- **Zirkuläre Chains:** Parser-Validierung (max. 10 Steps)
- **Sehr große Dateien:** Preview kürzen, Warnung
- **Schnelle aufeinanderfolgende Klicks:** Debounce Tool-Ausführung

---

## 13. Implementierungs-Phasen mit Tool-Features

### Phase 1: Foundation (Parser + Types)
- ✅ types.ts
- ✅ yaml-parser.ts, placeholder.ts, validator.ts
- ✅ tool-loader.ts (Custom-Tools laden)

### Phase 2: Core + Predefined Tools
- ✅ tool-registry.ts
- ✅ predefined.ts (4 Standard-Tools mit Factory)
- ✅ sandbox.ts (QuickJS)
- ✅ tool-executor.ts (Orchestrierung)

### Phase 3: UI (Sidebar + Forms + HITL)
- ✅ tool-sidebar.ts
- ✅ tool-detail-view.ts
- ✅ form-generator.ts
- ✅ hitl-modal.ts
- ✅ result-display.ts
- ✅ main.ts Update (Sidebar-Registration)

### Phase 4: Polish
- ✅ Mobile-Optimierungen
- ✅ Fehlerbehandlung
- ✅ Logging & Debugging
- ✅ Unit-Tests

---

## 14. Testing-Matrix

| Komponente | Desktop | iOS | Android |
|-----------|---------|-----|---------|
| YAML-Parser | ✓ | ✓ | ✓ |
| Custom-Tool-Loader | ✓ | ✓ | ✓ |
| Tool-Registry | ✓ | ✓ | ✓ |
| Predefined Tools | ✓ | ✓ | ✓ |
| Sidebar-UI | ✓ | ≈ (Bottom-Sheet) | ≈ (Bottom-Sheet) |
| Form-Generator | ✓ | ✓ | ✓ |
| HITL-Modal | ✓ | ✓ | ✓ |
| write_file + HITL | ✓ | ✓ | ✓ |
| rest_request | ✓ | ✓ | ✓ |
| Chains | ✓ | ✓ | ✓ |

---

## 15. Konfigurierbare Settings (settings.ts Update)

```typescript
interface PaperAgentsSettings {
  // Bestehend
  mySetting: string;

  // Neu - Tool-System
  toolsBasePath: string;                    // Default: "/.obsidian/plugins/paper-agents/tools/"
  enableHITL: boolean;                      // Default: true
  hitlTimeout: number;                      // Sekunden (default: 30)
  
  // Sandbox-Limits
  sandboxMaxExecutionTime: number;          // ms (default: 5000)
  sandboxMaxMemory: number;                 // MB (default: 256)
  
  // Logging
  enableDebugLogging: boolean;              // Default: false
  logPath: string;                          // Default: "/.obsidian/plugins/paper-agents/logs/"
}
```

---

## 16. Zusammenfassung: Architecture-Integration

Diese Detailplanung **fügt sich nahtlos** in die bestehende Architektur ein:

✅ **Layer-Architektur wird befolgt:**
- Parser Layer → tool-loader.ts
- Tool Layer → predefined.ts, sandbox.ts
- Execution Layer → tool-executor.ts
- UI Layer → sidebar, hitl-modal

✅ **Clean Code:**
- Factory Pattern für Tools (keine Klassen-Hierarchie)
- Single Responsibility (jede Datei hat eine Aufgabe)
- Keine Zirkularität (parser → tools → core → ui)

✅ **Mobile-First:**
- Nur Obsidian-APIs
- Bottom-Sheet statt Sidebar auf Mobile
- Performance-optimiert

✅ **Sicherheit (HITL + Sandbox):**
- HITL-Modal für destruktive Ops
- QuickJS-Sandbox für Custom-JS
- Keine eval() direkt

---

**Status:** ✅ Detailplanung komplett  
**Nächste Phase:** Implementation (Phase 1-4)  

Sollen wir mit der Implementierung beginnen? 🚀
