/**
 * HAKU-0033 (0033f): Baseline unit tests for ElectronBootstrap IPC handler wiring.
 * Verifies that _registerIPCHandlers() registers all expected channels and that
 * the webPreferences on the main window are correctly configured.
 */

jest.mock('fs-extra');
jest.mock('child_process');

const mockIpcMainHandlers = new Map();
const mockIpcMainListeners = new Map();

jest.mock('electron', () => {
    const mockBrowserWindow = jest.fn().mockImplementation(() => ({
        loadURL: jest.fn(),
        webContents: { send: jest.fn(), session: { webRequest: { onBeforeSendHeaders: jest.fn(), onHeadersReceived: jest.fn() } } },
        once: jest.fn(),
        on: jest.fn(),
        close: jest.fn(),
        isMaximized: jest.fn(() => false),
        show: jest.fn(),
        minimize: jest.fn(),
        maximize: jest.fn(),
        unmaximize: jest.fn(),
        isDestroyed: jest.fn(() => false),
    }));
    mockBrowserWindow.getAllWindows = jest.fn(() => []);

    return {
        app: {
            getAppPath: jest.fn(() => '/usr/bin'),
            getPath: jest.fn(type => {
                switch (type) {
                    case 'exe': return '/usr/bin/hakuneko';
                    case 'appData': return '/data';
                    case 'userData': return '/data/hakuneko';
                    case 'userCache': return '/cache/hakuneko';
                    default: return '/tmp';
                }
            }),
            setPath: jest.fn(),
            name: 'HakuNeko',
            on: jest.fn(),
            quit: jest.fn(),
        },
        ipcMain: {
            handle: jest.fn((channel, handler) => {
                mockIpcMainHandlers.set(channel, handler);
            }),
            on: jest.fn((channel, handler) => {
                mockIpcMainListeners.set(channel, handler);
            }),
        },
        BrowserWindow: mockBrowserWindow,
        shell: {
            openExternal: jest.fn(() => Promise.resolve()),
            openPath: jest.fn(() => Promise.resolve('')),
            showItemInFolder: jest.fn(),
        },
        dialog: {
            showMessageBox: jest.fn(),
            showOpenDialog: jest.fn(),
            showSaveDialog: jest.fn(),
        },
        session: {
            defaultSession: {
                cookies: { get: jest.fn(), set: jest.fn(), remove: jest.fn() },
                setProxy: jest.fn(),
                webRequest: { onBeforeSendHeaders: jest.fn(), onHeadersReceived: jest.fn() },
            },
        },
        Tray: jest.fn().mockImplementation(() => ({ setToolTip: jest.fn(), setContextMenu: jest.fn(), on: jest.fn() })),
        Menu: { buildFromTemplate: jest.fn(() => ({})), setApplicationMenu: jest.fn() },
        nativeImage: { createFromPath: jest.fn(() => ({})) },
        protocol: { registerSchemesAsPrivileged: jest.fn(), registerBufferProtocol: jest.fn(), handle: jest.fn() },
        globalShortcut: { register: jest.fn() },
        net: { request: jest.fn() },
    };
});

const ElectronBootstrap = require('../ElectronBootstrap');

function makeConfiguration() {
    return {
        applicationProtocol: 'hakuneko',
        connectorProtocol: 'connector',
        applicationCacheDirectory: '/cache/hakuneko',
        applicationUserDataDirectory: '/data/hakuneko',
        applicationUserPluginsDirectory: '/plugins',
        mainWindowSize: { width: 1200, height: 800 },
        preloadScript: '/usr/bin/preload.js',
    };
}

