import { BALL_SIZE, DOCK_Z_INDEX, SLOT_SIZE } from './dock-geometry.js';
import { dockCompatibility } from './dock-compat.js';

// The old zmer dock's stable ID/script/class fingerprint is retained; controls
// remain in their original document so document-level plugin handlers still work.
const excluded = '#top-bar,#top-settings-holder,#send_form,#form_sheld,#rightNavHolder,#leftNavHolder,#st-tools-dock,.popup,dialog';
const actions = 'button,[role="button"],.menu_button,.interactable';
const clean = value => String(value || '').replace(/\s+/g, ' ').trim();

export function fingerprint(element) {
    const compatibility = dockCompatibility(element);
    if (compatibility) return { elementId: compatibility.elementId || '', scriptId: '', classSelector: compatibility.selector || '', title: clean(element.getAttribute('title') || element.getAttribute('aria-label')) };
    const classes = Array.from(element.classList || []).filter(token => !/^(active|open|hover|focus|dragging|ui-)/i.test(token)).slice(0, 4);
    return {
        elementId: element.id || '',
        scriptId: element.getAttribute('script_id') || element.closest('[script_id]')?.getAttribute('script_id') || '',
        classSelector: classes.map(value => `.${CSS.escape(value)}`).join(''),
        title: clean(element.getAttribute('title') || element.getAttribute('aria-label')),
    };
}

export function targetKey(value) {
    return value.elementId ? `id:${value.elementId}` : `${value.scriptId}|${value.classSelector}|${value.title}`;
}

export function actionTarget(element) {
    const shadowButton = element.shadowRoot?.querySelector(actions);
    if (shadowButton) return shadowButton;
    if (element.matches(actions)) return element;
    return element.querySelector(actions) || element;
}

export function findTarget(value, documentRef = document) {
    if (value.elementId === 'tw-jm-reader') return documentRef.getElementById(value.elementId)?.shadowRoot?.getElementById('orb') || null;
    if (value.elementId === 'bbi-app-host') return documentRef.getElementById(value.elementId)?.shadowRoot?.querySelector('.bbi-root[data-theme] > .bbi-orb[role="button"][aria-label="打开柏宝绘"]') || null;
    if (value.elementId) return documentRef.getElementById(value.elementId);
    const selector = value.scriptId
        ? `[script_id="${CSS.escape(value.scriptId)}"]${value.classSelector || ''}`
        : value.classSelector;
    if (!selector) return null;
    const matches = Array.from(documentRef.querySelectorAll(selector)).filter(element => !value.title || clean(element.getAttribute('title') || element.getAttribute('aria-label')) === value.title);
    return matches.length === 1 ? matches[0] : null;
}

export function floatingTarget(event) {
    const path = event.composedPath();
    if (path.some(element => element?.id?.startsWith('st-tools-'))) return null;
    for (const element of path) {
        if (!(element instanceof Element) || element.closest(excluded)) continue;
        if (dockCompatibility(element)?.elementId) return element;
        // A shadow visual is not addressable by the document fingerprint.
        // Own its outer floating host, which also retains the plugin handlers.
        if (element.getRootNode() !== document) continue;
        const style = getComputedStyle(element);
        if (style.position !== 'fixed' && style.position !== 'absolute') continue;
        const rect = element.getBoundingClientRect();
        if (rect.width < 14 || rect.height < 14 || rect.width > 140 || rect.height > 140) continue;
        const value = fingerprint(element);
        if (value.elementId || value.scriptId || value.classSelector) return element;
    }
    return null;
}

const owned = ['position', 'left', 'top', 'right', 'bottom', 'z-index', 'transform', 'transform-origin', 'scale', 'clip-path', 'opacity', 'visibility', 'pointer-events', 'transition'];


