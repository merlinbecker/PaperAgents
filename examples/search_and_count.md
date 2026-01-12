---
tool: true
id: search_and_count
name: "Search Files and Count Results"
type: chain
parameters:
  - name: query
    type: string
    description: "Search query"
    required: true
  - name: folder
    type: string
    description: "Folder to search in"
    required: false
    default: "/"
description: "Searches for files and provides statistics about the results"
---

#### **Pre-Processing**
```javascript
// @preprocess
// Clean and prepare search query
input.query = input.query.trim().toLowerCase();
input.folder = input.folder || "/";
// Add timestamp for audit trail
input.searchTimestamp = "{{date}} {{time}}";
return input;
```

#### **Steps**
```yaml
steps:
  - name: "search_files"
    tool: "search_files"
    parameters:
      query: "{{query}}"
      path: "{{folder}}"
```

#### **Post-Processing**
```javascript
// @postprocess
// Transform raw search results into structured summary
const results = output.results || [];
const fileTypes = {};

// Count files by extension
results.forEach(file => {
  const ext = file.path.split('.').pop() || 'no-extension';
  fileTypes[ext] = (fileTypes[ext] || 0) + 1;
});

// Calculate total size
const totalSize = results.reduce((sum, file) => sum + (file.size || 0), 0);

return {
  summary: {
    total_files: results.length,
    file_types: fileTypes,
    total_size_bytes: totalSize,
    largest_file: results.length > 0
      ? results.reduce((max, f) => (f.size || 0) > (max.size || 0) ? f : max)
      : null
  },
  files: results.map(f => ({
    name: f.name,
    path: f.path,
    size: f.size || 0
  })),
  log: []
};
```
