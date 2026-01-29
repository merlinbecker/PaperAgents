import { describe, it, expect } from "vitest";
import { app, TFile, Vault } from "obsidian";
import CustomToolLoader from "../../../src/parser/tool-loader";
import ToolRegistry from "../../../src/core/tool-registry";
import { PredefinedToolsFactory } from "../../../src/tools/predefined";
import toolExecutor from "../../../src/core/tool-executor";
import fs from "node:fs/promises";
import path from "node:path";

// This scenario tests the new 3-phase execution: Pre-Processing → Tool → Post-Processing

describe("E2E Scenario 1 - Markdown Tool Single", () => {
  it("loads single tool markdown and executes with pre/post-processing", async () => {
    // Arrange vault with single tool markdown
    (app as any).vault = new Vault();
    const v = app.vault as any;
    const content = await fs.readFile(path.join(__dirname, "../../fixtures/markdown/tool-single.md"), "utf8");
    await v.create("paper-agents-tools/tool-single.md", content);
    await v.create("hello.md", "test content");

    const loader = new CustomToolLoader(app as any);
    const registry = new ToolRegistry(app as any);
    
    // Register predefined tools
    registry.registerPredefined(PredefinedToolsFactory.readFile);

    // Act: discover & load
    const tools = await loader.loadCustomTools("paper-agents-tools");
    tools.successful.forEach((agent) => registry.registerCustom(agent));

    // Assert discovery
    expect(tools.successful.length).toBe(1);
    expect(tools.successful[0].id).toBe("single_echo");

    // Attempt execution (3-phase: preprocess → read_file → postprocess)
    const agent = tools.successful[0];
    const result = await toolExecutor.executeAgent(agent, registry as any, { input: "hello" });

    expect(result.success).toBe(true);
    expect((result.data as any)?.output).toBeDefined();
  });
});
