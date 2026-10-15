const styleId = 'st-tools-toast-style';

// Runtime themes nest toast rules under :root. Including the native .toast
// class lets these scoped appearance rules take precedence there as well.
export const toastCss = `
html[data-st-tools-toast] body #toast-container{position:fixed;top:calc(var(--topBarBlockSize,40px) + 8px)!important;bottom:auto!important;left:8px!important;right:8px!important;width:auto!important;max-width:none!important;min-width:0;margin:0!important;transform:none!important}
html[data-st-tools-toast] body #toast-container>.toast{box-sizing:border-box;background-image:none!important;opacity:1;color:var(--st-tools-ink,#eee)!important;background-color:var(--st-tools-surface,#171717)!important;border:1px solid color-mix(in srgb,var(--st-tools-ink,#eee) 16%,transparent)!important;border-top:2px solid var(--tt-status)!important;border-radius:5px!important;box-shadow:0 3px 12px rgba(0,0,0,.12)!important;padding:5px 30px 5px 10px!important;font:12px/1.4 var(--mainFontFamily,system-ui,sans-serif)!important;width:100%!important;min-width:0!important;max-width:100%!important;min-height:30px;overflow-wrap:anywhere;position:relative;--tt-status:#a7b8c4}
html[data-st-tools-toast] body #toast-container>div.toast-success{--tt-status:#9cbea7}html[data-st-tools-toast] body #toast-container>div.toast-warning{--tt-status:#d4b985}html[data-st-tools-toast] body #toast-container>div.toast-error{--tt-status:#d9948d}
html[data-st-tools-toast] body #toast-container :is(.toast-title,.toast-message){color:inherit!important}
html[data-st-tools-toast] #toast-container .toast-title{font-weight:500;margin:0 6px 0 0}html[data-st-tools-toast] #toast-container .toast-message{line-height:1.4}html[data-st-tools-toast] #toast-container :is(.toast-title,.toast-message):not([hidden]){display:inline}html[data-st-tools-toast] #toast-container .toast-close-button{position:absolute;color:inherit;opacity:.6;right:9px;top:7px;margin:0;float:none;font-size:16px;line-height:1;text-shadow:none}html[data-st-tools-toast] #toast-container .toast-progress{height:2px;background:var(--tt-status);opacity:.5}
html[data-st-tools-toast] #toast-container .toast-message :is(a,label),html[data-st-tools-toast] #toast-container>div small{color:inherit}
html[data-st-tools-toast] #toast-container .toast-message :is(button,.menu_button):not([hidden]){display:inline-flex;float:right;align-items:center;justify-content:center;max-width:100%;min-width:0;height:auto;margin:0 0 0 10px;padding:2px 8px;border:1px solid color-mix(in srgb,var(--st-tools-ink,#eee) 16%,transparent);border-radius:5px;background:color-mix(in srgb,var(--st-tools-ink,#eee) 7%,var(--st-tools-surface,#171717));color:inherit;font:inherit;line-height:1.2;white-space:normal;vertical-align:middle}
`;

export function applyToast(mode) {
    let style = document.getElementById(styleId);
    if (mode === 'off') {
        document.documentElement.removeAttribute('data-st-tools-toast');
        style?.remove();
        return;
    }
    if (!style) {
        style = document.createElement('style'); style.id = styleId; style.textContent = toastCss; document.head.append(style);
    }
    // Only appearance is owned here. Toastr still owns the same DOM nodes,
    // returned handles, timers and action buttons; no text or workflow parsing.
    document.documentElement.setAttribute('data-st-tools-toast', 'bar');
}
