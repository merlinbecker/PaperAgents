# PaperAgents - Example Tools with Pre/Post-Processing

This directory contains example tools that demonstrate the Pre/Post-Processing feature of PaperAgents.

## What is Pre/Post-Processing?

Pre/Post-Processing allows you to transform data before and after tool execution using JavaScript code:

- **Pre-Processing**: Transforms input parameters before the tool runs
- **Post-Processing**: Transforms the tool's output before returning results

## Examples

### 1. format_list.md
**Type**: Single Tool  
**Purpose**: Converts comma-separated text into formatted Markdown lists

**Features Demonstrated**:
- Pre-processing: Splits string into array, cleans whitespace
- Post-processing: Formats array as Markdown list (bulleted or numbered)
- Simple data transformation pipeline

**Usage**:
```javascript
{
  items: "apple, banana, cherry",
  numbered: false
}
```

### 2. search_and_count.md
**Type**: Chain Tool  
**Purpose**: Searches files and provides detailed statistics

**Features Demonstrated**:
- Pre-processing: Normalizes search query and folder path
- Chain execution: Uses `search_files` predefined tool
- Post-processing: Aggregates results, counts by file type, calculates sizes
- Complex data analysis

**Usage**:
```javascript
{
  query: "meeting notes",
  folder: "/projects"
}
```

### 3. create_daily_note.md
**Type**: Single Tool  
**Purpose**: Creates a daily note with template structure

**Features Demonstrated**:
- Pre-processing: Builds note content from template, processes tags
- Tool execution: Uses `write_file` predefined tool
- Post-processing: Formats success message with metadata
- Template generation

**Usage**:
```javascript
{
  tags: "personal, reflection",
  mood: "productive"
}
```

## How to Use These Examples

1. Copy the example files to your Obsidian vault's tool directory (e.g., `paper-agents-tools/`)
2. The plugin will automatically discover and load them
3. Execute them through the PaperAgents sidebar UI
4. Modify them to create your own custom tools

## Best Practices

### Pre-Processing
- ✅ Clean and normalize input data
- ✅ Add computed fields
- ✅ Validate and transform parameters
- ✅ Prepare data for tool execution
- ❌ Don't make API calls or file operations

### Post-Processing
- ✅ Extract relevant fields from complex output
- ✅ Aggregate and summarize data
- ✅ Format output for display
- ✅ Add metadata and timestamps
- ❌ Don't modify the original tool behavior

### Security
- ✅ All code is validated before execution
- ✅ Dangerous patterns are blocked (require, eval, process, global, Function)
- ✅ Code runs in a sandbox (stub mode currently, QuickJS planned)
- ✅ Always include a `return` statement

## Syntax Reference

### Pre-Processing Block
```javascript
#### **Pre-Processing**
```javascript
// @preprocess
// Your code here
// Modify 'input' object
return input;
\```
```

### Post-Processing Block
```javascript
#### **Post-Processing**
```javascript
// @postprocess
// Your code here
// Transform 'output' from tool
return transformedOutput;
\```
```

## Learn More

- See `tests/unit/core/sandbox-prepost.spec.ts` for comprehensive examples
- See `tests/unit/core/executor-prepost.spec.ts` for 3-phase execution tests
- See `reports/Phase_werkzeuge.md` for implementation details
