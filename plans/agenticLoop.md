# Agentic Loop in Paper Agents Chat

## 1. Überblick

### Was ist ein Agentic Loop?

Ein **Agentic Loop** ermöglicht es einem Agenten, eine gestellte Aufgabe vollständig autonom zu lösen, ohne dass der Nutzer nach jedem LLM-Aufruf eingreifen muss. Der Nutzer gibt eine Aufgabe im Chat, der Agent iteriert eigenständig – er plant, ruft Tools auf, bewertet Zwischenergebnisse und schickt die gesamte History immer wieder ans LLM – bis die Aufgabe erledigt ist oder die maximale Anzahl von Iterationen erreicht wurde.

### Unterschied zum aktuellen Tool-Call-Loop

Der bestehende `maxToolCallRounds`-Loop im `Orchestrator` löst bereits den **Tool-Aufruf-Zyklus innerhalb einer Antwort** (LLM → Tool → LLM → ... → Finalantwort). Das entspricht dem ReAct-Muster auf Mikro-Ebene.

Der neue Agentic Loop arbeitet auf **Makro-Ebene**: Nach einer finalen Antwort des LLM bewertet der Agent, ob die Gesamtaufgabe abgeschlossen ist. Falls nicht, initiiert er eine weitere Iteration mit aktualisiertem Kontext – ohne Nutzereingriff.

```
Nutzer gibt Aufgabe
        ↓
  [Agentic Loop Start]
        ↓
   LLM + Tool Calls  ←──────────────────┐
        ↓                               │
  LLM Finalantwort                      │
        ↓                               │
  Aufgabe erledigt?  ──── Nein ─────────┘
        │ Ja / Max-Iter erreicht
        ↓
  Loop beendet → Ergebnis dem Nutzer anzeigen
```

---

## 2. Steuerung über Markdown-Attribute (Frontmatter)

### 2.1 Neue Frontmatter-Felder im Agenten-File

```yaml
---
agent: true
id: deep_research
name: "Deep Research Assistant"
description: "Recherchiert autonom mehrere Quellen und erstellt einen Report"
model: openai/gpt-4o
tools:
  - websearch
  - read_file
  - write_file
memory:
  type: conversation
  maxMessages: 100
temperature: 0.3

# Agentic Loop Konfiguration
agenticLoop:
  enabled: true            # Schaltet den autonomen Modus ein
  maxIterations: 10        # Maximale Anzahl Iterations (Sicherheitsgrenze)
  terminationCheck: auto   # Wie wird Abschluss erkannt: "auto" | "phrase" | "tool"
  terminationPhrase: "AUFGABE_ABGESCHLOSSEN"  # Nur bei terminationCheck: phrase
  iterationPrompt: |
    Überprüfe deinen bisherigen Fortschritt. Hast du die Aufgabe vollständig erfüllt?
    Wenn ja, formuliere eine finale Zusammenfassung und beende mit AUFGABE_ABGESCHLOSSEN.
    Wenn nicht, fahre mit dem nächsten Schritt fort.
  showProgress: true       # Iteration-Counter in der UI anzeigen
  autoSaveReport: true     # Ergebnis automatisch als Notiz speichern
---
```

### 2.2 Feldbeschreibungen

| Feld | Typ | Default | Beschreibung |
|------|-----|---------|--------------|
| `agenticLoop.enabled` | `boolean` | `false` | Aktiviert den autonomen Loop |
| `agenticLoop.maxIterations` | `number` | `10` | Maximale Iterationen (Sicherheitsgrenze, 1–50) |
| `agenticLoop.terminationCheck` | `"auto" \| "phrase" \| "tool"` | `"auto"` | Erkennungsmethode für Aufgabenabschluss |
| `agenticLoop.terminationPhrase` | `string` | – | Phrase, bei der der Loop stoppt (bei `terminationCheck: phrase`) |
| `agenticLoop.iterationPrompt` | `string` | – | Nachricht, die zu Beginn jeder Iteration eingefügt wird |
| `agenticLoop.showProgress` | `boolean` | `true` | Zeigt Iterationsfortschritt in der UI |
| `agenticLoop.autoSaveReport` | `boolean` | `false` | Speichert Endergebnis automatisch als Markdown-Datei |

