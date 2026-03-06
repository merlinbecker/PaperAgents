# Agentic Loop – Implementierungsbericht

## Status

**Phase 1 (MVP): ✅ Vollständig implementiert**  
**Phase 2 (Robustheit & Tools): ✅ Vollständig implementiert**  
**Phase 3 (Optimierung): 🔄 Teilweise implementiert**

---

## Was wurde implementiert

### Phase 1 – Agentic Loop Core

#### `src/types.ts`
- `TerminationCheckMode` (`"auto" | "phrase" | "tool"`) hinzugefügt
- `AgenticLoopConfig`-Interface hinzugefügt (enabled, maxIterations, terminationCheck, terminationPhrase, iterationPrompt, showProgress, autoSaveReport)
- `AgentDefinition` um optionales Feld `agenticLoop?: AgenticLoopConfig` erweitert
- `AgentFrontmatter` entsprechend erweitert

#### `src/parser/agent-parser.ts`
- `parseFrontmatter` erkennt `agenticLoop:` und `agentic_loop:` als verschachselte Keys
- `parseAgenticLoopConfig()` validiert und normalisiert die Konfiguration:
  - `maxIterations` wird auf 1..50 geclampt
  - Ungültiger `terminationCheck`-Mode fällt auf `"auto"` zurück
  - `showProgress` ist standardmäßig `true`
  - `autoSaveReport` ist standardmäßig `false`

#### `src/core/orchestrator.ts`
- `AgenticLoopCallbacks`-Interface hinzugefügt (`onIterationStart`, `onIterationEnd`, `onLoopComplete`)
- `runAgenticLoop()`-Methode implementiert:
  - Augmentiert den Agenten für den Loop (System-Prompt-Erweiterung oder Werkzeug-Injektion)
  - Iteriert bis `maxIterations` oder bis die Terminierungsbedingung erfüllt ist
  - Fügt `iterationPrompt` ab Iteration 2 als User-Message ein
  - Ruft `onIterationStart`, `onIterationEnd`, `onLoopComplete` Callbacks auf
- `augmentAgentForLoop()`: Fügt `[DONE]`-Instruktion bei `auto`, oder injiziert `finish_task`-Tool bei `tool`
- `checkLoopTermination()`: Prüft alle drei Terminierungsstrategien
- `hasFinishTaskCall()`: Sucht rückwärts durch Conversation-Messages nach einem `finish_task`-Tool-Call

#### `src/ui/chat.ts`
- `runTaskBtn` ("▶ Run Task") Button hinzugefügt, sichtbar nur wenn Agent `agenticLoop.enabled: true` hat
- `updateRunTaskButtonVisibility()` synchronisiert Button-Sichtbarkeit mit ausgewähltem Agent
- `runAgenticTask()` Methode: startet den Agentic Loop mit Loop-Callbacks
- `addIterationIndicator()`: Zeigt 🔄 Iteration X / max im Chat an
- `updateIterationIndicator()`: Aktualisiert den Indikator zu ✅ (done) oder ⏳ (weiter)
- `saveLoopReport()`: Speichert Endergebnis als Markdown-Datei (für `autoSaveReport: true`)

#### `examples/agents/deep-research-assistant.md`
- Beispiel-Agent mit aktiviertem Agentic Loop (terminationCheck: auto, maxIterations: 8)
- Demonstriert iterativen Recherche-Workflow mit websearch + write_file
- Enthält Hinweis auf `ask_user` für HITL-Rückfragen

---

### Phase 2 – Robustheit & Tools

#### `src/utils/constants.ts`
- `PREDEFINED_TOOL_IDS.FINISH_TASK = "finish_task"` hinzugefügt
- `PREDEFINED_TOOL_IDS.ASK_USER = "ask_user"` hinzugefügt

#### `src/tools/predefined.ts`
- `FinishTaskTool`-Klasse implementiert:
  - Nimmt `summary` (required) und `reportPath` (optional) als Parameter
  - Gibt `{ done: true, summary, reportPath? }` zurück
  - Kein HITL erforderlich
- `FinishTaskFactory` exportiert
- `PredefinedToolsFactory.finishTask` hinzugefügt
- `AskUserTool`-Klasse implementiert (**NEU – HITL-Integration**):
  - Nimmt `question` (required) als Parameter
  - Gibt `{ asked: true, question }` zurück
  - Kein HITL auf Tool-Ebene (Pause wird auf Loop-Ebene behandelt)
