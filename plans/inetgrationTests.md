# Integration/E2E Tests Plan

Ziel: End-to-End-Szenarien abbilden, auch wenn sie aktuell (teilweise) fehlschlagen. Fehlschläge sollen Missing-Features sichtbar machen.

## Szenario 1: Markdown-Tool (Single)
- **Beschreibung:** Ein Markdown mit `tool: true`, type `single`, pre/post-processing. Erwartet: korrekt geparst, UI zeigt Tool an, Ausführung liefert erwartetes Ergebnis.
- **Status:** Noch zu implementieren (Tests dürfen failen, falls Features fehlen).
- **Erwartete Lücken:** Pre/Post-Processing-Pfade im Executor fehlen; UI-Anzeige nicht automatisiert testbar (Mock nötig).
- **Testidee:** Fixture-Markdown laden → Loader → Registry → Executor-Aufruf → assert Output/Log; UI nur indirekt prüfen (Metadata vorhanden).

## Szenario 2: Markdown-Toolchain (Chain, ≥2 Steps)
- **Beschreibung:** Markdown mit `type: chain`, mind. 2 Steps, jeweils pre/post-processing. Erwartet: Parsing + Sequenz, Placeholder `prev_step.output` funktioniert.
- **Status:** Noch zu implementieren; Multi-Step-Loop im Executor nur rudimentär (fehlende continueOnError/Progress).
- **Erwartete Lücken:** Chain-Execution im Executor; Progress/History fehlt.
- **Testidee:** Fixture mit 2 Steps (z.B. read_file → write_file oder search → read). Simulierter Vault. Assert Schritt-Reihenfolge und Outputs.

## Szenario 3: Parser-Fehler & UI-Feedback
- **Beschreibung:** Ungültiges Markdown (Frontmatter-Fehler, fehlendes Feld). Erwartet: Parser meldet Fehlerquelle; UI zeigt Fehlstelle an.
- **Status:** Parser wirft Fehler, aber keine präzisen Positionshinweise; UI-Fehleranzeige nicht automatisiert.
- **Erwartete Lücken:** Fehlerlokalisierung (Zeile/Spalte) fehlt; UI-Binding für Fehlermeldung ungetestet.
- **Testidee:** Fixture mit Syntaxfehler → Parser → Fehlerobjekt sollte Position/Hinweis liefern (derzeit fail expected). Markiere als known-failing.

## Szenario 4: Tooldiscovery (4 Deklarationen) & Darstellung
- **Beschreibung:** Vault mit 4 Tool-Markdowns. Erwartet: Loader findet alle, Registry enthält korrekte Descriptions/Params, UI listet sie.
- **Status:** Loader rekursiv vorhanden; UI nicht automatisiert.
- **Erwartete Lücken:** UI-Abgleich; evtl. fehlende Felder (category/icon) pro Agent.
- **Testidee:** Fixtures mit 4 Tools, Loader+Registry prüfen Count/IDs/Parameter. UI nur indirekt über Metadata.

## Szenario 5: Toolausführung (gleiche 4 Tools)
- **Beschreibung:** Nach Discovery lassen sich die 4 Tools ausführen (inkl. HITL-Pflicht bei write_file / REST POST).
- **Status:** Predefined Tools OK; HITL-Pfade via Executor-Callback testbar. Custom JS/Chain ggf. fehlend.
- **Erwartete Lücken:** HITL UI Binding; Chain-Ausführung; QuickJS-Sandbox nicht integriert.
- **Testidee:** Simulierter Vault + requestUrl-Mock; Executor mit HITL-Callback. Custom-Tool (single) aus Fixture ausführen.

## Offene Features / Risiken
- QuickJS-Sandbox nicht integriert (Custom-JS Tools eingeschränkt).
- Chain-Execution (Multi-Step Loop) rudimentär; kein Progress/History.
- Fehlerlokalisierung im Parser fehlt (Zeile/Spalte).
- UI-E2E (Sidebar/Forms/HITL modal) nicht automatisiert.
- Pfad-Validierung (`../` escapes) nicht getestet.

## Umsetzungsschritte
1) Fixtures für Szenario 1–5 anlegen (Markdowns, Vault-Struktur, HTTP-Mock).
2) Integrationstests pro Szenario in `tests/integration/e2e/*.spec.ts` schreiben; erwartete Fails dokumentieren (todo/skip, `expect(...).toBe(false)` falls abweichend).
3) Ergänzende Executor-Funktionen (Chain-Loop, continueOnError, Progress) nach Bedarf implementieren, dann Tests aktivieren.
4) Parser-Fehlerlokalisierung ergänzen (Zeile/Spalte) → Szenario 3 grün schalten.
5) QuickJS-Integration planen (für Custom-JS), falls erforderlich für Szenario 5.

## Erwartungen an Test-Resultate jetzt
- Szenario 1/2/3/5: dürfen initial scheitern, um fehlende Features sichtbar zu machen.
- Szenario 4 Discovery-Teile sollten bestehen (Loader + Registry). Darstellung/UI bleibt indirekt.
