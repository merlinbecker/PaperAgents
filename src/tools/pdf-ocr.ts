/**
 * PDF OCR Tool – converts a PDF file to Markdown by running OCR via OpenRouter.
 *
 * The tool encapsulates the full OCR workflow that was previously implemented as a
 * multi-step agentic loop in the OCR agent:
 *   1. Read PDF metadata (file size, page count).
 *   2. For large PDFs on mobile: split into memory-safe chunks (≤ 5 MB) with pdf-lib
 *      and save each chunk to a temp vault folder.
 *   3. Optionally strip image XObjects from the PDF (or each chunk) using pdf-lib
 *      before encoding, so no binary image data is sent to the OCR API.
 *   4. Run OCR on each chunk by calling OpenRouter's chat/completions endpoint with the
 *      file-parser plugin and the caller-specified model.
 *   5. Save each chunk's OCR result as a Markdown file (image Markdown syntax is also
 *      removed from the text output as a final safety net).
 *   6. Clean up temporary chunk PDFs from the vault.
 *   7. Return the list of created Markdown file paths.
 *
 * Input parameters:
 *   - pdfPath    (required) – vault path to the PDF to convert.
 *   - model      (required) – OpenRouter model to use for OCR.
 *                              See https://openrouter.ai/models for available models.
 *                              The file-parser plugin with the mistral-ocr engine is
 *                              used for PDF extraction regardless of the chosen model.
 *   - outputPath (optional) – base path for output Markdown files (without extension).
 *                              Defaults to pdfPath with ".pdf" replaced by ".md".
 *   - stripImages (optional, default true) – when true, image XObjects are removed
 *                              from the PDF bytes before sending to OCR, and any
 *                              remaining image Markdown syntax is removed from the
 *                              output.  Set to false to keep images.
 *
 * Output:
 *   { files: string[], totalFiles: number }
 *   where `files` is the list of created Markdown vault paths.
 */

import { App, TFile, requestUrl, Platform } from "obsidian";
import type { IExecutableTool, IToolFactory, Parameter, ExecutionContext, ExecutionResult, ToolExecution } from "../types";
import { PREDEFINED_TOOL_IDS } from "../utils/constants";
import { globalLogger } from "../utils/logger";

const logger = globalLogger.createLogger("PdfOcr");

// ============================================================================
// CONSTANTS
// ============================================================================

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
    name: "model",
    type: "string",
    description:
      "OpenRouter model to use for OCR (required). " +
      "See https://openrouter.ai/models for available models. " +
      "The file-parser plugin with the mistral-ocr engine is used for PDF text extraction " +
      "regardless of the chosen model.",
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
    name: "stripImages",
    type: "boolean",
    description:
      "When true (default), removes all image references and embedded image data (e.g. " +
      "base64 data-URLs) from the OCR output so that only text is passed to the LLM. " +
      "Set to false to keep images in the Markdown output.",
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
  return uint8ArrayToBase64(new Uint8Array(buffer));
}

/**
 * Convert a Uint8Array directly to a base64 string.
 *
 * This avoids the `Uint8Array.buffer.slice(byteOffset, ...)` pattern used
 * elsewhere: when pdf-lib (or any Wasm/Node.js pooled allocator) returns a
 * Uint8Array that is a *view* of a larger backing buffer, accessing `.buffer`
 * returns the entire pool ArrayBuffer rather than just the PDF bytes.  The
 * explicit `.slice()` call compensates for this, but iterating over the
 * Uint8Array view itself is simpler and guaranteed correct regardless of the
 * buffer layout.
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + chunkSize)));
  }
  return btoa(chunks.join(""));
}

/**
 * Remove Markdown image syntax and HTML img tags from an OCR result.
 *
 * Mistral-OCR embeds page images as `![description](data:image/...;base64,…)` blocks
 * or as HTML `<img>` tags. This function removes both forms so that only text content
 * is forwarded to the LLM.
 *
 * Base64 encoding uses only A–Z, a–z, 0–9, +, / and = — no parentheses — so
 * `[^)]*` is safe and non-backtracking.
 *
 * The function handles:
 *   - Inline images with data URLs:  `![alt](data:image/png;base64,AAA…)`
 *   - Inline images with regular URLs:  `![alt](https://example.com/img.png)`
 *   - Images with empty alt text:  `![](url)`
 *   - HTML img tags:  `<img src="..." />` and `<img src="..." alt="…">`
 *
 * After removal, consecutive blank lines are collapsed to a single blank line.
 */
