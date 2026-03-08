# Paper Agents

**Obsidian Plugin für KI-Agenten und Tool-Workflows – direkt in Markdown**

![Version](https://img.shields.io/badge/version-0.0.53-blue)
![License](https://img.shields.io/badge/license-MIT-green)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=merlinbecker_PaperAgents&metric=alert_status)](https://sonarcloud.io/project/overview?id=merlinbecker_PaperAgents)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=merlinbecker_PaperAgents&metric=bugs)](https://sonarcloud.io/project/overview?id=merlinbecker_PaperAgents)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=merlinbecker_PaperAgents&metric=vulnerabilities)](https://sonarcloud.io/project/overview?id=merlinbecker_PaperAgents)
[![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=merlinbecker_PaperAgents&metric=code_smells)](https://sonarcloud.io/project/overview?id=merlinbecker_PaperAgents)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=merlinbecker_PaperAgents&metric=sqale_rating)](https://sonarcloud.io/project/overview?id=merlinbecker_PaperAgents)
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=merlinbecker_PaperAgents&metric=reliability_rating)](https://sonarcloud.io/project/overview?id=merlinbecker_PaperAgents)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=merlinbecker_PaperAgents&metric=security_rating)](https://sonarcloud.io/project/overview?id=merlinbecker_PaperAgents)
[![Duplicated Lines (%)](https://sonarcloud.io/api/project_badges/measure?project=merlinbecker_PaperAgents&metric=duplicated_lines_density)](https://sonarcloud.io/project/overview?id=merlinbecker_PaperAgents)

<a href="https://www.buymeacoffee.com/merlinbecker"><img src="https://img.buymeacoffee.com/button-api/?slug=merlinbecker"/></a>

---

## Was ist Paper Agents?

**Paper Agents** verwandelt Obsidian in einen vollwertigen KI-Agenten-Sandbox. Agenten, Tools und Workflows werden direkt in Markdown-Dateien definiert – ohne externe Konfigurationstools, ohne komplizierte Frameworks. Einfach schreiben, sofort testen.

> *"Wenn du einen Agenten nicht auf Papier skizzieren kannst, verstehst du ihn nicht. Wenn du ihn nicht in 30 Sekunden testen kannst, ist es kein Tool – es ist eine Karriere."*

---

## Features

### 🖊️ Agent Canvas – KI direkt ins Dokument

Das **Highlight-Feature**: Öffne ein beliebiges Markdown-Dokument, wähle einen Agenten und lass ihn dein Dokument annotieren. Agenten-Antworten erscheinen als native Obsidian-Callouts direkt im Text – strukturiert, durchsuchbar, dauerhaft.

- **Dokumentenkontext**: Der Agent analysiert das gesamte aktive Dokument
- **Textselektion**: Markiere einen Abschnitt und lass nur diesen kommentieren
- **Inline-Platzierung**: Mit `@after-paragraph-N:` platziert der Agent seine Annotation exakt nach dem gewünschten Absatz
- **Vorgemerkter Agent**: `paper-agent: research-assistant` im Frontmatter startet Canvas automatisch mit dem passenden Agenten
- **Multi-Agent-Modus**: Mehrere Agenten parallel auf ein Dokument anwenden
- **Diff-Ansicht**: Alle Canvas-Callouts auf einen Blick überblicken und verwalten
- **Bidirektional**: Canvas-Callouts werden beim nächsten Aufruf automatisch aus dem Kontext gefiltert – kein Rauschen in der Agenten-Antwort

### 💬 Chat View – Vollwertige Konversationen mit Agenten

- Streaming-Antworten Token für Token mit animiertem Cursor
- Aufklappbare Tool-Call-Blöcke mit Parametern und Ergebnis
- **Konversationen als Markdown-Dateien** im Vault – lesbar, bearbeitbar, versionierbar
- Automatisches Laden der letzten Konversation beim Öffnen
- **Antwort neu generieren**: ↺-Button für jede Assistenz-Antwort
- **Konversationshistorie neu senden**: Gespräch nach externer Bearbeitung fortführen
- Klassifizierte Fehlermeldungen (Timeout, Rate-Limit, Auth, Netzwerk, Credits)

### 🔧 Tool-Engine

- **4 eingebaute Tools**: `search_files`, `read_file`, `write_file`, `rest_request`
- **Custom Tools**: YAML-basierte Tool-Definitionen als Markdown-Dateien im Vault
- **QuickJS-Sandbox**: Sicheres Pre-/Post-Processing in isolierter JavaScript-Umgebung (10 MB, 5 s Timeout)
- **Human-in-the-Loop (HITL)**: Bestätigung bei schreibenden Operationen

### 🤖 Agenten-System

- Agenten als Markdown-Dateien: System-Prompt, Tools, Memory, Modell – alles an einem Ort
- **OpenRouter-Integration**: Zugang zu hunderten Modellen (GPT-4o, Claude, Gemini, Llama u.v.m.)
- SSE-Streaming, Tool-Calling (OpenAI-kompatibel), Retry-Logik (429/500/502/503)
- **WebSearch**: Serverseitige Web-Suche via OpenRouter mit Quellenangaben im Chat
- Proaktives Rate-Limiting und AbortController-basierte Timeouts

### ⛓️ Fortgeschrittene Chain-Features

- **Conditional Steps**: Bedingte Ausführung mit 8 Operatoren (eq, neq, gt, lt, gte, lte, contains, exists)
- **Loops**: Iteration über Datenlisten mit `loop.over` und `loop.as`
- **Retry mit Backoff**: Automatische Wiederholung mit exponentialem Backoff
- **continueOnError**: Fehlertolerante Chains – ein fehlgeschlagener Schritt stoppt nicht die ganze Pipeline

### 📊 Observability & History

- Persistente Execution History (Markdown im Vault)
- Execution-Metriken: Dauer, Erfolgsrate, p95
- Tracing mit Request-IDs durch die gesamte Pipeline
- Export, Suche und Filter in der History-Ansicht

### 🖥️ UI-Komponenten

- **Sidebar**: Tool- und Agenten-Übersicht mit interaktiven Beispielen
- **Output Panel**: Strukturierte Tool-Ergebnisse mit Copy-to-Clipboard
- **Template Browser**: Tools und Agenten importieren/exportieren
- **Workflow View**: Visuelle Chain-Darstellung
- **Dynamische Formulare** und HITL-Bestätigungsdialoge

### ✅ Qualität

- Läuft auf Desktop, iOS und Android (kein `isDesktopOnly`)
- TypeScript Strict Mode
- **385 Tests** in 25 Dateien, alle grün

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

1. Besuche [OpenRouter](https://openrouter.ai) und erstelle einen kostenlosen API-Key
2. In Obsidian: **Settings → Community plugins → Paper Agents → API Key** eintragen
3. Klicke **Validate** um den Key zu prüfen
4. Wähle dein bevorzugtes Modell (Standard: `openai/gpt-4o`)

### 2. Sidebar öffnen

Klicke das Bot-Icon in der linken Ribbon, oder öffne die Command Palette:
- `Ctrl/Cmd + P` → „Open sidebar"

### 3. Chat starten

- `Ctrl/Cmd + P` → „Open agent chat"
- Wähle eine bestehende Konversation aus dem Dropdown oder erstelle eine neue
- Sende Nachrichten und sieh Streaming-Antworten mit Tool-Call-Details
- Konversationen werden automatisch als Markdown-Dateien im Vault gespeichert und sind bidirektional editierbar

### 4. Agent Canvas nutzen

Öffne ein beliebiges Markdown-Dokument und wähle in der Command Palette:
- `Ctrl/Cmd + P` → „Apply interactive agent to document"

Der Agent analysiert dein Dokument und antwortet direkt als Obsidian-Callout im Text. Optional: Text markieren, um nur den ausgewählten Abschnitt zu kommentieren. Für einen fest zugeordneten Agenten einfach ins Frontmatter schreiben:

```yaml
---
paper-agent: research-assistant
---
```

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

Command Palette → „Reload custom tools" um neue Tools zu laden.

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
| Open sidebar | Tool- und Agenten-Übersicht öffnen |
| Open agent chat | Chat-View öffnen |
| Apply interactive agent to document | Agent Canvas auf aktives Dokument anwenden |
| Reload custom tools | Custom Tools aus Vault neu laden |
| Reload agents | Agenten-Definitionen neu laden |
| Show execution history | Ausführungsprotokoll anzeigen |
| Browse templates | Template Browser öffnen |
| Show workflow view | Visuelle Chain-Darstellung |

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

## Sicherheit

### Human-in-the-Loop (HITL)

| Tool | Operation | Bestätigung erforderlich? |
|------|-----------|--------------------------|
| `write_file` | Alle | ✅ Ja, immer |
| `rest_request` | POST/PUT/DELETE | ✅ Ja |
| `rest_request` | GET | ❌ Nein |
| `read_file` | Alle | ❌ Nein |
| `search_files` | Alle | ❌ Nein |

### JavaScript-Sandbox

Pre-/Post-Processing-Code läuft in einer **QuickJS-Sandbox**:
- Isolation vom Host-Prozess
- Memory-Limit (10 MB), Timeout-Limit (5 Sekunden)
- Blockierte Patterns: `require()`, `eval()`, `process`, `global`, `Function()`

---

## Entwicklung

```bash
npm install          # Abhängigkeiten installieren
npm run dev          # Development Build (Watch-Modus)
npm run build        # Production Build
npm test             # Tests ausführen (385 Tests, alle grün)
npm run lint         # Linting
```

---

## Dokumentation

| Dokumentation | Gehe zu... |
|-------------|------------|
| Architektur & Roadmap | [arc42/chapters/INDEX.md](arc42/chapters/INDEX.md) |
| Chat View Handbuch | [manuals/chat-view.md](manuals/chat-view.md) |
| Custom Tools erstellen | [manuals/tools.md](manuals/tools.md) |
| Beispiele | [examples/](examples/) |
| Changelog | [CHANGELOG.md](CHANGELOG.md) |

---

## Lizenz

MIT © [Merlin Becker](https://github.com/merlinbecker)

---

## Support

- **Issues**: [GitHub Issues](https://github.com/merlinbecker/PaperAgents/issues)
- **Discussions**: [GitHub Discussions](https://github.com/merlinbecker/PaperAgents/discussions)
- **Buy me a coffee**: [BuyMeACoffee](https://buymeacoffee.com/merlinbecker)

---

**Aktuelle Version:** 0.0.53  
**Status:** Beta – aktiv in Entwicklung  
**Letzte Aktualisierung:** März 2026

---

*"Paper Agents: Agenten-Workflows, die Sinn ergeben – weil sie dort geschrieben werden, wo du bereits Notizen machst."*
