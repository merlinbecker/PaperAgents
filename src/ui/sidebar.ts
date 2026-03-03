/**
 * Paper Agents Sidebar - UI für Tool-Auswahl und Status
 * Zeigt verfügbare Tools, ermöglicht Quick-Access, zeigt Execution-Status
 */

import { ItemView, WorkspaceLeaf, Modal, App, Notice } from "obsidian";
import { ToolMetadata, AgentDefinition, IToolRegistry } from "../types";
import { TOOL_CATEGORIES, TOOL_ICONS } from "../utils/constants";
import { globalLogger } from "../utils/logger";
import { SIDEBAR_EXAMPLES, SidebarExample } from "./sidebar-examples";

export const VIEW_TYPE_PAPER_AGENTS = "paper-agents-sidebar";

/**
 * Sidebar View für Paper Agents
 */
export class PaperAgentsSidebar extends ItemView {
  private toolsContainer: HTMLElement | null = null;
  private agentsContainer: HTMLElement | null = null;
  private examplesContainer: HTMLElement | null = null;
  private statusContainer: HTMLElement | null = null;
  private countsContainer: HTMLElement | null = null;
  private toolRegistry: IToolRegistry;
  private onToolClick: (toolId: string) => void;
  private agents: AgentDefinition[] = [];
  private onAgentClick: ((agentId: string) => void) | null = null;
  private onOpenChat: (() => void) | null = null;
  private onReloadTools: (() => Promise<void>) | null = null;
  private examplesExpanded = true;
  private toolsPath = "";
  private agentsPath = "";

  constructor(
    leaf: WorkspaceLeaf,
    toolRegistry: IToolRegistry,
    onToolClick: (toolId: string) => void
  ) {
    super(leaf);
    this.toolRegistry = toolRegistry;
    this.onToolClick = onToolClick;
  }

  getViewType(): string {
    return VIEW_TYPE_PAPER_AGENTS;
  }

  getDisplayText(): string {
    return "Paper agents";
  }

  getIcon(): string {
    return "bot";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    if (!container) return;
    
    container.empty();
    container.addClass("paper-agents-sidebar");

    // Header
    this.renderHeader(container as HTMLElement);

    // Counts bar
    this.countsContainer = container.createDiv({ cls: "pa-counts-bar" });
    this.renderCounts();

    // Tools Section
    this.toolsContainer = container.createDiv({ cls: "pa-tools-section" });
    this.renderTools();

    // Agents Section
    this.agentsContainer = container.createDiv({ cls: "pa-agents-section" });
    this.renderAgents();

    // Examples Section
    this.examplesContainer = container.createDiv({ cls: "pa-examples-section" });
    this.renderExamples();

    // Status Section
    this.statusContainer = container.createDiv({ cls: "pa-status-section" });
    this.renderStatus("Ready");

    globalLogger.debug("PaperAgentsSidebar opened");
  }

  async onClose(): Promise<void> {
    globalLogger.debug("PaperAgentsSidebar closed");
  }

  /**
   * Rendert Header mit Title und Action-Buttons
   */
  private renderHeader(container: HTMLElement): void {
    const header = container.createDiv({ cls: "pa-header" });

    const title = header.createEl("h2", { text: "Paper agents" });
    title.addClass("pa-title");

    const actions = header.createDiv({ cls: "pa-header-actions" });

    const chatBtn = actions.createEl("button", { text: "💬" });
    chatBtn.addClass("pa-header-btn");
    chatBtn.setAttribute("aria-label", "Open chat");
    chatBtn.title = "Open chat";
    chatBtn.addEventListener("click", () => {
      if (this.onOpenChat) {
        this.onOpenChat();
      }
      globalLogger.debug("Open chat clicked");
    });

    const reloadBtn = actions.createEl("button", { text: "↻" });
    reloadBtn.addClass("pa-header-btn");
    reloadBtn.setAttribute("aria-label", "Reload tools and agents");
    reloadBtn.title = "Reload tools & agents";
    reloadBtn.addEventListener("click", () => {
      if (this.onReloadTools) {
        reloadBtn.disabled = true;
        void this.onReloadTools().finally(() => {
          reloadBtn.disabled = false;
        });
      }
      globalLogger.debug("Reload tools clicked");
    });
  }