### 2.3 Terminierungsstrategien

#### `auto` (empfohlen)
Der LLM entscheidet selbst im System-Prompt, wann er fertig ist. Im System-Prompt wird eine klare Instruktion hinterlegt:
> *„Wenn du die Aufgabe vollständig abgeschlossen hast, antworte ausschließlich mit `[DONE]` am Anfang deiner Nachricht."*

Das System prüft die letzte Assistenten-Antwort auf das Signal `[DONE]`.

**Vorteil:** Flexibel, funktioniert mit allen Modellen.  
**Nachteil:** Halluzination möglich (LLM markiert Task als done, obwohl er es nicht ist).

#### `phrase`
Ein benutzerdefiniertes Stopp-Wort/Phrase im Frontmatter (`terminationPhrase`). Zuverlässiger als `auto`, erfordert aber, dass das LLM im System-Prompt klar instruiert wird, diese Phrase zu nutzen.

#### `tool`
Ein spezielles `finish_task`-Tool wird dem LLM angeboten. Wenn der LLM dieses Tool aufruft, endet der Loop. Dies ist die robusteste Methode, da der LLM explizit handeln muss.

```
LLM ruft finish_task({ summary: "...", reportPath: "..." }) auf
→ Loop endet, Zusammenfassung wird angezeigt
```

---

## 3. Integrationsplan in das aktuelle System

### 3.1 Typen erweitern (`src/types.ts`)

Neue Interfaces hinzufügen:

```typescript
export type TerminationCheckMode = "auto" | "phrase" | "tool";

export interface AgenticLoopConfig {
  enabled: boolean;
  maxIterations: number;
  terminationCheck: TerminationCheckMode;
  terminationPhrase?: string;
  iterationPrompt?: string;
  showProgress?: boolean;
  autoSaveReport?: boolean;
}
```

`AgentDefinition` um das Feld erweitern:
```typescript
export interface AgentDefinition {
  // ...bestehende Felder...
  agenticLoop?: AgenticLoopConfig;
}
```

`AgentFrontmatter` entsprechend erweitern:
```typescript
export interface AgentFrontmatter {
  // ...bestehende Felder...
  agenticLoop?: AgenticLoopConfig | Record<string, unknown>;
}
```

### 3.2 Parser erweitern (`src/parser/agent-parser.ts`)

Im `parseFrontmatter`-Block `agenticLoop:` als weiteren nested Key registrieren:

```typescript
const nestedKeys: Record<string, string> = {
  "memory:": "memory",
  "websearchConfig:": "websearchConfig",
  "agenticLoop:": "agenticLoop",   // NEU
};
```

In `toAgentDefinition` die neue Config parsen und validieren:

```typescript
agenticLoop: this.parseAgenticLoopConfig(fm.agenticLoop),
```

```typescript
private static parseAgenticLoopConfig(config: unknown): AgenticLoopConfig | undefined {
  if (!config || typeof config !== "object") return undefined;
  const cfg = config as Record<string, unknown>;
  if (cfg.enabled !== true) return undefined;

  const maxIter = typeof cfg.maxIterations === "number" ? cfg.maxIterations : 10;
  const validModes: TerminationCheckMode[] = ["auto", "phrase", "tool"];
  const mode = validModes.includes(cfg.terminationCheck as TerminationCheckMode)
    ? (cfg.terminationCheck as TerminationCheckMode)
    : "auto";

  return {
    enabled: true,
    maxIterations: Math.min(Math.max(1, maxIter), 50), // Clamp 1..50
    terminationCheck: mode,
    terminationPhrase: typeof cfg.terminationPhrase === "string" ? cfg.terminationPhrase : undefined,
    iterationPrompt: typeof cfg.iterationPrompt === "string" ? cfg.iterationPrompt : undefined,
    showProgress: cfg.showProgress !== false,
    autoSaveReport: cfg.autoSaveReport === true,
  };
}
```

### 3.3 Orchestrator erweitern (`src/core/orchestrator.ts`)

Neue öffentliche Methode `runAgenticLoop`:

