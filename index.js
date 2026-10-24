import { readConfig } from './src/config.js';
import { installDock } from './src/dock.js';
import { installEditor } from './src/editor.js';
import { getHost, notify } from './src/host.js';
import { migrateQuickReplies, registerCommands } from './src/reroll.js';
import { installHome } from './src/home.js';
import { applyToast } from './src/toast.js';
import { installTheme } from './src/theme.js';
import { installPresetToggles } from './src/preset-toggles.js';
import { installCharacterFolders } from './src/character-folders.js';

let dock = null;
let editor = null;
let initialized = false;
let cleanupTheme = null;
let home = null;
let cleanupPresetToggles = null;
let cleanupCharacterFolders = null;

function apply() {
    const config = readConfig();
    if (dock && !config.dock) { dock.destroy(); dock = null; }
    if (config.dock && !dock) dock = installDock();
    if (config.editor && !editor) editor = installEditor();
    if (!config.editor && editor) { editor(); editor = null; }
    applyToast(config.toast);
    if (config.presetToggles && !cleanupPresetToggles) cleanupPresetToggles = installPresetToggles();
    if (!config.presetToggles && cleanupPresetToggles) { cleanupPresetToggles(); cleanupPresetToggles = null; }
    if (config.foldersEnabled && !cleanupCharacterFolders) cleanupCharacterFolders = installCharacterFolders();
    if (!config.foldersEnabled && cleanupCharacterFolders) { cleanupCharacterFolders(); cleanupCharacterFolders = null; }
}

function init() {
    if (initialized) return;
    initialized = true;
    cleanupTheme = installTheme(() => home?.refreshTheme());
    home = installHome({
        apply,
        manageDock: () => dock ? dock.manage() : notify('先勾选“悬浮球收纳”，再管理收纳。'),
        addDock: () => dock ? dock.pick() : notify('先勾选“悬浮球收纳”，再点选添加。'),
        revealDock: () => dock ? dock.reveal() : notify('先勾选“悬浮球收纳”，再显示收纳球。'),
    });
    registerCommands();
    void migrateQuickReplies().catch(error => { console.error('[千机伞] QR 集合更名失败', error); notify(error.message, 'warning'); });
    apply();
}

export function disable() {
    const ctx = getHost();
    ctx.eventSource.removeListener(ctx.eventTypes.APP_READY, init);
    cleanupCharacterFolders?.(); cleanupCharacterFolders = null;
    cleanupPresetToggles?.(); cleanupPresetToggles = null;
    home?.destroy(); home = null;
    dock?.destroy(); dock = null;
    editor?.(); editor = null;
    applyToast('off');
    cleanupTheme?.(); cleanupTheme = null;
}

// Both hosts expose APP_READY via getContext.
getHost().eventSource.on(getHost().eventTypes.APP_READY, init);
