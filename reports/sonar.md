# SonarCloud Report – PaperAgents

Generated: 2026-03-05 (updated)

## Quality Gate Status: ❌ FAILED

| Metric | Status | Actual | Threshold |
|---|---|---|---|
| New Reliability Rating | ✅ OK | A | A |
| New Security Rating | ✅ OK | A | A |
| New Maintainability Rating | ✅ OK | A | A |
| New Duplicated Lines Density | ❌ FAIL | 5.0 % | 3 % |
| New Security Hotspots Reviewed | ❌ FAIL | 0 % | 100 % |

**Overall Metrics**

| Metric | Value |
|---|---|
| Lines of Code | 12 666 |
| Code Smells | 103 |
| Bugs | 0 |
| Vulnerabilities | 0 |
| Security Hotspots | 18 |
| Duplicated Lines | 3.2 % |
| Cognitive Complexity | 1 291 |

---

## Issues (Open)

### 🔴 CRITICAL

| Rule | File | Line | Message |
|---|---|---|---|
| S3776 | src/core/openrouter.ts | 242 | Refactor function – Cognitive Complexity 16 > 15 |
| S3776 | src/ui/chat.ts | 516 | Refactor function – Cognitive Complexity 23 > 15 |
| S3776 | src/core/tool-executor.ts | 70 | Refactor function – Cognitive Complexity 25 > 15 |
| S3776 | src/core/tool-executor.ts | 415 | Refactor function – Cognitive Complexity 16 > 15 |
| S3776 | src/core/tool-executor.ts | 549 | Refactor function – Cognitive Complexity 30 > 15 |
| S3776 | src/parser/agent-parser.ts | 77 | Refactor function – Cognitive Complexity 37 > 15 |
| S3776 | src/parser/placeholder.ts | 32 | Refactor function – Cognitive Complexity 20 > 15 |
| S3776 | src/parser/validator.ts | 187 | Refactor function – Cognitive Complexity 44 > 15 |
| S3776 | src/parser/yaml-parser.ts | 60 | Refactor function – Cognitive Complexity 102 > 15 |
| S3776 | src/parser/yaml-parser.ts | 466 | Refactor function – Cognitive Complexity 19 > 15 |

### 🟠 MAJOR

