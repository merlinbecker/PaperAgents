/**
 * CanvasModal - UI for the Agent Canvas feature.
 *
 * Allows the user to:
 * 1. Select an agent (or auto-selects from document frontmatter)
 * 2. Start a canvas session with the active document as context
 * 3. See streaming agent responses
 * 4. Send follow-up messages that appear as callouts in the document
 */

import { App, Modal, Notice, TFile } from "obsidian";
import type { AgentDefinition } from "../types";
import { ConversationManager } from "../core/conversation";
import { CanvasAgent } from "../core/canvas-agent";
import { Orchestrator } from "../core/orchestrator";
import { globalLogger } from "../utils/logger";

export class CanvasModal extends Modal {
  private readonly agents: AgentDefinition[];
  private readonly conversationManager: ConversationManager;
  private readonly canvasAgent: CanvasAgent;
  private readonly getOrchestrator: () => Orchestrator | null;

  private selectedAgent: AgentDefinition | null = null;
  private activeFile: TFile | null = null;
  private conversationId: string | null = null;
  private isStreaming = false;

  // UI elements
  private agentSelectEl: HTMLSelectElement | null = null;
  private startBtn: HTMLButtonElement | null = null;
  private inputEl: HTMLTextAreaElement | null = null;
  private sendBtn: HTMLButtonElement | null = null;
  private responseContainer: HTMLElement | null = null;
  private streamingEl: HTMLElement | null = null;
  private conversationPanel: HTMLElement | null = null;

