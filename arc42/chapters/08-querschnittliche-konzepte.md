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

### Konversations-Format (Markdown, Round-trip-fähig)

```markdown
### User (2026-01-29T10:30:00.000Z)
Nachrichtentext

### Assistant (2026-01-29T10:30:05.000Z)
Antworttext

### Tool (2026-01-29T10:30:10.000Z)
<!-- tool:read_file -->
<!-- params:{"path":"/test.md"} -->
Result: "Dateiinhalt"
```

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

## 8.7 Plugin-Lifecycle

```typescript
onload():
  1. Settings laden (loadData)
  2. ToolRegistry initialisieren
  3. Predefined Tools registrieren
  4. Custom Tools aus Vault laden
  5. Sandbox initialisieren (QuickJS)
  6. Sidebar View registrieren
  7. Ribbon Icon hinzufügen
  8. Commands registrieren (open-sidebar, reload-custom-tools)
  9. Settings-Tab registrieren
  10. HITL Callbacks registrieren

onunload():
  1. Sandbox destroyen
  2. Sidebar-Leaves detachen
```

---

**Zurück:** [Verteilungssicht ←](07-verteilungssicht.md) | **Weiter:** [Architekturentscheidungen →](09-architekturentscheidungen.md)
