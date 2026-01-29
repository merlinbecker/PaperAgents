# Beispiel-Agenten

Dieses Verzeichnis enthält Beispiel-Agenten für Paper Agents. Agenten sind LLM-basierte Assistenten, die mit Tools interagieren können.

## Verfügbare Beispiele

### 1. Research Assistant (`research-assistant.md`)
Ein Recherche-Assistent, der Dateien im Vault durchsucht und Informationen zusammenfasst.

**Tools:** `search_files`, `read_file`  
**Anwendungsfall:** Informationen finden, Zusammenfassungen erstellen

### 2. Writing Helper (`writing-helper.md`)
Ein Schreibassistent, der beim Korrekturlesen und Verbessern von Texten hilft.

**Tools:** `read_file`, `write_file`  
**Anwendungsfall:** Texte verbessern, Korrekturlesen

### 3. API Helper (`api-helper.md`)
Ein API-Experte, der bei der Arbeit mit externen Diensten unterstützt.

**Tools:** `rest_request`, `write_file`  
**Anwendungsfall:** API-Calls machen, Daten abrufen

## Agenten-Format

Agenten werden in Markdown-Dateien definiert:

```markdown
---
agent: true
id: mein_agent
name: "Mein Agent"
description: "Beschreibung"
model: openai/gpt-4o-mini
tools:
  - search_files
  - read_file
memory:
  type: conversation
  maxMessages: 20
temperature: 0.7
---

## System Prompt
Du bist ein hilfreicher Assistent...

## Kontext
Datum: {{current_date}}
```

## Frontmatter-Felder

| Feld | Erforderlich | Beschreibung |
|------|--------------|--------------|
| `agent` | Ja | Muss `true` sein |
| `id` | Ja | Eindeutige ID des Agenten |
| `name` | Ja | Anzeigename |
| `description` | Nein | Kurzbeschreibung |
| `model` | Nein | LLM-Modell (Standard: `openai/gpt-4o-mini`) |
| `tools` | Nein | Liste der verfügbaren Tools |
| `memory.type` | Nein | `conversation`, `summary`, oder `none` |
| `memory.maxMessages` | Nein | Max. Nachrichten im Kontext |
| `temperature` | Nein | Kreativität (0.0 - 2.0) |
| `maxTokens` | Nein | Max. Tokens pro Antwort |

## Sections

### System Prompt (erforderlich)
Der Hauptprompt, der das Verhalten des Agenten definiert.

```markdown
## System Prompt
Du bist ein hilfreicher Assistent...
```

### Kontext (optional)
Zusätzlicher Kontext mit Platzhaltern.

```markdown
## Kontext
Datum: {{current_date}}
Uhrzeit: {{current_time}}
```

## Platzhalter

- `{{current_date}}` - Aktuelles Datum (YYYY-MM-DD)
- `{{current_time}}` - Aktuelle Uhrzeit (HH:mm:ss)
- `{{vault_path}}` - Pfad zum Vault (wenn verfügbar)
