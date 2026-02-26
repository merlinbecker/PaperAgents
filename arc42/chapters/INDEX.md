# Paper Agents – Architekturdokumentation (arc42)

**Version**: 0.0.1  
**Autor**: Merlin Becker  
**Datum**: 26. Februar 2026

> Basiert auf dem arc42-Template v9.0-DE.  
> arc42 © Dr. Peter Hruschka, Dr. Gernot Starke – https://arc42.org

---

## Übersicht

Diese Dokumentation beschreibt die Architektur von **Paper Agents**, einem Obsidian-Community-Plugin, das Entwicklern ermöglicht, Agenten und Tools in Markdown zu definieren, zu testen und auszuführen.

### Kapitel

1. **[Einführung und Ziele](01-einfuehrung.md)**
   - Aufgabenstellung und Kernziele
   - Funktionsübersicht
   - Qualitätsziele und Stakeholder

2. **[Randbedingungen](02-randbedingungen.md)**
   - Technische Randbedingungen
   - Organisatorische Randbedingungen
   - Konventionen

3. **[Kontextabgrenzung](03-kontextabgrenzung.md)**
   - Fachlicher Kontext (C4 Context Diagram)
   - Schnittstellen
   - Technischer Kontext

4. **[Lösungsstrategie](04-loesungsstrategie.md)**
   - Architekturansätze für Qualitätsziele
   - Technologieentscheidungen
   - Phasenmodell

5. **[Bausteinsicht](05-bausteinsicht.md)**
   - Whitebox Gesamtsystem (C4 Container Diagram)
   - Core Execution Layer
   - Parser & Validation Layer
   - Tools Layer (Predefined Tools)

6. **[Laufzeitsicht](06-laufzeitsicht.md)**
   - Single-Tool-Ausführung
   - Chain-Tool-Ausführung
   - HITL-Bestätigung
   - Agenten-Konversation

7. **[Verteilungssicht](07-verteilungssicht.md)**
   - Deployment-Architektur (C4 Deployment Diagram)
   - Deployment-Artefakte
   - Installationswege
   - Release-Prozess

8. **[Querschnittliche Konzepte](08-querschnittliche-konzepte.md)**
   - Sicherheitskonzept (Sandbox, HITL, Datenschutz)
   - Tool-Definitions-Format
   - Agenten-Definitions-Format
   - Design Patterns
   - Logging und Error-Handling
   - Plugin-Lifecycle

9. **[Architekturentscheidungen](09-architekturentscheidungen.md)**
   - ADR-1: QuickJS-WASM als Sandbox
   - ADR-2: Markdown als Tool-/Agenten-Format
   - ADR-3: OpenRouter als LLM-Gateway
   - ADR-4: Factory Pattern für Tool-Registry
   - ADR-5: Approximatives Token-Counting

10. **[Qualitätsanforderungen](10-qualitaetsanforderungen.md)**
    - Qualitätsbaum
    - Qualitätsszenarien

11. **[Risiken und technische Schulden](11-risiken-schulden.md)**
    - Risiken und Maßnahmen
    - Technische Schulden

12. **[Glossar](12-glossar.md)**
    - Definitionen aller Fachbegriffe

---

## Schnelleinstieg für Entwickler

### Projektstruktur

```
src/
  main.ts                 # Plugin-Einstiegspunkt
  settings.ts            # Einstellungen und Defaults
  types.ts               # TypeScript-Typen
  core/                  # Ausführungs-Engine
    conversation.ts      # Konversations-Management
    sandbox.ts           # QuickJS WASM Sandbox
    tool-executor.ts     # Tool-Ausführung (3-Phasen)
    tool-registry.ts     # Tool-Registrierung (Factory Pattern)
  parser/                # Parsing und Validierung
    agent-parser.ts      # Agent-Definition Parsing
    placeholder.ts       # Placeholder-Auflösung
    tool-loader.ts       # Custom Tool Discovery
    validator.ts         # Parameter-Validierung
    yaml-parser.ts       # YAML Frontmatter Parsing
  tools/
    predefined.ts        # 4 vordefinierte Tools
  ui/                    # Benutzeroberfläche
    hitl-modal.ts        # Human-in-the-Loop Dialog
    sidebar.ts           # Sidebar View
    forms.ts             # Dynamische Formulare
  utils/
    constants.ts         # Konstanten
    logger.ts            # Logging
```

### Wichtigste Konzepte

- **Sandbox**: QuickJS-WASM für sichere JavaScript-Ausführung
- **HITL**: Human-in-the-Loop für destruktive Operationen
- **Tool-Registry**: Factory Pattern für einheitliche Tool-Verwaltung
- **Markdown-native Definition**: Tools und Agenten als Markdown mit YAML Frontmatter
- **3-Phasen-Pipeline**: Pre-Processing → Tool-Ausführung → Post-Processing

### Links

- [GitHub Repository](https://github.com/merlinbecker/PaperAgents)
- [Obsidian Plugin Docs](https://docs.obsidian.md)
- [AGENTS.md Developer Guide](../AGENTS.md)
- [Beispiel-Tools und Agenten](../examples/)

---

**Version**: 0.0.1 | **Lizenz**: MIT | **Autor**: Merlin Becker
