---
tool: true
id: custom_read
name: "Custom Read"
type: single
parameters:
  - name: filePath
    type: string
    required: true
description: "Read a file from disk"
---

#### **Pre-Processing**
```javascript
// @preprocess
if (!input.filePath.startsWith("/")) {
  input.filePath = "/" + input.filePath;
}
return input;
```

#### **Tool-Ausführung**
```yaml
tool: "read_file"
parameters:
  path: "input.filePath"
```

#### **Post-Processing**
```javascript
// @postprocess
return {
  path: output.filePath,
  content: output.content,
  size: output.size,
  log: []
};
```
