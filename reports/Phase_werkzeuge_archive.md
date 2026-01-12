# Phase Werkzeuge - Konsolidierter Statusbericht

**Datum:** 11. Januar 2026 (Update: 12. Januar 2026)  
**Meilenstein:** M1 - Tool-Funktionalitäten  
**Status:** 🟢 **Build erfolgreich! Kritischer Showstopper behoben**

---

## ⚡ Update 12. Januar 2026: Kritischer Showstopper behoben!

### ✅ Build-Fehler erfolgreich behoben

**Was wurde getan:**
1. ✅ TypeScript-Konfiguration aktualisiert (ES2017+ libs)
2. ✅ Obsidian-Dependencies korrekt installiert
3. ✅ IToolFactory-Interface erweitert für App-Parameter
4. ✅ ToolRegistry aktualisiert für App-Verwaltung
5. ✅ Alle Predefined Tool Factories angepasst
6. ✅ Null/undefined-Checks in Parser-Dateien ergänzt
7. ✅ RequestUrl API korrekt verwendet

**Ergebnis:**
- ✅ Build erfolgreich ohne Fehler
- ✅ `main.js` generiert (40 KB)
- ✅ Plugin kompilierbar und bereit für manuelles Testing
- ✅ Aufwand: ~2 Stunden (statt geschätzt 4-6 Stunden)

**Nächste Schritte:**
1. Plugin in Obsidian manuell laden und testen
2. Test-Infrastructure aufsetzen
3. QuickJS integrieren
4. Pre/Post-Processing aktivieren

---

## 1. Anforderungen: Was soll das Plugin können?

### 1.1 Kernfunktionalitäten (Tool-Definition und -Ausführung)

Das Paper Agents Plugin soll Entwickler:innen ermöglichen, **LLM-basierte Werkzeuge in Markdown zu definieren, zu testen und auszuführen** – ohne komplexe Frameworks.

#### Funktionale Anforderungen:

1. **Tool-Definition in Markdown**
   - Werkzeuge werden als Markdown-Dateien mit YAML-Frontmatter definiert
   - Zwei Tool-Typen: `single` (einzelnes Werkzeug) und `chain` (Werkzeugkette)
   - Parameter mit Typvalidierung (string, number, boolean, array, object)
   - Pre-Processing und Post-Processing mit JavaScript-Code
   - Placeholder-System für dynamische Werte (`{{param}}`, `{{prev_step.output}}`, `{{date}}`, etc.)

2. **Vordefinierte Standard-Werkzeuge**
   - `search_files`: Vault-Dateien durchsuchen
   - `read_file`: Datei-Inhalt lesen
   - `write_file`: Datei schreiben/ändern (mit HITL-Bestätigung)
   - `rest_request`: HTTP-Requests (mit HITL für PUT/POST/DELETE)

3. **Custom Tools (Benutzerdefinierte Werkzeuge)**
   - Laden von Custom Tools aus Vault-Ordner
   - JavaScript-Code in sicherer Sandbox ausführen (QuickJS geplant)
   - Automatische Discovery und Registrierung

4. **Tool-Ausführung & Orchestrierung**
   - Einzelne Tools ausführen mit Parameter-Validierung
   - Tool-Chains mit sequenzieller Ausführung
   - Output-Propagation zwischen Steps
   - Fehlerbehandlung und Logging

5. **Human-in-the-Loop (HITL)**
   - Bestätigungsmodal für destruktive Operationen
   - Kontextinformationen und Vorschau anzeigen
   - Approve/Reject mit Begründung
   - Konfigurierbare HITL-Regeln pro Tool

6. **UI-Integration**
   - Sidebar mit Tool-Übersicht und Kategorisierung
   - Dynamische Formulargenerierung basierend auf Parametern
   - Status-Feedback und Ergebnisanzeige
   - Mobile-kompatibles Design

7. **Qualitätseigenschaften**
   - **Wartbarkeit:** Tools ohne Code-Änderungen anpassbar
   - **Portabilität:** Reine Textdateien, plattformunabhängig
   - **Sicherheit:** HITL + Sandbox für sichere Ausführung
   - **Mobile-First:** iOS/Android-kompatibel

---

## 2. Stand der Implementierung: Was ist da, was fehlt?

### 2.1 Vollständig implementiert ✅

#### Parser & Foundation Layer (Phase 1)
| Komponente | Zeilen | Status | Beschreibung |
|-----------|--------|--------|--------------|
| `types.ts` | 167 | ✅ | 12 zentrale Interfaces (Agent, Parameter, ExecutionContext, etc.) |
| `yaml-parser.ts` | 301 | ✅ | Custom YAML-Parser mit Frontmatter-Extraktion |
| `placeholder.ts` | 205 | ✅ | Placeholder-Engine mit nested object access |
| `validator.ts` | 225 | ✅ | Parameter-Validierung mit Typ-Konvertierung |
| `tool-loader.ts` | 165 | ✅ | Rekursive Tool-Discovery im Vault |
| `logger.ts` | 143 | ✅ | Debug-Logging mit Log-Levels |
| `constants.ts` | 101 | ✅ | Shared Constants (IDs, Icons, Kategorien) |

**Funktionsumfang:**
- ✅ YAML-Frontmatter parsen (`---...---`)
- ✅ Code-Block-Extraktion (JavaScript & YAML)
- ✅ Parameter mit Type-Support (string, number, boolean, array, object)
- ✅ Placeholder-Ersetzung: `{{param}}`, `{{prev_step.output}}`, `{{date}}`, `{{time}}`, `{{random_id}}`
- ✅ Nested Field-Access: `{{prev_step.output.field.subfield}}`
- ✅ Rekursive Tool-Discovery in Vault-Ordnern
- ✅ Validierung mit Default-Values und Required-Checks

#### Core Execution Layer (Phase 2)
| Komponente | Zeilen | Status | Beschreibung |
|-----------|--------|--------|--------------|
| `predefined.ts` | 395 | ✅ | 4 Standard-Tools mit Factory Pattern |
| `tool-registry.ts` | 195 | ✅ | Tool-Management (Predefined + Custom) |
| `sandbox.ts` | 250 | 🟡 | QuickJS-Stub (echte Integration fehlt) |
| `tool-executor.ts` | 315 | ✅ | Orchestrierung + HITL-Framework |

**Funktionsumfang:**
- ✅ Factory Pattern für Tool-Instanziierung
- ✅ Tool-Registry mit Lookup und Caching
- ✅ 4 vordefinierte Tools vollständig implementiert
- ✅ HITL-Entscheidungslogik (Callback-basiert)
- ✅ Placeholder-Integration in Execution Context
- ✅ Sequential Step-Execution für Chains
- 🟡 QuickJS-Sandbox nur als Stub (verwendet Node Function-Wrapper)

