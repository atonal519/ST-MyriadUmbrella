import test from 'node:test';
import assert from 'node:assert/strict';

import { readFileSync } from 'node:fs';
import { createHomeWindow } from '../src/home-window.js';
import * as layout from '../src/home-window.js';
const rect = (left, top, width, height) => ({ left, top, width, height });

test('main window reads the complete visual viewport including offsets', () => {
  const win = { innerWidth: 1200, innerHeight: 900, visualViewport: { offsetLeft: 50, offsetTop: 80, width: 900, height: 700 } };
  assert.deepEqual(layout.readPanelViewport(win), rect(50, 80, 900, 700));
});

test('main window uses the browser viewport when visualViewport is unavailable', () => {
  assert.deepEqual(layout.readPanelViewport({ innerWidth: 390, innerHeight: 844 }), rect(0, 0, 390, 844));
});

class Target {
  listeners = new Map();
  addEventListener(type, handler) { this.listeners.set(type, handler); }
  removeEventListener(type) { this.listeners.delete(type); }
  emit(type, values = {}) { this.listeners.get(type)?.({ button: 0, pointerId: 1, clientX: 5, clientY: 5, target: this, composedPath: () => [this], ...values }); }
}

test('outside dismissal requires a plain complete outside click and respects child dialogs', () => {
  const target = new Target(), panel = {}, inside = { composedPath: () => [panel, target] };
  let closes = 0, child = false;
  const dispose = layout.bindOutsideClose({ target, panel, close: () => closes++, canClose: () => !child });
  const click = () => { target.emit('pointerdown'); target.emit('pointerup'); target.emit('click'); };
  click(); assert.equal(closes, 1);
  target.emit('pointerdown', inside); target.emit('pointerup'); target.emit('click'); assert.equal(closes, 1);
  target.emit('pointerdown'); target.emit('pointerup', inside); target.emit('click', inside); assert.equal(closes, 1);
  target.emit('pointerdown'); target.emit('pointermove', { clientY: 50 }); target.emit('pointerup'); target.emit('click'); assert.equal(closes, 1);
  target.emit('pointerdown'); target.emit('pointercancel'); target.emit('pointerup'); target.emit('click'); assert.equal(closes, 1);
  child = true; click(); assert.equal(closes, 1);
  child = false; click(); assert.equal(closes, 2);
  dispose(); assert.equal(target.listeners.size, 0);
});

test('native dialog backdrop uses coordinates so dialog padding remains internal', () => {
  const target = new Target(); target.getBoundingClientRect = () => rect(30, 40, 300, 500);
  let closes = 0;
  layout.bindOutsideClose({ target, panel: target, nativeDialog: true, close: () => closes++ });
  const click = (x, y) => { for (const type of ['pointerdown', 'pointerup', 'click']) target.emit(type, { clientX: x, clientY: y }); };
  click(35, 45); assert.equal(closes, 0);
  click(5, 5); assert.equal(closes, 1);
});


test('foreign fixed shadow window remains interactive while outside blank dismisses', () => {
  const target = new Target(), ownHost = {}, foreignHost = {}, foreignRoot = { nodeType: 11, host: foreignHost };
  const panel = { getRootNode: () => ({ host: ownHost }), ownerDocument: { defaultView: { getComputedStyle: () => ({ position: 'fixed' }) } } };
  let closes = 0; layout.bindOutsideClose({ target, panel, close: () => closes++ });
  for (const type of ['pointerdown', 'pointerup', 'click']) target.emit(type, { composedPath: () => [foreignRoot, foreignHost, target] });
  assert.equal(closes, 0);
  for (const type of ['pointerdown', 'pointerup', 'click']) target.emit(type);
  assert.equal(closes, 1);
});
function fixture(width = 1200, height = 900, withVisual = false) {
  const target = () => {
    const listeners = new Map();
    return { listeners, addEventListener: (type, handler) => listeners.set(type, handler), removeEventListener: type => listeners.delete(type), fire: (type, event = {}) => listeners.get(type)?.(event) };
  };
  const observed = [], resizeObservers = [], visual = target();
  let chat = { left: 400, top: 200, width: 400, height: 400 };
  const win = { ...target(), innerWidth: width, innerHeight: height,
    ResizeObserver: class { constructor(callback) { resizeObservers.push(callback); } observe(node) { observed.push(node); } disconnect() {} } };
  if (withVisual) win.visualViewport = Object.assign(visual, { offsetLeft: 0, offsetTop: 0, width, height });
  win.matchMedia = () => ({ get matches() { return win.innerWidth >= 641; } });
  const style = { setProperty(key, value) { this[key] = value; }, removeProperty(key) { delete this[key]; } };
  const host = { style: {}, getBoundingClientRect: () => ({ left: Number.parseFloat(host.style.left) || 0, top: Number.parseFloat(host.style.top) || 0 }) };
  const captures = new Set(), surface = { ...target(), ownerDocument: { defaultView: win, getElementById: id => id === 'chat' ? { getBoundingClientRect: () => chat } : null }, style,
    getRootNode: () => ({ host }), classList: { add() {}, remove() {} }, setPointerCapture: id => captures.add(id), hasPointerCapture: id => captures.has(id), releasePointerCapture: id => captures.delete(id),
    getBoundingClientRect: () => Object.fromEntries(['left', 'top', 'width', 'height'].map(key => [key, Number.parseFloat(style[key]) || 0])) };
  const controls = { dispose: createHomeWindow(surface), refresh: () => win.fire('resize'), stop: () => surface.fire('pointercancel', {pointerId:1}) };
  controls.refresh();
  return { surface, host, controls, style, win, visual, observed, resizeObservers, setChat: value => { chat = value; } };
}

