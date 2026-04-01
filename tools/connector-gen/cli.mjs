#!/usr/bin/env node
/**
 * Connector generation CLI — fingerprints CMS templates and generates .mjs connector files.
 *
 * Commands:
 *   generate <url>    Full pipeline: fingerprint → generate → validate → write file
 *   fingerprint <url> Diagnostic: identify the template only (no file written)
 *   validate <file>   Smoke-test an existing connector file
 *
 * All inputs come from flags — no interactive prompts — so this CLI is fully
 * scriptable for the GitHub Actions bot.
 *
 * Usage examples:
 *   bun run cli.mjs generate https://acescans.xyz --name "Ace Scans" --lang english
 *   bun run cli.mjs fingerprint https://acescans.xyz
 *   bun run cli.mjs validate src/web/mjs/connectors/AceScans.mjs
 *   bun run cli.mjs generate https://site.com --name "My Site" --template WordPressMadara --dry-run
 */

import { parseArgs } from 'node:util';
import { writeFileSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

import { fingerprint } from './lib/fingerprinter.mjs';
import { generate } from './lib/generator.mjs';
import { validate } from './lib/validator.mjs';

const CONNECTORS_DIR = resolve(
    import.meta.dirname,
    '..', '..', 'src', 'web', 'mjs', 'connectors'
);

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

const { values, positionals } = parseArgs({
    options: {
        name:     { type: 'string', short: 'n' },
        lang:     { type: 'string', short: 'l' },
        tags:     { type: 'string' },           // comma-separated alternative to --lang
        template: { type: 'string', short: 't' },
        path:     { type: 'string', short: 'p' },
        output:   { type: 'string', short: 'o' },
        'dry-run': { type: 'boolean', default: false },
        verbose:  { type: 'boolean', short: 'v', default: false },
    },
    allowPositionals: true,
    strict: false,
});

const [command, target] = positionals;

if (!command || !['generate', 'fingerprint', 'validate'].includes(command)) {
    printUsage();
    process.exit(1);
}

if (!target) {
    console.error(`Error: missing argument for "${command}"`);
    printUsage();
    process.exit(1);
}

// ---------------------------------------------------------------------------
// Command dispatch
// ---------------------------------------------------------------------------

switch (command) {
    case 'fingerprint': await runFingerprint(target); break;
    case 'generate':    await runGenerate(target); break;
    case 'validate':    await runValidate(target); break;
}

// ---------------------------------------------------------------------------
// Command implementations
// ---------------------------------------------------------------------------

/** Identify the CMS template for a URL without generating anything. */
async function runFingerprint(url) {
    console.log(`\nFingerprinting ${url} ...\n`);
    const result = await fingerprint(url);

    if (result.warnings.length) {
        result.warnings.forEach(w => console.warn(`  ⚠  ${w}`));
        console.log();
    }

    if (result.template) {
        console.log(`  Template : ${result.template}`);
        console.log(`  Confidence: ${result.confidence}`);
        console.log(`  Canonical : ${result.canonicalUrl}`);
    } else {
        console.log('  No template match (confidence below threshold)');
    }

    if (values.verbose && result.candidates.length) {
        console.log('\n  All candidates:');
        result.candidates.forEach(c =>
            console.log(`    ${c.template.padEnd(25)} score=${c.confidence}  signals=${c.matchedSignals}`)
        );
    }

    process.exit(result.template ? 0 : 1);
}

/** Full pipeline: fingerprint → generate → validate → write. */
async function runGenerate(url) {
    // --name is required for generate
    const name = values.name;
    if (!name) {
        console.error('Error: --name is required for the generate command');
        process.exit(1);
    }

    // Parse tags: prefer --tags (comma list), fall back to --lang, then default
    const tags = _parseTags(values.tags, values.lang);

    // Determine template: --template override or fingerprint
    let templateName = values.template;
    let canonicalUrl = url;

    if (!templateName) {
        console.log(`\nFingerprinting ${url} ...\n`);
        const fp = await fingerprint(url);
        fp.warnings.forEach(w => console.warn(`  ⚠  ${w}`));

        if (!fp.template) {
            console.error('\nNo template match. Use --template to specify manually.');
            console.error('Candidates:');
            fp.candidates.slice(0, 3).forEach(c =>
                console.error(`  ${c.template.padEnd(25)} score=${c.confidence}`)
            );
            process.exit(1);
        }

        templateName = fp.template;
        canonicalUrl = fp.canonicalUrl;
        console.log(`  Detected template: ${templateName} (confidence=${fp.confidence})`);
        console.log(`  Canonical URL    : ${canonicalUrl}\n`);
    }

    // Generate source
    const result = generate({
        name,
        url: canonicalUrl,
        template: templateName,
        tags,
        path: values.path,
    });

    if (result.hasConflict) {
        console.error(`\nConflict: connector "${result.id}" already exists at ${result.conflictFile}`);
        process.exit(1);
    }

    // Validate
    console.log('Validating ...\n');
    const validation = await validate(result.source, canonicalUrl, templateName);
    validation.checks.forEach(c => {
        const icon = c.passed ? '✓' : '✗';
        console.log(`  ${icon} ${c.name.padEnd(10)} ${c.message ?? ''}`);
    });
    console.log();

    if (!validation.passed) {
        console.error('Validation failed — connector not written.');
        if (!values['dry-run']) process.exit(1);
    }

    // Write or dry-run
    if (values['dry-run']) {
        console.log('--- dry-run output ---');
        console.log(result.source);
        console.log('--- end ---');
    } else {
        const outputDir = values.output ? resolve(values.output) : CONNECTORS_DIR;
        const outputPath = join(outputDir, result.filename);
        writeFileSync(outputPath, result.source, 'utf8');
        console.log(`Written: ${outputPath}`);
    }

    // In dry-run mode, always exit 0 — caller can inspect the output
    process.exit((validation.passed || values['dry-run']) ? 0 : 1);
}

/** Smoke-test an existing connector .mjs file. */
async function runValidate(filePath) {
    const absPath = resolve(filePath);
    const source = readFileSync(absPath, 'utf8');

    // Extract URL from source for HTTP check
    const urlMatch = source.match(/this\.url\s*=\s*['"`]([^'"`]+)['"`]/);
    const url = urlMatch?.[1] ?? '';

    if (!url) {
        console.error('Could not extract this.url from connector source');
        process.exit(1);
    }

    // Best-effort template detection from import statement
    const importMatch = source.match(/from\s+['"`].*\/templates\/(\w+)\.mjs['"`]/);
    const template = importMatch?.[1] ?? 'WordPressMangastream';

    console.log(`\nValidating ${absPath}\n  url      = ${url}\n  template = ${template}\n`);

    const result = await validate(source, url, template);
    result.checks.forEach(c => {
        const icon = c.passed ? '✓' : '✗';
        console.log(`  ${icon} ${c.name.padEnd(10)} ${c.message ?? ''}`);
    });

    process.exit(result.passed ? 0 : 1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _parseTags(tagsFlag, langFlag) {
    if (tagsFlag) {
        return ['manga', ...tagsFlag.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)];
    }
    if (langFlag) {
        return ['manga', langFlag.toLowerCase()];
    }
    return ['manga'];
}

function printUsage() {
    console.log(`
Usage:
  bun run cli.mjs generate <url>    --name "Site Name" [--lang english] [--template WordPressMadara] [--path /manga/list/] [--dry-run]
  bun run cli.mjs fingerprint <url> [--verbose]
  bun run cli.mjs validate <file>

Options:
  --name, -n       Site name (required for generate)
  --lang, -l       Language tag (e.g. english, japanese)
  --tags           Comma-separated tags (overrides --lang)
  --template, -t   Skip fingerprinting, use this template directly
  --path, -p       Override manga list path
  --output, -o     Output directory (default: src/web/mjs/connectors/)
  --dry-run        Print generated source to stdout, do not write file
  --verbose, -v    Show all fingerprint candidates
`);
}
