import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['src/web/lib/hakuneko/frontend@classic/__tests__/**/*.test.ts'],
        environment: 'happy-dom',
        globals: true,
        // Process CSS imports so theme.ts's `fontawesome.css?inline` resolves to
        // the stylesheet string (Vitest stubs CSS to '' by default).
        css: true,
        setupFiles: ['src/web/lib/hakuneko/frontend@classic/__tests__/setup.ts'],
    },
});
