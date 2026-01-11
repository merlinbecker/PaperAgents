---
tool: true
id: single_echo
name: "Single Echo"
type: single
parameters:
  - name: input
    type: string
    required: true
preprocess: "trim"
postprocess: "uppercase"
---

```javascript
function run(ctx) {
  return { success: true, data: { echoed: ctx.parameters.input }, log: [] };
}
return run(context);
```
