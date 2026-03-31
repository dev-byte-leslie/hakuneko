/**
 * Code generator — pure function that takes connector metadata and produces
 * the .mjs connector source string matching the project's hand-written style.
 *
 * Deliberately does NOT write files — the CLI or GitHub bot decides where to
 * write. This keeps the generator trivially testable without filesystem side
 * effects and composable in pipelines.
 *
 * Naming conflict detection scans existing connector files as text (no imports)
 * reusing the regex pattern from tools/smoke-test/lib/url-extractor.mjs —
 * avoids loading all 1,340 connectors into memory.
 */

import Mustache from 'mustache';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { getTemplateDefaults } from './fingerprinter.mjs';

const TEMPLATES_DIR = resolve(import.meta.dirname, '..', 'templates');
const CONNECTORS_DIR = resolve(
    import.meta.dirname,
    '..', '..', '..', 'src', 'web', 'mjs', 'connectors'
);

// Reuse regex patterns from url-extractor.mjs
const ID_RE = /super\.id\s*=\s*['"`]([^'"`]+)['"`]/;

/**
 * @typedef {Object} GeneratorInput
 * @property {string} name - Human-readable site name, e.g. "Ace Scans"
 * @property {string} url - Canonical site URL, e.g. "https://acescans.xyz"
 * @property {string} template - Template class name, e.g. "WordPressMangastream"
 * @property {string[]} [tags] - Tag array, e.g. ["manga", "english"]
 * @property {string} [path] - Override the template-default manga list path
 */

/**
 * @typedef {Object} GeneratorResult
 * @property {string} source - Generated .mjs source code
 * @property {string} filename - Output filename, e.g. "AceScans.mjs"
 * @property {string} className - PascalCase class name, e.g. "AceScans"
 * @property {string} id - Lowercase connector id, e.g. "acescans"
 * @property {boolean} hasConflict - True if id or filename already exists
 * @property {string|null} conflictFile - Path of conflicting file, or null
 */

/**
 * Generate a connector .mjs source file from metadata.
 * @param {GeneratorInput} input
 * @returns {GeneratorResult}
 */
export function generate(input) {
    const { name, url, template, tags = ['manga'], path } = input;

    const className = toClassName(name);
    const id = toId(name);
    const filename = `${className}.mjs`;

    // Determine path: caller override → fingerprint defaults → template default
    const defaults = getTemplateDefaults(template);
    const resolvedPath = path ?? defaults?.path ?? '/';

    // Format tags as a Mustache-safe string: 'manga', 'english'
    const tagsStr = tags.map(t => `'${t}'`).join(', ');

    const tplPath = resolve(TEMPLATES_DIR, `${template}.mjs.tpl`);
    const tplSource = readFileSync(tplPath, 'utf8');

    const source = Mustache.render(tplSource, {
        className,
        id,
        label: name,
        tags: tagsStr,
        url,
        path: resolvedPath,
    });

    const { hasConflict, conflictFile } = detectConflict(id, filename);

    return { source, filename, className, id, hasConflict, conflictFile };
}

/**
 * Convert a site name to PascalCase class name.
 * "Ace Scans" → "AceScans", "my-site!" → "MySite"
 * @param {string} name
 * @returns {string}
 */
export function toClassName(name) {
    return name
        .replace(/[^a-zA-Z0-9\s]/g, ' ')      // strip non-alphanum
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map(word => word[0].toUpperCase() + word.slice(1).toLowerCase())
        .join('');
}

/**
 * Convert a site name to lowercase alphanum connector id.
 * "Ace Scans" → "acescans"
 * @param {string} name
 * @returns {string}
 */
export function toId(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

/**
 * Scan existing connector files as text to detect id or filename conflicts.
 * Uses regex matching (no dynamic imports) to avoid loading 1,340 connectors.
 * @param {string} id
 * @param {string} filename
 * @returns {{ hasConflict: boolean, conflictFile: string|null }}
 */
function detectConflict(id, filename) {
    let files;
    try {
        files = readdirSync(CONNECTORS_DIR).filter(f => f.endsWith('.mjs'));
    } catch {
        // If connectors dir can't be read, skip conflict check
        return { hasConflict: false, conflictFile: null };
    }

    for (const file of files) {
        // Filename collision is the simplest check
        if (file === filename) {
            return { hasConflict: true, conflictFile: join(CONNECTORS_DIR, file) };
        }

        // Also check for id collision in the source
        try {
            const source = readFileSync(join(CONNECTORS_DIR, file), 'utf8');
            const existingId = source.match(ID_RE)?.[1];
            if (existingId === id) {
                return { hasConflict: true, conflictFile: join(CONNECTORS_DIR, file) };
            }
        } catch {
            // Skip unreadable files
        }
    }

    return { hasConflict: false, conflictFile: null };
}
