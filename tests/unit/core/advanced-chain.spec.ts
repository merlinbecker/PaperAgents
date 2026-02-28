import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import toolExecutor from "../../../src/core/tool-executor";
import { Agent, IExecutableTool, ExecutionContext } from "../../../src/types";

const makeTool = (name: string, opts?: { result?: unknown; fail?: boolean }): IExecutableTool => {
  return {
    name,
    parameters: [],
    shouldRequireHITL: () => false,
    execute: async (ctx: ExecutionContext) => {
      if (opts?.fail) {
        return { success: false, error: `${name} failed`, log: [] } as never;
      }
      return {
        success: true,
        data: opts?.result ?? ctx.parameters,
        log: [],
      } as never;
    },
  };
};

const makeRegistry = (tools: IExecutableTool[]) => ({
  getTool: (id: string) => tools.find((t) => t.name === id) || null,
});

describe("Advanced Chain Features", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("conditional steps", () => {
    it("skips step when condition evaluates to false", async () => {
      const tools = [
        makeTool("step1", { result: { value: "no" } }),
        makeTool("step2", { result: "should-skip" }),
      ];
      const registry = makeRegistry(tools);

      const agent: Agent = {
        id: "cond",
        name: "Cond",
        type: "chain",
        parameters: [],
        steps: [
          { name: "step1", parameters: {} },
          {
            name: "step2",
            parameters: {},
            condition: { field: "step1.value", equals: "yes" },
          },
        ],
      };

      const res = await toolExecutor.executeAgent(agent, registry, {});
      expect(res.success).toBe(true);
    });

    it("executes step when condition evaluates to true", async () => {
      const tools = [
        makeTool("step1", { result: { value: "yes" } }),
        makeTool("step2", { result: "executed" }),
      ];
      const registry = makeRegistry(tools);

      const agent: Agent = {
        id: "cond",
        name: "Cond",
        type: "chain",
        parameters: [],
        steps: [
          { name: "step1", parameters: {} },
          {
            name: "step2",
            parameters: {},
            condition: { field: "step1.value", equals: "yes" },
          },
        ],
      };

      const res = await toolExecutor.executeAgent(agent, registry, {});
      expect(res.success).toBe(true);
      const outputs = (res.data as Record<string, Record<string, unknown>>).outputs;
      expect(outputs.step2).toBeDefined();
    });
  });

  describe("retry logic", () => {
    it("retries a failing step up to maxAttempts", async () => {
      let callCount = 0;
      const retryTool: IExecutableTool = {
        name: "flaky",
        parameters: [],
        shouldRequireHITL: () => false,
        execute: async () => {
          callCount++;
          if (callCount < 3) {
            return { success: false, error: "transient", log: [] } as never;
          }
          return { success: true, data: { ok: true }, log: [] } as never;
        },
      };

      const registry = makeRegistry([retryTool]);

      const agent: Agent = {
        id: "retry",
        name: "Retry",
        type: "chain",
        parameters: [],
        steps: [
          {
            name: "flaky",
            parameters: {},
            retry: { maxAttempts: 5, delay: 0 },
          },
        ],
      };

      const res = await toolExecutor.executeAgent(agent, registry, {});
      expect(res.success).toBe(true);
      expect(callCount).toBe(3);
    });
  });

  describe("loop steps", () => {
    it("loops over a list of items", async () => {
      const callArgs: unknown[] = [];
      const loopTool: IExecutableTool = {
        name: "process",
        parameters: [],
        shouldRequireHITL: () => false,
        execute: async (ctx: ExecutionContext) => {
          callArgs.push(ctx.parameters);
          return { success: true, data: { processed: ctx.parameters.item }, log: [] } as never;
        },
      };

      const registry = makeRegistry([loopTool]);

      const agent: Agent = {
        id: "loop",
        name: "Loop",
        type: "chain",
        parameters: [{ name: "items", type: "string", required: true }],
        steps: [
          {
            name: "process",
            parameters: { item: "{{loop.item}}" },
            loop: { over: "items", as: "item", maxIterations: 10 },
          },
        ],
      };

      const res = await toolExecutor.executeAgent(agent, registry, {
        items: JSON.stringify(["a", "b", "c"]),
      });

      expect(res.success).toBe(true);
    });
  });
});
