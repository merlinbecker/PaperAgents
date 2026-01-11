# Offene Issues & Nächste Schritte

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
- **Status**: Funktioniert, aber ergänzungsbedürftig
- **Zu tun**:
  - `preprocess` / `postprocess` Hooks implementieren (aktuell ignoriert)
  - Dokumentation für Validierungstypen erweitern
  - Optional: Conditional Parameters unterstützen

### 1.3 Placeholder-Syntax Standardisieren
- **Status**: Funktioniert
- **Syntax**: `{{query}}`, `{{search_files.results[0].path}}`, `{{prev_step.output}}`
- **Zu tun**:
  - Dokumentation mit Beispielen erweitern
  - Type-Hints für IDE-Support (TS-Typen für Placeholders)

## Priorität 2: Custom-JS & Sandbox

### 2.1 QuickJS Integration (real vs. stub)
- **Status**: Stub-Mode aktiv (Node Function-Wrapper)
- **Problem**: Keine echte Isolation, keine Mobile-Unterstützung
- **Zu tun**:
  - `quickjs-emscripten` installieren und integrieren
  - Echte Runtime initialisieren
  - Error-Handling für Code-Validierungsfehler verbessern
  - Desktop vs. Mobile Runtime-Unterschiede behandeln

### 2.2 Custom-JS Policy & Security
- **Status**: Basis-Validierung vorhanden (gefährliche Patterns)
- **Zu tun**:
  - Erweiterte Validierungsregeln definieren
  - User-Bestätigung für Custom-JS Ausführung prüfen (HITL-Integration)
  - Timeout & Memory-Limits für Sandboxed Code

## Priorität 3: HITL & User Interaction

### 3.1 HITL-Modal & Sidebar Integration
- **Status**: Executor unterstützt HITL-Callbacks, UI fehlt
- **Zu tun**:
  - Modal für Bestätigung implementieren
  - Sidebar-Panel für Langzeit-Workflows
  - Approval/Rejection Flow mit Grund-Text
  - UI-Tests schreiben

### 3.2 Execution-Logs & Feedback
- **Status**: Logs werden gesammelt
- **Zu tun**:
  - Bessere Log-Formatierung für UI
  - Real-time Output-Streaming
  - Error-Details mit Stack-Traces

## Priorität 4: Test-Abdeckung & Qualität

### 4.1 Coverage-Ziele
- **Status**: ~60% Coverage aktuell
- **Ziel**: >80% für Kern-Module
- **Zu tun**:
  - `placeholder_new.ts` entfernen (Zero-Coverage)
  - Debug-Logs in Tests aufräumen
  - Edge-Cases für Parser & Executor testen
  - Snapshot-Tests für komplexe Outputs

### 4.2 Performance-Tests
- **Status**: Keine
- **Zu tun**:
  - Benchmark für Parser mit großen Dateien
  - Executor-Performance unter Last
  - Memory-Leaks für lange laufende Agents testen

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

## Nächste Session

**Fokus**: Notation-Refinement
1. Frontmatter-Struktur finalisieren
2. Best-Practice-Beispiele aktualisieren
3. Strikte Validierung implementieren
4. Dokumentation überarbeiten

---
**Aktualisiert**: 2026-01-11  
**Status**: Alle E2E-Szenarien grün ✅
