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
| `finish_task` | Agentic Loop beenden | ❌ Nein |
| `ask_user` | Frage an Nutzer im Agentic Loop | ❌ Nein (Pause auf Loop-Ebene) |

Der HITL-Dialog zeigt: Tool-Name, Step, Parameter und bietet Approve/Reject-Buttons.

Im Agentic Loop löst `ask_user` keine HITL-Bestätigung aus, sondern pausiert den Loop und öffnet das `HITLInputModal` mit der Agenten-Frage. Der Nutzer gibt eine Antwort ein, die als User-Message in die Konversation eingefügt wird. Danach läuft der Loop weiter.

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

### Agenten mit Agentic Loop

Agenten können mit `agenticLoop: enabled: true` in den autonomen Modus versetzt werden:

```markdown
---
agent: true
id: deep_research
name: "Deep Research Assistant"
model: openai/gpt-4o
tools:
  - websearch
  - write_file
  - read_file
memory:
  type: conversation
  maxMessages: 100
agenticLoop:
  enabled: true            # Schaltet den autonomen Modus ein
  maxIterations: 8         # Maximale Iterationen (1–50, Default: 10) – hier auf 8 gesetzt
  terminationCheck: tool   # "auto" | "phrase" | "tool"
  showProgress: true       # Iterations-Fortschritt in der UI anzeigen
  autoSaveReport: false    # Ergebnis automatisch als Markdown-Datei speichern
---
```

**Felder für `agenticLoop`:**

| Feld | Typ | Default | Beschreibung |
|------|-----|---------|--------------|
| `enabled` | `boolean` | `false` | Aktiviert den autonomen Loop |
| `maxIterations` | `number` | `10` | Maximale Iterationen (1–50, Sicherheitsgrenze) |
| `terminationCheck` | `"auto" \| "phrase" \| "tool"` | `"auto"` | Erkennungsmethode für Aufgabenabschluss |
| `terminationPhrase` | `string` | – | Stopp-Phrase bei `terminationCheck: phrase` (in diesem Modus erforderlich) |
| `iterationPrompt` | `string` | – | User-Message, die zu Beginn jeder Iteration (ab Iteration 2) eingefügt wird |
| `showProgress` | `boolean` | `true` | Zeigt Iterationsfortschritt in der UI |
| `autoSaveReport` | `boolean` | `false` | Speichert Endergebnis automatisch als Markdown-Datei |

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

Dateien werden im konfigurierten Conversations-Ordner abgelegt (Standard: `paper-agents-conversations/`) und können direkt in Obsidian geöffnet und bearbeitet werden. Das Format ist round-trip-fähig: Gespeicherte Dateien können über das Conversation-Dropdown in `PaperAgentsChatView` wieder geladen werden.

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
| **Observer Pattern** | HITL-Callbacks, Vault-Events | UI-Integration ohne Tight Coupling; Chat-View reagiert auf externe Dateiänderungen |
| **Pipeline Pattern** | 3-Phasen-Execution | Pre → Tool → Post als sequenzielle Pipeline |
| **Callback Pattern** | `OrchestratorCallbacks` | Streaming-Events (onToken, onToolCallStart, onToolCallEnd, onComplete, onError) |
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
  4. Predefined Tools registrieren (inkl. WebSearchFactory)
  5. Custom Tools aus Vault laden
  6. Agents aus Vault laden
  7. Orchestrator initialisieren
  8. History-Persistenz initialisieren (history.json)
  9. Sandbox initialisieren (QuickJS)
  10. Sidebar View registrieren
  11. Chat View (PaperAgentsChatView) registrieren
  12. Ribbon Icon hinzufügen
  13. Commands registrieren (via registerCommands())
  14. Settings-Tab registrieren
  15. HITL Callbacks registrieren

onunload():
  1. Sandbox destroyen
  2. Sidebar-Leaves detachen
  3. Chat-Leaves detachen
