const hex = rgb => '#' + rgb.map(value => Math.round(value).toString(16).padStart(2, '0')).join('');

export function resolveThemePalette(background, foreground) {
    if (background[3] < 1) {
        const lightText = foreground[0] * 0.2126 + foreground[1] * 0.7152 + foreground[2] * 0.0722 >= 128;
        return lightText ? { surface: '#000000', ink: '#ffffff' } : { surface: '#ffffff', ink: '#000000' };
    }
    const ink = foreground.slice(0, 3).map((value, index) => value * foreground[3] + background[index] * (1 - foreground[3]));
    return { surface: hex(background.slice(0, 3)), ink: hex(ink) };
}

export function resolveHomePalette(background, foreground) {
    const lightText = foreground[0] * 0.2126 + foreground[1] * 0.7152 + foreground[2] * 0.0722 >= 128;
    const base = lightText ? [39, 40, 41] : [250, 249, 246];
    const surface = background.slice(0, 3).map((value, i) => value * background[3] + base[i] * (1 - background[3]));
    const ink = foreground.slice(0, 3).map((value, i) => value * foreground[3] + surface[i] * (1 - foreground[3]));
    return { surface: hex(surface), ink: hex(ink) };
}

export function installTheme(onChange) {
    const style = document.createElement('style');
    style.id = 'st-tools-theme';
    const sample = document.createElement('span');
    sample.hidden = true;
    sample.style.cssText = 'color:var(--SmartThemeBodyColor,#eeeeee);background-color:var(--SmartThemeBlurTintColor,#171717)';
    document.head.append(style);
    document.body.append(sample);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const readColor = color => {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        const [r, g, b, alpha] = context.getImageData(0, 0, 1, 1).data;
        return [r, g, b, alpha / 255];
    };
    function update() {
        const colors = getComputedStyle(sample);
        const background = readColor(colors.backgroundColor);
        const foreground = readColor(colors.color);
        const palette = resolveThemePalette(background, foreground);
        const home = resolveHomePalette(background, foreground);
        // Theme controls change root/body styles. Own variables live in this
        // stylesheet so updating them does not retrigger the attribute observer.
        style.textContent = `:root{--st-tools-surface:${palette.surface};--st-tools-ink:${palette.ink};--st-home-surface:${home.surface};--st-home-ink:${home.ink}}`;
        onChange?.();
    }
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] });
    observer.observe(document.body, { attributes: true, attributeFilter: ['style', 'class'] });
    update();
    return () => { observer.disconnect(); style.remove(); sample.remove(); };
}
