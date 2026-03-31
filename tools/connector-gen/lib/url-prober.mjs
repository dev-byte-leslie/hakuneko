/**
 * URL prober — fetches a site's homepage, follows redirects manually to capture
 * the canonical URL after hops (http→https, bare→www), and detects CloudFlare
 * challenge pages via the cf-ray header.
 *
 * We use manual redirect following (redirect: 'manual') instead of
 * redirect: 'follow' because native fetch hides intermediate URLs —
 * we need the canonical URL for the fingerprinter and the generator.
 */

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 5;
const USER_AGENT = 'Mozilla/5.0 (compatible; HakuNeko-ConnectorGen/1.0; +https://github.com/niklaslong/hakuneko)';

/**
 * @typedef {Object} ProbeResult
 * @property {number} status - Final HTTP status code (0 on network error)
 * @property {string} finalUrl - Canonical URL after all redirects
 * @property {Record<string,string>} headers - Response headers of final response
 * @property {string} body - Response body text
 * @property {boolean} isCloudflare - True if cf-ray header is present (challenge page likely)
 * @property {number} redirectCount - Number of redirects followed
 * @property {number} durationMs - Total request duration
 * @property {Error|null} error - Network/timeout error, null on success
 */

/**
 * Probe a URL, following redirects manually to capture the canonical URL.
 * @param {string} url
 * @param {{ timeoutMs?: number }} opts
 * @param {typeof fetch} [_fetch] - Injectable fetch for testing
 * @returns {Promise<ProbeResult>}
 */
export async function probeUrl(url, opts = {}, _fetch = fetch) {
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const start = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let currentUrl = url;
    let redirectCount = 0;
    let lastResponse = null;
    let body = '';

    try {
        while (redirectCount <= MAX_REDIRECTS) {
            const response = await _fetch(currentUrl, {
                method: 'GET',
                redirect: 'manual',
                signal: controller.signal,
                headers: { 'User-Agent': USER_AGENT },
            });

            lastResponse = response;

            // Follow 3xx redirects manually to capture each hop URL
            if (response.status >= 300 && response.status < 400) {
                const location = response.headers.get('location');
                if (!location) break;
                // Resolve relative redirects against the current URL
                currentUrl = new URL(location, currentUrl).href;
                redirectCount++;
                continue;
            }

            body = await response.text();
            break;
        }

        clearTimeout(timer);

        const headers = lastResponse
            ? Object.fromEntries(lastResponse.headers.entries())
            : {};

        return {
            status: lastResponse?.status ?? 0,
            finalUrl: currentUrl,
            headers,
            body,
            isCloudflare: 'cf-ray' in headers,
            redirectCount,
            durationMs: Date.now() - start,
            error: null,
        };
    } catch (error) {
        clearTimeout(timer);
        return {
            status: 0,
            finalUrl: currentUrl,
            headers: {},
            body: '',
            isCloudflare: false,
            redirectCount,
            durationMs: Date.now() - start,
            error,
        };
    }
}

/**
 * Check whether a specific path on a site returns a 2xx response.
 * Used for CMS-specific path probing — e.g. /wp-admin/admin-ajax.php
 * returning 200 or 400 is a strong WordPress signal.
 * @param {string} baseUrl
 * @param {string} path
 * @param {typeof fetch} [_fetch] - Injectable fetch for testing
 * @returns {Promise<boolean>}
 */
export async function probePath(baseUrl, path, _fetch = fetch) {
    const url = new URL(path, baseUrl).href;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
        const response = await _fetch(url, {
            method: 'HEAD',
            redirect: 'follow',
            signal: controller.signal,
            headers: { 'User-Agent': USER_AGENT },
        });
        clearTimeout(timer);
        return response.status >= 200 && response.status < 500;
    } catch {
        clearTimeout(timer);
        return false;
    }
}
