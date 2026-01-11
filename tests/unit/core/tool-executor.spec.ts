import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import toolExecutor, { HITLDecision } from "../../../src/core/tool-executor";
import { Agent, IExecutableTool, ExecutionContext } from "../../../src/types";

const makeTool = (name: string, opts?: { hitl?: boolean; result?: any; fail?: boolean }): IExecutableTool => {
  return {
    name,
    parameters: [],
    shouldRequireHITL: () => !!opts?.hitl,
    execute: async (_ctx: ExecutionContext) => {
      if (opts?.fail) {
        return { success: false, error: "boom", log: [] } as any;
      }
      return { success: true, data: opts?.result ?? { ok: true }, log: [] } as any;
    },
  };
};

const makeRegistry = (tool: IExecutableTool | null) => ({
  getTool: (_id: string) => tool,
});

describe("ToolExecutor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-02T03:04:05Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("runs a step with placeholder replacement and succeeds", async () => {
    const registry = makeRegistry(makeTool("echo"));
    const agent: Agent = {
      id: "a",
      name: "A",
      type: "chain",
      parameters: [{ name: "msg", type: "string", required: true }],
      steps: [
        {
          name: "echo",
          parameters: { text: "Hello {{msg}}" },
        },
      ],
    };

    const res = await toolExecutor.executeAgent(agent, registry, { msg: "World" });
    expect(res.success).toBe(true);
    const outputs = (res.data as any).outputs;
    expect(outputs.echo).toBeDefined();
  });

  it("fails fast when required parameter missing", async () => {
    const registry = makeRegistry(makeTool("echo"));
    const agent: Agent = {
      id: "a",
      name: "A",
      type: "chain",
      parameters: [{ name: "msg", type: "string", required: true }],
      steps: [],
    };

    const res = await toolExecutor.executeAgent(agent, registry, {});
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Missing required parameter/);
  });

  it("requests HITL and approves execution", async () => {
    const registry = makeRegistry(makeTool("writer", { hitl: true }));
    const agent: Agent = {
      id: "w",
      name: "Writer",
      type: "chain",
      parameters: [],
      steps: [
        { name: "writer", parameters: { content: "hi" } },
      ],
    };

    // Register HITL callback that approves
    toolExecutor.registerHITLCallback("writer", async (decision: HITLDecision) => {
      decision.approved = true;
    });

    const res = await toolExecutor.executeAgent(agent, registry, {});
    expect(res.success).toBe(true);
  });

  it("requests HITL without callback and rejects", async () => {
    const registry = makeRegistry(makeTool("writer-no-cb", { hitl: true }));
    const agent: Agent = {
      id: "w2",
      name: "Writer2",
      type: "chain",
      parameters: [],
      steps: [
        { name: "writer-no-cb", parameters: {} },
      ],
    };

    const res = await toolExecutor.executeAgent(agent, registry, {});
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/User rejected/);
  });

  it("bubbles tool execution failure", async () => {
    const registry = makeRegistry(makeTool("f", { fail: true }));
    const agent: Agent = {
      id: "f",
      name: "Failer",
      type: "chain",
      parameters: [],
      steps: [ { name: "f", parameters: {} } ],
    };

    const res = await toolExecutor.executeAgent(agent, registry, {});
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Step f failed/);
  });
});