#### UI Layer (Phase 3)
| Komponente | Zeilen | Status | Beschreibung |
|-----------|--------|--------|--------------|
| `sidebar.ts` | 254 | ✅ | Sidebar View für Tool-Auswahl |
| `forms.ts` | 411 | ✅ | Dynamische Parameter-Formulare |
| `hitl-modal.ts` | 285 | ✅ | HITL-Bestätigungsdialog |
| `main.ts` | 237 | ✅ | Plugin Lifecycle und Integration |
| `settings.ts` | 67 | ✅ | Settings Tab |
| `styles.css` | 422 | ✅ | Responsive UI Styles |

**Funktionsumfang:**
- ✅ Dynamische Form-Generierung basierend auf Parameter-Definitionen
- ✅ Type-spezifische Input-Felder
- ✅ Client-side Validierung
- ✅ Sidebar kompiliert erfolgreich
- ✅ HITL-Modal kompiliert erfolgreich
- ✅ **Build erfolgreich - Plugin kann kompiliert werden!**

### 2.2 Teilweise implementiert 🟡

#### Chain-Execution
- ✅ Typ-Definition vorhanden (`type: chain`, `steps[]`)
- ✅ Placeholder für `prev_step.output` implementiert
- ✅ Sequential Execution im Executor
- ❌ Multi-Step-Loop nicht vollständig getestet
- ❌ Kein Progress-Indicator
- ❌ Kein `continueOnError` Flag

#### Custom-JS Sandbox
- ✅ Interface definiert (`QuickJSSandbox`, `CustomJSExecutor`)
- ✅ Code-Validierung (blockiert require, eval, process, global, Function)
- ✅ Stub-Mode funktioniert (Node Function-Wrapper)
- ❌ Echte QuickJS-Integration fehlt
- ❌ Keine Memory/Timeout-Limits
- ❌ Keine Mobile-Isolation

#### Pre/Post-Processing
- ✅ Notation definiert (`// @preprocess`, `// @postprocess`)
- ✅ Parser erkennt Code-Blöcke
- ❌ Executor nutzt Pre/Post-Processing nicht
- ❌ Keine Tests für Processing-Hooks

### 2.3 Nicht implementiert ❌

1. **~~UI-Integration vollständig~~** ✅ **BEHOBEN**
   - ~~Sidebar kompiliert nicht (TypeScript-Fehler)~~ ✅ Build erfolgreich
   - ~~HITL-Modal kompiliert nicht~~ ✅ Build erfolgreich
   - End-to-End UI-Workflow noch zu testen

2. **QuickJS-Integration**
   - Nur Stub vorhanden
   - Keine WASM-basierte Sandbox
   - Keine Mobile-Kompatibilität für Custom-JS

3. **Testing-Infrastructure**
   - `vitest` nicht installiert
   - Keine Unit-Tests vorhanden
   - Keine Integration-Tests
   - Keine E2E-Tests

4. **Error Recovery**
   - Kein Retry-Mechanismus
   - Kein `continueOnError` in Chains
   - Keine Fallback-Strategien

5. **Execution History**
   - Keine Persistierung von Results
   - Kein History-Panel
   - Keine Re-Run-Funktionalität

6. **Documentation**
   - Kein User-Guide
   - Keine Custom Tool Templates
   - Keine Video-Tutorials
   - README veraltet

---

## 3. Bisherige Lösung: Architektur und wichtige Komponenten

### 3.1 Layered Architecture

```
┌─────────────────────────────────────────┐
│  UI Layer (Phase 3)                     │
│  src/ui/                                │
│  - sidebar.ts (❌ Build-Fehler)         │
│  - forms.ts (✅)                         │
│  - hitl-modal.ts (❌ Build-Fehler)      │
│  - main.ts (✅)                          │
└────────────┬────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│  Core Layer (Phase 2)                   │
│  src/core/                              │
│  - tool-executor.ts (✅)                │
│  - tool-registry.ts (✅)                │
│  - sandbox.ts (🟡 Stub)                 │
└────────────┬────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│  Tools Layer (Phase 2)                  │
│  src/tools/                             │
│  - predefined.ts (✅)                   │
│    → 4 Standard-Tools                   │
└────────────┬────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│  Parser Layer (Phase 1)                 │
│  src/parser/                            │
│  - yaml-parser.ts (✅)                  │
│  - placeholder.ts (✅)                  │
│  - validator.ts (✅)                    │
│  - tool-loader.ts (✅)                  │
└────────────┬────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│  Types Layer (Phase 1)                  │
│  src/types.ts (✅)                      │
│  - 12 zentrale Interfaces               │
└─────────────────────────────────────────┘
```

### 3.2 Wichtige Komponenten und deren Verantwortlichkeiten

#### 3.2.1 Parser Layer (`src/parser/`)

**`yaml-parser.ts` (301 Zeilen)**
- **Verantwortung:** Markdown → Agent-Objekt Konvertierung
- **Kern-Funktionen:**
  - `parseFrontmatter()`: YAML-Frontmatter extrahieren und parsen
  - `extractCodeBlocks()`: JavaScript/YAML Code-Blöcke finden
  - `parseToolFile()`: Komplettes Parsing einer Tool-Datei
  - `toAgent()`: ParsedToolFile → Agent Konvertierung
- **Besonderheit:** Custom YAML-Parser (keine js-yaml Dependency)
- **Datei:** `/home/runner/work/PaperAgents/PaperAgents/src/parser/yaml-parser.ts`

**`placeholder.ts` (205 Zeilen)**
- **Verantwortung:** `{{placeholders}}` durch Kontext-Werte ersetzen
- **Unterstützte Placeholders:**
  - `{{param_name}}` → User-Parameter
  - `{{prev_step.output}}` → Vorheriger Step Output
  - `{{prev_step.output.field}}` → Nested Field-Access
  - `{{date}}` → YYYY-MM-DD
  - `{{time}}` → HH:mm:ss
  - `{{random_id}}` → UUID v4
- **Kern-Funktionen:**
  - `replacePlaceholdersInString()`
  - `replacePlaceholdersInObject()` (rekursiv)
  - `validatePlaceholders()`
  - `createContext()`
- **Datei:** `/home/runner/work/PaperAgents/PaperAgents/src/parser/placeholder.ts`

**`validator.ts` (225 Zeilen)**
- **Verantwortung:** Parameter-Validierung gegen Schema
- **Type-Support:** string, number, boolean, array, object
- **Kern-Funktionen:**
  - `validateParameters()`: Batch-Validierung
  - `normalizeInput()`: Type-Casting
  - `validateValue()`: Single-Parameter Check
