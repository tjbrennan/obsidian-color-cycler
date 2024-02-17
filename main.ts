import { App, HSL, Plugin, PluginSettingTab, Setting } from "obsidian";

enum Behavior {
	INCREMENT = "increment",
	RANDOM = "random",
	PRESET = "preset",
}

interface IncrementBehavior {
	startAngle: number;
	degrees: number;
	saturation: number;
	lightness: number;
}

interface RandomBehavior {
	isHueRandom: boolean;
	isSaturationRandom: boolean;
	isLightnessRandom: boolean;
	hue: number;
	saturation: number;
	lightness: number;
}

interface PresetBehavior {
	currentPresetIndex: number;
	colorList: HSL[];
}

interface ColorCyclerSettings {
	color: HSL;
	behavior: Behavior;
	[Behavior.INCREMENT]: IncrementBehavior;
	[Behavior.RANDOM]: RandomBehavior;
	[Behavior.PRESET]: PresetBehavior;
}

const DEFAULT_SETTINGS: ColorCyclerSettings = {
	color: {
		h: 0,
		s: 100,
		l: 50,
	},
	behavior: Behavior.INCREMENT,
	increment: {
		startAngle: 0,
		degrees: 30,
		saturation: 100,
		lightness: 50,
	},
	random: {
		isHueRandom: true,
		isSaturationRandom: false,
		isLightnessRandom: false,
		hue: 0,
		saturation: 100,
		lightness: 50,
	},
	preset: {
		currentPresetIndex: 0,
		colorList: [],
	},
};

export default class ColorCycler extends Plugin {
	settings: ColorCyclerSettings = DEFAULT_SETTINGS;
	statusBarItemEl: HTMLElement;
	ribbonIconEl: HTMLElement;

