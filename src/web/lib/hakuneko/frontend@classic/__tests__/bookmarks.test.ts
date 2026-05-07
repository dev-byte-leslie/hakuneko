import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockConnector } from './setup.js';
import '../bookmarks.js';

describe('hakuneko-bookmarks', () => {
    let el: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        (window as any).Engine.BookmarkManager.bookmarks = [];
        el = document.createElement('hakuneko-bookmarks');
        document.body.appendChild(el);
        await el.updateComplete;
    });

    afterEach(() => {
        el.remove();
    });

    it('registers as a custom element', () => {
        expect(customElements.get('hakuneko-bookmarks')).toBeDefined();
    });

    it('subscribes to BookmarkManager changed event on connect', () => {
        const bm = (window as any).Engine.BookmarkManager;
        expect(bm.addEventListener).toHaveBeenCalledWith('changed', expect.any(Function));
    });

    it('unsubscribes from BookmarkManager on disconnect', () => {
        el.remove();
        const bm = (window as any).Engine.BookmarkManager;
        expect(bm.removeEventListener).toHaveBeenCalledWith('changed', expect.any(Function));
    });

    it('shows add icon when manga is bookmarkable and not bookmarked', async () => {
        const connector = new MockConnector();
        connector.id = 'site-1';
        el.selectedManga = { id: 'manga-1', connector };
        el._bookmarkList = [];
        await el.updateComplete;

        const icon = el.shadowRoot.querySelector('.bookmarkAdd');
        expect(icon).not.toBeNull();
    });

    it('shows delete icon when manga is already bookmarked', async () => {
        const connector = new MockConnector();
        connector.id = 'site-1';
        el.selectedManga = { id: 'manga-1', connector };
        el._bookmarkList = [{ key: { manga: 'manga-1', connector: 'site-1' } }];
        await el.updateComplete;

        const icon = el.shadowRoot.querySelector('.bookmarkDelete');
        expect(icon).not.toBeNull();
    });

    it('shows invalid icon when manga connector is not a Connector instance', async () => {
        el.selectedManga = { id: 'manga-1', connector: { id: 'fake', label: 'Fake' } };
        el._bookmarkList = [];
        await el.updateComplete;

        const icon = el.shadowRoot.querySelector('.bookmarkInvalid');
        expect(icon).not.toBeNull();
    });

    it('calls addBookmark when clicking unbookmarked manga', async () => {
        const connector = new MockConnector();
        connector.id = 'site-1';
        el.selectedManga = { id: 'manga-1', connector };
        el._bookmarkList = [];
        await el.updateComplete;

        el.shadowRoot.querySelector('span').click();
        expect((window as any).Engine.BookmarkManager.addBookmark).toHaveBeenCalledWith(el.selectedManga);
    });

    it('calls deleteBookmark when clicking bookmarked manga', async () => {
        const connector = new MockConnector();
        connector.id = 'site-1';
        el.selectedManga = { id: 'manga-1', connector };
        const bookmark = { key: { manga: 'manga-1', connector: 'site-1' } };
        el._bookmarkList = [bookmark];
        await el.updateComplete;

        el.shadowRoot.querySelector('span').click();
        expect((window as any).Engine.BookmarkManager.deleteBookmark).toHaveBeenCalledWith(bookmark);
    });
});
