import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const path = '../src/';

test('卡库默认只读，显式偏好保存保留其他设置并在下次读取恢复', async () => {
    const { readConfig, writeConfig } = await import(`${path}config.js`);
    const previous = globalThis.SillyTavern;
    let writes = 0;
    const context = { extensionSettings: { other: { keep: 1 }, st_tavern_tools: { dock: true, custom: 2, charImage: 'abstract' } }, saveSettingsDebounced() { writes++; } };
    globalThis.SillyTavern = { getContext: () => context };
    try {
        assert.equal(readConfig().charLayout, 'grid'); assert.equal(readConfig().charImage, undefined);
        assert.equal(context.extensionSettings.st_tavern_tools.charImage, 'abstract', '读取不自动迁移旧设置');
        assert.equal(writes, 0);
        writeConfig({ charLayout: 'columns' });
        assert.equal(writes, 1);
        assert.equal(readConfig().charLayout, 'columns'); assert.equal(context.extensionSettings.st_tavern_tools.charImage, undefined, '下一次显式保存自然移除废弃自有字段');
        assert.equal(context.extensionSettings.st_tavern_tools.dock, true);
        assert.equal(context.extensionSettings.st_tavern_tools.custom, 2);
        assert.deepEqual(context.extensionSettings.other, { keep: 1 });
        assert(!JSON.stringify(context.extensionSettings).includes('data:image/'));
    } finally { globalThis.SillyTavern = previous; }
});

test('文件夹只归类卡片引用，批量移动和删除不改角色数据或其他设置', async () => {
    const { groupLibraryCards, saveLibraryFolder, moveLibraryCards, deleteLibraryFolder } = await import(`${path}folders.js`);
    const previous = globalThis.SillyTavern;
    const cards = [{ avatar: 'a.png', name: '同名' }, { avatar: 'b.png', name: '同名' }];
    const context = { characters: cards, extensionSettings: { st_tavern_tools: { dock: true } }, saveSettingsDebounced() {} };
    globalThis.SillyTavern = { getContext: () => context };
    try {
        saveLibraryFolder('测试分组');
        const folder = context.extensionSettings.st_tavern_tools.libraryFolders[0];
        moveLibraryCards(['a.png'], folder.id);
        const groups = groupLibraryCards(cards, context.extensionSettings.st_tavern_tools.libraryFolders);
        assert.equal(groups[0].cards[0], cards[0]); assert.equal(groups[1].cards[0], cards[1]);
        assert.equal(groups[1].name, '未分类'); assert.equal(context.extensionSettings.st_tavern_tools.dock, true);
        moveLibraryCards(['a.png'], '');
        assert.equal(groupLibraryCards(cards, context.extensionSettings.st_tavern_tools.libraryFolders)[1].cards.length, 2);
        moveLibraryCards(['a.png', 'b.png'], folder.id); deleteLibraryFolder(folder.id);
        assert.equal(groupLibraryCards(cards, [])[0].cards.length, 2);
        assert.deepEqual(cards, [{ avatar: 'a.png', name: '同名' }, { avatar: 'b.png', name: '同名' }]);
    } finally { globalThis.SillyTavern = previous; }
});

test('随卡开关只改匹配条目的 enabled，未保存的卡恢复预设默认，新条目沿用默认', async () => {
    const { capturePromptToggles, applyPromptToggles } = await import(`${path}preset-toggles.js`);
    const order = [{ identifier: 'a', enabled: true }, { identifier: 'b', enabled: false }, { identifier: 'new', enabled: true }];
    const baseline = structuredClone(order);
    assert.deepEqual(capturePromptToggles(order), { a: true, b: false, new: true });
    assert.equal(applyPromptToggles(order, baseline, { a: false, b: true, removed: false }), true);
    assert.deepEqual(order, [{ identifier: 'a', enabled: false }, { identifier: 'b', enabled: true }, { identifier: 'new', enabled: true }]);
    applyPromptToggles(order, baseline);
    assert.deepEqual(order, baseline);
    assert.equal(applyPromptToggles(order, baseline), false);
});

