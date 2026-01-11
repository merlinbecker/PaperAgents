# Testing Implementation Summary – Session Jan 11, 2026

## Übersicht

Diese Session implementierte das finale E2E-Test-Framework für alle vier Szenarien (Single-Tool, Chain, Parser-Fehler, Discovery & Execution). Alle Tests sind nun grün.

---

## Kernentscheidungen

### 1. **Fehlerbehandlung mit Kontext-Information (Scenario 3)**

**Entscheidung**: Dedizierte `YAMLParseError` Klasse mit Zeile/Spalte/Snippet-Metadata statt generischer `Error`.

**Begründung**:
- Parser-Fehler erfordern genaue Lokalisierung für User-Feedback
- Zeilen- und Spaltennummern aus Markdown-Frontmatter sind für IDE- und UI-Integration notwendig
- Snippet-Text hilft bei Debugging

**Implementierung**:
- `YAMLParseError` mit `position: { line, column }` Objekt
- Base-Line-Offset von Frontmatter-Start berechnet
- Alle Parser-Validierungen werfen `YAMLParseError` mit genauen Koordinaten

**Code**:
```typescript
export class YAMLParseError extends Error {
  line: number;
  column: number;
  position: { line: number; column: number };
  snippet?: string;
}
```

---

### 2. **Chain-Output-Propagation (Scenario 2)**

**Entscheidung**: Placeholder-System mit Array-Indizes und direkten Step-Referenzen + Executor-Context-Injection.

**Begründung**:
- Chain-Steps müssen Outputs vorheriger Steps verwenden können
- Verschiedene Datenstrukturen (Arrays, Objects, Scalars) müssen adressierbar sein
- Konsistenz mit Common Workflow-Notationen (DAGs, CI/CD Pipelines)

**Implementierung**:
- PlaceholderReplacer: `{{search_files.results[0].path}}`
- Fallback zu `{{prev_step.output}}` für zuletzt ausgeführten Step
- Executor injiziert `previousOutputs` in ExecutionContext
- JSON.stringify für komplexe Objekte als Fallback

**Fixture-Beispiel**:
```yaml
steps:
  - name: "search_files"
    parameters:
      query: "{{query}}"
  - name: "read_file"
    parameters:
      filePath: "{{search_files.results[0].path}}"
```

---

### 3. **Custom-JS Sandbox – Stub mit klarer Migration Path (Scenario 1 & 4)**

**Entscheidung**: Node.js `Function`-Wrapper für Stub-Mode; klare Struktur für QuickJS-Migration.

**Begründung**:
- Keine externe Abhängigkeit im MVP (QuickJS wäre zusätzliche Komplexität)
- Stub erlaubt E2E-Tests ohne Isolation
- Klare Trennung: Stub-Mode vs. echte Sandbox für später

**Implementierung**:
```typescript
// QuickJS-Platzhalter
class QuickJSSandbox {
  async execute(code: string, ctx: ExecutionContext) {
    // Stub: einfacher Function-Wrapper
    const runner = new Function("context", code);
    return runner(scriptContext);
  }
}
```

**Validierung**: Basis-Pattern-Check für `require`, `eval`, `process`, `global`, `Function`

**Migration Path**: Wenn `quickjs-emscripten` installiert ist, echte Runtime laden

---

### 4. **YAML-Parser: Strikte Zeilen-für-Zeilen Validierung**

**Entscheidung**: Parser validiert jede Zeile auf gültiges YAML; bei Fehler: `YAMLParseError` mit Position.

**Begründung**:
- Frühe Fehler-Erkennung statt silent fallback
- Benutzer erhalten sofort Feedback über fehlerhafte Notation
- Verhindert verwirrende downstream-Fehler

**Validierungen**:
- Jede Non-Comment-Zeile muss `key: value` oder `- item` sein
- Array-Items ohne Parent-Key → Fehler
- Nested Properties ohne korrekter Einrückung → Fehler
- Ungültige YAML-Syntax → `Invalid YAML frontmatter: ...`

---

## Implementierte Funktionen

### Parser (`src/parser/yaml-parser.ts`)

| Feature | Status | Details |
|---------|--------|---------|
| Frontmatter-Extraktion | ✅ | `^---\n...\n---` Regex |
| YAML Parsing (Hand-rolled) | ✅ | Arrays, Nested Objects, Type-Konversion |
| Error Location Tracking | ✅ | Zeile/Spalte/Snippet mit `YAMLParseError` |
| Field Validation | ✅ | Required: `id`, `name`, `type` |

### Placeholder Replacement (`src/parser/placeholder.ts`)

| Feature | Status | Details |
|---------|--------|---------|
| Simple Placeholders | ✅ | `{{param_name}}` |
| Nested Object Access | ✅ | `{{step.output.field}}` |
| Array Indexing | ✅ | `{{results[0].path}}` |
| Step Reference | ✅ | `{{prev_step.output}}` |
| Type Handling | ✅ | JSON.stringify für komplexe Typen |

