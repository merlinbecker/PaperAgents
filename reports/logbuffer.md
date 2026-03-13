# Log-System: Ring-Buffer + Event-Bus Pattern

## Überblick

Dieses Dokument beschreibt Planung, Implementierung, Entscheidungen und offene Punkte
des Log-Systems für das Paper Agents Plugin.

---

## Ziel

Alle Plugin-internen Logs sollen in der Sidebar in einem eigenen **Logs-Tab** sichtbar sein,
damit Nutzer einen direkten Einblick in den Betriebszustand des Plugins erhalten –
ohne die Browser-Konsole öffnen zu müssen.

Anforderungen laut Issue:
- **Ring-Buffer** zum Speichern der Logs (kein Speicher-Überlauf)
- **Event-Bus-Pattern** für Echtzeit-Updates der Anzeige
- Log-Levels: **INFO, WARN, ERROR** (+ DEBUG für interne Entwicklung)
- **Emitter** (Komponente/Tool) pro Log-Eintrag erkennbar

---

## Architektur-Entscheidungen

### 1. Ring-Buffer statt Array mit `shift()`

Der bisherige Logger verwendete ein einfaches Array mit `shift()`, um die Log-Größe
zu begrenzen. Das ist O(n) pro Eintrag (alle Elemente müssen verschoben werden).

**Entscheidung:** Implementierung eines echten zirkulären Puffers (`RingBuffer<T>`) mit
zwei Zeigern (`head`, `size`). `push()` und Übernahme sind O(1).

Standardgröße: **500 Einträge** (vorher 1000; reduziert wegen Speicher und
DOM-Performance). Im DOM werden maximal 200 Einträge gleichzeitig gerendert.

### 2. Event-Bus via `Set<LogListener>`

Die Sidebar-Ansicht muss in Echtzeit auf neue Log-Einträge reagieren, ohne dass der
Logger direkt von der UI abhängt (keine bidirektionale Kopplung).

**Entscheidung:** Observer-Pattern mit `subscribe(listener) → unsubscribe()`.
Der Logger benachrichtigt alle Listener nach jedem erfolgreichen `push()`.
Listener-Fehler werden abgefangen, damit ein fehlerhafter Subscriber das Logging
nicht unterbricht.

### 3. Emitter als Pflichtfeld in `LogEntry`

Statt den Emitter als optionalen Context-Schlüssel zu übergeben, ist `emitter: string`
jetzt ein Pflichtfeld in `LogEntry`. Das erleichtert die Anzeige und das Filtern.

**Rückwärtskompatibilität:** Die öffentliche API (`debug`, `info`, `warn`, `error`)
bleibt unverändert – der Emitter wird intern auf `"Plugin"` gesetzt.
Für komponentenspezifische Logs gibt es `createLogger(emitter: string)`.

### 4. `createLogger(emitter)` Fabrikmethode

Statt alle vorhandenen Aufrufe zu migrieren (> 60 Stellen) wurde eine
**Fabrikmethode** auf dem `Logger` eingeführt:

```typescript
const logger = globalLogger.createLogger("Sidebar");
logger.info("Sidebar opened");  // emitter = "Sidebar"
```

- `main.ts` wurde vollständig auf den `Plugin`-Logger umgestellt.
- Andere Komponenten können schrittweise migriert werden.

### 5. LogPanel als eingebettete Komponente

Der Log-Viewer ist keine eigene `ItemView`, sondern eine einfache **Klasse**
(`LogPanel`), die in ein `HTMLElement` eingebettet wird. Das erlaubt:
- Embedding in Tabs der Sidebar
- Potenzielles Einbetten in andere Kontexte (z. B. Modale)

---

## Implementierte Dateien