test('手动保存只写当前卡当前预设的开关，清除保留其他预设和扩展，失败不冒充成功', async () => {
    const { saveCardPromptToggles } = await import(`${path}preset-toggles.js`);
    const card = { avatar: 'a.png', data: { extensions: { external: { keep: 1 }, st_tavern_tools: { keep: 2, promptToggles: [{ preset: 'Other', states: { a: false } }] } } } };
    let sent;
    const context = { characters: [card], characterId: 0, getRequestHeaders: () => ({ 'Content-Type': 'application/json' }) };
    const fetcher = async (url, options) => { sent = { url, data: JSON.parse(options.body) }; return { ok: true, json: async () => ({ ok: true }) }; };
    await saveCardPromptToggles(context, 'Current', { a: true }, fetcher);
    assert.equal(sent.url, '/api/characters/merge-attributes');
    assert.deepEqual(Object.keys(sent.data.data.extensions), ['st_tavern_tools']);
    assert.deepEqual(card.data.extensions, { external: { keep: 1 }, st_tavern_tools: { keep: 2, promptToggles: [{ preset: 'Other', states: { a: false } }, { preset: 'Current', states: { a: true } }] } });
    await saveCardPromptToggles(context, 'Current', null, fetcher);
    assert.deepEqual(card.data.extensions.st_tavern_tools.promptToggles, [{ preset: 'Other', states: { a: false } }]);
    await assert.rejects(saveCardPromptToggles(context, 'Current', { a: false }, async () => ({ ok: false })), /保存.*失败/);
    assert.equal(card.data.extensions.st_tavern_tools.promptToggles.some(item => item.preset === 'Current'), false);
    card.json_data = JSON.stringify(card);
    await saveCardPromptToggles(context, 'Current', { a: true }, async (url, options) => {
        assert.deepEqual(Object.keys(JSON.parse(options.body).data.extensions.st_tavern_tools), ['promptToggles']);
        const raw = JSON.parse(card.json_data); raw.data.extensions.external.live = 3;
        card.json_data = JSON.stringify(raw);
        return { ok: true };
    });
    assert.equal(JSON.parse(card.json_data).data.extensions.external.live, 3);
});

test('同步监控保留 fetch 参数与结果，并行请求结束半秒后转为空闲', async () => {
    const { installSyncStatus } = await import(`${path}sync-status.js`);
    const calls = [];
    class Xhr { open() {} }
    const originalFetch = function (...args) {
        let resolve, reject;
        const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
        calls.push({ receiver: this, args, promise, resolve, reject });
        return promise;
    };
    const target = { fetch: originalFetch, XMLHttpRequest: Xhr };
    const states = [];
    const stop = installSyncStatus(busy => states.push(busy), target);
    const response = new Response('unchanged');
    const get = target.fetch('/read');
    assert.equal(get, calls[0].promise);
    calls[0].resolve(response); assert.equal(await get, response);
    assert.deepEqual(states, [false]);
    const owner = {};
    const options = { method: 'post', body: 'original body' };
    const first = target.fetch.call(owner, '/save', options);
    const request = new Request('https://example.invalid/item', { method: 'DELETE' });
    const second = target.fetch(request);
    assert.equal(calls[1].receiver, owner); assert.equal(calls[1].args[1], options);
    assert.equal(calls[2].args[0], request);
    assert.deepEqual(states, [false, true]);
    calls[1].resolve(response); assert.equal(await first, response);
    assert.deepEqual(states, [false, true]);
    const error = new Error('request failed'); calls[2].reject(error);
    await assert.rejects(second, value => value === error);
    assert.deepEqual(states, [false, true]);
    await new Promise(resolve => setTimeout(resolve, 520));
    assert.deepEqual(states, [false, true, false]);
    stop(); assert.equal(target.fetch, originalFetch);
});

