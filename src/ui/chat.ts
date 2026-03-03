import { ItemView, WorkspaceLeaf, Notice, TFile } from "obsidian";
import { AgentDefinition, WebSearchAnnotation } from "../types";
import { ConversationManager } from "../core/conversation";
import { ConversationFileManager } from "../core/conversation-file-manager";
import { Orchestrator, OrchestratorCallbacks } from "../core/orchestrator";
import { globalLogger } from "../utils/logger";

export const VIEW_TYPE_PAPER_AGENTS_CHAT = "paper-agents-chat";

export class PaperAgentsChatView extends ItemView {
  private agents: AgentDefinition[] = [];
  private selectedAgent: AgentDefinition | null = null;
  private conversationManager: ConversationManager;
  private fileManager: ConversationFileManager;
  private currentConversationId: string | null = null;
  private currentFilePath: string | null = null;
  private isStreaming = false;
  private isSaving = false;

  private messagesContainer: HTMLElement | null = null;
  private inputEl: HTMLTextAreaElement | null = null;
  private sendBtn: HTMLElement | null = null;
  private resendBtn: HTMLButtonElement | null = null;
  private conversationSelect: HTMLSelectElement | null = null;
  private newChatPanel: HTMLElement | null = null;
  private agentSelectEl: HTMLSelectElement | null = null;
  private createConvBtn: HTMLButtonElement | null = null;
  private noAgentsHint: HTMLElement | null = null;
  private streamingEl: HTMLElement | null = null;

  private onGetAgents: () => AgentDefinition[];
  private onGetOrchestrator: () => Orchestrator | null;
  private getConversationsPath: () => string;

  constructor(
    leaf: WorkspaceLeaf,
    conversationManager: ConversationManager,
    getAgents: () => AgentDefinition[],
    getOrchestrator: () => Orchestrator | null,
    getConversationsPath: () => string
  ) {
    super(leaf);
    this.conversationManager = conversationManager;
    this.fileManager = new ConversationFileManager(this.app, this.conversationManager);
    this.onGetAgents = getAgents;
    this.onGetOrchestrator = getOrchestrator;
    this.getConversationsPath = getConversationsPath;
  }

  getViewType(): string {
    return VIEW_TYPE_PAPER_AGENTS_CHAT;
  }

  getDisplayText(): string {
    return "Paper agents chat";
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

    this.refreshConversations();
    await this.autoLoadMostRecentConversation();
    this.registerVaultEvents();
  }

  async onClose(): Promise<void> {
    this.containerEl.empty();
  }

  // ============================================================================
  // Vault events
  // ============================================================================

