# 9. Architekturentscheidungen (ADRs)

## ADR-1: QuickJS-WASM als Sandbox

**Kontext**: Pre-/Post-Processing erfordert JavaScript-Ausführung. Sicherheit ist kritisch (Vault-Zugriff, Netzwerk).

**Entscheidung**: QuickJS-Emscripten (WASM) statt `eval()` oder `Function()`.

**Begründung**:
- Vollständige Isolation vom Host-Prozess
- Memory- und Timeout-Limits möglich
- WASM ist mobile-kompatibel
- Trade-off: JSON-Serialisierung für Datenaustausch (leichter Performance-Overhead)

**Status**: Implementiert, 69.26% Coverage.

---

## ADR-2: Markdown als Tool-/Agenten-Format

**Kontext**: Tools und Agenten brauchen ein Definitionsformat. Obsidian-native Formate bevorzugt.

**Entscheidung**: Markdown-Dateien mit YAML Frontmatter.

**Begründung**:
- Native in Obsidian editierbar
- Versionierbar (Git)
- Menschenlesbar
- Bestehende Parser-Infrastruktur nutzbar

**Status**: Implementiert (yaml-parser.ts, agent-parser.ts).

---

## ADR-3: OpenRouter als LLM-Gateway

**Kontext**: Agenten brauchen LLM-Zugriff. Verschiedene Anbieter (OpenAI, Anthropic, etc.) haben unterschiedliche APIs.

**Entscheidung**: OpenRouter als einheitliches Gateway.

**Begründung**:
- Ein API-Endpoint für viele Modelle
- Tool-Calling-Support
- Streaming-Support (SSE)
- Nutzer wählt Modell und zahlt über eigenen API-Key

**Status**: Implementiert (openrouter.ts, orchestrator.ts, chat.ts mit SSE-Streaming und Tool-Calling).

---

## ADR-4: Factory Pattern für Tool-Registry

**Kontext**: Predefined und Custom Tools müssen einheitlich verwaltet werden.

**Entscheidung**: Factory Pattern mit `IToolFactory` Interface.

**Begründung**:
- Entkopplung von Tool-Erstellung und -Verwendung
- Einfache Registrierung neuer Tools
- Kategorisierung (predefined, custom, chain)

**Status**: Implementiert (tool-registry.ts).

---

## ADR-5: Approximatives Token-Counting

**Kontext**: Memory-Management braucht Token-Schätzung. Exakte Tokenizer sind groß und modellspezifisch.

**Entscheidung**: Approximation mit 4 Zeichen ≈ 1 Token.

**Begründung**:
- Keine zusätzliche Dependency
- Akzeptable Genauigkeit für Playground-Zweck
- Leichtgewichtig und schnell

**Status**: Implementiert (conversation.ts).

---

## ADR-6: Markdown-only Conversation-Persistenz

**Kontext**: Conversations müssen nach einem Obsidian-Neustart wiederherstellbar und für Nutzer direkt editierbar sein. Eine frühere Zweischicht-Lösung (JSON + Markdown) führte zu Komplexität bei Konfliktlösung und doppeltem State.

**Entscheidung**: Konversationen werden **ausschließlich als Markdown-Dateien** im konfigurierten Conversations-Ordner gespeichert. Es gibt kein `conversations.json` mehr.

**Begründung**:
- Markdown-Dateien sind die einzige Quelle der Wahrheit (Single Source of Truth)
- Direkt in Obsidian editierbar und versionierbar (Git)
- Bidirektionale Synchronisierung: `vault.on('modify')` erkennt externe Änderungen sofort
- Einfacheres Plugin-Lifecycle (kein Force-Flush bei `onunload`, kein Startup-Merge)

**Konsequenz**:
- `ConversationManager` hat keine JSON-Persistenz mehr (`setPersistence`, `saveToStorage`, `loadFromStorage` entfernt)
- `persistence.ts` verwaltet nur noch `history.json`
- Chat-View liest Conversations-Liste via `ConversationFileManager.listConversationFiles()`

**Status**: Implementiert (conversation-file-manager.ts, chat.ts).

---

**Zurück:** [Querschnittliche Konzepte ←](08-querschnittliche-konzepte.md) | **Weiter:** [Qualitätsanforderungen →](10-qualitaetsanforderungen.md)