```typescript
export interface AgenticLoopCallbacks extends OrchestratorCallbacks {
  onIterationStart?: (iteration: number, maxIterations: number) => void;
  onIterationEnd?: (iteration: number, done: boolean) => void;
  onLoopComplete?: (iterations: number, finalContent: string) => void;
}

async runAgenticLoop(
  agent: AgentDefinition,
  conversationId: string,
  userMessage: string,
  callbacks?: AgenticLoopCallbacks
): Promise<string> {
  const loopConfig = agent.agenticLoop;
  if (!loopConfig?.enabled) {
    // Fallback: normaler sendMessage-Aufruf
    return this.sendMessage(agent, conversationId, userMessage, callbacks);
  }

  // Augmentierter System-Prompt für Loop-Terminierung
  const augmentedAgent = this.augmentAgentForLoop(agent, loopConfig);
  
  this.conversationManager.addMessage(conversationId, "user", userMessage);

  let finalContent = "";
  for (let i = 1; i <= loopConfig.maxIterations; i++) {
    callbacks?.onIterationStart?.(i, loopConfig.maxIterations);

    // Optionalen Iterations-Prompt einfügen
    if (loopConfig.iterationPrompt && i > 1) {
      this.conversationManager.addMessage(conversationId, "user", loopConfig.iterationPrompt);
    }

    const content = await this.continueConversation(augmentedAgent, conversationId, callbacks);
    finalContent = content;

    const done = this.checkTermination(content, loopConfig);
    callbacks?.onIterationEnd?.(i, done);

    if (done) break;
  }

  callbacks?.onLoopComplete?.(/* iterations */, finalContent);
  return finalContent;
}

private augmentAgentForLoop(agent: AgentDefinition, config: AgenticLoopConfig): AgentDefinition {
  if (config.terminationCheck !== "auto") return agent;
  
  const doneInstruction = "\n\nWenn du die gestellte Aufgabe vollständig erledigt hast, beginne deine Antwort mit `[DONE]`.";
  return {
    ...agent,
    systemPrompt: agent.systemPrompt + doneInstruction,
  };
}

private checkTermination(content: string, config: AgenticLoopConfig): boolean {
  switch (config.terminationCheck) {
    case "auto":
      return content.trimStart().startsWith("[DONE]");
    case "phrase":
      return config.terminationPhrase ? content.includes(config.terminationPhrase) : false;
    case "tool":
      // Tool-basierte Terminierung wird durch finish_task-Tool gehandelt
      return false;
  }
}
```

Für `terminationCheck: "tool"` wird ein neues `finish_task`-Tool benötigt (siehe Abschnitt 3.4).

### 3.4 Neues `finish_task`-Tool (`src/tools/predefined.ts`)

```typescript
// finish_task Tool – nur für Agentic Loop
export const FINISH_TASK_TOOL: IToolFactory = {
  name: "finish_task",
  description: "Schließe die aktuelle Aufgabe ab und liefere eine Zusammenfassung",
  parameters: [
    { name: "summary", type: "string", description: "Zusammenfassung der erledigten Aufgabe", required: true },
    { name: "reportPath", type: "string", description: "Optionaler Pfad zum gespeicherten Report", required: false },
  ],
  create: (app?: App) => ({
    name: "finish_task",
    parameters: FINISH_TASK_TOOL.parameters!,
    execute: async (ctx: ExecutionContext): Promise<ExecutionResult> => {
      return { success: true, data: { done: true, summary: ctx.parameters["summary"] }, log: [] };
    },
    shouldRequireHITL: () => false,
  }),
};
```

Im Orchestrator: Nach jedem Tool-Call prüfen, ob `finish_task` aufgerufen wurde → Loop beenden.

### 3.5 Chat UI erweitern (`src/ui/chat.ts`)

#### Neuer "Run Task"-Button
Neben dem "Send"-Button erscheint ein neuer Button **"▶ Run Task"**, der sichtbar ist, wenn der ausgewählte Agent `agenticLoop.enabled: true` hat.

```typescript
if (selectedAgent?.agenticLoop?.enabled) {
  const runTaskBtn = btnGroup.createEl("button", { cls: "pa-chat-run-task-btn", text: "▶ Run Task" });
  runTaskBtn.addEventListener("click", () => void this.runAgenticTask());
}
```

