import { describe, it, expect } from "vitest";
import ToolRegistry from "../../../src/core/tool-registry";
import { IExecutableTool, IToolFactory, Agent } from "../../../src/types";

class DummyTool implements IExecutableTool {
  name = "dummy";
  parameters = [];
  execute = async () => ({ success: true, data: { ok: true }, log: [] });
  shouldRequireHITL = () => false;
}

class DummyFactory implements IToolFactory {
  name: string;
  description: string;
  constructor(name: string, description: string) {
    this.name = name;
    this.description = description;
  }
  create(): IExecutableTool {
    return new DummyTool();
  }
}

describe("ToolRegistry", () => {
  it("registers and retrieves predefined tools via factory (cached)", () => {
    const reg = new ToolRegistry();
    const factory = new DummyFactory("search", "desc");
    reg.registerPredefined(factory);

    const t1 = reg.getTool("search");
    const t2 = reg.getTool("search");
    expect(t1).toBeTruthy();
    expect(t1?.name).toBe("dummy");
    expect(t1).toBe(t2); // cached instance
  });

  it("registers custom tools and lists metadata sorted", () => {
    const reg = new ToolRegistry();
    const a1: Agent = { id: "b", name: "Beta", type: "single", parameters: [] };
    const a2: Agent = { id: "a", name: "Alpha", type: "chain", parameters: [] };
    reg.registerCustomBatch([a1, a2]);

    const meta = reg.listTools();
    expect(meta.map((m) => m.id)).toEqual(["a", "b"]); // sorted by name
    expect(meta[0].type).toBe("chain");
    expect(meta[1].type).toBe("custom");
  });

  it("hasTool/removeTool/clearCustomTools work as expected", () => {
    const reg = new ToolRegistry();
    const a: Agent = { id: "x", name: "X", type: "single", parameters: [] };
    reg.registerCustom(a);
    expect(reg.hasTool("x")).toBe(true);

    const removed = reg.removeTool("x");
    expect(removed).toBe(true);
    expect(reg.hasTool("x")).toBe(false);

    reg.registerCustom(a);
    reg.clearCustomTools();
    expect(reg.getCustomIds().length).toBe(0);
  });

  it("getStats returns counts", () => {
    const reg = new ToolRegistry();
    reg.registerPredefined(new DummyFactory("p1", ""));
    reg.registerCustom({ id: "c1", name: "C1", type: "single", parameters: [] });
    const stats = reg.getStats();
    expect(stats.predefinedTools).toBe(1);
    expect(stats.customTools).toBe(1);
    expect(stats.totalTools).toBe(2);
  });
});
