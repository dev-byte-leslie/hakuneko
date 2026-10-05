// MangaGo.mjs is an ES module (and mostly obfuscated), which Jest cannot require.
// Instead, the page-extraction script shipped in MangaGo._getPages is pulled out of the source
// with acorn and executed in a VM sandbox that mimics a MangaGo reader page. (HAKU-0054)

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const acorn = require('acorn');
const CryptoJS = require('crypto-js');

const KEY = CryptoJS.enc.Hex.parse('e11adc3949ba59abbe56e057f20f883e');
const IV = CryptoJS.enc.Hex.parse('1234567890abcdef1234567890abcdef');
const ORIGIN = 'https://www.mangago.zone';
const CHAPTER = '/chapter/42563/2064955/';

/**
 * Finds the `const script = `...`` template literal declared inside MangaGo._getPages.
 */
function extractPagesScript() {
    const file = path.resolve(__dirname, '../mjs/connectors/MangaGo.mjs');
    const ast = acorn.parse(fs.readFileSync(file, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' });
    let script;
    (function walk(node) {
        if (script || !node || typeof node.type !== 'string') {
            return;
        }
        if (node.type === 'VariableDeclarator' && node.id.name === 'script' && node.init && node.init.type === 'TemplateLiteral') {
            script = node.init.quasis.map(quasi => quasi.value.cooked).join('');
            return;
        }
        for (const value of Object.values(node)) {
            Array.isArray(value) ? value.forEach(walk) : walk(value);
        }
    })(ast);
    return script;
}

/**
 * Encrypts a slot list the way MangaGo does: comma-joined, AES-CBC with zero padding.
 */
function encrypt(slots) {
    return CryptoJS.AES.encrypt(slots.join(','), KEY, { iv: IV, padding: CryptoJS.pad.ZeroPadding }).toString();
}

const imageLink = page => `https://iweb_5.mangapicgallery.com/r/newpiclink/series/1/1_${page}.jpg`;

/**
 * Builds the encrypted `imgsrcs` the reader page for `page` would embed: only the slots
 * page..page+4 are filled, the rest stay empty.
 */
function windowFor(page, total) {
    const slots = Array.from({ length: total }, (_, index) => index + 1 >= page && index + 1 < page + 5 ? imageLink(index + 1) : '');
    return encrypt(slots);
}

/**
 * Runs the extracted script inside a sandbox emulating the first reader page of a chapter.
 */
function runScript({ total, slots = total, hrefs = [], fetchPage }) {
    const requested = [];
    const sandbox = {
        CryptoJS,
        URL,
        imgsrcs: windowFor(1, slots),
        total_pages: total,
        location: new URL(ORIGIN + CHAPTER),
        document: {
            querySelectorAll: () => hrefs.map(href => ({ href }))
        },
        fetch: async url => {
            requested.push(url);
            return { text: async () => fetchPage(url) };
        }
    };
    const promise = vm.runInNewContext(extractPagesScript(), sandbox);
    return { promise, requested };
}

const pageFromURL = url => parseInt(url.match(/\/(\d+)\/$/)[1]);
const readerPage = url => `<script>var imgsrcs = '${windowFor(pageFromURL(url), 12)}';</script>`;

describe('MangaGo _getPages injection script', () => {

    it('ships a script in _getPages', () => {
        expect(extractPagesScript()).toContain('imgsrcs');
    });

    it('merges page windows into the full ordered link list', async () => {
        const { promise, requested } = runScript({ total: 12, fetchPage: readerPage });
        const links = await promise;
        expect(links).toEqual(Array.from({ length: 12 }, (_, index) => imageLink(index + 1)));
        expect(requested).toEqual([ORIGIN + CHAPTER + '6/', ORIGIN + CHAPTER + '11/']);
    });

    it('prefers the reader page dropdown links over the fallback URL scheme', async () => {
        const hrefs = Array.from({ length: 12 }, (_, index) => `${ORIGIN}${CHAPTER}${index + 1}/`);
        hrefs[5] = `${ORIGIN}${CHAPTER}6/?from=dropdown`;
        const { promise, requested } = runScript({ total: 12, hrefs, fetchPage: url => readerPage(url.replace('?from=dropdown', '')) });
        await promise;
        expect(requested[0]).toBe(`${ORIGIN}${CHAPTER}6/?from=dropdown`);
    });

    it('rejects and names the pages that could not be resolved', async () => {
        const { promise } = runScript({ total: 12, fetchPage: url => pageFromURL(url) === 11 ? '<html></html>' : readerPage(url) });
        await expect(promise).rejects.toThrow('(missing pages: 11)');
    });

    it('ignores slots beyond total_pages', async () => {
        const { promise } = runScript({ total: 3, slots: 6, fetchPage: () => {
            throw new Error('no fetch expected');
        } });
        expect(await promise).toEqual([imageLink(1), imageLink(2), imageLink(3)]);
    });
});