#### `runAgenticTask()`-Methode
```typescript
private async runAgenticTask(): Promise<void> {
  if (!this.inputEl || !this.selectedAgent?.agenticLoop?.enabled) return;
  
  const message = this.inputEl.value.trim();
  if (!message) return;
  
  this.inputEl.value = "";
  this.addMessageToUI("user", message);
  
  await this.runLLMOperation(
    (orch, agent, convId) => {
      const loopCallbacks: AgenticLoopCallbacks = {
        ...this.makeCallbacks(),
        onIterationStart: (i, max) => this.addIterationIndicator(i, max),
        onIterationEnd: (i, done) => this.updateIterationIndicator(i, done),
        onLoopComplete: (iterations, _) => this.addSystemMessage(`Loop abgeschlossen nach ${iterations} Iterationen.`),
      };
      return orch.runAgenticLoop(agent, convId, message, loopCallbacks);
    },
    "Agentic loop error"
  );
}
```

#### Iterations-Indikator in der UI
```typescript
private addIterationIndicator(iteration: number, maxIterations: number): void {
  if (!this.messagesContainer) return;
  const el = this.messagesContainer.createDiv({ cls: "pa-chat-loop-indicator" });
  el.textContent = `🔄 Iteration ${iteration} / ${maxIterations}`;
  el.id = `pa-loop-iter-${iteration}`;
  this.scrollToBottom();
}
```

---

## 4. Beispiel: Deep Research Assistant

### Agent-Definition (`examples/agents/deep-research-assistant.md`)

```markdown
---
agent: true
id: deep_research_assistant
name: "Deep Research Assistant"
description: "Recherchiert autonom mehrere Quellen und erstellt einen strukturierten Report"
model: openai/gpt-4o
tools:
  - websearch
  - write_file
  - read_file
memory:
  type: conversation
  maxMessages: 100
temperature: 0.2
maxTokens: 4096
websearchConfig:
  maxResults: 10

agenticLoop:
  enabled: true
  maxIterations: 8
  terminationCheck: tool
  showProgress: true
  autoSaveReport: true
---

## System Prompt
Du bist ein autonomer Recherche-Assistent. Deine Aufgabe ist es, ein gegebenes Thema
gründlich zu recherchieren und einen strukturierten Report zu erstellen.

**Vorgehen:**
1. Analysiere die Aufgabe und erstelle einen Rechercheplan
2. Recherchiere mehrere Quellen mit dem websearch-Tool
3. Fasse die gefundenen Informationen zusammen
4. Identifiziere Widersprüche oder Wissenslücken
5. Erstelle einen finalen strukturierten Report mit write_file
6. Rufe `finish_task` auf wenn der Report fertig ist

**Report-Format:**
- Einleitung (Was wurde recherchiert?)
- Hauptbefunde (gegliedert nach Themen)
- Quellen und Bewertung
- Fazit

Sei kritisch: Weise auf unsichere oder widersprüchliche Informationen hin.

## Kontext
Datum: {{current_date}}
Uhrzeit: {{current_time}}
```

### Ablauf bei Nutzereingabe "Recherchiere den aktuellen Stand von KI-Regulierung in der EU"

```
Iteration 1:
  User: "Recherchiere den aktuellen Stand von KI-Regulierung in der EU"
  LLM: plant die Recherche, ruft websearch("EU AI Act 2025") auf
  → Tool-Ergebnis gespeichert in History

Iteration 2:
  History + iterationPrompt eingefügt
  LLM: ruft websearch("EU AI Act enforcement") + websearch("AI governance Europe") auf
  → Weitere Ergebnisse in History

Iteration 3:
  LLM: ruft write_file("research/eu-ai-regulation.md", report_content) auf
  → Report gespeichert

Iteration 4:
  LLM: ruft finish_task({ summary: "Report erstellt unter research/eu-ai-regulation.md" }) auf
  → Loop beendet
```

---

## 5. Konzeptionelle Entscheidungen

### E1: Terminierungsstrategie
**Entscheidung notwendig:** Welche Default-Strategie soll verwendet werden?

