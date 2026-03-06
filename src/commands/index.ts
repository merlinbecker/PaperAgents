/**
 * Command Registration - All plugin commands in one place
 * Keeps main.ts focused on lifecycle management
 */

import { Notice } from "obsidian";
import type PaperAgents from "../main";
import { executionHistory } from "../core/history";
import { HistoryPanelModal } from "../ui/history-panel";
import { TemplateBrowserModal, ToolTemplate } from "../ui/template-browser";
import { WorkflowViewModal } from "../ui/workflow-view";
import { CanvasModal } from "../ui/canvas-modal";

export function registerCommands(plugin: PaperAgents): void {
  plugin.addCommand({
    id: "open-sidebar",
    name: "Open sidebar",
    callback: () => { void plugin.activateSidebar(); },
  });

  plugin.addCommand({
    id: "open-chat",
    name: "Open agent chat",
    callback: () => { void plugin.activateChat(); },
  });

  plugin.addCommand({
    id: "reload-custom-tools",
    name: "Reload custom tools",
    callback: async () => {
      await plugin.loadCustomToolsFromVault();
      new Notice("Custom tools reloaded");
      plugin.sidebar?.refreshTools();
    },
  });

  plugin.addCommand({
    id: "reload-agents",
    name: "Reload agents",
    callback: async () => {
      await plugin.loadAgentsFromVault();
      new Notice(`Agents reloaded (${plugin.loadedAgents.length} loaded)`);
      plugin.sidebar?.setAgents(plugin.loadedAgents);
    },
  });

  plugin.addCommand({
    id: "show-history",
    name: "Show execution history",
    callback: () => {
      new HistoryPanelModal(plugin.app, executionHistory).open();
    },
  });

  plugin.addCommand({
    id: "browse-templates",
    name: "Browse templates",
    callback: () => {
      openTemplateBrowser(plugin);
    },
  });

  plugin.addCommand({
    id: "show-workflow",
    name: "Show workflow view",
    callback: () => {
      openWorkflowView(plugin);
    },
  });

  plugin.addCommand({
    id: "apply-agent-canvas",
    name: "Apply interactive agent to document",
    callback: () => {
      openCanvasModal(plugin);
    },
  });
}

function openTemplateBrowser(plugin: PaperAgents): void {
  const templates: ToolTemplate[] = [];

  for (const tool of plugin.toolRegistry.listTools()) {
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

  for (const agent of plugin.loadedAgents) {
    templates.push({
      id: agent.id,
      name: agent.name,
      description: agent.systemPrompt?.substring(0, 100) || "",
      type: "agent",
      content: JSON.stringify(agent, null, 2),
    });
  }

  new TemplateBrowserModal(plugin.app, templates, (template) => {
    new Notice(`Template "${template.name}" imported`);
  }).open();
}

function openWorkflowView(plugin: PaperAgents): void {
  if (plugin.loadedAgents.length === 0) {
    new Notice("No agents loaded. Load agents first.");
    return;
  }

  const agent = plugin.loadedAgents.find((a) => a.tools.length > 1) ?? plugin.loadedAgents[0];
  if (!agent) return;

  const agentAsWorkflow = {
    id: agent.id,
    name: agent.name,
    type: agent.tools.length > 1 ? "chain" as const : "single" as const,
    parameters: [],
    steps: agent.tools.map((t) => ({ name: t, parameters: {} })),
  };

  new WorkflowViewModal(plugin.app, agentAsWorkflow).open();
}

function openCanvasModal(plugin: PaperAgents): void {
  new CanvasModal(
    plugin.app,
    plugin.loadedAgents,
    plugin.conversationManager,
    () => plugin.orchestrator
  ).open();
}
