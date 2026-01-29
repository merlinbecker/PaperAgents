# Paper Agents - Projektstatus & Nächste Schritte

**Datum:** 29. Januar 2026  
**Version:** 0.0.1  
**Status:** Phase 3 abgeschlossen, Phase 4 in Arbeit

---

## Zusammenfassung

Dieses Dokument konsolidiert den aktuellen Projektstand, vergleicht die Anforderungen mit der Implementierung und definiert die nächsten Schritte für das Paper Agents Obsidian-Plugin.

---

## 1. Projektbeschreibung & Anforderungen

### Vision

**Paper Agents** ist ein Obsidian-Plugin für **Agenten- und Tool-Workflows in Markdown**. Es ermöglicht Entwicklern:

- **Agenten und Tools in Markdown zu definieren** - Strukturierte Definition via YAML Frontmatter
- **Tools auszuführen und zu testen** - Inklusive Pre-/Post-Processing in Sandbox
- **Mit Agenten zu interagieren** - Über Markdown-basierte Konversationen
- **OpenRouter zu integrieren** - API-basierte LLM-Kommunikation
- **Zu experimentieren** - Playground-Fokus, nicht Production-ready

### Kernfunktionen (Anforderungen)

#### A. Plugin-Infrastruktur
- ✅ Installation & Updates via BART-Plugin-Beta-Releases
- ✅ Einstellungen für OpenRouter-API-Key (UI vorhanden, Integration Phase 4)

#### B. Tool-Definition & Ausführung
- ✅ **Vorgefertigte Tools**: 4 Tools implementiert (search_files, read_file, write_file, rest_request)
- ✅ **Benutzerdefinierte Tools**: Definition als Verkettung (Pre → Tool → Post)
- ✅ **Sandbox-Ausführung**: QuickJS mit Memory/Timeout-Limits
- ✅ **Tool-Notation**: YAML/Markdown-Blöcke für Parameter und Abhängigkeiten

#### C. Agenten-Definition & Interaktion
- ⏳ **Agenten-Notation**: System-Prompt, Tools, Kontext, Memory in Markdown (geplant)
- ⏳ **Konversationsablauf**: Automatische Nachrichtenverarbeitung (geplant)
- ⏳ **OpenRouter-Integration**: API-Kommunikation (geplant)

#### D. Sicherheits- & Validierungsmechanismen
- ✅ **Human-in-the-Loop**: Bestätigung für kritische Aktionen (write_file, POST/PUT/DELETE)
- ✅ **Validierung**: Markdown-Parsing mit Konsistenzprüfung
- ✅ **Sandbox-Sicherheit**: Blockierung gefährlicher Patterns (require, eval, etc.)

---

## 2. Aktueller Implementierungsstand

### ✅ Phase 1: Plugin-Grundgerüst (ABGESCHLOSSEN)

**Implementiert:**
- Build-Infrastructure (esbuild, TypeScript strict mode)
- Test-Framework (Vitest, 76 Tests, 67.25% Coverage)
- Basis-Typen und Konstanten
- Plugin-Lifecycle (onload, onunload, Settings)

**Qualität:**
- Build: ✅ Erfolgreich
- Tests: ✅ 76/76 bestanden
- Coverage: 67.25%

### ✅ Phase 2: Tool-Engine (ABGESCHLOSSEN)

**Implementiert:**
- **4 Vordefinierte Tools**:
  - `search_files` - Vault-Suche (HITL: Nein)
  - `read_file` - Datei lesen (HITL: Nein)
  - `write_file` - Datei schreiben (HITL: Ja)
  - `rest_request` - HTTP-Requests (HITL: Ja bei POST/PUT/DELETE)

- **Tool-Framework**:
  - `ToolRegistry` - Factory Pattern für Tool-Verwaltung
  - `ToolExecutor` - 3-Phasen-Pipeline (Pre → Tool → Post)
  - `ToolLoader` - Automatische Discovery von Custom Tools
  - `YAMLParser` - Markdown Frontmatter-Parsing
  - `Validator` - Parameter-Validierung und Typ-Konvertierung
  - `PlaceholderEngine` - Dynamische Platzhalter ({{date}}, {{prev_step.output}}, etc.)

- **UI-Integration**:
  - Sidebar mit Tool-Übersicht
  - Dynamische Formulare für Parameter-Eingabe
  - HITL-Modal für Bestätigungen

**Qualität:**
- Core Logic Coverage: 79.42%
- Parser Coverage: 64.29%
- Tools Coverage: 84.43%

### ✅ Phase 3: Sandbox & Security (ABGESCHLOSSEN)

**Implementiert:**
- **QuickJS-Integration**:
  - WASM-basierte JavaScript-Ausführung
  - Isolation vom Node.js-Prozess
  - Memory-Limit: 10 MB
  - Timeout-Limit: 5 Sekunden

