# Paper Agents Plugin - Architektur-Plan: Tool-System

**Status:** 🎯 Design-Phase  
**Datum:** 11. Januar 2026  
**Meilenstein:** M1 - Tool-Funktionalitäten  

---

## 1. Übersicht & Qualitätsziele

### 1.1 Kernziele
Das Paper Agents Plugin soll Entwickler:innen ermöglichen, **LLM-basierte Agenten in Markdown zu definieren, zu testen und auszuführen** – ohne komplexe Frameworks.

**Top-3 Qualitätsziele (nach ISO 25010):**
- **Wartbarkeit:** Agenten sind ohne Runtime-Änderungen anpassbar
- **Portabilität:** Agenten sind reine Textdateien, überall ausführbar
- **Sicherheit:** Keine unbeabsichtigten Datei-/API-Änderungen durch Human-in-the-Loop + Sandbox

### 1.2 Architektur-Prinzipien
1. **Clean Code:** Entkopplung, klare Abstraktion, Single Responsibility
2. **Interface-First:** Zentrale TypeScript-Interfaces als SSoT (Single Source of Truth)
3. **Factory Pattern:** Tool-Instanzierung über Factories, nicht via Klassen-Hierarchie
4. **Mobile-First:** Alle Module müssen auf iOS/Android laufen (QuickJS statt eval())
5. **Minimal Dependencies:** Nur essenzielle externe Packages

---

## 2. Architektur-Übersicht

### 2.1 Modularer Aufbau

```
src/
├── main.ts                           # Plugin-Lifecycle (onload/onunload)
├── settings.ts                       # Plugin-Settings + OpenRouter-Key
├── types.ts                          # ⭐ ZENTRAL: Alle Interfaces
│
├── core/
│   ├── agent-engine.ts              # Orchestrierung von Tool-Ausführung
│   └── tool-registry.ts             # Tool-Lookup & Verwaltung
│
├── parser/
│   ├── yaml-parser.ts               # YAML-Frontmatter → Agent-Objekt
│   ├── placeholder.ts               # {{param}} Ersetzung mit Context
│   └── validator.ts                 # Parameter-Typ-Validierung
│
├── tools/
│   ├── predefined.ts                # Factory für vordefinierte Tools
│   │   └── search_files, read_file, write_file, rest_request
│   └── sandbox.ts                   # QuickJS-Integration für Custom-JS
│
├── ui/
│   ├── tool-testing.ts              # Sidebar + Test-Formulare
│   └── hitl-modal.ts                # Human-in-the-Loop Bestätigung
│
└── utils/
    ├── logger.ts                    # Debug-Logging
    └── constants.ts                 # Shared Constants
```

### 2.2 Schichten-Modell

```
┌─────────────────────────────────────────┐
│  UI Layer (tool-testing, hitl-modal)    │
│  → User-Interaktion & Bestätigungen     │
└────────────────┬────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│  Engine Layer (agent-engine)            │
│  → Orchestrierung & Kontext-Threading   │
└────────────────┬────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│  Tool Layer (tool-registry, predefined) │
│  → Tool-Lookup & Factory-Pattern        │
└────────────────┬────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│  Execution Layer (sandbox, predefined)  │
│  → Code-Ausführung + File/API-Zugriff   │
└────────────────┬────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│  Parser Layer (yaml, placeholder, val)  │
│  → YAML-Parse + Validierung             │
└─────────────────────────────────────────┘
```

---

## 3. Zentrale Interfaces (types.ts)

### 3.1 Agent-Definition
```typescript
interface Agent {
  id: string;                          // Eindeutige ID
  name: string;                        // Anzeigename
  description?: string;                // Kurzbeschreibung
  type: "single" | "chain";           // Tool-Typ
  parameters: Parameter[];             // Input-Parameter
  customFunction?: string;             // JS-Code (nur single)
  steps?: Step[];                      // Tool-Chain (nur chain)
}
```

### 3.2 Parameter & Validierung
```typescript
interface Parameter {
  name: string;
  type: ParameterType;                // "string" | "number" | "boolean" | "array" | "object"
  description?: string;
  required: boolean;
  default?: any;
}

type ParameterType = "string" | "number" | "boolean" | "array" | "object";
```

### 3.3 Execution-Kontext & Ergebnis
```typescript
interface ExecutionContext {
  parameters: Record<string, any>;     // User-Input
  previousStepOutputs: Record<string, any>;  // Verkettung
  date: string;                        // YYYY-MM-DD
  time: string;                        // HH:mm:ss
  randomId: string;                    // UUID
}

interface ToolExecution {
  toolName: string;
  parameters: Record<string, any>;
  output?: any;
  error?: string;
  hitlRequired?: boolean;              // Bestätigung nötig?
  hitlConfirmed?: boolean;             // Nutzer hat bestätigt?
  timestamp: number;
}

interface ExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  log: ToolExecution[];
}
```

### 3.4 Tool-Interface (für Registry)
```typescript
interface IToolFactory {
  name: string;
  description: string;
  create(): IExecutableTool;
}

interface IExecutableTool {
  name: string;
  parameters: Parameter[];
  execute(ctx: ExecutionContext): Promise<ExecutionResult>;
  requiresHITL(): boolean;
}
```

