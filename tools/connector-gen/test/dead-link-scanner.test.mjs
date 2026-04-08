/**
 * Unit tests for dead-link-scanner.mjs.
 *
 * scanDeadLinks() and probeRedirectTarget() both use the global fetch.
 * We replace globalThis.fetch before each test and restore it after so
 * tests remain isolated without importing a DI-aware wrapper.
 *
 * formatReport() is a pure function — no mocking needed.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { scanDeadLinks, formatReport } from '../lib/dead-link-scanner.mjs';

// ─── fetch mock helpers ───────────────────────────────────────────────────────

let originalFetch;

/**
 * Build a minimal Response-like object compatible with headOrGet and
 * probeRedirectTarget's usage of fetch().
 */
function makeResponse({ status = 200, headers = {} } = {}) {
    return {
        status,
        headers: {
            get: (h) => headers[h.toLowerCase()] ?? null,
            entries: () => Object.entries(headers),
        },
    };
}

/**
 * Replace globalThis.fetch with a mock that returns the given responses
 * in sequence across ALL calls (HEAD, optional GET retry, redirect probe).
 */
function mockFetch(...responses) {
    let idx = 0;
    globalThis.fetch = async () => responses[idx++] ?? makeResponse({ status: 200 });
}

beforeEach(() => {
    originalFetch = globalThis.fetch;
});
afterEach(() => {
    globalThis.fetch = originalFetch;
});

// ─── single connector fixture ─────────────────────────────────────────────────

const conn = [{ id: 'test-connector', label: 'Test Connector', url: 'https://example.com' }];

// ─── scanDeadLinks ────────────────────────────────────────────────────────────

describe('scanDeadLinks', () => {
    it('omits alive connectors (2xx, no cross-domain redirect)', async () => {
        // Call 1: headOrGet HEAD → 200
        // Call 2: probeRedirectTarget HEAD manual → no Location header
        mockFetch(
            makeResponse({ status: 200 }),
            makeResponse({ status: 200 }),
        );

        const results = await scanDeadLinks(conn);
        expect(results).toHaveLength(0);
    });

    it('omits same-domain redirects (http→https counts as alive)', async () => {
        // Call 1: headOrGet HEAD → 200
        // Call 2: probeRedirectTarget → Location: https://example.com (same host)
        mockFetch(
            makeResponse({ status: 200 }),
            makeResponse({ status: 301, headers: { location: 'https://example.com/new-path' } }),
        );

        const results = await scanDeadLinks(conn);
        expect(results).toHaveLength(0);
    });

    it('flags cross-domain redirects as redirected', async () => {
        // Call 1: headOrGet HEAD → 200 (fetch followed the redirect silently)
        // Call 2: probeRedirectTarget → Location pointing to different domain
        mockFetch(
            makeResponse({ status: 200 }),
            makeResponse({ status: 301, headers: { location: 'https://other-domain.com/path' } }),
        );

        const results = await scanDeadLinks(conn);
        expect(results).toHaveLength(1);
        expect(results[0].status).toBe('redirected');
        expect(results[0].redirectUrl).toBe('https://other-domain.com/path');
        expect(results[0].id).toBe('test-connector');
    });

    it('flags CloudFlare-blocked connectors (403 + cf-ray header)', async () => {
        // headOrGet retries 403 HEAD with GET — both must return 403+cf-ray so the
        // final status seen by scanDeadLinks is still 403 with CF headers.
        const cfResponse = makeResponse({ status: 403, headers: { 'cf-ray': 'abc123-SFO' } });
        mockFetch(cfResponse, cfResponse);

        const results = await scanDeadLinks(conn);
        expect(results).toHaveLength(1);
        expect(results[0].status).toBe('cloudflare');
        expect(results[0].statusCode).toBe(403);
    });

    it('flags 503 + cf-ray as CloudFlare', async () => {
        // 503 is not retried by headOrGet (only 403/405 trigger the GET retry)
        mockFetch(
            makeResponse({ status: 503, headers: { 'cf-ray': 'xyz-LHR' } }),
        );

        const results = await scanDeadLinks(conn);
        expect(results).toHaveLength(1);
        expect(results[0].status).toBe('cloudflare');
    });

    it('does not flag 403 without cf-ray as CloudFlare (marks dead)', async () => {
        // headOrGet retries 403 HEAD with GET; both responses have no cf-ray
        const plain403 = makeResponse({ status: 403 });
        mockFetch(plain403, plain403);

        const results = await scanDeadLinks(conn);
        expect(results).toHaveLength(1);
        expect(results[0].status).toBe('dead');
        expect(results[0].statusCode).toBe(403);
    });

    it('flags 404 as dead with statusCode', async () => {
        mockFetch(
            makeResponse({ status: 404 }),
        );

        const results = await scanDeadLinks(conn);
        expect(results).toHaveLength(1);
        expect(results[0].status).toBe('dead');
        expect(results[0].statusCode).toBe(404);
        expect(results[0].error).toBeNull();
    });

    it('flags network error as dead with error message', async () => {
        globalThis.fetch = async () => {
            throw new Error('ECONNREFUSED');
        };

        const results = await scanDeadLinks(conn);
        expect(results).toHaveLength(1);
        expect(results[0].status).toBe('dead');
        expect(results[0].statusCode).toBeNull();
        expect(results[0].error).toBe('ECONNREFUSED');
    });

    it('accepts a pre-extracted connector list (skips disk read)', async () => {
        mockFetch(makeResponse({ status: 200 }), makeResponse({ status: 200 }));
        // Passing connectors directly should not throw even when extractConnectorUrls
        // is unavailable in the test environment.
        const results = await scanDeadLinks(conn);
        expect(Array.isArray(results)).toBe(true);
    });
});

