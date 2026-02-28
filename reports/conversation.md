# Conversation Mechanics – Überarbeitung

## Problembeschreibung

Zwei Probleme wurden im Issue gemeldet:

1. **Bug**: Das Erstellen einer Conversation über den Obsidian-Command führte zu einem Fehler: `C.view.loadFile is not a function`
2. **Feature**: Jede Conversation, die über die ChatView geführt wird, soll als Markdown-Datei gespeichert und wieder ladbar sein.

---

## Ursachenanalyse

### Bug (Fehler beim Erstellen einer Conversation)

Die Konstante `VIEW_TYPE_CHAT` in `src/ui/chat-view.ts` hatte denselben Stringwert (`"paper-agents-chat"`) wie `VIEW_TYPE_PAPER_AGENTS_CHAT` in `src/ui/chat.ts`. Außerdem war `VIEW_TYPE_CHAT` nie mit `registerView()` in `main.ts` registriert.

**Ablauf des Fehlers:**
1. Nutzer ruft den Command "New conversation" auf
2. `createNewConversation()` erstellt eine Markdown-Datei und ruft `openChatView(filePath)` auf
3. `openChatView()` sucht nach Leaves vom Typ `VIEW_TYPE_CHAT` (`"paper-agents-chat"`)
4. Es findet die registrierte `PaperAgentsChatView` (ebenfalls `"paper-agents-chat"`)
5. Es versucht `view.loadFile(filePath)` aufzurufen – diese Methode existiert nur in `ChatView`, nicht in `PaperAgentsChatView`
6. → Fehler: `C.view.loadFile is not a function`

### Zusätzliches Problem: Duplikate Command-ID

In `commands/index.ts` und in `main.ts` waren beide Commands mit der ID `"open-chat"` registriert, was zu Konflikten führte.

---

## Durchgeführte Änderungen

### 1. `src/ui/chat-view.ts`
- `VIEW_TYPE_CHAT` von `"paper-agents-chat"` auf `"paper-agents-chat-file"` geändert, um die Kollision mit `VIEW_TYPE_PAPER_AGENTS_CHAT` zu beseitigen.

### 2. `src/main.ts`
- **`VIEW_TYPE_CHAT` registriert**: `ChatView` wird nun korrekt für den Typ `"paper-agents-chat-file"` registriert.
- **`createNewConversation()` vereinfacht**: Statt eine Datei mit dem Agenten "default" (der keinem echten Agenten entspricht) zu erstellen und dann die kaputte `ChatView`-Route zu öffnen, öffnet der Command jetzt direkt `PaperAgentsChatView`. Die Markdown-Datei wird automatisch angelegt, sobald der Nutzer einen Agenten auswählt und eine Unterhaltung startet.
- **Duplikat Command-ID behoben**: Der Command in `main.ts` zum Öffnen der aktuellen Datei als Chat wurde von `"open-chat"` auf `"open-file-as-chat"` umbenannt.
- **`ConversationFileManager`-Import entfernt**: Da `main.ts` den `ConversationFileManager` nicht mehr direkt nutzt, wurde der Import bereinigt.

### 3. `src/ui/chat.ts` (`PaperAgentsChatView`)
- **`ConversationFileManager` integriert**: Die View erstellt und speichert Conversations als Markdown-Dateien im Vault.
- **`getConversationsPath: () => string` Callback**: Neuer Konstruktor-Parameter, der den konfigurierten Pfad für Conversations-Dateien liefert.
- **`currentFilePath` Feld**: Speichert den Pfad zur aktuellen Markdown-Datei.
- **`startNewConversation()` erweitert**: Ruft intern `createConversationFile()` auf, das eine Markdown-Datei im Vault-Ordner anlegt (mit YAML-Frontmatter und Agenten-Metadaten).
- **`sendMessage()` erweitert**: Ruft nach jedem erfolgreichen Nachrichtenaustausch `saveConversation()` auf, um die Unterhaltung in die Markdown-Datei zu schreiben.
- **`saveConversation()` (privat)**: Speichert die aktuelle Conversation über `ConversationFileManager` in die Markdown-Datei.
- **`createConversationFile()` (privat)**: Erstellt die initiale Markdown-Datei für eine neue Conversation.

---

## Markdown-Format der Conversations

Die gespeicherten Dateien liegen unter dem konfigurierten Pfad (Standard: `paper-agents-conversations/`) und haben folgendes Format:

```markdown
---
conversation: true
id: conv_1234567890_abcdefghi
agentId: research_assistant
createdAt: 2026-01-01T10:00:00.000Z
updatedAt: 2026-01-01T10:05:00.000Z
---

### User (2026-01-01T10:00:00.000Z)
Hallo!

### Assistant (2026-01-01T10:01:00.000Z)
Hallo! Wie kann ich helfen?
```

---

## Stand der Arbeiten

| Aufgabe | Status |
|---------|--------|
| Bug: `loadFile is not a function` behoben | ✅ Erledigt |
| `VIEW_TYPE_CHAT` Kollision behoben | ✅ Erledigt |
| `VIEW_TYPE_CHAT` registriert | ✅ Erledigt |
| Markdown-Speicherung in `PaperAgentsChatView` | ✅ Erledigt |
| Conversation-Datei beim Gesprächsstart anlegen | ✅ Erledigt |
| Conversation nach jeder Nachricht speichern | ✅ Erledigt |
| Duplikate Command-ID behoben | ✅ Erledigt |
| Alle vorhandenen Tests bestehen (244/244) | ✅ Erledigt |

---

## Bekannte Einschränkungen / Offene Punkte

- **Laden einer Conversation aus Datei in PaperAgentsChatView**: Über den Command "Open current file as conversation chat" (`open-file-as-chat`) kann eine Markdown-Datei in `ChatView` geöffnet werden. Die Anbindung an `PaperAgentsChatView` (mit LLM-Integration) für das Laden bestehender Conversations ist noch nicht implementiert.
- **ChatView (chat-view.ts)**: Hat noch keine echte LLM-Integration (nur Stub). Die `PaperAgentsChatView` ist die vollständige Chat-UI mit OpenRouter-Integration.
- **Agenten-Selektion beim "New conversation"-Command**: Der Command öffnet `PaperAgentsChatView` ohne Vorauswahl eines Agenten – der Nutzer muss selbst einen auswählen.
