import { getHost } from './host.js';

export function cardName(card) {
    return String(card.data?.name ?? card.name ?? '未命名角色');
}

export function getGreetings(card) {
    const first = card.data?.first_mes ?? card.first_mes;
    const alternate = card.data?.alternate_greetings ?? card.alternate_greetings ?? [];
    return [first, ...alternate].filter(text => typeof text === 'string' && text.trim());
}

export function greetingCount(card) {
    if (card.shallow) return null;
    const first = card.data?.first_mes ?? card.first_mes;
    const alternate = card.data?.alternate_greetings ?? card.alternate_greetings ?? [];
    return Number(typeof first === 'string' && !!first.trim()) + alternate.reduce((n, text) => n + Number(typeof text === 'string' && !!text.trim()), 0);
}

export async function readCharacter(avatar, context = getHost(), fetcher = globalThis.fetch) {
    const card = context.characters.find(item => item.avatar === avatar);
    if (!card) throw new Error('未找到这张角色卡，请重新打开卡库。');
    if (!card.shallow) return card;
    // Fetch only this card; host selection/unshallow helpers can update the
    // active character. Preview owns no character or chat fields.
    const response = await fetcher('/api/characters/get', {
        method: 'POST', headers: context.getRequestHeaders(), body: JSON.stringify({ avatar_url: avatar }),
    });
    if (!response.ok) throw new Error('读取角色卡失败，请返回卡库后重新打开。');
    const data = await response.json();
    if (!data || data.avatar !== avatar || data.error) throw new Error('未能读取角色卡内容，请返回卡库后重新打开。');
    return data;
}
