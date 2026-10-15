import { getHost, notify, saveEditedMessage } from './host.js';
import { locateText, replaceSpan } from './text-locate.js';
import { editDialog } from './ui.js';

function caretRange(x, y) {
    if (document.caretRangeFromPoint) return document.caretRangeFromPoint(x, y);
    const caret = document.caretPositionFromPoint?.(x, y);
    if (!caret) return null;
    const range = document.createRange();
    range.setStart(caret.offsetNode, caret.offset);
    range.collapse(true);
    return range;
}

function clickedRange(event, container) {
    const block = event.target.closest('p,li,blockquote,pre,summary,td,th,h1,h2,h3,h4');
    const selection = window.getSelection();
    if (selection?.rangeCount && !selection.isCollapsed && block?.contains(selection.getRangeAt(0).commonAncestorContainer)) {
        return selection.getRangeAt(0).cloneRange();
    }
    const caret = caretRange(event.clientX, event.clientY);
    if (caret && container.contains(caret.startContainer) && caret.startContainer.nodeType === Node.TEXT_NODE) {
        const source = caret.startContainer.textContent;
        const start = source.lastIndexOf('\n', Math.max(0, caret.startOffset - 1)) + 1;
        const newline = source.indexOf('\n', caret.startOffset);
        caret.setStart(caret.startContainer, start);
        caret.setEnd(caret.startContainer, newline < 0 ? source.length : newline);
        if (caret.toString().trim()) return caret;
    }
    const element = block;
    if (!element || element === container || !container.contains(element)) return null;
    const range = document.createRange();
    range.selectNodeContents(element);
    return range;
}

export function installEditor() {
    const chat = document.getElementById('chat');
    if (!chat) return () => {};
    let editing = false;
    let gesture = null;
    let taps = [];
    let lastTouchAt = 0;

    const edit = async event => {
        const container = event.target.closest('.mes_text');
        if (!container || editing || event.target.closest('button,a,input,textarea,select,[contenteditable="true"]')) return;
        const range = clickedRange(event, container);
        if (!range?.toString().trim()) return;
        const row = container.closest('.mes[mesid]');
        const index = Number(row?.getAttribute('mesid'));
        const context = getHost();
        const message = context.chat[index];
        if (!message || !row) return;
        const raw = String(message.mes || '');
        const prefix = document.createRange();
        prefix.selectNodeContents(container);
        prefix.setEnd(range.startContainer, range.startOffset);
        const span = locateText(raw, range.toString(), { visibleText: container.textContent, beforeText: prefix.toString() });
        if (!span) {
            notify('无法准确定位这一段。请选中更完整的文字后再试。', 'warning');
            return;
        }
        const offset = row.getBoundingClientRect().top - chat.getBoundingClientRect().top;
        const openDetails = Array.from(container.querySelectorAll('details')).flatMap((el, i) => el.open ? [i] : []);
        event.preventDefault();
        editing = true;
        try {
            const edited = await editDialog(span.text);
            if (edited === null || edited === span.text) return;
            const current = context.chat[index];
            if (!current) throw new Error('这条消息已经删除，无法应用修改。');
            if (current.mes !== raw) throw new Error('这条消息已经被修改，请重新打开编辑。');
            const text = replaceSpan(raw, span, edited);
            let userScrolled = false;
            const onScroll = () => { userScrolled = true; };
            chat.addEventListener('wheel', onScroll, { passive: true });
            chat.addEventListener('touchmove', onScroll, { passive: true });
            try {
                await saveEditedMessage(context, index, current, text);
                await new Promise(resolve => requestAnimationFrame(resolve));
                const updated = chat.querySelector(`.mes[mesid="${index}"]`);
                const details = updated?.querySelectorAll('.mes_text details');
                for (const i of openDetails) if (details?.[i]) details[i].open = true;
                if (updated && !userScrolled) chat.scrollTop += updated.getBoundingClientRect().top - chat.getBoundingClientRect().top - offset;
            } finally {
                chat.removeEventListener('wheel', onScroll);
                chat.removeEventListener('touchmove', onScroll);
            }
        } catch (error) {
            console.error('[千机伞] 编辑失败', error);
            notify(error.message || '文字修改未能完成，请重新打开编辑。', 'error');
        } finally {
            editing = false;
            taps = [];
        }
    };

    const doubleClick = event => {
        if (Date.now() - lastTouchAt > 1000) void edit(event);
    };
    const down = event => {
        if (event.pointerType !== 'touch' || editing || !event.target.closest('.mes_text')) return;
        lastTouchAt = Date.now();
        gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, row: event.target.closest('.mes') };
    };
    const move = event => {
        if (gesture?.id === event.pointerId && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 15) {
            gesture = null;
            taps = [];
        }
    };
    const up = event => {
        if (!gesture || gesture.id !== event.pointerId) return;
        const now = Date.now();
        const last = taps.at(-1);
        if (!last || now - last.time > 450 || last.row !== gesture.row || Math.hypot(last.x - event.clientX, last.y - event.clientY) > 35) taps = [];
        taps.push({ time: now, x: event.clientX, y: event.clientY, row: gesture.row });
        gesture = null;
        if (taps.length === 3) { taps = []; void edit(event); }
    };
    const cancel = () => { gesture = null; taps = []; };
    const bindings = { dblclick: doubleClick, pointerdown: down, pointermove: move, pointerup: up, pointercancel: cancel };
    for (const [name, handler] of Object.entries(bindings)) chat.addEventListener(name, handler);
    return () => { for (const [name, handler] of Object.entries(bindings)) chat.removeEventListener(name, handler); };
}
