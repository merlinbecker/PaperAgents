# Development Guide - Paper Agents

This guide is for developers contributing to the Paper Agents plugin.

## Quick Start

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm (comes with Node.js)
- Git

### Setup

```bash
# Clone the repository
git clone https://github.com/merlinbecker/PaperAgents.git
cd PaperAgents

# Install dependencies
npm install

# Development build (watch mode)
npm run dev

# Production build
npm run build

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Linting
npm run lint
```

## Project Structure

```
PaperAgents/
├── src/                    # Source code
│   ├── main.ts            # Plugin entry point
│   ├── settings.ts        # Settings interface
│   ├── types.ts           # Type definitions
│   ├── core/              # Core execution logic
│   │   ├── tool-executor.ts   # 3-phase execution engine
│   │   ├── tool-registry.ts   # Factory pattern tool management
│   │   └── sandbox.ts         # QuickJS sandbox
│   ├── parser/            # YAML parsing & validation
│   │   ├── yaml-parser.ts     # Markdown frontmatter parsing
│   │   ├── validator.ts       # Parameter validation
│   │   ├── placeholder.ts     # Placeholder resolution
│   │   └── tool-loader.ts     # Custom tool discovery
│   ├── tools/             # Predefined tools
│   │   └── predefined.ts      # 4 standard tools
│   ├── ui/                # UI components
│   │   ├── sidebar.ts         # Tool overview
│   │   ├── forms.ts           # Dynamic forms
│   │   └── hitl-modal.ts      # Confirmation dialogs
│   └── utils/             # Shared utilities
│       ├── logger.ts          # Logging
│       └── constants.ts       # Constants
├── tests/                  # Test files
│   ├── unit/              # Unit tests (50 tests)
│   ├── integration/       # Integration tests (16 tests)
│   └── e2e/               # End-to-end tests (10 tests)
├── examples/              # Example tool definitions
├── manuals/               # Documentation
├── Reports/               # Phase reports
├── manifest.json          # Plugin metadata
├── package.json           # npm configuration
└── tsconfig.json          # TypeScript configuration
```

## Development Workflow

### Making Changes

1. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes in `src/`

3. Run tests frequently:
   ```bash
   npm test
   ```

4. Build to verify:
   ```bash
   npm run build
   ```

5. Lint your code:
   ```bash
   npm run lint
   ```

### Testing in Obsidian

1. Build the plugin:
   ```bash
   npm run build
   ```

2. Create a symbolic link or copy files to your test vault:
   ```bash
   # Create symlink (recommended)
   ln -s /path/to/PaperAgents /path/to/vault/.obsidian/plugins/paper-agents
   
   # Or copy files
   cp main.js manifest.json styles.css /path/to/vault/.obsidian/plugins/paper-agents/
   ```

3. Reload Obsidian or enable the plugin in Settings

4. Check Console (Ctrl+Shift+I) for errors

### Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npx vitest tests/unit/core/sandbox.spec.ts

# Run with coverage
npm test -- --coverage
```

**Current Test Coverage:** 67.25% (76 tests passing)

## Code Style & Conventions

### TypeScript

- Use TypeScript strict mode
- Define interfaces for all public APIs
- Use `async/await` over promise chains
- Handle errors gracefully with try/catch

### File Organization

- Keep `main.ts` minimal (only lifecycle management)
- One class/interface per file when possible
- Group related functionality in folders
- Use barrel exports (index.ts) for public APIs

### Naming Conventions

- Classes: `PascalCase`
- Functions/methods: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Interfaces: `PascalCase` (prefix with `I` only if ambiguous)
- Files: `kebab-case.ts`

### Comments

- Use JSDoc for public APIs
- Inline comments for complex logic only
- Keep comments concise and up-to-date

### Example

```typescript
/**
 * Executes a tool with 3-phase pipeline.
 * 
 * @param tool - Tool definition
 * @param params - Input parameters
 * @returns Execution result
 */
async function executeTool(
  tool: ToolDefinition,
  params: Record<string, unknown>
): Promise<ExecutionResult> {
  // Phase 1: Pre-processing
  const processedParams = await runPreProcessing(tool, params);
  
  // Phase 2: Tool execution
  const output = await runTool(tool, processedParams);
  
  // Phase 3: Post-processing
  return await runPostProcessing(tool, output);
}
```

## Architecture

### Design Patterns

- **Factory Pattern**: Tool creation and registration (`tool-registry.ts`)
- **Strategy Pattern**: Interchangeable execution logic (Single vs. Chain)
- **Observer Pattern**: HITL callbacks for external confirmation
- **Pipeline Pattern**: 3-phase execution (Pre → Tool → Post)

### Core Concepts

#### Tool Execution Pipeline

```
Input Parameters
      ↓
[Pre-Processing] (optional)
  - JavaScript transformation
  - Placeholder resolution
      ↓
[Tool Execution]
  - Single: Execute one tool
  - Chain: Execute multiple steps
      ↓
[Post-Processing] (optional)
  - JavaScript transformation
  - Output formatting
      ↓
