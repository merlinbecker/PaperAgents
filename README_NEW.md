# Paper Agents

**Agent-based tool execution for Obsidian**

Execute custom tools, orchestrate workflows, and automate tasks directly in your Obsidian vault using Markdown-based tool definitions.

<a href="https://www.buymeacoffee.com/merlinbecker"><img src="https://img.buymeacoffee.com/button-api/?text=Buy me a beer&emoji=🍺&slug=merlinbecker&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff" /></a>

---

## Features

- **📝 Markdown-Native Tool Definitions**: Define custom tools using YAML frontmatter
- **🔧 4 Predefined Tools**: Search files, read/write files, make REST requests
- **⚡ Instant Execution**: Click a tool → Fill parameters → Execute
- **🛡️ Human-in-the-Loop Safety**: Destructive operations require explicit approval
- **🔗 Multi-Step Workflows**: Chain tools together with placeholder support
- **📱 Mobile Compatible**: Works on Desktop, iOS, and Android
- **🔒 Sandboxed JavaScript**: Execute custom code safely (planned)

---

## Installation

### From Obsidian Community Plugins

1. Open Obsidian Settings
2. Navigate to **Community plugins** → **Browse**
3. Search for "Paper Agents"
4. Click **Install**
5. Enable the plugin

### Manual Installation

