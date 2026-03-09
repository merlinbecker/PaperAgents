import { describe, it, expect, vi, beforeEach } from "vitest";
import * as Obsidian from "obsidian";
import { app, TFile, Vault } from "obsidian";
import { SearchFilesFactory, ReadFileFactory, WriteFileFactory, RestRequestFactory, FinishTaskFactory, AskUserFactory, ReadBinaryFileFactory } from "../../../src/tools/predefined";
import type { ExecutionContext } from "../../../src/types";

/** Wrap plain parameters into a minimal ExecutionContext for tool.execute(). */
const makeCtx = (params: Record<string, unknown>): ExecutionContext =>
  ({ parameters: params } as unknown as ExecutionContext);

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
    beforeEach(() => { tool = ReadBinaryFileFactory.create(app); });

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

    it("returns error when file exceeds 50 MB size limit", async () => {
      // Simulate a file whose stat.size exceeds MAX_BINARY_FILE_BYTES.
      // The mock vault TFile.stat.size is set from the stored content length,
      // so we stub getAbstractFileByPath to return a large-sized TFile.
      const { TFile: MockTFile } = await import("../../mocks/obsidian");
      const largeTFile = new MockTFile("/pdfs/huge.pdf", 51 * 1024 * 1024);
      // Register the path so the vault returns our oversized mock
      vi.spyOn(app.vault, "getAbstractFileByPath").mockReturnValueOnce(largeTFile as any);

      const res = await tool.execute(makeCtx({ filePath: "/pdfs/huge.pdf" }));
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/too large/i);
      expect(res.error).toMatch(/50 MB/);
    });

    it("accepts a file just below the 50 MB size limit", async () => {
      // Create a small actual file; override stat.size to 50 MB - 1 byte (just under limit)
      await (app.vault as any).create("/pdfs/near-limit.pdf", "small content");
      const { TFile: MockTFile } = await import("../../mocks/obsidian");
      const nearLimitTFile = new MockTFile("/pdfs/near-limit.pdf", 50 * 1024 * 1024 - 1);
      vi.spyOn(app.vault, "getAbstractFileByPath").mockReturnValueOnce(nearLimitTFile as any);

      const res = await tool.execute(makeCtx({ filePath: "/pdfs/near-limit.pdf" }));
      expect(res.success).toBe(true);
    });

    it("does not require HITL", () => {
      expect(tool.shouldRequireHITL({})).toBe(false);
    });
  });
});
