(function installThemeBars(report, generation) {
    if (window.__qjsThemeBars) { window.__qjsThemeBars(report, generation); return; }
    let last = '', queued = false, bodyObserved = null, headObserved = null;
    function color(value) {
        if (!value || value.length > 128) return '';
        if (/^(currentcolor|inherit|initial|unset|revert(-layer)?)$|var\(/i.test(value.trim())) return '';
        const probe = document.createElement('span');
        probe.style.color = value.trim();
        if (!probe.style.color) return '';
        probe.hidden = true;
        document.documentElement.appendChild(probe);
        const resolved = getComputedStyle(probe).color;
        probe.remove();
        const match = resolved.match(/^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/);
        if (!match) return '';
        const bytes = [Number(match[1]), Number(match[2]), Number(match[3]), match[4] === undefined ? 255 : Math.round(Number(match[4]) * 255)];
        if (bytes.some(n => !Number.isFinite(n) || n < 0 || n > 255) || bytes[3] === 0) return '';
        return bytes.map(Math.round).join(',');
    }
    function refresh() {
        queued = false;
        if (!document.documentElement) return;
        observeReadyNodes();
        const root = getComputedStyle(document.documentElement), body = document.body && getComputedStyle(document.body);
        const meta = document.querySelector('meta[name="theme-color"]');
        // body may resolve to the same translucent tint: choose once, never stack the two.
        const tint = color(root.getPropertyValue('--SmartThemeBlurTintColor'))
            || color(meta && meta.content) || color(body && body.backgroundColor);
        const text = color(root.getPropertyValue('--SmartThemeBodyColor')) || color(body && body.color);
        const key = tint + '|' + text;
        if (key !== last) { last = key; report(tint, text); }
    }
    function queue() { if (!queued) { queued = true; setTimeout(refresh, 0); } }
    const observer = new MutationObserver(queue);
    if (document.documentElement) observer.observe(document.documentElement, {attributes: true, attributeFilter: ['style', 'class']});
    function observeReadyNodes() {
        if (document.body && bodyObserved !== document.body) {
            bodyObserved = document.body;
            observer.observe(bodyObserved, {attributes: true, attributeFilter: ['style', 'class']});
        }
        if (document.head && headObserved !== document.head) {
            headObserved = document.head;
            observer.observe(headObserved, {childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['content', 'href', 'media', 'disabled']});
        }
    }
    document.addEventListener('DOMContentLoaded', queue);
    document.addEventListener('load', event => {
        if (event.target && (event.target.tagName === 'LINK' || event.target.tagName === 'STYLE')) queue();
    }, true);
    window.__qjsThemeBars = function(nextReport, nextGeneration) {
        report = nextReport;
        if (generation !== nextGeneration) { generation = nextGeneration; last = ''; }
        queue();
    };
    queue();
})
