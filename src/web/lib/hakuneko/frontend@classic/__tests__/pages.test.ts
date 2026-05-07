import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../pages.js';

describe('hakuneko-pages', () => {
    let el: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        el = document.createElement('hakuneko-pages');
        document.body.appendChild(el);
        await el.updateComplete;
    });

    afterEach(() => {
        el.remove();
    });

    it('registers as a custom element', () => {
        expect(customElements.get('hakuneko-pages')).toBeDefined();
    });

    it('renders container div', () => {
        const container = el.shadowRoot.querySelector('#container');
        expect(container).not.toBeNull();
    });

    it('shows thumbnails when media is an array and selectedMedia < 0', async () => {
        el.selectedMedia = -1;
        el._media = ['img1.jpg', 'img2.jpg', 'img3.jpg'];
        await el.updateComplete;
        const thumbnails = el.shadowRoot.querySelectorAll('.thumbnail');
        expect(thumbnails.length).toBe(3);
    });

    it('shows page viewer when media is array and selectedMedia >= 0', async () => {
        el._media = ['img1.jpg', 'img2.jpg'];
        el.selectedMedia = 0;
        await el.updateComplete;
        const images = el.shadowRoot.querySelectorAll('.image');
        expect(images.length).toBe(2);
    });

    it('shows video player when media has mirrors', async () => {
        el._media = { mirrors: ['https://example.com/stream.m3u8'], subtitles: [] };
        await el.updateComplete;
        const video = el.shadowRoot.querySelector('#video');
        expect(video).not.toBeNull();
    });

    it('dispatches selected-media-changed on thumbnail click', async () => {
        el.selectedMedia = -1;
        el._media = ['img1.jpg', 'img2.jpg'];
        await el.updateComplete;

        let received: number | undefined;
        el.addEventListener('selected-media-changed', (e: CustomEvent) => {
            received = e.detail;
        });

        const thumb = el.shadowRoot.querySelector('.thumbnail');
        thumb.click();
        expect(received).toBe(0);
    });

    it('dispatches selected-media-changed with -1 on hideViewer', async () => {
        el._media = ['img1.jpg'];
        el.selectedMedia = 0;
        await el.updateComplete;

        let received: number | undefined;
        el.addEventListener('selected-media-changed', (e: CustomEvent) => {
            received = e.detail;
        });

        const closeBtn = el.shadowRoot.querySelector('.fa-times-circle');
        closeBtn?.click();
        expect(received).toBe(-1);
    });

    describe('keyboard navigation', () => {
        it('Escape hides viewer', async () => {
            el._media = ['img1.jpg'];
            el.selectedMedia = 0;
            await el.updateComplete;

            let received: number | undefined;
            el.addEventListener('selected-media-changed', (e: CustomEvent) => {
                received = e.detail;
            });

            const buttons = el.shadowRoot.querySelector('#buttons');
            buttons?.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }));
            expect(received).toBe(-1);
        });

        it('ArrowRight dispatches chapterUp event', async () => {
            el._media = ['img1.jpg'];
            el.selectedMedia = 0;
            el.selectedChapter = { title: 'Ch 1', getPages: vi.fn() };
            await el.updateComplete;

            let fired = false;
            const handler = () => {
                fired = true;
            };
            window.addEventListener('chapterUp', handler);

            const buttons = el.shadowRoot.querySelector('#buttons');
            buttons?.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', bubbles: true }));
            expect(fired).toBe(true);

            window.removeEventListener('chapterUp', handler);
        });
    });

    describe('zoom controls', () => {
        it('zoom in increases image width', async () => {
            el._media = ['img1.jpg'];
            el.selectedMedia = 0;
            await el.updateComplete;

            const initialWidth = el._imageWidth;
            const zoomIn = el.shadowRoot.querySelector('.fa-search-plus');
            zoomIn?.click();
            expect(el._imageWidth).toBeGreaterThan(initialWidth);
        });

        it('zoom out decreases image width', async () => {
            el._media = ['img1.jpg'];
            el.selectedMedia = 0;
            await el.updateComplete;

            const initialWidth = el._imageWidth;
            const zoomOut = el.shadowRoot.querySelector('.fa-search-minus');
            zoomOut?.click();
            expect(el._imageWidth).toBeLessThan(initialWidth);
        });
    });
});