function stripMarkdownImages(text: string): string {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")  // remove ![alt](url) / ![alt](data:...)
    .replace(/<img\b[^>]*>/gi, "")          // remove <img ...> / <img ... />
    .replace(/\n{3,}/g, "\n\n")             // collapse runs of blank lines
    .trim();
}

// ── Inline image (BI/ID/EI) stripping from PDF content streams ───────────────

/**
 * Return true for the six PDF white-space characters (PDF 1.7 §7.2.2).
 */
function isPdfWhitespace(b: number): boolean {
  return b === 0x00 || b === 0x09 || b === 0x0a || b === 0x0c || b === 0x0d || b === 0x20;
}

/**
 * Safe indexed access into a Uint8Array.
 * Returns -1 for any out-of-bounds index so callers can use a single
 * conditional without separate range checks (rather than having to guard
 * each access with an explicit bounds check).
 */
function safeByteAt(bytes: Uint8Array, index: number): number {
  return index >= 0 && index < bytes.length ? (bytes[index] as number) : -1;
}

/**
 * Scan an **uncompressed** PDF content-stream byte array and return a copy with
 * all inline image blocks removed.
 *
 * Inline images in PDF content streams are delimited by three operators:
 *   - `BI`  (Begin Image) – marks the start of the parameter dictionary
 *   - `ID`  (Image Data) – marks the start of the raw image bytes
 *   - `EI`  (End Image)  – marks the end of the image data
 *
 * Unlike XObject images (which live in the page Resources dictionary), inline
 * images are embedded directly in the content stream, so they cannot be
 * removed by simply editing the Resources dictionary.
 *
 * Algorithm:
 *   1. Walk the byte array looking for `BI` surrounded by PDF whitespace.
 *   2. Scan forward from `BI` to find the `ID` operator.
 *   3. Scan forward from `ID` to find `EI` surrounded by PDF whitespace.
 *   4. Omit the entire `BI`…`EI` span from the output; emit a single space
 *      to keep adjacent PDF operators properly separated.
 *
 * Exported for unit testing.
 *
 * Limitation: the scan stops at the *first* `EI` sequence that is surrounded
 * by PDF whitespace within the image-data region.  For typical image encodings
 * (CCITT fax, JPEG/DCT, lossless predictors) the probability of the byte pair
 * 0x45 0x49 appearing flanked by whitespace bytes in the raw pixel data is
 * very low, making false early termination extremely rare in practice.
 */
export function removeInlineImagesFromStreamBytes(bytes: Uint8Array): Uint8Array {
  const out: number[] = [];
  let i = 0;

  while (i < bytes.length) {
    // Detect "BI" operator: bytes B I, preceded by PDF whitespace (or stream
    // start) and followed immediately by PDF whitespace.
    if (
      safeByteAt(bytes, i) === 0x42 /* B */ &&
      safeByteAt(bytes, i + 1) === 0x49 /* I */ &&
      isPdfWhitespace(safeByteAt(bytes, i + 2)) &&
      (i === 0 || isPdfWhitespace(safeByteAt(bytes, i - 1)))
    ) {
      // ── Locate "ID" operator ──────────────────────────────────────────────
      let j = i + 2;
      let idPos = -1;
      while (j + 1 < bytes.length) {
        if (
          safeByteAt(bytes, j) === 0x49 /* I */ &&
          safeByteAt(bytes, j + 1) === 0x44 /* D */ &&
          isPdfWhitespace(safeByteAt(bytes, j - 1)) &&
          isPdfWhitespace(safeByteAt(bytes, j + 2))
        ) {
          idPos = j;
          break;
        }
        j++;
      }
      if (idPos === -1) {
        // No matching "ID" — not a valid inline image; copy 'B' and move on.
        out.push(safeByteAt(bytes, i));
        i++;
        continue;
      }

      // Advance past "ID" and skip the single mandatory whitespace byte that
      // the PDF spec (ISO 32000 §8.9.7) requires to follow the ID operator
      // before the raw image data begins.
      j = idPos + 2;
      if (isPdfWhitespace(safeByteAt(bytes, j))) j++;

      // ── Locate "EI" operator ──────────────────────────────────────────────
      let eiEnd = -1;
      while (j + 1 < bytes.length) {
        if (
          safeByteAt(bytes, j) === 0x45 /* E */ &&
          safeByteAt(bytes, j + 1) === 0x49 /* I */ &&
          isPdfWhitespace(safeByteAt(bytes, j - 1)) &&
          (j + 2 >= bytes.length || isPdfWhitespace(safeByteAt(bytes, j + 2)))
        ) {
          eiEnd = j + 2;
          if (isPdfWhitespace(safeByteAt(bytes, eiEnd))) eiEnd++;
          break;
        }
        j++;
      }
      if (eiEnd === -1) {
        // No matching "EI" found — copy 'B' and move on.
        out.push(safeByteAt(bytes, i));
        i++;
        continue;
      }

      // Entire BI…EI block removed; emit a space to preserve operator spacing.
      out.push(0x20 /* space */);
      i = eiEnd;
    } else {
      out.push(safeByteAt(bytes, i));
      i++;
    }
  }

  return new Uint8Array(out);
}

