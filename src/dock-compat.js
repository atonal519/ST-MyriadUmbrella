import { getHost } from './host.js';

export const NATIVE_DOCK_EVENT = Symbol('dock native drag');

const targets = [
    { selector: '#lachesis-ball-host .lx-ball', container: '#lachesis-ball-host', script: '拉刻西斯悬浮球', button: '拉刻西斯', coordinates: true },
    { selector: '#lx-player-host .lx-deck-launcher', container: '#lx-player-host', script: '拉刻西斯播放器', button: '播放器' },
    { selector: '.lx-cat-ball', nativeDrop: true },
];

export function dockCompatibility(element) {
    return targets.find(target => element.matches(target.selector));
}

export async function activateCompatibleTarget(element, compatibility) {
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
    // The catalog paints its own position again on every pointerup. Let its
    // existing drag handler own the drop position and persistence as well.
    send('pointercancel', 0, 0);
    const rect = element.getBoundingClientRect();
    send('pointerdown', rect.left + rect.width / 2, rect.top + rect.height / 2);
    send('pointermove', point.x, point.y);
    send('pointerup', point.x, point.y);
}
