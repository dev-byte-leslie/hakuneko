/**
 * HTTP client with HEAD/GET fallback and concurrency limiting.
 * Used by Tier 1 URL validation to check connector base URLs.
 */

/**
 * Try HTTP HEAD first; if 405/403, retry with GET (read only first 1KB).
 * @param {string} url - URL to check
 * @param {number} timeoutMs - Request timeout in milliseconds
 * @returns {Promise<{ status: number, headers: object, durationMs: number, error: Error|null }>}
 */
export async function headOrGet(url, timeoutMs = 10_000) {
    const start = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        let response = await fetch(url, {
            method: 'HEAD',
            signal: controller.signal,
            redirect: 'follow',
        });

        // Some servers reject HEAD — retry with GET
        if (response.status === 405 || response.status === 403) {
            response = await fetch(url, {
                method: 'GET',
                signal: controller.signal,
                redirect: 'follow',
                headers: { Range: 'bytes=0-1023' },
            });
        }

        clearTimeout(timer);
        return {
            status: response.status,
            headers: Object.fromEntries(response.headers.entries()),
            durationMs: Date.now() - start,
            error: null,
        };
    } catch (error) {
        clearTimeout(timer);
        return {
            status: 0,
            headers: {},
            durationMs: Date.now() - start,
            error,
        };
    }
}

/**
 * Simple semaphore-based concurrency limiter.
 * @param {Array<() => Promise<T>>} tasks - Array of async functions
 * @param {number} limit - Maximum concurrent tasks
 * @returns {Promise<T[]>} - Results in original order
 */
export async function withConcurrencyLimit(tasks, limit = 50) {
    const results = new Array(tasks.length);
    let nextIndex = 0;

    async function worker() {
        while (nextIndex < tasks.length) {
            const idx = nextIndex++;
            results[idx] = await tasks[idx]();
        }
    }

    const workers = Array.from(
        { length: Math.min(limit, tasks.length) },
        () => worker()
    );
    await Promise.all(workers);
    return results;
}
