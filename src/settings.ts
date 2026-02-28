/**
 * Paper Agents Settings
 */

import { App, PluginSettingTab, Setting } from "obsidian";
import PaperAgents from "./main";
import { DEFAULT_PATHS } from "./utils/constants";

export interface PaperAgentsSettings {
  customToolsPath: string;
  conversationsPath: string;
  enableDebugLogging: boolean;
}

export const DEFAULT_SETTINGS: PaperAgentsSettings = {
  customToolsPath: DEFAULT_PATHS.CUSTOM_TOOLS,
  conversationsPath: DEFAULT_PATHS.CONVERSATIONS,
  enableDebugLogging: false,
};

export class PaperAgentsSettingTab extends PluginSettingTab {
  plugin: PaperAgents;

  constructor(app: App, plugin: PaperAgents) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl("h2", { text: "Paper Agents Settings" });

    // Custom Tools Path
    new Setting(containerEl)
      .setName("Custom Tools Path")
      .setDesc("Folder path for custom tool definitions (Markdown files with YAML frontmatter)")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_PATHS.CUSTOM_TOOLS)
          .setValue(this.plugin.settings.customToolsPath)
          .onChange(async (value) => {
            this.plugin.settings.customToolsPath = value || DEFAULT_PATHS.CUSTOM_TOOLS;
            await this.plugin.saveSettings();
          })
      );

    // Conversations Path
    new Setting(containerEl)
      .setName("Conversations Path")
      .setDesc("Folder path where conversation Markdown files are stored")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_PATHS.CONVERSATIONS)
          .setValue(this.plugin.settings.conversationsPath)
          .onChange(async (value) => {
            this.plugin.settings.conversationsPath = value || DEFAULT_PATHS.CONVERSATIONS;
            await this.plugin.saveSettings();
          })
      );

    // Debug Logging
    new Setting(containerEl)
      .setName("Enable Debug Logging")
      .setDesc("Enable detailed logging for troubleshooting (check console)")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableDebugLogging)
          .onChange(async (value) => {
            this.plugin.settings.enableDebugLogging = value;
            await this.plugin.saveSettings();
          })
      );

    // Info Section
    containerEl.createEl("h3", { text: "About" });
    containerEl.createEl("p", {
      text: "Paper Agents allows you to define and execute custom tools using YAML-based configurations.",
    });
    containerEl.createEl("p", {
      text: "Predefined tools: search_files, read_file, write_file, rest_request",
    });
  }
}

