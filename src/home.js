import { shadowHost } from './ui.js';
import { homeCss } from './home-style.js';
import { mountLibrary } from './library.js';
import { mountToolbox } from './settings.js';
import { installWandEntry } from './wand.js';

export function installHome(actions) {
    const monthFont = new FontFace('TT Month Brush', `url("${new URL('../assets/month-titles/CaveatBrush-Regular.ttf', import.meta.url).href}")`, { weight: '400' });
    document.fonts.add(monthFont);
    monthFont.load().catch(error => console.warn('[千机伞] 月份字体读取失败', error));
    let host = null;
    let dialog = null;
    let library = null;

    function close() {
        dialog?.close(); library?.destroy(); library = null;
        host?.remove(); host = null; dialog = null;
    }

    function open() {
        if (dialog) { dialog.focus(); return; }
        const view = shadowHost('st-tools-home', homeCss);
        host = view.host;
        const root = view.root;
        const icons = document.createElement('link'); icons.rel = 'stylesheet';
        icons.href = new URL('../../../../../css/fontawesome.min.css', import.meta.url).href;
        root.append(icons);
        dialog = document.createElement('dialog'); dialog.className = 'home'; dialog.setAttribute('aria-label', '千机伞');
        dialog.innerHTML = '<div class="shell"><header class="home-header"><div class="home-search"></div><button type="button" class="icon-button" data-close aria-label="关闭千机伞"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></header><main class="home-body"><section class="home-view" id="char-view" role="tabpanel" aria-label="char"></section><section class="home-view" id="tools-view" role="tabpanel" aria-label="工具箱" hidden></section></main><nav class="home-tabs" role="tablist" aria-label="主页"><button type="button" class="home-tab" role="tab" aria-selected="true" aria-controls="char-view" data-tab="char"><i class="fa-solid fa-book-open" aria-hidden="true"></i><span>char</span></button><button type="button" class="home-tab" role="tab" aria-selected="false" aria-controls="tools-view" data-tab="tools"><i class="fa-solid fa-toolbox" aria-hidden="true"></i><span>工具箱</span></button></nav></div>';
        root.append(dialog); document.body.append(host);
        const layouts = document.createElement('div'); layouts.className = 'home-layout';
        root.querySelector('[data-close]').before(layouts);
        const body = root.querySelector('.home-body');
        const char = root.querySelector('#char-view');
        const tools = root.querySelector('#tools-view');
        library = mountLibrary(char, body, root.querySelector('.home-search'), layouts);
        const outside = action => () => { close(); action(); };
        const toolbox = mountToolbox(tools, { ...actions, manageDock: outside(actions.manageDock), addDock: outside(actions.addDock), revealDock: outside(actions.revealDock) });
        const scroll = { char: 0, tools: 0 };
        let active = 'char';
        for (const tab of root.querySelectorAll('[data-tab]')) tab.addEventListener('click', () => {
            scroll[active] = body.scrollTop; active = tab.dataset.tab;
            char.hidden = active !== 'char'; tools.hidden = active !== 'tools';
            library.setVisible(active === 'char');
            for (const item of root.querySelectorAll('[data-tab]')) item.setAttribute('aria-selected', String(item === tab));
            if (active === 'tools') toolbox.refresh();
            body.scrollTop = scroll[active];
        });
        root.querySelector('[data-close]').addEventListener('click', close);
        root.addEventListener('keydown', event => event.stopPropagation());
        dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
        dialog.showModal();
        // Opening the album should not summon the mobile keyboard.
        root.querySelector('[data-close]').focus({ preventScroll: true });
    }
    const removeWand = installWandEntry(open);
    return {
        refreshTheme() { library?.refreshTheme(); },
        destroy() { close(); removeWand(); document.fonts.delete(monthFont); },
    };
}
