/**
 * Dead Link Scanner — classifies all 1,334 connector base URLs as alive,
 * redirected (different domain), cloudflare-protected, or dead.
 *
 * Reuses url-extractor and http-client from the smoke-test harness so no
 * new HTTP code is needed and the extraction avoids importing 1,334 modules.
 *
 * Alive connectors (2xx) are excluded from returned results; only actionable
 * problems surface in the report.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { extractConnectorUrls } from '../../smoke-test/lib/url-extractor.mjs';
import { headOrGet, withConcurrencyLimit } from '../../smoke-test/lib/http-client.mjs';

const CONCURRENCY = 10; // weekly background job — be friendly to external sites
const TIMEOUT_MS = 15_000; // dead sites may slow-TCP-timeout rather than fast-fail

/**
 * @typedef {{
 *   id: string|null,
 *   label: string|null,
 *   url: string,
 *   status: 'redirected'|'cloudflare'|'dead',
 *   statusCode: number|null,
 *   redirectUrl: string|null,
 *   error: string|null,
 *   durationMs: number
 * }} ScanResult
 */

/**
 * Determine whether a response header set indicates CloudFlare is blocking.
 * CF typically returns 403 or 503 with a `cf-ray` header.
 * @param {number} statusCode
 * @param {object} headers
 * @returns {boolean}
 */
function isCloudFlare(statusCode, headers) {
    return (statusCode === 403 || statusCode === 503) && 'cf-ray' in headers;
}

/**
 * Extract the effective final URL after redirects.
 * fetch() with redirect:'follow' does not expose the final URL via response.url
 * in all runtimes, so we probe with a manual redirect chain only when needed.
 * For the dead-link report we only need to know if the domain changed, not the
 * exact final URL — so we make one additional manual HEAD with redirect:'manual'.
 * @param {string} originalUrl
 * @returns {Promise<string|null>}
 */
async function probeRedirectTarget(originalUrl) {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        const res = await fetch(originalUrl, {
            method: 'HEAD',
            redirect: 'manual',
            signal: controller.signal,
        });
        clearTimeout(timer);
        return res.headers.get('location') ?? null;
    } catch {
        return null;
    }
}

/**
 * Return true if `location` points to a different origin than `original`.
 * Same-domain redirects (http→https, bare→www) are not errors.
 * @param {string} original
 * @param {string} location
 * @returns {boolean}
 */
function isDifferentDomain(original, location) {
    try {
        const origHost = new URL(original).hostname.replace(/^www\./, '');
        const locHost = new URL(new URL(location, original).href).hostname.replace(/^www\./, '');
        return origHost !== locHost;
    } catch {
        return false;
    }
}

/**
 * Scan all connector base URLs and classify each.
 * Alive connectors (2xx on the same domain) are excluded from the returned array.
 * @param {Array<{ id: string|null, label: string|null, url: string }>} [connectors]
 *   Optional pre-extracted list; avoids a redundant disk read when the CLI
 *   already called extractConnectorUrls().
 * @returns {Promise<ScanResult[]>}
 */
export async function scanDeadLinks(connectors) {
    if (!connectors) connectors = extractConnectorUrls().filter(c => c.url);

    const tasks = connectors.map(connector => async () => {
        const { status, headers, durationMs, error } = await headOrGet(connector.url, TIMEOUT_MS);

        // headOrGet uses redirect:'follow', so 2xx may be the result of a
        // followed redirect chain.  Probe with redirect:'manual' to detect
        // cross-domain redirects that headOrGet silently resolved.
        if (status >= 200 && status < 300) {
            const location = await probeRedirectTarget(connector.url);
            if (location && isDifferentDomain(connector.url, location)) {
                return /** @type {ScanResult} */ {
                    id:          connector.id,
                    label:       connector.label,
                    url:         connector.url,
                    status:      'redirected',
                    statusCode:  status,
                    redirectUrl: location,
                    error:       null,
                    durationMs,
                };
            }
            // Truly alive (no redirect, or same-domain redirect) — omit
            return null;
        }

        // CloudFlare block — list separately (informational; likely alive in Electron)
        if (isCloudFlare(status, headers)) {
            return /** @type {ScanResult} */ {
                id:          connector.id,
                label:       connector.label,
                url:         connector.url,
                status:      'cloudflare',
                statusCode:  status,
                redirectUrl: null,
                error:       null,
                durationMs,
            };
        }

        // Network error / timeout / DNS failure
        if (error) {
            return /** @type {ScanResult} */ {
                id:          connector.id,
                label:       connector.label,
                url:         connector.url,
                status:      'dead',
                statusCode:  null,
                redirectUrl: null,
                error:       error.message ?? String(error),
                durationMs,
            };
        }

        // 4xx / 5xx (non-CF)
        return /** @type {ScanResult} */ {
            id:          connector.id,
            label:       connector.label,
            url:         connector.url,
            status:      'dead',
            statusCode:  status,
            redirectUrl: null,
            error:       null,
            durationMs,
        };
    });

    const raw = await withConcurrencyLimit(tasks, CONCURRENCY);
    return raw.filter(Boolean);
}

