import { readConfig } from './config.js';
import { deleteLibraryFolder, groupLibraryCards, moveLibraryCards, saveLibraryFolder } from './folders.js';
import { getHost, notify } from './host.js';
import { loadCharacterListHost } from './character-list-host.js';

const css = `
#rm_characters_block.st-tools-folder-mode #rm_print_characters_pagination .paginationjs{display:none!important}
#rm_characters_block.st-tools-folder-mode #rm_print_characters_block{display:block!important}
#st-tools-character-folders{width:100%;font-size:13px}
#st-tools-character-folders [hidden]{display:none!important}
#st-tools-character-folders .library-actions,#st-tools-character-folders .folder-tools,#st-tools-character-folders .folder-form,#st-tools-character-folders .folder-selection{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
#st-tools-character-folders .library-actions{justify-content:space-between;margin:4px 0}
#st-tools-character-folders button,#st-tools-character-folders select{font-size:12px;line-height:1.5;padding:3px 7px;border-radius:5px;min-height:26px;margin:0;width:auto;max-width:none;white-space:nowrap;flex:0 0 auto}
#st-tools-character-folders .folder-form,#st-tools-character-folders .folder-selection{margin:7px 0}
#st-tools-character-folders .folder-form input{font-size:16px;flex:1;min-width:90px;width:90px;margin:0}
#st-tools-character-folders .folder-selection select{flex:1;min-width:90px}
#st-tools-character-folders .card-folder{border-bottom:1px solid var(--SmartThemeBorderColor)}
#st-tools-character-folders .card-folder>summary{display:flex;align-items:center;gap:8px;min-height:36px;padding:7px 3px;list-style:none;cursor:pointer;font-size:13px}
#st-tools-character-folders .card-folder>summary::-webkit-details-marker{display:none}
#st-tools-character-folders .folder-chevron{font-size:10px;transition:transform .15s}
#st-tools-character-folders .card-folder[open]>summary .folder-chevron{transform:rotate(90deg)}
#st-tools-character-folders .folder-name{flex:1;min-width:0;overflow-wrap:anywhere}
#st-tools-character-folders .folder-count{font-size:12px;opacity:.65}
#st-tools-character-folders .folder-body{padding:2px 0 8px}
#st-tools-character-folders .folder-tools{margin:3px 0 7px}
#st-tools-character-folders .st-tools-folder-items{display:flex;flex-direction:column}
body.charListGrid #st-tools-character-folders .st-tools-folder-items{flex-direction:row;flex-wrap:wrap;justify-content:space-around;gap:5px}
#st-tools-character-folders [data-st-tools-selected=true]{box-shadow:inset 0 0 0 2px var(--SmartThemeQuoteColor);border-radius:5px}
#st-tools-character-folders .folder-more{display:block;margin:8px auto 0}
#st-tools-character-folders .folder-empty{font-size:12px;opacity:.65;padding:6px}
@media(prefers-reduced-motion:reduce){#st-tools-character-folders .folder-chevron{transition:none}}
`;

export function installCharacterFolders() {
    let active = true;
    let cleanup = null;
    loadCharacterListHost().then(host => {
        if (active) cleanup = mountCharacterFolders(host);
    }).catch(error => {
        console.error('[千机伞] 读取角色列表失败', error);
        if (active) notify('读取角色列表失败，请关闭文件夹开关后重新开启。', 'warning');
    });
    return () => { active = false; cleanup?.(); cleanup = null; };
}

