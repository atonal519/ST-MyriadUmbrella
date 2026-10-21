export const albumCss = `
    #char-view{height:100%;min-height:0;padding:0}
    #char-view>.reader{padding:6px 14px 16px}
    .library{height:100%;min-height:0;display:flex;flex-direction:column}
    .album-viewport{position:relative;flex:1;min-height:0;isolation:isolate}
    .album-decoration{position:absolute;inset:0;z-index:0;overflow:hidden;pointer-events:none;color:var(--tt-ink);background:linear-gradient(145deg,color-mix(in srgb,var(--tt-ink) 3%,transparent),transparent 45% 72%,color-mix(in srgb,var(--tt-ink) 4.5%,transparent))}
    .album-decoration-svg{display:block;width:100%;height:100%;pointer-events:none}
    .album-pages{position:relative;z-index:1;height:100%;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;touch-action:pan-y;scroll-snap-type:y mandatory;scrollbar-width:thin}
    .album-pages[data-layout=grid]{padding:6px 14px 16px;scroll-snap-type:none}
    .card-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 12px}
    .card-grid .card{display:block;min-width:0;width:100%;padding:0;border:0;border-radius:6px;background:transparent;text-align:left;color:var(--tt-ink)}
    .card-grid .card:hover{background:transparent}.card-grid .card:hover .card-name{text-decoration:underline;text-underline-offset:3px}
    .card-grid .card-cover{display:block;width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:6px;background:color-mix(in srgb,var(--tt-ink) 5%,var(--tt-surface))}
    .card-title{display:flex;align-items:baseline;gap:5px;padding:6px 1px 0}.card-name{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:500}
    .card-title i{color:var(--tt-muted);font-size:11px}.card-count{display:block;padding:2px 1px 0;color:var(--tt-muted);font-size:11px}
    .card-grid .card-title,.card-grid .card-count{background:var(--tt-surface)}
    .library-more{display:block;margin:22px auto 0;padding:7px 20px;border-radius:5px;background:transparent;font-size:12px}
    .album-page{height:100%;min-height:100%;padding:2px 4px;display:grid;place-items:center;scroll-snap-align:start;scroll-snap-stop:always;container-type:size}
    .album-sheet{position:relative;width:min(100cqw,calc(100cqh * var(--album-ratio)));aspect-ratio:var(--album-ratio);max-width:100%;max-height:100%;container-type:inline-size;background:transparent}
    .album-sheet .card{position:absolute;left:var(--card-left);top:var(--card-top);width:var(--card-width);height:var(--card-height);padding:0;border:0;border-radius:0;background:transparent}
    .album-sheet .card-cover{display:block;width:100%;height:100%;aspect-ratio:auto;object-fit:cover;border-radius:0}
    .album-sheet .card:focus-visible{z-index:2;outline:2px solid var(--tt-ink);outline-offset:2px}
    .album-month{position:absolute;left:10%;top:3%;width:80%;margin:0;text-align:center;font-family:'TT Month Brush',cursive;font-size:15cqw;font-weight:400;line-height:1.15;letter-spacing:-.04em;transform:rotate(-4deg);color:var(--tt-ink)}
    .album-stripe{position:absolute;left:0;top:78.06%;width:36.36%;height:3.96%;background:var(--tt-muted)}
    .album-square{position:absolute;width:6%;aspect-ratio:1;background:var(--tt-muted);pointer-events:none}
    .album-pager{display:flex;align-items:center;justify-content:center;gap:12px;flex:none;min-height:34px;padding:2px 10px 4px;color:var(--tt-muted)}
    .album-pager button{width:32px;height:28px;padding:0;border:0;border-radius:5px;background:transparent;font-size:18px}
    .album-pager output{min-width:44px;text-align:center;font:11px/1.5 ui-monospace,monospace}
    .home-layout{position:relative;flex:none}
    .layout-switch{min-height:32px;padding:4px 7px;border:0;border-radius:5px;background:transparent;font-size:12px;color:var(--tt-muted)}
    .layout-options{position:absolute;right:0;top:calc(100% + 5px);z-index:5;display:grid;min-width:112px;padding:4px;border:1px solid var(--tt-border);border-radius:7px;background:var(--tt-surface);box-shadow:0 3px 12px #00000018}
    .layout-options button{min-height:32px;padding:5px 12px;border:0;border-radius:4px;text-align:left;background:transparent;font-size:13px}
    .layout-options button[aria-pressed=true]{color:var(--tt-ink);background:color-mix(in srgb,var(--tt-ink) 8%,var(--tt-surface));font-weight:600}
`;
