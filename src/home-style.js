export const homeCss = `
    :host{--tt-surface:var(--st-home-surface,#faf9f6);--tt-ink:var(--st-home-ink,#282927);--tt-border:color-mix(in srgb,var(--tt-ink) 15%,var(--tt-surface));--tt-muted:color-mix(in srgb,var(--tt-ink) 58%,var(--tt-surface));font:13px/1.5 var(--mainFontFamily,system-ui,sans-serif);color:var(--tt-ink)}
    .home{inset:0;width:min(360px,calc(100dvw - 40px));height:min(600px,85dvh);max-width:none;max-height:none;margin:auto;padding:0;border:1px solid var(--tt-border);border-radius:14px;overflow:hidden;background:var(--tt-surface);color:var(--tt-ink)}
    .shell{height:100%;display:flex;flex-direction:column;background:var(--tt-surface)}
    .home-header{display:flex;align-items:center;justify-content:space-between;flex:0 0 auto;padding:12px 14px 8px;gap:8px}
    .home-search{flex:1;min-width:0}.home-header>.icon-button{margin-left:auto}.home-search .search{margin:0}.home-search .reader-back{min-height:36px}
    .icon-button{display:inline-grid;place-items:center;flex:0 0 auto;width:32px;height:32px;padding:0;border:0;border-radius:5px;background:transparent;color:var(--tt-ink)}
    .icon-button i{font-size:18px;pointer-events:none}
    .home-body{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;scrollbar-width:thin}
    .home-view{min-width:0;min-height:100%;padding:6px 14px 16px}
    .home-view:has(>.reader:not([hidden])){height:100%}
    .home-tabs{display:flex;flex:0 0 auto;padding:4px 12px 6px;border-top:1px solid var(--tt-border);background:var(--tt-surface)}
    .home-tab{position:relative;display:grid;justify-items:center;gap:2px;flex:1;min-height:42px;padding:3px 8px 6px;border:0;border-radius:0;background:transparent;color:var(--tt-muted);font-size:12px}
    .home-tab i{font-size:17px}.home-tab[aria-selected=true]{color:var(--tt-ink);font-weight:650}
    .home-tab:hover{background:transparent}
    .home-tab[aria-selected=true]::after{content:'';position:absolute;bottom:0;width:28px;height:2px;background:var(--tt-ink);border-radius:2px}
    .search{display:flex;align-items:center;gap:8px;margin:0 0 14px;padding:0 10px;min-height:34px;border-radius:5px;background:color-mix(in srgb,var(--tt-ink) 6%,var(--tt-surface));color:var(--tt-muted)}
    .search input{width:100%;min-width:0;padding:6px 0;border:0;outline:none;background:transparent;color:var(--tt-ink);font-size:16px;line-height:1.4}
    .search:focus-within{outline:1px solid var(--tt-border)}.search input:focus-visible{outline:none}.search input::placeholder{color:var(--tt-muted)}
    .card-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 12px}
    .card{display:block;min-width:0;width:100%;padding:0;border:0;border-radius:6px;background:transparent;text-align:left;color:var(--tt-ink)}
    .card:hover{background:transparent}.card:hover .card-name{text-decoration:underline;text-underline-offset:3px}
    .card-cover{display:block;width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:6px;background:color-mix(in srgb,var(--tt-ink) 5%,var(--tt-surface))}
    .card-title{display:flex;align-items:baseline;gap:5px;padding:6px 1px 0}.card-name{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:500}
    .card-title i{color:var(--tt-muted);font-size:11px}.card-count{display:block;padding:2px 1px 0;color:var(--tt-muted);font-size:11px}
    .library-more{display:block;margin:22px auto 0;padding:7px 20px;border-radius:5px;background:transparent;font-size:12px}
    .library-message{padding:40px 6px;color:var(--tt-muted);font-size:13px;text-align:center}
    .reader{display:flex;flex-direction:column;gap:10px;min-height:100%;height:100%}
    .reader-toolbar{display:flex;align-items:center;gap:8px}.reader-back{display:flex;align-items:center;gap:7px;padding:4px 0;border:0;background:transparent;font-size:13px}
    .reader-heading{display:flex;align-items:center;gap:12px}.reader-cover{display:block;width:56px;max-height:78px;object-fit:contain;border-radius:5px}.reader-heading h2{margin:0;font-size:16px;font-weight:550;overflow-wrap:anywhere}
    .greeting-controls{display:flex;align-items:center;justify-content:space-between;gap:12px;border-top:1px solid var(--tt-border);padding-top:12px;font-size:12px;color:var(--tt-muted)}
    .greeting-controls .row{gap:3px}.greeting-controls .icon-button{width:32px;height:32px}.greeting-controls i{font-size:14px}
    .greeting-frame{display:block;flex:1;width:100%;min-height:240px;border:0;background:var(--tt-surface);color-scheme:normal}
    .toolbox{padding-top:8px;font-size:13px}.toolbox .feature{margin:0;padding:0;border:0;border-bottom:1px solid var(--tt-border)}.toolbox .feature:last-child{border-bottom:0}
    .toolbox summary,.toolbox .feature-switch{display:flex;align-items:center;gap:9px;min-height:42px;margin:0;padding:9px 2px;list-style:none;cursor:pointer;font-size:13px;line-height:24px}
    .toolbox summary::-webkit-details-marker{display:none}.toolbox summary>i{flex:0 0 12px;color:var(--tt-muted);font-size:10px;transition:transform .15s}.toolbox details[open]>summary>i{transform:rotate(90deg)}
    .toolbox summary>span,.toolbox .feature-switch>span{flex:1;min-width:0}.toolbox .feature-switch{padding-left:23px}.toolbox .feature-body{display:flex;align-items:center;flex-wrap:wrap;gap:7px;padding:0 2px 12px 23px}.toolbox .row{gap:7px;margin:0}.toolbox button,.toolbox select{padding:5px 9px;border:1px solid var(--tt-border);border-radius:5px;background:var(--tt-surface);font-size:12px;color:var(--tt-ink);line-height:1.5}
    .toolbox select{max-width:100%}.toolbox input[type=checkbox]{width:15px;height:15px;margin:0;accent-color:var(--tt-ink)}
    .toolbox .error{color:var(--tt-ink);font-size:12px}
    @media(max-width:640px){.home{top:calc(20px + env(safe-area-inset-top,0px));bottom:auto;width:calc(100dvw - 20px);height:calc(100dvh - 40px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));margin:0 auto}}
`;
