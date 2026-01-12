---
tool: true
id: format_list
name: "Format as Markdown List"
type: single
parameters:
  - name: items
    type: string
    description: "Comma-separated items to format"
    required: true
  - name: numbered
    type: boolean
    description: "Use numbered list instead of bullets"
    required: false
    default: false
description: "Converts comma-separated text into a formatted Markdown list"
---

#### **Pre-Processing**
```javascript
// @preprocess
// Split comma-separated string into array and clean each item
input.itemsArray = input.items
  .split(',')
  .map(item => item.trim())
  .filter(item => item.length > 0);
return input;
```

#### **Post-Processing**
```javascript
// @postprocess
// Format array as markdown list
const marker = output.numbered ? '1. ' : '- ';
const formattedList = output.itemsArray
  .map((item, index) => {
    if (output.numbered) {
      return `${index + 1}. ${item}`;
    }
    return `${marker}${item}`;
  })
  .join('\n');

return {
  formatted: formattedList,
  count: output.itemsArray.length,
  log: []
};
```
