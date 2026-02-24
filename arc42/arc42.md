---
title: "Paper Agents – Architekturdokumentation (arc42)"
version: 0.0.1
date: 24. Februar 2026
author: Merlin Becker
---

# Paper Agents – Architekturdokumentation

> Basiert auf dem arc42-Template v9.0-DE.  
> Erstellt und gepflegt von Merlin Becker.  
> arc42 © Dr. Peter Hruschka, Dr. Gernot Starke – <https://arc42.org>

---

# 1. Einführung und Ziele

## 1.1 Aufgabenstellung

**Paper Agents** ist ein Obsidian-Community-Plugin, das Entwicklern ermöglicht, **Agenten und Tools in Markdown zu definieren, zu testen und auszuführen**. Es kombiniert die Einfachheit von Markdown-Notation mit AI-Agenten-Workflows und Workflow-Automatisierung.

> *„Wenn du einen Agenten nicht auf Papier skizzieren kannst, verstehst du ihn nicht. Wenn du ihn nicht in 30 Sekunden testen kannst, ist es kein Tool – es ist eine Karriere."*

### Kernziele

| # | Ziel | Beschreibung |
|---|------|--------------|
| Z1 | **Markdown-native Definition** | Agenten und Tools werden strukturiert in Markdown-Dateien (YAML Frontmatter) beschrieben |
| Z2 | **Ausführung und Interaktion** | Parsing, Tool-Ausführung inkl. Pre-/Post-Processing in Sandbox, Agenten-Interaktion |
| Z3 | **OpenRouter-Integration** | API-basierte Kommunikation mit LLMs über OpenRouter |
| Z4 | **Entwicklerfreundlichkeit** | Playground für Experimente mit Fokus auf Flexibilität |
| Z5 | **Kontinuierliche Verteilung** | Beta-Releases über BRAT-Plugin |

### Funktionsübersicht

- **4 vordefinierte Tools**: `search_files`, `read_file`, `write_file`, `rest_request`
- **Custom Tools**: Eigene Tools als Markdown-Dateien mit YAML Frontmatter
- **Pre-/Post-Processing**: JavaScript-Transformation in QuickJS-Sandbox
- **Chain-Tools**: Multi-Step-Workflows mit Placeholder-Chaining
- **Human-in-the-Loop (HITL)**: Bestätigungspflicht für kritische Operationen
- **Agenten-Notation**: System-Prompts, Tools, Memory, Kontext in Markdown
- **Konversationslogik**: State-Management, Token-Counting, Markdown-Export/Import
- **Mobile-kompatibel**: Funktioniert auf Desktop, iOS und Android

## 1.2 Qualitätsziele

| Priorität | Qualitätsziel | Beschreibung |
|-----------|---------------|--------------|
| 1 | **Sicherheit** | Sandboxed Code-Ausführung, HITL für destruktive Operationen, keine Remote-Code-Execution |
| 2 | **Erweiterbarkeit** | Einfaches Hinzufügen neuer Tools via Markdown, Plugin-Architektur mit Factory Pattern |
| 3 | **Benutzerfreundlichkeit** | Intuitive Markdown-Notation, Sidebar-UI, dynamische Formulare |
| 4 | **Portabilität** | Desktop + Mobile (iOS/Android), WASM-basierte Sandbox |
| 5 | **Wartbarkeit** | TypeScript strict mode, >75% Test-Coverage, Clean Architecture |

## 1.3 Stakeholder

| Rolle | Kontakt | Erwartungshaltung |
|-------|---------|-------------------|
| Entwickler / Maintainer | Merlin Becker (GitHub: merlinbecker) | Saubere Architektur, gute Testabdeckung, erweiterbar |
| Plugin-Nutzer | Obsidian-Community | Einfache Installation, stabile Tool-Ausführung, gute Dokumentation |
| Beta-Tester | BRAT-Nutzer | Frühzeitiger Zugang, Feedback-Möglichkeit, automatische Updates |
| AI-Agenten (Copilot etc.) | Gesteuert via AGENTS.md | Klare Konventionen, stabile IDs, idempotente Pfade |

---

# 2. Randbedingungen

## Technische Randbedingungen

| Randbedingung | Beschreibung |
|---------------|--------------|
| **Obsidian-Plugin-API** | Das Plugin muss die Obsidian-Plugin-API verwenden und als `main.js` + `manifest.json` ausgeliefert werden |
| **Kein Node.js auf Mobile** | Mobile-Kompatibilität erfordert WASM-basierte Sandbox (kein `require`, `eval`, `process`) |
| **Bundle in eine Datei** | esbuild bundelt alles nach `main.js` (CommonJS, ES2018). Externe Dependencies: nur `obsidian` |
| **TypeScript strict** | `noImplicitAny`, `strictNullChecks`, `noImplicitReturns` aktiviert |
| **QuickJS-Emscripten** | WASM-Sandbox für sichere JavaScript-Ausführung (Memory-Limit: 10 MB, Timeout: 5 s) |
| **OpenRouter API** | LLM-Zugriff erfolgt ausschließlich über OpenRouter (Phase 4.3, noch nicht implementiert) |

## Organisatorische Randbedingungen

| Randbedingung | Beschreibung |
|---------------|--------------|
| **Lizenz** | MIT |
| **Versionierung** | Semantic Versioning (x.y.z), aktuell 0.0.1 |
| **Paketmanager** | npm |
| **CI/CD** | GitHub Actions für Releases, BRAT für Beta-Distribution |
| **Keine Telemetrie** | Kein Tracking, keine Analytics, keine versteckten Netzwerkzugriffe |
| **Vault-Scope** | Das Plugin liest/schreibt nur innerhalb des Obsidian-Vaults |

## Konventionen

| Konvention | Details |
|------------|---------|
| Dateinamen | `kebab-case.ts` |
| Klassen | `PascalCase` |
| Funktionen | `camelCase` |
| Konstanten | `UPPER_SNAKE_CASE` |
| Commits | Konventionelle Commit-Messages |
| Command-IDs | Stabil, nie umbenennen nach Release |

---

# 3. Kontextabgrenzung

## 3.1 Fachlicher Kontext