- **Sicherheitsfeatures**:
  - Code-Validierung (blockiert: require, eval, process, global, Function)
  - IIFE-Wrapping für return-Statement-Support
  - Error-Extraction und -Handling
  - Mobile-kompatibel (WASM)

- **Pre-/Post-Processing**:
  - JavaScript-basierte Input-Transformation (Pre)
  - JavaScript-basierte Output-Transformation (Post)
  - Platzhalter in Code unterstützt ({{date}}, {{time}}, etc.)

**Qualität:**
- Sandbox Coverage: 69.26%
- 30 spezifische Pre/Post-Processing Tests

### ⏳ Phase 4: Agenten & Konversation (IN ARBEIT)

**Geplant:**
1. **Agenten-Notation finalisieren**
   - Markdown-Format für System-Prompts
   - Tool-Referenzen und Kontext
   - Memory-Management
   - Beispiel-Templates

2. **Konversationslogik implementieren**
   - Markdown-Nachrichten erkennen
   - Trigger-Mechanismus für neue Nachrichten
   - Automatisches Rückschreiben der Antworten

3. **OpenRouter-Integration**
   - API-Key-Verwaltung (UI bereits vorhanden)
   - Request/Response-Handling
   - LLM-Auswahl und Konfiguration
   - Error-Handling und Rate-Limiting

4. **Testing & Iteration**
   - Manuelle Tests der Agenten
   - Tool-Ketten validieren
   - Performance-Profiling

**Herausforderungen:**
- **Markdown-Parsing**: Sicherstellung, dass Nutzer Notation nicht zerstören
  - *Lösung*: Plugin-Validierung + LLM-Feedback
- **Kontext-Management**: Memory bei langen Konversationen
  - *Lösung*: Token-Limits + Zusammenfassung alter Nachrichten
- **Sandbox-Kompatibilität**: QuickJS-Beschränkungen
  - *Status*: Gelöst durch JSON-Datenaustausch

---

## 3. Vergleich: Anforderungen vs. Implementierung

### Vollständig Erfüllt ✅

| Anforderung | Status | Notizen |
|-------------|--------|---------|
| YAML-Tool-Definitionen | ✅ | yaml-parser.ts, validator.ts |
| Vorgefertigte Tools | ✅ | 4 Tools: search, read, write, rest |
| Custom Tools | ✅ | tool-loader.ts, automatische Discovery |
| Pre-/Post-Processing | ✅ | JavaScript in Sandbox |
| QuickJS-Sandbox | ✅ | Memory/Timeout-Limits, WASM |
| Human-in-the-Loop | ✅ | HITL-Modal, write_file/POST/PUT/DELETE |
| Code-Validierung | ✅ | Blockierte Patterns, return-Statement |
| Platzhalter-Syntax | ✅ | {{date}}, {{time}}, {{prev_step}}, etc. |
| Chain-Tools | ✅ | Multi-Step-Workflows mit Step-Chaining |
| Mobile-Kompatibilität | ✅ | WASM, kein Node.js-Zugriff |
| UI-Integration | ✅ | Sidebar, Forms, HITL-Modal |
| Plugin-Settings | ✅ | Custom Tools Path, Debug Logging |

### Teilweise Erfüllt ⏳

| Anforderung | Status | Fehlend |
|-------------|--------|---------|
| OpenRouter-Integration | ⏳ | API-Key-UI vorhanden, Request-Logik fehlt |
| Agenten-Notation | ⏳ | Tool-Notation fertig, Agenten-Format fehlt |
| Konversationsablauf | ⏳ | Komplett fehlend |

### Nicht Erfüllt ❌ (Nicht Release-Blocker)

| Anforderung | Status | Priorität |
|-------------|--------|-----------|
| Execution History | ❌ | Nice-to-Have (Phase 5) |
| Visual Workflow Editor | ❌ | Future (Phase 5) |
| Community Template Marketplace | ❌ | Future (Phase 5) |
| Advanced Chain-Features (Loops, Conditionals) | ❌ | Nice-to-Have (Phase 5) |

---

## 4. Nächste Schritte (Roadmap)

### Phase 4.1: Agenten-Notation (2-3 Tage)

**Ziele:**
1. Markdown-Format für Agenten definieren
2. Parser für Agenten-Definitionen implementieren
3. Beispiel-Templates erstellen

**Aufgaben:**
- [ ] `agent-parser.ts` erstellen (ähnlich yaml-parser.ts)
- [ ] Agenten-Typen in `types.ts` erweitern
- [ ] System-Prompt-Parsing implementieren
- [ ] Tool-Referenzen in Agenten parsen
- [ ] Memory-Format definieren
- [ ] 3 Beispiel-Agenten erstellen (examples/agents/)
- [ ] Tests für Agent-Parsing (Unit + Integration)