  /**
   * Rendert Zähler für Agenten und Tools
   */
  private renderCounts(): void {
    if (!this.countsContainer) return;
    this.countsContainer.empty();

    const toolCount = this.toolRegistry.listTools().length;
    const agentCount = this.agents.length;

    const agentBadge = this.countsContainer.createSpan({
      cls: "pa-count-badge",
      text: `🤖 ${agentCount} agent${agentCount !== 1 ? "s" : ""}`,
    });
    if (this.agentsPath) {
      const agentLink = agentBadge.createEl("a", {
        cls: "pa-count-folder-link",
        title: `Open folder: ${this.agentsPath}`,
        text: " 📂",
      });
      agentLink.addEventListener("click", (e) => {
        e.stopPropagation();
        this.openFolderInExplorer(this.agentsPath);
      });
    }

    const toolBadge = this.countsContainer.createSpan({
      cls: "pa-count-badge",
      text: `🔧 ${toolCount} tool${toolCount !== 1 ? "s" : ""}`,
    });
    if (this.toolsPath) {
      const toolLink = toolBadge.createEl("a", {
        cls: "pa-count-folder-link",
        title: `Open folder: ${this.toolsPath}`,
        text: " 📂",
      });
      toolLink.addEventListener("click", (e) => {
        e.stopPropagation();
        this.openFolderInExplorer(this.toolsPath);
      });
    }
  }

  /**
   * Opens a folder in Obsidian's file explorer.
   * Shows a Notice if the folder does not exist in the vault.
   * If the file-explorer leaf is not available, the call is silently ignored.
   */
  private openFolderInExplorer(folderPath: string): void {
    const abstractFile = this.app.vault.getAbstractFileByPath(folderPath);
    if (!abstractFile) {
      new Notice(`Folder not found: ${folderPath}`);
      return;
    }
    const fileExplorer = this.app.workspace.getLeavesOfType("file-explorer")[0];
    if (fileExplorer?.view) {
      void this.app.workspace.revealLeaf(fileExplorer);
      // revealInFolder is an internal Obsidian API available on the file-explorer view
      (fileExplorer.view as { revealInFolder?: (f: unknown) => void }).revealInFolder?.(abstractFile);
    }
  }

  /**
   * Aktualisiert die Zähler-Anzeige
   */
  public updateCounts(): void {
    this.renderCounts();
  }

  /**
   * Rendert Tool-Liste gruppiert nach Kategorien
   */
  private renderTools(): void {
    if (!this.toolsContainer) return;

    this.toolsContainer.empty();

    const tools = this.toolRegistry.listTools();
    const grouped = this.groupToolsByCategory(tools);

    const categoryOrder = [
      TOOL_CATEGORIES.SYSTEM,
      TOOL_CATEGORIES.CUSTOM,
      TOOL_CATEGORIES.CHAINS,
      TOOL_CATEGORIES.PLUGINS,
    ];

    for (const category of categoryOrder) {
      if (grouped[category]) {
        this.renderToolCategory(this.toolsContainer, category, grouped[category]);
      }
    }

    globalLogger.debug(`Rendered ${tools.length} tools in sidebar`);
  }

  /**
   * Gruppiert Tools nach Category
   */
  private groupToolsByCategory(
    tools: ToolMetadata[]
  ): Record<string, ToolMetadata[]> {
    const grouped: Record<string, ToolMetadata[]> = {};

    for (const tool of tools) {
      const category = tool.category || TOOL_CATEGORIES.CUSTOM;
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(tool);
    }

    return grouped;
  }

