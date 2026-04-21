const { contextBridge, ipcRenderer, clipboard } = require('electron');

/**
 * HAKU-0005: preload script that replaces electron.remote usage.
 * Exposes a scoped hakunekoAPI via contextBridge for renderer access.
 */

const hakunekoAPI = {
    dialog: {
        showMessageBox: (options) => ipcRenderer.invoke('hakuneko:dialog:showMessageBox', options),
        showOpenDialog: (options) => ipcRenderer.invoke('hakuneko:dialog:showOpenDialog', options),
    },
    window: {
        minimize: () => ipcRenderer.invoke('hakuneko:window:minimize'),
        maximize: () => ipcRenderer.invoke('hakuneko:window:maximize'),
        unmaximize: () => ipcRenderer.invoke('hakuneko:window:unmaximize'),
        isMaximized: () => ipcRenderer.invoke('hakuneko:window:isMaximized'),
        close: () => ipcRenderer.invoke('hakuneko:window:close'),
    },
    app: {
        getPath: (name) => ipcRenderer.invoke('hakuneko:app:getPath', name),
        quit: () => ipcRenderer.send('hakuneko:ipc:quit'),
    },
    shell: {
        showItemInFolder: (fullPath) => ipcRenderer.invoke('hakuneko:shell:showItemInFolder', fullPath),
        openExternal: (url) => ipcRenderer.invoke('hakuneko:shell:openExternal', url),
        openPath: (path) => ipcRenderer.invoke('hakuneko:shell:openPath', path),
    },
    exec: {
        ffmpeg: (command, options) => ipcRenderer.invoke('hakuneko:exec:ffmpeg', command, options),
        postCommand: (command, options) => ipcRenderer.invoke('hakuneko:exec:postCommand', command, options),
    },
    platform: process.platform,
    isPortable: !!process.env.HAKUNEKO_PORTABLE,
    session: {
        cookies: {
            get: (filter) => ipcRenderer.invoke('hakuneko:session:cookies:get', filter),
            set: (details) => ipcRenderer.invoke('hakuneko:session:cookies:set', details),
            remove: (url, name) => ipcRenderer.invoke('hakuneko:session:cookies:remove', url, name),
        },
        setProxy: (config) => ipcRenderer.invoke('hakuneko:session:setProxy', config),
    },
    cert: {
        registerBypassDomains: (domains) => ipcRenderer.invoke('hakuneko:cert:registerBypassDomains', domains),
    },
    clipboard: {
        readText: () => clipboard.readText(),
        writeText: (text) => clipboard.writeText(text),
    },
    browser: {
        fetchUI: (url, injectionScript, timeout, images, requestOptions, blacklistPatterns) =>
            ipcRenderer.invoke('hakuneko:browser:fetchUI', url, injectionScript, timeout, images, requestOptions, blacklistPatterns),
        fetchBrowser: (url, preloadScript, runtimeScript, preferences, timeout, requestOptions, blacklistPatterns) =>
            ipcRenderer.invoke('hakuneko:browser:fetchBrowser', url, preloadScript, runtimeScript, preferences, timeout, requestOptions, blacklistPatterns),
        fetchJapscan: (url, preloadScript, runtimeScript, preferences, timeout, requestOptions) =>
            ipcRenderer.invoke('hakuneko:browser:fetchJapscan', url, preloadScript, runtimeScript, preferences, timeout, requestOptions),
    },
    ipc: {
        on: (channel, callback) => {
            const allowedChannels = ['hakuneko:ipc:connector-protocol', 'hakuneko:ipc:close'];
            if (allowedChannels.includes(channel)) {
                ipcRenderer.on(channel, callback);
            }
        },
        send: (channel, ...args) => {
            const allowedSendChannels = ['hakuneko:ipc:quit'];
            // Dynamic response channels: timestamp digits + optional decimal (e.g. "1718234567890.123")
            const isDynamicResponseChannel = /^\d{13,}\.?\d*$/.test(channel);
            if (allowedSendChannels.includes(channel) || isDynamicResponseChannel) {
                ipcRenderer.send(channel, ...args);
            } else {
                console.warn(`[preload] Blocked ipc.send to disallowed channel: ${channel}`);
            }
        },
    },
    fs: {
        readFile: async (filePath, encoding) => {
            if (filePath && typeof filePath === 'object' && typeof filePath.then === 'function') {
                throw new TypeError('Unawaited promise passed as file path to fs.readFile — missing await?');
            }
            return ipcRenderer.invoke('hakuneko:fs:readFile', filePath, encoding);
        },
        writeFile: async (filePath, data) => {
            if (filePath && typeof filePath === 'object' && typeof filePath.then === 'function') {
                throw new TypeError('Unawaited promise passed as file path to fs.writeFile — missing await?');
            }
            return ipcRenderer.invoke('hakuneko:fs:writeFile', filePath, data);
        },
        appendFile: async (filePath, data) => {
            if (filePath && typeof filePath === 'object' && typeof filePath.then === 'function') {
                throw new TypeError('Unawaited promise passed as file path to fs.appendFile — missing await?');
            }
            return ipcRenderer.invoke('hakuneko:fs:appendFile', filePath, data);
        },
        readdir: (dirPath) => ipcRenderer.invoke('hakuneko:fs:readdir', dirPath),
        stat: (filePath) => ipcRenderer.invoke('hakuneko:fs:stat', filePath),
        exists: (filePath) => ipcRenderer.invoke('hakuneko:fs:existsSync', filePath),
        mkdir: (dirPath) => ipcRenderer.invoke('hakuneko:fs:mkdir', dirPath),
        unlinkSync: (filePath) => ipcRenderer.invoke('hakuneko:fs:unlinkSync', filePath),
    },
    path: {
        join: async (...segments) => {
            for (const s of segments) {
                if (s && typeof s === 'object' && typeof s.then === 'function') {
                    throw new TypeError('Unawaited promise passed to path.join — missing await?');
                }
            }
            return ipcRenderer.invoke('hakuneko:path:join', ...segments);
        },
        resolve: async (...segments) => {
            for (const s of segments) {
                if (s && typeof s === 'object' && typeof s.then === 'function') {
                    throw new TypeError('Unawaited promise passed to path.resolve — missing await?');
                }
            }
            return ipcRenderer.invoke('hakuneko:path:resolve', ...segments);
        },
        dirname: (p) => ipcRenderer.invoke('hakuneko:path:dirname', p),
        basename: (p, ext) => ipcRenderer.invoke('hakuneko:path:basename', p, ext),
        extname: (p) => ipcRenderer.invoke('hakuneko:path:extname', p),
        parse: (p) => ipcRenderer.invoke('hakuneko:path:parse', p),
        sep: process.platform === 'win32' ? '\\' : '/',
    },
    os: {
        tmpdir: () => ipcRenderer.invoke('hakuneko:os:tmpdir'),
    },
    discord: {
        start: () => ipcRenderer.invoke('hakuneko:discord:start'),
        stop: () => ipcRenderer.invoke('hakuneko:discord:stop'),
        setActivity: (status) => ipcRenderer.invoke('hakuneko:discord:setActivity', status),
    },
};

// Use contextBridge if contextIsolation is enabled, otherwise set on window directly.
// This allows the preload to work both before and after HAKU-0004 flips contextIsolation.
if (process.contextIsolated) {
    contextBridge.exposeInMainWorld('hakunekoAPI', hakunekoAPI);
} else {
    window.hakunekoAPI = hakunekoAPI;
}
