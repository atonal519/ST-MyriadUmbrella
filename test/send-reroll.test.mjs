import test from 'node:test';
import assert from 'node:assert/strict';
import { createRerollActions, bindRerollGestures } from '../src/send-reroll.js';

function fixture() {
    let id = 'chat-a';
    const chat = [];
    const trace = [];
    const input = { value: '', dispatchEvent: () => trace.push('input'), focus() {} };
    const send = { disabled: false, getClientRects: () => [1], click: () => trace.push('send') };
    const nodes = { send_textarea: input, send_but: send };
    const doc = { getElementById: key => nodes[key], querySelector: () => null, body: { dataset: {} } };
    const data = new Map();
    const ctx = { chat, getCurrentChatId: () => id, substituteParams: s => s.replace('{{user}}', 'Alice'), async saveChat() {}, async deleteLastMessage() { trace.push('delete:' + (chat.length - 1)); chat.pop(); trace.push('hook'); } };
    const api = createRerollActions({ getContext: () => ctx, documentRef: doc, storage: { getItem: k => data.get(k), setItem: (k,v) => data.set(k,v) }, regenerate: () => trace.push('regenerate') });
    function capture(text = '  {{user}} advances\n') { input.value = text; api.capture(); input.value = ''; chat.push({ is_user: true, mes: 'Alice advances' }); }
    return { api, chat, trace, input, ctx, doc, data, capture, switchChat: () => { id = 'chat-b'; } };
}

test('single delete refills exact pre-send macros; double delete follows native hooks then sends once', async () => {
    const f = fixture(); f.capture();
    await f.api.run('refill');
    assert.equal(f.input.value, '  {{user}} advances\n');
    assert.deepEqual(f.trace, ['delete:0', 'hook', 'input']);
    f.trace.length = 0; f.api.capture(); f.input.value = '';
    f.chat.push({ is_user: true, mes: 'Alice advances' }, { is_user: false, mes: 'answer' });
    await f.api.run('send');
    assert.deepEqual(f.trace, ['delete:1', 'hook', 'delete:0', 'hook', 'input', 'send']);
});

test('draft, generation, edited input, mismatched floor/content, attachment and changed chat stop before deletion', async () => {
    for (const scenario of ['draft','busy','editing','floor','content','attachment','chat']) {
        const f = fixture(); f.capture('original'); f.chat[0].mes = 'original';
        if (scenario === 'draft') f.input.value = 'draft';
        if (scenario === 'busy') f.doc.body.dataset.generating = 'true';
        if (scenario === 'editing') f.doc.querySelector = selector => selector.includes('#chat .edit_textarea') ? {} : null;
        if (scenario === 'floor') f.chat.unshift({is_user:false,mes:'intro'});
        if (scenario === 'content') f.chat[0].mes = 'changed';
        if (scenario === 'attachment') f.chat[0].extra = { file: {} };
        if (scenario === 'chat') f.switchChat();
        await assert.rejects(f.api.run('send'), undefined, scenario);
        assert.deepEqual(f.trace, [], scenario);
    }
});

test('chat switch, a new draft and partial failure during awaited deletion never delete the next message or overwrite draft', async () => {
    for (const scenario of ['chat','draft','failure','tail']) {
        const f = fixture(); f.capture('original'); f.chat[0].mes = 'original'; f.chat.push({is_user:false,mes:'reply'});
        f.ctx.deleteLastMessage = async () => {
            f.trace.push('delete'); f.chat.pop();
            if (scenario === 'chat') f.switchChat();
            if (scenario === 'draft') f.input.value = 'new draft';
            if (scenario === 'failure') throw new Error('save failed');
            if (scenario === 'tail') f.chat[0] = {...f.chat[0]};
        };
        await assert.rejects(f.api.run('send'));
        assert.deepEqual(f.trace, ['delete']);
        assert.equal(f.input.value, scenario === 'draft' ? 'new draft' : '');
    }
});

test('native regenerate returns on click; repeated in-flight action and disabled lifecycle cannot delete twice', async () => {
    const f = fixture(); await f.api.run('native'); assert.deepEqual(f.trace, ['regenerate']);
    f.capture('original'); f.chat[0].mes = 'original';
    let finish; f.ctx.deleteLastMessage = () => new Promise(resolve => { finish = () => { f.chat.pop(); resolve(); }; });
    const pending = f.api.run('refill'); await assert.rejects(f.api.run('send'));
    f.api.destroy(); finish(); await assert.rejects(pending);
    assert.equal(f.input.value, '');
});

test('legacy cache only works for matching chat key, floor and text', async () => {
    const f = fixture(); f.chat.push({is_user:true,mes:'legacy'});
    f.data.set('Reroll_Cache_chat-a', JSON.stringify({text:'legacy',index:0,timestamp:1}));
    await f.api.run('refill'); assert.equal(f.input.value, 'legacy');
});

test('pre-send intent survives transformed generation input, then next send captures new raw input', async () => {
    const f = fixture();
    f.input.value = '{{user}} advances'; f.api.capture();
    f.input.value = 'Alice advances'; f.api.capture(true);
    f.chat.push({is_user:true,mes:'Alice advances'}); f.input.value = '';
    await f.api.run('refill'); assert.equal(f.input.value,'{{user}} advances');
    f.api.clearIntent(); f.input.value = 'new input'; f.api.capture(true); f.input.value='';
    f.chat.push({is_user:true,mes:'new input'});
    await f.api.run('refill'); assert.equal(f.input.value,'new input');
});

