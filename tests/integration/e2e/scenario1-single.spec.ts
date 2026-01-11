import { describe, it, expect } from "vitest";
import { app, TFile, Vault } from "obsidian";
import CustomToolLoader from "../../../src/parser/tool-loader";
import ToolRegistry from "../../../src/core/tool-registry";
import toolExecutor from "../../../src/core/tool-executor";
import fs from "node:fs/promises";
import path from "node:path";

// This scenario is expected to surface missing features (custom JS execution, preprocess/postprocess).

describe("E2E Scenario 1 - Markdown Tool Single", () => {
  it("loads single tool markdown and attempts execution (may fail: custom JS sandbox missing)", async () => {
    // Arrange vault with single tool markdown
    (app as any).vault = new Vault();
    const v = app.vault as any;
    const content = await fs.readFile(path.join(__dirname, "../../fixtures/markdown/tool-single.md"), "utf8");
    await v.create("paper-agents-tools/tool-single.md", content);

    const loader = new CustomToolLoader(app as any);
    const registry = new ToolRegistry();

    // Act: discover & load
    const tools = await loader.loadCustomTools("paper-agents-tools");
    tools.successful.forEach((agent) => registry.registerCustom(agent));

    // Assert discovery
    expect(tools.successful.length).toBe(1);
    expect(tools.successful[0].id).toBe("single_echo");

    // Attempt execution (custom JS path now supported via sandbox stub)
    const agent = tools.successful[0];
    const result = await toolExecutor.executeAgent(agent, registry as any, { input: "hello" });

    expect(result.success).toBe(true);
    expect((result.data as any)?.output?.echoed).toBe("hello");
  });
});