- `auto` (LLM-Phrase) ist einfach zu implementieren, aber anfällig für Halluzinationen
- `tool` (finish_task) ist robuster, erfordert aber ein neues Tool und Änderungen am Tool-Registry
- **Empfehlung:** `auto` als Default für Einfachheit, `tool` als optionale robustere Alternative

### E2: Iterations-Prompt vs. automatisch eingesetzter Context
**Entscheidung notwendig:** Wie wird jede neue Iteration initiiert?

- Option A: Leerer Loop ohne expliziten Prompt zwischen Iterationen → LLM muss selbst "weiterdenken"
- Option B: `iterationPrompt` wird als User-Message eingefügt → Explizit, aber füllt Context
- Option C: Der Loop-Prompt ist Teil des System-Prompts (immer aktiv)
- **Empfehlung:** Option B als Opt-in, da der Nutzer steuern kann, ob und wie gereflected wird

### E3: Kontext-Fenster-Management
**Problem:** Bei vielen Iterationen mit Tool-Calls kann der Kontext das LLM-Limit überschreiten.

- Die bestehende `MemoryConfig.maxMessages` begrenzt bereits den Kontext
- Für Deep Research: `memory.type: summary` könnte Zwischenzusammenfassungen erstellen
- **Lösung (implementiert):** OpenRouter **`transforms: ["middle-out"]`** wird automatisch für alle Agentic-Loop-Requests aktiviert.

#### OpenRouter `transforms: ["middle-out"]`

OpenRouter bietet eine serverseitige Komprimierungsstrategie für lange Konversationen:

> Wenn der Prompt das Context-Window des Modells überschreitet, entfernt OpenRouter automatisch Nachrichten aus der **Mitte** der History – und bewahrt dabei den Anfang (System-Prompt + initiale Aufgabe) sowie das Ende (neueste Schritte). Da LLMs erfahrungsgemäß dem Anfang und Ende mehr Aufmerksamkeit schenken, ist das der optimale Kompromiss.

**API-Parameter:**
```json
{
  "model": "openai/gpt-4o",
  "messages": [...],
  "transforms": ["middle-out"]
}
```

**Eigenschaften:**
- Modelle mit ≤ 8k Context-Window haben `middle-out` standardmäßig aktiv
- Verhindert Context-Overflow-Fehler ohne manuelle Token-Zählung
- Löst auch das Message-Limit von Claude (max. 1.000 Nachrichten)
- Kann pro Agent konfiguriert werden; für den Agentic Loop immer aktiviert

**Implementierung:**
- `AgentDefinition.transforms?: string[]` – internes Feld, nicht im Frontmatter
- `augmentAgentForLoop()` setzt `transforms: ["middle-out"]` automatisch
- `OpenRouterClient.chatStream()` leitet `transforms` an die API weiter
- `buildRequestBody()` fügt `transforms` in den Request-Body ein (nur wenn vorhanden)
- Normale Chats (kein Agentic Loop) erhalten kein `transforms`

### E4: User Interaction während des Loops
**Entscheidung notwendig:** Kann der Nutzer den Loop unterbrechen?

- Der "Stop"-Button sollte den Loop sofort abbrechen (abort signal)
- Pause-Funktion wäre nice-to-have, aber komplex
- **Empfehlung:** Nur "Stop"-Button in Phase 1

### E5: Parallelisierung von Tool-Calls
Die aktuelle Implementierung führt Tool-Calls sequentiell aus. Für Deep Research wäre parallele Ausführung (mehrere websearch-Calls gleichzeitig) nützlich.
- **Empfehlung:** Out-of-scope für Phase 1, separates Feature

### E6: Unterschied Loop vs. HITL (Human-in-the-Loop)
Das existierende HITL-Modal (`src/ui/hitl-modal.ts`) könnte als "Pause für User-Input" in den Agentic Loop integriert werden:
- Agent iteriert autonom
- Bei Unsicherheit: HITL-Pause, Nutzer bestätigt oder gibt Hinweis
- **Empfehlung:** Integration in Phase 2

---

## 6. Showstopper und bekannte Probleme

### S1: Halluziniertes [DONE] bei `auto`-Terminierung
Das LLM könnte `[DONE]` schreiben, obwohl die Aufgabe nicht erledigt ist.
**Mitigierung:** Robuster `terminationCheck: tool` verwenden; in System-Prompt klar instruieren.