```
                    ┌────────────────────┐
                    │   Obsidian-Nutzer   │
                    └────────┬───────────┘
                             │ Interagiert via UI
                             ▼
┌──────────────────────────────────────────────────────┐
│                   Paper Agents Plugin                 │
│                                                      │
│  - Tool-Definition (Markdown/YAML)                   │
│  - Tool-Ausführung (Pre → Tool → Post)               │
│  - Agenten-Konversation                              │
│  - Custom Tool Discovery                             │
└────────┬──────────────┬──────────────┬───────────────┘
         │              │              │
         ▼              ▼              ▼
┌──────────────┐ ┌────────────┐ ┌──────────────────┐
│ Obsidian     │ │ Externe    │ │ OpenRouter API   │
│ Vault (FS)   │ │ REST APIs  │ │ (LLM, Phase 4.3)│
└──────────────┘ └────────────┘ └──────────────────┘
```

| Schnittstelle | Beschreibung |
|---------------|--------------|
| **Obsidian-Nutzer** | Interagiert über Sidebar, Formulare, Commands und Markdown-Dateien |
| **Obsidian Vault** | Dateisystem-Zugriff via Obsidian Vault-API (`search_files`, `read_file`, `write_file`) |
| **Externe REST APIs** | HTTP-Requests via `rest_request`-Tool (GET, POST, PUT, DELETE) |
| **OpenRouter API** | LLM-Kommunikation für Agenten-Konversationen (Phase 4.3, ausstehend) |

## 3.2 Technischer Kontext

| Kanal/Schnittstelle | Technologie | Protokoll |
|---------------------|-------------|-----------|
| Plugin → Obsidian | Obsidian Plugin-API (TypeScript) | In-Process-API |
| Plugin → Vault | `app.vault.*` Methoden | Lokales Dateisystem |
| Plugin → REST APIs | `fetch()` / `requestUrl()` | HTTP/HTTPS |
| Plugin → OpenRouter | HTTP POST mit Bearer Token | HTTPS + SSE (Streaming) |
| Plugin → QuickJS | `quickjs-emscripten` WASM | In-Memory, JSON-Serialisierung |
| Build → Bundle | esbuild | TypeScript → CommonJS `main.js` |
| Test → Runner | Vitest + c8 | Node.js |

---

# 4. Lösungsstrategie

| Qualitätsziel | Architekturansatz |
|---------------|-------------------|
| **Sicherheit** | QuickJS-WASM-Sandbox isoliert Pre-/Post-Processing vom Host. HITL-Modal für destruktive Operationen. Code-Validierung blockiert `require`, `eval`, `process`, `global`, `Function`. |
| **Erweiterbarkeit** | Factory Pattern (ToolRegistry) für Tool-Erstellung. Custom Tools als Markdown-Dateien mit automatischer Discovery. Agenten-Notation als Markdown-Format. |
| **Benutzerfreundlichkeit** | Sidebar mit Tool-Übersicht, dynamische Formulare aus Parameter-Definitionen, HITL-Dialoge mit Approve/Reject. |
| **Portabilität** | WASM-basierte Sandbox (kein Node.js nötig). `isDesktopOnly: false` in manifest.json. Keine Desktop-spezifischen APIs. |
| **Wartbarkeit** | Layered Architecture (Parser → Core → UI). TypeScript strict mode. 146 Tests, 75.55% Coverage. Klare Modulgrenzen. |

### Technologieentscheidungen

| Entscheidung | Begründung |
|--------------|------------|
| **TypeScript** | Type Safety, IDE-Support, Obsidian-Ökosystem-Standard |
| **esbuild** | Schnelles Bundling, Obsidian-Sample-Plugin-Standard |
| **QuickJS-Emscripten** | Sichere Sandbox, WASM = Mobile-kompatibel, keine externen Abhängigkeiten |
| **Vitest** | Schnell, TypeScript-nativ, kompatible API zu Jest |
| **OpenRouter** | Einheitliche API für viele LLM-Anbieter, Tool-Calling-Support |

### Phasenmodell

| Phase | Inhalt | Status |
|-------|--------|--------|
| 1 | Plugin-Grundgerüst, Build, Tests | ✅ Abgeschlossen |
| 2 | Tool-Engine (4 Tools, Registry, Executor) | ✅ Abgeschlossen |
| 3 | Sandbox & Security (QuickJS, HITL) | ✅ Abgeschlossen |
| 4.1 | Agenten-Notation (Parser, Typen, Beispiele) | ✅ Abgeschlossen |
| 4.2 | Konversationslogik (ConversationManager) | ✅ Abgeschlossen |
| 4.3 | OpenRouter-Integration (API-Client) | ⏳ Ausstehend |
| 5 | Advanced Features (History, Loops, Visual Editor) | 🔮 Zukunft |

---

# 5. Bausteinsicht

## 5.1 Whitebox Gesamtsystem (Ebene 1)