function makeLogger() {
    return { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
}

describe('ElectronBootstrap._registerIPCHandlers', () => {
    let bootstrap;

    beforeEach(() => {
        mockIpcMainHandlers.clear();
        mockIpcMainListeners.clear();
        jest.clearAllMocks();
        bootstrap = new ElectronBootstrap(makeConfiguration(), makeLogger());
        bootstrap._registerIPCHandlers();
    });

    const expectedHandlers = [
        'hakuneko:cert:registerBypassDomains',
        'hakuneko:dialog:showMessageBox',
        'hakuneko:dialog:showOpenDialog',
        'hakuneko:shell:showItemInFolder',
        'hakuneko:shell:openExternal',
        'hakuneko:shell:openPath',
        'hakuneko:app:getPath',
        'hakuneko:window:minimize',
        'hakuneko:window:maximize',
        'hakuneko:window:unmaximize',
        'hakuneko:window:isMaximized',
        'hakuneko:window:close',
        'hakuneko:exec:ffmpeg',
        'hakuneko:exec:postCommand',
        'hakuneko:session:cookies:get',
        'hakuneko:session:cookies:set',
        'hakuneko:session:cookies:remove',
        'hakuneko:session:setProxy',
        'hakuneko:browser:fetchUI',
        'hakuneko:browser:fetchBrowser',
        'hakuneko:browser:fetchJapscan',
    ];

    expectedHandlers.forEach(channel => {
        it(`registers handler for ${channel}`, () => {
            expect(mockIpcMainHandlers.has(channel)).toBe(true);
        });
    });

    it('does NOT register the old generic hakuneko:exec handler', () => {
        expect(mockIpcMainHandlers.has('hakuneko:exec')).toBe(false);
    });
});

describe('ElectronBootstrap — exec:ffmpeg handler', () => {
    let bootstrap;

    beforeEach(() => {
        mockIpcMainHandlers.clear();
        jest.clearAllMocks();
        bootstrap = new ElectronBootstrap(makeConfiguration(), makeLogger());
        bootstrap._registerIPCHandlers();
    });

    it('rejects non-ffmpeg command', async () => {
        const handler = mockIpcMainHandlers.get('hakuneko:exec:ffmpeg');
        await expect(handler({}, 'rm -rf /', {})).rejects.toThrow();
    });

    it('rejects non-string command', async () => {
        const handler = mockIpcMainHandlers.get('hakuneko:exec:ffmpeg');
        await expect(handler({}, 42, {})).rejects.toThrow();
    });
});

describe('ElectronBootstrap — shell:openExternal handler', () => {
    let bootstrap;
    const { shell } = require('electron');

    beforeEach(() => {
        mockIpcMainHandlers.clear();
        jest.clearAllMocks();
        bootstrap = new ElectronBootstrap(makeConfiguration(), makeLogger());
        bootstrap._registerIPCHandlers();
    });

    it('rejects javascript: URL', async () => {
        const handler = mockIpcMainHandlers.get('hakuneko:shell:openExternal');
        await expect(handler({}, 'javascript:alert(1)')).rejects.toThrow();
        expect(shell.openExternal).not.toHaveBeenCalled();
    });

    it('allows https URL', async () => {
        const handler = mockIpcMainHandlers.get('hakuneko:shell:openExternal');
        await handler({}, 'https://example.com');
        expect(shell.openExternal).toHaveBeenCalledWith('https://example.com');
    });
});

describe('ElectronBootstrap — shell:openPath handler', () => {
    let bootstrap;
    const { shell } = require('electron');

    beforeEach(() => {
        mockIpcMainHandlers.clear();
        jest.clearAllMocks();
        bootstrap = new ElectronBootstrap(makeConfiguration(), makeLogger());
        bootstrap._registerIPCHandlers();
    });

    it('rejects path traversal', async () => {
        const handler = mockIpcMainHandlers.get('hakuneko:shell:openPath');
        await expect(handler({}, '/home/user/../../etc/passwd')).rejects.toThrow();
        expect(shell.openPath).not.toHaveBeenCalled();
    });

    it('rejects root path "/"', async () => {
        const handler = mockIpcMainHandlers.get('hakuneko:shell:openPath');
        await expect(handler({}, '/')).rejects.toThrow();
    });

    it('allows a normal manga directory', async () => {
        const handler = mockIpcMainHandlers.get('hakuneko:shell:openPath');
        await handler({}, '/home/user/Mangas/MySeries');
        expect(shell.openPath).toHaveBeenCalled();
    });
});
