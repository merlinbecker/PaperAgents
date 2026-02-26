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

**Status**: Geplant (Phase 4.3).

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

**Zurück:** [Querschnittliche Konzepte ←](08-querschnittliche-konzepte.md) | **Weiter:** [Qualitätsanforderungen →](10-qualitaetsanforderungen.md)
