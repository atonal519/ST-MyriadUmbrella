export const icons = {
    umbrella: '<svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3Q14.91 4.98 18.36 5.64Q19.02 9.09 21 12Q19.02 14.91 18.36 18.36Q14.91 19.02 12 21Q9.09 19.02 5.64 18.36Q4.98 14.91 3 12Q4.98 9.09 5.64 5.64Q9.09 4.98 12 3Z"/><path d="M12 10.65V3M12.95 11.05 18.36 5.64M13.35 12H21M12.95 12.95 18.36 18.36M12 13.35V21M11.05 12.95 5.64 18.36M10.65 12H3M11.05 11.05 5.64 5.64" stroke-width="1.1"/><circle cx="12" cy="12" r="1.35" stroke-width="1.1"/></svg>',
};

export const baseCss = `
    :host{font:14px/1.5 var(--mainFontFamily,system-ui,sans-serif);color:var(--st-tools-ink,var(--SmartThemeBodyColor,#ddd));--tt-ink:var(--st-tools-ink,var(--SmartThemeBodyColor,#ddd));--tt-surface:var(--st-tools-surface,#171717);--tt-border:color-mix(in srgb,var(--tt-ink) 22%,transparent);--tt-accent:var(--SmartThemeQuoteColor,#bd8780)}
    *{box-sizing:border-box}button,input,textarea,select{font:inherit;color:inherit}button{cursor:pointer}button:disabled{opacity:.4;cursor:default}button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:2px solid var(--tt-accent);outline-offset:2px}
    button{border:1px solid var(--tt-border);background:color-mix(in srgb,var(--tt-ink) 7%,transparent);border-radius:8px;padding:6px 10px}button:hover{background:color-mix(in srgb,var(--tt-ink) 13%,transparent)}
    svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}[hidden]{display:none!important}
    .hint{font-size:12px;opacity:.75;margin:6px 0}.row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}p{margin:6px 0}label{display:flex;align-items:center;gap:8px;min-height:36px}input[type=checkbox]{accent-color:var(--tt-accent)}hr{border:0;border-top:1px solid var(--tt-border);margin:12px 0}
    .error{color:#e69b92;font-size:13px;margin:8px 0}code{user-select:all;font-size:12px}dialog{border:1px solid var(--tt-border);border-radius:14px;background:var(--tt-surface);color:var(--tt-ink);padding:18px;width:min(540px,calc(100vw - 28px));max-height:calc(100dvh - 30px);overflow:auto}dialog::backdrop{background:rgba(0,0,0,.35)}h3{font-size:16px;font-weight:600;margin:0 0 12px}textarea{width:100%;min-height:120px;max-height:52dvh;resize:vertical;padding:10px;border:1px solid var(--tt-border);border-radius:8px;background:color-mix(in srgb,var(--tt-ink) 5%,transparent);font-size:16px;line-height:1.65}.actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}.primary{background:color-mix(in srgb,var(--tt-accent) 25%,transparent)}
    @media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`;

export function shadowHost(id, css = '') {
    const host = document.createElement('div');
    host.id = id;
    const root = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = baseCss + css;
    root.append(style);
    return { host, root };
}

export function editDialog(text) {
    const { host, root } = shadowHost('st-tools-editor');
    const dialog = document.createElement('dialog');
    dialog.innerHTML = '<h3>编辑文字</h3><p class="hint"></p><textarea aria-label="修改原文"></textarea><div class="actions"><button type="button" data-cancel>取消</button><button type="button" class="primary" data-save>应用修改</button></div>';
    const input = dialog.querySelector('textarea');
    input.value = text;
    dialog.querySelector('.hint').textContent = '只修改当前选中的文字，其他内容保持原样。';
    root.append(dialog);
    document.body.append(host);
    // Host hotkeys inspect document.activeElement, which is only the shadow
    // host. Keep typing and Escape inside this editor's normal input flow.
    root.addEventListener('keydown', event => event.stopPropagation());
    return new Promise(resolve => {
        let result = null;
        dialog.querySelector('[data-save]').addEventListener('click', () => { result = input.value; dialog.close(); });
        dialog.querySelector('[data-cancel]').addEventListener('click', () => dialog.close());
        dialog.addEventListener('close', () => { host.remove(); resolve(result); }, { once: true });
        dialog.showModal();
        input.focus({ preventScroll: true });
    });
}
