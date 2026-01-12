# Testing-Plan: Paper Agents

**Updated:** January 12, 2026

## Strategie: Feature-First mit Unit Tests

**Wichtig:** Tests werden parallel zur Feature-Entwicklung geschrieben, **nicht** vor UI-Testing!

### Entwicklungsablauf
1. ✅ **Phase 1:** Build & Test-Infrastructure (ERLEDIGT)
2. ⏳ **Phase 2:** Feature-Runde 1 - Pre/Post-Processing **mit Unit Tests**
3. ⏳ **Phase 3:** Feature-Runde 2 - QuickJS-Sandbox **mit Unit Tests**
4. 🎯 **Phase 4:** Finaler manueller UI-Test in Obsidian

**Ziel:** Kern-Logik ist durch Unit Tests validiert, bevor UI getestet wird

---

## Ziele
- **Robustheit erhöhen**: Parser, Validator, Placeholder, Core-Orchestrierung und Tools zuverlässig abdecken.
- **Feature-Absicherung**: Neue Features (Pre/Post, QuickJS) durch Tests validieren vor UI-Integration.
- **Sichere Ausführung**: Dateizugriffe und HITL-Flüsse deterministisch testen (keine echten Vault/Netzwerk-Operationen).
- **Automatisierung**: Unit- und Integration-Tests lokal und in CI (Node 18/20) mit Coverage-Berichten.
- **UI-Test-Fokus**: Manueller Test fokussiert auf UI-Bugs (Logik bereits getestet).

## Framework & Konfiguration
- **Test-Runner**: Vitest (Node 18+, TypeScript, ESM-freundlich, schnelle Mocks/Spies).
- **Coverage**: c8 (über Vitest integriert), Reporter: `text`, `lcov`.
- **Test-Umgebung**: `node` (UI-Rendering explizit ausgeschlossen).
- **ESM/TS**: Nutzung der bestehenden `tsconfig.json` und ESM-Imports; Tests laufen ungepackt, unabhängig von `esbuild`.

### `vitest.config.ts` (Outline)
- **environment**: `node`
- **aliases**: optional `src`-Basispfad; Obsidian-API wird in Tests via `vi.mock('obsidian', ...)` gemockt.
- **coverage**: include `src/**/*.ts`, exclude `src/ui/**`, `main.ts` (Lifecycle), `styles.css`.
- **tests include/exclude**: `tests/**/*.spec.ts`, `tests/**/*.test.ts`.

### `package.json` Scripts (geplant)
- `test`: Vitest ausgeführt mit Coverage.
- `test:watch`: Vitest im Watch-Mode.
- `coverage`: Coverage-Bericht (zusammen mit `test`).

## Verzeichnisstruktur
```
plans/
  testing.md
tests/
  unit/
    parser/
    core/
    utils/
  integration/
    tools/
    loader/
    vault/
  mocks/
    obsidian.ts
    requestUrl.ts
  fixtures/
    markdown/
    vault/
```
- **Konventionen**: Unit → `*.spec.ts`, Integration → `*.int.spec.ts`.

## Obsidian-API Mocking (Minimalstrategie)
- **Module**: `obsidian` (App, Vault, Workspace, TFile, requestUrl).
- **Stubs**:
  - `Vault`: `getAbstractFileByPath()`, `read()`, `readBinary()`, `modify()`, `create()`, `exists()`, `getFiles()`.
  - `TFile`: Felder `path`, `name`, `stat` (size, mtime), Typprüfung.
  - `Workspace`: nur für Smoke-Tests (optional) `on()`, `getActiveFile()`.
  - `requestUrl`: deterministische Fake-Responses (status, headers, text/json).
- **Bereitstellung**: zentral in tests/mocks/obsidian.ts; Hilfsfunktionen `makeTFile()`, `makeVault()`.

## Coverage-Ziele

**Aktuell:** 66% Coverage (38 Tests) ✅

**Feature-Runde 1 (Pre/Post-Processing):**
- **Parser/Core mit Pre/Post:** ≥ 80%
- **Neue Features:** ≥ 80%

**Feature-Runde 2 (QuickJS-Sandbox):**
- **Sandbox:** ≥ 85%
- **Security-Tests:** 100% der kritischen Pfade

**UI:** ausgeschlossen (Rendering in Obsidian, wird manuell getestet)

