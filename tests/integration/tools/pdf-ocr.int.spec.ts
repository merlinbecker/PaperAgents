import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as Obsidian from "obsidian";
import { app, TFile, Vault, Platform } from "obsidian";
import * as pdfLibActual from "pdf-lib";
import { createPdfOcrFactory, removeInlineImagesFromStreamBytes } from "../../../src/tools/pdf-ocr";
import type { ExecutionContext, IExecutableTool } from "../../../src/types";

/** Wrap plain parameters into a minimal ExecutionContext. */
const makeCtx = (params: Record<string, unknown>): ExecutionContext =>
  ({ parameters: params } as unknown as ExecutionContext);

/** Toggle the Platform mock between mobile and desktop. */
function setPlatformMobile(isMobile: boolean): void {
  (Platform as any).isMobile = isMobile;
}

/**
 * Stub pdf-lib's PDFDocument so that the pre-OCR image-stripping step
 * (PDFDocument.load → stripImageXObjects → save) is a safe no-op.
 *
 * Call this whenever the vault's readBinary mock returns non-PDF bytes (e.g. a
 * fake ArrayBuffer).  Spreading pdfLibActual keeps PDFName/PDFDict/PDFRef/PDFStream
 * available to the stripImageXObjects helper inside the tool.
 */
function mockPdfLibForSingleFile(): void {
  vi.doMock("pdf-lib", () => ({
    ...pdfLibActual,
    PDFDocument: {
      load: vi.fn().mockResolvedValue({
        getPages: vi.fn().mockReturnValue([]),
        save: vi.fn().mockResolvedValue(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])),
      }),
    },
  }));
}

/**
 * Set up vault mocks for a single small PDF on desktop.
 * Mocks getAbstractFileByPath, readBinary, and create so that success-path
 * tests require no per-test boilerplate.
 *
 * Also mocks pdf-lib's PDFDocument so that the image-stripping step
 * (PDFDocument.load → stripImageXObjects → save) is a safe no-op with no
 * real PDF bytes required.
 */
function setupSmallPdf(pdfPath = "doc.pdf"): void {
  vi.spyOn(app.vault, "getAbstractFileByPath").mockReturnValue(
    new TFile(pdfPath, 50) as any
  );
  vi.spyOn(app.vault, "readBinary").mockResolvedValue(new ArrayBuffer(50) as any);
  vi.spyOn(app.vault, "create").mockResolvedValue(
    new TFile(pdfPath.replace(".pdf", ".md"), 0) as any
  );
  mockPdfLibForSingleFile();
}

/** Fake a successful OCR API response. */
function mockOcrSuccess(content: string) {
  return vi.spyOn(Obsidian, "requestUrl").mockResolvedValue({
    status: 200,
    json: { choices: [{ message: { content } }] },
    text: "",
  } as any);
}

/** Fake an OCR API response that returns null content (empty extraction). */
function mockOcrEmptyContent() {
  return vi.spyOn(Obsidian, "requestUrl").mockResolvedValue({
    status: 200,
    json: { choices: [{ message: { content: null } }] },
    text: "",
  } as any);
}

