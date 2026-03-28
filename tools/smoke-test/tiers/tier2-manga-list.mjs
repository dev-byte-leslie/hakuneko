/**
 * Tier 2: Manga List Smoke Test — calls _getMangas() on the top 50 connectors.
 * Validates that each connector returns an array with at least minMangas items,
 * each having { id, title } shape.
 */
import '../lib/engine-mock.mjs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadAllConnectors, findConnectorById } from '../lib/connector-loader.mjs';
import { writeReport } from '../lib/report-writer.mjs';

const CURATION_PATH = resolve(import.meta.dirname, '..', 'curations', 'tier2-top50.json');
const TIMEOUT_MS = 30_000;

/**
 * Run _getMangas() on a single connector with timeout.
 * @param {object} connector - Instantiated connector
 * @param {number} minMangas - Minimum expected manga count
 * @returns {Promise<{ passed: boolean, count: number, error?: string }>}
 */
async function testMangaList(connector, minMangas) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const mangas = await Promise.race([
            connector._getMangas(),
            new Promise((_, reject) => {
                controller.signal.addEventListener('abort', () =>
                    reject(new Error(`Timeout after ${TIMEOUT_MS}ms`))
                );
            }),
        ]);

        clearTimeout(timer);

        if (!Array.isArray(mangas)) {
            return { passed: false, count: 0, error: `Expected array, got ${typeof mangas}` };
        }
        if (mangas.length < minMangas) {
            return { passed: false, count: mangas.length, error: `Got ${mangas.length} mangas, expected >= ${minMangas}` };
        }
        // Validate shape of first item
        const first = mangas[0];
        if (!first || typeof first.id === 'undefined' || typeof first.title === 'undefined') {
            return { passed: false, count: mangas.length, error: 'First manga missing { id, title } shape' };
        }
        return { passed: true, count: mangas.length };
    } catch (error) {
        clearTimeout(timer);
        return { passed: false, count: 0, error: error.message };
    }
}

export async function runTier2() {
    const curation = JSON.parse(readFileSync(CURATION_PATH, 'utf8'));
    console.log(`Tier 2: Testing ${curation.length} connectors for manga list retrieval...`);

    const filterIds = curation.map(entry => entry.id);
    const allConnectors = await loadAllConnectors(filterIds);
    const results = [];

    for (const entry of curation) {
        const found = findConnectorById(entry.id, allConnectors);
        const start = Date.now();

        if (!found || !found.connector) {
            results.push({
                name: entry.label || entry.id,
                status: 'fail',
                durationMs: 0,
                error: found?.error
                    ? `Instantiation failed: ${found.error.message}`
                    : `Connector "${entry.id}" not found`,
            });
            continue;
        }

        console.log(`  Testing: ${entry.label} (${entry.id})...`);
        const result = await testMangaList(found.connector, entry.minMangas || 1);
        const durationMs = Date.now() - start;

        results.push({
            name: entry.label || entry.id,
            status: result.passed ? 'pass' : 'fail',
            durationMs,
            ...(result.error ? { error: result.error } : {}),
            details: { id: entry.id, mangaCount: result.count },
        });
    }

    writeReport(2, results);
    return results;
}
