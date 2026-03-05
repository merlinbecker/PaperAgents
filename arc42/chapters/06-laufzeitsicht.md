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

---

**Zurück:** [Bausteinsicht ←](05-bausteinsicht.md) | **Weiter:** [Verteilungssicht →](07-verteilungssicht.md)