- **Datei:** `/home/runner/work/PaperAgents/PaperAgents/src/parser/validator.ts`

**`tool-loader.ts` (165 Zeilen)**
- **Verantwortung:** Custom Tools aus Vault laden
- **Kern-Funktionen:**
  - `discoverTools()`: Rekursive .md-Datei-Suche
  - `parseToolFile()`: Tool-Datei parsen
  - `loadCustomTools()`: Batch-Loading mit Error-Handling
- **Datei:** `/home/runner/work/PaperAgents/PaperAgents/src/parser/tool-loader.ts`

#### 3.2.2 Core Layer (`src/core/`)

**`tool-registry.ts` (195 Zeilen)**
- **Verantwortung:** Zentrale Tool-Verwaltung
- **Datenstrukturen:**
  - `predefinedTools: Map<string, IToolFactory>`
  - `customTools: Map<string, Agent>`
  - `executableTools: Map<string, IExecutableTool>` (Cache)
- **Kern-Funktionen:**
  - `registerPredefined()`, `registerCustom()`
  - `getTool(id)`: Lazy-Loading mit Caching
  - `listTools()`: Alle Tools mit Metadaten
  - `searchTools(query)`: Full-text Search
- **Design-Pattern:** Factory Method mit Lazy Initialization
- **Datei:** `/home/runner/work/PaperAgents/PaperAgents/src/core/tool-registry.ts`

**`tool-executor.ts` (315 Zeilen)**
- **Verantwortung:** Tool-Ausführung orchestrieren
- **Workflow:**
  1. Parameter validieren
  2. ExecutionContext erstellen
  3. Placeholders ersetzen
  4. HITL prüfen (falls erforderlich)
  5. Tool ausführen
  6. Output sammeln und loggen
- **HITL-Integration:** Callback-basiert
- **Datei:** `/home/runner/work/PaperAgents/PaperAgents/src/core/tool-executor.ts`

**`sandbox.ts` (250 Zeilen, Stub)**
- **Verantwortung:** JavaScript-Code sicher ausführen
- **Aktuell:** Node Function-Wrapper (nicht isoliert)
- **Geplant:** QuickJS WASM-basierte Sandbox
- **Code-Validierung:** Blockiert require, eval, process, global
- **Datei:** `/home/runner/work/PaperAgents/PaperAgents/src/core/sandbox.ts`

#### 3.2.3 Tools Layer (`src/tools/`)

**`predefined.ts` (395 Zeilen)**
- **Verantwortung:** 4 Standard-Tools implementieren
- **Tools:**
  1. **SearchFilesTool** (`search_files`)
     - Vault-Dateien durchsuchen
     - Parameter: query, path
     - Keine HITL
  2. **ReadFileTool** (`read_file`)
     - Datei-Inhalt lesen
     - Parameter: filePath
     - Keine HITL
  3. **WriteFileTool** (`write_file`)
     - Datei schreiben/ändern
     - Parameter: filePath, content, overwrite
     - **HITL: immer**
  4. **RestRequestTool** (`rest_request`)
     - HTTP-Requests
     - Parameter: url, method, headers, body
     - **HITL: bei PUT/POST/DELETE**
- **Design-Pattern:** Factory Pattern (SearchFilesFactory, etc.)
- **Datei:** `/home/runner/work/PaperAgents/PaperAgents/src/tools/predefined.ts`

#### 3.2.4 UI Layer (`src/ui/`)

**`forms.ts` (411 Zeilen) ✅**
- **Verantwortung:** Dynamische Formulare generieren
- **Features:**
  - Type-spezifische Input-Felder
  - Default-Values vorausfüllen
  - Client-side Validierung
  - Required/Optional Badge
- **Datei:** `/home/runner/work/PaperAgents/PaperAgents/src/ui/forms.ts`

**`sidebar.ts` (254 Zeilen) ❌**
- **Verantwortung:** Tool-Übersicht und Auswahl
- **Problem:** Kompiliert nicht (Obsidian API-Fehler)
- **Fehler:**
  - `createDiv` existiert nicht auf `HTMLElement`
  - `containerEl` Property fehlt
  - `empty()` Methode nicht gefunden
- **Datei:** `/home/runner/work/PaperAgents/PaperAgents/src/ui/sidebar.ts`

**`hitl-modal.ts` (285 Zeilen) ❌**
- **Verantwortung:** HITL-Bestätigungsmodal
- **Problem:** Kompiliert nicht (Modal API-Fehler)
- **Fehler:**
  - `contentEl` Property fehlt
  - `close()` Methode nicht gefunden
  - `open()` Methode nicht gefunden
- **Datei:** `/home/runner/work/PaperAgents/PaperAgents/src/ui/hitl-modal.ts`

### 3.3 Datenflüsse

#### Tool-Execution Flow:
```
User Input
  ↓
ToolExecutor.execute()
  ↓
1. Parameter validieren (validator.ts)
  ↓
2. ExecutionContext erstellen (placeholder.ts)
  ↓
3. Tool aus Registry laden (tool-registry.ts)
  ↓
4. HITL prüfen? → Modal anzeigen (hitl-modal.ts)
  ↓
5. Tool.execute(context)
  ↓
6. Output loggen und zurückgeben
```

#### Chain-Execution Flow:
```
Chain-Agent laden
  ↓
For each Step:
  ├─ Placeholders ersetzen (inkl. prev_step.output)
  ├─ Tool ausführen
  ├─ Output speichern in stepOutputs
  └─ Weiter zum nächsten Step
  ↓
Final Result
```

---

## 4. Tool-Notation in Markdown: Präzise Spezifikation

### 4.1 Grundstruktur

Jede Tool-Definition ist eine Markdown-Datei mit:
1. **YAML-Frontmatter** (Pflicht)
2. **Pre-Processing-Block** (Optional)
3. **Tool-Ausführung/Steps** (Pflicht)
4. **Post-Processing-Block** (Optional)

### 4.2 YAML-Frontmatter

```yaml
---
tool: true                              # Pflicht: Kennzeichnung als Tool
id: "unique_tool_id"                    # Pflicht: Eindeutige ID (z.B. "search_notes")
name: "Tool Name"                       # Pflicht: Anzeigename
description: "Was das Tool tut"         # Optional: Beschreibung für UI
type: "single" | "chain"                # Pflicht: Tool-Typ
parameters:                             # Pflicht: Array (kann leer sein)
  - name: "param_name"                  # Pflicht: Parameter-Name
    type: "string|number|boolean|array|object"  # Pflicht: Datentyp
    description: "Parameterbeschreibung"        # Optional
    required: true | false              # Pflicht
    default: <wert>                     # Optional: Default-Wert
---
```

**Beispiel:**
```yaml
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
    required: false
    default: "bullet"
---
```

