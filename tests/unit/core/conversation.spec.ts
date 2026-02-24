import { describe, it, expect, beforeEach } from "vitest";
import { ConversationManager } from "../../../src/core/conversation";
import type { MemoryConfig, AgentDefinition } from "../../../src/types";

describe("ConversationManager", () => {
  let manager: ConversationManager;

  beforeEach(() => {
    manager = new ConversationManager();
  });

  describe("createConversation", () => {
    it("should create a conversation with generated id", () => {
      const conv = manager.createConversation("agent_1");

      expect(conv.id).toMatch(/^conv_\d+_\w+$/);
      expect(conv.agentId).toBe("agent_1");
      expect(conv.messages).toEqual([]);
      expect(conv.createdAt).toBeGreaterThan(0);
      expect(conv.updatedAt).toBeGreaterThan(0);
    });

    it("should create a conversation with custom id", () => {
      const conv = manager.createConversation("agent_1", "custom_id");

      expect(conv.id).toBe("custom_id");
      expect(conv.agentId).toBe("agent_1");
    });

    it("should store the conversation for later retrieval", () => {
      const conv = manager.createConversation("agent_1", "test_id");
      const retrieved = manager.getConversation("test_id");

      expect(retrieved).toEqual(conv);
    });
  });

  describe("getConversation", () => {
    it("should return undefined for non-existent conversation", () => {
      const result = manager.getConversation("nonexistent");
      expect(result).toBeUndefined();
    });

    it("should return the conversation if it exists", () => {
      manager.createConversation("agent_1", "existing");
      const result = manager.getConversation("existing");

      expect(result).toBeDefined();
      expect(result?.id).toBe("existing");
    });
  });

  describe("deleteConversation", () => {
    it("should delete an existing conversation", () => {
      manager.createConversation("agent_1", "to_delete");
      const result = manager.deleteConversation("to_delete");

      expect(result).toBe(true);
      expect(manager.getConversation("to_delete")).toBeUndefined();
    });

    it("should return false for non-existent conversation", () => {
      const result = manager.deleteConversation("nonexistent");
      expect(result).toBe(false);
    });
  });

  describe("listConversations", () => {
    it("should return all conversations", () => {
      manager.createConversation("agent_1", "conv_1");
      manager.createConversation("agent_2", "conv_2");
      manager.createConversation("agent_1", "conv_3");

      const all = manager.listConversations();
      expect(all).toHaveLength(3);
    });

    it("should filter by agentId", () => {
      manager.createConversation("agent_1", "conv_1");
      manager.createConversation("agent_2", "conv_2");
      manager.createConversation("agent_1", "conv_3");

      const filtered = manager.listConversations("agent_1");
      expect(filtered).toHaveLength(2);
      expect(filtered.every((c) => c.agentId === "agent_1")).toBe(true);
    });
  });

  describe("addMessage", () => {
    it("should add a message to a conversation", () => {
      manager.createConversation("agent_1", "conv_1");
      const msg = manager.addMessage("conv_1", "user", "Hello!");

      expect(msg).not.toBeNull();
      expect(msg?.role).toBe("user");
      expect(msg?.content).toBe("Hello!");
      expect(msg?.timestamp).toBeGreaterThan(0);
    });

    it("should return null for non-existent conversation", () => {
      const msg = manager.addMessage("nonexistent", "user", "Hello!");
      expect(msg).toBeNull();
    });

    it("should add tool call info when provided", () => {
      manager.createConversation("agent_1", "conv_1");
      const toolCall = {
        toolId: "read_file",
        parameters: { path: "/test.md" },
        result: "file content",
      };
      const msg = manager.addMessage("conv_1", "tool", "Tool result", toolCall);

      expect(msg?.toolCall).toEqual(toolCall);
    });

    it("should update conversation timestamp", () => {
      const conv = manager.createConversation("agent_1", "conv_1");
      const originalUpdatedAt = conv.updatedAt;

      manager.addMessage("conv_1", "user", "Hello!");
      const updated = manager.getConversation("conv_1");

      expect(updated?.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt);
    });
  });

  describe("getMessages", () => {
    it("should return empty array for non-existent conversation", () => {
      const messages = manager.getMessages("nonexistent");
      expect(messages).toEqual([]);
    });

    it("should return all messages in order", () => {
      manager.createConversation("agent_1", "conv_1");
      manager.addMessage("conv_1", "user", "Hello!");
      manager.addMessage("conv_1", "assistant", "Hi there!");
      manager.addMessage("conv_1", "user", "How are you?");

      const messages = manager.getMessages("conv_1");
      expect(messages).toHaveLength(3);
      expect(messages[0]?.content).toBe("Hello!");
      expect(messages[1]?.content).toBe("Hi there!");
      expect(messages[2]?.content).toBe("How are you?");
    });
  });

  describe("clearMessages", () => {
    it("should clear all messages", () => {
      manager.createConversation("agent_1", "conv_1");
      manager.addMessage("conv_1", "user", "Hello!");
      manager.addMessage("conv_1", "assistant", "Hi!");

      const result = manager.clearMessages("conv_1");
      expect(result).toBe(true);
      expect(manager.getMessages("conv_1")).toEqual([]);
    });

    it("should return false for non-existent conversation", () => {
      const result = manager.clearMessages("nonexistent");
      expect(result).toBe(false);
    });
  });

  describe("estimateTokens", () => {
    it("should estimate tokens for text", () => {
      const tokens = manager.estimateTokens("Hello, world!");
      expect(tokens).toBe(4);
    });

    it("should return 0 for empty text", () => {
      expect(manager.estimateTokens("")).toBe(0);
    });

    it("should handle long text", () => {
      const longText = "a".repeat(400);
      expect(manager.estimateTokens(longText)).toBe(100);
    });
  });

  describe("estimateConversationTokens", () => {
    it("should sum up all message tokens", () => {
      manager.createConversation("agent_1", "conv_1");
      manager.addMessage("conv_1", "user", "Hello!");
      manager.addMessage("conv_1", "assistant", "Hi there, how can I help?");

      const tokens = manager.estimateConversationTokens("conv_1");
      expect(tokens).toBeGreaterThan(0);
    });

    it("should return 0 for empty conversation", () => {
      manager.createConversation("agent_1", "conv_1");
      const tokens = manager.estimateConversationTokens("conv_1");
      expect(tokens).toBe(0);
    });
  });

  describe("getMessagesForContext", () => {
    const memoryConfig: MemoryConfig = {
      type: "conversation",
      maxMessages: 3,
      maxTokens: 100,
    };

    it("should return empty for 'none' memory type", () => {
      manager.createConversation("agent_1", "conv_1");
      manager.addMessage("conv_1", "user", "Hello!");

      const messages = manager.getMessagesForContext("conv_1", { type: "none" });
      expect(messages).toEqual([]);
    });

    it("should limit messages by maxMessages", () => {
      manager.createConversation("agent_1", "conv_1");
      manager.addMessage("conv_1", "user", "1");
      manager.addMessage("conv_1", "assistant", "2");
      manager.addMessage("conv_1", "user", "3");
      manager.addMessage("conv_1", "assistant", "4");
      manager.addMessage("conv_1", "user", "5");

      const messages = manager.getMessagesForContext("conv_1", {
        type: "conversation",
        maxMessages: 3,
        maxTokens: 1000,
      });

      expect(messages).toHaveLength(3);
      expect(messages[0]?.content).toBe("3");
    });

    it("should limit messages by maxTokens", () => {
      manager.createConversation("agent_1", "conv_1");
      manager.addMessage("conv_1", "user", "a".repeat(40));
      manager.addMessage("conv_1", "assistant", "b".repeat(40));
      manager.addMessage("conv_1", "user", "c".repeat(40));

      const messages = manager.getMessagesForContext("conv_1", {
        type: "conversation",
        maxMessages: 100,
        maxTokens: 25,
      });

      expect(messages.length).toBeLessThan(3);
    });

    it("should account for system prompt tokens", () => {
      manager.createConversation("agent_1", "conv_1");
      manager.addMessage("conv_1", "user", "a".repeat(100));

      const systemPrompt = "b".repeat(200);
      const messages = manager.getMessagesForContext(
        "conv_1",
        { type: "conversation", maxMessages: 50, maxTokens: 60 },
        systemPrompt
      );

      expect(messages).toHaveLength(0);
    });
  });

  describe("shouldTruncate", () => {
    it("should return true when messages exceed maxMessages", () => {
      manager.createConversation("agent_1", "conv_1");
      for (let i = 0; i < 10; i++) {
        manager.addMessage("conv_1", "user", `Message ${i}`);
      }

      const result = manager.shouldTruncate("conv_1", {
        type: "conversation",
        maxMessages: 5,
      });
      expect(result).toBe(true);
    });

    it("should return false when messages are under limit", () => {
      manager.createConversation("agent_1", "conv_1");
      manager.addMessage("conv_1", "user", "Hello!");

      const result = manager.shouldTruncate("conv_1", {
        type: "conversation",
        maxMessages: 50,
      });
      expect(result).toBe(false);
    });

    it("should return false for 'none' memory type", () => {
      manager.createConversation("agent_1", "conv_1");
      for (let i = 0; i < 100; i++) {
        manager.addMessage("conv_1", "user", `Message ${i}`);
      }

      const result = manager.shouldTruncate("conv_1", { type: "none" });
      expect(result).toBe(false);
    });
  });

  describe("shouldSummarize", () => {
    it("should return true when messages reach summarizeAfter", () => {
      manager.createConversation("agent_1", "conv_1");
      for (let i = 0; i < 10; i++) {
        manager.addMessage("conv_1", "user", `Message ${i}`);
      }

      const result = manager.shouldSummarize("conv_1", {
        type: "summary",
        summarizeAfter: 10,
      });
      expect(result).toBe(true);
    });

    it("should return false for non-summary type", () => {
      manager.createConversation("agent_1", "conv_1");
      for (let i = 0; i < 100; i++) {
        manager.addMessage("conv_1", "user", `Message ${i}`);
      }

      const result = manager.shouldSummarize("conv_1", {
        type: "conversation",
        summarizeAfter: 10,
      });
      expect(result).toBe(false);
    });

    it("should return false when summarizeAfter is not set", () => {
      manager.createConversation("agent_1", "conv_1");
      for (let i = 0; i < 100; i++) {
        manager.addMessage("conv_1", "user", `Message ${i}`);
      }

      const result = manager.shouldSummarize("conv_1", { type: "summary" });
      expect(result).toBe(false);
    });
  });

  describe("buildContext", () => {
    const mockAgent: AgentDefinition = {
      id: "test_agent",
      name: "Test Agent",
      tools: [],
      memory: { type: "conversation" },
      systemPrompt: "You are a test agent.",
    };

    it("should build context for existing conversation", () => {
      manager.createConversation("test_agent", "conv_1");
      const context = manager.buildContext(mockAgent, "conv_1");

      expect(context).not.toBeNull();
      expect(context?.agent).toEqual(mockAgent);
      expect(context?.conversation.id).toBe("conv_1");
      expect(context?.currentDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(context?.currentTime).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    });

    it("should return null for non-existent conversation", () => {
      const context = manager.buildContext(mockAgent, "nonexistent");
      expect(context).toBeNull();
    });
  });

  describe("formatMessagesForLLM", () => {
    it("should format messages with system prompt first", () => {
      const messages = [
        { role: "user" as const, content: "Hello!" },
        { role: "assistant" as const, content: "Hi there!" },
      ];

      const formatted = manager.formatMessagesForLLM(messages, "You are helpful.");

      expect(formatted).toHaveLength(3);
      expect(formatted[0]).toEqual({ role: "system", content: "You are helpful." });
      expect(formatted[1]).toEqual({ role: "user", content: "Hello!" });
      expect(formatted[2]).toEqual({ role: "assistant", content: "Hi there!" });
    });

    it("should handle tool messages", () => {
      const messages = [
        {
          role: "tool" as const,
          content: "",
          toolCall: {
            toolId: "read_file",
            parameters: { path: "/test.md" },
            result: "content",
          },
        },
      ];

      const formatted = manager.formatMessagesForLLM(messages, "System");

      expect(formatted[1]?.role).toBe("assistant");
      expect(formatted[1]?.content).toContain("[Tool Call: read_file]");
    });
  });

  describe("toMarkdown", () => {
    it("should convert conversation to markdown", () => {
      manager.createConversation("agent_1", "conv_1");
      manager.addMessage("conv_1", "user", "Hello!");
      manager.addMessage("conv_1", "assistant", "Hi there!");

      const markdown = manager.toMarkdown("conv_1");

      expect(markdown).toContain("### User");
      expect(markdown).toContain("Hello!");
      expect(markdown).toContain("### Assistant");
      expect(markdown).toContain("Hi there!");
    });

    it("should include system messages with header", () => {
      manager.createConversation("agent_1", "conv_1");
      manager.addMessage("conv_1", "system", "System message");

      const markdown = manager.toMarkdown("conv_1");

      expect(markdown).toContain("### System");
      expect(markdown).toContain("System message");
    });

    it("should include tool call info", () => {
      manager.createConversation("agent_1", "conv_1");
      manager.addMessage("conv_1", "tool", "", {
        toolId: "read_file",
        parameters: { path: "/test.md" },
        result: "file content",
      });

      const markdown = manager.toMarkdown("conv_1");

      expect(markdown).toContain("### Tool");
      expect(markdown).toContain("<!-- tool:read_file -->");
      expect(markdown).toContain("file content");
    });

    it("should use ISO 8601 timestamps", () => {
      manager.createConversation("agent_1", "conv_1");
      manager.addMessage("conv_1", "user", "Hello!");

      const markdown = manager.toMarkdown("conv_1");

      expect(markdown).toMatch(/\(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe("parseMarkdown", () => {
    it("should parse user and assistant messages", () => {
      const markdown = `### User
Hello!

### Assistant
Hi there!`;

      const messages = manager.parseMarkdown(markdown);

      expect(messages).toHaveLength(2);
      expect(messages[0]?.role).toBe("user");
      expect(messages[0]?.content).toBe("Hello!");
      expect(messages[1]?.role).toBe("assistant");
      expect(messages[1]?.content).toBe("Hi there!");
    });

    it("should parse system messages", () => {
      const markdown = `### System
System init message

### User
Hello!`;

      const messages = manager.parseMarkdown(markdown);

      expect(messages).toHaveLength(2);
      expect(messages[0]?.role).toBe("system");
      expect(messages[0]?.content).toBe("System init message");
    });

    it("should parse tool messages with metadata", () => {
      const markdown = `### Tool
<!-- tool:read_file -->
<!-- params:{"path":"/test.md"} -->
Result: "file content"`;

      const messages = manager.parseMarkdown(markdown);

      expect(messages).toHaveLength(1);
      expect(messages[0]?.role).toBe("tool");
      expect(messages[0]?.toolCall?.toolId).toBe("read_file");
      expect(messages[0]?.toolCall?.result).toBe("file content");
    });

    it("should handle ISO 8601 timestamps", () => {
      const markdown = `### User (2026-01-29T10:30:00.000Z)
Hello!`;

      const messages = manager.parseMarkdown(markdown);
      expect(messages).toHaveLength(1);
      expect(messages[0]?.timestamp).toBeDefined();
    });

    it("should round-trip markdown correctly", () => {
      manager.createConversation("agent_1", "conv_1");
      manager.addMessage("conv_1", "user", "Hello!");
      manager.addMessage("conv_1", "assistant", "Hi there!");
      manager.addMessage("conv_1", "system", "System note");

      const markdown = manager.toMarkdown("conv_1");
      const parsed = manager.parseMarkdown(markdown);

      expect(parsed).toHaveLength(3);
      expect(parsed[0]?.role).toBe("user");
      expect(parsed[0]?.content).toBe("Hello!");
      expect(parsed[1]?.role).toBe("assistant");
      expect(parsed[1]?.content).toBe("Hi there!");
      expect(parsed[2]?.role).toBe("system");
      expect(parsed[2]?.content).toBe("System note");
    });
  });

  describe("export/import", () => {
    it("should export conversation to JSON", () => {
      manager.createConversation("agent_1", "conv_1");
      manager.addMessage("conv_1", "user", "Hello!");

      const json = manager.exportConversation("conv_1");

      expect(json).not.toBeNull();
      const parsed = JSON.parse(json!);
      expect(parsed.id).toBe("conv_1");
      expect(parsed.agentId).toBe("agent_1");
      expect(parsed.messages).toHaveLength(1);
    });

    it("should return null for non-existent conversation", () => {
      const json = manager.exportConversation("nonexistent");
      expect(json).toBeNull();
    });

    it("should import conversation from JSON", () => {
      const json = JSON.stringify({
        id: "imported_conv",
        agentId: "agent_1",
        messages: [{ role: "user", content: "Hello!" }],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const conv = manager.importConversation(json);

      expect(conv).not.toBeNull();
      expect(conv?.id).toBe("imported_conv");
      expect(manager.getConversation("imported_conv")).toBeDefined();
    });

    it("should return null for invalid JSON", () => {
      const result = manager.importConversation("invalid json");
      expect(result).toBeNull();
    });

    it("should return null for incomplete data", () => {
      const result = manager.importConversation('{"id": "test"}');
      expect(result).toBeNull();
    });
  });
});