```
┌──────────────────────────────────────────────────────────────┐
│                     Paper Agents Plugin                       │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    UI Layer                              │ │
│  │  sidebar.ts │ forms.ts │ hitl-modal.ts                  │ │
│  └──────────────────────┬──────────────────────────────────┘ │
│                         │                                    │
│  ┌──────────────────────▼──────────────────────────────────┐ │
│  │                 Core Execution Layer                     │ │
│  │  tool-executor.ts │ tool-registry.ts │ conversation.ts  │ │
│  └───────┬──────────────────────┬──────────────────────────┘ │
│          │                      │                            │
│  ┌───────▼──────────┐  ┌───────▼──────────────────────────┐ │
│  │  Sandbox Layer   │  │     Parser & Validation Layer     │ │
│  │  sandbox.ts      │  │  yaml-parser │ validator          │ │
│  │  (QuickJS WASM)  │  │  placeholder │ tool-loader        │ │
│  └──────────────────┘  │  agent-parser                     │ │
│                         └──────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    Tools Layer                           │ │
│  │  predefined.ts (search_files, read_file,                │ │
│  │                  write_file, rest_request)               │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                   Utils Layer                            │ │
│  │  constants.ts │ logger.ts                                │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### Bausteine (Blackboxen)

#### Plugin Entry Point (`main.ts`)

- **Verantwortung**: Plugin-Lifecycle (onload/onunload), Command-Registrierung, Settings, Initialisierung aller Subsysteme
- **Schnittstellen**: Obsidian Plugin-API, alle internen Module
- **Datei**: `src/main.ts` (273 Zeilen)

#### UI Layer

- **Verantwortung**: Benutzerinteraktion, Tool-Übersicht, Formular-Eingabe, Bestätigungsdialoge
- **Dateien**: `src/ui/sidebar.ts`, `src/ui/forms.ts`, `src/ui/hitl-modal.ts`
- **Schnittstellen**: Obsidian UI-API (View, Modal, Setting), ToolRegistry, ToolExecutor

#### Core Execution Layer

- **Verantwortung**: Tool-Ausführung, Tool-Verwaltung, Konversations-State
- **Dateien**: `src/core/tool-executor.ts`, `src/core/tool-registry.ts`, `src/core/conversation.ts`, `src/core/sandbox.ts`
- **Schnittstellen**: Parser-Layer (Eingabe), Tools-Layer (Ausführung), UI-Layer (Ergebnisse)

#### Parser & Validation Layer

- **Verantwortung**: Markdown/YAML-Parsing, Parametervalidierung, Placeholder-Auflösung, Tool-Discovery
- **Dateien**: `src/parser/yaml-parser.ts`, `src/parser/validator.ts`, `src/parser/placeholder.ts`, `src/parser/tool-loader.ts`, `src/parser/agent-parser.ts`
- **Schnittstellen**: Vault (Markdown-Dateien), Core-Layer (geparste Definitionen)

#### Tools Layer

- **Verantwortung**: Implementierung der 4 vordefinierten Tools
- **Datei**: `src/tools/predefined.ts`
- **Schnittstellen**: Obsidian Vault-API, HTTP-fetch, ToolRegistry

#### Utils Layer

- **Verantwortung**: Shared Constants, Logging
- **Dateien**: `src/utils/constants.ts`, `src/utils/logger.ts`
- **Schnittstellen**: Von allen anderen Layern genutzt

## 5.2 Ebene 2 – Core Execution Layer

### Tool-Executor (`tool-executor.ts`)

**3-Phasen-Execution-Pipeline:**
```
Input-Parameter
      ↓
┌─────────────────┐
│ Phase 1: Pre    │  Optional: JavaScript-Transformation in Sandbox
│ Processing      │  Input → modifizierter Input
└────────┬────────┘
         ↓
┌─────────────────┐
│ Phase 2: Tool   │  Ausführung des referenzierten Tools
│ Execution       │  (Single oder Chain)
└────────┬────────┘
         ↓
┌─────────────────┐
│ Phase 3: Post   │  Optional: JavaScript-Transformation in Sandbox
│ Processing      │  Output → modifizierter Output
└────────┬────────┘
         ↓
    Final Result
```

- **Single Execution**: Ein Tool mit optionalem Pre-/Post-Processing
- **Chain Execution**: Mehrere Steps sequenziell, mit State-Sharing via Placeholder (`{{prev_step.output}}`)
- **HITL-Integration**: Prüft `shouldRequireHITL()` vor Ausführung, ruft HITL-Modal auf
- **Coverage**: 89.06%

### Tool-Registry (`tool-registry.ts`)

- **Factory Pattern** für Tool-Erstellung und -Registrierung
- Methoden: `registerTool()`, `getTool()`, `hasTool()`, `listTools()`
- Unterscheidung: `predefined` vs. `custom` vs. `chain`
- **Coverage**: 77.38%

### ConversationManager (`conversation.ts`)

- **State-Management** für Agenten-Konversationen
- Methoden: `createConversation()`, `addMessage()`, `getMessagesForContext()`, `buildContext()`
- **Token-Counting**: Approximativ (4 Zeichen ≈ 1 Token)
- **Memory-Strategien**: `conversation` (letzte N Nachrichten), `summary` (Zusammenfassung), `none`
- **Markdown-Export/Import**: Round-trip-fähig mit ISO 8601 Timestamps
- **LLM-Formatierung**: `formatMessagesForLLM()` für OpenRouter-API
- **Coverage**: 97.47%

### Sandbox (`sandbox.ts`)

- **QuickJS-Emscripten** WASM-Runtime
- Führt Pre-/Post-Processing-JavaScript isoliert aus
- **Limits**: Memory 10 MB, Timeout 5 s
- **Code-Validierung**: Blockiert `require`, `eval`, `process`, `global`, `Function`
- IIFE-Wrapping für `return`-Statement-Support
- JSON-basierter Datenaustausch (Input/Output)
- **Coverage**: 69.26%

## 5.3 Ebene 2 – Parser & Validation Layer

### YAML-Parser (`yaml-parser.ts`)

- Extrahiert YAML Frontmatter aus Markdown
- Parst Tool-Metadaten (id, name, type, parameters)
- Extrahiert Code-Blöcke (`// @preprocess`, `// @postprocess`)
- Unterstützt Single- und Chain-Tool-Definitionen
- **Coverage**: 82.38%

### Agent-Parser (`agent-parser.ts`)

- Parst Agenten-Definitionen aus Markdown (Frontmatter `agent: true`)
- Extrahiert System-Prompt und Kontext-Template aus Sections
- Validiert AgentDefinition (required fields, temperature range, token limits)
- Flexible Memory-Keys (camelCase und snake_case)
- **Coverage**: 94.49%

### Validator (`validator.ts`)

- Validiert required/optional Parameter mit Typ-Konvertierung
- Unterstützte Typen: `string`, `number`, `boolean`, `array`, `object`
- Default-Werte, Fehler-Aggregation
- **Coverage**: 62.19%

### Placeholder-Engine (`placeholder.ts`)

- Ersetzt dynamische Platzhalter: `{{date}}`, `{{time}}`, `{{random_id}}`
- Parameter-Zugriff: `{{query}}`, `{{filePath}}`
- Nested Object Access: `{{prev_step.output.results[0].path}}`
- **Coverage**: 85.71%

