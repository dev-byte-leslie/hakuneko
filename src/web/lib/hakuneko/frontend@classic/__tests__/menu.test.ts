import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../menu.js';

describe('hakuneko-menu', () => {
    let el: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        (window as any).Engine.Settings.getCategorizedSettings = vi.fn(() => [
            {
                category: 'General',
                settings: [
                    { label: 'Theme', description: 'UI theme', input: 'select', value: 'dark', options: [] },
                ],
            },
        ]);

        el = document.createElement('hakuneko-menu');
        document.body.appendChild(el);
        await el.updateComplete;
    });

    afterEach(() => {
        el.remove();
    });

    it('registers as a custom element', () => {
        expect(customElements.get('hakuneko-menu')).toBeDefined();
    });

    it('renders title', () => {
        const title = el.shadowRoot.querySelector('.title');
        expect(title.textContent).toBe('HakuNeko');
    });

    it('popup is hidden by default', () => {
        const popup = el.shadowRoot.querySelector('.popup');
        expect(popup.classList.contains('hide')).toBe(true);
    });

    it('toggles popup visibility on menu icon click', async () => {
        const menuIcon = el.shadowRoot.querySelector('.fa-bars');
        menuIcon.click();
        await el.updateComplete;

        const popup = el.shadowRoot.querySelector('.popup');
        expect(popup.classList.contains('show')).toBe(true);
    });

    it('loads categorized settings when popup opens', async () => {
        const menuIcon = el.shadowRoot.querySelector('.fa-bars');
        menuIcon.click();
        await el.updateComplete;

        expect((window as any).Engine.Settings.getCategorizedSettings).toHaveBeenCalled();
        const group = el.shadowRoot.querySelector('.group');
        expect(group.textContent).toContain('General');
    });

    it('save button calls Settings.save and closes popup', async () => {
        el._popupVisible = true;
        await el.updateComplete;

        const saveBtn = el.shadowRoot.querySelector('.fa-check-circle');
        saveBtn.click();
        await el.updateComplete;

        expect((window as any).Engine.Settings.save).toHaveBeenCalled();
        expect(el._popupVisible).toBe(false);
    });

    it('discard button calls Settings.load and closes popup', async () => {
        el._popupVisible = true;
        await el.updateComplete;

        const discardBtn = el.shadowRoot.querySelector('.fa-times-circle');
        discardBtn.click();
        await el.updateComplete;

        expect((window as any).Engine.Settings.load).toHaveBeenCalled();
        expect(el._popupVisible).toBe(false);
    });

    it('window control buttons call correct functions', () => {
        const minimize = el.shadowRoot.querySelector('.fa-window-minimize');
        const maximize = el.shadowRoot.querySelector('.fa-window-maximize');
        const close = el.shadowRoot.querySelector('.fa-window-close');

        minimize.click();
        expect((window as any).minimizeWindow).toHaveBeenCalled();

        maximize.click();
        expect((window as any).maximizeWindow).toHaveBeenCalled();

        close.click();
        expect((window as any).closeWindow).toHaveBeenCalled();
    });
});
