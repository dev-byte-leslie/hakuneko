import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../jobs.js';

describe('hakuneko-jobs', () => {
    let el: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        el = document.createElement('hakuneko-jobs');
        document.body.appendChild(el);
        await el.updateComplete;
    });

    afterEach(() => {
        el.remove();
    });

    it('registers as a custom element', () => {
        expect(customElements.get('hakuneko-jobs')).toBeDefined();
    });

    it('subscribes to DownloadManager updated event', () => {
        const dm = (window as any).Engine.DownloadManager;
        expect(dm.addEventListener).toHaveBeenCalledWith('updated', expect.any(Function));
    });

    it('subscribes to ipc close event', () => {
        const ipc = (window as any).hakunekoAPI.ipc;
        expect(ipc.on).toHaveBeenCalledWith('hakuneko:ipc:close', expect.any(Function));
    });

    it('unsubscribes from both on disconnect', () => {
        el.remove();
        const dm = (window as any).Engine.DownloadManager;
        const ipc = (window as any).hakunekoAPI.ipc;
        expect(dm.removeEventListener).toHaveBeenCalledWith('updated', expect.any(Function));
        expect(ipc.off).toHaveBeenCalledWith('hakuneko:ipc:close', expect.any(Function));
    });

    it('toggle shows/hides job list', async () => {
        // Initially hidden
        expect(el.shadowRoot.querySelector('.hide')).not.toBeNull();

        // Click toggle
        const toggleBtn = el.shadowRoot.querySelector('[class*="fa-chart-bar"]') ||
                          el.shadowRoot.querySelector('i');
        toggleBtn?.click();
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.show')).not.toBeNull();
    });
});
