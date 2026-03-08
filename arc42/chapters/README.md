# Paper Agents – Architekturdokumentation

Diese Verzeichnis enthält die vollständige arc42-Architekturdokumentation für das **Paper Agents**-Plugin, aufgeteilt in 12 separate Kapitel.

## 📚 Kapitel-Übersicht

| # | Kapitel | Fokus |
|---|---------|-------|
| 1 | [Einführung und Ziele](01-einfuehrung.md) | Mission, Kernziele, Qualitätsziele |
| 2 | [Randbedingungen](02-randbedingungen.md) | Technische und organisatorische Grenzen |
| 3 | [Kontextabgrenzung](03-kontextabgrenzung.md) | C4 Context Diagram, externe Schnittstellen |
| 4 | [Lösungsstrategie](04-loesungsstrategie.md) | Technologieentscheidungen, Phasen |
| 5 | [Bausteinsicht](05-bausteinsicht.md) | C4 Container Diagram, Layer-Architektur |
| 6 | [Laufzeitsicht](06-laufzeitsicht.md) | Sequenzdiagramme, Interaktionsmuster |
| 7 | [Verteilungssicht](07-verteilungssicht.md) | C4 Deployment Diagram, Release-Prozess |
| 8 | [Querschnittliche Konzepte](08-querschnittliche-konzepte.md) | Security, Patterns, Formate, Lifecycle |
| 9 | [Architekturentscheidungen](09-architekturentscheidungen.md) | **10 ADRs** mit Kontext und Begründung |
| 10 | [Qualitätsanforderungen](10-qualitaetsanforderungen.md) | Qualitätsbaum, Szenarien |
| 11 | [Risiken und Schulden](11-risiken-schulden.md) | Identified Risks, Technical Debt |
| 12 | [Glossar](12-glossar.md) | Fachbegriff-Definitionen |

## 🎯 Schnelleinstieg

**Für Anfänger:**
1. [Einführung und Ziele](01-einfuehrung.md) – verstehen, worum es geht
2. [Kontextabgrenzung](03-kontextabgrenzung.md) – externe Grenzen sehen
3. [Bausteinsicht](05-bausteinsicht.md) – interne Struktur verstehen

**Für Entwickler:**
1. [Bausteinsicht](05-bausteinsicht.md) – Layer verstehen
2. [Querschnittliche Konzepte](08-querschnittliche-konzepte.md) – Patterns und Formate
3. [Architekturentscheidungen](09-architekturentscheidungen.md) – "Warum?" verstehen

**Für Architekten:**
1. [Lösungsstrategie](04-loesungsstrategie.md) – Strategie
2. [Bausteinsicht](05-bausteinsicht.md) – Komponenten
3. [Laufzeitsicht](06-laufzeitsicht.md) – Dynamik
4. [Verteilungssicht](07-verteilungssicht.md) – Infrastruktur
5. [Risiken und Schulden](11-risiken-schulden.md) – Herausforderungen

## 🔍 Nach Thema suchen

### Sicherheit
- [Querschnittliche Konzepte → Sicherheitskonzept](08-querschnittliche-konzepte.md#81-sicherheitskonzept)
- [Risiken und Schulden](11-risiken-schulden.md)

### Tools und Agenten
- [Querschnittliche Konzepte → Tool-Definitions-Format](08-querschnittliche-konzepte.md#82-tool-definitions-format)
- [Querschnittliche Konzepte → Agenten-Definitions-Format](08-querschnittliche-konzepte.md#83-agenten-definitions-format)

### Agent Canvas
- [Bausteinsicht → CanvasAgent und CanvasModal](05-bausteinsicht.md#55-ebene-2--agent-canvas-ui-layer)
- [Laufzeitsicht → Canvas-Workflow](06-laufzeitsicht.md#69-agent-canvas)
- [Querschnittliche Konzepte → Agent Canvas Callout-Format](08-querschnittliche-konzepte.md#810-agent-canvas--callout-format)
- [ADR-9: Callout-Injektion und Konversationsführung](09-architekturentscheidungen.md#adr-9-agent-canvas--callout-injektion-und-konversationsführung)

### Wikilink-Auflösung
- [Bausteinsicht → WikilinkResolver](05-bausteinsicht.md#wikilinkresolvertswikilink-resolverts)
- [Querschnittliche Konzepte → Wikilink-Auflösung](08-querschnittliche-konzepte.md#811-wikilink-auflösung)
- [ADR-10: Wikilink-Auflösung zum Ladezeitpunkt](09-architekturentscheidungen.md#adr-10-wikilink-auflösung-zum-ladezeitpunkt)

### Deployment und Release
- [Verteilungssicht](07-verteilungssicht.md)
- [Lösungsstrategie → Phasenmodell](04-loesungsstrategie.md#phasenmodell)

### Design Patterns
- [Querschnittliche Konzepte → Design Patterns](08-querschnittliche-konzepte.md#84-design-patterns)
- [Architekturentscheidungen](09-architekturentscheidungen.md)

## 📊 Mermaid C4-Diagramme

Diese Dokumentation verwendet **C4-Modellierung** mit Mermaid.js:

- **Context**: [Kontextabgrenzung](03-kontextabgrenzung.md) – Externe Systeme und Schnittstellen
- **Container**: [Bausteinsicht](05-bausteinsicht.md) – Große Komponenten und Abhängigkeiten
- **Deployment**: [Verteilungssicht](07-verteilungssicht.md) – Laufzeit-Infrastruktur

Alle Diagramme sind in Markdown embedded und können direkt in VS Code / Obsidian betrachtet werden.

## 🔗 Verwandte Dokumente

- **[AGENTS.md](../AGENTS.md)** – Developer Guide für AI-Agenten
- **[README.md](../README.md)** – Projekt-Übersicht
- **[Examples/](../examples/)** – Arbeitsbeispiele

## 📝 Konventionen

- **Kapitelnummern**: 01, 02, ..., 12 (arc42 Standard)
- **Dateinamen**: `NN-kapitel-name.md` (Kebab-case)
- **Navigation**: Jedes Kapitel hat Footer-Links zu vorherigem/nächstem Kapitel
- **Cross-Links**: `[Text](../pfad/zum/kapitel.md)` oder `[Text → ](kapitel.md)`

## 📱 Lesbarkeit

- ✅ Optimiert für VS Code Markdown Preview
- ✅ Optimiert für Obsidian (mit relativen Links)
- ✅ GitHub-kompatibel
- ✅ Mermaid C4-Diagramme direkt renderbar

---

**Zurück:** [arc42.md](../arc42.md) | **Start:** [INDEX.md](INDEX.md)
