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

    it('surfaces a failed job even when its earlier events were never seen', async () => {
        // Untracked job (panel missed queued/downloading) whose first event is 'failed'
        const job = { chapter: { id: 'c1' }, status: 'failed', labels: {}, errors: [new Error('boom')], progress: 100, isSame: (o: any) => o.chapter === job.chapter };
        el._onDownloadStatusUpdated(new CustomEvent('updated', { detail: job }));
        await el.updateComplete;

        expect(el._jobList).toContain(job);
        expect(el._failedCount()).toBe(1);
        expect(el.shadowRoot.querySelector('.failed')?.textContent).toContain('1 failed');
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
