# Paper Agents

**Obsidian Plugin for Agent and Tool Workflows in Markdown**

![Version](https://img.shields.io/badge/version-0.0.26-blue)
![License](https://img.shields.io/badge/license-MIT-green)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=merlinbecker_PaperAgents&metric=alert_status)](https://sonarcloud.io/project/overview?id=merlinbecker_PaperAgents)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=merlinbecker_PaperAgents&metric=bugs)](https://sonarcloud.io/project/overview?id=merlinbecker_PaperAgents)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=merlinbecker_PaperAgents&metric=vulnerabilities)](https://sonarcloud.io/project/overview?id=merlinbecker_PaperAgents)
[![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=merlinbecker_PaperAgents&metric=code_smells)](https://sonarcloud.io/project/overview?id=merlinbecker_PaperAgents)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=merlinbecker_PaperAgents&metric=sqale_rating)](https://sonarcloud.io/project/overview?id=merlinbecker_PaperAgents)
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=merlinbecker_PaperAgents&metric=reliability_rating)](https://sonarcloud.io/project/overview?id=merlinbecker_PaperAgents)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=merlinbecker_PaperAgents&metric=security_rating)](https://sonarcloud.io/project/overview?id=merlinbecker_PaperAgents)
[![Duplicated Lines (%)](https://sonarcloud.io/api/project_badges/measure?project=merlinbecker_PaperAgents&metric=duplicated_lines_density)](https://sonarcloud.io/project/overview?id=merlinbecker_PaperAgents)

<a href="https://www.buymeacoffee.com/merlinbecker"><img src="https://img.buymeacoffee.com/button-api/?text=BuyMeABeer&emoji=🍺&slug=merlinbecker&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff" /></a>

---

## Projektübersicht

**Paper Agents** ist ein Obsidian-Plugin, das Entwicklern ermöglicht, **Agenten und Tools in Markdown zu definieren, zu testen und auszuführen**. Das Plugin kombiniert die Einfachheit von Markdown mit der Leistungsfähigkeit von AI-Agenten und Workflow-Automatisierung.

### Kernziele

- **Markdown-native Definition**: Agenten und Tools werden strukturiert in Markdown-Dateien beschrieben
- **Ausführung und Interaktion**: Parsing, Tool-Ausführung (inkl. Pre-/Post-Processing in Sandbox) und Agenten-Interaktion
- **OpenRouter-Integration**: API-basierte Kommunikation mit LLMs inkl. Streaming und Tool-Calling
- **Entwicklerfreundlichkeit**: Playground für Experimente mit Fokus auf Flexibilität
- **Kontinuierliche Entwicklung**: Verteilung über BRAT-Plugin-Beta-Releases

### Designphilosophie

> *"Wenn du einen Agenten nicht auf Papier skizzieren kannst, verstehst du ihn nicht. Wenn du ihn nicht in 30 Sekunden testen kannst, ist es kein Tool – es ist eine Karriere."*

Paper Agents verfolgt einen **pragmatischen Ansatz** ohne komplexe Frameworks. Der Fokus liegt auf **Experimentation** – nicht auf Produktivsystemen.

> Siehe [arc42/chapters/INDEX.md](arc42/chapters/INDEX.md) für die vollständige Architekturdokumentation.

---

## Features

### Implementiert (v0.0.2)

**Tool-Engine:**
- Markdown-Native Tool-Definitionen via YAML Frontmatter
- 4 Vordefinierte Tools: `search_files`, `read_file`, `write_file`, `rest_request`
- Pre-/Post-Processing in QuickJS-WASM-Sandbox (10 MB Memory, 5 s Timeout)
- Custom Tool Support mit automatischer Discovery
- Human-in-the-Loop (HITL) für kritische Operationen
- Chain-Tools mit Placeholder-Support

**LLM-Integration (OpenRouter):**
- OpenRouter API-Client mit SSE-Streaming (Token-by-Token-Ausgabe)
- Tool-Calling-Protokoll (OpenAI-kompatibel)
- Rate-Limiting und Retry-Logik (429, 500, 502, 503)
- Multi-Modell-Support (konfigurierbar in Settings)
- API-Key-Validierung
- WebSearch Plugin: serverseitige Web-Suche via OpenRouter (aktiviert per `websearch` Tool in Agent-Definition, Quellenangaben im Chat)

**Agenten-System:**
- Agenten-Notation: System-Prompts, Tools, Memory und Kontext in Markdown
- Konversationslogik: State-Management, Token-Counting, Memory-Management
- Orchestrierung: Multi-Turn-Loop (User → LLM → Tool-Calls → Feedback → LLM)
- Agenten-Loading aus Vault mit Reload-Command
- Konversationen als Markdown-Dateien im Vault (bidirektional: externe Änderungen laden sich automatisch neu)

**UI-Komponenten:**
- Chat-View mit Streaming-Anzeige, Agent-Auswahl, Tool-Call-Display
- Sidebar mit Tool- und Agenten-Übersicht
- Tool-Execution Output Panel mit Copy-to-Clipboard
- Execution History mit Filter/Suche/Export
- Template Browser (Import/Export von Tools und Agenten)
- Workflow View (visuelle Chain-Darstellung)
- Dynamische Parameter-Formulare und HITL-Modal

**Advanced Chain-Features:**
- Conditional Steps (`condition.equals` oder `condition.operator`/`value`)
- Loops über Datenlisten (`loop.over`, `loop.as`)
- Retry-Logik mit exponential Backoff
- `continueOnError` für fehlertolerante Chains

**Observability:**
- Execution-Metriken (Dauer, Erfolgsrate, p95)
- Tracing mit Request-IDs durch die Pipeline
- Persistente Execution History (JSON im Vault)

**Qualität:**
- Mobile-Kompatibel (Desktop, iOS, Android)
- TypeScript Strict Mode (minimale `any`-Types)
- 178 Tests, ~144 grün (34 vorgefertigte Sandbox-Tests warten auf QuickJS-Mock-Verbesserung)

---

## Installation

### Manuelle Installation

1. Lade das neueste Release von [GitHub Releases](https://github.com/merlinbecker/PaperAgents/releases) herunter
2. Extrahiere nach `.obsidian/plugins/paperAgents/`
3. Aktiviere das Plugin in Obsidian Settings

### Installation via BRAT (Beta Testing)

1. Installiere das [BRAT Plugin](https://github.com/TfTHacker/obsidian42-brat)
2. Füge die Repository-URL hinzu: `merlinbecker/PaperAgents`
3. BRAT installiert automatisch Beta-Releases

---

## Schnellstart

### 1. API-Key konfigurieren

1. Besuche [OpenRouter](https://openrouter.ai) und erstelle einen API-Key
2. In Obsidian: **Settings → Paper Agents → API Key** eintragen
3. Klicke **Validate** um den Key zu prüfen
4. Wähle dein bevorzugtes Modell (Standard: `openai/gpt-4o`)

### 2. Sidebar öffnen

Klicke das Bot-Icon in der linken Ribbon, oder nutze die Command Palette:
- `Ctrl/Cmd + P` → "Open Paper Agents Sidebar"

### 3. Chat starten

- `Ctrl/Cmd + P` → "Open Chat" um den Chat-View zu öffnen
- Wähle eine bestehende Konversation aus dem Dropdown oder erstelle eine neue
- Sende Nachrichten und sieh Streaming-Responses + Tool-Calls
- Konversationen werden automatisch als Markdown-Dateien im Vault gespeichert

### 4. Vordefinierte Tools nutzen

Klicke ein Tool in der Sidebar um ein Eingabeformular zu öffnen. Die Ergebnisse erscheinen im Output Panel.

### 5. Custom Tools erstellen

Erstelle einen Ordner `paper-agents-tools/` in deinem Vault und füge Markdown-Dateien hinzu:

```markdown
---
tool: true
id: daily_summary
name: "Daily Summary"
description: "Erstellt eine Zusammenfassung der heutigen Notizen"
type: single
parameters:
  - name: date
    type: string
    description: "Datum im Format YYYY-MM-DD"
    required: true
    default: "{{date}}"
---

# Daily Summary Tool

#### **Tool-Ausführung**
```yaml
tool: "search_files"
parameters:
  query: "{{date}}"
  path: "/daily-notes"
```
```

**Custom Tools neu laden:**
- Command Palette → "Reload Custom Tools"

### 6. Agenten erstellen

Erstelle Agenten-Definitionen in `paper-agents-agents/`:

```markdown
---
agent: true
id: research-assistant
name: "Research Assistant"
model: "openai/gpt-4o"
temperature: 0.7
tools:
  - search_files
  - read_file
  - websearch
websearchConfig:
  maxResults: 5
memory:
  type: conversation
  maxMessages: 50
---

## System Prompt

You are a research assistant that helps users find and analyze information in their vault.
```

---

## Settings

Zugriff via **Settings → Community plugins → Paper Agents**:

| Setting | Beschreibung | Standard |
|---------|-------------|----------|
| API Key | OpenRouter API-Key (lokal gespeichert) | - |
| Default Model | LLM-Modell | `openai/gpt-4o` |
| Temperature | Kreativität (0–2) | `0.7` |
| Max Tokens | Maximale Token pro Response | `4096` |
| Custom Tools Path | Ordner für Tool-Definitionen | `paper-agents-tools` |
| Agents Path | Ordner für Agenten-Definitionen | `paper-agents-agents` |
| Conversations Path | Ordner für Konversations-Markdown | `paper-agents-conversations` |
| Debug Logging | Console-Logs für Troubleshooting | `false` |

Änderungen an API-Key, Modell, Temperature oder Max Tokens werden sofort wirksam (kein Neustart nötig).

---

## Commands

| Command | Beschreibung |
|---------|-------------|
| Open Paper Agents Sidebar | Tool- und Agenten-Übersicht öffnen |
| Open Chat | Chat-View öffnen |
| Reload Custom Tools | Custom Tools aus Vault neu laden |
| Reload Agents | Agenten-Definitionen neu laden |
| Show Execution History | Ausführungsprotokoll anzeigen |
| Browse Templates | Template Browser öffnen |
| Show Workflow View | Visuelle Chain-Darstellung |

---

## Advanced Chain-Features

### Conditional Steps

```yaml
steps:
  - name: check_status
    tool: read_file
    parameters:
      filePath: "status.md"
  - name: notify
    tool: write_file
    parameters:
      filePath: "notification.md"
      content: "Status changed!"
    condition:
      field: "check_status.content"
      equals: "changed"
```

### Loops

```yaml
steps:
  - name: process_item
    tool: read_file
    parameters:
      filePath: "{{loop.item}}"
    loop:
      over: items
      as: item
      maxIterations: 100
```

### Retry mit Backoff

```yaml
steps:
  - name: api_call
    tool: rest_request
    parameters:
      url: "https://api.example.com/data"
      method: GET
    retry:
      maxAttempts: 3
      delay: 1000
      backoffMultiplier: 2
```

### continueOnError

```yaml
steps:
  - name: risky_step
    tool: rest_request
    parameters:
      url: "https://maybe-down.api.com"
      method: GET
    continueOnError: true
  - name: next_step
    tool: write_file
    parameters:
      filePath: "result.md"
      content: "Completed regardless of previous step"
```

---

## Sicherheit & Validierung

### Human-in-the-Loop (HITL)

| Tool | Operation | HITL erforderlich? |
|------|-----------|-------------------|
| `write_file` | Alle | Ja, immer |
| `rest_request` | GET | Nein |
| `rest_request` | POST/PUT/DELETE | Ja |
| `read_file` | Alle | Nein |
| `search_files` | Alle | Nein |

### JavaScript-Sandbox

Pre-/Post-Processing-Code läuft in einer **QuickJS-Sandbox**:
- Isolation vom Node.js-Prozess
- Memory-Limit (10 MB), Timeout-Limit (5 Sekunden)
- Blockierte Patterns: `require()`, `eval()`, `process`, `global`, `Function()`

---

## Architektur

```
Paper Agents
├── Types & Parser (Phase 1)
│   ├── types.ts         - Zentrale Typ-Definitionen
│   ├── yaml-parser.ts   - YAML Frontmatter-Parsing
│   ├── agent-parser.ts  - Agenten-Notation-Parsing
│   ├── placeholder.ts   - Platzhalter-Ersetzung
│   ├── validator.ts     - Parameter-Validierung
│   └── tool-loader.ts   - Custom Tool Discovery
│
├── Core (Phase 2–4)
│   ├── tool-registry.ts - Tool-Verwaltung / Factory Pattern
│   ├── tool-executor.ts - 3-Phasen-Execution + Advanced Chain Features
│   ├── sandbox.ts       - QuickJS sichere JavaScript-Ausführung
│   ├── conversation.ts  - Konversations-State-Management
│   ├── openrouter.ts    - OpenRouter API-Client (SSE, Tool-Calling, Retry)
│   ├── orchestrator.ts  - LLM-Orchestrierung (Multi-Turn-Loop)
│   └── history.ts       - Persistente Execution History
│
├── Tools
│   └── predefined.ts    - 4 Standard-Tools
│
├── UI
│   ├── sidebar.ts       - Tool- & Agenten-Übersicht
│   ├── chat.ts          - Chat-View mit Streaming
│   ├── forms.ts         - Dynamische Parameter-Formulare
│   ├── hitl-modal.ts    - Bestätigungsdialoge
│   ├── output-panel.ts  - Execution-Ergebnis-Anzeige
│   ├── history-panel.ts - Ausführungsprotokoll
│   ├── template-browser.ts - Template Import/Export
│   └── workflow-view.ts - Visuelle Chain-Darstellung
│
└── Utils
    ├── constants.ts     - Zentrale Konstanten
    ├── logger.ts        - Debug-Logging
    └── metrics.ts       - Execution-Metriken & Tracing
```

### Design Patterns

- **Factory Pattern**: Tool-Erstellung und -Registrierung
- **Strategy Pattern**: Austauschbare Tool-Ausführungslogik (Single vs. Chain)
- **Observer Pattern**: HITL-Callbacks, Streaming-Callbacks
- **Pipeline Pattern**: 3-Phasen-Execution (Pre → Tool → Post)
- **Orchestrator Pattern**: Multi-Turn LLM ↔ Tool-Calling Loop

---

## Projektphasen

| Phase | Status | Beschreibung |
|-------|--------|-------------|
| 1: Plugin-Grundgerüst | Abgeschlossen | Build, TypeScript, Tests, Basis-Typen |
| 2: Tool-Engine | Abgeschlossen | 4 Tools, Registry, Executor, Custom Tools |
| 3: Sandbox & Security | Abgeschlossen | QuickJS, Pre/Post-Processing, HITL |
| 4.1: Agenten-Notation | Abgeschlossen | AgentParser, Beispiel-Agenten |
| 4.2: Konversationslogik | Abgeschlossen | ConversationManager, Token-Counting |
| 4.3: OpenRouter-Integration | Abgeschlossen | API-Client, Chat-UI, Orchestrierung |
| 4.4: Advanced Features | Abgeschlossen | Conditional, Loops, Retry, History, Metrics |

---

## Entwicklung

```bash
npm install          # Abhängigkeiten installieren
npm run dev          # Development Build (Watch-Modus)
npm run build        # Production Build
npm test             # Tests ausführen
npm run lint         # Linting
```

**178 Tests** insgesamt (144 grün, 34 pre-existing Sandbox-Mock-Failures).

---

## Dokumentation

| Dokumentation | Gehe zu... |
|-------------|------------|
| Das Projekt verstehen | [README.md](README.md) |
| Architektur & Roadmap | [arc42/chapters/INDEX.md](arc42/chapters/INDEX.md) |
| Ein Custom Tool erstellen | [manuals/tools.md](manuals/tools.md) |
| Beispiele sehen | [examples/](examples/) |
| Ein Release machen | [RELEASE.md](RELEASE.md) |
| AI-Agent-Richtlinien | [AGENTS.md](AGENTS.md) |

---

## Lizenz

MIT © [Merlin Becker](https://github.com/merlinbecker)

---

## Support

- **Issues**: [GitHub Issues](https://github.com/merlinbecker/PaperAgents/issues)
- **Discussions**: [GitHub Discussions](https://github.com/merlinbecker/PaperAgents/discussions)
- **Buy me a beer**: [BuyMeACoffee](https://buymeacoffee.com/merlinbecker)

---

**Aktuelle Version:** 0.0.26
**Status:** Beta (Phase 4.3 + 4.4 abgeschlossen, WebSearch und Conversation-Rework integriert)
**Letzte Aktualisierung:** 5. März 2026

---

*"Paper Agents: Agenten-Workflows, die Sinn ergeben – weil sie dort geschrieben werden, wo du bereits Notizen machst."*
