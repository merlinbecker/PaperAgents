import { ItemView, WorkspaceLeaf } from "obsidian";
import { AgentDefinition, Message } from "../types";
import { ConversationManager } from "../core/conversation";
import { Orchestrator, OrchestratorCallbacks } from "../core/orchestrator";
import { globalLogger } from "../utils/logger";

export const VIEW_TYPE_PAPER_AGENTS_CHAT = "paper-agents-chat";

export class PaperAgentsChatView extends ItemView {
  private agents: AgentDefinition[] = [];
  private selectedAgent: AgentDefinition | null = null;
  private conversationManager: ConversationManager;
  private orchestrator: Orchestrator | null = null;
  private currentConversationId: string | null = null;
  private isStreaming = false;

  private messagesContainer: HTMLElement | null = null;
  private inputEl: HTMLTextAreaElement | null = null;
  private sendBtn: HTMLElement | null = null;
  private agentSelect: HTMLSelectElement | null = null;
  private streamingEl: HTMLElement | null = null;

  private onGetAgents: () => AgentDefinition[];
  private onGetOrchestrator: () => Orchestrator | null;

  constructor(
    leaf: WorkspaceLeaf,
    conversationManager: ConversationManager,
    getAgents: () => AgentDefinition[],
    getOrchestrator: () => Orchestrator | null
  ) {
    super(leaf);
    this.conversationManager = conversationManager;
    this.onGetAgents = getAgents;
    this.onGetOrchestrator = getOrchestrator;
  }

  getViewType(): string {
    return VIEW_TYPE_PAPER_AGENTS_CHAT;
  }

  getDisplayText(): string {
    return "Paper Agents Chat";
  }

  getIcon(): string {
    return "message-circle";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    if (!container) return;

    container.empty();
    container.addClass("pa-chat-container");

    this.renderHeader(container as HTMLElement);
    this.renderMessages(container as HTMLElement);
    this.renderInput(container as HTMLElement);

    this.refreshAgents();
  }

  async onClose(): Promise<void> {
    this.containerEl.empty();
  }

  refreshAgents(): void {
    this.agents = this.onGetAgents();
    this.orchestrator = this.onGetOrchestrator();
    this.updateAgentSelect();
  }

  private renderHeader(container: HTMLElement): void {
    const header = container.createDiv({ cls: "pa-chat-header" });

    header.createEl("h3", { cls: "pa-chat-title", text: "Agent Chat" });

    const controls = header.createDiv({ cls: "pa-chat-controls" });

    this.agentSelect = controls.createEl("select", { cls: "pa-chat-agent-select" });
    this.agentSelect.addEventListener("change", () => {
      this.onAgentSelected();
    });

    const newChatBtn = controls.createEl("button", {
      cls: "pa-chat-new-btn",
      text: "New Chat",
    });
    newChatBtn.addEventListener("click", () => {
      this.startNewConversation();
    });

    this.updateAgentSelect();
  }

  private renderMessages(container: HTMLElement): void {
    this.messagesContainer = container.createDiv({ cls: "pa-chat-messages" });

    const placeholder = this.messagesContainer.createDiv({ cls: "pa-chat-placeholder" });
    placeholder.createEl("p", { text: "Select an agent and start chatting" });
  }

  private renderInput(container: HTMLElement): void {
    const inputArea = container.createDiv({ cls: "pa-chat-input-area" });

    this.inputEl = inputArea.createEl("textarea", {
      cls: "pa-chat-input",
      attr: { placeholder: "Type your message... (Enter to send, Shift+Enter for newline)", rows: "3" },
    });

    this.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    this.sendBtn = inputArea.createEl("button", {
      cls: "pa-chat-send-btn",
      text: "Send",
    });
    this.sendBtn.addEventListener("click", () => {
      this.sendMessage();
    });
  }

  private updateAgentSelect(): void {
    if (!this.agentSelect) return;

    this.agentSelect.empty();

    const defaultOpt = this.agentSelect.createEl("option", {
      text: "-- Select Agent --",
      attr: { value: "" },
    });
    if (!this.selectedAgent) defaultOpt.selected = true;

    for (const agent of this.agents) {
      const opt = this.agentSelect.createEl("option", {
        text: agent.name,
        attr: { value: agent.id },
      });
      if (this.selectedAgent?.id === agent.id) opt.selected = true;
    }
  }

