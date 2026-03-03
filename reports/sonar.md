# SonarQube Issue Tracking

This file documents the SonarQube issues found in the PaperAgents codebase and their resolution status.

## Summary

| Status | Count |
|--------|-------|
| ✅ Fixed | 88 |
| ⏳ Deferred | 12 |
| **Total** | **100** |

---

## Fixed Issues

### S2933 – Mark members as `readonly`
Fields that are assigned only in the constructor are now marked `readonly`.

| File | Lines | Status |
|------|-------|--------|
| `src/core/conversation-file-manager.ts` | 29, 30 | ✅ Fixed |
| `src/core/conversation.ts` | 27 | ✅ Fixed |
| `src/core/history.ts` | 28 | ✅ Fixed |
| `src/core/orchestrator.ts` | 26–29 | ✅ Fixed |
| `src/ui/chat.ts` | 13, 14, 31, 32, 33 | ✅ Fixed |
| `src/ui/history-panel.ts` | 5, 7 | ✅ Fixed |
| `src/ui/output-panel.ts` | 5, 6, 7 | ✅ Fixed |
| `src/ui/sidebar.ts` | 23, 533 | ✅ Fixed |
| `src/ui/template-browser.ts` | 12, 13 | ✅ Fixed |
| `src/ui/workflow-view.ts` | 5 | ✅ Fixed |
| `src/utils/metrics.ts` | 42, 43, 44 | ✅ Fixed |

### S7773 – Prefer `Number.parseInt` / `Number.isNaN` / `Number.parseFloat`
Global `parseInt`, `parseFloat`, and `isNaN` replaced with their `Number.*` equivalents.

| File | Lines | Status |
|------|-------|--------|
| `src/core/openrouter.ts` | 166, 167 | ✅ Fixed |
| `src/parser/validator.ts` | 205 | ✅ Fixed |
| `src/settings.ts` | 128, 129 | ✅ Fixed |

### S7781 – Prefer `String#replaceAll()` over `String#replace()` with `/g` flag
Changed `.replace(/regex/g, ...)` to `.replaceAll(/regex/g, ...)`. Also updated `tsconfig.json` to include `ES2021` lib for full TypeScript support.

| File | Lines | Status |
|------|-------|--------|
| `src/core/conversation-file-manager.ts` | 91 | ✅ Fixed |

### S1128 – Remove unused imports
Removed unused vitest and Obsidian imports from test files.

| File | Lines | Status |
|------|-------|--------|
| `tests/unit/core/conversation-file-manager.spec.ts` | 1 (`vi`) | ✅ Fixed |
| `tests/unit/core/advanced-chain.spec.ts` | 1 (`beforeEach`) | ✅ Fixed |
| `tests/unit/parser/tool-loader.spec.ts` | 1 (`vi`), 2 (`Vault`) | ✅ Fixed |

### S6582 – Prefer optional chain expressions
Replaced `a && a.b` patterns with `a?.b`.

| File | Lines | Status |
|------|-------|--------|
| `src/core/openrouter.ts` | 335 | ✅ Fixed |
| `src/core/conversation.ts` | 377 | ✅ Fixed |
| `src/tools/predefined.ts` | 165 | ✅ Fixed |

### S7750 – Prefer `.find()` over `.filter()[0]`

| File | Lines | Status |
|------|-------|--------|
| `src/commands/index.ts` | 110 | ✅ Fixed |

### S6606 – Prefer `??=` (nullish assignment operator)

| File | Lines | Status |
|------|-------|--------|
| `src/core/history.ts` | 125 | ✅ Fixed |
| `tests/unit/parser/tool-loader.spec.ts` | 175, 196, 214, 232, 251 | ✅ Fixed |

### S4325 – Remove unnecessary type assertion
Used generic `querySelector<T>()` instead of casting the return value.

| File | Lines | Status |
|------|-------|--------|
| `src/ui/chat.ts` | 548 | ✅ Fixed |

### S3735 – Remove `void` operator

| File | Lines | Status |
|------|-------|--------|
| `src/ui/sidebar.ts` | 185 | ✅ Fixed |

### S7761 – Prefer `.dataset` over `setAttribute("data-*", ...)`

| File | Lines | Status |
|------|-------|--------|
| `src/ui/chat.ts` | 535 | ✅ Fixed |

### S7786 – Use `TypeError` instead of generic `Error` for type checks

| File | Lines | Status |
|------|-------|--------|
| `src/core/conversation-file-manager.ts` | 64 | ✅ Fixed |

### S6594 – Use `RegExp.exec()` instead of `String.match()`

| File | Lines | Status |
|------|-------|--------|
| `src/core/conversation.ts` | 332, 376 | ✅ Fixed |

### S6551 – Remove unnecessary `String()` type cast
The `as string | number | ...` casts before `String()` are redundant since `String()` accepts `unknown`.

| File | Lines | Status |
|------|-------|--------|
| `src/parser/placeholder.ts` | 82 | ✅ Fixed |
| `src/ui/forms.ts` | 193, 326 | ✅ Fixed |
| `src/ui/hitl-modal.ts` | 133 | ✅ Fixed |

