import { getHost, notify, retractInput, triggerRegenerate } from './host.js';

export function registerCommands() {
    const ctx = getHost();
    const add = (name, help, action) => ctx.SlashCommandParser.addCommandObject(ctx.SlashCommand.fromProps({
        name, helpString: help,
        callback: async () => { try { await action(); } catch (error) { notify(error.message, 'warning'); } return ''; },
    }));
    add('tt-reroll', '执行酒馆原生重新生成。', triggerRegenerate);
    add('tt-retract', '撤回最后一条用户消息及后续回复，将原文放回空输入框，等待手动发送。', () => retractInput());
}

const quickReplySetName = '千机伞';
const legacyQuickReplySetName = '酒馆工具箱';
const replies = [['重新生成', '/tt-reroll'], ['回退输入', '/tt-retract']];
let pendingRename = null;
const renameError = message => Object.assign(new Error(message), { name: 'QuickReplyRenameError' });

export function migrateQuickReplies(api = globalThis.quickReplyApi, fetcher = globalThis.fetch) {
    if (pendingRename) return pendingRename;
    const set = api?.getSetByName(legacyQuickReplySetName);
    if (!set) return Promise.resolve(false);
    if (api.getSetByName(quickReplySetName)) {
        return Promise.reject(renameError('已有同名的“千机伞”QR 集合。请先在快速回复设置中为它换名，再重新启用千机伞。'));
    }
    const context = getHost();
    const post = async (operation, data, message) => {
        let response;
        try {
            response = await fetcher('/api/quick-replies/' + operation, {
                method: 'POST', headers: context.getRequestHeaders(), body: JSON.stringify(data),
            });
        } catch { throw renameError(message); }
        if (!response.ok) throw renameError(message);
    };
    pendingRename = (async () => {
        // Preserve the native set and QR objects; only the persisted name changes.
        await post('save', { ...set.toJSON(), name: quickReplySetName }, 'QR 集合更名失败：新集合未能保存，旧集合仍保留。请检查酒馆连接后重新启用千机伞。');
        await post('delete', { name: legacyQuickReplySetName }, 'QR 集合更名未完成：新集合“千机伞”已保存，但旧集合“酒馆工具箱”未能删除。请检查酒馆连接，恢复后在千机伞工具箱中再操作一次 QR 开关完成更名。');
        set.name = quickReplySetName;
        const assistant = context.extensionSettings['qr-assistant'];
        for (const [list, oldName, newName] of [
            [assistant?.whitelist, `QRV2::${legacyQuickReplySetName}`, `QRV2::${quickReplySetName}`],
            [assistant?.groupOrder?.left, legacyQuickReplySetName, quickReplySetName],
            [assistant?.groupOrder?.right, legacyQuickReplySetName, quickReplySetName],
        ]) {
            if (Array.isArray(list)) for (const [index, name] of list.entries()) if (name === oldName) list[index] = newName;
        }
        api.settings.save();
        api.settingsUi.rerender();
        return true;
    })().finally(() => { pendingRename = null; });
    return pendingRename;
}

export function quickRepliesEnabled(api = globalThis.quickReplyApi, label) {
    if (!api?.settings.isEnabled) return false;
    const link = api.settings.config.setList.find(item => item.set.name === quickReplySetName)
        || api.settings.config.setList.find(item => item.set.name === legacyQuickReplySetName);
    return Boolean(link?.isVisible && (label ? [label] : replies.map(([name]) => name)).every(name => {
        const reply = api.getQrByLabel(link.set.name, name);
        return reply && !reply.isHidden;
    }));
}

export async function setQuickRepliesEnabled(enabled, api = globalThis.quickReplyApi, label) {
    if (enabled) return installQuickReplies(api, label);
    await migrateQuickReplies(api);
    const set = api?.getSetByName(quickReplySetName);
    if (!set) return;
    if (label) {
        const reply = api.getQrByLabel(quickReplySetName, label);
        if (reply) api.updateQuickReply(quickReplySetName, label, { isHidden: true });
        await set.save();
        if (!set.qrList.some(reply => !reply.isHidden)) api.removeGlobalSet(quickReplySetName);
    } else api.removeGlobalSet(quickReplySetName);
    api.settings.save();
    api.settingsUi.rerender();
}

export async function installQuickReplies(api = globalThis.quickReplyApi, selected) {
    if (!api) throw new Error('请先在酒馆扩展中启用“快速回复”，再添加 QR 按钮。');
    await migrateQuickReplies(api);
    const name = quickReplySetName;
    // Read effective visibility before enabling the shared native set, so
    // choosing one button never silently reveals an unchecked sibling.
    const visible = new Map(replies.map(([label]) => [label, !selected || selected === label || quickRepliesEnabled(api, label)]));
    let set = api.getSetByName(name);
    if (!set) set = await api.createSet(name, { disableSend: false, injectInput: false, placeBeforeInput: false });
    // Native QR executes slash commands without inserting them into the draft.
    // Keep existing replies and never recreate a user's already populated set.
    for (const [label, message] of replies) {
        const existing = api.getQrByLabel(name, label);
        const isHidden = !visible.get(label);
        if (!existing) api.createQuickReply(name, label, { message, isHidden, showLabel: true });
        else if (existing.isHidden !== isHidden) api.updateQuickReply(name, label, { isHidden });
    }
    await set.save();
    if (!api.listGlobalSets().includes(name)) api.addGlobalSet(name, true);
    const link = api.settings.config.setList.find(item => item.set === set);
    if (link) link.isVisible = true;
    api.settings.isEnabled = true;
    api.settings.save();
    api.settingsUi.rerender();
}
