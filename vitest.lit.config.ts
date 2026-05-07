import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['src/web/lib/hakuneko/frontend@classic/__tests__/**/*.test.ts'],
        environment: 'happy-dom',
        globals: true,
        setupFiles: ['src/web/lib/hakuneko/frontend@classic/__tests__/setup.ts'],
    },
});
