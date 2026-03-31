/**
 * URL prober unit tests — use dependency-injected fetch to avoid live network calls
 * and module caching issues with globalThis mocking.
 */

import { describe, it, expect } from 'bun:test';
import { probeUrl, probePath } from '../lib/url-prober.mjs';

/** Build a minimal fetch mock that returns given responses in sequence */
function mockFetchSequence(...responses) {
    let callIndex = 0;
    return async () => responses[callIndex++];
}

function makeFetchResponse({ status = 200, headers = {}, body = '' } = {}) {
    return {
        status,
        headers: {
            get: (h) => headers[h.toLowerCase()] ?? null,
            entries: () => Object.entries(headers),
        },
        text: async () => body,
    };
}

describe('probeUrl', () => {
    it('returns status and body on 200', async () => {
        const mockFetch = mockFetchSequence(
            makeFetchResponse({ status: 200, body: '<html>Hello</html>' })
        );

        const result = await probeUrl('https://example.com', {}, mockFetch);
        expect(result.status).toBe(200);
        expect(result.body).toBe('<html>Hello</html>');
        expect(result.error).toBeNull();
        expect(result.isCloudflare).toBe(false);
        expect(result.redirectCount).toBe(0);
    });

    it('follows a redirect and returns the final URL', async () => {
        const mockFetch = mockFetchSequence(
            // First call: 301 to www
            makeFetchResponse({
                status: 301,
                headers: { location: 'https://www.example.com' },
            }),
            // Second call: 200 OK
            makeFetchResponse({ status: 200, body: '<html>Redirected</html>' }),
        );

        const result = await probeUrl('https://example.com', {}, mockFetch);
        // URL constructor normalises bare origins to have a trailing slash
        expect(result.finalUrl).toBe('https://www.example.com/');
        expect(result.redirectCount).toBe(1);
        expect(result.status).toBe(200);
        expect(result.body).toBe('<html>Redirected</html>');
    });

    it('detects CloudFlare via cf-ray header', async () => {
        const mockFetch = mockFetchSequence(
            makeFetchResponse({
                status: 403,
                headers: { 'cf-ray': '1234abc-SFO' },
                body: '<html>Just a moment...</html>',
            })
        );

        const result = await probeUrl('https://cf-site.com', {}, mockFetch);
        expect(result.isCloudflare).toBe(true);
    });

    it('returns error result on network failure', async () => {
        const mockFetch = async () => { throw new Error('ECONNREFUSED'); };

        const result = await probeUrl('https://dead.example.com', {}, mockFetch);
        expect(result.status).toBe(0);
        expect(result.error).not.toBeNull();
        expect(result.error.message).toBe('ECONNREFUSED');
        expect(result.body).toBe('');
    });

    it('stops following redirects after MAX_REDIRECTS', async () => {
        // Return 301 indefinitely
        const mockFetch = async () => makeFetchResponse({
            status: 301,
            headers: { location: 'https://loop.example.com' },
        });

        const result = await probeUrl('https://loop.example.com', {}, mockFetch);
        // Should not throw — should just return what we have after max hops
        expect(result.redirectCount).toBeGreaterThan(0);
    });
});

describe('probePath', () => {
    it('returns true for 2xx responses', async () => {
        const mockFetch = async () => makeFetchResponse({ status: 200 });
        const result = await probePath('https://example.com', '/wp-admin/admin-ajax.php', mockFetch);
        expect(result).toBe(true);
    });

    it('returns true for 400 (WordPress AJAX endpoint responds 400 without action)', async () => {
        const mockFetch = async () => makeFetchResponse({ status: 400 });
        const result = await probePath('https://example.com', '/wp-admin/admin-ajax.php', mockFetch);
        expect(result).toBe(true);
    });

    it('returns false for 5xx responses', async () => {
        const mockFetch = async () => makeFetchResponse({ status: 500 });
        const result = await probePath('https://example.com', '/nonexistent', mockFetch);
        expect(result).toBe(false);
    });

    it('returns false on network error', async () => {
        const mockFetch = async () => { throw new Error('timeout'); };
        const result = await probePath('https://dead.example.com', '/path', mockFetch);
        expect(result).toBe(false);
    });
});
