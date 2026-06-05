// HAKU-0047: Static guard against connector import regressions that break on
// case-sensitive Linux and under the hakuneko:// protocol (which does NO extension
// resolution). Every relative import in a connector must:
//   1. include an explicit extension (.mjs/.ts/.js) — the browser won't append one
//   2. resolve case-sensitively to a real file (engine modules are .ts in source
//      but emitted as .mjs by Rollup, so a '.mjs' specifier may map to a '.ts' file)
//
// Two failure classes this catches:
//   B — extensionless engine imports, e.g. import Manga from '../../engine/Manga'
//   C — wrong-case imports,           e.g. import X from './AzoraWorld.mjs' (file: azoraworld.mjs)

const fs = require('fs');
const path = require('path');

const CONNECTORS_DIR = path.resolve(__dirname, '..', 'mjs', 'connectors');
const REL_IMPORT_RE = /(?:from|import)\s+['"](\.[^'"]+)['"]/g;

/** Recursively collect all .mjs files under a directory. */
function collectMjs(dir) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...collectMjs(full));
        else if (entry.name.endsWith('.mjs')) out.push(full);
    }
    return out;
}

/**
 * Case-sensitive resolution check for a relative specifier.
 * @returns {'ok'|'no-ext'|'missing'}
 */
function checkSpecifier(fromFile, spec) {
    const abs = path.resolve(path.dirname(fromFile), spec);
    const base = path.basename(abs);
    if (!/\.(mjs|ts|js)$/.test(base)) return 'no-ext';

    let entries;
    try {
        entries = fs.readdirSync(path.dirname(abs));
    } catch {
        return 'missing';
    }
    // Exact case match, or the .ts source of a .mjs specifier (engine modules).
    const tsAlt = base.endsWith('.mjs') ? base.slice(0, -4) + '.ts' : null;
    if (entries.includes(base) || tsAlt && entries.includes(tsAlt)) return 'ok';
    return 'missing';
}

describe('connector relative imports (HAKU-0047 regression guard)', () => {
    const files = collectMjs(CONNECTORS_DIR);

    it('finds connector files to scan', () => {
        expect(files.length).toBeGreaterThan(1000);
    });

    it('every relative import has an explicit extension (no extensionless engine imports)', () => {
        const violations = [];
        for (const file of files) {
            const src = fs.readFileSync(file, 'utf8');
            let m;
            while ((m = REL_IMPORT_RE.exec(src)) !== null) {
                if (checkSpecifier(file, m[1]) === 'no-ext') {
                    violations.push(`${path.relative(CONNECTORS_DIR, file)} -> '${m[1]}'`);
                }
            }
        }
        expect(violations).toEqual([]);
    });

    it('every relative import resolves case-sensitively to a real file', () => {
        const violations = [];
        for (const file of files) {
            const src = fs.readFileSync(file, 'utf8');
            let m;
            while ((m = REL_IMPORT_RE.exec(src)) !== null) {
                if (checkSpecifier(file, m[1]) === 'missing') {
                    violations.push(`${path.relative(CONNECTORS_DIR, file)} -> '${m[1]}'`);
                }
            }
        }
        expect(violations).toEqual([]);
    });
});
