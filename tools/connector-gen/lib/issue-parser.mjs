/**
 * Issue body parser — translates a GitHub issue body into structured data
 * the generator can consume.
 *
 * GitHub renders YAML-based issue templates as markdown with the pattern:
 *   ### Field Label
 *
 *   Field value
 *
 * The parser splits on `### ` section headers and maps field labels to
 * generator inputs. Required fields (websiteName, websiteUrl) throw a typed
 * error when missing so the bot can comment on the issue explaining what's
 * needed rather than silently failing.
 *
 * GitHub's "no response" placeholder is normalised to null — submitters who
 * skip optional fields get the GitHub default text rather than blank input.
 */

const GITHUB_NO_RESPONSE = '_No response_';

/**
 * @typedef {Object} ParsedIssue
 * @property {string} websiteName - Required: human-readable site name
 * @property {string} websiteUrl - Required: canonical site URL
 * @property {string|null} mangaListUrl - Optional: series list page URL
 * @property {string|null} mangaExampleUrl - Optional: example manga page URL
 * @property {string|null} mangaViewerUrl - Optional: example chapter viewer URL
 * @property {string[]} languages - Required: list of supported language tags
 * @property {string|null} relationship - Optional: domain/copy relationship info
 * @property {string|null} additionalDetails - Optional: template hints, CMS info
 */

/**
 * Parse a GitHub issue body into structured connector generator input.
 * @param {string} body - Raw issue body markdown
 * @returns {ParsedIssue}
 * @throws {IssueParseError} if required fields (websiteName, websiteUrl) are absent
 */
export function parseIssueBody(body) {
    const sections = _parseSections(body);

    const websiteName = _required(sections, 'Website Name', 'websiteName');
    const websiteUrl = _required(sections, 'Site URL', 'websiteUrl');

    const mangaListUrl = _optional(sections, 'Series list');
    const mangaExampleUrl = _optional(sections, 'Manga example');
    const mangaViewerUrl = _optional(sections, 'Manga chapter viewer');
    const relationship = _optional(sections, 'Website relationship');
    const additionalDetails = _optional(sections, 'Additional details');

    const rawLanguages = sections.get('Languages') ?? '';
    const languages = _parseLanguages(rawLanguages);

    return {
        websiteName,
        websiteUrl,
        mangaListUrl,
        mangaExampleUrl,
        mangaViewerUrl,
        languages,
        relationship,
        additionalDetails,
    };
}

/**
 * Convert ParsedIssue into GeneratorInput format for use with generator.mjs.
 * @param {ParsedIssue} parsed
 * @param {string} template - Template class name from fingerprinter
 * @returns {{ name: string, url: string, template: string, tags: string[] }}
 */
export function toGeneratorInput(parsed, template) {
    return {
        name: parsed.websiteName,
        url: normaliseUrl(parsed.websiteUrl),
        template,
        tags: parsed.languages,
    };
}

/**
 * Strip trailing slash and ensure https:// prefix for common bare inputs.
 * @param {string} url
 * @returns {string}
 */
export function normaliseUrl(url) {
    let u = url.trim().replace(/\/+$/, '');
    if (!u.startsWith('http://') && !u.startsWith('https://')) {
        u = 'https://' + u;
    }
    return u;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Split issue body markdown into a Map<fieldLabel, value>.
 * GitHub renders issue templates as: `### Label\n\nValue`
 * @param {string} body
 * @returns {Map<string, string>}
 */
function _parseSections(body) {
    const map = new Map();
    // Split on any line that starts with "### "
    const parts = body.split(/^### /m);

    for (const part of parts) {
        const newline = part.indexOf('\n');
        if (newline === -1) continue;
        const label = part.slice(0, newline).trim();
        const value = part.slice(newline).trim();
        if (label) map.set(label, value);
    }

    return map;
}

/**
 * Get a required field value; throw IssueParseError if missing or empty.
 * @param {Map<string,string>} sections
 * @param {string} label
 * @param {string} fieldName
 * @returns {string}
 */
function _required(sections, label, fieldName) {
    const value = sections.get(label)?.trim();
    if (!value || value === GITHUB_NO_RESPONSE) {
        throw new IssueParseError(
            `Required field "${label}" is missing or empty. Please fill in the ${fieldName} field in the issue template.`,
            fieldName
        );
    }
    return value;
}

/**
 * Get an optional field value; return null if absent or GitHub's no-response placeholder.
 * @param {Map<string,string>} sections
 * @param {string} label
 * @returns {string|null}
 */
function _optional(sections, label) {
    const value = sections.get(label)?.trim();
    if (!value || value === GITHUB_NO_RESPONSE) return null;
    return value;
}

/**
 * Parse a comma-separated or newline-separated languages string into a tag array.
 * "English, Japanese, French" → ["english", "japanese", "french"]
 * @param {string} raw
 * @returns {string[]}
 */
function _parseLanguages(raw) {
    if (!raw || raw === GITHUB_NO_RESPONSE) return ['manga'];

    const langs = raw
        .split(/[,\n]+/)
        .map(l => l.trim().toLowerCase().replace(/[^a-z]/g, ''))
        .filter(Boolean);

    // Always include 'manga' as first tag (convention in existing connectors)
    if (!langs.includes('manga')) {
        langs.unshift('manga');
    }

    return langs;
}

/**
 * Typed error for missing required issue fields.
 * The bot catches this to post a helpful comment on the issue.
 */
export class IssueParseError extends Error {
    /** @param {string} message @param {string} fieldName */
    constructor(message, fieldName) {
        super(message);
        this.name = 'IssueParseError';
        this.fieldName = fieldName;
    }
}
