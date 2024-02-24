import { App, HSL, Modal, Plugin, PluginSettingTab, Setting } from "obsidian";

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
	shouldShowIcon: boolean;
	shouldShowStatusBar: boolean;
	behavior: Behavior;
	timer: {
		isTimerEnabled: boolean;
		timerSeconds: number | "";
	};
	[Behavior.INCREMENT]: IncrementBehavior;
	[Behavior.RANDOM]: RandomBehavior;
	[Behavior.PRESET]: PresetBehavior;
}

enum HueRange {
	MIN = 0,
	MAX = 360,
}

enum PercentRange {
	MIN = 0,
	MAX = 100,
}

enum TimerRange {
	MIN = 1,
	MAX = 86400,
}

const DEFAULT_SETTINGS: ColorCyclerSettings = {
	color: {
		h: 0,
		s: 100,
		l: 50,
	},
	shouldShowIcon: true,
	shouldShowStatusBar: false,
	behavior: Behavior.INCREMENT,
	timer: {
		isTimerEnabled: false,
		timerSeconds: "",
	},
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
		colorList: [
			{
				h: 0,
				s: 100,
				l: 50,
			},
		],
	},
};

function bound(value: number, min: number, max: number) {
	return !Number.isNaN(value) ? Math.min(Math.max(value, min), max) : min;
}

export default class ColorCycler extends Plugin {
	settings: ColorCyclerSettings = DEFAULT_SETTINGS;
	ribbonIconEl: HTMLElement;
	statusBarItemEl: HTMLElement;
	timerObject: NodeJS.Timer;

	async onload() {
		await this.loadSettings();
		this.updateColor(this.settings.color);

		this.ribbonIconEl = this.addRibbonIcon(
			"palette",
			"Cycle accent color",
			() => {
				this.cycleColor();
			}
		);
		this.updateRibbonIconVisibility();

		this.statusBarItemEl = this.addStatusBarItem();
		this.updateStatusBar();
		this.updateStatusBarVisibility();

		this.addCommand({
			id: "cycle-color",
			name: "Cycle accent color",
			callback: () => {
				this.cycleColor();
			},
		});

		this.updateTimer();

		this.addSettingTab(new ColorCyclerSettingTab(this.app, this));
	}

	onunload() {
		clearInterval(this.timerObject);
	}