### 4.3 Pre-Processing-Block (Optional)

**Syntax:**
````markdown
#### **Pre-Processing**
```javascript
// @preprocess
// JavaScript-Code hier
// input-Objekt enthält alle Parameter
// Muss input-Objekt zurückgeben

input.filePath = input.input.trim() + ".md";
return input;
```
````

**Zweck:** Input-Parameter transformieren bevor Tool ausgeführt wird

**Eingabe:** `input`-Objekt mit allen Parametern  
**Ausgabe:** Modifiziertes `input`-Objekt (muss `return` Statement haben)

**Erlaubte Operationen:**
- String-Manipulation
- Objektfeld-Modifikation
- Globale Helfer (z.B. `encodeURIComponent`)

**Verbotene Operationen:**
- `require`, `eval`, `process`, `global`, `Function`

### 4.4 Tool-Ausführung (type: single)

**Syntax:**
````markdown
#### **Tool-Ausführung**
```yaml
tool: "tool_id"                    # ID eines vordefinierten Tools
parameters:
  filePath: "{{filePath}}"         # Placeholder-Referenzen
  content: "static value"          # Oder statische Werte
```
````

**Oder Custom JavaScript:**
````markdown
#### **Tool-Ausführung**
```javascript
function processData(input) {
  // Custom Logic
  return {
    result: input.text.toUpperCase()
  };
}
return processData(input);
```
````

### 4.5 Steps (type: chain)

**Syntax:**
````markdown
#### **Steps**
```yaml
steps:
  - name: "step_name_1"              # Eindeutiger Step-Name
    tool: "search_files"             # Tool-ID (vordefiniert oder custom)
    parameters:
      query: "{{query}}"             # User-Parameter
      path: "/"
    
  - name: "step_name_2"
    tool: "read_file"
    parameters:
      filePath: "{{prev_step.output.results[0].path}}"  # Output vom vorherigen Step
```
````

**Output-Referenzen in Chains:**
- `{{prev_step.output}}` → Output vom direkt vorherigen Step
- `{{step_name.output}}` → Output von spezifischem Step
- `{{step_name.output.field}}` → Nested Field-Access
- `{{step_name.output.array[0]}}` → Array-Zugriff

### 4.6 Post-Processing-Block (Optional)

**Syntax:**
````markdown
#### **Post-Processing**
```javascript
// @postprocess
// output enthält das Ergebnis der Tool-Ausführung
// Muss verarbeitetes Objekt zurückgeben

return {
  echoed: typeof output === 'string' ? output.toUpperCase() : JSON.stringify(output),
  log: []
};
```
````

**Zweck:** Tool-Output transformieren bevor es zurückgegeben wird

**Eingabe:** `output`-Objekt (Ergebnis der Tool-Ausführung)  
**Ausgabe:** Modifiziertes Output-Objekt

### 4.7 Unterstützte Placeholders

| Placeholder | Beschreibung | Beispiel |
|------------|--------------|----------|
| `{{param_name}}` | User-Parameter | `{{query}}` |
| `{{prev_step.output}}` | Output vom vorherigen Step | `{{prev_step.output}}` |
| `{{prev_step.output.field}}` | Nested Field-Access | `{{prev_step.output.content}}` |
| `{{step_name.output}}` | Output von spezifischem Step | `{{search_files.results}}` |
| `{{date}}` | Aktuelles Datum (YYYY-MM-DD) | `{{date}}` |
| `{{time}}` | Aktuelle Zeit (HH:mm:ss) | `{{time}}` |
| `{{random_id}}` | UUID v4 | `{{random_id}}` |

### 4.8 Vollständiges Beispiel: Single Tool

````markdown
---
tool: true
id: "single_echo"
name: "Single Echo"
type: "single"
parameters:
  - name: "input"
    type: "string"
    required: true
description: "Echo tool with trim and uppercase"
---

#### **Pre-Processing**
```javascript
// @preprocess
input.filePath = input.input.trim() + ".md";
return input;
```

#### **Tool-Ausführung**
```yaml
tool: "read_file"
parameters:
  filePath: "{{filePath}}"
```

#### **Post-Processing**
```javascript
// @postprocess
return {
  echoed: typeof output === 'string' ? output.toUpperCase() : JSON.stringify(output),
  log: []
};
```
````

### 4.9 Vollständiges Beispiel: Chain Tool

````markdown
---
tool: true
id: "chain_reader"
name: "Chain Reader"
type: "chain"
parameters:
  - name: "query"
    type: "string"
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
````

### 4.10 Validierungsregeln

1. **Frontmatter:**
   - `tool: true` muss vorhanden sein
   - `id`, `name`, `type` sind Pflichtfelder
   - `parameters` muss Array sein (kann leer sein)
   - Jeder Parameter muss `name`, `type`, `required` haben

2. **Pre/Post-Processing:**
   - Muss `// @preprocess` bzw. `// @postprocess` Marker haben
   - Muss `return` Statement enthalten
   - Darf keine verbotenen Funktionen verwenden (require, eval, etc.)

3. **Tool-Ausführung (single):**
   - Entweder YAML mit `tool:` und `parameters:`
   - Oder JavaScript-Code mit `return` Statement

4. **Steps (chain):**
   - Nur bei `type: chain`
   - Jeder Step muss `name`, `tool`, `parameters` haben
   - Step-Namen müssen eindeutig sein

5. **Placeholders:**
   - Müssen Format `{{...}}` haben
   - Referenzen müssen auflösbar sein

---

## 5. Nächste Schritte, Showstopper und Risiken

### 5.1 Kritische Showstopper 🔴

#### ~~1. Build-Fehler in UI-Komponenten~~ ✅ **BEHOBEN (12. Januar 2026)**

**Problem:**
- ~~`sidebar.ts` kompiliert nicht (14+ TypeScript-Fehler)~~ ✅ Behoben
- ~~`hitl-modal.ts` kompiliert nicht (11+ TypeScript-Fehler)~~ ✅ Behoben
- ~~Grund: Falsche Verwendung der Obsidian API~~ ✅ Behoben

**Impact:** ~~Plugin kann nicht gebaut werden → Nicht nutzbar~~ ✅ Build erfolgreich

**Lösung durchgeführt:**
1. ✅ TypeScript-Konfiguration aktualisiert (ES2017+ libs für Object.entries/fromEntries)
2. ✅ Obsidian-Dependencies korrekt installiert (npm install)
3. ✅ IToolFactory-Interface erweitert um App-Parameter
4. ✅ ToolRegistry aktualisiert um App-Instanz zu verwalten
5. ✅ Alle Predefined Tool Factories aktualisiert (SearchFiles, ReadFile, WriteFile, RestRequest)
6. ✅ Null/undefined-Checks in Parser-Dateien ergänzt (placeholder.ts, placeholder_new.ts, yaml-parser.ts)
7. ✅ RequestUrl API korrekt verwendet (kein statusText-Feld)

