import HeaderGenerator from './HeaderGenerator';
import type Settings from './Settings';

export default class Request {

    userAgent: string;
    _settings: Settings;

    // TODO: use dependency injection instead of globals for Engine.Settings, Engine.Blacklist, Enums
    constructor(ipc: unknown, settings: Settings) {
        this.userAgent = HeaderGenerator.randomUA();

        this._settings = settings;
        this._settings.addEventListener('loaded', this._onSettingsChanged.bind(this));
        this._settings.addEventListener('saved', this._onSettingsChanged.bind(this));
    }

    async _initializeHCaptchaUUID(settings: Settings): Promise<void> {
        let hcCookies = await window.hakunekoAPI.session.cookies.get({ name: 'hc_accessibility' });
        let isCookieAvailable = hcCookies.some(cookie => cookie.expirationDate > Date.now() / 1000 + 1800);
        if (settings.hCaptchaAccessibilityUUID.value && !isCookieAvailable) {
            let script = `
                new Promise((resolve, reject) => {
                    setTimeout(() => {
                        try {
                            document.querySelector('button[data-cy*="setAccessibilityCookie"]').click();
                        } catch(error) {
                            reject(error);
                        }
                    }, 1000);
                    setInterval(() => {
                        if(document.cookie.includes('hc_accessibility=')) {
                            resolve(document.cookie);
                        }
                    }, 750);
                    setTimeout(() => {
                        reject(new Error('The hCaptcha accessibility cookie was not applied within the given timeout!'));
                    }, 7500);
                });
            `;
            let uri = new URL('https://accounts.hcaptcha.com/verify_email/' + settings.hCaptchaAccessibilityUUID.value);
            let request = new window.Request(uri);
            try {
                let data = await this.fetchUI(request, script, 30000);
                console.log('Initialization of hCaptcha accessibility signup succeeded.', data);
            } catch (error) {
                // Maybe quota of cookie requests exceeded
                // Maybe account suspension because of suspicious behavior/abuse
                console.warn('Initialization of hCaptcha accessibility signup failed!', error);
            }
        }
    }

    _initializeProxy(settings: Settings): void {
        // See: https://electronjs.org/docs/api/session#sessetproxyconfig-callback
        let proxy: Record<string, string> = {};
        if (settings.proxyRules.value) {
            proxy['proxyRules'] = settings.proxyRules.value as string;
        }
        window.hakunekoAPI.session.setProxy(proxy);
    }

    _onSettingsChanged(event: CustomEvent): void {
        this._initializeProxy(event.detail);
        this._initializeHCaptchaUUID(event.detail);
    }

    _loginHandler(evt: unknown, webContent: unknown, request: unknown, authInfo: { isProxy: boolean }, callback: (user: string, pass: string) => void): void {
        let proxyAuth = this._settings.proxyAuth.value as string;
        if (authInfo.isProxy && proxyAuth && proxyAuth.includes(':')) {
            let auth = proxyAuth.split(':');
            let username = auth[0];
            let password = auth[1];
            console.log('login event', authInfo.isProxy, username, password);
            callback(username, password);
        }
    }

    // NOTE: _scrapingCheckScript, _domPreparationScript, _checkScrapingRedirection, and _fetchUICleanup
    // have been moved to ElectronBootstrap.js (main process) as part of HAKU-0005.
    // The fetch methods now delegate BrowserWindow management to the main process via IPC.

    /**
     * The browser window of electron does not support request objects,
     * so it is required to convert the request to supported options.
     */
    _extractRequestOptions(request: globalThis.Request): Record<string, string | undefined> {
        let referer = request.headers.get('x-referer');
        let cookie = request.headers.get('x-cookie');
        let headers: string[] = [];
        if (cookie) {
            headers.push('x-cookie: ' + cookie);
        }
        let headersStr = headers.join('\n');
        return {
            // set user agent to prevent `window.navigator.userAgent` being set to elecetron ...
            userAgent: request.headers.get('x-user-agent') || this.userAgent,
            httpReferrer: referer ? referer : undefined,
            extraHeaders: headersStr ? headersStr : undefined

            //postData: undefined,
        };
    }

    /**
     * Fetch content using a hidden BrowserWindow with a Japscan-specific flow.
     * Delegates BrowserWindow management to the main process via IPC.
     */
    async fetchJapscan(request: globalThis.Request, preloadScript: string, runtimeScript: string, action: unknown, preferences: Record<string, unknown> | null, timeout: number): Promise<unknown> {
        let requestOptions = this._extractRequestOptions(request);
        let serializablePrefs = preferences ? {
            nodeIntegration: preferences.nodeIntegration,
            webSecurity: preferences.webSecurity,
            images: preferences.images,
            onBeforeRequestPattern: !!preferences.onBeforeRequest
        } : {};
        return window.hakunekoAPI.browser.fetchJapscan(
            request.url, preloadScript, runtimeScript, serializablePrefs, timeout, requestOptions
        );
    }

    async fetchBrowser(request: globalThis.Request, preloadScript: string, runtimeScript: string, preferences: Record<string, unknown> | null, timeout: number): Promise<unknown> {
        let requestOptions = this._extractRequestOptions(request);
        let blacklistPatterns = Engine.Blacklist.patterns;
        let serializablePrefs = preferences ? {
            nodeIntegration: preferences.nodeIntegration,
            webSecurity: preferences.webSecurity,
            images: preferences.images,
        } : {};
        return window.hakunekoAPI.browser.fetchBrowser(
            request.url, preloadScript, runtimeScript, serializablePrefs, timeout, requestOptions, blacklistPatterns
        );
    }

    /**
     * If timeout [ms] is given, the window will be kept open until timeout, otherwise
     * it will be closed after injecting the script (or after 60 seconds in case an error occurred).
     * Delegates BrowserWindow management to the main process via IPC.
     */
    async fetchUI(request: globalThis.Request, injectionScript: string, timeout: number, images?: boolean): Promise<unknown> {
        let requestOptions = this._extractRequestOptions(request);
        let blacklistPatterns = Engine.Blacklist.patterns;
        return window.hakunekoAPI.browser.fetchUI(
            request.url, injectionScript, timeout, images, requestOptions, blacklistPatterns
        );
    }

}
