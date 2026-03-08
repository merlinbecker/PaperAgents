# Agent Canvas – Tätigkeitsbericht

## Zusammenfassung

Der Plan in `plans/agentcanvas.md` wurde weiter umgesetzt. Phase 1 (Core-Implementierung) war bereits vollständig abgeschlossen. In diesem Durchgang wurde Phase 2 umgesetzt: **Callout-Löschung (Callout Dismissal)**. Alle 361 Tests (davon 29 speziell für den Canvas-Agent) laufen durch, und der Build schlägt fehlerfrei.

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

### Phase 2 – Callout Dismissal

| Datei | Tätigkeit | Status |
|---|---|---|
| `src/core/canvas-agent.ts` | Rückgabetyp von `appendAgentCallout` und `appendUserCallout` von `Promise<void>` auf `Promise<string>` geändert – die Methoden geben jetzt den exakten Callout-Text zurück, der angehängt wurde | ✅ Fertig |
| `src/core/canvas-agent.ts` | Neue Methode `removeCallout(file, calloutText): Promise<boolean>` – entfernt den genauen Callout-Block aus dem Dokument anhand des gespeicherten Callout-Texts; gibt `true` zurück, wenn das Callout gefunden und entfernt wurde | ✅ Fertig |
| `src/ui/canvas-modal.ts` | `addMessageToDisplay()` erhält optionalen Parameter `calloutText`; wenn übergeben, wird ein 🗑️-Dismiss-Button in den Message-Header eingefügt | ✅ Fertig |
| `src/ui/canvas-modal.ts` | Neue private Methode `dismissCallout(file, calloutText, entryEl)` – ruft `canvasAgent.removeCallout()` auf und entfernt das Element aus dem Modal bei Erfolg | ✅ Fertig |
| `src/ui/canvas-modal.ts` | `sendToAgent()` überarbeitet: `addMessageToDisplay("assistant", ...)` wurde aus `onComplete` herausgezogen und wird jetzt nach `appendAgentCallout()` aufgerufen, mit dem zurückgegebenen Callout-Text | ✅ Fertig |
| `src/ui/canvas-modal.ts` | `sendFollowUp()` überarbeitet: Callout-Text von `appendUserCallout()` wird gespeichert und an `addMessageToDisplay("user", ...)` übergeben | ✅ Fertig |
| `styles.css` | CSS-Klassen für das Canvas Modal hinzugefügt: Layout, Nachrichten-Anzeige, Dismiss-Button, Streaming-Bereich, Eingabefeld, Sende-Button | ✅ Fertig |
| `tests/unit/core/canvas-agent.spec.ts` | 5 neue Tests: Rückgabewert von `appendAgentCallout` und `appendUserCallout`; 3 Tests für `removeCallout` (Entfernen vorhanden, nicht vorhanden, Round-Trip mit append) | ✅ Fertig |

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
| Dismiss-Button (`🗑️`) im Message-Header statt separatem Delete-Button außerhalb | Minimales UI-Footprint. Der Button ist sichtbar genug ohne den Lesefluss zu stören; `opacity: 0.5` im Normalzustand, `opacity: 1` + roter Hintergrund beim Hover. |

---

## Noch nicht umgesetzte Features (Phase 2 & 3)

| Feature | Beschreibung | Phase |
|---|---|---|
| Inline-Platzierung | Agent-Antwort an einer bestimmten Stelle im Dokument einfügen (z.B. nach Absatz 3), statt immer ans Ende | Phase 2 |
| Dokument-Diff | Side-by-Side-Vergleich von Original und annotierter Version | Phase 2 |
| Multi-Agenten-Canvas | Mehrere Agenten gleichzeitig auf dasselbe Dokument anwenden und Annotationen zusammenführen | Phase 3 |
| Selektions-Kontext | Nutzer markiert Text vor dem Command-Aufruf; nur die Selektion wird als Kontext gesendet | Phase 3 |

---

## Showstopper und Probleme

Keine blockierenden Probleme aufgetreten.

| Problem | Beschreibung | Lösung / Status |
|---|---|---|
| Kein `vault.process()` | Die in der Plan-Architektur erwähnte `vault.process()`-API steht nicht in allen Ziel-Versionen von Obsidian zur Verfügung | Ersetzt durch `vault.read()` + `vault.modify()` – funktional äquivalent für diesen Anwendungsfall |
| Streaming und Dokument-Write sind entkoppelt | Während des Streamings steht der finale Response-Text noch nicht fest | Callout wird erst in `onComplete` geschrieben; im Modal werden Tokens live angezeigt. Kein Showstopper, da im Plan so spezifiziert (FR-6) |
