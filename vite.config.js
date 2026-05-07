import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';

/**
 * Generates src/web/mjs/VersionInfo.mjs before Rollup resolves the module graph.
 * HakuNeko.mjs imports this file statically, so it must exist at buildStart time.
 * Replaces the createVersionInfo() function from the legacy build-web.js.
 */
function versionInfoPlugin() {
    return {
        name: 'hakuneko-version-info',
        buildStart() {
            const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
            const revision = execSync('git rev-parse HEAD').toString().trim();
            const content = [
                `export default {`,
                `    branch: {`,
                `        label: '${branch}',`,
                `        link: 'https://github.com/manga-download/hakuneko/commits/${branch}',`,
                `    },`,
                `    revision: {`,
                `        label: '${revision.slice(0, 6)}',`,
                `        link: 'https://github.com/manga-download/hakuneko/commits/${revision}',`,
                `    }`,
                `};`,
            ].join('\n');
            writeFileSync('src/web/mjs/VersionInfo.mjs', content);
        },
    };
}

export default defineConfig({
    root: 'src/web',
    resolve: {
        extensions: ['.ts', '.mjs', '.js', '.json'],
    },
    build: {
        outDir: '../../build/web',
        emptyOutDir: true,
        copyPublicDir: false,
        // The original polymer-build pipeline did NOT minify — it was a plain copy.
        // Disable minification to match that behavior and avoid breaking connectors
        // that import engine modules (minified names could break reflection patterns).
        minify: false,
        rollupOptions: {
            // Use the JS entry directly so that index.html is not transformed by
            // Vite (avoids hashing of <link rel="icon"> and <script src="..."> paths).
            // index.html is copied as-is via viteStaticCopy below.
            input: [
                    'src/web/mjs/HakuNeko.mjs',
                    'src/web/mjs/globals.mjs',
                    // Lit frontend — compiled from TypeScript, loaded via dynamic import in index.html
                    'src/web/lib/hakuneko/frontend@classic/app.ts',
                ],
            // Required when preserveModules is true — Vite's default of false conflicts
            preserveEntrySignatures: 'strict',
            output: {
                format: 'es',
                // Preserve the mjs/ directory structure so that:
                //   1. Relative dynamic import paths (../connectors/system/...) still resolve correctly
                //   2. index.html's <script type="module"> import './mjs/HakuNeko.mjs' still works
                preserveModules: true,
                preserveModulesRoot: 'src/web',
                // Keep .mjs extension — the hakuneko:// protocol serves these files
                // and connector list fetches reference .mjs filenames
                entryFileNames: '[name].mjs',
                chunkFileNames: '[name].mjs',
                assetFileNames: '[name].[ext]',
            },
        },
    },
    plugins: [
        versionInfoPlugin(),
        viteStaticCopy({
            targets: [
                // index.html is copied as-is to avoid Vite hashing <link>/<script> paths
                { src: 'index.html', dest: '.' },
                // Static lib assets (icons, etc.) — Lit TS components are compiled by Rollup above
                { src: 'lib/**/*', dest: 'lib' },
                // Static assets
                { src: 'img/**/*', dest: 'img' },
                { src: 'css/**/*', dest: 'css' },
                // Connector modules — 1,334 .mjs files loaded at runtime via
                // dynamic import() from hakuneko://cache/mjs/connectors/ listings.
                // These are NOT in the static module graph so Rollup won't include them.
                { src: 'mjs/connectors/**/*', dest: 'mjs/connectors' },
                // Video stream extractors — imported by anime connectors
                // (e.g. import FileMoon from '../videostreams/FileMoon.mjs')
                { src: 'mjs/videostreams/**/*', dest: 'mjs/videostreams' },
            ],
        }),
    ],
    server: {
        port: 7357,
        strictPort: true,
    },
});