```

## 8.8 Vault-Persistenz

- **JSON-Persistenz** (nur Execution History):
  - Speicherort: `.obsidian/plugins/paper-agents/`
  - Datei: `history.json`
  - Factory-Funktionen: `createVaultSaver()`, `createVaultLoader()` in `src/core/persistence.ts`
  - Fehlertoleranz: Korrupte Daten werden geloggt und ignoriert (kein Plugin-Crash)
  - Datenschutz: Alle Daten lokal im Vault

### Markdown-Persistenz für Conversations

- **Speicherort**: Konfigurierbarer Pfad (Standard: `paper-agents-conversations/`)
- **Format**: Markdown mit YAML-Frontmatter (`conversation: true`, `id`, `agentId`, `createdAt`, `updatedAt`) und `### Role (timestamp)` Nachrichtenblöcken
- **Schreiben**: Nach jeder Nachricht in `PaperAgentsChatView.sendMessage()` via `ConversationFileManager.saveConversation()`
- **Datei anlegen**: Beim Start einer neuen Konversation via `ConversationFileManager.createConversationFile()`
- **Laden**: Beim Öffnen der Chat-View oder bei Auswahl aus dem Conversation-Dropdown
- **Bidirektionale Synchronisierung**: `vault.on('modify')` erkennt externe Änderungen und lädt die Konversation automatisch neu

## 8.9 Agentic Loop Konzept

Der Agentic Loop ermöglicht autonome, mehrstufige Aufgabenbearbeitung. Der Nutzer startet die Aufgabe über den "▶ Run Task"-Button (nur sichtbar bei Agenten mit `agenticLoop.enabled: true`); danach iteriert der Agent eigenständig.

### Makro-Ebene vs. Mikro-Ebene

| Ebene | Beschreibung |
|-------|--------------|
| **Mikro (Tool-Call-Loop)** | `maxToolCallRounds`-Schleife im Orchestrator: LLM → Tool → LLM → … → Finalantwort (ReAct-Muster innerhalb einer Iteration) |
| **Makro (Agentic Loop)** | Nach der Finalantwort prüft der Loop, ob die Gesamtaufgabe abgeschlossen ist. Falls nicht, startet die nächste Iteration. |

### Terminierungsstrategien

| Strategie | Funktionsweise | Vor- / Nachteil |
|-----------|---------------|-----------------|
| `auto` | LLM beginnt Antwort mit `[DONE]`; System-Prompt instruiert das Modell | Einfach, anfällig für Halluzinationen |
| `phrase` | Benutzerdefinierte Stopp-Phrase (`terminationPhrase`) im Content | Zuverlässiger als auto, erfordert präzise System-Prompt-Instruktion |
| `tool` | LLM ruft `finish_task({ summary })` explizit auf | Robusteste Methode; erfordert Tool-Aufruf des LLM |

### HITL-Integration im Agentic Loop

Das `ask_user`-Tool wird automatisch in jeden Agentic-Loop-Agenten injiziert. Wenn das LLM `ask_user({ question })` aufruft:
1. `getAskUserQuestion()` im Orchestrator erkennt den Call.
2. `onHITLPause(question)` Callback wird aufgerufen.
3. Chat-UI öffnet `HITLInputModal` und wartet auf Nutzerantwort.
4. Antwort wird als User-Message in die Konversation eingefügt.
5. Loop setzt mit der nächsten Iteration fort.

### Context-Window-Management

Für Agentic-Loop-Requests wird OpenRouter `transforms: ["middle-out"]` automatisch aktiviert:
- Wenn die Nachrichtenhistory das Context-Window überschreitet, entfernt OpenRouter Nachrichten **aus der Mitte**.
- System-Prompt + initiale Aufgabe (Anfang) und neueste Schritte (Ende) werden beibehalten.
- Verhindert Context-Overflow-Fehler ohne manuelle Token-Zählung.
- Normale Chat-Requests erhalten kein `transforms`.

### Persistenz im Agentic Loop

Nach **jeder Iteration** wird die Conversation-Datei gespeichert:
- `onIterationEnd` im Orchestrator ist `void | Promise<void>`.
- Der Callback in `chat.ts` ruft `saveConversation()` async auf.
- Bei Obsidian-Absturz während des Loops gehen maximal die Schritte der laufenden Iteration verloren.

## 8.10 Agent Canvas – Callout-Format

