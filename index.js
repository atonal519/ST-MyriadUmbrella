import { readConfig } from './src/config.js';
import { installDock } from './src/dock.js';
import { installEditor } from './src/editor.js';
import { getHost, notify } from './src/host.js';
import { registerCommands } from './src/reroll.js';
import { installSettings } from './src/settings.js';
import { applyToast } from './src/toast.js';
import { installTheme } from './src/theme.js';

let dock = null;
let editor = null;
let initialized = false;
let cleanupTheme = null;

function apply() {
    const config = readConfig();
    if (dock && !config.dock) { dock.destroy(); dock = null; }
    if (config.dock && !dock) dock = installDock();
    if (config.editor && !editor) editor = installEditor();
    if (!config.editor && editor) { editor(); editor = null; }
    applyToast(config.toast);
}

function init() {
    if (initialized) return;
    initialized = true;
    cleanupTheme = installTheme();
    installSettings({
        apply,
        manageDock: () => dock ? dock.manage() : notify('先勾选“悬浮球收纳”，再管理收纳。'),
        addDock: () => dock ? dock.pick() : notify('先勾选“悬浮球收纳”，再点选添加。'),
        revealDock: () => dock ? dock.reveal() : notify('先勾选“悬浮球收纳”，再显示收纳球。'),
    });
    registerCommands();
    apply();
}

export function disable() {
    dock?.destroy(); dock = null;
    editor?.(); editor = null;
    applyToast('off');
    cleanupTheme?.(); cleanupTheme = null;
}

// Both hosts expose APP_READY via getContext; no chat-switch hooks are needed.
getHost().eventSource.on(getHost().eventTypes.APP_READY, init);