Final Output
```

#### Security Layers

1. **Code Validation**: Block dangerous patterns (require, eval, etc.)
2. **Sandbox Isolation**: QuickJS WASM runtime (isolated from Node.js)
3. **Resource Limits**: Memory (10 MB) and timeout (5s) constraints
4. **Human-in-the-Loop**: Manual confirmation for critical operations

## Adding New Features

### Adding a New Predefined Tool

1. Define the tool in `src/tools/predefined.ts`:

```typescript
export function createMyNewTool(app: App): ToolDefinition {
  return {
    id: 'my_new_tool',
    name: 'My New Tool',
    type: 'single',
    description: 'Does something useful',
    parameters: [
      {
        name: 'input',
        type: 'string',
        required: true,
        description: 'Input data'
      }
    ],
    execute: async (params: Record<string, unknown>) => {
      // Implementation
      return { result: 'success' };
    }
  };
}
```

2. Register in `ToolRegistry`:

```typescript
// In tool-registry.ts
this.registerTool(createMyNewTool(this.app));
```

3. Add tests in `tests/integration/tools/`:

```typescript
describe('my_new_tool', () => {
  it('should execute successfully', async () => {
    const result = await executor.execute(tool, { input: 'test' });
    expect(result.success).toBe(true);
  });
});
```

### Adding Parser Features

1. Update types in `src/types.ts`
2. Implement parsing logic in `src/parser/yaml-parser.ts`
3. Add validation in `src/parser/validator.ts`
4. Add tests in `tests/unit/parser/`

### Adding UI Components

1. Create component in `src/ui/`
2. Extend from Obsidian base classes (`Modal`, `View`, etc.)
3. Register in `main.ts` during `onload`
4. Manual testing required (no automated UI tests)

## Testing Strategy

### Unit Tests

- Test individual functions/classes in isolation
- Mock external dependencies (Obsidian API, file system)
- Focus on edge cases and error handling

### Integration Tests

- Test multiple components working together
- Use fixtures for test data
- Mock Obsidian Vault API

### E2E Tests

- Test complete workflows end-to-end
- Use real tool definitions from fixtures
- Verify expected outputs

### Coverage Goals

- **Target**: 80%+ line coverage
- **Current**: 67.25%
- **Focus areas**: Core logic (executor, sandbox, parser)
- **Excluded**: UI components (tested manually)

## Debugging

### Enable Debug Logging

1. In Obsidian Settings → Paper Agents → Enable Debug Logging
2. Open Console (Ctrl+Shift+I)
3. Look for `[DEBUG]` prefixed messages

### Common Issues

**Build fails with TypeScript errors:**
- Run `npm install` to ensure dependencies are up-to-date
- Check `tsconfig.json` settings
- Verify import paths are correct

**Tests fail:**
- Run `npm install` to ensure test dependencies are installed
- Check if fixtures in `tests/fixtures/` are valid
- Enable debug logging in tests

**Plugin doesn't load in Obsidian:**
- Verify `main.js` and `manifest.json` are in plugin folder
- Check Obsidian Console for errors
- Ensure plugin is enabled in Settings

## Release Process

See [RELEASE.md](RELEASE.md) for detailed release instructions.

### Quick Release

```bash
# Update version in manifest.json
npm version patch  # or minor/major

# Commit changes
git add .
git commit -m "Bump version to X.Y.Z"
git push

# Create release (production)
npm run release

# Or create beta release
npm run release:beta
```

## Contributing Guidelines

### Before Submitting a PR

1. ✅ All tests pass (`npm test`)
2. ✅ Build succeeds (`npm run build`)
3. ✅ Code is linted (`npm run lint`)
4. ✅ Add tests for new features
5. ✅ Update documentation if needed
6. ✅ Follow code style conventions

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project style
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] All tests pass
```

## Resources

### Documentation

- [README.md](README.md) - Project overview and features
- [manuals/tools.md](manuals/tools.md) - Tool notation reference
- [examples/](examples/) - Example tool definitions
- [Reports/PhaseWerkzeuge.md](Reports/PhaseWerkzeuge.md) - Implementation status

### External Resources

- [Obsidian Plugin API](https://docs.obsidian.md)
- [Obsidian Sample Plugin](https://github.com/obsidianmd/obsidian-sample-plugin)
- [QuickJS Documentation](https://bellard.org/quickjs/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## Current Development Status

**Completed Phases:**
- ✅ Phase 1: Plugin Infrastructure (Build, Tests, Types)
- ✅ Phase 2: Tool Engine (4 tools, Registry, Executor)
- ✅ Phase 3: Sandbox & Security (QuickJS, HITL)

**Current Phase:**
- ⏳ Phase 4: Agents & Conversation (In Progress)
  - Planned: Agent notation, Conversation logic, OpenRouter integration

**Future Phases:**
- 🔮 Phase 5: Advanced Features (History, Conditionals, Visual Editor)

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/merlinbecker/PaperAgents/issues)
- **Discussions**: [GitHub Discussions](https://github.com/merlinbecker/PaperAgents/discussions)
- **Email**: See package.json for contact information

---

*Last Updated: January 29, 2026*
