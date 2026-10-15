export function getHost() {
    const host = globalThis.SillyTavern || globalThis.Luker;
    if (!host?.getContext) throw new Error('酒馆尚未准备好，请稍后再试。');
    return host.getContext();
}

export function notify(message, type = 'info') {
    globalThis.toastr?.[type]?.(message, '千机伞');
}

export function triggerRegenerate(documentRef = document) {
    const action = documentRef.getElementById('option_regenerate');
    if (!action) throw new Error('未找到重新生成入口，请先打开一个聊天。');
    // Keep the native edit checks, group generation and extension hooks intact.
    action.click();
}

export async function retractInput(context = getHost(), documentRef = document) {
    const input = documentRef.getElementById('send_textarea');
    if (!input) throw new Error('未找到消息输入框。');
    if (input.value.trim()) throw new Error('输入框里还有未发送的文字，请先发送或移走，再回退上一轮。');
    const stop = documentRef.getElementById('mes_stop');
    if (stop?.getClientRects().length) throw new Error('请先停止生成，再回退上一轮。');
    const index = context.chat.findLastIndex(message => message.is_user);
    if (index < 0) throw new Error('还没有可回退的用户消息。');
    const message = context.chat[index];
    if (message.extra?.media?.length || message.extra?.image || message.extra?.file) {
        throw new Error('这条输入带有附件，请用酒馆原生编辑处理，避免撤回后丢失附件。');
    }
    // Keep the user's words in the composer before asking the host to delete
    // the tail. This is a user-requested withdrawal, not a generation retry.
    input.value = String(message.mes || '');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const indices = Array.from({ length: context.chat.length - index }, (_, offset) => index + offset);
    if (typeof context.deleteMessages === 'function') {
        await context.deleteMessages(indices);
    } else {
        for (const id of indices.reverse()) await context.deleteMessage(id, undefined, false);
        await context.saveChat();
    }
    input.focus();
}

export async function saveEditedMessage(context, index, message, text) {
    message.mes = text;
    if (Array.isArray(message.swipes)) message.swipes[message.swipe_id ?? 0] = text;
    if (context.chatMetadata) context.chatMetadata.tainted = true;
    await context.eventSource.emit(context.eventTypes.MESSAGE_EDITED, index);
    context.updateMessageBlock(index, message);
    await context.eventSource.emit(context.eventTypes.MESSAGE_UPDATED, index);
    // Luker's updateMessages currently persists/renders without edit events;
    // upstream has no Messages API. Emit once above and centralize this split.
    if (typeof context.updateMessages === 'function') {
        await context.updateMessages({ index, patch: {} }, { rerender: false });
    } else {
        await context.saveChat();
    }
}