  /**
   * Rendert eine Tool-Kategorie
   */
  private renderToolCategory(
    container: HTMLElement,
    categoryName: string,
    tools: ToolMetadata[]
  ): void {
    const categoryDiv = container.createDiv({ cls: "pa-tool-category" });

    // Category Header
    const categoryHeader = categoryDiv.createEl("h3", { text: categoryName });
    categoryHeader.addClass("pa-category-header");

    // Tool Items
    for (const tool of tools) {
      this.renderToolItem(categoryDiv, tool);
    }
  }

  /**
   * Rendert ein einzelnes Tool-Item
   */
  private renderToolItem(container: HTMLElement, tool: ToolMetadata): void {
    const wrapper = container.createDiv({ cls: "pa-tool-wrapper" });
    const toolItem = wrapper.createDiv({ cls: "pa-tool-item" });

    // Icon
    const icon = toolItem.createSpan({ cls: "pa-tool-icon" });
    icon.setText(tool.icon || TOOL_ICONS.DEFAULT);

    // Content
    const content = toolItem.createDiv({ cls: "pa-tool-content" });

    const name = content.createEl("div", { text: tool.name });
    name.addClass("pa-tool-name");

    if (tool.description) {
      const desc = content.createEl("div", { text: tool.description });
      desc.addClass("pa-tool-description");
    }

    // Parameter badge – expandable when there are parameters
    if (tool.parameters.length > 0) {
      const count = tool.parameters.length;
      const paramsBadgeText = (expanded: boolean): string =>
        `${expanded ? "▼" : "▶"} ${count} param${count !== 1 ? "s" : ""}`;

      const paramsPanel = wrapper.createDiv({ cls: "pa-tool-params-panel pa-hidden" });
      for (const param of tool.parameters) {
        const row = paramsPanel.createDiv({ cls: "pa-tool-param-row" });
        const nameEl = row.createSpan({ cls: "pa-tool-param-name", text: param.name });
        if (param.required) {
          nameEl.createSpan({ cls: "pa-tool-param-required", text: "*" });
        }
        row.createSpan({ cls: "pa-tool-param-type", text: `(${param.type})` });
        if (param.description) {
          row.createSpan({ cls: "pa-tool-param-desc", text: param.description });
        }
      }

      const badge = toolItem.createSpan({ cls: "pa-tool-badge pa-tool-badge-toggle" });
      badge.setText(paramsBadgeText(false));
      badge.addEventListener("click", (e) => {
        e.stopPropagation();
        const expanded = !paramsPanel.hasClass("pa-hidden");
        paramsPanel.toggleClass("pa-hidden", expanded);
        badge.setText(paramsBadgeText(!expanded));
      });
    } else if (tool.isPlugin) {
      toolItem.createSpan({
        text: "🌐 Plugin",
        cls: "pa-tool-badge pa-tool-badge-plugin",
      });
    } else {
      toolItem.createSpan({
        text: `0 params`,
        cls: "pa-tool-badge",
      });
    }

    // Click Handler – plugins don't open a parameter form
    if (!tool.isPlugin) {
      toolItem.addEventListener("click", () => {
        this.onToolClick(tool.id);
        this.updateStatus(`Opening ${tool.name}...`);
        globalLogger.info(`Tool clicked: ${tool.id}`);
      });
    }

    // Hover Effect
    this.addHoverEffect(toolItem);
  }

  /** Adds standard pa-tool-item-hover effect to any element. */
  private addHoverEffect(el: HTMLElement): void {
    el.addEventListener("mouseenter", () => el.addClass("pa-tool-item-hover"));
    el.addEventListener("mouseleave", () => el.removeClass("pa-tool-item-hover"));
  }

  /**
   * Rendert Status-Anzeige
   */
  private renderStatus(message: string): void {
    if (!this.statusContainer) return;

    this.statusContainer.empty();

    const statusDiv = this.statusContainer.createDiv({ cls: "pa-status" });
    const statusText = statusDiv.createEl("span", { text: message });
    statusText.addClass("pa-status-text");
  }

  /**
   * Aktualisiert Status-Text
   */
  public updateStatus(message: string): void {
    this.renderStatus(message);
  }