function mountCharacterFolders(host) {
    const context = getHost();
    const panel = document.getElementById('rm_characters_block');
    const list = document.getElementById('rm_print_characters_block');
    const style = document.createElement('style'); style.id = 'st-tools-character-folders-style'; style.textContent = css;
    document.head.append(style); panel.classList.add('st-tools-folder-mode');
    const root = document.createElement('section'); root.id = 'st-tools-character-folders';
    root.innerHTML = '<div class="native-back"></div><div class="library-actions"><button type="button" class="menu_button" data-new-folder>新建文件夹</button><button type="button" class="menu_button" data-organize>整理</button></div><form class="folder-form" hidden><input class="text_pole" type="text" aria-label="文件夹名称" placeholder="文件夹名称" required maxlength="60"><button class="menu_button" type="submit">保存</button><button class="menu_button" type="button" data-cancel-folder>取消</button></form><div class="folder-selection" hidden><span data-selected></span><select class="text_pole" aria-label="移到文件夹"></select><button type="button" class="menu_button" data-move>移动</button></div><div class="folder-stack"></div>';
    const stack = root.querySelector('.folder-stack');
    const form = root.querySelector('form');
    const nameInput = form.querySelector('input');
    const selection = root.querySelector('.folder-selection');
    const target = selection.querySelector('select');
    const move = selection.querySelector('[data-move]');
    const selected = new Set();
    const expanded = new Set();
    let entities = [];
    let back = null;
    let managing = false;
    let editingId;

    const run = action => { try { action(); } catch (error) { console.error('[千机伞] 整理角色文件夹失败', error); notify(/^(请|已有)/.test(error.message) ? error.message : '整理文件夹失败，请重试。', 'warning'); } };
    function updateSelection() {
        selection.hidden = !managing;
        selection.querySelector('[data-selected]').textContent = `已选 ${selected.size}`;
        move.disabled = !selected.size || target.value === '?';
        for (const row of stack.querySelectorAll('[data-st-tools-avatar]')) {
            if (managing) row.dataset.stToolsSelected = String(selected.has(row.dataset.stToolsAvatar));
            else delete row.dataset.stToolsSelected;
        }
    }

    function showForm(id, name = '') {
        editingId = id; form.hidden = false; nameInput.value = name; nameInput.focus();
    }

    function renderGroup(id, name, items, editable, query) {
        const details = document.createElement('details'); details.className = 'card-folder'; details.dataset.folder = id;
        const summary = document.createElement('summary'); summary.innerHTML = '<span class="folder-chevron" aria-hidden="true">›</span><i class="fa-regular fa-folder" aria-hidden="true"></i><span class="folder-name"></span><span class="folder-count"></span>';
        summary.querySelector('.folder-name').textContent = name; summary.querySelector('.folder-count').textContent = String(items.length);
        const body = document.createElement('div'); body.className = 'folder-body'; details.append(summary, body); stack.append(details);
        function fill() {
            if (body.childElementCount) return;
            if (managing && editable) {
                const tools = document.createElement('div'); tools.className = 'folder-tools';
                const all = document.createElement('button'); all.type = 'button'; all.className = 'menu_button'; all.textContent = '全选本组';
                all.addEventListener('click', () => { for (const entity of items) selected.add(entity.item.avatar); updateSelection(); }); tools.append(all);
                if (id) {
                    const rename = document.createElement('button'); rename.type = 'button'; rename.className = 'menu_button'; rename.textContent = '改名'; rename.addEventListener('click', () => showForm(id, name));
                    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'menu_button'; remove.textContent = '删除文件夹'; remove.title = '删除文件夹，角色卡移至未分类';
                    remove.addEventListener('click', () => run(() => { deleteLibraryFolder(id); expanded.delete(id); render(); })); tools.append(rename, remove);
                }
                body.append(tools);
            }
            if (!items.length) { const empty = document.createElement('p'); empty.className = 'folder-empty'; empty.textContent = '暂无角色卡'; body.append(empty); return; }
            const rows = document.createElement('div'); rows.className = 'st-tools-folder-items';
            const more = document.createElement('button'); more.type = 'button'; more.className = 'menu_button folder-more'; more.textContent = '显示更多';
            let shown = 0;
            function appendBatch() {
                const fragment = document.createDocumentFragment();
                const end = Math.min(shown + 24, items.length);
                for (; shown < end; shown++) {
                    const entity = items[shown]; const row = host.row(entity);
                    if (entity.type === 'character') row.dataset.stToolsAvatar = entity.item.avatar;
                    fragment.append(row);
                }
                rows.append(fragment); more.hidden = shown >= items.length; updateSelection();
                if (!managing) host.bindRows();
            }
            more.addEventListener('click', () => run(appendBatch)); body.append(rows, more); appendBatch();
        }
        details.open = query ? items.length > 0 : expanded.has(id);
        if (details.open) fill();
        details.addEventListener('toggle', () => {
            if (details.open) { if (!query) expanded.add(id); run(fill); }
            else { if (!query) expanded.delete(id); body.replaceChildren(); }
        });
    }

    function render() {
        const query = document.getElementById('character_search_bar').value.trim();
        const folders = readConfig().libraryFolders || [];
        const characters = entities.filter(entity => entity.type === 'character');
        const byAvatar = new Map(characters.map(entity => [entity.item.avatar, entity]));
        stack.replaceChildren();
        root.querySelector('.native-back').replaceChildren(...(back ? [back] : []));
        list.replaceChildren(root);
        for (const group of groupLibraryCards(characters.map(entity => entity.item), folders)) {
            if (query && !group.cards.length) continue;
            renderGroup(group.id, group.name, group.cards.map(card => byAvatar.get(card.avatar)), true, query);
        }
        for (const [type, name] of [['group', '群聊'], ['tag', '标签文件夹']]) {
            const items = entities.filter(entity => entity.type === type);
            if (items.length) renderGroup('@' + type, name, items, false, query);
        }
        if (!stack.childElementCount) { const empty = document.createElement('p'); empty.className = 'folder-empty'; empty.textContent = '没有符合条件的角色卡'; stack.append(empty); }
        const previous = target.value;
        target.replaceChildren(new Option('移到…', '?'), new Option('未分类', ''));
        for (const folder of folders) target.append(new Option(folder.name, folder.id));
        target.value = [...target.options].some(option => option.value === previous) ? previous : '?';
        root.querySelector('[data-organize]').textContent = managing ? '完成' : '整理'; updateSelection();
    }

    root.querySelector('[data-new-folder]').addEventListener('click', () => showForm());
    root.querySelector('[data-cancel-folder]').addEventListener('click', () => { form.hidden = true; });
    form.addEventListener('submit', event => { event.preventDefault(); run(() => { saveLibraryFolder(nameInput.value, editingId); form.hidden = true; render(); }); });
    root.querySelector('[data-organize]').addEventListener('click', () => run(() => { managing = !managing; selected.clear(); form.hidden = true; render(); }));
    target.addEventListener('change', updateSelection);
    move.addEventListener('click', () => run(() => { moveLibraryCards(selected, target.value); expanded.add(target.value); selected.clear(); render(); }));
    root.addEventListener('click', event => {
        const row = event.target.closest('[data-st-tools-avatar]');
        if (!managing || !row) return;
        event.preventDefault(); event.stopImmediatePropagation();
        const avatar = row.dataset.stToolsAvatar;
        if (selected.has(avatar)) selected.delete(avatar); else selected.add(avatar);
        updateSelection();
    }, true);

    function onPage() {
        run(() => {
            // Read the host's full filtered/sorted entity list, not its current
            // page. Only avatar IDs and live references are used for grouping.
            entities = host.entities();
            back = [...list.children].find(node => node.matches('.bogus_folder_select') && !node.getAttribute('tagid')) || null;
            render();
        });
    }
    context.eventSource.makeFirst(context.eventTypes.CHARACTER_PAGE_LOADED, onPage); onPage();
    return () => {
        context.eventSource.removeListener(context.eventTypes.CHARACTER_PAGE_LOADED, onPage);
        root.remove(); style.remove(); panel.classList.remove('st-tools-folder-mode');
        selected.clear(); expanded.clear(); entities = []; back = null;
        host.refresh().catch(error => { console.error('[千机伞] 恢复角色列表失败', error); notify('恢复角色列表失败，请重新打开角色管理页。', 'warning'); });
    };
}
