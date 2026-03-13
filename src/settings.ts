import { App, PluginSettingTab, Setting, Notice, requestUrl } from "obsidian";
import PaperAgents from "./main";
import { DEFAULT_PATHS, OPENROUTER_DEFAULTS } from "./utils/constants";
import { LogLevel } from "./utils/logger";

export interface PaperAgentsSettings {
  customToolsPath: string;
  conversationsPath: string;
  enableDebugLogging: boolean;
  openRouterApiKey: string;
  defaultModel: string;
  temperature: number;
  maxTokens: number;
  agentsPath: string;
  canvasMarkdownPath: string;
  canvasSystemPromptFile: string;
  /** Minimum log level shown in the log panel and written to the logger (0=DEBUG, 1=INFO, 2=WARN, 3=ERROR) */
  logMinLevel: LogLevel;
  /** Log panel filter level — persisted so the user's filter choice survives reloads */
  logPanelFilterLevel: LogLevel;
}

export const DEFAULT_SETTINGS: PaperAgentsSettings = {
  customToolsPath: DEFAULT_PATHS.CUSTOM_TOOLS,
  conversationsPath: DEFAULT_PATHS.CONVERSATIONS,
  enableDebugLogging: false,
  openRouterApiKey: "",
  defaultModel: OPENROUTER_DEFAULTS.DEFAULT_MODEL,
  temperature: OPENROUTER_DEFAULTS.TEMPERATURE,
  maxTokens: OPENROUTER_DEFAULTS.MAX_TOKENS,
  agentsPath: DEFAULT_PATHS.AGENTS,
  canvasMarkdownPath: DEFAULT_PATHS.CANVAS_MARKDOWNS,
  canvasSystemPromptFile: "",
  logMinLevel: LogLevel.INFO,
  logPanelFilterLevel: LogLevel.INFO,
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

    new Setting(containerEl).setName("Openrouter API").setHeading();

    const apiKeyStatusEl = containerEl.createDiv({ cls: "pa-settings-api-status" });
    this.renderApiKeyStatus(apiKeyStatusEl);

    new Setting(containerEl)
      .setName("API key")
      .setDesc(this.createApiKeyDescription())
      .addText((text) => {
        text.inputEl.type = "password";
        text.inputEl.setCssProps({"width": "300px"});
        text
          .setPlaceholder("Sk-or-v1-...")
          .setValue(this.plugin.settings.openRouterApiKey)
          .onChange(async (value) => {
            this.plugin.settings.openRouterApiKey = value;
            await this.plugin.saveSettings();
            this.plugin.initializeOrchestrator();
            this.renderApiKeyStatus(apiKeyStatusEl);
          });
      })
      .addButton((button) =>
        button
          .setButtonText("Validate")
          .onClick(async () => {
            await this.validateApiKey(apiKeyStatusEl);
          })
      );

    new Setting(containerEl)
      .setName("Default model")
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
            this.plugin.initializeOrchestrator();
          });
      })
      .addText((text) => {
        text.inputEl.setCssProps({"width": "200px"});
        text
          .setPlaceholder("Or enter custom model ID")
          .setValue(
            OPENROUTER_DEFAULTS.MODELS.includes(this.plugin.settings.defaultModel)
              ? ""
              : this.plugin.settings.defaultModel
          )
          .onChange(async (value) => {
            if (value.trim()) {
              this.plugin.settings.defaultModel = value.trim();
              await this.plugin.saveSettings();
              this.plugin.initializeOrchestrator();
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
            this.plugin.initializeOrchestrator();
            this.display();
          })
      );

    new Setting(containerEl)
      .setName("Max tokens")
      .setDesc("Maximum number of tokens in the response")
      .addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.setCssProps({"width": "100px"});
        text
          .setPlaceholder(String(OPENROUTER_DEFAULTS.MAX_TOKENS))
          .setValue(String(this.plugin.settings.maxTokens))
          .onChange(async (value) => {
            const parsed = Number.parseInt(value, 10);
            if (!Number.isNaN(parsed) && parsed > 0) {
              this.plugin.settings.maxTokens = parsed;
              await this.plugin.saveSettings();
              this.plugin.initializeOrchestrator();
            }
          });
      });

    new Setting(containerEl).setName("Paths").setHeading();

    new Setting(containerEl)
      .setName("Custom tools path")
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
      .setName("Agents path")
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

    // Conversations Path
    new Setting(containerEl)
      .setName("Conversations path")
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

    new Setting(containerEl).setName("Agent Canvas").setHeading();

    new Setting(containerEl)
      .setName("Canvas Markdowns path")
      .setDesc(
        "Folder path for canvas Markdown files. The Agent Canvas modal can load documents directly from this folder."
      )
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_PATHS.CANVAS_MARKDOWNS)
          .setValue(this.plugin.settings.canvasMarkdownPath)
          .onChange(async (value) => {
            this.plugin.settings.canvasMarkdownPath = value || DEFAULT_PATHS.CANVAS_MARKDOWNS;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Canvas system prompt file")
      .setDesc(
        this.createCanvasSystemPromptDescription()
      )
      .addText((text) =>
        text
          .setPlaceholder("e.g. paper-agents-canvas/canvas-system-prompt.md")
          .setValue(this.plugin.settings.canvasSystemPromptFile)
          .onChange(async (value) => {
            this.plugin.settings.canvasSystemPromptFile = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl).setName("Debug").setHeading();

    // Minimum log level for the global logger
    new Setting(containerEl)
      .setName("Log level")
      .setDesc("Minimum severity level recorded by the logger and shown in the sidebar log panel")
      .addDropdown((dropdown) => {
        dropdown
          .addOption(String(LogLevel.DEBUG), "Debug (all)")
          .addOption(String(LogLevel.INFO),  "Info")
          .addOption(String(LogLevel.WARN),  "Warn")
          .addOption(String(LogLevel.ERROR), "Error only")
          .setValue(String(this.plugin.settings.logMinLevel))
          .onChange(async (value) => {
            const level = Number(value) as LogLevel;
            this.plugin.settings.logMinLevel = level;
            await this.plugin.saveSettings();
            this.plugin.applyLogLevel();
          });
      });

    // Debug Logging (legacy toggle — kept for backward compat, drives logMinLevel)
    new Setting(containerEl)
      .setName("Enable debug logging")
      .setDesc("Shortcut: sets log level to debug (all messages) when enabled, info otherwise")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableDebugLogging)
          .onChange(async (value) => {
            this.plugin.settings.enableDebugLogging = value;
            this.plugin.settings.logMinLevel = value ? LogLevel.DEBUG : LogLevel.INFO;
            await this.plugin.saveSettings();
            this.plugin.applyLogLevel();
            // Re-render to keep the dropdown in sync
            this.display();
          })
      );

    new Setting(containerEl).setName("About").setHeading();
    containerEl.createEl("p", {
      text: "Paper agents allows you to define and execute custom tools using YAML-based configurations.",
    });
    containerEl.createEl("p", {
      text: "Predefined tools: search_files, read_file, write_file, REST_request, websearch",
    });
  }

  private createCanvasSystemPromptDescription(): DocumentFragment {
    const frag = document.createDocumentFragment();
    frag.appendText(
      "Path to a Markdown file whose body text will be used as the system prompt for canvas sessions. " +
      "Leave empty to use the built-in default prompt. "
    );
    frag.appendText("Example file content: ");
    const code = document.createElement("code");
    code.textContent = "paper-agents-canvas/canvas-system-prompt.md";
    frag.appendChild(code);
    frag.appendText(
      " — Place your custom instructions there. " +
      'See the sidebar examples section for a "Canvas System Prompt" template.'
    );
    return frag;
  }

  private createApiKeyDescription(): DocumentFragment {
    const frag = document.createDocumentFragment();
    frag.appendText("Your OpenRouter API key (stored locally). ");
    const link = document.createElement("a");
    link.textContent = "Get a free API key";
    link.href = "https://openrouter.ai/keys";
    link.target = "_blank";
    frag.appendChild(link);
    return frag;
  }

  private renderApiKeyStatus(container: HTMLElement): void {
    container.empty();
    const key = this.plugin.settings.openRouterApiKey;

    const statusDiv = container.createDiv({ cls: "pa-api-status-badge" });

    if (key) {
      statusDiv.addClass("pa-api-status-set");
      statusDiv.createSpan({ text: "API key configured" });
    } else {
      statusDiv.addClass("pa-api-status-missing");
      statusDiv.createSpan({ text: "No API key configured — Chat & Agent features require an OpenRouter API key" });
    }
  }

  private async validateApiKey(statusEl?: HTMLElement): Promise<void> {
    const apiKey = this.plugin.settings.openRouterApiKey;
    if (!apiKey) {
      new Notice("Please enter an API key first");
      return;
    }

    try {
      new Notice("Validating API key...");
      const response = await requestUrl({
        url: `${OPENROUTER_DEFAULTS.API_URL}/auth/key`,
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        },
      });

      if (response.status === 200) {
        const json = response.json as { data?: { label?: string; limit?: number } } | undefined;
        const data = json?.data;
        const label = data?.label || "unnamed";
        const limit = data?.limit ? `$${(data.limit / 100).toFixed(2)} limit` : "unlimited";
        new Notice(`API key valid (${label}, ${limit})`);
        if (statusEl) {
          statusEl.empty();
          const badge = statusEl.createDiv({ cls: "pa-api-status-badge pa-api-status-valid" });
          badge.createSpan({ text: `API key valid (${label})` });
        }
      } else {
        new Notice(`API key invalid (HTTP ${response.status})`);
        if (statusEl) {
          statusEl.empty();
          const badge = statusEl.createDiv({ cls: "pa-api-status-badge pa-api-status-invalid" });
          badge.createSpan({ text: "API key invalid" });
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      new Notice(`API key validation failed: ${msg}`);
    }
  }
}
