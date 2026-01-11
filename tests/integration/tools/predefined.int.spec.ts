import { describe, it, expect, vi, beforeEach } from "vitest";
import * as Obsidian from "obsidian";
import { app, TFile, Vault } from "obsidian";
import { SearchFilesFactory, ReadFileFactory, WriteFileFactory, RestRequestFactory } from "../../../src/tools/predefined";

describe("Predefined tools integration (mocked vault)", () => {
  beforeEach(async () => {
    // reset vault map
    // recreate app.vault to clear state
    (app as any).vault = new Vault();
    // seed files
    const v = app.vault as any;
    await v.create("/notes/a.md", "alpha");
    await v.create("/notes/b.md", "beta");
    await v.create("/other/c.txt", "gamma");
  });

  it("search_files filters by path and query", async () => {
    const tool = SearchFilesFactory.create();
    const res = await tool.execute({ parameters: { query: "a", path: "/notes" } } as any);
    expect(res.success).toBe(true);
    expect((res.data as any).count).toBe(1);
    expect((res.data as any).results[0].path).toBe("/notes/a.md");
  });

  it("read_file returns content and metadata", async () => {
    const tool = ReadFileFactory.create();
    const res = await tool.execute({ parameters: { filePath: "/notes/a.md" } } as any);
    expect(res.success).toBe(true);
    expect((res.data as any).content).toBe("alpha");
    expect((res.data as any).size).toBeDefined();
  });

  it("write_file prevents overwrite unless flag set", async () => {
    const tool = WriteFileFactory.create();
    const fail = await tool.execute({ parameters: { filePath: "/notes/a.md", content: "x", overwrite: false } } as any);
    expect(fail.success).toBe(false);
    expect(fail.error).toMatch(/already exists/);

    const ok = await tool.execute({ parameters: { filePath: "/notes/a.md", content: "x", overwrite: true } } as any);
    expect(ok.success).toBe(true);
    const readBack = await (app.vault as any).read(new TFile("/notes/a.md"));
    expect(readBack).toBe("x");
  });

  it("rest_request uses mocked requestUrl", async () => {
    const spy = vi.spyOn(Obsidian, "requestUrl").mockResolvedValue({ status: 201, statusText: "Created", text: "done" });
    const tool = RestRequestFactory.create();
    const res = await tool.execute({ parameters: { url: "https://api", method: "POST", body: "{}" } } as any);
    expect(res.success).toBe(true);
    expect((res.data as any).status).toBe(201);
    spy.mockRestore();
  });
});
