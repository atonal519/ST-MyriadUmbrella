import { getHost } from './host.js';

export async function loadCharacterListHost() {
    const [main, tags, groups, welcome] = await Promise.all([
        import('/script.js'), import('/scripts/tags.js'),
        import('/scripts/group-chats.js'), import('/scripts/welcome-screen.js'),
    ]);
    return {
        entities: () => main.getEntitiesList({ doFilter: true }),
        refresh: () => main.printCharacters(false),
        bindRows: () => main.characterGroupOverlay.onPageLoad(),
        row(entity) {
            if (entity.type === 'group') return groups.getGroupBlock(entity.item)[0];
            if (entity.type === 'tag') return tags.getTagBlock(entity.item, entity.entities, entity.hidden, entity.isUseless)[0];
            const card = entity.item;
            const ctx = getHost();
            // Native classes and data-chid keep delegated selection, tags and
            // bulk actions on the host's existing routes, including off-page cards.
            const row = document.querySelector('#character_template .character_select').cloneNode(true);
            row.id = `CharID${entity.id}`; row.dataset.chid = String(entity.id);
            const name = main.getCharacterName?.(card) ?? card.name;
            const favorite = main.isCharacterFavorite ? main.isCharacterFavorite(card) : card.fav === true || card.fav === 'true';
            const setText = (selector, value, hideEmpty = false) => {
                const element = row.querySelector(selector);
                element.textContent = value || '';
                if (hideEmpty && !value) element.style.display = 'none';
            };
            setText('.ch_name', name); row.querySelector('.ch_name').title = `[Character] ${name}`;
            row.querySelector('.avatar').title = `[Character] ${name}\nFile: ${card.avatar}`;
            const image = row.querySelector('img'); image.alt = name;
            image.src = card.avatar === 'none' ? '/' + main.default_avatar : ctx.getThumbnailUrl('avatar', card.avatar);
            setText('.ch_avatar_url', ctx.powerUserSettings.show_card_avatar_urls ? card.avatar : '');
            setText('.ch_description', main.getCharacterCreatorNotes?.(card) ?? card.data?.creator_notes, true);
            setText('.character_version', card.data?.[ctx.powerUserSettings.aux_field || 'character_version'], true);
            row.classList.toggle('is_fav', favorite);
            row.querySelector('.ch_fav').value = String(favorite);
            row.querySelector('.ch_fav_icon').style.display = 'none';
            if (card.avatar !== welcome.getPermanentAssistantAvatar()) row.querySelector('.ch_assistant')?.remove();
            tags.printTagList(globalThis.$(row.querySelector('.tags')), { forEntityOrKey: entity.id, tagOptions: { isCharacterList: true } });
            return row;
        },
    };
}
