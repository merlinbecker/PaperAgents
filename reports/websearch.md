# WebSearch Plugin Support — Implementation Report

## Zusammenfassung

Dieses Dokument beschreibt die vollständige Implementierung des OpenRouter WebSearch-Plugin-Supports für PaperAgents.

---

## Hintergrund

OpenRouter bietet ein serverseitiges **Web-Search Plugin** an, das beim API-Aufruf aktiviert werden kann. Ist es aktiviert, kann das LLM das Internet durchsuchen und aktuelle Informationen in seine Antworten einbeziehen. Das Plugin wird durch das Hinzufügen von `"plugins": [{"id": "web-search"}]` zum API-Request-Body aktiviert – es handelt sich also **nicht** um ein lokal ausgeführtes Tool, sondern um eine serverseitige Erweiterung der OpenRouter-API.

Referenz: https://openrouter.ai/docs/guides/features/plugins/web-search

---

## Implementierte Änderungen

### Phase 1 (Initial)

#### 1. `src/utils/constants.ts`
- `WEBSEARCH: "websearch"` zu `PREDEFINED_TOOL_IDS` hinzugefügt

#### 2. `src/tools/predefined.ts`
- `WebSearchTool`-Klasse als `IExecutableTool` hinzugefügt (no-op lokale Implementierung, die klarstellt, dass das Plugin serverseitig läuft)
- `WebSearchFactory` als `IToolFactory` exportiert, mit lesbarer Beschreibung
- `webSearch` zum `PredefinedToolsFactory`-Export hinzugefügt

#### 3. `src/core/openrouter.ts`
- `buildRequestBody()` erweitert um optionalen `plugins`-Parameter (typisiert als Plugin-Objekt-Array)
- `chat()` und `chatStream()` akzeptieren jetzt optional Plugin-Konfigurationen

#### 4. `src/core/orchestrator.ts`
- Import von `PREDEFINED_TOOL_IDS` hinzugefügt
- Neue private Methode `buildPluginList(agent)`: gibt Plugin-Objekte zurück, wenn `websearch` in `agent.tools` enthalten ist
- `buildToolDefinitions()` überspringt `websearch` (da es kein Function-Tool ist)
- `continueConversation()` übergibt die Plugin-Liste an `chatStream()`

#### 5. `src/main.ts`
- `WebSearchFactory` wird in `registerPredefinedTools()` registriert

#### 6. `src/settings.ts`
- Beschreibungstext der vordefinierten Tools um `websearch` ergänzt

---

### Phase 2 (Erweiterungen)

#### 7. UI-Kennzeichnung (`src/utils/constants.ts`, `src/core/tool-registry.ts`, `src/ui/sidebar.ts`, `styles.css`)
- `WEBSEARCH: "🌐"` zu `TOOL_ICONS` hinzugefügt
- `PLUGINS: "OpenRouter Plugins"` zu `TOOL_CATEGORIES` hinzugefügt
- `isPlugin?: boolean` zum `ToolMetadata`-Interface hinzugefügt
- `ToolRegistry.listTools()` weist `websearch` die Kategorie `"OpenRouter Plugins"` und das Icon `🌐` zu
- Sidebar rendert jetzt eine eigene `"OpenRouter Plugins"`-Sektion mit `🌐 Plugin`-Badge
- Plugin-Tools öffnen kein Parameterformular (kein Click-Handler nötig)
- Neuer CSS-Style `.pa-tool-badge-plugin` für den Badge

#### 8. WebSearch-Konfiguration (`src/types.ts`, `src/parser/agent-parser.ts`, `src/core/orchestrator.ts`)
- `WebSearchConfig`-Interface in `src/types.ts` hinzugefügt (`{ maxResults?: number }`)
- `websearchConfig?: WebSearchConfig` zu `AgentDefinition` und `AgentFrontmatter` hinzugefügt
- `AgentParser` parst den Frontmatter-Block `websearchConfig:` / `websearch_config:` und übergibt `maxResults`
- `buildPluginList()` im Orchestrator berücksichtigt `agent.websearchConfig.maxResults` und fügt `max_results` zum Plugin-Objekt hinzu

  **Verwendung im Agenten-YAML:**
  ```yaml
  websearchConfig:
    maxResults: 5
  ```

#### 9. Streaming-Annotationen / Quellenangaben (`src/core/openrouter.ts`, `src/core/orchestrator.ts`, `src/ui/chat.ts`, `styles.css`)
- `WebSearchAnnotation` und `WebSearchUrlCitation`-Interfaces in `src/types.ts` definiert
- `LLMMessage` erweitert um `annotations?: WebSearchAnnotation[]`
- `StreamChunk.delta` erweitert um `annotations?: WebSearchAnnotation[]`
- `StreamCallbacks` erweitert um `onAnnotations?: (annotations: WebSearchAnnotation[]) => void`
- `chatStream()` sammelt Annotationen aus SSE-Chunks und feuert den `onAnnotations`-Callback
- `OrchestratorCallbacks` weiterleitet `onAnnotations`
- Chat-UI rendert Quellenangaben als klickbare Links unterhalb der Antwort (`.pa-chat-annotations`)

---

## Verwendung

### Grundkonfiguration

```yaml
---
agent: true
id: research-agent
name: Research Agent
tools:
  - websearch
memory:
  type: conversation
---

Du bist ein Forschungsassistent mit Zugriff auf aktuelle Web-Informationen.
```

### Mit Konfigurationsoptionen

```yaml
---
agent: true
id: research-agent
name: Research Agent
tools:
  - websearch
  - read_file
websearchConfig:
  maxResults: 5
memory:
  type: conversation
---

Du bist ein Forschungsassistent mit Zugriff auf aktuelle Web-Informationen.
```

Sobald `websearch` als Tool konfiguriert ist, sendet der Orchestrator automatisch `"plugins": [{"id": "web-search"}]` (ggf. mit `max_results`) im OpenRouter-API-Request. Das LLM kann dann aktuelle Webinhalte einbeziehen und Quellenangaben werden in der Chat-UI als klickbare Links angezeigt.

---

## Architekturentscheidungen

1. **Serverseitiges Plugin, kein lokales Tool**: `websearch` wird nicht lokal ausgeführt. Die lokale `WebSearchTool.execute()`-Methode gibt einen erklärenden Fehler zurück, falls sie versehentlich aufgerufen wird.

2. **Ausschluss aus Function-Tool-Definitionen**: `buildToolDefinitions()` überspringt `websearch`, sodass es nicht als OpenAI-Function-Call-Schema in den Request eingebettet wird.

3. **Typisiertes Plugin-Objekt statt String**: Die Plugins-Liste verwendet `Array<{ id: string } & Record<string, unknown>>`, was optionale Parameter wie `max_results` ermöglicht und zukünftige OpenRouter-Plugins ohne Refactoring unterstützt.

4. **Rückwärtskompatibilität**: Alle bestehenden Methoden bleiben unverändert; alle neuen Felder sind optional.

---

## Testergebnisse

- Alle **283 Tests** bestehen (275 vorher + 8 neue)
- Keine TypeScript-Fehler in den geänderten Dateien

---

## Offene Arbeiten

- **Weitere OpenRouter-Plugins**: Die Plugin-Infrastruktur (`buildPluginList`) ist generisch gehalten und kann für weitere OpenRouter-Plugins (z. B. `code-interpreter`) durch Hinzufügen eines weiteren Eintrags in `PREDEFINED_TOOL_IDS` und einer entsprechenden Factory leicht erweitert werden.
