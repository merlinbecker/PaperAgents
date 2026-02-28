# Changelog

All notable changes to Paper Agents will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.3] - 2026-02-27

### Added

#### Persistence Layer
- **Vault-based persistence** (`src/core/persistence.ts`): New module with generic `createVaultSaver`/`createVaultLoader` functions for JSON persistence under `.obsidian/plugins/paper-agents/`.
- **Conversation persistence**: `ConversationManager` gains `setPersistence()`, `loadFromStorage()`, `saveToStorage()` with debounced auto-save (1s). Max 50 conversations persisted.
- **History persistence**: `ExecutionHistory` auto-saves/loads via vault files (`history.json`).

#### Command Module Extraction
- **`src/commands/index.ts`**: All 7 plugin commands extracted from `main.ts` into dedicated module (open-sidebar, open-chat, reload-custom-tools, reload-agents, show-history, browse-templates, show-workflow).

#### Chat UX Improvements
- **Conversation restoration**: Chat view loads last existing conversation when switching agents (`restoreConversationUI`) instead of always creating a new one.
- **Error classification**: New `addErrorMessage()` in `chat.ts` categorizes errors by type (timeout, rate-limit, auth, network, credits, model-not-found) with user-friendly messages and `pa-chat-message-error` CSS class.

#### Interactive Sidebar Examples
- **`src/ui/sidebar-examples.ts`**: Interactive examples integrated into the sidebar.

#### OpenRouter Rate Limiting & Timeout
- **Proactive rate limiting**: `enforceRateLimit()` in `OpenRouterClient` with RPM tracking (60 req/min window), auto-waits when approaching limit.
- **AbortController-based timeouts**: Both `chat()` (60s) and `chatStream()` (120s) now use active `AbortController` timeouts with proper `clearTimeout` in `finally` block.

#### Test Infrastructure
- **QuickJS mock overhaul** (`tests/mocks/quickjs.ts`): From 20-line stub to 120-line mock with real `Function()`-based code evaluation, `MockContext`, `MockRuntime`, `MockModule` classes.
- **Obsidian mock extended**: Added `TFile.basename`, `Vault.on()`.
- **Validator tests expanded**: `validator.spec.ts` from ~40 to ~330+ lines with type-safe `Parameter[]` fixtures.

### Changed
- **`main.ts` significantly reduced**: ~155 lines of inline commands and helpers extracted to `src/commands/index.ts` and `src/core/persistence.ts`.
- **Type safety**: 38 `Record<string, any>` replaced with `Record<string, unknown>` across 8+ source files for stricter typing.
- **`ToolExecution` interface**: New optional `phase` field (`"preprocess"`, `"tool_execution"`, `"postprocess"`).
- **Settings tab**: Stricter types on `onChange` callbacks.

### Fixed
- **OpenRouter timeout now effective**: `REQUEST_TIMEOUT` was defined but never applied to HTTP requests. Now active via `AbortController` + `setTimeout` with proper cleanup.
- **Stream error handling**: `chatStream()` correctly catches `AbortError` and converts to `OpenRouterError` with `retryable: true` for timeouts.
- **Chat error display**: Generic `Error: ${message}` replaced with categorized, user-friendly error messages.
- **Conversation loss**: Conversations no longer lost on plugin restart (vault persistence).
- **Rate-limit race condition**: Proactive client-side rate limiting prevents unnecessary 429 responses.

## [0.0.2] - 2026-02-27

### Added

#### OpenRouter Integration (Phase 4.3)
- **OpenRouter API Client** (`src/core/openrouter.ts`): SSE streaming, tool-calling protocol (OpenAI-compatible), retry logic with exponential backoff for 429/500/502/503 errors, proactive rate limiting, timeout handling.
- **Settings expansion**: API key (password field + validate button), model selector (dropdown + custom ID), temperature slider (0–2), max tokens input, agents path configuration.
- **Orchestrator** (`src/core/orchestrator.ts`): Multi-turn conversation loop connecting ConversationManager → OpenRouter → ToolExecutor. Supports up to 10 tool-call rounds per message. Full tracing & metrics integration.

