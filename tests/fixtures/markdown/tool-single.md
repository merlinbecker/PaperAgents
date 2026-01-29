---
tool: true
id: single_echo
name: "Single Echo"
type: single
parameters:
  - name: input
    type: string
    required: true
description: "Echo tool with trim and uppercase using read_file"
---

#### **Pre-Processing**
```javascript
// @preprocess
input.filePath = input.input.trim() + ".md";
return input;
```

#### **Tool-Ausführung**
```yaml
tool: "read_file"
parameters:
  filePath: "{{filePath}}"
```

#### **Post-Processing**
```javascript
// @postprocess
return {
  echoed: typeof output === 'string' ? output.toUpperCase() : JSON.stringify(output),
  log: []
};
```
