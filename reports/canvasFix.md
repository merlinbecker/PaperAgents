# Canvas Fix Report

**Datum:** 2026-03-22  
**Issue:** Agent Canvas sendet das aktuelle Dokument nicht mit  
**Status:** ✅ Behoben

---

## 1. Problembeschreibung

Beim Starten einer Canvas-Session (Kommando „Apply interactive agent to document") wurde der Inhalt des aktuellen Dokuments nicht im POST-Request an das LLM gesendet. Der Agent erhielt lediglich den System-Prompt aus der Agent-Definition, aber nicht das Dokument, das analysiert werden sollte.

## 2. Ursachenanalyse

### Root Cause

Der Dokumentinhalt wird im Canvas-Flow als User-Message über `orchestrator.sendMessage()` an das LLM gesendet. Intern nutzt die Methode `buildLLMMessages()` den `ConversationManager.getMessagesForContext()`, um die Nachrichten für den LLM-Kontext zu ermitteln. Diese Methode filtert Nachrichten anhand der Memory-Konfiguration des Agenten:

1. **`memory.type === "none"`**: Alle Nachrichten werden verworfen → Dokument wird nicht gesendet
2. **Token-Budget überschritten** (`maxTokens` Standard: 4000 ≈ 16.000 Zeichen): Große Dokumente überschreiten das Budget und werden ebenfalls verworfen

### Betroffener Code

```
src/core/orchestrator.ts → buildLLMMessages() → getMessagesForContext()
```

Die Methode `getMessagesForContext()` gibt bei `type: "none"` ein leeres Array zurück. Bei `type: "conversation"` iteriert sie rückwärts und bricht ab, sobald eine Nachricht das verfügbare Token-Budget übersteigt. In beiden Fällen erreicht die User-Message mit dem Dokumentinhalt das LLM nicht.

## 3. Durchgeführte Änderungen

### 3.1 Core Fix: Fallback in `buildLLMMessages()` (orchestrator.ts)

**Änderung:** Nach dem Aufruf von `getMessagesForContext()` wird geprüft, ob das Ergebnis leer ist. In diesem Fall werden alle Konversationsnachrichten direkt geladen, um sicherzustellen, dass die aktuelle User-Message immer im LLM-Request enthalten ist.

```typescript
let contextMessages = this.conversationManager.getMessagesForContext(
  conversationId, agent.memory, agent.systemPrompt
);

// Fallback: wenn Memory-Filter alles verwirft, alle Nachrichten einbeziehen
if (contextMessages.length === 0) {
  contextMessages = this.conversationManager.getMessages(conversationId);
}
```

### 3.2 Multi-Agent Custom System Prompt (canvas-modal.ts)

**Problem:** `startMultiAgentSession()` verwendete immer den Standard-System-Prompt (`buildInitialPrompt()`), während `startSession()` den konfigurierten Custom System Prompt lud.

**Fix:** Custom System Prompt wird nun auch im Multi-Agent-Modus geladen und angewendet.

### 3.3 Clean-Code-Refactoring (canvas-modal.ts)

| Änderung | Beschreibung |
|----------|-------------|
| `buildDocumentPrompt()` extrahiert | Gemeinsame Methode für Prompt-Erstellung. Eliminiert Duplikation in `startSession()`, `startMultiAgentSession()` und `rerunForFollowUp()` |
| `showConversationPanel()` extrahiert | Gemeinsame Methode für Panel-Sichtbarkeit und Diff-Button-Rendering |
| `sessionStarted` entfernt | Ungenutztes Property (zugewiesen aber nie gelesen) |
| Button-Reset in `startSession()` | Catch-Block stellt Button bei Fehler vor `sendToAgent()` wieder her |

### 3.4 Tests hinzugefügt (orchestrator.spec.ts)

Zwei neue Tests validieren den Fix:

1. **`includes user message in LLM request even when agent memory type is none`**: Prüft, dass bei `memory.type === "none"` die User-Message trotzdem im Request enthalten ist
2. **`includes user message when token budget is exceeded by a large document`**: Prüft, dass ein großes Dokument auch bei kleinem Token-Budget gesendet wird

## 4. Arc42-Abgleich

Die Canvas-Implementierung wurde gegen die arc42-Dokumentation (Kapitel 5, 6, 8, 9) geprüft:

| Anforderung (arc42) | Status | Anmerkung |
|---------------------|--------|-----------|
| Dokument-Content als LLM-Kontext | ✅ Behoben | War der Kernfehler |
| Canvas-Callouts strippen vor Re-Analyse | ✅ OK | `buildDocumentContext()` funktioniert korrekt |
| Frontmatter Agent-Erkennung | ✅ OK | `extractAgentId()` und MetadataCache |
| Inline Placement Hints | ✅ OK | `@after-paragraph-N:` korrekt implementiert |
| Multi-Agent sequentielle Ausführung | ✅ Verbessert | Custom System Prompt wird nun berücksichtigt |
| Diff-View | ✅ OK | Callout-Extraktion und Statistiken |
| Custom System Prompt | ✅ Verbessert | Konsistent in allen Session-Modi |
| Callout Dismiss (🗑️) | ✅ OK | Exakte Textübereinstimmung für Löschung |

## 5. Geänderte Dateien

| Datei | Änderungstyp |
|-------|-------------|
| `src/core/orchestrator.ts` | Bugfix: Fallback für leeren Message-Kontext |
| `src/ui/canvas-modal.ts` | Bugfix + Refactoring: Custom System Prompt, Duplikationsentfernung |
| `tests/unit/core/orchestrator.spec.ts` | Neue Tests für den Fallback-Mechanismus |
| `reports/canvasFix.md` | Dokumentation (dieses Dokument) |

## 6. Testabdeckung

- **Vor Fix:** 490 Tests bestanden
- **Nach Fix:** 492 Tests bestanden (+2 neue)
- **Keine Regressionen**