function collectAppearance(element, control, compatibility) {
    const ink = 'var(--st-tools-ink,var(--SmartThemeBodyColor,currentColor))';
    const border = `${SLOT_SIZE / BALL_SIZE}px solid color-mix(in srgb,${ink} 48%,transparent)`;
    const iconSize = 18 * SLOT_SIZE / BALL_SIZE;
    const hostBox = `width:${SLOT_SIZE}px!important;height:${SLOT_SIZE}px!important;box-sizing:border-box!important;`;
    const frame = `${hostBox}padding:0!important;border:${border}!important;border-radius:50%!important;background:transparent!important;box-shadow:none!important;transform:none!important;`;
    const center = 'display:grid!important;place-items:center!important;';
    const iconBox = `width:${iconSize}px!important;height:${iconSize}px!important;display:block!important;margin:0!important;`;
    let root = null;
    let rules = '';
    if (compatibility?.elementId === 'bbi-app-host') {
        root = element.getRootNode();
        rules = `
            .bbi-root[data-theme] > .bbi-orb{${frame}${center}filter:none!important;overflow:hidden!important;color:${ink}!important}
            .bbi-root[data-theme] > .bbi-orb > .bbi-orb-icon{${iconBox}}
            .bbi-root[data-theme] > .bbi-orb > .bbi-orb-img{${iconBox}object-fit:contain!important}
        `;
    } else if (compatibility?.elementId === 'rlog-badge-host') {
        root = element.shadowRoot;
        rules = `
            :host{${hostBox}}
            .rlog-badge-visual{${center}color:${ink}!important}
            .rlog-badge-visual::before{${frame}}
            .rlog-badge-visual > i{${iconBox}${center}font-size:${iconSize}px!important;line-height:1!important}
        `;
    } else if (['tmt-fab-host', 'tmt-card-fab-host', 'qqj-fab-host'].includes(element.id) && element.shadowRoot?.querySelector('button[aria-busy]') === control) {
        root = element.shadowRoot;
        rules = `
            :host{${hostBox}}
            button[aria-busy]{${frame}${center}}
            button[aria-busy]:not([aria-busy="true"]):not(.busy){color:${ink}!important}
            button[aria-busy] > svg{${iconBox}}
        `;
    } else if (element.id === 'sp-fab' && (element.shadowRoot?.querySelector('.sp-fab-btn') === control || control.matches('#sp-fab > .sp-fab-btn'))) {
        root = element.shadowRoot || element.ownerDocument.head;
        const host = element.shadowRoot ? ':host' : '#sp-fab';
        const button = element.shadowRoot ? '.sp-fab-btn' : '#sp-fab > .sp-fab-btn';
        // The native Shadow button resets inherited pointer-events with all:initial.
        // While collected, the slot must own both the visual and its icon's hit area.
        rules = `
            ${host}{${hostBox}}
            ${button}{${frame}${center}}
            ${button},${button} *{pointer-events:none!important}
            ${button}:not(.sp-fab-busy):not(.sp-btn-generating):not(.sp-btn-done):not([aria-busy="true"]){color:${ink}!important}
            ${button} > svg.sp-pen-icon{${iconBox}}
        `;
    }
    if (!root) return null;
    const style = element.ownerDocument.createElement('style');
    style.textContent = rules;
    root.append(style);
    return style;
}

export function holdTarget(element) {
    const rect = element.getBoundingClientRect();
    const prior = new Map(owned.map(key => [key, { value: element.style.getPropertyValue(key), priority: element.style.getPropertyPriority(key) }]));
    const control = actionTarget(element);
    const innerOpacity = control !== element ? { element: control, value: control.style.getPropertyValue('opacity'), priority: control.style.getPropertyPriority('opacity') } : null;
    const compatibility = dockCompatibility(element);
    const container = compatibility?.container && element.closest(compatibility.container);
    const containerZ = container ? { element: container, value: container.style.getPropertyValue('z-index'), priority: container.style.getPropertyPriority('z-index') } : null;
    if (compatibility) prior.set('display', { value: element.style.getPropertyValue('display'), priority: element.style.getPropertyPriority('display') });
    if (container) set(container, 'z-index', String(DOCK_Z_INDEX + 1));
    const collectedStyle = collectAppearance(element, control, compatibility);
    return { element, control, prior, innerOpacity, compatibility, containerZ, collectedStyle, width: collectedStyle ? SLOT_SIZE : Math.max(1, rect.width), height: collectedStyle ? SLOT_SIZE : Math.max(1, rect.height) };
}

