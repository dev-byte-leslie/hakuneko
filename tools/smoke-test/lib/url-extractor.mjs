/**
 * Lightweight URL extractor — reads connector .mjs source files as text
 * and extracts id, label, and url via regex. No dynamic imports, no instantiation.
 * Memory footprint: ~MB instead of GB for 1,340 connectors.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const CONNECTORS_DIR = resolve(
    import.meta.dirname,
    '..', '..', '..', 'src', 'web', 'mjs', 'connectors'
);

const ID_RE = /super\.id\s*=\s*['"`]([^'"`]+)['"`]/;
const LABEL_RE = /super\.label\s*=\s*['"`]([^'"`]+)['"`]/;
const URL_RE = /this\.url\s*=\s*['"`]([^'"`]+)['"`]/;

/**
 * Extract connector metadata from source text without importing.
 * @returns {Array<{ id: string|null, label: string|null, url: string|null, file: string }>}
 */
export function extractConnectorUrls() {
    const files = readdirSync(CONNECTORS_DIR)
        .filter(f => f.endsWith('.mjs'))
        .sort();

    return files.map(file => {
        const source = readFileSync(join(CONNECTORS_DIR, file), 'utf8');
        const id = source.match(ID_RE)?.[1] ?? null;
        const label = source.match(LABEL_RE)?.[1] ?? null;
        const url = source.match(URL_RE)?.[1] ?? null;
        return { id, label, url, file };
    });
}
