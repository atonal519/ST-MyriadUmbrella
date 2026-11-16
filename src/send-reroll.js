import { getHost, notify, triggerRegenerate } from './host.js';

const cachePrefix = 'st-tools-reroll:';
const legacyPrefix = 'Reroll_Cache_';
const attached = message => Boolean(message?.extra?.media?.length || message?.extra?.image || message?.extra?.file);

export function createRerollActions({ getContext = getHost, documentRef = document, storage = localStorage, regenerate = () => triggerRegenerate(documentRef) } = {}) {
    const memory = new Map();
    let running = false;
    let alive = true;
    let intent = null;
    let chatRevision = 0;
    const chatId = ctx => ctx.getCurrentChatId?.();
    const input = () => documentRef.getElementById('send_textarea');
    function ready(allowDraft = false) {
        if (!alive) throw new Error('发送旁重 roll 已关闭。');
        if (documentRef.body.dataset.generating === 'true' || documentRef.querySelector('#form_sheld.isExecutingCommandsFromChatInput, #send_form.no-connection')) throw new Error('请等当前操作结束并连接酒馆后再重 roll。');
        if (documentRef.querySelector('#chat .edit_textarea, #chat .reasoning_edit_textarea')) throw new Error('请先完成正在编辑的消息。');
        const send = documentRef.getElementById('send_but');
        if (!send || send.disabled || send.getAttribute?.('aria-disabled') === 'true' || !send.getClientRects().length) throw new Error('发送入口当前不可用。');
        if (!input()) throw new Error('未找到消息输入框。');
        if (!allowDraft && input().value.trim()) throw new Error('输入框里还有草稿，请先发送或移走。');
    }
    function capture(preserveIntent = false) {
        if (!alive) return;
        const ctx = getContext();
        const id = chatId(ctx);
        const text = input()?.value;
        if (id == null || id === '' || !text?.trim() || text.trimStart().startsWith('/')) return;
        if (preserveIntent && intent?.id === id && intent.index === ctx.chat.length) return;
        const data = { text, index: ctx.chat.length, timestamp: Date.now() };
        intent = { id, index: data.index };
        memory.set(id, data);
        try { storage.setItem(cachePrefix + id, JSON.stringify(data)); } catch { /* Keep this session's original input when storage is full. */ }
    }
    function read(id) {
        if (memory.has(id)) return memory.get(id);
        for (const prefix of [cachePrefix, legacyPrefix]) {
            try {
                const data = JSON.parse(storage.getItem(prefix + id));
                if (typeof data?.text === 'string' && data.text.trim() && Number.isInteger(data.index)) return data;
            } catch { /* An invalid historical entry is not a usable original input. */ }
        }
        return null;
    }
    async function run(action) {
        if (running) throw new Error('正在处理上一轮重 roll。');
        ready();
        if (action === 'native') { regenerate(); return; }
        const ctx = getContext();
        const revision = chatRevision;
        const id = chatId(ctx);
        const cache = id == null || id === '' ? null : read(id);
        if (!cache) throw new Error('这段聊天还没有发送前原文，请先发送一条消息。');
        const chat = ctx.chat;
        const last = chat.at(-1);
        const index = last?.is_user ? chat.length - 1 : chat.length - 2;
        const user = chat[index];
        if (!user?.is_user || last?.is_system || cache.index !== index) throw new Error('原文缓存与最后一轮楼层不匹配，请用原生编辑。');
        if (attached(user) || attached(last)) throw new Error('最后一轮带有附件，请用酒馆原生编辑。');
        const original = cache.text.trim();
        if (!String(user.mes).includes(original)) {
            // Validation must not evaluate variable-writing macros a second time.
            const expanded = cache.text.replace(/<user>|{{user}}/gi, () => ctx.name1 ?? ctx.substituteParams?.('{{user}}') ?? '{{user}}')
                .replace(/<char>|{{char}}/gi, () => ctx.name2 ?? ctx.substituteParams?.('{{char}}') ?? '{{char}}').trim();
            if (!String(user.mes).includes(expanded)) throw new Error('最后一条输入已变化，无法匹配发送前原文。');
        }
        const targets = chat.slice(index).reverse().map(message => ({ message, text: message.mes }));
        const composer = input();
        let expectedLength = chat.length;
        const check = () => {
            ready();
            const current = getContext();
            if (chatRevision !== revision || chatId(current) !== id || current.chat !== chat || input() !== composer) throw new Error('聊天已切换，已停止重 roll。');
            if (chat.length !== expectedLength) throw new Error('最后一轮消息已变化，已停止重 roll。');
        };
        running = true;
        try {
            for (const target of targets) {
                check();
                if (chat.at(-1) !== target.message || target.message.mes !== target.text) throw new Error('待撤回消息已变化，已停止重 roll。');
                // Luker's Messages API persists each deletion before emitting its native hooks.
                if (typeof ctx.deleteMessages === 'function') await ctx.deleteMessages([expectedLength - 1]);
                else {
                    await ctx.deleteLastMessage();
                    await ctx.saveChat();
                }
                expectedLength--;
                check();
            }
            composer.value = cache.text;
            composer.dispatchEvent(new Event('input', { bubbles: true }));
            composer.focus();
            if (action === 'send') {
                if (!alive || chatRevision !== revision || chatId(getContext()) !== id || composer.value !== cache.text) throw new Error('输入或聊天已变化，请检查输入框后手动发送。');
                ready(true);
                capture();
                documentRef.getElementById('send_but').click();
            }
        } catch (error) {
            // A host save can reject after removing the user message in memory.
            // Keep that input editable without replacing a later draft or another chat.
            if (alive && chatRevision === revision && chatId(getContext()) === id && getContext().chat === chat && input() === composer && !composer.value.trim() && chat.length === index) {
                composer.value = cache.text;
                composer.dispatchEvent(new Event('input', { bubbles: true }));
                composer.focus();
            }
            throw error;
        } finally { running = false; }
    }
    return { capture, run, chatChanged() { chatRevision++; intent = null; }, clearIntent() { intent = null; }, destroy() { alive = false; memory.clear(); } };
}

