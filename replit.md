# Paper Agents - Obsidian Plugin

## Übersicht
Paper Agents ist ein Obsidian-Plugin, das Entwicklern ermöglicht, **Agenten und Tools in Markdown zu definieren, zu testen und auszuführen**. Das Plugin kombiniert die Einfachheit von Markdown mit der Leistungsfähigkeit von AI-Agenten und Workflow-Automatisierung.

## Projekttyp
**Obsidian Plugin** (kein Webserver) - kompiliert TypeScript zu `main.js`, das von Obsidian geladen wird.

## Tech Stack
- **Sprache**: TypeScript (strict mode)
- **Build**: esbuild (Bundler)
- **Package Manager**: npm
- **Testing**: Vitest (146 Tests, ~75% Coverage)
- **Sandbox**: QuickJS-Emscripten (WASM)
- **Runtime**: Läuft in Obsidian Desktop/Mobile App

## Projektstruktur
```
src/
├── main.ts           # Plugin Entry Point (272 Zeilen)
├── types.ts          # TypeScript Typdefinitionen (279 Zeilen)
├── settings.ts       # Plugin-Einstellungen (71 Zeilen)
├── core/             # Kernlogik
│   ├── sandbox.ts         # QuickJS WASM Sandbox (397 Zeilen)
│   ├── tool-executor.ts   # 3-Phasen-Execution (503 Zeilen)
│   ├── tool-registry.ts   # Factory Pattern Tool-Verwaltung (252 Zeilen)
│   └── conversation.ts    # Konversations-State-Management (356 Zeilen)
├── parser/           # YAML-Parsing, Validierung, Tool-Loading
│   ├── yaml-parser.ts     # YAML Frontmatter-Parsing (511 Zeilen)
│   ├── agent-parser.ts    # Agenten-Notation-Parsing (309 Zeilen)
│   ├── validator.ts       # Parameter-Validierung (283 Zeilen)
│   ├── placeholder.ts     # Platzhalter-Ersetzung (126 Zeilen)
│   └── tool-loader.ts     # Custom Tool Discovery (195 Zeilen)
├── tools/
│   └── predefined.ts      # 4 vordefinierte Tools (392 Zeilen)
├── ui/               # UI-Komponenten
│   ├── sidebar.ts         # Sidebar View (260 Zeilen)
│   ├── forms.ts           # Dynamische Formulare (375 Zeilen)
│   └── hitl-modal.ts      # HITL-Modal (287 Zeilen)
└── utils/            # Utilities
    ├── constants.ts       # Konstanten (107 Zeilen)
    └── logger.ts          # Logger (134 Zeilen)
tests/                # Unit-, Integration- und E2E-Tests
examples/             # Beispiel-Tool- und Agenten-Definitionen
manuals/              # Tool-Notation-Referenz
arc42/                # Architekturdokumentation (12 Kapitel)
```

## Entwicklungsbefehle
- `npm run dev` - Development Build mit Watch-Modus
- `npm run build` - Production Build mit Type-Checking
- `npm run test` - Tests mit Coverage ausführen
- `npm run test:watch` - Tests im Watch-Modus
- `npm run lint` - ESLint ausführen
- `npm run release` - Release erstellen
- `npm run release:beta` - Beta-Release erstellen

## Aktueller Status
**Phase 1-3 abgeschlossen:**
- ✅ Tool-Engine mit 4 vordefinierten Tools (search_files, read_file, write_file, rest_request)
- ✅ Custom Tool-Support mit automatischer Discovery
- ✅ Pre-/Post-Processing in QuickJS-WASM-Sandbox (10 MB Memory, 5 s Timeout)
- ✅ Human-in-the-Loop für kritische Operationen (write_file immer, rest_request bei POST/PUT/DELETE)

**Phase 4.1 abgeschlossen:**
- ✅ AgentDefinition, MemoryConfig, Conversation-Typen in types.ts
- ✅ agent-parser.ts mit 94.49% Coverage
- ✅ 3 Beispiel-Agenten (Research Assistant, Writing Helper, API Helper)

**Phase 4.2 abgeschlossen:**
- ✅ ConversationManager mit 97.47% Coverage
- ✅ Token-Counting (approximativ, 4 chars/token)
- ✅ Memory-Management (Truncation, Summary-Placeholder)
- ✅ Round-trip-fähiges Markdown-Format mit ISO 8601 Timestamps

**Phase 4.3 ausstehend:**
- ⏳ OpenRouter-Integration (API-Client, Streaming, Tool-Calling)

## Dokumentation
- **[README.md](README.md)** - Hauptdokumentation, Features, Schnellstart
- **[AGENTS.md](AGENTS.md)** - Richtlinien für AI-Agenten am Code
- **[arc42/chapters/INDEX.md](arc42/chapters/INDEX.md)** - Architekturdokumentation (12 Kapitel)
- **[manuals/tools.md](manuals/tools.md)** - Tool-Notation-Referenz
- **[examples/](examples/)** - Beispiel-Tools und Agenten
- **[RELEASE.md](RELEASE.md)** - Release-Prozess

## Letzte Änderungen
- 2026-02-26: arc42-Dokumentation in 12 Kapitel aufgeteilt, Mermaid C4-Diagramme
- 2026-01-29: Phase 4.2 abgeschlossen (ConversationManager, 146 Tests)
- 2026-01-29: Phase 4.1 implementiert (agent-parser.ts, 3 Beispiel-Agenten)

## Hinweise
- Plugin benötigt Obsidian App zum Testen - kein Browser-Preview möglich
- Der `npm run dev` Watch-Modus ermöglicht Hot-Reloading während der Entwicklung
- Plugin-ID: `paperAgents` (camelCase, wie in manifest.json)
