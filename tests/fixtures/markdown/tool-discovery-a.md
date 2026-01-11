---
tool: true
id: alpha
name: "Alpha Tool"
type: single
parameters:
  - name: a
    type: string
    required: true
---

#### **Tool-Ausführung**
```yaml
tool: "search_files"
parameters:
  query: "{{a}}"
  path: "/"
```

