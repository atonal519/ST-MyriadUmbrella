// 主窗口按浏览器可视视口定位，手机安全区与外侧间距由CSS处理。
export function readPanelViewport(win = globalThis.window) {
  const visual = win.visualViewport;
  return { left: Number(visual?.offsetLeft) || 0, top: Number(visual?.offsetTop) || 0,
    width: Math.max(0, Number(visual?.width) || win.innerWidth), height: Math.max(0, Number(visual?.height) || win.innerHeight) };
}

export function isForeignWindow(event, panel) {
  const path = event.composedPath?.();
  if (path?.includes(panel)) return false;
  const host = panel.getRootNode?.().host;
  return path?.some(node => node?.matches?.('button,input,textarea,select,a[href],label,summary,[contenteditable]:not([contenteditable="false"]),[tabindex]:not([tabindex="-1"]),[role~="button"],[role~="link"],[role~="checkbox"],[role~="radio"],[role~="switch"],[role~="textbox"],dialog,[role~="dialog"],[role~="alertdialog"],[role~="menu"],[role~="listbox"],[role~="combobox"]')
    || ['true', 'menu', 'listbox', 'tree', 'grid', 'dialog'].includes(node?.getAttribute?.('aria-haspopup'))
    || typeof node?.popover === 'string' && node.matches?.(':popover-open')
    || node?.nodeType === 11 && node.host !== host
    && panel.ownerDocument?.defaultView?.getComputedStyle?.(node.host)?.position === 'fixed');
}

// down/up 两端均在外侧才关闭，拖选、滚动、取消的手势不转换成关闭。
export function bindOutsideClose({ target, panel, close, canClose = () => true, nativeDialog = false }) {
  let gesture = null;
  const outside = event => {
    if (nativeDialog) {
      if (event.target !== panel) return false;
      const rect = panel.getBoundingClientRect();
      return event.clientX < rect.left || event.clientX > rect.left + rect.width || event.clientY < rect.top || event.clientY > rect.top + rect.height;
    }
    const path = event.composedPath?.();
    const host = panel.getRootNode?.().host;
    const foreignWindow = path?.some(node => node !== panel && (node?.matches?.('dialog,[role~="dialog"],[role~="alertdialog"],[role~="menu"],[role~="listbox"],[role~="combobox"]')
      || typeof node?.popover === 'string' && node.matches?.(':popover-open'))
      || node?.nodeType === 11 && node.host !== host
      && panel.ownerDocument?.defaultView?.getComputedStyle?.(node.host)?.position === 'fixed');
    const inside = path?.includes(panel) ?? panel.contains(event.target);
    const rect = inside ? panel.getBoundingClientRect?.() : null;
    // Touch adjustment may target the panel even when the physical tap is in its margin.
    const outsidePoint = rect && (event.clientX < rect.left || event.clientX > rect.left + rect.width
      || event.clientY < rect.top || event.clientY > rect.top + rect.height);
    return !foreignWindow && (!inside || outsidePoint);
  };
  const down = event => {
    gesture = event.button === 0 && event.isPrimary !== false && outside(event) && canClose()
      ? { id: event.pointerId, x: event.clientX, y: event.clientY, up: false, moved: false } : null;
  };
  const move = event => {
    if (gesture?.id === event.pointerId && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 5) gesture.moved = true;
  };
  const up = event => {
    if (gesture?.id !== event.pointerId) { gesture = null; return; }
    move(event);
    gesture.up = outside(event);
  };
  const reset = () => { gesture = null; };
  const click = event => {
    const dismiss = gesture?.up && !gesture.moved && canClose();
    reset();
    if (dismiss) {
      // Only suppress a touch-adjusted click sent back into our own panel.
      if (nativeDialog || event.composedPath?.().includes(panel)) {
        event.preventDefault?.();
        event.stopImmediatePropagation?.();
      }
      close();
    }
  };
  const listeners = [['pointerdown', down], ['pointermove', move], ['pointerup', up], ['pointercancel', reset], ['click', click]];
  for (const [type, listener] of listeners) target.addEventListener(type, listener, true);
  return () => { reset(); for (const [type, listener] of listeners) target.removeEventListener(type, listener, true); };
}



