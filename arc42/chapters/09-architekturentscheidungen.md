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

## ADR-7: Terminierungsstrategien im Agentic Loop

**Kontext**: Der Agentic Loop muss erkennen, wann die gestellte Aufgabe abgeschlossen ist. Verschiedene LLM-Modelle und Aufgabentypen erfordern unterschiedliche Erkennungsmethoden.

**Entscheidung**: Drei austauschbare Strategien über `terminationCheck`-Konfiguration: `auto` (LLM schreibt `[DONE]`), `phrase` (benutzerdefinierte Stopp-Phrase), `tool` (expliziter `finish_task`-Call).

**Begründung**:
- `auto` ist einfach zu konfigurieren und funktioniert mit allen Modellen, ist aber anfällig für Halluzinationen
- `phrase` bietet mehr Kontrolle mit minimalem Overhead
- `tool` ist die robusteste Methode, da das LLM explizit handeln muss; empfohlen für produktive Agenten
- Alle drei Strategien sind in `checkLoopTermination()` zusammengefasst und über ein einziges Konfigurationsfeld austauschbar

**Status**: Implementiert (orchestrator.ts, predefined.ts – finish_task-Tool).

---

## ADR-8: OpenRouter `transforms: ["middle-out"]` für Context-Window-Management

**Kontext**: Bei langen Agentic Loops mit vielen Tool-Calls wächst die Conversation-History schnell. Sobald sie das Context-Window des Modells überschreitet, bricht der API-Call ab. Exaktes Token-Counting ist modellspezifisch und aufwändig.

**Entscheidung**: OpenRouter `transforms: ["middle-out"]` wird automatisch für alle Agentic-Loop-Requests aktiviert. Normale Chat-Requests bleiben unverändert.

**Begründung**:
- Serverseitige Lösung: keine Änderung der lokalen Token-Counting-Logik nötig
- OpenRouter entfernt Nachrichten aus der Mitte der History (System-Prompt + Anfang + neuestes Ende bleiben erhalten)
- Löst auch Modell-spezifische Nachrichten-Limits (z.B. Claudes max. 1.000 Messages)
- `augmentAgentForLoop()` setzt `transforms` auf dem augmentierten Agenten → nur Agentic-Loop-Requests sind betroffen

**Konsequenz**: Informationsverlust bei sehr langen Loops möglich. Für kritische Zwischenschritte sollte `write_file` genutzt werden.

**Status**: Implementiert (orchestrator.ts, openrouter.ts – buildRequestBody).

---

## ADR-9: Agent Canvas – Callout-Injektion und Konversationsführung

**Kontext**: Dokumentzentrierte AI-Kollaboration erfordert, dass Agent-Antworten direkt ins Obsidian-Dokument geschrieben werden, ohne die bestehende Konversationsinfrastruktur zu duplizieren.

**Entscheidung**: Obsidian-Callout-Blöcke als Annotationsformat; Konversationsführung über den bestehenden `Orchestrator`/`ConversationManager`; `vault.read()` + `vault.modify()` statt `vault.process()`.

**Begründung**:
- Callout-Blöcke rendern schön im Reading View und sind im Source View normal editierbar
- `<!-- paper-agents-canvas -->`-Marker sind in Obsidian unsichtbar und kollisionssicher
- `vault.read()` + `vault.modify()` ist breiter kompatibel als `vault.process()` (nicht in allen Obsidian-Versionen verfügbar)
- Kein Doppelcode: bestehende Streaming-, Tool-Calling- und History-Infrastruktur wird genutzt
- Callout-Text-Rückgabe von `appendAgentCallout`/`appendUserCallout` ermöglicht exaktes Entfernen via `removeCallout` ohne zweiten Timestamp-Aufruf

**Status**: Implementiert (canvas-agent.ts, canvas-modal.ts, commands/index.ts, sidebar.ts).

---

## ADR-10: Wikilink-Auflösung zum Ladezeitpunkt

**Kontext**: Agenten und Tools referenzieren Obsidian-Wikilinks in ihren Definitionen. Die Auflösung kann zur Ladezeit oder zur LLM-Anfrage-Zeit erfolgen.

**Entscheidung**: Ladezeit-Auflösung (beim Parsen der Agent-/Tool-Datei) via `WikilinkResolver`, `maxDepth: 3`, `visited`-Zyklenschutz, primär Obsidian `MetadataCache`.

**Begründung**:
- Keine asynchronen Operationen während des LLM-Aufrufs nötig; Fehler werden früh erkannt
- Obsidians `MetadataCache.getFirstLinkpathDest()` garantiert konsistente Pfadauflösung
- Kommentar-Wrapper machen eingebetteten Inhalt für Debugging transparent
- `maxDepth: 3` schützt vor tiefen Rekursionsbäumen ohne zu restriktiv zu sein
- Frontmatter wird nicht verarbeitet, da Wikilinks in YAML unerwünschte Expansion auslösen könnten

**Konsequenz**: Änderungen an verlinkten Dateien werden erst beim nächsten Laden (Hot-Reload) wirksam.

**Status**: Implementiert (wikilink-resolver.ts; Integration in main.ts Agent-Loader und tool-loader.ts).

---

**Zurück:** [Querschnittliche Konzepte ←](08-querschnittliche-konzepte.md) | **Weiter:** [Qualitätsanforderungen →](10-qualitaetsanforderungen.md)
