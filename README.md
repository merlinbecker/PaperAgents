# Paper Agents

**Obsidian Plugin für Agenten- und Tool-Workflows in Markdown**

![Version](https://img.shields.io/badge/version-0.0.1-blue)
![License](https://img.shields.io/badge/license-MIT-green)

<a href="https://www.buymeacoffee.com/merlinbecker"><img src="https://img.buymeacoffee.com/button-api/?text=Buy me a beer&emoji=🍺&slug=merlinbecker&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff" /></a>

---

## 📋 Projektübersicht

**Paper Agents** ist ein Obsidian-Plugin, das Entwicklern ermöglicht, **Agenten und Tools in Markdown zu definieren, zu testen und auszuführen**. Das Plugin kombiniert die Einfachheit von Markdown mit der Leistungsfähigkeit von AI-Agenten und Workflow-Automatisierung.

### Kernziele

- **Markdown-native Definition**: Agenten und Tools werden strukturiert in Markdown-Dateien beschrieben
- **Ausführung und Interaktion**: Parsing, Tool-Ausführung (inkl. Pre-/Post-Processing in Sandbox) und Agenten-Interaktion
- **OpenRouter-Integration**: API-basierte Kommunikation mit LLMs und externen Tools
- **Entwicklerfreundlichkeit**: Playground für Experimente mit Fokus auf Flexibilität
- **Kontinuierliche Entwicklung**: Verteilung über BRAT-Plugin-Beta-Releases

### Designphilosophie

> *"Wenn du einen Agenten nicht auf Papier skizzieren kannst, verstehst du ihn nicht. Wenn du ihn nicht in 30 Sekunden testen kannst, ist es kein Tool – es ist eine Karriere."*

Paper Agents verfolgt einen **pragmatischen Ansatz** ohne komplexe Frameworks. Der Fokus liegt auf **Experimentation** – nicht auf Produktivsystemen.

---

## ✨ Features

### Aktuell Implementiert (v0.0.1)

- ✅ **Markdown-Native Tool-Definitionen**: Tools via YAML Frontmatter definieren
- ✅ **4 Vordefinierte Tools**: search_files, read_file, write_file, rest_request
- ✅ **Pre-/Post-Processing**: JavaScript-basierte Datenverarbeitung vor/nach Tool-Ausführung
- ✅ **QuickJS-Sandbox**: Sichere JavaScript-Ausführung mit Memory- und Timeout-Limits
- ✅ **Custom Tool Support**: Automatische Discovery und Laden von benutzerdefinierten Tools
- ✅ **Human-in-the-Loop (HITL)**: Bestätigungspflicht für kritische Operationen
- ✅ **Chain-Tools**: Verkettung mehrerer Tools mit Placeholder-Support
- ✅ **Mobile-Kompatibel**: Funktioniert auf Desktop, iOS und Android
- ✅ **UI-Integration**: Sidebar, dynamische Formulare, HITL-Modal

### In Planung

- ⏳ **Agenten-Definition**: System-Prompts, Tools, Kontext und Memory in Markdown
- ⏳ **Konversationsablauf**: Automatische Nachrichtenverarbeitung und Antwortgenerierung
- ⏳ **OpenRouter-Integration**: API-Key-Konfiguration und LLM-Kommunikation
- ⏳ **Execution History**: Log-Persistierung und History-Panel
- ⏳ **Advanced Chain-Features**: Conditional Steps, Loops, Retry-Logik
- ⏳ **Template Library**: Community-geteilte Tool- und Agenten-Templates

---

## 🚀 Installation

### Von Obsidian Community Plugins (Noch nicht verfügbar)

1. Öffne Obsidian Settings
2. Navigiere zu **Community plugins** → **Browse**
3. Suche nach "Paper Agents"
4. Klicke **Install** → **Enable**

### Manuelle Installation

1. Lade das neueste Release von [GitHub Releases](https://github.com/merlinbecker/PaperAgents/releases) herunter
2. Extrahiere nach `.obsidian/plugins/paper-agents/`
3. Aktiviere das Plugin in Obsidian Settings

### Installation via BRAT (Beta Testing)

1. Installiere das [BRAT Plugin](https://github.com/TfTHacker/obsidian42-brat)
2. Füge die Repository-URL hinzu: `merlinbecker/PaperAgents`
3. BRAT installiert automatisch Beta-Releases

---

## 📖 Schnellstart

### 1. Sidebar öffnen

Klicke das 🤖 Bot-Icon in der linken Ribbon, oder nutze die Command Palette:
- `Ctrl/Cmd + P` → "Open Paper Agents Sidebar"

### 2. Vordefinierte Tools nutzen

Das Plugin bietet 4 integrierte Tools:

#### 🔧 search_files
Durchsuche dein Vault nach Dateinamen.

**Parameter:**
- `query` (string, required): Suchtext
- `path` (string, optional): Basis-Ordner (Standard: "/")

**Beispiel:**
```yaml
query: "meeting notes"
path: "/work"
```

#### 🔧 read_file
Lese Dateiinhalt aus dem Vault.

**Parameter:**
- `filePath` (string, required): Pfad zur Datei (z.B., "notes/file.md")

**Returns:** Dateiinhalt, Größe, Änderungsdatum

#### 🔧 write_file
Erstelle oder modifiziere eine Datei.

**Parameter:**
- `filePath` (string, required): Pfad zur Datei
- `content` (string, required): Zu schreibender Inhalt
- `overwrite` (boolean, optional): Überschreiben falls vorhanden (Standard: false)

**⚠️ Erfordert Bestätigung**: Zeigt immer einen Bestätigungsdialog.

#### 🔧 rest_request
HTTP-Requests an externe APIs.

**Parameter:**
- `url` (string, required): Ziel-URL
- `method` (string, required): HTTP-Methode (GET, POST, PUT, DELETE)
- `headers` (object, optional): HTTP-Headers als JSON
- `body` (string, optional): Request-Body

**⚠️ Erfordert Bestätigung**: POST, PUT, DELETE erfordern Bestätigung.

### 3. Custom Tools erstellen

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

Dieses Tool durchsucht Notizen eines bestimmten Datums und erstellt eine Zusammenfassung.

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
- Oder klicke den Refresh-Button in der Sidebar

---

## 🔐 Sicherheit & Validierung

### Human-in-the-Loop (HITL)

Destruktive Operationen erfordern explizite Bestätigung:

| Tool | Operation | HITL erforderlich? |
|------|-----------|-------------------|
| `write_file` | Alle | ✅ Ja, immer |
| `rest_request` | GET | ❌ Nein |
| `rest_request` | POST/PUT/DELETE | ✅ Ja |
| `read_file` | Alle | ❌ Nein |
| `search_files` | Alle | ❌ Nein |

### JavaScript-Sandbox

Pre-/Post-Processing-Code läuft in einer **QuickJS-Sandbox**:

**Sicherheitsfeatures:**
- ✅ Isolation vom Node.js-Prozess
- ✅ Memory-Limit (10 MB)
- ✅ Timeout-Limit (5 Sekunden)
- ✅ Blockierte Patterns: `require()`, `eval()`, `process`, `global`, `Function()`

**Beispiel - Blockierter Code:**
```javascript
// ❌ FEHLER: Diese Patterns sind aus Sicherheitsgründen blockiert
const fs = require('fs');        // Kein Modul-Import
eval('dangerous code');          // Kein Code-Evaluation
process.exit(1);                 // Kein Prozess-Zugriff
```

---

## 🔗 Multi-Step Workflows (Chains)

Definiere Agenten mit mehreren sequenziellen Schritten:

```markdown
---
tool: true
id: backup_notes
name: "Backup Important Notes"
description: "Sichert Notizen in einen Backup-Ordner"
type: chain
parameters:
  - name: tag
    type: string
    required: true
steps:
  - name: "Search notes"
    tool: search_files
    parameters:
      query: "{{tag}}"
      path: "/"
  
  - name: "Create backup"
    tool: write_file
    parameters:
      filePath: "/backups/{{date}}-{{tag}}.md"
      content: "{{prev_step.output.results}}"
---
```

### Placeholder-Support

- `{{param_name}}` → Nutzer-Input-Parameter
- `{{prev_step.output}}` → Output des vorherigen Schritts
- `{{prev_step.output.field}}` → Verschachtelter Feldzugriff
- `{{date}}` → Aktuelles Datum (YYYY-MM-DD)
- `{{time}}` → Aktuelle Zeit (HH:mm:ss)
- `{{random_id}}` → Zufällige UUID

---

## ⚙️ Settings

Zugriff via **Settings → Community plugins → Paper Agents**:

### Custom Tools Path
- **Standard**: `paper-agents-tools`
- Ändere den Ordner für Custom Tool-Definitionen

### Enable Debug Logging
- **Standard**: `false`
- Aktiviere für detaillierte Console-Logs (hilfreich beim Troubleshooting)

---

## 🏗 Architektur

```
Paper Agents
├── Types & Parser (Phase 1) ✅
│   ├── types.ts         - Zentrale Typ-Definitionen
│   ├── yaml-parser.ts   - YAML Frontmatter-Parsing
│   ├── placeholder.ts   - Platzhalter-Ersetzung
│   ├── validator.ts     - Parameter-Validierung
│   └── tool-loader.ts   - Custom Tool-Loading
│
├── Core & Tools (Phase 2) ✅
│   ├── tool-registry.ts - Tool-Verwaltung (Factory Pattern)
│   ├── tool-executor.ts - 3-Phasen-Execution + HITL
│   ├── sandbox.ts       - QuickJS sichere JavaScript-Ausführung
│   └── predefined.ts    - 4 Standard-Tools
│
├── UI (Phase 3) ✅
│   ├── sidebar.ts       - Tool-Übersicht & Status
│   ├── forms.ts         - Dynamische Parameter-Formulare
│   ├── hitl-modal.ts    - Bestätigungsdialoge
│   └── main.ts          - Plugin-Integration
│
└── Agents & Conversation (Phase 4) ⏳
    ├── agent-parser.ts  - Agenten-Notation-Parsing
    ├── conversation.ts  - Konversationslogik
    └── openrouter.ts    - OpenRouter API-Integration
```

### Design Principles

- **Factory Pattern**: Tool-Erstellung und -Registrierung
- **Strategy Pattern**: Austauschbare Tool-Ausführungslogik (Single vs. Chain)
- **Observer Pattern**: HITL-Callbacks für externe Bestätigung
- **Pipeline Pattern**: 3-Phasen-Execution (Pre → Tool → Post)

---

## 📚 Projektphasen & Roadmap

### ✅ Phase 1: Plugin-Grundgerüst (Abgeschlossen)
- Build-Infrastructure und TypeScript-Setup
- Test-Framework (Vitest, 76 Tests, 67% Coverage)
- Basis-Typen und Konstanten

### ✅ Phase 2: Tool-Engine (Abgeschlossen)
- 4 vordefinierte Tools (search, read, write, rest)
- Tool-Registry mit Factory Pattern
- Tool-Executor mit 3-Phasen-Pipeline
- Custom Tool-Loading und Discovery

### ✅ Phase 3: Sandbox & Security (Abgeschlossen)
- QuickJS-Integration für sichere JavaScript-Ausführung
- Pre-/Post-Processing mit Code-Validierung
- Memory- und Timeout-Limits
- HITL-Modal für kritische Operationen

### ⏳ Phase 4: Agenten & Konversation (Aktuell)

**Geplante Features:**
1. **Agenten-Notation finalisieren**
   - Markdown-Format für System-Prompts, Tools, Kontext
   - Memory-Management für Konversationen
   - Beispiel-Templates erstellen

2. **Konversationslogik implementieren**
   - Trigger für Nutzer-Nachrichten erkennen
   - LLM-Integration über OpenRouter
   - Automatisches Rückschreiben in Markdown

3. **OpenRouter-Integration**
   - API-Key-Verwaltung in Settings
   - Request/Response-Handling
   - Error-Handling und Rate-Limiting

4. **Testing & Iteration**
   - Manuelle Tests der Agenten-Interaktionen
   - Tool-Ketten validieren
   - Performance-Profiling

**Herausforderungen:**
- **Markdown-Parsing**: Wie wird sichergestellt, dass Nutzer die Notation nicht versehentlich zerstören?
  - *Lösung*: Validierung durch Plugin oder LLM-Feedback
- **Kontext-Management**: Wie wird Memory bei langen Konversationen verwaltet?
  - *Lösung*: Token-Limits beachten, ggf. Zusammenfassung alter Nachrichten

### 🔮 Phase 5: Advanced Features (Zukunft)

- Execution History Panel
- Conditional Steps & Loops in Chains
- Visual Workflow Editor
- Community Template Marketplace
- Observability (Metrics, Tracing)

---

## 🧪 Entwicklung

### Build from Source

```bash
# Abhängigkeiten installieren
npm install

# Development Build (Watch-Modus)
npm run dev

# Production Build
npm run build

# Tests ausführen
npm test

# Linting
npm run lint
```

### Projektstruktur

```
src/
  main.ts              # Plugin Entry Point, Lifecycle
  settings.ts          # Settings Interface
  types.ts             # Type Definitions
  
  core/                # Core Logic
    tool-executor.ts   # 3-Phasen-Execution-Engine
    tool-registry.ts   # Factory Pattern Tool-Management
    sandbox.ts         # QuickJS Sandbox
  
  parser/              # YAML Parsing & Validation
    yaml-parser.ts     # Markdown Frontmatter Parsing
    validator.ts       # Parameter Validation
    placeholder.ts     # Placeholder Resolution
    tool-loader.ts     # Custom Tool Discovery
  
  tools/               # Predefined Tools
    predefined.ts      # 4 Standard-Tools
  
  ui/                  # UI Components
    sidebar.ts         # Tool Overview
    forms.ts           # Dynamic Forms
    hitl-modal.ts      # Confirmation Dialogs
  
  utils/               # Shared Utilities
    logger.ts          # Logging
    constants.ts       # Constants

tests/
  unit/                # Unit Tests (50 Tests)
  integration/         # Integration Tests (16 Tests)
  e2e/                 # End-to-End Tests (10 Tests)
```

### Test Coverage

```
All files          |   67.25 |    67.27 |   70.27 |   67.25
src/core          |   79.42 |    71.96 |   69.04 |   79.42
src/parser        |   64.29 |    65.38 |   74.35 |   64.29
src/tools         |   84.43 |    62.85 |    87.5 |   84.43
```

---

## 📝 Dokumentation

- **[Tool Notation Manual](manuals/tools.md)**: Umfassende Referenz für Tool-Definitionen
- **[Examples](examples/)**: 4 Beispiel-Tools mit Best Practices
- **[Release Process](RELEASE.md)**: Anleitung für Beta- und Production-Releases
- **[Phase Report](Reports/PhaseWerkzeuge.md)**: Detaillierter Bericht über Phase 1-3

---

## 🤝 Contributing

Beiträge sind willkommen! Bitte:

1. Forke das Repository
2. Erstelle einen Feature-Branch
3. Mache deine Änderungen
4. Füge Tests hinzu (falls zutreffend)
5. Reiche einen Pull Request ein

**Code Style:**
- TypeScript Strict Mode
- Folge existierenden Patterns
- Dokumentiere öffentliche APIs
- Halte Funktionen klein und fokussiert

---

## 📄 Lizenz

MIT © [Merlin Becker](https://github.com/merlinbecker)

---

## 🙏 Support

- **Issues**: [GitHub Issues](https://github.com/merlinbecker/PaperAgents/issues)
- **Discussions**: [GitHub Discussions](https://github.com/merlinbecker/PaperAgents/discussions)
- **Buy me a beer**: [BuyMeACoffee](https://buymeacoffee.com/merlinbecker)

---

## 🔗 Links

- **GitHub Repository**: https://github.com/merlinbecker/PaperAgents
- **Obsidian API**: https://docs.obsidian.md
- **BRAT Plugin**: https://tfthacker.com/BRAT
- **OpenRouter**: https://openrouter.ai

---

## 📊 Status

**Aktuelle Version:** 0.0.1  
**Status:** Beta (Phase 3 abgeschlossen, Phase 4 in Arbeit)  
**Letzte Aktualisierung:** 29. Januar 2026

**Abgeschlossene Phasen:**
- ✅ Phase 1: Plugin-Grundgerüst
- ✅ Phase 2: Tool-Engine
- ✅ Phase 3: Sandbox & Security

**Aktuelle Phase:**
- ⏳ Phase 4: Agenten & Konversation

---

*"Paper Agents: Agenten-Workflows, die Sinn ergeben – weil sie dort geschrieben werden, wo du bereits Notizen machst."*
