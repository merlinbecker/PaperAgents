---
tool: true
id: gamma
name: "Gamma Tool"
type: chain
parameters:
  - name: x
    type: string
    required: true
steps:
  - name: "search_files"
    parameters:
      query: "{{x}}"
      path: "/notes"
---
