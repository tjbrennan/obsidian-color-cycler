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
  timerId: number;
  lastSave: number | undefined = undefined;
  theme: "dark" | "light" = "dark";

  async onload() {
    await this.loadSettings();

    this.updateColor(this.settings.color);
    this.updateTimer();

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
    this.updateStatusBar();
    this.updateStatusBarVisibility();

    this.addSettingTab(new ColorCyclerSettingTab(this.app, this));

    const detectTheme = () => {
      //@ts-ignore
      const theme = this.app.getTheme();
      const media = window.matchMedia("(prefers-color-scheme: dark)");

      if (theme === "obsidian") {
        this.theme = "dark";
      } else if (theme === "moonstone") {
        this.theme = "light";
      } else if (theme === "system" && media.matches) {
        this.theme = "dark";
      } else if (theme === "system" && !media.matches) {
        this.theme = "light";
      }
      // FIXME
      console.log(this.theme);
    };
    this.registerEvent(this.app.workspace.on("css-change", detectTheme));
    detectTheme();
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

  updateStatusBarVisibility() {
    if (this.settings.shouldShowStatusBar) {
      this.statusBarItemEl.show();
    } else {
      this.statusBarItemEl.hide();
    }
  }

  updateStatusBar() {
    this.statusBarItemEl.setText(`HSL ${this.settings.color.h} ${this.settings.color.s} ${this.settings.color.l}`);
  }

  updateTimer() {
    clearInterval(this.timerId);
    if (this.settings.timer.isTimerEnabled && this.settings.timer.timerSeconds) {
      const timerSeconds = bound(this.settings.timer.timerSeconds, TimerRange.MIN, TimerRange.MAX);
      this.timerId = this.registerInterval(window.setInterval(() => this.cycleColor(true), timerSeconds * 1000));
    }
  }

  async setColor(color: HSL, isTimer = false) {
    const hue = color.h % 360;
    const saturation = bound(color.s, PercentRange.MIN, PercentRange.MAX);
    const lightness = bound(color.l, PercentRange.MIN, PercentRange.MAX);

    this.settings.color = { h: hue, s: saturation, l: lightness };
    this.updateColor(this.settings.color);
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
    const currentHue = this.settings.color.h;
    const degrees = this.settings.increment.degrees;
    const newHue = currentHue + degrees;

    this.setColor(
      {
        h: newHue,
        s: this.settings.color.s,
        l: this.settings.color.l,
      },
      isTimer
    );
  }

  randomizeColor(isTimer = false) {
    const hue = this.settings.random.isHueRandom ? Math.floor(Math.random() * HueRange.MAX) : this.settings.random.hue;
    const saturation = this.settings.random.isSaturationRandom
      ? Math.floor(Math.random() * PercentRange.MAX)
      : this.settings.random.saturation;
    const lightness = this.settings.random.isLightnessRandom
      ? Math.floor(Math.random() * PercentRange.MAX)
      : this.settings.random.lightness;

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
      this.settings.preset.currentPresetIndex + 1 >= this.settings.preset.colorList.length
        ? 0
        : this.settings.preset.currentPresetIndex + 1;

    this.settings.preset.currentPresetIndex = nextPresetIndex;

    this.setColor(this.settings.preset.colorList[nextPresetIndex] ?? this.settings.color, isTimer);
  }

  cycleColor(isTimer = false) {
    switch (this.settings.behavior) {
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

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Behavior")
      .setDesc("How the accent color is cycled when clicking the sidebar button.")
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
                  h: this.plugin.settings.increment.startAngle,
                  s: this.plugin.settings.increment.saturation,
                  l: this.plugin.settings.increment.lightness,
                });
                break;
              case Behavior.RANDOM:
                this.plugin.randomizeColor();
                break;
              case Behavior.PRESET:
                if (this.plugin.settings.preset.colorList[this.plugin.settings.preset.currentPresetIndex]) {
                  this.plugin.setColor(
                    this.plugin.settings.preset.colorList[this.plugin.settings.preset.currentPresetIndex]
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
        toggle.setValue(this.plugin.settings.timer.isTimerEnabled).onChange(async (value) => {
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
          .setValue(this.plugin.settings.timer.timerSeconds.toString())
          .onChange(async (value) => {
            const newValue = value !== "" ? bound(parseInt(value), TimerRange.MIN, TimerRange.MAX) : value;
            this.plugin.settings.timer.timerSeconds = newValue;
            this.plugin.updateTimer();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Show status bar")
      .setDesc("Show or hide the HSL value in the status bar.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.shouldShowStatusBar).onChange(async (value) => {
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
    new Setting(contentEl).setName("Increment").setHeading();

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
      .setDesc("Hue angle degrees of the color wheel to advance on each click.")
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
    new Setting(contentEl).setName("Random").setHeading();

    new Setting(contentEl)
      .setName("Randomize hue")
      .setDesc("Randomize hue angle on each click. Otherwise, use the slider to set a static hue angle.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.random.isHueRandom).onChange(async (value) => {
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
        toggle.setValue(this.plugin.settings.random.isSaturationRandom).onChange(async (value) => {
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
        toggle.setValue(this.plugin.settings.random.isLightnessRandom).onChange(async (value) => {
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
    new Setting(contentEl).setName("Preset").setHeading();

    new Setting(contentEl)
      .setHeading()
      .setName("Colors")
      .addExtraButton((button) =>
        button
          .setIcon("plus-circle")
          .setTooltip("Add color")
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
        .setName(`Color ${index + 1}`)
        .addExtraButton((button) =>
          button
            .setIcon("palette")
            .setTooltip("Set as current color")
            .onClick(async () => {
              this.plugin.settings.preset.currentPresetIndex = index;
              this.plugin.setColor(
                this.plugin.settings.preset.colorList[this.plugin.settings.preset.currentPresetIndex]
              );
              await this.plugin.saveSettings();
            })
        )
        .addExtraButton((button) =>
          button
            .setIcon("trash")
            .setTooltip("Remove color")
            .setDisabled(this.plugin.settings.preset.colorList.length === 1 && index === 0)
            .onClick(async () => {
              this.plugin.settings.preset.colorList = [
                ...this.plugin.settings.preset.colorList.slice(0, index),
                ...this.plugin.settings.preset.colorList.slice(index + 1, this.plugin.settings.preset.colorList.length),
              ];
              this.plugin.settings.preset.currentPresetIndex = 0;
              this.plugin.setColor(
                this.plugin.settings.preset.colorList[this.plugin.settings.preset.currentPresetIndex]
              );
              await this.plugin.saveSettings();
              this.refresh();
            })
        )
        .addColorPicker((color) => {
          color.setValueHsl(this.plugin.settings.preset.colorList[index]);
          color.onChange(async () => {
            this.plugin.settings.preset.colorList[index] = color.getValueHsl();
            this.plugin.settings.preset.currentPresetIndex = index;

            this.plugin.setColor(this.plugin.settings.preset.colorList[this.plugin.settings.preset.currentPresetIndex]);
            await this.plugin.saveSettings();
          });
        });
    });
  }
}
