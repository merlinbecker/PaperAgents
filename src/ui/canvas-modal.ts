/**
 * CanvasModal - UI for the Agent Canvas feature.
 *
 * Allows the user to:
 * 1. Select an agent (or auto-selects from document frontmatter)
 * 2. Start a canvas session with the active document as context
 *    OR load a document from the configured canvas Markdown folder
 * 3. See streaming agent responses
 * 4. Send follow-up messages that appear as callouts in the document
 * 5. Re-run the document analysis for a follow-up pass
 */

import { App, Modal, Notice, TFile, TFolder } from "obsidian";
import type { AgentDefinition } from "../types";
import { ConversationManager } from "../core/conversation";
import { CanvasAgent } from "../core/canvas-agent";
import { Orchestrator } from "../core/orchestrator";
import { globalLogger } from "../utils/logger";

const logger = globalLogger.createLogger("CanvasModal");

export interface CanvasModalSettings {
  canvasMarkdownPath?: string;
  canvasSystemPromptFile?: string;
}

export class CanvasModal extends Modal {
  private readonly agents: AgentDefinition[];
  private readonly conversationManager: ConversationManager;
  private readonly canvasAgent: CanvasAgent;
  private readonly getOrchestrator: () => Orchestrator | null;
  private readonly canvasSettings: CanvasModalSettings;

  private selectedAgent: AgentDefinition | null = null;
  private selectedAgents: AgentDefinition[] = [];
  private multiAgentMode = false;
  private activeFile: TFile | null = null;
  private activeSelection: string | null = null;
  private conversationId: string | null = null;
  private isStreaming = false;
  private originalDocumentContent: string | null = null;
  private sessionStarted = false;

  // UI elements
  private agentSelectEl: HTMLSelectElement | null = null;
  private startBtn: HTMLButtonElement | null = null;
  private rerunBtn: HTMLButtonElement | null = null;
  private inputEl: HTMLTextAreaElement | null = null;
  private sendBtn: HTMLButtonElement | null = null;
  private responseContainer: HTMLElement | null = null;
  private streamingEl: HTMLElement | null = null;
  private conversationPanel: HTMLElement | null = null;
  private diffSection: HTMLElement | null = null;

  constructor(
    app: App,
    agents: AgentDefinition[],
    conversationManager: ConversationManager,
    getOrchestrator: () => Orchestrator | null,
    canvasSettings: CanvasModalSettings = {}
  ) {
    super(app);
    this.agents = agents;
    this.conversationManager = conversationManager;
    this.canvasAgent = new CanvasAgent(app);
    this.getOrchestrator = getOrchestrator;
    this.canvasSettings = canvasSettings;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("pa-canvas-modal");

    this.activeFile = this.canvasAgent.getActiveFile();
    this.activeSelection = this.canvasAgent.getActiveEditorSelection();

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

    if (this.activeSelection) {
      const charCount = this.activeSelection.length;
      header.createEl("p", {
        cls: "pa-canvas-selection-hint",
        text: `✂️ Using selected text as context (${charCount} chars)`,
      });
    }

    // Canvas Markdown folder picker
    this.renderCanvasFilePicker(header);
  }

  /**
   * Renders a file picker showing Markdown files from the configured canvas folder.
   * When the user selects a file and clicks "Load", it becomes the active file.
   */
  private renderCanvasFilePicker(container: HTMLElement): void {
    const folderPath = this.canvasSettings.canvasMarkdownPath;
    if (!folderPath) return;

    const folder = this.app.vault.getAbstractFileByPath(folderPath);
    if (!(folder instanceof TFolder)) return;

    const mdFiles: TFile[] = [];
    this.collectMdFiles(folder, mdFiles);
    if (mdFiles.length === 0) return;

    const pickerRow = container.createDiv({ cls: "pa-canvas-file-picker" });
    pickerRow.createEl("label", {
      text: `📂 Load from canvas folder (${folderPath}):`,
      cls: "pa-canvas-file-picker-label",
    });

    const select = pickerRow.createEl("select", { cls: "pa-canvas-file-picker-select" });
    select.createEl("option", { text: "— select a file —", value: "" });
    for (const f of mdFiles) {
      select.createEl("option", { text: f.basename, value: f.path });
    }

    const loadBtn = pickerRow.createEl("button", {
      cls: "pa-canvas-file-picker-btn",
      text: "Load",
    });
    loadBtn.addEventListener("click", () => {
      const selectedPath = select.value;
      if (!selectedPath) return;
      const file = this.app.vault.getAbstractFileByPath(selectedPath);
      if (file instanceof TFile) {
        this.activeFile = file;
        // Update header hint
        const hint = container.querySelector(".pa-canvas-file-hint, .pa-canvas-no-file");
        if (hint) {
          hint.textContent = `Document: ${file.basename}`;
          hint.className = "pa-canvas-file-hint";
        }
        new Notice(`Loaded: ${file.basename}`);
        // Re-render agent selection (it was skipped when no active file)
        const existingSelection = this.contentEl.querySelector(".pa-canvas-agent-selection");
        if (!existingSelection) {
          this.renderAgentSelection();
        }
      }
    });
  }

