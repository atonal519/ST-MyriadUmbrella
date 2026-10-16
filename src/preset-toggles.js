import { KEY } from './config.js';
import { getHost, notify } from './host.js';

export function capturePromptToggles(order) {
    return Object.fromEntries(order.map(entry => [entry.identifier, Boolean(entry.enabled)]));
}

export function applyPromptToggles(order, baseline, saved) {
    const defaults = new Map(baseline.map(entry => [entry.identifier, entry.enabled]));
    let changed = false;
    for (const entry of order) {
        const enabled = saved && Object.hasOwn(saved, entry.identifier) ? saved[entry.identifier] : defaults.get(entry.identifier);
        if (typeof enabled !== 'boolean' || entry.enabled === enabled) continue;
        entry.enabled = enabled; changed = true;
    }
    return changed;
}

function currentCard(context) {
    const card = !context.groupId && context.characters[context.characterId];
    if (!card?.avatar || card.avatar === 'none') throw new Error('请先打开一张角色卡，再操作预设开关。');
    return card;
}

export async function saveCardPromptToggles(context, presetName, states, fetcher = globalThis.fetch) {
    const card = currentCard(context);
    const previous = card.data?.extensions?.[KEY] || {};
    const entries = (previous.promptToggles || []).filter(item => item.preset !== presetName);
    if (states) entries.push({ preset: presetName, states });
    // Both hosts replace arrays during merge-attributes. Keeping snapshots in
    // one array also lets clearing/replacing remove obsolete prompt identifiers.
    const response = await fetcher('/api/characters/merge-attributes', {
        method: 'POST', headers: context.getRequestHeaders(),
        body: JSON.stringify({ avatar: card.avatar, data: { extensions: { [KEY]: { promptToggles: entries } } } }),
    });
    if (!response.ok) throw new Error('保存预设开关失败，请检查酒馆连接后重试。');
    card.data ||= {}; card.data.extensions ||= {};
    card.data.extensions[KEY] = { ...card.data.extensions[KEY], promptToggles: entries };
    const raw = card.json_data ? JSON.parse(card.json_data) : null;
    if (raw) {
        raw.data ||= {}; raw.data.extensions ||= {};
        raw.data.extensions[KEY] = { ...raw.data.extensions[KEY], promptToggles: entries };
        card.json_data = JSON.stringify(raw);
        const field = globalThis.document?.getElementById('character_json_data');
        if (field && String(getHost().characterId) === String(context.characterId)) field.value = card.json_data;
    }
}

export function installPresetToggles() {
    const context = getHost();
    const menu = document.getElementById('char-management-dropdown');
    let anchor = menu.querySelector('#clear_character_chat_completion_preset') || menu.querySelector('#set_chat_character_settings');
    const options = [
        ['st-tools-save-prompt-toggles', '保存当前预设开关'],
        ['st-tools-clear-prompt-toggles', '清除已保存开关'],
    ].map(([id, text]) => {
        const option = new Option(text, id); option.id = id; option.dataset.myriadPresetToggle = '';
        if (anchor) anchor.after(option); else menu.append(option);
        anchor = option;
        return option;
    });
    let manager = null;
    let active = true;
    let applied = false;
    const ready = context.openai?.promptManager
        ? Promise.resolve(context.openai.promptManager)
        : import('/scripts/openai.js').then(module => module.promptManager);

    function environment(ctx = getHost()) {
        if (ctx.mainApi !== 'openai') throw new Error('请先切换到对话补全预设，再操作条目开关。');
        const presets = ctx.getPresetManager('openai');
        // A Luker card-bound preset already owns and persists its switches.
        if (String(presets.getSelectedPreset()).startsWith('__luker_card__::')) return null;
        const name = presets.getSelectedPresetName().trim();
        if (!name) throw new Error('请先选择一个对话补全预设。');
        const order = manager.getPromptOrderForCharacter(manager.activeCharacter);
        const preset = presets.getCompletionPresetByName(name);
        const baseline = preset?.prompt_order?.find(item => String(item.character_id) === String(manager.activeCharacter?.id))?.order || [];
        return { name, order, baseline };
    }

    function restore() {
        if (!manager || !active) return;
        const ctx = getHost();
        if (ctx.mainApi !== 'openai') return;
        if (!ctx.getPresetManager('openai')?.getSelectedPresetName().trim()) return;
        const target = environment(ctx);
        if (!target) { applied = false; return; }
        const card = !ctx.groupId && ctx.characters[ctx.characterId];
        const saved = card?.data?.extensions?.[KEY]?.promptToggles?.find(item => item.preset === target.name)?.states;
        if (!saved && !applied) return;
        if (applyPromptToggles(target.order, target.baseline, saved)) manager.render(false);
        applied = Boolean(saved);
    }

    function onRestore() {
        try { restore(); } catch (error) { console.error('[千机伞] 恢复预设开关失败', error); notify('恢复预设开关失败，请重新选择对应预设。', 'warning'); }
    }

    async function onMenu(id) {
        if (!options.some(option => option.id === id)) return;
        try {
            manager = await ready;
            const ctx = getHost();
            const target = environment(ctx);
            if (!target) { notify('这个预设已由 Luker 随卡保存，请使用酒馆原有的绑定预设功能。'); return; }
            const clearing = id === 'st-tools-clear-prompt-toggles';
            await saveCardPromptToggles(ctx, target.name, clearing ? null : capturePromptToggles(target.order));
            if (clearing) { applied = true; restore(); }
            else applied = true;
            notify(clearing ? '已清除当前卡的这份预设开关。' : '当前预设开关已保存到这张卡。', 'success');
        } catch (error) {
            console.error('[千机伞] 保存预设开关失败', error);
            notify(error.message?.startsWith('请先') ? error.message : '保存预设开关失败，请检查酒馆连接后重试。', 'warning');
        }
    }

    const events = [context.eventTypes.CHAT_CHANGED, context.eventTypes.OAI_PRESET_CHANGED_AFTER, context.eventTypes.MAIN_API_CHANGED].filter(Boolean);
    for (const event of events) context.eventSource.on(event, onRestore);
    context.eventSource.on(context.eventTypes.CHARACTER_MANAGEMENT_DROPDOWN, onMenu);
    ready.then(value => { if (active) { manager = value; onRestore(); } }).catch(error => {
        console.error('[千机伞] 读取预设管理器失败', error);
        if (active) notify('读取预设管理器失败，请刷新酒馆后重试。', 'warning');
    });
    return () => {
        if (applied && manager) {
            try {
                const target = getHost().mainApi === 'openai' && environment();
                if (target && applyPromptToggles(target.order, target.baseline)) manager.render(false);
            } catch (error) { console.error('[千机伞] 恢复预设默认开关失败', error); }
        }
        active = false; manager = null;
        for (const option of options) option.remove();
        for (const event of events) context.eventSource.removeListener(event, onRestore);
        context.eventSource.removeListener(context.eventTypes.CHARACTER_MANAGEMENT_DROPDOWN, onMenu);
    };
}
