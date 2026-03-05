# 11. Risiken und technische Schulden

## 11.1 Risiken

| # | Risiko | Wahrscheinlichkeit | Auswirkung | Status | Maßnahme |
|---|--------|---------------------|------------|--------|----------|
| R1 | OpenRouter API-Änderung bricht Integration | Mittel | Hoch | Mitigiert | API-Client mit Abstraktionsschicht in `openrouter.ts`, Retry-Logik, konfigurierbare Modelle |
| R2 | QuickJS-Emscripten breaking changes | Niedrig | Hoch | Offen | Version pinnen (`^0.31.0`), Tests bei Updates |
| R3 | Obsidian API-Deprecation | Niedrig | Mittel | Offen | `minAppVersion` pflegen, API-Changelog verfolgen |
| R4 | Performance-Probleme bei großen Vaults | Mittel | Mittel | Offen | Debouncing, Lazy Loading, Profiling |
| R5 | Token-Counting-Ungenauigkeit | Hoch | Niedrig | Akzeptiert | Akzeptabel für Playground; ggf. tiktoken nachrüsten |
| R6 | Chat-Konversationen Migrations-Kompatibilität | Niedrig | Niedrig | Offen | Konversationen werden im Vault persistiert; Schema-Änderungen könnten alte Daten unlesbar machen |

## 11.2 Technische Schulden

| # | Schuld | Priorität | Status | Beschreibung |
|---|--------|-----------|--------|--------------|
| TS1 | `any`-Types | Mittel | **Behoben** | 39 `any`-Vorkommnisse in 13 Dateien durch spezifische Types ersetzt. ~5 verbleibende `Record<string, any>` für dynamische User-Parameter (bewusst) |
| TS2 | Validator-Coverage niedrig | Niedrig | Offen | validator.ts nur 62.19% Coverage → Edge Cases testen |
| TS3 | Tool-Loader Branch-Coverage | Niedrig | Offen | tool-loader.ts Branch-Coverage nur 45.45% → Error-Pfade testen |
| TS4 | UI-Tests fehlen | Akzeptabel | Unverändert | Sidebar, Forms, HITL-Modal, Chat nur manuell getestet (Obsidian-UI-API schwer zu mocken) |
| TS5 | Keine Performance-Tests | Niedrig | Offen | Kein Benchmarking für Sandbox-Ausführung oder Vault-Scans |
| TS6 | QuickJS-Dependency nicht aufgelöst | Mittel | Offen | `@jitl/quickjs-singlefile-cjs-release-sync` Import schlägt bei `tsc` fehl. esbuild bundelt korrekt, aber 34 Tests scheitern am Mock |
| TS7 | `main.ts` zu groß | Niedrig | Offen | ~360 Zeilen – Command-Registration und weitere Features könnten in separate Module |
| TS8 | Chat-Konversationen Migrations-Kompatibilität | Niedrig | Offen | Nur Markdown-Persistenz; Schema-Änderungen könnten alte Dateien unlesbar machen |

## 11.3 Behobene Schulden (seit v0.0.1)

| # | Schuld | Lösung |
|---|--------|--------|
| TS1 | 39× `any`-Types | In 13 Dateien durch `unknown`, `Record<string, unknown>`, Union-Types ersetzt |
| TS8 | Zweischichtige Conversation-Persistenz komplex | Vereinfacht: Markdown-only (kein `conversations.json`, kein Startup-Merge) |
| - | HITL-Verdrahtung fehlend | `registerGlobalHITLCallback()` implementiert |
| - | Keine Test-Coverage für neue Features | 32 neue Unit-Tests für OpenRouter, Orchestrator, History, continueOnError, Advanced Chain |
| - | Settings-Änderungen erforderten Neustart | `reinitializeOrchestrator()` wird bei jeder Settings-Änderung aufgerufen |
| - | SonarQube-Qualitätsprobleme (94 Issues) | S2933 (readonly), S7773 (Number.*), S7781 (replaceAll), S6582 (optional chaining), S3776 (cognitive complexity), u.v.m. behoben |
| - | CSS Color Contrast (WCAG AA) | API-Status-Badge-Farben auf ≥4.5:1 Kontrastverhältnis verbessert |
| - | CI Script Injection | GitHub Actions Workflow: `INPUT_VERSION` env-Variable statt direkter `${{ inputs.version }}` Interpolation |

---

**Zurück:** [Qualitätsanforderungen ←](10-qualitaetsanforderungen.md) | **Weiter:** [Glossar →](12-glossar.md)
