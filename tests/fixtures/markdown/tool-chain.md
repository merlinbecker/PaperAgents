---
tool: true
id: chain_reader
name: "Chain Reader"
type: chain
parameters:
  - name: query
    type: string
    required: true
description: "Chain tool: search files and read first result"
---

#### **Pre-Processing**
```javascript
// @preprocess
input.query = input.query.trim();
return input;
```

#### **Steps**
```yaml
steps:
  - name: "search_files"
    tool: "search_files"
    parameters:
      query: "{{query}}"
      path: "/"
    
  - name: "read_file"
    tool: "read_file"
    parameters:
      filePath: "{{prev_step.output.results[0].path}}"
```

#### **Post-Processing**
```javascript
// @postprocess
return {
  files_found: output.files_found || 0,
  content: output.content || "",
  log: []
};
```
