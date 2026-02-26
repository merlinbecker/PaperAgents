# 11. Risiken und technische Schulden

## 11.1 Risiken

| # | Risiko | Wahrscheinlichkeit | Auswirkung | Maßnahme |
|---|--------|---------------------|------------|----------|
| R1 | OpenRouter API-Änderung bricht Integration | Mittel | Hoch | API-Client mit Abstraktionsschicht, Versionierung |
| R2 | QuickJS-Emscripten breaking changes | Niedrig | Hoch | Version pinnen (`^0.31.0`), Tests bei Updates |
| R3 | Obsidian API-Deprecation | Niedrig | Mittel | `minAppVersion` pflegen, API-Changelog verfolgen |
| R4 | Performance-Probleme bei großen Vaults | Mittel | Mittel | Debouncing, Lazy Loading, Profiling |
| R5 | Token-Counting-Ungenauigkeit | Hoch | Niedrig | Akzeptabel für Playground; ggf. tiktoken nachrüsten |

## 11.2 Technische Schulden

| # | Schuld | Priorität | Beschreibung |
|---|--------|-----------|--------------|
| TS1 | Viele `any`-Types | Mittel | 39 `any`-Vorkommnisse in sandbox.ts, tool-executor.ts, conversation.ts → schrittweise durch spezifische Types ersetzen |
| TS2 | Validator-Coverage niedrig | Niedrig | validator.ts nur 62.19% Coverage → Edge Cases testen |
| TS3 | Tool-Loader Branch-Coverage | Niedrig | tool-loader.ts Branch-Coverage nur 45.45% → Error-Pfade testen |
| TS4 | UI-Tests fehlen | Akzeptabel | Sidebar, Forms, HITL-Modal nur manuell getestet (absichtlich, Obsidian-UI-API schwer zu mocken) |
| TS5 | Keine Performance-Tests | Niedrig | Kein Benchmarking für Sandbox-Ausführung oder Vault-Scans |
| TS6 | Keine ADR-Dokumentation formal | Niedrig | Entscheidungen hier in arc42 dokumentiert, kein separates ADR-Verzeichnis |

---

**Zurück:** [Qualitätsanforderungen ←](10-qualitaetsanforderungen.md) | **Weiter:** [Glossar →](12-glossar.md)
