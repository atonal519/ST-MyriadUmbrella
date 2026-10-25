import { BALL_SIZE, DOCK_Z_INDEX, HUB_SIZE, RAIL_PADDING, SLOT_GAP, SLOT_SIZE, layoutDock, settleDock } from './dock-geometry.js';
import { actionTarget, findTarget, fingerprint, floatingTarget, holdTarget, placeTarget, releaseTarget, suppressCoordinateStart, targetKey } from './dock-targets.js';
import { activateCompatibleTarget, dockCompatibility, dropCompatibleTarget, prepareCompatibleTarget, NATIVE_DOCK_EVENT } from './dock-compat.js';
import { readConfig, writeConfig } from './config.js';
import { notify } from './host.js';
import { bindPressActions } from './press.js';
import { icons, shadowHost } from './ui.js';
import { installSyncStatus } from './sync-status.js';

const POSITION_KEY = 'st-tavern-tools-position';
// Mobile ST fixes body while html establishes the fixed-position containing
// block. Insets alone can then resolve to zero height and clip every control.
const css = `
    :host{position:fixed;inset:0;width:100vw;height:100dvh;z-index:${DOCK_Z_INDEX};pointer-events:none;overflow:hidden}
    .rail{position:absolute;pointer-events:none;border:1px solid color-mix(in srgb,var(--tt-ink) 13%,transparent);border-radius:${HUB_SIZE / 2 + RAIL_PADDING}px;background:var(--tt-surface);box-shadow:0 3px 12px rgba(0,0,0,.08);transition:height 180ms ease,background 180ms ease}
    .rail[data-edge=left]{border-top-left-radius:${8 + RAIL_PADDING}px;border-bottom-left-radius:${8 + RAIL_PADDING}px}.rail[data-edge=right]{border-top-right-radius:${8 + RAIL_PADDING}px;border-bottom-right-radius:${8 + RAIL_PADDING}px}
    .rail.closed{background:transparent;border-color:transparent;box-shadow:none}
    .hub{position:absolute;display:grid;place-items:center;width:${HUB_SIZE}px;height:${HUB_SIZE}px;padding:0;border:1px solid color-mix(in srgb,var(--tt-ink) 48%,transparent);border-radius:${HUB_SIZE / 2}px;pointer-events:auto;touch-action:none;user-select:none;-webkit-user-select:none;color:var(--tt-ink);background:var(--tt-surface);opacity:.58;box-shadow:0 2px 8px rgba(0,0,0,.25);transition:opacity 160ms ease,border-radius 180ms ease}
    .hub[aria-expanded=false]{transition:left 180ms ease,top 180ms ease,opacity 160ms ease,border-radius 180ms ease}
    .hub.dragging{transition:none}.hub[data-edge=left]{border-radius:8px ${HUB_SIZE / 2}px ${HUB_SIZE / 2}px 8px}.hub[data-edge=right]{border-radius:${HUB_SIZE / 2}px 8px 8px ${HUB_SIZE / 2}px}
    .hub[aria-expanded=true],.hub.pressed,.hub:focus-visible,.hub.dragging{opacity:1}
    @media(hover:hover){.hub:hover{opacity:1}}
    .hub:focus-visible{outline-offset:-3px}
    .hub svg{stroke-width:1.5}.hub[data-sync=idle]{color:#279f7d}.hub[data-sync=busy]{color:#bb8618}
    .hub[aria-expanded=false][data-edge=left] svg,.hub[aria-expanded=false][data-edge=right] svg{opacity:0}
    .hub[aria-expanded=false][data-edge=left]::after,.hub[aria-expanded=false][data-edge=right]::after{content:'';position:absolute;top:50%;transform:translateY(-50%);width:5px;height:5px;border-radius:50%;background:currentColor;box-shadow:0 0 0 2px color-mix(in srgb,currentColor 12%,transparent)}
    .hub[data-sync=busy]::after{animation:sync-pulse 900ms ease-in-out infinite}@keyframes sync-pulse{0%,100%{opacity:.65}50%{opacity:1}}
    @media(prefers-reduced-motion:reduce){.hub[data-sync=busy]::after{animation:none}}
    .hub[aria-expanded=false][data-edge=left]::after{right:5px}.hub[aria-expanded=false][data-edge=right]::after{left:5px}
    .list{position:absolute;width:${SLOT_SIZE}px;overflow-y:auto;overflow-x:hidden;scrollbar-width:none;pointer-events:auto;overscroll-behavior:contain;display:flex;flex-direction:column;gap:${SLOT_GAP}px}.list::-webkit-scrollbar{display:none}
    .slot{display:block;position:relative;flex:none;width:${SLOT_SIZE}px;height:${SLOT_SIZE}px;padding:0;border:0;border-radius:50%;background:transparent!important;touch-action:pan-y}
    .slot[data-busy]::after{content:'';position:absolute;inset:${(SLOT_SIZE - BALL_SIZE) / 2}px;border-radius:50%;pointer-events:none;box-shadow:0 0 3px var(--tt-working-color);animation:dock-breathe 1.4s ease-in-out infinite}
    @keyframes dock-breathe{0%,100%{opacity:.12}50%{opacity:.42}}
    @media(prefers-reduced-motion:reduce){.slot[data-busy]::after{animation:none;opacity:.2}}
    .slot:hover,.slot:focus-visible{outline:1px solid color-mix(in srgb,var(--tt-accent) 45%,transparent);outline-offset:0}
    .slot.missing{border:1px dashed var(--tt-border)}.slot.missing::after{content:'·';opacity:.5}
    .empty{position:absolute;width:${SLOT_SIZE}px;height:${SLOT_SIZE}px;border-radius:50%;font-size:22px;padding:0;pointer-events:auto}
    .manager-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid var(--tt-border)}
    dialog{pointer-events:auto}
    .pick-note{position:absolute;left:50%;top:20px;transform:translateX(-50%);width:max-content;max-width:calc(100vw - 32px);padding:10px 14px;background:var(--tt-surface);border:1px solid var(--tt-border);border-radius:12px;pointer-events:auto}
`;

