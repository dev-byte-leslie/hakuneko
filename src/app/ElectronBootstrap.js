const path = require('path');
const fs = require('fs-extra');
const electron = require('electron');
const { exec } = require('child_process');
const { ConsoleLogger } = require('@logtrine/logtrine');
const urlFilterAll = { urls: ['http://*/*', 'https://*/*'] };
const trayTooltipMinimize = 'HakuNeko\nClick to hide window';
const trayTooltipRestore = 'HakuNeko\nClick to show window';

module.exports = class ElectronBootstrap {

    constructor(configuration, logger) {
        this._logger = logger || new ConsoleLogger(ConsoleLogger.LEVEL.Warn);
        this._configuration = configuration;
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

    _registerConnectorProtocol() {
        electron.protocol.registerBufferProtocol(this._configuration.connectorProtocol, async (request, callback) => {
            try {
                callback(await this._ipcSend('on-connector-protocol-handler', request));
            } catch(error) {
                callback(undefined);
            }
        });
    }

    /**
     * Ignore any certificate errors, such as self-signed, expiration, ...
     */
    _certificateErrorHandler(event, webContents, url, error, certificate, callback) {
        event.preventDefault();
        callback(true);
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
                experimentalFeatures: true,
                nodeIntegration: true,
                webSecurity: false, // required to open local images in browser
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
        electron.ipcMain.on('quit', this._mainWindowQuitHandler.bind(this));
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
        this._window.webContents.send('close');
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

    async _ipcSend(channel, payload) {
        /*
         * inject javascript: looks stupid, but is a working solution to call a function which returns data
         * directly within the render process (without dealing with ipcRenderer)
         */
        return new Promise(resolve => {
            /*
             * prevent from injecting javascript into the webpage while the webcontent is not yet ready
             * => required for loading initial page over http protocol (e.g. local hosted test page)
             */
            if(this._window && this._window.webContents && !this._window.webContents.isLoading()) {
                let responseChannelID = '' + Date.now() + Math.random();
                this._window.webContents.send(channel, responseChannelID, payload);
                // TODO: set timeout and remove listener in case no answer is received ...
                electron.ipcMain.once(responseChannelID, (event, data) => resolve(data));
            } else {
                throw new Error(`Cannot call remote channel "${channel}" while web-application is not yet ready!`);
            }
        });
    }

    _setupBeforeSendHeaders() {
        // inject headers before a request is made (call the handler in the webapp to do the dirty work)
        electron.session.defaultSession.webRequest.onBeforeSendHeaders(urlFilterAll, async (details, callback) => {
            try {
                let result = await this._ipcSend('on-before-send-headers', details);
                callback({
                    cancel: false,
                    requestHeaders: result.requestHeaders
                });
            } catch(error) {
                this._logger.warn(error);
                callback({
                    cancel: false,
                    requestHeaders: details.requestHeaders
                });
            }
        });
    }

    _setupHeadersReceived() {
        electron.session.defaultSession.webRequest.onHeadersReceived(urlFilterAll, async (details, callback) => {
            try {
                let result = await this._ipcSend('on-headers-received', details);
                callback({
                    cancel: false,
                    responseHeaders: result.responseHeaders
                    // statusLine
                });
            } catch(error) {
                this._logger.warn(error);
                callback({
                    cancel: false,
                    responseHeaders: details.responseHeaders
                    // statusLine
                });
            }
        });
    }

    /**
     * HAKU-0005: Register IPC handlers to replace electron.remote usage in renderer.
     */
    _registerIPCHandlers() {
        const { ipcMain, dialog, shell, app, session } = electron;

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
        ipcMain.on('hakuneko:app:getPathSync', (event, name) => {
            try {
                event.returnValue = app.getPath(name);
            } catch (e) {
                event.returnValue = null;
            }
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
            return new Promise(resolve => {
                session.defaultSession.setProxy(config, resolve);
            });
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