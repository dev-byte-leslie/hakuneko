/**
 * Integration tests — full pipeline (fingerprint → generate → validate) against live sites.
 *
 * Gated by NETWORK_TESTS env var to avoid flaky CI:
 *   NETWORK_TESTS=1 bun test test/integration.test.mjs
 *
 * These tests validate that:
 *  1. The fingerprinter correctly identifies the CMS template (>= 90% accuracy target)
 *  2. The generator produces valid connector source code
 *  3. Generated code matches the expected template
 *
 * This suite also serves as the signal weight tuning phase — if accuracy is below
 * 90%, adjust weights in fingerprints.json and rerun until the threshold is met.
 */

import { describe, it, expect } from 'bun:test';
import { fingerprint } from '../lib/fingerprinter.mjs';
import { generate } from '../lib/generator.mjs';

const NETWORK = process.env.NETWORK_TESTS === '1' || process.env.NETWORK_TESTS === 'true';
const testOrSkip = NETWORK ? it : it.skip;

/**
 * Test sites grouped by expected template.
 * Minimum 2 sites per template, diverse regions/languages.
 * These sites were verified manually at plan-writing time — if a site goes
 * down or changes CMS, remove it and add a replacement.
 */
const TEST_SITES = {
    WordPressMadara: [
        { url: 'https://manhuafast.com', name: 'ManhuaFast' },
        { url: 'https://mangachill.io', name: 'MangaChill' },
        { url: 'https://mangatx.to', name: 'MangaTX' },
    ],
    WordPressMangastream: [
        { url: 'https://asuracomic.net', name: 'Asura Scans' },
        { url: 'https://luminousscans.gg', name: 'Luminous Scans' },
        { url: 'https://flamescans.org', name: 'Flame Scans' },
    ],
    FoolSlide: [
        { url: 'https://reader.kireicake.com', name: 'Kirei Cake' },
        { url: 'https://reader.deathtollscans.net', name: 'Death Toll Scans' },
    ],
    SinMH: [
        { url: 'https://www.manhuaniu.com', name: 'ManHuaNiu' },
        { url: 'https://www.imitui.com', name: 'ImiTui' },
    ],
    MadTheme: [
        { url: 'https://mangaforest.me', name: 'MangaForest' },
        { url: 'https://mangaread.co', name: 'MangaRead' },
    ],
};

describe('integration: fingerprint accuracy', () => {
    let results = [];

    for (const [expectedTemplate, sites] of Object.entries(TEST_SITES)) {
        for (const site of sites) {
            testOrSkip(`fingerprints ${site.name} (${site.url}) as ${expectedTemplate}`, async () => {
                const result = await fingerprint(site.url);
                results.push({
                    site: site.name,
                    expected: expectedTemplate,
                    actual: result.template,
                    confidence: result.confidence,
                    correct: result.template === expectedTemplate,
                });

                expect(result.template).toBe(expectedTemplate);
                expect(result.confidence).toBeGreaterThanOrEqual(50);
            }, 30_000); // 30s timeout for slow sites
        }
    }
});

describe('integration: generate from fingerprint', () => {
    // Test the full generate pipeline for one site per template
    const GENERATE_SITES = [
        { url: 'https://manhuafast.com', name: 'ManhuaFast Integration Test', template: 'WordPressMadara' },
        { url: 'https://asuracomic.net', name: 'Asura Integration Test', template: 'WordPressMangastream' },
    ];

    for (const site of GENERATE_SITES) {
        testOrSkip(`generates valid connector for ${site.name}`, async () => {
            // Fingerprint
            const fp = await fingerprint(site.url);
            expect(fp.template).toBe(site.template);

            // Generate
            const result = generate({
                name: site.name,
                url: fp.canonicalUrl,
                template: fp.template,
                tags: ['manga', 'english'],
            });

            // Verify generated source structure
            expect(result.source).toContain(`import ${site.template}`);
            expect(result.source).toContain(`super.id = '${result.id}'`);
            expect(result.source).toContain(`this.url = '${fp.canonicalUrl}'`);
            expect(result.filename).toMatch(/\.mjs$/);
        }, 30_000);
    }
});
