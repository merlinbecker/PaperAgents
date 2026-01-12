# Offene Issues & Entwicklungsplan

**Updated:** January 12, 2026

## Entwicklungsstrategie: Feature-First mit Unit Tests

**Ansatz:** 2 Feature-Runden mit umfassenden Unit Tests, dann finaler manueller UI-Test

### ✅ Phase 1: Foundation (ERLEDIGT)
- ✅ Build erfolgreich
- ✅ Test-Infrastructure (38 Tests, 66% Coverage)
- ✅ Kern-Logik getestet

### ⏳ Phase 2: Feature-Runde 1 - Pre/Post-Processing (NÄCHSTER SCHRITT)

**Priorität:** P0 - Kritisches Feature

**Implementierung:**
- Executor um Pre/Post-Processing Hooks erweitern
- Integration mit Sandbox (Stub-Mode)
- Beispiel-Tools mit Pre/Post erstellen

**Unit Tests (parallel zur Implementierung):**
- Pre-Processing transformiert Input korrekt
- Post-Processing transformiert Output korrekt
- Error-Handling bei Invalid JS
- Edge Cases (undefined, null, komplexe Objekte)
- Integration-Tests für komplette Workflows

**Akzeptanz:** Alle Tests grün, >80% Coverage für neue Features

**Aufwand:** 1-2 Tage

---

### ⏳ Phase 3: Feature-Runde 2 - QuickJS-Sandbox

**Priorität:** P0 - Security-kritisch

**Implementierung:**
- `quickjs-emscripten` installieren
- Sandbox-Stub durch echte QuickJS ersetzen
- Memory- und Timeout-Limits konfigurieren
- Mobile-Kompatibilität sicherstellen

**Unit Tests (parallel zur Implementierung):**
- Sandbox isoliert Code korrekt
- Memory-Limits funktionieren
- Timeout-Limits funktionieren
- Gefährliche APIs blockiert (require, eval, etc.)
- Performance-Tests (Overhead)
- Mobile-Kompatibilitäts-Tests

**Akzeptanz:** Security-Tests grün, >85% Coverage, keine Isolation-Leaks

**Aufwand:** 1-2 Tage

---

### 🎯 Phase 4: Finaler manueller UI-Test

**Priorität:** P0 - Release-Blocker

**Vorbereitung:**
- Alle Features durch Unit Tests validiert
- Kern-Logik funktionsfähig

**Testing:**
- Plugin in Obsidian Test-Vault laden
- testing_guide.md Checkliste durcharbeiten
- End-to-End Workflows in echter Umgebung
- **Erwartung:** Nur UI-spezifische Bugs (Logik bereits getestet)

**Bug-Fixes:**
- UI-Bugs lokalisieren und fixen
- Schnelle Iteration (Logik nicht betroffen)

**Akzeptanz:** Alle manuellen Tests bestanden, Release 0.1.0 bereit

**Aufwand:** 0.5-1 Tag

---

## Priorität 1: Notation & Frontmatter-Design

### 1.1 Vereinheitlichung der Markdown-Notation
- **Status**: Zu klären
- **Problem**: Frontmatter-Format für Single-Tools und Chain-Tools erlaubt verschiedene Schreibweisen
- **Zu tun**:
  - Eindeutige Richtlinien für `type: single` vs `type: chain` festlegen
  - Dokumentation mit Best-Practice-Beispielen erweitern
  - Fixture-Dateien standardisieren
  - Optional: Strikte Validierung für unerwartete Kombinationen (z.B. `type: single` mit `steps`)

### 1.2 Parameter-Syntax
- **Status:** Funktioniert
- **Nächste Schritte:**
  - ⏳ **Phase 2:** `preprocess` / `postprocess` Hooks implementieren + Unit Tests
  - Dokumentation für Validierungstypen erweitern
  - Optional: Conditional Parameters unterstützen

### 1.3 Placeholder-Syntax Standardisieren
- **Status**: Funktioniert
- **Syntax**: `{{query}}`, `{{search_files.results[0].path}}`, `{{prev_step.output}}`
- **Zu tun**:
  - Dokumentation mit Beispielen erweitern
  - Type-Hints für IDE-Support (TS-Typen für Placeholders)

## Priorität 2: Custom-JS & Sandbox (In Entwicklung)

### 2.1 QuickJS Integration
- **Status:** ⏳ Phase 3 - Wird nach Pre/Post-Processing implementiert
- **Aktuell:** Stub-Mode aktiv (Node Function-Wrapper)
- **Nächste Schritte:**
  - ⏳ **Phase 3:** `quickjs-emscripten` installieren und integrieren
  - ⏳ Echte Runtime initialisieren
  - ⏳ **Unit Tests:** Isolation, Memory-Limits, Timeouts, Security
  - ⏳ Error-Handling für Code-Validierungsfehler verbessern
  - ⏳ Desktop vs. Mobile Runtime-Unterschiede behandeln

