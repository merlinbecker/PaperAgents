/**
 * Paper Agents Sidebar - UI für Tool-Auswahl und Status
 * Zeigt verfügbare Tools, ermöglicht Quick-Access, zeigt Execution-Status
 */

import { ItemView, WorkspaceLeaf } from "obsidian";
import { ToolMetadata, AgentDefinition, IToolRegistry } from "../types";
import { TOOL_CATEGORIES, TOOL_ICONS } from "../utils/constants";
import { globalLogger } from "../utils/logger";

export const VIEW_TYPE_PAPER_AGENTS = "paper-agents-sidebar";

/**
 * Sidebar View für Paper Agents
 */
export class PaperAgentsSidebar extends ItemView {
  private toolsContainer: HTMLElement | null = null;
  private agentsContainer: HTMLElement | null = null;
  private statusContainer: HTMLElement | null = null;
  private toolRegistry: IToolRegistry;
  private onToolClick: (toolId: string) => void;
  private agents: AgentDefinition[] = [];
  private onAgentClick: ((agentId: string) => void) | null = null;

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
    return "Paper Agents";
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

    // Tools Section
    this.toolsContainer = container.createDiv({ cls: "pa-tools-section" });
    this.renderTools();

    // Agents Section
    this.agentsContainer = container.createDiv({ cls: "pa-agents-section" });
    this.renderAgents();

    // Status Section
    this.statusContainer = container.createDiv({ cls: "pa-status-section" });
    this.renderStatus("Ready");

    globalLogger.debug("PaperAgentsSidebar opened");
  }

  async onClose(): Promise<void> {
    globalLogger.debug("PaperAgentsSidebar closed");
  }

  /**
   * Rendert Header mit Title und Refresh-Button
   */
  private renderHeader(container: HTMLElement): void {
    const header = container.createDiv({ cls: "pa-header" });

    const title = header.createEl("h2", { text: "Paper Agents" });
    title.addClass("pa-title");

    const refreshBtn = header.createEl("button", { text: "↻" });
    refreshBtn.addClass("pa-refresh-btn");
    refreshBtn.addEventListener("click", () => {
      this.renderTools();
      globalLogger.debug("Tools refreshed");
    });
  }

  /**
   * Rendert Tool-Liste gruppiert nach Kategorien
   */
  private renderTools(): void {
    if (!this.toolsContainer) return;

    this.toolsContainer.empty();

    const tools = this.toolRegistry.listTools();
    const grouped = this.groupToolsByCategory(tools);

    // Predefined Tools zuerst
    if (grouped[TOOL_CATEGORIES.PREDEFINED]) {
      this.renderToolCategory(
        this.toolsContainer,
        TOOL_CATEGORIES.PREDEFINED,
        grouped[TOOL_CATEGORIES.PREDEFINED] || []
      );
    }

    // Custom Tools
    if (grouped[TOOL_CATEGORIES.CUSTOM]) {
      this.renderToolCategory(
        this.toolsContainer,
        TOOL_CATEGORIES.CUSTOM,
        grouped[TOOL_CATEGORIES.CUSTOM] || []
      );
    }

    // Chains
    if (grouped[TOOL_CATEGORIES.CHAINS]) {
      this.renderToolCategory(
        this.toolsContainer,
        TOOL_CATEGORIES.CHAINS,
        grouped[TOOL_CATEGORIES.CHAINS] || []
      );
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
    const toolItem = container.createDiv({ cls: "pa-tool-item" });

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

    // Parameter Count Badge
    const badge = toolItem.createSpan({
      text: `${tool.parameters.length} params`,
      cls: "pa-tool-badge",
    });

    // Click Handler
    toolItem.addEventListener("click", () => {
      this.onToolClick(tool.id);
      this.updateStatus(`Opening ${tool.name}...`);
      globalLogger.info(`Tool clicked: ${tool.id}`);
    });

    // Hover Effect
    toolItem.addEventListener("mouseenter", () => {
      toolItem.addClass("pa-tool-item-hover");
    });

    toolItem.addEventListener("mouseleave", () => {
      toolItem.removeClass("pa-tool-item-hover");
    });
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

    const badge = toolItem.createSpan({
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

    toolItem.addEventListener("mouseenter", () => {
      toolItem.addClass("pa-tool-item-hover");
    });

    toolItem.addEventListener("mouseleave", () => {
      toolItem.removeClass("pa-tool-item-hover");
    });
  }

  public setAgents(agents: AgentDefinition[]): void {
    this.agents = agents;
    this.renderAgents();
  }

  public setOnAgentClick(callback: (agentId: string) => void): void {
    this.onAgentClick = callback;
  }

  /**
   * Refresh Tools (nach Custom-Tool-Loading)
   */
  public refreshTools(): void {
    this.renderTools();
  }

  public refreshAgents(): void {
    this.renderAgents();
  }
}
