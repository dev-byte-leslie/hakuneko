#!/usr/bin/env node
/**
 * CLI entry point for connector smoke tests.
 * Usage: bun run run.mjs --tier=1|2|3
 */
import { parseArgs } from 'node:util';

const { values } = parseArgs({
    options: {
        tier: { type: 'string', short: 't' },
    },
    strict: false,
});

const tier = parseInt(values.tier, 10);

if (![1, 2, 3].includes(tier)) {
    console.error('Usage: bun run run.mjs --tier=1|2|3');
    process.exit(1);
}

console.log(`\nRunning Smoke Test Tier ${tier}...\n`);

switch (tier) {
    case 1: {
        const { runTier1 } = await import('./tiers/tier1-url-check.mjs');
        await runTier1();
        break;
    }
    case 2: {
        const { runTier2 } = await import('./tiers/tier2-manga-list.mjs');
        await runTier2();
        break;
    }
    case 3: {
        const { runTier3 } = await import('./tiers/tier3-full-pipeline.mjs');
        await runTier3();
        break;
    }
}
