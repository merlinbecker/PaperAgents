import { describe, it, expect, beforeEach } from "vitest";
import { ToolExecutor } from "../../../src/core/tool-executor";
import { Agent, IExecutableTool, ExecutionContext, ExecutionResult } from "../../../src/types";

/**
 * Unit tests for 3-Phase Execution in ToolExecutor
 * Phase 1: Pre-Processing → Phase 2: Tool Execution → Phase 3: Post-Processing
 */
describe("ToolExecutor - 3-Phase Execution (Pre/Post-Processing)", () => {
  let executor: ToolExecutor;
  let mockRegistry: any;
  let executedTools: string[];

  beforeEach(() => {
    executor = new ToolExecutor();
    executedTools = [];

    // Mock tool that echoes input
    const mockEchoTool: IExecutableTool = {
      name: "echo_tool",
      parameters: [],
      shouldRequireHITL: () => false,
      execute: async (ctx: ExecutionContext): Promise<ExecutionResult> => {
        executedTools.push("echo_tool");
        return {
          success: true,
          data: { echoed: ctx.parameters.text },
          log: [{
            toolName: "echo_tool",
            parameters: ctx.parameters,
            output: { echoed: ctx.parameters.text },
            timestamp: Date.now(),
          }],
        };
      },
    };

    mockRegistry = {
      getTool: (id: string) => {
        if (id === "echo_tool") return mockEchoTool;
        return null;
      },
    };
  });

  describe("Single Tool with Pre-Processing only", () => {
    it("transforms input before tool execution", async () => {
      const agent: Agent = {
        id: "test_agent",
        name: "Test Agent",
        type: "single",
        parameters: [
          { name: "text", type: "string", required: true },
        ],
        preprocess: `
          input.text = input.text.trim().toUpperCase();
          return input;
        `,
        toolDefinition: {
          toolId: "echo_tool",
          parameters: {
            text: "{{text}}",
          },
        },
      };

      const result = await executor.executeAgent(agent, mockRegistry, {
        text: "  hello world  ",
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(executedTools).toContain("echo_tool");
      // The tool should have received the transformed (trimmed and uppercased) input
      // We can verify this indirectly through the tool execution
    });

    it("adds new fields during preprocessing", async () => {
      const agent: Agent = {
        id: "test_agent",
        name: "Test Agent",
        type: "single",
        parameters: [
          { name: "name", type: "string", required: true },
        ],
        preprocess: `
          input.filePath = input.name + ".md";
          input.timestamp = "2026-01-12";
          return input;
        `,
        toolDefinition: {
          toolId: "echo_tool",
          parameters: {
            text: "{{filePath}}",
          },
        },
      };

      const result = await executor.executeAgent(agent, mockRegistry, {
        name: "test-file",
      });

      expect(result.success).toBe(true);
      // The executor logs phases, not parameters
      // The actual tool execution should have used the transformed filePath
      expect(executedTools).toContain("echo_tool");
    });
  });

  describe("Single Tool with Post-Processing only", () => {
    it("transforms output after tool execution", async () => {
      const agent: Agent = {
        id: "test_agent",
        name: "Test Agent",
        type: "single",
        parameters: [
          { name: "text", type: "string", required: true },
        ],
        toolDefinition: {
          toolId: "echo_tool",
          parameters: {
            text: "{{text}}",
          },
        },
        postprocess: `
          return {
            result: output.echoed.toUpperCase(),
            length: output.echoed.length,
            log: []
          };
        `,
      };

      const result = await executor.executeAgent(agent, mockRegistry, {
        text: "hello",
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      // When using executeAgent, the data is wrapped in a structure
      expect((result.data as any).output.result).toBe("HELLO");
      expect((result.data as any).output.length).toBe(5);
    });
  });

  describe("Single Tool with Pre AND Post-Processing", () => {
    it("executes full 3-phase pipeline correctly", async () => {
      const agent: Agent = {
        id: "test_agent",
        name: "Test Agent",
        type: "single",
        parameters: [
          { name: "text", type: "string", required: true },
        ],
        preprocess: `
          input.text = input.text.trim();
          return input;
        `,
        toolDefinition: {
          toolId: "echo_tool",
          parameters: {
            text: "{{text}}",
          },
        },
        postprocess: `
          return {
            final: output.echoed.toUpperCase(),
            log: []
          };
        `,
      };

      const result = await executor.executeAgent(agent, mockRegistry, {
        text: "  hello  ",
      });

      expect(result.success).toBe(true);
      // Pre-processing trimmed, post-processing uppercased
      expect(result.data).toBeDefined();
      // When using executeAgent, the data is wrapped in a structure
      expect((result.data as any).output.final).toBe("HELLO");
    });

    it("propagates data through all phases", async () => {
      const agent: Agent = {
        id: "test_agent",
        name: "Test Agent",
        type: "single",
        parameters: [
          { name: "count", type: "number", required: true },
        ],
        preprocess: `
          input.count = input.count * 2;
          return input;
        `,
        toolDefinition: {
          toolId: "echo_tool",
          parameters: {
            text: "{{count}}",
          },
        },
        postprocess: `
          return {
            doubled: parseInt(output.echoed) * 2,
            log: []
          };
        `,
      };

      const result = await executor.executeAgent(agent, mockRegistry, {
        count: 5,
      });

      expect(result.success).toBe(true);
      // 5 * 2 (preprocess) = 10, then 10 * 2 (postprocess) = 20
      expect(result.data).toBeDefined();
      // When using executeAgent, the data is wrapped in a structure
      expect((result.data as any).output.doubled).toBe(20);
    });
  });

  describe("Error Handling in Pre-Processing", () => {
    it("fails execution when preprocess has invalid code", async () => {
      const agent: Agent = {
        id: "test_agent",
        name: "Test Agent",
        type: "single",
        parameters: [
          { name: "text", type: "string", required: true },
        ],
        preprocess: `
          // No return statement - invalid
          input.text = input.text.trim();
        `,
        toolDefinition: {
          toolId: "echo_tool",
          parameters: {
            text: "{{text}}",
          },
        },
      };

      const result = await executor.executeAgent(agent, mockRegistry, {
        text: "hello",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Pre-processing");
    });

    it("fails execution when preprocess throws error", async () => {
      const agent: Agent = {
        id: "test_agent",
        name: "Test Agent",
        type: "single",
        parameters: [
          { name: "text", type: "string", required: true },
        ],
        preprocess: `
          input.value = input.missing.property; // Will throw
          return input;
        `,
        toolDefinition: {
          toolId: "echo_tool",
          parameters: {
            text: "{{text}}",
          },
        },
      };

      const result = await executor.executeAgent(agent, mockRegistry, {
        text: "hello",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Pre-processing failed");
    });

    it("does not execute tool when preprocess fails", async () => {
      const agent: Agent = {
        id: "test_agent",
        name: "Test Agent",
        type: "single",
        parameters: [
          { name: "text", type: "string", required: true },
        ],
        preprocess: `
          throw new Error("Preprocess error");
          return input;
        `,
        toolDefinition: {
          toolId: "echo_tool",
          parameters: {
            text: "{{text}}",
          },
        },
      };

      await executor.executeAgent(agent, mockRegistry, { text: "hello" });

      // Tool should NOT have been executed
      expect(executedTools).not.toContain("echo_tool");
    });
  });

  describe("Error Handling in Post-Processing", () => {
    it("fails execution when postprocess has no executable return", async () => {
      const agent: Agent = {
        id: "test_agent",
        name: "Test Agent",
        type: "single",
        parameters: [
          { name: "text", type: "string", required: true },
        ],
        toolDefinition: {
          toolId: "echo_tool",
          parameters: {
            text: "{{text}}",
          },
        },
        postprocess: `
          const x = output.echoed;
        `,
      };

      const result = await executor.executeAgent(agent, mockRegistry, {
        text: "hello",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Post-processing");
    });

    it("fails execution when postprocess throws error", async () => {
      const agent: Agent = {
        id: "test_agent",
        name: "Test Agent",
        type: "single",
        parameters: [
          { name: "text", type: "string", required: true },
        ],
        toolDefinition: {
          toolId: "echo_tool",
          parameters: {
            text: "{{text}}",
          },
        },
        postprocess: `
          return output.missing.deeply.nested.property;
        `,
      };

      const result = await executor.executeAgent(agent, mockRegistry, {
        text: "hello",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Post-processing failed");
    });
  });

  describe("Single Tool without Tool Execution", () => {
    it("can run pre-processing without tool execution", async () => {
      const agent: Agent = {
        id: "test_agent",
        name: "Test Agent",
        type: "single",
        parameters: [
          { name: "text", type: "string", required: true },
        ],
        preprocess: `
          input.processed = input.text.toUpperCase();
          return input;
        `,
        // No toolDefinition
      };

      const result = await executor.executeAgent(agent, mockRegistry, {
        text: "hello",
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      // When using executeAgent, the data is wrapped in a structure
      expect((result.data as any).output.processed).toBe("HELLO");
      expect(executedTools).not.toContain("echo_tool");
    });

    it("can run post-processing on preprocessed data", async () => {
      const agent: Agent = {
        id: "test_agent",
        name: "Test Agent",
        type: "single",
        parameters: [
          { name: "value", type: "number", required: true },
        ],
        preprocess: `
          input.doubled = input.value * 2;
          return input;
        `,
        postprocess: `
          return {
            final: output.doubled * 3,
            log: []
          };
        `,
        // No toolDefinition
      };

      const result = await executor.executeAgent(agent, mockRegistry, {
        value: 5,
      });

      expect(result.success).toBe(true);
      // 5 * 2 = 10, then 10 * 3 = 30
      expect(result.data).toBeDefined();
      // When using executeAgent, the data is wrapped in a structure
      expect((result.data as any).output.final).toBe(30);
    });
  });

  describe("Phase Logging", () => {
    it("logs all three phases", async () => {
      const agent: Agent = {
        id: "test_agent",
        name: "Test Agent",
        type: "single",
        parameters: [
          { name: "text", type: "string", required: true },
        ],
        preprocess: `
          input.text = input.text.trim();
          return input;
        `,
        toolDefinition: {
          toolId: "echo_tool",
          parameters: {
            text: "{{text}}",
          },
        },
        postprocess: `
          return {
            result: output.echoed.toUpperCase(),
            log: []
          };
        `,
      };

      const result = await executor.executeAgent(agent, mockRegistry, {
        text: "  hello  ",
      });

      expect(result.success).toBe(true);
      expect(result.log).toBeDefined();
      
      // Check that all phases are logged
      const phases = result.log?.map((l: any) => l.phase).filter(Boolean);
      expect(phases).toContain("preprocess");
      expect(phases).toContain("tool_execution");
      expect(phases).toContain("postprocess");
    });
  });
});