### Tool-Loader (`tool-loader.ts`)

- Rekursive Discovery von Custom Tools in konfigurierbarem Verzeichnis
- Filtert nach `tool: true` im Frontmatter
- Fehlerbehandlung für invalide Definitionen
- **Coverage**: 69.74%

## 5.4 Ebene 2 – Tools Layer (Predefined Tools)

| Tool | Funktion | Parameter | HITL |
|------|----------|-----------|------|
| `search_files` | Dateien im Vault suchen | `query` (string), `path` (string, optional) | Nein |
| `read_file` | Dateiinhalt lesen | `filePath` (string) | Nein |
| `write_file` | Datei erstellen/modifizieren | `filePath` (string), `content` (string), `overwrite` (boolean) | **Ja, immer** |
| `rest_request` | HTTP-Requests an externe APIs | `url` (string), `method` (string), `headers` (object), `body` (object) | **Ja bei POST/PUT/DELETE** |

**Coverage**: 84.43%

---

# 6. Laufzeitsicht

## 6.1 Single-Tool-Ausführung

```
Nutzer                  Sidebar/Form        Executor            Sandbox         Tool (z.B. read_file)
  │                        │                   │                   │                    │
  │─── Klickt Tool ────────▶                   │                   │                    │
  │                        │── Parameter ──────▶                   │                    │
  │                        │                   │                   │                    │
  │                        │                   │── Pre-Process ───▶│                    │
  │                        │                   │◀─ modif. Input ───│                    │
  │                        │                   │                   │                    │
  │                        │                   │── Execute ────────────────────────────▶│
  │                        │                   │◀─ Output ─────────────────────────────│
  │                        │                   │                   │                    │
  │                        │                   │── Post-Process ──▶│                    │
  │                        │                   │◀─ modif. Output ──│                    │
  │                        │                   │                   │                    │
  │◀── Ergebnis ───────────│◀── Result ────────│                   │                    │
```

## 6.2 Chain-Tool-Ausführung

```
Executor                 Step 1 (search)     Step 2 (read)       Placeholder-Engine
  │                         │                   │                      │
  │── Execute Step 1 ──────▶│                   │                      │
  │◀── Output 1 ────────────│                   │                      │
  │                         │                   │                      │
  │── Resolve Placeholders ────────────────────────────────────────────▶│
  │   {{prev_step.output}}  │                   │                      │
  │◀── Resolved Params ────────────────────────────────────────────────│
  │                         │                   │                      │
  │── Execute Step 2 ──────────────────────────▶│                      │
  │◀── Output 2 ───────────────────────────────│                      │
  │                         │                   │                      │
  │── Final Result ─────────────────────────────────────────────────────▶
```

## 6.3 HITL-Bestätigung (write_file)

```
Executor            HITL-Check          HITL-Modal              Nutzer
  │                    │                    │                      │
  │── shouldRequireHITL?─▶                  │                      │
  │◀── true ───────────│                    │                      │
  │                    │                    │                      │
  │── showHITLModal ───────────────────────▶│                      │
  │                    │                    │── Bestätigungsdialog ▶│
  │                    │                    │    (Tool, Params)     │
  │                    │                    │◀── Approve/Reject ───│
  │◀── confirmed ──────────────────────────│                      │
  │                    │                    │                      │
  │── Execute Tool ───▶...                  │                      │
```

## 6.4 Agenten-Konversation (Geplant, Phase 4.3)

```
Nutzer               ConversationManager    OpenRouter API       Tool-Executor
  │                       │                      │                    │
  │── Nachricht ─────────▶│                      │                    │
  │                       │── buildContext() ────▶│                    │
  │                       │   (Messages, Prompt) │                    │
  │                       │                      │                    │
  │                       │── POST /completions ─▶│                    │
  │                       │◀── Response ──────────│                    │
  │                       │                       │                    │
  │                       │ (Falls Tool-Call)      │                    │
  │                       │── Execute Tool ───────────────────────────▶│
  │                       │◀── Tool-Result ───────────────────────────│
  │                       │── POST (mit Result) ──▶│                   │
  │                       │◀── Final Response ────│                    │
  │                       │                       │                    │
  │◀── Antwort ──────────│                       │                    │
```

---

# 7. Verteilungssicht

## 7.1 Infrastruktur

```
┌───────────────────────────────────────────────┐
│              Obsidian App                      │
│  (Desktop: Electron / Mobile: iOS/Android)    │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │  <Vault>/.obsidian/plugins/paperAgents/ │  │
│  │                                         │  │
│  │  ├── main.js       (gebundelt, ~92 KB)  │  │
│  │  ├── manifest.json (Plugin-Metadaten)   │  │
│  │  └── styles.css    (UI-Styles)          │  │
│  └─────────────────────────────────────────┘  │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │  <Vault>/paper-agents-tools/            │  │
│  │  (Custom Tool Markdown-Dateien)         │  │
│  └─────────────────────────────────────────┘  │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │  <Vault>/examples/agents/               │  │
│  │  (Beispiel-Agenten Markdown-Dateien)    │  │
│  └─────────────────────────────────────────┘  │
└───────────────────────────────────────────────┘
         │                          │
         │ HTTP/HTTPS               │ HTTP/HTTPS
         ▼                          ▼
┌─────────────────┐      ┌────────────────────┐
│  Externe REST   │      │   OpenRouter API   │
│  APIs           │      │   (Phase 4.3)      │
└─────────────────┘      └────────────────────┘
```

### Deployment-Artefakte

| Artefakt | Beschreibung | Generiert durch |
|----------|--------------|-----------------|
| `main.js` | Gebundelter Plugin-Code (~92 KB) | `npm run build` (esbuild) |
| `manifest.json` | Plugin-ID, Version, minAppVersion | Manuell gepflegt |
| `styles.css` | UI-Styles | Manuell gepflegt |

### Installationswege

| Methode | Beschreibung |
|---------|--------------|
| **BRAT** | Beta-Tester fügen `merlinbecker/PaperAgents` in BRAT hinzu |
| **Manuell** | `main.js`, `manifest.json`, `styles.css` nach `<Vault>/.obsidian/plugins/paperAgents/` kopieren |
| **Community Plugins** | Noch nicht verfügbar (geplant nach v1.0) |

