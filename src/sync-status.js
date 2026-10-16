// Adapted from wominIII/Sync-Monitor (MIT); see licenses/sync-monitor.txt.
const modifying = new Set(['POST', 'PUT', 'DELETE']);

export function installSyncStatus(onChange, target = globalThis) {
    const fetchRef = target.fetch;
    const proto = target.XMLHttpRequest.prototype;
    const openRef = proto.open;
    const listeners = new WeakMap();
    let active = true;
    let pending = 0;
    let timer = 0;
    let busy = false;
    onChange(false);

    function show(next) {
        if (!active || busy === next) return;
        busy = next;
        onChange(next);
    }
    function begin() {
        clearTimeout(timer); timer = 0;
        pending++;
        show(true);
        let finished = false;
        return () => {
            if (finished || !active) return;
            finished = true;
            if (--pending === 0) timer = setTimeout(() => { timer = 0; show(false); }, 500);
        };
    }
    function fetch(...args) {
        const method = String(args[1]?.method ?? args[0]?.method ?? 'GET').toUpperCase();
        if (!active || !modifying.has(method)) return Reflect.apply(fetchRef, this, args);
        const finish = begin();
        try {
            // Match Sync Monitor's boundary: fetch ends at response headers.
            return Reflect.apply(fetchRef, this, args).finally(finish);
        } catch (error) { finish(); throw error; }
    }
    function open(method, ...args) {
        const result = Reflect.apply(openRef, this, [method, ...args]);
        listeners.get(this)?.();
        if (!active || !modifying.has(String(method).toUpperCase())) return result;
        // XHR request events keep send() and its caller's stack untouched.
        let finish = null;
        const start = () => { if (active) finish = begin(); };
        const cleanup = () => {
            this.removeEventListener('loadstart', start);
            this.removeEventListener('loadend', end);
            listeners.delete(this);
        };
        const end = () => { finish?.(); cleanup(); };
        this.addEventListener('loadstart', start, { once: true });
        this.addEventListener('loadend', end, { once: true });
        listeners.set(this, cleanup);
        return result;
    }
    // Identify the transport relay as the global API in stack-based diagnostics.
    Object.defineProperty(fetch, 'name', { value: 'window.fetch' });
    target.fetch = fetch;
    proto.open = open;
    return () => {
        active = false; clearTimeout(timer); onChange = null;
        // Preserve wrappers installed later by other extensions. Any remaining
        // reference to our wrapper becomes a pass-through with no UI owner.
        if (target.fetch === fetch) target.fetch = fetchRef;
        if (proto.open === open) proto.open = openRef;
    };
}
