import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import toolExecutor from "../../../src/core/tool-executor";
import { Agent, IExecutableTool, ExecutionContext } from "../../../src/types";

const makeTool = (name: string, opts?: { result?: unknown; fail?: boolean }): IExecutableTool => {
  return {
    name,
    parameters: [],
    shouldRequireHITL: () => false,
    execute: async (_ctx: ExecutionContext) => {
      if (opts?.fail) {
        return { success: false, error: `${name} failed`, log: [] } as never;
      }
      return { success: true, data: opts?.result ?? { ok: true }, log: [] } as never;
    },
  };
};

const makeRegistry = (tools: IExecutableTool[]) => ({
  getTool: (id: string) => tools.find((t) => t.name === id) || null,
});

describe("continueOnError", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-02T03:04:05Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("stops on error when continueOnError is false/absent", async () => {
    const tools = [
      makeTool("step1", { result: "s1" }),
      makeTool("step2", { fail: true }),
      makeTool("step3", { result: "s3" }),
    ];
    const registry = makeRegistry(tools);

    const agent: Agent = {
      id: "chain",
      name: "Chain",
      type: "chain",
      parameters: [],
      steps: [
        { name: "step1", parameters: {} },
        { name: "step2", parameters: {} },
        { name: "step3", parameters: {} },
      ],
    };

    const res = await toolExecutor.executeAgent(agent, registry, {});
    expect(res.success).toBe(false);
    expect(res.error).toContain("step2");
  });

  it("continues past failed step when continueOnError is true", async () => {
    const tools = [
      makeTool("step1", { result: "s1" }),
      makeTool("step2", { fail: true }),
      makeTool("step3", { result: "s3" }),
    ];
    const registry = makeRegistry(tools);

    const agent: Agent = {
      id: "chain",
      name: "Chain",
      type: "chain",
      parameters: [],
      steps: [
        { name: "step1", parameters: {} },
        { name: "step2", parameters: {}, continueOnError: true },
        { name: "step3", parameters: {} },
      ],
    };

    const res = await toolExecutor.executeAgent(agent, registry, {});
    expect(res.success).toBe(true);
    const outputs = res.data as Record<string, unknown>;
    const innerOutputs = (outputs as Record<string, Record<string, unknown>>).outputs;
    expect(innerOutputs.step1).toBeDefined();
    expect(innerOutputs.step3).toBeDefined();
  });

  it("includes error in stepOutputs when continueOnError is true", async () => {
    const tools = [
      makeTool("failstep", { fail: true }),
      makeTool("afterfail", { result: "ok" }),
    ];
    const registry = makeRegistry(tools);

    const agent: Agent = {
      id: "chain",
      name: "Chain",
      type: "chain",
      parameters: [],
      steps: [
        { name: "failstep", parameters: {}, continueOnError: true },
        { name: "afterfail", parameters: {} },
      ],
    };

    const res = await toolExecutor.executeAgent(agent, registry, {});
    expect(res.success).toBe(true);
  });
});
