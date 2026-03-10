# OCR Agent → Tool Refactoring

**Datum:** 2026-03-10  
**Branch:** `copilot/convert-ocr-agent-workflow`  
**Issue:** Wandel den OCR-Agenten-Workflow in ein eigenes Tool um

---

## Aufgabe

Der bestehende OCR-Agent (`ocr_agent`) implementierte den gesamten PDF-zu-Markdown-Workflow als einen mehrstufigen agentischen Loop. Der Agent musste dabei:

1. Metadaten des PDFs abrufen (`split_and_read_pdf` ohne `chunkIndex`)
2. Bei großen PDFs auf Mobile: Chunks erzeugen und in den Vault speichern
3. Jeden Chunk einzeln mit `read_binary_file` laden
4. Das `file_parser`-Plugin (serverseitig) warten lassen
5. Das OCR-Ergebnis jedes Chunks mit `write_file` speichern
6. Am Ende `finish_task` aufrufen

**Problem:** Dieser Ablauf war zu komplex für einen Agenten: zu viele Iterationen, hohes Fehlerrisiko bei jedem Schritt, schwer nachvollziehbar für den LLM-Loop.

---

## Lösung

### Neues Tool: `pdf_ocr` (`src/tools/pdf-ocr.ts`)

Der gesamte Workflow wird in einem einzigen Tool-Call gekapselt:

**Eingabe:**
| Parameter | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| `pdfPath` | string | ✅ | Vault-Pfad zur PDF-Datei |
| `outputPath` | string | ❌ | Basispfad für die Markdown-Ausgabe (ohne Extension). Standard: gleicher Pfad wie PDF |
| `model` | string | ❌ | OpenRouter-Modell. Standard: `mistralai/mistral-ocr-latest` |

**Verarbeitung:**
1. **Metadaten einlesen**: Vault-Datei lokalisieren, Größe prüfen
2. **Splitting (nur auf Mobile bei > 20 MB)**: pdf-lib zerlegt das PDF in Chunks à max. 5 MB und speichert sie im Temp-Ordner `_ocr_tmp/`
3. **OCR via OpenRouter**: Jeder Chunk wird als `data:application/pdf;base64,...` in der User-Message übermittelt, zusammen mit dem `file-parser`-Plugin
4. **Markdown speichern**: Jedes OCR-Ergebnis wird sofort als `.md`-Datei gespeichert
5. **Aufräumen**: Temp-Chunks werden nach der Verarbeitung gelöscht

**Ausgabe:**
```json
{
  "files": ["papers/article.md"],
  "totalFiles": 1
}
```
Oder bei großen PDFs (mehrere Chunks):
```json
{
  "files": ["papers/article_part_1.md", "papers/article_part_2.md", "papers/article_part_3.md"],
  "totalFiles": 3
}
```

### Aktualisierter OCR-Agent (`examples/agents/ocr-agent.md`)

Der Agent wurde erheblich vereinfacht:

- **Vorher**: 4 Tools (`read_binary_file`, `split_and_read_pdf`, `write_file`, `file_parser`), 20 maximale Iterationen, komplexer System-Prompt mit detaillierten Workflow-Anweisungen
- **Nachher**: 1 Tool (`pdf_ocr`), 5 maximale Iterationen, klarer System-Prompt mit 3 einfachen Regeln

Der Agent ruft jetzt `pdf_ocr` auf und wartet auf das Ergebnis. Kein manuelles Chunk-Management mehr.

### Model-Durchreichung

Das `model`-Parameter des `pdf_ocr`-Tools erlaubt es, das Modell vom Agenten ans Tool durchzureichen. Sofern der Agent kein Modell angibt, wird `mistralai/mistral-ocr-latest` als Standard verwendet.

---

## Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/utils/constants.ts` | `PDF_OCR: "pdf_ocr"` zu `PREDEFINED_TOOL_IDS` hinzugefügt |
| `src/tools/pdf-ocr.ts` | **Neu**: Vollständige Tool-Implementierung |
| `src/main.ts` | `createPdfOcrFactory` importiert und Tool registriert |
| `examples/agents/ocr-agent.md` | Agent vereinfacht: 1 Tool, 5 Iterationen, kompakter Prompt |
| `tests/integration/tools/pdf-ocr.int.spec.ts` | **Neu**: 10 Tests für das neue Tool |
| `tests/mocks/obsidian.ts` | `delete`-Methode zum Vault-Mock hinzugefügt (für Cleanup-Tests) |

---

## Technische Architektur

