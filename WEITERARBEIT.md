# Paper Agents - Hinweise zur Weiterarbeit

**Datum:** 29. Januar 2026  
**Aktueller Stand:** Phase 4.2 abgeschlossen

---

## Projektübersicht

Paper Agents ist ein Obsidian-Plugin für Markdown-basierte Agenten und Tools. Die Phasen 1-4.2 sind abgeschlossen, Phase 4.3 (OpenRouter-Integration) steht aus.

---

## Abgeschlossene Phasen

| Phase | Status | Coverage |
|-------|--------|----------|
| 1. Plugin-Grundgerüst | ✅ | - |
| 2. Tool-Engine | ✅ | 84.43% |
| 3. Sandbox & Security | ✅ | 69.26% |
| 4.1 Agenten-Notation | ✅ | 94.49% |
| 4.2 Konversationslogik | ✅ | 97.47% |
| 4.3 OpenRouter-Integration | ⏳ | - |

**Gesamt-Coverage:** ~75%  
**Tests:** 146 bestanden

---

## Wichtige Dateien

### Kernlogik
- `src/core/conversation.ts` - ConversationManager für State-Management
- `src/core/sandbox.ts` - QuickJS-Sandbox für Pre-/Post-Processing
- `src/core/tool-executor.ts` - 3-Phasen-Pipeline (Pre → Tool → Post)
- `src/core/tool-registry.ts` - Factory Pattern für Tool-Verwaltung

### Parser
- `src/parser/agent-parser.ts` - Agenten-Markdown-Parser
- `src/parser/yaml-parser.ts` - YAML-Frontmatter-Parser
- `src/parser/tool-loader.ts` - Automatische Tool-Discovery

### Typen
- `src/types.ts` - Zentrale Typdefinitionen (280 Zeilen)

### Tests
- `tests/unit/` - Unit-Tests
- `tests/integration/` - Integrationstests

---

## Phase 4.3: OpenRouter-Integration

### Aufgaben

1. **API-Client erstellen** (`src/api/openrouter.ts`)
   - HTTP-Requests an OpenRouter API
   - Request/Response-Typen definieren
   - Error-Handling implementieren

2. **Streaming-Support**
   - Server-Sent Events (SSE) verarbeiten
   - Inkrementelle Antworten an UI weiterleiten

3. **Rate-Limiting & Retry**
   - Exponentielles Backoff
   - Request-Queue bei Überlastung

4. **Tool-Calling-Protokoll**
   - OpenRouter Tool-Format implementieren
   - Tool-Ergebnisse zurück an LLM senden

### OpenRouter API-Dokumentation

```
Endpoint: https://openrouter.ai/api/v1/chat/completions
Method: POST
Headers:
  Authorization: Bearer $OPENROUTER_API_KEY
  Content-Type: application/json

Body:
{
  "model": "openai/gpt-4o-mini",
  "messages": [...],
  "tools": [...],           // Optional
  "stream": true/false
}
```

### Vorhandene Infrastruktur

- **API-Key-UI**: `src/settings.ts` hat bereits ein Feld für OpenRouter-API-Key
- **Message-Format**: `formatMessagesForLLM()` in ConversationManager
- **Tool-Definitionen**: `ToolMetadata` in types.ts

---

## Architektur-Hinweise

### Konversationsformat (Markdown)

```markdown
### User (2026-01-29T10:30:00.000Z)
Nachrichtentext

### Assistant (2026-01-29T10:30:05.000Z)
Antworttext

### Tool (2026-01-29T10:30:10.000Z)
<!-- tool:read_file -->
<!-- params:{"path":"/test.md"} -->
Result: "Dateiinhalt"
```

### Memory-Management

- **conversation**: Behält die letzten N Nachrichten (default: 50)
- **summary**: Fasst alte Nachrichten zusammen (summarizeAfter)
- **none**: Keine History

### Token-Schätzung

Approximativ: 4 Zeichen = 1 Token

---

## Entwicklungsbefehle

```bash
npm run dev      # Watch-Modus
npm run build    # Production Build
npm run test     # Tests mit Coverage
npm run lint     # ESLint
```

---

## Bekannte Einschränkungen

1. **Kein Browser-Preview**: Plugin läuft nur in Obsidian
2. **Token-Counting**: Approximativ, nicht exakt (akzeptabel für Playground)
3. **Sandbox-Limits**: 10 MB Memory, 5s Timeout

---

## Code-Konventionen

- **TypeScript Strict Mode**: Alle Typen explizit
- **Coverage-Ziel**: >80% für neue Dateien
- **Tests**: Vitest mit describe/it Pattern
- **Imports**: Relative Pfade, keine Barrel-Files

---

## Dokumentation

| Datei | Inhalt |
|-------|--------|
| `README.md` | Hauptdokumentation |
| `PROJEKT_STATUS.md` | Detaillierte Roadmap |
| `DEVELOPMENT.md` | Entwickler-Guide |
| `AGENTS.md` | Agenten-Format-Referenz |
| `Reports/PhaseAgent.md` | Phase 4.1/4.2 Reports |
| `replit.md` | Replit-spezifische Infos |
| `examples/agents/README.md` | Beispiel-Agenten-Doku |

---

## Nächste Schritte

1. **OpenRouter-Client implementieren**
2. **Streaming-Antworten in UI integrieren**
3. **Tool-Calling-Loop implementieren**
4. **Manuelle Tests in Obsidian durchführen**
5. **Performance-Profiling**

---

*Erstellt: 29. Januar 2026*
