### **1. Grundstruktur einer Tool-Definition**
Jede Tool-Definition besteht aus:
- **YAML-Frontmatter** (Metadaten, Parameter).
- **Pre-Processing-Block** (optional, JS-Code).
- **Tool-Ausführungsblock** (YAML, Pflicht).
- **Post-Processing-Block** (optional, JS-Code).

**Syntax:**
````markdown
---
tool: true
name: "<tool_name>"
description: "<description>"
type: "single" | "chain"
parameters:
  - name: "<param_name>"
    type: "string" | "number" | "boolean" | "array" | "object"
    description: "<description>"
    required: true | false
    default: <default_value>  # Optional
---

#### **Pre-Processing** (optional)
```javascript
// @preprocess
// <JS-Code>
return <modifiziertes_input>;
```

#### **Tool-Ausführung** (Pflicht)
```yaml
tool: "<tool_name>"
parameters:
  <param1>: "<wert_oder_referenz>"
  <param2>: "<wert_oder_referenz>"
```

#### **Post-Processing** (optional)
```javascript
// @postprocess
// <JS-Code>
return <modifiziertes_output>;
```
````

---

### **2. Regelwerk im Detail**

#### **A. YAML-Frontmatter**
- **Pflichtfelder:**
  - `tool: true` (Kennzeichnung als Tool).
  - `name: "<string>"` (Einzigartiger Name).
  - `type: "single" | "chain"` (Typ des Tools).
- **Parameter:**
  - Jeder Parameter **muss** `name`, `type`, und `description` enthalten.
  - `required` ist standardmäßig `true`.
  - `default` ist optional.

**Beispiel:**
```yaml
parameters:
  - name: "url"
    type: "string"
    description: "Basis-URL für die Suche"
    required: true
```

#### **B. Pre-Processing-Block**
- **Marker:** `// @preprocess` (erster Kommentar im Block).
- **Eingabe:** `input` (Objekt mit den Parametern aus der Frontmatter).
- **Ausgabe:** **Muss** ein Objekt mit `return` zurückgeben.
- **Erlaubte Operationen:**
  - Modifikation von `input`-Feldern (z. B. `input.url += "path"`).
  - Nutzung von **globalen Helfern** (z. B. `encodeURIComponent`).

**Syntax:**
```javascript
// @preprocess
<input.url = input.url + "/path";>  // Beispiel
return input;
```

#### **C. Tool-Ausführungsblock**
- **Format:** YAML mit dem Schlüssel `tool`.
- **Parameter:**
  - Werte können **statisch** (`"GET"`) oder **dynamisch** (`"input.url"`) sein.
  - Dynamische Referenzen:
    - `"input.<feld>"` → Ergebnis aus Pre-Processing.
    - `"prev_step.output"` → Nur in Chains (Ausgabe des vorherigen Schritts).

**Syntax:**
```yaml
tool: "<tool_name>"
parameters:
  url: "input.url"  # Dynamische Referenz
  method: "GET"     # Statischer Wert
```

#### **D. Post-Processing-Block**
- **Marker:** `// @postprocess`.
- **Eingabe:** `output` (Rohausgabe des Tools).
- **Ausgabe:** **Muss** ein Objekt mit `return` zurückgeben.

**Syntax:**
```javascript
// @postprocess
return output.map(item => item.toUpperCase());
```

---

### **3. Parsing-Regeln**
#### **A. Extraktion der Blöcke**
1. **YAML-Frontmatter:**
   - Parse mit `js-yaml` oder `zod` (Schema-Validation).
   - Beispiel-Schema (Pseudocode):
     ```typescript
     interface ToolFrontmatter {
       tool: true;
       name: string;
       type: "single" | "chain";
       parameters: Array<{
         name: string;
         type: string;
         description: string;
         required: boolean;
         default?: any;
       }>;
     }
     ```