- `AskUserFactory` exportiert
- `PredefinedToolsFactory.askUser` hinzugefügt

#### `src/main.ts`
- `FinishTaskFactory` in `registerPredefinedTools()` registriert
- `AskUserFactory` in `registerPredefinedTools()` registriert (jetzt 7 Tools)

#### Orchestrator (Phase-2-Ergänzungen)
- `augmentAgentForLoop()` injiziert `finish_task` automatisch wenn `terminationCheck: "tool"`
- `augmentAgentForLoop()` injiziert `ask_user` **immer** in die Tool-Liste (für HITL-Unterstützung)
- `hasFinishTaskCall()` durchsucht Conversation-Messages auf `finish_task`-Tool-Calls
- `getAskUserQuestion()` durchsucht die letzte Iteration auf `ask_user`-Tool-Calls und gibt die Frage zurück
- `onLoopComplete` Callback-Typ unterstützt `Promise<void>` (für async autoSaveReport)
- `onHITLPause?: (question: string) => Promise<string>` zu `AgenticLoopCallbacks` hinzugefügt (**NEU**)
- `runAgenticLoop` erkennt `ask_user`-Calls, pausiert den Loop, wartet auf User-Antwort via `onHITLPause`

---

### Phase 3 – Kontext-Fenster-Management via OpenRouter Transforms (implementiert)

#### Problem (S3: Token-Explosion)
Bei langen Agentic Loops mit vielen Tool-Calls wächst die Conversation-History schnell. Sobald sie das Context-Window des Modells überschreitet, bricht der API-Call mit einem Fehler ab.

#### Lösung: OpenRouter `transforms: ["middle-out"]`

OpenRouter bietet eine serverseitige Komprimierungsstrategie:

- Wenn die Nachrichtenhistory das Context-Window überschreitet, entfernt OpenRouter automatisch Nachrichten **aus der Mitte** der History
- Beibehaltung von: System-Prompt + initiale Aufgabe (Anfang) + neueste Iterationsschritte (Ende)
- LLMs schenken dem Anfang und Ende mehr Aufmerksamkeit → optimaler Kompromiss
- Löst auch Modell-spezifische Nachrichten-Limits (z.B. Claudes max. 1.000 Messages)

#### Implementierte Änderungen

**`src/types.ts`**
- `AgentDefinition.transforms?: string[]` hinzugefügt (internes Feld, nicht im User-Frontmatter)

**`src/core/openrouter.ts`**
- `chatStream()` um `transforms?: string[]`-Parameter erweitert
- `buildRequestBody()` fügt `transforms` in den Request-Body ein (nur wenn vorhanden, um normale Chats nicht zu beeinflussen)

**`src/core/orchestrator.ts`**
- `processChatRound()` leitet `agent.transforms` an `chatStream()` weiter
- `augmentAgentForLoop()` setzt `transforms: ["middle-out"]` auf dem augmentierten Agenten → nur Agentic-Loop-Requests erhalten diese Optimierung; normale Chats bleiben unverändert

**Tests**  
- `sends transforms: [middle-out] in agentic loop requests` – verifiziert, dass der API-Request `transforms: ["middle-out"]` enthält
- `does not send transforms in regular sendMessage calls` – verifiziert, dass normale Chats kein `transforms` senden

#### `src/ui/hitl-modal.ts` (**NEU – HITL-Integration**)
- `HITLInputModal`-Klasse implementiert:
  - Zeigt die Agenten-Frage in einem Modal an
  - Textarea für die Nutzer-Antwort
  - ✅ "Send answer" Button und ❌ "Cancel" Button
  - Tastaturkürzel: Ctrl/Cmd+Enter zum Absenden
  - Bei Modal-Schließung ohne Eingabe: leerer String zurückgegeben
- `showHITLInputModal(app, question)` Helper-Funktion exportiert

#### Chat UI (Phase-2-Ergänzungen)
- `runAgenticTask()` ruft `saveLoopReport()` auf wenn `autoSaveReport: true`
- `saveLoopReport()` erstellt Markdown-Datei unter `{conversationsPath}/reports/DATUM_AUFGABE.md`
- `onHITLPause` Callback in `runAgenticTask()` implementiert (**NEU**):
  - Zeigt System-Message "🙋 Agent is asking: ..." im Chat
  - Öffnet `HITLInputModal` und wartet auf Nutzer-Eingabe
  - Fügt die Antwort als User-Message im Chat hinzu

