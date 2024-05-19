# Obsidian Color Cycler

Do you prefer the default Obsidian theme but get bored with your accent color quickly? Add some spice to your vanilla with Color cycler!
Use this plugin to dynamically change the accent color via the ribbon menu or command palette.
Cycle behavior can be configured to increment, random, or preset colors. Cycling can also happen automatically at a specified interval.

Color is defined using [HSL](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/hsl).

## Usage

- Using the command palette: `Color cycler: Cycle accent color`
- Using the ribbon menu: Click the `Palette` icon <img width="25" alt="Screenshot 2024-02-28 at 13 01 42" src="https://github.com/tjbrennan/obsidian-color-cycler/assets/2440702/2d66679a-877e-4205-a234-33acc64e1fe0">

## Configuration

### Status bar

The current HSL value of the accent color can be displayed in the status bar. This can be useful for debugging.

### Separate theme settings

Color cycler can be configured to use one set of color behaviors across dark and light themes, or the settings can be split into separate dark and light theme behaviors.

### Behavior

The plugin offers three different color cycling behaviors, each with their own advanced options:

- **Increment**: Cycle through the color wheel at a specified angle
- **Random**: Randomly select a color
- **Preset**: Cycle through a list of preset colors

### Timer

A timer can be set to automatically cycle the color at a specified interval in seconds. The timer resets when the plugin loads or the color is cycled manually.

### Cycle color on load

The color can be cycled automatically when the plugin loads. This can be useful if you close the app before the timer has a chance to cycle the color.

## Support

Thanks for using this plugin! If you encounter bugs or have a feature request, please [create an issue](https://github.com/tjbrennan/obsidian-color-cycler/issues) on GitHub.

If you enjoy using this plugin, consider supporting my work:

<a href="https://www.buymeacoffee.com/tjbrennan"><img src="https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&emoji=☕&slug=tjbrennan&button_colour=5F7FFF&font_colour=ffffff&font_family=Lato&outline_colour=000000&coffee_colour=FFDD00" /></a>
<a href='https://ko-fi.com/P5P2UVA8M' target='_blank'><img height='48' style='border:0px;height:48px;' src='https://storage.ko-fi.com/cdn/kofi3.png?v=3' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>
