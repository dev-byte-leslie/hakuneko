/**
 * Connector loader — enumerates and dynamically imports all connector .mjs files.
 * Returns an array of { connector, file, error } objects.
 * Connectors that throw on instantiation are captured, not fatal.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ID_RE = /super\.id\s*=\s*['"`]([^'"`]+)['"`]/;

const CONNECTORS_DIR = resolve(
    import.meta.dirname,
    '..', '..', '..', 'src', 'web', 'mjs', 'connectors'
);

/**
 * Load top-level .mjs connector files (excludes templates/, system/ subdirs).
 * @param {string[]|null} filterIds - If provided, only load connectors whose filename
 *   (without .mjs) or super.id matches one of these IDs. Pass null to load all (~1,340).
 *   WARNING: Loading all connectors requires significant memory (~GB). Prefer passing
 *   a filter list for Tier 2/3 curated subsets.
 * @returns {Promise<Array<{ connector: object|null, file: string, error: Error|null }>>}
 */
export async function loadAllConnectors(filterIds = null) {
    let files = readdirSync(CONNECTORS_DIR)
        .filter(f => f.endsWith('.mjs'))
        .sort();

    if (filterIds) {
        const idSet = new Set(filterIds.map(id => id.toLowerCase()));
        files = files.filter(f => {
            // Match by filename first (fast path)
            if (idSet.has(f.replace('.mjs', '').toLowerCase())) return true;
            // Fall back to reading super.id from source (handles ID != filename cases like mangapark-en)
            const source = readFileSync(join(CONNECTORS_DIR, f), 'utf8');
            const match = source.match(ID_RE);
            return match && idSet.has(match[1].toLowerCase());
        });
    }

    const results = [];

    for (const file of files) {
        const fullPath = join(CONNECTORS_DIR, file);
        try {
            const mod = await import(pathToFileURL(fullPath).href);
            const ConnectorClass = mod.default;
            const connector = new ConnectorClass();
            results.push({ connector, file, error: null });
        } catch (error) {
            results.push({ connector: null, file, error });
        }
    }

    return results;
}

/**
 * Load a single connector by its ID (filename without .mjs extension or connector.id match).
 * @param {string} id - Connector ID to find
 * @param {Array} allConnectors - Pre-loaded connector array from loadAllConnectors()
 * @returns {{ connector: object|null, file: string, error: Error|null } | undefined}
 */
export function findConnectorById(id, allConnectors) {
    return allConnectors.find(
        entry => entry.connector && (
            entry.connector.id === id ||
            entry.file.replace('.mjs', '').toLowerCase() === id.toLowerCase()
        )
    );
}