2. **JS-Blöcke:**
   - Extrahiere Code-Blöcke mit ````javascript` und den Markern (`@preprocess`, `@postprocess`).
   - Beispiel (Regex):
     ```javascript
     const preprocessCode = content.match(/```javascript\n\/\/@preprocess\n([\s\S]*?)\n```/)?.[1];
     ```

3. **Tool-Block:**
   - Extrahiere YAML zwischen ```` ```yaml` und ```` ```.

#### **B. Validierung**
- **Pre/Post-Processing:**
  - Prüfe auf `return`-Statement.
  - Prüfe auf **verbotenes JS** (z. B. `require`, `fs`).
- **Tool-Block:**
  - Prüfe, ob `tool` und `parameters` vorhanden sind.
  - Validiere Referenzen (z. B. existiert `input.url` im Pre-Processing?).

---

### **4. Datenflüsse & Referenzen**
| **Referenz**       | **Bedeutung**                                  | **Beispiel**               |
|--------------------|-----------------------------------------------|----------------------------|
| `input.<feld>`     | Wert aus Pre-Processing oder Parameter.       | `input.url`                |
| `prev_step.output` | Ausgabe des vorherigen Schritts (nur Chains). | `prev_step.output[0].path` |
| `output`           | Rohausgabe des Tools.                         | `output.map(...)`          |

---

### **5. Fehlerbehandlung**
- **Fehlerquellen:**
  - Fehlende `return`-Statements in JS-Blöcken.
  - Ungültige Referenzen (z. B. `input.undefined`).
  - Syntaxfehler in JS/YAML.

**Fehlerformat:**
```yaml
execution_log:
  - block: "preprocess"
    status: "error"
    message: "SyntaxError: Unexpected token"
  - block: "tool"
    status: "error"
    message: "Parameter 'url' ist Pflichtfeld"
```

---

### **6. Beispiele**
#### **A. Single Tool mit `web_search`**
````markdown
---
tool: true
name: "beispieltool"
type: "single"
parameters:
  - name: "url"
    type: "string"
    required: true
---

#### **Pre-Processing**
```javascript
// @preprocess
input.url += "/search?q=" + input.query;
return input;
```

#### **Tool-Ausführung**
```yaml
tool: "web_search"
parameters:
  url: "input.url"
  method: "GET"
```

#### **Post-Processing**
```javascript
// @postprocess
return output.results.slice(0, 5);
```
````

#### **B. Chain mit zwei Tools**
````markdown
---
tool: true
name: "chain_beispiel"
type: "chain"
parameters:
  - name: "query"
    type: "string"
---

#### **Pre-Processing**
```javascript
// @preprocess
return { query: input.query.trim() };
```

#### **Steps**
```yaml
steps:
  - name: "web_search"
    parameters:
      url: "https://api.example.com?q={{preprocess.query}}"
    post_processing: |
      // @postprocess
      return output.filter(item => item.score > 0.5);

  - name: "save_results"
    parameters:
      data: "prev_step.output"
```
````

---

### **7. Sandbox-Regeln für JS-Code**
- **Erlaubt:**
  - `String`, `Array`, `Object`, `JSON`, `Math`.
  - Helferfunktionen (z. B. `encodeURIComponent`).
- **Verboten:**
  - `require`, `fs`, `eval`, `while(true)`.

---

### **8. Zusammenfassung der Syntaxregeln**
| **Element**         | **Format**                          | **Pflicht** | **Referenzen**               |
|---------------------|-------------------------------------|-------------|------------------------------|
| YAML-Frontmatter    | `---` + YAML                        | Ja          | -                            |
| Pre-Processing      | ````javascript + `@preprocess`      | Nein        | `input`                      |
| Tool-Block          | ````yaml + `tool: "<name>"`         | Ja          | `input.<feld>`, statische Werte |
| Post-Processing     | ````javascript + `@postprocess`     | Nein        | `output`                     |
| Chains              | `steps: [...]`                      | Nur bei `type: "chain"` | `prev_step.output`       |
