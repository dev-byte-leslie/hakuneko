import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../mangas.js';

describe('hakuneko-mangas', () => {
    let el: any;
    let mockConnector: any;

    beforeEach(async () => {
        vi.clearAllMocks();

        mockConnector = {
            id: 'test-connector',
            label: 'Test Site',
            isUpdating: false,
            getMangas: vi.fn((cb: any) => cb(null, [
                { id: 'm1', title: 'Alpha Manga', connector: mockConnector, status: '' },
                { id: 'm2', title: 'Beta Manga', connector: mockConnector, status: '' },
                { id: 'm3', title: 'Gamma Manga', connector: mockConnector, status: '' },
            ])),
            updateMangas: vi.fn(),
        };

        el = document.createElement('hakuneko-mangas');
        document.body.appendChild(el);
        await el.updateComplete;
    });

    afterEach(() => {
        el.remove();
    });

    it('registers as a custom element', () => {
        expect(customElements.get('hakuneko-mangas')).toBeDefined();
    });

    it('loads manga list when connector is set', async () => {
        el.selectedConnector = mockConnector;
        await el.updateComplete;
        await el.updateComplete;

        const items = el.shadowRoot.querySelectorAll('.manga');
        expect(items.length).toBe(3);
    });

    it('filters manga list by pattern (3+ chars)', async () => {
        el.selectedConnector = mockConnector;
        await el.updateComplete;
        await el.updateComplete;

        el._mangaPattern = 'alp';
        await el.updateComplete;

        const items = el.shadowRoot.querySelectorAll('.manga');
        expect(items.length).toBe(1);
        expect(items[0].textContent).toContain('Alpha');
    });

    it('does not filter with pattern shorter than 3 chars', async () => {
        el.selectedConnector = mockConnector;
        await el.updateComplete;
        await el.updateComplete;

        el._mangaPattern = 'al';
        await el.updateComplete;

        const items = el.shadowRoot.querySelectorAll('.manga');
        expect(items.length).toBe(3);
    });

    it('dispatches selected-manga-changed on manga click', async () => {
        el.selectedConnector = mockConnector;
        await el.updateComplete;
        await el.updateComplete;

        let received: any;
        el.addEventListener('selected-manga-changed', (e: CustomEvent) => {
            received = e.detail;
        });

        const firstManga = el.shadowRoot.querySelector('.manga');
        firstManga.click();
        expect(received).toBeDefined();
        expect(received.title).toBe('Alpha Manga');
    });

    it('clears selected manga when connector changes', async () => {
        el.selectedConnector = mockConnector;
        await el.updateComplete;

        let received: any = 'not-set';
        el.addEventListener('selected-manga-changed', (e: CustomEvent) => {
            received = e.detail;
        });

        el.selectedConnector = { ...mockConnector, id: 'other', getMangas: vi.fn((cb: any) => cb(null, [])) };
        await el.updateComplete;

        // detail is undefined (or null depending on event dispatch)
        expect(received == null || received === undefined).toBe(true);
    });

    it('shows notification when connector has no mangas', async () => {
        const emptyConnector = {
            ...mockConnector,
            id: 'empty',
            getMangas: vi.fn((cb: any) => cb(null, [])),
        };
        el.selectedConnector = emptyConnector;
        await el.updateComplete;
        await el.updateComplete;

        const notification = el.shadowRoot.querySelector('.notification');
        expect(notification).not.toBeNull();
    });

    it('highlights selected manga with focus class', async () => {
        el.selectedConnector = mockConnector;
        await el.updateComplete;
        await el.updateComplete;

        const firstManga = el.shadowRoot.querySelector('.manga');
        firstManga.click();
        await el.updateComplete;

        const focused = el.shadowRoot.querySelector('.focus');
        expect(focused).not.toBeNull();
        expect(focused.textContent).toContain('Alpha');
    });
});