test('停用取消空闲更新并保留其他扩展后来安装的网络包装', async () => {
    const { installSyncStatus } = await import(`${path}sync-status.js`);
    const result = Promise.resolve(new Response('unchanged'));
    const nativeFetch = () => result;
    class Xhr { open() {} }
    const open = Xhr.prototype.open;
    const target = { fetch: nativeFetch, XMLHttpRequest: Xhr };
    const states = [];
    const stop = installSyncStatus(busy => states.push(busy), target);
    const wrapped = target.fetch;
    await target.fetch('/save', { method: 'POST' });
    const later = function (...args) { return Reflect.apply(wrapped, this, args); };
    target.fetch = later;
    stop();
    assert.equal(target.fetch, later); assert.equal(Xhr.prototype.open, open);
    assert.equal(target.fetch('/next', { method: 'POST' }), result);
    await new Promise(resolve => setTimeout(resolve, 520));
    assert.deepEqual(states, [false, true]);
});

test('已加载卡片直接读取，懒加载只请求选中的卡，不选择聊天或写设置', async () => {
    const { readCharacter } = await import(`${path}characters.js`);
    const full = Object.freeze({ avatar: '完整.png', data: Object.freeze({ first_mes: '开场' }) });
    const shallow = Object.freeze({ avatar: '待加载.png', shallow: true });
    const context = { characters: [full, shallow], getRequestHeaders: () => ({ 'Content-Type': 'application/json' }) };
    let requests = 0;
    const fetcher = async (url, options) => {
        requests++;
        assert.equal(url, '/api/characters/get');
        assert.deepEqual(JSON.parse(options.body), { avatar_url: '待加载.png' });
        return { ok: true, json: async () => ({ avatar: shallow.avatar, data: { first_mes: '补读开场' } }) };
    };
    assert.equal(await readCharacter(full.avatar, context, fetcher), full);
    assert.equal(requests, 0);
    assert.equal((await readCharacter(shallow.avatar, context, fetcher)).data.first_mes, '补读开场');
    assert.equal(requests, 1);
    assert.equal(context.characters[1], shallow);
    await assert.rejects(readCharacter('不存在.png', context, fetcher), /未找到/);
    await assert.rejects(readCharacter(shallow.avatar, context, async () => ({ ok: true, json: async () => ({ date_added: 0, chat_size: 0 }) })), /未能读取/);
});

test('只读开场白保留正文，兼容两种卡片字段，空开场不凑条数', async () => {
    const { getGreetings, greetingCount } = await import(`${path}characters.js`);
    const card = Object.freeze({ first_mes: '旧字段', data: Object.freeze({ first_mes: '  **正文**\n', alternate_greetings: Object.freeze(['备选一', '', '备选二']) }) });
    assert.deepEqual(getGreetings(card), ['  **正文**\n', '备选一', '备选二']);
    assert.equal(greetingCount(card), 3);
    assert.deepEqual(getGreetings({ first_mes: '原生开场', data: { alternate_greetings: ['另一个开场'] } }), ['原生开场', '另一个开场']);
    assert.deepEqual(getGreetings({ data: { first_mes: '', alternate_greetings: [] } }), []);
    assert.equal(greetingCount({ shallow: true }), null);
});

test('主页主题将透明色合成到实色底板，通知原有黑白回退保持不变', async () => {
    const { resolveHomePalette, resolveThemePalette } = await import(`${path}theme.js`);
    assert.deepEqual(resolveHomePalette([180, 150, 100, 0.5], [20, 20, 20, 1]), { surface: '#d7c8ad', ink: '#141414' });
    assert.deepEqual(resolveHomePalette([20, 40, 60, 1], [230, 235, 240, 1]), { surface: '#14283c', ink: '#e6ebf0' });
    assert.deepEqual(resolveThemePalette([180, 150, 100, 0.5], [20, 20, 20, 1]), { surface: '#ffffff', ink: '#000000' });
});

test('透明主题按正文深浅回退到实心黑白，保留不透明主题原配色', async () => {
    const { resolveThemePalette } = await import(`${path}theme.js`);
    for (const alpha of [0, 0.4, 0.99]) {
        assert.deepEqual(resolveThemePalette([90, 60, 80, alpha], [240, 240, 240, 1]), { surface: '#000000', ink: '#ffffff' });
        assert.deepEqual(resolveThemePalette([90, 60, 80, alpha], [20, 20, 20, 1]), { surface: '#ffffff', ink: '#000000' });
    }
    assert.deepEqual(resolveThemePalette([31, 45, 53, 1], [230, 215, 198, 1]), { surface: '#1f2d35', ink: '#e6d7c6' });
    assert.deepEqual(resolveThemePalette([20, 30, 40, 1], [255, 255, 255, 0.5]), { surface: '#141e28', ink: '#8a8f94' });
});