// ─── formatReport ─────────────────────────────────────────────────────────────

describe('formatReport', () => {
    it('renders _None_ sections when there are no results', () => {
        const md = formatReport([], '2026-03-31', 100, 12.3);
        expect(md).toContain('Scanned **100** connectors. Found **0** issues.');
        expect(md).toMatch(/_None_/);
    });

    it('includes dead connector rows', () => {
        const results = [{
            id: 'dead-conn', label: 'Dead Site', url: 'https://dead.example.com',
            status: 'dead', statusCode: 404, redirectUrl: null, error: null, durationMs: 200,
        }];
        const md = formatReport(results, '2026-03-31', 50, 5.0);
        expect(md).toContain('Dead Site');
        expect(md).toContain('https://dead.example.com');
        expect(md).toContain('404');
    });

    it('includes redirected connector rows', () => {
        const results = [{
            id: 'redir-conn', label: 'Redirected', url: 'https://old.example.com',
            status: 'redirected', statusCode: 200, redirectUrl: 'https://new-domain.com/', error: null, durationMs: 100,
        }];
        const md = formatReport(results, '2026-03-31', 50, 3.0);
        expect(md).toContain('https://new-domain.com/');
        expect(md).toContain('Redirected');
    });

    it('includes cloudflare connector rows', () => {
        const results = [{
            id: 'cf-conn', label: 'CF Site', url: 'https://cf.example.com',
            status: 'cloudflare', statusCode: 403, redirectUrl: null, error: null, durationMs: 50,
        }];
        const md = formatReport(results, '2026-03-31', 50, 2.0);
        expect(md).toContain('CF Site');
        expect(md).toContain('CloudFlare Protected');
    });

    it('truncates long error messages at a word boundary', () => {
        const longError = 'connect ECONNREFUSED: this is a very descriptive network error message that exceeds eighty characters';
        const results = [{
            id: 'e', label: 'Err', url: 'https://x.com',
            status: 'dead', statusCode: null, redirectUrl: null, error: longError, durationMs: 100,
        }];
        const md = formatReport(results, '2026-03-31', 1, 1.0);
        // The truncated string should end with '…' and not cut mid-word
        const match = md.match(/connect ECONNREFUSED[^|]*/);
        expect(match).not.toBeNull();
        const cell = match[0].trim();
        // Must end with '…' (word-boundary truncation applied)
        expect(cell.endsWith('…')).toBe(true);
        // The character immediately before '…' must not be a space —
        // confirming we trimmed to a complete word, not a trailing space.
        expect(cell.at(-2)).not.toBe(' ');
    });

    it('stays under 65,536 chars with 500+ results per category', () => {
        const makeBulk = (status, count) => Array.from({ length: count }, (_, i) => ({
            id: `${status}-${i}`,
            label: `${status} Connector ${i}`,
            url: `https://${status}-site-${i}.example.com/very/long/path/segment`,
            status,
            statusCode: status === 'dead' ? 404 : status === 'cloudflare' ? 403 : 200,
            redirectUrl: status === 'redirected' ? `https://new-domain-${i}.example.com/` : null,
            error: status === 'dead' ? 'connect ECONNREFUSED 127.0.0.1:443' : null,
            durationMs: 100,
        }));

        const results = [
            ...makeBulk('dead', 500),
            ...makeBulk('redirected', 500),
            ...makeBulk('cloudflare', 500),
        ];

        const md = formatReport(results, '2026-04-07', 1500, 120.0);
        expect(md.length).toBeLessThan(65_536);
        // Verify truncation notice appears for at least one section
        expect(md).toContain('…and');
        expect(md).toContain('see artifact for full list');
    });

    it('uses em-dash when error is null', () => {
        const results = [{
            id: 'x', label: 'X', url: 'https://x.com',
            status: 'dead', statusCode: 500, redirectUrl: null, error: null, durationMs: 10,
        }];
        const md = formatReport(results, '2026-03-31', 1, 0.5);
        expect(md).toContain('—');
    });
});
