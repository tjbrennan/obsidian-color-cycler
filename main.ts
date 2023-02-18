import { App, Plugin, PluginSettingTab, Setting } from "obsidian";

// Remember to rename these classes and interfaces!

interface ColorCyclerSettings {
	increment: string;
}

const DEFAULT_SETTINGS: ColorCyclerSettings = {
	increment: "30",
};

export default class ColorCycler extends Plugin {
	settings: ColorCyclerSettings;
	hue: string;

	async onload() {
		await this.loadSettings();

		this.hue = document.body.style.getPropertyValue("--accent-h");

		const ribbonIconEl = this.addRibbonIcon(
			"palette",
			"Sample Plugin",
			(evt: MouseEvent) => {
				this.cycleColor();
			}
		);

		this.addCommand({
			id: "cycle-color",
			name: "Cycle accent color",
			callback: () => {
				this.cycleColor();
			},
		});

		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText(`Hue ${this.hue}`);

		ribbonIconEl.addEventListener("click", () =>
			statusBarItemEl.setText(`Hue ${this.hue}`)
		);

		this.addSettingTab(new ColorCyclerSettingTab(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	cycleColor() {
		let hue = parseInt(this.hue) || 0;
		const increment = parseInt(this.settings.increment) || 30;

		if (hue % increment !== 0 || hue % 360 === 0) {
			hue = 0;
		}

		this.hue = (hue + increment).toString();

		document.body.style.setProperty("--accent-h", this.hue);
	}
}

class ColorCyclerSettingTab extends PluginSettingTab {
	plugin: ColorCycler;

	constructor(app: App, plugin: ColorCycler) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", { text: "Settings for Color Cycler" });

		new Setting(containerEl)
			.setName("Color wheel increment")
			.setDesc("How many degrees to advance the color wheel")
			.addText((text) =>
				text
					.setPlaceholder("Enter degrees")
					.setValue(this.plugin.settings.increment)
					.onChange(async (value) => {
						this.plugin.settings.increment = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