export function bindRerollGestures(button, act) {
    let pointer = null;
    let holdTimer;
    let clickTimer;
    let suppressed = false;
    let held = false;
    let secondTap = false;
    const clearClick = () => { clearTimeout(clickTimer); clickTimer = null; };
    const cancelPointer = () => { clearTimeout(holdTimer); pointer = null; };
    const interrupt = () => { suppressed = true; secondTap = false; cancelPointer(); clearClick(); };
    const down = event => {
        if (event.button !== 0 || event.isPrimary === false || pointer || button.disabled) return;
        held = false; suppressed = false;
        secondTap = Boolean(clickTimer);
        if (secondTap) clearClick();
        pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
        button.setPointerCapture?.(event.pointerId);
        holdTimer = setTimeout(() => {
            held = true; suppressed = true; cancelPointer(); clearClick(); act('refill');
        }, 500);
    };
    const move = event => { if (pointer && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 10) interrupt(); };
    const up = () => cancelPointer();
    const click = event => {
        event.preventDefault();
        if (button.disabled) return;
        if (event.detail === 0) { clearClick(); act('native'); return; }
        if (held || suppressed) { held = false; return; }
        if (secondTap || clickTimer) { secondTap = false; clearClick(); act('send'); }
        else clickTimer = setTimeout(() => { clickTimer = null; act('native'); }, 230);
    };
    const lost = () => { if (pointer) interrupt(); };
    const contextmenu = event => event.preventDefault();
    const keydown = event => { if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault(); };
    const listeners = { pointerdown: down, pointermove: move, pointerup: up, pointercancel: interrupt, lostpointercapture: lost, click, contextmenu, keydown };
    for (const [name, handler] of Object.entries(listeners)) button.addEventListener(name, handler);
    const destroy = () => { cancelPointer(); clearClick(); for (const [name, handler] of Object.entries(listeners)) button.removeEventListener(name, handler); };
    destroy.cancel = interrupt;
    return destroy;
}

