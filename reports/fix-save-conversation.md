# Conversation Speicherung – Fehlerbehebung & Status

## Bearbeitete Issues

- **Fehler beim Speichern der Conversation-Datei** → `"Conversation not found"` / `"Failed to save conversation to file"`
- **Paper Agents Sidebar verschwindet** nach dem Versuch, eine Conversation zu speichern

---

## Ursachenanalyse (dieser PR)

### Primärer Fehler: Falscher `ConversationManager`

`ConversationFileManager` importierte und verwendete den **globalen `conversationManager`-Singleton** aus `conversation.ts`. `PaperAgentsChatView` hingegen erhält eine **eigene `ConversationManager`-Instanz** über den Konstruktor und arbeitet ausschließlich damit.

Ablauf des Fehlers:

1. Nutzer wählt einen Agenten aus → `startNewConversation()` erzeugt eine Conversation im **View-internen** Manager
2. Nutzer schickt eine Nachricht → `sendMessage()` ruft `saveConversation(filePath, conversationId)` auf
3. `ConversationFileManager.saveConversation()` sucht die ID im **globalen Singleton** → nicht vorhanden
4. Fehler: `"Conversation not found: conv_xxx"` wird geworfen
5. Der unbehandelte Fehler lässt den UI-Rendering-Zyklus von Obsidian abstürzen → Sidebar verschwindet

### Sekundärer Fehler: Doppelte Conversation anlegen

`ConversationFileManager.createConversationFile(agentId, path)` legte intern über den globalen Singleton eine **zweite, neue Conversation** an – anstatt die vom Aufrufer bereits erstellte zu verwenden. Die eigentlich aktive Conversation (`currentConversationId` der View) wurde damit nie in einer Datei gespeichert.

---

## Durchgeführte Änderungen (dieser PR)

### 1. `src/core/conversation-file-manager.ts`

- **Konstruktor geändert**: Nimmt jetzt eine `ConversationManager`-Instanz entgegen (`constructor(app: App, conversationManager: ConversationManager)`).
- **Globalen Singleton entfernt**: Alle internen Zugriffe auf `conversationManager` verwenden jetzt `this.conversationManager`.
- **`createConversationFile`-Signatur geändert**: Von `(agentId, path, title?)` auf `(conversationId, path, title?)` – verwendet eine **bestehende** Conversation, legt keine neue an.

### 2. `src/ui/chat.ts` (`PaperAgentsChatView`)

- Übergibt `this.conversationManager` an den `ConversationFileManager`-Konstruktor.
- Übergibt `this.currentConversationId` an `createConversationFile` (statt der Agent-ID).

### 3. `src/ui/chat-view.ts` (`ChatView`)

- Übergibt den globalen `conversationManager`-Singleton explizit an `ConversationFileManager` (dieser View ist konsistent mit dem Singleton).

### 4. `tests/mocks/obsidian.ts`

- Fehlende Methode `createFolder` zum Mock-`Vault` hinzugefügt.

### 5. `tests/unit/core/conversation-file-manager.spec.ts` (neu)

- 16 Unit-Tests für `ConversationFileManager`:
  - `saveConversation`: Neue Datei anlegen, überschreiben, Fehler bei unbekannter ID, Isolation vom Singleton
  - `loadConversation`: Aus Vault laden, Nicht-Conversation-Dateien ignorieren, Fehler bei fehlender Datei
  - `createConversationFile`: Markdown-Datei für bestehende Conversation anlegen, Agenten-ID als Dateiname, Fehler bei unbekannter Conversation, kein Duplikat im Manager
  - `isConversationFile`: Erkennung per Frontmatter
  - Round-Trip: Anlegen → Speichern → Laden in neuem Manager

---

## Gesamtübersicht der Arbeiten (alle PRs)

| Aufgabe | Status |
|---------|--------|
| Bug: `loadFile is not a function` behoben | ✅ Erledigt |
| `VIEW_TYPE_CHAT`-Kollision behoben (`"paper-agents-chat"` → `"paper-agents-chat-file"`) | ✅ Erledigt |
| `VIEW_TYPE_CHAT` in `main.ts` registriert | ✅ Erledigt |
| Duplikat Command-ID (`"open-chat"` → `"open-file-as-chat"`) behoben | ✅ Erledigt |
| `ConversationFileManager` nutzte globalen Singleton statt injizierter Instanz | ✅ Erledigt |
| `createConversationFile` legte Duplikat-Conversation an | ✅ Erledigt |
| Markdown-Speicherung in `PaperAgentsChatView` nach jeder Nachricht | ✅ Erledigt |
| Conversation-Datei beim Gesprächsstart anlegen | ✅ Erledigt |
| `createFolder` im Obsidian-Mock ergänzt | ✅ Erledigt |
| Unit-Tests für `ConversationFileManager` (16 Tests) | ✅ Erledigt |
| Alle Tests bestehen (260/260) | ✅ Erledigt |

---

## Offene Punkte

| Aufgabe | Priorität | Beschreibung |
|---------|-----------|--------------|
| Bestehende Conversation aus Datei in `PaperAgentsChatView` laden | Mittel | Der Command `open-file-as-chat` öffnet eine Markdown-Datei nur in der einfachen `ChatView` (ohne LLM). Das Laden in `PaperAgentsChatView` (mit OpenRouter-Integration) ist noch nicht implementiert. |
| LLM-Integration in `ChatView` (`chat-view.ts`) | Niedrig | `ChatView` enthält nur einen Stub für die Antwortgenerierung. Die vollständige LLM-Anbindung ist in `PaperAgentsChatView` implementiert; `ChatView` dient aktuell nur als Datei-Viewer. |
| Agenten-Vorauswahl beim "New conversation"-Command | Niedrig | Der Command öffnet `PaperAgentsChatView` ohne vorausgewählten Agenten – der Nutzer muss manuell auswählen. |
| Bestehende Conversations beim View-Öffnen aus Dateien wiederherstellen | Mittel | Nach einem Obsidian-Neustart werden Conversations aus den gespeicherten JSON-Daten (`conversations.json`) geladen, aber nicht aus den Markdown-Dateien. Eine Synchronisation beider Quellen fehlt noch. |

---

## Markdown-Format gespeicherter Conversations

Dateien liegen unter dem konfigurierten Pfad (Standard: `paper-agents-conversations/`):

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