Der Agent Canvas-Modus annotiert Dokumente mit AI-Antworten als Obsidian-Callout-Blöcke.

### Callout-Format

**Agent-Callout:**

```markdown
<!-- paper-agents-canvas -->
> [!note] 🤖 Agent: Research Assistant *(2026-01-01T10:05:00Z)*
>
> Antworttext des Agenten...
```

**User-Callout:**

```markdown
<!-- paper-agents-canvas -->
> [!question] 👤 User *(2026-01-01T10:07:00Z)*
>
> Follow-up-Nachricht des Nutzers...
```

Der HTML-Kommentar `<!-- paper-agents-canvas -->` ist in Obsidian unsichtbar und dient als eindeutiger Marker, damit `CanvasAgent.stripCanvasCallouts()` AI-Callouts vom Originaldokument trennen kann.

### Frontmatter-Konfiguration

Dokumente können den Canvas-Agenten vorbelegen:

```markdown
---
paper-agent: research_assistant
---
```

Ist das Feld gesetzt, überspringt `CanvasModal` die Agent-Auswahl. Andernfalls zeigt das Modal ein Dropdown.

### Inline-Platzierungs-Hints

Der Agent kann seine Antwort mit `@after-paragraph-N:` (case-insensitive) beginnen, um den Callout nach Absatz N einzufügen:

```
@after-paragraph-3: Hier folgt die Anmerkung zu Absatz 3.
```

`CanvasAgent.parseInlinePlacement()` entfernt den Hint und gibt `{ paragraphIndex, cleanedText }` zurück. Bei ungültigem oder fehlendem Index wird ans Dokumentende angehängt.

### Multi-Agenten-Canvas

Wenn ≥ 2 Agenten geladen sind, erscheint im Modal ein **Multi-Agenten-Toggle**. Aktiviert sieht der Nutzer eine Checkbox-Liste aller Agenten. `startMultiAgentSession()` iteriert sequenziell über die ausgewählten Agenten; jeder erhält eine eigene Konversation und denselben Dokument-Kontext (ohne bestehende Canvas-Callouts).

## 8.11 Wikilink-Auflösung

Obsidian-Wikilinks (`[[Dateiname]]`) in Agenten- und Tool-Definitionen werden beim **Laden** (nicht bei LLM-Anfragen) aufgelöst und der Inhalt der referenzierten Datei wird eingebettet.

### Unterstützte Wikilink-Formate

| Format | Verhalten |
|--------|-----------|
| `[[Dateiname]]` | Inhalt der Datei einbetten |
| `[[Dateiname\|Alias]]` | Alias wird ignoriert, Inhalt wird eingebettet |
| `[[Dateiname#Abschnitt]]` | Abschnitt wird ignoriert, gesamter Inhalt eingebettet |
| `[[Pfad/zur/Datei]]` | Pfad-Referenz |

Frontmatter-Wikilinks in YAML-Werten werden nicht verarbeitet. Nur `.md`-Dateien werden eingebettet; andere Dateitypen werden übersprungen.

### Einbettungsformat

```
<!-- wikilink:pfad/zur/datei.md -->
[Inhalt der verlinkten Datei]
<!-- /wikilink:pfad/zur/datei.md -->
```

Kommentar-Wrapper sind für das LLM unsichtbar und dienen dem Debugging.

### Pfadauflösung (Prioritätsreihenfolge)

1. `app.metadataCache.getFirstLinkpathDest()` – Obsidians nativer Resolver (Fuzzy-Matching, relative Pfade)
2. `app.vault.getAbstractFileByPath(linkPath + ".md")` – direkter Pfad mit `.md`-Extension
3. `app.vault.getAbstractFileByPath(linkPath)` – direkter Pfad ohne Extension

### Rekursion und Zyklenschutz

- `maxDepth` (Standard: 3) begrenzt die Rekursionstiefe
- `visited: Set<string>` verhindert Endlosrekursion bei zirkulären Links (A → B → A)

---

**Zurück:** [Verteilungssicht ←](07-verteilungssicht.md) | **Weiter:** [Architekturentscheidungen →](09-architekturentscheidungen.md)