## Konkrete Testfälle (Priorisiert)

### Parser & Validator
- src/parser/yaml-parser.ts
  - Frontmatter fehlt → Fehler oder leere Definition.
  - Primitive/Arrays/Objekte korrekt erkannt; Kommentare ignoriert.
  - Mehrzeilige Strings und einfache Maps; invalides YAML → verständliche Fehlermeldung.
- src/parser/validator.ts
  - Required/Optional korrekt; Typkonvertierung für `number`, `boolean`, `array`, `object`.
  - Default-Werte angewendet; Fehleraggregation nach Feldnamen.
- src/parser/placeholder.ts
  - `{{date}}` (YYYY-MM-DD), `{{time}}` (HH:mm:ss), `{{random_id}}` deterministisch via Fake-Timer/UUID-Spy.
  - `{{prev_step.output}}` und `{{prev_step.output.field}}` inkl. nested Access; robust bei `undefined` (keine Crashes, klare Fehler).

### Core
- src/core/tool-registry.ts
  - `registerTool()`/`getTool()`/`hasTool()` Caching und Lookups; stabile IDs/Kategorien.
  - `listTools()` sortiert/kategorisiert; Clear-Operation leert Cache/Maps.
- src/core/tool-executor.ts
  - `execute()` validiert Eingaben, ersetzt Placeholders, orchestriert Steps.
  - HITL: `write_file` immer → Approval/Reject-Pfade; `rest_request` nur bei `POST/PUT/DELETE`.
  - Fehlerpfad: Tool nicht gefunden, Validierungsfehler, abgelehnter HITL.

### Tools & Loader
- src/tools/predefined.ts
  - `search_files`: Filter nach Query/Ordner; leere Ergebnisse.
  - `read_file`: nicht-existente Datei → Fehler; Metadaten korrekt.
  - `write_file`: Overwrite=false bei existierender Datei → Fehler; Pfad-Normalisierung im Vault.
  - `rest_request`: GET ohne HITL; POST/PUT/DELETE mit HITL; Timeout/404/500 via Mock.
- src/parser/tool-loader.ts
  - rekursive Discovery von `.md`; ignoriert Dateien ohne `tool: true`.
  - valide/invalid YAML werden geloggt; saubere Aggregation von Custom Tools.

## Integrationstests: Minimaler Vault
- **Temp-Vault**: OS-Tempverzeichnis mit Fixtures (Ordner, Markdown-Dateien, Textdateien). 
- **Vault-Mock**: Methoden mappen auf Node-FS für den Temp-Pfad; `TFile`-Objekte aus Pfaden ableiten.
- **Use-Cases**:
  - `read_file` liest Inhalt/Metadaten nur aus Temp-Vault.
  - `write_file` erstellt/modifiziert Dateien innerhalb Temp-Vault; `overwrite`-Pfad und Fehlerfall.
  - `search_files` über simulierte Struktur; Performance mit 100 Dateien.
  - `tool-loader` lädt Custom Tools aus `fixtures/markdown/` rekursiv.
- **Netzwerk**: `requestUrl`-Mock liefert deterministische Antworten, keine externen Calls.

## Risiken & Mitigation
- **Mobile-APIs**: UI/Workspace-APIs nicht testen; UI-Ordner ausschließen.
- **QuickJS-Sandbox**: src/core/sandbox.ts bleibt Stub; Tests prüfen nur Interface-Aufrufe, kein echtes Eval.
- **ESM/CJS**: Vitest ESM-freundlich; vermeiden Jest-ESM-Fallen. Imports konsistent halten.
- **Zeit/UUID**: `vi.useFakeTimers()`/`vi.setSystemTime()` und Spies für Randomness.
- **Dateipfade**: Vault-Mock verhindert `../` Zugriff außerhalb Temp; zusätzliche Pfadvalidierung in Tests.

## CI-Workflow (GitHub Actions, optional)
- **Matrix**: Node 18, 20.
- **Schritte**: Checkout → Setup Node → Cache npm → Install → Lint → Test (Vitest) → Coverage als Artefakt (`lcov`).
- **Artefakte**: `coverage/` Upload, kein Release.

## Umsetzungsfahrplan (Updated: January 12, 2026)