// 窗口位置只属于当前 UI 实例；手机布局仍由 CSS 接管，不写入聊天或全局设置。
export function createHomeWindow(surface) {
  const win = surface.ownerDocument.defaultView;
  const host = surface.getRootNode().host;
  const desktop = win.matchMedia('(min-width: 641px)');
  let gesture = null;
  let preferredPosition = null;

  function place(left, top, { width, height }) {
    const view = readPanelViewport(win);
    const origin = host.getBoundingClientRect();
    surface.style.left = `${Math.max(view.left + 10, Math.min(left, view.left + view.width - width - 10)) - origin.left}px`;
    surface.style.top = `${Math.max(view.top + 10, Math.min(top, view.top + view.height - height - 10)) - origin.top}px`;
    surface.style.right = 'auto';
  }
  function stop() {
    if (!gesture) return;
    const id = gesture.id;
    gesture = null;
    surface.classList.remove('is-dragging');
    if (surface.hasPointerCapture(id)) surface.releasePointerCapture(id);
  }
  function down(event) {
    if (!desktop.matches || event.button !== 0 || event.isPrimary === false || gesture || !event.target.closest('.home-header')) return;
    const control = event.target.closest('label') || event.target.closest('button, input, textarea, select, a, [contenteditable]');
    if (control) {
      const rect = control.getBoundingClientRect();
      // 触屏可能把标题空白重定向到邻近输入，实际控件边框内仍由控件处理。
      if (event.pointerType !== 'touch' || (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom)) return;
    }
    const bounds = surface.getBoundingClientRect();
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height, moved: false };
    surface.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  }
  function move(event) {
    if (!gesture || event.pointerId !== gesture.id) return;
    if (event.pointerType === 'mouse' && event.buttons === 0) { stop(); return; }
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    if (!gesture.moved && Math.hypot(dx, dy) <= 5) return;
    gesture.moved = true;
    surface.classList.add('is-dragging');
    place(gesture.left + dx, gesture.top + dy, gesture);
  }
  function up(event) {
    if (event.pointerId !== gesture?.id) return;
    if (event.type === 'pointerup' && gesture.moved) {
      const rect = surface.getBoundingClientRect();
      preferredPosition = { left: rect.left, top: rect.top };
    }
    stop();
  }
  function refresh() {
    const view = readPanelViewport(win);
    Object.assign(host.style, { position: 'fixed', left: '0px', top: '0px', right: 'auto', bottom: 'auto', width: `${view.width}px`, height: `${view.height}px` });
    // 宿主 html 的 transform 会改变 fixed 原点，补偿后仍对齐可视视口。
    const origin = host.getBoundingClientRect();
    host.style.left = `${view.left - origin.left}px`;
    host.style.top = `${view.top - origin.top}px`;
    for (const property of ['width', 'height']) surface.style.setProperty(`--tt-window-${property}`, `${view[property]}px`);
    if (!desktop.matches) {
      for (const property of ['left', 'top', 'right', 'width', 'height']) surface.style.removeProperty(property);
      return;
    }
    const width = Math.max(0, Math.min(360, view.width - 20));
    const height = Math.max(0, Math.min(600, view.height - 20));
    surface.style.width = `${width}px`;
    surface.style.height = `${height}px`;
    place(preferredPosition?.left ?? view.left + view.width - width - 20, preferredPosition?.top ?? view.top + 70, { width, height });
  }
  const resize = () => { stop(); refresh(); };
  const listeners = [['pointerdown', down], ['pointermove', move], ['pointerup', up], ['pointercancel', up], ['lostpointercapture', up]];
  for (const [type, handler] of listeners) surface.addEventListener(type, handler);
  win.addEventListener('resize', resize);
  win.addEventListener('scroll', resize);
  win.addEventListener('orientationchange', resize);
  win.visualViewport?.addEventListener('resize', resize);
  win.visualViewport?.addEventListener('scroll', resize);
  refresh();
  return () => {
    stop();
    for (const [type, handler] of listeners) surface.removeEventListener(type, handler);
    win.removeEventListener('resize', resize);
    win.removeEventListener('scroll', resize);
    win.removeEventListener('orientationchange', resize);
    win.visualViewport?.removeEventListener('resize', resize);
    win.visualViewport?.removeEventListener('scroll', resize);
  };
}
