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

interface TimerSettings {
  isTimerEnabled: boolean;
  timerSeconds: number | "";
}

enum ThemeMode {
  BASE = "base",
  DARK = "dark",
  LIGHT = "light",
}

interface ThemeSettings {
  color: HSL;
  behavior: Behavior;
  timer: TimerSettings;
  [Behavior.INCREMENT]: IncrementBehavior;
  [Behavior.RANDOM]: RandomBehavior;
  [Behavior.PRESET]: PresetBehavior;
}

interface ColorCyclerSettings {
  shouldShowStatusBar: boolean;
  shouldShowSeparateThemeSettings: boolean;
  themes: {
    [ThemeMode.BASE]: ThemeSettings;
    [ThemeMode.DARK]: ThemeSettings;
    [ThemeMode.LIGHT]: ThemeSettings;
  };
  color?: never; //deprecated;
  behavior?: never; // deprecated
  timer?: never; // deprecated
  [Behavior.INCREMENT]?: never; // deprecated
  [Behavior.RANDOM]?: never; // deprecated
  [Behavior.PRESET]?: never; // deprecated
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

const DEFAULT_COLOR: HSL = {
  h: 0,
  s: 100,
  l: 50,
};

const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  color: DEFAULT_COLOR,
  behavior: Behavior.INCREMENT,
  timer: {
    isTimerEnabled: false,
    timerSeconds: "",
  },
  increment: {
    startAngle: 0,
    degrees: 30,
    saturation: DEFAULT_COLOR["s"],
    lightness: DEFAULT_COLOR["l"],
  },
  random: {
    isHueRandom: true,
    isSaturationRandom: false,
    isLightnessRandom: false,
    hue: DEFAULT_COLOR["h"],
    saturation: DEFAULT_COLOR["s"],
    lightness: DEFAULT_COLOR["l"],
  },
  preset: {
    currentPresetIndex: 0,
    colorList: [DEFAULT_COLOR],
  },
};

const DEFAULT_SETTINGS: ColorCyclerSettings = {
  shouldShowStatusBar: false,
  shouldShowSeparateThemeSettings: false,
  themes: {
    base: DEFAULT_THEME_SETTINGS,
    dark: DEFAULT_THEME_SETTINGS,
    light: DEFAULT_THEME_SETTINGS,
  },
};

function bound(value: number, min: number, max: number) {
  return !Number.isNaN(value) ? Math.min(Math.max(value, min), max) : min;
}

export default class ColorCycler extends Plugin {
  settings: ColorCyclerSettings = DEFAULT_SETTINGS;
  ribbonIconEl: HTMLElement;
  statusBarItemEl: HTMLElement;
  timerId: number;
  lastSave: number | undefined = undefined;
  themeMode: ThemeMode = ThemeMode.BASE;

  async onload() {
    await this.loadSettings();

    this.addCommand({
      id: "cycle-color",
      name: "Cycle accent color",
      callback: () => {
        this.cycleColor();
      },
    });
    this.ribbonIconEl = this.addRibbonIcon("palette", "Cycle accent color", () => {
      this.cycleColor();
    });
    this.statusBarItemEl = this.addStatusBarItem();
    this.addSettingTab(new ColorCyclerSettingTab(this.app, this));

    this.update();

    this.registerEvent(this.app.workspace.on("css-change", this.detectTheme.bind(this)));
    this.detectTheme();
  }

  update() {
    this.updateColor(this.settings.themes[this.themeMode].color);
    this.updateTimer();
    this.updateStatusBar();
    this.updateStatusBarVisibility();
  }