### Release-Prozess

1. Version in `manifest.json` aktualisieren
2. `npm run build` → `main.js` generieren
3. `npm run release` → Git-Tag erstellen + pushen
4. GitHub Actions erstellt automatisch Release mit Artefakten
5. BRAT-Nutzer erhalten automatisch Updates
6. Beta-Releases via `npm run release:beta` (alte Betas werden automatisch aufgeräumt, letzte 10 behalten)

---

# 8. Querschnittliche Konzepte

## 8.1 Sicherheitskonzept

### Sandbox-Isolation

Pre-/Post-Processing-Code wird in einer **QuickJS-WASM-Sandbox** ausgeführt:

- **Isolation**: Kein Zugriff auf Node.js, Dateisystem oder Netzwerk
- **Memory-Limit**: 10 MB (konfigurierbar)
- **Timeout-Limit**: 5 Sekunden (konfigurierbar)
- **Code-Validierung**: Statische Analyse blockiert:
  - `require()` – kein Modul-Import
  - `eval()` – kein dynamischer Code
  - `process` – kein Prozess-Zugriff
  - `global` – kein Zugriff auf Global-Scope
  - `Function()` – kein Konstruktor-Zugriff
- **IIFE-Wrapping**: Code wird als `(function(){ ... })()` ausgeführt
- **Datenaustausch**: JSON-Serialisierung (kein Direct Memory Access)

### Human-in-the-Loop (HITL)

| Tool | Operation | HITL erforderlich? |
|------|-----------|-------------------|
| `write_file` | Alle Schreiboperationen | ✅ Ja, immer |
| `rest_request` | GET | ❌ Nein |
| `rest_request` | POST, PUT, DELETE | ✅ Ja |
| `read_file` | Alle Leseoperationen | ❌ Nein |
| `search_files` | Alle Suchoperationen | ❌ Nein |

Der HITL-Dialog zeigt: Tool-Name, Step, Parameter und bietet Approve/Reject-Buttons.

### Datenschutz

- Keine Telemetrie, kein Tracking
- API-Key wird lokal in Obsidian-Settings gespeichert
- Vault-Inhalte werden nur bei expliziter Nutzeraktion an LLMs gesendet
- Keine Remote-Code-Execution

## 8.2 Tool-Definitions-Format

### Tool-Datei (Markdown mit YAML Frontmatter)

```markdown
---
tool: true
id: my_tool
name: "My Tool"
description: "Beschreibung"
type: single          # oder "chain"
parameters:
  - name: input
    type: string      # string | number | boolean | array | object
    required: true
    default: "Wert"
    description: "Eingabe"
---

#### **Pre-Processing**
```javascript
// @preprocess
input.normalized = input.input.trim().toLowerCase();
return input;
```​

#### **Tool-Ausführung**
```yaml
tool: "search_files"
parameters:
  query: "{{input}}"
```​

#### **Post-Processing**
```javascript
// @postprocess
return { resultCount: output.results.length, results: output.results };
```​
```

### Chain-Tool-Format

```markdown
---
tool: true
id: my_chain
name: "My Chain"
type: chain
parameters:
  - name: query
    type: string
    required: true
steps:
  - name: "search"
    tool: search_files
    parameters:
      query: "{{query}}"
  - name: "read"
    tool: read_file
    parameters:
      filePath: "{{prev_step.output.results[0].path}}"
---
```

### Placeholder-Syntax

| Placeholder | Beschreibung |
|-------------|--------------|
| `{{param_name}}` | Nutzer-Input-Parameter |
| `{{prev_step.output}}` | Output des vorherigen Steps |
| `{{prev_step.output.field}}` | Verschachtelter Feldzugriff |
| `{{date}}` | Aktuelles Datum (YYYY-MM-DD) |
| `{{time}}` | Aktuelle Zeit (HH:mm:ss) |
| `{{random_id}}` | Zufällige UUID |

## 8.3 Agenten-Definitions-Format

```markdown
---
agent: true
id: research_assistant
name: "Research Assistant"
description: "Hilft bei Recherche"
model: openai/gpt-4o-mini
tools:
  - search_files
  - read_file
memory:
  type: conversation        # conversation | summary | none
  maxMessages: 20
  maxTokens: 4000
temperature: 0.7
---

## System Prompt
Du bist ein hilfreicher Recherche-Assistent...

## Kontext
Datum: {{current_date}}
Vault: {{vault_path}}
```

### Konversations-Format (Markdown, Round-trip-fähig)

```markdown
### User (2026-01-29T10:30:00.000Z)
Nachrichtentext

### Assistant (2026-01-29T10:30:05.000Z)
Antworttext

### Tool (2026-01-29T10:30:10.000Z)
<!-- tool:read_file -->
<!-- params:{"path":"/test.md"} -->
Result: "Dateiinhalt"
```

### Memory-Strategien

| Typ | Beschreibung | Default |
|-----|--------------|---------|
| `conversation` | Behält die letzten N Nachrichten | maxMessages: 50, maxTokens: 4000 |
| `summary` | Fasst alte Nachrichten zusammen nach N Nachrichten | summarizeAfter: configurable |
| `none` | Keine History, jede Nachricht ist unabhängig | – |

## 8.4 Design Patterns

| Pattern | Einsatzort | Zweck |
|---------|-----------|-------|
| **Factory Pattern** | `ToolRegistry` | Tool-Erstellung und -Registrierung entkoppelt von Implementierung |
| **Strategy Pattern** | `ToolExecutor` | Austauschbare Ausführungslogik (Single vs. Chain) |
| **Observer Pattern** | HITL-Callbacks | UI-Integration ohne Tight Coupling |
| **Pipeline Pattern** | 3-Phasen-Execution | Pre → Tool → Post als sequenzielle Pipeline |

## 8.5 Logging

- Zentrales Logger-Modul (`src/utils/logger.ts`)
- Log-Levels: `debug`, `info`, `warn`, `error`
- Debug-Logging aktivierbar in Settings
- Ausgabe in Obsidian Console (Ctrl+Shift+I)
- Prefix `[PaperAgents]` für alle Log-Einträge

