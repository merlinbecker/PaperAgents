import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as Obsidian from "obsidian";
import { app, TFile, Vault, Platform } from "obsidian";
import { SearchFilesFactory, ReadFileFactory, WriteFileFactory, RestRequestFactory, FinishTaskFactory, AskUserFactory, ReadBinaryFileFactory, SplitAndReadPdfFactory } from "../../../src/tools/predefined";
import type { ExecutionContext } from "../../../src/types";

/** Wrap plain parameters into a minimal ExecutionContext for tool.execute(). */
const makeCtx = (params: Record<string, unknown>): ExecutionContext =>
  ({ parameters: params } as unknown as ExecutionContext);

/** Toggle the Platform mock between mobile and desktop. */
function setPlatformMobile(isMobile: boolean): void {
  (Platform as any).isMobile = isMobile;
}

/**
 * Build a pdf-lib mock for the given total page count (default: 4).
 * Pass the returned factory to `vi.doMock("pdf-lib", ...)`.
 */
function buildPdfLibMock(pageCount = 4) {
  const mockSave = vi.fn().mockResolvedValue(new Uint8Array(100));
  const mockAddPage = vi.fn();
  const mockCopyPages = vi.fn().mockResolvedValue(Array.from({ length: pageCount }, () => ({})));
  const mockCreate = vi.fn().mockResolvedValue({ copyPages: mockCopyPages, addPage: mockAddPage, save: mockSave });
  const mockLoad = vi.fn().mockResolvedValue({ getPageCount: vi.fn().mockReturnValue(pageCount), copyPages: mockCopyPages });
  return { mockLoad, mockCreate };
}

/**
 * Encode a minimal PDF `/Count N` byte sequence for the raw-byte page counter.
 */
function makePdfCountBuffer(pageCount: number): ArrayBuffer {
  return new TextEncoder().encode(`/Pages /Count ${pageCount} /Kids`).buffer;
}

/**
 * Switch to mobile, create a TFile stub of the given size, and mock vault spies.
 * `readBuf` defaults to an empty 16-byte buffer (no /Count pattern).
 */
function setupMobileLargePdf(filePath: string, sizeBytes: number, readBuf: ArrayBuffer = new ArrayBuffer(16)): void {
  setPlatformMobile(true);
  const stub = new TFile(filePath, sizeBytes);
  vi.spyOn(app.vault, "getAbstractFileByPath").mockReturnValue(stub as any);
  vi.spyOn(app.vault, "readBinary").mockResolvedValue(readBuf as any);
}

/**
 * Switch to mobile and mock vault spies for saveTo tests.
 * Unlike `setupMobileLargePdf`, `getAbstractFileByPath` returns null for any path
 * that is not the original PDF – preventing the fast-path from triggering when the
 * chunk file does not yet exist.
 */