export function installSendReroll() {
    const send = document.getElementById('send_but');
    const input = document.getElementById('send_textarea');
    const right = document.getElementById('rightSendForm');
    if (!send || !input || !right) return null;
    const actions = createRerollActions();
    const button = document.createElement('button');
    button.id = 'st-tools-send-reroll';
    button.type = 'button';
    button.title = '单击重新生成 · 双击全流程重 roll · 长按回填修改';
    button.setAttribute('aria-label', button.title);
    button.innerHTML = '<i class="fa-solid fa-rotate-left" aria-hidden="true"></i>';
    const style = document.createElement('style');
    style.id = 'st-tools-send-reroll-style';
    style.textContent = `#rightSendForm:has(> #st-tools-send-reroll){width:auto;flex-direction:row;flex-wrap:nowrap;align-items:center;gap:4px}button:where(#st-tools-send-reroll){order:2;display:inline-flex;flex:none;align-items:center;justify-content:center;width:var(--bottomFormBlockSize,2.3em);height:var(--bottomFormBlockSize,2.3em);padding:0;margin:0;border:0;border-radius:0;background:transparent;color:inherit;box-shadow:none;font-size:var(--bottomFormIconSize,1em);cursor:pointer;touch-action:none;box-sizing:border-box}button:where(#st-tools-send-reroll) i{display:block;font-size:1em;line-height:1;pointer-events:none}button:where(#st-tools-send-reroll):disabled{opacity:.45;cursor:default}button:where(#st-tools-send-reroll):focus-visible{outline:2px solid currentColor;outline-offset:2px}`;
    document.head.append(style);
    right.insertBefore(button, send);
    function syncState() {
        button.disabled = Boolean(send.disabled || send.getAttribute('aria-disabled') === 'true' || document.body.dataset.generating === 'true' || document.querySelector('#form_sheld.isExecutingCommandsFromChatInput, #send_form.no-connection'));
    }
    const unbind = bindRerollGestures(button, key => { void actions.run(key).catch(error => notify(error.message, 'warning')); });
    const capture = () => actions.capture();
    const keydown = event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) capture(); };
    const clickCapture = () => actions.capture(true);
    send.addEventListener('pointerdown', capture, true);
    send.addEventListener('click', clickCapture, true);
    input.addEventListener('keydown', keydown, true);
    const ctx = getHost();
    const generationStarted = (type, options, dryRun) => { if (!dryRun && (!type || type === 'normal')) actions.capture(true); };
    if (ctx.eventTypes.GENERATION_STARTED) ctx.eventSource.on(ctx.eventTypes.GENERATION_STARTED, generationStarted);
    const clearIntent = () => actions.clearIntent();
    const chatChanged = () => { unbind.cancel(); actions.chatChanged(); };
    if (ctx.eventTypes.CHAT_CHANGED) ctx.eventSource.on(ctx.eventTypes.CHAT_CHANGED, chatChanged);
    for (const name of ['MESSAGE_SENT', 'GENERATION_ENDED']) if (ctx.eventTypes[name]) ctx.eventSource.on(ctx.eventTypes[name], clearIntent);
    const observer = new MutationObserver(() => { if (!send.isConnected || !button.isConnected) destroy(); else syncState(); });
    observer.observe(right.parentNode, { childList: true });
    observer.observe(right, { childList: true });
    observer.observe(send, { attributes: true, attributeFilter: ['disabled', 'aria-disabled'] });
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-generating'] });
    for (const node of [document.getElementById('form_sheld'), document.getElementById('send_form')]) if (node) observer.observe(node, { attributes: true, attributeFilter: ['class'] });
    syncState();
    function destroy() {
        unbind(); actions.destroy(); observer.disconnect();
        send.removeEventListener('pointerdown', capture, true); send.removeEventListener('click', clickCapture, true); input.removeEventListener('keydown', keydown, true);
        if (ctx.eventTypes.CHAT_CHANGED) ctx.eventSource.removeListener(ctx.eventTypes.CHAT_CHANGED, chatChanged);
        for (const name of ['MESSAGE_SENT', 'GENERATION_ENDED']) if (ctx.eventTypes[name]) ctx.eventSource.removeListener(ctx.eventTypes[name], clearIntent);
        if (ctx.eventTypes.GENERATION_STARTED) ctx.eventSource.removeListener(ctx.eventTypes.GENERATION_STARTED, generationStarted);
        button.remove(); style.remove();
    }
    return { destroy };
}
