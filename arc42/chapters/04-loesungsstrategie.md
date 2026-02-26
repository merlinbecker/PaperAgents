# 4. Lösungsstrategie

| Qualitätsziel | Architekturansatz |
|---------------|-------------------|
| **Sicherheit** | QuickJS-WASM-Sandbox isoliert Pre-/Post-Processing vom Host. HITL-Modal für destruktive Operationen. Code-Validierung blockiert `require`, `eval`, `process`, `global`, `Function`. |
| **Erweiterbarkeit** | Factory Pattern (ToolRegistry) für Tool-Erstellung. Custom Tools als Markdown-Dateien mit automatischer Discovery. Agenten-Notation als Markdown-Format. |
| **Benutzerfreundlichkeit** | Sidebar mit Tool-Übersicht, dynamische Formulare aus Parameter-Definitionen, HITL-Dialoge mit Approve/Reject. |
| **Portabilität** | WASM-basierte Sandbox (kein Node.js nötig). `isDesktopOnly: false` in manifest.json. Keine Desktop-spezifischen APIs. |
| **Wartbarkeit** | Layered Architecture (Parser → Core → UI). TypeScript strict mode. 146 Tests, 75.55% Coverage. Klare Modulgrenzen. |

## Technologieentscheidungen

| Entscheidung | Begründung |
|--------------|------------|
| **TypeScript** | Type Safety, IDE-Support, Obsidian-Ökosystem-Standard |
| **esbuild** | Schnelles Bundling, Obsidian-Sample-Plugin-Standard |
| **QuickJS-Emscripten** | Sichere Sandbox, WASM = Mobile-kompatibel, keine externen Abhängigkeiten |
| **Vitest** | Schnell, TypeScript-nativ, kompatible API zu Jest |
| **OpenRouter** | Einheitliche API für viele LLM-Anbieter, Tool-Calling-Support |

## Phasenmodell

| Phase | Inhalt | Status |
|-------|--------|--------|
| 1 | Plugin-Grundgerüst, Build, Tests | ✅ Abgeschlossen |
| 2 | Tool-Engine (4 Tools, Registry, Executor) | ✅ Abgeschlossen |
| 3 | Sandbox & Security (QuickJS, HITL) | ✅ Abgeschlossen |
| 4.1 | Agenten-Notation (Parser, Typen, Beispiele) | ✅ Abgeschlossen |
| 4.2 | Konversationslogik (ConversationManager) | ✅ Abgeschlossen |
| 4.3 | OpenRouter-Integration (API-Client) | ⏳ Ausstehend |
| 5 | Advanced Features (History, Loops, Visual Editor) | 🔮 Zukunft |

---

**Zurück:** [Kontextabgrenzung ←](03-kontextabgrenzung.md) | **Weiter:** [Bausteinsicht →](05-bausteinsicht.md)
