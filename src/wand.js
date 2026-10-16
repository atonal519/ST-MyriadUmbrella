import { icons } from './ui.js';

export const umbrellaIcon = icons.umbrella;

export function installWandEntry(open) {
    const parent = document.getElementById('sp_wand_container') || document.getElementById('extensionsMenu');
    if (!parent) return () => {};
    const entry = document.createElement('div');
    entry.id = 'st-tools-open-wand'; entry.className = 'list-group-item flex-container flexGap5';
    entry.style.cssText = 'display:flex;flex-direction:row;flex-wrap:nowrap;align-items:center;white-space:nowrap';
    entry.setAttribute('role', 'button'); entry.tabIndex = 0;
    entry.innerHTML = `<span class="extensionsMenuExtensionButton">${umbrellaIcon}</span><span>千机伞</span>`;
    entry.addEventListener('click', open);
    entry.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); }
    });
    parent.append(entry);
    return () => entry.remove();
}
