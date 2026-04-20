/**
 * HAKU-0033: Unit tests for IPC input-validation helpers and preload allowlist.
 * Tests the static methods on ElectronBootstrap and the ipc.send allowlist logic.
 */

jest.mock('fs-extra');
jest.mock('electron', () => ({
    app: {
        getAppPath: jest.fn(() => '/usr/bin'),
        getPath: jest.fn(() => '/tmp'),
        name: 'HakuNeko',
        on: jest.fn(),
        quit: jest.fn(),
    },
    ipcMain: { handle: jest.fn(), on: jest.fn() },
    ipcRenderer: { invoke: jest.fn(), send: jest.fn(), on: jest.fn() },
    BrowserWindow: jest.fn(),
    shell: { openExternal: jest.fn(), openPath: jest.fn(), showItemInFolder: jest.fn() },
    dialog: {},
    session: { defaultSession: { cookies: {}, setProxy: jest.fn() } },
    Tray: jest.fn(),
    Menu: { buildFromTemplate: jest.fn(), setApplicationMenu: jest.fn() },
    nativeImage: { createFromPath: jest.fn(() => ({})) },
    protocol: { registerSchemesAsPrivileged: jest.fn(), handle: jest.fn() },
}));

const ElectronBootstrap = require('../ElectronBootstrap');

// ---------------------------------------------------------------------------
// hakuneko:exec:ffmpeg  — validateFfmpegCommand
// ---------------------------------------------------------------------------

describe('ElectronBootstrap.validateFfmpegCommand', () => {
    const validate = ElectronBootstrap.validateFfmpegCommand;

    it('allows "ffmpeg -loglevel error ..."', () => {
        expect(validate('ffmpeg -loglevel error -i input.m3u8 out.mkv')).toBeNull();
    });

    it('allows bare "ffmpeg"', () => {
        expect(validate('ffmpeg')).toBeNull();
    });

    it('allows leading whitespace before ffmpeg', () => {
        expect(validate('  ffmpeg -i input.m3u8')).toBeNull();
    });

    it('rejects "rm -rf /"', () => {
        expect(validate('rm -rf /')).not.toBeNull();
    });

    it('rejects "ffmpegfake ..." (no space after token)', () => {
        expect(validate('ffmpegfake -i input.m3u8')).not.toBeNull();
    });

    it('rejects empty string', () => {
        expect(validate('')).not.toBeNull();
    });

    it('rejects non-string (number)', () => {
        expect(validate(123)).not.toBeNull();
    });

    it('rejects non-string (null)', () => {
        expect(validate(null)).not.toBeNull();
    });
});

// ---------------------------------------------------------------------------
// hakuneko:shell:openExternal  — validateExternalUrl
// ---------------------------------------------------------------------------

describe('ElectronBootstrap.validateExternalUrl', () => {
    const validate = ElectronBootstrap.validateExternalUrl;

    it('allows https URL', () => {
        expect(validate('https://example.com')).toBeNull();
    });

    it('allows http URL', () => {
        expect(validate('http://example.com')).toBeNull();
    });

    it('rejects file:// URL', () => {
        expect(validate('file:///etc/passwd')).not.toBeNull();
    });

    it('rejects javascript: URL', () => {
        expect(validate('javascript:alert(1)')).not.toBeNull();
    });

    it('rejects ftp:// URL', () => {
        expect(validate('ftp://server')).not.toBeNull();
    });

    it('rejects data: URL', () => {
        expect(validate('data:text/html,<script>alert(1)</script>')).not.toBeNull();
    });

    it('rejects blob: URL', () => {
        expect(validate('blob:https://example.com/uuid')).not.toBeNull();
    });

    it('rejects ws:// URL', () => {
        expect(validate('ws://attacker.com')).not.toBeNull();
    });

    it('rejects empty string (invalid URL)', () => {
        expect(validate('')).not.toBeNull();
    });

    it('rejects non-string (number)', () => {
        expect(validate(123)).not.toBeNull();
    });

    it('rejects non-string (null)', () => {
        expect(validate(null)).not.toBeNull();
    });
});

// ---------------------------------------------------------------------------
// hakuneko:shell:openPath / showItemInFolder  — validateFilePath
// ---------------------------------------------------------------------------

describe('ElectronBootstrap.validateFilePath', () => {
    const validate = ElectronBootstrap.validateFilePath;

    it('allows a normal user path', () => {
        expect(validate('/home/user/Mangas/title')).toBeNull();
    });

    it('rejects path traversal "../../etc/passwd"', () => {
        // path.resolve('../../etc/passwd') on Linux yields an absolute path without '..'
        // but the raw input is still dangerous — the plan checks the resolved path
        // On a real system this resolves to /etc/passwd; here we just test the string check
        expect(validate('/home/user/../../etc/passwd')).not.toBeNull();
    });

    it('rejects root "/"', () => {
        expect(validate('/')).not.toBeNull();
    });

    it('rejects "/etc"', () => {
        expect(validate('/etc')).not.toBeNull();
    });

    it('rejects non-string (null)', () => {
        expect(validate(null)).not.toBeNull();
    });

    it('rejects non-string (number)', () => {
        expect(validate(42)).not.toBeNull();
    });
});

// ---------------------------------------------------------------------------
// preload.js  — ipc.send channel allowlist  (inline logic test)
// ---------------------------------------------------------------------------

describe('preload ipc.send allowlist', () => {
    /**
     * Mirrors the allowlist logic from preload.js so it can be tested
     * without loading the preload (which requires a real Electron context).
     */
    function isAllowedSendChannel(channel) {
        const allowedSendChannels = ['hakuneko:ipc:quit'];
        const isDynamicResponseChannel = /^\d{13,}\.?\d*$/.test(channel);
        return allowedSendChannels.includes(channel) || isDynamicResponseChannel;
    }

    it('allows "hakuneko:ipc:quit"', () => {
        expect(isAllowedSendChannel('hakuneko:ipc:quit')).toBe(true);
    });

    it('allows a dynamic response channel (13-digit timestamp)', () => {
        expect(isAllowedSendChannel('1718234567890')).toBe(true);
    });

    it('allows a dynamic response channel with decimal part', () => {
        expect(isAllowedSendChannel('1718234567890.123456789')).toBe(true);
    });

    it('rejects arbitrary channel name', () => {
        expect(isAllowedSendChannel('arbitrary-channel')).toBe(false);
    });

    it('rejects receive-only channel', () => {
        expect(isAllowedSendChannel('hakuneko:ipc:close')).toBe(false);
    });

    it('rejects empty string', () => {
        expect(isAllowedSendChannel('')).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// hakuneko:exec:postCommand  — inline length/type guard
// ---------------------------------------------------------------------------

describe('exec:postCommand guards', () => {
    /**
     * Mirrors the guards in the hakuneko:exec:postCommand handler.
     */
    function validatePostCommand(command) {
        if (typeof command !== 'string' || command.length === 0) return 'Invalid command';
        if (command.length > 2048) return 'Command exceeds maximum length';
        return null;
    }

    it('allows a normal command string', () => {
        expect(validatePostCommand('echo hello')).toBeNull();
    });

    it('rejects empty string', () => {
        expect(validatePostCommand('')).not.toBeNull();
    });

    it('rejects a string longer than 2048 chars', () => {
        expect(validatePostCommand('a'.repeat(2049))).not.toBeNull();
    });

    it('rejects non-string (null)', () => {
        expect(validatePostCommand(null)).not.toBeNull();
    });

    it('rejects non-string (number)', () => {
        expect(validatePostCommand(42)).not.toBeNull();
    });
});
