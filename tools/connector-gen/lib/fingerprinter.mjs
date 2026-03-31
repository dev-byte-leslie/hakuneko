/**
 * Fingerprinter engine — identifies which CMS template a site uses.
 *
 * Algorithm:
 *  1. Fetch the site homepage via url-prober (manual redirect following)
 *  2. Parse HTML with node-html-parser (fast static parse, no full DOM needed)
 *  3. Evaluate weighted signals from fingerprints.json against the page
 *  4. URL probes for all templates run in parallel (Promise.all) to minimise latency
 *  5. Return ranked candidates with confidence scores and warnings
 *
 * Using saved HTML fixtures in tests (test/fixtures/) keeps CI deterministic —
 * live sites change and would make fingerprint tests flaky.
 */

import { parse } from 'node-html-parser';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { probeUrl, probePath } from './url-prober.mjs';

// Load the signal database at module init (synchronous, tiny file)
const fingerprintsPath = resolve(import.meta.dirname, '..', 'data', 'fingerprints.json');
const { templates: TEMPLATES } = JSON.parse(readFileSync(fingerprintsPath, 'utf8'));

/**
 * @typedef {Object} Candidate
 * @property {string} template - Template class name
 * @property {number} confidence - Score 0-100+
 * @property {number} matchedSignals - Number of signals that matched
 */

/**
 * @typedef {Object} FingerprintResult
 * @property {string|null} template - Best matching template class name, or null if none exceeded threshold
 * @property {number} confidence - Confidence score of best match (0 if no match)
 * @property {Candidate[]} candidates - All templates ranked by confidence descending
 * @property {string} canonicalUrl - Final URL after redirects
 * @property {string[]} warnings - Non-fatal warnings (e.g. CloudFlare detected)
 */

/**
 * Fingerprint a site URL to determine which HakuNeko connector template it uses.
 * @param {string} url
 * @returns {Promise<FingerprintResult>}
 */
export async function fingerprint(url) {
    const warnings = [];

    // Fetch and probe the homepage
    const probe = await probeUrl(url);

    if (probe.error) {
        return {
            template: null,
            confidence: 0,
            candidates: [],
            canonicalUrl: url,
            warnings: [`Fetch failed: ${probe.error.message}`],
        };
    }

    if (probe.isCloudflare) {
        warnings.push('CloudFlare detected — fingerprint results may be unreliable. Use --template to override.');
    }

    const canonicalUrl = probe.finalUrl;
    // Run all url-probe signals in parallel across templates to minimise latency
    const urlProbeResults = await _runUrlProbesParallel(canonicalUrl);

    return fingerprintFromBody(probe.body, canonicalUrl, urlProbeResults, warnings);
}

/**
 * Pure function: evaluate signals against already-fetched HTML body.
 * Exposed separately so tests can call it directly with fixture HTML
 * without needing to mock the network layer.
 *
 * @param {string} body - Raw HTML string
 * @param {string} canonicalUrl - Final URL after redirects
 * @param {Map<string,boolean>} [urlProbeResults] - Pre-computed url-probe results
 * @param {string[]} [warnings] - Accumulated warnings to pass through
 * @returns {FingerprintResult}
 */
export function fingerprintFromBody(body, canonicalUrl, urlProbeResults = new Map(), warnings = []) {
    const root = parse(body);

    // Extract <script> tag text content once for script-var checks
    // We query the parsed DOM rather than regex raw HTML to avoid matching
    // script src attributes or other non-code occurrences.
    const scriptContent = root.querySelectorAll('script')
        .map(s => s.rawText)
        .join('\n');

    // Score each template
    const candidates = Object.entries(TEMPLATES).map(([templateName, config]) => {
        let score = 0;
        let matchedSignals = 0;

        for (const signal of config.signals) {
            const hit = _evaluateSignal(signal, body, root, scriptContent, urlProbeResults);
            if (hit) {
                score += signal.weight;
                matchedSignals++;
            }
        }

        return { template: templateName, confidence: score, matchedSignals };
    });

    // Sort by confidence descending, then by matchedSignals as tiebreaker
    candidates.sort((a, b) =>
        b.confidence !== a.confidence
            ? b.confidence - a.confidence
            : b.matchedSignals - a.matchedSignals
    );

    const best = candidates[0];
    const threshold = TEMPLATES[best?.template]?.threshold ?? 50;
    const matched = best && best.confidence >= threshold ? best : null;

    return {
        template: matched?.template ?? null,
        confidence: matched?.confidence ?? 0,
        candidates,
        canonicalUrl,
        warnings,
    };
}

/**
 * Run url-probe signals for all templates in parallel.
 * Returns a Map<path, boolean> of probe results.
 * @param {string} baseUrl
 * @returns {Promise<Map<string, boolean>>}
 */
async function _runUrlProbesParallel(baseUrl) {
    const paths = new Set();
    for (const config of Object.values(TEMPLATES)) {
        for (const signal of config.signals) {
            if (signal.type === 'url-probe') {
                paths.add(signal.value);
            }
        }
    }

    const entries = [...paths];
    const results = await Promise.all(
        entries.map(path => probePath(baseUrl, path))
    );

    const map = new Map();
    entries.forEach((path, i) => map.set(path, results[i]));
    return map;
}

/**
 * Evaluate a single signal against the fetched page data.
 * @param {Object} signal
 * @param {string} body - Raw HTML string
 * @param {import('node-html-parser').HTMLElement} root - Parsed DOM root
 * @param {string} scriptContent - Concatenated script tag text
 * @param {Map<string,boolean>} urlProbeResults
 * @returns {boolean}
 */
function _evaluateSignal(signal, body, root, scriptContent, urlProbeResults) {
    switch (signal.type) {
        case 'html-content':
            return body.includes(signal.value);

        case 'html-selector':
            return root.querySelector(signal.value) !== null;

        case 'script-var':
            return scriptContent.includes(signal.value);

        case 'url-probe':
            return urlProbeResults.get(signal.value) ?? false;

        default:
            return false;
    }
}

/**
 * Expose TEMPLATES config for use in generator defaults.
 * @param {string} templateName
 * @returns {{ path: string, import: string }|undefined}
 */
export function getTemplateDefaults(templateName) {
    return TEMPLATES[templateName]?.defaults;
}
