# WebSearch Plugin Support — Implementation Report

## Zusammenfassung

Dieses Dokument beschreibt die Implementierung des OpenRouter WebSearch-Plugin-Supports für PaperAgents.

---

## Hintergrund

OpenRouter bietet ein serverseitiges **Web-Search Plugin** an, das beim API-Aufruf aktiviert werden kann. Ist es aktiviert, kann das LLM das Internet durchsuchen und aktuelle Informationen in seine Antworten einbeziehen. Das Plugin wird durch das Hinzufügen von `"plugins": [{"id": "web-search"}]` zum API-Request-Body aktiviert – es handelt sich also **nicht** um ein lokal ausgeführtes Tool, sondern um eine serverseitige Erweiterung der OpenRouter-API.

Referenz: https://openrouter.ai/docs/guides/features/plugins/web-search

---

## Implementierte Änderungen

### 1. `src/utils/constants.ts`
- `WEBSEARCH: "websearch"` zu `PREDEFINED_TOOL_IDS` hinzugefügt

### 2. `src/tools/predefined.ts`
- `WebSearchTool`-Klasse als `IExecutableTool` hinzugefügt (no-op lokale Implementierung, die klarstellt, dass das Plugin serverseitig läuft)
- `WebSearchFactory` als `IToolFactory` exportiert, mit lesbarer Beschreibung
- `webSearch` zum `PredefinedToolsFactory`-Export hinzugefügt

### 3. `src/core/openrouter.ts`
- `buildRequestBody()` erweitert um optionalen `plugins?: string[]`-Parameter
- Wenn Plugins übergeben werden, wird `body.plugins = plugins.map(id => ({ id }))` gesetzt
- `chat()` und `chatStream()` akzeptieren jetzt optional `plugins?: string[]`

### 4. `src/core/orchestrator.ts`
- Import von `PREDEFINED_TOOL_IDS` hinzugefügt
- Neue private Methode `buildPluginList(agent)`: gibt `["web-search"]` zurück, wenn `websearch` in `agent.tools` enthalten ist
- `buildToolDefinitions()` überspringt `websearch` (da es kein Function-Tool ist)
- `continueConversation()` ruft `buildPluginList()` auf und übergibt die Plugin-Liste an `chatStream()`

### 5. `src/main.ts`
- `WebSearchFactory` wird in `registerPredefinedTools()` registriert (Anzahl von 4 auf 5 erhöht)

### 6. `src/settings.ts`
- Beschreibungstext der vordefinierten Tools um `websearch` ergänzt

### 7. Tests
- `tests/unit/core/openrouter.spec.ts`: 2 neue Tests für Plugin-Unterstützung im API-Request
- `tests/unit/core/orchestrator.spec.ts`: 3 neue Tests für WebSearch-Plugin-Integration im Orchestrator

---

## Verwendung

Um den WebSearch-Support für einen Agenten zu aktivieren, füge `websearch` zur `tools`-Liste in der Agenten-Definitionsdatei hinzu:

```yaml
---
agent: true
id: my-agent
name: My Web-Aware Agent
tools:
  - websearch
memory:
  type: conversation
---

Du bist ein hilfreicher Assistent mit Zugriff auf aktuelle Web-Informationen.
```

Sobald `websearch` als Tool konfiguriert ist, sendet der Orchestrator automatisch `"plugins": [{"id": "web-search"}]` im OpenRouter-API-Request. Das LLM kann dann aktuelle Webinhalte in seine Antworten einbeziehen.

Das `websearch`-Tool kann mit anderen lokalen Tools kombiniert werden:

```yaml
tools:
  - websearch
  - read_file
  - write_file
```

---

## Architekturentscheidungen

1. **Serverseitiges Plugin, kein lokales Tool**: `websearch` wird nicht lokal ausgeführt. Die lokale `WebSearchTool.execute()`-Methode gibt einen erklärenden Fehler zurück, falls sie versehentlich aufgerufen wird.

2. **Ausschluss aus Function-Tool-Definitionen**: `buildToolDefinitions()` überspringt `websearch`, sodass es nicht als OpenAI-Function-Call-Schema in den Request eingebettet wird.

3. **Plugin-Liste statt Flag**: Die Implementierung nutzt `string[]` als Plugins-Liste, was eine einfache Erweiterung um weitere OpenRouter-Plugins ermöglicht.

4. **Rückwärtskompatibilität**: Alle bestehenden Methoden bleiben unverändert; `plugins` ist in allen Signaturen optional.

---

## Testergebnisse

- Alle **280 Tests** bestehen (275 vorher + 5 neue)
- Keine TypeScript-Fehler in den geänderten Dateien

---

## Offene Arbeiten / Mögliche Erweiterungen

- **UI-Kennzeichnung**: In der Sidebar / im Agent-Editor könnte `websearch` mit einem speziellen Icon (z. B. 🌐) oder einem Hinweis als Plugin-Tool (nicht als lokales Tool) gekennzeichnet werden.
- **Weitere OpenRouter-Plugins**: Die Plugin-Infrastruktur (`buildPluginList`) ist generisch gehalten und kann für weitere OpenRouter-Plugins (z. B. `code-interpreter`) leicht erweitert werden.
- **WebSearch-Konfiguration**: Das OpenRouter Web-Search Plugin unterstützt optionale Parameter (z. B. `max_results`). Diese könnten als Agent-Konfigurationsoptionen in `AgentDefinition` ergänzt werden.
- **Streaming-Annotationen**: OpenRouter gibt bei WebSearch-Antworten Annotationen (Quellenangaben) zurück. Diese könnten in der Chat-UI angezeigt werden.