**Aufwand:** 1-2 Tage mit umfassenden Tests

### 2.2 Custom-JS Policy & Security
- **Status:** Basis-Validierung vorhanden
- **Nächste Schritte:**
  - ⏳ **Phase 3:** Erweiterte Validierungsregeln mit Tests
  - ⏳ Security-Tests für alle blockierten Patterns
  - ⏳ User-Bestätigung für Custom-JS Ausführung (HITL-Integration)
  - ⏳ Timeout & Memory-Limits mit Performance-Tests

## Priorität 3: HITL & User Interaction (Nach Feature-Completeness)

### 3.1 HITL-Modal & Sidebar Integration
- **Status:** Executor unterstützt HITL-Callbacks, UI kompiliert
- **Nächste Schritte:**
  - 🎯 **Phase 4:** Modal in echtem Obsidian testen
  - 🎯 Sidebar-Panel für Workflows testen
  - 🎯 Approval/Rejection Flow verifizieren
  - Nur UI-Bugs erwarten (Logik bereits getestet)

### 3.2 Execution-Logs & Feedback
- **Status:** Logs werden gesammelt
- **Nächste Schritte:**
  - 🎯 **Phase 4:** Log-Formatierung in UI testen
  - Optional: Real-time Output-Streaming
  - Optional: Error-Details mit Stack-Traces

## Priorität 4: Test-Abdeckung & Qualität (In Arbeit)

### 4.1 Coverage-Ziele
- **Status:** ✅ 66% Coverage (38 Tests)
- **Ziel:** >80% nach Feature-Runden
- **Nächste Schritte:**
  - ⏳ **Phase 2:** Pre/Post-Processing Tests (>80% Coverage)
  - ⏳ **Phase 3:** QuickJS Security-Tests (>85% Coverage)
  - Optional: `placeholder_new.ts` entfernen (Zero-Coverage)
  - Optional: Snapshot-Tests für komplexe Outputs

### 4.2 Performance-Tests
- **Status:** Keine
- **Nächste Schritte:**
  - ⏳ **Phase 3:** Sandbox-Overhead Benchmarks
  - Optional: Parser mit großen Dateien
  - Optional: Memory-Leaks für lange laufende Agents testen

## Priorität 5: Documentation & Examples

### 5.1 User-Dokumentation
- **Status**: README vorhanden, aber lückenhaft
- **Zu tun**:
  - Video-Tutorial für Tool-Erstellung
  - FAQ mit häufigen Fehlern
  - Migration-Guide von v0 zu v1

### 5.2 Developer-Dokumentation
- **Status**: Code-Comments vorhanden
- **Zu tun**:
  - ADR (Architecture Decision Records) für Notations-Choices
  - Extension-Points dokumentieren
  - Plugin-Development-Guide

## Priorität 6: Features (später)

### 6.1 Tool-Versioning
- Multi-Version Support für Custom-Tools
- Breaking-Change Handling

### 6.2 Conditional Execution
- `if` / `else` Branches in Chains
- Loop-Unterstützung

### 6.3 Error Handling & Retries
- Automatic Retry-Policy definieren
- Fallback-Tools

### 6.4 Observability
- OpenTelemetry Integration
- Metrics & Tracing

## Nächste Session: Feature-Runde 1 - Pre/Post-Processing

**Fokus:** Implementierung + Unit Tests (1-2 Tage)

### Implementierungs-Tasks
1. Executor erweitern um Pre/Post-Processing Hooks
2. Sandbox-Integration für JavaScript-Ausführung
3. Beispiel-Tools mit Pre/Post-Processing erstellen
4. Fehlerbehandlung und Edge Cases

### Test-Tasks (parallel)
1. Unit Tests für Pre-Processing:
   - Input-Transformation korrekt
   - Error-Handling bei Invalid JS
   - Edge Cases (undefined, null, komplexe Objekte)
   
2. Unit Tests für Post-Processing:
   - Output-Transformation korrekt
   - Verschiedene Output-Typen
   - Fehlerbehandlung
   
3. Integration-Tests:
   - Komplette Workflows mit Pre/Post
   - Placeholder-System mit verarbeitetem Output
   - Chain-Execution mit Pre/Post

### Akzeptanzkriterium
- ✅ Alle Tests grün
- ✅ >80% Coverage für neue Features
- ✅ Feature funktional und dokumentiert

---
**Aktualisiert**: 2026-01-12  
**Status**: Phase 1 abgeschlossen ✅, Phase 2 steht bevor ⏳  
**Strategie**: Feature-First mit Unit Tests, dann UI-Test am Ende
