const clamp = (value, low, high) => Math.max(low, Math.min(Math.max(low, high), value));

export const BALL_SIZE = 32;
export const HUB_SIZE = BALL_SIZE;
export const SLOT_SIZE = 36;
export const SLOT_GAP = 4;
export const SLOT_STEP = SLOT_SIZE + SLOT_GAP;
export const RAIL_PADDING = 5;
export const EDGE_REVEAL = 14;
export const DOCK_Z_INDEX = 2140000001;

export function settleDock(point, width, height) {
    const edge = point.x < 26 ? 'left' : point.x + HUB_SIZE > width - 26 ? 'right' : '';
    return { x: clamp(point.x, 0, width - HUB_SIZE), y: clamp(point.y, 6, height - HUB_SIZE - 6), edge };
}

export function layoutDock({ width, height, x, y, edge = '', open = false, count = 0 }) {
    const visibleCount = Math.min(count, Math.max(1, Math.floor((height - HUB_SIZE - 28) / SLOT_STEP)));
    const listHeight = count ? visibleCount * SLOT_STEP - SLOT_GAP : 0;
    const columnHeight = HUB_SIZE + (open && count ? listHeight + SLOT_GAP : 0);
    let left = clamp(x, 6, width - HUB_SIZE - 6);
    if (edge === 'left') left = open ? RAIL_PADDING : EDGE_REVEAL - HUB_SIZE;
    if (edge === 'right') left = open ? width - HUB_SIZE - RAIL_PADDING : width - EDGE_REVEAL;
    const top = clamp(y, 6, height - columnHeight - 6);
    const hub = { x: left, y: top, size: HUB_SIZE };
    const slots = open ? Array.from({ length: count }, (_, index) => ({ x: left + (HUB_SIZE - SLOT_SIZE) / 2, y: top + HUB_SIZE + SLOT_GAP + index * SLOT_STEP, size: SLOT_SIZE })) : [];
    return { hub, slots, listHeight, columnHeight, visibleCount };
}
