import { describe, it, expect, beforeEach } from 'vitest';
import '../status.js';

describe('hakuneko-status', () => {
    let el: any;

    beforeEach(async () => {
        el = document.createElement('hakuneko-status');
        document.body.appendChild(el);
        await el.updateComplete;
    });

    afterEach(() => {
        el.remove();
    });

    it('registers as a custom element', () => {
        expect(customElements.get('hakuneko-status')).toBeDefined();
    });

    it('renders with empty message initially', async () => {
        const messageDiv = el.shadowRoot.querySelector('.message');
        expect(messageDiv.textContent.trim()).toBe('');
    });

    it('addToQueue returns a symbol ID', () => {
        const id = el.addToQueue('Loading...');
        expect(typeof id).toBe('symbol');
    });

    it('addToQueue increases queue length', async () => {
        el.addToQueue('Task 1');
        el.addToQueue('Task 2');
        await el.updateComplete;
        const statusDiv = el.shadowRoot.querySelector('.status');
        expect(statusDiv.classList.contains('show')).toBe(true);
    });

    it('removeFromQueue decreases queue length', async () => {
        const id1 = el.addToQueue('Task 1');
        el.addToQueue('Task 2');
        el.removeFromQueue(id1);
        await el.updateComplete;
        const statusDiv = el.shadowRoot.querySelector('.status');
        expect(statusDiv.textContent).toContain('1');
    });

    it('removeFromQueue hides status when queue is empty', async () => {
        const id = el.addToQueue('Only task');
        el.removeFromQueue(id);
        await el.updateComplete;
        const statusDiv = el.shadowRoot.querySelector('.status');
        expect(statusDiv.classList.contains('hide')).toBe(true);
    });

    it('setting message dispatches message-changed event', async () => {
        let received: string | undefined;
        el.addEventListener('message-changed', (e: CustomEvent) => {
            received = e.detail;
        });
        el.message = 'Mangas: 42 / 100';
        expect(received).toBe('Mangas: 42 / 100');
    });

    it('message setter updates rendered content', async () => {
        el.message = 'Test message';
        await el.updateComplete;
        const messageDiv = el.shadowRoot.querySelector('.message');
        expect(messageDiv.textContent.trim()).toBe('Test message');
    });
});
