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

// Native QR references this set by name; reuse it across the extension rename.
const quickReplySetName = '酒馆工具箱';
const replies = [['重新生成', '/tt-reroll'], ['回退输入', '/tt-retract']];

export function quickRepliesEnabled(api = globalThis.quickReplyApi, label) {
    if (!api?.settings.isEnabled) return false;
    const link = api.settings.config.setList.find(item => item.set.name === quickReplySetName);
    return Boolean(link?.isVisible && (label ? [label] : replies.map(([name]) => name)).every(name => {
        const reply = api.getQrByLabel(quickReplySetName, name);
        return reply && !reply.isHidden;
    }));
}

export async function setQuickRepliesEnabled(enabled, api = globalThis.quickReplyApi, label) {
    if (enabled) return installQuickReplies(api, label);
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