  private onAgentSelected(): void {
    if (!this.agentSelect) return;

    const agentId = this.agentSelect.value;
    this.selectedAgent = this.agents.find((a) => a.id === agentId) || null;

    if (this.selectedAgent) {
      // Try to resume the most recent existing conversation for this agent
      const existingConvs = this.conversationManager
        .listConversations(this.selectedAgent.id)
        .sort((a, b) => b.updatedAt - a.updatedAt);

      if (existingConvs.length > 0 && existingConvs[0]) {
        this.currentConversationId = existingConvs[0].id;
        this.restoreConversationUI(existingConvs[0].id);
      } else {
        this.startNewConversation();
      }
    }
  }

  private startNewConversation(): void {
    if (!this.selectedAgent) return;

    const conv = this.conversationManager.createConversation(this.selectedAgent.id);
    this.currentConversationId = conv.id;

    this.clearMessages();
    this.addSystemMessage(`Started new conversation with ${this.selectedAgent.name}`);
  }

  private restoreConversationUI(conversationId: string): void {
    this.clearMessages();

    const messages = this.conversationManager.getMessages(conversationId);
    for (const msg of messages) {
      if (msg.role === "tool" && msg.toolCall) {
        this.addToolCallToUI(msg.toolCall.toolId, msg.toolCall.parameters, true);
        this.addToolCallToUI(
          msg.toolCall.toolId,
          {},
          false,
          msg.toolCall.result,
          msg.toolCall.error
        );
      } else {
        this.addMessageToUI(msg.role, msg.content);
      }
    }

    if (messages.length === 0) {
      this.addSystemMessage(`Resumed conversation with ${this.selectedAgent?.name}`);
    }
  }

