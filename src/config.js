import { getHost } from './host.js';

// Retain the existing key so renaming the extension keeps users' settings.
export const KEY = 'st_tavern_tools';
const defaults = { dock: false, editor: false, toast: 'off', dockItems: [], presetToggles: false, foldersEnabled: false, charLayout: 'grid' };

export function readConfig() {
    const config = { ...defaults, ...getHost().extensionSettings[KEY] };
    config.toast = config.toast === 'off' ? 'off' : 'bar';
    config.charLayout = ['grid', 'stack', 'columns'].includes(config.charLayout) ? config.charLayout : 'grid';
    delete config.charImage;
    return config;
}

export function writeConfig(patch) {
    const ctx = getHost();
    const next = { ...readConfig(), ...patch };
    ctx.extensionSettings[KEY] = next;
    ctx.saveSettingsDebounced();
    return next;
}
