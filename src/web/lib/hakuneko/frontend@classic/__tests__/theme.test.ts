import { describe, it, expect } from 'vitest';
import { themeStyles } from '../theme.js';
import { CSSResult } from 'lit';

describe('theme', () => {
    // themeStyles is an array of CSSResult (theme rules + Font Awesome); Lit
    // flattens it when spread into a component's `static styles`.
    const styles = ([] as CSSResult[]).concat(themeStyles);
    const cssText = styles.map((s) => s.cssText).join('\n');

    it('exports CSSResult instances', () => {
        expect(styles.length).toBeGreaterThan(0);
        for (const s of styles) {
            expect(s).toBeInstanceOf(CSSResult);
        }
    });

    it('contains expected CSS custom property references', () => {
        expect(cssText).toContain('--theme-text-color');
        expect(cssText).toContain('input');
    });

    it('carries Font Awesome classes for shadow-DOM icon rendering', () => {
        // happy-dom can't render webfonts, so assert the rules are present
        // rather than checking computed ::before glyph content.
        expect(cssText).toContain('.fa-bars');
        expect(cssText).toContain('font-family:"Font Awesome 5 Free"');
    });
});
