/**
 * Tool Registry - Zentrale Verwaltung aller Tools
 * Verwaltet vordefinierte Tools und Custom-Tools
 * Factory Pattern für Tool-Instanzierung
 */

import { Agent, IExecutableTool, ToolMetadata, IToolFactory } from "../types";
import { PREDEFINED_TOOL_IDS, TOOL_CATEGORIES, TOOL_ICONS } from "../utils/constants";
import { globalLogger } from "../utils/logger";

export class ToolRegistry {
  private predefinedTools: Map<string, IToolFactory> = new Map();
  private customTools: Map<string, Agent> = new Map();
  private executableTools: Map<string, IExecutableTool> = new Map();

  constructor() {
    globalLogger.info("ToolRegistry initialized");
  }

  /**
   * Registriert eine vordefinierte Tool-Factory
   */
  registerPredefined(factory: IToolFactory): void {
    this.predefinedTools.set(factory.name, factory);
    globalLogger.debug(`Registered predefined tool: ${factory.name}`);
  }

  /**
   * Registriert mehrere vordefinierte Tools auf einmal
   */
  registerPredefinedBatch(factories: IToolFactory[]): void {
    for (const factory of factories) {
      this.registerPredefined(factory);
    }
    globalLogger.info(`Registered ${factories.length} predefined tools`);
  }

  /**
   * Registriert ein Custom-Tool (Agent)
   */
  registerCustom(agent: Agent): void {
    this.customTools.set(agent.id, agent);
    globalLogger.debug(`Registered custom tool: ${agent.id}`);
  }

  /**
   * Registriert mehrere Custom-Tools auf einmal
   */
  registerCustomBatch(agents: Agent[]): void {
    for (const agent of agents) {
      this.registerCustom(agent);
    }
    globalLogger.info(`Registered ${agents.length} custom tools`);
  }

  /**
   * Gibt ein Tool als IExecutableTool zurück
   * Erstellt Instanz bei Bedarf (Factory Pattern)
   */
  getTool(id: string): IExecutableTool | null {
    // Check Cache
    if (this.executableTools.has(id)) {
      return this.executableTools.get(id) || null;
    }

    // Versuche vordefiniertes Tool zu laden
    const predefinedFactory = this.predefinedTools.get(id);
    if (predefinedFactory) {
      try {
        const tool = predefinedFactory.create();
        this.executableTools.set(id, tool);
        return tool;
      } catch (error) {
        globalLogger.error(`Failed to create predefined tool: ${id}`, { error });
        return null;
      }
    }

    // Versuche Custom-Tool zu laden
    const agent = this.customTools.get(id);
    if (agent) {
      try {
        const tool = this.agentToExecutableTool(agent);
        this.executableTools.set(id, tool);
        return tool;
      } catch (error) {
        globalLogger.error(`Failed to create custom tool: ${id}`, { error });
        return null;
      }
    }

    globalLogger.warn(`Tool not found: ${id}`);
    return null;
  }

  /**
   * Gibt alle verfügbaren Tools als Metadata zurück
   */
  listTools(): ToolMetadata[] {
    const metadata: ToolMetadata[] = [];

    // Predefined Tools
    for (const [id, factory] of this.predefinedTools) {
      metadata.push({
        id,
        name: factory.name,
        description: factory.description,
        type: "predefined",
        parameters: [], // Wird bei Bedarf geladen
        category: TOOL_CATEGORIES.SYSTEM,
        icon: TOOL_ICONS.SYSTEM,
      });
    }

    // Custom Tools
    for (const [id, agent] of this.customTools) {
      const category = agent.type === "chain" ? TOOL_CATEGORIES.CHAIN : TOOL_CATEGORIES.CUSTOM;
      const icon = agent.type === "chain" ? TOOL_ICONS.CHAIN : TOOL_ICONS.CUSTOM;

      metadata.push({
        id,
        name: agent.name,
        description: agent.description,
        type: agent.type === "chain" ? "chain" : "custom",
        parameters: agent.parameters,
        category,
        icon,
      });
    }

    return metadata.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Sucht Tools nach Name/Description (für Sidebar-Filter)
   */
  searchTools(query: string): ToolMetadata[] {
    const lowerQuery = query.toLowerCase();
    return this.listTools().filter(
      (tool) =>
        tool.name.toLowerCase().includes(lowerQuery) ||
        (tool.description && tool.description.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Gibt alle Predefined-Tool-IDs zurück
   */
  getPredefinedIds(): string[] {
    return Array.from(this.predefinedTools.keys());
  }

  /**
   * Gibt alle Custom-Tool-IDs zurück
   */
  getCustomIds(): string[] {
    return Array.from(this.customTools.keys());
  }

  /**
   * Prüft, ob ein Tool existiert
   */
  hasTool(id: string): boolean {
    return this.predefinedTools.has(id) || this.customTools.has(id);
  }

  /**
   * Löscht ein Custom-Tool
   */
  removeTool(id: string): boolean {
    const removed = this.customTools.delete(id);
    if (removed) {
      this.executableTools.delete(id);
      globalLogger.debug(`Removed tool: ${id}`);
    }
    return removed;
  }

  /**
   * Löscht alle Custom-Tools
   */
  clearCustomTools(): void {
    const count = this.customTools.size;
    this.customTools.clear();
    this.executableTools.clear();
    globalLogger.info(`Cleared ${count} custom tools`);
  }

  /**
   * Konvertiert einen Agent zu IExecutableTool für Chaining
   * Wird benötigt, wenn ein Agent selbst als Tool in anderem Agent verwendet wird
   */
  private agentToExecutableTool(agent: Agent): IExecutableTool {
    const self = this;

    return {
      name: agent.name,
      parameters: agent.parameters,

      async execute(ctx) {
        const { toolExecutor } = await import("./tool-executor");
        return toolExecutor.executeAgent(agent, self, ctx.parameters);
      },

      shouldRequireHITL() {
        // HITL-Entscheidung für jeden Step wird im Executor getroffen
        return false;
      },
    };
  }

  /**
   * Gibt Registry-Statistiken zurück
   */
  getStats(): {
    totalTools: number;
    predefinedTools: number;
    customTools: number;
    cachedExecutables: number;
  } {
    return {
      totalTools: this.predefinedTools.size + this.customTools.size,
      predefinedTools: this.predefinedTools.size,
      customTools: this.customTools.size,
      cachedExecutables: this.executableTools.size,
    };
  }

  /**
   * Setzt Registry zurück (für Tests)
   */
  reset(): void {
    this.predefinedTools.clear();
    this.customTools.clear();
    this.executableTools.clear();
    globalLogger.debug("ToolRegistry reset");
  }
}

export default ToolRegistry;