describe("pdf_ocr tool", () => {
  let apiKeyValue = "sk-or-test-key";
  let tool: IExecutableTool;

  beforeEach(() => {
    (app as any).vault = new Vault();
    setPlatformMobile(false);
    const factory = createPdfOcrFactory(() => apiKeyValue);
    tool = factory.create(app);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setPlatformMobile(false);
    vi.doUnmock("pdf-lib");
  });

  // ── API key validation ──────────────────────────────────────────────────────

  it("returns error when API key is not configured", async () => {
    const factory = createPdfOcrFactory(() => "");
    const t = factory.create(app);
    const res = await t.execute(makeCtx({ pdfPath: "test.pdf", model: "google/gemini-2.0-flash-001" }));
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/API key/i);
  });

  // ── Model validation ────────────────────────────────────────────────────────

  it("returns error when model parameter is not provided", async () => {
    const res = await tool.execute(makeCtx({ pdfPath: "test.pdf" }));
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/model.*required/i);
  });

  // ── File-not-found errors ───────────────────────────────────────────────────

  it("returns error when PDF file does not exist in vault", async () => {
    const res = await tool.execute(makeCtx({ pdfPath: "nonexistent.pdf", model: "google/gemini-2.0-flash-001" }));
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/not found/i);
  });

  // ── Desktop single-file OCR ─────────────────────────────────────────────────

  it("calls OCR API and saves a single Markdown file for a small PDF on desktop", async () => {
    mockPdfLibForSingleFile();
    vi.spyOn(app.vault, "getAbstractFileByPath").mockImplementation((p: string) => {
      // Only return a file for the PDF path; output .md doesn't exist yet
      if (p === "papers/article.pdf") return new TFile("papers/article.pdf", 100) as any;
      return null;
    });
    vi.spyOn(app.vault, "readBinary").mockResolvedValue(new ArrayBuffer(100) as any);
    const createSpy = vi.spyOn(app.vault, "create").mockResolvedValue(
      new TFile("papers/article.md", 0) as any
    );
    const requestSpy = mockOcrSuccess("# OCR Result\n\nSome text");

    const res = await tool.execute(makeCtx({ pdfPath: "papers/article.pdf", model: "google/gemini-2.0-flash-001" }));

    expect(res.success).toBe(true);
    const data = res.data as { files: string[]; totalFiles: number };
    expect(data.files).toHaveLength(1);
    expect(data.files[0]).toBe("papers/article.md");
    expect(data.totalFiles).toBe(1);

    // Verify OpenRouter was called with file-parser plugin
    expect(requestSpy).toHaveBeenCalledTimes(1);
    const callBody = JSON.parse(requestSpy.mock.calls[0][0].body);
    expect(callBody.plugins).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "file-parser" })])
    );
    expect(callBody.model).toBe("google/gemini-2.0-flash-001");
    expect(callBody.messages[0].content[0].type).toBe("text");
    expect(callBody.messages[0].content[1].type).toBe("file");

    // Verify the PDF is sent as a base64-encoded data URL (not empty, not redacted)
    const fileItem = callBody.messages[0].content[1] as { type: string; file: { filename: string; file_data: string } };
    expect(fileItem.file.filename).toBe("article.pdf");
    expect(fileItem.file.file_data).toMatch(/^data:application\/pdf;base64,[A-Za-z0-9+/]+=*$/);

    // Verify markdown was saved
    expect(createSpy).toHaveBeenCalledWith("papers/article.md", "# OCR Result\n\nSome text");
  });

  it("uses the specified model parameter", async () => {
    setupSmallPdf();
    const requestSpy = mockOcrSuccess("text");

    await tool.execute(makeCtx({ pdfPath: "doc.pdf", model: "custom/model-v1" }));

    const callBody = JSON.parse(requestSpy.mock.calls[0][0].body);
    expect(callBody.model).toBe("custom/model-v1");
  });

  it.each([
    ["google/gemini-2.0-flash-001"],
    ["mistralai/ministral-14b-instruct"],
  ])(
    "uses mistral-ocr engine and includes text instruction before the file item (%s)",
    async (model) => {
      setupSmallPdf();
      const requestSpy = mockOcrSuccess("ocr text");

      await tool.execute(makeCtx({ pdfPath: "doc.pdf", model }));

      const callBody = JSON.parse(requestSpy.mock.calls[0][0].body);
      const plugin = callBody.plugins.find((p: { id: string }) => p.id === "file-parser");
      // engine is always mistral-ocr regardless of which model is chosen
      expect(plugin?.pdf?.engine).toBe("mistral-ocr");
      // Text instruction BEFORE the file item is required for all models per OpenRouter docs
      const content = callBody.messages[0].content;
      expect(content).toHaveLength(2);
      expect(content[0].type).toBe("text");
      expect((content[0] as { type: string; text: string }).text).toMatch(/extract.*text/i);
      expect(content[1].type).toBe("file");
    }
  );

  it("error message includes model name and helpful hint when content is empty", async () => {
    setupSmallPdf();
    mockOcrEmptyContent();

    const res = await tool.execute(
      makeCtx({ pdfPath: "doc.pdf", model: "mistralai/ministral-14b-instruct" })
    );

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/empty content/i);
    expect(res.error).toMatch(/mistralai\/ministral-14b-instruct/);
  });

  it("uses outputPath when provided", async () => {
    setupSmallPdf("input.pdf");
    mockOcrSuccess("content");

    const res = await tool.execute(
      makeCtx({ pdfPath: "input.pdf", outputPath: "output/result", model: "google/gemini-2.0-flash-001" })
    );

    expect(res.success).toBe(true);
    const data = res.data as { files: string[] };
    expect(data.files[0]).toBe("output/result.md");
  });

  // ── API errors ──────────────────────────────────────────────────────────────

  it("returns error when OCR API returns non-2xx status", async () => {
    setupSmallPdf();
    vi.spyOn(Obsidian, "requestUrl").mockResolvedValue({
      status: 500,
      text: "Internal Server Error",
      json: {},
    } as any);

    const res = await tool.execute(makeCtx({ pdfPath: "doc.pdf", model: "google/gemini-2.0-flash-001" }));

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/OCR API error/i);
    expect(res.error).toMatch(/500/);
  });

  it("returns error when OCR API returns empty content", async () => {
    setupSmallPdf();
    mockOcrEmptyContent();

    const res = await tool.execute(makeCtx({ pdfPath: "doc.pdf", model: "google/gemini-2.0-flash-001" }));

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/empty content/i);
  });

  it("returns error when the PDF binary data is empty (zero-length file)", async () => {
    vi.spyOn(app.vault, "getAbstractFileByPath").mockReturnValue(
      new TFile("empty.pdf", 0) as any
    );
    vi.spyOn(app.vault, "readBinary").mockResolvedValue(new ArrayBuffer(0) as any);
    vi.spyOn(Obsidian, "requestUrl"); // should NOT be called

    const res = await tool.execute(makeCtx({ pdfPath: "empty.pdf", model: "google/gemini-2.0-flash-001" }));

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/empty/i);
    expect(res.error).toMatch(/valid.*non-empty PDF/i);
    // The API must not be called when there is no data to send
    expect(Obsidian.requestUrl).not.toHaveBeenCalled();
  });

  // ── Mobile large PDF – multi-chunk path ────────────────────────────────────

  /** Build a minimal valid mock PDF Uint8Array starting with the required %PDF- header. */
  function mockValidPdfBytes(): Uint8Array {
    const header = new TextEncoder().encode("%PDF-1.4\n");
    const buf = new Uint8Array(100); // 100 bytes total; only the header matters for validation
    buf.set(header);
    return buf;
  }

  /**
   * Set up vault and platform mocks for a 25 MB mobile PDF (25 MB > 20 MB threshold).
   * With 4 pages and TARGET_CHUNK_SIZE = 5 MB this yields 4 chunks of 1 page each.
   * Also stubs createBinary and delete for the temp-chunk lifecycle.
   */
  function setupLargeMobilePdf(): void {
    setPlatformMobile(true);
    const fakePdfSize = 25 * 1024 * 1024;
    vi.spyOn(app.vault, "getAbstractFileByPath").mockImplementation((p: string) => {
      if (p === "big.pdf") return new TFile("big.pdf", fakePdfSize) as any;
      return null;
    });
    vi.spyOn(app.vault, "readBinary").mockResolvedValue(new ArrayBuffer(8) as any);
    (app.vault as any).createBinary = vi.fn().mockResolvedValue(
      new TFile("_ocr_tmp/big_chunk_1.pdf", 100) as any
    );
    vi.spyOn(app.vault, "delete" as any).mockResolvedValue(undefined);
  }

  /**
   * Mock the pdf-lib module so each chunk's save() returns the given `saveResult`.
   * The mocked document has 4 pages (matches the 25 MB / 5 MB chunk math).
   * Returns the `mockSave` spy for per-test assertions.
   *
   * Spreads pdfLibActual so that PDFName/PDFDict/PDFRef/PDFStream remain available
   * to the stripImageXObjects helper inside the tool.  getPages() on the source
   * doc returns [] so the strip step is a safe no-op.
   */
  function setupPdfLibMock(saveResult: Uint8Array = mockValidPdfBytes()): ReturnType<typeof vi.fn> {
    const mockSave = vi.fn().mockResolvedValue(saveResult);
    const mockCopyPages = vi.fn().mockResolvedValue([{}]);
    const mockChunkDoc = {
      copyPages: mockCopyPages,
      addPage: vi.fn(),
      save: mockSave,
      getPages: vi.fn().mockReturnValue([]),
    };
    vi.doMock("pdf-lib", () => ({
      ...pdfLibActual,
      PDFDocument: {
        load: vi.fn().mockResolvedValue({
          getPageCount: vi.fn().mockReturnValue(4),
          copyPages: mockCopyPages,
          getPages: vi.fn().mockReturnValue([]), // stripImageXObjects iterates pages; [] = no-op
        }),
        create: vi.fn().mockResolvedValue(mockChunkDoc),
      },
    }));
    return mockSave;
  }

  it("splits large PDFs on mobile and produces multiple Markdown part files", async () => {
    setupLargeMobilePdf();
    // Simulate a 25 MB PDF on mobile (> 20 MB limit)
    // TARGET_CHUNK_SIZE = 5 MB → ceil(25/5)=5 groups → pagesPerChunk=ceil(4/5)=1 → totalChunks=4
    const mockSave = setupPdfLibMock();
    const requestSpy = mockOcrSuccess("# Part content");
    const createSpy = vi.spyOn(app.vault, "create").mockResolvedValue(
      new TFile("big_part_1.md", 0) as any
    );

    const res = await tool.execute(makeCtx({ pdfPath: "big.pdf", model: "google/gemini-2.0-flash-001" }));

    expect(res.success).toBe(true);
    const data = res.data as { files: string[]; totalFiles: number; failedParts?: string[] };
    // 25 MB / 5 MB TARGET_CHUNK_SIZE → ceil(25/5)=5 groups, 4 pages / ceil(4/5)=1 ppc → 4 chunks
    expect(data.totalFiles).toBe(4);
    expect(data.files[0]).toBe("big_part_1.md");
    expect(data.files[3]).toBe("big_part_4.md");
    // No failures expected
    expect(data.failedParts).toBeUndefined();

    // OCR should have been called once per chunk
    expect(requestSpy).toHaveBeenCalledTimes(4);

    // Markdown files should have been saved
    expect(createSpy).toHaveBeenCalledTimes(4);

    // Verify that save() was called with useObjectStreams: false for maximum OCR compatibility
    expect(mockSave).toHaveBeenCalledWith({ useObjectStreams: false });
  });

  it("returns partial results when some chunks fail OCR and others succeed", async () => {
    setupLargeMobilePdf();
    setupPdfLibMock();

    // Chunks 0 and 2 succeed; chunks 1 and 3 return empty content (simulating OCR failure).
    let callCount = 0;
    vi.spyOn(Obsidian, "requestUrl").mockImplementation(async () => {
      const n = callCount++;
      const content = n % 2 === 0 ? "# Text" : null; // even chunks succeed, odd chunks fail
      return { status: 200, json: { choices: [{ message: { content } }] }, text: "" } as any;
    });
    const createSpy = vi.spyOn(app.vault, "create").mockResolvedValue(
      new TFile("big_part_1.md", 0) as any
    );

    const res = await tool.execute(makeCtx({ pdfPath: "big.pdf", model: "google/gemini-2.0-flash-001" }));

    // Operation should still succeed with partial results (parts 1 and 3 succeeded; parts 2 and 4 failed)
    expect(res.success).toBe(true);
    const data = res.data as { files: string[]; totalFiles: number; failedParts: string[] };
    expect(data.totalFiles).toBe(2);
    expect(data.files).toHaveLength(2);
    expect(data.files[0]).toBe("big_part_1.md");
    expect(data.files[1]).toBe("big_part_3.md");

    // Failed parts should be reported in the result
    expect(data.failedParts).toHaveLength(2);
    expect(data.failedParts[0]).toMatch(/Part 2/);
    expect(data.failedParts[1]).toMatch(/Part 4/);

    // Markdown was saved only for the two successful chunks
    expect(createSpy).toHaveBeenCalledTimes(2);
  });

  it("returns error when all chunks fail OCR", async () => {
    setupLargeMobilePdf();
    setupPdfLibMock();
    mockOcrEmptyContent();

    const res = await tool.execute(makeCtx({ pdfPath: "big.pdf", model: "google/gemini-2.0-flash-001" }));

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/OCR failed for all 4 part/i);
  });

  it("returns error when a chunk PDF produced by pdf-lib is missing the PDF header", async () => {
    setupLargeMobilePdf();
    // save() returns bytes that do NOT start with "%PDF-" – simulates a corrupt/invalid chunk
    setupPdfLibMock(new Uint8Array(100)); // all zeros, no PDF header

    const res = await tool.execute(makeCtx({ pdfPath: "big.pdf", model: "google/gemini-2.0-flash-001" }));

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/did not produce a valid PDF/i);
    // Error message should tell the user which chunk failed
    expect(res.error).toMatch(/Chunk 1/);
  });

  // ── HITL ──────────────────────────────────────────────────────────────────

  it("shouldRequireHITL returns false", () => {
    expect(tool.shouldRequireHITL({})).toBe(false);
  });

  // ── Factory ────────────────────────────────────────────────────────────────

  it("factory create throws when App is not provided", () => {
    const factory = createPdfOcrFactory(() => "sk-or-test");
    expect(() => factory.create(undefined)).toThrow("PdfOcrTool requires App instance");
  });

  // ── stripImages (image removal) ────────────────────────────────────────────

  it("strips Markdown image syntax from OCR output by default (stripImages not set)", async () => {
    setupSmallPdf("doc.pdf");
    // OCR returns text that contains an inline image and a base64 data URL image
    const ocrWithImages =
      "# Title\n\n" +
      "Some text before.\n\n" +
      "![Figure 1](https://example.com/figure1.png)\n\n" +
      "Some text after.\n\n" +
      "![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA)\n\n" +
      "More text.";
    mockOcrSuccess(ocrWithImages);
    const modifySpy = vi.spyOn(app.vault, "modify").mockResolvedValue(undefined as any);

    const res = await tool.execute(makeCtx({ pdfPath: "doc.pdf", model: "google/gemini-2.0-flash-001" }));

    expect(res.success).toBe(true);
    const savedContent = (modifySpy.mock.calls[0][1] as string);
    // Images should be removed
    expect(savedContent).not.toMatch(/!\[/);
    expect(savedContent).not.toMatch(/Figure 1/);
    expect(savedContent).not.toMatch(/data:image/);
    // Text content should be preserved
    expect(savedContent).toContain("Title");
    expect(savedContent).toContain("Some text before.");
    expect(savedContent).toContain("Some text after.");
    expect(savedContent).toContain("More text.");
  });

  it("strips images when stripImages is explicitly true", async () => {
    setupSmallPdf("doc.pdf");
    const ocrWithImage = "Text before.\n\n![alt](https://img.example.com/photo.jpg)\n\nText after.";
    const requestSpy = mockOcrSuccess(ocrWithImage);
    const modifySpy = vi.spyOn(app.vault, "modify").mockResolvedValue(undefined as any);

    const res = await tool.execute(
      makeCtx({ pdfPath: "doc.pdf", model: "google/gemini-2.0-flash-001", stripImages: true })
    );

    expect(res.success).toBe(true);
    const savedContent = (modifySpy.mock.calls[0][1] as string);
    expect(savedContent).not.toMatch(/!\[/);
    expect(savedContent).toContain("Text before.");
    expect(savedContent).toContain("Text after.");

    // Verify include_image_base64: false was sent to the API
    const callBody = JSON.parse(requestSpy.mock.calls[0][0].body);
    const plugin = callBody.plugins.find((p: { id: string }) => p.id === "file-parser");
    expect(plugin?.pdf?.include_image_base64).toBe(false);
  });

  it("keeps images in OCR output when stripImages is false", async () => {
    setupSmallPdf("doc.pdf");
    const ocrWithImage = "Text.\n\n![Figure 1](https://example.com/fig.png)\n\nEnd.";
    const requestSpy = mockOcrSuccess(ocrWithImage);
    const modifySpy = vi.spyOn(app.vault, "modify").mockResolvedValue(undefined as any);

    const res = await tool.execute(
      makeCtx({ pdfPath: "doc.pdf", model: "google/gemini-2.0-flash-001", stripImages: false })
    );

    expect(res.success).toBe(true);
    const savedContent = (modifySpy.mock.calls[0][1] as string);
    // Image reference should be preserved
    expect(savedContent).toContain("![Figure 1]");
    expect(savedContent).toContain("https://example.com/fig.png");

    // include_image_base64 should NOT be present when stripImages is false
    const callBody = JSON.parse(requestSpy.mock.calls[0][0].body);
    const plugin = callBody.plugins.find((p: { id: string }) => p.id === "file-parser");
    expect(plugin?.pdf?.include_image_base64).toBeUndefined();
  });

  /** Extract the instruction text from a captured requestUrl call body. */
  function getInstructionText(requestSpy: ReturnType<typeof vi.fn>, callIndex = 0): string {
    const callBody = JSON.parse(requestSpy.mock.calls[callIndex][0].body);
    return (callBody.messages[0].content[0] as { type: string; text: string }).text;
  }

  it("uses image-free OCR instruction when stripping images (default)", async () => {
    setupSmallPdf("doc.pdf");
    const requestSpy = mockOcrSuccess("text only");
    vi.spyOn(app.vault, "create").mockResolvedValue(new TFile("doc.md", 0) as any);

    await tool.execute(makeCtx({ pdfPath: "doc.pdf", model: "google/gemini-2.0-flash-001" }));

    const instructionText = getInstructionText(requestSpy);
    expect(instructionText).toMatch(/only.*text|text.*only/i);
    expect(instructionText).toMatch(/do not include images/i);
  });

  it("uses full-content OCR instruction when stripImages is false", async () => {
    setupSmallPdf("doc.pdf");
    const requestSpy = mockOcrSuccess("full content");
    vi.spyOn(app.vault, "create").mockResolvedValue(new TFile("doc.md", 0) as any);

    await tool.execute(
      makeCtx({ pdfPath: "doc.pdf", model: "google/gemini-2.0-flash-001", stripImages: false })
    );

    const instructionText = getInstructionText(requestSpy);
    expect(instructionText).toMatch(/complete text content/i);
    expect(instructionText).not.toMatch(/do not include images/i);
  });

  it("calls PDFDocument.load and stripImageXObjects before encoding when stripImages is true (default)", async () => {
    // Verify the pre-OCR pdf-lib strip path: PDFDocument.load must be called so
    // that stripImageXObjects can remove image XObjects before encoding.
    const mockLoad = vi.fn().mockResolvedValue({
      getPages: vi.fn().mockReturnValue([]),
      save: vi.fn().mockResolvedValue(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])),
    });
    vi.doMock("pdf-lib", () => ({
      ...pdfLibActual,
      PDFDocument: { load: mockLoad },
    }));

    vi.spyOn(app.vault, "getAbstractFileByPath").mockReturnValue(
      new TFile("paper.pdf", 200) as any
    );
    vi.spyOn(app.vault, "readBinary").mockResolvedValue(new ArrayBuffer(200) as any);
    mockOcrSuccess("text content");
    vi.spyOn(app.vault, "create").mockResolvedValue(new TFile("paper.md", 0) as any);

    const res = await tool.execute(
      makeCtx({ pdfPath: "paper.pdf", model: "google/gemini-2.0-flash-001" })
    );

    expect(res.success).toBe(true);
    // PDFDocument.load must have been called (pre-OCR strip step)
    expect(mockLoad).toHaveBeenCalledTimes(1);
  });

  it("skips PDFDocument.load when stripImages is false", async () => {
    const mockLoad = vi.fn();
    vi.doMock("pdf-lib", () => ({
      ...pdfLibActual,
      PDFDocument: { load: mockLoad },
    }));

    setupSmallPdf("paper.pdf");
    mockOcrSuccess("text content");
    vi.spyOn(app.vault, "create").mockResolvedValue(new TFile("paper.md", 0) as any);

    const res = await tool.execute(
      makeCtx({ pdfPath: "paper.pdf", model: "google/gemini-2.0-flash-001", stripImages: false })
    );

    expect(res.success).toBe(true);
    // PDFDocument.load must NOT be called in the single-file strip path
    expect(mockLoad).not.toHaveBeenCalled();
  });

  // ── HTML img tag stripping ─────────────────────────────────────────────────

  it("strips HTML img tags from OCR output when stripImages is true", async () => {
    setupSmallPdf("doc.pdf");
    const ocrWithHtmlImg =
      "Text before.\n\n" +
      '<img src="data:image/png;base64,iVBORw0KGgo=" />\n\n' +
      "Text after.\n\n" +
      '<img src="https://example.com/figure.png" alt="Figure 1">\n\n' +
      "More text.";
    mockOcrSuccess(ocrWithHtmlImg);
    const modifySpy = vi.spyOn(app.vault, "modify").mockResolvedValue(undefined as any);

    const res = await tool.execute(makeCtx({ pdfPath: "doc.pdf", model: "google/gemini-2.0-flash-001" }));

    expect(res.success).toBe(true);
    const savedContent = modifySpy.mock.calls[0]?.[1] as string;
    // HTML img tags should be removed
    expect(savedContent).not.toMatch(/<img/i);
    expect(savedContent).not.toMatch(/data:image/);
    expect(savedContent).not.toMatch(/figure\.png/);
    // Text content should be preserved
    expect(savedContent).toContain("Text before.");
    expect(savedContent).toContain("Text after.");
    expect(savedContent).toContain("More text.");
  });

  it("keeps HTML img tags when stripImages is false", async () => {
    setupSmallPdf("doc.pdf");
    const ocrWithHtmlImg = 'Text.\n\n<img src="https://example.com/img.png" alt="Figure">\n\nEnd.';
    mockOcrSuccess(ocrWithHtmlImg);
    const modifySpy = vi.spyOn(app.vault, "modify").mockResolvedValue(undefined as any);

    const res = await tool.execute(
      makeCtx({ pdfPath: "doc.pdf", model: "google/gemini-2.0-flash-001", stripImages: false })
    );

    expect(res.success).toBe(true);
    const savedContent = modifySpy.mock.calls[0]?.[1] as string;
    expect(savedContent).toContain('<img src="https://example.com/img.png"');
  });

  // ── Improved API error response parsing ───────────────────────────────────

  it("extracts error.message from JSON error body for a non-2xx response", async () => {
    setupSmallPdf();
    vi.spyOn(Obsidian, "requestUrl").mockResolvedValue({
      status: 402,
      text: '{"error":{"message":"Your credit balance is too low to complete this request.","code":402}}',
      json: { error: { message: "Your credit balance is too low to complete this request.", code: 402 } },
    } as any);

    const res = await tool.execute(makeCtx({ pdfPath: "doc.pdf", model: "google/gemini-2.0-flash-001" }));

    expect(res.success).toBe(false);
    expect(res.error).toContain("Your credit balance is too low");
    expect(res.error).toMatch(/HTTP 402/);
    // Error code from the JSON body should be included
    expect(res.error).toContain("code: 402");
  });

  it("falls back to raw text when error body is not JSON", async () => {
    setupSmallPdf();
    vi.spyOn(Obsidian, "requestUrl").mockResolvedValue({
      status: 503,
      text: "Service Unavailable",
      get json() { throw new Error("Not JSON"); },
    } as any);

    const res = await tool.execute(makeCtx({ pdfPath: "doc.pdf", model: "google/gemini-2.0-flash-001" }));

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/HTTP 503/);
    expect(res.error).toContain("Service Unavailable");
  });

  it("returns a descriptive error when the success response body is not JSON", async () => {
    setupSmallPdf();
    vi.spyOn(Obsidian, "requestUrl").mockResolvedValue({
      status: 200,
      text: "not-json-response",
      get json() { throw new Error("Not JSON"); },
    } as any);

    const res = await tool.execute(makeCtx({ pdfPath: "doc.pdf", model: "google/gemini-2.0-flash-001" }));

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/could not be parsed as JSON/i);
    expect(res.error).toContain("not-json-response");
  });
});

