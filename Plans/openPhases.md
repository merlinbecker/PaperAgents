# Paper Agents – Offene Phasen & Fehlende Implementierungen

**Stand**: 27. Februar 2026  
**Basis**: Quellcode-Analyse, arc42-Dokumentation, Test-Suite, README-Roadmap  
**Aktuelle Version**: 0.0.2 (Phase 4.2 abgeschlossen)

---

## Übersicht

```
Abgeschlossen:  Phase 1 ✅ │ Phase 2 ✅ │ Phase 3 ✅ │ Phase 4.1 ✅ │ Phase 4.2 ✅
Ausstehend:     Phase 4.3 ⏳ │ Phase 5 🔮
```

Dieses Dokument listet alle identifizierten Lücken zwischen dem aktuellen Stand und einem finalen Plugin-Release, geordnet nach Priorität.

---

## 1. KRITISCH – Ohne diese Features kein funktionales Plugin

### 1.1 OpenRouter API-Client (Phase 4.3) ❌

**Status**: Komplett fehlend – keine `openrouter.ts` Datei existiert.

**Benötigt**:
- [ ] `src/core/openrouter.ts` – API-Client-Klasse
  - SSE-Streaming (Server-Sent Events) für Token-by-Token-Ausgabe
  - Tool-Calling-Protokoll (OpenAI-kompatibel)
  - Request/Response-Handling mit korrektem Error-Mapping
  - Rate-Limiting und Retry-Logik (429, 500, 503)
  - Timeout-Handling
  - Abstraktionsschicht gegen API-Änderungen (siehe ADR-3, Risiko R1)
- [ ] Multi-Modell-Support (Nutzer wählt Modell in Settings)
- [ ] Korrekte Header: `Authorization: Bearer <key>`, `HTTP-Referer`, `X-Title`
- [ ] Unit-Tests für API-Client (Mocking von `requestUrl`)

**Referenzen**: arc42 ADR-3, README Phase 4.3, Risiko R1

---

### 1.2 API-Key & Modell-Settings ❌

**Status**: Settings enthalten nur `customToolsPath` und `enableDebugLogging`.

**Benötigt**:
- [ ] `settings.ts` erweitern:
  - `openRouterApiKey: string` – API-Key Eingabefeld (Password-Type)
  - `defaultModel: string` – Modellauswahl (z.B. Dropdown oder Text)
  - `temperature: number` – Standard-Temperatur (0.0–2.0)
  - `maxTokens: number` – Max-Tokens pro Response
- [ ] Settings-Tab UI für die neuen Felder
- [ ] Sichere Key-Speicherung (Obsidian `loadData`/`saveData` – verschlüsselt im Vault)
- [ ] Validierung: API-Key-Format prüfen, Test-Request bei Eingabe

---

### 1.3 HITL-Modal nicht an Executor angebunden ⚠️

**Status**: `showHITLModal()` ist importiert in `main.ts`, aber `registerHITLCallbacks()` (Zeile 173) ist ein leerer Stub.

**Auswirkung**: HITL-Requests fallen auf Auto-Reject zurück → destruktive Operationen (`write_file`, POST/PUT/DELETE) werden automatisch abgelehnt.

**Benötigt**:
- [ ] In `main.ts`: `registerHITLCallbacks()` muss `toolExecutor.registerHITLCallback()` mit `showHITLModal()` verbinden
- [ ] Test: `write_file` → Modal erscheint → Approve → Datei wird geschrieben
- [ ] Test: `rest_request` POST → Modal erscheint → Reject → Kein Request

---

## 2. HOCH – Für einen sinnvollen Release notwendig

### 2.1 Agent-Loading in Plugin-Lifecycle ❌

**Status**: `AgentParser` existiert und ist getestet (94.49% Coverage), wird aber nirgends in `main.ts` aufgerufen.

**Benötigt**:
- [ ] Agent-Definitionen aus Vault laden (analog zu `loadCustomToolsFromVault()`)
- [ ] Settings-Feld: `agentsPath: string` (Default: `paper-agents-agents/`)
- [ ] Command: "Reload Agents" (analog zu "Reload Custom Tools")
- [ ] Geladene Agents im UI sichtbar machen (eigene Kategorie in Sidebar)

---

