import { describe, it, expect } from 'vitest';
import { themeStyles } from '../theme.js';
import { CSSResult } from 'lit';

describe('theme', () => {
    it('exports a valid CSSResult', () => {
        expect(themeStyles).toBeInstanceOf(CSSResult);
    });

    it('contains expected CSS custom property references', () => {
        const cssText = themeStyles.cssText;
        expect(cssText).toContain('--theme-text-color');
        expect(cssText).toContain('input');
    });
});
