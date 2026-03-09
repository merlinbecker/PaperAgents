import { describe, it, expect, beforeEach } from "vitest";
import { ConversationFileManager } from "../../../src/core/conversation-file-manager";
import { ConversationManager } from "../../../src/core/conversation";
import { App } from "../../mocks/obsidian";

describe("ConversationFileManager", () => {
  let app: App;
  let manager: ConversationManager;
  let fileManager: ConversationFileManager;

  beforeEach(() => {
    app = new App();
    manager = new ConversationManager();
    fileManager = new ConversationFileManager(app as any, manager);
  });

  describe("constructor", () => {
    it("should accept a ConversationManager instance", () => {
      expect(fileManager).toBeDefined();
    });
  });

  describe("saveConversation", () => {
    it("should save a conversation to a new file", async () => {
      manager.createConversation("agent_1", "conv_1");
      manager.addMessage("conv_1", "user", "Hello!");

      await fileManager.saveConversation("convs/test.md", "conv_1");

      const file = app.vault.getAbstractFileByPath("convs/test.md");
      expect(file).not.toBeNull();

      const content = await app.vault.read(file as any);
      expect(content).toContain("conversation: true");
      expect(content).toContain("id: conv_1");
      expect(content).toContain("agentId: agent_1");
      expect(content).toContain("Hello!");
    });

    it("should overwrite an existing file", async () => {
      manager.createConversation("agent_1", "conv_2");
      manager.addMessage("conv_2", "user", "First message");

      await fileManager.saveConversation("convs/test2.md", "conv_2");
      manager.addMessage("conv_2", "assistant", "Second message");
      await fileManager.saveConversation("convs/test2.md", "conv_2");

      const file = app.vault.getAbstractFileByPath("convs/test2.md");
      const content = await app.vault.read(file as any);
      expect(content).toContain("First message");
      expect(content).toContain("Second message");
    });

    it("should throw if the conversation ID does not exist", async () => {
      await expect(
        fileManager.saveConversation("convs/missing.md", "nonexistent_id")
      ).rejects.toThrow("Conversation not found: nonexistent_id");
    });

    it("should use the injected ConversationManager, not a global singleton", async () => {
      // Create a separate manager to simulate the "global singleton" scenario
      const otherManager = new ConversationManager();
      otherManager.createConversation("agent_x", "conv_x");

      // The fileManager uses `manager`, not `otherManager`
      // so `conv_x` should NOT be found
      await expect(
        fileManager.saveConversation("convs/other.md", "conv_x")
      ).rejects.toThrow("Conversation not found: conv_x");
    });
  });

  describe("loadConversation", () => {
    it("should load a conversation from a vault file", async () => {
      const fileContent = `---
conversation: true
id: conv_loaded
agentId: agent_load
createdAt: 2026-01-01T10:00:00.000Z
updatedAt: 2026-01-01T10:05:00.000Z
---

### User (2026-01-01T10:00:00.000Z)
Loaded message
`;
      await app.vault.create("convs/loaded.md", fileContent);

      const conv = await fileManager.loadConversation("convs/loaded.md");

      expect(conv).not.toBeNull();
      expect(conv?.id).toBe("conv_loaded");
      expect(conv?.agentId).toBe("agent_load");
      expect(conv?.messages).toHaveLength(1);
      expect(conv?.messages[0]?.content).toBe("Loaded message");

      // The conversation should now be in the injected manager
      expect(manager.getConversation("conv_loaded")).toBeDefined();
    });

    it("should return null for non-conversation files", async () => {
      await app.vault.create("notes/regular.md", "Just a regular note\nNo frontmatter");

      const result = await fileManager.loadConversation("notes/regular.md");
      expect(result).toBeNull();
    });

    it("should throw if the file does not exist", async () => {
      await expect(
        fileManager.loadConversation("convs/nonexistent.md")
      ).rejects.toThrow("File not found: convs/nonexistent.md");
    });
  });

  describe("createConversationFile", () => {
    it("should create a markdown file for an existing conversation", async () => {
      manager.createConversation("agent_1", "conv_create");

      const filePath = await fileManager.createConversationFile(
        "conv_create",
        "paper-agents-conversations",
        "My Agent"
      );

      expect(filePath).toMatch(/^paper-agents-conversations\//);
      expect(filePath).toMatch(/\.md$/);
      expect(filePath).toContain("My-Agent");

      const file = app.vault.getAbstractFileByPath(filePath);
      expect(file).not.toBeNull();
      const content = await app.vault.read(file as any);
      expect(content).toContain("conversation: true");
      expect(content).toContain("id: conv_create");
    });

    it("should use the agent ID as filename base when no title provided", async () => {
      manager.createConversation("research_assistant", "conv_notitle");

      const filePath = await fileManager.createConversationFile(
        "conv_notitle",
        "paper-agents-conversations"
      );

      expect(filePath).toContain("research_assistant");
    });

    it("should throw if the conversation does not exist", async () => {
      await expect(
        fileManager.createConversationFile(
          "nonexistent_id",
          "paper-agents-conversations",
          "Test"
        )
      ).rejects.toThrow("Conversation not found: nonexistent_id");
    });

    it("should NOT create a second conversation in the manager", async () => {
      manager.createConversation("agent_1", "conv_single");

      await fileManager.createConversationFile(
        "conv_single",
        "paper-agents-conversations",
        "Agent"
      );

      // Only the original conversation should exist
      const all = manager.listConversations();
      expect(all).toHaveLength(1);
      expect(all[0]?.id).toBe("conv_single");
    });
  });

  describe("isConversationFile", () => {
    it("should return true for a valid conversation file", async () => {
      await app.vault.create("convs/conv.md", `---
conversation: true
id: c1
---
`);

      const result = await fileManager.isConversationFile("convs/conv.md");
      expect(result).toBe(true);
    });

    it("should return false for a regular markdown file", async () => {
      await app.vault.create("notes/note.md", "# Just a note\nNo frontmatter");
      const result = await fileManager.isConversationFile("notes/note.md");
      expect(result).toBe(false);
    });

    it("should return false for a non-existent file", async () => {
      const result = await fileManager.isConversationFile("nonexistent/path.md");
      expect(result).toBe(false);
    });
  });

  describe("listConversationFiles", () => {
    it("should return empty array for a non-existent folder", () => {
      const result = fileManager.listConversationFiles("nonexistent-folder");
      expect(result).toEqual([]);
    });

    it("should return markdown files sorted by title", async () => {
      await app.vault.create("chat-convs/2026-01-01-Beta.md", "content");
      await app.vault.create("chat-convs/2026-01-01-Alpha.md", "content");

      const result = fileManager.listConversationFiles("chat-convs");

      expect(result).toHaveLength(2);
      expect(result[0]?.title).toBe("2026-01-01-Alpha");
      expect(result[1]?.title).toBe("2026-01-01-Beta");
    });

    it("should return path and title (basename without extension) for each file", async () => {
      await app.vault.create("my-convs/2026-03-01-Test.md", "content");

      const result = fileManager.listConversationFiles("my-convs");

      expect(result).toHaveLength(1);
      expect(result[0]?.path).toBe("my-convs/2026-03-01-Test.md");
      expect(result[0]?.title).toBe("2026-03-01-Test");
    });

    it("should return files created via createConversationFile", async () => {
      manager.createConversation("agent_1", "conv_list_test");

      await fileManager.createConversationFile("conv_list_test", "list-convs", "My Agent");

      const result = fileManager.listConversationFiles("list-convs");

      expect(result).toHaveLength(1);
      expect(result[0]?.title).toContain("My-Agent");
    });
  });

  describe("round-trip: createConversationFile → saveConversation → loadConversation", () => {
    it("should persist and reload messages correctly", async () => {
      manager.createConversation("round_trip_agent", "conv_rt");
      manager.addMessage("conv_rt", "user", "Hello from round trip!");
      manager.addMessage("conv_rt", "assistant", "Reply from round trip!");

      const filePath = await fileManager.createConversationFile(
        "conv_rt",
        "rt-convs",
        "RoundTripAgent"
      );

      // Load into a fresh manager
      const manager2 = new ConversationManager();
      const fileManager2 = new ConversationFileManager(app as any, manager2);

      const loaded = await fileManager2.loadConversation(filePath);

      expect(loaded).not.toBeNull();
      expect(loaded?.agentId).toBe("round_trip_agent");
      expect(loaded?.messages).toHaveLength(2);
      expect(loaded?.messages[0]?.content).toBe("Hello from round trip!");
      expect(loaded?.messages[1]?.content).toBe("Reply from round trip!");
    });

    it("should restore base64 for read_binary_file tool results when loading", async () => {
      // Simulate a binary file in the vault
      await app.vault.create("pdfs/sample.pdf", "fake-pdf-content");

      // Add a conversation with a read_binary_file result (base64 in memory)
      manager.createConversation("ocr_agent", "conv_binary");
      manager.addMessage("conv_binary", "user", "OCR this PDF");
      manager.addMessage("conv_binary", "tool", "", {
        toolId: "read_binary_file",
        parameters: { filePath: "pdfs/sample.pdf" },
        result: { filePath: "pdfs/sample.pdf", base64: "originalbase64", mimeType: "application/pdf", size: 100 },
      });

      const filePath = await fileManager.createConversationFile("conv_binary", "rt-convs", "OcrAgent");

      // Verify base64 was NOT written to the markdown
      const file = app.vault.getAbstractFileByPath(filePath);
      const savedContent = await app.vault.read(file as any);
      expect(savedContent).not.toContain("originalbase64");
      expect(savedContent).toContain("[[pdfs/sample.pdf]]");
      expect(savedContent).toContain("_binaryRef");

      // Load into a fresh manager — binary should be restored from vault
      const manager2 = new ConversationManager();
      const fileManager2 = new ConversationFileManager(app as any, manager2);
      const loaded = await fileManager2.loadConversation(filePath);

      expect(loaded?.messages).toHaveLength(2);
      const toolMsg = loaded?.messages[1];
      expect(toolMsg?.role).toBe("tool");
      const result = toolMsg?.toolCall?.result as Record<string, unknown>;
      // base64 should be restored (re-read from vault mock which encodes text as UTF-8)
      expect(result["base64"]).toBeDefined();
      expect(typeof result["base64"]).toBe("string");
      // _binaryRef should be cleaned up from the in-memory result
      expect(result["_binaryRef"]).toBeUndefined();
    });

    it("should gracefully handle a missing binary file during restore", async () => {
      // Conversation references a file that doesn't exist in the vault
      const fileContent = `---
conversation: true
id: conv_missing_binary
agentId: ocr_agent
createdAt: 2026-01-01T10:00:00.000Z
updatedAt: 2026-01-01T10:05:00.000Z
---

### User (2026-01-01T10:00:00.000Z)
OCR please

### Tool (2026-01-01T10:01:00.000Z)
<!-- tool:read_binary_file -->
<!-- params:{"filePath":"nonexistent/file.pdf"} -->
[[nonexistent/file.pdf]]
Result: ${JSON.stringify({ filePath: "nonexistent/file.pdf", mimeType: "application/pdf", size: 100, _binaryRef: "nonexistent/file.pdf" })}
`;
      await app.vault.create("rt-convs/missing.md", fileContent);

      // Loading should not throw; the message is loaded without base64
      const loaded = await fileManager.loadConversation("rt-convs/missing.md");
      expect(loaded).not.toBeNull();
      expect(loaded?.messages).toHaveLength(2);
      const toolMsg = loaded?.messages[1];
      const result = toolMsg?.toolCall?.result as Record<string, unknown>;
      // _binaryRef stays since restore failed, base64 absent
      expect(result["base64"]).toBeUndefined();
    });
  });
});
