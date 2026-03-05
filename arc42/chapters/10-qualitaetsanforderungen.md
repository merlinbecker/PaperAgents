# 10. Qualitätsanforderungen

## 10.1 Qualitätsbaum

```
Qualität
├── Sicherheit
│   ├── Sandbox-Isolation (QuickJS WASM)
│   ├── HITL für destruktive Operationen
│   ├── Code-Validierung (blockierte Patterns)
│   └── Keine Telemetrie, kein Remote Code
├── Erweiterbarkeit
│   ├── Custom Tools als Markdown-Dateien
│   ├── Factory Pattern (ToolRegistry)
│   └── Agenten-Notation als Markdown
├── Benutzerfreundlichkeit
│   ├── Sidebar mit Tool-Übersicht
│   ├── Dynamische Formulare
│   └── HITL-Bestätigungsdialoge
├── Portabilität
│   ├── Desktop (Windows, macOS, Linux)
│   └── Mobile (iOS, Android) via WASM
└── Wartbarkeit
    ├── TypeScript strict mode
    ├── 283 Tests, >80% Coverage (testbarer Code)
    └── Layered Architecture
```

## 10.2 Qualitätsszenarien

| ID | Qualitätsziel | Szenario | Erwartetes Verhalten |
|----|---------------|----------|---------------------|
| QS-1 | Sicherheit | Nutzer schreibt `require('fs')` in Pre-Processing | Code-Validierung lehnt ab, keine Ausführung |
| QS-2 | Sicherheit | Pre-Processing-Code hat Endlosschleife | Timeout nach 5 s, Fehler wird gemeldet |
| QS-3 | Sicherheit | Tool `write_file` wird ausgeführt | HITL-Modal erscheint, Nutzer muss bestätigen |
| QS-4 | Erweiterbarkeit | Nutzer legt `my_tool.md` in `paper-agents-tools/` | Tool wird bei Reload automatisch erkannt und in Sidebar gelistet |
| QS-5 | Portabilität | Plugin wird auf iOS installiert | QuickJS WASM funktioniert, alle Tools nutzbar |
| QS-6 | Wartbarkeit | Entwickler fügt neues Predefined Tool hinzu | Registrierung in `tool-registry.ts`, Tests hinzufügen, Coverage ≥80% |
| QS-7 | Benutzerfreundlichkeit | Nutzer öffnet Sidebar und klickt Tool | Dynamisches Formular mit Parametern erscheint |

## 10.3 Code Coverage

Coverage wird mit `npm test` (`vitest --coverage`, Provider: V8) gemessen.  
Ausgeschlossen vom Report sind Obsidian-spezifische Infrastruktur-Dateien, die nicht sinnvoll ohne Obsidian-Runtime unit-getestet werden können: `src/main.ts`, `src/settings.ts`, `src/commands/**`, `src/ui/**`.

### Aktuelle Metriken (283 Tests, 23 Dateien)

| Layer | Statements | Branches | Functions | Anmerkung |
|-------|-----------|----------|-----------|-----------|
| **Gesamt (testbarer Code)** | **84.62 %** | **77.44 %** | **82.80 %** | Alle gemessenen Dateien |
| `src/core` | 81.72 % | 73.97 % | 83.87 % | Ausführungs-Engine |
| `src/parser` | 89.47 % | 80.41 % | 95.91 % | Parsing & Validierung |
| `src/tools` | 91.89 % | 82.22 % | 76.00 % | Vordefinierte Tools |
| `src/utils` | 81.81 % | 84.61 % | 56.52 % | Logger, Metrics, Constants |

### Dateien mit niedrigster Coverage (Verbesserungspotenzial)

| Datei | Stmts | Branches | Hinweis |
|-------|-------|----------|---------|
| `src/core/persistence.ts` | 0 % | 0 % | Vault-Persistenz; Mock vorhanden, Tests ausstehend |
| `src/core/orchestrator.ts` | 63.06 % | 70.58 % | Orchestrierung; Tool-Calling-Zweige nicht vollständig abgedeckt |
| `src/core/sandbox.ts` | 68.84 % | 70.27 % | QuickJS-Sandbox; Rand-Fälle und Fehler-Pfade |
| `src/utils/metrics.ts` | 68.34 % | 86.66 % | Tracing-Export-Methoden ohne Tests |

### Teststruktur

```
tests/
  unit/
    core/       # 11 Dateien – Ausführungs-Engine, Konversation, History, OpenRouter
    parser/     # 6 Dateien  – YAML-Parser, Validator, Placeholder, Tool-Loader
  integration/
    e2e/        # 4 Szenarien – Komplette Ausführungspipeline
    loader/     # 1 Datei    – Custom Tool Discovery
    tools/      # 1 Datei    – Vordefinierte Tools (gemocktes Vault)
  mocks/        # Obsidian- und QuickJS-Mocks
```

**Ziel:** ≥ 80 % Statement-Coverage für alle testbaren Layer.

---

**Zurück:** [Architekturentscheidungen ←](09-architekturentscheidungen.md) | **Weiter:** [Risiken und Schulden →](11-risiken-schulden.md)