### Tool Executor (`src/core/tool-executor.ts`)

| Feature | Status | Details |
|---------|--------|---------|
| Single-Tool Execution | ✅ | Custom-JS via Sandbox |
| Chain Execution | ✅ | Sequenzielle Steps mit Output-Sharing |
| Parameter Validation | ✅ | Vor Ausführung geprüft |
| HITL Support | ✅ | Callback-Framework (UI-Integration pending) |
| Error Handling | ✅ | Mit Logs & Context |

### Registry (`src/core/tool-registry.ts`)

| Feature | Status | Details |
|---------|--------|---------|
| Predefined Tool Registration | ✅ | Factory Pattern |
| Custom Tool Registration | ✅ | Agent → IExecutableTool |
| Tool Discovery | ✅ | getTool, listTools, searchTools |
| Metadata Generation | ✅ | Für UI-Rendering |

### Custom Loader (`src/parser/tool-loader.ts`)

| Feature | Status | Details |
|---------|--------|---------|
| Vault Tool Discovery | ✅ | Rekursive .md-Suche mit `tool: true` Check |
| Batch Loading | ✅ | Parallel File-Reads |
| Error Collection | ✅ | `failed[]` mit Details |

---

## Test-Struktur

### E2E Tests (alle grün ✅)

```
tests/integration/e2e/
├── scenario1-single.spec.ts       # Single-Tool mit Custom-JS
├── scenario2-chain.spec.ts        # 2-Step Chain (search+read)
├── scenario3-parser-errors.spec.ts # Frontmatter Validierung
└── scenario4-discovery-exec.spec.ts # Discovery + Ausführung 4 Tools
```

### Unit Tests
- `parser/` (YAML, Placeholder, Validator)
- `core/` (Registry, Executor, HITL)
- `tools/` (Predefined Tool Factories)

### Fixtures
```
tests/fixtures/markdown/
├── tool-single.md
├── tool-chain.md
├── tool-discovery-{a,b,c,d}.md
├── custom-tool.md
└── tool-invalid.md (für Fehler-Tests)
```

---

## Kritische Design-Entscheidungen

### 1. **Notation-Wahl: YAML Frontmatter**
- Pro: Human-readable, Standard für Static Site Generators
- Con: Parser ist Hand-rolled (keine externe YAML-Lib)
- Entscheidung: Reduziert Dependencies, Code bleibt klein & lesbar

### 2. **Placeholder-Syntax: Mustache-ähnlich**
- Pro: Vertraut, einfach zu parsen
- Con: Keine komplexen Expressions (Loop, Conditionals)
- Entscheidung: Genug für MVP; komplexe Logik gehört in Custom-JS

### 3. **Custom-JS Sandbox: Stub-Mode im MVP**
- Pro: Keine zusätzliche Dependency, Tests laufen schnell
- Con: Keine echte Isolation
- Entscheidung: QuickJS-Integration postponed; Migration Path klar

### 4. **Output-Format: Flache Map statt Nested**
```typescript
// Executor gibt zurück:
{ 
  success: true,
  data: {
    outputs: {
      search_files: { results: [...] },
      read_file: { content: "..." }
    }
  }
}
```
- Reason: Einfach zu iterieren für HITL-UI, konsistent mit Log-Format

---

## Bekannte Limitationen (für nächste Phase)

| Issue | Workaround | Priority |
|-------|-----------|----------|
| Keine echte JS-Isolation | Stub-Mode; Code-Validierung | P1 |
| HITL-UI fehlt | Callback-Framework ready | P1 |
| `preprocess`/`postprocess` ignoriert | Manuell in Custom-JS | P2 |
| Keine Conditional Branching | Alles in Custom-JS | P2 |
| Keine Retry-Policy | Manual per Step | P3 |

---

## Testing-Strategie

1. **Unit Tests**: Parser, Placeholder, Validator isoliert
2. **Integration Tests**: Registry + Loader mit Mocked Vault
3. **E2E Tests**: Komplette Workflows über tatsächliche Markdown-Dateien

**Coverage Target**: >80% für `src/parser` und `src/core`

---

## Nächste Phase: Notation-Refinement

1. **Frontmatter-Standard finalisieren** (Single vs. Chain Struktur)
2. **Best-Practice-Beispiele** in Fixtures aktualisieren
3. **Strikte Validierung** für unerwartete Kombinationen
4. **Dokumentation** überarbeiten (README, Tutorial)
5. **HITL-UI** implementieren (Modal + Sidebar)

---

**Session-Datum**: 2026-01-11  
**Alle Tests**: ✅ PASSING  
**Nächster Fokus**: Notation & Documentation
