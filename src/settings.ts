import {App, PluginSettingTab, Setting} from "obsidian";
import PaperAgents from "./main";

export interface PaperAgentsSettings {
	mySetting: string;
}

export const DEFAULT_SETTINGS: PaperAgentsSettings = {
	mySetting: 'default'
}

export class SampleSettingTab extends PluginSettingTab {
	plugin: PaperAgents;

	constructor(app: App, plugin: PaperAgents) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Settings #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}
