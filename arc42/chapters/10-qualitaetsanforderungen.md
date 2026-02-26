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
    ├── 146 Tests, 75.55% Coverage
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

---

**Zurück:** [Architekturentscheidungen ←](09-architekturentscheidungen.md) | **Weiter:** [Risiken und Schulden →](11-risiken-schulden.md)