test('native Messages API persists and emits each deletion before the next deletion and single send', async () => {
    const f = fixture(); f.capture('original'); f.chat[0].mes='original'; f.chat.push({is_user:false,mes:'reply'});
    f.ctx.deleteMessages = async indices => {
        f.trace.push('deleteMessages:'+indices.join(',')); f.chat.splice(indices[0],1);
        await Promise.resolve(); f.trace.push('persist'); f.trace.push('hook');
    };
    f.ctx.saveChat = () => { throw new Error('Messages API already persists'); };
    await f.api.run('send');
    assert.deepEqual(f.trace,['deleteMessages:1','persist','hook','deleteMessages:0','persist','hook','input','send']);
});

class Button extends EventTarget {
    disabled = false;
    setPointerCapture() {}
    fire(type, values={}) { const e = new Event(type, {cancelable:true}); Object.assign(e,{button:0,pointerId:1,clientX:0,clientY:0,detail:1,...values}); this.dispatchEvent(e); }
}
test('pointer single, double, hold, movement, cancellation, keyboard and destroy are exclusive', t => {
    t.mock.timers.enable({apis:['setTimeout']});
    const button = new Button(); const calls = [];
    const cleanup = bindRerollGestures(button, key => calls.push(key));
    const tap = () => { button.fire('pointerdown'); button.fire('pointerup'); button.fire('click'); };
    tap(); t.mock.timers.tick(230); assert.deepEqual(calls,['native']);
    tap(); t.mock.timers.tick(100); tap(); t.mock.timers.tick(500); assert.deepEqual(calls,['native','send']);
    button.fire('pointerdown'); t.mock.timers.tick(500); button.fire('pointerup'); button.fire('click'); t.mock.timers.tick(300); assert.deepEqual(calls,['native','send','refill']);
    button.fire('pointerdown'); button.fire('pointermove',{clientX:20}); button.fire('pointerup'); button.fire('click');
    button.fire('pointerdown'); button.fire('pointercancel'); button.fire('click'); t.mock.timers.tick(500); assert.equal(calls.length,3);
    button.fire('click',{detail:0}); assert.equal(calls.at(-1),'native');
    tap(); cleanup(); t.mock.timers.tick(500); assert.equal(calls.length,4);
});

test('a second pointer held beyond the single-click deadline runs only long press', t => {
    t.mock.timers.enable({apis:['setTimeout']});
    const b = new Button(); const calls=[]; const destroy=bindRerollGestures(b,a=>calls.push(a));
    b.fire('pointerdown'); b.fire('pointerup'); b.fire('click'); t.mock.timers.tick(100);
    b.fire('pointerdown'); t.mock.timers.tick(500); b.fire('pointerup'); b.fire('click');
    assert.deepEqual(calls,['refill']); destroy();
});

test('a rejected host save after deleting the user keeps the raw original editable and never sends', async () => {
    const f=fixture(); f.capture('  original macro {{user}}  '); f.chat[0].mes='original macro Alice';
    f.ctx.deleteMessages=async()=>{f.trace.push('delete');f.chat.pop();throw new Error('save failed');};
    await assert.rejects(f.api.run('send'), /save failed/);
    assert.equal(f.input.value,'  original macro {{user}}  ');assert.deepEqual(f.trace,['delete','input']);
});

test('a transient switch away and back cancels the in-flight reroll', async () => {
    const f=fixture(); f.capture('original'); f.chat[0].mes='original';f.chat.push({is_user:false,mes:'reply'});
    f.ctx.deleteMessages=async()=>{f.trace.push('delete');f.chat.pop();f.api.chatChanged();f.api.chatChanged();};
    await assert.rejects(f.api.run('send'), /聊天已切换/);
    assert.deepEqual(f.trace,['delete']);assert.equal(f.input.value,'');
});

test('validation never evaluates variable-writing macros or repeats exact matching text', async () => {
    const f=fixture(); f.capture('{{incvar::x}} original');f.chat[0].mes='1 original';
    let macroCalls=0;f.ctx.substituteParams=()=>{macroCalls++;throw new Error('must not evaluate');};
    await assert.rejects(f.api.run('refill'), /无法匹配/);assert.equal(macroCalls,0);assert.deepEqual(f.trace,[]);
    f.chat[0].mes='{{incvar::x}} original';await f.api.run('refill');assert.equal(macroCalls,0);
});

test('chat changes cancel unresolved click and hold gestures before a new action can start', t => {
    t.mock.timers.enable({apis:['setTimeout']});
    const b = new Button();const calls=[];const destroy=bindRerollGestures(b,a=>calls.push(a));
    b.fire('pointerdown');b.fire('pointerup');b.fire('click');destroy.cancel();t.mock.timers.tick(600);
    assert.deepEqual(calls,[]);
    b.fire('pointerdown');t.mock.timers.tick(100);destroy.cancel();t.mock.timers.tick(600);b.fire('pointerup');b.fire('click');
    assert.deepEqual(calls,[]);
    b.fire('pointerdown');b.fire('pointerup');b.fire('click');t.mock.timers.tick(230);
    assert.deepEqual(calls,['native']);destroy();
});
