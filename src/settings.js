import { readConfig, writeConfig } from './config.js';
import { notify } from './host.js';
import { shadowHost } from './ui.js';
import { quickRepliesEnabled, setQuickRepliesEnabled } from './reroll.js';

export function installSettings({ apply, manageDock, addDock, revealDock }) {
    const mount = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings');
    if (!mount) return;
    const drawer = document.createElement('div');
    drawer.className = 'inline-drawer';
    drawer.id = 'st-tools-settings';
    drawer.innerHTML = '<div class="inline-drawer-toggle inline-drawer-header"><b>千机伞</b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div><div class="inline-drawer-content"></div>';
    drawer.querySelector('b').style.fontSize = '13px';
    const { host, root } = shadowHost('st-tools-settings-content', ':host{display:block;padding:4px 2px}.settings{font:12px/1.4 var(--mainFontFamily,system-ui,sans-serif)}select{max-width:100%;border:1px solid var(--tt-border);border-radius:5px;padding:3px 5px;background:var(--tt-surface)}.feature{margin:5px 0}label{min-height:23px;gap:5px;flex-wrap:wrap}input[type=checkbox]{margin:0}button{padding:3px 7px;border-radius:5px}.row{gap:5px}hr{margin:7px 0}');
    root.innerHTML += `
      <div class="settings">
      <div class="feature"><label><input type="checkbox" data-setting="dock">悬浮球收纳</label>
      <div class="row"><button type="button" data-reveal>显示收纳球</button><button type="button" data-manage>管理</button><button type="button" data-add>点选添加</button></div></div>
      <hr><div class="feature"><label><input type="checkbox" data-qr>在 QR 栏显示重生成和回退输入</label></div>
      <hr><div class="feature"><label><input type="checkbox" data-setting="editor">正文局部编辑</label></div>
      <hr><div class="feature"><label>通知外观 <select data-toast aria-label="通知外观"><option value="off">使用酒馆原样</option><option value="bar">顶部长细条</option></select></label>
      <button type="button" data-preview>显示一条示例通知</button></div>
      </div>
    `;
    drawer.querySelector('.inline-drawer-content').append(host);
    mount.append(drawer);
    root.addEventListener('keydown', event => event.stopPropagation());
    for (const input of root.querySelectorAll('[data-setting]')) {
        input.checked = readConfig()[input.dataset.setting];
        input.addEventListener('change', () => { writeConfig({ [input.dataset.setting]: input.checked }); apply(); });
    }
    const toast = root.querySelector('[data-toast]');
    toast.value = readConfig().toast;
    toast.addEventListener('change', () => { writeConfig({ toast: toast.value }); apply(); });
    root.querySelector('[data-preview]').addEventListener('click', () => notify('这是一条示例通知，原来的点击与关闭操作会保留。', 'success'));
    root.querySelector('[data-manage]').addEventListener('click', manageDock);
    root.querySelector('[data-add]').addEventListener('click', addDock);
    root.querySelector('[data-reveal]').addEventListener('click', revealDock);
    const qr = root.querySelector('[data-qr]');
    qr.checked = quickRepliesEnabled();
    drawer.querySelector('.inline-drawer-toggle').addEventListener('click', () => { qr.checked = quickRepliesEnabled(); });
    qr.addEventListener('change', async () => {
        qr.disabled = true;
        try {
            await setQuickRepliesEnabled(qr.checked);
        } catch (error) {
            console.error('[千机伞] 更改 QR 显示失败', error);
            notify(globalThis.quickReplyApi ? '更改 QR 显示失败，请重试。' : error.message, 'warning');
        } finally { qr.checked = quickRepliesEnabled(); qr.disabled = false; }
    });
}