function set(element, key, value) {
    if (element.style.getPropertyValue(key) !== value || element.style.getPropertyPriority(key) !== 'important') element.style.setProperty(key, value, 'important');
}

function restore(element, key, old) {
    if (old.value) {
        if (element.style.getPropertyValue(key) !== old.value || element.style.getPropertyPriority(key) !== old.priority) element.style.setProperty(key, old.value, old.priority);
    } else if (element.style.getPropertyValue(key)) element.style.removeProperty(key);
}

export function suppressCoordinateStart(element) {
    // Restore through the dock's next alignment. Microtasks can run between
    // event listeners, before the preset's document listener checks geometry.
    set(element, 'display', 'none');
}

export function placeTarget(binding, rect, show) {
    const { element, width, height } = binding;
    if (binding.compatibility) {
        if (show) restore(element, 'display', binding.prior.get('display'));
        else set(element, 'display', 'none');
    }
    // Normalize the original control to a filled circle, then inset that whole
    // appearance so its border and glyph keep the same proportions.
    const fill = Math.max(1, rect.width / width, rect.height / height);
    const scale = fill * BALL_SIZE / SLOT_SIZE;
    const pixel = value => `${Math.round(value * 100) / 100}px`;
    const values = {
        position: 'fixed', left: pixel(rect.left + (rect.width - width * scale) / 2), top: pixel(rect.top + (rect.height - height * scale) / 2),
        // Render above the opaque rail; pointer-events:none still lets the
        // transparent slot underneath own the full click and drag area.
        right: 'auto', bottom: 'auto', 'z-index': String(DOCK_Z_INDEX + 1), transform: 'none', 'transform-origin': '0px 0px', scale: String(Math.round(scale * 10000) / 10000),
        'clip-path': `circle(${pixel(Math.min(rect.width, rect.height) / (2 * fill))} at 50% 50%)`,
        opacity: show ? '1' : '0', visibility: show ? 'visible' : 'hidden', 'pointer-events': 'none', transition: 'opacity 180ms ease',
    };
    for (const [key, value] of Object.entries(values)) set(element, key, value);
    // A shadow control can dim itself independently of its floating host.
    // Keep one opacity owner while collected, restoring its original rule on release.
    if (binding.innerOpacity) set(binding.innerOpacity.element, 'opacity', '1');
}

export function releaseTarget(binding, point) {
    binding.collectedStyle?.remove();
    for (const [key, old] of binding.prior) {
        restore(binding.element, key, old);
    }
    if (binding.containerZ) restore(binding.containerZ.element, 'z-index', binding.containerZ);
    if (binding.innerOpacity) {
        const { element, value, priority } = binding.innerOpacity;
        if (value) element.style.setProperty('opacity', value, priority);
        else element.style.removeProperty('opacity');
    }
    if (point) {
        const element = binding.element;
        for (const [key, value] of Object.entries({ position: 'fixed', left: '0px', top: '0px', right: 'auto', bottom: 'auto' })) set(element, key, value);
        // Preserve the original transform/scale while placing its visible
        // center at the drop point, including transformed containing blocks.
        const rect = element.getBoundingClientRect();
        const view = element.ownerDocument.defaultView;
        const x = Math.max(0, Math.min(view.innerWidth - rect.width, point.x - rect.width / 2));
        const y = Math.max(0, Math.min(view.innerHeight - rect.height, point.y - rect.height / 2));
        set(element, 'left', `${x - rect.left}px`);
        set(element, 'top', `${y - rect.top}px`);
    }
}
