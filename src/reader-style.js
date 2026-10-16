// Base typography has zero specificity so authored card styles stay in charge.
export const readerCss = `
    :where(html){font-size:14px;line-height:1.95}
    :where(body){margin:0;padding:7px 10px 28px;letter-spacing:.015em;text-align:justify;overflow-wrap:anywhere;line-break:strict}
    :where(body>p){margin:0 0 1.15em;line-height:inherit;text-indent:0}
    :where(blockquote){margin:1.2em 0;padding:.1em 0 .1em 1em;border-left:2px solid var(--reader-accent);color:var(--reader-muted);text-align:start}
    :where(blockquote p){margin:.4em 0;text-indent:0}
    :where(h1,h2,h3,h4){margin:1.6em 0 .7em;font-weight:600;line-height:1.5;text-indent:0;letter-spacing:.025em}
    :where(h1){font-size:1.4em}:where(h2){font-size:1.25em}:where(h3,h4){font-size:1.12em}
    :where(hr){margin:1.7em auto;width:42px;border:0;border-top:1px solid var(--reader-accent);opacity:.5}
    :where(ul,ol){padding-inline-start:1.5em;text-align:start}:where(li){margin:.45em 0;text-indent:0}
    :where(a){color:inherit;text-decoration-color:var(--reader-accent);text-underline-offset:.2em}
    :where(strong){font-weight:600}:where(code){font-size:.9em;letter-spacing:0;text-indent:0}
    :where(pre){overflow:auto;white-space:pre-wrap;padding:.8em;background:color-mix(in srgb,currentColor 4%,transparent);border-radius:4px;text-align:start;text-indent:0}
    :where(table){border-collapse:collapse;width:100%;font-size:.9em;text-align:start}
    :where(th,td){padding:.4em .6em;border-bottom:1px solid color-mix(in srgb,currentColor 12%,transparent)}
    :where(img,video){max-width:100%;height:auto}
    *{box-sizing:border-box;scrollbar-width:thin}
`;
