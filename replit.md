# Paper Agents - Obsidian Plugin

## Übersicht
Paper Agents ist ein Obsidian-Plugin, das Entwicklern ermöglicht, **Agenten und Tools in Markdown zu definieren, zu testen und auszuführen**. Das Plugin kombiniert die Einfachheit von Markdown mit der Leistungsfähigkeit von AI-Agenten und Workflow-Automatisierung.

## Projekttyp
**Obsidian Plugin** (kein Webserver) - kompiliert TypeScript zu `main.js`, das von Obsidian geladen wird.

## Tech Stack
- **Sprache**: TypeScript
- **Build**: esbuild (Bundler)
- **Package Manager**: npm
- **Testing**: Vitest (76 Tests, 67% Coverage)
- **Runtime**: Läuft in Obsidian Desktop/Mobile App

## Projektstruktur
```
src/
├── main.ts           # Plugin Entry Point
├── types.ts          # TypeScript Typdefinitionen
├── settings.ts       # Plugin-Einstellungen
├── core/             # Kernlogik (Sandbox, Tool-Executor, Registry)
├── parser/           # YAML-Parsing, Validierung, Tool-Loading
├── ui/               # UI-Komponenten (Sidebar, Modals, Forms)
└── utils/            # Utilities (Constants, Logger)
tests/                # Unit-, Integration- und E2E-Tests
examples/             # Beispiel-Tool-Definitionen
manuals/              # Tool-Notation-Referenz
```

## Entwicklungsbefehle
- `npm run dev` - Development Build mit Watch-Modus
- `npm run build` - Production Build mit Type-Checking
- `npm run test` - Tests mit Coverage ausführen
- `npm run lint` - ESLint ausführen

## Aktueller Status
**Phase 1-3 abgeschlossen:**
- ✅ Tool-Engine mit 4 vordefinierten Tools
- ✅ Custom Tool-Support
- ✅ Pre-/Post-Processing in QuickJS-Sandbox
- ✅ Human-in-the-Loop für kritische Operationen

**Phase 4.1 abgeschlossen:**
- ✅ AgentDefinition, MemoryConfig, Conversation-Typen
- ✅ agent-parser.ts mit 94.49% Coverage
- ✅ 3 Beispiel-Agenten (Research, Writing, API Helper)

**Phase 4.2 abgeschlossen:**
- ✅ ConversationManager mit 97.47% Coverage
- ✅ Token-Counting (approximativ, 4 chars/token)
- ✅ Memory-Management (Truncation, Summary-Placeholder)
- ✅ Round-trip-fähiges Markdown-Format mit ISO 8601 Timestamps

**Phase 4.3 ausstehend:**
- ⏳ OpenRouter-Integration (API-Client)

## Dokumentation
- **[README.md](README.md)** - Hauptdokumentation
- **[PROJEKT_STATUS.md](PROJEKT_STATUS.md)** - Roadmap und nächste Schritte
- **[WEITERARBEIT.md](WEITERARBEIT.md)** - Hinweise zur Weiterarbeit an Phase 4.3
- **[Reports/PhaseAgent.md](Reports/PhaseAgent.md)** - Implementierungsberichte Phase 4.1/4.2
- **[DEVELOPMENT.md](DEVELOPMENT.md)** - Entwickler-Guide
- **[manuals/tools.md](manuals/tools.md)** - Tool-Notation-Referenz

## Letzte Änderungen
- 2026-01-29: Phase 4.2 abgeschlossen (ConversationManager, 146 Tests)
- 2026-01-29: WEITERARBEIT.md erstellt mit Hinweisen zu Phase 4.3
- 2026-01-29: Dokumentation konsolidiert, PROJEKT_STATUS.md aktualisiert
- 2026-01-29: Phase 4.1 implementiert (agent-parser.ts, 3 Beispiel-Agenten)
- 2026-01-29: Initial import nach Replit, Development-Workflow konfiguriert

## Hinweise
- Plugin benötigt Obsidian App zum Testen - kein Browser-Preview möglich
- Der Workflow läuft im Watch-Modus für Hot-Reloading während der Entwicklung
