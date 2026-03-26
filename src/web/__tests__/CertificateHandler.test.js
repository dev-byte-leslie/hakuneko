jest.mock('electron');

const ElectronBootstrap = require('../../app/ElectronBootstrap');

describe('CertificateHandler (HAKU-0006)', () => {
    let bootstrap;
    let mockLogger;
    let mockEvent;

    beforeEach(() => {
        mockLogger = {
            warn: jest.fn(),
            error: jest.fn(),
            info: jest.fn(),
        };
        const mockConfig = {
            applicationProtocol: 'hakuneko',
            connectorProtocol: 'connector',
            applicationCacheDirectory: '/tmp/cache',
            applicationUserDataDirectory: '/tmp/userdata',
            applicationUserPluginsDirectory: '/tmp/plugins',
        };
        bootstrap = new ElectronBootstrap(mockConfig, mockLogger);
        mockEvent = { preventDefault: jest.fn() };
    });

    describe('_certBypassDomains', () => {
        it('should initialize as empty Set', () => {
            expect(bootstrap._certBypassDomains).toBeInstanceOf(Set);
            expect(bootstrap._certBypassDomains.size).toBe(0);
        });
    });

    describe('_certificateErrorHandler', () => {
        it('should reject cert errors for unknown domains', () => {
            const callback = jest.fn();

            bootstrap._certificateErrorHandler(
                mockEvent, null, 'https://evil.example.com/page', 'ERR_CERT_AUTHORITY_INVALID', {}, callback
            );

            expect(mockEvent.preventDefault).toHaveBeenCalled();
            expect(callback).toHaveBeenCalledWith(false);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('[CertReject]')
            );
        });

        it('should accept cert errors for declared bypass domains', () => {
            const callback = jest.fn();
            bootstrap._certBypassDomains.add('manga-site.example.com');

            bootstrap._certificateErrorHandler(
                mockEvent, null, 'https://manga-site.example.com/chapter/1', 'ERR_CERT_DATE_INVALID', {}, callback
            );

            expect(callback).toHaveBeenCalledWith(true);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('[CertBypass]')
            );
        });

        it('should reject cert errors for non-bypassed domains even when others are bypassed', () => {
            const callback = jest.fn();
            bootstrap._certBypassDomains.add('allowed.example.com');

            bootstrap._certificateErrorHandler(
                mockEvent, null, 'https://not-allowed.example.com/', 'ERR_CERT_COMMON_NAME_INVALID', {}, callback
            );

            expect(callback).toHaveBeenCalledWith(false);
        });

        it('should reject when URL is malformed', () => {
            const callback = jest.fn();

            bootstrap._certificateErrorHandler(
                mockEvent, null, 'not-a-valid-url', 'ERR_CERT_AUTHORITY_INVALID', {}, callback
            );

            expect(callback).toHaveBeenCalledWith(false);
        });

        it('should log the domain and error type on bypass', () => {
            const callback = jest.fn();
            bootstrap._certBypassDomains.add('test.example.com');

            bootstrap._certificateErrorHandler(
                mockEvent, null, 'https://test.example.com/path', 'ERR_CERT_DATE_INVALID', {}, callback
            );

            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('test.example.com')
            );
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('ERR_CERT_DATE_INVALID')
            );
        });

        it('should log the URL and error type on rejection', () => {
            const callback = jest.fn();

            bootstrap._certificateErrorHandler(
                mockEvent, null, 'https://unknown.example.com/page', 'ERR_CERT_AUTHORITY_INVALID', {}, callback
            );

            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('unknown.example.com')
            );
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('ERR_CERT_AUTHORITY_INVALID')
            );
        });
    });

    describe('registerBypassDomains IPC simulation', () => {
        it('should add domains to the bypass set', () => {
            const domains = ['site-a.com', 'site-b.com'];
            for (const domain of domains) {
                if (typeof domain === 'string') {
                    bootstrap._certBypassDomains.add(domain);
                }
            }

            expect(bootstrap._certBypassDomains.has('site-a.com')).toBe(true);
            expect(bootstrap._certBypassDomains.has('site-b.com')).toBe(true);
        });

        it('should deduplicate domains', () => {
            bootstrap._certBypassDomains.add('dup.com');
            bootstrap._certBypassDomains.add('dup.com');

            expect(bootstrap._certBypassDomains.size).toBe(1);
        });

        it('should ignore non-string values', () => {
            const domains = ['valid.com', 123, null, undefined, 'also-valid.com'];
            for (const domain of domains) {
                if (typeof domain === 'string') {
                    bootstrap._certBypassDomains.add(domain);
                }
            }

            expect(bootstrap._certBypassDomains.size).toBe(2);
        });
    });
});
