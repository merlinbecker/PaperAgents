/**
 * Predefined Tools - 4 Standard-Tools mit Factory Pattern
 * search_files, read_file, write_file, rest_request
 */

import { App, TFile, requestUrl, Platform } from "obsidian";
import type { IExecutableTool, IToolFactory, Parameter, ExecutionContext, ExecutionResult, ToolExecution, PdfChunkResult, PdfChunkSavedResult, PdfSplitMetadata } from "../types";
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

// Maximum file size accepted for base64 encoding.
// Converting a binary file to base64 requires multiple in-memory copies
// (ArrayBuffer + binary string + base64 string + JSON request body), which
// can exhaust available memory and crash the app.  Mobile devices (Capacitor/
// iOS, Capacitor/Android) have tighter memory budgets than the desktop app
// (Electron), so we enforce a stricter limit there.
const MAX_BINARY_FILE_BYTES_DESKTOP = 50 * 1024 * 1024; //  50 MB
const MAX_BINARY_FILE_BYTES_MOBILE  = 20 * 1024 * 1024; //  20 MB

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

      const maxBytes = Platform.isMobile ? MAX_BINARY_FILE_BYTES_MOBILE : MAX_BINARY_FILE_BYTES_DESKTOP;
      if (file.stat.size > maxBytes) {
        const limitMb = maxBytes / 1024 / 1024;
        throw new Error(
          `File too large: ${filePath} (${(file.stat.size / 1024 / 1024).toFixed(1)} MB). ` +
          `Maximum supported size on this platform is ${limitMb} MB.`
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
// SPLIT_AND_READ_PDF TOOL (splits large PDFs on mobile for base64 encoding)
// ============================================================================

const SPLIT_AND_READ_PDF_PARAMS: Parameter[] = [
  {
    name: "filePath",
    type: "string",
    description: "Path to PDF file in vault (e.g., '/pdfs/large.pdf')",
    required: true,
  },
  {
    name: "chunkIndex",
    type: "number",
    description:
      "Optional: 0-based index of the chunk to retrieve. " +
      "Omit on the first call to receive metadata (totalChunks, pagesPerChunk) without any base64 payload. " +
      "Then call again with chunkIndex=0, 1, … to retrieve each chunk individually.",
    required: false,
  },
  {
    name: "pagesPerChunk",
    type: "number",
    description: "Optional: pages per chunk (default: auto-calculated for ~5 MB chunks)",
    required: false,
  },
  {
    name: "saveTo",
    type: "string",
    description:
      "Optional: vault folder path where each chunk PDF should be saved " +
      "(e.g., '_chunks'). When set, the chunk is written to disk as " +
      "'{saveTo}/{basename}_chunk_{n}.pdf' and the result contains only " +
      "the file path – no base64 payload is kept in memory. " +
      "This is the recommended approach for mobile devices to prevent OOM crashes.",
    required: false,
  },
];

// Target chunk size before base64 encoding (5 MB → ~7 MB after base64).
// Kept conservative to prevent OOM crashes on mobile devices.
const TARGET_CHUNK_SIZE = 5 * 1024 * 1024;

class SplitAndReadPdfTool implements IExecutableTool {
  name = PREDEFINED_TOOL_IDS.SPLIT_AND_READ_PDF;
  parameters = SPLIT_AND_READ_PDF_PARAMS;

  constructor(private readonly app: App) {}

  async execute(ctx: ExecutionContext): Promise<ExecutionResult> {
    try {
      const filePath = ctx.parameters.filePath as string;

      const file = this.app.vault.getAbstractFileByPath(normPath(filePath)) ||
        this.app.vault.getAbstractFileByPath(filePath);
      const tfile = file instanceof TFile ? file : null;
      if (!tfile) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Only split when: mobile + PDF + > 20 MB
      const isPdf = filePath.toLowerCase().endsWith(".pdf");
      const isOverMobileLimit = tfile.stat.size > MAX_BINARY_FILE_BYTES_MOBILE;

      if (!Platform.isMobile || !isPdf || !isOverMobileLimit) {
        // Delegate to ReadBinaryFileTool
        const delegate = new ReadBinaryFileTool(this.app);
        return delegate.execute(ctx);
      }

      const chunkIndex = ctx.parameters.chunkIndex as number | undefined;
      const requestedPagesPerChunk = ctx.parameters.pagesPerChunk as number | undefined;
      const saveTo = ctx.parameters.saveTo as string | undefined;

      if (chunkIndex === undefined) {
        // ── Phase 1: metadata-only ──────────────────────────────────────────
        // Read raw bytes and count pages without loading the full pdf-lib DOM.
        // This saves ~75–100 MB compared to PDFDocument.load() on a 27 MB PDF.
        const buffer = await this.app.vault.readBinary(tfile);
        const rawPageCount = this.countPdfPagesFromRawBytes(buffer);
        const totalPages = rawPageCount ?? this.estimatePdfPagesFromFileSize(tfile.stat.size);

        if (totalPages === 1) {
          throw new Error(
            `PDF too large for mobile: file is ${(tfile.stat.size / 1024 / 1024).toFixed(1)} MB but contains only 1 page and` +
            ` cannot be split further. Please reduce the file size or use a desktop device.`
          );
        }

        const pagesPerChunk = requestedPagesPerChunk ??
          Math.ceil(totalPages / Math.ceil(tfile.stat.size / TARGET_CHUNK_SIZE));
        const totalChunks = Math.ceil(totalPages / pagesPerChunk);

        const metadata: PdfSplitMetadata = {
          filePath,
          totalPages,
          totalChunks,
          pagesPerChunk,
          fileSize: tfile.stat.size,
          strategy: "chunked",
        };

        return {
          success: true,
          data: metadata,
          log: [buildLogEntry(this.name, ctx.parameters, metadata)],
        };
      }

      // ── Phase 2: single-chunk retrieval ────────────────────────────────────
      // Dynamic import of pdf-lib (avoids bundling cost when not needed)
      const { PDFDocument } = await import("pdf-lib");

      // Load the full PDF, extract the chunk, then let all references go out of
      // scope so the GC can reclaim memory before the next chunk call.
      const buffer = await this.app.vault.readBinary(tfile);
      const pdfDoc = await PDFDocument.load(buffer);
      const totalPages = pdfDoc.getPageCount();

      const pagesPerChunk = requestedPagesPerChunk ??
        Math.ceil(totalPages / Math.ceil(tfile.stat.size / TARGET_CHUNK_SIZE));
      const totalChunks = Math.ceil(totalPages / pagesPerChunk);

      if (chunkIndex < 0 || chunkIndex >= totalChunks) {
        throw new Error(
          `Invalid chunkIndex ${chunkIndex}: PDF has ${totalChunks} chunk(s) (0-based index 0–${totalChunks - 1}).`
        );
      }

      const startPage = chunkIndex * pagesPerChunk; // 0-based
      const endPage = Math.min(startPage + pagesPerChunk - 1, totalPages - 1);

      const chunkDoc = await PDFDocument.create();
      const pageIndices = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);
      const copiedPages = await chunkDoc.copyPages(pdfDoc, pageIndices);
      for (const page of copiedPages) {
        chunkDoc.addPage(page);
      }
      const chunkBuffer = await chunkDoc.save();

      if (saveTo) {
        // ── saveTo mode: write chunk to vault file, return path only ──────────
        // No base64 is produced, keeping peak memory minimal.
        // The agent can then use read_binary_file on the saved path for OCR.
        const chunkPath = await this.saveChunkToVault(saveTo, filePath, chunkIndex, chunkBuffer);

        const savedChunk: PdfChunkSavedResult = {
          chunkPath,
          chunkIndex,
          totalChunks,
          startPage: startPage + 1, // 1-based for display
          endPage: endPage + 1,
          filePath,
          size: chunkBuffer.byteLength,
        };

        return {
          success: true,
          data: savedChunk,
          log: [buildLogEntry(this.name, ctx.parameters, {
            filePath,
            totalPages,
            chunkIndex,
            totalChunks,
            startPage: savedChunk.startPage,
            endPage: savedChunk.endPage,
            size: savedChunk.size,
            chunkPath,
          })],
        };
      }

      // ── in-memory mode: encode to base64 and return ────────────────────────
      // All pdf-lib and binary references are released once this call returns,
      // so peak memory is limited to one chunk at a time.
      const base64 = this.arrayBufferToBase64(chunkBuffer.buffer as ArrayBuffer);

      const chunk: PdfChunkResult = {
        chunkIndex,
        totalChunks,
        startPage: startPage + 1, // 1-based for display
        endPage: endPage + 1,
        base64,
        mimeType: "application/pdf",
        filePath,
        size: chunkBuffer.byteLength,
      };

      return {
        success: true,
        data: chunk,
        log: [buildLogEntry(this.name, ctx.parameters, {
          filePath,
          totalPages,
          chunkIndex,
          totalChunks,
          startPage: chunk.startPage,
          endPage: chunk.endPage,
          size: chunk.size,
        })],
      };
    } catch (error) {
      globalLogger.error("split_and_read_pdf tool error", { error });
      return buildErrorResult(this.name, ctx.parameters, error);
    }
  }

  /**
   * Count PDF pages from raw bytes without using pdf-lib.
   * Searches for /Count N entries in the PDF's Pages dictionary.
   * Returns the largest value found (the root Pages node holds the total count),
   * or null if no /Count entry was found (e.g., cross-reference streams only).
   */
  private countPdfPagesFromRawBytes(buffer: ArrayBuffer): number | null {
    const view = new Uint8Array(buffer);
    // ASCII byte values for the '/Count' keyword
    const SLASH = 47, B_C = 67, B_o = 111, B_u = 117, B_n = 110, B_t = 116;
    let maxCount = 0;

    outer: for (let i = 0; i < view.length - 8; i++) {
      if (view[i] !== SLASH) continue;
      if (view[i + 1] !== B_C) continue;
      if (view[i + 2] !== B_o) continue;
      if (view[i + 3] !== B_u) continue;
      if (view[i + 4] !== B_n) continue;
      if (view[i + 5] !== B_t) continue;
      // Must be followed by whitespace (space, tab, CR, LF)
      const ws = view[i + 6];
      if (ws !== 32 && ws !== 9 && ws !== 13 && ws !== 10) continue outer;

      let j = i + 7;
      while (j < view.length && (view[j] === 32 || view[j] === 9 || view[j] === 13 || view[j] === 10)) j++;

      let numStr = "";
      while (j < view.length) {
        const byte = view[j];
        if (byte === undefined || byte < 48 || byte > 57) break;
        numStr += String.fromCharCode(byte);
        j++;
      }

      if (numStr) {
        const count = parseInt(numStr, 10);
        if (count > maxCount) maxCount = count;
      }
    }

    return maxCount > 0 ? maxCount : null;
  }

  /**
   * Fallback page count estimate based on file size.
   * 200 KB per page is a conservative midpoint for typical mixed-content PDFs
   * (scanned pages at 150 dpi are ~200–400 KB; text-heavy PDFs are often <50 KB/page).
   * Returns at least 2 so the caller always attempts splitting.
   */
  private estimatePdfPagesFromFileSize(fileSizeBytes: number): number {
    return Math.max(2, Math.round(fileSizeBytes / (200 * 1024)));
  }

  /**
   * Save a chunk buffer as a PDF file in the vault under `saveTo`.
   * Creates the folder if it does not exist.
   * Returns the vault path of the saved file.
   */
  private async saveChunkToVault(
    saveTo: string,
    originalFilePath: string,
    chunkIndex: number,
    chunkBuffer: Uint8Array
  ): Promise<string> {
    const folderPath = normPath(saveTo);

    // Ensure folder exists
    const existing = this.app.vault.getAbstractFileByPath(folderPath);
    if (!existing) {
      await this.app.vault.createFolder(folderPath);
    }

    const baseName = (originalFilePath.split("/").pop() ?? "chunk").replace(/\.pdf$/i, "");
    const chunkPath = `${folderPath}/${baseName}_chunk_${chunkIndex}.pdf`;
    const chunkArrayBuffer = chunkBuffer.buffer as ArrayBuffer;

    // Obsidian's Vault binary API (not in the TypeScript definitions shipped with the
    // obsidian package, but present at runtime).
    type VaultBinary = { createBinary(p: string, d: ArrayBuffer): Promise<TFile>; modifyBinary(f: TFile, d: ArrayBuffer): Promise<void> };
    const vaultBinary = this.app.vault as unknown as VaultBinary;

    const existingChunk = this.app.vault.getAbstractFileByPath(chunkPath);
    if (existingChunk instanceof TFile) {
      await vaultBinary.modifyBinary(existingChunk, chunkArrayBuffer);
    } else {
      await vaultBinary.createBinary(chunkPath, chunkArrayBuffer);
    }

    return chunkPath;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    const chunksList: string[] = [];
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      chunksList.push(String.fromCharCode(...bytes.subarray(i, i + chunkSize)));
    }
    return btoa(chunksList.join(""));
  }

  shouldRequireHITL(): boolean {
    return false;
  }
}

