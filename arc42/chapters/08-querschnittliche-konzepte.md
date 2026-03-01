# 8. Querschnittliche Konzepte

## 8.1 Sicherheitskonzept

### Sandbox-Isolation

Pre-/Post-Processing-Code wird in einer **QuickJS-WASM-Sandbox** ausgeführt:

- **Isolation**: Kein Zugriff auf Node.js, Dateisystem oder Netzwerk
- **Memory-Limit**: 10 MB (konfigurierbar)
- **Timeout-Limit**: 5 Sekunden (konfigurierbar)
- **Code-Validierung**: Statische Analyse blockiert:
  - `require()` – kein Modul-Import
  - `eval()` – keine dynamische Code-Ausführung
  - `process` – kein Process-Zugriff
  - `global` – kein Global-Objekt
  - `Function()` – kein Konstruktor-Zugriff
- **IIFE-Wrapping**: Code wird als `(function(){ ... })()` ausgeführt
- **Datenaustausch**: JSON-Serialisierung (kein Direct Memory Access)

### Human-in-the-Loop (HITL)

| Tool | Operation | HITL erforderlich? |
|------|-----------|-------------------|
| `write_file` | Alle Schreiboperationen | ✅ Ja, immer |
| `rest_request` | GET | ❌ Nein |
| `rest_request` | POST, PUT, DELETE | ✅ Ja |
| `read_file` | Alle Leseoperationen | ❌ Nein |
| `search_files` | Alle Suchoperationen | ❌ Nein |

Der HITL-Dialog zeigt: Tool-Name, Step, Parameter und bietet Approve/Reject-Buttons.

### Datenschutz

- Keine Telemetrie, kein Tracking
- API-Key wird lokal in Obsidian-Settings gespeichert
- Vault-Inhalte werden nur bei expliziter Nutzeraktion an LLMs gesendet
- Keine Remote-Code-Execution

## 8.2 Tool-Definitions-Format

### Tool-Datei (Markdown mit YAML Frontmatter)

```markdown
---
tool: true
id: my_tool
name: "My Tool"
description: "Beschreibung"
type: single          # oder "chain"
parameters:
  - name: input
---

#### **Pre-Processing**
\`\`\`javascript
// @preprocess
input.normalized = input.input.trim().toLowerCase();
return input;
\`\`\`

#### **Tool-Ausführung**
\`\`\`yaml
tool: "search_files"
parameters:
  query: "{{input}}"
\`\`\`

#### **Post-Processing**
\`\`\`javascript
// @postprocess
return { resultCount: output.results.length, results: output.results };
\`\`\`
```

### Chain-Tool-Format

```markdown
---
tool: true
id: my_chain
name: "My Chain"
type: chain
parameters:
  - name: query
steps:
  - name: "search"
---
```

### Placeholder-Syntax

| Placeholder | Beschreibung |
|-------------|--------------|
| `{{param_name}}` | Nutzer-Input-Parameter |
| `{{prev_step.output}}` | Output des vorherigen Steps |
| `{{prev_step.output.field}}` | Verschachtelter Feldzugriff |
| `{{date}}` | Aktuelles Datum (YYYY-MM-DD) |
| `{{time}}` | Aktuelle Zeit (HH:mm:ss) |
| `{{random_id}}` | Zufällige UUID |

## 8.3 Agenten-Definitions-Format

```markdown
---
agent: true
id: research_assistant
name: "Research Assistant"
description: "Hilft bei Recherche"
model: openai/gpt-4o-mini
tools:
  - search_files
  - read_file
memory:
  type: conversation        # conversation | summary | none
  maxMessages: 50
  maxTokens: 4000
temperature: 0.7
---

## System Prompt
Du bist ein hilfreicher Recherche-Assistent...

## Kontext
Datum: {{current_date}}
Vault: {{vault_path}}
```

### Konversations-Dateiformat (Markdown, round-trip-fähig, speicherbar)

Das vollständige Dateiformat für Conversation-Dateien kombiniert YAML-Frontmatter mit Message-Blöcken:

```markdown
---
conversation: true
id: conv_1234567890_abcdefghi
agentId: research_assistant
createdAt: 2026-01-01T10:00:00.000Z
updatedAt: 2026-01-01T10:05:00.000Z
---

### User (2026-01-01T10:00:00.000Z)
Nachrichtentext

### Assistant (2026-01-01T10:01:00.000Z)
Antworttext

### Tool (2026-01-01T10:02:00.000Z)
<!-- tool:read_file -->
<!-- params:{"filePath":"/test.md"} -->
Result: "Dateiinhalt"
```

Dateien werden im konfigurierten Conversations-Ordner abgelegt (Standard: `paper-agents-conversations/`) und können direkt in Obsidian geöffnet und bearbeitet werden. Das Format ist round-trip-fähig: Gespeicherte Dateien können über `open-file-as-chat` wieder in `PaperAgentsChatView` geladen werden.

### Memory-Strategien

| Typ | Beschreibung | Default |
|-----|--------------|---------|
| `conversation` | Behält die letzten N Nachrichten | maxMessages: 50, maxTokens: 4000 |
| `summary` | Fasst alte Nachrichten zusammen nach N Nachrichten | summarizeAfter: configurable |
| `none` | Keine History, jede Nachricht ist unabhängig | – |

## 8.4 Design Patterns