test('QR 勾选显示两按钮、取消隐藏，重选不重复添加或覆盖其他按钮', async () => {
    const { installQuickReplies, quickRepliesEnabled, setQuickRepliesEnabled } = await import(`${path}reroll.js`);
    const sets = new Map();
    const active = [];
    const api = {
        getSetByName: name => sets.get(name),
        getQrByLabel: (name, label) => sets.get(name)?.qrList.find(qr => qr.label === label),
        async createSet(name, props) { const set = { name, ...props, qrList: [], async save() {} }; sets.set(name, set); return set; },
        createQuickReply(name, label, props) { const qr = { label, ...props }; sets.get(name).qrList.push(qr); return qr; },
        updateQuickReply(name, label, props) { Object.assign(this.getQrByLabel(name, label), props); },
        addGlobalSet(name, isVisible) { active.push({ name, set: sets.get(name), isVisible }); },
        removeGlobalSet(name) { const index = active.findIndex(link => link.name === name); if (index >= 0) active.splice(index, 1); },
        listGlobalSets: () => active.map(set => set.name),
        settings: { isEnabled: false, config: { setList: active }, save() {} },
        settingsUi: { rerender() {} },
    };
    await installQuickReplies(api);
    assert.equal(sets.size, 1);
    const set = [...sets.values()][0];
    assert.equal(set.injectInput, false);
    assert.equal(set.disableSend, false);
    assert.deepEqual(set.qrList.map(qr => [qr.label, qr.message, qr.isHidden]), [['重新生成', '/tt-reroll', false], ['回退输入', '/tt-retract', false]]);
    set.qrList.push({ label: '自己加的按钮', message: '/echo 保留' });
    set.qrList[0].isHidden = true;
    await installQuickReplies(api);
    assert.equal(sets.size, 1);
    assert.equal(set.qrList.length, 3);
    assert.equal(active.length, 1);
    assert.equal(active[0].isVisible, true);
    assert.equal(api.settings.isEnabled, true);
    assert.equal(set.qrList[2].message, '/echo 保留');
    assert.equal(set.qrList[0].isHidden, false);
    assert.equal(quickRepliesEnabled(api), true);
    active[0].isVisible = false;
    assert.equal(quickRepliesEnabled(api), false);
    await setQuickRepliesEnabled(true, api);
    assert.equal(quickRepliesEnabled(api), true);
    await setQuickRepliesEnabled(false, api);
    assert.equal(quickRepliesEnabled(api), false);
    assert.equal(set.qrList.length, 3);
    await setQuickRepliesEnabled(true, api);
    assert.equal(quickRepliesEnabled(api), true);
    assert.equal(set.qrList.length, 3);
    assert.equal(active.length, 1);
    await setQuickRepliesEnabled(false, api, '回退输入');
    assert.equal(quickRepliesEnabled(api, '重新生成'), true);
    assert.equal(quickRepliesEnabled(api, '回退输入'), false);
    await setQuickRepliesEnabled(false, api, '重新生成');
    assert.equal(quickRepliesEnabled(api, '重新生成'), false);
    assert.equal(active.length, 1, '用户自己的可见按钮仍保留');
    assert.equal(set.qrList[2].message, '/echo 保留');
    await setQuickRepliesEnabled(true, api, '回退输入');
    assert.equal(quickRepliesEnabled(api, '回退输入'), true);
    assert.equal(quickRepliesEnabled(api, '重新生成'), false);
    api.settings.isEnabled = false;
    await setQuickRepliesEnabled(true, api, '重新生成');
    assert.equal(quickRepliesEnabled(api, '重新生成'), true);
    assert.equal(quickRepliesEnabled(api, '回退输入'), false, '只打开所选按钮');
});

