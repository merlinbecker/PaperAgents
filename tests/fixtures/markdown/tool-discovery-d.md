---
tool: true
id: delta
name: "Delta Tool"
type: single
parameters:
  - name: note
    type: string
    required: true
---

```javascript
return { success: true, data: { note: context.parameters.note }, log: [] };
```
