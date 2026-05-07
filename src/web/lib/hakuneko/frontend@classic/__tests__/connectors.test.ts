import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../connectors.js';

describe('hakuneko-connectors', () => {
    let el: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        (window as any).Engine.Connectors = [
            { id: 'manga-site', label: 'Manga Site', tags: ['manga'], url: 'https://manga.test' },
            { id: 'anime-site', label: 'Anime Site', tags: ['anime'], url: 'https://anime.test' },
            { id: 'comic-site', label: 'Comic Hub', tags: ['manga', 'webtoon'], url: 'https://comic.test' },
        ];

        el = document.createElement('hakuneko-connectors');
        document.body.appendChild(el);
        await el.updateComplete;
    });

    afterEach(() => {
        el.remove();
    });

    it('registers as a custom element', () => {
        expect(customElements.get('hakuneko-connectors')).toBeDefined();
    });

    it('loads connectors from Engine on popup open', async () => {
        el._popupVisible = true;
        await el.updateComplete;

        const cards = el.shadowRoot.querySelectorAll('.card');
        expect(cards.length).toBe(3);
    });

    it('filters connectors by name pattern', async () => {
        el._popupVisible = true;
        el._connectorPattern = 'manga';
        await el.updateComplete;

        const cards = el.shadowRoot.querySelectorAll('.card');
        expect(cards.length).toBe(1);
    });

    it('dispatches selected-connector-changed on connector click', async () => {
        el._popupVisible = true;
        await el.updateComplete;

        let received: any;
        el.addEventListener('selected-connector-changed', (e: CustomEvent) => {
            received = e.detail;
        });

        const card = el.shadowRoot.querySelector('.card');
        card?.click();
        expect(received).toBeDefined();
        expect(received.id).toBe('manga-site');
    });

    it('closes popup after selection', async () => {
        el._popupVisible = true;
        await el.updateComplete;

        const card = el.shadowRoot.querySelector('.card');
        card?.click();
        await el.updateComplete;

        expect(el._popupVisible).toBe(false);
    });

    it('clearFilters resets all filter state', async () => {
        el._connectorPattern = 'test';
        el._mangaPattern = 'test';

        el._clearFilters();
        expect(el._connectorPattern).toBe('');
        expect(el._mangaPattern).toBe('');
    });
});