  /**
   * Zeigt Execution-Status mit Progress
   */
  public showExecutionStatus(agentName: string, currentStep: number, totalSteps: number): void {
    const message = `Executing ${agentName} (${currentStep}/${totalSteps})`;
    this.updateStatus(message);
  }

  /**
   * Zeigt Erfolg-Status
   */
  public showSuccess(message: string): void {
    this.updateStatus(`✅ ${message}`);
    setTimeout(() => this.updateStatus("Ready"), 3000);
  }

  /**
   * Zeigt Fehler-Status
   */
  public showError(message: string): void {
    this.updateStatus(`❌ ${message}`);
    setTimeout(() => this.updateStatus("Ready"), 5000);
  }

  private renderAgents(): void {
    if (!this.agentsContainer) return;

    this.agentsContainer.empty();

    if (this.agents.length === 0) return;

    const categoryDiv = this.agentsContainer.createDiv({ cls: "pa-tool-category" });

    const categoryHeader = categoryDiv.createEl("h3", { text: TOOL_CATEGORIES.AGENTS });
    categoryHeader.addClass("pa-category-header");

    for (const agent of this.agents) {
      this.renderAgentItem(categoryDiv, agent);
    }

    globalLogger.debug(`Rendered ${this.agents.length} agents in sidebar`);
  }

  private renderAgentItem(container: HTMLElement, agent: AgentDefinition): void {
    const toolItem = container.createDiv({ cls: "pa-tool-item" });

    const icon = toolItem.createSpan({ cls: "pa-tool-icon" });
    icon.setText(TOOL_ICONS.AGENTS);

    const content = toolItem.createDiv({ cls: "pa-tool-content" });

    const name = content.createEl("div", { text: agent.name });
    name.addClass("pa-tool-name");

    if (agent.description) {
      const desc = content.createEl("div", { text: agent.description });
      desc.addClass("pa-tool-description");
    }

    toolItem.createSpan({
      text: agent.model || "default",
      cls: "pa-tool-badge",
    });

    toolItem.addEventListener("click", () => {
      if (this.onAgentClick) {
        this.onAgentClick(agent.id);
      }
      this.updateStatus(`Selected agent: ${agent.name}`);
      globalLogger.info(`Agent clicked: ${agent.id}`);
    });

    this.addHoverEffect(toolItem);
  }

  public setAgents(agents: AgentDefinition[]): void {
    this.agents = agents;
    this.renderAgents();
    this.renderCounts();
  }

  public setOnAgentClick(callback: (agentId: string) => void): void {
    this.onAgentClick = callback;
  }

  public setOnOpenChat(callback: () => void): void {
    this.onOpenChat = callback;
  }

  public setOnReloadTools(callback: () => Promise<void>): void {
    this.onReloadTools = callback;
  }

  public setFolderPaths(toolsPath: string, agentsPath: string): void {
    this.toolsPath = toolsPath;
    this.agentsPath = agentsPath;
  }

  /**
   * Refresh Tools (nach Custom-Tool-Loading)
   */
  public refreshTools(): void {
    this.renderTools();
    this.renderCounts();
  }

  public refreshAgents(): void {
    this.renderAgents();
    this.renderCounts();
  }

  private renderExamples(): void {
    if (!this.examplesContainer) return;
    this.examplesContainer.empty();

    const header = this.examplesContainer.createDiv({ cls: "pa-examples-header" });
    header.createEl("h3", { text: "Getting started" });

    const toggleBtn = header.createEl("button", {
      text: this.examplesExpanded ? "Hide" : "Show",
      cls: "pa-examples-toggle",
    });
    toggleBtn.addEventListener("click", () => {
      this.examplesExpanded = !this.examplesExpanded;
      this.renderExamples();
    });

    if (!this.examplesExpanded) return;

    const groups = new Map<string, SidebarExample[]>();
    for (const ex of SIDEBAR_EXAMPLES) {
      const list = groups.get(ex.group) || [];
      list.push(ex);
      groups.set(ex.group, list);
    }

    for (const [groupName, examples] of groups) {
      const groupDiv = this.examplesContainer.createDiv({ cls: "pa-example-group" });
      groupDiv.createDiv({ cls: "pa-example-group-title", text: groupName });

      for (const example of examples) {
        this.renderExampleCard(groupDiv, example);
      }
    }
  }

