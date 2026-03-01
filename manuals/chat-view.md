# PaperAgents Chat View Manual

**Handbuch für die Konversationsansicht (Chat View)**

---

## Übersicht

Die Chat View ermöglicht interaktive Konversationen mit KI-Agenten direkt in Obsidian. Jede Konversation wird als Markdown-Datei gespeichert und kann jederzeit geladen, fortgesetzt oder neu generiert werden.

---

## Inhaltsverzeichnis

1. [Benutzeroberfläche](#benutzeroberfläche)
2. [Neue Konversation erstellen](#neue-konversation-erstellen)
3. [Konversation laden](#konversation-laden)
4. [Nachrichten senden](#nachrichten-senden)
5. [Antwort neu generieren](#antwort-neu-generieren)
6. [Konversationshistorie neu senden](#konversationshistorie-neu-senden)
7. [Technische Details](#technische-details)

---

## Benutzeroberfläche

Die Chat View ist in drei Bereiche unterteilt:

### Header
- **Konversationsauswahl**: Dropdown-Menü zum Wechseln zwischen gespeicherten Konversationen
- **New Chat**: Öffnet das Panel zur Erstellung einer neuen Konversation

### Nachrichtenbereich
- Zeigt den vollständigen Gesprächsverlauf
- **Benutzernachrichten** (rechts, blau hervorgehoben)
- **Assistentantworten** (links, grauer Hintergrund) – mit Regenerier-Button `↺`
- **Tool-Aufrufe** (aufklappbare Details mit Status und Ergebnis)
- **Systemmeldungen** und **Fehlermeldungen** (zentriert)

### Eingabebereich
- **Texteingabefeld**: Nachricht tippen; `Enter` sendet, `Shift+Enter` erzeugt einen Zeilenumbruch
- **↺ (Resend)**: Sendet die bestehende Konversationshistorie ohne neue Nachricht
- **Send**: Sendet die eingegebene Nachricht

---

## Neue Konversation erstellen

1. Klick auf **New Chat** im Header
2. Agenten aus der Dropdown-Liste auswählen
3. Klick auf **Create** – die Konversation wird als Markdown-Datei im Conversations-Ordner gespeichert
4. Mit **Cancel** kann der Vorgang abgebrochen werden

> **Hinweis**: Agenten müssen zuvor in der Seitenleiste geladen werden. Falls keine Agenten angezeigt werden, erscheint ein entsprechender Hinweis.

---

## Konversation laden

- Im Header-Dropdown eine gespeicherte Konversation auswählen
- Beim Öffnen der Chat View wird automatisch die zuletzt erstellte Konversation geladen
- Änderungen an der Markdown-Datei außerhalb von Obsidian werden automatisch erkannt und nachgeladen

---

## Nachrichten senden

1. Nachricht ins Texteingabefeld eingeben
2. `Enter` drücken oder auf **Send** klicken
3. Die Antwort des Assistenten wird Token für Token gestreamt (animierter Cursor sichtbar)
4. Nach Abschluss wird die Konversation automatisch in der Markdown-Datei gespeichert

---

## Antwort neu generieren

Jede Assistentantwort hat einen **↺**-Button in der Rollenzeile:

1. Auf **↺** neben einer Assistentantwort klicken
2. Die Antwort und alle nachfolgenden Nachrichten werden entfernt
3. Die Konversationshistorie bis zur vorherigen Nutzernachricht wird an das LLM gesendet
4. Eine neue Antwort wird generiert und gespeichert

> **Anwendungsfälle**: Eine unzufriedenstellende Antwort neu generieren, eine alternative Formulierung erhalten oder nach einem Fehler neu starten.

---

## Konversationshistorie neu senden

Der **↺**-Button im Eingabebereich sendet die gesamte Konversationshistorie ohne neue Nutzernachricht:

1. Auf **↺** im Eingabebereich klicken
2. Die bestehende Historie wird an das LLM gesendet
3. Eine neue Assistentantwort wird generiert und angefügt

> **Anwendungsfälle**: Die Historie nach einem Fehler erneut senden, eine Antwort nach einer externen Bearbeitung der Konversationsdatei einholen oder ein Gespräch fortsetzen.

---

## Technische Details

### Datenspeicherung
Konversationen werden als Markdown-Dateien im konfigurierten Conversations-Ordner gespeichert (Standard: `conversations/`). Das Dateiformat enthält YAML-Frontmatter mit Metadaten sowie den Nachrichtenverlauf als Markdown-Abschnitte.

### Speicherung und Memory
Das Memory-Management wird über die Agenten-Konfiguration gesteuert:
- `type: conversation` – vollständige Historie (bis zu `maxMessages`)
- `type: none` – keine Historie (jede Anfrage ist zustandslos)
- `maxTokens` begrenzt die Kontextgröße

### Streaming und Tool-Aufrufe
- Antworten werden Token für Token gestreamt
- Tool-Aufrufe erscheinen als aufklappbare Elemente mit Parametern und Ergebnis
- Während des Streamings sind Eingabe, Send- und Resend-Button deaktiviert

### Konversationsdatei-Format

```markdown
---
conversation: true
id: conv_1234567890_abc123
agentId: my-agent
createdAt: 2025-01-01T10:00:00.000Z
updatedAt: 2025-01-01T10:05:00.000Z
---

### User (2025-01-01T10:00:00.000Z)
Hallo, wie geht es dir?

### Assistant (2025-01-01T10:00:05.000Z)
Hallo! Mir geht es gut, danke der Nachfrage.
```
