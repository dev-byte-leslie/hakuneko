/**
 * Issue body parser unit tests.
 */

import { describe, it, expect } from 'bun:test';
import { parseIssueBody, toGeneratorInput, normaliseUrl, IssueParseError } from '../lib/issue-parser.mjs';

const SAMPLE_BODY = `### Website Name

Ace Scans

### Site URL

https://acescans.xyz

### Series list

https://acescans.xyz/manga/list-mode/

### Manga example

https://acescans.xyz/manga/example-manga/

### Manga chapter viewer

https://acescans.xyz/manga/example-manga/chapter-1/

### Languages

English, Japanese

### Website relationship

_No response_

### Additional details

Uses WordPressMangastream template`;

describe('parseIssueBody', () => {
    it('parses a complete well-formed issue body', () => {
        const result = parseIssueBody(SAMPLE_BODY);
        expect(result.websiteName).toBe('Ace Scans');
        expect(result.websiteUrl).toBe('https://acescans.xyz');
        expect(result.mangaListUrl).toBe('https://acescans.xyz/manga/list-mode/');
        expect(result.languages).toContain('manga');
        expect(result.languages).toContain('english');
        expect(result.languages).toContain('japanese');
        expect(result.relationship).toBeNull();
        expect(result.additionalDetails).toContain('WordPressMangastream');
    });

    it('throws IssueParseError when websiteName is missing', () => {
        const body = SAMPLE_BODY.replace('### Website Name\n\nAce Scans', '### Website Name\n\n_No response_');
        expect(() => parseIssueBody(body)).toThrow(IssueParseError);
    });

    it('throws IssueParseError when websiteUrl is missing', () => {
        const body = SAMPLE_BODY.replace('### Site URL\n\nhttps://acescans.xyz', '### Site URL\n\n_No response_');
        expect(() => parseIssueBody(body)).toThrow(IssueParseError);
    });

    it('returns null for absent optional fields', () => {
        const result = parseIssueBody(SAMPLE_BODY);
        expect(result.relationship).toBeNull();
    });

    it('always includes "manga" as first language tag', () => {
        const body = SAMPLE_BODY.replace('English, Japanese', 'French');
        const result = parseIssueBody(body);
        expect(result.languages[0]).toBe('manga');
        expect(result.languages).toContain('french');
    });
});

describe('normaliseUrl', () => {
    it('strips trailing slash', () => {
        expect(normaliseUrl('https://example.com/')).toBe('https://example.com');
    });

    it('adds https:// to bare URLs', () => {
        expect(normaliseUrl('example.com')).toBe('https://example.com');
    });

    it('preserves http:// when explicitly set', () => {
        expect(normaliseUrl('http://example.com')).toBe('http://example.com');
    });

    it('throws IssueParseError for a garbage string', () => {
        expect(() => normaliseUrl('not a url !!')).toThrow(IssueParseError);
    });

    it('throws IssueParseError for an empty string', () => {
        expect(() => normaliseUrl('')).toThrow(IssueParseError);
    });
});

describe('toGeneratorInput', () => {
    it('maps parsed issue to generator input format', () => {
        const parsed = parseIssueBody(SAMPLE_BODY);
        const input = toGeneratorInput(parsed, 'WordPressMangastream');
        expect(input.name).toBe('Ace Scans');
        expect(input.url).toBe('https://acescans.xyz');
        expect(input.template).toBe('WordPressMangastream');
        expect(input.tags).toContain('english');
    });
});