| Rule | File | Line | Message |
|---|---|---|---|
| S2933 | src/core/sandbox.ts | 302 | Member `sandbox` never reassigned – mark as `readonly` |
| S2933 | src/core/tool-executor.ts | 43 | Member `hitlCallbacks` never reassigned – mark as `readonly` |
| S2933 | src/core/tool-registry.ts | 13 | Member `predefinedTools` never reassigned – mark as `readonly` |
| S2933 | src/core/tool-registry.ts | 14 | Member `customTools` never reassigned – mark as `readonly` |
| S2933 | src/core/tool-registry.ts | 15 | Member `executableTools` never reassigned – mark as `readonly` |
| S2933 | src/parser/tool-loader.ts | 13 | Member `app` never reassigned – mark as `readonly` |
| S2933 | src/tools/predefined.ts | 139 | Member `app` never reassigned – mark as `readonly` |
| S2933 | src/tools/predefined.ts | 217 | Member `app` never reassigned – mark as `readonly` |
| S2933 | src/tools/predefined.ts | 266 | Member `app` never reassigned – mark as `readonly` |
| S2933 | src/tools/predefined.ts | 319 | Member `app` never reassigned – mark as `readonly` |
| S2933 | src/ui/forms.ts | 15 | Member `tool` never reassigned – mark as `readonly` |
| S2933 | src/ui/forms.ts | 16 | Member `onSubmit` never reassigned – mark as `readonly` |
| S2933 | src/ui/forms.ts | 271 | Member `container` never reassigned – mark as `readonly` |
| S2933 | src/ui/forms.ts | 272 | Member `tool` never reassigned – mark as `readonly` |
| S2933 | src/ui/forms.ts | 273 | Member `onSubmit` never reassigned – mark as `readonly` |
| S2933 | src/ui/hitl-modal.ts | 14 | Member `decision` never reassigned – mark as `readonly` |
| S2933 | src/ui/hitl-modal.ts | 15 | Member `onDecision` never reassigned – mark as `readonly` |
| S2933 | src/ui/sidebar.ts | 24 | Member `onToolClick` never reassigned – mark as `readonly` |
| S2933 | src/utils/logger.ts | 22 | Member `maxLogs` never reassigned – mark as `readonly` |
| S2933 | tests/mocks/obsidian.ts | 29 | Member `files` never reassigned – mark as `readonly` |
| S2933 | tests/mocks/obsidian.ts | 30 | Member `root` never reassigned – mark as `readonly` |
| S6582 | src/parser/agent-parser.ts | 55 | Use optional chain (`?.`) instead of manual null check |
| S6582 | src/parser/agent-parser.ts | 189 | Use optional chain (`?.`) |
| S6582 | src/parser/agent-parser.ts | 196 | Use optional chain (`?.`) |
| S6582 | src/parser/agent-parser.ts | 199 | Use optional chain (`?.`) |
| S6582 | src/parser/agent-parser.ts | 304 | Use optional chain (`?.`) |
| S6582 | src/parser/agent-parser.ts | 325 | Use optional chain (`?.`) |
| S6582 | src/core/tool-executor.ts | 267 | Use optional chain (`?.`) |
| S6582 | src/core/tool-registry.ts | 156 | Use optional chain (`?.`) |
| S6582 | src/parser/yaml-parser.ts | 46 | Use optional chain (`?.`) |
| S6582 | src/parser/yaml-parser.ts | 190 | Use optional chain (`?.`) |
| S6582 | src/parser/yaml-parser.ts | 419 | Use optional chain (`?.`) |
| S6582 | src/parser/yaml-parser.ts | 477 | Use optional chain (`?.`) |
| S6582 | src/parser/yaml-parser.ts | 503 | Use optional chain (`?.`) |
| S3358 | src/core/sandbox.ts | 146 | Extract nested ternary into independent statement |
| S6661 | src/main.ts | 354 | Use object spread instead of `Object.assign` |
| S4624 | src/parser/yaml-parser.ts | 15 | Refactor nested template literals |
| S6606 | src/parser/validator.ts | 197 | Use `??=` nullish coalescing assignment |
| S6606 | src/ui/sidebar.ts | 235 | Use `??=` nullish coalescing assignment |
| S1854 | tests/unit/core/conversation.spec.ts | 229 | Remove useless assignment to `memoryConfig` |
| css:S7924 | styles.css | 460 | ~~Text contrast requirement not met~~ ✅ fixed |
| css:S7924 | styles.css | 466 | ~~Text contrast requirement not met~~ ✅ fixed |
| css:S7924 | styles.css | 1350 | ~~Text contrast requirement not met~~ ✅ fixed |
| css:S7924 | styles.css | 1356 | ~~Text contrast requirement not met~~ ✅ fixed |
| css:S7924 | styles.css | 1362 | ~~Text contrast requirement not met~~ ✅ fixed |
| css:S7924 | styles.css | 1368 | ~~Text contrast requirement not met~~ ✅ fixed |

### 🟡 MINOR

