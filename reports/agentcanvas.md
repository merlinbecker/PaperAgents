# Agent Canvas – Tätigkeitsbericht

## Zusammenfassung

Der Plan in `plans/agentcanvas.md` wurde vollständig durch Phase 5 ergänzt und ist damit abgeschlossen. Phase 1 (Core-Implementierung), Phase 2 (Callout-Löschung) und Phase 3 (Selektions-Kontext) waren bereits abgeschlossen. In diesem Durchgang wurden Phase 4 (**Inline-Platzierungs-Hints** und **Dokument-Diff-Ansicht**) und Phase 5 (**Multi-Agenten-Canvas**) umgesetzt. Alle 385 Tests (davon 53 speziell für den Canvas-Agent) laufen durch, und der Build schlägt fehlerfrei.

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

### Phase 3 – Selektions-Kontext (bereits fertig)

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

### Phase 4 – Inline-Platzierung und Diff-Ansicht

| Datei | Tätigkeit | Status |
|---|---|---|
| `src/core/canvas-agent.ts` | `buildInitialPrompt()` erweitert: Instruktionen für `@after-paragraph-N:`-Syntax aufgenommen | ✅ Fertig |
| `src/core/canvas-agent.ts` | Neue Methode `parseInlinePlacement(responseText)`: parst `@after-paragraph-N:` vom Anfang der Agent-Antwort; gibt `{ paragraphIndex, cleanedText }` zurück | ✅ Fertig |
| `src/core/canvas-agent.ts` | Neue Methode `insertCalloutAfterParagraph(content, calloutText, N)`: fügt den Callout nach dem N-ten Absatz ein; fällt auf Anhängen zurück wenn N außerhalb des Bereichs liegt | ✅ Fertig |
| `src/core/canvas-agent.ts` | `appendAgentCallout()` aktualisiert: nutzt `parseInlinePlacement` + `insertCalloutAfterParagraph` bei vorhandenem Hint; gibt weiterhin den Callout-Text zurück (kompatibel mit `removeCallout`) | ✅ Fertig |
| `src/core/canvas-agent.ts` | Neue Methode `extractCanvasCallouts(content)`: extrahiert alle Canvas-Callout-Blöcke aus dem Dokumentinhalt; gibt Array mit `{ type, raw, title, body }` zurück | ✅ Fertig |
| `src/ui/canvas-modal.ts` | `originalDocumentContent`-Property: speichert den Dokumentinhalt beim Session-Start | ✅ Fertig |
| `src/ui/canvas-modal.ts` | `renderDiffButton()`: rendert den „📊 View diff"-Button nach Session-Start; togglet die Diff-Sektion | ✅ Fertig |
| `src/ui/canvas-modal.ts` | `renderDiffView(container)`: liest aktuellen Dokumentinhalt, ruft `extractCanvasCallouts()` auf und zeigt Statistiken (Zeilenanzahl original → aktuell) und Liste aller Callouts mit Titel und gekürztem Body | ✅ Fertig |
| `src/ui/canvas-modal.ts` | `diffSection`-UI-Element: separater Div unterhalb der Konversation, initial versteckt | ✅ Fertig |
| `styles.css` | Neue CSS-Klassen: `.pa-canvas-diff-section`, `.pa-canvas-diff-btn`, `.pa-canvas-diff-content`, `.pa-canvas-diff-header`, `.pa-canvas-diff-stats`, `.pa-canvas-diff-empty`, `.pa-canvas-diff-error`, `.pa-canvas-diff-list`, `.pa-canvas-diff-callout`, `.pa-canvas-diff-callout-title`, `.pa-canvas-diff-callout-body` | ✅ Fertig |
| `tests/unit/core/canvas-agent.spec.ts` | 6 neue Tests für `parseInlinePlacement` (ohne Hint, mit Hint+Zahl, mit Newline-Separator, N=0, mittig, case-insensitive) | ✅ Fertig |
| `tests/unit/core/canvas-agent.spec.ts` | 4 neue Tests für `insertCalloutAfterParagraph` (nach Para 1, nach Para 2, außerhalb Bereich, Inhalt vollständig) | ✅ Fertig |
| `tests/unit/core/canvas-agent.spec.ts` | 3 neue Tests für `appendAgentCallout` mit Inline-Placement-Hint (Anhängen ohne Hint, Einfügen mit Hint, Rückgabewert ohne Hint) | ✅ Fertig |
| `tests/unit/core/canvas-agent.spec.ts` | 4 neue Tests für `extractCanvasCallouts` (keine Callouts, ein Agent-Callout, Agent + User-Callout, Titel-Extraktion) | ✅ Fertig |
| `tests/unit/core/canvas-agent.spec.ts` | 1 neuer Test für `buildInitialPrompt` Phase-4-Update (enthält `@after-paragraph-N:`) | ✅ Fertig |