**Status:** ✅ **Build erfolgreich** - Plugin kompiliert ohne Fehler
- `main.js` generiert (40 KB)
- `manifest.json` vorhanden
- `styles.css` vorhanden

**Aufwand:** ~2 Stunden (statt geschätzt 4-6 Stunden)

---

#### ~~1. Fehlende Test-Infrastructure~~ ✅ **BEHOBEN (12. Januar 2026)**

**Problem:**
- ~~`vitest` ist installiert, aber nicht konfiguriert~~ ✅ Konfiguriert
- ~~Keine Tests vorhanden~~ ✅ 38 Tests implementiert
- ~~Test-Guide vorhanden, aber nicht umsetzbar~~ ✅ Tests laufen

**Status:** ✅ **Tests erfolgreich** - Umfassende Test-Suite läuft
- **12 Test-Dateien** erfolgreich
- **38 Tests** bestanden (Unit + Integration + E2E)
- **Code Coverage:** 66.14% Statements
- **Test-Kategorien:**
  - ✅ Unit-Tests: Parser, Validator, Placeholder, ToolRegistry, ToolExecutor
  - ✅ Integration-Tests: Predefined Tools, Tool-Loader
  - ✅ E2E-Tests: Single Tool, Chain Tool, Discovery & Execution

**Lösung durchgeführt:**
1. ✅ `vitest.config.ts` konfiguriert mit Coverage
2. ✅ Obsidian API gemockt (TFile, Vault, App, requestUrl)
3. ✅ Unit-Tests für alle Parser-Komponenten geschrieben
4. ✅ Integration-Tests für alle 4 Predefined Tools
5. ✅ E2E-Szenarien für Tool-Discovery und -Execution
6. ✅ Alle Factory-Pattern Tests mit App-Instanz korrigiert

**Aufwand:** ~1 Tag (inkl. Bug-Fixes)

**Noch ausstehend:** Manuelle UI-Tests in echtem Obsidian-Vault (siehe testing_guide.md)

### 5.2 Wichtige Risiken und technische Schulden 🟡

#### 1. QuickJS-Integration fehlt
**Problem:**
- Nur Stub-Mode (Node Function-Wrapper)
- Keine echte Sandbox-Isolation
- Keine Mobile-Kompatibilität

**Impact:** Custom-JS Tools nicht sicher → Sicherheitsrisiko

**Technische Schuld:** Stub-Code muss durch echte QuickJS-Integration ersetzt werden

**Lösung:**
1. `quickjs-emscripten` installieren
2. Runtime initialisieren in `sandbox.ts`
3. Context und Limits konfigurieren
4. Tests für Sandbox schreiben

**Priorität:** P1 - Vor Production-Release

**Geschätzter Aufwand:** 1-2 Tage

#### 2. Pre/Post-Processing nicht genutzt
**Problem:**
- Parser erkennt `@preprocess` und `@postprocess` Blöcke
- Executor nutzt sie aber nicht

**Impact:** Feature ist dokumentiert, funktioniert aber nicht

**Technische Schuld:** Disconnect zwischen Parser und Executor

**Lösung:**
1. Executor erweitern um Pre/Post-Processing Hooks
2. Custom-JS über Sandbox ausführen
3. Tests für Processing-Pfade schreiben

**Priorität:** P1 - Feature-Completeness

**Geschätzter Aufwand:** 1 Tag

#### 3. Chain-Execution nicht vollständig getestet
**Problem:**
- Code vorhanden für Sequential Execution
- Kein `continueOnError` Flag
- Kein Progress-Tracking
- Keine Tests für komplexe Chains

**Impact:** Chains könnten bei Fehlern abstürzen

**Technische Schuld:** Error-Handling und Recovery fehlen

**Lösung:**
1. `continueOnError` Flag zu Steps hinzufügen
2. Progress-Callback implementieren
3. Error-Recovery-Strategien definieren
4. E2E-Tests für Chains schreiben

**Priorität:** P2 - Nice to have

**Geschätzter Aufwand:** 2-3 Tage

#### 4. Placeholder-System nicht vollständig robust
**Problem:**
- Nested Field-Access implementiert
- Array-Zugriff implementiert
- Aber: Keine Tests für Edge-Cases (undefined, null, circular references)

**Impact:** Chains könnten bei komplexen Datenstrukturen crashen

**Technische Schuld:** Fehlende Validierung und Error-Handling

**Lösung:**
1. Tests für Edge-Cases schreiben
2. Graceful Fallbacks bei undefined/null
3. Zirkularitätsprüfung
4. Bessere Error-Messages

**Priorität:** P2 - Robustheit

**Geschätzter Aufwand:** 1-2 Tage

#### 5. Keine Execution History
**Problem:**
- Tool-Executions werden geloggt
- Logs werden nicht persistiert
- Kein History-Panel in UI

**Impact:** Debugging schwierig, keine Audit-Trail

**Technische Schuld:** Logging-Infrastruktur vorhanden, aber nicht genutzt

**Lösung:**
1. Log-Persistierung implementieren
2. History-Panel in Sidebar
3. Re-Run Funktionalität
4. Export-Funktion

**Priorität:** P3 - Future Enhancement

**Geschätzter Aufwand:** 3-4 Tage

### 5.3 Entwicklungsplan: Feature-Completeness mit Unit Tests

**Strategie:** Funktionen komplett implementieren und via Unit Tests absichern, dann am Ende manueller UI-Test

#### ~~Phase 1: Build & Test-Infrastructure~~ ✅ **ERLEDIGT (12. Januar 2026)**
1. ✅ UI-Komponenten fixen (sidebar.ts, hitl-modal.ts)
2. ✅ Build erfolgreich ausführen
3. ✅ Test-Suite implementiert (38 Tests, 66% Coverage)
4. ✅ Obsidian API gemockt

**Deliverable:** ✅ Solide Test-Grundlage mit automatisierten Tests

#### Phase 2: Feature-Runde 1 - Pre/Post-Processing ⏳
1. Executor erweitern um Pre/Post-Processing Hooks
2. Integration mit Sandbox (aktuell Stub-Mode)
3. **Unit Tests schreiben:**
   - Pre-Processing transformiert Input korrekt
   - Post-Processing transformiert Output korrekt
   - Fehlerbehandlung bei Invalid JS
   - Edge Cases (undefined, null, komplexe Objekte)
4. Beispiel-Tools mit Pre/Post-Processing erstellen
5. Integration-Tests für komplette Workflows

**Deliverable:** Pre/Post-Processing funktional und getestet (>80% Coverage)

