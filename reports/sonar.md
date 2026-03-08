# SonarQube Issues – Inventarisierung und Behebung

**Datum:** 2026-03-08  
**Bearbeiter:** @copilot  
**Projekt:** merlinbecker_PaperAgents

---

## Zusammenfassung

Alle offenen SonarQube Issues wurden gesichtet und nach Priorität kategorisiert. Insgesamt gab es 31 offene Issues und 7 Security Hotspots. Die wichtigsten Issues wurden behoben, False Positives dokumentiert und Security Hotspots bewertet.

| Kategorie       | Gesamt | Behoben | False Positive | Akzeptiert |
|-----------------|--------|---------|----------------|------------|
| CRITICAL        | 2      | 0       | 0              | 2 (komplex)|
| MAJOR           | 9      | 7       | 0              | 2 (stale)  |
| MINOR           | 20     | 10      | 4              | 6          |
| Security Hotspot| 7      | 4 (FIXED)| 3 (SAFE)      | 0          |

---

## Behobene Issues

### MAJOR

| Key | Datei | Zeile | Regel | Beschreibung | Fix |
|-----|-------|-------|-------|-------------|-----|
| AZzO67kUbUJJ94dzEVzl | `src/core/canvas-agent.ts` | 289 | S6582 | Optional chain statt `&&`-Guard | `!match || !match[1]` → `!match?.[1]` |
| AZzO2IXUk705V7y5qRj6 | `src/core/canvas-agent.ts` | 243 | S6582 | Optional chain | `selection && selection.trim() ? selection.trim() : null` → `selection?.trim() \|\| null` |
| AZzEkm4T6dRtrXWPq24c | `src/core/canvas-agent.ts` | 45  | S6582 | Optional chain | `!file \|\| file.extension !== "md"` → `file?.extension !== "md"` |
| AZzEk1VnJaAH9qebyqAz | `src/parser/wikilink-resolver.ts` | 24 | S6535 | Unnötiges Escape `\[` in Regex | `[^\]\[]` → `[^\][` |
| AZzCnxL0rz5mteQSSzK2 | `src/core/tool-executor.ts` | 189 | S107  | Zu viele Parameter (8/7) | `ChainTraceContext`-Objekt eingeführt: `{traceId, parentSpanId, executionId}` |
| AZzCnxPkrz5mteQSSzK4 | `src/parser/yaml-parser.ts` | 97  | S3358 | Verschachtelter Ternary | Ternary in separate Variablen extrahiert |
| AZzCnxPJrz5mteQSSzK3 | `src/parser/agent-parser.ts` | 118 | S1854 | Nutzlose Zuweisung `inArray = false` | Zuweisung entfernt (wird direkt überschrieben) |
| AZzDGWMtQh-IuXSnrH_i | `styles.css` | 1014 | css:S7924 | Unzureichender Kontrast (3.66:1, Minimum 4.5:1) | Hintergrundfarbe von `#2e86c1` auf `#1a6fa3` geändert (5.07:1) |

### MINOR

| Key | Datei | Zeile | Regel | Beschreibung | Fix |
|-----|-------|-------|-------|-------------|-----|
| AZzO67kUbUJJ94dzEVzm | `src/core/canvas-agent.ts` | 292 | S7773 | `parseInt` → `Number.parseInt` | `parseInt(x, 10)` → `Number.parseInt(x, 10)` |
| AZzO67kUbUJJ94dzEVzk | `src/core/canvas-agent.ts` | 135 | S7735 | Negierte Bedingung | `if (paragraphIndex !== null)` → `if (paragraphIndex === null)` mit getauschten Zweigen |
| AZzDSYr7cA_XXrmcDR9Z | `src/ui/chat.ts` | 485–509 | S7781 | `replace` → `replaceAll` | Alle 5 Aufrufe in `saveLoopReport` und `buildReportContent` umgestellt |
| AZzDSYr7cA_XXrmcDR9c | `src/ui/chat.ts` | 509 | S7780 | `String.raw` für Backslash-Escaping | `"\\\\"` → `String.raw\`\\\\\`` |
| AZzDSYwLcA_XXrmcDR9d | `tests/.../orchestrator.spec.ts` | 47 | S7781/S7780 | `replace` → `replaceAll` + `String.raw` | Gleiche Umstellung |
| AZzEkm6T6dRtrXWPq24d/e | `tests/.../canvas-agent.spec.ts` | 4–5 | S2094 | Leere Klassen in Mock | `class {}` → `vi.fn()` |
| AZzO2IZ-k705V7y5qRj7/8 | `tests/.../canvas-agent.spec.ts` | 20/25 | S7735 | Negierte Bedingungen | `!== undefined` → `=== undefined` (Zweige getauscht); `selection !== null` → `selection === null` |
| AZzOvOpNPquwnIS43uXd/e | `tests/.../canvas-agent.spec.ts` | 302/320 | S4325 | Unnötige Type Assertion `as never` | Redundante `as never`-Casts entfernt |