---

## 4. Technische Entscheidungen

### 4.1 Factory Pattern (für Tool-Instanzierung)
**Entscheidung:** ✅ **Factory Pattern statt Klassen-Hierarchie**

**Begründung:**
- **Einfachheit:** Vordefinierte Tools sind konzeptuell ähnlich (File/REST), aber unterschiedlich in Impl.
- **Flexibilität:** Custom Tools später ohne Base-Class-Umgestaltung integrierbar
- **Wartbarkeit:** Tools sind unabhängig, keine Vererbungs-Komplexität
- **Testing:** Factories sind einfacher zu mocken

**Implementierung:**
```typescript
// tools/predefined.ts
export const ToolFactory = {
  searchFiles: () => ({ name: "search_files", execute: ... }),
  readFile: () => ({ name: "read_file", execute: ... }),
  writeFile: () => ({ name: "write_file", execute: ... }),
  restRequest: () => ({ name: "rest_request", execute: ... }),
};
```

### 4.2 Sandbox: QuickJS statt eval()
**Entscheidung:** ✅ **QuickJS-Emscripten für Custom JS**

| Kriterium | eval() | QuickJS |
|-----------|--------|---------|
| **Mobile-Safe** | ❌ Nein | ✅ Ja (WASM) |
| **Sicherheit** | ❌ Keine Isolation | ✅ Vollständig isoliert |
| **Größe** | – | ~900KB (akzeptabel) |
| **Performance** | ⚡ Schnell | ⚡ Gut (WASM-JIT) |
| **Desktop+Mobile** | Unterschiedlich | ✅ Einheitlich |

### 4.3 YAML-Parser: js-yaml
**Entscheidung:** ✅ **js-yaml (~47KB)**
- Maturo & zuverlässig
- Mobile-kompatibel (WASM-frei)
- Type-safe mit TypeScript

### 4.4 UUID für {{random_id}}
**Entscheidung:** ✅ **uuid Package (~8KB)**
- Standard in JavaScript-Ökosystem
- Mobile-kompatibel

### 4.5 Dateizugriffe: Obsidian Vault API
**Entscheidung:** ✅ **Nur `this.app.vault` verwenden**
- ❌ Kein `fs` Modul (nicht im Plugin-Kontext)
- ✅ Cross-platform (Desktop + Mobile)
- ✅ Sandbox-kompatibel

### 4.6 REST-Requests: Obsidian requestUrl()
**Entscheidung:** ✅ **Obsidian-eigene API**
- ❌ Kein `fetch()` direkt (eingeschränkt auf Mobile)
- ✅ `obsidian.requestUrl()` ist Standard

---

## 5. Implementierungs-Roadmap

### Phase 1: Foundation (Core-Interfaces & Parser)
1. **types.ts** – Zentrale Agent-, Parameter-, Execution-Interfaces
2. **yaml-parser.ts** – Markdown-File → Agent-Objekt
3. **placeholder.ts** – {{param}}, {{prev_step.output}}, {{date}}, {{time}}, {{random_id}} ersetzen
4. **validator.ts** – Parameter-Typ-Validierung (string, number, boolean, array, object)

**Deliverable:** Parser kann YAML korrekt parsen & validieren

---

### Phase 2: Engine & Tools (Execution-Core)
5. **sandbox.ts** – QuickJS-Integration für Custom-JS (Desktop + Mobile)
6. **tool-registry.ts** – Tool-Lookup & Verwaltung
7. **predefined.ts** – 4 Standard-Tools via Factory:
   - `search_files` – Vault-Dateien durchsuchen
   - `read_file` – Datei-Inhalt lesen
   - `write_file` – Datei schreiben (mit HITL)
   - `rest_request` – HTTP-Requests (mit HITL für PUT/POST)
8. **agent-engine.ts** – Tool-Ausführung & Chaining-Orchestrierung

**Deliverable:** Tools sind ausführbar, Single & Chain-Workflows funktionieren

---

### Phase 3: UI & Integration
9. **tool-testing.ts** – Sidebar mit Tool-Übersicht & Test-Formulare
10. **hitl-modal.ts** – Modal für Bestätigungen (write_file, REST PUT/POST)
11. **main.ts Update** – Commands & Sidebar-Integration
12. **settings.ts Update** – OpenRouter-Key, Sandbox-Limits

**Deliverable:** Nutzer können Tools in UI testen

---

### Phase 4: Polish & Dokumentation
13. **logger.ts** – Debug-Logging für Troubleshooting
14. **error-handling** – Recovery-Strategien
15. **Unit-Tests** – Parser, Validator, Factory-Tests
16. **README-Update** – Dokumentation für Tool-Definition

**Deliverable:** Production-ready Tool-System

---

## 6. Mobile-Kompatibilität

### 6.1 Design-Constraints
- ✅ Nur Obsidian-APIs verwenden (vault, requestUrl, UI)
- ✅ Keine Node-Module (fs, child_process, etc.)
- ✅ QuickJS für Custom-JS (einheitlich Desktop + Mobile)
- ✅ Keine großen in-memory Datenstrukturen
- ✅ Canvas/DOM sparsam nutzen

