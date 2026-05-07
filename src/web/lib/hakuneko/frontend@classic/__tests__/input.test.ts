import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import '../input.js';

describe('hakuneko-input', () => {
    let el: any;

    beforeEach(async () => {
        el = document.createElement('hakuneko-input');
        document.body.appendChild(el);
        await el.updateComplete;
    });

    afterEach(() => {
        el.remove();
    });

    it('registers as a custom element', () => {
        expect(customElements.get('hakuneko-input')).toBeDefined();
    });

    it('renders nothing when item is undefined', () => {
        const content = el.shadowRoot.querySelector('.stretch');
        expect(content).toBeNull();
    });

    it('renders a text input for input type "text"', async () => {
        el.item = { input: 'text', value: 'hello', label: 'TestField' };
        await el.updateComplete;
        const input = el.shadowRoot.querySelector('input[type="text"]');
        expect(input).not.toBeNull();
        expect(input.value).toBe('hello');
    });

    it('renders a password input for input type "password"', async () => {
        el.item = { input: 'password', value: 'secret', label: 'Pass' };
        await el.updateComplete;
        const input = el.shadowRoot.querySelector('input[type="password"]');
        expect(input).not.toBeNull();
    });

    it('renders a number input for input type "numeric"', async () => {
        el.item = { input: 'numeric', value: 42, min: 0, max: 100, label: 'Num' };
        await el.updateComplete;
        const input = el.shadowRoot.querySelector('input[type="number"]');
        expect(input).not.toBeNull();
        expect(input.min).toBe('0');
        expect(input.max).toBe('100');
    });

    it('renders a select for input type "select"', async () => {
        el.item = {
            input: 'select',
            value: 'b',
            options: [{ value: 'a', name: 'A' }, { value: 'b', name: 'B' }],
            label: 'Sel',
        };
        await el.updateComplete;
        const select = el.shadowRoot.querySelector('select');
        expect(select).not.toBeNull();
        expect(select.querySelectorAll('option').length).toBe(2);
    });

    it('renders a checkbox for input type "checkbox"', async () => {
        el.item = { input: 'checkbox', value: true, label: 'Check' };
        await el.updateComplete;
        const input = el.shadowRoot.querySelector('input[type="checkbox"]');
        expect(input).not.toBeNull();
        expect(input.checked).toBe(true);
    });

    it('renders a disabled input for input type "disabled"', async () => {
        el.item = { input: 'disabled', value: 'readonly', label: 'Dis' };
        await el.updateComplete;
        const input = el.shadowRoot.querySelector('input[disabled]');
        expect(input).not.toBeNull();
    });

    it('dispatches item-changed event on text input change', async () => {
        el.item = { input: 'text', value: '', label: 'TestLabel' };
        await el.updateComplete;

        let received: any;
        el.addEventListener('item-changed', (e: CustomEvent) => {
            received = e.detail;
        });

        const input = el.shadowRoot.querySelector('input[type="text"]');
        input.value = 'new value';
        input.dispatchEvent(new Event('change'));

        expect(received).toBeDefined();
        expect(received.value).toBe('new value');
    });

    it('dispatches item-changed event on checkbox toggle', async () => {
        el.item = { input: 'checkbox', value: false, label: 'Check' };
        await el.updateComplete;

        let received: any;
        el.addEventListener('item-changed', (e: CustomEvent) => {
            received = e.detail;
        });

        const input = el.shadowRoot.querySelector('input[type="checkbox"]');
        input.checked = true;
        input.dispatchEvent(new Event('change'));

        expect(received).toBeDefined();
        expect(received.value).toBe(true);
    });
});