1. Download latest release from [GitHub Releases](https://github.com/merlinbecker/PaperAgents/releases)
2. Extract to `.obsidian/plugins/paper-agents/`
3. Enable plugin in Obsidian Settings

---

## Quick Start

### 1. Open the Sidebar

Click the 🤖 bot icon in the left ribbon, or use the command palette:
- `Ctrl/Cmd + P` → "Open Paper Agents Sidebar"

### 2. Use Predefined Tools

The sidebar shows 4 built-in tools:

#### 🔧 search_files
Search your vault by filename.

**Parameters:**
- `query` (string, required): Search text
- `path` (string, optional): Base folder (default: "/")

**Example:**
```
query: "meeting notes"
path: "/work"
```

#### 🔧 read_file
Read content from a file in your vault.

**Parameters:**
- `filePath` (string, required): Path to file (e.g., "notes/file.md")

**Returns:** File content, size, last modified date

#### 🔧 write_file
Create or modify a file in your vault.

**Parameters:**
- `filePath` (string, required): Path to file
- `content` (string, required): Content to write
- `overwrite` (boolean, optional): Overwrite if exists (default: false)

**⚠️ Requires approval**: This tool always shows a confirmation dialog.

#### 🔧 rest_request
Make HTTP requests to external APIs.

**Parameters:**
- `url` (string, required): Target URL
- `method` (string, required): HTTP method (GET, POST, PUT, DELETE)
- `headers` (object, optional): HTTP headers as JSON
- `body` (string, optional): Request body

**⚠️ Requires approval**: POST, PUT, DELETE operations require confirmation.

### 3. Create Custom Tools

Create a folder `paper-agents-tools/` in your vault and add Markdown files:

```markdown
---
tool: true
name: "Daily Summary"
description: "Creates a summary of today's notes"
type: single
parameters:
  - name: date
    type: string
    description: "Date in YYYY-MM-DD format"
    required: true
    default: "{{date}}"
---

# Daily Summary Tool

This tool searches for notes from a specific date and creates a summary.

## Implementation

Uses the search_files and read_file tools to gather content.
```

**Reload custom tools:**
- Command Palette → "Reload Custom Tools"
- Or click the refresh button in the sidebar

---

## Human-in-the-Loop (HITL)

Destructive operations require explicit approval before execution:

### When HITL is Triggered

- **write_file**: Always (modifies vault)
- **rest_request**: For PUT, POST, DELETE only (GET is safe)
- **Custom tools**: Can define own HITL logic

### HITL Modal

Shows:
- Tool name and step
- All parameters being used
- Contextual warning
- Approve (✅) / Reject (❌) buttons

**Keyboard shortcuts:**
- `Enter` → Approve
- `Escape` → Reject

---

## Multi-Step Workflows (Chains)

Define agents that execute multiple tools in sequence:

```markdown
---
tool: true
name: "Backup Important Notes"
description: "Backup notes to a specific folder"
type: chain
parameters:
  - name: tag
    type: string
    required: true
steps:
  - name: "Search notes"
    tool: search_files
    parameters:
      query: "{{tag}}"
      path: "/"
  
  - name: "Create backup"
    tool: write_file
    parameters:
      filePath: "/backups/{{date}}-{{tag}}.md"
      content: "{{prev_step.output.results}}"
---
```

### Placeholder Support

- `{{param_name}}` → User input parameter
- `{{prev_step.output}}` → Output from previous step
- `{{prev_step.output.field}}` → Nested field access
- `{{date}}` → Current date (YYYY-MM-DD)
- `{{time}}` → Current time (HH:mm:ss)
- `{{random_id}}` → Random UUID

---

## Settings

Access via **Settings → Community plugins → Paper Agents**:

### Custom Tools Path
- Default: `paper-agents-tools`
- Change to use a different folder for custom tool definitions

### Enable Debug Logging
- Default: `false`
- Enable for detailed console logs (helpful for troubleshooting)

---

## Architecture

```
Paper Agents
├── Types & Parser (Phase 1)
│   ├── types.ts         - Central type definitions
│   ├── yaml-parser.ts   - Parse YAML frontmatter
│   ├── placeholder.ts   - Replace {{placeholders}}
│   ├── validator.ts     - Parameter validation
│   └── tool-loader.ts   - Load custom tools from vault
│
├── Core & Tools (Phase 2)
│   ├── tool-registry.ts - Manage predefined + custom tools
│   ├── tool-executor.ts - Orchestrate execution + HITL
│   ├── sandbox.ts       - Safe JavaScript execution
│   └── predefined.ts    - 4 standard tools
│
└── UI (Phase 3)
    ├── sidebar.ts       - Tool overview & status
    ├── forms.ts         - Dynamic parameter forms
    ├── hitl-modal.ts    - Approval dialogs
    └── main.ts          - Plugin integration
```

**Design Principles:**
- Factory Pattern for tool instantiation
- Interface-first architecture
- Single Responsibility Principle
- Mobile-first compatibility

---

## Use Cases

### 1. Daily Note Automation
```yaml
tool: true
name: "Create Daily Note"
type: chain
steps:
  - Search for template
  - Read template
  - Replace placeholders
  - Write new daily note
```

### 2. Content Publishing
```yaml
tool: true
name: "Publish to Blog"
type: chain
steps:
  - Read markdown file
  - Convert to HTML
  - Upload via REST API
```

### 3. Research Organization
```yaml
tool: true
name: "Organize Research"
type: chain
steps:
  - Search files by tag
  - Extract metadata
  - Create index file
```

---

## Troubleshooting

### Tools Not Showing
- Check folder path in Settings
- Ensure YAML frontmatter has `tool: true`
- Check console for parsing errors
- Run "Reload Custom Tools" command

### HITL Modal Not Appearing
- Check if tool should require HITL
- Verify parameters are correct
- Check console for errors

### Execution Fails
- Enable Debug Logging in Settings
- Check console (Ctrl+Shift+I)
- Verify parameters meet requirements
- Check file paths are correct

---

## Development

### Build from Source

```bash
# Install dependencies
npm install

# Development build (watch mode)
npm run dev

# Production build
npm run build

# Lint
eslint main.ts
```

### Project Structure

```
src/
  main.ts           # Plugin entry point
  settings.ts       # Settings interface
  types.ts          # Type definitions
  core/             # Core logic
  parser/           # YAML parsing & validation
  tools/            # Predefined tools
  ui/               # UI components
  utils/            # Shared utilities
```

---

## Roadmap

### v1.1 (Planned)
- [ ] Execution history panel
- [ ] Chain progress indicator
- [ ] Tool output viewer
- [ ] QuickJS integration (real sandbox)

### v1.2 (Planned)
- [ ] Agent memory/state
- [ ] Conditional steps
- [ ] Parallel execution
- [ ] Template library

### v2.0 (Future)
- [ ] LLM integration (OpenRouter)
- [ ] Visual workflow editor
- [ ] Community template marketplace

---

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

**Code Style:**
- TypeScript strict mode
- Follow existing patterns
- Document public APIs
- Keep functions small and focused

---

## License

MIT © [Merlin Becker](https://github.com/merlinbecker)

---

## Support

- **Issues**: [GitHub Issues](https://github.com/merlinbecker/PaperAgents/issues)
- **Discussions**: [GitHub Discussions](https://github.com/merlinbecker/PaperAgents/discussions)
- **Buy me a beer**: [BuyMeACoffee](https://buymeacoffee.com/merlinbecker)

---

## Acknowledgments

Built with:
- [Obsidian API](https://docs.obsidian.md)
- TypeScript
- esbuild

Inspired by the need for **simple, understandable, Markdown-native agent workflows**.

---

*"Paper Agents: Agent workflows that make sense—because they're written where you already take notes."*