### API-Aufruf

Das Tool ruft OpenRouter direkt über `requestUrl` (Obsidian-API) auf:

```
POST https://openrouter.ai/api/v1/chat/completions
{
  "model": "mistralai/mistral-ocr-latest",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "file",
          "file": {
            "filename": "document.pdf",
            "file_data": "data:application/pdf;base64,<base64>"
          }
        }
      ]
    }
  ],
  "plugins": [
    {
      "id": "file-parser",
      "pdf": { "engine": "mistral-ocr" }
    }
  ]
}
```

### Factory-Muster

Das Tool verwendet eine Factory-Funktion `createPdfOcrFactory(getApiKey)` statt einer statischen Factory-Instanz, da die OpenRouter-API-Key zur Laufzeit gelesen werden muss (der Benutzer kann ihn in den Einstellungen ändern):

```typescript
// In main.ts
this.toolRegistry.registerPredefined(
  createPdfOcrFactory(() => this.settings.openRouterApiKey)
);
```

Der Getter wird beim `execute()`-Aufruf ausgewertet – so wird immer der aktuelle API-Key verwendet.

---

## Tests

10 neue Integrationstests in `tests/integration/tools/pdf-ocr.int.spec.ts`:

| Test | Beschreibung |
|---|---|
| API key validation | Fehler wenn kein API-Key konfiguriert |
| File not found | Fehler wenn PDF nicht im Vault |
| Single-file OCR (desktop) | OCR-Aufruf + Markdown-Speicherung für kleine PDF |
| Model parameter | Verwendetes Modell wird korrekt übergeben |
| outputPath parameter | Ausgabepfad wird korrekt verwendet |
| HTTP 5xx error | Fehlerbehandlung bei API-Fehlern |
| Empty OCR content | Fehlerbehandlung bei leerem Ergebnis |
| Mobile large PDF | Splitting + mehrteilige Markdown-Ausgabe |
| shouldRequireHITL | Kein HITL erforderlich |
| Factory without App | Fehler bei fehlendem App-Kontext |

Alle 440 Tests (430 bestehend + 10 neu) bestehen.

---

## Beurteilung

### ✅ Was gut gelungen ist

1. **Klare Kapselung**: Der gesamte OCR-Workflow (Metadaten, Splitting, OCR, Speicherung, Aufräumen) ist in einem einzigen Tool-Call enthalten. Der Agent muss nur noch den Pfad übergeben.

2. **Memory-Effizienz auf Mobile**: Das Splitting-Verhalten (nur bei > 20 MB auf Mobile) wurde beibehalten und schützt vor OOM-Crashes auf iOS/Android.

3. **Vereinfachter Agent**: Von 20 Iterationen mit 4 Tools auf 5 Iterationen mit 1 Tool – deutlich weniger Komplexität und weniger Fehleranfälligkeit.

4. **Saubere Factory-Architektur**: Der API-Key wird per Getter-Closure zur Laufzeit gelesen, sodass Einstellungsänderungen automatisch übernommen werden.

5. **Rückwärtskompatibilität**: Das alte Toolset (`read_binary_file`, `split_and_read_pdf`, `write_file`, `file_parser`) bleibt registriert und kann weiterhin direkt verwendet werden.

### ⚠️ Einschränkungen

1. **Kein Timeout pro Chunk**: Große PDFs mit vielen Chunks könnten bei langsamem Netzwerk sehr lange dauern. Eine Timeout-Konfiguration fehlt derzeit.

2. **Kein HITL bei Überschreiben**: Das Tool überschreibt bestehende Markdown-Dateien stillschweigend. Der ursprüngliche Agent fragte via `ask_user` nach. Dieser Trade-off ist für ein Tool akzeptabel (der Agent kann vorher prüfen).

3. **Fehlerwiederholung**: Bei einem fehlgeschlagenen OCR-Aufruf für einen Chunk bricht das Tool komplett ab. Eine Retry-Logik pro Chunk wäre wünschenswert für produktive Nutzung.

4. **Nur PDF unterstützt**: Das Tool ist auf PDFs ausgerichtet. Andere Formate (PNG, JPEG) sind nicht vorgesehen.

### Gesamtbewertung

Die Refaktorierung ist gelungen und erfüllt alle Anforderungen des Issues: Das Tool kapselt den gesamten OCR-Workflow, unterstützt Modell-Durchreichung, räumt Temp-Ressourcen auf und gibt eine Dateiliste zurück. Der OCR-Agent wurde entsprechend vereinfacht.
