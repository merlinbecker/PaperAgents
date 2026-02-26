# 2. Randbedingungen

## Technische Randbedingungen

| Randbedingung | Beschreibung |
|---------------|--------------|
| **Obsidian-Plugin-API** | Das Plugin muss die Obsidian-Plugin-API verwenden und als `main.js` + `manifest.json` ausgeliefert werden |
| **Kein Node.js auf Mobile** | Mobile-Kompatibilität erfordert WASM-basierte Sandbox (kein `require`, `eval`, `process`) |
| **Bundle in eine Datei** | esbuild bundelt alles nach `main.js` (CommonJS, ES2018). Externe Dependencies: nur `obsidian` |
| **TypeScript strict** | `noImplicitAny`, `strictNullChecks`, `noImplicitReturns` aktiviert |
| **QuickJS-Emscripten** | WASM-Sandbox für sichere JavaScript-Ausführung (Memory-Limit: 10 MB, Timeout: 5 s) |
| **OpenRouter API** | LLM-Zugriff erfolgt ausschließlich über OpenRouter (Phase 4.3, noch nicht implementiert) |

## Organisatorische Randbedingungen

| Randbedingung | Beschreibung |
|---------------|--------------|
| **Lizenz** | MIT |
| **Versionierung** | Semantic Versioning (x.y.z), aktuell 0.0.1 |
| **Paketmanager** | npm |
| **CI/CD** | GitHub Actions für Releases, BRAT für Beta-Distribution |
| **Keine Telemetrie** | Kein Tracking, keine Analytics, keine versteckten Netzwerkzugriffe |
| **Vault-Scope** | Das Plugin liest/schreibt nur innerhalb des Obsidian-Vaults |

## Konventionen

| Konvention | Details |
|------------|---------|
| Dateinamen | `kebab-case.ts` |
| Klassen | `PascalCase` |
| Funktionen | `camelCase` |
| Konstanten | `UPPER_SNAKE_CASE` |
| Commits | Konventionelle Commit-Messages |
| Command-IDs | Stabil, nie umbenennen nach Release |

---

**Zurück:** [Einführung ←](01-einfuehrung.md) | **Weiter:** [Kontextabgrenzung →](03-kontextabgrenzung.md)