  private registerVaultEvents(): void {
    const isInConversationsFolder = (path: string) =>
      path.startsWith(this.getConversationsPath() + "/");

    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (
          !this.isSaving &&
          file instanceof TFile &&
          file.extension === "md" &&
          file.path === this.currentFilePath
        ) {
          void this.reloadCurrentConversation();
        }
      })
    );
    this.registerEvent(
      this.app.vault.on("create", (file) => {
        if (file instanceof TFile && file.extension === "md" && isInConversationsFolder(file.path)) {
          this.refreshConversations();
        }
      })
    );
    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (file instanceof TFile && isInConversationsFolder(file.path)) {
          this.refreshConversations();
        }
      })
    );
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        if (file instanceof TFile) {
          if (oldPath === this.currentFilePath) this.currentFilePath = file.path;
          if (isInConversationsFolder(file.path) || isInConversationsFolder(oldPath)) {
            this.refreshConversations();
          }
        }
      })
    );
  }

  // ============================================================================
  // Conversations list
  // ============================================================================

  private refreshConversations(): void {
    const files = this.fileManager.listConversationFiles(this.getConversationsPath());
    this.updateConversationSelect(files);
  }

  private updateConversationSelect(files: { path: string; title: string }[]): void {
    if (!this.conversationSelect) return;

    const currentValue = this.currentFilePath;
    this.conversationSelect.empty();

    const placeholder = this.conversationSelect.createEl("option", {
      text: "-- select conversation --",
      attr: { value: "" },
    });

    for (const f of files) {
      const opt = this.conversationSelect.createEl("option", { text: f.title, attr: { value: f.path } });
      if (f.path === currentValue) opt.selected = true;
    }

    if (!currentValue) placeholder.selected = true;
  }

  private async onConversationSelected(): Promise<void> {
    if (!this.conversationSelect) return;
    const path = this.conversationSelect.value;
    if (path) {
      await this.selectConversationFile(path);
    } else {
      this.currentConversationId = null;
      this.currentFilePath = null;
      this.clearMessages();
    }
  }

  async selectConversationFile(filePath: string): Promise<void> {
    try {
      const conv = await this.fileManager.loadConversation(filePath);
      if (!conv) { new Notice("Not a conversation file"); return; }

      this.currentConversationId = conv.id;
      this.currentFilePath = filePath;
      this.agents = this.onGetAgents();
      this.selectedAgent = this.agents.find((a) => a.id === conv.agentId) ?? null;

      if (this.conversationSelect) this.conversationSelect.value = filePath;
      this.restoreConversationUI(conv.id);
      globalLogger.info(`Loaded conversation ${conv.id} from ${filePath}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      new Notice(`Failed to load conversation: ${msg}`);
      globalLogger.error("Failed to load conversation from file", { error });
    }
  }

  private async reloadCurrentConversation(): Promise<void> {
    if (this.currentFilePath) await this.selectConversationFile(this.currentFilePath);
  }

  private async autoLoadMostRecentConversation(): Promise<void> {
    const files = this.fileManager.listConversationFiles(this.getConversationsPath());
    const mostRecent = files[files.length - 1];
    if (mostRecent) await this.selectConversationFile(mostRecent.path);
  }

  // ============================================================================
  // UI Building
  // ============================================================================

  private renderHeader(container: HTMLElement): void {
    const header = container.createDiv({ cls: "pa-chat-header" });
    header.createEl("h3", { cls: "pa-chat-title", text: "Agent chat" });

    const controls = header.createDiv({ cls: "pa-chat-controls" });
    this.conversationSelect = controls.createEl("select", { cls: "pa-chat-conversation-select" });
    this.conversationSelect.addEventListener("change", () => void this.onConversationSelected());

    controls.createEl("button", { cls: "pa-chat-new-btn", text: "New chat" })
      .addEventListener("click", () => this.toggleNewChatPanel());

    this.newChatPanel = header.createDiv({ cls: "pa-chat-new-panel" });
    this.newChatPanel.style.display = "none";

    const panelLabel = this.newChatPanel.createEl("span", { text: "Agent: ", cls: "pa-chat-new-label" });
    panelLabel.style.marginRight = "4px";

    this.agentSelectEl = this.newChatPanel.createEl("select", { cls: "pa-chat-agent-select" });

    this.noAgentsHint = this.newChatPanel.createEl("span", {
      cls: "pa-chat-no-agents-hint",
      text: "No agents loaded. Reload agents in the sidebar first.",
    });
    this.noAgentsHint.style.display = "none";

    this.createConvBtn = this.newChatPanel.createEl("button", { cls: "pa-chat-create-btn", text: "Create" });
    this.createConvBtn.addEventListener("click", () => void this.createNewConversation());

    this.newChatPanel.createEl("button", { cls: "pa-chat-cancel-btn", text: "Cancel" })
      .addEventListener("click", () => this.hideNewChatPanel());

    this.updateAgentSelectOptions();
  }

  private toggleNewChatPanel(): void {
    this.agents = this.onGetAgents();
    this.updateAgentSelectOptions();
    if (this.newChatPanel) {
      this.newChatPanel.style.display = this.newChatPanel.style.display === "none" ? "" : "none";
    }
  }

  private hideNewChatPanel(): void {
    if (this.newChatPanel) this.newChatPanel.style.display = "none";
  }

  private updateAgentSelectOptions(): void {
    if (!this.agentSelectEl) return;
    this.agentSelectEl.empty();

    if (this.agents.length === 0) {
      this.agentSelectEl.style.display = "none";
      if (this.noAgentsHint) this.noAgentsHint.style.display = "";
      if (this.createConvBtn) this.createConvBtn.disabled = true;
      return;
    }

    this.agentSelectEl.style.display = "";
    if (this.noAgentsHint) this.noAgentsHint.style.display = "none";
    if (this.createConvBtn) this.createConvBtn.disabled = false;

    const defaultOpt = this.agentSelectEl.createEl("option", { text: "-- select agent --", attr: { value: "" } });
    if (!this.selectedAgent) defaultOpt.selected = true;

    for (const agent of this.agents) {
      const opt = this.agentSelectEl.createEl("option", { text: agent.name, attr: { value: agent.id } });
      if (this.selectedAgent?.id === agent.id) opt.selected = true;
    }
  }

  private renderMessages(container: HTMLElement): void {
    this.messagesContainer = container.createDiv({ cls: "pa-chat-messages" });
    this.messagesContainer.createDiv({ cls: "pa-chat-placeholder" })
      .createEl("p", { text: "Select a conversation or create a new one" });
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
        void this.sendMessage();
      }
    });

    const btnGroup = inputArea.createDiv({ cls: "pa-chat-btn-group" });

    this.resendBtn = btnGroup.createEl("button", {
      cls: "pa-chat-resend-btn",
      text: "↺",
      attr: { title: "Resend conversation history to LLM (no new message)" },
    });
    this.resendBtn.addEventListener("click", () => void this.continueChat());

    this.sendBtn = btnGroup.createEl("button", { cls: "pa-chat-send-btn", text: "Send" });
    this.sendBtn.addEventListener("click", () => void this.sendMessage());
  }

  // ============================================================================
  // New conversation
  // ============================================================================

  private async createNewConversation(): Promise<void> {
    if (!this.agentSelectEl) return;

    const agentSelect = this.agentSelectEl;
    const agent = this.agents.find((a) => a.id === agentSelect.value);
    if (!agent) { new Notice("Please select an agent first"); return; }

    this.selectedAgent = agent;
    this.hideNewChatPanel();

    const conv = this.conversationManager.createConversation(agent.id);
    this.currentConversationId = conv.id;
    this.currentFilePath = null;
    this.clearMessages();

    try {
      const filePath = await this.fileManager.createConversationFile(conv.id, this.getConversationsPath(), agent.name);
      this.currentFilePath = filePath;
      this.refreshConversations();
      if (this.conversationSelect) this.conversationSelect.value = filePath;
      globalLogger.info(`Created new conversation file: ${filePath}`);
    } catch (error) {
      globalLogger.error("Failed to create conversation file", { error });
    }
  }

  // ============================================================================
  // Message rendering
  // ============================================================================

  private restoreConversationUI(conversationId: string): void {
    this.clearMessages();

    const messages = this.conversationManager.getMessages(conversationId);
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]!;
      if (msg.role === "tool" && msg.toolCall) {
        this.addToolCallToUI(msg.toolCall.toolId, msg.toolCall.parameters, true);
        this.addToolCallToUI(msg.toolCall.toolId, {}, false, msg.toolCall.result, msg.toolCall.error);
      } else {
        this.addMessageToUI(msg.role, msg.content, i);
      }
    }

    if (messages.length === 0) {
      this.messagesContainer?.createDiv({ cls: "pa-chat-placeholder" })
        .createEl("p", { text: "No messages yet. Start the conversation!" });
    }
  }

  // ============================================================================
  // Send logic
  // ============================================================================

  private makeCallbacks(): OrchestratorCallbacks {
    return {
      onToken: (token) => this.appendToStreaming(token),
      onToolCallStart: (toolId, params) => this.addToolCallToUI(toolId, params, true),
      onToolCallEnd: (toolId, result, error) => this.addToolCallToUI(toolId, {}, false, result, error),
      onAnnotations: (annotations) => this.addAnnotationsToStreaming(annotations),
      onError: (error) => this.addErrorMessage(error),
    };
  }

  /**
   * Shared LLM round: guards, streaming setup, delegates to action, saves and re-renders.
   */
  private async runLLMOperation(
    action: (orch: Orchestrator, agent: AgentDefinition, convId: string) => Promise<void | string>,
    errorContext: string
  ): Promise<void> {
    const { selectedAgent, currentConversationId } = this;
    if (!selectedAgent || !currentConversationId || this.isStreaming) return;

    const orchestrator = this.onGetOrchestrator();
    if (!orchestrator) {
      this.addSystemMessage("OpenRouter not configured. Please set your API key in Settings.");
      return;
    }

    this.setStreaming(true);
    this.streamingEl = this.addStreamingIndicator();

    try {
      await action(orchestrator, selectedAgent, currentConversationId);
      await this.saveConversation();
      this.streamingEl = null;
      this.restoreConversationUI(currentConversationId);
    } catch (error) {
      globalLogger.error(errorContext, { error });
      this.addErrorMessage(error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.finalizeStreaming();
      this.setStreaming(false);
    }
  }

  private async sendMessage(): Promise<void> {
    if (!this.inputEl || !this.selectedAgent || !this.currentConversationId || this.isStreaming) return;

    const message = this.inputEl.value.trim();
    if (!message) return;

    this.inputEl.value = "";
    this.addMessageToUI("user", message);

    await this.runLLMOperation(
      (orch, agent, convId) => orch.sendMessage(agent, convId, message, this.makeCallbacks()),
      "Chat send error"
    );
  }

  private async continueChat(): Promise<void> {
    await this.runLLMOperation(
      (orch, agent, convId) => orch.continueConversation(agent, convId, this.makeCallbacks()),
      "Continue chat error"
    );
  }

  private async regenerateFrom(messageIndex: number): Promise<void> {
    if (!this.currentConversationId) return;
    this.conversationManager.truncateMessages(this.currentConversationId, messageIndex);
    this.restoreConversationUI(this.currentConversationId);

    await this.runLLMOperation(
      (orch, agent, convId) => orch.continueConversation(agent, convId, this.makeCallbacks()),
      "Regenerate error"
    );
  }

  private async saveConversation(): Promise<void> {
    if (!this.currentConversationId || !this.currentFilePath) return;
    try {
      this.isSaving = true;
      await this.fileManager.saveConversation(this.currentFilePath, this.currentConversationId);
    } catch (error) {
      new Notice("Failed to save conversation to file");
      globalLogger.error("Failed to save conversation", { error });
    } finally {
      this.isSaving = false;
    }
  }

  // ============================================================================
  // UI helpers
  // ============================================================================

  private removePlaceholder(): void {
    this.messagesContainer?.querySelector(".pa-chat-placeholder")?.remove();
  }

  private addMessageToUI(role: string, content: string, messageIndex?: number): void {
    if (!this.messagesContainer) return;
    this.removePlaceholder();

    const msgEl = this.messagesContainer.createDiv({ cls: `pa-chat-message pa-chat-message-${role}` });
    const roleRow = msgEl.createDiv({ cls: "pa-chat-message-role-row" });
    const roleEl = roleRow.createDiv({ cls: "pa-chat-message-role" });
    roleEl.textContent = role === "user" ? "You" : role === "assistant" ? "Assistant" : "System";

    if (role === "assistant" && messageIndex !== undefined) {
      const regenBtn = roleRow.createEl("button", {
        cls: "pa-chat-regen-btn",
        text: "↺",
        attr: { title: "Regenerate this answer" },
      });
      regenBtn.addEventListener("click", () => void this.regenerateFrom(messageIndex));
    }

    msgEl.createDiv({ cls: "pa-chat-message-content" }).textContent = content;
    this.scrollToBottom();
  }

  private addSystemMessage(content: string): void {
    this.addMessageToUI("system", content);
  }

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
    this.removePlaceholder();

    const msgEl = this.messagesContainer.createDiv({ cls: "pa-chat-message pa-chat-message-error" });
    msgEl.createDiv({ cls: "pa-chat-message-role", text: "Error" });
    msgEl.createDiv({ cls: "pa-chat-message-content" }).textContent = userMessage;
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
      content.createEl("pre").createEl("code", { text: JSON.stringify(params, null, 2) });

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

      const content = toolEl.querySelector(".pa-chat-tool-content") as HTMLElement | null;
      if (content) {
        if (error) {
          content.createEl("h4", { text: "Error" });
          content.createDiv({ cls: "pa-output-error-box", text: error });
        } else if (result !== undefined) {
          content.createEl("h4", { text: "Result" });
          content.createEl("pre").createEl("code", {
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

  private addAnnotationsToStreaming(annotations: WebSearchAnnotation[]): void {
    if (!this.streamingEl) return;
    const citations = annotations
      .filter((a) => a.type === "url_citation" && a.url_citation?.url)
      .map((a) => ({
        url: a.url_citation!.url,
        title: a.url_citation!.title,
      }));
    if (citations.length === 0) return;

    const citationsDiv = this.streamingEl.createDiv({ cls: "pa-chat-annotations" });
    citationsDiv.createDiv({ cls: "pa-chat-annotations-label", text: "Sources:" });
    for (const c of citations) {
      const link = citationsDiv.createEl("a", {
        cls: "pa-chat-annotation-link",
        attr: { href: c.url, target: "_blank", rel: "noopener noreferrer" },
        text: c.title || c.url,
      });
      link.title = c.url;
    }
    this.scrollToBottom();
  }

  private appendToStreaming(token: string): void {
    if (!this.streamingEl) return;
    const content = this.streamingEl.querySelector(".pa-chat-message-content");
    if (content) content.textContent = (content.textContent || "") + token;
    this.scrollToBottom();
  }

  private finalizeStreaming(): void {
    if (this.streamingEl) {
      this.streamingEl.removeClass("pa-chat-streaming");
      this.streamingEl = null;
    }
  }

  private clearMessages(): void {
    this.messagesContainer?.empty();
  }

  private setStreaming(streaming: boolean): void {
    this.isStreaming = streaming;
    if (this.sendBtn) {
      if (streaming) {
        this.sendBtn.textContent = "...";
        this.sendBtn.addClass("pa-chat-send-disabled");
      } else {
        this.sendBtn.textContent = "Send";
        this.sendBtn.removeClass("pa-chat-send-disabled");
      }
    }
    if (this.resendBtn) this.resendBtn.disabled = streaming;
    if (this.inputEl) this.inputEl.disabled = streaming;
  }

  private scrollToBottom(): void {
    if (this.messagesContainer) {
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }
  }
}

