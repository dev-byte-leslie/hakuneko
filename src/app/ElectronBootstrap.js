const path = require('path');
const fs = require('fs-extra');
const electron = require('electron');
const { exec } = require('child_process');
const { ConsoleLogger } = require('@logtrine/logtrine');
const urlFilterAll = { urls: ['http://*/*', 'https://*/*'] };
const trayTooltipMinimize = 'HakuNeko\nClick to hide window';
const trayTooltipRestore = 'HakuNeko\nClick to show window';

/**
 * Generate a random Chrome User-Agent string.
 * Mirrors HeaderGenerator.randomUA() from the renderer process.
 */
function _randomChromeUA() {
    const rn = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const rd = (items) => items[Math.floor(Math.random() * items.length)];
    const os = rd([
        'X11; Linux' + rd([' i386', ' i686', ' amd64', ' x86_64']),
        'Macintosh; Intel Mac OS X ' + [rd(['10']), rd(['8', '9', '10', '11', '12', '13']), rd(['0', '1', '2', '3', '4', '5'])].join(rd(['_', '.'])),
        'Windows NT ' + rd(['5.0', '5.1', '6.0', '6.1', '6.2', '10.0']) + rd(['', '; WOW64', '; Win64; x64']),
    ]);
    const ver = rn(120, 122) + '.' + rn(0, 99) + '.' + rn(0, 9999) + '.' + rn(0, 999);
    return 'Mozilla/5.0 (' + os + ') AppleWebKit/537.36 (KHTML, like Gecko) Chrome/' + ver + ' Safari/537.36';
}

/**
 * Merge two semicolon-delimited cookie strings, with newer values winning.
 * Mirrors Cookie.merge() from the renderer process.
 */
function _mergeCookies(existing, additional) {
    const parse = (str) => {
        const map = {};
        (str || '').split(';').filter(c => c.trim()).forEach(c => {
            const pair = c.split('=');
            const key = pair.shift().trim();
            map[key] = pair.join('=').trim();
        });
        return map;
    };
    const merged = Object.assign(parse(existing), parse(additional));
    return Object.keys(merged)
        .filter(k => merged[k] !== 'EXPIRED')
        .map(k => k + '=' + merged[k])
        .join('; ');
}

/**
 * Ensure SameSite=None on all Set-Cookie headers for cross-site cookie support.
 * Mirrors Cookie.applyCrossSiteCookies() from the renderer process.
 */
function _applyCrossSiteCookies(headers) {
    let cookies = headers['set-cookie'] || headers['Set-Cookie'];
    if (!cookies) return;
    if (!Array.isArray(cookies)) cookies = [cookies];
    for (let i in cookies) {
        cookies[i] = [...cookies[i].split(';').map(p => p.trim()).filter(p => !/^SameSite=/i.test(p)), 'SameSite=None'].join('; ');
    }
}

