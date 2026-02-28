/**
 * ChatView - Obsidian ItemView for agent conversations
 *
 * Displays messages from a conversation Markdown file and allows the user to
 * send new messages. Every change is persisted back to the Markdown file so the
 * conversation is always readable and editable outside this view as well.
 *
 * LLM integration (OpenRouter) is prepared but intentionally left as a stub
 * until Phase 4.3 is complete. Messages sent by the user are stored immediately;
 * the assistant response will be populated once the LLM layer is wired up.
 */

import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import { conversationManager } from "../core/conversation";
import { ConversationFileManager } from "../core/conversation-file-manager";
import type { Conversation, Message } from "../types";
import { globalLogger } from "../utils/logger";

export const VIEW_TYPE_CHAT = "paper-agents-chat-file";

export class ChatView extends ItemView {
  private conversation: Conversation | null = null;
  private filePath: string | null = null;
  private fileManager: ConversationFileManager;

  private messagesEl: HTMLElement | null = null;
  private inputEl: HTMLTextAreaElement | null = null;
  private sendBtn: HTMLButtonElement | null = null;
  private headerTitleEl: HTMLElement | null = null;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    this.fileManager = new ConversationFileManager(this.app, conversationManager);
  }

  getViewType(): string {
    return VIEW_TYPE_CHAT;
  }

  getDisplayText(): string {
    if (this.filePath) {
      const parts = this.filePath.split("/");
      const fileName = parts[parts.length - 1] || "Chat";
      return fileName.replace(/\.md$/, "");
    }
    return "Chat";
  }

  getIcon(): string {
    return "message-square";
  }

  async onOpen(): Promise<void> {
    this.buildUI();
    globalLogger.debug("ChatView opened");
  }

  async onClose(): Promise<void> {
    globalLogger.debug("ChatView closed");
  }

  /**
   * Load a conversation from a vault file and render it.
   * Called by the plugin when a conversation file is opened.
   */
  async loadFile(filePath: string): Promise<void> {
    this.filePath = filePath;

    try {
      const loaded = await this.fileManager.loadConversation(filePath);
      if (!loaded) {
        new Notice("Not a conversation file");
        return;
      }
      this.conversation = loaded;
      this.renderMessages();
      if (this.headerTitleEl) {
        this.headerTitleEl.setText(this.getDisplayText());
      }
      globalLogger.info(`ChatView loaded conversation ${loaded.id} from ${filePath}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      new Notice(`Failed to load conversation: ${msg}`);
      globalLogger.error("ChatView load failed", { error });
    }
  }

  // ============================================================================
  // UI Building
  // ============================================================================

  private buildUI(): void {
    const container = this.containerEl.children[1] as HTMLElement;
    if (!container) return;

    container.empty();
    container.addClass("pa-chat-container");

    // Header
    const header = container.createDiv({ cls: "pa-chat-header" });
    this.headerTitleEl = header.createEl("span", {
      text: this.getDisplayText(),
      cls: "pa-chat-title",
    });

    const agentBadge = header.createEl("span", { cls: "pa-chat-agent-badge" });
    if (this.conversation) {
      agentBadge.setText(this.conversation.agentId);
    }

    // Messages area
    this.messagesEl = container.createDiv({ cls: "pa-chat-messages" });

    // Input area
    const inputArea = container.createDiv({ cls: "pa-chat-input-area" });

    this.inputEl = inputArea.createEl("textarea", {
      cls: "pa-chat-input",
      attr: { placeholder: "Type your message… (Ctrl+Enter to send)" },
    });

    this.inputEl.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        void this.handleSend();
      }
    });

    this.sendBtn = inputArea.createEl("button", {
      text: "Send",
      cls: "pa-chat-send-btn",
    });

    this.sendBtn.addEventListener("click", () => { void this.handleSend(); });

    if (this.conversation) {
      this.renderMessages();
    } else {
      this.renderEmptyState();
    }
  }

  private renderEmptyState(): void {
    if (!this.messagesEl) return;
    this.messagesEl.empty();

    const empty = this.messagesEl.createDiv({ cls: "pa-chat-empty" });
    empty.createEl("p", {
      text: "No conversation loaded.",
      cls: "pa-chat-empty-text",
    });
    empty.createEl("p", {
      text: 'Open a conversation file (with "conversation: true" frontmatter) to start chatting.',
      cls: "pa-chat-empty-hint",
    });
  }

  private renderMessages(): void {
    if (!this.messagesEl || !this.conversation) return;
    this.messagesEl.empty();

    const messages = conversationManager.getMessages(this.conversation.id);

    if (messages.length === 0) {
      const empty = this.messagesEl.createDiv({ cls: "pa-chat-empty" });
      empty.createEl("p", {
        text: "No messages yet. Start the conversation!",
        cls: "pa-chat-empty-text",
      });
      return;
    }

    for (const msg of messages) {
      this.renderMessage(msg);
    }

    // Scroll to bottom
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  private renderMessage(msg: Message): void {
    if (!this.messagesEl) return;

    const bubble = this.messagesEl.createDiv({
      cls: `pa-chat-bubble pa-chat-bubble-${msg.role}`,
    });

    const roleLine = bubble.createDiv({ cls: "pa-chat-bubble-role" });

    const roleLabels: Record<string, string> = {
      user: "You",
      assistant: "Assistant",
      system: "System",
      tool: "Tool",
    };
    roleLine.createSpan({ text: roleLabels[msg.role] || msg.role });

    if (msg.timestamp) {
      const d = new Date(msg.timestamp);
      const ts = `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
      roleLine.createSpan({ text: ` · ${ts}`, cls: "pa-chat-bubble-ts" });
    }

    const content = bubble.createDiv({ cls: "pa-chat-bubble-content" });

    if (msg.role === "tool" && msg.toolCall) {
      content.createEl("code", {
        text: `[Tool: ${msg.toolCall.toolId}]`,
        cls: "pa-chat-tool-id",
      });
      if (msg.toolCall.result !== undefined) {
        content.createEl("pre", {
          text: JSON.stringify(msg.toolCall.result, null, 2),
          cls: "pa-chat-tool-result",
        });
      }
    } else {
      // Render content preserving line breaks
      const lines = msg.content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        content.appendText(lines[i] ?? "");
        if (i < lines.length - 1) {
          content.createEl("br");
        }
      }
    }
  }

  // ============================================================================
  // Send Logic
  // ============================================================================

  private async handleSend(): Promise<void> {
    if (!this.inputEl || !this.conversation) return;

    const text = this.inputEl.value.trim();
    if (!text) return;

    this.inputEl.value = "";
    this.setInputEnabled(false);

    try {
      // Add user message
      conversationManager.addMessage(this.conversation.id, "user", text);
      this.renderMessages();

      // Persist to file immediately after user message
      if (this.filePath) {
        await this.fileManager.saveConversation(this.filePath, this.conversation.id);
      }

      // TODO (Phase 4.3): Call OpenRouter LLM here and add assistant response.
      // For now, add a placeholder notice.
      new Notice("Message saved. Language model integration coming in phase 4.3.");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      new Notice(`Failed to send message: ${msg}`);
      globalLogger.error("ChatView send failed", { error });
    } finally {
      this.setInputEnabled(true);
      this.inputEl?.focus();
    }
  }

  private setInputEnabled(enabled: boolean): void {
    if (this.inputEl) this.inputEl.disabled = !enabled;
    if (this.sendBtn) this.sendBtn.disabled = !enabled;
  }

  /**
   * Reload the conversation from file (e.g. after external edits).
   */
  async reload(): Promise<void> {
    if (this.filePath) {
      await this.loadFile(this.filePath);
    }
  }
}
