---
tool: true
id: create_daily_note
name: "Create Daily Note with Template"
type: single
parameters:
  - name: tags
    type: string
    description: "Comma-separated tags for the note"
    required: false
    default: ""
  - name: mood
    type: string
    description: "Today's mood"
    required: false
    default: "neutral"
description: "Creates a daily note with a template structure using write_file"
---

#### **Pre-Processing**
```javascript
// @preprocess
// Prepare daily note filename and content
const today = "{{date}}";
input.filePath = `daily-notes/${today}.md`;

// Parse tags
const tagList = input.tags
  ? input.tags.split(',').map(t => `#${t.trim()}`).join(' ')
  : '';

// Build note content
input.content = `# Daily Note - ${today}

## Metadata
- Date: ${today}
- Mood: ${input.mood}
- Tags: ${tagList}

## Tasks
- [ ] Review yesterday's notes
- [ ] Plan today's priorities

## Notes

## Reflections

---
Created with PaperAgents on ${today} at {{time}}
`;

return input;
```

#### **Tool-Ausführung**
```yaml
tool: "write_file"
parameters:
  filePath: "{{filePath}}"
  content: "{{content}}"
  overwrite: false
```

#### **Post-Processing**
```javascript
// @postprocess
// Format success message
return {
  message: `Daily note created successfully`,
  path: output.filePath || "unknown",
  timestamp: "{{date}} {{time}}",
  log: []
};
```