test('desktop home defaults to 360×600 and ignores chat/input size changes', () => {
  const f = fixture(1200, 700);
  assert.deepEqual(f.surface.getBoundingClientRect(), { left: 820, top: 70, width: 360, height: 600 });
  f.setChat({ left: 500, top: 300, width: 100, height: 50 });
  for (const callback of f.resizeObservers) callback();
  f.controls.refresh();
  assert.deepEqual(f.surface.getBoundingClientRect(), { left: 820, top: 70, width: 360, height: 600 });
  assert.equal(f.observed.length, 0);
  f.controls.dispose();
  assert.equal(f.win.listeners.size, 0);
  assert.equal(f.surface.listeners.size, 0);
});

test('desktop home drags across all chat edges and restores its preferred position after a smaller viewport', () => {
  const f = fixture();
  const target = { closest: selector => selector === '.home-header' ? {} : null };
  for (const [x, y, left, top] of [[-2000, 0, 10, 70], [4000, 0, 830, 70], [0, -2000, 830, 10], [0, 4000, 830, 290]]) {
    f.surface.fire('pointerdown', { pointerId: 1, button: 0, clientX: 0, clientY: 0, target, preventDefault() {}, stopPropagation() {} });
    f.surface.fire('pointermove', { pointerId: 1, clientX: x, clientY: y });
    f.surface.fire('pointerup', { pointerId: 1, type: 'pointerup' });
    assert.deepEqual(f.surface.getBoundingClientRect(), { left, top, width: 360, height: 600 });
    f.controls.stop(); f.controls.refresh();
    assert.equal(f.style.left, `${left}px`); assert.equal(f.style.top, `${top}px`);
  }
  f.win.innerWidth = 700; f.win.innerHeight = 400; f.win.fire('resize');
  assert.deepEqual(f.surface.getBoundingClientRect(), { left: 330, top: 10, width: 360, height: 380 });
  f.win.innerWidth = 1200; f.win.innerHeight = 900; f.win.fire('resize');
  assert.deepEqual(f.surface.getBoundingClientRect(), { left: 830, top: 290, width: 360, height: 600 });
  f.controls.dispose();
});

test('390 and 320 mobile home bounds follow the visual viewport and use QQJ mobile safe-area margins', () => {
  const css = readFileSync(new URL('../src/home-style.js', import.meta.url), 'utf8');
  assert.match(css, /max\(40px,env\(safe-area-inset-top,0px\)\)/);
  assert.match(css, /max\(40px,env\(safe-area-inset-bottom,0px\)\)/);
  for (const width of [390, 320]) {
    const f = fixture(width, 844, true);
    assert.equal(f.style['--tt-window-width'], `${width}px`);
    assert.equal(f.style['--tt-window-height'], '844px');
    assert.equal(f.style.width, undefined);
    f.setChat({ left: 100, top: 300, width: 100, height: 50 });
    f.controls.refresh();
    assert.equal(f.style['--tt-window-height'], '844px');
    assert.equal(f.observed.length, 0);
    f.win.visualViewport = Object.assign(f.visual, { offsetLeft: 10, offsetTop: 30, width: width - 20, height: 420 });
    f.visual.fire('resize');
    assert.equal(f.host.style.top, '30px');
    assert.equal(f.style['--tt-window-height'], '420px');
    f.controls.dispose();
  }
});


