# Paper Agents - Obsidian Plugin

## Overview
Paper Agents is an Obsidian plugin that enables users to **define, test, and execute AI agent workflows in Markdown**. The plugin combines the simplicity of Markdown with the power of AI agents and workflow automation.

## Project Type
**Obsidian Plugin** (no web server) - compiles TypeScript to `main.js`, loaded by Obsidian.

## Tech Stack
- **Language**: TypeScript (strict mode)
- **Build**: esbuild (Bundler)
- **Package Manager**: npm
- **Testing**: Vitest (178 Tests)
- **Sandbox**: QuickJS-Emscripten (WASM)
- **LLM**: OpenRouter API (streaming, tool-calling)
- **Runtime**: Runs inside Obsidian Desktop/Mobile App

## Project Structure
```
src/
├── main.ts                # Plugin Entry Point
├── types.ts               # TypeScript type definitions
├── settings.ts            # Plugin settings (API key, model, temperature, etc.)
├── core/                  # Core logic
│   ├── sandbox.ts         # QuickJS WASM Sandbox
│   ├── tool-executor.ts   # 3-phase execution + advanced chain features
│   ├── tool-registry.ts   # Factory Pattern tool management
│   ├── conversation.ts    # Conversation state management
│   ├── openrouter.ts      # OpenRouter API client (SSE streaming, tool-calling, retry)
│   ├── orchestrator.ts    # LLM orchestration loop (message → API → tool calls → feed back)
│   └── history.ts         # Persistent execution history store
├── parser/                # YAML parsing, validation, tool loading
│   ├── yaml-parser.ts     # YAML frontmatter parsing
│   ├── agent-parser.ts    # Agent notation parsing
│   ├── validator.ts       # Parameter validation
│   ├── placeholder.ts     # Placeholder replacement
│   └── tool-loader.ts     # Custom tool discovery
├── tools/
│   └── predefined.ts      # 4 predefined tools
├── ui/                    # UI components
│   ├── sidebar.ts         # Sidebar View
│   ├── forms.ts           # Dynamic forms
│   ├── hitl-modal.ts      # HITL (Human-in-the-Loop) Modal
│   ├── chat.ts            # Chat/Conversation View (streaming, agent selection)
│   ├── output-panel.ts    # Tool execution output panel
│   ├── history-panel.ts   # Execution history viewer (filter/search/export)
│   ├── template-browser.ts # Template import/export browser
│   └── workflow-view.ts   # Visual workflow/chain viewer
└── utils/                 # Utilities
    ├── constants.ts       # Constants
    ├── logger.ts          # Logger
    └── metrics.ts         # Execution metrics + tracing (p95, trace IDs)
tests/                     # Unit, integration, and E2E tests
examples/                  # Example tool and agent definitions
manuals/                   # Tool notation reference
arc42/                     # Architecture documentation (12 chapters)
```

## Development Commands
- `npm run dev` - Development build with watch mode
- `npm run build` - Production build with type-checking
- `npm run test` - Tests with coverage
- `npm run test:watch` - Tests in watch mode
- `npm run lint` - ESLint
- `npm run release` - Create release
- `npm run release:beta` - Create beta release

## Current Status
**All phases implemented:**
- Tool Engine with 4 predefined tools (search_files, read_file, write_file, rest_request)
- Custom Tool support with automatic discovery
- Pre-/Post-Processing in QuickJS WASM Sandbox
- Human-in-the-Loop for critical operations
- AgentDefinition, MemoryConfig, Conversation types
- ConversationManager with token counting and memory management
- OpenRouter API client (SSE streaming, tool-calling, retry logic, model listing)
- Orchestrator: multi-turn LLM loop with tool execution
- Chat UI with streaming display, agent selection
- Execution history with persistence, filtering, export
- Output panel with structured results, copy-to-clipboard
- Advanced chain features: conditional steps, loops, retry with backoff
- continueOnError for chain steps
- Observability: execution metrics, tracing with trace IDs
- Template browser for import/export
- Visual workflow viewer for chain debugging
- Technical debt: most `any` types replaced with proper types
- Settings: API key, model, temperature, maxTokens, agentsPath

## Key Architecture
- **Orchestrator** (`src/core/orchestrator.ts`): Main loop connecting ConversationManager + OpenRouterClient + ToolRegistry
- **OpenRouter Client** (`src/core/openrouter.ts`): SSE streaming, tool-calling protocol, retry on 429/500/503
- **History**: Persisted at `.obsidian/plugins/paper-agents/history.json` in vault
- **Metrics**: `src/utils/metrics.ts` integrated into tool-executor and orchestrator via `globalMetrics`
- **Advanced Chain**: `Step` type has `condition?: StepCondition`, `loop?: StepLoop`, `retry?: StepRetry`
- **Settings validation**: Tests API key via OpenRouter `/api/v1/models` endpoint

## Notes
- Plugin requires Obsidian App to test - no browser preview available
- `npm run dev` watch mode enables hot-reloading during development
- Plugin ID: `paperAgents` (camelCase, as in manifest.json)
- Pre-existing build warning: `@jitl/quickjs-singlefile-cjs-release-sync` module not resolved (external dep)
