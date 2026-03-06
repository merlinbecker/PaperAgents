# Agentic Loop – Implementierungsbericht

## Status

**Phase 1 (MVP): ✅ Vollständig implementiert**  
**Phase 2 (Robustheit & Tools): ✅ Vollständig implementiert**  
**Phase 3 (Optimierung): ⏳ Noch offen**

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

---

### Phase 2 – Robustheit & Tools

#### `src/utils/constants.ts`
- `PREDEFINED_TOOL_IDS.FINISH_TASK = "finish_task"` hinzugefügt

#### `src/tools/predefined.ts`
- `FinishTaskTool`-Klasse implementiert:
  - Nimmt `summary` (required) und `reportPath` (optional) als Parameter
  - Gibt `{ done: true, summary, reportPath? }` zurück
  - Kein HITL erforderlich
- `FinishTaskFactory` exportiert
- `PredefinedToolsFactory.finishTask` hinzugefügt

#### `src/main.ts`
- `FinishTaskFactory` in `registerPredefinedTools()` registriert (jetzt 6 Tools)

#### Orchestrator (Phase-2-Ergänzungen)
- `augmentAgentForLoop()` injiziert `finish_task` automatisch in die Tool-Liste, wenn `terminationCheck: "tool"`
- `hasFinishTaskCall()` durchsucht Conversation-Messages auf `finish_task`-Tool-Calls
- `onLoopComplete` Callback-Typ unterstützt jetzt `Promise<void>` (für async autoSaveReport)
- `runAgenticLoop` wartet auf `onLoopComplete` mit `await`

#### Chat UI (Phase-2-Ergänzungen)
- `runAgenticTask()` ruft `saveLoopReport()` auf wenn `autoSaveReport: true`
- `saveLoopReport()` erstellt Markdown-Datei unter `{conversationsPath}/reports/DATUM_AUFGABE.md`

---

### Tests

Neue Tests wurden hinzugefügt:

**`tests/unit/core/orchestrator.spec.ts`**
- `injects finish_task into agent tools when terminationCheck is tool`
- `terminates loop when finish_task tool is called`
- Hilfsfunktion `makeToolCallStreamResponse()` für Tool-Call-SSE-Mocking

**`tests/integration/tools/predefined.int.spec.ts`**
- `finish_task returns done:true with summary`
- `finish_task includes reportPath when provided`
- `finish_task does not require HITL`
- `finish_task has a non-empty log entry`

Alle 305 Tests bestehen.

---

## Noch offene Arbeiten

### Phase 3 – Optimierung (noch nicht implementiert)

| Feature | Beschreibung | Aufwand |
|---------|--------------|---------|
| Parallele Tool-Calls | Mehrere Tool-Calls innerhalb einer Iteration parallel ausführen | Mittel |
| Summary-Memory | Zusammenfassungen für lange Loops erstellen (memory.type: summary) | Hoch |
| Kosten-Tracking | Token-Kosten pro Loop-Durchlauf tracken und anzeigen | Mittel |

### Bekannte Einschränkungen

| ID | Problem | Status |
|----|---------|--------|
| S1 | Halluziniertes `[DONE]` bei `auto`-Terminierung | Mitigiert durch `terminationCheck: tool` |
| S2 | Endlosloop bei schlechtem Prompt | Mitigiert durch `maxIterations` (Default: 10) |
| S3 | Kosten-/Token-Explosion bei vielen Iterationen | Dokumentiert – `memory.maxMessages` begrenzt Kontext |
| S4 | Kein Persistenz des Loop-Zustands bei Absturz | Conversation-Datei wird nach jeder Iteration gespeichert |
| S5 | Sequentielle Tool-Calls (kein Parallelism) | Akzeptiert in Phase 1+2; Phase 3 |

### Phase 2 – Nicht implementiert

| Feature | Beschreibung |
|---------|--------------|
| HITL-Integration | Agent kann während des Loops nach User-Input fragen |

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
   continueConversation() ←──────────────────┐
        ↓                                   │
   LLM + Tool Calls (inner loop)            │
        ↓                                   │
   LLM Finalantwort                         │
        ↓                                   │
   checkLoopTermination()                   │
        ↓                                   │
   auto:  [DONE] in content?                │
   phrase: terminationPhrase in content?    │
   tool:   finish_task in conversation?     │
        │                                   │
        ├── Nein ────────────────────────────┘
        │
        └── Ja / Max-Iter erreicht
              ↓
        onLoopComplete callback
              ↓
        autoSaveReport? → saveLoopReport()
              ↓
        Ergebnis dem Nutzer anzeigen
```
