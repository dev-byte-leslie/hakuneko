import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import '../start.js';

describe('hakuneko-start', () => {
    let el: any;

    beforeEach(async () => {
        el = document.createElement('hakuneko-start');
        document.body.appendChild(el);
        await el.updateComplete;
    });

    afterEach(() => {
        el.remove();
    });

    it('registers as a custom element', () => {
        expect(customElements.get('hakuneko-start')).toBeDefined();
    });

    it('renders shadow DOM content', () => {
        expect(el.shadowRoot).not.toBeNull();
        expect(el.shadowRoot.innerHTML.length).toBeGreaterThan(0);
    });
});
