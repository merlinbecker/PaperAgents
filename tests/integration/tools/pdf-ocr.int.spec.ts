import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as Obsidian from "obsidian";
import { app, TFile, Vault, Platform } from "obsidian";
import { createPdfOcrFactory } from "../../../src/tools/pdf-ocr";
import type { ExecutionContext, IExecutableTool } from "../../../src/types";

/** Wrap plain parameters into a minimal ExecutionContext. */
const makeCtx = (params: Record<string, unknown>): ExecutionContext =>
  ({ parameters: params } as unknown as ExecutionContext);

/** Toggle the Platform mock between mobile and desktop. */
function setPlatformMobile(isMobile: boolean): void {
  (Platform as any).isMobile = isMobile;
}

/**
 * Set up vault mocks for a single small PDF on desktop.
 * Mocks getAbstractFileByPath, readBinary, and create so that success-path
 * tests require no per-test boilerplate.
 */
function setupSmallPdf(pdfPath = "doc.pdf"): void {
  vi.spyOn(app.vault, "getAbstractFileByPath").mockReturnValue(
    new TFile(pdfPath, 50) as any
  );
  vi.spyOn(app.vault, "readBinary").mockResolvedValue(new ArrayBuffer(50) as any);
  vi.spyOn(app.vault, "create").mockResolvedValue(
    new TFile(pdfPath.replace(".pdf", ".md"), 0) as any
  );
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

  it("splits large PDFs on mobile and produces multiple Markdown part files", async () => {
    setPlatformMobile(true);

    // Simulate a 25 MB PDF on mobile (> 20 MB limit)
    // TARGET_CHUNK_SIZE = 5 MB → ceil(25/5)=5 groups → pagesPerChunk=ceil(4/5)=1 → totalChunks=4
    const fakePdfSize = 25 * 1024 * 1024;
    vi.spyOn(app.vault, "getAbstractFileByPath").mockImplementation((p: string) => {
      if (p === "big.pdf") return new TFile("big.pdf", fakePdfSize) as any;
      return null;
    });
    vi.spyOn(app.vault, "readBinary").mockResolvedValue(new ArrayBuffer(8) as any);

    // Mock pdf-lib with 4 pages → pagesPerChunk=1 → totalChunks=4
    // save() must return a Uint8Array that starts with "%PDF-" so the validity check passes.
    const mockSave = vi.fn().mockResolvedValue(mockValidPdfBytes());
    const mockAddPage = vi.fn();
    const mockCopyPages = vi.fn().mockResolvedValue([{}]);
    const mockChunkDoc = { copyPages: mockCopyPages, addPage: mockAddPage, save: mockSave };
    const mockCreate = vi.fn().mockResolvedValue(mockChunkDoc);
    const mockLoad = vi.fn().mockResolvedValue({
      getPageCount: vi.fn().mockReturnValue(4),
      copyPages: mockCopyPages,
    });
    vi.doMock("pdf-lib", () => ({ PDFDocument: { load: mockLoad, create: mockCreate } }));

    // Mock createBinary for saving chunks to temp folder
    (app.vault as any).createBinary = vi.fn().mockResolvedValue(new TFile("_ocr_tmp/big_chunk_1.pdf", 100) as any);

    // Mock delete for cleanup
    vi.spyOn(app.vault, "delete" as any).mockResolvedValue(undefined);

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

    vi.doUnmock("pdf-lib");
  });

  it("returns partial results when some chunks fail OCR and others succeed", async () => {
    setPlatformMobile(true);

    const fakePdfSize = 25 * 1024 * 1024;
    vi.spyOn(app.vault, "getAbstractFileByPath").mockImplementation((p: string) => {
      if (p === "big.pdf") return new TFile("big.pdf", fakePdfSize) as any;
      return null;
    });
    vi.spyOn(app.vault, "readBinary").mockResolvedValue(new ArrayBuffer(8) as any);

    const mockSave = vi.fn().mockResolvedValue(mockValidPdfBytes());
    const mockCopyPages = vi.fn().mockResolvedValue([{}]);
    const mockChunkDoc = { copyPages: mockCopyPages, addPage: vi.fn(), save: mockSave };
    vi.doMock("pdf-lib", () => ({
      PDFDocument: {
        load: vi.fn().mockResolvedValue({ getPageCount: vi.fn().mockReturnValue(4), copyPages: mockCopyPages }),
        create: vi.fn().mockResolvedValue(mockChunkDoc),
      },
    }));

    (app.vault as any).createBinary = vi.fn().mockResolvedValue(new TFile("_ocr_tmp/big_chunk_1.pdf", 100) as any);
    vi.spyOn(app.vault, "delete" as any).mockResolvedValue(undefined);

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

    vi.doUnmock("pdf-lib");
  });

  it("returns error when all chunks fail OCR", async () => {
    setPlatformMobile(true);

    const fakePdfSize = 25 * 1024 * 1024;
    vi.spyOn(app.vault, "getAbstractFileByPath").mockImplementation((p: string) => {
      if (p === "big.pdf") return new TFile("big.pdf", fakePdfSize) as any;
      return null;
    });
    vi.spyOn(app.vault, "readBinary").mockResolvedValue(new ArrayBuffer(8) as any);

    const mockSave = vi.fn().mockResolvedValue(mockValidPdfBytes());
    const mockCopyPages = vi.fn().mockResolvedValue([{}]);
    const mockChunkDoc = { copyPages: mockCopyPages, addPage: vi.fn(), save: mockSave };
    vi.doMock("pdf-lib", () => ({
      PDFDocument: {
        load: vi.fn().mockResolvedValue({ getPageCount: vi.fn().mockReturnValue(4), copyPages: mockCopyPages }),
        create: vi.fn().mockResolvedValue(mockChunkDoc),
      },
    }));

    (app.vault as any).createBinary = vi.fn().mockResolvedValue(new TFile("_ocr_tmp/big_chunk_1.pdf", 100) as any);
    vi.spyOn(app.vault, "delete" as any).mockResolvedValue(undefined);

    // All chunks return null content → callOcr throws for each
    vi.spyOn(Obsidian, "requestUrl").mockResolvedValue({
      status: 200,
      json: { choices: [{ message: { content: null } }] },
      text: "",
    } as any);

    const res = await tool.execute(makeCtx({ pdfPath: "big.pdf", model: "google/gemini-2.0-flash-001" }));

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/OCR failed for all 4 part/i);

    vi.doUnmock("pdf-lib");
  });

  it("returns error when a chunk PDF produced by pdf-lib is missing the PDF header", async () => {
    setPlatformMobile(true);

    const fakePdfSize = 25 * 1024 * 1024;
    vi.spyOn(app.vault, "getAbstractFileByPath").mockImplementation((p: string) => {
      if (p === "big.pdf") return new TFile("big.pdf", fakePdfSize) as any;
      return null;
    });
    vi.spyOn(app.vault, "readBinary").mockResolvedValue(new ArrayBuffer(8) as any);

    // save() returns bytes that do NOT start with "%PDF-" – simulates a corrupt/invalid chunk
    const mockSave = vi.fn().mockResolvedValue(new Uint8Array(100)); // all zeros, no PDF header
    const mockCopyPages = vi.fn().mockResolvedValue([{}]);
    const mockChunkDoc = { copyPages: mockCopyPages, addPage: vi.fn(), save: mockSave };
    const mockCreate = vi.fn().mockResolvedValue(mockChunkDoc);
    const mockLoad = vi.fn().mockResolvedValue({
      getPageCount: vi.fn().mockReturnValue(4),
      copyPages: mockCopyPages,
    });
    vi.doMock("pdf-lib", () => ({ PDFDocument: { load: mockLoad, create: mockCreate } }));

    const res = await tool.execute(makeCtx({ pdfPath: "big.pdf", model: "google/gemini-2.0-flash-001" }));

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/did not produce a valid PDF/i);
    // Error message should tell the user which chunk failed
    expect(res.error).toMatch(/Chunk 1/);

    vi.doUnmock("pdf-lib");
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
});
