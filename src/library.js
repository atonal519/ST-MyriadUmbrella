import { cardName, getGreetings, greetingCount, readCharacter } from './characters.js';
import { getHost } from './host.js';
import { readerCss } from './reader-style.js';
import { albumLayouts, months } from './album-layout.js';
import { albumDecoration } from './album-decoration.js';
import { readConfig, writeConfig } from './config.js';

export function mountLibrary(root, scrollArea, header, controls) {
    root.innerHTML = `<div class="library"><label class="search"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><input type="search" aria-label="搜索角色卡" placeholder="搜索角色卡"></label><div class="album-viewport"><div class="album-decoration" aria-hidden="true">${albumDecoration}</div><div class="album-pages" aria-label="角色卡相册"></div></div><p class="library-message" role="status" hidden></p><nav class="album-pager" aria-label="卡库翻页"><button type="button" data-previous aria-label="上一页">↑</button><output aria-live="polite"></output><button type="button" data-next aria-label="下一页">↓</button></nav></div><section class="reader" hidden></section>`;
    const list = root.querySelector('.library');
    const viewport = root.querySelector('.album-viewport');
    const pages = root.querySelector('.album-pages');
    const search = root.querySelector('input');
    const searchBox = root.querySelector('.search');
    header.append(searchBox);
    const pager = root.querySelector('.album-pager');
    const previous = pager.querySelector('[data-previous]');
    const next = pager.querySelector('[data-next]');
    const counter = pager.querySelector('output');
    const message = root.querySelector('.library-message');
    const reader = root.querySelector('.reader');
    let matched = [];
    let { charLayout: mode } = readConfig();
    let grid = null;
    let shown = 0;
    let pageIndex = 0;
    let pageCount = 0;
    let listScroll = 0;
    let greetings = [];
    let greetingIndex = 0;
    let converter = null;
    const more = document.createElement('button'); more.type = 'button'; more.className = 'library-more'; more.textContent = '显示更多';
    controls.innerHTML = '<button type="button" class="layout-switch" aria-expanded="false" aria-controls="tt-layout-options">切换</button><div class="layout-options" id="tt-layout-options" role="group" aria-label="排版方式" hidden><button type="button" data-layout="grid" aria-pressed="true">普通两列</button><button type="button" data-layout="stack" aria-pressed="false">堆叠</button><button type="button" data-layout="columns" aria-pressed="false">错列</button></div>';
    const switcher = controls.querySelector('.layout-switch');
    const options = controls.querySelector('.layout-options');
    const shadow = root.getRootNode();

    // Use host thumbnails for original cards outside the viewport; the browser owns HTTP caching.
    const covers = new IntersectionObserver(entries => {
        for (const { target: image, isIntersecting } of entries) {
            if (!image.isConnected) continue;
            showCover(image, isIntersecting && !list.hidden && !root.hidden);
        }
    }, { root: pages });
    // Page shells preserve native vertical scrolling. Only visible sheets own
    // image nodes; offscreen sheets hold no copied card payloads or image cache.
    const sheets = new IntersectionObserver(entries => {
        for (const entry of entries) {
            if (!entry.target.isConnected) continue;
            if (entry.isIntersecting && entry.intersectionRatio > 0) fillPage(entry.target);
            else {
                for (const image of entry.target.querySelectorAll('.card-cover')) covers.unobserve(image);
                entry.target.replaceChildren();
            }
        }
    }, { root: pages, threshold: .001 });

    function showCover(image, visible) {
        image.dataset.coverVisible = String(visible);
        const source = visible ? image.dataset.original : image.dataset.thumbnail;
        if (image.getAttribute('src') !== source) image.src = source;
    }

    function setCoverSource(image, context) {
        image.dataset.thumbnail = context.getThumbnailUrl('avatar', image.dataset.avatar);
        image.dataset.original = `/characters/${encodeURIComponent(image.dataset.avatar)}`;
        image.src = image.dataset.thumbnail;
        covers.observe(image);
    }

    function createCard(card, context, plain = false) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'card';
        const name = cardName(card); button.setAttribute('aria-label', `阅读 ${name} 的开场白`); button.title = name;
        const image = document.createElement('img'); image.className = 'card-cover'; image.alt = name;
        image.dataset.avatar = card.avatar; setCoverSource(image, context); button.append(image);
        if (plain) {
            const title = document.createElement('span'); title.className = 'card-title';
            const text = document.createElement('span'); text.className = 'card-name'; text.textContent = name;
            const icon = document.createElement('i'); icon.className = 'fa-solid fa-book-open'; icon.setAttribute('aria-hidden', 'true');
            title.append(text, icon); button.append(title);
            const total = greetingCount(card);
            if (total !== null) {
                const count = document.createElement('span'); count.className = 'card-count'; count.textContent = `${total} 则开场白`; button.append(count);
            }
        }
        button.addEventListener('click', () => openCard(card.avatar));
        return button;
    }

    function appendBatch() {
        const end = Math.min(shown + 24, matched.length);
        const context = getHost();
        const fragment = document.createDocumentFragment();
        for (; shown < end; shown++) fragment.append(createCard(matched[shown], context, true));
        grid.append(fragment); more.hidden = shown >= matched.length;
    }

    function refreshTheme() {
        const style = reader.querySelector('iframe')?.contentDocument?.getElementById('reader-theme');
        if (!style) return;
        const colors = getComputedStyle(root);
        const surface = colors.getPropertyValue('--tt-surface');
        const accent = colors.getPropertyValue('--SmartThemeQuoteColor').trim() || colors.color;
        style.textContent = `html{color:${colors.color};background:${surface};font-family:${colors.fontFamily};--reader-accent:${accent};--reader-muted:color-mix(in srgb,${colors.color} 76%,${surface})}` + readerCss;
    }

    function renderGreeting() {
        reader.querySelector('iframe')?.remove();
        reader.querySelector('[data-counter]').textContent = greetings.length ? `开场白 ${greetingIndex + 1} / ${greetings.length}` : '暂无开场白';
        reader.querySelector('[data-prev]').disabled = greetingIndex === 0;
        reader.querySelector('[data-next]').disabled = greetingIndex >= greetings.length - 1;
        if (!greetings.length) return;
        converter ||= new globalThis.showdown.Converter({ tables: true, strikethrough: true, simpleLineBreaks: true });
        const html = globalThis.DOMPurify.sanitize(converter.makeHtml(greetings[greetingIndex]), {
            ADD_TAGS: ['style'], FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'base', 'meta', 'link'],
        });
        const doc = document.implementation.createHTMLDocument('开场白');
        const style = doc.createElement('style');
        style.id = 'reader-theme'; doc.head.append(style);
        doc.body.innerHTML = html;
        const frame = document.createElement('iframe');
        frame.className = 'greeting-frame'; frame.title = '开场白';
        // Card CSS stays in this document. Palette access is allowed, scripts
        // are disabled, and no host macro or message-render hooks run.
        frame.setAttribute('sandbox', 'allow-same-origin');
        frame.srcdoc = '<!doctype html>' + doc.documentElement.outerHTML;
        frame.addEventListener('load', refreshTheme, { once: true });
        reader.append(frame);
    }

    function back() {
        reader.hidden = true; reader.replaceChildren(); greetings = [];
        header.replaceChildren(searchBox); searchBox.hidden = false;
        list.hidden = false; controls.hidden = false; pages.scrollTop = listScroll;
    }

    async function openCard(avatar) {
        listScroll = pages.scrollTop; list.hidden = true; controls.hidden = true; reader.hidden = false;
        closeOptions();
        reader.innerHTML = '<div class="reader-toolbar"><button type="button" class="reader-back" aria-label="返回卡库"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i>返回卡库</button></div><p role="status">正在读取开场白…</p>';
        const backButton = reader.querySelector('.reader-back');
        backButton.addEventListener('click', back);
        header.replaceChildren(backButton); reader.querySelector('.reader-toolbar').remove();
        scrollArea.scrollTop = 0;
        const status = reader.querySelector('[role=status]');
        try {
            const card = await readCharacter(avatar);
            if (!status.isConnected) return;
            greetings = getGreetings(card); greetingIndex = 0;
            const heading = document.createElement('div'); heading.className = 'reader-heading';
            const image = document.createElement('img'); image.className = 'reader-cover';
            image.src = `/characters/${encodeURIComponent(avatar)}`; image.alt = cardName(card);
            const title = document.createElement('h2'); title.textContent = cardName(card);
            heading.append(image, title); reader.append(heading);
            const controls = document.createElement('div'); controls.className = 'greeting-controls';
            controls.innerHTML = '<span data-counter></span><div class="row"><button type="button" class="icon-button" data-prev aria-label="上一则开场白"><i class="fa-solid fa-chevron-left" aria-hidden="true"></i></button><button type="button" class="icon-button" data-next aria-label="下一则开场白"><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button></div>';
            controls.querySelector('[data-prev]').addEventListener('click', () => { greetingIndex--; renderGreeting(); });
            controls.querySelector('[data-next]').addEventListener('click', () => { greetingIndex++; renderGreeting(); });
            reader.append(controls); renderGreeting(); status.remove();
        } catch (error) {
            if (!status.isConnected) return;
            console.warn('[千机伞] 读取或显示开场白失败', error);
            status.textContent = '读取或显示开场白失败，请返回卡库后重新打开。';
        }
    }

    function fillPage(page) {
        if (page.firstChild) return;
        const layout = albumLayouts[mode];
        const start = Number(page.dataset.page) * layout.slots.length;
        const count = Math.min(layout.slots.length, matched.length - start);
        let offsetX = 0, offsetY = 0;
        if (mode === 'stack') {
            // Center the actual image group, including short final pages.
            const slots = layout.slots.slice(0, count);
            offsetX = (layout.width - Math.min(...slots.map(([left]) => left)) - Math.max(...slots.map(([left, , width]) => left + width))) / 2;
            offsetY = (layout.height - Math.min(...slots.map(([, top]) => top)) - Math.max(...slots.map(([, top, , height]) => top + height))) / 2;
        }
        const sheet = document.createElement('div'); sheet.className = 'album-sheet';
        sheet.style.setProperty('--album-ratio', String(layout.width / layout.height));
        if (mode === 'columns') {
            const month = document.createElement('h2'); month.className = 'album-month';
            month.textContent = months[Number(page.dataset.page) % months.length]; sheet.append(month);
            if (count > 7) { const stripe = document.createElement('span'); stripe.className = 'album-stripe'; stripe.setAttribute('aria-hidden', 'true'); sheet.append(stripe); }
        }
        const context = getHost();
        for (let index = 0; index < count; index++) {
            const card = matched[start + index];
            const button = createCard(card, context);
            const [left, top, width, height] = layout.slots[index];
            for (const [key, value] of Object.entries({ left: (left + offsetX) / layout.width, top: (top + offsetY) / layout.height, width: width / layout.width, height: height / layout.height })) button.style.setProperty(`--card-${key}`, `${value * 100}%`);
            sheet.append(button);
        }
        if (mode === 'stack') {
            for (const [slot, left, top] of [[1, 23, 37], [0, 104, 19], [5, 93, 134]]) {
                if (count <= slot) continue;
                const square = document.createElement('span'); square.className = 'album-square'; square.setAttribute('aria-hidden', 'true');
                square.style.left = `${(left + offsetX) / layout.width * 100}%`; square.style.top = `${(top + offsetY) / layout.height * 100}%`; sheet.append(square);
            }
        }
        page.append(sheet);
    }

    function updatePager() {
        counter.textContent = pageCount ? `${pageIndex + 1} / ${pageCount}` : '';
        previous.disabled = pageIndex === 0; next.disabled = pageIndex >= pageCount - 1;
    }

    function renderPages() {
        sheets.disconnect(); covers.disconnect(); pages.replaceChildren(); grid = null;
        pageIndex = 0; pageCount = mode === 'grid' ? 0 : Math.ceil(matched.length / albumLayouts[mode].slots.length);
        pages.dataset.layout = mode;
        if (mode === 'grid') {
            grid = document.createElement('div'); grid.className = 'card-grid'; shown = 0;
            pages.append(grid, more); appendBatch();
        }
        const fragment = document.createDocumentFragment();
        for (let index = 0; index < pageCount; index++) {
            const page = document.createElement('section'); page.className = 'album-page'; page.dataset.page = String(index);
            page.setAttribute('aria-label', `第 ${index + 1} 页`); fragment.append(page); sheets.observe(page);
        }
        pages.append(fragment); pages.scrollTop = 0;
        viewport.hidden = !matched.length; pages.hidden = !matched.length; pager.hidden = mode === 'grid' || !pageCount;
        updatePager();
    }

    function closeOptions() { options.hidden = true; switcher.setAttribute('aria-expanded', 'false'); }
    switcher.addEventListener('click', () => { options.hidden = !options.hidden; switcher.setAttribute('aria-expanded', String(!options.hidden)); });
    for (const option of options.querySelectorAll('[data-layout]')) option.addEventListener('click', () => {
        if (mode !== option.dataset.layout) { mode = option.dataset.layout; writeConfig({ charLayout: mode }); renderPages(); }
        for (const item of options.querySelectorAll('[data-layout]')) item.setAttribute('aria-pressed', String(item === option));
        closeOptions(); switcher.focus({ preventScroll: true });
    });
    for (const item of options.querySelectorAll('[data-layout]')) item.setAttribute('aria-pressed', String(item.dataset.layout === mode));
    function outside(event) { if (!controls.contains(event.target)) closeOptions(); }
    function escape(event) { if (event.key === 'Escape' && !options.hidden) { event.preventDefault(); event.stopPropagation(); closeOptions(); switcher.focus({ preventScroll: true }); } }
    shadow.addEventListener('click', outside); shadow.addEventListener('keydown', escape);
    pages.addEventListener('scroll', () => {
        if (mode === 'grid' || !pages.clientHeight) return;
        const index = Math.min(pageCount - 1, Math.round(pages.scrollTop / pages.clientHeight));
        if (index !== pageIndex) { pageIndex = index; updatePager(); }
    }, { passive: true });
    for (const [button, direction] of [[previous, -1], [next, 1]]) button.addEventListener('click', () => {
        const behavior = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
        pages.scrollTo({ top: (pageIndex + direction) * pages.clientHeight, behavior });
    });

    function filter() {
        const query = search.value.trim().toLocaleLowerCase();
        // Retain loaded card references, never copies of their full payloads.
        matched = getHost().characters.filter(card => card.avatar && card.avatar !== 'none' && cardName(card).toLocaleLowerCase().includes(query));
        message.hidden = matched.length > 0;
        message.textContent = query ? '没有找到这张角色卡。' : '卡库里还没有角色卡。';
        renderPages();
    }
    search.addEventListener('input', filter); more.addEventListener('click', appendBatch); filter();
    return {
        refreshTheme,
        setVisible(visible) { header.hidden = !visible; controls.hidden = !visible || !reader.hidden; closeOptions(); if (visible && reader.hidden && mode !== 'grid') pages.scrollTop = pageIndex * pages.clientHeight; },
        destroy() { sheets.disconnect(); covers.disconnect(); shadow.removeEventListener('click', outside); shadow.removeEventListener('keydown', escape); matched = []; greetings = []; pages.replaceChildren(); grid = null; root.replaceChildren(); header.replaceChildren(); controls.replaceChildren(); },
    };
}