	async onload() {
		await this.loadSettings();
		this.setColor(this.settings.color);

		this.statusBarItemEl = this.addStatusBarItem();
		this.statusBarItemEl.setText(
			`HSL ${this.settings.color.h} ${this.settings.color.s} ${this.settings.color.l}`
		);

		this.ribbonIconEl = this.addRibbonIcon(
			"palette",
			"Cycle accent color",
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

		this.addSettingTab(new ColorCyclerSettingTab(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		const savedData = await this.loadData();
		this.settings = {
			...DEFAULT_SETTINGS,
			...savedData,
			color: {
				...DEFAULT_SETTINGS.color,
				...savedData.color,
			},
			increment: {
				...DEFAULT_SETTINGS.increment,
				...savedData.increment,
			},
			random: {
				...DEFAULT_SETTINGS.random,
				...savedData.random,
			},
			preset: {
				...DEFAULT_SETTINGS.preset,
				...savedData.preset,
			},
		};
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	updateColor(color: HSL) {
		let newHue = color.h;
		let newSaturation = color.s;
		let newLightness = color.l;

		newHue = newHue % 360;

		if (newSaturation > 100) {
			newSaturation = 100;
		} else if (newSaturation < 0) {
			newSaturation = 0;
		}

		if (newLightness > 100) {
			newLightness = 100;
		} else if (newLightness < 0) {
			newLightness = 0;
		}

		this.settings.color = { h: newHue, s: newSaturation, l: newLightness };

		this.statusBarItemEl.setText(
			`HSL ${this.settings.color.h} ${this.settings.color.s} ${this.settings.color.l}`
		);
		this.setColor(this.settings.color);
		this.saveSettings();
	}

	setColor(color: HSL) {
		document.body.style.setProperty("--accent-h", `${color.h}`);
		document.body.style.setProperty("--accent-s", `${color.s}%`);
		document.body.style.setProperty("--accent-l", `${color.l}%`);
	}

	resetColor() {
		this.updateColor(this.settings.color);
	}

	incrementColor() {
		const currentHue = this.settings.color.h;
		const degrees = this.settings.increment.degrees;
		let newHue = currentHue + degrees;

		this.settings.color.h = newHue;
		this.updateColor(this.settings.color);
	}

	randomizeColor() {
		const hue = this.settings.random.isHueRandom
			? Math.floor(Math.random() * 360)
			: this.settings.random.hue;
		const saturation = this.settings.random.isSaturationRandom
			? Math.floor(Math.random() * 100)
			: this.settings.random.saturation;
		const lightness = this.settings.random.isLightnessRandom
			? Math.floor(Math.random() * 100)
			: this.settings.random.lightness;

		this.settings.color = {
			h: hue,
			s: saturation,
			l: lightness,
		};

		this.updateColor(this.settings.color);
	}

	cyclePresetColor() {
		const nextPresetIndex =
			this.settings.preset.currentPresetIndex + 1 >=
			this.settings.preset.colorList.length
				? 0
				: this.settings.preset.currentPresetIndex + 1;

		this.settings.preset.currentPresetIndex = nextPresetIndex;

		this.updateColor(
			this.settings.preset.colorList[nextPresetIndex] ??
				this.settings.color
		);
	}

	cycleColor() {
		switch (this.settings.behavior) {
			case Behavior.INCREMENT:
				this.incrementColor();
				break;
			case Behavior.RANDOM:
				this.randomizeColor();
				break;
			case Behavior.PRESET:
				this.cyclePresetColor();
			default:
				this.resetColor();
		}
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
		containerEl.createEl("h2", { text: "Color Cycler" });
		containerEl.createEl("p", {
			cls: "setting-item-description",
			text: "This plugin allows you to dynamically change the accent color by clicking the sidebar button. Color is set using HSL format.",
		});
		containerEl.createEl("a", {
			cls: "setting-item-description",

			text: "HSL documentation",
			href: "https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/hsl",
		});
		containerEl.createEl("br");
		containerEl.createEl("br");

		/*
		 * Increment settings
		 */
		const showIncrementSettings = () => {
			this.plugin.updateColor({
				h: this.plugin.settings.increment.startAngle,
				s: this.plugin.settings.increment.saturation,
				l: this.plugin.settings.increment.lightness,
			});

			containerEl.createEl("h2", { text: "Increment" });

			new Setting(containerEl)
				.setName("Starting hue angle")
				.setDesc(
					"Hue angle on the color wheel to start incrementing from"
				)
				.addText((text) =>
					text
						.setPlaceholder("1-359")
						.setValue(
							this.plugin.settings.increment.startAngle.toString()
						)
						.onChange(async (value) => {
							this.plugin.settings.increment.startAngle =
								parseInt(value);
							this.plugin.updateColor({
								h: this.plugin.settings.increment.startAngle,
								s: this.plugin.settings.increment.saturation,
								l: this.plugin.settings.increment.lightness,
							});
							await this.plugin.saveSettings();
						})
				);

			new Setting(containerEl)
				.setName("Hue degrees")
				.setDesc(
					"Hue angle degrees of the color wheel to advance on each click"
				)
				.addText((text) =>
					text
						.setPlaceholder("1-359")
						.setValue(
							this.plugin.settings.increment.degrees.toString()
						)
						.onChange(async (value) => {
							this.plugin.settings.increment.degrees =
								parseInt(value);
							this.plugin.updateColor({
								h: this.plugin.settings.increment.startAngle,
								s: this.plugin.settings.increment.saturation,
								l: this.plugin.settings.increment.lightness,
							});
							await this.plugin.saveSettings();
						})
				);

			new Setting(containerEl)
				.setName("Saturation")
				.setDesc("Saturation percentage (this value is static)")
				.addText((text) =>
					text
						.setPlaceholder("0-100")
						.setValue(
							this.plugin.settings.increment.saturation.toString()
						)
						.onChange(async (value) => {
							this.plugin.settings.increment.saturation =
								parseInt(value);
							this.plugin.updateColor({
								h: this.plugin.settings.increment.startAngle,
								s: this.plugin.settings.increment.saturation,
								l: this.plugin.settings.increment.lightness,
							});
							await this.plugin.saveSettings();
						})
				);

			new Setting(containerEl)
				.setName("Lightness")
				.setDesc("Lightness percentage (this value is static)")
				.addText((text) =>
					text
						.setPlaceholder("0-100")
						.setValue(this.plugin.settings.color.l.toString())
						.onChange(async (value) => {
							this.plugin.settings.increment.lightness =
								parseInt(value);
							this.plugin.updateColor({
								h: this.plugin.settings.increment.startAngle,
								s: this.plugin.settings.increment.saturation,
								l: this.plugin.settings.increment.lightness,
							});
							await this.plugin.saveSettings();
						})
				);
		};

		/*
		 * Random settings
		 */
		const showRandomSettings = () => {
			this.plugin.updateColor({
				h: this.plugin.settings.random.hue,
				s: this.plugin.settings.random.saturation,
				l: this.plugin.settings.random.lightness,
			});

			containerEl.createEl("h2", { text: "Random" });

			new Setting(containerEl)
				.setName("Randomize hue")
				.setDesc("Randomize hue angle on each click")
				.addToggle((toggle) =>
					toggle
						.setValue(this.plugin.settings.random.isHueRandom)
						.onChange(async (value) => {
							this.plugin.settings.random.isHueRandom = value;
							await this.plugin.saveSettings();
							this.display();
						})
				);

			if (!this.plugin.settings.random.isHueRandom) {
				new Setting(containerEl)
					.setName("Hue angle")
					.setDesc(
						"Static hue angle of the color wheel to use if not randomized"
					)
					.addText((text) =>
						text
							.setPlaceholder("0-360")
							.setValue(
								this.plugin.settings.random.hue.toString()
							)
							.onChange(async (value) => {
								this.plugin.settings.random.hue =
									parseInt(value);
								this.plugin.updateColor({
									h: this.plugin.settings.random.hue,
									s: this.plugin.settings.random.saturation,
									l: this.plugin.settings.random.lightness,
								});
								await this.plugin.saveSettings();
							})
					);
			}

			new Setting(containerEl)
				.setName("Randomize saturation")
				.setDesc("Randomize saturation percentage on each click")
				.addToggle((toggle) =>
					toggle
						.setValue(
							this.plugin.settings.random.isSaturationRandom
						)
						.onChange(async (value) => {
							this.plugin.settings.random.isSaturationRandom =
								value;
							await this.plugin.saveSettings();
							this.display();
						})
				);

			if (!this.plugin.settings.random.isSaturationRandom) {
				new Setting(containerEl)
					.setName("Saturation")
					.setDesc(
						"Static saturation percentage to use if not randomized"
					)
					.addText((text) =>
						text
							.setPlaceholder("0-100")
							.setValue(
								this.plugin.settings.random.saturation.toString()
							)
							.onChange(async (value) => {
								this.plugin.settings.random.saturation =
									parseInt(value);
								this.plugin.updateColor({
									h: this.plugin.settings.random.hue,
									s: this.plugin.settings.random.saturation,
									l: this.plugin.settings.random.lightness,
								});
								await this.plugin.saveSettings();
							})
					);
			}

			new Setting(containerEl)
				.setName("Randomize lightness")
				.setDesc("Randomize lightness percentage on each click")
				.addToggle((toggle) =>
					toggle
						.setValue(this.plugin.settings.random.isLightnessRandom)
						.onChange(async (value) => {
							this.plugin.settings.random.isLightnessRandom =
								value;
							await this.plugin.saveSettings();
							this.display();
						})
				);

			if (!this.plugin.settings.random.isLightnessRandom) {
				new Setting(containerEl)
					.setName("Lightness")
					.setDesc(
						"Static lightness percentage to use if not randomized"
					)
					.addText((text) =>
						text
							.setPlaceholder("0-100")
							.setValue(
								this.plugin.settings.random.lightness.toString()
							)
							.onChange(async (value) => {
								this.plugin.settings.random.lightness =
									parseInt(value);
								this.plugin.updateColor({
									h: this.plugin.settings.random.hue,
									s: this.plugin.settings.random.saturation,
									l: this.plugin.settings.random.lightness,
								});
								await this.plugin.saveSettings();
							})
					);
			}
		};

		/*
		 * Preset settings
		 */
		const showPresetSettings = () => {
			containerEl.createEl("h2", { text: "Preset" });

			this.plugin.updateColor(
				this.plugin.settings.preset.colorList[
					this.plugin.settings.preset.currentPresetIndex
				]
			);

			new Setting(containerEl)
				.setName("Add preset")
				.setDesc("Add preset colors to cycle through on each click")
				.addButton((button) =>
					button.setButtonText("Add").onClick(() => {
						this.plugin.settings.preset.colorList.push({
							h: 0,
							s: 100,
							l: 50,
						});
						this.plugin.saveSettings();
						this.display();
					})
				);

			this.plugin.settings.preset.colorList.forEach(
				(_colorPreset, index) => {
					new Setting(containerEl)
						.setName(`Preset ${index + 1}`)
						.addColorPicker((color) => {
							color.setValueHsl(
								this.plugin.settings.preset.colorList[index]
							);
							color.onChange(async () => {
								this.plugin.settings.preset.colorList[index] =
									color.getValueHsl();
								this.plugin.settings.preset.currentPresetIndex =
									index;

								this.plugin.updateColor(
									this.plugin.settings.preset.colorList[
										this.plugin.settings.preset
											.currentPresetIndex
									]
								);
								await this.plugin.saveSettings();
							});
						})
						.addExtraButton((button) =>
							button
								.setIcon("trash")
								.onClick(async () => {
									this.plugin.settings.preset.colorList = [
										...this.plugin.settings.preset.colorList.slice(
											0,
											index
										),
										...this.plugin.settings.preset.colorList.slice(
											index + 1,
											this.plugin.settings.preset
												.colorList.length
										),
									];
									this.plugin.settings.preset.currentPresetIndex = 0;
									this.plugin.updateColor(
										this.plugin.settings.preset.colorList[
											this.plugin.settings.preset
												.currentPresetIndex
										]
									);
									await this.plugin.saveSettings();
									this.display();
								})
								.setDisabled(
									this.plugin.settings.preset.colorList
										.length === 1 && index === 0
								)
						);
				}
			);
		};

		/*
		 * Behavior settings
		 */
		new Setting(containerEl)
			.setName("Behavior")
			.setDesc(
				"How the accent color is cycled when clicking the sidebar button"
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						[Behavior.INCREMENT]: "Increment",
						[Behavior.RANDOM]: "Random",
						[Behavior.PRESET]: "Preset",
					})
					.setValue(this.plugin.settings.behavior)
					.onChange(async (value) => {
						this.plugin.settings.behavior = value as Behavior;
						this.plugin.saveSettings();
						this.display();
					})
			);

		containerEl.createEl("br");

		switch (this.plugin.settings.behavior) {
			case Behavior.INCREMENT:
				showIncrementSettings();
				break;
			case Behavior.RANDOM:
				showRandomSettings();
				break;
			case Behavior.PRESET:
				showPresetSettings();
				break;
			default:
				containerEl.createEl("p", { text: "No behavior selected" });
		}
	}
}
