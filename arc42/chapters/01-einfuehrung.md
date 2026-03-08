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

- **4 vordefinierte Tools + WebSearch**: `search_files`, `read_file`, `write_file`, `rest_request`, `websearch` (OpenRouter-Plugin)
- **Custom Tools**: Eigene Tools als Markdown-Dateien mit YAML Frontmatter
- **Pre-/Post-Processing**: JavaScript-Transformation in QuickJS-Sandbox
- **Chain-Tools**: Multi-Step-Workflows mit Placeholder-Chaining (Conditionals, Loops, Retry)
- **Human-in-the-Loop (HITL)**: Bestätigungspflicht für kritische Operationen
- **Agenten-Notation**: System-Prompts, Tools, Memory, Kontext in Markdown
- **Konversationslogik**: State-Management, Token-Counting, Markdown-Persistenz
- **OpenRouter-Integration**: SSE-Streaming, Tool-Calling, Multi-Turn-Loop
- **Chat-UI**: Konversations-Auswahl aus Markdown-Dateien, Streaming, Quellenangaben
- **Observability**: Execution-History, Metriken (Dauer, Erfolgsrate, p95), Tracing
- **Mobile-kompatibel**: Funktioniert auf Desktop, iOS und Android
- **Agent Canvas**: KI-Annotation von Dokumenten als Obsidian-Callout-Blöcke; Inline-Platzierung, Diff-Ansicht, Multi-Agenten-Modus
- **Wikilink-Auflösung**: `[[Wikilinks]]` in Agenten- und Tool-Definitionen werden beim Laden aufgelöst und eingebettet

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

**Weiter:** [Randbedingungen →](02-randbedingungen.md)
