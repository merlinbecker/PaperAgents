# Testing-Plan: Paper Agents

## Ziele
- **Robustheit erhöhen**: Parser, Validator, Placeholder, Core-Orchestrierung und Tools zuverlässig abdecken.
- **Sichere Ausführung**: Dateizugriffe und HITL-Flüsse deterministisch testen (keine echten Vault/Netzwerk-Operationen).
- **Automatisierung**: Unit- und Integration-Tests lokal und in CI (Node 18/20) mit Coverage-Berichten.

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
- **Parser/Core**: ≥ 90%
- **Tools/Loader**: ≥ 80%
- **UI**: ausgeschlossen (Rendering in Obsidian, nicht Node).

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

## Umsetzungsfahrplan
1. **Konfiguration**
   - Vitest & c8 als Dev-Dependencies hinzufügen.
   - `vitest.config.ts` erstellen; Scripts in `package.json` ergänzen.
2. **Struktur & Mocks**
   - `tests/unit`, `tests/integration`, `tests/mocks`, `tests/fixtures` anlegen.
   - zentralen `obsidian`-Mock und `requestUrl`-Mock implementieren.
3. **Unit-Tests (Priorität A)**
   - Parser (`yaml-parser.ts`, `validator.ts`, `placeholder.ts`).
   - Core (`tool-registry.ts`, ausgewählte `tool-executor.ts`-Pfade inkl. HITL via Callback-Injektion).
4. **Integrationstests (Priorität B)**
   - Minimaler Vault & Tools (`predefined.ts`, `tool-loader.ts`).
   - Netzwerk-Mock für `rest_request`-Varianten.
5. **CI & Coverage**
   - GitHub Actions Workflow hinzufügen.
   - Coverage-Ziele prüfen, fehlende Pfade ergänzen.
6. **Review & Stabilisierung**
   - Edge Cases erweitern (Nested Placeholder, invalid YAML, große Dateien, viele Tools).
   - Fehlertexte und Logs prüfen (siehe src/utils/logger.ts).

## Akzeptanzkriterien
- Tests laufen lokal (`npm run test`) und in CI (Node 18/20) grün.
- Coverage erfüllt Ziele (Parser/Core ≥ 90%, Tools/Loader ≥ 80%).
- Keine echten Vault- oder Netzwerkzugriffe in Tests.
- HITL-Pfade werden deterministisch über Callbacks getestet.
