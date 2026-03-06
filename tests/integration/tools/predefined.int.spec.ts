import { describe, it, expect, vi, beforeEach } from "vitest";
import * as Obsidian from "obsidian";
import { app, TFile, Vault } from "obsidian";
import { SearchFilesFactory, ReadFileFactory, WriteFileFactory, RestRequestFactory, FinishTaskFactory } from "../../../src/tools/predefined";
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
});
