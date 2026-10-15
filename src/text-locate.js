// Adapted from the installed 手机三击pc双击编辑 v1.1 (绾绾 / Sommer):
// normalize formatting for comparison, but keep source offsets for the write.
function projection(source) {
    const positions = [];
    let text = '';
    const excluded = /<!--[\s\S]*?-->|<[^>]*>|\s+|[`*~_]/g;
    let cursor = 0;
    const append = end => {
        for (; cursor < end; cursor++) {
            text += source[cursor];
            positions.push(cursor);
        }
    };
    for (const match of source.matchAll(excluded)) {
        append(match.index);
        cursor = match.index + match[0].length;
    }
    append(source.length);
    return { text, positions };
}

function occurrences(source, needle) {
    const found = [];
    if (!needle) return found;
    let index = source.indexOf(needle);
    while (index !== -1) {
        found.push(index);
        index = source.indexOf(needle, index + 1);
    }
    return found;
}

export function locateText(raw, text, { visibleText, beforeText } = {}) {
    const selected = text.trim();
    if (!selected) return null;
    const source = projection(raw);
    const needle = projection(selected).text;
    const matches = occurrences(source.text, needle);
    let index = matches.length === 1 ? matches[0] : -1;
    // Hidden source sections and appended UI may change the rest of a message.
    // Match this fragment's actual occurrence at the clicked DOM position;
    // changed occurrence counts cannot identify a safe replacement.
    if (typeof visibleText === 'string') {
        const visibleMatches = occurrences(projection(visibleText).text, needle);
        if (visibleMatches.length !== matches.length) return null;
        if (typeof beforeText === 'string') {
            const ordinal = visibleMatches.indexOf(projection(beforeText).text.length);
            index = ordinal < 0 ? -1 : matches[ordinal];
        }
    } else if (matches.length > 1 && typeof beforeText === 'string') {
        const offset = projection(beforeText).text.length;
        if (matches.includes(offset)) index = offset;
    }
    if (index < 0) return null;
    const direct = occurrences(raw, selected);
    if (direct.length === 1 && matches.length === 1) return { start: direct[0], end: direct[0] + selected.length, text: selected };
    const start = source.positions[index];
    const end = source.positions[index + needle.length - 1] + 1;
    return { start, end, text: raw.slice(start, end) };
}

export function replaceSpan(raw, span, replacement) {
    return raw.slice(0, span.start) + replacement + raw.slice(span.end);
}