| Pattern | Einsatzort | Zweck |
|---------|-----------|-------|
| **Factory Pattern** | `ToolRegistry` | Tool-Erstellung und -Registrierung entkoppelt von Implementierung |
| **Strategy Pattern** | `ToolExecutor` | Austauschbare Ausführungslogik (Single vs. Chain) |
| **Observer Pattern** | HITL-Callbacks | UI-Integration ohne Tight Coupling |
| **Pipeline Pattern** | 3-Phasen-Execution | Pre → Tool → Post als sequenzielle Pipeline |
| **Callback Pattern** | `OrchestratorCallbacks` | Streaming-Events (onToken, onToolCallStart, onToolCallEnd, onComplete, onError) |
| **Debounce Pattern** | `ConversationManager` | Persistenz-Speicherung mit 1 s Timer, vermeidet exzessive Schreiboperationen |
| **Module Extraction** | `commands/`, `persistence.ts` | Verantwortlichkeiten aus main.ts in eigenständige Module extrahiert |

## 8.5 Logging

- Zentrales Logger-Modul (`src/utils/logger.ts`)
- Log-Levels: `debug`, `info`, `warn`, `error`
- Debug-Logging aktivierbar in Settings
- Ausgabe in Obsidian Console (Ctrl+Shift+I)
- Prefix `[PaperAgents]` für alle Log-Einträge

## 8.6 Error-Handling

- `try/catch` mit `async/await` in allen Executoren
- `ExecutionResult` mit `success: boolean`, `error?: string`, `log: ToolExecution[]`
- `ValidationResult` mit `valid: boolean`, `errors: ValidationError[]`
- User-Facing errors als `Notice` in Obsidian
- Detaillierte Fehler im Debug-Log

### Streaming Error Classification (Chat-UI)

Fehler während der LLM-Kommunikation werden in `src/ui/chat.ts` (`addErrorMessage()`) klassifiziert und nutzerfreundlich angezeigt:

| Error-Typ | Erkennung (im Error-Message) | Nutzer-Nachricht |
|---|---|---|
| Timeout | `timeout`, `aborted` | „Request timed out. Model is overloaded.“ |
| Rate Limit | `429`, `rate limit` | „Rate limit reached. Please wait.“ |
| Auth | `401`, `unauthorized`, `invalid api key` | „API key invalid or missing.“ |
| Netzwerk | `network`, `fetch`, `ECONNREFUSED`, `ENOTFOUND` | „Network error — check connection.“ |
| Credits | `402`, `insufficient` | „Insufficient credits on OpenRouter account.“ |
| Model | `model` + `not found` | „Selected model unavailable.“ |
| Generic | alles andere | „Error: {original message}“ |

Fehler werden als eigener CSS-styled Message-Block (`pa-chat-message-error`) angezeigt.

## 8.7 Plugin-Lifecycle

```typescript
onload():
  1. Settings laden (loadData)
  2. ToolRegistry initialisieren
  3. ConversationManager initialisieren
  4. Predefined Tools registrieren
  5. Custom Tools aus Vault laden
  6. Agents aus Vault laden
  7. Orchestrator initialisieren
  8. History-Persistenz initialisieren
  9. Conversation-Persistenz initialisieren (loadFromStorage aus conversations.json)
  10. Conversations aus Markdown-Dateien wiederherstellen (newest-wins bei Konflikten)
  11. Sandbox initialisieren (QuickJS)
  12. Sidebar View registrieren
  13. Chat View (PaperAgentsChatView) registrieren
  14. Chat-File View (ChatView) registrieren (Fallback/Rückwärtskompatibilität)
  15. Ribbon Icon hinzufügen
  16. Commands registrieren (via registerCommands())
  17. Settings-Tab registrieren
  18. HITL Callbacks registrieren

onunload():
  1. Conversations speichern (force flush – saveToStorage)
  2. Sandbox destroyen
  3. Sidebar-Leaves detachen
  4. Chat-Leaves detachen
```

## 8.8 Vault-Persistenz

- **Speicherort JSON**: `.obsidian/plugins/paper-agents/`
- **Dateien**: `conversations.json` (Chat-Konversationen), `history.json` (Execution-History)
- **Debounced Saves**: Während der Laufzeit werden Änderungen mit 1 s Delay gespeichert (vermeidet exzessive I/O)
- **Force-Save bei Unload**: Beim Plugin-Stopp wird explizit `saveToStorage()` aufgerufen
- **Factory-Funktionen**: `createVaultSaver()`, `createVaultLoader()` in `src/core/persistence.ts`
- **Limits**: Max. 50 persistierte Konversationen in `conversations.json`
- **Fehlertoleranz**: Korrupte Daten werden geloggt und ignoriert (kein Plugin-Crash)
- **Datenschutz**: Alle Daten lokal im Vault – kein Cloud-Sync der Gespräche

### Markdown-Persistenz für Conversations

- **Speicherort**: Konfigurierbarer Pfad (Standard: `paper-agents-conversations/`)
- **Format**: Markdown mit YAML-Frontmatter (`conversation: true`, `id`, `agentId`, `createdAt`, `updatedAt`) und `### Role (timestamp)` Nachrichtenblöcken
- **Schreiben**: Nach jeder Nachricht in `PaperAgentsChatView.sendMessage()` via `ConversationFileManager.saveConversation()`
- **Datei anlegen**: Beim Start einer neuen Konversation in `PaperAgentsChatView.startNewConversation()` via `ConversationFileManager.createConversationFile()`
- **Laden**: Via Command `open-file-as-chat` → `PaperAgentsChatView.loadConversationFromFile()` – öffnet mit voller LLM-Integration
- **Startup-Wiederherstellung**: `restoreConversationsFromFiles()` in `main.ts` scannt den Conversations-Ordner beim Plugin-Start und lädt Markdown-Dateien, die nicht in `conversations.json` vorhanden sind. Bei Konflikten gilt: **neuere `updatedAt` gewinnt** (Markdown kann `conversations.json` überschreiben)

---

**Zurück:** [Verteilungssicht ←](07-verteilungssicht.md) | **Weiter:** [Architekturentscheidungen →](09-architekturentscheidungen.md)
