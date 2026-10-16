import { cardName, getGreetings, greetingCount, readCharacter } from './characters.js';
import { getHost } from './host.js';
import { readerCss } from './reader-style.js';

const batchSize = 24;

export function mountLibrary(root, scrollArea, header) {
    root.innerHTML = '<div class="library"><label class="search"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><input type="search" aria-label="搜索角色卡" placeholder="搜索角色卡"></label><div class="card-grid"></div><p class="library-message" role="status" hidden></p><button type="button" class="library-more" data-more hidden>显示更多</button></div><section class="reader" hidden></section>';
    const list = root.querySelector('.library');
    const grid = root.querySelector('.card-grid');
    const search = root.querySelector('input');
    const searchBox = root.querySelector('.search');
    header.append(searchBox);
    const more = root.querySelector('[data-more]');
    const message = root.querySelector('.library-message');
    const reader = root.querySelector('.reader');
    let matched = [];
    let shown = 0;
    let listScroll = 0;
    let greetings = [];
    let greetingIndex = 0;
    let converter = null;
    // Keep original images only on visible cards; the browser owns HTTP caching.
    const covers = new IntersectionObserver(entries => {
        for (const { target: image, isIntersecting } of entries) {
            if (!image.isConnected) continue;
            const source = isIntersecting && !list.hidden && !root.hidden ? image.dataset.original : image.dataset.thumbnail;
            if (image.getAttribute('src') !== source) image.src = source;
        }
    }, { root: scrollArea });

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
        list.hidden = false; scrollArea.scrollTop = listScroll;
    }

    async function openCard(avatar) {
        listScroll = scrollArea.scrollTop; list.hidden = true; reader.hidden = false;
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

    function appendBatch() {
        const fragment = document.createDocumentFragment();
        const end = Math.min(shown + batchSize, matched.length);
        const context = getHost();
        for (; shown < end; shown++) {
            const card = matched[shown];
            const button = document.createElement('button'); button.type = 'button'; button.className = 'card';
            const name = cardName(card); button.setAttribute('aria-label', `阅读 ${name} 的开场白`);
            const image = document.createElement('img'); image.className = 'card-cover';
            image.alt = name;
            image.dataset.thumbnail = context.getThumbnailUrl('avatar', card.avatar);
            image.dataset.original = `/characters/${encodeURIComponent(card.avatar)}`;
            image.src = image.dataset.thumbnail;
            covers.observe(image);
            const title = document.createElement('span'); title.className = 'card-title';
            const text = document.createElement('span'); text.className = 'card-name'; text.textContent = name;
            const icon = document.createElement('i'); icon.className = 'fa-solid fa-book-open'; icon.setAttribute('aria-hidden', 'true');
            title.append(text, icon);
            const count = document.createElement('span'); count.className = 'card-count';
            const total = greetingCount(card); count.textContent = total === null ? '查看开场白' : `${total} 则开场白`;
            button.append(image, title, count); button.addEventListener('click', () => openCard(card.avatar));
            fragment.append(button);
        }
        grid.append(fragment); more.hidden = shown >= matched.length;
    }

    function filter() {
        const query = search.value.trim().toLocaleLowerCase();
        // Retain loaded card references, never copies of their full payloads.
        matched = getHost().characters.filter(card => card.avatar && card.avatar !== 'none' && cardName(card).toLocaleLowerCase().includes(query));
        covers.disconnect(); shown = 0; grid.replaceChildren(); scrollArea.scrollTop = 0;
        message.hidden = matched.length > 0;
        message.textContent = query ? '没有找到这张角色卡。' : '卡库里还没有角色卡。';
        appendBatch();
    }
    search.addEventListener('input', filter); more.addEventListener('click', appendBatch); filter();
    return { refreshTheme, setVisible(visible) { header.hidden = !visible; }, destroy() { covers.disconnect(); matched = []; greetings = []; root.replaceChildren(); header.replaceChildren(); } };
}
