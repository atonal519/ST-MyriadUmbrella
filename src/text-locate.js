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

function renderedOccurrence(raw, source, matches, needle, ordinal, visibleCount, renderText) {
    if (!matches.length || ordinal < 0 || typeof renderText !== 'function') return -1;
    // Trace candidates through the host's renderer once. Markers
    // inside hidden sections disappear with them; raw offsets stay authoritative.
    const token = '\uE000' + Math.random().toString(36).slice(2);
    const boundaries = matches.flatMap((index, id) => [
        { offset: source.positions[index], marker: `${token}:${id}:s\uE001` },
        { offset: source.positions[index + needle.length - 1] + 1, marker: `${token}:${id}:e\uE001` },
    ]).sort((a, b) => a.offset - b.offset);
    const parts = [];
    let cursor = 0;
    for (const boundary of boundaries) {
        parts.push(raw.slice(cursor, boundary.offset), boundary.marker);
        cursor = boundary.offset;
    }
    parts.push(raw.slice(cursor));
    const rendered = projection(renderText(parts.join(''))).text;
    const traced = matches.map(() => ({ s: [], e: [] }));
    let clean = '';
    cursor = 0;
    for (const marker of rendered.matchAll(new RegExp(`${token}:(\\d+):([se])\uE001`, 'g'))) {
        clean += rendered.slice(cursor, marker.index);
        traced[Number(marker[1])][marker[2]].push(clean.length);
        cursor = marker.index + marker[0].length;
    }
    clean += rendered.slice(cursor);
    const renderedMatches = occurrences(clean, needle);
    if (renderedMatches.length !== visibleCount) return -1;
    const offset = renderedMatches[ordinal];
    const candidates = matches.filter((index, id) => {
        const { s, e } = traced[id];
        return s.length === 1 && e.length === 1 && s[0] === offset && e[0] === offset + needle.length;
    });
    return candidates.length === 1 ? candidates[0] : -1;
}

export function locateText(raw, text, { visibleText, beforeText, renderText } = {}) {
    const selected = text.trim();
    if (!selected) return null;
    const source = projection(raw);
    const needle = projection(selected).text;
    const matches = occurrences(source.text, needle);
    let index = matches.length === 1 ? matches[0] : -1;
    // Use the clicked DOM occurrence. When hidden source changes the count,
    // ask the host which raw candidate actually survives its rendering rules.
    if (typeof visibleText === 'string') {
        const visibleMatches = occurrences(projection(visibleText).text, needle);
        const ordinal = typeof beforeText === 'string' ? visibleMatches.indexOf(projection(beforeText).text.length) : -1;
        if (visibleMatches.length !== matches.length) {
            index = renderedOccurrence(raw, source, matches, needle, ordinal, visibleMatches.length, renderText);
        } else if (typeof beforeText === 'string') {
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