test('收起贴边只露出 14px，展开后所有入口向下且留在屏幕内', async () => {
    const { layoutDock } = await import(`${path}dock-geometry.js`);
    for (const edge of ['left', 'right', '']) {
        const closed = layoutDock({ width: 390, height: 720, x: 120, y: 650, edge, open: false, count: 4 });
        if (edge === 'left') assert.equal(closed.hub.x + closed.hub.size, 14);
        if (edge === 'right') assert.equal(390 - closed.hub.x, 14);
        const opened = layoutDock({ width: 390, height: 720, x: 120, y: 650, edge, open: true, count: 4 });
        assert.equal(opened.slots.length, 4);
        assert(opened.hub.y < opened.slots[0].y);
        for (let i = 0; i < opened.slots.length; i++) {
            const slot = opened.slots[i];
            assert(slot.x >= 0 && slot.x + slot.size <= 390);
            assert(slot.y + slot.size <= 720);
            if (i) assert.equal(slot.y - opened.slots[i - 1].y - opened.slots[i - 1].size, 4);
        }
    }
});

test('位置靠近左右边缘才吸附，中间保留自由位置', async () => {
    const { settleDock } = await import(`${path}dock-geometry.js`);
    assert.equal(settleDock({ x: 8, y: 90 }, 390, 720).edge, 'left');
    assert.equal(settleDock({ x: 350, y: 90 }, 390, 720).edge, 'right');
    assert.equal(settleDock({ x: 170, y: 90 }, 390, 720).edge, '');
});

test('局部修改保留 Markdown 原文和其他段落', async () => {
    const { locateText, replaceSpan } = await import(`${path}text-locate.js`);
    const raw = '第一段。\n\n风吹过**红色**的树叶。\n\n最后一段。';
    const span = locateText(raw, '风吹过红色的树叶。');
    assert.equal(span.text, '风吹过**红色**的树叶。');
    assert.equal(replaceSpan(raw, span, '风吹过绿色的树叶。'), '第一段。\n\n风吹过绿色的树叶。\n\n最后一段。');
});

test('重复文字通过实际显示位置定位，没有明确位置则不给第一处冒充结果', async () => {
    const { locateText } = await import(`${path}text-locate.js`);
    const raw = '他说：**好。**\n她说：好。';
    const visible = '他说：好。\n她说：好。';
    const span = locateText(raw, '好。', { visibleText: visible, beforeText: '他说：好。\n她说：' });
    assert.equal(span.start, raw.lastIndexOf('好。'));
    assert.equal(locateText(raw, '好。'), null);
});

test('HTML 包装可定位，显示正则改成其他内容时不猜源文本', async () => {
    const { locateText } = await import(`${path}text-locate.js`);
    assert.equal(locateText('<p>路过<b>小桥</b>。</p>', '路过小桥。').text, '路过<b>小桥</b>。');
    assert.equal(locateText('原文内容。', '替换后的完全不同内容。'), null);
});

test('显示正则把一段改成另一段已有文字时，不误写那条已有原文', async () => {
    const { locateText } = await import(`${path}text-locate.js`);
    assert.equal(locateText('红色。\n蓝色。', '蓝色。', { visibleText: '蓝色。\n蓝色。', beforeText: '' }), null);
});

test('隐藏状态文字、Markdown 链接和楼内插件文案不使正常局部编辑退成整楼', async () => {
    const { locateText, replaceSpan } = await import(`${path}text-locate.js`);
    const raw = '<PreStatus>时间：上午</PreStatus>\n\n窗外的雨停了。\n\n他推开门。\n\n[链接](https://example.test)';
    const span = locateText(raw, '他推开门。', { visibleText: '窗外的雨停了。他推开门。链接第 0 个结', beforeText: '窗外的雨停了。' });
    assert.equal(span?.text, '他推开门。');
    assert.equal(replaceSpan(raw, span, '他关上门。'), '<PreStatus>时间：上午</PreStatus>\n\n窗外的雨停了。\n\n他关上门。\n\n[链接](https://example.test)');
});

test('整楼显示序列不一致时，重复片段仍按点击处的实际出现次序定位', async () => {
    const { locateText } = await import(`${path}text-locate.js`);
    const raw = '<hidden>不显示的头部</hidden>\n\n他说：好。\n\n她说：好。';
    const span = locateText(raw, '好。', { visibleText: '他说：好。她说：好。工具按钮', beforeText: '他说：好。她说：' });
    assert.equal(span?.start, raw.lastIndexOf('好。'));
});