### S2: Endlosloop bei schlechtem Prompt
Wenn der `iterationPrompt` den LLM nicht zum Abschluss bringt, werden maximal `maxIterations` Runden gefahren.
**Mitigierung:** Sinnvoller Default für `maxIterations` (10), Warnung in der UI wenn Loop abbricht.

### S3: Kosten / Token-Explosion
Jede Iteration sendet die gesamte History ans LLM. Bei 10 Iterationen mit Tool-Calls können schnell 100k+ Tokens anfallen.
**Mitigierung:** `memory.maxMessages` begrenzt die Context-Größe. **`transforms: ["middle-out"]`** (OpenRouter) verhindert Context-Overflow-Fehler, indem Nachrichten aus der Mitte der History automatisch entfernt werden. Hinweis in der Dokumentation.

### S4: Keine Persistenz des Loop-Zustands
Wenn Obsidian während eines Loops geschlossen wird, geht der Zustand verloren.
**Mitigierung:** Out-of-scope für Phase 1. Die Conversation-Datei wird nach jeder Iteration gespeichert.

### S5: Keine parallele Tool-Ausführung
Sequentielle Tool-Calls sind langsamer. Bei Deep Research mit vielen Quellen dauert es länger.
**Mitigierung:** Akzeptiert in Phase 1.

---

## 7. Implementierungsphasen

### Phase 1 (MVP) – Agentic Loop Core
- [x] `AgenticLoopConfig` in `src/types.ts` hinzufügen
- [x] Parser in `src/parser/agent-parser.ts` erweitern (agenticLoop-Block parsen)
- [x] `runAgenticLoop`-Methode im `Orchestrator` implementieren (terminationCheck: auto + phrase)
- [x] `AgenticLoopCallbacks` im Orchestrator
- [x] Chat UI: "▶ Run Task"-Button, der bei Loop-fähigen Agenten erscheint
- [x] Chat UI: Iterations-Indikator anzeigen
- [x] Beispiel-Agent `deep-research-assistant.md`

### Phase 2 – Robustheit & Tools
- [x] `finish_task`-Tool implementieren (terminationCheck: tool)
- [x] HITL-Integration: Agent kann nach User-Input fragen während des Loops
- [x] `autoSaveReport`: Automatisches Speichern des Ergebnisses

### Phase 3 – Optimierung
- [ ] Parallele Tool-Calls innerhalb einer Iteration
- [x] Kontext-Fenster-Management via OpenRouter `transforms: ["middle-out"]`
- [ ] Summary-Memory für lange Loops
- [ ] Kosten-Tracking pro Loop-Durchlauf

---

## 8. Dateiänderungen (Übersicht)

| Datei | Änderung |
|-------|----------|
| `src/types.ts` | `AgenticLoopConfig`, `TerminationCheckMode` hinzufügen; `AgentDefinition` + `AgentFrontmatter` erweitern; `AgentDefinition.transforms?: string[]` (intern) |
| `src/parser/agent-parser.ts` | `agenticLoop:`-Block parsen, `parseAgenticLoopConfig()` |
| `src/core/openrouter.ts` | `chatStream()` + `buildRequestBody()` um `transforms`-Parameter erweitert |
| `src/core/orchestrator.ts` | `runAgenticLoop()`, `AgenticLoopCallbacks`, Terminierungslogik; `augmentAgentForLoop()` setzt `transforms: ["middle-out"]` |
| `src/ui/chat.ts` | "▶ Run Task"-Button, `runAgenticTask()`, Iterations-Indikator |
| `src/tools/predefined.ts` | `finish_task`-Tool (Phase 2) |
| `examples/agents/deep-research-assistant.md` | Beispiel-Agent (NEU) |

---

## 9. Referenzen und Inspiration

- **ReAct Pattern**: Yao et al. (2022) – "ReAct: Synergizing Reasoning and Acting in Language Models"
- **AutoGPT / BabyAGI**: Bekannte Implementierungen von autonomen LLM-Loops
- **LangChain AgentExecutor**: Tool-basierte Loop-Implementierung
- **OpenAI Assistants API**: Thread-basierter Ansatz mit Tool-Calls
