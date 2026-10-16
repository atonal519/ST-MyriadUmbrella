import { readConfig, writeConfig } from './config.js';
import { notify } from './host.js';
import { quickRepliesEnabled, setQuickRepliesEnabled } from './reroll.js';

export function mountToolbox(root, { apply, manageDock, addDock, revealDock }) {
    root.classList.add('toolbox');
    root.innerHTML = `
      <details class="feature"><summary><i class="fa-solid fa-chevron-right" aria-hidden="true"></i><span>悬浮球收纳</span><input type="checkbox" data-setting="dock" aria-label="启用悬浮球收纳"></summary>
      <div class="feature-body"><div class="row"><button type="button" data-reveal>显示收纳球</button><button type="button" data-manage>管理</button><button type="button" data-add>点选添加</button></div></div></details>
      <div class="feature"><label class="feature-switch"><span>QR 重新生成</span><input type="checkbox" data-qr="重新生成" aria-label="在 QR 栏显示重新生成"></label><label class="feature-switch"><span>QR 回退输入</span><input type="checkbox" data-qr="回退输入" aria-label="在 QR 栏显示回退输入"></label></div>
      <div class="feature"><label class="feature-switch"><span>正文局部编辑</span><input type="checkbox" data-setting="editor" aria-label="正文局部编辑"></label></div>
      <div class="feature"><label class="feature-switch"><span>角色卡文件夹</span><input type="checkbox" data-setting="foldersEnabled" aria-label="角色卡文件夹"></label></div>
      <div class="feature"><label class="feature-switch"><span>随卡保存预设开关</span><input type="checkbox" data-setting="presetToggles" aria-label="随卡保存预设开关"></label></div>
      <details class="feature"><summary><i class="fa-solid fa-chevron-right" aria-hidden="true"></i><span>通知外观</span></summary>
      <div class="feature-body"><select data-toast aria-label="通知外观"><option value="off">使用酒馆原样</option><option value="bar">顶部长细条</option></select><button type="button" data-preview>示例通知</button></div></details>
    `;
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
    const replies = root.querySelectorAll('[data-qr]');
    const refresh = () => { for (const qr of replies) qr.checked = quickRepliesEnabled(undefined, qr.dataset.qr); };
    refresh();
    for (const qr of replies) qr.addEventListener('change', async () => {
        for (const input of replies) input.disabled = true;
        try {
            await setQuickRepliesEnabled(qr.checked, undefined, qr.dataset.qr);
        } catch (error) {
            console.error('[千机伞] 更改 QR 显示失败', error);
            notify(globalThis.quickReplyApi ? '更改 QR 显示失败，请重试。' : error.message, 'warning');
        } finally { refresh(); for (const input of replies) input.disabled = false; }
    });
    return { refresh };
}
