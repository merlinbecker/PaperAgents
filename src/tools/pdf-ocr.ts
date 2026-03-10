/**
 * PDF OCR Tool – converts a PDF file to Markdown by running OCR via OpenRouter.
 *
 * The tool encapsulates the full OCR workflow that was previously implemented as a
 * multi-step agentic loop in the OCR agent:
 *   1. Read PDF metadata (file size, page count).
 *   2. For large PDFs on mobile: split into memory-safe chunks (≤ 5 MB) with pdf-lib
 *      and save each chunk to a temp vault folder.
 *   3. Run OCR on each chunk by calling OpenRouter's chat/completions endpoint with the
 *      file-parser plugin and the specified (or default) Mistral OCR model.
 *   4. Save each chunk's OCR result as a Markdown file.
 *   5. Clean up temporary chunk PDFs from the vault.
 *   6. Return the list of created Markdown file paths.
 *
 * Input parameters:
 *   - pdfPath   (required) – vault path to the PDF to convert.
 *   - outputPath (optional) – base path for output Markdown files (without extension).
 *                             Defaults to pdfPath with ".pdf" replaced by ".md".
 *   - model     (optional) – OpenRouter model for OCR.
 *                             Defaults to "mistralai/mistral-ocr-latest".
 *
 * Output:
 *   { files: string[], totalFiles: number }
 *   where `files` is the list of created Markdown vault paths.
 */

import { App, TFile, requestUrl, Platform } from "obsidian";
import type { IExecutableTool, IToolFactory, Parameter, ExecutionContext, ExecutionResult, ToolExecution } from "../types";
import { PREDEFINED_TOOL_IDS } from "../utils/constants";
import { globalLogger } from "../utils/logger";

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_OCR_MODEL = "mistralai/mistral-ocr-latest";
const OCR_TEMP_FOLDER = "_ocr_tmp";
const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

/** Maximum file size before splitting on mobile (20 MB). */
const MAX_BINARY_BYTES_MOBILE = 20 * 1024 * 1024;
/** Maximum file size allowed on desktop without splitting (50 MB). */
const MAX_BINARY_BYTES_DESKTOP = 50 * 1024 * 1024;
/** Target chunk size before base64 encoding (5 MB → ~7 MB after encoding). */
const TARGET_CHUNK_SIZE = 5 * 1024 * 1024;

// ============================================================================
// PARAMETER DEFINITIONS
// ============================================================================

export const PDF_OCR_PARAMS: Parameter[] = [
  {
    name: "pdfPath",
    type: "string",
    description: "Vault path to the PDF file to convert to Markdown (e.g. 'papers/article.pdf')",
    required: true,
  },
  {
    name: "outputPath",
    type: "string",
    description:
      "Base vault path for the output Markdown file(s) without extension " +
      "(e.g. 'papers/article'). Defaults to pdfPath with '.pdf' replaced by '.md'.",
    required: false,
  },
  {
    name: "model",
    type: "string",
    description:
      `OpenRouter model to use for OCR. Defaults to "${DEFAULT_OCR_MODEL}".`,
    required: false,
  },
];

// ============================================================================
// HELPERS (module-level, shared)
// ============================================================================

function normPath(p: string): string {
  return p.replace(/^\//, "");
}

function buildLogEntry(
  toolName: string,
  parameters: Record<string, unknown>,
  output?: unknown
): ToolExecution {
  return { toolName, parameters, output, timestamp: Date.now() };
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunks: string[] = [];
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + chunkSize)));
  }
  return btoa(chunks.join(""));
}

// ============================================================================
// PDF OCR TOOL
// ============================================================================

class PdfOcrTool implements IExecutableTool {
  name = PREDEFINED_TOOL_IDS.PDF_OCR;
  parameters = PDF_OCR_PARAMS;

  constructor(
    private readonly app: App,
    private readonly getApiKey: () => string,
  ) {}