#### Chat & UI (Phase 4.3)
- **Agent Chat View** (`src/ui/chat.ts`): Full chat interface with agent dropdown, message list (user/assistant/system roles), token-by-token streaming display, collapsible tool-call blocks, Enter/Shift+Enter keyboard shortcuts.
- **Output Panel** (`src/ui/output-panel.ts`): Structured tool execution results with status, duration, step details, copy-to-clipboard, error details, and execution log.
- **History Panel** (`src/ui/history-panel.ts`): Execution history modal with search, status filter, stats dashboard, export/clear functionality.
- **HITL Modal wiring**: `registerHITLCallbacks()` properly connects `ToolExecutor` to `showHITLModal()` (previously a stub).

#### Agent Loading
- Agent definitions loaded from vault (`agentsPath` setting, default: `paper-agents-agents/`).
- "Reload Agents" command.
- Agents displayed in sidebar with click-to-chat.

#### Advanced Chain Features (Phase 4.4)
- **Conditional steps**: `StepCondition` with 8 operators (eq, neq, gt, lt, gte, lte, contains, exists) + shorthand `equals`.
- **Loop steps**: `StepLoop` with `over` (data source), `as` (iterator variable), `maxIterations` limit.
- **Retry logic**: `StepRetry` with exponential backoff, `retryOn` error pattern matching.
- **`continueOnError`**: Steps can fail without aborting chain; errors stored in `stepOutputs`.

#### Observability (Phase 4.4)
- **Metrics** (`src/utils/metrics.ts`): Execution duration tracking, success rates, p95 calculation, trace IDs with parent-child spans.
- **Execution History** (`src/core/history.ts`): Persistent history (JSON in vault), filter by tool/success/date/search, export to JSON, stats summary.

#### Visual & Template Features (Phase 4.4)
- **Workflow View** (`src/ui/workflow-view.ts`): Read-only visual chain display with connector arrows, badges for condition/loop/retry/continueOnError.
- **Template Browser** (`src/ui/template-browser.ts`): Browse tools & agents as templates, filter by search/type, import from clipboard, export.

### Changed
- `main.ts` expanded with orchestrator initialization, agent loading, history persistence, chat view registration, and new commands (reload agents, show history, browse templates, show workflow).
- Settings tab reorganized into sections: OpenRouter API, Paths, Debug, About.
- 38 `Record<string, any>` types replaced with `Record<string, unknown>` across 8 source files for stricter type safety.

### Fixed
- `REQUEST_TIMEOUT` in `openrouter.ts` now actively applied to HTTP requests (was previously defined but unused).
- Proactive rate limiting added to prevent exceeding OpenRouter RPM limits.

## [0.0.1] - 2026-02-01

### Added
- Initial release with core tool execution framework.
- **Tool Registry**: Registration and lookup of predefined and custom tools.
- **Predefined Tools**: `search_files`, `read_file`, `write_file`, `rest_request`.
- **Custom Tools**: YAML-based tool definitions loaded from vault Markdown files.
- **Chain Execution**: Sequential multi-step tool chains with placeholder replacement.
- **QuickJS Sandbox**: Secure JavaScript execution for pre/post-processing.
- **HITL Modal**: Human-in-the-loop confirmation for destructive operations.
- **Sidebar UI**: Tool browser with categories and click-to-execute.
- **Form UI**: Dynamic parameter forms generated from tool definitions.
- **YAML Parser**: Frontmatter parsing, tool block extraction, validation.
- **Placeholder System**: `{{param}}`, `{{prev_step.output}}`, `{{date}}`, `{{time}}`, `{{random_id}}`.
- **Conversation Manager**: In-memory conversation state, token estimation, memory management.
- **Agent Parser**: Agent definition parsing from Markdown with YAML frontmatter.
- 146 unit and integration tests (75.46% statement coverage).

[0.0.3]: https://github.com/merlinbecker/PaperAgents/compare/0.0.2...0.0.3
[0.0.2]: https://github.com/merlinbecker/PaperAgents/compare/0.0.1...0.0.2
[0.0.1]: https://github.com/merlinbecker/PaperAgents/releases/tag/0.0.1
