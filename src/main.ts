import { Plugin, Notice, TFile } from "obsidian";
import { DEFAULT_SETTINGS, PaperAgentsSettings, PaperAgentsSettingTab } from "./settings";

import ToolRegistry from "./core/tool-registry";
import { toolExecutor } from "./core/tool-executor";
import { customJSExecutor } from "./core/sandbox";
import { ConversationManager } from "./core/conversation";
import { Orchestrator } from "./core/orchestrator";
import { executionHistory } from "./core/history";

import PredefinedToolsFactory from "./tools/predefined";

import ToolLoader from "./parser/tool-loader";
import { AgentParser } from "./parser/agent-parser";

import { AgentDefinition, LoadAgentsResult } from "./types";

import { PaperAgentsSidebar, VIEW_TYPE_PAPER_AGENTS } from "./ui/sidebar";
import { PaperAgentsChatView, VIEW_TYPE_PAPER_AGENTS_CHAT } from "./ui/chat";
import { ToolFormModal } from "./ui/forms";
import { OutputPanelModal } from "./ui/output-panel";
import { HistoryPanelModal } from "./ui/history-panel";
import { showHITLModal } from "./ui/hitl-modal";
import { TemplateBrowserModal, ToolTemplate } from "./ui/template-browser";
import { WorkflowViewModal } from "./ui/workflow-view";

import { globalLogger } from "./utils/logger";
import { DEFAULT_PATHS, OPENROUTER_DEFAULTS } from "./utils/constants";

export default class PaperAgents extends Plugin {
  settings: PaperAgentsSettings;
  toolRegistry: ToolRegistry;
  sidebar: PaperAgentsSidebar | null = null;
  loadedAgents: AgentDefinition[] = [];
  conversationManager: ConversationManager;
  orchestrator: Orchestrator | null = null;

  async onload() {
    globalLogger.info("Paper Agents plugin loading...");

    await this.loadSettings();

    this.toolRegistry = new ToolRegistry(this.app);
    this.conversationManager = new ConversationManager();

    this.registerPredefinedTools();
    await this.loadCustomToolsFromVault();
    await this.loadAgentsFromVault();

    this.initializeOrchestrator();
    await this.initializeHistory();

    try {
      await customJSExecutor.initialize();
    } catch (err) {
      globalLogger.warn("QuickJS sandbox unavailable – custom-js tools will not work", { error: String(err) });
      new Notice("Paper Agents: Sandbox konnte nicht initialisiert werden. Custom-JS Tools sind deaktiviert.");
    }

    this.registerView(
      VIEW_TYPE_PAPER_AGENTS,
      (leaf) => {
        const sidebar = new PaperAgentsSidebar(leaf, this.toolRegistry, (toolId) =>
          this.handleToolClick(toolId)
        );
        sidebar.setAgents(this.loadedAgents);
        sidebar.setOnAgentClick((agentId) => this.handleAgentClick(agentId));
        return sidebar;
      }
    );

    this.registerView(
      VIEW_TYPE_PAPER_AGENTS_CHAT,
      (leaf) =>
        new PaperAgentsChatView(
          leaf,
          this.conversationManager,
          () => this.loadedAgents,
          () => this.orchestrator
        )
    );

    this.addRibbonIcon("bot", "Paper Agents", () => {
      this.activateSidebar();
    });

    this.addCommand({
      id: "open-sidebar",
      name: "Open Paper Agents Sidebar",
      callback: () => { this.activateSidebar(); },
    });

    this.addCommand({
      id: "open-chat",
      name: "Open Agent Chat",
      callback: () => { this.activateChat(); },
    });

    this.addCommand({
      id: "reload-custom-tools",
      name: "Reload Custom Tools",
      callback: async () => {
        await this.loadCustomToolsFromVault();
        new Notice("Custom tools reloaded");
        this.sidebar?.refreshTools();
      },
    });

    this.addCommand({
      id: "reload-agents",
      name: "Reload Agents",
      callback: async () => {
        await this.loadAgentsFromVault();
        new Notice(`Agents reloaded (${this.loadedAgents.length} loaded)`);
        this.sidebar?.setAgents(this.loadedAgents);
      },
    });

    this.addCommand({
      id: "show-history",
      name: "Show Execution History",
      callback: () => {
        new HistoryPanelModal(this.app, executionHistory).open();
      },
    });

    this.addCommand({
      id: "browse-templates",
      name: "Browse Templates",
      callback: () => {
        this.openTemplateBrowser();
      },
    });

    this.addCommand({
      id: "show-workflow",
      name: "Show Workflow View",
      callback: () => {
        this.openWorkflowView();
      },
    });

    this.addSettingTab(new PaperAgentsSettingTab(this.app, this));

    this.registerHITLCallbacks();

    globalLogger.info("Paper Agents plugin loaded successfully");
  }