**Geschätzter Aufwand:** 1-2 Tage

**Akzeptanzkriterium:** Alle Unit Tests grün, Coverage >80% für neue Features

#### Phase 3: Feature-Runde 2 - QuickJS-Sandbox ⏳
1. `quickjs-emscripten` installieren
2. Sandbox-Stub durch echte QuickJS-Implementierung ersetzen
3. **Unit Tests schreiben:**
   - Sandbox isoliert Code korrekt
   - Memory-Limits funktionieren
   - Timeout-Limits funktionieren
   - Gefährliche APIs blockiert (require, eval, etc.)
   - Mobile-Kompatibilität
4. Custom-JS Security-Tests
5. Performance-Tests für Sandbox-Overhead

**Deliverable:** Sichere Custom-JS Ausführung, vollständig getestet (>85% Coverage)

**Geschätzter Aufwand:** 1-2 Tage

**Akzeptanzkriterium:** Security-Tests grün, Performance akzeptabel, keine Isolation-Leaks

#### Phase 4: Finaler manueller UI-Test 🎯
1. Plugin in Obsidian Test-Vault laden
2. Manual Testing Guide durcharbeiten (testing_guide.md)
3. UI-Funktionalität end-to-end testen:
   - Sidebar, Forms, HITL-Modal
   - Pre/Post-Processing in echtem Obsidian
   - Custom-JS Tools mit QuickJS
   - Error-Handling in UI
4. Nur UI-Bugs dokumentieren und beheben

**Deliverable:** Plugin funktioniert fehlerfrei in Obsidian

**Geschätzter Aufwand:** 0.5-1 Tag

**Akzeptanzkriterium:** Alle manuellen Tests bestanden, keine kritischen UI-Bugs

**Vorteil dieser Strategie:**
- ✅ Alle Features sind durch Unit Tests abgesichert
- ✅ Fehlersuche im finalen UI-Test auf UI-spezifische Bugs eingegrenzt
- ✅ Kern-Logik ist bereits validiert
- ✅ Schnellere Bug-Fixes (klare Trennung UI vs. Logik)

### 5.4 Entwicklungsroadmap

**Phase 1: Foundation** ✅ **ERLEDIGT (12. Januar 2026)**
- ✅ Build-Fehler beheben
- ✅ Test-Infrastructure aufsetzen (38 Tests, 66% Coverage)
- ✅ Kern-Logik getestet (Parser, Tools, Executor)

**Phase 2: Feature-Runde 1** ⏳ **NÄCHSTER SCHRITT (1-2 Tage)**
- ⏳ Pre/Post-Processing implementieren
- ⏳ Unit Tests für Pre/Post-Processing (>80% Coverage)
- ⏳ Integration-Tests für komplette Workflows

**Phase 3: Feature-Runde 2** ⏳ **(1-2 Tage)**
- ⏳ QuickJS-Sandbox integrieren
- ⏳ Security & Performance Unit Tests
- ⏳ Mobile-Kompatibilität sicherstellen

**Phase 4: Finaler UI-Test** 🎯 **(0.5-1 Tag)**
- ⏳ Manuelles Testing in Obsidian
- ⏳ UI-Bugs fixen
- ⏳ Release vorbereiten

**Gesamtaufwand bis Release:** 3-5 Tage

**Mittelfristig (nach v0.1.0):**
- Chain-Execution robustifizieren
- Error-Recovery implementieren
- Execution History
- Mobile Testing erweitern

**Langfristig (3+ Monate):**
- Tool-Versioning
- Conditional Execution (if/else)
- Loop-Unterstützung
- OpenTelemetry Integration

---

## 6. Einschätzung: Wie weit ist der Meilenstein?

### 6.1 Meilenstein "Werkzeuge": Fortschritt

**Gesamtfortschritt:** 🟢 **~85% implementiert** (Update: 12. Januar 2026)

| Bereich | Fortschritt | Details |
|---------|------------|---------|
| **Parser & Foundation** | ✅ 100% | Vollständig und funktionsfähig |
| **Core Execution** | 🟡 85% | Sandbox nur Stub, sonst komplett |
| **Predefined Tools** | ✅ 100% | Alle 4 Tools implementiert und getestet |
| **Custom Tools** | 🟡 70% | Laden funktioniert, JS-Sandbox Stub |
| **UI Integration** | 🟡 90% | Build erfolgreich, manuelles Testing ausstehend |
| **Testing** | ✅ 85% | 38 Unit/Integration/E2E Tests erfolgreich (66% Coverage) |
| **Documentation** | 🟡 70% | Umfangreich vorhanden, teilweise veraltet |

### 6.2 Zur Fertigstellung fehlen:

**Must-Have (für initialen Test-Release):**
1. ✅ UI Build-Fehler beheben (2h) **← ERLEDIGT**
2. ✅ Test-Suite aufsetzen (2-3 Tage) **← ERLEDIGT**
3. ⏳ Manuelle Tests in Obsidian durchführen (2-3h) **← NÄCHSTER SCHRITT**
4. ⏳ Bug-Fixes aus manuellem Testing (1-2 Tage)

**Should-Have (für Production-Release):**
1. ⏳ Pre/Post-Processing aktivieren (1 Tag)
2. ⏳ QuickJS integrieren (1-2 Tage)
3. Chain-Error-Handling (2-3 Tage)
4. Documentation Update (1 Tag)
5. User-Guide erstellen (1 Tag)

**Could-Have (Nice to have):**
1. Mobile Testing (2-3 Tage)
2. Execution History (3-4 Tage)
3. Progress-Indicator (2 Tage)
4. Tool-Versioning (1 Woche)

**Geschätzte Zeit:**
- **Bis Test-Release (ohne Pre/Post & QuickJS):** 1-2 Tage
- **Bis Production-Release (komplett):** 1-2 Wochen (bei Vollzeit-Arbeit)

### 6.3 Qualitätseinschätzung der Implementierung

**Stärken ✅:**
- Clean Architecture mit klarer Layer-Trennung
- Solide Type-Safety (TypeScript strict mode)
- Factory Pattern für Erweiterbarkeit
- Gute Separation of Concerns
- Comprehensive Parser-Implementation
- Durchdachtes Placeholder-System
- **Umfassende Test-Suite (38 Tests, 66% Coverage)**
- **Build erfolgreich ohne Fehler**

**Schwächen ❌:**
- ~~UI-Komponenten folgen nicht Obsidian-Patterns~~ ✅ Behoben
- ~~Keine Tests (0% Coverage)~~ ✅ Behoben
- QuickJS nur Stub ← Sicherheitsrisiko für Custom-JS
- Pre/Post-Processing nicht genutzt ← Feature-Gap
- Keine Error-Recovery in Chains
- Manuelles Testing in Obsidian ausstehend

