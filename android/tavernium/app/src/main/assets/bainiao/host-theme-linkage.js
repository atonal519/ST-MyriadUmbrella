(function installThemeLinkage(report, generation, policy, entering) {
    if (window.__qjsThemeLinkage) {
        window.__qjsThemeLinkage.connect(report, generation, policy, entering);
        return;
    }
    let started = false, current, observed = null;
    const binding = value => value.dark ? value.darkTheme : value.lightTheme;
    function read() {
        return check();
    }
    function check() {
        const select = document.getElementById('themes');
        if (select !== observed) {
            observer.disconnect(); observed = select;
            if (select) observer.observe(select, {childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'value']});
        }
        const controlAvailable = Boolean(select && !select.disabled);
        const options = controlAvailable ? Array.from(select.options)
            .filter(option => option.value && !option.disabled)
            .map(option => ({value: option.value, label: option.textContent})) : [];
        const state = {ready: controlAvailable && options.length > 0, controlAvailable, options};
        if (!started && state.ready) { started = true; apply(state); report(); }
        return state;
    }
    function apply(state) {
        if (!state.ready || !current.enabled) return;
        const value = binding(current), select = document.getElementById('themes');
        if (!value || select.value === value || !state.options.some(option => option.value === value)) return;
        select.value = value;
        // The host owns the complete theme, custom CSS and its normal save.
        select.dispatchEvent(new Event('change', {bubbles: true}));
    }
    function update(next, force) {
        const changed = force || !current || !current.enabled || current.dark !== next.dark || binding(current) !== binding(next);
        current = {...next};
        const wasStarted = started, state = check();
        if (wasStarted && changed) apply(state);
    }
    const observer = new MutationObserver(check);
    window.__qjsThemeLinkage = {
        read, update,
        connect(nextReport, nextGeneration, nextPolicy, force) {
            const changed = generation !== nextGeneration;
            const wasStarted = started;
            report = nextReport; generation = nextGeneration;
            update(nextPolicy, force);
            if (wasStarted && changed) report();
        },
    };
    document.addEventListener('DOMContentLoaded', check, {once: true});
    update(policy, entering);
})
