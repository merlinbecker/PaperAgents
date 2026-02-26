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

## 6.4 Agenten-Konversation (Geplant, Phase 4.3)

```
Nutzer               ConversationManager    OpenRouter API       Tool-Executor
  │                       │                      │                    │
  ├─User-Nachricht────────▶│                      │                    │
  │                       ├─Add to Memory────────▶│                    │
  │                       ├─Build Context────────▶│                    │
  │                       ├─Format Messages──────▶│                    │
  │                       ├─LLM Request──────────▶│                    │
  │                       │◀─LLM Response─────────┤                    │
  │                       ├─Tool Detection───────▶│                    │
  │                       │                      ├─Tool Execution────▶│
  │                       │                      │◀─Tool Result───────┤
  │                       ├─Format for LLM───────▶│                    │
  │                       ├─Continue Chat────────▶│                    │
  │◀─Agent Answer────────┤                      │                    │
```

---

**Zurück:** [Bausteinsicht ←](05-bausteinsicht.md) | **Weiter:** [Verteilungssicht →](07-verteilungssicht.md)
