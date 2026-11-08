import { getHost } from './host.js';

export const NATIVE_DOCK_EVENT = Symbol('dock native drag');

const targets = [
    { selector: '#rlog-badge-host.rlog-badge-host.rlog-floating-button[script_id="recent-request-log-badge"][role="button"]', elementId: 'rlog-badge-host', nativeDrop: true, originalStyles: ['left', 'top', 'display'] },
    { selector: '#lachesis-ball-host .lx-ball', container: '#lachesis-ball-host', script: '拉刻西斯悬浮球', button: '拉刻西斯', coordinates: true },
    { selector: '#lx-player-host .lx-deck-launcher', container: '#lx-player-host', script: '拉刻西斯播放器', button: '播放器' },
    { selector: '.lx-cat-ball', nativeDrop: true },
];

const jmReader = { elementId: 'tw-jm-reader', nativeDrop: true };
const baiBaiImage = { elementId: 'bbi-app-host', selector: '.bbi-root[data-theme] > .bbi-orb[role="button"][aria-label="打开柏宝绘"]', nativeDrop: true, originalStyles: ['left', 'top', 'right', 'transform'] };

export function dockCompatibility(element) {
    const root = element.getRootNode?.();
    // Only the reader's original orb is collected; its full-screen host and panel stay put.
    if (element.id === 'orb' && root?.host?.id === jmReader.elementId && root.host.shadowRoot === root) return jmReader;
    if (root?.host?.id === baiBaiImage.elementId && root.host.shadowRoot === root && element.matches(baiBaiImage.selector)) return baiBaiImage;
    return targets.find(target => element.matches(target.selector));
}

export async function activateCompatibleTarget(element, compatibility) {
    if (compatibility === baiBaiImage) {
        const view = element.ownerDocument.defaultView;
        element.dispatchEvent(new view.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true, cancelable: true }));
        return;
    }
    if (!compatibility.button) { element.click(); return; }
    // Both scripts register the same panel action with Tavern Helper, including
    // the player whose button is not listed in its visible button settings.
    const frames = element.ownerDocument.querySelectorAll('iframe[id^="TH-script--"]');
    const frame = [...frames].find(frame => frame.contentWindow?.getScriptName?.() === compatibility.script);
    if (!frame) throw new Error('未找到这个球的脚本入口，请确认对应预设脚本已启用。');
    await getHost().eventSource.emit(frame.contentWindow.getButtonEvent(compatibility.button));
}

function nativePointer(element, pointer) {
    const view = element.ownerDocument.defaultView;
    return (type, x, y) => {
        const event = new view.PointerEvent(type, {
            bubbles: true, composed: true, view, pointerId: pointer.pointerId, pointerType: pointer.pointerType,
            clientX: x, clientY: y, button: 0, buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
        });
        event[NATIVE_DOCK_EVENT] = true;
        element.dispatchEvent(event);
    };
}

export function prepareCompatibleTarget(element, pointer) {
    // This orb opens on a stationary pointerup, including pointercancel.
    if (dockCompatibility(element) === baiBaiImage) return;
    const send = nativePointer(element, pointer);
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
    // A touch drag into the dock may leave the catalog's click-suppression flag
    // set. Its normal tap start/end clears that state without activating it.
    send('pointerdown', x, y);
    send('pointerup', x, y);
}

export function dropCompatibleTarget(element, point, pointer) {
    const send = nativePointer(element, pointer);
    if (dockCompatibility(element) === baiBaiImage) {
        // Its drag origin uses the untransformed layout position, even when
        // the resting bookmark is translated halfway past the screen edge.
        const x = element.offsetLeft + element.offsetWidth / 2;
        const y = element.offsetTop + element.offsetHeight / 2;
        send('pointerdown', x, y);
        send('pointermove', x + 7, y);
        send('pointermove', point.x, point.y);
        send('pointerup', point.x, point.y);
        return;
    }
    // The catalog paints its own position again on every pointerup. Let its
    // existing drag handler own the drop position and persistence as well.
    send('pointercancel', 0, 0);
    const rect = element.getBoundingClientRect();
    send('pointerdown', rect.left + rect.width / 2, rect.top + rect.height / 2);
    send('pointermove', point.x, point.y);
    send('pointerup', point.x, point.y);
}