### ✅ Phase 1: Konfiguration & Basis-Tests (ERLEDIGT)
1. ✅ Vitest & c8 als Dev-Dependencies hinzugefügt
2. ✅ `vitest.config.ts` erstellt; Scripts in `package.json` ergänzt
3. ✅ `tests/unit`, `tests/integration`, `tests/mocks`, `tests/fixtures` angelegt
4. ✅ Zentralen `obsidian`-Mock und `requestUrl`-Mock implementiert
5. ✅ Unit-Tests (Priorität A) für Parser und Core geschrieben
6. ✅ Integrationstests (Priorität B) für Tools implementiert

**Ergebnis:** 38 Tests erfolgreich, 66% Coverage

### ⏳ Phase 2: Feature-Runde 1 - Pre/Post-Processing (1-2 Tage)
1. **Implementierung:**
   - Executor um Pre/Post-Processing Hooks erweitern
   - Integration mit Sandbox (Stub-Mode nutzen bis QuickJS fertig)
   
2. **Unit Tests schreiben:**
   - Pre-Processing: Input-Transformation, Error-Handling
   - Post-Processing: Output-Transformation, Edge Cases
   - Integration-Tests für komplette Workflows
   - Placeholder-System mit Pre/Post-Output
   
3. **Coverage-Ziel:** >80% für neue Features

**Akzeptanzkriterium:** Alle Tests grün, Feature funktional

### ⏳ Phase 3: Feature-Runde 2 - QuickJS-Sandbox (1-2 Tage)
1. **Implementierung:**
   - `quickjs-emscripten` installieren
   - Sandbox-Stub durch echte QuickJS ersetzen
   - Memory- und Timeout-Limits konfigurieren
   
2. **Unit Tests schreiben:**
   - Isolation-Tests (Code kann nicht ausbrechen)
   - Security-Tests (require, eval, process blockiert)
   - Memory-Limit-Tests
   - Timeout-Tests
   - Performance-Tests (Sandbox-Overhead)
   - Mobile-Kompatibilitäts-Tests
   
3. **Coverage-Ziel:** >85%, 100% kritischer Security-Pfade

**Akzeptanzkriterium:** Security-Tests bestanden, keine Isolation-Leaks

### 🎯 Phase 4: Finaler manueller UI-Test (0.5-1 Tag)
1. **Vorbereitung:**
   - Alle Features durch Unit Tests validiert
   - Build erfolgreich
   
2. **Manueller Test:**
   - Plugin in Obsidian Test-Vault laden
   - testing_guide.md Checkliste durcharbeiten
   - End-to-End Workflows testen
   - **Erwartung:** Nur UI-spezifische Bugs
   
3. **Bug-Fixes:**
   - UI-Bugs schnell lokalisierbar (Logik bereits getestet)
   - Fokussierte Fixes ohne Logik-Änderungen

**Akzeptanzkriterium:** Alle manuellen Tests bestanden

### Phase 5: CI & Release (nach manuellem Test)
- GitHub Actions Workflow aktivieren
- Coverage-Berichte veröffentlichen
- Release 0.1.0 vorbereiten

## Akzeptanzkriterien (Updated)

**Phase 1 (ERLEDIGT):**
- ✅ Tests laufen lokal (`npm run test`) und in CI (Node 18/20) grün
- ✅ Coverage ≥ 66% erreicht
- ✅ Keine echten Vault- oder Netzwerkzugriffe in Tests
- ✅ HITL-Pfade deterministisch über Callbacks getestet

**Phase 2 (Pre/Post-Processing):**
- ⏳ Alle Pre/Post-Processing Tests grün
- ⏳ Coverage ≥ 80% für neue Features
- ⏳ Integration-Tests für komplette Workflows erfolgreich

**Phase 3 (QuickJS-Sandbox):**
- ⏳ Security-Tests bestehen (Isolation, Memory-Limits, Timeouts)
- ⏳ Coverage ≥ 85% für Sandbox-Code
- ⏳ Keine Isolation-Leaks nachweisbar
- ⏳ Performance akzeptabel (Overhead < 50ms pro Execution)

**Phase 4 (Manueller UI-Test):**
- ⏳ Alle manuellen Tests aus testing_guide.md bestanden
- ⏳ Keine kritischen UI-Bugs
- ⏳ Plugin funktioniert fehlerfrei in Obsidian
- ⏳ Release 0.1.0 bereit