/**
 * Remove inline image (BI/ID/EI) operator blocks from every page's content
 * streams in a PDFDocument.
 *
 * Only operates on **uncompressed** content streams (those without a /Filter
 * entry).  Decompressing and re-compressing filtered streams (e.g.
 * FlateDecode) requires a zlib implementation that is not available in the
 * Obsidian plugin environment.  The post-processing `stripMarkdownImages` step
 * serves as a fallback for images that survive through compressed streams.
 */
async function stripInlineImages(pdfDoc: import("pdf-lib").PDFDocument): Promise<void> {
  const { PDFName, PDFRef, PDFRawStream, PDFArray, PDFNumber } = await import("pdf-lib");
  const context = pdfDoc.context;

  for (const page of pdfDoc.getPages()) {
    const contentsRaw = page.node.get(PDFName.of("Contents"));
    if (!contentsRaw) continue;

    // Contents may be a single indirect reference or an array of references.
    const streamRefs: import("pdf-lib").PDFRef[] = [];
    if (contentsRaw instanceof PDFRef) {
      streamRefs.push(contentsRaw);
    } else if (contentsRaw instanceof PDFArray) {
      for (const item of contentsRaw.asArray()) {
        if (item instanceof PDFRef) streamRefs.push(item);
      }
    }

    for (const ref of streamRefs) {
      const rawObj = context.lookup(ref);
      if (!(rawObj instanceof PDFRawStream)) continue;

      // Skip compressed streams – cannot decode/re-encode without zlib.
      if (rawObj.dict.get(PDFName.of("Filter"))) continue;

      const newContents = removeInlineImagesFromStreamBytes(rawObj.contents);
      if (newContents.length !== rawObj.contents.length) {
        // PDFRawStream.contents is readonly; create a replacement stream with
        // the same dictionary (updated /Length) and register it in the context.
        rawObj.dict.set(PDFName.of("Length"), PDFNumber.of(newContents.length));
        const newStream = PDFRawStream.of(rawObj.dict, newContents);
        context.assign(ref, newStream);
      }
    }
  }
}

/**
 * Remove all image XObjects from every page's Resources in a pdf-lib PDFDocument.
 *
 * PDF images are stored as XObject streams with `/Subtype /Image` in each page's
 * Resources/XObject dictionary.  Deleting them before re-serialising the document
 * ensures that no binary image data is transmitted to the OCR API.
 *
 * Limitations:
 *  - Only *referenced* XObject images are removed.  Inline images embedded directly
 *    inside a page's content stream via the `BI`/`EI` operators are handled separately
 *    by `stripInlineImages` (for uncompressed streams only).
 *  - Resources that are inherited from a parent page tree node (rather than declared
 *    on the page itself) are also walked through the same resolution logic.
 */
