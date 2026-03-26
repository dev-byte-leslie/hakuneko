import HeaderGenerator from './HeaderGenerator.mjs';
import Cookie from './Cookie.mjs';

export default class Request {

    // TODO: use dependency injection instead of globals for Engine.Settings, Engine.Blacklist, Enums
    constructor(ipc, settings) {
        this.userAgent = HeaderGenerator.randomUA();

        ipc.listen('on-before-send-headers', this.onBeforeSendHeadersHandler.bind(this));
        ipc.listen('on-headers-received', this.onHeadersReceivedHandler.bind(this));

        this._settings = settings;
        this._settings.addEventListener('loaded', this._onSettingsChanged.bind(this));
        this._settings.addEventListener('saved', this._onSettingsChanged.bind(this));
    }

    async _initializeHCaptchaUUID(settings) {
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

    _initializeProxy(settings) {
        // See: https://electronjs.org/docs/api/session#sessetproxyconfig-callback
        let proxy = {};
        if (settings.proxyRules.value) {
            proxy['proxyRules'] = settings.proxyRules.value;
        }
        window.hakunekoAPI.session.setProxy(proxy);
    }

    _onSettingsChanged(event) {
        this._initializeProxy(event.detail);
        this._initializeHCaptchaUUID(event.detail);
    }

    /**
     *
     */
    _loginHandler(evt, webContent, request, authInfo, callback) {
        let proxyAuth = this._settings.proxyAuth.value;
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
    _extractRequestOptions(request) {
        let referer = request.headers.get('x-referer');
        let cookie = request.headers.get('x-cookie');
        let headers = [];
        if (cookie) {
            headers.push('x-cookie: ' + cookie);
        }
        headers = headers.join('\n');
        return {
            // set user agent to prevent `window.navigator.userAgent` being set to elecetron ...
            userAgent: request.headers.get('x-user-agent') || this.userAgent,
            httpReferrer: referer ? referer : undefined,
            extraHeaders: headers ? headers : undefined

            //postData: undefined,
        };
    }

    /**
     * Fetch content using a hidden BrowserWindow with a Japscan-specific flow.
     * Delegates BrowserWindow management to the main process via IPC.
     */
    async fetchJapscan(request, preloadScript, runtimeScript, action, preferences, timeout) {
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

    async fetchBrowser(request, preloadScript, runtimeScript, preferences, timeout) {
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
    async fetchUI(request, injectionScript, timeout, images) {
        let requestOptions = this._extractRequestOptions(request);
        let blacklistPatterns = Engine.Blacklist.patterns;
        return window.hakunekoAPI.browser.fetchUI(
            request.url, injectionScript, timeout, images, requestOptions, blacklistPatterns
        );
    }

    /**
     * Provide headers for the electron main process that shall be modified before every BrowserWindow request is send.
     */
    async onBeforeSendHeadersHandler(details) {
        let uri = new URL(details.url);

        // Remove accidently added headers from opened developer console
        for (let header in details.requestHeaders) {
            if (header.startsWith('X-DevTools')) {
                delete details.requestHeaders[header];
            }
        }

        // Overwrite the Host header with the one provided by the connector
        if (details.requestHeaders['x-host']) {
            details.requestHeaders['Host'] = details.requestHeaders['x-host'];
        }
        delete details.requestHeaders['x-host'];

        // Always overwrite the electron user agent
        if (details.requestHeaders['User-Agent'].toLowerCase().includes('electron')) {
            details.requestHeaders['User-Agent'] = this.userAgent;
        }
        // If a custom user agent is set use this instead
        if (details.requestHeaders['x-user-agent']) {
            details.requestHeaders['User-Agent'] = details.requestHeaders['x-user-agent'];
            delete details.requestHeaders['x-user-agent'];
        }

        // Prevent loading anything from cache (espacially CloudFlare protection)
        details.requestHeaders['Cache-Control'] = details.requestHeaders['no-cache'];
        details.requestHeaders['Pragma'] = details.requestHeaders['no-cache'];

        /*
         * Overwrite the Referer header, but
         * NEVER overwrite the referer for CloudFlare's DDoS protection to prevent infinite redirects!
         */
        if (!/(ch[kl]_jschl|challenge-platform)/i.test(uri.href)) {
            if (uri.hostname.includes('.mcloud.to')) {
                details.requestHeaders['Referer'] = uri.href;
            } else if (details.requestHeaders['x-referer']) {
                details.requestHeaders['Referer'] = details.requestHeaders['x-referer'];
            }
        }
        delete details.requestHeaders['x-referer'];

        // Overwrite the Origin header
        if (details.requestHeaders['x-origin']) {
            details.requestHeaders['Origin'] = details.requestHeaders['x-origin'];
        }
        delete details.requestHeaders['x-origin'];

        // Append Cookie header
        if (details.requestHeaders['x-cookie']) {
            let cookiesORG = new Cookie(details.requestHeaders['Cookie']);
            let cookiesNEW = new Cookie(details.requestHeaders['x-cookie']);
            details.requestHeaders['Cookie'] = cookiesORG.merge(cookiesNEW).toString();
        }
        delete details.requestHeaders['x-cookie'];

        //
        if (details.requestHeaders['x-sec-fetch-dest']) {
            details.requestHeaders['Sec-Fetch-Dest'] = details.requestHeaders['x-sec-fetch-dest'];
        }
        delete details.requestHeaders['x-sec-fetch-dest'];

        //
        if (details.requestHeaders['x-sec-fetch-mode']) {
            details.requestHeaders['Sec-Fetch-Mode'] = details.requestHeaders['x-sec-fetch-mode'];
        }
        delete details.requestHeaders['x-sec-fetch-mode'];

        //
        if (details.requestHeaders['x-sec-fetch-site']) {
            details.requestHeaders['Sec-Fetch-Site'] = details.requestHeaders['x-sec-fetch-site'];
        }
        delete details.requestHeaders['x-sec-fetch-site'];

        //
        if (details.requestHeaders['x-sec-ch-ua']) {
            details.requestHeaders['sec-ch-ua'] = details.requestHeaders['x-sec-ch-ua'];
        }
        delete details.requestHeaders['x-sec-ch-ua'];

        // HACK: Imgur does not support request with accept types containing other mimes then images
        //       => overwrite accept header to prevent redirection to HTML notice
        if (/i\.imgur\.com/i.test(uri.hostname) || /\.(jpg|jpeg|png|gif|webp)/i.test(uri.pathname)) {
            details.requestHeaders['Accept'] = 'image/webp,image/apng,image/*,*/*';
            delete details.requestHeaders['accept'];
        }

        // Avoid detection of HakuNeko through lowercase accept header
        if (details.requestHeaders['accept']) {
            details.requestHeaders['Accept'] = details.requestHeaders['accept'];
            delete details.requestHeaders['accept'];
        }

        return details;
    }

    /**
     * Provide headers for the electron main process that shall be modified before every BrowserWindow response is received.
     */
    async onHeadersReceivedHandler(details) {
        let uri = new URL(details.url);

        /*
         * Some video sreaming sites (Streamango, OpenVideo) using 'X-Redirect' header instead of 'Location' header,
         * but fetch API only follows 'Location' header redirects => assign redirect to location
         */
        let redirect = details.responseHeaders['X-Redirect'] || details.responseHeaders['x-redirect'];
        if (redirect) {
            details.responseHeaders['Location'] = redirect;
        }
        if (uri.hostname.includes('mp4upload')) {
            /*
             *details.responseHeaders['Access-Control-Allow-Origin'] = '*';
             *details.responseHeaders['Access-Control-Allow-Methods'] = 'HEAD, GET';
             */
            details.responseHeaders['Access-Control-Expose-Headers'] = ['Content-Length'];
        }
        if (uri.hostname.includes('webtoons') && uri.searchParams.get('title_no')) {
            details.responseHeaders['Set-Cookie'] = `agn2=${uri.searchParams.get('title_no')}; Domain=${uri.hostname}; Path=/`;
        }
        if(uri.hostname.includes('comikey') && uri.pathname.includes('/read/')) {
            delete details.responseHeaders['content-security-policy'];
        }

        if(details.responseHeaders['set-cookie'] || details.responseHeaders['Set-Cookie']) {
            Cookie.applyCrossSiteCookies(details.responseHeaders);
        }

        return details;
    }
}
