/// <reference types="vite/client" />

// Explicit ambient declarations for Vite asset query imports so any TypeScript
// service (tsc, WebStorm's bundled TS server) resolves them without depending on
// vite/client being picked up. Used by theme.ts to inline the Font Awesome
// stylesheet as a string via `./fontawesome.css?inline`.
declare module '*.css?inline' {
    const css: string;
    export default css;
}

declare module '*?inline' {
    const content: string;
    export default content;
}

declare module '*?raw' {
    const content: string;
    export default content;
}
