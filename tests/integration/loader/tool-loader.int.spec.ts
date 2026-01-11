import { describe, it, expect, beforeEach } from "vitest";
import { app, TFile, Vault } from "obsidian";
import CustomToolLoader from "../../../src/parser/tool-loader";
import fs from "node:fs/promises";
import path from "node:path";

describe("CustomToolLoader integration", () => {
  const loader = new CustomToolLoader(app as any);

  beforeEach(async () => {
    (app as any).vault = new Vault();
    const v = app.vault as any;
    // create folder structure and files
    await v.create("paper-agents-tools/custom-tool.md", await fs.readFile(path.join(__dirname, "../../fixtures/markdown/custom-tool.md"), "utf8"));
    await v.create("paper-agents-tools/ignore.txt", "nope");
  });

  it("discoverTools finds markdown tool files", async () => {
    const files = await loader.discoverTools("paper-agents-tools");
    expect(files.length).toBe(1);
    expect(files[0].name).toBe("custom-tool.md");
  });

  it("loadCustomTools parses and returns successful agents", async () => {
    const result = await loader.loadCustomTools("paper-agents-tools");
    expect(result.successful.length).toBe(1);
    expect(result.successful[0].id).toBe("custom_read");
    expect(result.failed.length).toBe(0);
  });
});