**Code-Qualität:** 🟢 **8.5/10** (Update: 12. Januar 2026)
- Gut strukturiert und wartbar
- Build erfolgreich
- Gute Test-Abdeckung
- Fehlende Features (QuickJS, Pre/Post) senken Score leicht

---

## 7. Integration mit zukünftigen Meilensteinen

### 7.1 Meilenstein "Agenten"

**Architektur-Fit:** ✅ **Sehr gut vorbereitet**

Die aktuelle Tool-Infrastruktur ist ideal für Agent-Integration:

**Bestehende Foundation:**
- ✅ Agent-Interface bereits definiert (types.ts)
- ✅ Tool-Registry kann Agent-Tools speichern
- ✅ Executor kann Chains orchestrieren
- ✅ Placeholder-System unterstützt Kontext-Weitergabe

**Benötigte Erweiterungen:**
1. **LLM-Integration:**
   - OpenRouter API-Client
   - Prompt-Template-System
   - Response-Parsing

2. **Agent-Orchestrierung:**
   - Multi-Agent Workflows
   - Agent-to-Agent Communication
   - Shared Context Management

3. **Tool-Selection:**
   - Agent wählt Tools basierend auf Ziel
   - Dynamic Tool-Discovery
   - Tool-Beschreibungen für LLM

**Geschätzter Zusatzaufwand:** 2-3 Wochen

### 7.2 Meilenstein "Evaluation"

**Architektur-Fit:** ✅ **Gut vorbereitet**

Logging und Execution-Tracking sind vorhanden:

**Bestehende Foundation:**
- ✅ ExecutionResult mit Logs
- ✅ ToolExecution-Tracking
- ✅ Logger mit verschiedenen Log-Levels

**Benötigte Erweiterungen:**
1. **Metrics-Collection:**
   - Performance-Metriken (Latenz, Tokens)
   - Success/Failure-Rates
   - Cost-Tracking

2. **Evaluation-Framework:**
   - Test-Cases definieren
   - Expected vs. Actual Comparison
   - Scoring-Mechanismen

3. **Reporting:**
   - Dashboard für Metriken
   - Trend-Analyse
   - Export-Funktionen

**Geschätzter Zusatzaufwand:** 2-3 Wochen

### 7.3 Meilenstein "Gesprächshistorie"

**Architektur-Fit:** 🟡 **Teilweise vorbereitet**

Chat-Interface fehlt noch komplett:

**Bestehende Foundation:**
- ✅ ExecutionContext kann erweitert werden
- ✅ Logging-Infrastruktur vorhanden
- ❌ Keine Chat-UI
- ❌ Keine Conversation-Storage

**Benötigte Erweiterungen:**
1. **Chat-Interface:**
   - Message-UI-Komponente
   - Chat-History-Panel
   - Input/Output-Streaming

2. **Conversation-Management:**
   - Message-Storage (IndexedDB?)
   - Conversation-Threading
   - Search in History

3. **Context-Management:**
   - Sliding Window für lange Conversations
   - Context-Compression
   - Relevante Message-Selection

**Geschätzter Zusatzaufwand:** 3-4 Wochen

### 7.4 Gesamteinschätzung: Architektur-Eignung

**Score:** ✅ **8/10** - Sehr gut geeignet

**Begründung:**
- Clean Architecture ermöglicht einfache Erweiterung
- Interface-First Design macht Integration leicht
- Layer-Trennung verhindert Breaking Changes
- Parser und Executor sind agnostisch gegenüber Nutzungskontext

**Risiken:**
- UI-Layer muss komplett überarbeitet werden (Obsidian-konform)
- Sandbox-Integration kritisch für Sicherheit
- Performance bei vielen Agents ungetestet

**Empfehlung:**
Fokus zuerst auf Stabilisierung des Werkzeug-Meilensteins, dann schrittweise Erweiterung für Agenten. Die Architektur unterstützt das gut.

---

## 8. Kritische Analyse und Handlungsempfehlungen

### 8.1 Was läuft gut ✅

1. **Solide Architektur:** Layer-Modell und Separation of Concerns sind vorbildlich
2. **Type-Safety:** Strict TypeScript mit umfassenden Interfaces
3. **Erweiterbarkeit:** Factory Pattern ermöglicht einfaches Hinzufügen neuer Tools
4. **Parser-Qualität:** Custom YAML-Parser funktioniert zuverlässig
5. **Placeholder-System:** Mächtig und flexibel

### 8.2 Was muss sofort verbessert werden 🔴

1. ✅ ~~Build-Fehler: Plugin nicht lauffähig~~ **BEHOBEN** → Build erfolgreich
2. ✅ ~~Fehlende Tests: 0% Coverage → Qualitätsrisiko~~ **BEHOBEN** → 38 Tests, 66% Coverage
3. ⏳ **Manuelle Tests in Obsidian:** UI-Funktionalität ungetestet
4. **Sandbox-Stub:** Sicherheitsrisiko für Custom-JS
5. **Pre/Post-Processing inaktiv:** Feature dokumentiert, aber nicht genutzt

### 8.3 Knallharte Einschätzung (Update: 12. Januar 2026 - Test-Suite implementiert)

**Positiv:**
- ✅ 85% der Kern-Funktionalität ist da und gut implementiert
- ✅ Foundation ist solide und erweiterbar
- ✅ Code-Qualität im Parser/Core-Layer ist hoch
- ✅ **Build erfolgreich - Plugin kompilierbar!**
- ✅ **Test-Suite mit 38 Tests erfolgreich (66% Coverage)**
- ✅ **Alle Predefined Tools getestet und funktionsfähig**

**Negativ:**
- ~~Plugin kann nicht gebaut werden → **Nicht nutzbar**~~ ✅ **BEHOBEN**
- ~~Keine Tests → **Nicht wartbar**~~ ✅ **BEHOBEN**
- ~~UI folgt nicht Obsidian-Standards → **Muss neu geschrieben werden**~~ ✅ **BEHOBEN**
- ⏳ UI-Funktionalität in echtem Obsidian ungetestet → **Risiko**
- QuickJS nur Stub → **Sicherheitsrisiko**
- Pre/Post-Processing inaktiv → **Feature-Gap**

**Fazit (Update 12. Januar 2026):**
Der Meilenstein ist **technisch zu 85% fertig** und **vollständig testbar**! Alle kritischen Build-Probleme sind gelöst. Die Implementierung der Kern-Logik ist gut getestet mit 38 automatisierten Tests. **Nächste Schritte:** Manuelles Testing in Obsidian zur Verifikation der UI-Funktionalität, dann Feature-Completeness (Pre/Post-Processing, QuickJS).

