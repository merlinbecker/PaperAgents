/**
 * Paper Agents - Main Plugin Entry Point
 * Obsidian Community Plugin für Agent-basierte Tool-Ausführung
 */

import { Plugin, Notice } from "obsidian";
import { DEFAULT_SETTINGS, PaperAgentsSettings, PaperAgentsSettingTab } from "./settings";

// Core
import ToolRegistry from "./core/tool-registry";
import { toolExecutor } from "./core/tool-executor";
import { customJSExecutor } from "./core/sandbox";

// Tools
import PredefinedToolsFactory from "./tools/predefined";

// Parser
import ToolLoader from "./parser/tool-loader";

// UI
import { PaperAgentsSidebar, VIEW_TYPE_PAPER_AGENTS } from "./ui/sidebar";
import { ToolFormModal } from "./ui/forms";
import { showHITLModal } from "./ui/hitl-modal";

// Utils
import { globalLogger } from "./utils/logger";
import { DEFAULT_PATHS } from "./utils/constants";

export default class PaperAgents extends Plugin {
  settings: PaperAgentsSettings;
  toolRegistry: ToolRegistry;
  sidebar: PaperAgentsSidebar | null = null;

  async onload() {
    globalLogger.info("Paper Agents plugin loading...");

    // Load Settings
    await this.loadSettings();

    // Initialize Registry
    this.toolRegistry = new ToolRegistry(this.app);

    // Register Predefined Tools
    this.registerPredefinedTools();

    // Load Custom Tools from Vault
    await this.loadCustomToolsFromVault();

    // Initialize Sandbox
    await customJSExecutor.initialize();

    // Register Sidebar View
    this.registerView(
      VIEW_TYPE_PAPER_AGENTS,
      (leaf) =>
        new PaperAgentsSidebar(leaf, this.toolRegistry, (toolId) =>
          this.handleToolClick(toolId)
        )
    );

    // Add Ribbon Icon
    this.addRibbonIcon("bot", "Paper Agents", () => {
      this.activateSidebar();
    });

    // Add Commands
    this.addCommand({
      id: "open-sidebar",
      name: "Open Paper Agents Sidebar",
      callback: () => {
        this.activateSidebar();
      },
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

    // Add Settings Tab
    this.addSettingTab(new PaperAgentsSettingTab(this.app, this));

    // Register HITL Callbacks
    this.registerHITLCallbacks();

    globalLogger.info("Paper Agents plugin loaded successfully");
  }

  async onunload() {
    globalLogger.info("Paper Agents plugin unloading...");

    // Cleanup Sandbox
    await customJSExecutor.destroy();

    // Detach Sidebar
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_PAPER_AGENTS);

    globalLogger.info("Paper Agents plugin unloaded");
  }

  /**
   * Registriert alle vordefinierten Tools
   */
  private registerPredefinedTools(): void {
    this.toolRegistry.registerPredefinedBatch([
      PredefinedToolsFactory.searchFiles,
      PredefinedToolsFactory.readFile,
      PredefinedToolsFactory.writeFile,
      PredefinedToolsFactory.restRequest,
    ]);

    globalLogger.info("Predefined tools registered", {
      count: 4,
    });
  }

  /**
   * Lädt Custom Tools aus Vault
   */
  private async loadCustomToolsFromVault(): Promise<void> {
    try {
      const customToolsPath = this.settings.customToolsPath || DEFAULT_PATHS.CUSTOM_TOOLS;

      const loader = new ToolLoader(this.app);
      const result = await loader.loadCustomTools(customToolsPath);

      // Registriere geladene Tools
      this.toolRegistry.registerCustomBatch(result.successful);

      globalLogger.info("Custom tools loaded", {
        loaded: result.successful.length,
        failed: result.failed.length,
      });

      if (result.failed.length > 0) {
        new Notice(
          `Loaded ${result.successful.length} tools, ${result.failed.length} failed`
        );
      }
    } catch (error) {
      globalLogger.error("Failed to load custom tools", { error });
      new Notice("Failed to load custom tools");
    }
  }

  /**
   * Aktiviert Sidebar (öffnet wenn nicht sichtbar)
   */
  private async activateSidebar(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_PAPER_AGENTS);

    if (existing.length > 0) {
      const leaf = existing[0];
      if (!leaf) return;
      
      // Sidebar existiert bereits, fokussiere sie
      this.app.workspace.revealLeaf(leaf);
    } else {
      // Erstelle neue Sidebar
      const leaf = this.app.workspace.getRightLeaf(false);
      if (!leaf) {
        new Notice("Failed to create sidebar");
        return;
      }
      
      await leaf.setViewState({
        type: VIEW_TYPE_PAPER_AGENTS,
        active: true,
      });

      this.app.workspace.revealLeaf(leaf);

      // Referenz speichern
      this.sidebar = leaf.view as PaperAgentsSidebar;
    }
  }

  /**
   * Behandelt Tool-Click in Sidebar
   */
  private handleToolClick(toolId: string): void {
    const metadata = this.toolRegistry
      .listTools()
      .find((t) => t.id === toolId);

    if (!metadata) {
      new Notice("Tool not found");
      return;
    }

    // Öffne Form Modal
    const modal = new ToolFormModal(this.app, metadata, (parameters) => {
      this.executeToolWithParameters(toolId, metadata.name, parameters);
    });

    modal.open();
  }

  /**
   * Führt Tool mit Parametern aus
   */
  private async executeToolWithParameters(
    toolId: string,
    toolName: string,
    parameters: Record<string, any>
  ): Promise<void> {
    try {
      this.sidebar?.updateStatus(`Executing ${toolName}...`);

      const tool = this.toolRegistry.getTool(toolId);
      if (!tool) {
        throw new Error(`Tool not found: ${toolId}`);
      }

      // Erstelle Execution Context
      const context = {
        parameters,
        previousStepOutputs: {},
        date: new Date().toISOString().split("T")[0] || "",
        time:
          new Date().toISOString().split("T")[1]?.split(".")[0] || "",
        randomId: Math.random().toString(36).substring(7) || "",
      };

      // Führe Tool aus
      const result = await tool.execute(context);

      if (result.success) {
        this.sidebar?.showSuccess(`${toolName} completed`);
        new Notice(`✅ ${toolName} completed successfully`);

        // Zeige Output
        globalLogger.info("Tool execution result", { result: result.data });
      } else {
        throw new Error(result.error || "Unknown error");
      }
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Unknown error";
      this.sidebar?.showError(errorMsg);
      new Notice(`❌ ${toolName} failed: ${errorMsg}`);
      globalLogger.error("Tool execution failed", { error });
    }
  }

  /**
   * Registriert HITL Callbacks für alle Steps
   */
  private registerHITLCallbacks(): void {
    // Dummy Step IDs - werden später von Executor gesetzt
    // Der Executor ruft showHITLModal() auf wenn benötigt
    globalLogger.debug("HITL callbacks ready");
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