	async loadSettings() {
		const savedData = await this.loadData();
		this.settings = {
			...DEFAULT_SETTINGS,
			...savedData,
			color: {
				...DEFAULT_SETTINGS.color,
				...savedData?.color,
			},
			timer: {
				...DEFAULT_SETTINGS.timer,
				...savedData?.timer,
			},
			increment: {
				...DEFAULT_SETTINGS.increment,
				...savedData?.increment,
			},
			random: {
				...DEFAULT_SETTINGS.random,
				...savedData?.random,
			},
			preset: {
				...DEFAULT_SETTINGS.preset,
				...savedData?.preset,
			},
		};
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	updateRibbonIconVisibility() {
		if (this.settings.shouldShowIcon) {
			this.ribbonIconEl.show();
		} else {
			this.ribbonIconEl.hide();
		}
	}

	updateStatusBarVisibility() {
		if (this.settings.shouldShowStatusBar) {
			this.statusBarItemEl.show();
		} else {
			this.statusBarItemEl.hide();
		}
	}

	updateStatusBar() {
		this.statusBarItemEl.setText(
			`HSL ${this.settings.color.h} ${this.settings.color.s} ${this.settings.color.l}`
		);
	}

	updateTimer() {
		clearInterval(this.timerObject);
		if (
			this.settings.timer.isTimerEnabled &&
			this.settings.timer.timerSeconds
		) {
			const timerSeconds = bound(
				this.settings.timer.timerSeconds,
				TimerRange.MIN,
				TimerRange.MAX
			);
			this.timerObject = setInterval(
				() => this.cycleColor(),
				timerSeconds * 1000
			);
		}
	}

	async setColor(color: HSL) {
		const hue = color.h % 360;
		const saturation = bound(color.s, PercentRange.MIN, PercentRange.MAX);
		const lightness = bound(color.l, PercentRange.MIN, PercentRange.MAX);

		this.settings.color = { h: hue, s: saturation, l: lightness };
		this.updateColor(this.settings.color);
		this.updateStatusBar();
		await this.saveSettings();
	}

	updateColor(color: HSL) {
		document.body.style.setProperty("--accent-h", `${color.h}`);
		document.body.style.setProperty("--accent-s", `${color.s}%`);
		document.body.style.setProperty("--accent-l", `${color.l}%`);
	}

	incrementColor() {
		const currentHue = this.settings.color.h;
		const degrees = this.settings.increment.degrees;
		const newHue = currentHue + degrees;

		this.setColor({
			h: newHue,
			s: this.settings.color.s,
			l: this.settings.color.l,
		});
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

		this.setColor({
			h: hue,
			s: saturation,
			l: lightness,
		});
	}

	cyclePresetColor() {
		const nextPresetIndex =
			this.settings.preset.currentPresetIndex + 1 >=
			this.settings.preset.colorList.length
				? 0
				: this.settings.preset.currentPresetIndex + 1;

		this.settings.preset.currentPresetIndex = nextPresetIndex;

		this.setColor(
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
				break;
			default:
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
			text: `Dynamically change the accent color using the ribbon menu or command palette. 
			Cycle behavior can be configured to increment, random, or preset colors.`,
		});
		containerEl.createEl("span", {
			cls: "setting-item-description",
			text: "Color is set using ",
		});
		containerEl.createEl("a", {
			cls: "setting-item-description",
			text: "HSL",
			href: "https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/hsl",
		});
		containerEl.createEl("br");
		containerEl.createEl("br");

		new Setting(containerEl)
			.setName("Behavior")
			.setDesc(
				"How the accent color is cycled when clicking the sidebar button."
			)
			.addExtraButton((button) =>
				button
					.setIcon("gear")
					.setTooltip("Advanced settings")
					.onClick(() => {
						new BehaviorModal(this.app, this.plugin).open();
					})
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
						switch (this.plugin.settings.behavior) {
							case Behavior.INCREMENT:
								this.plugin.setColor({
									h: this.plugin.settings.increment
										.startAngle,
									s: this.plugin.settings.increment
										.saturation,
									l: this.plugin.settings.increment.lightness,
								});
								break;
							case Behavior.RANDOM:
								this.plugin.randomizeColor();
								break;
							case Behavior.PRESET:
								if (
									this.plugin.settings.preset.colorList[
										this.plugin.settings.preset
											.currentPresetIndex
									]
								) {
									this.plugin.setColor(
										this.plugin.settings.preset.colorList[
											this.plugin.settings.preset
												.currentPresetIndex
										]
									);
								}
								break;
							default:
						}
						await this.plugin.saveSettings();
						this.display();
					})
			);

		new Setting(containerEl)
			.setName("Timer")
			.setDesc(
				"Automatically cycle the color after a specified time in seconds."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.timer.isTimerEnabled)
					.onChange(async (value) => {
						this.plugin.settings.timer.isTimerEnabled = value;
						this.plugin.updateTimer();
						await this.plugin.saveSettings();
						this.display();
					})
			)
			.addText((text) =>
				text
					.setPlaceholder("1-86400")
					.setDisabled(!this.plugin.settings.timer.isTimerEnabled)
					.setValue(
						this.plugin.settings.timer.timerSeconds.toString()
					)
					.onChange(async (value) => {
						const newValue =
							value !== ""
								? bound(
										parseInt(value),
										TimerRange.MIN,
										TimerRange.MAX
								  )
								: value;
						this.plugin.settings.timer.timerSeconds = newValue;
						this.plugin.updateTimer();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Show ribbon icon")
			.setDesc(
				"Show or hide the ribbon icon. The `Cycle accent color` command will still work."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.shouldShowIcon)
					.onChange(async (value) => {
						this.plugin.settings.shouldShowIcon = value;
						this.plugin.updateRibbonIconVisibility();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Show status bar")
			.setDesc("Show or hide the HSL value in the status bar.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.shouldShowStatusBar)
					.onChange(async (value) => {
						this.plugin.settings.shouldShowStatusBar = value;
						this.plugin.updateStatusBarVisibility();
						await this.plugin.saveSettings();
					})
			);
	}
}

class BehaviorModal extends Modal {
	plugin: ColorCycler;
	constructor(app: App, plugin: ColorCycler) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		switch (this.plugin.settings.behavior) {
			case Behavior.INCREMENT:
				this.showIncrementSettings(contentEl);
				break;
			case Behavior.RANDOM:
				this.showRandomSettings(contentEl);
				break;
			case Behavior.PRESET:
				this.showPresetSettings(contentEl);
				break;
			default:
				contentEl.createEl("p", { text: "No behavior selected" });
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	refresh() {
		this.onClose();
		this.onOpen();
	}

	showIncrementSettings(contentEl: HTMLElement) {
		contentEl.createEl("h2", { text: "Increment settings" });

		new Setting(contentEl)
			.setName("Starting hue angle")
			.setDesc("Hue angle on the color wheel to start incrementing from.")
			.addSlider((slider) =>
				slider
					.setLimits(HueRange.MIN, HueRange.MAX, 1)
					.setDynamicTooltip()
					.setValue(this.plugin.settings.increment.startAngle)
					.onChange(async (value) => {
						this.plugin.settings.increment.startAngle = value;
						this.plugin.setColor({
							h: this.plugin.settings.increment.startAngle,
							s: this.plugin.settings.increment.saturation,
							l: this.plugin.settings.increment.lightness,
						});
						await this.plugin.saveSettings();
					})
			);

		new Setting(contentEl)
			.setName("Hue increment degrees")
			.setDesc(
				"Hue angle degrees of the color wheel to advance on each click."
			)
			.addSlider((slider) =>
				slider
					.setLimits(HueRange.MIN + 1, HueRange.MAX, 1)
					.setDynamicTooltip()
					.setValue(this.plugin.settings.increment.degrees)
					.onChange(async (value) => {
						this.plugin.settings.increment.degrees = value;
						this.plugin.setColor({
							h: this.plugin.settings.increment.startAngle,
							s: this.plugin.settings.increment.saturation,
							l: this.plugin.settings.increment.lightness,
						});
						await this.plugin.saveSettings();
					})
			);

		new Setting(contentEl)
			.setName("Saturation")
			.setDesc("Static saturation percentage.")
			.addSlider((slider) =>
				slider
					.setLimits(PercentRange.MIN, PercentRange.MAX, 1)
					.setDynamicTooltip()
					.setValue(this.plugin.settings.increment.saturation)
					.onChange(async (value) => {
						this.plugin.settings.increment.saturation = value;
						this.plugin.setColor({
							h: this.plugin.settings.increment.startAngle,
							s: this.plugin.settings.increment.saturation,
							l: this.plugin.settings.increment.lightness,
						});
						await this.plugin.saveSettings();
					})
			);

		new Setting(contentEl)
			.setName("Lightness")
			.setDesc("Static lightness percentage.")
			.addSlider((slider) =>
				slider
					.setLimits(PercentRange.MIN, PercentRange.MAX, 1)
					.setDynamicTooltip()
					.setValue(this.plugin.settings.increment.lightness)
					.onChange(async (value) => {
						this.plugin.settings.increment.lightness = value;
						this.plugin.setColor({
							h: this.plugin.settings.increment.startAngle,
							s: this.plugin.settings.increment.saturation,
							l: this.plugin.settings.increment.lightness,
						});
						await this.plugin.saveSettings();
					})
			);
	}

	showRandomSettings(contentEl: HTMLElement) {
		contentEl.createEl("h2", { text: "Random settings" });

		new Setting(contentEl)
			.setName("Randomize hue")
			.setDesc(
				"Randomize hue angle on each click. Otherwise, use the slider to set a static hue angle."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.random.isHueRandom)
					.onChange(async (value) => {
						this.plugin.settings.random.isHueRandom = value;
						await this.plugin.saveSettings();
						this.refresh();
					})
			)
			.addSlider((slider) =>
				slider
					.setLimits(HueRange.MIN, HueRange.MAX, 1)
					.setDynamicTooltip()
					.setDisabled(this.plugin.settings.random.isHueRandom)
					.setValue(this.plugin.settings.random.hue)
					.onChange(async (value) => {
						this.plugin.settings.random.hue = value;
						this.plugin.setColor({
							h: this.plugin.settings.random.hue,
							s: this.plugin.settings.random.saturation,
							l: this.plugin.settings.random.lightness,
						});
						await this.plugin.saveSettings();
					})
			);

		new Setting(contentEl)
			.setName("Randomize saturation")
			.setDesc(
				"Randomize saturation percentage on each click. Otherwise, use the slider to set a static saturation percentage."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.random.isSaturationRandom)
					.onChange(async (value) => {
						this.plugin.settings.random.isSaturationRandom = value;
						await this.plugin.saveSettings();
						this.refresh();
					})
			)
			.addSlider((slider) =>
				slider
					.setLimits(PercentRange.MIN, PercentRange.MAX, 1)
					.setDynamicTooltip()
					.setDisabled(this.plugin.settings.random.isSaturationRandom)
					.setValue(this.plugin.settings.random.saturation)
					.onChange(async (value) => {
						this.plugin.settings.random.saturation = value;
						this.plugin.setColor({
							h: this.plugin.settings.random.hue,
							s: this.plugin.settings.random.saturation,
							l: this.plugin.settings.random.lightness,
						});
						await this.plugin.saveSettings();
					})
			);

		new Setting(contentEl)
			.setName("Randomize lightness")
			.setDesc(
				"Randomize lightness percentage on each click. Otherwise, use the slider to set a static lightness percentage."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.random.isLightnessRandom)
					.onChange(async (value) => {
						this.plugin.settings.random.isLightnessRandom = value;
						await this.plugin.saveSettings();
						this.refresh();
					})
			)
			.addSlider((slider) =>
				slider
					.setLimits(PercentRange.MIN, PercentRange.MAX, 1)
					.setDynamicTooltip()
					.setDisabled(this.plugin.settings.random.isLightnessRandom)
					.setValue(this.plugin.settings.random.lightness)
					.onChange(async (value) => {
						this.plugin.settings.random.lightness = value;
						this.plugin.setColor({
							h: this.plugin.settings.random.hue,
							s: this.plugin.settings.random.saturation,
							l: this.plugin.settings.random.lightness,
						});
						await this.plugin.saveSettings();
					})
			);
	}

	showPresetSettings(contentEl: HTMLElement) {
		contentEl.createEl("h2", { text: "Preset settings" });

		new Setting(contentEl)
			.setHeading()
			.setName("Presets")
			.addExtraButton((button) =>
				button
					.setIcon("plus-circle")
					.setTooltip("Add preset color")
					.onClick(() => {
						this.plugin.settings.preset.colorList.push({
							h: 0,
							s: 100,
							l: 50,
						});
						this.plugin.saveSettings();
						this.refresh();
					})
			);

		this.plugin.settings.preset.colorList.forEach((_colorPreset, index) => {
			new Setting(contentEl)
				.setName(`Preset ${index + 1}`)
				.addExtraButton((button) =>
					button
						.setIcon("palette")
						.setTooltip("Set as current color")
						.onClick(async () => {
							this.plugin.settings.preset.currentPresetIndex =
								index;
							this.plugin.setColor(
								this.plugin.settings.preset.colorList[
									this.plugin.settings.preset
										.currentPresetIndex
								]
							);
							await this.plugin.saveSettings();
						})
				)
				.addExtraButton((button) =>
					button
						.setIcon("trash")
						.setTooltip("Remove preset")
						.setDisabled(
							this.plugin.settings.preset.colorList.length ===
								1 && index === 0
						)
						.onClick(async () => {
							this.plugin.settings.preset.colorList = [
								...this.plugin.settings.preset.colorList.slice(
									0,
									index
								),
								...this.plugin.settings.preset.colorList.slice(
									index + 1,
									this.plugin.settings.preset.colorList.length
								),
							];
							this.plugin.settings.preset.currentPresetIndex = 0;
							this.plugin.setColor(
								this.plugin.settings.preset.colorList[
									this.plugin.settings.preset
										.currentPresetIndex
								]
							);
							await this.plugin.saveSettings();
							this.refresh();
						})
				)
				.addColorPicker((color) => {
					color.setValueHsl(
						this.plugin.settings.preset.colorList[index]
					);
					color.onChange(async () => {
						this.plugin.settings.preset.colorList[index] =
							color.getValueHsl();
						this.plugin.settings.preset.currentPresetIndex = index;

						this.plugin.setColor(
							this.plugin.settings.preset.colorList[
								this.plugin.settings.preset.currentPresetIndex
							]
						);
						await this.plugin.saveSettings();
					});
				});
		});
	}
}
