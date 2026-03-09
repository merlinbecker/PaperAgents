# Code Duplication Report

**Date:** 2026-03-09  
**Source:** SonarQube project `merlinbecker_PaperAgents`  
**Overall duplication density (before):** 2.7 % (738 duplicated lines in 30 blocks)

---

## Findings

Five files were identified by SonarQube as containing significant code duplication:

| File | Duplicated lines | Density | Blocks |
|---|---|---|---|
| `src/ui/sidebar-examples.ts` | 297 | 64.3 % | 2 |
| `tests/unit/core/executor-prepost.spec.ts` | 260 | 56.0 % | 10 |
| `tests/unit/parser/tool-loader.spec.ts` | 82 | 30.6 % | 14 |
| `tests/unit/core/advanced-chain.spec.ts` | 48 | 29.8 % | 2 |
| `tests/unit/core/sandbox-prepost.spec.ts` | 51 | 13.9 % | 2 |

---

## Root Causes

### `src/ui/sidebar-examples.ts`
The file defined eight `SidebarExample` data objects, each containing large inline template-literal strings with YAML frontmatter. All tool examples repeated the same frontmatter key sequence (`tool: true`, `id:`, `name:`, `type:`, `parameters:`, `description:`). All agent examples repeated an identical structure (`agent: true`, `id:`, `name:`, `description:`, `model:`, `tools:`, `memory:`, `temperature:`). The `#### **Tool-Ausführung**`, `#### **Pre-Processing**`, and `#### **Post-Processing**` section patterns were also duplicated across multiple content strings.

### `tests/unit/core/executor-prepost.spec.ts`
Every test in the file constructed an `Agent` object inline using the same boilerplate:
```typescript
const agent: Agent = {
  id: "test_agent",
  name: "Test Agent",
  type: "single",
  parameters: [{ name: "text", type: "string", required: true }],
  toolDefinition: { toolId: "echo_tool", parameters: { text: "{{text}}" } },
};
```
This pattern was copy-pasted across all 12 test cases, differing only in optional `preprocess`/`postprocess` fields and the parameter name.

### `tests/unit/parser/tool-loader.spec.ts`
The `isToolFile` describe block contained five tests that each independently set up the same vault-event mocking boilerplate (6 lines each, 30 lines total repeated):
```typescript
const calls: Array<{ id: string; action: string }> = [];
const vaultEvents: Record<string, Array<(file: any) => void>> = {};
(mockApp.vault as any).on = (event: string, cb: (file: any) => void) => {
  vaultEvents[event] ??= [];
  vaultEvents[event].push(cb);
};
loader.onToolFileChanged((toolId, action) => { calls.push({ id: toolId, action }); });
```

### `tests/unit/core/advanced-chain.spec.ts`
The two tests inside `describe("conditional steps")` defined an identical `Agent` object. The only difference between the tests was the mock tool return value and the assertions.

### `tests/unit/core/sandbox-prepost.spec.ts`
The `Code Validation` describe block contained six tests that all followed the same three-line pattern:
```typescript
const validation = sandbox.validateCode(code);
expect(validation.valid).toBe(false);
expect(validation.errors.some((e) => e.includes("…"))).toBe(true);
```

---

## Changes Made

### `src/ui/sidebar-examples.ts`
Introduced five private helper functions to generate the repeated string patterns programmatically:

| Helper | Purpose |
|---|---|
| `buildToolFrontmatter(id, name, type, parameters, description, extra?)` | Generates the YAML frontmatter block for tool definitions |
| `buildAgentFrontmatter(id, name, description, model, tools, maxMessages, temperature)` | Generates the YAML frontmatter block for agent definitions |
| `buildToolExecutionBlock(toolId, parametersYaml)` | Generates the `#### **Tool-Ausführung**` section |
| `buildPreprocessBlock(code)` | Generates the `#### **Pre-Processing**` section |
| `buildPostprocessBlock(code)` | Generates the `#### **Post-Processing**` section |

Each `SidebarExample.content` string now calls these helpers instead of repeating the YAML/JavaScript boilerplate inline. The produced content strings are character-for-character identical to the originals.

### `tests/unit/core/executor-prepost.spec.ts`
Added a `makeAgent(overrides?)` factory function at the top of the `describe` block. The factory creates a fully-typed `Agent` with sensible defaults (`id`, `name`, `type`, `parameters`, `toolDefinition`) and merges any `overrides`. All 12 tests now call `makeAgent({ preprocess: "…", postprocess: "…" })` instead of repeating the full object literal.

### `tests/unit/parser/tool-loader.spec.ts`
Extracted the vault-event setup boilerplate into a `setupVaultEvents(app, loader)` helper function defined once inside the `isToolFile` describe block. All five tests now call this single helper and receive `{ calls, vaultEvents }`.

### `tests/unit/core/advanced-chain.spec.ts`
Moved the shared `Agent` constant (`conditionalAgent`) to the top of the `describe("conditional steps")` block so both tests reference it instead of each defining their own copy.

### `tests/unit/core/sandbox-prepost.spec.ts`
Added an `expectBlocked(code, pattern)` helper inside `describe("Code Validation")`. The helper runs `validateCode` and asserts `valid === false` and that the error message contains `pattern`. The six blocked-keyword tests are now each a single line.

---

## Verification

All **387 tests** continue to pass after the refactoring:

```
Test Files  25 passed (25)
     Tests  387 passed (387)
```

No TypeScript compilation errors were introduced in any of the changed files.