### Phase 5 – Multi-Agenten-Canvas

| Datei | Tätigkeit | Status |
|---|---|---|
| `src/ui/canvas-modal.ts` | `multiAgentMode`-Flag und `selectedAgents`-Array ergänzt | ✅ Fertig |
| `src/ui/canvas-modal.ts` | `renderAgentSelection()` überarbeitet: zeigt Multi-Agenten-Toggle (Checkbox) wenn ≥ 2 Agenten geladen | ✅ Fertig |
| `src/ui/canvas-modal.ts` | Neue Methode `renderAgentSelectionBody(section, singleRow, multiRow)`: wechselt zwischen Einzel-Dropdown und Checkbox-Liste je nach `multiAgentMode` | ✅ Fertig |
| `src/ui/canvas-modal.ts` | `renderStartButton()`: `click`-Handler startet `startMultiAgentSession()` bei `multiAgentMode`, sonst `startSession()` | ✅ Fertig |
| `src/ui/canvas-modal.ts` | Neue Methode `startMultiAgentSession()`: iteriert über `selectedAgents`, startet für jeden eine eigene Konversation, schickt den gleichen Dokument-Kontext, hängt Callouts sequenziell an | ✅ Fertig |
| `src/ui/canvas-modal.ts` | Visueller Trenner `── Running: <Agent Name> ──` im Konversations-Panel zwischen den Agenten-Läufen | ✅ Fertig |
| `styles.css` | Neue CSS-Klassen: `.pa-canvas-multi-toggle-row`, `.pa-canvas-multi-toggle-label`, `.pa-canvas-multi-agent`, `.pa-canvas-multi-hint`, `.pa-canvas-agent-checkbox-row`, `.pa-canvas-agent-separator` | ✅ Fertig |

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
| Inline-Platzierung: `@after-paragraph-N:` am Anfang der Antwort → Callout nach Absatz N | ✅ |
| Diff-Ansicht: 📊-Button zeigt hinzugefügte Callouts mit Titel und Body-Vorschau | ✅ |
| Multi-Agenten: Checkbox-Auswahl, sequenzielle Ausführung, visueller Trenner | ✅ |

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
| Inline-Platzierung via Regex `^@after-paragraph-(\d+):\s*/i` am Anfang der Antwort | Einfach zu parsen, eindeutig vom normalen Text unterscheidbar, case-insensitive für Robustheit. |
| `insertCalloutAfterParagraph` zählt Absätze als zusammenhängende Nicht-Leerzeilen | Entspricht Markdown-Konvention; robust gegenüber einfachen und doppelten Leerzeilen. |
| Inline-Platzierung fällt auf Anhängen zurück wenn N außerhalb des Bereichs | Defensives Verhalten; kein Fehler wenn der Agent eine falsche Zahl sendet. |
| Diff-Ansicht als Collapsible-Section im Modal (nicht separates Fenster) | Minimaler UI-Footprint; Nutzer bleibt im Canvas-Modal-Kontext. |
| Multi-Agenten sequenziell statt parallel | Einfacheres Error-Handling; verhindert Race Conditions beim Vault-Write; klarer visueller Fortschritt im Modal. |
| Jeder Agent im Multi-Modus erhält eigene Konversation | Agenten sollen sich nicht gegenseitig beeinflussen; Isolation der Konversationshistorie ist Standard. |

---

## Showstopper und Probleme

Keine blockierenden Probleme aufgetreten.

| Problem | Beschreibung | Lösung / Status |
|---|---|---|
| Kein `vault.process()` | Die in der Plan-Architektur erwähnte `vault.process()`-API steht nicht in allen Ziel-Versionen von Obsidian zur Verfügung | Ersetzt durch `vault.read()` + `vault.modify()` – funktional äquivalent für diesen Anwendungsfall |
| Streaming und Dokument-Write sind entkoppelt | Während des Streamings steht der finale Response-Text noch nicht fest | Callout wird erst in `onComplete` geschrieben; im Modal werden Tokens live angezeigt. Kein Showstopper, da im Plan so spezifiziert (FR-6) |
| TypeScript strict-mode: `var`-Deklaration in if/else | `var` in beiden Zweigen eines if/else nicht erlaubt | Umstrukturierung: Variablen vor den Branches deklariert; Toggle via `section.prepend()` eingefügt |

