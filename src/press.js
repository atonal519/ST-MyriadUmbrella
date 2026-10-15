export function bindPressActions(button, { click, hold }) {
    let gesture = null;
    let timer;
    let held = false;
    let cancelled = false;
    const cancel = () => { clearTimeout(timer); gesture = null; };
    const down = event => {
        if (button.disabled || event.button !== 0) return;
        cancel();
        held = false;
        cancelled = false;
        gesture = { x: event.clientX, y: event.clientY, id: event.pointerId };
        button.setPointerCapture?.(event.pointerId);
        timer = setTimeout(() => {
            held = true;
            gesture = null;
            hold();
        }, 500);
    };
    const move = event => {
        if (gesture && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 10) { cancelled = true; cancel(); }
    };
    const activate = event => {
        if (held || (cancelled && event.detail !== 0)) { held = false; cancelled = false; event.preventDefault(); return; }
        if (!button.disabled) click();
    };
    const contextMenu = event => event.preventDefault();
    const interrupt = () => { if (gesture) cancelled = true; cancel(); };
    const listeners = { pointerdown: down, pointermove: move, pointerup: cancel, pointercancel: interrupt, lostpointercapture: interrupt, click: activate, contextmenu: contextMenu };
    for (const [name, handler] of Object.entries(listeners)) button.addEventListener(name, handler);
    return () => {
        cancel();
        for (const [name, handler] of Object.entries(listeners)) button.removeEventListener(name, handler);
    };
}
