/**
 * Tier 1: URL Validation — HTTP HEAD on every connector's base URL.
 * Classifies results as pass (2xx/3xx), skip_cloudflare (403/503 + cf-ray), or fail.
 * Uses text-based URL extraction (no dynamic imports) to stay lightweight.
 * Expected wall time: ~4-5 min for ~1,334 connectors at concurrency=50.
 */
import { extractConnectorUrls } from '../lib/url-extractor.mjs';
import { headOrGet, withConcurrencyLimit } from '../lib/http-client.mjs';
import { writeReport } from '../lib/report-writer.mjs';

/** System connectors without a meaningful URL to check */
const SYSTEM_CONNECTOR_IDS = ['bookmarks', 'clipboard', 'folderwatch'];

/**
 * Classify an HTTP response into a smoke test status.
 * @param {{ status: number, headers: object, error: Error|null }} result
 * @returns {'pass' | 'fail' | 'skip_cloudflare'}
 */
function classify({ status, headers, error }) {
    if (error) return 'fail';
    if (status >= 200 && status < 400) return 'pass';
    // CloudFlare challenge pages return 403 or 503 with cf-ray header
    if ((status === 403 || status === 503) && headers['cf-ray']) return 'skip_cloudflare';
    return 'fail';
}

export async function runTier1() {
    console.log('Extracting connector URLs from source (no dynamic imports)...');
    const entries = extractConnectorUrls();
    console.log(`Found ${entries.length} connector files`);

    // Filter out system connectors and those without a URL
    const testable = entries.filter(entry => {
        if (!entry.url) return false;
        const id = (entry.id || entry.file.replace('.mjs', '')).toLowerCase();
        return !SYSTEM_CONNECTOR_IDS.includes(id);
    });

    console.log(`Testing ${testable.length} connector URLs (concurrency=50, timeout=10s)...`);

    const tasks = testable.map(entry => async () => {
        const label = entry.label || entry.file;
        const httpResult = await headOrGet(entry.url, 10_000);
        const status = classify(httpResult);
        return {
            name: label,
            status,
            durationMs: httpResult.durationMs,
            ...(status === 'fail' ? {
                error: httpResult.error
                    ? httpResult.error.message
                    : `HTTP ${httpResult.status}`,
            } : {}),
            details: {
                url: entry.url,
                httpStatus: httpResult.status,
            },
        };
    });

    const results = await withConcurrencyLimit(tasks, 50);
    writeReport(1, results);
    return results;
}
