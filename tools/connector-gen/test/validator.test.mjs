/**
 * Validator unit tests.
 *
 * Tests the 4-check validation pipeline: lint, import, HTTP smoke, selector smoke.
 * Network-dependent checks (HTTP, selector) use the real network when available
 * but are expected to fail gracefully in sandboxed environments.
 */

import { describe, it, expect } from 'bun:test';
import { validate } from '../lib/validator.mjs';

const VALID_MADARA_SOURCE = `import WordPressMadara from './templates/WordPressMadara.mjs';

export default class TestSite extends WordPressMadara {

    constructor() {
        super();
        super.id = 'testsite';
        super.label = 'Test Site';
        this.tags = [ 'manga', 'english' ];
        this.url = 'https://example.com';
        this.path = '/manga/list-mode/';
    }
}
`;

const SYNTAX_ERROR_SOURCE = `
import WordPressMadara from './templates/WordPressMadara.mjs'

export default class BrokenSite extends WordPressMadara {
    constructor() {
        super()
        // Missing closing brace
`;

const MISSING_ID_SOURCE = `
export default class NoIdSite {
    constructor() {
        this.url = 'https://example.com';
        this.label = 'No Id';
    }
}
`;

describe('validate', () => {
    it('returns a result with all 4 check names', async () => {
        const result = await validate(VALID_MADARA_SOURCE, 'https://example.com', 'WordPressMadara');
        const checkNames = result.checks.map(c => c.name);
        expect(checkNames).toContain('lint');
        expect(checkNames).toContain('import');
        expect(checkNames).toContain('http');
        expect(checkNames).toContain('selector');
    });

    it('lint check passes for well-formed source', async () => {
        const result = await validate(VALID_MADARA_SOURCE, 'https://example.com', 'WordPressMadara');
        const lint = result.checks.find(c => c.name === 'lint');
        expect(lint.passed).toBe(true);
    });

    it('import check passes or gracefully handles template path', async () => {
        const result = await validate(VALID_MADARA_SOURCE, 'https://example.com', 'WordPressMadara');
        const importCheck = result.checks.find(c => c.name === 'import');
        // Template paths resolve relative to the generated file, not the temp dir.
        // The import check should pass (gracefully skipping template resolution).
        expect(importCheck.passed).toBe(true);
    });

    it('import check detects syntax errors', async () => {
        const result = await validate(SYNTAX_ERROR_SOURCE, 'https://example.com', 'WordPressMadara');
        const importCheck = result.checks.find(c => c.name === 'import');
        expect(importCheck.passed).toBe(false);
    });

    it('HTTP check fails for unreachable URLs', async () => {
        const result = await validate(VALID_MADARA_SOURCE, 'https://this-domain-does-not-exist-12345.invalid', 'WordPressMadara');
        const http = result.checks.find(c => c.name === 'http');
        expect(http.passed).toBe(false);
    });

    it('selector check is skipped when HTTP check fails', async () => {
        const result = await validate(VALID_MADARA_SOURCE, 'https://this-domain-does-not-exist-12345.invalid', 'WordPressMadara');
        const selector = result.checks.find(c => c.name === 'selector');
        expect(selector.passed).toBe(false);
        expect(selector.message).toMatch(/[Ss]kipped/);
    });

    it('passed is false when any check fails', async () => {
        const result = await validate(VALID_MADARA_SOURCE, 'https://this-domain-does-not-exist-12345.invalid', 'WordPressMadara');
        expect(result.passed).toBe(false);
    });

    it('handles unknown template gracefully in selector check', async () => {
        const result = await validate(VALID_MADARA_SOURCE, 'https://this-domain-does-not-exist-12345.invalid', 'UnknownTemplate');
        // Should not crash; selector check should skip with message
        const selector = result.checks.find(c => c.name === 'selector');
        expect(selector).toBeDefined();
    });
});
