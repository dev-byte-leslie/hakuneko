/**
 * Report writer — outputs JUnit XML and JSON summary files.
 * Compatible with dorny/test-reporter and jest-junit schema.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const REPORTS_DIR = resolve(import.meta.dirname, '..', 'reports');

/**
 * Escape XML special characters.
 * @param {string} str
 * @returns {string}
 */
function escapeXml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Write test results as JUnit XML and JSON summary.
 * @param {number} tier - Tier number (1, 2, or 3)
 * @param {Array<{ name: string, status: 'pass'|'fail'|'skip'|'skip_cloudflare', durationMs: number, error?: string }>} results
 */
export function writeReport(tier, results) {
    mkdirSync(REPORTS_DIR, { recursive: true });

    const passed = results.filter(r => r.status === 'pass');
    const failed = results.filter(r => r.status === 'fail');
    const skipped = results.filter(r => r.status === 'skip' || r.status === 'skip_cloudflare');
    const totalTime = results.reduce((sum, r) => sum + (r.durationMs || 0), 0) / 1000;

    // JUnit XML
    const testcases = results.map(r => {
        const attrs = `classname="smoke.tier${tier}" name="${escapeXml(r.name)}" time="${((r.durationMs || 0) / 1000).toFixed(3)}"`;
        if (r.status === 'pass') {
            return `    <testcase ${attrs} />`;
        }
        if (r.status === 'skip' || r.status === 'skip_cloudflare') {
            return `    <testcase ${attrs}>\n      <skipped message="${escapeXml(r.status)}" />\n    </testcase>`;
        }
        return `    <testcase ${attrs}>\n      <failure message="${escapeXml(r.error || 'Unknown error')}" />\n    </testcase>`;
    }).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="smoke-tier${tier}" tests="${results.length}" failures="${failed.length}" skipped="${skipped.length}" time="${totalTime.toFixed(3)}">
${testcases}
  </testsuite>
</testsuites>
`;

    writeFileSync(resolve(REPORTS_DIR, `tier${tier}-junit.xml`), xml, 'utf8');

    // JSON summary
    const summary = {
        tier,
        timestamp: new Date().toISOString(),
        totals: {
            total: results.length,
            passed: passed.length,
            failed: failed.length,
            skipped: skipped.length,
            durationMs: Math.round(totalTime * 1000),
        },
        results: results.map(r => ({
            name: r.name,
            status: r.status,
            durationMs: r.durationMs,
            ...(r.error ? { error: r.error } : {}),
            ...(r.details ? { details: r.details } : {}),
        })),
    };

    writeFileSync(
        resolve(REPORTS_DIR, `tier${tier}-summary.json`),
        JSON.stringify(summary, null, 2),
        'utf8'
    );

    // Console summary
    console.log(`\n--- Tier ${tier} Summary ---`);
    console.log(`Total: ${results.length} | Pass: ${passed.length} | Fail: ${failed.length} | Skip: ${skipped.length}`);
    console.log(`Duration: ${totalTime.toFixed(1)}s`);
    console.log(`Reports: reports/tier${tier}-junit.xml, reports/tier${tier}-summary.json\n`);
}