// ── removeInlineImagesFromStreamBytes unit tests ───────────────────────────

/** Build a Uint8Array from an ASCII/binary string (latin1 byte-for-byte). */
function strToBytes(s: string): Uint8Array {
  const buf = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) buf[i] = s.charCodeAt(i);
  return buf;
}

/** Convert a Uint8Array back to a latin1 string. */
function bytesToStr(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i] as number);
  return s;
}

describe("removeInlineImagesFromStreamBytes", () => {
  it("removes a simple inline image block from a content stream", () => {
    const input = strToBytes(
      "q\nBT /F1 12 Tf (Hello) Tj ET\n" +
      "BI /W 2 /H 2 /BPC 8 /CS /DeviceGray\nID\n\x80\x80\x80\x80\nEI\n" +
      "Q\n",
    );
    const output = removeInlineImagesFromStreamBytes(input);
    const text = bytesToStr(output);
    expect(text).not.toContain("BI");
    expect(text).not.toContain(" ID");
    expect(text).not.toContain("\nEI");
    expect(text).toContain("Hello");
    expect(text).toContain("q");
    expect(text).toContain("Q");
  });

  it("leaves a content stream without inline images unchanged", () => {
    const input = strToBytes("q\nBT /F1 12 Tf (Hello World) Tj ET\nQ\n");
    const output = removeInlineImagesFromStreamBytes(input);
    expect(output).toEqual(input);
  });

  it("removes multiple consecutive inline image blocks", () => {
    const input = strToBytes(
      "BI /W 1 /H 1 /BPC 8 /CS /DeviceGray\nID\n\xff\nEI\n" +
      "(Text)\n" +
      "BI /W 1 /H 1 /BPC 8 /CS /DeviceGray\nID\n\xfe\nEI\n",
    );
    const output = removeInlineImagesFromStreamBytes(input);
    const text = bytesToStr(output);
    expect(text).not.toMatch(/\bBI\b/);
    expect(text).toContain("Text");
  });

  it("does not treat 'BI' inside a text string as an inline image", () => {
    // The 'B' of 'BI' is preceded by '(' (not whitespace), so it must NOT be treated
    // as the start of an inline image block.
    const input = strToBytes("BT /F1 12 Tf (BI image description) Tj ET\n");
    const output = removeInlineImagesFromStreamBytes(input);
    expect(output).toEqual(input);
  });

  it("copies 'BI' bytes unchanged when no matching 'ID' is found", () => {
    // Lone 'BI' with whitespace but no 'ID' — should be copied as-is.
    const input = strToBytes("q\nBI \nsome content\nQ\n");
    const output = removeInlineImagesFromStreamBytes(input);
    expect(bytesToStr(output)).toContain("BI");
  });

  it("copies 'BI'/'ID' bytes unchanged when no matching 'EI' is found", () => {
    const input = strToBytes("q\nBI /W 1 /H 1\nID\n\xde\xad\n");
    const output = removeInlineImagesFromStreamBytes(input);
    // Without EI the scanner should fall back and copy 'B' then advance
    expect(bytesToStr(output)).toContain("BI");
  });

  it("handles an empty input without error", () => {
    expect(removeInlineImagesFromStreamBytes(new Uint8Array(0))).toEqual(new Uint8Array(0));
  });
});
