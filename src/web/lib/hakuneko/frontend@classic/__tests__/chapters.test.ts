import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../chapters.js';

describe('hakuneko-chapters', () => {
    let el: any;
    let mockManga: any;
    let mockConnector: any;

    beforeEach(async () => {
        vi.clearAllMocks();

        mockConnector = { id: 'site-1', label: 'Test Site' };
        mockManga = {
            id: 'manga-1',
            title: 'Test Manga',
            connector: mockConnector,
            getChapters: vi.fn((cb: any) => cb(null, [
                { id: 'ch1', title: 'Chapter 1', language: 'en', status: '', manga: mockManga },
                { id: 'ch2', title: 'Chapter 2', language: 'en', status: '', manga: mockManga },
                { id: 'ch3', title: 'Chapter 3', language: 'fr', status: '', manga: mockManga },
            ])),
        };

        el = document.createElement('hakuneko-chapters');
        document.body.appendChild(el);
        await el.updateComplete;
    });

    afterEach(() => {
        el.remove();
    });

    async function loadChapters() {
        el.selectedConnector = mockConnector;
        await el.updateComplete;
        el.selectedManga = mockManga;
        await el.updateComplete;
        await el.updateComplete;
    }

    it('registers as a custom element', () => {
        expect(customElements.get('hakuneko-chapters')).toBeDefined();
    });

    it('loads chapter list when manga is set', async () => {
        await loadChapters();
        const items = el.shadowRoot.querySelectorAll('.list > li');
        expect(items.length).toBe(3);
    });

    it('filters chapters by language', async () => {
        await loadChapters();
        el._searchLanguage = 'fr';
        await el.updateComplete;

        const items = el.shadowRoot.querySelectorAll('.list > li');
        expect(items.length).toBe(1);
    });

    it('filters chapters by title pattern', async () => {
        await loadChapters();
        el._searchPattern = 'Chapter 1';
        await el.updateComplete;

        const items = el.shadowRoot.querySelectorAll('.list > li');
        expect(items.length).toBe(1);
        expect(items[0].textContent).toContain('Chapter 1');
    });

    it('dispatches selected-chapter-changed on chapter image icon click', async () => {
        await loadChapters();

        let received: any;
        el.addEventListener('selected-chapter-changed', (e: CustomEvent) => {
            received = e.detail;
        });

        // The chapter select handler is on the .fa-image icon
        const imageIcon = el.shadowRoot.querySelector('.fa-image');
        imageIcon?.click();
        expect(received).toBeDefined();
        expect(received.title).toBe('Chapter 1');
    });

    it('clears chapters when connector changes', async () => {
        await loadChapters();

        // Changing connector triggers _onSelectedConnectorChanged which clears chapter list
        el.selectedConnector = { id: 'other', label: 'Other' };
        el.selectedManga = undefined;
        await el.updateComplete;
        await el.updateComplete;

        const items = el.shadowRoot.querySelectorAll('.list > li');
        expect(items.length).toBe(0);
    });
});
