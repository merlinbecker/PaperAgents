---
tool: true
id: gamma
name: "Gamma Tool"
type: chain
parameters:
  - name: x
    type: string
    required: true
---

#### **Steps**
```yaml
steps:
  - name: "search_files"
    tool: "file_search"
    parameters:
      query: "input.x"
      path: "/notes"
```
