# 12. Glossar

| Begriff | Definition |
|---------|------------|
| **Agent** | Eine in Markdown definierte Entität mit System-Prompt, Tool-Zugriff und Memory-Konfiguration, die über LLM-API mit dem Nutzer interagiert |
| **BRAT** | Beta Reviewers Auto-update Tester – Obsidian-Plugin für Installation von Beta-Versionen |
| **Chain-Tool** | Ein Tool bestehend aus mehreren sequenziellen Steps, die Output des vorherigen Steps als Input nutzen können |
| **Custom Tool** | Vom Nutzer definiertes Tool als Markdown-Datei im `paper-agents-tools/`-Verzeichnis |
| **Frontmatter** | YAML-Block am Anfang einer Markdown-Datei (zwischen `---`-Markern), enthält Metadaten |
| **HITL** | Human-in-the-Loop – Bestätigungspflicht für destruktive Operationen durch den Nutzer |
| **LLM** | Large Language Model – KI-Sprachmodell (z.B. GPT-4, Claude) |
| **OpenRouter** | API-Gateway, das einheitlichen Zugriff auf verschiedene LLM-Anbieter bietet |
| **Placeholder** | Dynamischer Platzhalter in der Form `{{name}}`, der zur Laufzeit ersetzt wird |
| **Pre-/Post-Processing** | Optionale JavaScript-Transformation der Eingabe (Pre) bzw. Ausgabe (Post) eines Tools |
| **Predefined Tool** | Eines der 4 vordefinierten Tools: `search_files`, `read_file`, `write_file`, `rest_request` |
| **QuickJS** | Leichtgewichtige JavaScript-Engine, hier als WASM-Sandbox via `quickjs-emscripten` eingesetzt |
| **Sandbox** | Isolierte Ausführungsumgebung für JavaScript-Code mit Memory- und Timeout-Limits |
| **Single-Tool** | Ein Tool, das eine einzelne Operation ausführt (optional mit Pre-/Post-Processing) |
| **Tool** | Eine in Markdown definierte, ausführbare Einheit mit Parametern, Ausführungslogik und optionaler Transformation |
| **ToolRegistry** | Factory-basierte Verwaltung aller registrierten Tools (predefined + custom) |

---

**Zurück:** [Risiken und Schulden ←](11-risiken-schulden.md)