  async onunload() {
    globalLogger.info("Paper Agents plugin unloading...");

    await customJSExecutor.destroy();

    this.app.workspace.detachLeavesOfType(VIEW_TYPE_PAPER_AGENTS);
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_PAPER_AGENTS_CHAT);

    globalLogger.info("Paper Agents plugin unloaded");
  }

  private initializeOrchestrator(): void {
    const apiKey = this.settings.openRouterApiKey;
    if (!apiKey) {
      globalLogger.info("OpenRouter API key not set, orchestrator disabled");
      this.orchestrator = null;
      return;
    }

    this.orchestrator = new Orchestrator(
      {
        openRouterConfig: {
          apiKey,
          model: this.settings.defaultModel || OPENROUTER_DEFAULTS.DEFAULT_MODEL,
          temperature: this.settings.temperature,
          maxTokens: this.settings.maxTokens,
          title: "Paper Agents (Obsidian Plugin)",
        },
      },
      this.conversationManager,
      this.toolRegistry
    );

    globalLogger.info("Orchestrator initialized");
  }

  private async initializeHistory(): Promise<void> {
    executionHistory.setPersistence(
      async (data) => {
        const path = ".obsidian/plugins/paper-agents/history.json";
        const folder = ".obsidian/plugins/paper-agents";
        if (!this.app.vault.getAbstractFileByPath(folder)) {
          await this.app.vault.createFolder(folder).catch(() => {});
        }
        const existing = this.app.vault.getAbstractFileByPath(path);
        if (existing instanceof TFile) {
          await this.app.vault.modify(existing, data);
        } else {
          await this.app.vault.create(path, data);
        }
      },
      async () => {
        const path = ".obsidian/plugins/paper-agents/history.json";
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file instanceof TFile) {
          return await this.app.vault.read(file);
        }
        return null;
      }
    );

    await executionHistory.loadFromStorage();
  }

  reinitializeOrchestrator(): void {
    this.initializeOrchestrator();
  }

  private registerPredefinedTools(): void {
    this.toolRegistry.registerPredefinedBatch([
      PredefinedToolsFactory.searchFiles,
      PredefinedToolsFactory.readFile,
      PredefinedToolsFactory.writeFile,
      PredefinedToolsFactory.restRequest,
    ]);
    globalLogger.info("Predefined tools registered", { count: 4 });
  }

  private async loadCustomToolsFromVault(): Promise<void> {
    try {
      const customToolsPath = this.settings.customToolsPath || DEFAULT_PATHS.CUSTOM_TOOLS;
      const loader = new ToolLoader(this.app);
      const result = await loader.loadCustomTools(customToolsPath);

      this.toolRegistry.registerCustomBatch(result.successful);

      globalLogger.info("Custom tools loaded", {
        loaded: result.successful.length,
        failed: result.failed.length,
      });

      if (result.failed.length > 0) {
        new Notice(`Loaded ${result.successful.length} tools, ${result.failed.length} failed`);
      }
    } catch (error) {
      globalLogger.error("Failed to load custom tools", { error });
      new Notice("Failed to load custom tools");
    }
  }

  private async loadAgentsFromVault(): Promise<void> {
    try {
      const agentsPath = this.settings.agentsPath || DEFAULT_PATHS.AGENTS;
      const folder = this.app.vault.getAbstractFileByPath(agentsPath);

      if (!folder || !("children" in folder)) {
        globalLogger.info(`Agents folder not found: ${agentsPath}`);
        this.loadedAgents = [];
        return;
      }

      const result: LoadAgentsResult = { successful: [], failed: [] };
      const mdFiles: TFile[] = [];
      this.collectMarkdownFiles(folder, mdFiles);

      for (const file of mdFiles) {
        try {
          const content = await this.app.vault.read(file);
          if (!AgentParser.isAgentFile(content)) continue;

          const agentDef = AgentParser.parse(content);
          const validation = AgentParser.validateAgentDefinition(agentDef);

          if (validation.valid) {
            result.successful.push(agentDef);
          } else {
            result.failed.push({ file: file.path, error: validation.errors.join(", ") });
          }
        } catch (error) {
          result.failed.push({
            file: file.path,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      this.loadedAgents = result.successful;

      globalLogger.info("Agents loaded", {
        loaded: result.successful.length,
        failed: result.failed.length,
      });

      if (result.failed.length > 0) {
        new Notice(`Loaded ${result.successful.length} agents, ${result.failed.length} failed`);
      }

      this.sidebar?.setAgents(this.loadedAgents);
    } catch (error) {
      globalLogger.error("Failed to load agents", { error });
      new Notice("Failed to load agents");
    }
  }

  private collectMarkdownFiles(folder: unknown, results: TFile[]): void {
    const f = folder as { children?: unknown[] };
    if (!f.children) return;

    for (const child of f.children) {
      if (child instanceof TFile && child.extension === "md") {
        results.push(child);
      } else if (child && typeof child === "object" && "children" in child) {
        this.collectMarkdownFiles(child, results);
      }
    }
  }

  private async activateSidebar(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_PAPER_AGENTS);

    if (existing.length > 0) {
      const leaf = existing[0];
      if (!leaf) return;
      this.app.workspace.revealLeaf(leaf);
    } else {
      const leaf = this.app.workspace.getRightLeaf(false);
      if (!leaf) {
        new Notice("Failed to create sidebar");
        return;
      }

      await leaf.setViewState({ type: VIEW_TYPE_PAPER_AGENTS, active: true });
      this.app.workspace.revealLeaf(leaf);
      this.sidebar = leaf.view as PaperAgentsSidebar;
    }
  }

  private async activateChat(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_PAPER_AGENTS_CHAT);

    if (existing.length > 0) {
      const leaf = existing[0];
      if (leaf) this.app.workspace.revealLeaf(leaf);
    } else {
      const leaf = this.app.workspace.getLeaf(true);
      if (!leaf) return;

      await leaf.setViewState({ type: VIEW_TYPE_PAPER_AGENTS_CHAT, active: true });
      this.app.workspace.revealLeaf(leaf);
    }
  }

  private handleToolClick(toolId: string): void {
    const metadata = this.toolRegistry.listTools().find((t) => t.id === toolId);
    if (!metadata) {
      new Notice("Tool not found");
      return;
    }

    const modal = new ToolFormModal(this.app, metadata, (parameters) => {
      this.executeToolWithParameters(toolId, metadata.name, parameters);
    });
    modal.open();
  }

  private handleAgentClick(agentId: string): void {
    this.activateChat();
  }

  private async executeToolWithParameters(
    toolId: string,
    toolName: string,
    parameters: Record<string, unknown>
  ): Promise<void> {
    const startTime = Date.now();
    try {
      this.sidebar?.updateStatus(`Executing ${toolName}...`);

      const tool = this.toolRegistry.getTool(toolId);
      if (!tool) {
        throw new Error(`Tool not found: ${toolId}`);
      }

      const context = {
        parameters,
        previousStepOutputs: {},
        date: new Date().toISOString().split("T")[0] || "",
        time: new Date().toISOString().split("T")[1]?.split(".")[0] || "",
        randomId: Math.random().toString(36).substring(7) || "",
      };

      const result = await tool.execute(context);
      const duration = Date.now() - startTime;

      await executionHistory.addEntry({
        toolId,
        toolName,
        parameters,
        result,
        duration,
      });

      if (result.success) {
        this.sidebar?.showSuccess(`${toolName} completed`);
        new OutputPanelModal(this.app, toolName, result, duration).open();
      } else {
        throw new Error(result.error || "Unknown error");
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      const duration = Date.now() - startTime;

      await executionHistory.addEntry({
        toolId,
        toolName,
        parameters,
        result: { success: false, error: errorMsg, log: [] },
        duration,
      });

      this.sidebar?.showError(errorMsg);
      new Notice(`${toolName} failed: ${errorMsg}`);
      globalLogger.error("Tool execution failed", { error });
    }
  }

  private openTemplateBrowser(): void {
    const templates: ToolTemplate[] = [];

    for (const tool of this.toolRegistry.listTools()) {
      templates.push({
        id: tool.id,
        name: tool.name,
        description: tool.description || "",
        type: "tool",
        content: JSON.stringify({
          id: tool.id,
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        }, null, 2),
      });
    }

    for (const agent of this.loadedAgents) {
      templates.push({
        id: agent.id,
        name: agent.name,
        description: agent.systemPrompt?.substring(0, 100) || "",
        type: "agent",
        content: JSON.stringify(agent, null, 2),
      });
    }

    new TemplateBrowserModal(this.app, templates, (template) => {
      new Notice(`Template "${template.name}" imported`);
    }).open();
  }

  private openWorkflowView(): void {
    if (this.loadedAgents.length === 0) {
      new Notice("No agents loaded. Load agents first.");
      return;
    }

    const chainAgents = this.loadedAgents.filter((a) => a.tools.length > 1);
    const agent = chainAgents[0] || this.loadedAgents[0];
    if (!agent) return;

    const agentAsWorkflow = {
      id: agent.id,
      name: agent.name,
      type: agent.tools.length > 1 ? "chain" as const : "single" as const,
      parameters: [],
      steps: agent.tools.map((t) => ({ name: t, parameters: {} })),
    };

    new WorkflowViewModal(this.app, agentAsWorkflow).open();
  }

  private registerHITLCallbacks(): void {
    toolExecutor.registerGlobalHITLCallback(
      (toolName: string, stepName: string, parameters: Record<string, unknown>) => {
        return showHITLModal(this.app, toolName, stepName, parameters);
      }
    );
    globalLogger.debug("HITL callbacks registered");
  }

  async loadSettings() {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      (await this.loadData()) as Partial<PaperAgentsSettings>
    );
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
