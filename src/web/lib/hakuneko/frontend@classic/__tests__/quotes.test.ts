import { describe, it, expect } from 'vitest';
import { quotes, randomQuote } from '../quotes.js';

describe('quotes', () => {
    it('has a non-empty quotes array', () => {
        expect(quotes.length).toBeGreaterThan(0);
    });

    it('each quote has lines array and author string', () => {
        for (const q of quotes) {
            expect(Array.isArray(q.lines)).toBe(true);
            expect(q.lines.length).toBeGreaterThan(0);
            expect(typeof q.author).toBe('string');
            expect(q.author.length).toBeGreaterThan(0);
        }
    });

    it('randomQuote returns a Quote from the array', () => {
        const result = randomQuote();
        expect(result).toHaveProperty('lines');
        expect(result).toHaveProperty('author');
        expect(quotes).toContain(result);
    });

    it('randomQuote returns varied results over many calls', () => {
        const results = new Set(Array.from({ length: 50 }, () => randomQuote().author));
        expect(results.size).toBeGreaterThan(1);
    });
});
