import { describe, it, expect } from "vitest";
import { app, Vault } from "obsidian";
import ToolRegistry from "../../../src/core/tool-registry";
import toolExecutor from "../../../src/core/tool-executor";
import { PredefinedToolsFactory } from "../../../src/tools/predefined";
import YAMLParser from "../../../src/parser/yaml-parser";
import fs from "node:fs/promises";
import path from "node:path";

// Chain execution is partly implemented; this test asserts expected behavior and will fail if chain support is incomplete.

describe("E2E Scenario 2 - Markdown Toolchain", () => {
  it("executes a 2-step chain (search_files -> read_file) over mocked vault", async () => {
    // Arrange: mock vault with files
    (app as any).vault = new Vault();
    const v = app.vault as any;
    await v.create("/notes/one.md", "first");
    await v.create("/notes/two.md", "second");

    // Parse chain markdown
    const content = await fs.readFile(path.join(__dirname, "../../fixtures/markdown/tool-chain.md"), "utf8");
    const parsed = YAMLParser.parseToolFile(content);
    const agent = YAMLParser.toAgent(parsed);

    // Registry with predefined tools
    const registry = new ToolRegistry(app as any);
    registry.registerPredefined(PredefinedToolsFactory.searchFiles);
    registry.registerPredefined(PredefinedToolsFactory.readFile);

    // eslint-disable-next-line no-console
    console.log("Parsed agent:", agent);

    // Execute chain
    const res = await toolExecutor.executeAgent(agent, registry as any, { query: "one" });

    // eslint-disable-next-line no-console
    console.log("Scenario 2 result:", JSON.stringify(res, null, 2));

    // Expect success; if chain orchestration is incomplete, this will fail and highlight the gap
    expect(res.success).toBe(true);
    const outputs = (res.data as any).outputs;
    expect(outputs.search_files).toBeDefined();
    expect(outputs.read_file?.content).toBe("first");
  });
});
