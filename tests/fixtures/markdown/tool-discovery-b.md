---
tool: true
id: beta
name: "Beta Tool"
type: single
parameters:
  - name: b
    type: number
    required: false
---

```javascript
return { success: true, data: { b: context.parameters.b ?? 0 }, log: [] };
```