  private renderExampleCard(container: HTMLElement, example: SidebarExample): void {
    const card = container.createDiv({ cls: "pa-example-card" });

    const headerDiv = card.createDiv({ cls: "pa-example-card-header" });
    headerDiv.createSpan({ cls: "pa-example-card-icon", text: example.icon });
    headerDiv.createSpan({ cls: "pa-example-card-title", text: example.title });

    card.createDiv({ cls: "pa-example-card-desc", text: example.description });

    if (example.tags.length > 0) {
      const tagsDiv = card.createDiv({ cls: "pa-example-card-tags" });
      for (const tag of example.tags) {
        tagsDiv.createSpan({ cls: "pa-example-tag", text: tag });
      }
    }

    card.addEventListener("click", () => {
      new ExampleDetailModal(this.app, example).open();
    });
  }
}

class ExampleDetailModal extends Modal {
  private example: SidebarExample;

  constructor(app: App, example: SidebarExample) {
    super(app);
    this.example = example;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("pa-example-modal");

    const header = contentEl.createDiv({ cls: "pa-example-modal-header" });
    header.createSpan({ cls: "pa-example-modal-icon", text: this.example.icon });
    header.createEl("h2", { cls: "pa-example-modal-title", text: this.example.title });

    contentEl.createDiv({ cls: "pa-example-modal-desc", text: this.example.longDescription });

    if (this.example.usageHint) {
      const hintSection = contentEl.createDiv({ cls: "pa-example-modal-section" });
      hintSection.createEl("h3", { text: "How to use" });
      hintSection.createDiv({ cls: "pa-example-modal-desc", text: this.example.usageHint });
    }

    const codeSection = contentEl.createDiv({ cls: "pa-example-modal-section" });
    codeSection.createEl("h3", { text: this.example.fileType === "agent" ? "Agent Definition" : "Tool Definition" });
    const codeBlock = codeSection.createDiv({ cls: "pa-example-modal-code" });
    codeBlock.setText(this.example.content);

    const buttons = contentEl.createDiv({ cls: "pa-example-modal-buttons" });

    const installBtn = buttons.createEl("button", {
      text: `Install to vault`,
      cls: "pa-btn-install",
    });
    installBtn.addEventListener("click", () => {
      void this.installExample();
    });

    const copyBtn = buttons.createEl("button", {
      text: "Copy to clipboard",
      cls: "pa-btn-close-example",
    });
    copyBtn.addEventListener("click", () => {
      void navigator.clipboard.writeText(this.example.content).then(() => {
        new Notice("Copied to clipboard");
      }).catch(() => {
        new Notice("Could not copy — try installing the example instead");
      });
    });

    const closeBtn = buttons.createEl("button", {
      text: "Close",
      cls: "pa-btn-close-example",
    });
    closeBtn.addEventListener("click", () => this.close());
  }

  private async installExample(): Promise<void> {
    try {
      const vault = this.app.vault;
      const folderPath = this.example.fileType === "agent" ? "paper-agents-agents" : "paper-agents-tools";
      const filePath = `${folderPath}/${this.example.fileName}`;

      const existing = vault.getAbstractFileByPath(folderPath);
      if (!existing) {
        await vault.createFolder(folderPath);
      }

      const existingFile = vault.getAbstractFileByPath(filePath);
      if (existingFile) {
        new Notice(`File already exists: ${filePath}`);
        return;
      }

      await vault.create(filePath, this.example.content);
      new Notice(`Installed: ${filePath} — reload tools/agents to use it`);
      this.close();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      new Notice(`Failed to install example: ${msg}`);
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