  private collectMdFiles(folder: TFolder, results: TFile[]): void {
    for (const child of folder.children) {
      if (child instanceof TFile && child.extension === "md") {
        results.push(child);
      } else if (child instanceof TFolder) {
        this.collectMdFiles(child, results);
      }
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
        this.selectedAgents = [resolved];
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

    // Multi-agent toggle (only when there are multiple agents)
    if (this.agents.length > 1) {
      const toggleRow = section.createDiv({ cls: "pa-canvas-multi-toggle-row" });
      const toggleLabel = toggleRow.createEl("label", { cls: "pa-canvas-multi-toggle-label" });
      const toggleCheckbox = toggleLabel.createEl("input", { type: "checkbox" });
      toggleCheckbox.type = "checkbox";
      toggleLabel.appendText(" Multi-agent mode");
      toggleCheckbox.addEventListener("change", () => {
        this.multiAgentMode = toggleCheckbox.checked;
        this.renderAgentSelectionBody(section, singleRow, multiRow);
      });
    }

    const singleRow = section.createDiv({ cls: "pa-canvas-agent-row" });
    const multiRow = section.createDiv({ cls: "pa-canvas-multi-agent" });

    this.renderAgentSelectionBody(section, singleRow, multiRow);

    this.renderStartButton(section);
  }

  private renderAgentSelectionBody(
    _section: HTMLElement,
    singleRow: HTMLElement,
    multiRow: HTMLElement
  ): void {
    singleRow.empty();
    multiRow.empty();

    if (this.multiAgentMode) {
      singleRow.style.display = "none";
      multiRow.style.display = "block";

      // Checkbox list for every agent
      multiRow.createEl("p", { cls: "pa-canvas-multi-hint", text: "Select agents to run sequentially:" });
      this.selectedAgents = [];

      for (const agent of this.agents) {
        const row = multiRow.createDiv({ cls: "pa-canvas-agent-checkbox-row" });
        const lbl = row.createEl("label");
        const cb = lbl.createEl("input", { type: "checkbox" });
        cb.type = "checkbox";
        lbl.appendText(` ${agent.name}`);

        cb.addEventListener("change", () => {
          if (cb.checked) {
            this.selectedAgents.push(agent);
          } else {
            this.selectedAgents = this.selectedAgents.filter((a) => a.id !== agent.id);
          }
        });
      }

      // In multi-agent mode selectedAgent is unused; we use selectedAgents
      this.selectedAgent = null;
    } else {
      singleRow.style.display = "flex";
      multiRow.style.display = "none";

      singleRow.createEl("label", { text: "Select agent:", attr: { for: "pa-canvas-agent-select" } });
      this.agentSelectEl = singleRow.createEl("select", { cls: "pa-canvas-agent-select" });
      this.agentSelectEl.id = "pa-canvas-agent-select";

      for (const agent of this.agents) {
        this.agentSelectEl.createEl("option", { text: agent.name, value: agent.id });
      }

      this.selectedAgent = this.agents[0] ?? null;
      this.selectedAgents = this.selectedAgent ? [this.selectedAgent] : [];

      this.agentSelectEl.addEventListener("change", () => {
        const id = this.agentSelectEl?.value ?? "";
        this.selectedAgent = this.canvasAgent.resolveAgent(id, this.agents);
        this.selectedAgents = this.selectedAgent ? [this.selectedAgent] : [];
      });
    }
  }

  private renderStartButton(container: HTMLElement): void {
    const row = container.createDiv({ cls: "pa-canvas-start-row" });
    const label = this.activeSelection ? "Analyze selection" : "Start canvas session";
    this.startBtn = row.createEl("button", {
      cls: "pa-canvas-start-btn mod-cta",
      text: label,
    });
    this.startBtn.addEventListener("click", () => {
      if (this.multiAgentMode) {
        void this.startMultiAgentSession();
      } else {
        void this.startSession();
      }
    });
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

    // Re-run button (hidden until first session completes)
    const rerunRow = this.conversationPanel.createDiv({ cls: "pa-canvas-rerun-row" });
    this.rerunBtn = rerunRow.createEl("button", {
      cls: "pa-canvas-rerun-btn",
      text: "🔄 Re-run document analysis (follow-up)",
      attr: { title: "Re-read the current document and run the agent again as a follow-up pass" },
    });
    this.rerunBtn.style.display = "none";
    this.rerunBtn.addEventListener("click", () => { void this.rerunForFollowUp(); });

    // Diff section (hidden until session started)
    this.diffSection = this.contentEl.createDiv({ cls: "pa-canvas-diff-section" });
    this.diffSection.style.display = "none";
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
      let initialPrompt: string;
      if (this.activeSelection) {
        initialPrompt = this.canvasAgent.buildSelectionPrompt(this.activeSelection);
      } else {
        const content = await this.canvasAgent.readFile(this.activeFile);
        this.originalDocumentContent = content;
        const docContext = this.canvasAgent.buildDocumentContext(content);
        const systemPrompt = await this.loadSystemPrompt();
        initialPrompt = systemPrompt
          ? this.canvasAgent.buildInitialPromptWithSystem(docContext, systemPrompt)
          : this.canvasAgent.buildInitialPrompt(docContext);
      }

      // Create conversation
      const conversation = this.conversationManager.createConversation(this.selectedAgent.id);
      this.conversationId = conversation.id;

      // Show conversation panel and diff button
      if (this.conversationPanel) {
        this.conversationPanel.style.display = "block";
      }
      this.renderDiffButton();

      await this.sendToAgent(orchestrator, initialPrompt);
      this.sessionStarted = true;
      if (this.rerunBtn) this.rerunBtn.style.display = "block";
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      new Notice(`Canvas session failed: ${msg}`);
      logger.error("Canvas session error", { error: msg });

      if (this.startBtn) {
        this.startBtn.disabled = false;
        this.startBtn.textContent = "Start canvas session";
      }
    }
  }

