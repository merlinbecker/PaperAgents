import { App, PluginSettingTab, Setting, Notice, requestUrl } from "obsidian";
import PaperAgents from "./main";
import { DEFAULT_PATHS, OPENROUTER_DEFAULTS } from "./utils/constants";

export interface PaperAgentsSettings {
  customToolsPath: string;
  enableDebugLogging: boolean;
  openRouterApiKey: string;
  defaultModel: string;
  temperature: number;
  maxTokens: number;
  agentsPath: string;
}

export const DEFAULT_SETTINGS: PaperAgentsSettings = {
  customToolsPath: DEFAULT_PATHS.CUSTOM_TOOLS,
  enableDebugLogging: false,
  openRouterApiKey: "",
  defaultModel: OPENROUTER_DEFAULTS.DEFAULT_MODEL,
  temperature: OPENROUTER_DEFAULTS.TEMPERATURE,
  maxTokens: OPENROUTER_DEFAULTS.MAX_TOKENS,
  agentsPath: DEFAULT_PATHS.AGENTS,
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

    containerEl.createEl("h3", { text: "OpenRouter API" });

    new Setting(containerEl)
      .setName("API Key")
      .setDesc("Your OpenRouter API key (stored locally)")
      .addText((text) => {
        text.inputEl.type = "password";
        text.inputEl.style.width = "300px";
        text
          .setPlaceholder("sk-or-...")
          .setValue(this.plugin.settings.openRouterApiKey)
          .onChange(async (value) => {
            this.plugin.settings.openRouterApiKey = value;
            await this.plugin.saveSettings();
            this.plugin.reinitializeOrchestrator();
          });
      })
      .addButton((button) =>
        button
          .setButtonText("Validate")
          .onClick(async () => {
            await this.validateApiKey();
          })
      );

    new Setting(containerEl)
      .setName("Default Model")
      .setDesc("Model to use when not specified by agent")
      .addDropdown((dropdown) => {
        for (const model of OPENROUTER_DEFAULTS.MODELS) {
          dropdown.addOption(model, model);
        }
        dropdown
          .setValue(this.plugin.settings.defaultModel)
          .onChange(async (value) => {
            this.plugin.settings.defaultModel = value;
            await this.plugin.saveSettings();
            this.plugin.reinitializeOrchestrator();
          });
      })
      .addText((text) => {
        text.inputEl.style.width = "200px";
        text
          .setPlaceholder("or enter custom model ID")
          .setValue(
            OPENROUTER_DEFAULTS.MODELS.includes(this.plugin.settings.defaultModel)
              ? ""
              : this.plugin.settings.defaultModel
          )
          .onChange(async (value) => {
            if (value.trim()) {
              this.plugin.settings.defaultModel = value.trim();
              await this.plugin.saveSettings();
              this.plugin.reinitializeOrchestrator();
            }
          });
      });

    new Setting(containerEl)
      .setName("Temperature")
      .setDesc(`Controls randomness (0 = deterministic, 2 = creative). Current: ${this.plugin.settings.temperature}`)
      .addSlider((slider) =>
        slider
          .setLimits(0, 2, 0.1)
          .setValue(this.plugin.settings.temperature)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.temperature = value;
            await this.plugin.saveSettings();
            this.plugin.reinitializeOrchestrator();
            this.display();
          })
      );

    new Setting(containerEl)
      .setName("Max Tokens")
      .setDesc("Maximum number of tokens in the response")
      .addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.style.width = "100px";
        text
          .setPlaceholder(String(OPENROUTER_DEFAULTS.MAX_TOKENS))
          .setValue(String(this.plugin.settings.maxTokens))
          .onChange(async (value) => {
            const parsed = parseInt(value, 10);
            if (!isNaN(parsed) && parsed > 0) {
              this.plugin.settings.maxTokens = parsed;
              await this.plugin.saveSettings();
              this.plugin.reinitializeOrchestrator();
            }
          });
      });

    containerEl.createEl("h3", { text: "Paths" });

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

    new Setting(containerEl)
      .setName("Agents Path")
      .setDesc("Folder path for agent definition files")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_PATHS.AGENTS)
          .setValue(this.plugin.settings.agentsPath)
          .onChange(async (value) => {
            this.plugin.settings.agentsPath = value || DEFAULT_PATHS.AGENTS;
            await this.plugin.saveSettings();
          })
      );

    containerEl.createEl("h3", { text: "Debug" });

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

    containerEl.createEl("h3", { text: "About" });
    containerEl.createEl("p", {
      text: "Paper Agents allows you to define and execute custom tools using YAML-based configurations.",
    });
    containerEl.createEl("p", {
      text: "Predefined tools: search_files, read_file, write_file, rest_request",
    });
  }

  private async validateApiKey(): Promise<void> {
    const apiKey = this.plugin.settings.openRouterApiKey;
    if (!apiKey) {
      new Notice("❌ Please enter an API key first");
      return;
    }

    try {
      new Notice("🔄 Validating API key...");
      const response = await requestUrl({
        url: `${OPENROUTER_DEFAULTS.API_URL}/auth/key`,
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        },
      });

      if (response.status === 200) {
        const data = response.json?.data;
        const label = data?.label || "unnamed";
        new Notice(`✅ API key valid (${label})`);
      } else {
        new Notice(`❌ API key invalid (HTTP ${response.status})`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      new Notice(`❌ API key validation failed: ${msg}`);
    }
  }
}
