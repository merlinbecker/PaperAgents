import { Plugin, Notice, TFile } from "obsidian";
import { DEFAULT_SETTINGS, PaperAgentsSettings, PaperAgentsSettingTab } from "./settings";

import ToolRegistry from "./core/tool-registry";
import { toolExecutor } from "./core/tool-executor";
import { customJSExecutor } from "./core/sandbox";
import { ConversationManager } from "./core/conversation";
import { Orchestrator } from "./core/orchestrator";
import { executionHistory } from "./core/history";
import { initializeHistoryPersistence, initializeConversationPersistence } from "./core/persistence";

import PredefinedToolsFactory from "./tools/predefined";

import ToolLoader from "./parser/tool-loader";
import { AgentParser } from "./parser/agent-parser";

import { AgentDefinition, LoadAgentsResult } from "./types";

import { PaperAgentsSidebar, VIEW_TYPE_PAPER_AGENTS } from "./ui/sidebar";
import { PaperAgentsChatView, VIEW_TYPE_PAPER_AGENTS_CHAT } from "./ui/chat";
import { ChatView, VIEW_TYPE_CHAT } from "./ui/chat-view";
import { ToolFormModal } from "./ui/forms";
import { OutputPanelModal } from "./ui/output-panel";
import { showHITLModal } from "./ui/hitl-modal";
import { registerCommands } from "./commands";

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
    await initializeHistoryPersistence(this.app.vault);
    await initializeConversationPersistence(this.app.vault, this.conversationManager);
    await this.restoreConversationsFromFiles();

    try {
      await customJSExecutor.initialize();
    } catch (err) {
      globalLogger.warn("QuickJS sandbox unavailable – custom-js tools will not work", { error: String(err) });
      new Notice("Sandbox could not be initialized. Custom JavaScript tools are disabled.");
    }

    this.registerView(
      VIEW_TYPE_PAPER_AGENTS,
      (leaf) => {
        const sidebar = new PaperAgentsSidebar(leaf, this.toolRegistry, (toolId) =>
          this.handleToolClick(toolId)
        );
        sidebar.setAgents(this.loadedAgents);
        sidebar.setOnAgentClick(() => { void this.activateChat(); });
        sidebar.setOnOpenChat(() => { void this.activateChat(); });
        sidebar.setOnReloadTools(async () => {
          await this.loadCustomToolsFromVault();
          await this.loadAgentsFromVault();
        });
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
          () => this.orchestrator,
          () => this.settings.conversationsPath || DEFAULT_PATHS.CONVERSATIONS
        )
    );

    this.registerView(
      VIEW_TYPE_CHAT,
      (leaf) => new ChatView(leaf)
    );

    this.addRibbonIcon("bot", "Paper agents", () => {
      void this.activateSidebar();
    });

    registerCommands(this);

    this.addCommand({
      id: "open-file-as-chat",
      name: "Open current file as conversation chat",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || !file.path.endsWith(".md")) return false;
        if (!checking) {
          void this.openChatView(file.path);
        }
        return true;
      },
    });

    this.addCommand({
      id: "new-conversation",
      name: "New conversation",
      callback: async () => {
        await this.createNewConversation();
      },
    });

    // Add Settings Tab
    this.addSettingTab(new PaperAgentsSettingTab(this.app, this));

    this.registerHITLCallbacks();

    globalLogger.info("Paper Agents plugin loaded successfully");
  }

  onunload() {
    globalLogger.info("Paper Agents plugin unloading...");

    void this.conversationManager.saveToStorage();
    void customJSExecutor.destroy();

    globalLogger.info("Paper Agents plugin unloaded");
  }

  initializeOrchestrator(): void {
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

  private registerPredefinedTools(): void {
    this.toolRegistry.registerPredefinedBatch([
      PredefinedToolsFactory.searchFiles,
      PredefinedToolsFactory.readFile,
      PredefinedToolsFactory.writeFile,
      PredefinedToolsFactory.restRequest,
    ]);
    globalLogger.info("Predefined tools registered", { count: 4 });
  }

  async loadCustomToolsFromVault(): Promise<void> {
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

  async loadAgentsFromVault(): Promise<void> {
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

  async activateSidebar(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_PAPER_AGENTS);

    if (existing.length > 0) {
      const leaf = existing[0];
      if (!leaf) return;
      await this.app.workspace.revealLeaf(leaf);
    } else {
      const leaf = this.app.workspace.getRightLeaf(false);
      if (!leaf) {
        new Notice("Failed to create sidebar");
        return;
      }

      await leaf.setViewState({ type: VIEW_TYPE_PAPER_AGENTS, active: true });
      await this.app.workspace.revealLeaf(leaf);
      this.sidebar = leaf.view as PaperAgentsSidebar;
    }
  }

  async activateChat(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_PAPER_AGENTS_CHAT);

    if (existing.length > 0) {
      const leaf = existing[0];
      if (leaf) await this.app.workspace.revealLeaf(leaf);
    } else {
      const leaf = this.app.workspace.getLeaf(true);
      if (!leaf) return;

      await leaf.setViewState({ type: VIEW_TYPE_PAPER_AGENTS_CHAT, active: true });
      await this.app.workspace.revealLeaf(leaf);
    }
  }

  private handleToolClick(toolId: string): void {
    const metadata = this.toolRegistry.listTools().find((t) => t.id === toolId);
    if (!metadata) {
      new Notice("Tool not found");
      return;
    }

    const modal = new ToolFormModal(this.app, metadata, (parameters) => {
      void this.executeToolWithParameters(toolId, metadata.name, parameters);
    });
    modal.open();
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

  private registerHITLCallbacks(): void {
    toolExecutor.registerGlobalHITLCallback(
      (toolName: string, stepName: string, parameters: Record<string, unknown>) => {
        return showHITLModal(this.app, toolName, stepName, parameters);
      }
    );
    globalLogger.debug("HITL callbacks registered");
  }

  /**
   * Opens a conversation Markdown file in PaperAgentsChatView with full LLM support.
   */
  private async openChatView(filePath: string): Promise<void> {
    await this.activateChat();

    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_PAPER_AGENTS_CHAT);
    const leaf = leaves[0];
    if (!leaf) {
      new Notice("Failed to open chat view");
      return;
    }

    const view = leaf.view as PaperAgentsChatView;
    await view.loadConversationFromFile(filePath);
  }

  /**
   * Scans the conversations folder for Markdown files and loads any conversation
   * that is not already present in the ConversationManager (e.g. after conversations.json
   * was cleared or a conversation was only stored as a Markdown file).
   */
  private async restoreConversationsFromFiles(): Promise<void> {
    const conversationsPath = this.settings.conversationsPath || DEFAULT_PATHS.CONVERSATIONS;
    const folder = this.app.vault.getAbstractFileByPath(conversationsPath);
    if (!folder || !("children" in folder)) return;

    const mdFiles: TFile[] = [];
    this.collectMarkdownFiles(folder, mdFiles);

    let loaded = 0;
    for (const file of mdFiles) {
      try {
        const content = await this.app.vault.read(file);
        const parsed = this.conversationManager.parseConversationFile(content);
        if (!parsed) continue;

        const convId = parsed.conversation.id;
        if (convId) {
          const existing = this.conversationManager.getConversation(convId);
          if (existing) {
            // Newest-wins: prefer the Markdown file if it was updated more recently
            const markdownUpdatedAt = parsed.conversation.updatedAt ?? 0;
            if (markdownUpdatedAt <= existing.updatedAt) continue;
          }
        }

        this.conversationManager.loadFromConversationFile(content);
        loaded++;
      } catch (error) {
        globalLogger.debug(`Skipping file during conversation restore: ${file.path}`, { error });
      }
    }

    if (loaded > 0) {
      globalLogger.info(`Restored ${loaded} conversation(s) from Markdown files`);
    }
  }

  /**
   * Creates a new conversation Markdown file and opens PaperAgentsChatView.
   */
  private async createNewConversation(): Promise<void> {
    await this.activateChat();
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
