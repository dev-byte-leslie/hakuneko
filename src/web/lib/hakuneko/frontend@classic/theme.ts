import { css, unsafeCSS } from 'lit';
// Font Awesome utility classes + glyph map, injected into every component's
// shadow root. Shadow DOM does not inherit document-scope utility classes, so
// the FA `.fa-*` content rules must be re-declared in each scope or icons
// render blank. Imported as a string (?inline) to keep the minified `\fXXX`
// glyph escapes as real CSS rather than JS-string double-escapes.
import faStyles from './fontawesome.css?inline';

/**
 * Shared theme styles applied to all HakuNeko components via shadow DOM.
 * CSS custom properties (--theme-*, --app-*, etc.) are injected on :root
 * via applyTheme() in index.html and inherited through shadow DOM boundaries.
 *
 * Exported as an array so the Font Awesome stylesheet is bundled alongside the
 * theme rules. Lit flattens nested style arrays, so consumers that spread
 * `themeStyles` into `static styles = [themeStyles, css`…`]` need no change.
 */
export const themeStyles = [
    // noinspection CssUnresolvedCustomProperty — --theme-* vars are injected at runtime
    // on :root by applyTheme() in index.html, so the IDE cannot statically resolve them.
    css`
    :host {
        user-select: none;
        font-family: Arial, Helvetica, Sans, sans-serif;
        font-size: 10pt;
        color: var(--theme-text-color, #404040);
    }

    ::-webkit-scrollbar {
        width: var(--theme-scrollbar-width, 0);
    }

    ::-webkit-scrollbar-track {
        background-color: var(--theme-scrollbar-track, transparent);
    }

    ::-webkit-scrollbar-thumb {
        background-color: var(--theme-scrollbar-thumb, transparent);
    }

    i {
        color: var(--theme-icon-color);
    }

    a {
        color: var(--theme-link-color);
    }

    input[type=text],
    input[type=password],
    input[type=number] {
        color: var(--theme-input-color);
        border: var(--theme-input-border);
        background-color: var(--theme-input-bg);
        width: calc(100% - 0.5em);
    }

    input[type=text]:disabled,
    input[type=password]:disabled,
    input[type=number]:disabled {
        color: var(--theme-input-disabled-color);
        border: var(--theme-input-disabled-border);
        background-color: var(--theme-input-disabled-bg);
    }

    input[type=checkbox] {
        accent-color: var(--theme-checkbox-color);
    }

    select {
        color: var(--theme-input-color);
        border: var(--theme-input-border);
        background-color: var(--theme-input-bg);
        background-image: var(--theme-select-bg-image);
        background-repeat: no-repeat;
        background-position: right center;
        appearance: none;
        -webkit-appearance: none;
        padding-right: 1.5em;
        width: 100%;
    }
`,
    unsafeCSS(faStyles),
];