  detectTheme() {
    if (!this.settings.shouldShowSeparateThemeSettings) {
      this.themeMode = ThemeMode.BASE;
    } else {
      // @ts-ignore: getTheme() is not officially supported
      const theme = this.app.getTheme();
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      let newThemeMode: ThemeMode = ThemeMode.BASE;

      if (theme === "obsidian") {
        newThemeMode = ThemeMode.DARK;
      } else if (theme === "moonstone") {
        newThemeMode = ThemeMode.LIGHT;
      } else if (theme === "system" && media.matches) {
        newThemeMode = ThemeMode.DARK;
      } else if (theme === "system" && !media.matches) {
        newThemeMode = ThemeMode.LIGHT;
      }

      if (newThemeMode !== this.themeMode) {
        this.themeMode = newThemeMode;
      }
    }

    this.update();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getThemeSettings(savedData: any, mode: ThemeMode) {
    return {
      color: savedData?.themes[mode]?.color ?? DEFAULT_SETTINGS.themes[mode].color,
      behavior: savedData?.themes[mode]?.behavior ?? DEFAULT_SETTINGS.themes[mode].behavior,
      timer: {
        ...DEFAULT_SETTINGS.themes[mode].timer,
        ...savedData?.themes[mode]?.timer,
      },
      increment: {
        ...DEFAULT_SETTINGS.themes[mode].increment,
        ...savedData?.themes[mode]?.increment,
      },
      random: {
        ...DEFAULT_SETTINGS.themes[mode].random,
        ...savedData?.themes[mode]?.random,
      },
      preset: {
        ...DEFAULT_SETTINGS.themes[mode].preset,
        ...savedData?.themes[mode]?.preset,
      },
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async migrateBaseThemeSettings(savedData: any) {
    // already migrated?
    if (savedData.themes) return savedData;

    if (savedData.behavior || savedData.timer || savedData.increment || savedData.random || savedData.preset) {
      this.settings.themes.base = {
        color: savedData?.color ?? DEFAULT_SETTINGS.themes.base.color,
        behavior: savedData?.behavior ?? DEFAULT_SETTINGS.themes.base.behavior,
        timer: {
          ...DEFAULT_SETTINGS.themes.base.timer,
          ...savedData?.timer,
        },
        increment: {
          ...DEFAULT_SETTINGS.themes.base.increment,
          ...savedData?.increment,
        },
        random: {
          ...DEFAULT_SETTINGS.themes.base.random,
          ...savedData?.random,
        },
        preset: {
          ...DEFAULT_SETTINGS.themes.base.preset,
          ...savedData?.preset,
        },
      };

      delete this.settings.color;
      delete this.settings.behavior;
      delete this.settings.timer;
      delete this.settings.increment;
      delete this.settings.random;
      delete this.settings.preset;

      await this.saveSettings();
      return await this.loadData();
    }
  }

  async loadSettings() {
    const savedData = await this.loadData();
    const migratedSavedData = await this.migrateBaseThemeSettings(savedData);

    this.settings = {
      ...DEFAULT_SETTINGS,
      ...migratedSavedData,
      themes: {
        [ThemeMode.BASE]: this.getThemeSettings(migratedSavedData, ThemeMode.BASE),
        [ThemeMode.DARK]: this.getThemeSettings(migratedSavedData, ThemeMode.DARK),
        [ThemeMode.LIGHT]: this.getThemeSettings(migratedSavedData, ThemeMode.LIGHT),
      },
    };
  }

  async saveSettings() {
    await this.saveData(this.settings);
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
      `HSL ${this.settings.themes[this.themeMode].color.h} ${this.settings.themes[this.themeMode].color.s} ${
        this.settings.themes[this.themeMode].color.l
      }`
    );
  }

  updateTimer() {
    clearInterval(this.timerId);
    if (
      this.settings.themes[this.themeMode].timer.isTimerEnabled &&
      this.settings.themes[this.themeMode].timer.timerSeconds
    ) {
      const timerSeconds = bound(
        this.settings.themes[this.themeMode].timer.timerSeconds || NaN,
        TimerRange.MIN,
        TimerRange.MAX
      );
      this.timerId = this.registerInterval(window.setInterval(() => this.cycleColor(true), timerSeconds * 1000));
    }
  }

  async setColor(color: HSL, isTimer = false) {
    const hue = color.h % 360;
    const saturation = bound(color.s, PercentRange.MIN, PercentRange.MAX);
    const lightness = bound(color.l, PercentRange.MIN, PercentRange.MAX);

    this.settings.themes[this.themeMode].color = { h: hue, s: saturation, l: lightness };
    this.updateColor(this.settings.themes[this.themeMode].color);
    this.updateStatusBar();

    if (isTimer) {
      if (this.lastSave) {
        const now = Date.now();
        if (now - this.lastSave > 60 * 1000) {
          await this.saveSettings();
          this.lastSave = now;
        }
      } else {
        await this.saveSettings();
        this.lastSave = Date.now();
      }
    } else {
      this.updateTimer();
      await this.saveSettings();
    }
  }

  updateColor(color: HSL) {
    document.body.style.setProperty("--accent-h", `${color.h}`);
    document.body.style.setProperty("--accent-s", `${color.s}%`);
    document.body.style.setProperty("--accent-l", `${color.l}%`);
  }

  incrementColor(isTimer = false) {
    const currentHue = this.settings.themes[this.themeMode].color.h;
    const degrees = this.settings.themes[this.themeMode].increment.degrees;
    const newHue = currentHue + degrees;

    this.setColor(
      {
        h: newHue,
        s: this.settings.themes[this.themeMode].increment.saturation,
        l: this.settings.themes[this.themeMode].increment.lightness,
      },
      isTimer
    );
  }

  randomizeColor(isTimer = false) {
    const hue = this.settings.themes[this.themeMode].random.isHueRandom
      ? Math.floor(Math.random() * HueRange.MAX)
      : this.settings.themes[this.themeMode].random.hue;
    const saturation = this.settings.themes[this.themeMode].random.isSaturationRandom
      ? Math.floor(Math.random() * PercentRange.MAX)
      : this.settings.themes[this.themeMode].random.saturation;
    const lightness = this.settings.themes[this.themeMode].random.isLightnessRandom
      ? Math.floor(Math.random() * PercentRange.MAX)
      : this.settings.themes[this.themeMode].random.lightness;

    this.setColor(
      {
        h: hue,
        s: saturation,
        l: lightness,
      },
      isTimer
    );
  }

  cyclePresetColor(isTimer = false) {
    const nextPresetIndex =
      this.settings.themes[this.themeMode].preset.currentPresetIndex + 1 >=
      this.settings.themes[this.themeMode].preset.colorList.length
        ? 0
        : this.settings.themes[this.themeMode].preset.currentPresetIndex + 1;

    this.settings.themes[this.themeMode].preset.currentPresetIndex = nextPresetIndex;

    this.setColor(
      this.settings.themes[this.themeMode].preset.colorList[nextPresetIndex] ??
        this.settings.themes[this.themeMode].color,
      isTimer
    );
  }

  cycleColor(isTimer = false) {
    switch (this.settings.themes[this.themeMode].behavior) {
      case Behavior.INCREMENT:
        this.incrementColor(isTimer);
        break;
      case Behavior.RANDOM:
        this.randomizeColor(isTimer);
        break;
      case Behavior.PRESET:
        this.cyclePresetColor(isTimer);
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

  showColorSettings(containerEl: HTMLElement, themeMode: ThemeMode) {
    new Setting(containerEl)
      .setName("Behavior")
      .setDesc("How the accent color is cycled when clicking the sidebar button.")
      .addExtraButton((button) =>
        button
          .setIcon("gear")
          .setTooltip("Advanced settings")
          .onClick(() => {
            new BehaviorModal(this.app, this.plugin, themeMode).open();
          })
      )
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({
            [Behavior.INCREMENT]: "Increment",
            [Behavior.RANDOM]: "Random",
            [Behavior.PRESET]: "Preset",
          })
          .setValue(this.plugin.settings.themes[themeMode].behavior)
          .onChange(async (value) => {
            this.plugin.settings.themes[themeMode].behavior = value as Behavior;
            switch (this.plugin.settings.themes[themeMode].behavior) {
              case Behavior.INCREMENT:
                this.plugin.setColor({
                  h: this.plugin.settings.themes[themeMode].increment.startAngle,
                  s: this.plugin.settings.themes[themeMode].increment.saturation,
                  l: this.plugin.settings.themes[themeMode].increment.lightness,
                });
                break;
              case Behavior.RANDOM:
                this.plugin.randomizeColor();
                break;
              case Behavior.PRESET:
                if (
                  this.plugin.settings.themes[themeMode].preset.colorList[
                    this.plugin.settings.themes[themeMode].preset.currentPresetIndex
                  ]
                ) {
                  this.plugin.setColor(
                    this.plugin.settings.themes[themeMode].preset.colorList[
                      this.plugin.settings.themes[themeMode].preset.currentPresetIndex
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
        "Automatically cycle the color after a specified time in seconds. Manually cycling the color will reset the timer."
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.themes[themeMode].timer.isTimerEnabled).onChange(async (value) => {
          this.plugin.settings.themes[themeMode].timer.isTimerEnabled = value;
          this.plugin.updateTimer();
          await this.plugin.saveSettings();
          this.display();
        })
      )
      .addText((text) =>
        text
          .setPlaceholder("1-86400")
          .setDisabled(!this.plugin.settings.themes[themeMode].timer.isTimerEnabled)
          .setValue(this.plugin.settings.themes[themeMode].timer.timerSeconds.toString())
          .onChange(async (value) => {
            const newValue = value !== "" ? bound(parseInt(value), TimerRange.MIN, TimerRange.MAX) : value;
            this.plugin.settings.themes[themeMode].timer.timerSeconds = newValue;
            this.plugin.updateTimer();
            await this.plugin.saveSettings();
          })
      );
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Show in status bar")
      .setDesc("Show or hide the HSL value in the status bar.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.shouldShowStatusBar).onChange(async (value) => {
          this.plugin.settings.shouldShowStatusBar = value;
          this.plugin.updateStatusBarVisibility();
          await this.plugin.saveSettings();
        })
      );
    new Setting(containerEl)
      .setName("Separate settings for dark and light themes")
      .setDesc("Behavior and timer can be set individually for the dark theme and light theme.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.shouldShowSeparateThemeSettings).onChange(async (value) => {
          this.plugin.settings.shouldShowSeparateThemeSettings = value;
          await this.plugin.saveSettings();
          this.display();
          this.plugin.detectTheme();
        })
      );

    if (this.plugin.settings.shouldShowSeparateThemeSettings) {
      new Setting(containerEl).setName("Dark theme colors").setHeading();
      this.showColorSettings(containerEl, ThemeMode.DARK);

      new Setting(containerEl).setName("Light theme colors").setHeading();
      this.showColorSettings(containerEl, ThemeMode.LIGHT);
    } else {
      new Setting(containerEl).setName("Colors").setHeading();
      this.showColorSettings(containerEl, ThemeMode.BASE);
    }
  }
}

class BehaviorModal extends Modal {
  plugin: ColorCycler;
  themeMode: ThemeMode;
  constructor(app: App, plugin: ColorCycler, themeMode: ThemeMode) {
    super(app);
    this.plugin = plugin;
    this.themeMode = themeMode;
  }

  onOpen() {
    const { contentEl } = this;

    switch (this.plugin.settings.themes[this.themeMode].behavior) {
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
    new Setting(contentEl).setName("Increment").setHeading();

    new Setting(contentEl)
      .setName("Starting hue angle")
      .setDesc("Hue angle on the color wheel to start incrementing from.")
      .addSlider((slider) =>
        slider
          .setLimits(HueRange.MIN, HueRange.MAX, 1)
          .setDynamicTooltip()
          .setValue(this.plugin.settings.themes[this.themeMode].increment.startAngle)
          .onChange(async (value) => {
            this.plugin.settings.themes[this.themeMode].increment.startAngle = value;
            this.plugin.setColor({
              h: this.plugin.settings.themes[this.themeMode].increment.startAngle,
              s: this.plugin.settings.themes[this.themeMode].increment.saturation,
              l: this.plugin.settings.themes[this.themeMode].increment.lightness,
            });
            await this.plugin.saveSettings();
          })
      );

    new Setting(contentEl)
      .setName("Hue increment degrees")
      .setDesc("Hue angle degrees of the color wheel to advance on each click.")
      .addSlider((slider) =>
        slider
          .setLimits(HueRange.MIN + 1, HueRange.MAX, 1)
          .setDynamicTooltip()
          .setValue(this.plugin.settings.themes[this.themeMode].increment.degrees)
          .onChange(async (value) => {
            this.plugin.settings.themes[this.themeMode].increment.degrees = value;
            this.plugin.setColor({
              h: this.plugin.settings.themes[this.themeMode].increment.startAngle,
              s: this.plugin.settings.themes[this.themeMode].increment.saturation,
              l: this.plugin.settings.themes[this.themeMode].increment.lightness,
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
          .setValue(this.plugin.settings.themes[this.themeMode].increment.saturation)
          .onChange(async (value) => {
            this.plugin.settings.themes[this.themeMode].increment.saturation = value;
            this.plugin.setColor({
              h: this.plugin.settings.themes[this.themeMode].increment.startAngle,
              s: this.plugin.settings.themes[this.themeMode].increment.saturation,
              l: this.plugin.settings.themes[this.themeMode].increment.lightness,
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
          .setValue(this.plugin.settings.themes[this.themeMode].increment.lightness)
          .onChange(async (value) => {
            this.plugin.settings.themes[this.themeMode].increment.lightness = value;
            this.plugin.setColor({
              h: this.plugin.settings.themes[this.themeMode].increment.startAngle,
              s: this.plugin.settings.themes[this.themeMode].increment.saturation,
              l: this.plugin.settings.themes[this.themeMode].increment.lightness,
            });
            await this.plugin.saveSettings();
          })
      );
  }

  showRandomSettings(contentEl: HTMLElement) {
    new Setting(contentEl).setName("Random").setHeading();

    new Setting(contentEl)
      .setName("Randomize hue")
      .setDesc("Randomize hue angle on each click. Otherwise, use the slider to set a static hue angle.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.themes[this.themeMode].random.isHueRandom).onChange(async (value) => {
          this.plugin.settings.themes[this.themeMode].random.isHueRandom = value;
          await this.plugin.saveSettings();
          this.refresh();
        })
      )
      .addSlider((slider) =>
        slider
          .setLimits(HueRange.MIN, HueRange.MAX, 1)
          .setDynamicTooltip()
          .setDisabled(this.plugin.settings.themes[this.themeMode].random.isHueRandom)
          .setValue(this.plugin.settings.themes[this.themeMode].random.hue)
          .onChange(async (value) => {
            this.plugin.settings.themes[this.themeMode].random.hue = value;
            this.plugin.setColor({
              h: this.plugin.settings.themes[this.themeMode].random.hue,
              s: this.plugin.settings.themes[this.themeMode].random.saturation,
              l: this.plugin.settings.themes[this.themeMode].random.lightness,
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
          .setValue(this.plugin.settings.themes[this.themeMode].random.isSaturationRandom)
          .onChange(async (value) => {
            this.plugin.settings.themes[this.themeMode].random.isSaturationRandom = value;
            await this.plugin.saveSettings();
            this.refresh();
          })
      )
      .addSlider((slider) =>
        slider
          .setLimits(PercentRange.MIN, PercentRange.MAX, 1)
          .setDynamicTooltip()
          .setDisabled(this.plugin.settings.themes[this.themeMode].random.isSaturationRandom)
          .setValue(this.plugin.settings.themes[this.themeMode].random.saturation)
          .onChange(async (value) => {
            this.plugin.settings.themes[this.themeMode].random.saturation = value;
            this.plugin.setColor({
              h: this.plugin.settings.themes[this.themeMode].random.hue,
              s: this.plugin.settings.themes[this.themeMode].random.saturation,
              l: this.plugin.settings.themes[this.themeMode].random.lightness,
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
          .setValue(this.plugin.settings.themes[this.themeMode].random.isLightnessRandom)
          .onChange(async (value) => {
            this.plugin.settings.themes[this.themeMode].random.isLightnessRandom = value;
            await this.plugin.saveSettings();
            this.refresh();
          })
      )
      .addSlider((slider) =>
        slider
          .setLimits(PercentRange.MIN, PercentRange.MAX, 1)
          .setDynamicTooltip()
          .setDisabled(this.plugin.settings.themes[this.themeMode].random.isLightnessRandom)
          .setValue(this.plugin.settings.themes[this.themeMode].random.lightness)
          .onChange(async (value) => {
            this.plugin.settings.themes[this.themeMode].random.lightness = value;
            this.plugin.setColor({
              h: this.plugin.settings.themes[this.themeMode].random.hue,
              s: this.plugin.settings.themes[this.themeMode].random.saturation,
              l: this.plugin.settings.themes[this.themeMode].random.lightness,
            });
            await this.plugin.saveSettings();
          })
      );
  }

  showPresetSettings(contentEl: HTMLElement) {
    new Setting(contentEl).setName("Preset").setHeading();

    new Setting(contentEl)
      .setHeading()
      .setName("Colors")
      .addExtraButton((button) =>
        button
          .setIcon("plus-circle")
          .setTooltip("Add color")
          .onClick(() => {
            this.plugin.settings.themes[this.themeMode].preset.colorList.push({
              h: 0,
              s: 100,
              l: 50,
            });
            this.plugin.saveSettings();
            this.refresh();
          })
      );

    this.plugin.settings.themes[this.themeMode].preset.colorList.forEach((_colorPreset, index) => {
      new Setting(contentEl)
        .setName(`Color ${index + 1}`)
        .addExtraButton((button) =>
          button
            .setIcon("palette")
            .setTooltip("Set as current color")
            .onClick(async () => {
              this.plugin.settings.themes[this.themeMode].preset.currentPresetIndex = index;
              this.plugin.setColor(
                this.plugin.settings.themes[this.themeMode].preset.colorList[
                  this.plugin.settings.themes[this.themeMode].preset.currentPresetIndex
                ]
              );
              await this.plugin.saveSettings();
            })
        )
        .addExtraButton((button) =>
          button
            .setIcon("trash")
            .setTooltip("Remove color")
            .setDisabled(this.plugin.settings.themes[this.themeMode].preset.colorList.length === 1 && index === 0)
            .onClick(async () => {
              this.plugin.settings.themes[this.themeMode].preset.colorList = [
                ...this.plugin.settings.themes[this.themeMode].preset.colorList.slice(0, index),
                ...this.plugin.settings.themes[this.themeMode].preset.colorList.slice(
                  index + 1,
                  this.plugin.settings.themes[this.themeMode].preset.colorList.length
                ),
              ];
              this.plugin.settings.themes[this.themeMode].preset.currentPresetIndex = 0;
              this.plugin.setColor(
                this.plugin.settings.themes[this.themeMode].preset.colorList[
                  this.plugin.settings.themes[this.themeMode].preset.currentPresetIndex
                ]
              );
              await this.plugin.saveSettings();
              this.refresh();
            })
        )
        .addColorPicker((color) => {
          color.setValueHsl(this.plugin.settings.themes[this.themeMode].preset.colorList[index]);
          color.onChange(async () => {
            this.plugin.settings.themes[this.themeMode].preset.colorList[index] = color.getValueHsl();
            this.plugin.settings.themes[this.themeMode].preset.currentPresetIndex = index;

            this.plugin.setColor(
              this.plugin.settings.themes[this.themeMode].preset.colorList[
                this.plugin.settings.themes[this.themeMode].preset.currentPresetIndex
              ]
            );
            await this.plugin.saveSettings();
          });
        });
    });
  }
}