## 8.6 Error-Handling

- `try/catch` mit `async/await` in allen Executoren
- `ExecutionResult` mit `success: boolean`, `error?: string`, `log: ToolExecution[]`
- `ValidationResult` mit `valid: boolean`, `errors: ValidationError[]`
- User-Facing errors als `Notice` in Obsidian
- Detaillierte Fehler im Debug-Log

## 8.7 Plugin-Lifecycle

```typescript
onload():
  1. Settings laden (loadData)
  2. ToolRegistry initialisieren
  3. Predefined Tools registrieren (4 Tools)
  4. Custom Tools aus Vault laden
  5. QuickJS-Sandbox initialisieren
  6. Sidebar-View registrieren
  7. Ribbon-Icon hinzufügen
  8. Commands registrieren (open-sidebar, reload-custom-tools)
  9. Settings-Tab registrieren

onunload():
  1. Sandbox destroyen
  2. Sidebar-Leaves detachen
```

---

# 9. Architekturentscheidungen

## ADR-1: QuickJS-WASM als Sandbox

**Kontext**: Pre-/Post-Processing erfordert JavaScript-Ausführung. Sicherheit ist kritisch (Vault-Zugriff, Netzwerk).

**Entscheidung**: QuickJS-Emscripten (WASM) statt `eval()` oder `Function()`.

**Begründung**:
- Vollständige Isolation vom Host-Prozess
- Memory- und Timeout-Limits möglich
- WASM ist mobile-kompatibel
- Trade-off: JSON-Serialisierung für Datenaustausch (leichter Performance-Overhead)

**Status**: Implementiert, 69.26% Coverage.

## ADR-2: Markdown als Tool-/Agenten-Format

**Kontext**: Tools und Agenten brauchen ein Definitionsformat. Obsidian-native Formate bevorzugt.

**Entscheidung**: Markdown-Dateien mit YAML Frontmatter.

**Begründung**:
- Native in Obsidian editierbar
- Versionierbar (Git)
- Menschenlesbar
- Bestehende Parser-Infrastruktur nutzbar

**Status**: Implementiert (yaml-parser.ts, agent-parser.ts).

## ADR-3: OpenRouter als LLM-Gateway

**Kontext**: Agenten brauchen LLM-Zugriff. Verschiedene Anbieter (OpenAI, Anthropic, etc.) haben unterschiedliche APIs.

**Entscheidung**: OpenRouter als einheitliches Gateway.

**Begründung**:
- Ein API-Endpoint für viele Modelle
- Tool-Calling-Support
- Streaming-Support (SSE)
- Nutzer wählt Modell und zahlt über eigenen API-Key

**Status**: Geplant (Phase 4.3).

## ADR-4: Factory Pattern für Tool-Registry

**Kontext**: Predefined und Custom Tools müssen einheitlich verwaltet werden.

**Entscheidung**: Factory Pattern mit `IToolFactory` Interface.

**Begründung**:
- Entkopplung von Tool-Erstellung und -Verwendung
- Einfache Registrierung neuer Tools
- Kategorisierung (predefined, custom, chain)

**Status**: Implementiert (tool-registry.ts).

## ADR-5: Approximatives Token-Counting

**Kontext**: Memory-Management braucht Token-Schätzung. Exakte Tokenizer sind groß und modellspezifisch.

**Entscheidung**: Approximation mit 4 Zeichen ≈ 1 Token.

**Begründung**:
- Keine zusätzliche Dependency
- Akzeptable Genauigkeit für Playground-Zweck
- Leichtgewichtig und schnell

**Status**: Implementiert (conversation.ts).

---

# 10. Qualitätsanforderungen

## 10.1 Qualitätsbaum

```
Qualität
├── Sicherheit
│   ├── Sandbox-Isolation (QuickJS WASM)
│   ├── HITL für destruktive Operationen
│   ├── Code-Validierung (blockierte Patterns)
│   └── Keine Telemetrie, kein Remote Code
├── Erweiterbarkeit
│   ├── Custom Tools als Markdown-Dateien
│   ├── Factory Pattern (ToolRegistry)
│   └── Agenten-Notation als Markdown
├── Benutzerfreundlichkeit
│   ├── Sidebar mit Tool-Übersicht
│   ├── Dynamische Formulare
│   └── HITL-Bestätigungsdialoge
├── Portabilität
│   ├── Desktop (Windows, macOS, Linux)
│   └── Mobile (iOS, Android) via WASM
└── Wartbarkeit
    ├── TypeScript strict mode
    ├── 146 Tests, 75.55% Coverage
    └── Layered Architecture
```

## 10.2 Qualitätsszenarien

| ID | Qualitätsziel | Szenario | Erwartetes Verhalten |
|----|---------------|----------|---------------------|
| QS-1 | Sicherheit | Nutzer schreibt `require('fs')` in Pre-Processing | Code-Validierung lehnt ab, keine Ausführung |
| QS-2 | Sicherheit | Pre-Processing-Code hat Endlosschleife | Timeout nach 5 s, Fehler wird gemeldet |
| QS-3 | Sicherheit | Tool `write_file` wird ausgeführt | HITL-Modal erscheint, Nutzer muss bestätigen |
| QS-4 | Erweiterbarkeit | Nutzer legt `my_tool.md` in `paper-agents-tools/` | Tool wird bei Reload automatisch erkannt und in Sidebar gelistet |
| QS-5 | Portabilität | Plugin wird auf iOS installiert | QuickJS WASM funktioniert, alle Tools nutzbar |
| QS-6 | Wartbarkeit | Entwickler fügt neues Predefined Tool hinzu | Registrierung in `tool-registry.ts`, Tests hinzufügen, Coverage ≥80% |
| QS-7 | Benutzerfreundlichkeit | Nutzer öffnet Sidebar und klickt Tool | Dynamisches Formular mit Parametern erscheint |

---

# 11. Risiken und technische Schulden

## 11.1 Risiken

