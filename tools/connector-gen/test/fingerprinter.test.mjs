/**
 * Fingerprinter unit tests — test signal evaluation against saved HTML fixtures.
 *
 * We test fingerprintFromBody() (a pure function) directly rather than fingerprint()
 * (which makes network calls). This keeps tests fast, deterministic, and offline-safe.
 * Live sites change; fixtures keep CI stable.
 */

import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fingerprintFromBody } from '../lib/fingerprinter.mjs';

const FIXTURES = resolve(import.meta.dirname, 'fixtures');

function loadFixture(name) {
    return readFileSync(resolve(FIXTURES, name), 'utf8');
}

describe('fingerprintFromBody', () => {
    describe('WordPressMadara', () => {
        it('identifies Madara from fixture HTML', () => {
            const body = loadFixture('madara-homepage.html');
            const result = fingerprintFromBody(body, 'https://madara-site.com');

            expect(result.template).toBe('WordPressMadara');
            expect(result.confidence).toBeGreaterThanOrEqual(50);
            expect(result.warnings).toHaveLength(0);
        });
    });

    describe('WordPressMangastream', () => {
        it('identifies Mangastream from fixture HTML', () => {
            const body = loadFixture('mangastream-homepage.html');
            const result = fingerprintFromBody(body, 'https://mangastream-site.com');

            expect(result.template).toBe('WordPressMangastream');
            expect(result.confidence).toBeGreaterThanOrEqual(50);
        });
    });

    describe('FoolSlide', () => {
        it('identifies FoolSlide from fixture HTML', () => {
            const body = loadFixture('foolslide-homepage.html');
            const result = fingerprintFromBody(body, 'https://foolslide-site.com');

            expect(result.template).toBe('FoolSlide');
            expect(result.confidence).toBeGreaterThanOrEqual(50);
        });
    });

    describe('empty / unrecognised HTML', () => {
        it('returns null template when no signals match', () => {
            const result = fingerprintFromBody('<html><body>Generic site</body></html>', 'https://unknown.com');
            expect(result.template).toBeNull();
            expect(result.confidence).toBe(0);
        });

        it('returns all 5 templates as candidates even for empty HTML', () => {
            const result = fingerprintFromBody('<html></html>', 'https://unknown.com');
            expect(result.candidates).toHaveLength(5);
        });
    });

    describe('candidate ranking', () => {
        it('best candidate is always first', () => {
            const body = loadFixture('madara-homepage.html');
            const result = fingerprintFromBody(body, 'https://madara-site.com');

            const [first, ...rest] = result.candidates;
            for (const candidate of rest) {
                expect(first.confidence).toBeGreaterThanOrEqual(candidate.confidence);
            }
        });

        it('canonical URL is passed through unchanged', () => {
            const result = fingerprintFromBody('<html></html>', 'https://my-site.com/');
            expect(result.canonicalUrl).toBe('https://my-site.com/');
        });
    });

    describe('url-probe signals', () => {
        it('incorporates url-probe results when provided', () => {
            // Simulate admin-ajax.php probe returning true (WordPress signal)
            const urlProbeResults = new Map([
                ['/wp-admin/admin-ajax.php', true],
            ]);
            const body = '<html><body>Generic</body></html>';
            const result = fingerprintFromBody(body, 'https://wp-site.com', urlProbeResults);

            const madara = result.candidates.find(c => c.template === 'WordPressMadara');
            // Should have the url-probe weight (15) even without other signals
            expect(madara.confidence).toBe(15);
        });
    });

    describe('warnings passthrough', () => {
        it('passes existing warnings through unchanged', () => {
            const result = fingerprintFromBody(
                '<html></html>',
                'https://cf-site.com',
                new Map(),
                ['CloudFlare detected']
            );
            expect(result.warnings).toContain('CloudFlare detected');
        });
    });
});