**Beispiel-Format:**
```markdown
---
agent: true
id: research_assistant
name: "Research Assistant"
description: "Hilft bei Recherche-Aufgaben"
tools:
  - search_files
  - read_file
  - rest_request
memory:
  type: "conversation"
  max_messages: 20
---

# Research Assistant

## System Prompt
Du bist ein hilfreicher Recherche-Assistent...

## Kontext
{{vault_path}}
{{current_date}}

## Konversation
User: {{last_message}}
Assistant: 
```

### Phase 4.2: Konversationslogik (3-4 Tage)

**Ziele:**
1. Markdown-Nachrichten erkennen und parsen
2. Trigger-Mechanismus für neue Nachrichten
3. Automatisches Rückschreiben implementieren

**Aufgaben:**
- [ ] `conversation.ts` Modul erstellen
- [ ] Markdown-Nachrichtenformat definieren
- [ ] File-Watcher für Konversations-Dateien
- [ ] Message-Extraction aus Markdown
- [ ] Response-Insertion in Markdown
- [ ] Kontext-Management (Token-Limits)
- [ ] Tests für Konversationslogik
- [ ] Beispiel-Konversation erstellen

**Technische Entscheidungen:**
- File-Watch via Obsidian `vault.on('modify')`
- Nachrichtenformat: Standard Markdown mit `User:` und `Assistant:` Prefixen
- Kontext-Limit: Konfigurierbar (Standard: 4000 Tokens)

### Phase 4.3: OpenRouter-Integration (2-3 Tage)

**Ziele:**
1. API-Key-Verwaltung (bereits UI vorhanden)
2. Request/Response-Handling
3. LLM-Auswahl und Konfiguration

**Aufgaben:**
- [ ] `openrouter.ts` Modul erstellen
- [ ] API-Client implementieren (fetch-basiert)
- [ ] Request-Builder für OpenRouter API
- [ ] Response-Parser für LLM-Outputs
- [ ] Error-Handling (Rate-Limiting, Timeouts)
- [ ] LLM-Auswahl in Settings
- [ ] Mock-Tests für API-Calls
- [ ] Integration mit Conversation-Logik

**API-Design:**
```typescript
interface OpenRouterClient {
  sendMessage(
    systemPrompt: string,
    messages: Message[],
    model?: string
  ): Promise<string>;
}
```

### Phase 4.4: Testing & Iteration (2-3 Tage)

**Ziele:**
1. Manuelle Tests in Obsidian
2. Performance-Profiling
3. Bug-Fixes

**Aufgaben:**
- [ ] Manuelle Tests: Agenten erstellen und ausführen
- [ ] Manuelle Tests: Konversationen mit LLM
- [ ] Performance-Tests (große Konversationen)
- [ ] Memory-Leak-Tests
- [ ] Mobile-Tests (iOS/Android)
- [ ] Bug-Fixes basierend auf Tests
- [ ] Dokumentation aktualisieren

### Phase 5: Advanced Features (Future)

**Geplant (nicht Release-Blocker):**
- Execution History Panel
- Conditional Steps in Chains (`if`, `else`)
- Loops in Chains (`for`, `while`)
- Visual Workflow Editor
- Community Template Marketplace
- Observability (Metrics, Tracing)

---

## 5. Zeitplan

| Phase | Dauer | Start | Ende |
|-------|-------|-------|------|
| Phase 4.1: Agenten-Notation | 2-3 Tage | 30. Jan | 1. Feb |
| Phase 4.2: Konversationslogik | 3-4 Tage | 2. Feb | 5. Feb |
| Phase 4.3: OpenRouter-Integration | 2-3 Tage | 6. Feb | 8. Feb |
| Phase 4.4: Testing & Iteration | 2-3 Tage | 9. Feb | 11. Feb |
| **Release 0.1.0** | - | - | **12. Feb** |

**Gesamt:** ~9-13 Tage (ca. 2 Wochen)

---

## 6. Risiken & Mitigationen

### Risiko 1: LLM-Integration komplexer als erwartet
**Wahrscheinlichkeit:** Mittel  
**Impact:** Hoch  
**Mitigation:** 
- OpenRouter API ist gut dokumentiert
- Fallback: Erst nur einfache Completion implementieren
- Zeitpuffer: 1-2 Tage extra eingeplant

### Risiko 2: Markdown-Parsing-Probleme
**Wahrscheinlichkeit:** Mittel  
**Impact:** Mittel  
**Mitigation:**
- Bereits Erfahrung mit YAML-Parsing vorhanden
- Parser gut testbar (Unit-Tests)
- Validierung mit LLM-Feedback als Fallback