  constructor(
    app: App,
    agents: AgentDefinition[],
    conversationManager: ConversationManager,
    getOrchestrator: () => Orchestrator | null
  ) {
    super(app);
    this.agents = agents;
    this.conversationManager = conversationManager;
    this.canvasAgent = new CanvasAgent(app);
    this.getOrchestrator = getOrchestrator;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("pa-canvas-modal");

    this.activeFile = this.canvasAgent.getActiveFile();

    this.renderHeader();
    this.renderAgentSelection();
    this.renderConversationPanel();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  // ============================================================================
  // Render helpers
  // ============================================================================

  private renderHeader(): void {
    const header = this.contentEl.createDiv({ cls: "pa-canvas-header" });
    header.createEl("h2", { text: "🖊️ Agent Canvas" });

    if (this.activeFile) {
      header.createEl("p", {
        cls: "pa-canvas-file-hint",
        text: `Document: ${this.activeFile.basename}`,
      });
    } else {
      header.createEl("p", {
        cls: "pa-canvas-no-file",
        text: "⚠️ No active Markdown document found. Open a document first.",
      });
    }
  }

  private renderAgentSelection(): void {
    if (!this.activeFile) return;

    const section = this.contentEl.createDiv({ cls: "pa-canvas-agent-selection" });

    // Try to resolve agent from frontmatter
    const autoAgentId = this.tryResolveAgentFromFrontmatter();
    if (autoAgentId) {
      const resolved = this.canvasAgent.resolveAgent(autoAgentId, this.agents);
      if (resolved) {
        this.selectedAgent = resolved;
        section.createEl("p", {
          cls: "pa-canvas-auto-agent",
          text: `Agent from frontmatter: ${resolved.name}`,
        });
        this.renderStartButton(section);
        return;
      }
    }

    if (this.agents.length === 0) {
      section.createEl("p", {
        cls: "pa-canvas-no-agents",
        text: "⚠️ No agents loaded. Add agent definition files first.",
      });
      return;
    }

    // Manual agent selection
    const row = section.createDiv({ cls: "pa-canvas-agent-row" });
    row.createEl("label", { text: "Select agent:", attr: { for: "pa-canvas-agent-select" } });

    this.agentSelectEl = row.createEl("select", { cls: "pa-canvas-agent-select" });
    this.agentSelectEl.id = "pa-canvas-agent-select";

    for (const agent of this.agents) {
      const opt = this.agentSelectEl.createEl("option", { text: agent.name, value: agent.id });
      opt.value = agent.id;
    }

    this.selectedAgent = this.agents[0] ?? null;

    this.agentSelectEl.addEventListener("change", () => {
      const id = this.agentSelectEl?.value ?? "";
      this.selectedAgent = this.canvasAgent.resolveAgent(id, this.agents);
    });

    this.renderStartButton(section);
  }

  private renderStartButton(container: HTMLElement): void {
    const row = container.createDiv({ cls: "pa-canvas-start-row" });
    this.startBtn = row.createEl("button", {
      cls: "pa-canvas-start-btn mod-cta",
      text: "Start canvas session",
    });
    this.startBtn.addEventListener("click", () => { void this.startSession(); });
  }

  private renderConversationPanel(): void {
    this.conversationPanel = this.contentEl.createDiv({ cls: "pa-canvas-conversation" });
    this.conversationPanel.style.display = "none";

    this.responseContainer = this.conversationPanel.createDiv({ cls: "pa-canvas-responses" });
    this.streamingEl = this.conversationPanel.createDiv({ cls: "pa-canvas-streaming" });
    this.streamingEl.style.display = "none";

    const inputRow = this.conversationPanel.createDiv({ cls: "pa-canvas-input-row" });
    this.inputEl = inputRow.createEl("textarea", {
      cls: "pa-canvas-input",
      attr: { placeholder: "Send a follow-up message…", rows: "3" },
    });
    this.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        void this.sendFollowUp();
      }
    });

    this.sendBtn = inputRow.createEl("button", {
      cls: "pa-canvas-send-btn",
      text: "Send (Ctrl+Enter)",
    });
    this.sendBtn.addEventListener("click", () => { void this.sendFollowUp(); });
  }

  // ============================================================================
  // Session logic
  // ============================================================================

  private async startSession(): Promise<void> {
    const orchestrator = this.getOrchestrator();

    if (!orchestrator) {
      new Notice("No orchestrator available. Please configure your OpenRouter API key in settings.");
      return;
    }

    if (!this.selectedAgent) {
      new Notice("Please select an agent.");
      return;
    }

    if (!this.activeFile) {
      new Notice("No active document. Open a Markdown file first.");
      return;
    }

    // Disable start button to prevent double-click
    if (this.startBtn) {
      this.startBtn.disabled = true;
      this.startBtn.textContent = "Starting…";
    }

    try {
      const content = await this.canvasAgent.readFile(this.activeFile);
      const docContext = this.canvasAgent.buildDocumentContext(content);
      const initialPrompt = this.canvasAgent.buildInitialPrompt(docContext);

      // Create conversation
      const conversation = this.conversationManager.createConversation(this.selectedAgent.id);
      this.conversationId = conversation.id;

      // Show conversation panel
      if (this.conversationPanel) {
        this.conversationPanel.style.display = "block";
      }

      await this.sendToAgent(orchestrator, initialPrompt);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      new Notice(`Canvas session failed: ${msg}`);
      globalLogger.error("Canvas session error", { error: msg });

      if (this.startBtn) {
        this.startBtn.disabled = false;
        this.startBtn.textContent = "Start canvas session";
      }
    }
  }

  private async sendFollowUp(): Promise<void> {
    if (this.isStreaming) return;

    const orchestrator = this.getOrchestrator();
    if (!orchestrator || !this.conversationId || !this.selectedAgent || !this.activeFile) return;

    const message = this.inputEl?.value.trim() ?? "";
    if (!message) return;

    if (this.inputEl) this.inputEl.value = "";

    // Append user callout to document and capture callout text for dismissal
    let userCalloutText: string | undefined;
    try {
      userCalloutText = await this.canvasAgent.appendUserCallout(this.activeFile, message);
    } catch (error) {
      globalLogger.warn("Failed to append user callout", { error });
    }

    this.addMessageToDisplay("user", message, userCalloutText);

    await this.sendToAgent(orchestrator, message);
  }

  private async sendToAgent(orchestrator: Orchestrator, message: string): Promise<void> {
    if (!this.conversationId || !this.selectedAgent || !this.activeFile) return;

    this.isStreaming = true;
    if (this.sendBtn) this.sendBtn.disabled = true;

    let streamBuffer = "";

    if (this.streamingEl) {
      this.streamingEl.style.display = "block";
      this.streamingEl.textContent = "🤖 Thinking…";
    }

    try {
      let completedContent = "";

      await orchestrator.sendMessage(
        this.selectedAgent,
        this.conversationId,
        message,
        {
          onToken: (token: string) => {
            streamBuffer += token;
            if (this.streamingEl) {
              this.streamingEl.textContent = streamBuffer;
            }
          },
          onComplete: (content: string) => {
            completedContent = content;
            if (this.streamingEl) {
              this.streamingEl.style.display = "none";
              this.streamingEl.textContent = "";
            }
            streamBuffer = "";
          },
          onError: (error: Error) => {
            new Notice(`Agent error: ${error.message}`);
            if (this.streamingEl) {
              this.streamingEl.style.display = "none";
            }
          },
        }
      );

      // Append agent callout to document and display it with dismiss support
      const agentName = this.selectedAgent.name;
      if (completedContent && this.activeFile) {
        const calloutText = await this.canvasAgent.appendAgentCallout(
          this.activeFile,
          agentName,
          completedContent
        );
        this.addMessageToDisplay("assistant", completedContent, calloutText);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      new Notice(`Agent error: ${msg}`);
      globalLogger.error("Canvas agent error", { error: msg });
    } finally {
      this.isStreaming = false;
      if (this.sendBtn) this.sendBtn.disabled = false;
      if (this.startBtn) {
        this.startBtn.disabled = false;
        this.startBtn.textContent = "Restart session";
      }
    }
  }

  // ============================================================================
  // UI helpers
  // ============================================================================

  private addMessageToDisplay(role: "user" | "assistant", content: string, calloutText?: string): void {
    if (!this.responseContainer) return;

    const entry = this.responseContainer.createDiv({
      cls: `pa-canvas-message pa-canvas-message-${role}`,
    });

    const header = entry.createDiv({ cls: "pa-canvas-message-header" });
    const label = role === "user" ? "👤 You" : `🤖 ${this.selectedAgent?.name ?? "Agent"}`;
    header.createEl("strong", { text: label });

    if (calloutText && this.activeFile) {
      const file = this.activeFile;
      const dismissBtn = header.createEl("button", {
        cls: "pa-canvas-dismiss-btn",
        text: "🗑️",
        attr: { title: "Remove this callout from the document" },
      });
      dismissBtn.addEventListener("click", () => {
        void this.dismissCallout(file, calloutText, entry);
      });
    }

    entry.createEl("p", { text: content });
  }

  private async dismissCallout(file: TFile, calloutText: string, entryEl: HTMLElement): Promise<void> {
    try {
      const removed = await this.canvasAgent.removeCallout(file, calloutText);
      if (removed) {
        entryEl.remove();
      } else {
        new Notice("Callout not found in document – it may have been deleted already.");
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      new Notice(`Failed to remove callout: ${msg}`);
      globalLogger.error("Canvas dismissal error", { error: msg });
    }
  }

  private tryResolveAgentFromFrontmatter(): string | null {
    if (!this.activeFile) return null;

    // Use Obsidian's MetadataCache for the frontmatter if available, then fall
    // back to a manual read via the vault (which we do synchronously using the
    // cached content already present in MetadataCache).
    const cache = this.app.metadataCache.getFileCache(this.activeFile);
    if (cache?.frontmatter) {
      const val = cache.frontmatter["paper-agent"];
      if (typeof val === "string" && val.trim()) {
        return val.trim();
      }
    }
    return null;
  }
}