function setupMobileLargePdfForSaveTo(
  filePath: string,
  sizeBytes: number,
  readBuf: ArrayBuffer = new ArrayBuffer(16)
): TFile {
  setPlatformMobile(true);
  const pdfStub = new TFile(filePath, sizeBytes);
  vi.spyOn(app.vault, "getAbstractFileByPath").mockImplementation((p: string) =>
    p === filePath || p === filePath.replace(/^\//, "") ? pdfStub as any : null
  );
  vi.spyOn(app.vault, "readBinary").mockResolvedValue(readBuf as any);
  return pdfStub;
}

/**
 * Register a pdf-lib mock for the current test and return the mock handles.
 * Call `vi.doUnmock("pdf-lib")` at the end of the test to clean up.
 */
function installPdfLibMock(pageCount = 4) {
  const { mockLoad, mockCreate } = buildPdfLibMock(pageCount);
  vi.doMock("pdf-lib", () => ({ PDFDocument: { load: mockLoad, create: mockCreate } }));
  return { mockLoad, mockCreate };
}

describe("Predefined tools integration (mocked vault)", () => {
  beforeEach(async () => {
    (app as any).vault = new Vault();
    const v = app.vault as any;
    await v.create("/notes/a.md", "alpha");
    await v.create("/notes/b.md", "moon");
    await v.create("/other/c.txt", "gamma");
  });

  describe("search_files", () => {
    let tool: ReturnType<typeof SearchFilesFactory.create>;
    beforeEach(() => { tool = SearchFilesFactory.create(app); });

    it("filters by path and query (name match)", async () => {
      const res = await tool.execute(makeCtx({ query: "a", path: "/notes" }));
      expect(res.success).toBe(true);
      expect((res.data as any).count).toBe(1);
      expect((res.data as any).results[0].path).toBe("/notes/a.md");
    });

    it("finds files by content when name does not match", async () => {
      const res = await tool.execute(makeCtx({ query: "moon", path: "/notes" }));
      expect(res.success).toBe(true);
      expect((res.data as any).count).toBe(1);
      expect((res.data as any).results[0].path).toBe("/notes/b.md");
    });

    it("searches all files when path is omitted", async () => {
      const res = await tool.execute(makeCtx({ query: "alpha" }));
      expect(res.success).toBe(true);
      expect((res.data as any).count).toBe(1);
      expect((res.data as any).results[0].path).toBe("/notes/a.md");
    });

    it("returns error result when query parameter is missing", async () => {
      const res = await tool.execute(makeCtx({}));
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/query/);
    });

    it("returns error result when query parameter is null", async () => {
      const res = await tool.execute(makeCtx({ query: null }));
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/query/);
    });
  });

  describe("read_file", () => {
    it("returns content and metadata", async () => {
      const tool = ReadFileFactory.create(app);
      const res = await tool.execute(makeCtx({ filePath: "/notes/a.md" }));
      expect(res.success).toBe(true);
      expect((res.data as any).content).toBe("alpha");
      expect((res.data as any).size).toBeDefined();
    });
  });

  describe("write_file", () => {
    it("prevents overwrite unless flag set", async () => {
      const tool = WriteFileFactory.create(app);
      const fail = await tool.execute(makeCtx({ filePath: "/notes/a.md", content: "x", overwrite: false }));
      expect(fail.success).toBe(false);
      expect(fail.error).toMatch(/already exists/);

      const ok = await tool.execute(makeCtx({ filePath: "/notes/a.md", content: "x", overwrite: true }));
      expect(ok.success).toBe(true);
      const readBack = await (app.vault as any).read(new TFile("/notes/a.md"));
      expect(readBack).toBe("x");
    });
  });

  describe("rest_request", () => {
    it("uses mocked requestUrl", async () => {
      const spy = vi.spyOn(Obsidian, "requestUrl").mockResolvedValue({ status: 201, statusText: "Created", text: "done" });
      const tool = RestRequestFactory.create(app);
      const res = await tool.execute(makeCtx({ url: "https://api", method: "POST", body: "{}" }));
      expect(res.success).toBe(true);
      expect((res.data as any).status).toBe(201);
      spy.mockRestore();
    });
  });

  describe("finish_task", () => {
    it("returns done:true with summary", async () => {
      const tool = FinishTaskFactory.create();
      const res = await tool.execute(makeCtx({ summary: "All done!" }));
      expect(res.success).toBe(true);
      expect((res.data as any).done).toBe(true);
      expect((res.data as any).summary).toBe("All done!");
    });

    it("includes reportPath when provided", async () => {
      const tool = FinishTaskFactory.create();
      const res = await tool.execute(makeCtx({ summary: "Done", reportPath: "reports/result.md" }));
      expect(res.success).toBe(true);
      expect((res.data as any).reportPath).toBe("reports/result.md");
    });

    it("does not require HITL", () => {
      const tool = FinishTaskFactory.create();
      expect(tool.shouldRequireHITL({})).toBe(false);
    });

    it("has a non-empty log entry", async () => {
      const tool = FinishTaskFactory.create();
      const res = await tool.execute(makeCtx({ summary: "Completed" }));
      expect(res.log).toHaveLength(1);
      expect(res.log[0]?.toolName).toBe("finish_task");
    });
  });

  describe("ask_user", () => {
    it("returns asked:true with question", async () => {
      const tool = AskUserFactory.create();
      const res = await tool.execute(makeCtx({ question: "What should I do next?" }));
      expect(res.success).toBe(true);
      expect((res.data as any).asked).toBe(true);
      expect((res.data as any).question).toBe("What should I do next?");
    });

    it("does not require HITL", () => {
      const tool = AskUserFactory.create();
      expect(tool.shouldRequireHITL({})).toBe(false);
    });

    it("has a non-empty log entry with correct tool name", async () => {
      const tool = AskUserFactory.create();
      const res = await tool.execute(makeCtx({ question: "Continue?" }));
      expect(res.log).toHaveLength(1);
      expect(res.log[0]?.toolName).toBe("ask_user");
    });
  });

  describe("read_binary_file", () => {
    let tool: ReturnType<typeof ReadBinaryFileFactory.create>;
    beforeEach(() => {
      tool = ReadBinaryFileFactory.create(app);
      // Reset platform to desktop before each test
      setPlatformMobile(false);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("returns base64, mimeType and size for a small binary file", async () => {
      await (app.vault as any).create("/pdfs/small.pdf", "PDF content");
      const res = await tool.execute(makeCtx({ filePath: "/pdfs/small.pdf" }));
      expect(res.success).toBe(true);
      const data = res.data as any;
      expect(data.base64).toBeDefined();
      expect(typeof data.base64).toBe("string");
      expect(data.mimeType).toBe("application/pdf");
      expect(data.size).toBeGreaterThan(0);
    });

    it("returns error when file does not exist", async () => {
      const res = await tool.execute(makeCtx({ filePath: "/pdfs/nonexistent.pdf" }));
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/not found/i);
    });

    it("returns error on desktop when file exceeds 50 MB size limit", async () => {
      vi.spyOn(app.vault, "getAbstractFileByPath").mockReturnValueOnce(new TFile("/pdfs/huge.pdf", 51 * 1024 * 1024) as any);
      const res = await tool.execute(makeCtx({ filePath: "/pdfs/huge.pdf" }));
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/too large/i);
      expect(res.error).toMatch(/50 MB/);
    });

    it("returns error on mobile when file exceeds 20 MB size limit", async () => {
      setPlatformMobile(true);
      // 25 MB — over the mobile limit (20 MB) but under the desktop limit (50 MB)
      vi.spyOn(app.vault, "getAbstractFileByPath").mockReturnValueOnce(new TFile("/pdfs/medium.pdf", 25 * 1024 * 1024) as any);
      const res = await tool.execute(makeCtx({ filePath: "/pdfs/medium.pdf" }));
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/too large/i);
      expect(res.error).toMatch(/20 MB/);
    });

    it("accepts on mobile a file just below the 20 MB limit", async () => {
      setPlatformMobile(true);
      await (app.vault as any).create("/pdfs/mobile-ok.pdf", "small content");
      vi.spyOn(app.vault, "getAbstractFileByPath").mockReturnValueOnce(new TFile("/pdfs/mobile-ok.pdf", 20 * 1024 * 1024 - 1) as any);
      const res = await tool.execute(makeCtx({ filePath: "/pdfs/mobile-ok.pdf" }));
      expect(res.success).toBe(true);
    });

    it("accepts a file just below the 50 MB desktop size limit", async () => {
      await (app.vault as any).create("/pdfs/near-limit.pdf", "small content");
      vi.spyOn(app.vault, "getAbstractFileByPath").mockReturnValueOnce(new TFile("/pdfs/near-limit.pdf", 50 * 1024 * 1024 - 1) as any);
      const res = await tool.execute(makeCtx({ filePath: "/pdfs/near-limit.pdf" }));
      expect(res.success).toBe(true);
    });

    it("does not require HITL", () => {
      expect(tool.shouldRequireHITL({})).toBe(false);
    });
  });

  describe("split_and_read_pdf", () => {
    let tool: ReturnType<typeof SplitAndReadPdfFactory.create>;

    beforeEach(async () => {
      tool = SplitAndReadPdfFactory.create(app);
      setPlatformMobile(false);
      await (app.vault as any).create("/pdfs/test.pdf", "PDF content");
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("delegates to read_binary_file on desktop (no splitting)", async () => {
      // On desktop the tool should behave like read_binary_file
      const res = await tool.execute(makeCtx({ filePath: "/pdfs/test.pdf" }));
      expect(res.success).toBe(true);
      const data = res.data as any;
      // Delegated: single result with base64, not an array
      expect(Array.isArray(data)).toBe(false);
      expect(data.base64).toBeDefined();
      expect(data.mimeType).toBe("application/pdf");
    });

    it("delegates to read_binary_file on mobile when PDF is below 20 MB", async () => {
      setPlatformMobile(true);
      // Just below the 20 MB limit
      vi.spyOn(app.vault, "getAbstractFileByPath").mockReturnValueOnce(new TFile("/pdfs/test.pdf", 19 * 1024 * 1024) as any);
      vi.spyOn(app.vault, "readBinary").mockResolvedValueOnce(new ArrayBuffer(8) as any);

      const res = await tool.execute(makeCtx({ filePath: "/pdfs/test.pdf" }));
      expect(res.success).toBe(true);
      // Delegated: single result, not an array
      expect(Array.isArray(res.data)).toBe(false);
    });

    it("delegates to read_binary_file on mobile when file is not a PDF", async () => {
      setPlatformMobile(true);
      await (app.vault as any).create("/images/photo.png", "PNG data");
      // Large PNG – should NOT split (not a PDF), delegates to read_binary_file
      vi.spyOn(app.vault, "getAbstractFileByPath").mockReturnValue(new TFile("/images/photo.png", 25 * 1024 * 1024) as any);
      vi.spyOn(app.vault, "readBinary").mockResolvedValue(new ArrayBuffer(8) as any);

      const res = await tool.execute(makeCtx({ filePath: "/images/photo.png" }));
      // Delegated to ReadBinaryFileTool – PNG is 25 MB on mobile (> 20 MB limit), so error
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/too large/i);
    });

    it("returns error for missing file", async () => {
      const res = await tool.execute(makeCtx({ filePath: "/pdfs/nonexistent.pdf" }));
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/not found/i);
    });

    it("does not require HITL", () => {
      expect(tool.shouldRequireHITL({})).toBe(false);
    });

    it("returns metadata without base64 when chunkIndex is omitted (raw byte page counting)", async () => {
      // Phase 1 reads raw bytes for /Count — no pdf-lib needed
      setupMobileLargePdf("/pdfs/large.pdf", 32 * 1024 * 1024, makePdfCountBuffer(4));

      const freshTool = SplitAndReadPdfFactory.create(app);
      const res = await freshTool.execute(makeCtx({ filePath: "/pdfs/large.pdf", pagesPerChunk: 2 }));

      expect(res.success).toBe(true);
      const meta = res.data as any;
      expect(Array.isArray(meta)).toBe(false);
      expect(meta.base64).toBeUndefined();
      expect(meta.strategy).toBe("chunked");
      expect(meta.totalChunks).toBe(2);
      expect(meta.totalPages).toBe(4);
      expect(meta.pagesPerChunk).toBe(2);
      expect(meta.filePath).toBe("/pdfs/large.pdf");
    });

    it("metadata call falls back to file-size estimate when no /Count pattern found", async () => {
      // 30 MB PDF with no /Count pattern → estimate: round(30 * 1024 * 1024 / (200 * 1024)) = 154 pages
      setupMobileLargePdf("/pdfs/large.pdf", 30 * 1024 * 1024);

      const freshTool = SplitAndReadPdfFactory.create(app);
      const res = await freshTool.execute(makeCtx({ filePath: "/pdfs/large.pdf", pagesPerChunk: 2 }));

      expect(res.success).toBe(true);
      const meta = res.data as any;
      expect(meta.strategy).toBe("chunked");
      expect(meta.totalPages).toBeGreaterThanOrEqual(2);
      expect(meta.totalChunks).toBeGreaterThanOrEqual(1);
    });

    it("returns a single chunk with base64 when chunkIndex is provided (pdf-lib mocked)", async () => {
      setupMobileLargePdf("/pdfs/large.pdf", 32 * 1024 * 1024);
      const { mockLoad, mockCreate } = installPdfLibMock(4);

      const freshTool = SplitAndReadPdfFactory.create(app);
      const res = await freshTool.execute(makeCtx({ filePath: "/pdfs/large.pdf", pagesPerChunk: 2, chunkIndex: 0 }));

      expect(res.success).toBe(true);
      const chunk = res.data as any;
      expect(Array.isArray(chunk)).toBe(false);
      expect(chunk.chunkIndex).toBe(0);
      expect(chunk.totalChunks).toBe(2);
      expect(chunk.startPage).toBe(1);
      expect(chunk.endPage).toBe(2);
      expect(chunk.mimeType).toBe("application/pdf");
      expect(chunk.filePath).toBe("/pdfs/large.pdf");
      expect(typeof chunk.base64).toBe("string");

      vi.doUnmock("pdf-lib");
    });

    it("returns error when chunkIndex is out of range (pdf-lib mocked)", async () => {
      setupMobileLargePdf("/pdfs/large.pdf", 32 * 1024 * 1024);
      const { mockLoad, mockCreate } = installPdfLibMock(4);

      const freshTool = SplitAndReadPdfFactory.create(app);
      // pagesPerChunk=2 → totalChunks=2 → valid indices are 0,1; index 5 is out of range
      const res = await freshTool.execute(makeCtx({ filePath: "/pdfs/large.pdf", pagesPerChunk: 2, chunkIndex: 5 }));

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/invalid chunkindex/i);

      vi.doUnmock("pdf-lib");
    });

    it("returns error on mobile for a single-page PDF that is too large", async () => {
      setupMobileLargePdf("/pdfs/huge-single.pdf", 25 * 1024 * 1024, makePdfCountBuffer(1));

      const freshTool = SplitAndReadPdfFactory.create(app);
      const res = await freshTool.execute(makeCtx({ filePath: "/pdfs/huge-single.pdf" }));

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/only 1 page/i);
      expect(res.error).toMatch(/cannot be split/i);
    });

    it("saves chunk to vault and returns chunkPath (no base64) when saveTo is set", async () => {
      // Set up a mobile large PDF, but return null for chunk paths (not yet saved)
      setupMobileLargePdfForSaveTo("/pdfs/large.pdf", 32 * 1024 * 1024);
      const { mockLoad, mockCreate } = installPdfLibMock(4);

      const freshTool = SplitAndReadPdfFactory.create(app);
      const res = await freshTool.execute(makeCtx({
        filePath: "/pdfs/large.pdf",
        pagesPerChunk: 2,
        chunkIndex: 0,
        saveTo: "_chunks",
      }));

      expect(res.success).toBe(true);
      const data = res.data as any;
      // saveTo mode: chunkPath present, no base64
      expect(data.base64).toBeUndefined();
      expect(data.mimeType).toBeUndefined();
      expect(typeof data.chunkPath).toBe("string");
      expect(data.chunkPath).toMatch(/large_chunk_0\.pdf$/);
      expect(data.chunkIndex).toBe(0);
      expect(data.totalChunks).toBe(2);
      expect(data.startPage).toBe(1);
      expect(data.endPage).toBe(2);
      expect(data.filePath).toBe("/pdfs/large.pdf");

      // The chunk file must now exist in the vault's internal storage
      const vaultFiles = (app.vault as any).files as Map<string, string>;
      expect(vaultFiles.has(data.chunkPath)).toBe(true);

      vi.doUnmock("pdf-lib");
    });

    it("batch-saves all chunks when saveTo is set (pdf-lib loaded only once)", async () => {
      // Set up mobile large PDF; chunk files do not exist yet
      setupMobileLargePdfForSaveTo("/pdfs/large.pdf", 32 * 1024 * 1024);
      const { mockLoad, mockCreate } = installPdfLibMock(4);

      const freshTool = SplitAndReadPdfFactory.create(app);
      await freshTool.execute(makeCtx({
        filePath: "/pdfs/large.pdf",
        pagesPerChunk: 2,
        chunkIndex: 0,
        saveTo: "_chunks",
      }));

      // Both chunk files (0 and 1) must exist in the vault's internal storage
      const vaultFiles = (app.vault as any).files as Map<string, string>;
      expect(vaultFiles.has("_chunks/large_chunk_0.pdf")).toBe(true);
      expect(vaultFiles.has("_chunks/large_chunk_1.pdf")).toBe(true);

      // pdf-lib was loaded exactly once (one PDFDocument.load call)
      expect(mockLoad).toHaveBeenCalledTimes(1);

      vi.doUnmock("pdf-lib");
    });

    it("fast-path: returns cached chunk without reloading PDF when saveTo chunk already exists", async () => {
      // Pre-save a chunk file so the fast-path is triggered
      setPlatformMobile(true);
      const pdfStub = new TFile("/pdfs/large.pdf", 32 * 1024 * 1024);
      const chunkStub = new TFile("_chunks/large_chunk_1.pdf", 500);
      vi.spyOn(app.vault, "getAbstractFileByPath").mockImplementation((p: string) => {
        if (p === "/pdfs/large.pdf" || p === "pdfs/large.pdf") return pdfStub as any;
        if (p === "_chunks/large_chunk_1.pdf") return chunkStub as any;
        return null;
      });
      vi.spyOn(app.vault, "readBinary").mockResolvedValue(makePdfCountBuffer(4) as any);
      const { mockLoad, mockCreate } = installPdfLibMock(4);

      const freshTool = SplitAndReadPdfFactory.create(app);
      const res = await freshTool.execute(makeCtx({
        filePath: "/pdfs/large.pdf",
        pagesPerChunk: 2,
        chunkIndex: 1,
        saveTo: "_chunks",
      }));

      expect(res.success).toBe(true);
      const data = res.data as any;
      expect(data.chunkPath).toBe("_chunks/large_chunk_1.pdf");
      expect(data.chunkIndex).toBe(1);
      expect(data.totalChunks).toBe(2);
      expect(data.startPage).toBe(3); // pages 3-4 (1-based)
      expect(data.endPage).toBe(4);
      expect(data.base64).toBeUndefined();

      // pdf-lib must NOT have been loaded (fast-path skips full PDF parse)
      expect(mockLoad).not.toHaveBeenCalled();

      vi.doUnmock("pdf-lib");
    });
  });
});