/**
 * Format scan results as GitHub-flavored markdown.
 * Embeds scan date and totals. Returned string is stored in the JSON report
 * as `markdownBody` for consumption by the GitHub Actions workflow.
 * @param {ScanResult[]} results
 * @param {string} scanDate - ISO date string (YYYY-MM-DD)
 * @param {number} totalScanned
 * @param {number} elapsedSec - Wall-clock seconds for the full scan
 * @returns {string}
 */
export function formatReport(results, scanDate, totalScanned, elapsedSec) {
    const MAX_BODY_CHARS = 60_000;
    const MAX_ROWS_PER_SECTION = 150;

    const dead = results.filter(r => r.status === 'dead');
    const redirected = results.filter(r => r.status === 'redirected');
    const cloudflare = results.filter(r => r.status === 'cloudflare');

    const tableRow = (cols) => `| ${cols.join(' | ')} |`;

    /**
     * Build a markdown table section with a row cap.
     * @param {ScanResult[]} items
     * @param {string[]} headerCols
     * @param {function(ScanResult): string[]} rowMapper
     * @returns {string}
     */
    function buildSection(items, headerCols, rowMapper) {
        if (items.length === 0) return '_None_\n';
        const shown = items.slice(0, MAX_ROWS_PER_SECTION);
        const omitted = items.length - shown.length;
        const lines = [
            tableRow(headerCols),
            tableRow(headerCols.map(() => '---')),
            ...shown.map(r => tableRow(rowMapper(r))),
        ];
        if (omitted > 0) {
            lines.push('', `_…and ${omitted} more (see artifact for full list)_`);
        }
        lines.push('');
        return lines.join('\n');
    }

    const deadSection = buildSection(
        dead,
        ['Connector', 'URL', 'Status', 'Error'],
        r => [
            r.label ?? r.id ?? '—',
            r.url,
            r.statusCode ? String(r.statusCode) : 'timeout/DNS',
            r.error ? r.error.slice(0, 80).replace(/\s\S*$/, '…') : '—',
        ],
    );

    const redirectedSection = buildSection(
        redirected,
        ['Connector', 'Original URL', 'Redirected To', 'Status'],
        r => [
            r.label ?? r.id ?? '—',
            r.url,
            r.redirectUrl ?? '—',
            r.statusCode ? String(r.statusCode) : '—',
        ],
    );

    const cfSection = buildSection(
        cloudflare,
        ['Connector', 'URL'],
        r => [r.label ?? r.id ?? '—', r.url],
    );

    let body = [
        `## Dead Link Scan — ${scanDate}`,
        '',
        `Scanned **${totalScanned}** connectors. Found **${results.length}** issues.`,
        '',
        `### Dead (4xx/5xx/timeout) — ${dead.length} connectors`,
        deadSection,
        `### Redirected (different domain) — ${redirected.length} connectors`,
        redirectedSection,
        `### CloudFlare Protected — ${cloudflare.length} connectors (informational)`,
        cfSection,
        `_Scan completed in ${elapsedSec.toFixed(1)}s. CloudFlare-protected connectors may still be alive — listed for awareness only._`,
    ].join('\n');

    if (body.length > MAX_BODY_CHARS) {
        const notice = '\n\n_⚠️ Report truncated — see the uploaded JSON artifact for the full list._';
        body = body.slice(0, MAX_BODY_CHARS - notice.length) + notice;
    }

    return body;
}

// ─── CLI entry point ─────────────────────────────────────────────────────────
// Run directly:  bun run lib/dead-link-scanner.mjs [--output=json]
// Exit code is always 0 — dead connectors are informational, not build-blocking.

if (import.meta.url === `file://${process.argv[1]}`) {
    const jsonMode = process.argv.includes('--output=json');
    const scanDate = new Date().toISOString().slice(0, 10);
    const scanStart = Date.now();

    console.error(`[dead-link-scanner] Starting scan (concurrency=${CONCURRENCY}, timeout=${TIMEOUT_MS}ms) …`);

    const connectors = extractConnectorUrls().filter(c => c.url);
    const totalScanned = connectors.length;
    const results = await scanDeadLinks(connectors);
    const elapsedSec = (Date.now() - scanStart) / 1000;
    const markdownBody = formatReport(results, scanDate, totalScanned, elapsedSec);

    if (jsonMode) {
        const reportsDir = resolve(import.meta.dirname, '..', 'reports');
        await mkdir(reportsDir, { recursive: true });
        const outPath = resolve(reportsDir, `dead-links-${scanDate}.json`);
        const payload = {
            scanDate,
            totalScanned,
            totalProblematic: results.length,
            results,
            markdownBody,
        };
        await writeFile(outPath, JSON.stringify(payload, null, 2));
        console.error(`[dead-link-scanner] Report written to ${outPath}`);
    } else {
        console.log(markdownBody);
    }

    const elapsed = ((Date.now() - scanStart) / 1000).toFixed(1);
    console.error(`[dead-link-scanner] Done in ${elapsed}s. Found ${results.length} issues out of ${totalScanned} connectors.`);
    process.exit(0);
}
