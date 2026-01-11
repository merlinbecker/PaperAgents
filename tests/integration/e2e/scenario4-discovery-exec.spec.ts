import { describe, it, expect } from "vitest";
import { app, TFile, Vault } from "obsidian";
import CustomToolLoader from "../../../src/parser/tool-loader";
import ToolRegistry from "../../../src/core/tool-registry";
import toolExecutor from "../../../src/core/tool-executor";
import { PredefinedToolsFactory } from "../../../src/tools/predefined";
import fs from "node:fs/promises";
import path from "node:path";

// Discovery should pass; execution of custom JS may currently fail (sandbox missing).

describe("E2E Scenario 4 - Discovery and execution of 4 tools", () => {
  it("discovers 4 tools and attempts execution (custom JS may fail)", async () => {
    (app as any).vault = new Vault();
    const v = app.vault as any;

    const files = [
      "tool-discovery-a.md",
      "tool-discovery-b.md",
      "tool-discovery-c.md",
      "tool-discovery-d.md",
    ];

    for (const file of files) {
      const content = await fs.readFile(path.join(__dirname, `../../fixtures/markdown/${file}`), "utf8");
      await v.create(`paper-agents-tools/${file}`, content);
    }

    // Seed notes for search/read
    await v.create("/notes/a.md", "alpha note");

    const loader = new CustomToolLoader(app as any);
    const registry = new ToolRegistry();
    registry.registerPredefined(PredefinedToolsFactory.searchFiles);
    registry.registerPredefined(PredefinedToolsFactory.readFile);

    const result = await loader.loadCustomTools("paper-agents-tools");
    result.successful.forEach((agent) => registry.registerCustom(agent));

    expect(result.successful.length).toBe(4);
    expect(registry.listTools().length).toBeGreaterThanOrEqual(4);

    // Attempt executing a predefined tool via executor (should pass)
    const searchTool = registry.getTool("search_files");
    expect(searchTool).toBeTruthy();
    const searchRes = await searchTool!.execute({ parameters: { query: "a", path: "/notes" } } as any);
    expect(searchRes.success).toBe(true);

    // Attempt executing a custom single tool (now supported via sandbox stub)
    const custom = result.successful.find((a) => a.id === "alpha")!;
    const execRes = await toolExecutor.executeAgent(custom, registry as any, { a: "x" });
    expect(execRes.success).toBe(true);
    expect((execRes.data as any)?.output?.a).toBe("x");
  });
});
