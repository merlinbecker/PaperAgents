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

export function registerCommands(plugin: PaperAgents): void {
  plugin.addCommand({
    id: "open-sidebar",
    name: "Open Paper Agents Sidebar",
    callback: () => { plugin.activateSidebar(); },
  });

  plugin.addCommand({
    id: "open-chat",
    name: "Open Agent Chat",
    callback: () => { plugin.activateChat(); },
  });

  plugin.addCommand({
    id: "reload-custom-tools",
    name: "Reload Custom Tools",
    callback: async () => {
      await plugin.loadCustomToolsFromVault();
      new Notice("Custom tools reloaded");
      plugin.sidebar?.refreshTools();
    },
  });

  plugin.addCommand({
    id: "reload-agents",
    name: "Reload Agents",
    callback: async () => {
      await plugin.loadAgentsFromVault();
      new Notice(`Agents reloaded (${plugin.loadedAgents.length} loaded)`);
      plugin.sidebar?.setAgents(plugin.loadedAgents);
    },
  });

  plugin.addCommand({
    id: "show-history",
    name: "Show Execution History",
    callback: () => {
      new HistoryPanelModal(plugin.app, executionHistory).open();
    },
  });

  plugin.addCommand({
    id: "browse-templates",
    name: "Browse Templates",
    callback: () => {
      openTemplateBrowser(plugin);
    },
  });

  plugin.addCommand({
    id: "show-workflow",
    name: "Show Workflow View",
    callback: () => {
      openWorkflowView(plugin);
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

  const chainAgents = plugin.loadedAgents.filter((a) => a.tools.length > 1);
  const agent = chainAgents[0] || plugin.loadedAgents[0];
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
