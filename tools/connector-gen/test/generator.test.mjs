/**
 * Generator unit tests — pure function, no network or filesystem side effects.
 */

import { describe, it, expect } from 'bun:test';
import { toClassName, toId, generate } from '../lib/generator.mjs';

describe('toClassName', () => {
    it('converts "Ace Scans" to "AceScans"', () => {
        expect(toClassName('Ace Scans')).toBe('AceScans');
    });

    it('handles hyphens as word separators', () => {
        expect(toClassName('my-site!')).toBe('MySite');
    });

    it('handles multiple spaces', () => {
        expect(toClassName('漫画牛 (ManHuaNiu)')).toBe('Manhuaniu');
    });

    it('handles single word', () => {
        expect(toClassName('mangakakalot')).toBe('Mangakakalot');
    });
});

describe('toId', () => {
    it('converts "Ace Scans" to "acescans"', () => {
        expect(toId('Ace Scans')).toBe('acescans');
    });

    it('strips all non-alphanum', () => {
        expect(toId('My Site! (Test)')).toBe('mysitetest');
    });

    it('preserves numbers', () => {
        expect(toId('Site 2')).toBe('site2');
    });
});

describe('generate', () => {
    it('produces source matching AceScans.mjs style for WordPressMangastream', () => {
        const result = generate({
            name: 'Ace Scans',
            url: 'https://acescans.xyz',
            template: 'WordPressMangastream',
            tags: ['manga', 'english'],
        });

        expect(result.filename).toBe('AceScans.mjs');
        expect(result.className).toBe('AceScans');
        expect(result.id).toBe('acescans');

        // Check source structure matches hand-written style
        expect(result.source).toContain("import WordPressMangastream from './templates/WordPressMangastream.mjs'");
        expect(result.source).toContain('export default class AceScans extends WordPressMangastream');
        expect(result.source).toContain("super.id = 'acescans'");
        expect(result.source).toContain("super.label = 'Ace Scans'");
        expect(result.source).toContain("this.tags = [ 'manga', 'english' ]");
        expect(result.source).toContain("this.url = 'https://acescans.xyz'");
    });

    it('uses template default path when none provided', () => {
        const result = generate({
            name: 'Test Site',
            url: 'https://test.com',
            template: 'WordPressMadara',
        });
        // WordPressMadara defaults to /manga/list-mode/
        expect(result.source).toContain("this.path = '/manga/list-mode/'");
    });

    it('uses caller path override over template default', () => {
        const result = generate({
            name: 'Test Site',
            url: 'https://test.com',
            template: 'WordPressMangastream',
            path: '/list/',
        });
        expect(result.source).toContain("this.path = '/list/'");
    });

    it('generates FoolSlide connector', () => {
        const result = generate({
            name: 'Russification',
            url: 'https://russification.example.com',
            template: 'FoolSlide',
            tags: ['manga', 'russian', 'scanlation'],
        });
        expect(result.source).toContain("import FoolSlide from './templates/FoolSlide.mjs'");
        expect(result.source).toContain('extends FoolSlide');
    });

    it('generates SinMH connector without path field', () => {
        const result = generate({
            name: 'ManHuaNiu',
            url: 'https://www.manhuaniu.com',
            template: 'SinMH',
            tags: ['webtoon', 'chinese'],
        });
        expect(result.source).toContain("import SinMH from './templates/SinMH.mjs'");
        // SinMH template does not include this.path
        expect(result.source).not.toContain('this.path');
    });

    it('generates MadTheme connector without path field', () => {
        const result = generate({
            name: 'MangaForest',
            url: 'https://mangaforest.me',
            template: 'MadTheme',
            tags: ['manga', 'english'],
        });
        expect(result.source).toContain("import MadTheme from './templates/MadTheme.mjs'");
        expect(result.source).not.toContain('this.path');
    });

    it('detects conflict with existing connector', () => {
        // 'acescans' should exist in connectors/AceScans.mjs
        const result = generate({
            name: 'Ace Scans',
            url: 'https://acescans.xyz',
            template: 'WordPressMangastream',
        });
        expect(result.hasConflict).toBe(true);
        expect(result.conflictFile).toMatch(/AceScans\.mjs/);
    });

    it('reports no conflict for a novel name', () => {
        const result = generate({
            name: 'Totally New Site 99999',
            url: 'https://totallynewsite99999.example.com',
            template: 'WordPressMangastream',
        });
        expect(result.hasConflict).toBe(false);
        expect(result.conflictFile).toBeNull();
    });
});