test('隐藏草稿中的重写和复查不阻止编辑可见正文，也不修改草稿', async () => {
    const { locateText, replaceSpan } = await import(`${path}text-locate.js`);
    const raw = '[DRAFT]重写：他推开门。\n复查：他推开门。[/DRAFT]\n正文：他推开门。';
    const span = locateText(raw, '他推开门。', {
        visibleText: '正文：他推开门。', beforeText: '正文：',
        renderText: text => text.replace(/\[DRAFT\][\s\S]*?\[\/DRAFT\]/g, ''),
    });
    assert.equal(span?.start, raw.lastIndexOf('他推开门。'));
    assert.equal(replaceSpan(raw, span, '他关上门。'), '[DRAFT]重写：他推开门。\n复查：他推开门。[/DRAFT]\n正文：他关上门。');
});

test('其他隐藏规则与正文重复台词按实际渲染和点击次序定位', async () => {
    const { locateText } = await import(`${path}text-locate.js`);
    const raw = '<private>好。</private>他说：**好。**\n她说：好。';
    const span = locateText(raw, '好。', {
        visibleText: '他说：好。她说：好。工具按钮', beforeText: '他说：好。她说：',
        renderText: text => text.replace(/<private>[\s\S]*?<\/private>/g, ''),
    });
    assert.equal(span?.start, raw.lastIndexOf('好。'));
    assert.equal(locateText('红色。\n蓝色。', '蓝色。', {
        visibleText: '蓝色。蓝色。', beforeText: '', renderText: text => text.replace('红色。', '蓝色。'),
    }), null, '被正则改写的文字不能冒充另一处原文');
});

test('保存更新当前候选、发出编辑事件，保留其他字段；两宿主走各自持久化接口', async () => {
    const { saveEditedMessage } = await import(`${path}host.js`);
    for (const modern of [true, false]) {
        const events = [];
        const message = { mes: '旧正文', swipes: ['另一个候选', '旧正文'], swipe_id: 1, extra: { otherPlugin: { keep: 3 } } };
        const ctx = {
            chat: [message], chatMetadata: {},
            eventTypes: { MESSAGE_EDITED: 'edited', MESSAGE_UPDATED: 'updated' },
            eventSource: { emit: async (name, index) => { events.push(name); assert.equal(index, 0); assert.equal(message.mes, '新正文'); } },
            updateMessageBlock: () => events.push('render'),
            saveChat: async () => events.push('save-native'),
            ...(modern ? { updateMessages: async (patch, options) => { assert.deepEqual(patch, { index: 0, patch: {} }); assert.equal(options.rerender, false); events.push('save-luker'); } } : {}),
        };
        await saveEditedMessage(ctx, 0, message, '新正文');
        assert.deepEqual(message.swipes, ['另一个候选', '新正文']);
        assert.deepEqual(message.extra, { otherPlugin: { keep: 3 } });
        assert.deepEqual(events, ['edited', 'render', 'updated', modern ? 'save-luker' : 'save-native']);
    }
});

test('重生成快捷入口实际点击宿主菜单项', async () => {
    const { triggerRegenerate } = await import(`${path}host.js`);
    let clicked = 0;
    const doc = { getElementById(id) { assert.equal(id, 'option_regenerate'); return { click() { clicked++; } }; } };
    triggerRegenerate(doc);
    assert.equal(clicked, 1);
});

test('回退最后一轮到输入框，两宿主均保留更早楼层且不覆盖未发送草稿', async () => {
    const { retractInput } = await import(`${path}host.js`);
    for (const modern of [true, false]) {
        const chat = [{ mes: '开场' }, { is_user: true, mes: '上一轮' }, { mes: '上一轮回复' }, { is_user: true, mes: '这次输入' }, { mes: '这次回复' }];
        const input = { value: '', dispatchEvent() {}, focus() {} };
        const doc = { getElementById: id => id === 'send_textarea' ? input : null };
        const ctx = { chat, saveChat: async () => {}, deleteMessage: async index => { chat.splice(index, 1); } };
        if (modern) ctx.deleteMessages = async indices => { for (const i of [...indices].reverse()) chat.splice(i, 1); };
        input.value = '还没发的草稿';
        await assert.rejects(retractInput(ctx, doc), /输入框/);
        assert.equal(chat.length, 5);
        input.value = '';
        await retractInput(ctx, doc);
        assert.equal(chat.length, 3);
        assert.equal(input.value, '这次输入');
        assert.equal(chat[2].mes, '上一轮回复');
    }
});

