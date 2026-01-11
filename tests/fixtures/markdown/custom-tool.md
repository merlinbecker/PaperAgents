---
tool: true
id: custom_read
name: "Custom Read"
type: single
parameters:
  - name: filePath
    type: string
    required: true
---

```javascript
function run(ctx) {
  return { success: true, data: { echo: ctx.parameters.filePath }, log: [] };
}
return run(context);
```
