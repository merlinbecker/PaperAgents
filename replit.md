# Paper Agents - Obsidian Plugin

## Overview
Paper Agents is an Obsidian plugin that turns Obsidian into an agent sandbox. It allows users to define, test, and execute workflows and tools in Markdown, with OpenRouter integration and sandboxed JavaScript execution.

## Project Type
This is an **Obsidian plugin** (not a web application). It compiles TypeScript code into a single `main.js` file that Obsidian loads as a plugin.

## Tech Stack
- **Language**: TypeScript
- **Build System**: esbuild (bundler)
- **Package Manager**: npm
- **Testing**: Vitest with coverage
- **Runtime**: Runs inside Obsidian desktop/mobile app

## Project Structure
```
src/
├── main.ts           # Plugin entry point
├── types.ts          # TypeScript type definitions
├── settings.ts       # Plugin settings
├── core/             # Core functionality (sandbox, tool executor, registry)
├── parser/           # YAML parsing, validation, tool loading
├── ui/               # UI components (sidebar, modals, forms)
└── utils/            # Utilities (constants, logger)
tests/                # Test files
examples/             # Example workflows
```

## Development Commands
- `npm run dev` - Start development build with watch mode
- `npm run build` - Production build with type checking
- `npm run test` - Run tests with coverage
- `npm run lint` - Run ESLint

## Build Output
The build process generates `main.js` in the project root, which is the compiled plugin that Obsidian loads.

## Recent Changes
- 2026-01-29: Initial import to Replit, configured development workflow

## Notes
- This plugin requires the Obsidian app to run - it cannot be previewed in a browser
- The development workflow runs esbuild in watch mode for hot reloading during development
