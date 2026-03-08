# 6. Laufzeitsicht

## 6.1 Single-Tool-Ausführung

```
Nutzer                  Sidebar/Form        Executor            Sandbox         Tool (z.B. read_file)
  │                        │                   │                   │                    │
  ├──────────Select Tool───▶│                   │                   │                    │
  │                        │─────execute───────▶│                   │                    │
  │                        │                   ├─validate params───▶│                    │
  │                        │                   │◀─validated params──┤                    │
  │                        │                   ├─run pre-process───▶│                    │
  │                        │                   │◀─transformed input──┤                    │
  │                        │                   ├───execute tool──────────────────────────▶
  │                        │                   │◀────────────result─────────────────────────
  │                        │                   ├─run post-process──▶│                    │
  │                        │                   │◀─transformed output─┤                    │
  │◀─────────Result────────│◀────Result────────┤                   │                    │
```

## 6.2 Chain-Tool-Ausführung

```
Executor                 Step 1 (search)     Step 2 (read)       Placeholder-Engine
  │                         │                   │                      │
  ├──execute Step 1─────────▶│                   │                      │
  │◀────Step 1 Result───────┤                   │                      │
  ├──resolve placeholders──────────────────────────────────────────────▶│
  │                         │                   │◀─resolved values────┤
  ├──execute Step 2──────────────────────────────▶│                    │
  │◀────────Step 2 Result───────────────────────┤                    │
  │                                             │                    │
  ├──Final Result──────────────────────────────────────────────────────▶
```

## 6.3 HITL-Bestätigung (write_file)

```
Executor            HITL-Check          HITL-Modal              Nutzer
  │                    │                    │                      │
  ├─execute write_file─▶│                    │                      │
  │                   ├─check if HITL───────▶│                      │
  │                   │       required      ├──Show parameters──────▶│
  │                   │                    │◀─Approve/Reject────┤
  │                   │◀─confirmation────┤                        │
  ├─Execute Tool      │                   │                      │
  │◀─Result───────────┤                   │                      │
```

## 6.4 Agenten-Konversation (Chat mit LLM)

```
Nutzer               Chat-UI            Orchestrator        OpenRouter API       Tool-Executor
  │                    │                    │                    │                    │
  ├─User-Nachricht─────▶│                    │                    │                    │
  │                    ├─sendMessage─────────▶│                    │                    │
  │                    │                    ├─buildContext────────▶│                    │
  │                    │                    ├─SSE chatStream──────▶│                    │
  │                    │◀─onToken (stream)──┤◀─SSE Tokens─────────┤                    │
  │                    │                    │                    │                    │
  │                    │  ... (Token-Streaming bis tool_call) ...│                    │
  │                    │                    │                    │                    │
  │                    │◀─onToolCallStart──┤◀─tool_use────────────┤                    │
  │                    │                    ├───execute tool──────────────────────────▶│
  │                    │◀─onToolCallEnd────┤◀─────────────result────────────────────┤
  │                    │                    │                    │                    │
  │                    │  ... (bis zu 10 Tool-Call-Runden möglich) ...               │
  │                    │                    │                    │                    │
  │                    │                    ├─Final SSE Stream───▶│                    │
  │                    │◀─onToken (final)───┤◀─Final Tokens────────┤                    │
  │◀─Assistant-Answer──┤◀─onComplete────────┤                    │                    │
```

## 6.5 Chat-Persistenz (Markdown-only)

```
Nutzer               PaperAgentsChatView    ConversationFileManager    Vault (Conversations-Ordner)
  │                        │                        │                        │
  ├─Öffne Chat-View────────▶│                        │                        │
  │                        ├─listConversationFiles──▶│                        │
  │                        │                        ├─scan *.md──────────────▶│
  │                        │◀─{ path, title }[]─────┤◀─Markdown-Dateien──────┤
  │                        ├─autoSelect newest──────▶│                        │
  │                        ├─loadConversation────────▶│                        │
  │                        │                        ├─read(file)──────────────▶│
  │◀─Chat-UI mit History───┤◀─Conversation──────────┤◀─Markdown-Inhalt────────┤
  │                        │                        │                        │
(Nutzer chattet...)
  ├─User-Nachricht─────────▶│                        │                        │
  │                        ├─saveConversation────────▶│                        │
  │                        │                        ├─modify(file)────────────▶│
  │◀─UI aktualisiert───────┤◀───────────────────────┤◀─OK──────────────────────┤
  │                        │                        │                        │
(Externe Dateiänderung...)
  │                        │◀─vault.on('modify')────────────────────────────┤
  │                        ├─loadConversation (reload)▶│                        │
  │◀─UI aktualisiert───────┤                        │                        │
```

Vault-Events (`create`, `delete`, `rename`) aktualisieren das Conversation-Dropdown in der Chat-View. Ein `isSaving`-Flag verhindert einen Reload-Loop bei eigenem Speichern.

## 6.6 Neue Konversation starten

```
Nutzer               PaperAgentsChatView    ConversationFileManager    ConversationManager
  │                        │                        │                        │
  ├─New Chat──────────────▶│                        │                        │
  │                        ├─zeige Agenten-Panel    │                        │
  ├─Agent auswählen────────▶│                        │                        │
  ├─Create──────────────────▶│                        │                        │
  │                        ├─createConversation──────────────────────────────▶│
  │                        │◀─conversationId─────────────────────────────────┤
  │                        ├─createConversationFile──▶│                        │
  │                        │                        ├─create(file)            │
  │                        ├─autoSelect neue Datei  │                        │
  │◀─Chat-UI bereit─────────┤                        │                        │
```