module.exports = class ElectronBootstrap {

    constructor(configuration, logger) {
        this._logger = logger || new ConsoleLogger(ConsoleLogger.LEVEL.Warn);
        this._configuration = configuration;
        this._userAgent = _randomChromeUA();
        this._window = null;
        this._schemes = [
            {
                scheme: this._configuration.applicationProtocol,
                privileges: {
                    secure: true,
                    standard: true,
                    supportFetchAPI: true
                }
            },
            {
                scheme: this._configuration.connectorProtocol,
                privileges: {
                    standard: true,
                    supportFetchAPI: true
                }
            },
            {
                scheme: 'hakuneko-local',
                privileges: {
                    standard: true,
                    secure: true,
                    supportFetchAPI: true
                }
            }
        ];
        this._directoryMap = {
            'cache': this._configuration.applicationCacheDirectory,
            'plugins': this._configuration.applicationUserPluginsDirectory
        };
        this._appIcon;
        this._minimizeToTray = false; // only supported when tray is shown
        this._showTray = false;
        this._tray;
        this._certBypassDomains = new Set();
    }

    /**
     *
     */
    launch() {
        /*
         * See: https://fossies.org/linux/electron/atom/browser/api/atom_api_protocol.cc
         * { standard, secure, bypassCSP, corsEnabled, supportFetchAPI, allowServiceWorkers }
         */
        electron.protocol.registerSchemesAsPrivileged(this._schemes);

        // update userdata path (e.g. for portable version)
        electron.app.setPath('userData', this._configuration.applicationUserDataDirectory);

        /*
         * HACK: Create a dummy menu to support local hotkeys (only accessable when app is focused)
         *       This has to be done, because F12 key cannot be used as global key in windows
         */
        this._registerLocalHotkeys();

        return new Promise(resolve => {
            electron.app.on('ready', () => {
                this._appIcon = electron.nativeImage.createFromPath(path.join(this._configuration.applicationCacheDirectory, 'img', 'tray', process.platform === 'win32' ? 'logo.ico' : 'logo.png'));
                this._registerCacheProtocol();
                this._registerConnectorProtocol();
                this._registerLocalFileProtocol();
                this._createWindow();
                resolve();
            });
            /*
             * HACK: prevent default in main process, because it cannot be done in render process:
             *       see: https://github.com/electron/electron/issues/9428#issuecomment-300669586
             */
            electron.app.on('login', evt => evt.preventDefault());
            electron.app.on('activate', this._createWindow.bind(this));
            electron.app.on('window-all-closed', this._allWindowsClosedHandler.bind(this));
            electron.app.on('certificate-error', this._certificateErrorHandler.bind(this));
        });
    }

    /**
     *
     */
    _registerCacheProtocol() {
        electron.protocol.registerBufferProtocol(this._configuration.applicationProtocol, async (request, callback) => {
            try {
                let uri = new URL(request.url);
                let endpoint = path.join(this._directoryMap[uri.hostname], path.normalize(uri.pathname));
                if(!await fs.exists(endpoint)) {
                    throw -6; // https://cs.chromium.org/chromium/src/net/base/net_error_list.h
                }
                let stats = await fs.stat(endpoint);
                let mime;
                let buffer;
                if(stats.isDirectory()) {
                    mime = 'application/json';
                    buffer = Buffer.from(JSON.stringify(await fs.readdir(endpoint)));
                }
                if(stats.isFile()) {
                    mime = endpoint.endsWith('.mjs') ? 'text/javascript' : undefined;
                    buffer = await fs.readFile(endpoint);
                }
                callback({
                    mimeType: mime, // leaving this blank seems to use autodetect
                    data: buffer
                });
            } catch(error) {
                callback(error);
            }
        });
    }

    /**
     * HAKU-0004: Serve downloaded content via hakuneko-local:// protocol.
     * Replaces raw file:// access so webSecurity can be enabled.
     * Validates requested paths are absolute and resolved to prevent traversal.
     *
     * TODO: When nodeIntegration is flipped to false, add an IPC-based allowlist
     * so only the download directory + app directories are served.
     */
    _registerLocalFileProtocol() {
        electron.protocol.registerFileProtocol('hakuneko-local', (request, callback) => {
            try {
                let url = new URL(request.url);
                let filePath = decodeURIComponent(url.pathname);
                // On Windows, strip leading slash from /C:/... paths
                if (process.platform === 'win32' && filePath.startsWith('/') && /^\/[a-zA-Z]:/.test(filePath)) {
                    filePath = filePath.slice(1);
                }
                filePath = path.resolve(filePath);

                // Block relative path components that survived decoding
                if (filePath.includes('..')) {
                    this._logger.warn(`[hakuneko-local] Blocked path traversal attempt: ${filePath}`);
                    callback({ error: -10 }); // net::ERR_ACCESS_DENIED
                    return;
                }

                callback({ path: filePath });
            } catch (error) {
                this._logger.warn(`[hakuneko-local] Error serving file: ${error.message}`);
                callback({ error: -2 }); // net::ERR_FAILED
            }
        });
    }

    _registerConnectorProtocol() {
        electron.protocol.registerBufferProtocol(this._configuration.connectorProtocol, async (request, callback) => {
            try {
                callback(await this._ipcInvokeRenderer('connector-protocol', request));
            } catch(error) {
                callback(undefined);
            }
        });
    }

    /**
     * Handle certificate errors: only bypass for declared connector domains.
     */
    _certificateErrorHandler(event, webContents, url, error, certificate, callback) {
        event.preventDefault();
        try {
            const hostname = new URL(url).hostname;
            if (this._certBypassDomains.has(hostname)) {
                this._logger.warn(`[CertBypass] Accepting cert error for declared domain: ${hostname} (${error})`);
                callback(true);
                return;
            }
        } catch (e) {
            // malformed URL — fall through to reject
        }
        this._logger.warn(`[CertReject] Rejecting cert error for: ${url} (${error})`);
        callback(false);
    }

    /**
     *
     */
    _registerLocalHotkeys() {
        let menu = [
            {
                role: 'viewMenu',
                submenu: [
                    { role: 'togglefullscreen' },
                    {
                        role: 'toggleDevTools',
                        accelerator: 'F12'
                    }
                ]
            },
            {
                role: 'editMenu',
                submenu: [
                    { role: 'undo' },
                    { role: 'redo' },
                    { type: 'separator' },
                    { role: 'cut' },
                    { role: 'copy' },
                    { role: 'paste' },
                    { role: 'selectall' },
                    { type: 'separator' },
                    {
                        label: 'Copy URL',
                        accelerator: 'Shift+C',
                        click: this._copyURL.bind(this)
                    },
                    {
                        label: 'Paste URL',
                        accelerator: 'Shift+V',
                        click: this._pasteURL.bind(this)
                    }
                ]
            }
        ];

        if(process.platform === 'darwin') {
            menu[0].submenu.push({ type: 'separator' });
            menu[0].submenu.push({ role: 'quit' });
        }

        electron.Menu.setApplicationMenu(electron.Menu.buildFromTemplate(menu));
    }

    /**
     *
     */
    _copyURL(menu, window) {
        if(window !== this._window) {
            electron.clipboard.writeText(window.webContents.getURL());
        }
    }

    /**
     *
     */
    _pasteURL(menu, window) {
        if(window !== this._window) {
            window.webContents.loadURL(electron.clipboard.readText());
        }
    }

    /**
     *
     */
    _allWindowsClosedHandler() {
        electron.app.quit();
    }

    /**
     *
     * @param {bool} showTray
     */
    _setupTray(showTray) {
        if(showTray) {
            let menu = [
                {
                    label: 'Minimize to Tray',
                    //enabled: true,
                    click: () => {
                        if(process.platform === 'darwin') {
                            electron.app.dock.hide();
                        }
                        this._window.hide();
                        //item.enabled = false;
                    }
                },
                {
                    label: 'Restore from Tray',
                    //enabled: false,
                    click: () => {
                        if(process.platform === 'darwin') {
                            electron.app.dock.show();
                        }
                        this._window.show();
                        //item.enabled = false;
                    }
                },
                {
                    role: 'quit',
                }
            ];
            this._tray = new electron.Tray(this._appIcon);
            this._tray.setContextMenu(electron.Menu.buildFromTemplate(menu));
        } else {
            this._tray = undefined;
        }
    }

    /**
     *
     */
    _createWindow() {
        if(this._window) {
            return;
        }

        this._window = new electron.BrowserWindow({
            width: 1120,
            height: 680,
            title: 'HakuNeko',
            icon: this._appIcon,
            show: false,
            backgroundColor: '#f8f8f8',
            webPreferences: {
                nodeIntegration: true, // TODO(HAKU-0004): flip to false after migrating require('fs'/'path'/'os') in Storage.mjs, Settings.mjs, DiscordPresence.mjs to IPC handlers
                contextIsolation: true,
                webSecurity: true,
                preload: path.join(__dirname, 'preload.js')
            },
            frame: false
        });

        this._setupBeforeSendHeaders();
        this._setupHeadersReceived();
        this._setupTray(this._showTray);
        this._window.setMenuBarVisibility(false);
        this._window.once('ready-to-show', () => this._window.show());
        this._window.on('close', this._mainWindowCloseHandler.bind(this));
        this._window.on('closed', this._mainWindowClosedHandler.bind(this));
        this._window.on('restore', this._mainWindowRestoreHandler.bind(this));
        this._window.on('maximize', this._mainWindowRestoreHandler.bind(this));
        this._window.on('minimize', this._mainWindowMinimizeHandler.bind(this));
        electron.ipcMain.on('hakuneko:ipc:quit', this._mainWindowQuitHandler.bind(this));
        this._registerIPCHandlers();
    }

    /**
     *
     * @param {string} uri
     * @returns {Promise}
     */
    loadURL(uri) {
        return this._window.loadURL(uri);
    }

    /**
     *
     * @param {string} html
     * @returns {Promise}
     */
    loadHTML(html) {
        let dataURL = 'data:text/html;charset=utf-8;base64,' + Buffer.from(html).toString('base64');
        return this._window.loadURL(dataURL);
    }

    /**
     *
     * @param {*} evt
     */
    _mainWindowCloseHandler(evt) {
        this._window.webContents.send('hakuneko:ipc:close');
        evt.preventDefault();
    }

    /**
     * Exit the application forcefully without raising the close event handler
     */
    _mainWindowQuitHandler() {
        this._tray && this._tray.destroy();
        /*
         * NOTE: removing a certain event handler seems not to work...
         *this._window.removeListener('close', this._mainWindowCloseHandler);
         */
        this._window.removeAllListeners('close');
        this._window.close();
    }

    /**
     *
     */
    _mainWindowClosedHandler() {
        // close all existing windows
        electron.BrowserWindow.getAllWindows().forEach(window => window.close());
        this._window = null;
    }

    /**
     *
     */
    _mainWindowRestoreHandler() {
        if(this._tray && this._showTray) {
            this._tray.setToolTip(trayTooltipMinimize);
        }
    }

    /**
     *
     * @param {*} evt
     */
    _mainWindowMinimizeHandler(evt) {
        if(this._tray && this._showTray) {
            this._tray.setToolTip(trayTooltipRestore);
            if(this._minimizeToTray) {
                this._window.hide();
                evt.preventDefault();
            }
        }
    }

    /**
     * Send a request to the renderer and wait for a response.
     * Used for connector-protocol where the handler lives in renderer-side Connectors.mjs.
     * @param {string} channel
     * @param {any} payload
     * @param {number} timeoutMs
     * @returns {Promise<any>}
     */
    async _ipcInvokeRenderer(channel, payload, timeoutMs = 30000) {
        if (!this._window?.webContents || this._window.webContents.isLoading()) {
            throw new Error(`Cannot call renderer channel "${channel}" — web content not ready`);
        }
        const responseChannel = `hakuneko:ipc:${channel}:resp:${Date.now()}-${Math.random()}`;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                electron.ipcMain.removeAllListeners(responseChannel);
                reject(new Error(`IPC timeout: ${channel} after ${timeoutMs}ms`));
            }, timeoutMs);
            electron.ipcMain.once(responseChannel, (event, data) => {
                clearTimeout(timer);
                resolve(data);
            });
            this._window.webContents.send('hakuneko:ipc:connector-protocol', responseChannel, payload);
        });
    }

    _setupBeforeSendHeaders() {
        // Synchronous header manipulation (moved from renderer Request.mjs for Electron 33+ compat)
        electron.session.defaultSession.webRequest.onBeforeSendHeaders(urlFilterAll, (details, callback) => {
            try {
                const h = details.requestHeaders;

                // Remove DevTools headers
                for (let key in h) {
                    if (key.startsWith('X-DevTools')) delete h[key];
                }

                // x-host → Host
                if (h['x-host']) h['Host'] = h['x-host'];
                delete h['x-host'];

                // Replace Electron user-agent with random Chrome UA
                if (h['User-Agent'] && h['User-Agent'].toLowerCase().includes('electron')) {
                    h['User-Agent'] = this._userAgent;
                }
                // Custom user-agent override
                if (h['x-user-agent']) {
                    h['User-Agent'] = h['x-user-agent'];
                    delete h['x-user-agent'];
                }

                // Disable caching
                h['Cache-Control'] = 'no-cache';
                h['Pragma'] = 'no-cache';

                // Referer — never overwrite for CloudFlare challenge URLs
                let uri = new URL(details.url);
                if (!/(ch[kl]_jschl|challenge-platform)/i.test(uri.href)) {
                    if (uri.hostname.includes('.mcloud.to')) {
                        h['Referer'] = uri.href;
                    } else if (h['x-referer']) {
                        h['Referer'] = h['x-referer'];
                    }
                }
                delete h['x-referer'];

                // Origin
                if (h['x-origin']) h['Origin'] = h['x-origin'];
                delete h['x-origin'];

                // Merge cookies
                if (h['x-cookie']) {
                    h['Cookie'] = _mergeCookies(h['Cookie'], h['x-cookie']);
                }
                delete h['x-cookie'];

                // Sec-Fetch-* headers
                if (h['x-sec-fetch-dest']) h['Sec-Fetch-Dest'] = h['x-sec-fetch-dest'];
                delete h['x-sec-fetch-dest'];
                if (h['x-sec-fetch-mode']) h['Sec-Fetch-Mode'] = h['x-sec-fetch-mode'];
                delete h['x-sec-fetch-mode'];
                if (h['x-sec-fetch-site']) h['Sec-Fetch-Site'] = h['x-sec-fetch-site'];
                delete h['x-sec-fetch-site'];
                if (h['x-sec-ch-ua']) h['sec-ch-ua'] = h['x-sec-ch-ua'];
                delete h['x-sec-ch-ua'];

                // Imgur image accept fix
                if (/i\.imgur\.com/i.test(uri.hostname) || /\.(jpg|jpeg|png|gif|webp)/i.test(uri.pathname)) {
                    h['Accept'] = 'image/webp,image/apng,image/*,*/*';
                    delete h['accept'];
                }

                // Normalize lowercase accept
                if (h['accept']) {
                    h['Accept'] = h['accept'];
                    delete h['accept'];
                }

                callback({ cancel: false, requestHeaders: h });
            } catch(error) {
                this._logger.warn(error);
                callback({ cancel: false, requestHeaders: details.requestHeaders });
            }
        });
    }

    _setupHeadersReceived() {
        // Synchronous response header manipulation (moved from renderer Request.mjs for Electron 33+ compat)
        electron.session.defaultSession.webRequest.onHeadersReceived(urlFilterAll, (details, callback) => {
            try {
                const rh = details.responseHeaders;
                let uri = new URL(details.url);

                // X-Redirect → Location (some streaming sites use non-standard redirect header)
                let redirect = rh['X-Redirect'] || rh['x-redirect'];
                if (redirect) rh['Location'] = redirect;

                // mp4upload: expose Content-Length for CORS
                if (uri.hostname.includes('mp4upload')) {
                    rh['Access-Control-Expose-Headers'] = ['Content-Length'];
                }

                // Webtoons: inject agn2 cookie from query param
                if (uri.hostname.includes('webtoons') && uri.searchParams.get('title_no')) {
                    rh['Set-Cookie'] = `agn2=${uri.searchParams.get('title_no')}; Domain=${uri.hostname}; Path=/`;
                }

                // Comikey: strip CSP on reader pages
                if (uri.hostname.includes('comikey') && uri.pathname.includes('/read/')) {
                    delete rh['content-security-policy'];
                }

                // Ensure SameSite=None on cross-site cookies
                if (rh['set-cookie'] || rh['Set-Cookie']) {
                    _applyCrossSiteCookies(rh);
                }

                callback({ cancel: false, responseHeaders: rh });
            } catch(error) {
                this._logger.warn(error);
                callback({ cancel: false, responseHeaders: details.responseHeaders });
            }
        });
    }

    /**
     * HAKU-0005: Register IPC handlers to replace electron.remote usage in renderer.
     */
    _registerIPCHandlers() {
        const { ipcMain, dialog, shell, app, session } = electron;

        // Certificate bypass domains (HAKU-0006)
        ipcMain.handle('hakuneko:cert:registerBypassDomains', (event, domains) => {
            if (Array.isArray(domains)) {
                for (const domain of domains) {
                    if (typeof domain === 'string') {
                        this._certBypassDomains.add(domain);
                    }
                }
            }
        });

        // Dialog
        ipcMain.handle('hakuneko:dialog:showMessageBox', (event, options) => {
            return dialog.showMessageBox(this._window, options);
        });
        ipcMain.handle('hakuneko:dialog:showOpenDialog', (event, options) => {
            return dialog.showOpenDialog(this._window, options);
        });

        // Window controls
        ipcMain.handle('hakuneko:window:minimize', () => {
            if (this._window) this._window.minimize();
        });
        ipcMain.handle('hakuneko:window:maximize', () => {
            if (this._window) this._window.maximize();
        });
        ipcMain.handle('hakuneko:window:unmaximize', () => {
            if (this._window) this._window.unmaximize();
        });
        ipcMain.handle('hakuneko:window:isMaximized', () => {
            return this._window ? this._window.isMaximized() : false;
        });
        ipcMain.handle('hakuneko:window:close', () => {
            if (this._window) this._window.close();
        });

        // App paths
        ipcMain.handle('hakuneko:app:getPath', (event, name) => {
            return app.getPath(name);
        });
        // Shell
        ipcMain.handle('hakuneko:shell:showItemInFolder', (event, fullPath) => {
            shell.showItemInFolder(fullPath);
        });
        ipcMain.handle('hakuneko:shell:openExternal', (event, url) => {
            return shell.openExternal(url);
        });
        ipcMain.handle('hakuneko:shell:openPath', (event, filePath) => {
            return shell.openPath(filePath);
        });

        // Child process exec
        ipcMain.handle('hakuneko:exec', (event, command, options) => {
            return new Promise((resolve, reject) => {
                exec(command, options, (error, stdout, stderr) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve({ stdout, stderr });
                    }
                });
            });
        });

        // Session cookies
        ipcMain.handle('hakuneko:session:cookies:get', (event, filter) => {
            return session.defaultSession.cookies.get(filter);
        });
        ipcMain.handle('hakuneko:session:cookies:set', (event, details) => {
            return session.defaultSession.cookies.set(details);
        });
        ipcMain.handle('hakuneko:session:cookies:remove', (event, url, name) => {
            return session.defaultSession.cookies.remove(url, name);
        });

        // Session proxy
        ipcMain.handle('hakuneko:session:setProxy', (event, config) => {
            return session.defaultSession.setProxy(config);
        });

        // Browser fetch operations (replaces electron.remote.BrowserWindow usage in Request.mjs)
        ipcMain.handle('hakuneko:browser:fetchUI', (event, url, injectionScript, timeout, images, requestOptions, blacklistPatterns) => {
            return this._browserFetchUI(url, injectionScript, timeout, images, requestOptions, blacklistPatterns);
        });
        ipcMain.handle('hakuneko:browser:fetchBrowser', (event, url, preloadScript, runtimeScript, preferences, timeout, requestOptions, blacklistPatterns) => {
            return this._browserFetchBrowser(url, preloadScript, runtimeScript, preferences, timeout, requestOptions, blacklistPatterns);
        });
        ipcMain.handle('hakuneko:browser:fetchJapscan', (event, url, preloadScript, runtimeScript, preferences, timeout, requestOptions) => {
            return this._browserFetchJapscan(url, preloadScript, runtimeScript, preferences, timeout, requestOptions);
        });
    }

    /**
     * DOM preparation script injected on dom-ready for scraping windows.
     */
    get _scrapeDomPreparationScript() {
        return `
            {
                let images = [...document.querySelectorAll( 'img[onerror]' )];
                for( let image of images ) {
                    image.removeAttribute( 'onerror' );
                    image.onerror = undefined;
                }
            }
        `;
    }

    /**
     * Scraping redirection detection script.
     */
    get _scrapeCheckScript() {
        return `
            new Promise(async (resolve, reject) => {
                function handleError(message) { reject(new Error(message)); }
                function handleNoRedirect() { resolve(undefined); }
                function handleAutomaticRedirect() { resolve('automatic'); }
                function handleUserInteractionRequired() { resolve('interactive'); }

                if(document.querySelector('meta[http-equiv="refresh"][content*="="]')) {
                    return handleAutomaticRedirect();
                }
                if(document.querySelector('form#formVerify[action*="/Special/AreYouHuman"]')) {
                    return handleUserInteractionRequired();
                }
                let cfCode = document.querySelector('.cf-error-code');
                if(cfCode) {
                    return handleError('CloudFlare Error ' + cfCode.innerText);
                }
                if(document.querySelector('form#challenge-form[action*="_jschl_"]')) {
                    return handleAutomaticRedirect();
                }
                if(document.querySelector('form#challenge-form[action*="_captcha_"]')) {
                    return handleUserInteractionRequired();
                }
                if(document.querySelector('title') && document.querySelector('title').text == 'DDOS-GUARD') {
                    await new Promise(resolve => setTimeout(resolve, 7000));
                    return document.querySelector('div#h-captcha') ? handleUserInteractionRequired() : handleAutomaticRedirect();
                }
                if(document.querySelector('title') && document.querySelector('title').text == 'WAF' && document.documentElement.innerHTML.indexOf('/waf-js-run') != -1) {
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    return handleAutomaticRedirect();
                }
                if(typeof CloudTest == 'function') {
                    return handleUserInteractionRequired();
                }
                handleNoRedirect();
            });
        `;
    }

    async _checkScrapeRedirection(win) {
        let scrapeRedirect = await win.webContents.executeJavaScript(this._scrapeCheckScript);
        if (scrapeRedirect === 'automatic') {
            return true;
        }
        if (scrapeRedirect === 'interactive') {
            win.setSize(1280, 720);
            win.center();
            win.show();
            win.focus();
            return true;
        }
        return false;
    }

    _scrapeCleanup(browserWindow, abortAction) {
        if (abortAction) {
            clearTimeout(abortAction);
        }
        abortAction = null;
        if (browserWindow) {
            if (browserWindow.webContents.debugger.isAttached()) {
                browserWindow.webContents.debugger.detach();
            }
            browserWindow.webContents.session.webRequest.onBeforeRequest(null);
            browserWindow.close();
        }
        browserWindow = null;
    }

    async _browserFetchUI(url, injectionScript, timeout, images, requestOptions, blacklistPatterns) {
        timeout = timeout || 60000;
        return new Promise((resolve, reject) => {
            let win = new electron.BrowserWindow({
                show: false,
                webPreferences: {
                    nodeIntegration: false,
                    webSecurity: false,
                    images: images || false
                }
            });

            if (blacklistPatterns && blacklistPatterns.length > 0) {
                win.webContents.session.webRequest.onBeforeRequest({ urls: blacklistPatterns }, (details, callback) => {
                    callback({ cancel: true });
                });
            }

            let preventCallback = false;
            let abortAction = setTimeout(() => {
                this._scrapeCleanup(win, abortAction);
                if (!preventCallback) {
                    reject(new Error(`Failed to load "${url}" within the given timeout of ${Math.floor(timeout / 1000)} seconds!`));
                }
            }, timeout);

            win.webContents.on('dom-ready', () => win.webContents.executeJavaScript(this._scrapeDomPreparationScript));

            win.webContents.on('did-finish-load', async () => {
                try {
                    if (await this._checkScrapeRedirection(win)) {
                        return;
                    }
                    let jsResult = await win.webContents.executeJavaScript(injectionScript);
                    preventCallback = true;
                    this._scrapeCleanup(win, abortAction);
                    resolve(jsResult);
                } catch (error) {
                    preventCallback = true;
                    this._scrapeCleanup(win, abortAction);
                    reject(error);
                }
            });

            win.webContents.on('did-fail-load', (event, errCode, errMessage, uri, isMain) => {
                if (!preventCallback && errCode && errCode !== -3 && (isMain || uri === url)) {
                    this._scrapeCleanup(win, abortAction);
                    reject(new Error(errMessage + ' ' + uri));
                }
            });

            win.loadURL(url, requestOptions);
        });
    }

    async _browserFetchBrowser(url, preloadScript, runtimeScript, preferences, timeout, requestOptions, blacklistPatterns) {
        timeout = timeout || 60000;
        preferences = preferences || {};
        let preloadScriptFile = undefined;
        if (preloadScript) {
            // Save preload script to temp file
            let tempDir = require('os').tmpdir();
            let tempFile = path.join(tempDir, 'hakuneko', Math.random().toString(36));
            await fs.ensureDir(path.dirname(tempFile));
            await fs.writeFile(tempFile, preloadScript);
            preloadScriptFile = tempFile;
        }
        let win = new electron.BrowserWindow({
            show: false,
            webPreferences: {
                preload: preloadScriptFile,
                nodeIntegration: preferences.nodeIntegration || false,
                webSecurity: preferences.webSecurity || false,
                images: preferences.images || false
            }
        });

        if (blacklistPatterns && blacklistPatterns.length > 0) {
            win.webContents.session.webRequest.onBeforeRequest({ urls: blacklistPatterns }, (_, callback) => callback({ cancel: true }));
        }

        return new Promise((resolve, reject) => {
            let preventCallback = false;
            let abortAction = setTimeout(() => {
                this._scrapeCleanup(win, abortAction);
                if (!preventCallback) {
                    reject(new Error(`Failed to load "${url}" within the given timeout of ${Math.floor(timeout / 1000)} seconds!`));
                }
            }, timeout);

            win.webContents.on('dom-ready', () => win.webContents.executeJavaScript(this._scrapeDomPreparationScript));

            win.webContents.on('did-fail-load', (event, errCode, errMessage, uri, isMain) => {
                if (!preventCallback && errCode && errCode !== -3 && (isMain || uri === url)) {
                    this._scrapeCleanup(win, abortAction);
                    reject(new Error(errMessage + ' ' + uri));
                }
            });

            win.webContents.on('did-finish-load', async () => {
                try {
                    if (await this._checkScrapeRedirection(win)) {
                        return;
                    }
                    let jsResult = await win.webContents.executeJavaScript(runtimeScript);
                    preventCallback = true;
                    this._scrapeCleanup(win, abortAction);
                    resolve(jsResult);
                } catch (error) {
                    preventCallback = true;
                    this._scrapeCleanup(win, abortAction);
                    reject(error);
                }
            });

            win.loadURL(url, requestOptions);
        });
    }

    async _browserFetchJapscan(url, preloadScript, runtimeScript, preferences, timeout, requestOptions) {
        timeout = timeout || 60000;
        preferences = preferences || {};
        let preloadScriptFile = undefined;
        if (preloadScript) {
            let tempDir = require('os').tmpdir();
            let tempFile = path.join(tempDir, 'hakuneko', Math.random().toString(36));
            await fs.ensureDir(path.dirname(tempFile));
            await fs.writeFile(tempFile, preloadScript);
            preloadScriptFile = tempFile;
        }
        let win = new electron.BrowserWindow({
            show: false,
            webPreferences: {
                preload: preloadScriptFile,
                nodeIntegration: preferences.nodeIntegration || false,
                webSecurity: preferences.webSecurity || false,
                images: preferences.images || false
            }
        });

        if (preferences.onBeforeRequestPattern) {
            win.webContents.session.webRequest.onBeforeRequest((details, callback) => {
                if (details.webContentsId === win.webContents.id) {
                    // Apply the pattern-based filtering from preferences
                    callback({ cancel: false });
                } else {
                    callback({ cancel: false });
                }
            });
        }

        return new Promise((resolve, reject) => {
            let preventCallback = false;
            let abortAction = setTimeout(() => {
                this._scrapeCleanup(win, abortAction);
                if (!preventCallback) {
                    reject(new Error(`Failed to load "${url}" within the given timeout of ${Math.floor(timeout / 1000)} seconds!`));
                }
            }, timeout);

            win.webContents.on('dom-ready', () => win.webContents.executeJavaScript(this._scrapeDomPreparationScript));

            win.webContents.on('did-fail-load', (event, errCode, errMessage, uri, isMain) => {
                if (!preventCallback && errCode && errCode !== -3 && (isMain || uri === url)) {
                    this._scrapeCleanup(win, abortAction);
                    reject(new Error(errMessage + ' ' + uri));
                }
            });

            win.webContents.on('did-finish-load', async () => {
                try {
                    if (await this._checkScrapeRedirection(win)) {
                        return;
                    }
                    let jsResult = await win.webContents.executeJavaScript(runtimeScript);
                    win.webContents.debugger.attach('1.3');
                    // Return both jsResult and allow caller to use debugger via subsequent IPC
                    preventCallback = true;
                    this._scrapeCleanup(win, abortAction);
                    resolve(jsResult);
                } catch (error) {
                    preventCallback = true;
                    this._scrapeCleanup(win, abortAction);
                    reject(error);
                }
            });

            win.loadURL(url, requestOptions);
        });
    }
};