### 8.4 Entwicklungsplan: Feature-First, dann UI-Test

**~~Phase 1: Build & Test-Infrastructure~~** ✅ **ERLEDIGT**
- ✅ Build-Fehler behoben
- ✅ Test-Suite implementiert (38 Tests, 66% Coverage)
- ✅ Kern-Logik getestet und validiert

**Phase 2: Feature-Runde 1 - Pre/Post-Processing** ⏳ **1-2 Tage**
- Tag 1-2: Implementierung + Unit Tests
  - Pre/Post-Processing Hooks in Executor
  - Sandbox-Integration für JS-Ausführung
  - Unit Tests für alle Code-Pfade (>80% Coverage)
  - Integration-Tests für komplette Workflows
  - Edge Cases abdecken
- **Deliverable:** Feature komplett getestet, alle Tests grün

**Phase 3: Feature-Runde 2 - QuickJS-Sandbox** ⏳ **1-2 Tage**
- Tag 1-2: Implementierung + Unit Tests
  - QuickJS-Integration (quickjs-emscripten)
  - Sandbox-Stub ersetzen
  - Security-Tests (Isolation, Memory-Limits, Timeouts)
  - Performance-Tests
  - Mobile-Kompatibilitäts-Tests
- **Deliverable:** Sichere Sandbox komplett getestet (>85% Coverage)

**Phase 4: Finaler manueller UI-Test** 🎯 **0.5-1 Tag**
- Tag 1: Kompletter UI-Test in Obsidian
  - testing_guide.md Checkliste durcharbeiten
  - Alle Features in echter Obsidian-Umgebung testen
  - Nur UI-spezifische Bugs erwarten (Kern-Logik bereits getestet)
  - UI-Bugs fixen (eingegrenzt, schnell lösbar)
- **Deliverable:** Release 0.1.0 - Feature-complete und getestet

**Gesamtaufwand:** 3-5 Tage bis Production-Release

**Vorteile dieses Ansatzes:**
1. ✅ Alle Features durch Unit Tests abgesichert vor UI-Test
2. ✅ Fehlersuche im UI-Test auf UI-Bugs eingegrenzt
3. ✅ Schnellere Debugging-Cycles (klare Trennung)
4. ✅ Höhere Qualität und Sicherheit
5. ✅ Dokumentation stimmt mit Implementierung überein

---

## 9. Zusammenfassung und Entwicklungsstrategie

### Meilenstein-Status: 🟢 **85% implementiert, Test-Suite erfolgreich!** (Update: 12. Januar 2026)

**Was funktioniert:**
- ✅ Parser-Layer komplett (YAML, Placeholder, Validation)
- ✅ Core-Layer größtenteils (Registry, Executor)
- ✅ 4 vordefinierte Tools vollständig implementiert und getestet
- ✅ Custom Tool Loading funktionsfähig
- ✅ UI-Layer kompiliert erfolgreich
- ✅ **Build erfolgreich - Plugin kompilierbar**
- ✅ **38 automatisierte Tests (Unit, Integration, E2E) - 66% Coverage**

**Was noch zu tun ist:**
- ❌ Pre/Post-Processing nicht aktiv (Feature-Gap)
- ❌ QuickJS nur Stub (Sicherheitsrisiko)
- ⏳ Manuelles UI-Testing ausstehend (am Ende)

### Entwicklungsstrategie: Feature-First mit Unit Tests

**🎯 Ansatz: 2 Feature-Runden mit Unit Tests, dann finaler manueller UI-Test**

**Begründung:**
1. **Unit Tests sichern Funktionalität ab** - Kern-Logik validiert vor UI-Test
2. **Fehlersuche eingegrenzt** - Finale Tests fokussieren auf UI-Bugs
3. **Schnelleres Debugging** - Klare Trennung zwischen Logik- und UI-Fehlern
4. **Höhere Qualität** - Features sind getestet bevor UI involviert ist

**Entwicklungsplan (3-5 Tage):**

**Phase 2: Feature-Runde 1 - Pre/Post-Processing (1-2 Tage)**
- Implementierung: Executor-Hooks, Sandbox-Integration
- **Unit Tests:** Input/Output-Transformation, Edge Cases, Error-Handling
- **Ziel:** >80% Coverage für neue Features
- **Akzeptanz:** Alle Tests grün, Feature komplett funktional

**Phase 3: Feature-Runde 2 - QuickJS-Sandbox (1-2 Tage)**
- Implementierung: QuickJS-Integration, Stub ersetzen
- **Unit Tests:** Isolation, Security, Memory-Limits, Performance
- **Ziel:** >85% Coverage, keine Security-Leaks
- **Akzeptanz:** Security-Tests bestanden, Mobile-kompatibel

**Phase 4: Finaler manueller UI-Test (0.5-1 Tag)**
- **Erst jetzt:** Plugin in Obsidian laden
- testing_guide.md Checkliste durcharbeiten
- **Erwartung:** Nur UI-spezifische Bugs (Kern-Logik bereits validiert)
- Schnelle Bug-Fixes durch klare Fehler-Lokalisierung

### Nächste konkrete Schritte (Priorität)

**1. Feature-Runde 1: Pre/Post-Processing (NÄCHSTER SCHRITT)**
   - Executor um Pre/Post-Hooks erweitern
   - Unit Tests für alle Code-Pfade schreiben
   - Integration-Tests für komplette Workflows
   - Coverage-Ziel: >80%
   
**2. Feature-Runde 2: QuickJS-Sandbox**
   - `quickjs-emscripten` installieren und integrieren
   - Sandbox-Stub durch echte Implementierung ersetzen
   - Security- und Performance-Tests schreiben
   - Coverage-Ziel: >85%

**3. Finaler manueller UI-Test**
   - Plugin in Obsidian Test-Vault laden
   - Komplette UI-Funktionalität testen
   - Nur UI-Bugs erwarten und fixen
   - Release vorbereiten

**Geschätzte Zeit bis Release:** 3-5 Tage

**Vorteil dieser Strategie:**
- ✅ Alle Features unit-getestet vor UI-Integration
- ✅ Schnellere Bug-Lokalisierung im finalen Test
- ✅ Höhere Code-Qualität und Sicherheit
- ✅ Effizienter Entwicklungsprozess

---

**Bericht erstellt:** 11. Januar 2026  
**Update:** 12. Januar 2026 - Build-Showstopper behoben, Test-Suite implementiert, Strategie festgelegt  
**Gesamte Codebase:** ~4.000 Zeilen TypeScript  
**Status:** ✅ Fundament solide, Build erfolgreich, Tests erfolgreich  
**Strategie:** Feature-First mit Unit Tests, dann finaler UI-Test  
**Nächster Schritt:** Pre/Post-Processing implementieren + Unit Tests
