### **Zusammenfassung: YAML-Schema für Paper Agent Tools**

#### **1. Grundstruktur**
Jede Tool-Definition wird in einer **eigenen Markdown-Datei** mit YAML-Frontmatter gespeichert und durch das Attribut **`tool: true`** gekennzeichnet.

---

#### **2. Attribute & Typen**
| **Attribut**         | **Typ**               | **Beschreibung**                                                                                     |
|----------------------|-----------------------|-----------------------------------------------------------------------------------------------------|
| `tool`               | `boolean`             | **Pflichtfeld.** Kennzeichnet die Datei als Tool-Definition (`tool: true`).                          |
| `name`               | `string`              | **Pflichtfeld.** Eindeutiger Name des Tools.                                                        |
| `description`        | `string`              | Beschreibung des Tools (wird in der Sidebar angezeigt).                                             |
| `type`               | `"single" \| "chain"` | Gibt an, ob es sich um ein **einzelnes Tool** oder eine **Chain** handelt.                           |
| `parameters`         | `Array`               | Liste der Parameter, die der Nutzer beim Testen eingibt.                                            |
| `custom_function`    | `string` (JS-Code)    | **Nur bei `type: "single"`.** Benutzerdefinierter JS-Code für Datenverarbeitung in der Sandbox.      |
| `steps`              | `Array`               | **Nur bei `type: "chain"`.** Liste der auszuführenden Tools (vordefiniert oder benutzerdefiniert).    |

---

#### **3. Parameter-Definition**
Jeder Parameter hat folgende Struktur:
```yaml
parameters:
  - name: "param_name"
    type: "string" | "number" | "boolean" | "array" | "object"
    description: "Beschreibung des Parameters"
    required: true | false
    default: "Standardwert"  # Optional
```

---

#### **4. Vordefinierte Tools**
Können in Chains verwendet werden:
- `search_files`
- `read_file`
- `write_file` (mit Human-in-the-Loop-Bestätigung)
- `rest_request` (mit HITL bei PUT/POST)

**Beispiel:**
```yaml
steps:
  - name: "search_files"
    parameters:
      query: "{{tag}} AND -template"
      path: "/notes"
```

---

#### **5. Benutzerdefinierte Funktionen**
- **`custom_function`:** Enthält JS-Code, der in der Sandbox ausgeführt wird.
- **Eingabe:** `input` (Parameter + Daten aus vorherigen Steps).
- **Ausgabe:** `output` (wird an den nächsten Step oder Nutzer zurückgegeben).

**Beispiel:**
```yaml
custom_function: |
  function transform(input) {
    return {
      transformed: input.input_data.map(item => item.toUpperCase())
    };
  }
  return transform(input);
```

---

#### **6. Platzhalter**
| **Platzhalter**       | **Beschreibung**                                      |
|-----------------------|-------------------------------------------------------|
| `{{param_name}}`      | Wert eines Nutzer-Parameters.                         |
| `{{prev_step.output}}`| Ausgabe des vorherigen Schritts.                      |
| `{{date}}`            | Aktuelles Datum (`YYYY-MM-DD`).                       |
| `{{time}}`            | Aktuelle Uhrzeit (`HH:mm:ss`).                        |
| `{{random_id}}`       | Zufällige ID (UUID).                                  |

---

#### **7. Chains (Tool-Ketten)**
- **`steps`:** Liste von Tools, die nacheinander ausgeführt werden.
- **Beispiel:**
  ```yaml
  steps:
    - name: "search_files"
      parameters:
        query: "{{tag}} AND -template"
    - name: "transform_data"  # Benutzerdefinierte Funktion
      parameters:
        input_data: "{{prev_step.output}}"
    - name: "write_file"
      parameters:
        filePath: "/backups/{{date}}.md"
        content: "{{prev_step.output.transformed}}"
  ```

---

#### **8. Testen & Sidebar**
- **Test-Workflow:**
  1. Nutzer wählt Tool in der Sidebar aus.
  2. Plugin zeigt Formular mit den `parameters` an.
  3. Nach Eingabe der Werte wird das Tool/Chain ausgeführt.
- **Ausgabe:** Ergebnis wird angezeigt (z. B. `{ transformed: ["A", "B", "C"] }`).

---

#### **9. Fehlerbehandlung & Logging**
- **Fehlerformat:**
  ```yaml
  execution_log:
    - step: 1
      name: "search_files"
      status: "error"
      message: "Keine Dateien gefunden"
  ```
- **Logging:** Kann in der Tool-Datei oder separat gespeichert werden.

---
**Das Schema ist bereit für die Implementierung!**
**Nächste Schritte in einer neuen Unterhaltung:**
- Parser für YAML + JS-Code implementieren.
- Sandbox-Integration testen.
- UI für die Sidebar und das Testen bauen.