function paintGlow(control, slot, visible) {
    // Work remains owned by the original plugin. The dock projects only its
    // busy signal and color, keeping native static shadows inside the crop.
    const busy = visible && (control.getAttribute('aria-busy') === 'true' || control.matches('.sp-fab-btn.sp-fab-busy,.sp-fab-btn.sp-btn-generating'));
    if (slot.hasAttribute('data-busy') !== busy) slot.toggleAttribute('data-busy', busy);
    // A color transition initially still reports the idle ink. Use its target
    // color rather than freezing that first frame into the working glow.
    const transition = busy ? control.getAnimations().find(animation => animation.transitionProperty === 'color') : null;
    const color = busy ? transition?.effect.getKeyframes().at(-1).color || getComputedStyle(control).color : '';
    if (slot.style.getPropertyValue('--tt-working-color') === color) return;
    if (color) slot.style.setProperty('--tt-working-color', color);
    else slot.style.removeProperty('--tt-working-color');
}

export function installDock() {
    const { host, root } = shadowHost('st-tools-dock', css);
    root.innerHTML += '<div class="rail closed" aria-hidden="true"></div><div class="list" role="group" aria-label="已收纳的悬浮球" hidden></div><button type="button" class="hub" aria-label="点击展开收纳；长按管理"></button><button type="button" class="empty" aria-label="添加悬浮球" title="添加悬浮球" hidden>+</button><div class="pick-note" hidden>点一下要收纳的悬浮球 <button type="button">取消</button></div>';
    document.body.append(host);
    const rail = root.querySelector('.rail');
    const hub = root.querySelector('.hub');
    const list = root.querySelector('.list');
    const empty = root.querySelector('.empty');
    const pickNote = root.querySelector('.pick-note');
    hub.innerHTML = icons.umbrella;
    const cleanupSync = installSyncStatus(busy => {
        hub.dataset.sync = busy ? 'busy' : 'idle';
        const state = busy ? '正在同步' : '空闲';
        hub.title = `${state}；点击展开或收起；长按管理悬浮球`;
        hub.setAttribute('aria-label', `${state}；点击展开收纳；长按管理`);
    });
    let position = { x: window.innerWidth - HUB_SIZE, y: 100, edge: 'right' };
    try { Object.assign(position, JSON.parse(localStorage.getItem(POSITION_KEY) || '{}')); } catch { /* device-local position is disposable */ }
    let items = readConfig().dockItems;
    let open = false;
    let gesture = null;
    let dragged = false;
    let hubHeld = false;
    let externalDrag = null;
    let itemDrag = null;
    let releasedPointer = null;
    let picking = false;
    let layoutFrame = 0;
    let rebindTimer = 0;
    let manager = null;
    const bindings = new Map();
    const slots = new Map();
    const viewport = () => {
        const view = window.visualViewport;
        return { width: view?.width || innerWidth, height: view?.height || innerHeight, left: view?.offsetLeft || 0, top: view?.offsetTop || 0 };
    };

    function align() {
        const listRect = list.getBoundingClientRect();
        for (const [key, binding] of bindings) {
            const slot = slots.get(key);
            if (!slot) continue;
            const moving = itemDrag?.key === key && itemDrag.active;
            const rect = moving ? { left: itemDrag.x - SLOT_SIZE / 2, top: itemDrag.y - SLOT_SIZE / 2, width: SLOT_SIZE, height: SLOT_SIZE } : slot.getBoundingClientRect();
            const visible = moving || (open && rect.top >= listRect.top - 1 && rect.bottom <= listRect.bottom + 1);
            placeTarget(binding, rect, visible);
            paintGlow(binding.control, slot, visible && !moving);
        }
    }
    function scheduleAlign() {
        if (layoutFrame) return;
        layoutFrame = requestAnimationFrame(() => { layoutFrame = 0; align(); });
    }
    function paint() {
        const view = viewport();
        const layout = layoutDock({ ...view, ...position, open, count: items.length });
        const x = view.left + layout.hub.x;
        const y = view.top + layout.hub.y;
        const listX = x + (HUB_SIZE - SLOT_SIZE) / 2;
        Object.assign(hub.style, { left: `${x}px`, top: `${y}px` });
        hub.dataset.edge = position.edge;
        rail.dataset.edge = position.edge;
        hub.setAttribute('aria-expanded', String(open));
        Object.assign(rail.style, { left: `${Math.max(view.left, x - RAIL_PADDING)}px`, top: `${y - RAIL_PADDING}px`, width: `${HUB_SIZE + RAIL_PADDING * 2}px`, height: `${layout.columnHeight + RAIL_PADDING * 2}px` });
        rail.classList.toggle('closed', !open);
        list.hidden = !open || !items.length;
        Object.assign(list.style, { left: `${listX}px`, top: `${y + HUB_SIZE + SLOT_GAP}px`, height: `${layout.listHeight}px` });
        empty.hidden = !open || items.length > 0;
        Object.assign(empty.style, { left: `${listX}px`, top: `${Math.min(view.top + view.height - SLOT_SIZE - 6, y + HUB_SIZE + SLOT_GAP)}px` });
        scheduleAlign();
    }
    function release(key, point, pointer) {
        const binding = bindings.get(key);
        if (!binding) return;
        binding.observer.disconnect();
        const slot = slots.get(key);
        if (slot) paintGlow(binding.control, slot, false);
        if (point && pointer && binding.compatibility?.nativeDrop) {
            releaseTarget(binding);
            dropCompatibleTarget(binding.element, point, pointer);
        } else releaseTarget(binding, point);
        bindings.delete(key);
    }
    function bindItems() {
        for (const item of items) {
            const old = bindings.get(item.key);
            if (old?.element.isConnected) continue;
            if (old) release(item.key);
            const element = findTarget(item.fingerprint);
            if (!element) continue;
            const binding = holdTarget(element);
            binding.observer = new MutationObserver(scheduleAlign);
            const attributes = { attributes: true, attributeFilter: ['style', 'class', 'aria-busy'] };
            if (binding.compatibility?.elementId === 'tw-jm-reader') attributes.attributeFilter.push('hidden');
            binding.observer.observe(element, attributes);
            if (binding.control !== element) binding.observer.observe(binding.control, attributes);
            bindings.set(item.key, binding);
        }
        for (const item of items) slots.get(item.key)?.classList.toggle('missing', !bindings.has(item.key));
        paint();
    }
    function saveItems() {
        writeConfig({ dockItems: items });
        renderItems();
    }
    function renderItems() {
        list.replaceChildren();
        slots.clear();
        for (const item of items) {
            const slot = document.createElement('button');
            slot.type = 'button';
            slot.className = 'slot';
            slot.title = item.name;
            slot.setAttribute('aria-label', `打开${item.name}`);
            const activate = async () => {
                const binding = bindings.get(item.key);
                if (!binding) { notify('暂时找不到这个悬浮球。请确认原球已显示，或在管理中移出后重新添加。', 'warning'); return; }
                // The slot owns the full hit area; activate the original
                // plugin entry while its original control supplies the visual.
                try {
                    if (binding.compatibility) await activateCompatibleTarget(binding.element, binding.compatibility);
                    else actionTarget(binding.element).click();
                } catch (error) {
                    console.error('[千机伞] 打开收纳球失败', error);
                    notify(error.message || '打开这个悬浮球失败，请重试。', 'warning');
                    return;
                }
                open = false;
                paint();
            };
            slot.addEventListener('click', event => { event.stopPropagation(); void activate(); });
            slot.addEventListener('pointerdown', event => {
                const binding = bindings.get(item.key);
                if (event.button !== 0 || !binding) return;
                itemDrag = { key: item.key, id: event.pointerId, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, active: false };
                slot.setPointerCapture(event.pointerId);
            });
            slot.addEventListener('pointermove', event => {
                if (!itemDrag || itemDrag.id !== event.pointerId) return;
                const dx = event.clientX - itemDrag.startX, dy = event.clientY - itemDrag.startY;
                if (!itemDrag.active) {
                    if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) { itemDrag = null; return; }
                    if (Math.abs(dx) < 10) return;
                    itemDrag.active = true;
                    slot.setPointerCapture(event.pointerId);
                }
                event.preventDefault();
                itemDrag.x = event.clientX; itemDrag.y = event.clientY;
                scheduleAlign();
            });
            const finishItemDrag = event => {
                if (!itemDrag || itemDrag.id !== event.pointerId) return;
                const active = itemDrag.active;
                itemDrag = null;
                if (!active) {
                    const binding = bindings.get(item.key);
                    if (event.type === 'pointerup' && binding?.compatibility && (event.pointerType === 'touch' || binding.compatibility.nativeDrop)) {
                        if (binding.compatibility.nativeDrop) prepareCompatibleTarget(binding.element, event);
                        // A collected touch control can finish without click;
                        // consume any trailing click through the existing path.
                        releasedPointer = event.pointerId;
                        void activate();
                    }
                    return;
                }
                const rect = list.getBoundingClientRect();
                const outside = event.clientX < rect.left - 12 || event.clientX > rect.right + 12 || event.clientY < rect.top - 12 || event.clientY > rect.bottom + 12;
                if (event.type === 'pointerup' && outside) remove(item.key, { x: event.clientX, y: event.clientY }, event);
                else scheduleAlign();
                releasedPointer = event.pointerId;
            };
            slot.addEventListener('pointerup', finishItemDrag);
            slot.addEventListener('pointercancel', finishItemDrag);
            slots.set(item.key, slot);
            list.append(slot);
        }
        bindItems();
    }
    function add(element) {
        const value = fingerprint(element);
        const key = targetKey(value);
        if (items.some(item => item.key === key)) { notify('这个悬浮球已经收纳了。'); return; }
        const button = actionTarget(element);
        const name = value.title || button.getAttribute('aria-label') || button.getAttribute('title') || value.elementId || '悬浮球';
        items = [...items, { key, fingerprint: value, name: name.slice(0, 60) }];
        open = true;
        saveItems();
    }
    function remove(key, point, pointer) {
        release(key, point, pointer);
        items = items.filter(item => item.key !== key);
        saveItems();
        renderManager();
    }
    function pick(value = true) { picking = value; pickNote.hidden = !value; }
    pickNote.querySelector('button').addEventListener('click', () => pick(false));
    empty.addEventListener('click', () => pick());

    function renderManager() {
        if (!manager) return;
        const rows = manager.querySelector('[data-rows]');
        rows.replaceChildren();
        if (!items.length) rows.textContent = '还没有收纳悬浮球。';
        for (const item of items) {
            const row = document.createElement('div'); row.className = 'manager-row';
            const label = document.createElement('span'); label.textContent = item.name;
            const button = document.createElement('button'); button.type = 'button'; button.textContent = '移出';
            button.addEventListener('click', () => remove(item.key));
            row.append(label, button); rows.append(row);
        }
    }
    function showManager() {
        if (manager) { manager.focus(); return; }
        manager = document.createElement('dialog');
        manager.innerHTML = '<h3>管理悬浮球</h3><div data-rows></div><p class="hint">把原球拖入收纳；在栏内横向拖出可解除收纳，上下滑动浏览。</p><div class="actions"><button type="button" data-pick>点选添加</button><button type="button" data-close>完成</button></div>';
        root.append(manager);
        renderManager();
        manager.querySelector('[data-pick]').addEventListener('click', () => { manager.close(); pick(); });
        manager.querySelector('[data-close]').addEventListener('click', () => manager.close());
        manager.addEventListener('close', () => { manager.remove(); manager = null; }, { once: true });
        manager.showModal();
    }

    const toggleHub = () => { if (dragged) { dragged = false; return; } open = !open; paint(); };
    const cleanupPress = bindPressActions(hub, { click: toggleHub, hold: () => { hubHeld = true; showManager(); } });
    hub.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        const view = viewport();
        const rect = hub.getBoundingClientRect();
        gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left - view.left, top: rect.top - view.top, open };
        dragged = false;
        hubHeld = false;
        hub.classList.add('pressed');
        hub.setPointerCapture(event.pointerId);
    });
    hub.addEventListener('pointermove', event => {
        if (!gesture || gesture.id !== event.pointerId) return;
        const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
        if (!dragged && Math.hypot(dx, dy) < 7) return;
        dragged = true;
        hub.classList.add('dragging');
        open = false;
        position = { x: gesture.left + dx, y: gesture.top + dy, edge: '' };
        paint();
    });
    const finishDrag = event => {
        if (!gesture) return;
        hub.classList.remove('dragging', 'pressed');
        if (dragged) {
            const view = viewport();
            position = settleDock(position, view.width, view.height);
            open = position.edge ? false : gesture.open;
            localStorage.setItem(POSITION_KEY, JSON.stringify(position));
            paint();
        } else if (event.type === 'pointerup' && event.pointerType === 'touch' && !hubHeld) {
            // Edge-clipped touch buttons can receive pointerup without a
            // browser click. Activate here once, consuming any later click.
            releasedPointer = event.pointerId;
            toggleHub();
        }
        gesture = null;
    };
    hub.addEventListener('pointerup', finishDrag);
    hub.addEventListener('pointercancel', finishDrag);

    const onClick = event => {
        // Touch activation and drag release already finished on pointerup.
        // Consume that gesture's trailing click; the next pointerdown clears it.
        if (releasedPointer !== null && event.pointerId === releasedPointer) {
            releasedPointer = null;
            event.preventDefault(); event.stopImmediatePropagation(); return;
        }
        if (!picking || event.composedPath().includes(host)) return;
        const element = floatingTarget(event);
        if (!element) return;
        event.preventDefault(); event.stopImmediatePropagation();
        pick(false); add(element);
    };
    const onDown = event => {
        if (event[NATIVE_DOCK_EVENT]) return;
        releasedPointer = null;
        if (event.composedPath().includes(host)) return;
        if (open) { open = false; paint(); }
        const target = floatingTarget(event);
        externalDrag = target && !bindingsHas(target) ? { target, x: event.clientX, y: event.clientY, pointerId: event.pointerId } : null;
    };
    const bindingsHas = element => Array.from(bindings.values()).some(binding => binding.element === element);
    const onUp = event => {
        if (event[NATIVE_DOCK_EVENT]) return;
        const drag = externalDrag;
        externalDrag = null;
        if (!drag || drag.pointerId !== event.pointerId || Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 12) return;
        const rect = hub.getBoundingClientRect();
        if (event.clientX >= rect.left - 24 && event.clientX <= rect.right + 24 && event.clientY >= rect.top - 24 && event.clientY <= rect.bottom + 24) add(drag.target);
    };
    const onKey = event => { if (event.key === 'Escape') pick(false); };
    const cancelExternal = () => { externalDrag = null; };
    const onPointerStart = event => {
        if (event[NATIVE_DOCK_EVENT]) return;
        const path = event.composedPath();
        if (picking && !path.includes(host)) {
            const target = floatingTarget(event);
            if (target && dockCompatibility(target)) { releasedPointer = null; event.stopImmediatePropagation(); return; }
        }
        const point = event.touches?.[0] || event;
        for (const binding of bindings.values()) {
            if (!binding.compatibility?.coordinates) continue;
            const rect = binding.element.getBoundingClientRect();
            if (rect.width && point.clientX >= rect.left && point.clientX <= rect.right && point.clientY >= rect.top && point.clientY <= rect.bottom) {
                suppressCoordinateStart(binding.element); scheduleAlign();
            }
        }
    };
    const pointerStarts = ['pointerdown', 'touchstart', 'mousedown'];
    for (const name of pointerStarts) window.addEventListener(name, onPointerStart, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('pointerup', onUp, true);
    document.addEventListener('pointercancel', cancelExternal, true);
    document.addEventListener('keydown', onKey);
    list.addEventListener('scroll', scheduleAlign, { passive: true });
    root.addEventListener('keydown', event => event.stopPropagation());
    const observer = new MutationObserver(records => {
        // Only missing/recreated selected nodes need lookup. Streaming changes
        // in the chat never require re-projecting every docked control.
        if (!items.length || items.every(item => bindings.get(item.key)?.element.isConnected)) return;
        if (!records.some(record => record.addedNodes.length || record.removedNodes.length)) return;
        clearTimeout(rebindTimer);
        rebindTimer = setTimeout(bindItems, 120);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', paint);
    window.visualViewport?.addEventListener('resize', paint);
    window.visualViewport?.addEventListener('scroll', paint);
    renderItems();
    return {
        manage: showManager,
        pick,
        reveal() { open = true; paint(); hub.focus({ preventScroll: true }); },
        destroy() {
            for (const name of pointerStarts) window.removeEventListener(name, onPointerStart, true);
            cleanupSync(); cleanupPress(); observer.disconnect();
            clearTimeout(rebindTimer); cancelAnimationFrame(layoutFrame);
            for (const key of Array.from(bindings.keys())) release(key);
            document.removeEventListener('click', onClick, true);
            document.removeEventListener('pointerdown', onDown, true);
            document.removeEventListener('pointerup', onUp, true);
            document.removeEventListener('pointercancel', cancelExternal, true);
            document.removeEventListener('keydown', onKey);
            window.removeEventListener('resize', paint);
            window.visualViewport?.removeEventListener('resize', paint);
            window.visualViewport?.removeEventListener('scroll', paint);
            host.remove();
        },
    };
}