| # | Risiko | Wahrscheinlichkeit | Auswirkung | Maßnahme |
|---|--------|---------------------|------------|----------|
| R1 | OpenRouter API-Änderung bricht Integration | Mittel | Hoch | API-Client mit Abstraktionsschicht, Versionierung |
| R2 | QuickJS-Emscripten breaking changes | Niedrig | Hoch | Version pinnen (`^0.31.0`), Tests bei Updates |
| R3 | Obsidian API-Deprecation | Niedrig | Mittel | `minAppVersion` pflegen, API-Changelog verfolgen |
| R4 | Performance-Probleme bei großen Vaults | Mittel | Mittel | Debouncing, Lazy Loading, Profiling |
| R5 | Token-Counting-Ungenauigkeit | Hoch | Niedrig | Akzeptabel für Playground; ggf. tiktoken nachrüsten |

## 11.2 Technische Schulden

| # | Schuld | Priorität | Beschreibung |
|---|--------|-----------|--------------|
| TS1 | Viele `any`-Types | Mittel | 39 `any`-Vorkommnisse in sandbox.ts, tool-executor.ts, conversation.ts → schrittweise durch spezifische Types ersetzen |
| TS2 | Validator-Coverage niedrig | Niedrig | validator.ts nur 62.19% Coverage → Edge Cases testen |
| TS3 | Tool-Loader Branch-Coverage | Niedrig | tool-loader.ts Branch-Coverage nur 45.45% → Error-Pfade testen |
| TS4 | UI-Tests fehlen | Akzeptabel | Sidebar, Forms, HITL-Modal nur manuell getestet (absichtlich, Obsidian-UI-API schwer zu mocken) |
| TS5 | Keine Performance-Tests | Niedrig | Kein Benchmarking für Sandbox-Ausführung oder Vault-Scans |
| TS6 | Keine ADR-Dokumentation formal | Niedrig | Entscheidungen hier in arc42 dokumentiert, kein separates ADR-Verzeichnis |

---

# 12. Glossar

| Begriff | Definition |
|---------|------------|
| **Agent** | Eine in Markdown definierte Entität mit System-Prompt, Tool-Zugriff und Memory-Konfiguration, die über LLM-API mit dem Nutzer interagiert |
| **BRAT** | Beta Reviewers Auto-update Tester – Obsidian-Plugin für Installation von Beta-Versionen |
| **Chain-Tool** | Ein Tool bestehend aus mehreren sequenziellen Steps, die Output des vorherigen Steps als Input nutzen können |
| **Custom Tool** | Vom Nutzer definiertes Tool als Markdown-Datei im `paper-agents-tools/`-Verzeichnis |
| **Frontmatter** | YAML-Block am Anfang einer Markdown-Datei (zwischen `---`-Markern), enthält Metadaten |
| **HITL** | Human-in-the-Loop – Bestätigungspflicht für destruktive Operationen durch den Nutzer |
| **LLM** | Large Language Model – KI-Sprachmodell (z.B. GPT-4, Claude) |
| **OpenRouter** | API-Gateway, das einheitlichen Zugriff auf verschiedene LLM-Anbieter bietet |
| **Placeholder** | Dynamischer Platzhalter in der Form `{{name}}`, der zur Laufzeit ersetzt wird |
| **Pre-/Post-Processing** | Optionale JavaScript-Transformation der Eingabe (Pre) bzw. Ausgabe (Post) eines Tools |
| **Predefined Tool** | Eines der 4 vordefinierten Tools: `search_files`, `read_file`, `write_file`, `rest_request` |
| **QuickJS** | Leichtgewichtige JavaScript-Engine, hier als WASM-Sandbox via `quickjs-emscripten` eingesetzt |
| **Sandbox** | Isolierte Ausführungsumgebung für JavaScript-Code mit Memory- und Timeout-Limits |
| **Single-Tool** | Ein Tool, das eine einzelne Operation ausführt (optional mit Pre-/Post-Processing) |
| **Tool** | Eine in Markdown definierte, ausführbare Einheit mit Parametern, Ausführungslogik und optionaler Transformation |
| **ToolRegistry** | Factory-basierte Verwaltung aller registrierten Tools (predefined + custom) |
| **Vault** | Obsidian-Datenablage (Ordner mit Markdown-Dateien und `.obsidian/`-Konfiguration) |
| **WASM** | WebAssembly – Binärformat für portable Code-Ausführung im Browser und auf Mobile-Geräten |

---

# Anhänge

## A. Projektstruktur

```
PaperAgents/
├── src/                        # Quellcode
│   ├── main.ts                 # Plugin Entry Point, Lifecycle
│   ├── settings.ts             # Settings Interface + Tab
│   ├── types.ts                # Zentrale Typdefinitionen (~280 Zeilen)
│   ├── core/                   # Kernlogik
│   │   ├── conversation.ts     # ConversationManager (97.47% Coverage)
│   │   ├── sandbox.ts          # QuickJS-Sandbox (69.26% Coverage)
│   │   ├── tool-executor.ts    # 3-Phasen-Pipeline (89.06% Coverage)
│   │   └── tool-registry.ts    # Factory Pattern (77.38% Coverage)
│   ├── parser/                 # Parsing & Validation
│   │   ├── agent-parser.ts     # Agenten-Markdown-Parser (94.49% Coverage)
│   │   ├── placeholder.ts      # Placeholder-Auflösung (85.71% Coverage)
│   │   ├── tool-loader.ts      # Custom Tool Discovery (69.74% Coverage)
│   │   ├── validator.ts        # Parameter-Validierung (62.19% Coverage)
│   │   └── yaml-parser.ts      # YAML Frontmatter-Parser (82.38% Coverage)
│   ├── tools/                  # Vordefinierte Tools
│   │   └── predefined.ts       # 4 Standard-Tools (84.43% Coverage)
│   ├── ui/                     # UI-Komponenten
│   │   ├── forms.ts            # Dynamische Formulare
│   │   ├── hitl-modal.ts       # HITL-Bestätigungsdialog
│   │   └── sidebar.ts          # Tool-Übersicht
│   └── utils/                  # Utilities
│       ├── constants.ts        # Konstanten (100% Coverage)
│       └── logger.ts           # Logger (85.82% Coverage)
├── tests/                      # Tests (146 Tests, 75.55% Coverage)
│   ├── unit/                   # Unit-Tests
│   ├── integration/            # Integrationstests
│   └── mocks/                  # Obsidian-API-Mocks
├── examples/                   # Beispiele
│   ├── *.md                    # 4 Beispiel-Tools
│   └── agents/                 # 3 Beispiel-Agenten
├── manuals/                    # Referenz-Handbücher
│   └── tools.md                # Tool Notation Manual (1246 Zeilen)
├── manifest.json               # Obsidian Plugin-Manifest
├── package.json                # npm-Konfiguration
├── tsconfig.json               # TypeScript-Konfiguration (strict mode)
├── esbuild.config.mjs          # Build-Konfiguration
├── vitest.config.ts            # Test-Konfiguration
└── AGENTS.md                   # AI-Agenten-Richtlinien für Copilot etc.
```