| Datei | Änderung |
|-------|----------|
| `src/utils/logger.ts` | Ring-Buffer, Event-Bus, `createLogger()`, `LogEntry.emitter` |
| `src/ui/log-panel.ts` | Log-Anzeige: Level-Filter, Emitter-Filter, Export/Copy, Auto-Scroll |
| `src/ui/sidebar.ts` | Tab-Navigation (Übersicht / Logs), LogPanel eingebettet, Filter-Persistenz |
| `src/main.ts` | Scoped Logger `createLogger("Plugin")`, `applyLogLevel()` |
| `src/settings.ts` | `logMinLevel` + `logPanelFilterLevel` Settings, Log-Level-Dropdown |
| `styles.css` | Styles für Tabs, Log-Panel und Copy-Button |
| `tests/unit/core/logger.spec.ts` | 23 Unit-Tests für RingBuffer, Logger, Event-Bus |
| `src/core/*.ts` | Emitter-Migration (7 Dateien) |
| `src/ui/*.ts` | Emitter-Migration (5 Dateien) |
| `src/tools/*.ts` | Emitter-Migration (2 Dateien) |
| `src/utils/metrics.ts` | Emitter-Migration |

---

## Log-Panel Features

- **Echtzeit-Updates** via Event-Bus-Subscription
- **Level-Filter**: Debug+, Info+, Warn+, Error (Dropdown)
- **Auto-Scroll**: Automatisches Scrollen zum neuesten Eintrag (ein-/ausschaltbar)
- **Clear-Button**: Löscht alle gespeicherten Einträge
- **Emitter-Badge**: Farblich hervorgehoben (welche Komponente hat geloggt)
- **Context-Expansion**: `{ … }` Toggle für strukturierte Context-Daten
- **Level-Farben**:
  - DEBUG: grau
  - INFO: blau
  - WARN: gelb/orange (Zeile leicht hinterlegt)
  - ERROR: rot (Zeile leicht hinterlegt)

---

## Tab-Struktur der Sidebar

```
[ 📋 Übersicht ] [ 📜 Logs ]
```

- **Übersicht-Tab**: Tools, Agents, Examples (bisherige Ansicht)
- **Logs-Tab**: LogPanel mit Ring-Buffer-Inhalten

---

## Offene Arbeiten / TODOs

- [x] **Emitter-Migration**: Alle Komponenten auf `createLogger(emitter)` umgestellt
  (Orchestrator, Sandbox, CanvasModal, ChatView, Forms, HITLModal, ToolExecutor, ToolRegistry,
  OpenRouter, History, ConversationFileManager, Persistence, Metrics, PredefinedTools, PdfOcr, Sidebar)
- [x] **Level-Filter persistieren**: Letzten ausgewählten Level wird in Plugin-Settings gespeichert
  (`logPanelFilterLevel` in `PaperAgentsSettings`)
- [x] **Export-Funktion im Log-Panel**: Button „📋 copy logs" kopiert gefilterte Einträge in die Zwischenablage
- [x] **Emitter-Filter**: Dropdown zum Filtern nach Emitter (z.B. nur „Orchestrator") – automatisch befüllt
- [x] **Log-Level-Einstellung in Settings**: Globales Minimum-Level konfigurierbar (Dropdown: Debug/Info/Warn/Error)
  – verbunden mit Legacy-Toggle für Rückwärtskompatibilität
- [ ] **Persistenz**: Logs nach Neustart des Plugins wieder laden (optionale Datei-Persistenz)

## Herausforderungen

- **Rückwärtskompatibilität**: Die Logger-API wird an > 60 Stellen aufgerufen.
  Vollständige Migration wäre riskant gewesen; stattdessen `createLogger()` als
  schrittweise Migrationspfad.
- **DOM-Performance**: Bei 500 Einträgen wäre das DOM zu groß. Lösung: Max 200
  DOM-Einträge; älteste werden entfernt. Der Ring-Buffer behält aber alle 500.
- **Subscriber-Isolation**: Ein fehlerhafter Listener darf das Logging nicht
  unterbrechen → `try/catch` um jeden Listener-Aufruf.

---

## Test-Ergebnisse

```
✓ tests/unit/core/logger.spec.ts  (23 tests) 13ms
  - RingBuffer: 5 Tests (capacity, overwrite, order, clear, capacity-1)
  - Logger: 15 Tests (storage, ring, clear, filter, minLevel, setLevel,
              emitter, context, event-bus, unsubscribe, multi-subscriber,
              error-resilience)
  - createLogger: 3 Tests (emitter, levels, events)
  - globalLogger: 1 Test (singleton check)

Gesamt: 490/490 Tests bestanden
```