### 2.2 Chat-/Konversations-UI ❌

**Status**: `ConversationManager` ist voll funktional (97.47% Coverage), aber es existiert keine UI-Anbindung.

**Benötigt**:
- [ ] `src/ui/chat.ts` – Chat-View-Komponente
  - Agent-Auswahl (Dropdown der geladenen Agents)
  - Nachrichtenliste (User/Assistant/System/Tool-Rollen)
  - Eingabefeld mit Send-Button
  - Streaming-Anzeige (Token progressiv darstellen)
  - Tool-Call-Anzeige (eingeklappte Blöcke mit Parameters + Result)
- [ ] Integration in Sidebar oder als separater View (Tab neben Tool-Liste)
- [ ] CSS-Styles in `styles.css` für Chat-Nachrichten, Streaming-Indikator, Message-Bubbles
- [ ] Keyboard-Shortcuts: Enter = Senden, Shift+Enter = Newline

---

### 2.3 Tool-Execution-Output im UI ❌

**Status**: `executeToolWithParameters()` in `main.ts` loggt Ergebnisse nur via `globalLogger` und `Notice`. Der Nutzer sieht keine strukturierten Resultate.

**Benötigt**:
- [ ] Output-Panel in Sidebar oder Modal nach Ausführung
- [ ] Strukturierte Anzeige: Inputs, Outputs, Execution-Time, Fehler
- [ ] Copy-to-Clipboard für Output-Daten
- [ ] Fehlerfall: Detaillierte Fehlermeldung statt nur "failed"

---

### 2.4 Conversation ↔ OpenRouter ↔ Tool-Executor Integration ❌

**Status**: Die drei Systeme existieren isoliert. Es gibt keinen Code, der sie verbindet.

**Benötigt**:
- [ ] Orchestrierungsschicht: User-Message → ConversationManager → OpenRouter-API → Response parsen → Tool-Calls erkennen → ToolExecutor ausführen → Ergebnis zurück an LLM
- [ ] Multi-Turn-Loop: LLM kann mehrere Tool-Calls in Serie anfordern
- [ ] Context-Building: `ConversationManager.buildContext()` + Agent-SystemPrompt an API senden
- [ ] Fehlerbehandlung: Tool-Fehler als Nachricht an LLM zurückreichen

---

## 3. MITTEL – Verbesserung von Qualität und Nutzererlebnis

### 3.1 Execution History ❌

**Benötigt**:
- [ ] Persistierung der Execution-Logs (aktuell nur In-Memory-Logger mit Ring-Buffer)
- [ ] History-Store: Letzte N Ausführungen in Vault speichern (JSON oder Markdown)
- [ ] History-Panel im UI mit Filter- und Suchmöglichkeit
- [ ] Export-Funktion

**Referenz**: README Roadmap "⏳ Execution History"

---

### 3.2 `continueOnError` für Chain-Steps ❌

**Status**: In `tool-executor.ts` Zeile ~137 explizit als "noch nicht implementiert" markiert.

**Benötigt**:
- [ ] Flag `continueOnError` in Step-Definition unterstützen
- [ ] Bei Fehler: Error in `stepOutputs` speichern, nächsten Step fortsetzen
- [ ] Finales Result enthält Teilergebnisse + Fehler-Log

---

### 3.3 Technische Schulden abbauen (arc42 Kap. 11)

| ID | Schuld | Priorität | Aktuell |
|----|--------|-----------|---------|
| TS1 | **39× `any`-Types** im Code | Mittel | In `sandbox.ts`, `tool-executor.ts`, `conversation.ts` |
| TS2 | **Validator-Coverage 62.19%** | Niedrig | Edge-Cases fehlen |
| TS3 | **Tool-Loader Branch-Coverage 45.45%** | Niedrig | Error-Pfade nicht getestet |
| TS5 | **Keine Performance-Tests** | Niedrig | Kein Benchmarking für Sandbox/Vault-Scans |

---

### 3.4 Test-Coverage unter Zielwert

**Aktuell**: 75.46% Statement-Coverage (146 Tests, alle grün)