## B. Entwicklungsbefehle

| Befehl | Beschreibung |
|--------|--------------|
| `npm install` | Abhängigkeiten installieren |
| `npm run dev` | Development Build (Watch-Modus) |
| `npm run build` | Production Build mit Type-Checking |
| `npm test` | Tests mit Coverage ausführen |
| `npm run test:watch` | Tests im Watch-Modus |
| `npm run lint` | ESLint ausführen |
| `npm run release` | Production-Release erstellen |
| `npm run release:beta` | Beta-Release erstellen |

## C. Abhängigkeiten

### Production

| Paket | Version | Zweck |
|-------|---------|-------|
| `obsidian` | latest | Obsidian Plugin-API und Typ-Definitionen |
| `quickjs-emscripten` | ^0.31.0 | QuickJS WASM-Sandbox für sichere JavaScript-Ausführung |

### Development

| Paket | Version | Zweck |
|-------|---------|-------|
| `typescript` | ^5.8.3 | TypeScript-Compiler |
| `esbuild` | 0.25.5 | Bundler |
| `vitest` | ^1.6.0 | Test-Framework |
| `@vitest/coverage-v8` | ^1.6.1 | Coverage-Reports |
| `typescript-eslint` | 8.35.1 | Linting |

## D. Test-Coverage (Stand: 24. Februar 2026)

```
Datei                  | Stmts  | Branch | Funcs  | Lines
-----------------------|--------|--------|--------|-------
Gesamt                 | 75.55% | 71.45% | 77.62% | 75.55%
src/core               | 83.88% | 75.32% | 79.36% | 83.88%
  conversation.ts      | 97.47% | 79.00% | 100%   | 97.47%
  tool-executor.ts     | 89.06% | 66.15% | 100%   | 89.06%
  tool-registry.ts     | 77.38% | 89.28% | 64.70% | 77.38%
  sandbox.ts           | 69.26% | 71.05% | 58.82% | 69.26%
src/parser             | 79.56% | 69.91% | 82.00% | 79.56%
  agent-parser.ts      | 94.49% | 80.00% | 100%   | 94.49%
  placeholder.ts       | 85.71% | 71.42% | 87.50% | 85.71%
  yaml-parser.ts       | 82.38% | 69.03% | 92.30% | 82.38%
  tool-loader.ts       | 69.74% | 45.45% | 71.42% | 69.74%
  validator.ts         | 62.19% | 57.50% | 50.00% | 62.19%
src/tools              | 84.43% | 62.85% | 87.50% | 84.43%
src/utils              | 92.11% | 81.81% | 50.00% | 92.11%
```

**Tests:** 146 bestanden (16 Test-Dateien)

## E. Roadmap

| Phase | Beschreibung | Status | Datum |
|-------|-------------|--------|-------|
| 1 | Plugin-Grundgerüst, Build, Tests | ✅ Abgeschlossen | Jan 2026 |
| 2 | Tool-Engine (4 Tools, Registry, Executor, HITL) | ✅ Abgeschlossen | Jan 2026 |
| 3 | Sandbox & Security (QuickJS, Pre/Post-Processing) | ✅ Abgeschlossen | Jan 2026 |
| 4.1 | Agenten-Notation (Parser, Typen, 3 Beispiel-Agenten) | ✅ Abgeschlossen | Jan 2026 |
| 4.2 | Konversationslogik (ConversationManager, Memory) | ✅ Abgeschlossen | Jan 2026 |
| 4.3 | OpenRouter-Integration (API-Client, Streaming, Tool-Calling) | ⏳ Ausstehend | – |
| 5 | Advanced Features (History, Loops, Visual Editor, Community Templates) | 🔮 Zukunft | – |

### Phase 4.3 – Nächste Schritte

1. **API-Client erstellen** (`src/api/openrouter.ts`)
   - HTTP-Requests an `https://openrouter.ai/api/v1/chat/completions`
   - Request/Response-Typen definieren
   - Error-Handling implementieren
2. **Streaming-Support** (Server-Sent Events)
3. **Rate-Limiting & Retry** (exponentielles Backoff)
4. **Tool-Calling-Protokoll** (OpenRouter Tool-Format)
5. **Manuelle Tests** in Obsidian Desktop + Mobile
6. **Performance-Profiling**

## F. Beispiel-Agenten

| Agent | Tools | Zweck |
|-------|-------|-------|
| Research Assistant | search_files, read_file | Recherche im Vault, Informationen finden |
| Writing Helper | read_file, write_file | Texte korrigieren und verbessern |
| API Helper | rest_request, write_file | HTTP-Requests, API-Interaktion |

## G. Links

| Ressource | URL |
|-----------|-----|
| GitHub Repository | https://github.com/merlinbecker/PaperAgents |
| Obsidian API | https://docs.obsidian.md |
| Obsidian Developer Policies | https://docs.obsidian.md/Developer+policies |
| Plugin Guidelines | https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines |
| BRAT Plugin | https://tfthacker.com/BRAT |
| OpenRouter | https://openrouter.ai |
| QuickJS-Emscripten | https://github.com/nicolo-ribaudo/jit-less-quickjs |
| arc42 | https://arc42.org |
| Buy me a beer | https://buymeacoffee.com/merlinbecker |