### Risiko 3: Performance-Probleme bei langen Konversationen
**Wahrscheinlichkeit:** Niedrig  
**Impact:** Mittel  
**Mitigation:**
- Token-Limits frühzeitig implementieren
- Zusammenfassung alter Nachrichten
- Konfigurierbare Limits

### Risiko 4: Mobile-Kompatibilität
**Wahrscheinlichkeit:** Niedrig  
**Impact:** Niedrig  
**Mitigation:**
- QuickJS bereits mobile-kompatibel
- OpenRouter API ist REST-basiert (kein Node.js)
- Frühe Mobile-Tests

---

## 7. Erfolgskriterien

### Phase 4 Abschluss

**Must-Have:**
- ✅ Agenten können in Markdown definiert werden
- ✅ Konversationen funktionieren (User → Agent → Response)
- ✅ OpenRouter-Integration funktioniert
- ✅ Mindestens 1 funktionierender Beispiel-Agent
- ✅ Build erfolgreich, Tests bestanden

**Nice-to-Have:**
- Mehrere Beispiel-Agenten
- Gute Test-Coverage für neue Features (>70%)
- Performance akzeptabel (<1s Response-Zeit)

### Release 0.1.0

**Kriterien:**
- Alle Phase 1-4 Features implementiert
- Manuelle Tests erfolgreich (Desktop + Mobile)
- Dokumentation aktuell
- Keine kritischen Bugs
- Release Notes erstellt

---

## 8. Dokumentations-Status

### Neu Erstellt ✅

1. **README.md** - Konsolidierte Single Source of Truth
   - Projektübersicht und Vision
   - Features (implementiert + geplant)
   - Schnellstart und Installation
   - Architektur und Roadmap
   - Alle Phasen dokumentiert

2. **DEVELOPMENT.md** - Entwickler-Leitfaden
   - Setup-Anweisungen
   - Projektstruktur
   - Code-Style und Conventions
   - Testing-Strategie
   - Contributing Guidelines

3. **Dieses Dokument** - Status & Nächste Schritte
   - Anforderungsvergleich
   - Implementierungsstand
   - Roadmap und Zeitplan

### Aktualisiert ✅

- **AGENTS.md** - AI-Agent-Richtlinien (Referenzen zu README.md)
- **manuals/tools.md** - Tool-Notation (bereits umfassend)
- **examples/** - 4 Beispiel-Tools (bereits vorhanden)
- **Reports/PhaseWerkzeuge.md** - Phase 1-3 Bericht (bereits detailliert)

### Entfernt ✅

- **README_NEW.md** - War technische Doku, jetzt in README.md integriert

---

## 9. Zusammenfassung

### Was ist fertig?

**Kernfunktionalität (Phase 1-3):**
- ✅ Tool-Framework mit 4 vordefinierten Tools
- ✅ Custom Tool-Support
- ✅ Pre-/Post-Processing in QuickJS-Sandbox
- ✅ Human-in-the-Loop für kritische Operationen
- ✅ Chain-Tools mit Platzhaltern
- ✅ Mobile-kompatibel
- ✅ 76 Tests, 67% Coverage
- ✅ Umfassende Dokumentation

### Was fehlt noch?

**Agenten-Features (Phase 4):**
- ⏳ Agenten-Notation und Parser
- ⏳ Konversationslogik
- ⏳ OpenRouter-Integration

### Wann ist Release 0.1.0?

**Geschätzt:** 12. Februar 2026 (in ~2 Wochen)

**Voraussetzungen:**
- Phase 4.1-4.4 abgeschlossen
- Manuelle Tests erfolgreich
- Dokumentation aktualisiert

---

## 10. Empfehlung

**Vorgehen:**

1. **Sofort starten:** Phase 4.1 (Agenten-Notation)
   - Klare Anforderungen
   - Ähnlich zu Tool-Parsing (bereits funktionstüchtig)
   - Niedrige Komplexität

2. **Parallel:** Dokumentation auf dem neuesten Stand halten
   - README.md als Single Source of Truth nutzen
   - Beispiele früh erstellen

3. **Wöchentliche Reviews:** Fortschritt überprüfen
   - Risiken neu bewerten
   - Zeitplan anpassen falls nötig

4. **Release-Fokus:** Phase 5 Features auf später verschieben
   - Execution History nicht kritisch
   - Advanced Features optional

**Fazit:**  
Das Plugin hat eine **solide Foundation** (Phase 1-3). Die nächsten Schritte (Phase 4) sind **klar definiert** und **realistisch umsetzbar**. Ein Release in **2 Wochen** ist **machbar**, wenn der Fokus auf Must-Have-Features liegt.

---

*Erstellt: 29. Januar 2026*  
*Autor: GitHub Copilot*  
*Basierend auf: Projektbeschreibung, Code-Analyse, Phase-Reports*
