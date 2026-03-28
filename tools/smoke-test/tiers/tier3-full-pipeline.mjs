/**
 * Tier 3: Full Pipeline Test — manga -> chapters -> pages for the top 10 connectors.
 * Uses seed manga data so we don't need to scan the full manga list.
 */
import '../lib/engine-mock.mjs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadAllConnectors, findConnectorById } from '../lib/connector-loader.mjs';
import { writeReport } from '../lib/report-writer.mjs';

const CURATION_PATH = resolve(import.meta.dirname, '..', 'curations', 'tier3-top10.json');
const TIMEOUT_MS = 60_000;

/**
 * Run full pipeline (chapters + pages) on a connector with seed manga.
 * @param {object} connector
 * @param {{ id: string, title: string }} seedManga
 * @param {number} minChapters
 * @param {number} minPages
 */
async function testFullPipeline(connector, seedManga, minChapters, minPages) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const abortPromise = new Promise((_, reject) => {
        controller.signal.addEventListener('abort', () =>
            reject(new Error(`Timeout after ${TIMEOUT_MS}ms`))
        );
    });

    try {
        // Step 1: Get chapters for seed manga
        const chapters = await Promise.race([
            connector._getChapters(seedManga),
            abortPromise,
        ]);

        if (!Array.isArray(chapters) || chapters.length < minChapters) {
            clearTimeout(timer);
            return {
                passed: false,
                chapterCount: Array.isArray(chapters) ? chapters.length : 0,
                pageCount: 0,
                error: `Chapters: got ${Array.isArray(chapters) ? chapters.length : 0}, expected >= ${minChapters}`,
            };
        }

        // Step 2: Get pages for first chapter
        const pages = await Promise.race([
            connector._getPages(chapters[0]),
            abortPromise,
        ]);

        clearTimeout(timer);

        const pageCount = Array.isArray(pages) ? pages.length : 0;
        if (pageCount < minPages) {
            return {
                passed: false,
                chapterCount: chapters.length,
                pageCount,
                error: `Pages: got ${pageCount}, expected >= ${minPages}`,
            };
        }

        return { passed: true, chapterCount: chapters.length, pageCount };
    } catch (error) {
        clearTimeout(timer);
        return { passed: false, chapterCount: 0, pageCount: 0, error: error.message };
    }
}

export async function runTier3() {
    const curation = JSON.parse(readFileSync(CURATION_PATH, 'utf8'));
    console.log(`Tier 3: Testing ${curation.length} connectors for full pipeline...`);

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
        const result = await testFullPipeline(
            found.connector,
            entry.seedManga,
            entry.minChapters || 1,
            entry.minPages || 1
        );
        const durationMs = Date.now() - start;

        results.push({
            name: entry.label || entry.id,
            status: result.passed ? 'pass' : 'fail',
            durationMs,
            ...(result.error ? { error: result.error } : {}),
            details: {
                id: entry.id,
                chapterCount: result.chapterCount,
                pageCount: result.pageCount,
            },
        });
    }

    writeReport(3, results);
    return results;
}