---

## Security Hotspots

| Key | Datei | Zeile | Kategorie | Wahrscheinlichkeit | Bewertung | Begründung |
|-----|-------|-------|-----------|-------------------|-----------|------------|
| AZyQ6SApmGxIOc1HzKkS/V/X/b | `src/parser/agent-parser.ts` | 177–193 | DoS (ReDoS) | MEDIUM | **FIXED** | `[\s\S]*?`-Regex in `extractSections` durch sichere zeilenweise Verarbeitung (Map-basiert) ersetzt |
| AZy1IGChVpv9g5a1OorC | `src/core/conversation.ts` | 343 | DoS (ReDoS) | MEDIUM | **SAFE** | `/\(([^)]+)\)/` – `[^)]+` ist negierte Zeichenklasse, O(n), kein ReDoS möglich |
| AZzCRCDIkolwbU_sxS5C | `src/parser/yaml-parser.ts` | 257 | DoS (ReDoS) | MEDIUM | **SAFE** | `/^(\w+):\s*(.*)$/` operiert auf einzelnen YAML-Zeilen (split vorher), begrenzte Länge |
| AZyk0JoVS3KiHI-Avnsa | `tests/mocks/quickjs.ts` | 37 | RCE | MEDIUM | **SAFE** | Test-Mock der QuickJS-Sandbox, kein Produktions-Code, explizit kontrollierte Testumgebung |

---

## Nicht behobene Issues (akzeptiert oder zu komplex)

### CRITICAL – Kognitive Komplexität (S3776)

| Key | Datei | Zeile | Komplexität | Begründung |
|-----|-------|-------|-------------|------------|
| AZyQ6SApmGxIOc1HzKkM | `src/parser/agent-parser.ts` | 78 | 34/15 | Die `parseFrontmatter`-Funktion wurde in vorherigen Sprints bereits auf `processTopLevelKey` aufgeteilt. Ein vollständiges Refactoring erfordert weitere Zerlegung, die separate Aufgabe rechtfertigt. |
| AZzJ9xvjnpfnfw46DC0T | `src/parser/yaml-parser.ts` | 61 | 74/15 | Die `parseYAML`-Funktion ist ein komplexer, zustandsbehafteter YAML-Parser. Vollständiges Refactoring auf mehrere Klassen/Methoden ist umfangreiche Arbeit und sollte als eigene Aufgabe behandelt werden (Technical Debt). |

### MINOR – False Positives (S6551)

Die folgenden Issues wurden als **False Positive** markiert, da der Code objektbasierte Werte korrekt mit `JSON.stringify()` behandelt (explizite `typeof value === "object"`-Prüfung vorhanden):

| Key | Datei | Zeile |
|-----|-------|-------|
| AZzCiwtY2vaqiWb_BsGj | `src/ui/forms.ts` | 329 |
| AZy1IGGqVpv9g5a1OorD | `src/ui/forms.ts` | 193 |
| AZyk0Ji3S3KiHI-Avnrs | `src/ui/hitl-modal.ts` | 133 |
| AZyk0JltS3KiHI-AvnsH | `src/parser/placeholder.ts` | 76 |

---

## Geänderte Dateien

| Datei | Art der Änderung |
|-------|-----------------|
| `src/core/canvas-agent.ts` | S6582 (3×), S7735, S7773 |
| `src/parser/wikilink-resolver.ts` | S6535 |
| `src/core/tool-executor.ts` | S107 (`ChainTraceContext` Interface) |
| `src/parser/yaml-parser.ts` | S3358 |
| `src/parser/agent-parser.ts` | S1854, ReDoS-Fix (extractSections refactored) |
| `src/ui/chat.ts` | S7781 (5×), S7780 |
| `styles.css` | css:S7924 (Kontrast) |
| `tests/unit/core/canvas-agent.spec.ts` | S2094, S7735 (2×), S4325 (2×) |
| `tests/unit/core/orchestrator.spec.ts` | S7781, S7780 |

---

## Test-Validierung

Alle 385 bestehenden Tests laufen weiterhin erfolgreich durch:

```
Test Files  25 passed (25)
     Tests  385 passed (385)
```

---

## Offene technische Schulden

| # | Issue | Priorität | Aufwand |
|---|-------|-----------|---------|
| TS-S1 | Kognitive Komplexität `agent-parser.ts::parseFrontmatter` (34 → ≤15) | Mittel | ~1 Tag |
| TS-S2 | Kognitive Komplexität `yaml-parser.ts::parseYAML` (74 → ≤15) | Hoch | ~2 Tage |