| Rule | File | Line | Message |
|---|---|---|---|
| S6594 | src/parser/agent-parser.ts | 53, 162, 188, 193, 195, 303 | Use `RegExp.exec()` instead of `.match()` |
| S6594 | src/parser/yaml-parser.ts | 44, 189, 251, 310, 316, 322, 418 (×2), 424, 480, 481, 491 | Use `RegExp.exec()` instead of `.match()` |
| S7773 | src/parser/agent-parser.ts | 174, 175 | Use `Number.parseInt` / `Number.parseFloat` |
| S7773 | src/parser/yaml-parser.ts | 286, 287 | Use `Number.parseInt` / `Number.parseFloat` |
| S7773 | src/parser/validator.ts | 65, 67 | Use `Number.parseFloat` / `Number.isNaN` |
| S7773 | src/ui/forms.ts | 150, 151, 349, 350 | Use `Number.parseFloat` / `Number.isNaN` |
| S7781 | src/parser/agent-parser.ts | 204 | Use `String#replaceAll()` |
| S7781 | src/parser/placeholder.ts | 28 | Use `String#replaceAll()` |
| S6551 | src/parser/placeholder.ts | 82 | `value` may stringify as `[object Object]` |
| S6551 | src/ui/forms.ts | 193, 326 | ~~`value` may stringify as `[object Object]`~~ ✅ fixed |
| S6551 | src/ui/hitl-modal.ts | 133 | `value` may stringify as `[object Object]` |
| S6606 | src/ui/sidebar.ts | 235 | Use `??=` |
| S6353 | src/utils/constants.ts | 101 | Use `\w` instead of `[a-zA-Z0-9_]` |
| S7750 | tests/mocks/obsidian.ts | 24 | Use `.findLast()` over `.filter().pop()` |
| S7754 | tests/mocks/obsidian.ts | 98 | Use `.some()` over `.find()` |
| S7780 | tests/unit/core/sandbox-prepost.spec.ts | 292 | Use `String.raw` to avoid escaping `\` |
| S1128 | tests/integration/e2e/scenario1-single.spec.ts | 2 | Remove unused import of `TFile` |
| S1128 | tests/integration/e2e/scenario4-discovery-exec.spec.ts | 2 | Remove unused import of `TFile` |
| S1128 | tests/integration/loader/tool-loader.int.spec.ts | 2 | Remove unused import of `TFile` |
| S7735 | src/parser/yaml-parser.ts | 452 | Unexpected negated condition |
| javascript:S7772 | create-release.mjs | 3, 4, 5 | ~~Use `node:child_process` / `node:fs` / `node:readline` prefix~~ ✅ fixed |
| javascript:S7772 | esbuild.config.mjs | 2 | ~~Use `node:process` prefix~~ ✅ fixed |
| javascript:S7772 | version-bump.mjs | 1 | ~~Use `node:fs` prefix~~ ✅ fixed |

---

## Security Hotspots (TO_REVIEW)

### ReDoS – Regex vulnerable to super-linear backtracking (S5852)

| File | Line | Regex |
|---|---|---|
| src/core/conversation.ts | 342 | line 342 |
| src/parser/agent-parser.ts | 162 | line 162 |
| src/parser/agent-parser.ts | 188 | line 188 |
| src/parser/agent-parser.ts | 193 | line 193 |
| src/parser/agent-parser.ts | 195 | line 195 |
| src/parser/agent-parser.ts | 204 | line 204 |
| src/parser/yaml-parser.ts | 251 | line 251 |

### Weak PRNG – `Math.random()` (S2245)

| File | Line |
|---|---|
| src/core/conversation.ts | 353 |
| src/core/history.ts | 164 |
| src/core/openrouter.ts | 179 |
| src/core/orchestrator.ts | 176 |
| src/core/sandbox.ts | 108 |
| src/core/tool-executor.ts | 350 |
| src/main.ts | 306 |
| src/parser/placeholder.ts | 115 |
| src/utils/metrics.ts | 36 |

### Dynamic Code Execution (S1523)

| File | Line | Message |
|---|---|---|
| tests/mocks/quickjs.ts | 34 | Make sure dynamic injection is safe |
| tests/mocks/quickjs.ts | 35 | Make sure dynamic injection is safe |

---

## Implementation Plan

### ✅ Done

1. **[S2933] `readonly` class members** – added `readonly` to all 21 never-reassigned members across `src/core/sandbox.ts`, `src/core/tool-executor.ts`, `src/core/tool-registry.ts`, `src/parser/tool-loader.ts`, `src/tools/predefined.ts`, `src/ui/forms.ts`, `src/ui/hitl-modal.ts`, `src/ui/sidebar.ts`, `src/utils/logger.ts`, `tests/mocks/obsidian.ts`
2. **[S7773] `Number.*` globals** – replaced all occurrences of `parseInt`/`parseFloat`/`isNaN` with `Number.parseInt`/`Number.parseFloat`/`Number.isNaN` in `src/parser/agent-parser.ts`, `src/parser/yaml-parser.ts`, `src/parser/validator.ts`, `src/ui/forms.ts`
3. **[S7781] `String#replaceAll()`** – replaced `.replace(regex_with_g, …)` with `.replaceAll(…)` in `src/parser/agent-parser.ts`, `src/parser/placeholder.ts`
4. **[S6661] Object spread** – replaced `Object.assign({}, …)` with `{ ...x }` spread in `src/main.ts`
5. **[S6606] `??=` nullish coalescing assignment** – in `src/parser/validator.ts` and `src/ui/sidebar.ts`
6. **[S6353] `\w` shorthand** – replaced `[a-zA-Z0-9_]` with `\w` in `src/utils/constants.ts`
7. **[S1128] Unused imports** – removed unused `TFile` import from three integration test files; removed unused `MemoryConfig` import from `tests/unit/core/conversation.spec.ts`
8. **[S7750] `.findLast()`** – replaced `.filter(Boolean).pop()` with `.findLast(Boolean)` in `tests/mocks/obsidian.ts`
9. **[S7754] `.some()`** – replaced `.find(…)` boolean check with `.some(…)` in `tests/mocks/obsidian.ts`
10. **[S1854] Useless assignment** – removed unused `memoryConfig` const from `tests/unit/core/conversation.spec.ts`
11. **[javascript:S7772] `node:` protocol** – updated imports in `create-release.mjs`
12. **[S6582] Use optional chain expressions** – replaced all manual null-guard patterns (`obj && obj.prop`, `!obj || !obj.prop`) with `obj?.prop` optional chain in `src/parser/agent-parser.ts` (6 occurrences), `src/parser/yaml-parser.ts` (5 occurrences), `src/core/tool-executor.ts` (1 occurrence), `src/core/tool-registry.ts` (1 occurrence)
13. **[S6594] Use `RegExp.exec()`** – replaced all `.match()` calls with `RegExp.exec()` (or `.test()` where only a boolean result is needed) across `src/parser/agent-parser.ts` (5 occurrences) and `src/parser/yaml-parser.ts` (12 occurrences); also replaced `||` fallback chains with `??` for exec calls
14. **[S3358] Extract nested ternary** – replaced nested ternary in `src/core/sandbox.ts` with independent `if/else if/else` statements
15. **[S4624] Refactor nested template literal** – extracted `snippetSuffix` variable in `YAMLParseError` constructor in `src/parser/yaml-parser.ts`
16. **[S7735] Unexpected negated condition** – simplified tautological ternary `p.default !== undefined ? p.default : undefined` to `p.default` in `src/parser/yaml-parser.ts`
17. **[S6551] Object `[object Object]` stringification** – fixed `input.value = String(param.default)` in `src/ui/forms.ts` to use `JSON.stringify` for object values; refactored ternary at line 326–328 to `if/else` so SonarCloud recognizes the type guard
18. **[S7780] Use `String.raw`** – replaced double-escaped string in `tests/unit/core/sandbox-prepost.spec.ts` with `String.raw` template literal
19. **[css:S7924] CSS text contrast** – fixed all 6 contrast violations in `styles.css`: darkened `.pa-btn-reject:hover` background (`#e74c3c` → `#c0392b`, 5.4:1), `.pa-btn-approve` background (`#27ae60` → `#1a7a3c`, 5.4:1) and hover (`#229954` → `#156030`); changed API status badge text from hardcoded dark colours to `var(--text-normal)` (`.pa-api-status-missing/set/valid/invalid`)
20. **[javascript:S7772] `node:` protocol** – added missing `node:` prefix to `readline` in `create-release.mjs`; `process` in `esbuild.config.mjs`; `fs` in `version-bump.mjs`

### 🔜 Next Steps (ordered by effort / impact)

1. **[S3776] Reduce Cognitive Complexity** – large refactors in 10 functions, highest effort
2. **Security Hotspots (S5852/S2245/S1523)** – review and decide safe/fix per hotspot
