# Conversation Rework – Ergebnis-Dokumentation

## Ziel

Konversationen sollen im Chat-Fenster ausschließlich über Markdown-Dateien geladen und gespeichert werden. Ändert sich die Markdown-Datei, muss sich der Chat ändern, und umgekehrt. Die Auswahl der Chats entspricht der Auswahl aller Markdown-Dateien im konfigurierten Conversations-Ordner.

---

## Durchgeführte Arbeiten

### 1. `src/ui/chat.ts` – `PaperAgentsChatView` vollständig überarbeitet

**Vorher:** Dropdown zeigte alle geladenen Agenten; Konversationen wurden sowohl im Arbeitsspeicher (ConversationManager JSON-Persistenz) als auch in Markdown-Dateien gespeichert.

**Nachher:**
- Neues Haupt-Dropdown **„Conversation"** listet alle `.md`-Dateien aus dem konfigurierten Conversations-Ordner. Titel = Dateiname ohne Endung.
- Wählt der Benutzer eine Datei aus, wird die Konversation exklusiv aus dieser Markdown-Datei geladen.
- Jede gesendete Nachricht wird sofort in die Markdown-Datei zurückgeschrieben.
- Vault-Event-Listener `vault.on('modify')` erkennt externe Änderungen an der aktuell geöffneten Datei und lädt die Konversation automatisch neu (bidirektionale Synchronisierung). Ein `isSaving`-Flag verhindert einen Reload-Loop bei eigenem Speichern.
- Vault-Events `create`, `delete`, `rename` aktualisieren das Conversation-Dropdown.
- **„New Chat"**-Button öffnet ein Inline-Panel zur Agenten-Auswahl und erstellt eine neue Markdown-Datei, die danach direkt ausgewählt wird.
- Methode `selectConversationFile(path)` ist public, damit externe Aufrufer (z. B. Plugin-Commands) eine Konversation direkt laden können.

### 2. `src/core/conversation-file-manager.ts` – neue Methode `listConversationFiles`

```typescript
listConversationFiles(folderPath: string): { path: string; title: string }[]
```

Gibt alle `.md`-Dateien im angegebenen Ordner als `{ path, title }` zurück, alphabetisch nach Titel sortiert. Wird von `PaperAgentsChatView` verwendet, um das Dropdown zu befüllen.

### 3. `src/core/conversation.ts` – JSON-Persistenz entfernt

Die Methoden `setPersistence`, `scheduleSave`, `saveToStorage` und `loadFromStorage` wurden entfernt, da Markdown jetzt die einzige Quelle der Wahrheit ist. Aufrufe von `this.scheduleSave()` in `createConversation`, `deleteConversation`, `addMessage` und `clearMessages` wurden ebenfalls entfernt.

### 4. `src/core/persistence.ts` – `initializeConversationPersistence` entfernt

Da keine JSON-Persistenz für Konversationen mehr benötigt wird, wurde `initializeConversationPersistence` aus `persistence.ts` entfernt. Die History-Persistenz (`initializeHistoryPersistence`) bleibt unverändert.

### 5. `src/ui/chat-view.ts` – gelöscht

Die veraltete `ChatView` (einfaches Lese-View ohne vollständige LLM-Unterstützung) wurde vollständig entfernt.

### 6. `src/main.ts` – Bereinigung

- Import und Registrierung von `ChatView` / `VIEW_TYPE_CHAT` entfernt
- Import von `initializeConversationPersistence` entfernt
- Methoden `restoreConversationsFromFiles`, `openChatView`, `createNewConversation` entfernt
- Kommandos `open-file-as-chat` und `new-conversation` entfernt (Funktionalität ist jetzt direkt in der Chat-View integriert)
- `this.conversationManager.saveToStorage()` aus `onunload` entfernt

### 7. Tests

Vier neue Unit-Tests für `listConversationFiles` in `tests/unit/core/conversation-file-manager.spec.ts`:
- Leerer Ordner / nicht vorhandener Ordner → leeres Array
- Dateien werden alphabetisch nach Titel sortiert zurückgegeben
- `path` und `title` (Basename ohne `.md`) korrekt gesetzt
- Dateien, die per `createConversationFile` erstellt wurden, erscheinen in der Liste

**Testergebnis:** 266/266 Tests bestanden.

---

## Offene Punkte

1. **Vault-Event-Granularität:** `vault.on('create')` / `delete` / `rename` lösen ein vollständiges Refresh des Conversation-Dropdowns aus, auch wenn die betroffene Datei nicht im Conversations-Ordner liegt. Für große Vaults könnte eine Pfadfilterung sinnvoll sein.

2. **Neue Konversation ohne Agenten:** Wenn kein Agent geladen ist (leer oder keine Agents-Dateien im Vault), bleibt das „Create"-Panel ohne auswählbaren Agenten. Ein klareres Nutzerfeedback (Hinweistext, deaktivierter Button) wäre wünschenswert.

3. **Dateiumbenennungen:** Bei Umbenennung einer aktuell geöffneten Konversationsdatei außerhalb des Chat-Views wird `currentFilePath` nun automatisch aktualisiert via `vault.on('rename')`. Das Dropdown wird ebenfalls aktualisiert.

4. **Kein automatisches Laden beim Öffnen:** Beim Öffnen der Chat-View wird keine Konversation automatisch ausgewählt. Sinnvoll wäre es, die zuletzt verwendete Konversation (gespeichert im Plugin-State) automatisch zu laden.
