---
tool: true
id: chain_reader
name: "Chain Reader"
type: chain
parameters:
  - name: query
    type: string
    required: true
steps:
  - name: "search_files"
    parameters:
      query: "{{query}}"
      path: "/notes"
  - name: "read_file"
    parameters:
      filePath: "{{search_files.results[0].path}}"
---

```yaml
# optional additional steps yaml block (not used by parser today)
```