  private async sendMessage(): Promise<void> {
    if (!this.inputEl || !this.selectedAgent || !this.currentConversationId || this.isStreaming) return;

    const message = this.inputEl.value.trim();
    if (!message) return;

    this.orchestrator = this.onGetOrchestrator();
    if (!this.orchestrator) {
      this.addSystemMessage("OpenRouter not configured. Please set your API key in Settings.");
      return;
    }

    this.inputEl.value = "";
    this.addMessageToUI("user", message);
    this.setStreaming(true);

    this.streamingEl = this.addStreamingIndicator();

    const callbacks: OrchestratorCallbacks = {
      onToken: (token) => {
        this.appendToStreaming(token);
      },
      onToolCallStart: (toolId, params) => {
        this.addToolCallToUI(toolId, params, true);
      },
      onToolCallEnd: (toolId, result, error) => {
        this.addToolCallToUI(toolId, {}, false, result, error);
      },
      onError: (error) => {
        this.addErrorMessage(error);
      },
    };

    try {
      await this.orchestrator.sendMessage(
        this.selectedAgent,
        this.currentConversationId,
        message,
        callbacks
      );
    } catch (error) {
      globalLogger.error("Chat send error", { error });
      this.addErrorMessage(error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.finalizeStreaming();
      this.setStreaming(false);
    }
  }

  private addMessageToUI(role: string, content: string): void {
    if (!this.messagesContainer) return;

    const placeholder = this.messagesContainer.querySelector(".pa-chat-placeholder");
    if (placeholder) placeholder.remove();

    const msgEl = this.messagesContainer.createDiv({ cls: `pa-chat-message pa-chat-message-${role}` });

    const roleEl = msgEl.createDiv({ cls: "pa-chat-message-role" });
    roleEl.textContent = role === "user" ? "You" : role === "assistant" ? "Assistant" : "System";

    const contentEl = msgEl.createDiv({ cls: "pa-chat-message-content" });
    contentEl.textContent = content;

    this.scrollToBottom();
  }

  private addSystemMessage(content: string): void {
    this.addMessageToUI("system", content);
  }

  /**
   * Classifies an error and displays a user-friendly message in the chat.
   */
  private addErrorMessage(error: Error): void {
    const msg = error.message.toLowerCase();
    let userMessage: string;

    if (msg.includes("timeout") || msg.includes("aborted")) {
      userMessage = "Request timed out. The model may be overloaded — please try again in a moment.";
    } else if (msg.includes("rate limit") || msg.includes("429")) {
      userMessage = "Rate limit reached. Please wait a few seconds before sending another message.";
    } else if (msg.includes("401") || msg.includes("unauthorized") || msg.includes("invalid api key")) {
      userMessage = "API key is invalid or missing. Check your key in **Settings → Paper Agents**.";
    } else if (msg.includes("network") || msg.includes("fetch") || msg.includes("econnrefused") || msg.includes("enotfound")) {
      userMessage = "Network error — could not reach the API. Check your internet connection.";
    } else if (msg.includes("402") || msg.includes("insufficient")) {
      userMessage = "Insufficient credits on your OpenRouter account.";
    } else if (msg.includes("model") && msg.includes("not found")) {
      userMessage = "The selected model is unavailable. Try a different model in settings.";
    } else {
      userMessage = `Error: ${error.message}`;
    }

    if (!this.messagesContainer) return;

    const placeholder = this.messagesContainer.querySelector(".pa-chat-placeholder");
    if (placeholder) placeholder.remove();

    const msgEl = this.messagesContainer.createDiv({ cls: "pa-chat-message pa-chat-message-error" });
    msgEl.createDiv({ cls: "pa-chat-message-role", text: "Error" });
    const contentEl = msgEl.createDiv({ cls: "pa-chat-message-content" });
    contentEl.textContent = userMessage;

    this.scrollToBottom();
  }

  private addToolCallToUI(
    toolId: string,
    params: Record<string, unknown>,
    isStart: boolean,
    result?: unknown,
    error?: string
  ): void {
    if (!this.messagesContainer) return;

    if (isStart) {
      const toolEl = this.messagesContainer.createDiv({ cls: "pa-chat-tool-call" });
      const details = toolEl.createEl("details");
      const summary = details.createEl("summary");
      summary.createSpan({ text: `🔧 Calling: ${toolId}` });
      summary.createSpan({ cls: "pa-chat-tool-status pa-chat-tool-running", text: " (running...)" });

      const content = details.createDiv({ cls: "pa-chat-tool-content" });
      content.createEl("h4", { text: "Parameters" });
      const pre = content.createEl("pre");
      pre.createEl("code", { text: JSON.stringify(params, null, 2) });

      toolEl.setAttribute("data-tool-id", toolId);
    } else {
      const toolEls = this.messagesContainer.querySelectorAll(`.pa-chat-tool-call[data-tool-id="${toolId}"]`);
      const toolEl = toolEls[toolEls.length - 1] as HTMLElement | undefined;
      if (!toolEl) return;

      const statusEl = toolEl.querySelector(".pa-chat-tool-status");
      if (statusEl) {
        statusEl.textContent = error ? " (failed)" : " (done)";
        statusEl.removeClass("pa-chat-tool-running");
        statusEl.addClass(error ? "pa-chat-tool-error" : "pa-chat-tool-success");
      }

      const content = toolEl.querySelector(".pa-chat-tool-content");
      if (content) {
        if (error) {
          (content as HTMLElement).createEl("h4", { text: "Error" });
          (content as HTMLElement).createDiv({ cls: "pa-output-error-box", text: error });
        } else if (result !== undefined) {
          (content as HTMLElement).createEl("h4", { text: "Result" });
          const pre = (content as HTMLElement).createEl("pre");
          pre.createEl("code", {
            text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
          });
        }
      }
    }

    this.scrollToBottom();
  }

  private addStreamingIndicator(): HTMLElement {
    if (!this.messagesContainer) return document.createElement("div");

    const msgEl = this.messagesContainer.createDiv({
      cls: "pa-chat-message pa-chat-message-assistant pa-chat-streaming",
    });

    msgEl.createDiv({ cls: "pa-chat-message-role", text: "Assistant" });
    msgEl.createDiv({ cls: "pa-chat-message-content" });

    this.scrollToBottom();
    return msgEl;
  }

  private appendToStreaming(token: string): void {
    if (!this.streamingEl) return;

    const content = this.streamingEl.querySelector(".pa-chat-message-content");
    if (content) {
      content.textContent = (content.textContent || "") + token;
    }
    this.scrollToBottom();
  }

  private finalizeStreaming(): void {
    if (this.streamingEl) {
      this.streamingEl.removeClass("pa-chat-streaming");
      this.streamingEl = null;
    }
  }

  private clearMessages(): void {
    if (this.messagesContainer) {
      this.messagesContainer.empty();
    }
  }

  private setStreaming(streaming: boolean): void {
    this.isStreaming = streaming;
    if (this.sendBtn) {
      if (streaming) {
        this.sendBtn.addClass("pa-chat-send-disabled");
        this.sendBtn.textContent = "...";
      } else {
        this.sendBtn.removeClass("pa-chat-send-disabled");
        this.sendBtn.textContent = "Send";
      }
    }
    if (this.inputEl) {
      (this.inputEl as HTMLTextAreaElement).disabled = streaming;
    }
  }

  private scrollToBottom(): void {
    if (this.messagesContainer) {
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }
  }
}