---

### Tests

Neue Tests wurden hinzugefügt:

**`tests/unit/core/orchestrator.spec.ts`**
- `injects finish_task into agent tools when terminationCheck is tool`
- `terminates loop when finish_task tool is called`
- `injects ask_user tool for every agentic loop run` (**NEU**)
- `pauses and resumes loop when ask_user is called` (**NEU**)
- `sends transforms: [middle-out] in agentic loop requests` (**NEU**)
- `does not send transforms in regular sendMessage calls` (**NEU**)
- Hilfsfunktion `makeToolCallStreamResponse()` für Tool-Call-SSE-Mocking

**`tests/integration/tools/predefined.int.spec.ts`**
- `finish_task returns done:true with summary`
- `finish_task includes reportPath when provided`
- `finish_task does not require HITL`
- `finish_task has a non-empty log entry`
- `ask_user returns asked:true with question` (**NEU**)
- `ask_user does not require HITL` (**NEU**)
- `ask_user has a non-empty log entry with correct tool name` (**NEU**)

Alle 312 Tests bestehen.

---

## Noch offene Arbeiten

### Phase 3 – Optimierung (teilweise implementiert)

| Feature | Beschreibung | Status |
|---------|--------------|--------|
| ~~Kontext-Fenster via Transforms~~ | OpenRouter `transforms: ["middle-out"]` | ✅ Implementiert |
| Parallele Tool-Calls | Mehrere Tool-Calls innerhalb einer Iteration parallel ausführen | Offen |
| Summary-Memory | Zusammenfassungen für lange Loops erstellen (memory.type: summary) | Offen |
| Kosten-Tracking | Token-Kosten pro Loop-Durchlauf tracken und anzeigen | Offen |

### Bekannte Einschränkungen

| ID | Problem | Status |
|----|---------|--------|
| S1 | Halluziniertes `[DONE]` bei `auto`-Terminierung | Mitigiert durch `terminationCheck: tool` |
| S2 | Endlosloop bei schlechtem Prompt | Mitigiert durch `maxIterations` (Default: 10) |
| S3 | Kosten-/Token-Explosion bei vielen Iterationen | ✅ Gelöst via `transforms: ["middle-out"]` (OpenRouter) + `memory.maxMessages` |
| S4 | Kein Persistenz des Loop-Zustands bei Absturz | Conversation-Datei wird nach jeder Iteration gespeichert |
| S5 | Sequentielle Tool-Calls (kein Parallelism) | Akzeptiert in Phase 1+2; Phase 3 |

---

## Architekturübersicht

```
Nutzer gibt Aufgabe ("▶ Run Task")
        ↓
  PaperAgentsChatView.runAgenticTask()
        ↓
  Orchestrator.runAgenticLoop()
        ↓
  [Agentic Loop: i = 1..maxIterations]
        ↓
   continueConversation() ←──────────────────────┐
        ↓                                        │
   LLM + Tool Calls (inner loop)                 │
        ↓                                        │
   LLM Finalantwort                              │
        ↓                                        │
   getAskUserQuestion()                          │
        ↓                                        │
   ask_user aufgerufen?                          │
        ├── Ja → onHITLPause(question) ──────────┤
        │        ↓                               │
        │   HITLInputModal anzeigen              │
        │        ↓                               │
        │   Nutzer gibt Antwort ein              │
        │        ↓                               │
        │   Antwort als user-Message hinzufügen  │
        │        └─────────────────────────────→ │
        │                                        │
        └── Nein                                 │
              ↓                                  │
   checkLoopTermination()                        │
        ↓                                        │
   auto:  [DONE] in content?                     │
   phrase: terminationPhrase in content?         │
   tool:   finish_task in conversation?          │
        │                                        │
        ├── Nein ────────────────────────────────┘
        │
        └── Ja / Max-Iter erreicht
              ↓
        onLoopComplete callback
              ↓
        autoSaveReport? → saveLoopReport()
              ↓
        Ergebnis dem Nutzer anzeigen
```
