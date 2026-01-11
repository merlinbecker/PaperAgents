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

```javascript
return { success: true, data: { a: context.parameters.a }, log: [] };
```