### 6.2 Testing-Matrix
| Plattform | YAML-Parser | Sandbox | Tools | UI |
|-----------|------------|---------|-------|-----|
| Desktop (Win/Mac/Linux) | ✓ | ✓ | ✓ | ✓ |
| iOS | ✓ | ✓ (WASM) | ✓ | ✓ |
| Android | ✓ | ✓ (WASM) | ✓ | ✓ |

---

## 7. Dependencies & Bundle-Größe

### 7.1 Neue Dependencies
| Package | Größe | Mobile | Zweck |
|---------|-------|--------|-------|
| `js-yaml` | 47KB | ✓ | YAML-Parser |
| `quickjs-emscripten` | ~900KB | ✓ (WASM) | JS-Sandbox |
| `uuid` | 8KB | ✓ | {{random_id}} |

**Gesamt:** ~955KB (akzeptabel, später optimierbar)

### 7.2 Bestehende Dependencies
- `obsidian` – Bereits vorhanden ✓
- TypeScript/esbuild – Build-Zeit nur ✓

---

## 8. Clean-Code Prinzipien

### 8.1 Single Responsibility
- `yaml-parser.ts` – NUR Parsing
- `validator.ts` – NUR Validierung
- `sandbox.ts` – NUR JS-Ausführung
- `predefined.ts` – NUR Tool-Factories
- `agent-engine.ts` – NUR Orchestrierung

### 8.2 Dependency Inversion
```typescript
// Engine nimmt generische IExecutableTool an, nicht konkrete Klassen
export class AgentEngine {
  execute(tool: IExecutableTool, ctx: ExecutionContext): Promise<ExecutionResult>
}
```

### 8.3 Keine Zirkuläre Abhängigkeiten
```
types.ts
  ↓
parser/ tools/ core/ ui/
  ↓
utils/
```

### 8.4 Error-Handling
- Try-catch in `execute()`-Methoden
- Strukturierte Error-Objekte (nicht Strings)
- Logging ohne Sensitive-Data

---

## 9. Sicherheit & Human-in-the-Loop

### 9.1 HITL-Szenarien
| Operation | HITL | Grund |
|-----------|------|-------|
| search_files | ✓ Optional | Read-only, aber Audit |
| read_file | ✓ Optional | Read-only, aber Audit |
| write_file | ✅ **MUSS** | Destruktiv (Datei-Änderung) |
| rest_request (GET) | ✓ Optional | Read-only API |
| rest_request (PUT/POST) | ✅ **MUSS** | Destruktiv (API-Änderung) |
| Custom JS | ✓ Optional | Audit-Trail |

### 9.2 Sandbox-Limits (QuickJS)
- Max. Execution-Time: 5 Sekunden (konfigurierbar)
- Max. Memory: 256MB (konfigurierbar)
- Kein File-System-Zugriff direkt (nur via Obsidian-API)
- Keine Network-Calls direkt (nur via rest_request-Tool)

---

## 10. Fehlerszenarien & Recovery

| Fehler | Handling | Recovery |
|--------|----------|----------|
| YAML-Parse-Error | Nutzer benachrichtigen | Fehlerpositions-Info |
| Parameter-Validierung | Formular-Validierung | Hints für Nutzer |
| Sandbox-Timeout | Execution abbrechen | Log mit Stack-Trace |
| File-Not-Found | Tool-Error werfen | Suggestion für Dateipfade |
| API-Error (4xx/5xx) | HITL-Modal zeigt Error | Abort/Retry-Option |

---

## 11. Nächste Schritte

### Vor Implementierung:
- [ ] Diese Architektur-Review durchlaufen
- [ ] Feedback einarbeiten
- [ ] TypeScript-Interfaces finalisieren

### Nach Approval:
- [ ] Phase 1 implementieren (types → parser)
- [ ] Phase 2 (engine → predefined)
- [ ] Phase 3 (UI integration)
- [ ] Phase 4 (Polish & Tests)

---

## 12. Appendix: Code-Struktur Beispiel (types.ts Skeleton)

```typescript
// types.ts - Zentrale Schnittstelle
export interface Agent {
  id: string;
  name: string;
  description?: string;
  type: "single" | "chain";
  parameters: Parameter[];
  customFunction?: string;
  steps?: Step[];
}

export interface Parameter {
  name: string;
  type: ParameterType;
  description?: string;
  required: boolean;
  default?: any;
}

export type ParameterType = "string" | "number" | "boolean" | "array" | "object";

export interface ExecutionContext {
  parameters: Record<string, any>;
  previousStepOutputs: Record<string, any>;
  date: string;
  time: string;
  randomId: string;
}

export interface IExecutableTool {
  name: string;
  parameters: Parameter[];
  execute(ctx: ExecutionContext): Promise<ExecutionResult>;
  requiresHITL(): boolean;
}

export interface ExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  log: ToolExecution[];
}
```

---

**Version:** 1.0  
**Letzte Änderung:** 11. Jan 2026  
**Autor:** Design-Phase Paper Agents
