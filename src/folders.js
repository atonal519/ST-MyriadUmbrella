import { readConfig, writeConfig } from './config.js';

export function groupLibraryCards(cards, folders) {
    const groups = folders.map(folder => ({ id: folder.id, name: folder.name, cards: [] }));
    const unfiled = { id: '', name: '未分类', cards: [] };
    const owners = new Map();
    folders.forEach((folder, index) => { for (const avatar of folder.avatars) owners.set(avatar, groups[index]); });
    for (const card of cards) (owners.get(card.avatar) || unfiled).cards.push(card);
    if (unfiled.cards.length || !groups.length) groups.push(unfiled);
    return groups;
}

export function saveLibraryFolder(name, id) {
    name = name.trim();
    if (!name) throw new Error('请填写文件夹名称。');
    const folders = readConfig().libraryFolders || [];
    if (folders.some(folder => folder.name === name && folder.id !== id)) throw new Error('已有同名文件夹，请换个名称。');
    if (id) writeConfig({ libraryFolders: folders.map(folder => folder.id === id ? { ...folder, name } : folder) });
    else writeConfig({ libraryFolders: [...folders, { id: crypto.randomUUID(), name, avatars: [] }] });
}

export function moveLibraryCards(avatars, targetId) {
    const folders = readConfig().libraryFolders || [];
    if (targetId && !folders.some(folder => folder.id === targetId)) throw new Error('请先选择目标文件夹。');
    const selected = new Set(avatars);
    writeConfig({ libraryFolders: folders.map(folder => ({
        ...folder,
        avatars: folder.id === targetId
            ? [...folder.avatars.filter(avatar => !selected.has(avatar)), ...selected]
            : folder.avatars.filter(avatar => !selected.has(avatar)),
    })) });
}

export function deleteLibraryFolder(id) {
    writeConfig({ libraryFolders: (readConfig().libraryFolders || []).filter(folder => folder.id !== id) });
}
