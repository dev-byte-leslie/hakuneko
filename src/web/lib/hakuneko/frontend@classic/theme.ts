import { css } from 'lit';

/**
 * Shared theme styles applied to all HakuNeko components via shadow DOM.
 * CSS custom properties (--theme-*, --app-*, etc.) are injected on :root
 * via applyTheme() in index.html and inherited through shadow DOM boundaries.
 */
export const themeStyles = css`
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
`;
