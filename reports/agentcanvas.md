# Agent Canvas – Tätigkeitsbericht

## Zusammenfassung

Der Plan in `plans/agentcanvas.md` wurde vollständig durch Phase 3 ergänzt. Phase 1 (Core-Implementierung) und Phase 2 (Callout-Löschung) waren bereits abgeschlossen. In diesem Durchgang wurde Phase 3 umgesetzt: **Selektions-Kontext (Selection-scoped context)**. Alle 367 Tests (davon 35 speziell für den Canvas-Agent) laufen durch, und der Build schlägt fehlerfrei.

---

## Umgesetzte Tätigkeiten

### Phase 1 – Core-Implementierung (bereits fertig)

| Datei | Tätigkeit | Status |
|---|---|---|
| `src/core/canvas-agent.ts` | Neuer Service `CanvasAgent`: Dokument lesen, Canvas-Callouts herausfiltern, Agent- und User-Callouts anhängen, Frontmatter-Auswertung, Kontext-Prompt aufbauen | ✅ Fertig |
| `src/ui/canvas-modal.ts` | Neues Modal `CanvasModal`: Agent-Auswahl (automatisch via Frontmatter oder Dropdown), Streaming-Anzeige, Eingabe für Follow-ups, Callout-Schreiben ins Dokument | ✅ Fertig |
| `src/commands/index.ts` | Command `apply-agent-canvas` (Command-Palette: „Apply interactive agent to document") registriert; `openCanvasModal()`-Hilfsfunktion hinzugefügt | ✅ Fertig |
| `src/ui/sidebar.ts` | Canvas-Button 🖊️ im Sidebar-Header ergänzt; `setOnOpenCanvas()`-Methode und `onOpenCanvas`-Property implementiert | ✅ Fertig |
| `src/main.ts` | Methode `activateCanvas()` implementiert; `sidebar.setOnOpenCanvas()`-Callback verdrahtet; Import von `CanvasModal` und `CanvasAgent` ergänzt | ✅ Fertig |
| `tests/unit/core/canvas-agent.spec.ts` | 24 Unit-Tests für `CanvasAgent` (Phase 1) | ✅ Fertig |

### Phase 2 – Callout Dismissal (bereits fertig)

| Datei | Tätigkeit | Status |
|---|---|---|
| `src/core/canvas-agent.ts` | Rückgabetyp von `appendAgentCallout` und `appendUserCallout` von `Promise<void>` auf `Promise<string>` geändert – die Methoden geben jetzt den exakten Callout-Text zurück, der angehängt wurde | ✅ Fertig |
| `src/core/canvas-agent.ts` | Neue Methode `removeCallout(file, calloutText): Promise<boolean>` – entfernt den genauen Callout-Block aus dem Dokument anhand des gespeicherten Callout-Texts; gibt `true` zurück, wenn das Callout gefunden und entfernt wurde | ✅ Fertig |
| `src/ui/canvas-modal.ts` | `addMessageToDisplay()` erhält optionalen Parameter `calloutText`; wenn übergeben, wird ein 🗑️-Dismiss-Button in den Message-Header eingefügt | ✅ Fertig |
| `src/ui/canvas-modal.ts` | Neue private Methode `dismissCallout(file, calloutText, entryEl)` – ruft `canvasAgent.removeCallout()` auf und entfernt das Element aus dem Modal bei Erfolg | ✅ Fertig |
| `styles.css` | CSS-Klassen für das Canvas Modal hinzugefügt: Layout, Nachrichten-Anzeige, Dismiss-Button, Streaming-Bereich, Eingabefeld, Sende-Button | ✅ Fertig |
| `tests/unit/core/canvas-agent.spec.ts` | 5 neue Tests: Rückgabewert von `appendAgentCallout` und `appendUserCallout`; 3 Tests für `removeCallout` | ✅ Fertig |

### Phase 3 – Selektions-Kontext

| Datei | Tätigkeit | Status |
|---|---|---|
| `src/core/canvas-agent.ts` | Neue Methode `getActiveEditorSelection(): string \| null` – liest die aktuelle Textselektion aus dem aktiven Editor via `workspace.activeEditor`; gibt `null` zurück wenn nichts selektiert ist | ✅ Fertig |
| `src/core/canvas-agent.ts` | Neue Methode `buildSelectionPrompt(selectionContent): string` – erstellt den Initialprompt für eine Selektions-basierte Konversation (analog zu `buildInitialPrompt`, aber mit `=== SELECTED TEXT ===` Rahmen) | ✅ Fertig |
| `src/ui/canvas-modal.ts` | `activeSelection`-Property ergänzt; in `onOpen()` wird `getActiveEditorSelection()` aufgerufen und gespeichert | ✅ Fertig |
| `src/ui/canvas-modal.ts` | `renderHeader()`: Wenn eine Selektion aktiv ist, wird ein Hinweis „✂️ Using selected text as context (N chars)" angezeigt | ✅ Fertig |
| `src/ui/canvas-modal.ts` | `renderStartButton()`: Button-Text ist „Analyze selection" statt „Start canvas session" wenn eine Selektion vorhanden | ✅ Fertig |
| `src/ui/canvas-modal.ts` | `startSession()`: Wenn `activeSelection` gesetzt ist, wird `buildSelectionPrompt()` statt `buildInitialPrompt()` verwendet; kein `readFile`-Aufruf nötig | ✅ Fertig |
| `styles.css` | Neue CSS-Klasse `.pa-canvas-selection-hint` für die Selektions-Anzeige im Header | ✅ Fertig |
| `tests/unit/core/canvas-agent.spec.ts` | 6 neue Tests: 4 für `getActiveEditorSelection` (mit Selektion, leer, nur Whitespace, kein Editor); 2 für `buildSelectionPrompt` | ✅ Fertig |

---

### Callout-Format (gemäß Spezifikation)

Agent-Callout:
```markdown
<!-- paper-agents-canvas -->
> [!note] 🤖 Agent: Research Assistant *(2026-01-01T10:05:00Z)*
>
> Agent response text here...
```

User-Callout:
```markdown
<!-- paper-agents-canvas -->
> [!question] 👤 User *(2026-01-01T10:07:00Z)*
>
> User reply here...
```

---

## Akzeptanzkriterien – Abgleich

| Kriterium | Status |
|---|---|
| Command `paper-agents:apply-agent-canvas` erscheint in der Command-Palette | ✅ |
| Sidebar zeigt Canvas-Button 🖊️, der das Canvas Modal öffnet | ✅ |
| Bei `paper-agent: <id>` im Frontmatter wird der Agent automatisch gewählt | ✅ |
| Ohne Frontmatter kann der Nutzer einen Agenten aus dem Dropdown wählen | ✅ |
| Dokumentinhalt wird beim Start als Kontext an den Agenten gesendet | ✅ |
| Agent-Antwort wird mit Name und Zeitstempel als Callout ans Dokument angehängt | ✅ |
| Follow-up-Nachrichten erscheinen als User-Callouts; Agenten-Antworten folgen | ✅ |
| Vorherige Canvas-Callouts werden beim Kontext-Aufbau ausgeblendet | ✅ |
| Streaming-Tokens sind im Modal sichtbar | ✅ |
| Fehlerbehandlung: kein API-Key → Notice; keine Agenten geladen → Notice | ✅ |
| Callout-Löschung: 🗑️-Button im Modal entfernt den Callout aus Dokument und Modal | ✅ |
| Selektions-Kontext: Wenn Text selektiert ist, wird nur die Selektion als Kontext gesendet | ✅ |

---

## Entscheidungen

| Entscheidung | Begründung |
|---|---|
| `vault.read()` + `vault.modify()` statt `vault.process()` für das Anhängen von Callouts | `vault.process()` ist eine neuere Vault-API, die nicht in allen Obsidian-Versionen verfügbar ist. Die Kombination aus `read()` + `modify()` ist breiter kompatibel und ausreichend für sequenzielle Schreibvorgänge. |
| Canvas-Callouts via `<!-- paper-agents-canvas -->`-Marker identifizieren | Ein HTML-Kommentar ist in Markdown unsichtbar, weder im Reading View noch im Preview. Er ist eindeutig und kollisionssicher gegenüber normalem Dokumentinhalt. |
| Callout-Injektion erst nach vollständigem Streaming | Partial-Writes würden ein kaputtes Callout-Format ins Dokument schreiben. Warten auf `onComplete` garantiert valides Markdown. |
| Obsidian `MetadataCache` für Frontmatter-Auflösung im Modal | Vermeidet einen asynchronen Vault-Read beim Modal-Öffnen. `MetadataCache` ist synchron und bereits indexiert. |
| Konversation wird über den bestehenden `ConversationManager` und `Orchestrator` abgewickelt | Kein Doppelcode. Der existierende Mechanismus übernimmt Konversationshistorie, Streaming und Tool-Calls ohne Anpassungen. |
| `appendAgentCallout`/`appendUserCallout` geben den Callout-Text zurück | Ermöglicht dem Aufrufer (Modal), den exakten Text für die spätere Löschung zu speichern, ohne ihn ein zweites Mal mit einem möglicherweise anderen Timestamp zu generieren. |
| `removeCallout` verwendet `String.replace()` mit dem exakten Callout-Text | Da der Callout-Text einen eindeutigen ISO-Timestamp enthält, ist ein falsches Entfernen praktisch ausgeschlossen. Kein komplexes Parsing erforderlich. |
| Dismiss-Button (`🗑️`) im Message-Header statt separatem Delete-Button außerhalb | Minimales UI-Footprint. Der Button ist sichtbar genug ohne den Lesefluss zu stören. |
| `workspace.activeEditor` per Duck-Typing für Selektions-Lesen | Vermeidet einen harten Import von `MarkdownView`, der den Test-Mock aufwendig erweitern würde. Die duck-typed Schnittstelle ist stabil genug für diesen read-only Zugriff. |
| `getActiveEditorSelection()` in `CanvasAgent` statt direkt im Modal | Klare Separation of Concerns: `CanvasAgent` kapselt alle Dokument-/Editor-Zugriffe; das Modal ist rein für UI zuständig. Ermöglicht einfacheres Unit-Testing. |

---

## Noch nicht umgesetzte Features

| Feature | Beschreibung | Phase |
|---|---|---|
| Inline-Platzierung | Agent-Antwort an einer bestimmten Stelle im Dokument einfügen (z.B. nach Absatz 3), statt immer ans Ende | Phase 4 |
| Dokument-Diff | Side-by-Side-Vergleich von Original und annotierter Version | Phase 4 |
| Multi-Agenten-Canvas | Mehrere Agenten gleichzeitig auf dasselbe Dokument anwenden und Annotationen zusammenführen | Phase 5 |

---

## Showstopper und Probleme

Keine blockierenden Probleme aufgetreten.

| Problem | Beschreibung | Lösung / Status |
|---|---|---|
| Kein `vault.process()` | Die in der Plan-Architektur erwähnte `vault.process()`-API steht nicht in allen Ziel-Versionen von Obsidian zur Verfügung | Ersetzt durch `vault.read()` + `vault.modify()` – funktional äquivalent für diesen Anwendungsfall |
| Streaming und Dokument-Write sind entkoppelt | Während des Streamings steht der finale Response-Text noch nicht fest | Callout wird erst in `onComplete` geschrieben; im Modal werden Tokens live angezeigt. Kein Showstopper, da im Plan so spezifiziert (FR-6) |
