# Agent Canvas – Arbeitsstand und offene Punkte

**Datum:** 2026-03-09  
**Branch:** `copilot/add-agentcanvas-markdown-support`

---

## Umgesetzte Änderungen

### 1. Canvas Markdown aus Ordner laden (Modal-Erweiterung)
Das Agent Canvas Modal kann jetzt Markdown-Dateien direkt aus einem konfigurierbaren Ordner laden, anstatt ausschließlich das aktuell geöffnete Dokument zu verwenden.

- **Wo:** `src/ui/canvas-modal.ts` – neue Methode `renderCanvasFilePicker()`
- Wenn in den Settings ein `canvasMarkdownPath` hinterlegt ist und der Ordner mindestens eine `.md`-Datei enthält, wird im Header des Modals ein Dropdown mit allen verfügbaren Dateien angezeigt.
- Per Klick auf „Load" wird die ausgewählte Datei als aktives Dokument für die Canvas-Session gesetzt.
- **Einstellung:** Settings → Agent Canvas → *Canvas Markdowns path* (Standard: `paper-agents-canvas`)

### 2. Aktion „Re-run for follow-up"
Nutzer können eine Canvas-Analyse erneut starten, nachdem das Dokument bereits mit Callouts angereichert wurde.

- **Wo:** `src/ui/canvas-modal.ts` – neue Methode `rerunForFollowUp()`, neuer Button `🔄 Re-run document analysis (follow-up)`
- Der Button erscheint nach Abschluss der ersten Session im Konversations-Panel.
- Beim Klick wird das Dokument neu eingelesen, bestehende Canvas-Callouts werden herausgefiltert (`buildDocumentContext()`), und eine neue Konversation mit dem Agenten wird gestartet.
- Im Antwort-Panel wird ein Trenner `── Follow-up pass: <Agent-Name> ──` eingefügt.

### 3. Konfigurierbarer System-Prompt (Markdown-Datei)
Der System-Prompt für Canvas-Sessions kann jetzt über eine Markdown-Datei individuell angepasst werden.

- **Wo:** `src/core/canvas-agent.ts` – neue Methode `buildInitialPromptWithSystem(docContent, systemPrompt)`
- `buildInitialPrompt()` nutzt intern weiterhin den eingebauten Standard-Prompt.
- Im Modal liest `loadSystemPrompt()` den Inhalt der konfigurierten Datei (YAML-Frontmatter wird automatisch entfernt).
- Falls kein Prompt konfiguriert ist, wird der eingebaute Standard verwendet.
- **Einstellung:** Settings → Agent Canvas → *Canvas system prompt file* (z. B. `paper-agents-canvas/canvas-system-prompt.md`)

### 4. Settings-Tab erweitert
Ein neuer Abschnitt „Agent Canvas" wurde in den Plugin-Settings ergänzt.

- **Wo:** `src/settings.ts`
- Felder: `canvasMarkdownPath` und `canvasSystemPromptFile`
- Beide Felder mit Beschreibung und Platzhalter-Text
- Die Beschreibung zum System-Prompt-Feld verweist auf das Sidebar-Beispiel.

### 5. Sidebar-Beispiel: Canvas System Prompt
Ein neues Beispiel wurde den Sidebar-Beispielen hinzugefügt.

- **Wo:** `src/ui/sidebar-examples.ts`
- Gruppe: „Agent Canvas", Dateiname: `canvas-system-prompt.md`
- Enthält einen vollständigen, einsatzbereiten Review-Prompt als Vorlage.
- Anleitung zum Einrichten (Dateipfad in Settings eintragen) direkt im `usageHint`.

---

## Technische Details

| Datei | Änderung |
|---|---|
| `src/utils/constants.ts` | `DEFAULT_PATHS.CANVAS_MARKDOWNS = "paper-agents-canvas"` hinzugefügt |
| `src/settings.ts` | `canvasMarkdownPath` und `canvasSystemPromptFile` in Interface, Defaults und Settings-UI |
| `src/core/canvas-agent.ts` | `buildInitialPromptWithSystem()` hinzugefügt; `buildInitialPrompt()` delegiert intern |
| `src/ui/canvas-modal.ts` | `CanvasModalSettings`-Interface; Datei-Picker; Re-run-Button; `loadSystemPrompt()`; `rerunForFollowUp()` |
| `src/main.ts` | Canvas-Settings an `CanvasModal` weitergegeben |
| `src/commands/index.ts` | Canvas-Settings an `CanvasModal` weitergegeben |
| `src/ui/sidebar-examples.ts` | Beispiel `canvas-system-prompt` hinzugefügt |

---

## Offene Punkte

1. **UI-Styling für neue Elemente:** Der Datei-Picker und der Re-run-Button sind funktional, aber noch ohne dedizierte CSS-Klassen in `styles.css`. Visuelle Anpassungen (z. B. Abstände, Farben) können in einem folgenden Schritt ergänzt werden.

2. **Multi-Agenten-Modus + Custom System Prompt:** Im Multi-Agenten-Modus (`startMultiAgentSession()`) wird der benutzerdefinierte System-Prompt noch nicht berücksichtigt. Dies sollte konsistent mit dem Einzelagenten-Modus gemacht werden.

3. **Validierung des System-Prompt-Dateipfads:** Es gibt keine Live-Validierung im Settings-Tab, ob die angegebene Datei tatsächlich existiert. Eine optionale Schaltfläche „Validate" (analog zur API-Key-Validierung) könnte die Usability verbessern.

4. **Automatisches Laden aus Canvas-Ordner beim Start:** Wenn kein aktives Dokument vorhanden ist, aber Dateien im Canvas-Ordner liegen, könnte das Modal die erste Datei automatisch vorladen (opt-in).

5. **Tests für neue Canvas-Modal-Features:** Die Unit-Tests für `CanvasAgent` wurden um Tests für `buildInitialPromptWithSystem()` erweitert. Tests für die UI-Logik des Modals (Datei-Picker, Re-run-Button) sind aufgrund der Obsidian-UI-Abhängigkeiten nicht ohne weiteres in der bestehenden Test-Infrastruktur abdeckbar.