## 6.7 Streaming Error Handling

```
Orchestrator         Chat-UI (onError)       Nutzer
  │                    │                       │
  ├─Error (z.B. 429)──▶│                       │
  │                    ├─classifyError()───────▶│
  │                    ├─User-friendly msg─────▶│
```

| Error-Klasse | Erkennung | Nutzer-Nachricht |
|---|---|---|
| Timeout | `timeout`, `aborted` | „Request timed out. Bitte erneut versuchen." |
| Rate Limit | `429`, `rate limit` | „Rate limit erreicht. Bitte warten." |
| Auth | `401`, `unauthorized` | „API key ungültig. Bitte prüfen." |
| Netzwerk | `network`, `fetch`, `ECONNREFUSED` | „Netzwerkfehler. Verbindung prüfen." |
| Credits | `402`, `insufficient` | „Unzureichendes Guthaben." |
| Modell | `model not found` | „Modell nicht verfügbar." |

## 6.8 Agentic Loop

Der Agentic Loop ermöglicht autonome, mehrstufige Aufgabenbearbeitung ohne manuelle Nutzereingriffe zwischen den Iterationen.

```
Nutzer               Chat-UI               Orchestrator          OpenRouter API       Tools
  │                    │                       │                       │                 │
  ├─▶ Run Task─────────▶│                       │                       │                 │
  │                    ├─runAgenticTask()──────▶│                       │                 │
  │                    │                       ├─augmentAgentForLoop() │                 │
  │                    │                       │  (tools, transforms)  │                 │
  │                    │                       │                       │                 │
  │                    │ [Loop: i=1..maxIter]   │                       │                 │
  │                    │ ┌─────────────────────┤                       │                 │
  │◀─🔄 Iteration i────┤ │ onIterationStart    │                       │                 │
  │                    │ │                     ├─continueConversation──▶│                 │
  │                    │ │                     │◀─LLM + Tool-Calls──────┤◀──tool results──┤
  │                    │ │                     │                       │                 │
  │                    │ │ getAskUserQuestion()─▶                       │                 │
  │                    │ │                     │                       │                 │
  │                    │ │ ask_user aufgerufen?│                       │                 │
  │                    │ ├── Ja: onHITLPause   │                       │                 │
  │◀─🙋 Agent fragt────┤ │ HITLInputModal      │                       │                 │
  ├─Nutzer-Antwort─────▶│ │                     │                       │                 │
  │                    ├─┤─addMessage──────────▶│                       │                 │
  │                    │ │                     │                       │                 │
  │                    │ │ onIterationEnd      │                       │                 │
  │                    │ │ saveConversation()  │                       │                 │
  │                    │ │                     │                       │                 │
  │                    │ │ checkLoopTermination│                       │                 │
  │                    │ │ done? ──── Nein─────┘                       │                 │
  │                    │ └── Ja                │                       │                 │
  │                    │ onLoopComplete        │                       │                 │
  │◀─✅ Ergebnis────────┤                       │                       │                 │
```

**Terminierungsstrategien:**

| Strategie | Beschreibung |
|-----------|--------------|
| `auto` | LLM schreibt `[DONE]` am Anfang der Antwort; System-Prompt instruiert das Modell |
| `phrase` | Benutzerdefinierte Stopp-Phrase (`terminationPhrase` im Frontmatter) |
| `tool` | LLM ruft explizit `finish_task({ summary })` auf; robusteste Methode |

**Persistenz während des Loops:** Nach jeder Iteration wird die Conversation-Datei gespeichert (async `onIterationEnd` → `saveConversation()`). Bei einem Absturz gehen maximal die Schritte der laufenden Iteration verloren.

## 6.9 Agent Canvas

```
Nutzer               Sidebar / Command    CanvasModal         CanvasAgent         Orchestrator       Vault
  │                        │                   │                   │                   │               │
  ├─▶ Canvas-Button / Cmd──▶│                   │                   │                   │               │
  │                        ├─ openCanvasModal──▶│                   │                   │               │
  │                        │                   ├─ getActiveEditorSelection()            │               │
  │                        │                   ├─ readFrontmatter()                     │               │
  │                        │                   ├─ buildInitialPrompt / buildSelectionPrompt              │
  │                        │                   │                   ├─ read(file)────────────────────────▶│
  │                        │                   │                   │◀─ Dokumentinhalt───────────────────┤
  │                        │                   │                   ├─ stripCanvasCallouts()              │
  │                        │                   ├─ continueConversation───────────────────▶│              │
  │                        │                   │◀─ onToken (stream)─────────────────────┤│              │
  │◀─ Streaming im Modal───┤◀─ Tokens──────────┤                   │                   ││              │
  │                        │                   │◀─ onComplete──────────────────────────┤│              │
  │                        │                   ├─ appendAgentCallout()                  │               │
  │                        │                   │                   ├─ modify(file)──────────────────────▶│
  │◀─ Callout im Dokument──┤◀─────────────────┤◀──────────────────┤◀─ OK───────────────────────────────┤
```

**Follow-up-Nachrichten:** Der Nutzer tippt im Modal; `appendUserCallout()` schreibt den User-Callout ins Dokument, danach wird die nächste `continueConversation()`-Runde gestartet.

**Multi-Agenten-Canvas:** Bei mehreren ausgewählten Agenten wiederholt `startMultiAgentSession()` den obigen Ablauf für jeden Agenten sequenziell mit eigener Konversation.

---

**Zurück:** [Bausteinsicht ←](05-bausteinsicht.md) | **Weiter:** [Verteilungssicht →](07-verteilungssicht.md)
