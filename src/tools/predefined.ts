/**
 * Predefined Tools - 4 Standard-Tools mit Factory Pattern
 * search_files, read_file, write_file, rest_request
 */

import { App, TFile, requestUrl } from "obsidian";
import { IExecutableTool, IToolFactory, Parameter, ExecutionContext, ExecutionResult } from "../types";
import { PREDEFINED_TOOL_IDS } from "../utils/constants";
import { globalLogger } from "../utils/logger";

// ============================================================================
// SEARCH_FILES TOOL
// ============================================================================

class SearchFilesTool implements IExecutableTool {
  name = PREDEFINED_TOOL_IDS.SEARCH_FILES;
  parameters: Parameter[] = [
    {
      name: "query",
      type: "string",
      description: "Search text or glob pattern",
      required: true,
    },
    {
      name: "path",
      type: "string",
      description: "Base folder (e.g., '/notes')",
      required: false,
      default: "/",
    },
  ];

  constructor(private app: App) {}

  async execute(ctx: ExecutionContext): Promise<ExecutionResult> {
    try {
      const query = ctx.parameters.query as string;
      const basePath = (ctx.parameters.path as string) || "/";

      const results: Array<{ name: string; path: string; size: number }> = [];

      // Hole alle Markdown-Dateien
      const files = this.app.vault.getMarkdownFiles();

      for (const file of files) {
        // Filter nach Pfad
        if (!file.path.startsWith(basePath)) {
          continue;
        }

        // Filter nach Query (einfacher String-Match)
        if (file.name.toLowerCase().includes(query.toLowerCase())) {
          results.push({
            name: file.name,
            path: file.path,
            size: file.stat.size,
          });
        }
      }

      return {
        success: true,
        data: { results, count: results.length },
        log: [
          {
            toolName: this.name,
            parameters: ctx.parameters,
            output: { results, count: results.length },
            timestamp: Date.now(),
          },
        ],
      };
    } catch (error) {
      globalLogger.error("search_files tool error", { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        log: [
          {
            toolName: this.name,
            parameters: ctx.parameters,
            error: error instanceof Error ? error.message : "Unknown error",
            timestamp: Date.now(),
          },
        ],
      };
    }
  }

  shouldRequireHITL(): boolean {
    return false; // Read-only, no HITL needed
  }
}

export const SearchFilesFactory: IToolFactory = {
  name: PREDEFINED_TOOL_IDS.SEARCH_FILES,
  description: "Search files in vault by name or path",
  create: (app?: any) => {
    if (!app) {
      throw new Error("SearchFilesTool requires App instance");
    }
    return new SearchFilesTool(app);
  },
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
        log: [
          {
            toolName: this.name,
            parameters: ctx.parameters,
            output: { size: file.stat.size },
            timestamp: Date.now(),
          },
        ],
      };
    } catch (error) {
      globalLogger.error("read_file tool error", { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        log: [
          {
            toolName: this.name,
            parameters: ctx.parameters,
            error: error instanceof Error ? error.message : "Unknown error",
            timestamp: Date.now(),
          },
        ],
      };
    }
  }

  shouldRequireHITL(): boolean {
    return false; // Read-only, no HITL needed
  }
}

export const ReadFileFactory: IToolFactory = {
  name: PREDEFINED_TOOL_IDS.READ_FILE,
  description: "Read file content from vault",
  create: (app?: any) => {
    if (!app) {
      throw new Error("ReadFileTool requires App instance");
    }
    return new ReadFileTool(app);
  },
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
        log: [
          {
            toolName: this.name,
            parameters: ctx.parameters,
            output: { filePath, size: content.length },
            timestamp: Date.now(),
          },
        ],
      };
    } catch (error) {
      globalLogger.error("write_file tool error", { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        log: [
          {
            toolName: this.name,
            parameters: ctx.parameters,
            error: error instanceof Error ? error.message : "Unknown error",
            timestamp: Date.now(),
          },
        ],
      };
    }
  }

  shouldRequireHITL(parameters: Record<string, any>): boolean {
    return true; // Always require HITL for write operations
  }
}

export const WriteFileFactory: IToolFactory = {
  name: PREDEFINED_TOOL_IDS.WRITE_FILE,
  description: "Write or modify file in vault",
  create: (app?: any) => {
    if (!app) {
      throw new Error("WriteFileTool requires App instance");
    }
    return new WriteFileTool(app);
  },
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
        log: [
          {
            toolName: this.name,
            parameters: ctx.parameters,
            output: { status: response.status },
            timestamp: Date.now(),
          },
        ],
      };
    } catch (error) {
      globalLogger.error("rest_request tool error", { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        log: [
          {
            toolName: this.name,
            parameters: ctx.parameters,
            error: error instanceof Error ? error.message : "Unknown error",
            timestamp: Date.now(),
          },
        ],
      };
    }
  }

  shouldRequireHITL(parameters: Record<string, any>): boolean {
    const method = (parameters.method as string) || "GET";
    // Require HITL for destructive operations
    return ["PUT", "POST", "DELETE"].includes(method.toUpperCase());
  }
}

export const RestRequestFactory: IToolFactory = {
  name: PREDEFINED_TOOL_IDS.REST_REQUEST,
  description: "Make HTTP requests to APIs",
  create: (app?: any) => {
    if (!app) {
      throw new Error("RestRequestTool requires App instance");
    }
    return new RestRequestTool(app);
  },
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