export const SplitAndReadPdfFactory: IToolFactory = {
  name: PREDEFINED_TOOL_IDS.SPLIT_AND_READ_PDF,
  description:
    "Memory-efficient reading of a PDF from the vault as Base64. " +
    "On mobile devices with PDFs larger than 20 MB, call this tool TWICE per chunk: " +
    "first WITHOUT chunkIndex to get metadata (totalChunks, pagesPerChunk); " +
    "then WITH chunkIndex=0, 1, … to retrieve each chunk individually. " +
    "For the lowest memory footprint on mobile, also pass saveTo='/path/to/chunks': " +
    "each chunk PDF is saved to the vault (no base64 in memory) and the result " +
    "contains only the saved file path. Use read_binary_file on that path for OCR. " +
    "Only one chunk is kept in memory at a time, preventing out-of-memory crashes. " +
    "Chunks are kept small (~5 MB) to avoid OOM on mobile. " +
    "On desktop or for smaller files the behaviour is identical to read_binary_file.",
  parameters: SPLIT_AND_READ_PDF_PARAMS,
  create: (app?: App) => new SplitAndReadPdfTool(requireApp(app, "SplitAndReadPdfTool")),
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
  splitAndReadPdf: SplitAndReadPdfFactory,
  ocrFileParser: OcrFileParserFactory,
  finishTask: FinishTaskFactory,
  askUser: AskUserFactory,
};

export default PredefinedToolsFactory;
