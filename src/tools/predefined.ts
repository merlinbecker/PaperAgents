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
// PARAMETER DEFINITIONS (single source of truth, shared by class + factory)
// ============================================================================

const SEARCH_FILES_PARAMS: Parameter[] = [
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

const READ_FILE_PARAMS: Parameter[] = [
  {
    name: "filePath",
    type: "string",
    description: "Path to file (e.g., '/notes/file.md')",
    required: true,
  },
];

const WRITE_FILE_PARAMS: Parameter[] = [
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

const REST_REQUEST_PARAMS: Parameter[] = [
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

// ============================================================================
// SEARCH_FILES TOOL
// ============================================================================

class SearchFilesTool implements IExecutableTool {
  name = PREDEFINED_TOOL_IDS.SEARCH_FILES;
  parameters = SEARCH_FILES_PARAMS;

  constructor(private readonly app: App) {}

  private async checkFileContent(file: TFile, lowerQuery: string): Promise<boolean> {
    try {
      const content = await this.app.vault.read(file);
      return content.toLowerCase().includes(lowerQuery);
    } catch (err) {
      globalLogger.debug("search_files: could not read file", { path: file.path, error: err instanceof Error ? err.message : String(err) });
      return false;
    }
  }

  async execute(ctx: ExecutionContext): Promise<ExecutionResult> {
    try {
      const rawQuery = ctx.parameters.query;
      if (rawQuery === undefined || rawQuery === null) {
        throw new Error("search_files: required parameter 'query' is missing");
      }
      const query = rawQuery as string;
      const basePath = (ctx.parameters.path as string) ?? "";

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

        // Match against file name first (guard against undefined name)
        if (file.name?.toLowerCase().includes(lowerQuery)) {
          results.push({ name: file.name, path: file.path, size: file.stat.size });
          continue;
        }

        // Also search within file content
        if (await this.checkFileContent(file, lowerQuery)) {
          results.push({ name: file.name, path: file.path, size: file.stat.size });
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
  parameters: SEARCH_FILES_PARAMS,
  create: (app?: App) => new SearchFilesTool(requireApp(app, "SearchFilesTool")),
};

// ============================================================================
// READ_FILE TOOL
// ============================================================================

class ReadFileTool implements IExecutableTool {
  name = PREDEFINED_TOOL_IDS.READ_FILE;
  parameters = READ_FILE_PARAMS;

  constructor(private readonly app: App) {}

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
  parameters: READ_FILE_PARAMS,
  create: (app?: App) => new ReadFileTool(requireApp(app, "ReadFileTool")),
};

// ============================================================================
// WRITE_FILE TOOL
// ============================================================================

class WriteFileTool implements IExecutableTool {
  name = PREDEFINED_TOOL_IDS.WRITE_FILE;
  parameters = WRITE_FILE_PARAMS;

  constructor(private readonly app: App) {}

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

  shouldRequireHITL(_parameters: Record<string, unknown>): boolean {
    return true; // Always require HITL for write operations
  }
}

export const WriteFileFactory: IToolFactory = {
  name: PREDEFINED_TOOL_IDS.WRITE_FILE,
  description: "Write or modify file in vault",
  parameters: WRITE_FILE_PARAMS,
  create: (app?: App) => new WriteFileTool(requireApp(app, "WriteFileTool")),
};

// ============================================================================
// REST_REQUEST TOOL
// ============================================================================

class RestRequestTool implements IExecutableTool {
  name = PREDEFINED_TOOL_IDS.REST_REQUEST;
  parameters = REST_REQUEST_PARAMS;

  constructor(private readonly app: App) {}

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
  parameters: REST_REQUEST_PARAMS,
  create: (app?: App) => new RestRequestTool(requireApp(app, "RestRequestTool")),
};

// ============================================================================
// FINISH_TASK TOOL (Agentic Loop termination signal)
// ============================================================================

const FINISH_TASK_PARAMS: Parameter[] = [
  {
    name: "summary",
    type: "string",
    description: "Summary of the completed task",
    required: true,
  },
  {
    name: "reportPath",
    type: "string",
    description: "Optional path to a saved report file",
    required: false,
  },
];

class FinishTaskTool implements IExecutableTool {
  name = PREDEFINED_TOOL_IDS.FINISH_TASK;
  parameters = FINISH_TASK_PARAMS;

  async execute(ctx: ExecutionContext): Promise<ExecutionResult> {
    const summary = ctx.parameters.summary as string;
    const reportPath = ctx.parameters.reportPath as string | undefined;
    const data: Record<string, unknown> = { done: true, summary };
    if (reportPath) data.reportPath = reportPath;
    return {
      success: true,
      data,
      log: [buildLogEntry(this.name, ctx.parameters, data)],
    };
  }

  shouldRequireHITL(): boolean {
    return false;
  }
}

export const FinishTaskFactory: IToolFactory = {
  name: PREDEFINED_TOOL_IDS.FINISH_TASK,
  description: "Signal that the current task is complete and provide a summary. Call this when you have fully completed the assigned task.",
  parameters: FINISH_TASK_PARAMS,
  create: () => new FinishTaskTool(),
};

// ============================================================================
// ASK_USER TOOL (Agentic Loop HITL pause – request input from human)
// ============================================================================

const ASK_USER_PARAMS: Parameter[] = [
  {
    name: "question",
    type: "string",
    description: "The question or clarification request to present to the user",
    required: true,
  },
];

class AskUserTool implements IExecutableTool {
  name = PREDEFINED_TOOL_IDS.ASK_USER;
  parameters = ASK_USER_PARAMS;

  async execute(ctx: ExecutionContext): Promise<ExecutionResult> {
    const question = ctx.parameters.question as string;
    const data = { asked: true, question };
    return {
      success: true,
      data,
      log: [buildLogEntry(this.name, ctx.parameters, data)],
    };
  }

  shouldRequireHITL(): boolean {
    return false; // HITL is handled at the agentic-loop level, not here
  }
}

export const AskUserFactory: IToolFactory = {
  name: PREDEFINED_TOOL_IDS.ASK_USER,
  description:
    "Pause the agentic loop and ask the user a question or request clarification. " +
    "Call this when you need additional information or confirmation from the user before proceeding.",
  parameters: ASK_USER_PARAMS,
  create: () => new AskUserTool(),
};

// ============================================================================
// WEBSEARCH TOOL (OpenRouter server-side plugin)
// ============================================================================

class WebSearchTool implements IExecutableTool {
  name = PREDEFINED_TOOL_IDS.WEBSEARCH;
  parameters: Parameter[] = [];

  // The websearch tool is handled server-side by the OpenRouter web-search plugin.
  // This execute method is a fallback and should not be called during normal operation.
  async execute(_ctx: ExecutionContext): Promise<ExecutionResult> {
    return {
      success: false,
      error: "websearch is a server-side OpenRouter plugin and cannot be executed locally",
      log: [{ toolName: this.name, parameters: {}, error: "server-side plugin only", timestamp: Date.now() }],
    };
  }

  shouldRequireHITL(): boolean {
    return false;
  }
}

export const WebSearchFactory: IToolFactory = {
  name: PREDEFINED_TOOL_IDS.WEBSEARCH,
  description: "Enable OpenRouter web-search plugin: the model can search the web for up-to-date information",
  parameters: [],
  isPlugin: true,
  create: () => new WebSearchTool(),
};

// ============================================================================
// READ_BINARY_FILE TOOL (reads binary files, e.g. PDFs, as base64)
// ============================================================================

const READ_BINARY_FILE_PARAMS: Parameter[] = [
  {
    name: "filePath",
    type: "string",
    description: "Path to binary file in vault (e.g., '/pdfs/document.pdf')",
    required: true,
  },
];

// Maximum file size accepted for base64 encoding (50 MB).
// Larger files would require hundreds of MB of RAM for the base64 conversion
// and request body, which can crash the renderer process.
const MAX_BINARY_FILE_BYTES = 50 * 1024 * 1024;

class ReadBinaryFileTool implements IExecutableTool {
  name = PREDEFINED_TOOL_IDS.READ_BINARY_FILE;
  parameters = READ_BINARY_FILE_PARAMS;

  constructor(private readonly app: App) {}

  async execute(ctx: ExecutionContext): Promise<ExecutionResult> {
    try {
      const filePath = ctx.parameters.filePath as string;

      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (!file || !(file instanceof TFile)) {
        throw new Error(`File not found: ${filePath}`);
      }

      if (file.stat.size > MAX_BINARY_FILE_BYTES) {
        throw new Error(
          `File too large: ${filePath} (${(file.stat.size / 1024 / 1024).toFixed(1)} MB). ` +
          `Maximum supported size is ${MAX_BINARY_FILE_BYTES / 1024 / 1024} MB.`
        );
      }

      const buffer = await this.app.vault.readBinary(file);
      const base64 = this.arrayBufferToBase64(buffer);

      return {
        success: true,
        data: {
          filePath,
          base64,
          mimeType: this.getMimeType(filePath),
          size: buffer.byteLength,
        },
        log: [buildLogEntry(this.name, ctx.parameters, { filePath, size: buffer.byteLength })],
      };
    } catch (error) {
      globalLogger.error("read_binary_file tool error", { error });
      return buildErrorResult(this.name, ctx.parameters, error);
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    const chunks: string[] = [];
    const chunkSize = 0x8000; // 32KB chunks to avoid call stack overflow
    for (let i = 0; i < bytes.length; i += chunkSize) {
      chunks.push(String.fromCharCode(...bytes.subarray(i, i + chunkSize)));
    }
    return btoa(chunks.join(""));
  }

  private getMimeType(filePath: string): string {
    const ext = filePath.split(".").pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      pdf: "application/pdf",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
    };
    return mimeTypes[ext ?? ""] ?? "application/octet-stream";
  }

  shouldRequireHITL(): boolean {
    return false;
  }
}

export const ReadBinaryFileFactory: IToolFactory = {
  name: PREDEFINED_TOOL_IDS.READ_BINARY_FILE,
  description: "Read a binary file (e.g. PDF, image) from the vault and return its Base64-encoded content",
  parameters: READ_BINARY_FILE_PARAMS,
  create: (app?: App) => new ReadBinaryFileTool(requireApp(app, "ReadBinaryFileTool")),
};

// ============================================================================
// FILE_PARSER TOOL (OpenRouter server-side OCR plugin)
// ============================================================================

class OcrFileParserTool implements IExecutableTool {
  name = PREDEFINED_TOOL_IDS.FILE_PARSER;
  parameters: Parameter[] = [];

  // The file_parser tool is handled server-side by the OpenRouter file-parser plugin.
  // This execute method is a fallback and should not be called during normal operation.
  async execute(_ctx: ExecutionContext): Promise<ExecutionResult> {
    return {
      success: false,
      error: "file_parser is a server-side OpenRouter plugin and cannot be executed locally",
      log: [{ toolName: this.name, parameters: {}, error: "server-side plugin only", timestamp: Date.now() }],
    };
  }

  shouldRequireHITL(): boolean {
    return false;
  }
}

export const OcrFileParserFactory: IToolFactory = {
  name: PREDEFINED_TOOL_IDS.FILE_PARSER,
  description: "Enable OpenRouter file-parser plugin: the model can process PDF files and convert them to Markdown using Mistral OCR",
  parameters: [],
  isPlugin: true,
  create: () => new OcrFileParserTool(),
};

// ============================================================================
// EXPORT ALL FACTORIES
// ============================================================================

export const PredefinedToolsFactory = {
  searchFiles: SearchFilesFactory,
  readFile: ReadFileFactory,
  writeFile: WriteFileFactory,
  restRequest: RestRequestFactory,
  webSearch: WebSearchFactory,
  readBinaryFile: ReadBinaryFileFactory,
  ocrFileParser: OcrFileParserFactory,
  finishTask: FinishTaskFactory,
  askUser: AskUserFactory,
};

export default PredefinedToolsFactory;