async function stripImageXObjects(pdfDoc: import("pdf-lib").PDFDocument): Promise<void> {
  const { PDFName, PDFDict, PDFRef, PDFStream } = await import("pdf-lib");

  const context = pdfDoc.context;
  const nameSubtype = PDFName.of("Subtype");
  const nameImage = PDFName.of("Image");

  for (const page of pdfDoc.getPages()) {
    // Resources may be a direct PDFDict or an indirect PDFRef to one.
    const resourcesRaw = page.node.get(PDFName.Resources);
    if (!resourcesRaw) continue;

    const resources =
      resourcesRaw instanceof PDFRef
        ? context.lookupMaybe(resourcesRaw, PDFDict)
        : resourcesRaw instanceof PDFDict
          ? resourcesRaw
          : undefined;
    if (!resources) continue;

    // XObject subdictionary – may also be an indirect reference.
    const xObjectsRaw = resources.get(PDFName.XObject);
    if (!xObjectsRaw) continue;

    const xObjects =
      xObjectsRaw instanceof PDFRef
        ? context.lookupMaybe(xObjectsRaw, PDFDict)
        : xObjectsRaw instanceof PDFDict
          ? xObjectsRaw
          : undefined;
    if (!xObjects) continue;

    // Collect image keys first to avoid mutating the dictionary while iterating.
    const imageKeys: import("pdf-lib").PDFName[] = [];
    for (const key of xObjects.keys()) {
      const xobjRaw = xObjects.get(key);
      const xobj = xobjRaw instanceof PDFRef ? context.lookup(xobjRaw) : xobjRaw;
      if (!xobj) continue;

      // Both PDFStream and PDFRawStream inherit from PDFStream and carry their
      // metadata in `.dict`.
      const dict = xobj instanceof PDFStream ? xobj.dict : undefined;
      if (!dict) continue;

      if (dict.get(nameSubtype) === nameImage) {
        imageKeys.push(key);
      }
    }

    for (const key of imageKeys) {
      xObjects.delete(key);
    }
  }
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
    const model = ctx.parameters.model as string | undefined;
    // Default to true: strip images so only text is forwarded to the LLM.
    const stripImages = ctx.parameters.stripImages !== false;

    const apiKey = this.getApiKey();
    if (!apiKey) {
      return {
        success: false,
        error: "OpenRouter API key is not configured. Please set it in plugin settings.",
        log: [buildLogEntry(this.name, ctx.parameters)],
      };
    }

    if (!model) {
      return {
        success: false,
        error:
          "The 'model' parameter is required. Please specify an OpenRouter model to use for OCR. " +
          "See https://openrouter.ai/models for available models.",
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
    // Records descriptions of any per-chunk OCR failures (multi-chunk path only).
    // Keeping this at the outer scope lets us surface it in the final result data.
    const chunkErrors: string[] = [];

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

        // Guard against empty files before attempting any pdf-lib processing.
        // callOcr also checks, but the empty-buffer error should surface before
        // we try to load the bytes into PDFDocument (which would throw a less
        // informative parser error).
        if (buffer.byteLength === 0) {
          return {
            success: false,
            error:
              `Cannot perform OCR on "${pdfPath}": the PDF could not be read or is empty. ` +
              `Please check that the file exists in the vault and is a valid, non-empty PDF.`,
            log: [buildLogEntry(this.name, ctx.parameters)],
          };
        }

        let pdfBytesToSend: Uint8Array | ArrayBuffer;

        if (stripImages) {
          // Load the PDF into pdf-lib, strip image XObjects and inline images,
          // then re-serialise.  This ensures no binary image data is transmitted
          // to the OCR API.
          const { PDFDocument } = await import("pdf-lib");
          const singleDoc = await PDFDocument.load(buffer);
          await stripImageXObjects(singleDoc);
          await stripInlineImages(singleDoc);
          pdfBytesToSend = await singleDoc.save({ useObjectStreams: false });
          logger.info("pdf_ocr: stripped images from single PDF before OCR", { pdfPath });
        } else {
          pdfBytesToSend = buffer;
        }

        // When stripImages is true, pdfBytesToSend is a Uint8Array from PDFDocument.save().
        // When false, it is the raw ArrayBuffer from vault.readBinary().
        const base64 = pdfBytesToSend instanceof ArrayBuffer
          ? arrayBufferToBase64(pdfBytesToSend)
          : uint8ArrayToBase64(pdfBytesToSend);
        const fileName = normalizedPath.split("/").pop() || "document.pdf";

        logger.info("pdf_ocr: starting single-file OCR", { pdfPath, model });
        const ocrText = await this.callOcr(base64, fileName, model, apiKey, stripImages);

        const mdPath = `${outputBase}.md`;
        await this.writeMarkdown(mdPath, ocrText);
        createdFiles.push(mdPath);
      } else {
        // ── Multi-chunk path (mobile, large PDF) ──────────────────────────────
        logger.info("pdf_ocr: large PDF on mobile – splitting into chunks", {
          pdfPath,
          sizeMb: (pdfFile.stat.size / 1024 / 1024).toFixed(1),
        });

        const { PDFDocument } = await import("pdf-lib");
        const buffer = await this.app.vault.readBinary(pdfFile);
        const pdfDoc = await PDFDocument.load(buffer);

        // Strip image XObjects and inline images from the source document once,
        // before page-copying. Chunks created via copyPages will inherit the
        // image-free resource dictionaries and content streams.
        if (stripImages) {
          await stripImageXObjects(pdfDoc);
          await stripInlineImages(pdfDoc);
          logger.info("pdf_ocr: stripped images from source PDF before chunking", {
            pdfPath,
            sizeMb: (pdfFile.stat.size / 1024 / 1024).toFixed(1),
          });
        }

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
          // useObjectStreams: false produces a PDF 1.4-compatible file (no cross-reference
          // streams), which is more broadly supported by OCR engines and PDF parsers.
          const chunkBuffer = await chunkDoc.save({ useObjectStreams: false });

          // Validate that pdf-lib produced a well-formed PDF chunk.
          // A valid PDF begins with the 5-byte magic sequence "%PDF-".
          if (
            chunkBuffer.length < 5 ||
            chunkBuffer[0] !== 0x25 || // %
            chunkBuffer[1] !== 0x50 || // P
            chunkBuffer[2] !== 0x44 || // D
            chunkBuffer[3] !== 0x46 || // F
            chunkBuffer[4] !== 0x2d    // -
          ) {
            throw new Error(
              `Chunk ${i + 1} of ${totalChunks} (pages ${startPage + 1}–${endPage + 1}): ` +
              `pdf-lib did not produce a valid PDF. ` +
              `The source PDF may use features incompatible with splitting.`
            );
          }

          // Save chunk to vault temp folder so it can be cleaned up after OCR
          const tempPath = await this.saveChunkToVault(
            OCR_TEMP_FOLDER,
            baseName,
            i,
            chunkBuffer
          );
          tempChunkPaths.push(tempPath);

          // OCR this chunk.
          // Use uint8ArrayToBase64 directly on the Uint8Array returned by pdf-lib
          // instead of going through `chunkBuffer.buffer.slice(byteOffset, ...)`.
          // When pdf-lib (or its Wasm/Node allocator) returns a Uint8Array that is a
          // *view* into a larger pooled buffer, `buffer.slice` still works correctly
          // but is unnecessarily indirect; iterating the view itself is simpler and
          // guaranteed to encode only the actual PDF bytes.
          const base64 = uint8ArrayToBase64(chunkBuffer);
          const chunkFileNameForOcr = `${baseName}_chunk_${i + 1}.pdf`;

          logger.info("pdf_ocr: OCR-ing chunk", {
            chunkIndex: i,
            totalChunks,
            startPage: startPage + 1,
            endPage: endPage + 1,
            chunkKb: Math.round(chunkBuffer.byteLength / 1024),
          });

          let ocrText: string;
          try {
            ocrText = await this.callOcr(base64, chunkFileNameForOcr, model, apiKey, stripImages);
          } catch (chunkErr) {
            // Record the failure but continue with remaining chunks so the caller
            // receives partial results rather than nothing.
            const msg = chunkErr instanceof Error ? chunkErr.message : String(chunkErr);
            logger.warn("pdf_ocr: OCR failed for chunk – skipping", {
              chunkIndex: i,
              startPage: startPage + 1,
              endPage: endPage + 1,
              error: msg,
            });
            chunkErrors.push(
              `Part ${i + 1} (pages ${startPage + 1}–${endPage + 1}): ${msg}`
            );
            continue;
          }

          const mdPath = `${outputBase}_part_${i + 1}.md`;
          await this.writeMarkdown(mdPath, ocrText);
          createdFiles.push(mdPath);
        }

        // If every chunk failed there is nothing useful to return.
        if (createdFiles.length === 0 && chunkErrors.length > 0) {
          throw new Error(
            `OCR failed for all ${totalChunks} part(s). ` +
            `Errors:\n${chunkErrors.join("\n")}`
          );
        }
      }

      const resultData: Record<string, unknown> = {
        files: createdFiles,
        totalFiles: createdFiles.length,
        ...(chunkErrors.length > 0 && { failedParts: chunkErrors }),
      };

      return {
        success: true,
        data: resultData,
        log: [buildLogEntry(this.name, ctx.parameters, resultData)],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("pdf_ocr tool error", { error: message, pdfPath });
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
   * The OpenRouter docs always show the text instruction BEFORE the file item. All models
   * require an explicit instruction alongside the file; without it the model returns an
   * empty response.
   */
  private async callOcr(
    base64: string,
    filename: string,
    model: string,
    apiKey: string,
    stripImages = true,
  ): Promise<string> {
    if (!base64 || base64.length === 0) {
      throw new Error(
        `Cannot perform OCR on "${filename}": the PDF could not be read or is empty. ` +
        `Please check that the file exists in the vault and is a valid, non-empty PDF.`
      );
    }

    const estimatedKb = Math.round((base64.length * 3) / 4 / 1024); // base64 is ~4/3× the original binary size
    logger.info("pdf_ocr: sending file to OpenRouter for OCR", { filename, estimatedKb });

    const dataUrl = `data:application/pdf;base64,${base64}`;

    // The instruction tells the model what to extract.
    // When stripImages is enabled we explicitly ask for text only so that models
    // that echo image placeholders back as text omit them as well.
    const instructionText = stripImages
      ? "Extract and return only the text content of this document. " +
        "Do not include images, image placeholders, or descriptions of images. " +
        "Preserve the original text structure and formatting as faithfully as possible."
      : "Extract and return the complete text content of this document. " +
        "Preserve the original structure and formatting as faithfully as possible.";

    // The OpenRouter docs always place the text instruction BEFORE the file item.
    // All models require an explicit instruction; without it the model returns an empty response.
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
        text: instructionText,
      },
      fileItem,
    ];

    // When stripping images, pass include_image_base64: false to the mistral-ocr engine.
    // This prevents the OCR engine from embedding base64 image data in its response,
    // which would otherwise result in large data-URL strings in the Markdown output.
    const pdfPluginOptions: Record<string, unknown> = { engine: "mistral-ocr" };
    if (stripImages) {
      pdfPluginOptions["include_image_base64"] = false;
    }

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
          pdf: pdfPluginOptions,
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
      // Try to extract a structured error message from the JSON response body.
      // OpenRouter returns { error: { message: string, code: number } } for most errors.
      let errorDetail = response.text || "(no body)";
      try {
        const errJson = response.json as { error?: { message?: string; code?: number } };
        if (errJson?.error?.message) {
          const code = errJson.error.code != null ? ` (code: ${errJson.error.code})` : "";
          errorDetail = `${errJson.error.message}${code}`;
        }
      } catch {
        // response.json is not valid JSON – fall back to the raw text.
      }
      throw new Error(
        `OCR API error: HTTP ${response.status} — ${errorDetail}`
      );
    }

    let data: { choices?: Array<{ message?: { content?: string | null } }> };
    try {
      data = response.json as typeof data;
    } catch {
      throw new Error(
        `OCR response from OpenRouter could not be parsed as JSON. ` +
        `Raw response (first 200 chars): ${response.text?.slice(0, 200) ?? "(empty)"}`
      );
    }
    const content = data.choices?.[0]?.message?.content;
    if (content == null || content === "") {
      throw new Error(
        `OCR returned empty content from OpenRouter. ` +
        `The PDF may be encrypted, contain only images without recognizable text, ` +
        `be in an unsupported format, or the model "${model}" may not support PDF extraction ` +
        `via the file-parser plugin. See https://openrouter.ai/models for compatible models.`
      );
    }

    return stripImages ? stripMarkdownImages(content) : content;
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
      "By default, image data is stripped from the output so that only text is forwarded to the LLM " +
      "(set stripImages: false to keep images). " +
      "Input: pdfPath (required), model (required — specify an OpenRouter model, see https://openrouter.ai/models), " +
      "outputPath (optional), stripImages (optional, default true). " +
      "The file-parser plugin with the mistral-ocr engine is used for PDF text extraction regardless of the chosen model. " +
      "Output: list of created Markdown file paths.",
    parameters: PDF_OCR_PARAMS,
    create(app?: App): IExecutableTool {
      if (!app) throw new Error("PdfOcrTool requires App instance");
      return new PdfOcrTool(app, getApiKey);
    },
  };
}