test('收纳球短按展开，长按管理，松手不再补一次展开', async () => {
    const { bindPressActions } = await import(`${path}press.js`);
    const button = new EventTarget();
    const action = [];
    const cleanup = bindPressActions(button, { click: () => action.push('expand'), hold: () => action.push('manage') });
    const pointer = type => { const e = new Event(type, { cancelable: true }); Object.assign(e, { button: 0, pointerId: 1, clientX: 0, clientY: 0 }); button.dispatchEvent(e); };
    pointer('pointerdown'); pointer('pointerup'); button.dispatchEvent(new Event('click'));
    assert.deepEqual(action, ['expand']);
    pointer('pointerdown');
    await new Promise(resolve => setTimeout(resolve, 560));
    pointer('pointerup'); button.dispatchEvent(new Event('click'));
    assert.deepEqual(action, ['expand', 'manage']);
    cleanup();
});

test('收纳样式重复对齐不反复写 style，移出后保留外部新增样式', async () => {
    const { holdTarget, placeTarget, releaseTarget, actionTarget } = await import(`${path}dock-targets.js`);
    const values = new Map([['left', ['12px', '']], ['--busy-color', ['red', '']]]);
    let writes = 0;
    const element = {
        matches: () => false,
        querySelector: () => null,
        style: {
            getPropertyValue: key => values.get(key)?.[0] || '', getPropertyPriority: key => values.get(key)?.[1] || '',
            setProperty(key, value, priority) { writes++; values.set(key, [value, priority || '']); }, removeProperty(key) { values.delete(key); },
        },
        getBoundingClientRect: () => ({ width: 36, height: 36 }),
    };
    const held = holdTarget(element);
    const rect = { left: 100, top: 200, width: 44, height: 44 };
    placeTarget(held, rect, true);
    const first = writes;
    placeTarget(held, rect, true);
    assert.equal(writes, first);
    values.set('--busy-color', ['blue', '']);
    releaseTarget(held);
    assert.deepEqual(values.get('left'), ['12px', '']);
    assert.deepEqual(values.get('--busy-color'), ['blue', '']);
    let clicked = false;
    const originalButton = { click() { clicked = true; } };
    actionTarget({ shadowRoot: { querySelector: () => originalButton } }).click();
    assert(clicked);
});

test('预设球使用运行中脚本返回的按钮事件，播放器无需显式列出按钮', async () => {
    const { EventEmitter } = await import('node:events');
    const { activateCompatibleTarget, dockCompatibility } = await import(`${path}dock-compat.js`);
    const previous = globalThis.SillyTavern;
    const events = new EventEmitter();
    let open = false;
    events.on('runtime-button-event', () => { open = !open; });
    globalThis.SillyTavern = { getContext: () => ({ eventSource: events }) };
    const frame = { contentWindow: { getScriptName: () => '拉刻西斯播放器', getButtonEvent: name => name === '播放器' ? 'runtime-button-event' : '' } };
    const element = {
        matches: selector => selector === '#lx-player-host .lx-deck-launcher',
        ownerDocument: { querySelectorAll: () => [frame] },
        click() { throw new Error('普通 click 不会打开播放器'); },
    };
    try {
        await activateCompatibleTarget(element, dockCompatibility(element));
        assert.equal(open, true);
        await activateCompatibleTarget(element, dockCompatibility(element));
        assert.equal(open, false);
    } finally { globalThis.SillyTavern = previous; }
});