  async execute(ctx: ExecutionContext): Promise<ExecutionResult> {
    const pdfPath = ctx.parameters.pdfPath as string;
    const outputPath = ctx.parameters.outputPath as string | undefined;
    const model = (ctx.parameters.model as string | undefined) || DEFAULT_OCR_MODEL;

    const apiKey = this.getApiKey();
    if (!apiKey) {
      return {
        success: false,
        error: "OpenRouter API key is not configured. Please set it in plugin settings.",
        log: [buildLogEntry(this.name, ctx.parameters)],
      };
    }

    // Resolve the PDF file in the vault
    const normalizedPath = normPath(pdfPath);
    const pdfFile =
      this.app.vault.getAbstractFileByPath(normalizedPath) ??
      this.app.vault.getAbstractFileByPath(pdfPath);

    if (!pdfFile || !(pdfFile instanceof TFile)) {
      return {
        success: false,
        error: `PDF file not found: ${pdfPath}`,
        log: [buildLogEntry(this.name, ctx.parameters)],
      };
    }

    // Derive the output base path (strip trailing .pdf, .md)
    const outputBase = outputPath
      ? normPath(outputPath).replace(/\.md$/i, "")
      : normalizedPath.replace(/\.pdf$/i, "");

    const createdFiles: string[] = [];
    const tempChunkPaths: string[] = [];

    try {
      const needsSplit =
        Platform.isMobile && pdfFile.stat.size > MAX_BINARY_BYTES_MOBILE;

      if (!needsSplit) {
        // ── Single-file path ──────────────────────────────────────────────────
        const maxBytes = Platform.isMobile
          ? MAX_BINARY_BYTES_MOBILE
          : MAX_BINARY_BYTES_DESKTOP;

        if (pdfFile.stat.size > maxBytes) {
          const limitMb = (maxBytes / 1024 / 1024).toFixed(0);
          const fileMb = (pdfFile.stat.size / 1024 / 1024).toFixed(1);
          return {
            success: false,
            error:
              `PDF too large: ${fileMb} MB exceeds the ${limitMb} MB limit on this platform. ` +
              `Please use a smaller file or run on a desktop device.`,
            log: [buildLogEntry(this.name, ctx.parameters)],
          };
        }

        const buffer = await this.app.vault.readBinary(pdfFile);
        const base64 = arrayBufferToBase64(buffer);
        const fileName = normalizedPath.split("/").pop() || "document.pdf";

        globalLogger.info("pdf_ocr: starting single-file OCR", { pdfPath, model });
        const ocrText = await this.callOcr(base64, fileName, model, apiKey);

        const mdPath = `${outputBase}.md`;
        await this.writeMarkdown(mdPath, ocrText);
        createdFiles.push(mdPath);
      } else {
        // ── Multi-chunk path (mobile, large PDF) ──────────────────────────────
        globalLogger.info("pdf_ocr: large PDF on mobile – splitting into chunks", {
          pdfPath,
          sizeMb: (pdfFile.stat.size / 1024 / 1024).toFixed(1),
        });

        const { PDFDocument } = await import("pdf-lib");
        const buffer = await this.app.vault.readBinary(pdfFile);
        const pdfDoc = await PDFDocument.load(buffer);
        const totalPages = pdfDoc.getPageCount();

        const pagesPerChunk = Math.ceil(
          totalPages / Math.ceil(pdfFile.stat.size / TARGET_CHUNK_SIZE)
        );
        const totalChunks = Math.ceil(totalPages / pagesPerChunk);
        const baseName = (pdfPath.split("/").pop() ?? "doc").replace(/\.pdf$/i, "");

        for (let i = 0; i < totalChunks; i++) {
          const startPage = i * pagesPerChunk;
          const endPage = Math.min(startPage + pagesPerChunk - 1, totalPages - 1);

          const chunkDoc = await PDFDocument.create();
          const pageIndices = Array.from(
            { length: endPage - startPage + 1 },
            (_, k) => startPage + k
          );
          const copiedPages = await chunkDoc.copyPages(pdfDoc, pageIndices);
          for (const page of copiedPages) chunkDoc.addPage(page);
          const chunkBuffer = await chunkDoc.save();

          // Save chunk to vault temp folder so it can be cleaned up after OCR
          const tempPath = await this.saveChunkToVault(
            OCR_TEMP_FOLDER,
            baseName,
            i,
            chunkBuffer
          );
          tempChunkPaths.push(tempPath);

          // OCR this chunk
          const chunkArrayBuffer = chunkBuffer.buffer.slice(
            chunkBuffer.byteOffset,
            chunkBuffer.byteOffset + chunkBuffer.byteLength
          );
          const base64 = arrayBufferToBase64(chunkArrayBuffer);
          const chunkFileNameForOcr = `${baseName}_chunk_${i}.pdf`;

          globalLogger.info("pdf_ocr: OCR-ing chunk", {
            chunkIndex: i,
            totalChunks,
            startPage: startPage + 1,
            endPage: endPage + 1,
          });
          const ocrText = await this.callOcr(base64, chunkFileNameForOcr, model, apiKey);

          const mdPath = `${outputBase}_part_${i + 1}.md`;
          await this.writeMarkdown(mdPath, ocrText);
          createdFiles.push(mdPath);
        }
      }

      return {
        success: true,
        data: { files: createdFiles, totalFiles: createdFiles.length },
        log: [buildLogEntry(this.name, ctx.parameters, { files: createdFiles })],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      globalLogger.error("pdf_ocr tool error", { error: message, pdfPath });
      return {
        success: false,
        error: message,
        log: [buildLogEntry(this.name, ctx.parameters, { error: message })],
      };
    } finally {
      // ── Cleanup: delete temporary chunk PDFs from vault ─────────────────────
      for (const tempPath of tempChunkPaths) {
        try {
          const f = this.app.vault.getAbstractFileByPath(tempPath);
          if (f instanceof TFile) {
            await this.app.vault.delete(f);
          }
        } catch {
          // Ignore individual cleanup errors – non-fatal
        }
      }
      // Remove the temp folder itself if it is now empty
      try {
        const tempFolder = this.app.vault.getAbstractFileByPath(OCR_TEMP_FOLDER);
        if (
          tempFolder &&
          "children" in tempFolder &&
          Array.isArray((tempFolder as { children: unknown[] }).children) &&
          (tempFolder as { children: unknown[] }).children.length === 0
        ) {
          await this.app.vault.delete(tempFolder as Parameters<typeof this.app.vault.delete>[0]);
        }
      } catch {
        // Ignore – non-fatal
      }
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Call OpenRouter chat/completions with the file-parser plugin to OCR a single PDF chunk.
   * Returns the raw OCR text from the model.
   *
   * The `mistral-ocr` PDF engine is model-independent — it is used by OpenRouter's
   * file-parser plugin to extract text from the PDF before passing the content to
   * whichever model is configured.
   *
   * The OpenRouter docs show the text instruction BEFORE the file item in all examples.
   * All models (including dedicated OCR models like mistral-ocr-latest) require an
   * explicit text instruction alongside the file so they know to return the extracted
   * document text rather than producing an empty response.
   */
  private async callOcr(
    base64: string,
    filename: string,
    model: string,
    apiKey: string
  ): Promise<string> {
    const dataUrl = `data:application/pdf;base64,${base64}`;

    // isDedicatedOcrModel is used only for tailoring the empty-content error hint.
    const isDedicatedOcrModel = model.toLowerCase().includes("mistral-ocr");

    // The OpenRouter docs always place the text instruction BEFORE the file item.
    // All models — including dedicated OCR models like mistral-ocr-latest — require
    // an explicit instruction; without it the model returns an empty response.
    const fileItem: Record<string, unknown> = {
      type: "file",
      file: {
        filename,
        file_data: dataUrl,
      },
    };
    const messageContent: Array<Record<string, unknown>> = [
      {
        type: "text",
        text: "Extract and return the complete text content of this document. Preserve the original structure and formatting as faithfully as possible.",
      },
      fileItem,
    ];

    const requestBody = {
      model,
      messages: [
        {
          role: "user",
          content: messageContent,
        },
      ],
      plugins: [
        {
          id: "file-parser",
          pdf: { engine: "mistral-ocr" },
        },
      ],
    };

    const response = await requestUrl({
      url: OPENROUTER_CHAT_URL,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "X-Title": "Paper Agents (Obsidian Plugin)",
      },
      body: JSON.stringify(requestBody),
      throw: false,
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(
        `OCR API error: HTTP ${response.status} — ${response.text || "no body"}`
      );
    }

    const data = response.json as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (content == null || content === "") {
      const hint = isDedicatedOcrModel
        ? "The PDF may be encrypted, contain only images without recognizable text, or be in an unsupported format."
        : `Model "${model}" may not support PDF extraction. Try using "${DEFAULT_OCR_MODEL}" for best OCR results on scanned documents.`;
      throw new Error(`OCR returned empty content from OpenRouter. ${hint}`);
    }

    return content;
  }

  /** Write (or overwrite) a Markdown file in the vault. Creates parent folders as needed. */
  private async writeMarkdown(filePath: string, content: string): Promise<void> {
    const existing = this.app.vault.getAbstractFileByPath(filePath);
    if (existing instanceof TFile) {
      await this.app.vault.modify(existing, content);
      return;
    }
    // Ensure parent folder exists
    const parentPath = filePath.split("/").slice(0, -1).join("/");
    if (parentPath) {
      const parentExists = this.app.vault.getAbstractFileByPath(parentPath);
      if (!parentExists) {
        await this.app.vault.createFolder(parentPath);
      }
    }
    await this.app.vault.create(filePath, content);
  }

  /**
   * Save a chunk buffer as a PDF in the vault temp folder.
   * Returns the vault path of the saved file.
   */
  private async saveChunkToVault(
    tempFolder: string,
    baseName: string,
    chunkIndex: number,
    chunkBuffer: Uint8Array
  ): Promise<string> {
    const folderPath = normPath(tempFolder);
    const folderExists = this.app.vault.getAbstractFileByPath(folderPath);
    if (!folderExists) {
      await this.app.vault.createFolder(folderPath);
    }

    const chunkPath = `${folderPath}/${baseName}_chunk_${chunkIndex}.pdf`;
    const chunkArrayBuffer = chunkBuffer.buffer.slice(
      chunkBuffer.byteOffset,
      chunkBuffer.byteOffset + chunkBuffer.byteLength
    );

    type VaultBinary = {
      createBinary(p: string, d: ArrayBuffer): Promise<TFile>;
      modifyBinary(f: TFile, d: ArrayBuffer): Promise<void>;
    };
    const vaultBinary = this.app.vault as unknown as VaultBinary;

    const existing = this.app.vault.getAbstractFileByPath(chunkPath);
    if (existing instanceof TFile) {
      await vaultBinary.modifyBinary(existing, chunkArrayBuffer);
    } else {
      await vaultBinary.createBinary(chunkPath, chunkArrayBuffer);
    }

    return chunkPath;
  }

  shouldRequireHITL(): boolean {
    return false;
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create an IToolFactory for the pdf_ocr tool.
 *
 * @param getApiKey     – Getter that returns the current OpenRouter API key at call-time.
 *                        This allows the tool to pick up key changes without re-registration.
 */
export function createPdfOcrFactory(
  getApiKey: () => string,
): IToolFactory {
  return {
    name: PREDEFINED_TOOL_IDS.PDF_OCR,
    description:
      "Convert a PDF file to Markdown using OCR via OpenRouter. " +
      "Handles PDF splitting for large files on mobile automatically. " +
      "Input: pdfPath (required), outputPath (optional), model (optional, default mistralai/mistral-ocr-latest — required for optimal OCR on scanned PDFs; other models may produce lower quality results). " +
      "Output: list of created Markdown file paths.",
    parameters: PDF_OCR_PARAMS,
    create(app?: App): IExecutableTool {
      if (!app) throw new Error("PdfOcrTool requires App instance");
      return new PdfOcrTool(app, getApiKey);
    },
  };
}