**Lücken**:
| Datei | Statements | Branches | Ziel |
|-------|-----------|----------|------|
| `main.ts` | 0% | 0% | ≥50% (Integration) |
| `settings.ts` | 0% | 0% | ≥50% |
| `sandbox.ts` | 69.34% | 71.05% | ≥80% |
| `tool-loader.ts` | 69.74% | 45.45% | ≥80% |
| `validator.ts` | 62.19% | 57.50% | ≥80% |
| `predefined.ts` | 84.43% | 62.85% | ≥80% Branch |

**Benötigt**:
- [ ] Integration-Tests für `main.ts` (Plugin-Loading, Commands)
- [ ] Sandbox-Tests für Timeout/Memory-Edge-Cases
- [ ] Validator-Tests für alle Typ-Konversionen
- [ ] Tool-Loader-Tests für Error-Szenarien

---

### 3.5 Mobile-Verifikation (QS-5) ⚠️

**Status**: `isDesktopOnly: false` in manifest.json, WASM-basierte Sandbox (architektonisch mobil-kompatibel), aber **keine Tests auf iOS/Android** durchgeführt.

**Benötigt**:
- [ ] Manuelles Testen auf iOS (Safari/WebKit)
- [ ] Manuelles Testen auf Android
- [ ] Responsive CSS überprüfen (nur 1 Breakpoint bei 768px vorhanden)
- [ ] Touch-Targets überprüfen (MIN_TOUCH_TARGET = 44px definiert, aber unklar ob überall eingehalten)

---

## 4. NIEDRIG – Nice-to-have / Zukunft (Phase 5)

### 4.1 Advanced Chain-Features
- [ ] Conditional Steps (`if`/`else` basierend auf vorherigem Output)
- [ ] Loops (`for`/`while` über Datenlisten)
- [ ] Retry-Logik mit Backoff

### 4.2 Visual Workflow Editor
- [ ] Drag & Drop Tool-Verknüpfung
- [ ] Visuelles Chain-Debugging

### 4.3 Template Library
- [ ] Community-geteilte Tool- und Agenten-Templates
- [ ] Import/Export-Format

### 4.4 Observability
- [ ] Metrics (Execution-Zeiten, Erfolgsraten)
- [ ] Tracing (Request-IDs durch die Pipeline)

---

## 5. Zusammenfassung: Kritischer Pfad zum Release

```
Phase 4.3 (OpenRouter) ──────────────────────────────────────────┐
│                                                                 │
├── 1.1 openrouter.ts (API-Client, SSE, Tool-Calling)           │
├── 1.2 Settings erweitern (API-Key, Model, Temperature)         │
├── 1.3 HITL-Modal korrekt verdrahten                            │
├── 2.1 Agent-Loading in main.ts                                 │
├── 2.2 Chat-UI (src/ui/chat.ts + CSS)                          │
├── 2.3 Output-Panel für Tool-Ergebnisse                         │
├── 2.4 Orchestrierung: Conversation ↔ OpenRouter ↔ Executor    │
│                                                                 │
└──► Funktionales Plugin mit LLM-Agenten ◄───────────────────────┘
```

### Geschätzter Aufwand

| Bereich | Schätzung | Abhängigkeiten |
|---------|-----------|----------------|
| OpenRouter API-Client | 2–3 Tage | Keine |
| Settings-Erweiterung | 0.5 Tag | Keine |
| HITL-Verdrahtung | 0.5 Tag | Keine |
| Agent-Loading | 1 Tag | Keine |
| Chat-UI + CSS | 3–4 Tage | OpenRouter, Agent-Loading |
| Tool-Output-Panel | 1 Tag | Keine |
| Orchestrierung | 2–3 Tage | OpenRouter, Conversation, Executor |
| Tests für neue Features | 2–3 Tage | Alle obigen |
| **Gesamt Phase 4.3** | **~12–15 Tage** | |

---

## 6. Referenzen

- [README.md – Roadmap](../README.md)
- [arc42 – Risiken & Schulden](../arc42/chapters/11-risiken-schulden.md)
- [arc42 – ADR-3: OpenRouter](../arc42/chapters/09-architekturentscheidungen.md)
- [arc42 – Qualitätsszenarien](../arc42/chapters/10-qualitaetsanforderungen.md)
- [arc42 – Lösungsstrategie (Phasenmodell)](../arc42/chapters/04-loesungsstrategie.md)
- [AGENTS.md – Developer Guide](../AGENTS.md)
