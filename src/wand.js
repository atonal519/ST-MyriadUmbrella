export const umbrellaIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.333333" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 18 0q-4.5-4-9 0q-4.5-4-9 0Z"/><path d="M12 12v6a3 3 0 0 1-6 0"/></svg>';

export function installWandEntry(open) {
    const parent = document.getElementById('sp_wand_container') || document.getElementById('extensionsMenu');
    if (!parent) return () => {};
    const entry = document.createElement('div');
    entry.id = 'st-tools-open-wand'; entry.className = 'list-group-item flex-container flexGap5';
    entry.style.cssText = 'display:flex;flex-direction:row;flex-wrap:nowrap;align-items:center;white-space:nowrap';
    entry.setAttribute('role', 'button'); entry.tabIndex = 0;
    entry.innerHTML = `<span class="extensionsMenuExtensionButton" style="width:20px;height:20px;flex:0 0 20px">${umbrellaIcon}</span><span>千机伞</span>`;
    entry.querySelector('svg').style.cssText = 'width:18px;height:18px;display:block';
    entry.addEventListener('click', open);
    entry.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); }
    });
    parent.append(entry);
    return () => entry.remove();
}
