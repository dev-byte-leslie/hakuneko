import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../app.js';

describe('hakuneko-app', () => {
    let el: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        (window as any).Engine.Settings.readerEnabled.value = true;

        el = document.createElement('hakuneko-app');
        document.body.appendChild(el);
        await el.updateComplete;
    });

    afterEach(() => {
        el.remove();
    });

    it('registers as a custom element', () => {
        expect(customElements.get('hakuneko-app')).toBeDefined();
    });

    it('renders all child components', () => {
        expect(el.shadowRoot.querySelector('hakuneko-menu')).not.toBeNull();
        expect(el.shadowRoot.querySelector('hakuneko-mangas')).not.toBeNull();
        expect(el.shadowRoot.querySelector('hakuneko-chapters')).not.toBeNull();
        expect(el.shadowRoot.querySelector('hakuneko-jobs')).not.toBeNull();
        expect(el.shadowRoot.querySelector('hakuneko-pages')).not.toBeNull();
    });

    it('shows content panel when reader is enabled', () => {
        const content = el.shadowRoot.querySelector('.content');
        const style = content.getAttribute('style') || '';
        expect(style).not.toContain('display: none');
    });

    it('hides content panel when reader is disabled', async () => {
        el._readerEnabled = false;
        await el.updateComplete;

        const content = el.shadowRoot.querySelector('.content');
        const style = content.getAttribute('style') || '';
        expect(style).toContain('display: none');
    });

    it('control panel shows by default (no media selected)', () => {
        const control = el.shadowRoot.querySelector('.control');
        expect(control.classList.contains('show')).toBe(true);
    });

    it('control panel hides when media is selected', async () => {
        el._selectedMediaIndex = 0;
        await el.updateComplete;

        const control = el.shadowRoot.querySelector('.control');
        expect(control.classList.contains('hide')).toBe(true);
    });

    it('passes connector to chapters component', async () => {
        const testConnector = { id: 'test', label: 'Test', getMangas: vi.fn((cb: any) => cb(null, [])), isUpdating: false };
        el._connector = testConnector;
        await el.updateComplete;

        const chapters = el.shadowRoot.querySelector('hakuneko-chapters');
        expect(chapters.selectedConnector).toBe(testConnector);
    });

    it('passes manga to chapters component', async () => {
        const testManga = { id: 'manga-1', title: 'Test Manga', connector: { id: 'c', label: 'C' } };
        el._manga = testManga;
        await el.updateComplete;

        const chapters = el.shadowRoot.querySelector('hakuneko-chapters');
        expect(chapters.selectedManga).toBe(testManga);
    });

    it('passes chapter to pages component', async () => {
        const testChapter = { id: 'ch-1', title: 'Ch 1', getPages: vi.fn() };
        el._chapter = testChapter;
        await el.updateComplete;

        const pages = el.shadowRoot.querySelector('hakuneko-pages');
        expect(pages.selectedChapter).toBe(testChapter);
    });

    it('shows start panel when reader enabled and no chapter selected', async () => {
        el._readerEnabled = true;
        el._chapter = undefined;
        await el.updateComplete;

        const start = el.shadowRoot.querySelector('hakuneko-start');
        const style = start.getAttribute('style') || '';
        expect(style).not.toContain('display: none');
    });

    it('hides start panel when chapter is selected', async () => {
        el._readerEnabled = true;
        el._chapter = { id: 'ch-1', title: 'Ch 1', getPages: vi.fn() };
        await el.updateComplete;

        const start = el.shadowRoot.querySelector('hakuneko-start');
        const style = start.getAttribute('style') || '';
        expect(style).toContain('display: none');
    });
});