test('native modal geometry follows the visible keyboard area and disposes listeners', async () => {
  const { bindDialogViewport } = await import('../src/ui.js');
  const events = () => { const listeners = new Map(); return { listeners, addEventListener(type, fn) { listeners.set(type, fn); }, removeEventListener(type) { listeners.delete(type); } }; };
  const visual = { ...events(), width: 360, height: 240, offsetLeft: 15, offsetTop: 80 };
  const win = { ...events(), innerWidth: 390, innerHeight: 844, visualViewport: visual };
  const dialog = { ownerDocument: { defaultView: win }, style: {} };
  const dispose = bindDialogViewport(dialog);
  assert.equal(dialog.style.left, '195px');
  assert.equal(dialog.style.top, '200px');
  assert.equal(dialog.style.width, '332px');
  assert.equal(dialog.style.maxHeight, '210px');
  visual.height = 190; visual.offsetTop = 120; visual.listeners.get('scroll')();
  assert.equal(dialog.style.top, '215px');
  assert.equal(dialog.style.maxHeight, '160px');
  dispose();
  assert.equal(visual.listeners.size, 0);
  assert.equal(win.listeners.size, 0);
});


test('touch drag preserves the complete search label and accepts adjusted header whitespace', () => {
  const f = fixture();
  const label = { getBoundingClientRect: () => ({ left: 100, right: 300, top: 100, bottom: 140 }) };
  const target = { closest: selector => selector === '.home-header' ? {} : label };
  const down = y => f.surface.fire('pointerdown', { pointerId: 1, button: 0, pointerType: 'touch', clientX: 150, clientY: y, target, preventDefault() {}, stopPropagation() {} });
  down(110);
  f.surface.fire('pointermove', { pointerId: 1, clientX: 200, clientY: 180 });
  assert.equal(f.style.left, '820px');
  down(90);
  f.surface.fire('pointermove', { pointerId: 1, clientX: 200, clientY: 180 });
  assert.equal(f.style.left, '830px');
  assert.equal(f.style.top, '160px');
  f.surface.fire('pointercancel', { pointerId: 1 });
  f.controls.dispose();
});


test('foreign standard dialogs and popup semantics retain clicks while fixed-body blank still dismisses', () => {
  const target = new Target(), panel = { contains: () => false };
  let closes = 0, blocked = 0;
  layout.bindOutsideClose({ target, panel, close: () => closes++ });
  const click = path => {
    for (const type of ['pointerdown', 'pointerup', 'click']) target.emit(type, { composedPath: () => path,
      preventDefault: () => blocked++, stopImmediatePropagation: () => blocked++ });
  };
  for (const selector of ['button', 'input', 'textarea', 'a[href]', 'label', 'summary', '[role~="button"]', '[tabindex]:not([tabindex="-1"])', 'dialog', 'select', 'input[list]', '[role~="dialog"]', '[role~="alertdialog"]', '[role~="menu"]', '[role~="listbox"]', '[role~="combobox"]', '[aria-haspopup]', '[popover]']) {
    const popup = selector === '[popover]' ? { popover: 'auto', matches: value => value === ':popover-open' }
      : selector === '[aria-haspopup]' ? { getAttribute: name => name === 'aria-haspopup' ? 'menu' : null }
        : { matches: selectors => selectors.split(',').map(value => value.trim()).includes(selector === 'input[list]' ? 'input' : selector) };
    click([{}, popup, target]);
    assert.equal(closes, 0, selector); assert.equal(blocked, 0, selector);
  }
  const fixedBody = { matches: () => false, style: { position: 'fixed' } };
  click([panel, fixedBody, target]); assert.equal(closes, 0, 'own panel remains internal');
  click([fixedBody, target]); assert.equal(closes, 1, 'ordinary fixed ancestors are not foreign popups');
});


test('home Escape belongs to its own window and leaves foreign dialogs and menus open', () => {
  const source = readFileSync(new URL('../src/home.js', import.meta.url), 'utf8');
  const start = source.indexOf('        const escape =');
  const end = source.indexOf("        root.addEventListener('keydown', escape)", start);
  const host = {}, panel = { getRootNode: () => ({ host }) };
  const doc = {}; let closes = 0;
  const escape = new Function('host', 'dialog', 'document', 'close', 'getComputedStyle', 'isForeignWindow',
    source.slice(start, end) + ';return escape;')(host, panel, doc, () => closes++, () => ({ position: 'fixed' }), layout.isForeignWindow);
  for (const selector of ['dialog', 'select', '[role~="menu"]', '[role~="listbox"]', '[role~="combobox"]']) {
    const popup = { matches: selectors => selectors.split(',').map(value => value.trim()).includes(selector === 'input[list]' ? 'input' : selector) };
    escape({ key: 'Escape', composedPath: () => [popup, doc], preventDefault() {} });
    assert.equal(closes, 0, selector);
  }
  escape({ key: 'Escape', composedPath: () => [panel, doc], preventDefault() {} });
  assert.equal(closes, 1, 'Escape in the home still closes it');
});