  /**
   * Runs all selected agents sequentially against the active document.
   * Each agent gets its own conversation and appends its callouts independently.
   */
  private async startMultiAgentSession(): Promise<void> {
    const orchestrator = this.getOrchestrator();

    if (!orchestrator) {
      new Notice("No orchestrator available. Please configure your OpenRouter API key in settings.");
      return;
    }

    if (this.selectedAgents.length === 0) {
      new Notice("Please select at least one agent.");
      return;
    }

    if (!this.activeFile) {
      new Notice("No active document. Open a Markdown file first.");
      return;
    }

    if (this.startBtn) {
      this.startBtn.disabled = true;
      this.startBtn.textContent = "Running…";
    }

    try {
      const content = await this.canvasAgent.readFile(this.activeFile);
      this.originalDocumentContent = content;
      const docContext = this.canvasAgent.buildDocumentContext(content);

      // Show conversation panel
      if (this.conversationPanel) {
        this.conversationPanel.style.display = "block";
      }
      this.renderDiffButton();

      // Run each selected agent sequentially
      for (const agent of this.selectedAgents) {
        const initialPrompt = this.canvasAgent.buildInitialPrompt(docContext);
        const conversation = this.conversationManager.createConversation(agent.id);
        this.conversationId = conversation.id;
        this.selectedAgent = agent;

        if (this.responseContainer) {
          this.responseContainer.createEl("p", {
            cls: "pa-canvas-agent-separator",
            text: `── Running: ${agent.name} ──`,
          });
        }

        await this.sendToAgent(orchestrator, initialPrompt);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      new Notice(`Multi-agent session failed: ${msg}`);
      logger.error("Multi-agent canvas error", { error: msg });
    } finally {
      if (this.startBtn) {
        this.startBtn.disabled = false;
        this.startBtn.textContent = "Run all agents";
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
      logger.warn("Failed to append user callout", { error });
    }

    this.addMessageToDisplay("user", message, userCalloutText);

    await this.sendToAgent(orchestrator, message);
  }

  /**
   * Re-reads the active document, strips existing canvas callouts, and sends
   * the cleaned content to the agent again as a follow-up pass. This allows
   * the user to iterate on the document after applying earlier annotations.
   */
  private async rerunForFollowUp(): Promise<void> {
    if (this.isStreaming) return;

    const orchestrator = this.getOrchestrator();
    if (!orchestrator || !this.selectedAgent || !this.activeFile) {
      new Notice("Cannot re-run: no active session or document.");
      return;
    }

    if (this.rerunBtn) {
      this.rerunBtn.disabled = true;
      this.rerunBtn.textContent = "🔄 Re-running…";
    }

    try {
      const content = await this.canvasAgent.readFile(this.activeFile);
      const docContext = this.canvasAgent.buildDocumentContext(content);
      const systemPrompt = await this.loadSystemPrompt();
      const followUpPrompt = systemPrompt
        ? this.canvasAgent.buildInitialPromptWithSystem(docContext, systemPrompt)
        : this.canvasAgent.buildInitialPrompt(docContext);

      // Create a new conversation for the follow-up pass
      const conversation = this.conversationManager.createConversation(this.selectedAgent.id);
      this.conversationId = conversation.id;

      if (this.responseContainer) {
        this.responseContainer.createEl("p", {
          cls: "pa-canvas-agent-separator",
          text: `── Follow-up pass: ${this.selectedAgent.name} ──`,
        });
      }

      await this.sendToAgent(orchestrator, followUpPrompt);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      new Notice(`Re-run failed: ${msg}`);
      logger.error("Canvas re-run error", { error: msg });
    } finally {
      if (this.rerunBtn) {
        this.rerunBtn.disabled = false;
        this.rerunBtn.textContent = "🔄 Re-run document analysis (follow-up)";
      }
    }
  }

  /**
   * Loads the custom system prompt from the file specified in settings.
   * Returns null if no file is configured or the file cannot be read.
   */
  private async loadSystemPrompt(): Promise<string | null> {
    const filePath = this.canvasSettings.canvasSystemPromptFile;
    if (!filePath) return null;

    try {
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (!(file instanceof TFile)) return null;
      const content = await this.app.vault.read(file);
      // Strip YAML frontmatter if present
      const stripped = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "").trim();
      return stripped || null;
    } catch (error) {
      logger.warn("Failed to load canvas system prompt", { filePath, error });
      return null;
    }
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
      logger.error("Canvas agent error", { error: msg });
    } finally {
      this.isStreaming = false;
      if (this.sendBtn) this.sendBtn.disabled = false;
      if (this.startBtn) {
        this.startBtn.disabled = false;
        this.startBtn.textContent = this.activeSelection ? "Analyze selection" : "Restart session";
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
      logger.error("Canvas dismissal error", { error: msg });
    }
  }

  /**
   * Renders the "📊 View diff" button that toggles the diff section.
   * Called once when the session starts.
   */
  private renderDiffButton(): void {
    if (!this.diffSection) return;
    this.diffSection.style.display = "block";
    this.diffSection.empty();

    const btn = this.diffSection.createEl("button", {
      cls: "pa-canvas-diff-btn",
      text: "📊 View diff",
      attr: { title: "Show annotations added to the document" },
    });

    const diffContent = this.diffSection.createDiv({ cls: "pa-canvas-diff-content" });
    diffContent.style.display = "none";

    btn.addEventListener("click", () => {
      if (diffContent.style.display === "none") {
        diffContent.style.display = "block";
        btn.textContent = "📊 Hide diff";
        void this.renderDiffView(diffContent);
      } else {
        diffContent.style.display = "none";
        btn.textContent = "📊 View diff";
      }
    });
  }

  /**
   * Reads the current document and renders a summary of added annotations
   * (all canvas callout blocks) compared to the original content.
   */
  private async renderDiffView(container: HTMLElement): Promise<void> {
    container.empty();

    if (!this.activeFile) return;

    let currentContent: string;
    try {
      currentContent = await this.canvasAgent.readFile(this.activeFile);
    } catch {
      container.createEl("p", { text: "Could not read document.", cls: "pa-canvas-diff-error" });
      return;
    }

    const callouts = this.canvasAgent.extractCanvasCallouts(currentContent);
    const originalLines = this.originalDocumentContent
      ? this.canvasAgent.buildDocumentContext(this.originalDocumentContent).split("\n").length
      : 0;
    const currentLines = this.canvasAgent.buildDocumentContext(currentContent).split("\n").length;

    const header = container.createDiv({ cls: "pa-canvas-diff-header" });
    header.createEl("span", {
      cls: "pa-canvas-diff-stats",
      text: `Original: ${originalLines} lines → Current: ${currentLines} lines   |   Annotations added: ${callouts.length}`,
    });

    if (callouts.length === 0) {
      container.createEl("p", {
        cls: "pa-canvas-diff-empty",
        text: "No annotations in document yet.",
      });
      return;
    }

    const list = container.createDiv({ cls: "pa-canvas-diff-list" });
    for (const callout of callouts) {
      const item = list.createDiv({ cls: "pa-canvas-diff-callout" });
      const icon = callout.type === "agent" ? "🤖" : "👤";
      item.createEl("strong", { cls: "pa-canvas-diff-callout-title", text: `${icon} ${callout.title}` });
      if (callout.body) {
        const preview = callout.body.length > 120 ? callout.body.slice(0, 120) + "…" : callout.body;
        item.createEl("p", { cls: "pa-canvas-diff-callout-body", text: preview });
      }
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