### S7735 – Fix unexpected negated conditions
Inverted `!condition ? a : b` patterns to the positive form `condition ? b : a`.

| File | Lines | Status |
|------|-------|--------|
| `src/ui/sidebar.ts` | 141, 157, 290 | ✅ Fixed |
| `src/settings.ts` | 220 | ✅ Fixed |

### S6571 – Fix redundant union type
`"url_citation" | string` is redundant since `string` already covers the literal. Changed to just `string`.

| File | Lines | Status |
|------|-------|--------|
| `src/types.ts` | 357 | ✅ Fixed |

### S7778 – Combine multiple `Array#push()` calls
Replaced successive `.push()` calls with a single call accepting multiple arguments.

| File | Lines | Status |
|------|-------|--------|
| `src/core/conversation.ts` | 245–262 | ✅ Fixed |
| `tests/unit/core/orchestrator.spec.ts` | 39–40 | ✅ Fixed |

### S4624 – Avoid nested template literals
Extracted inner template literals into separate variables.

| File | Lines | Status |
|------|-------|--------|
| `src/core/conversation.ts` | 244, 249, 254, 259 | ✅ Fixed |

### S3358 – Extract nested ternary operations

| File | Lines | Status |
|------|-------|--------|
| `src/core/openrouter.ts` | 306 | ✅ Fixed |
| `src/core/orchestrator.ts` | 257 | ✅ Fixed |
| `src/ui/chat.ts` | 467 | ✅ Fixed |
| `src/parser/agent-parser.ts` | 274 | ✅ Fixed |
| `src/parser/validator.ts` | 205, 248 | ✅ Fixed |

### S1854 – Remove useless assignment
Removed an unused `file` variable that was created but never referenced.

| File | Lines | Status |
|------|-------|--------|
| `tests/unit/parser/tool-loader.spec.ts` | 166 | ✅ Fixed |

### S4030 – Fix unused collection
Removed the `callArgs` array that was populated but never used in assertions.

| File | Lines | Status |
|------|-------|--------|
| `tests/unit/core/advanced-chain.spec.ts` | 128 | ✅ Fixed |

### css:S7924 – Fix CSS color contrast
Text colors in API status badges darkened to meet WCAG AA contrast ratio (≥4.5:1).
- Red: `#e74c3c` → `#922b21` (ratio ≈ 7.1:1)
- Green: `#27ae60` → `#1a5c35` (ratio ≈ 6.7:1)

| File | Lines | Status |
|------|-------|--------|
| `styles.css` | 1350, 1356, 1362, 1368 | ✅ Fixed |

### githubactions:S7630 – Prevent script injection from user-controlled inputs
Used environment variable (`INPUT_VERSION`) instead of directly interpolating `${{ inputs.version }}` in run blocks.

| File | Lines | Status |
|------|-------|--------|
| `.github/workflows/release-beta.yml` | 23, 24 | ✅ Fixed |

### S107 – Too many parameters (max 7)
Introduced a `LoopStepContext` parameter object interface. `executeLoopStep` now accepts a single context object instead of 9 individual parameters.

| File | Lines | Status |
|------|-------|--------|
| `src/core/tool-executor.ts` | 448 | ✅ Fixed |

### S3776 – Cognitive Complexity too high (`chat`)
Extracted `performChatRequest` private helper containing the HTTP request, timeout, and response-status logic.
The `chat` method now delegates a single attempt to `performChatRequest` and only contains the slim retry loop,
reducing its cognitive complexity from 18 to below the threshold of 15.

| File | Function | Complexity | Status |
|------|----------|------------|--------|
| `src/core/openrouter.ts` | `chat` | 18 → <15 | ✅ Fixed |

---

## Deferred Issues

These issues require larger refactors and are tracked for future work.

### S3776 – Cognitive Complexity too high
These functions exceed the threshold of 15 and require significant restructuring.

| File | Function | Complexity | Status |
|------|----------|------------|--------|
| `src/core/openrouter.ts:273` | `chatStream` | 56 | ⏳ Deferred |
| `src/core/orchestrator.ts:56` | `continueConversation` | 16 | ⏳ Deferred |
| `src/core/orchestrator.ts:242` | `buildToolDefinitions` | 19 | ⏳ Deferred |
| `src/core/conversation.ts:233` | `toMarkdown` | 28 | ⏳ Deferred |
| `src/core/conversation.ts:278` | `parseMarkdown` | 26 | ⏳ Deferred |
| `src/core/tool-executor.ts:55` | `executeAgent` | 25 | ⏳ Deferred |
| `src/core/tool-executor.ts:400` | `executeStep` | 16 | ⏳ Deferred |
| `src/tools/predefined.ts:141` | `execute` (SearchFilesTool) | 16 | ⏳ Deferred |
| `src/ui/chat.ts:515` | `addToolCallToUI` | 23 | ⏳ Deferred |