test('兼容球收起移除命中框，展开不重复写样式，移出恢复容器层级', async () => {
    const { holdTarget, placeTarget, releaseTarget } = await import(`${path}dock-targets.js`);
    let writes = 0;
    const style = entries => {
        const values = new Map(entries);
        return {
            getPropertyValue: key => values.get(key)?.[0] || '', getPropertyPriority: key => values.get(key)?.[1] || '',
            setProperty(key, value, priority = '') { writes++; values.set(key, [value, priority]); },
            removeProperty(key) { writes++; values.delete(key); },
        };
    };
    const container = { style: style([['z-index', ['1900000', '']]]) };
    const element = { style: style([['display', ['flex', '']], ['left', ['20px', '']]]),
        matches: selector => selector === '#lx-player-host .lx-deck-launcher', querySelector: () => null,
        closest: () => container, getBoundingClientRect: () => ({ width: 36, height: 36 }),
    };
    const binding = holdTarget(element);
    assert(Number(container.style.getPropertyValue('z-index')) > 1900000);
    const rect = { left: 100, top: 200, width: 36, height: 36 };
    placeTarget(binding, rect, false); assert.equal(element.style.getPropertyValue('display'), 'none');
    placeTarget(binding, rect, true); assert.equal(element.style.getPropertyValue('display'), 'flex');
    const count = writes; placeTarget(binding, rect, true); assert.equal(writes, count);
    releaseTarget(binding);
    assert.equal(element.style.getPropertyValue('display'), 'flex');
    assert.equal(element.style.getPropertyValue('left'), '20px');
    assert.equal(container.style.getPropertyValue('z-index'), '1900000');
    assert.equal(container.style.getPropertyPriority('z-index'), '');
});

test('移动收纳球取消按压时不触发展开', async () => {
    const { bindPressActions } = await import(`${path}press.js`);
    const button = new EventTarget();
    let count = 0;
    const cleanup = bindPressActions(button, { click: () => count++, hold: () => count++ });
    const pointer = (type, x) => { const e = new Event(type, { cancelable: true }); Object.assign(e, { button: 0, pointerId: 1, clientX: x, clientY: 0 }); button.dispatchEvent(e); };
    pointer('pointerdown', 0); pointer('pointermove', 30); pointer('pointerup', 30); button.dispatchEvent(new Event('click'));
    assert.equal(count, 0);
    cleanup();
});

test('实际宿主 EventEmitter 能让编辑消费者读取新正文并保留其修改', async () => {
    const { saveEditedMessage } = await import(`${path}host.js`);
    const oldStorage = globalThis.localStorage;
    globalThis.localStorage = { getItem: () => null };
    const emitters = [
        await import('../../../../../lib/eventemitter.js'),
    ];
    if (process.env.ST_UPSTREAM_REFERENCE) emitters.push(await import(pathToFileURL(`${process.env.ST_UPSTREAM_REFERENCE}/public/lib/eventemitter.js`).href));
    for (const { EventEmitter } of emitters) {
        const message = { mes: '旧文', extra: { external: 4 } };
        const events = new EventEmitter();
        events.on('edited', index => { assert.equal(index, 0); assert.equal(message.mes, '修改后'); message.extra.listener = 'kept'; });
        const ctx = { chat: [message], eventSource: events, eventTypes: { MESSAGE_EDITED: 'edited', MESSAGE_UPDATED: 'updated' }, updateMessageBlock() {}, async saveChat() { assert.equal(message.extra.listener, 'kept'); } };
        await saveEditedMessage(ctx, 0, message, '修改后');
        assert.deepEqual(message.extra, { external: 4, listener: 'kept' });
    }
    globalThis.localStorage = oldStorage;
});

test('代表性长正文只定位点击内容，较多悬浮球由可滚动区域容纳', async () => {
    const { locateText } = await import(`${path}text-locate.js`);
    const { layoutDock } = await import(`${path}dock-geometry.js`);
    const raw = '背景段落。\n\n'.repeat(10000) + '唯一的修改目标。';
    assert.equal(locateText(raw, '唯一的修改目标。').start, raw.length - 8);
    const layout = layoutDock({ width: 320, height: 260, x: 310, y: 220, edge: 'right', open: true, count: 12 });
    assert(layout.visibleCount < 12);
    assert(layout.hub.y + layout.columnHeight <= 254);
});
