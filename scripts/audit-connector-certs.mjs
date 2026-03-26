#!/usr/bin/env node

/**
 * HAKU-0006a: Audit connector domains for certificate issues.
 *
 * Reads the first 50 connector files (alphabetical), extracts the URL each
 * one sets in its constructor, and attempts a strict TLS connection.
 * Reports which domains fail and with what error.
 *
 * Usage: node scripts/audit-connector-certs.mjs
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import https from 'node:https';

const CONNECTORS_DIR = join(import.meta.dirname, '..', 'src', 'web', 'mjs', 'connectors');
const MAX_CONNECTORS = 50;
const TIMEOUT_MS = 10_000;

/**
 * Extract the URL from a connector source file by regex.
 * Connectors set their URL via patterns like:
 *   this.url = 'https://...'
 *   value: 'https://...'   (in config blocks)
 */
function extractUrl(source) {
    // Try this.url = '...' first
    const directMatch = source.match(/this\.url\s*=\s*['"]([^'"]+)['"]/);
    if (directMatch) return directMatch[1];

    // Try config value pattern
    const configMatch = source.match(/value:\s*['"]([^'"]+)['"]/);
    if (configMatch && configMatch[1].startsWith('http')) return configMatch[1];

    return null;
}

/**
 * Attempt a strict HTTPS HEAD request. Rejects on any cert error.
 */
function checkCert(hostname) {
    return new Promise((resolve) => {
        const req = https.request(
            {
                hostname,
                port: 443,
                path: '/',
                method: 'HEAD',
                timeout: TIMEOUT_MS,
                rejectUnauthorized: true,
            },
            (res) => {
                res.resume();
                resolve({ hostname, ok: true, status: res.statusCode });
            }
        );
        req.on('error', (err) => {
            resolve({ hostname, ok: false, error: err.code || err.message });
        });
        req.on('timeout', () => {
            req.destroy();
            resolve({ hostname, ok: false, error: 'TIMEOUT' });
        });
        req.end();
    });
}

async function main() {
    const files = (await readdir(CONNECTORS_DIR))
        .filter((f) => f.endsWith('.mjs') && !f.startsWith('.'))
        .sort()
        .slice(0, MAX_CONNECTORS);

    console.log(`Auditing ${files.length} connectors for cert issues...\n`);

    const results = [];

    for (const file of files) {
        const source = await readFile(join(CONNECTORS_DIR, file), 'utf-8');
        const url = extractUrl(source);

        if (!url) {
            results.push({ file, hostname: null, skipped: true });
            continue;
        }

        let hostname;
        try {
            hostname = new URL(url).hostname;
        } catch {
            results.push({ file, hostname: url, skipped: true, reason: 'invalid URL' });
            continue;
        }

        // Skip duplicates
        if (results.some((r) => r.hostname === hostname)) {
            results.push({ file, hostname, skipped: true, reason: 'duplicate' });
            continue;
        }

        const result = await checkCert(hostname);
        results.push({ file, ...result });

        const icon = result.ok ? '✓' : '✗';
        const detail = result.ok ? `status ${result.status}` : result.error;
        console.log(`  ${icon} ${hostname.padEnd(40)} ${detail} (${file})`);
    }

    const failures = results.filter((r) => !r.skipped && !r.ok);
    const successes = results.filter((r) => !r.skipped && r.ok);
    const skipped = results.filter((r) => r.skipped);

    console.log(`\n--- Summary ---`);
    console.log(`  Passed:  ${successes.length}`);
    console.log(`  Failed:  ${failures.length}`);
    console.log(`  Skipped: ${skipped.length}`);

    if (failures.length > 0) {
        console.log(`\nConnectors that need certBypass = true:`);
        for (const f of failures) {
            console.log(`  - ${f.file}: ${f.hostname} (${f.error})`);
        }
    }
}

main().catch(console.error);
