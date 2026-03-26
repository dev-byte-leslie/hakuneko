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
        // Synchronous path getter for use in constructors (uses sendSync)
        getPathSync: (name) => ipcRenderer.sendSync('hakuneko:app:getPathSync', name),
    },
    shell: {
        showItemInFolder: (fullPath) => ipcRenderer.invoke('hakuneko:shell:showItemInFolder', fullPath),
        openExternal: (url) => ipcRenderer.invoke('hakuneko:shell:openExternal', url),
        openPath: (path) => ipcRenderer.invoke('hakuneko:shell:openPath', path),
    },
    exec: (command, options) => ipcRenderer.invoke('hakuneko:exec', command, options),
    platform: process.platform,
    session: {
        cookies: {
            get: (filter) => ipcRenderer.invoke('hakuneko:session:cookies:get', filter),
            set: (details) => ipcRenderer.invoke('hakuneko:session:cookies:set', details),
            remove: (url, name) => ipcRenderer.invoke('hakuneko:session:cookies:remove', url, name),
        },
        setProxy: (config) => ipcRenderer.invoke('hakuneko:session:setProxy', config),
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
            const allowedChannels = ['on-before-send-headers', 'on-headers-received', 'on-connector-protocol-handler', 'close'];
            if (allowedChannels.includes(channel)) {
                ipcRenderer.on(channel, callback);
            }
        },
        send: (channel, ...args) => {
            ipcRenderer.send(channel, ...args);
        },
    },
};

// Use contextBridge if contextIsolation is enabled, otherwise set on window directly.
// This allows the preload to work both before and after HAKU-0004 flips contextIsolation.
if (process.contextIsolated) {
    contextBridge.exposeInMainWorld('hakunekoAPI', hakunekoAPI);
} else {
    window.hakunekoAPI = hakunekoAPI;
}
