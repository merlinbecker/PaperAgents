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

/** Fake a successful OCR API response. */
function mockOcrSuccess(content: string) {
  return vi.spyOn(Obsidian, "requestUrl").mockResolvedValue({
    status: 200,
    json: { choices: [{ message: { content } }] },
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
    const res = await t.execute(makeCtx({ pdfPath: "test.pdf" }));
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/API key/i);
  });

  // ── File-not-found errors ───────────────────────────────────────────────────

  it("returns error when PDF file does not exist in vault", async () => {
    const res = await tool.execute(makeCtx({ pdfPath: "nonexistent.pdf" }));
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/not found/i);
  });

  // ── Desktop single-file OCR ─────────────────────────────────────────────────

  it("calls OCR API and saves a single Markdown file for a small PDF on desktop", async () => {
    setPlatformMobile(false);
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

    const res = await tool.execute(makeCtx({ pdfPath: "papers/article.pdf" }));

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
    expect(callBody.model).toBe("mistralai/mistral-ocr-latest");
    expect(callBody.messages[0].content[0].type).toBe("file");

    // Verify markdown was saved
    expect(createSpy).toHaveBeenCalledWith("papers/article.md", "# OCR Result\n\nSome text");
  });

  it("uses the specified model parameter", async () => {
    setPlatformMobile(false);
    vi.spyOn(app.vault, "getAbstractFileByPath").mockReturnValue(
      new TFile("doc.pdf", 50) as any
    );
    vi.spyOn(app.vault, "readBinary").mockResolvedValue(new ArrayBuffer(50) as any);
    vi.spyOn(app.vault, "create").mockResolvedValue(new TFile("doc.md", 0) as any);
    const requestSpy = mockOcrSuccess("text");

    await tool.execute(makeCtx({ pdfPath: "doc.pdf", model: "custom/model-v1" }));

    const callBody = JSON.parse(requestSpy.mock.calls[0][0].body);
    expect(callBody.model).toBe("custom/model-v1");
  });

  it("uses mistral-ocr engine and no text prompt for the default OCR model", async () => {
    setPlatformMobile(false);
    vi.spyOn(app.vault, "getAbstractFileByPath").mockReturnValue(
      new TFile("doc.pdf", 50) as any
    );
    vi.spyOn(app.vault, "readBinary").mockResolvedValue(new ArrayBuffer(50) as any);
    vi.spyOn(app.vault, "create").mockResolvedValue(new TFile("doc.md", 0) as any);
    const requestSpy = mockOcrSuccess("ocr text");

    // Default model contains "mistral-ocr" → should use mistral-ocr engine
    await tool.execute(makeCtx({ pdfPath: "doc.pdf" }));

    const callBody = JSON.parse(requestSpy.mock.calls[0][0].body);
    const plugin = callBody.plugins.find((p: { id: string }) => p.id === "file-parser");
    expect(plugin?.pdf?.engine).toBe("mistral-ocr");
    // No extra text instruction for OCR-native models
    const content = callBody.messages[0].content;
    expect(content).toHaveLength(1);
    expect(content[0].type).toBe("file");
  });

  it("uses auto engine and adds text prompt for non-OCR models", async () => {
    setPlatformMobile(false);
    vi.spyOn(app.vault, "getAbstractFileByPath").mockReturnValue(
      new TFile("doc.pdf", 50) as any
    );
    vi.spyOn(app.vault, "readBinary").mockResolvedValue(new ArrayBuffer(50) as any);
    vi.spyOn(app.vault, "create").mockResolvedValue(new TFile("doc.md", 0) as any);
    const requestSpy = mockOcrSuccess("extracted text");

    await tool.execute(makeCtx({ pdfPath: "doc.pdf", model: "mistralai/ministral-14b-instruct" }));

    const callBody = JSON.parse(requestSpy.mock.calls[0][0].body);
    const plugin = callBody.plugins.find((p: { id: string }) => p.id === "file-parser");
    expect(plugin?.pdf?.engine).toBe("auto");
    // Text instruction must be present so the chat model knows what to respond with
    const content = callBody.messages[0].content;
    expect(content).toHaveLength(2);
    expect(content[0].type).toBe("file");
    expect(content[1].type).toBe("text");
    expect((content[1] as { type: string; text: string }).text).toMatch(/extract.*text/i);
  });

  it("error message for non-OCR model includes model suggestion when content is empty", async () => {
    setPlatformMobile(false);
    vi.spyOn(app.vault, "getAbstractFileByPath").mockReturnValue(
      new TFile("doc.pdf", 50) as any
    );
    vi.spyOn(app.vault, "readBinary").mockResolvedValue(new ArrayBuffer(50) as any);
    vi.spyOn(Obsidian, "requestUrl").mockResolvedValue({
      status: 200,
      json: { choices: [{ message: { content: null } }] },
      text: "",
    } as any);

    const res = await tool.execute(
      makeCtx({ pdfPath: "doc.pdf", model: "mistralai/ministral-14b-instruct" })
    );

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/empty content/i);
    expect(res.error).toMatch(/mistral-ocr-latest/i);
  });

  it("uses outputPath when provided", async () => {
    setPlatformMobile(false);
    vi.spyOn(app.vault, "getAbstractFileByPath").mockReturnValue(
      new TFile("input.pdf", 50) as any
    );
    vi.spyOn(app.vault, "readBinary").mockResolvedValue(new ArrayBuffer(50) as any);
    vi.spyOn(app.vault, "create").mockResolvedValue(new TFile("output/result.md", 0) as any);
    mockOcrSuccess("content");

    const res = await tool.execute(
      makeCtx({ pdfPath: "input.pdf", outputPath: "output/result" })
    );

    expect(res.success).toBe(true);
    const data = res.data as { files: string[] };
    expect(data.files[0]).toBe("output/result.md");
  });

  // ── API errors ──────────────────────────────────────────────────────────────

  it("returns error when OCR API returns non-2xx status", async () => {
    setPlatformMobile(false);
    vi.spyOn(app.vault, "getAbstractFileByPath").mockReturnValue(
      new TFile("doc.pdf", 50) as any
    );
    vi.spyOn(app.vault, "readBinary").mockResolvedValue(new ArrayBuffer(50) as any);
    vi.spyOn(Obsidian, "requestUrl").mockResolvedValue({
      status: 500,
      text: "Internal Server Error",
      json: {},
    } as any);

    const res = await tool.execute(makeCtx({ pdfPath: "doc.pdf" }));

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/OCR API error/i);
    expect(res.error).toMatch(/500/);
  });

  it("returns error when OCR API returns empty content", async () => {
    setPlatformMobile(false);
    vi.spyOn(app.vault, "getAbstractFileByPath").mockReturnValue(
      new TFile("doc.pdf", 50) as any
    );
    vi.spyOn(app.vault, "readBinary").mockResolvedValue(new ArrayBuffer(50) as any);
    vi.spyOn(Obsidian, "requestUrl").mockResolvedValue({
      status: 200,
      json: { choices: [{ message: { content: null } }] },
      text: "",
    } as any);

    const res = await tool.execute(makeCtx({ pdfPath: "doc.pdf" }));

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/empty content/i);
  });

  // ── Mobile large PDF – multi-chunk path ────────────────────────────────────

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
    const mockSave = vi.fn().mockResolvedValue(new Uint8Array(100));
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
    (app.vault as any).createBinary = vi.fn().mockResolvedValue(new TFile("_ocr_tmp/big_chunk_0.pdf", 100) as any);

    // Mock delete for cleanup
    vi.spyOn(app.vault, "delete" as any).mockResolvedValue(undefined);

    const requestSpy = mockOcrSuccess("# Part content");
    const createSpy = vi.spyOn(app.vault, "create").mockResolvedValue(
      new TFile("big_part_1.md", 0) as any
    );

    const res = await tool.execute(makeCtx({ pdfPath: "big.pdf" }));

    expect(res.success).toBe(true);
    const data = res.data as { files: string[]; totalFiles: number };
    // 25 MB / 5 MB TARGET_CHUNK_SIZE → ceil(25/5)=5 groups, 4 pages / ceil(4/5)=1 ppc → 4 chunks
    expect(data.totalFiles).toBe(4);
    expect(data.files[0]).toBe("big_part_1.md");
    expect(data.files[3]).toBe("big_part_4.md");

    // OCR should have been called once per chunk
    expect(requestSpy).toHaveBeenCalledTimes(4);

    // Markdown files should have been saved
    expect(createSpy).toHaveBeenCalledTimes(4);

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
