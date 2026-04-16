// Provide a proper electron mock with controllable ipcMain
const mockIpcMain = {
    once: jest.fn(),
    removeAllListeners: jest.fn(),
    on: jest.fn(),
    handle: jest.fn(),
};

jest.mock('electron', () => ({
    ipcMain: mockIpcMain,
    app: { setPath: jest.fn(), on: jest.fn(), getPath: jest.fn() },
    protocol: { registerSchemesAsPrivileged: jest.fn(), registerBufferProtocol: jest.fn(), registerFileProtocol: jest.fn() },
    BrowserWindow: jest.fn(),
    nativeImage: { createFromPath: jest.fn(() => ({})) },
    Menu: { setApplicationMenu: jest.fn(), buildFromTemplate: jest.fn() },
    Tray: jest.fn(),
    session: { defaultSession: { webRequest: { onBeforeSendHeaders: jest.fn(), onHeadersReceived: jest.fn() }, cookies: {}, setProxy: jest.fn() } },
    clipboard: { readText: jest.fn(), writeText: jest.fn() },
    dialog: {},
    shell: {},
}));

const ElectronBootstrap = require('../../app/ElectronBootstrap');

const mockConfig = {
    applicationProtocol: 'hakuneko',
    connectorProtocol: 'connector',
    applicationCacheDirectory: '/tmp/cache',
    applicationUserDataDirectory: '/tmp/userdata',
    applicationUserPluginsDirectory: '/tmp/plugins',
};

describe('IPC Bridge (HAKU-0012)', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('_ipcInvokeRenderer', () => {
        let bootstrap;

        beforeEach(() => {
            bootstrap = new ElectronBootstrap(mockConfig);
        });

        it('rejects after timeout when renderer does not respond', async () => {
            bootstrap._window = {
                webContents: {
                    isLoading: () => false,
                    send: jest.fn(),
                },
            };
            // ipcMain.once registers but the handler is never called — timeout fires
            mockIpcMain.once.mockImplementation(() => {});
            mockIpcMain.removeAllListeners.mockImplementation(() => {});

            await expect(
                bootstrap._ipcInvokeRenderer('connector-protocol', {}, 50)
            ).rejects.toThrow('IPC timeout: connector-protocol after 50ms');
        }, 1000);

        it('resolves when renderer sends response on ephemeral channel', async () => {
            const fakeData = { mimeType: 'image/png', data: Buffer.from('img') };
            const capturedHandlers = {};

            mockIpcMain.once.mockImplementation((channel, fn) => {
                capturedHandlers[channel] = fn;
            });
            mockIpcMain.removeAllListeners.mockImplementation(() => {});

            bootstrap._window = {
                webContents: {
                    isLoading: () => false,
                    send: jest.fn((sentChannel, responseChannel) => {
                        // Simulate renderer responding on the ephemeral channel
                        setImmediate(() => {
                            if (capturedHandlers[responseChannel]) {
                                capturedHandlers[responseChannel]({}, fakeData);
                            }
                        });
                    }),
                },
            };

            const result = await bootstrap._ipcInvokeRenderer('connector-protocol', {}, 5000);
            expect(result).toBe(fakeData);
        });

        it('throws when _window is null', async () => {
            bootstrap._window = null;

            await expect(
                bootstrap._ipcInvokeRenderer('connector-protocol', {})
            ).rejects.toThrow('web content not ready');
        });

        it('throws when webContents is loading', async () => {
            bootstrap._window = {
                webContents: {
                    isLoading: () => true,
                    send: jest.fn(),
                },
            };

            await expect(
                bootstrap._ipcInvokeRenderer('connector-protocol', {})
            ).rejects.toThrow('web content not ready');
        });
    });

    describe('preload allowedChannels', () => {
        it('only permits hakuneko:ipc:connector-protocol and hakuneko:ipc:close', () => {
            const fs = require('fs');
            const path = require('path');
            const preloadSrc = fs.readFileSync(
                path.join(__dirname, '../../app/preload.js'), 'utf8'
            );
            const match = preloadSrc.match(/const allowedChannels\s*=\s*(\[[^\]]+\])/);
            expect(match).not.toBeNull();
            const channels = JSON.parse(match[1].replace(/'/g, '"'));
            expect(channels).toEqual(['hakuneko:ipc:connector-protocol', 'hakuneko:ipc:close']);
        });
    });

    describe('inline ipcBridge (Engine)', () => {
        it('listen routes handler and sends response on ephemeral channel', async () => {
            const sentMessages = [];
            const mockAPI = {
                ipc: {
                    on: jest.fn((channel, cb) => {
                        setImmediate(() => cb({}, 'resp-channel-123', { url: 'connector://test' }));
                    }),
                    send: jest.fn((channel, data) => {
                        sentMessages.push({ channel, data });
                    }),
                },
            };

            const ipcBridge = {
                listen(channel, handler) {
                    mockAPI.ipc.on(channel, async (event, responseChannelID, payload) => {
                        try {
                            const data = await handler(payload);
                            mockAPI.ipc.send(responseChannelID, data);
                        } catch (error) {
                            mockAPI.ipc.send(responseChannelID, undefined);
                        }
                    });
                }
            };

            const mockHandler = jest.fn().mockResolvedValue({ mimeType: 'image/jpeg', data: 'bytes' });
            ipcBridge.listen('hakuneko:ipc:connector-protocol', mockHandler);

            await new Promise(resolve => setImmediate(resolve));

            expect(mockHandler).toHaveBeenCalledWith({ url: 'connector://test' });
            expect(sentMessages).toEqual([{
                channel: 'resp-channel-123',
                data: { mimeType: 'image/jpeg', data: 'bytes' },
            }]);
        });

        it('sends undefined on response channel when handler throws', async () => {
            const sentMessages = [];
            const mockAPI = {
                ipc: {
                    on: jest.fn((channel, cb) => {
                        setImmediate(() => cb({}, 'resp-err-456', {}));
                    }),
                    send: jest.fn((channel, data) => {
                        sentMessages.push({ channel, data });
                    }),
                },
            };

            const ipcBridge = {
                listen(channel, handler) {
                    mockAPI.ipc.on(channel, async (event, responseChannelID, payload) => {
                        try {
                            const data = await handler(payload);
                            mockAPI.ipc.send(responseChannelID, data);
                        } catch (error) {
                            mockAPI.ipc.send(responseChannelID, undefined);
                        }
                    });
                }
            };

            const failingHandler = jest.fn().mockRejectedValue(new Error('connector exploded'));
            ipcBridge.listen('hakuneko:ipc:connector-protocol', failingHandler);

            await new Promise(resolve => setImmediate(resolve));

            expect(sentMessages).toEqual([{ channel: 'resp-err-456', data: undefined }]);
        });
    });
});
