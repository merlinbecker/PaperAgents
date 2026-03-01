/**
 * Predefined Tools - 4 Standard-Tools mit Factory Pattern
 * search_files, read_file, write_file, rest_request
 */

import { App, TFile, requestUrl } from "obsidian";
import type { IExecutableTool, IToolFactory, Parameter, ExecutionContext, ExecutionResult, ToolExecution } from "../types";
import { PREDEFINED_TOOL_IDS } from "../utils/constants";
import { globalLogger } from "../utils/logger";

// ============================================================================
// SHARED HELPERS
// ============================================================================

/** Strip leading slash so vault-relative paths and /absolute paths compare equal. */
function normPath(p: string): string {
  return p.replace(/^\//, "");
}

/** Build a single ToolExecution log entry. */
function buildLogEntry(
  toolName: string,
  parameters: Record<string, unknown>,
  output?: unknown
): ToolExecution {
  return { toolName, parameters, output, timestamp: Date.now() };
}

/** Build a standardised error ExecutionResult from a caught value. */
function buildErrorResult(
  toolName: string,
  parameters: Record<string, unknown>,
  error: unknown
): ExecutionResult {
  const message = error instanceof Error ? error.message : "Unknown error";
  return {
    success: false,
    error: message,
    log: [{ toolName, parameters, error: message, timestamp: Date.now() }],
  };
}

/** Assert that the App instance is present; throws if not. */
function requireApp(app: App | undefined, toolName: string): App {
  if (!app) {
    throw new Error(`${toolName} requires App instance`);
  }
  return app;
}

// ============================================================================
// SEARCH_FILES TOOL
// ============================================================================

class SearchFilesTool implements IExecutableTool {
  name = PREDEFINED_TOOL_IDS.SEARCH_FILES;
  parameters: Parameter[] = [
    {
      name: "query",
      type: "string",
      description: "Search text to match against file names and content",
      required: true,
    },
    {
      name: "path",
      type: "string",
      description: "Base folder to restrict search (e.g., 'notes' or '/notes')",
      required: false,
      default: "",
    },
  ];

  constructor(private app: App) {}

  async execute(ctx: ExecutionContext): Promise<ExecutionResult> {
    try {
      const query = ctx.parameters.query as string;
      const basePath = (ctx.parameters.path as string) || "";

      const results: Array<{ name: string; path: string; size: number }> = [];

      // Get all Markdown files from vault
      const files = this.app.vault.getMarkdownFiles();

      const normalizedBase = normPath(basePath);
      const lowerQuery = query.toLowerCase();

      for (const file of files) {
        // Filter by path prefix (normalize to handle leading slashes)
        if (normalizedBase && !normPath(file.path).startsWith(normalizedBase)) {
          continue;
        }

        // Match against file name first
        if (file.name.toLowerCase().includes(lowerQuery)) {
          results.push({
            name: file.name,
            path: file.path,
            size: file.stat.size,
          });
          continue;
        }

        // Also search within file content
        try {
          const content = await this.app.vault.read(file);
          if (content.toLowerCase().includes(lowerQuery)) {
            results.push({
              name: file.name,
              path: file.path,
              size: file.stat.size,
            });
          }
        } catch (err) {
          // skip files that cannot be read
          globalLogger.debug("search_files: could not read file", { path: file.path, error: err instanceof Error ? err.message : String(err) });
        }
      }

      return {
        success: true,
        data: { results, count: results.length },
        log: [buildLogEntry(this.name, ctx.parameters, { results, count: results.length })],
      };
    } catch (error) {
      globalLogger.error("search_files tool error", { error });
      return buildErrorResult(this.name, ctx.parameters, error);
    }
  }

  shouldRequireHITL(): boolean {
    return false; // Read-only, no HITL needed
  }
}

export const SearchFilesFactory: IToolFactory = {
  name: PREDEFINED_TOOL_IDS.SEARCH_FILES,
  description: "Search files in vault by name, path, or content",
  create: (app?: App) => new SearchFilesTool(requireApp(app, "SearchFilesTool")),
};

// ============================================================================
// READ_FILE TOOL
// ============================================================================

class ReadFileTool implements IExecutableTool {
  name = PREDEFINED_TOOL_IDS.READ_FILE;
  parameters: Parameter[] = [
    {
      name: "filePath",
      type: "string",
      description: "Path to file (e.g., '/notes/file.md')",
      required: true,
    },
  ];

  constructor(private app: App) {}

  async execute(ctx: ExecutionContext): Promise<ExecutionResult> {
    try {
      const filePath = ctx.parameters.filePath as string;

      // Get file from vault
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (!file || !(file instanceof TFile)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const content = await this.app.vault.read(file);

      return {
        success: true,
        data: {
          content,
          size: file.stat.size,
          modified: new Date(file.stat.mtime).toISOString(),
        },
        log: [buildLogEntry(this.name, ctx.parameters, { size: file.stat.size })],
      };
    } catch (error) {
      globalLogger.error("read_file tool error", { error });
      return buildErrorResult(this.name, ctx.parameters, error);
    }
  }

  shouldRequireHITL(): boolean {
    return false; // Read-only, no HITL needed
  }
}

export const ReadFileFactory: IToolFactory = {
  name: PREDEFINED_TOOL_IDS.READ_FILE,
  description: "Read file content from vault",
  create: (app?: App) => new ReadFileTool(requireApp(app, "ReadFileTool")),
};

// ============================================================================
// WRITE_FILE TOOL
// ============================================================================

class WriteFileTool implements IExecutableTool {
  name = PREDEFINED_TOOL_IDS.WRITE_FILE;
  parameters: Parameter[] = [
    {
      name: "filePath",
      type: "string",
      description: "Path to file",
      required: true,
    },
    {
      name: "content",
      type: "string",
      description: "Content to write",
      required: true,
    },
    {
      name: "overwrite",
      type: "boolean",
      description: "Overwrite existing file?",
      required: false,
      default: false,
    },
  ];

  constructor(private app: App) {}

  async execute(ctx: ExecutionContext): Promise<ExecutionResult> {
    try {
      const filePath = ctx.parameters.filePath as string;
      const content = ctx.parameters.content as string;
      const overwrite = ctx.parameters.overwrite as boolean;

      // Check if file exists
      const existing = this.app.vault.getAbstractFileByPath(filePath);
      if (existing && !overwrite) {
        throw new Error(`File already exists: ${filePath}. Use overwrite: true`);
      }

      if (existing && overwrite && existing instanceof TFile) {
        // Modify existing file
        await this.app.vault.modify(existing, content);
      } else {
        // Create new file
        await this.app.vault.create(filePath, content);
      }

      return {
        success: true,
        data: { filePath, size: content.length },
        log: [buildLogEntry(this.name, ctx.parameters, { filePath, size: content.length })],
      };
    } catch (error) {
      globalLogger.error("write_file tool error", { error });
      return buildErrorResult(this.name, ctx.parameters, error);
    }
  }

  shouldRequireHITL(parameters: Record<string, unknown>): boolean {
    return true; // Always require HITL for write operations
  }
}

export const WriteFileFactory: IToolFactory = {
  name: PREDEFINED_TOOL_IDS.WRITE_FILE,
  description: "Write or modify file in vault",
  create: (app?: App) => new WriteFileTool(requireApp(app, "WriteFileTool")),
};

// ============================================================================
// REST_REQUEST TOOL
// ============================================================================

class RestRequestTool implements IExecutableTool {
  name = PREDEFINED_TOOL_IDS.REST_REQUEST;
  parameters: Parameter[] = [
    {
      name: "url",
      type: "string",
      description: "Target URL",
      required: true,
    },
    {
      name: "method",
      type: "string",
      description: "HTTP method (GET, POST, PUT, DELETE)",
      required: true,
      default: "GET",
    },
    {
      name: "headers",
      type: "object",
      description: "HTTP headers (JSON format)",
      required: false,
      default: {},
    },
    {
      name: "body",
      type: "string",
      description: "Request body (JSON string)",
      required: false,
    },
  ];

  constructor(private app: App) {}

  async execute(ctx: ExecutionContext): Promise<ExecutionResult> {
    try {
      const url = ctx.parameters.url as string;
      const method = (ctx.parameters.method as string) || "GET";
      const headers = (ctx.parameters.headers as Record<string, string>) || {};
      const body = ctx.parameters.body as string | undefined;

      // Use Obsidian's requestUrl API
      const response = await requestUrl({
        url,
        method,
        headers,
        body,
      });

      return {
        success: true,
        data: {
          status: response.status,
          body: response.text,
        },
        log: [buildLogEntry(this.name, ctx.parameters, { status: response.status })],
      };
    } catch (error) {
      globalLogger.error("rest_request tool error", { error });
      return buildErrorResult(this.name, ctx.parameters, error);
    }
  }

  shouldRequireHITL(parameters: Record<string, unknown>): boolean {
    const method = (parameters.method as string) || "GET";
    // Require HITL for destructive operations
    return ["PUT", "POST", "DELETE"].includes(method.toUpperCase());
  }
}

export const RestRequestFactory: IToolFactory = {
  name: PREDEFINED_TOOL_IDS.REST_REQUEST,
  description: "Make HTTP requests to APIs",
  create: (app?: App) => new RestRequestTool(requireApp(app, "RestRequestTool")),
};

// ============================================================================
// EXPORT ALL FACTORIES
// ============================================================================

export const PredefinedToolsFactory = {
  searchFiles: SearchFilesFactory,
  readFile: ReadFileFactory,
  writeFile: WriteFileFactory,
  restRequest: RestRequestFactory,
};

export default PredefinedToolsFactory;
