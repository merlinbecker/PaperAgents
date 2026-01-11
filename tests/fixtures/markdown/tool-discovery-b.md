---
tool: true
id: beta
name: "Beta Tool"
type: single
parameters:
  - name: b
    type: number
    required: false
    default: 0
---

#### **Tool-Ausführung**
```yaml
tool: "echo"
parameters:
  number: "input.b"
```
