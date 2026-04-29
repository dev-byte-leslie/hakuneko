import type { SettingDef } from './types';

const events = {
    loaded: 'loaded',
    saved: 'saved'
} as const;

const extensions = {
    // chapter formats
    img: 'img',
    cbz: '.cbz',
    pdf: '.pdf',
    epub: '.epub',
    // history formats
    none: '',
    json: '.json',
    csv: '.csv'
} as const;

const mimes = {
    webp: 'image/webp',
    jpeg: 'image/jpeg',
    png: 'image/png'
} as const;

const types = {
    disabled: 'disabled',
    text: 'text',
    password: 'password',
    numeric: 'numeric',
    select: 'select',
    checkbox: 'checkbox',
    file: 'file',
    directory: 'directory'
} as const;

export default class Settings extends EventTarget {

    frontend: SettingDef;
    readerEnabled: SettingDef<boolean>;
    baseDirectory: SettingDef;
    bookmarkDirectory: SettingDef;
    useSubdirectory: SettingDef<boolean>;
    ignoreErrorOnDownload: SettingDef<boolean>;
    chapterTitleFormat: SettingDef;
    chapterFormat: SettingDef;
    recompressionFormat: SettingDef;
    recompressionQuality: SettingDef<number>;
    useSequentialMediaDownloads: SettingDef<boolean>;
    proxyRules: SettingDef;
    proxyAuth: SettingDef;
    hCaptchaAccessibilityUUID: SettingDef;
    downloadHistoryLogFormat: SettingDef;
    postChapterDownloadCommand: SettingDef;
    discordPresence: SettingDef;
    NovelColorProfiles: SettingDef;

    // TODO: use dependency injection instead of globals for Engine.Storage, Engine.Conenctors
    constructor() {
        super();
        this.frontend = {
            label: 'Frontend ⁽¹⁾',
            description: [
                'Select the UI frontend that should be used for the manga download engine.',
                '',
                '⁽¹⁾ Restart required to take affect',
            ].join('\n'),
            input: types.select,
            options: [
                { value: 'frontend@classic-light', name: 'Classic (Light)' },
                { value: 'frontend@classic-dark', name: 'Ken\'s Daedal Dark' }
            ],
            value: 'frontend@classic-light'
        };

        this.readerEnabled = {
            label: 'Enable Reader',
            description: 'Show a preview panel and a basic reader for the chapters',
            input: types.checkbox,
            value: true
        };

        this.baseDirectory = {
            label: 'Manga Directory',
            description: 'The base directory where all downloaded mangas will be stored',
            input: types.directory,
            value: 'Mangas'
        };

        this.bookmarkDirectory = {
            label: 'Bookmarks Directory',
            description: [
                'The directory where the bookmark and chaptermark files will be stored.',
                'This setting has no effect when the application is in portable mode!'
            ].join('\n'),
            input: window.hakunekoAPI.isPortable ? types.disabled : types.directory,
            value: '.'
        };

        this.useSubdirectory = {
            label: 'Use Sub-Directories',
            description: 'Create sub-directories for each website (e.g. "/downloads/mangadex/...")',
            input: types.checkbox,
            value: false
        };

        this.ignoreErrorOnDownload = {
            label: 'Ignore errors on download',
            description: 'The download will be treated as successful, even if all or some files failed to download and the chapter is in a broken state',
            input: types.checkbox,
            value: false
        };

        this.chapterTitleFormat = {
            label: 'Chapter Title Format',
            description: [
                'Define the chapter name format.',
                'This is an experimental feature, volume/chapter numbers are extracted directly from the original name.',
                'May fail in some cases and also reduce performance!',
                '',
                'Supported placeholders:',
                '  %C% - Connector title',
                '  %M% - Manga title',
                '  %VOL% - Volume number',
                '  %CH% - Chapter number',
                '  %T% - Chapter title (without volume/chapter number)',
                '  %O% - Chapter title (original)'
            ].join('\n'),
            input: types.text,
            value: ''
        };

        this.chapterFormat = {
            label: 'Chapter File Format',
            description: 'Store chapters in the selected file format',
            input: types.select,
            options: [
                { value: extensions.img, name: 'Folder with Images (*.jpg, *.png, *.webp)' },
                { value: extensions.cbz, name: 'Comic Book Archive (*.cbz)' },
                { value: extensions.pdf, name: 'Portable Document (*.pdf)' },
                { value: extensions.epub, name: 'Ebook Reader (*.epub)' },
            ],
            value: extensions.img
        };

        this.recompressionFormat = {
            label: 'De-Scrambling Format',
            description: [
                'Select the re-compression format that shall be used for scrambled images.',
                'Only applies to scrambled images!',
                'Unscrambled images are stored natively (no re-compression will be applied).'
            ].join('\n'),
            input: types.select,
            options: [
                { value: mimes.webp, name: 'WEBP (*.webp)' },
                { value: mimes.jpeg, name: 'JPEG (*.jpg)' },
                { value: mimes.png, name: 'PNG (*.png)' },
            ],
            value: mimes.jpeg
        };

        this.recompressionQuality = {
            label: 'De-Scrambling Quality',
            description: [
                'Select the re-compression quality that shall be used for scrambled images.',
                'Only applies to WEBP and JPEG, has no effect on PNG (which is lossless).'
            ].join('\n'),
            input: types.numeric,
            min: 50,
            max: 100,
            value: 90
        };

        this.useSequentialMediaDownloads = {
            label: 'Disable Concurrent Downloads',
            description: 'Media will be downloaded one after another instead of concurrently. Enable this in case of holding a slow internet connection, or regularly encountering failed downloads due to network errors.',
            input: types.checkbox,
            value: false
        };

        this.proxyRules = {
            label: 'Proxy Rules',
            description: [
                'Set the proxy servers that shall be used.',
                'Leave blank to ignore.',
                '',
                'Examples:',
                '  http=proxy.web:80',
                '  http=127.0.0.1:8080;https=127.0.0.1:8080;socks=127.0.0.1:8081',
                '',
                'More info: https://git.io/hakuneko-proxy'
            ].join('\n'),
            input: types.text,
            value: ''
        };

        this.proxyAuth = {
            label: 'Proxy Authentication',
            description: [
                'Set the username and password for the proxy server(s).',
                'Use ":" as separator between both terms.',
                'Only basic auth is supported!',
                '',
                'Examples:',
                '  username:password'
            ].join('\n'),
            input: types.password,
            value: ''
        };

        this.hCaptchaAccessibilityUUID = {
            label: 'hCaptcha UUID',
            description: [
                'Provide your accessibility UUID for hCaptcha (CloudFlare protection).',
                'Therefore CloudFlare may only show a click box instead of an image challenge.',
                'Signup for accessibility by registering an email on https://cutt.ly/hcaptcha-signup',
                'Copy the UUID part from the verification link in the received confirmation mail.',
                '',
                'Example:',
                '  68e89cc3-4c2d-4539-b80b-49ba4bec76c4',
                '',
                'More info: https://www.hcaptcha.com/accessibility'
            ].join('\n'),
            input: types.text,
            value: ''
        };

        this.downloadHistoryLogFormat = {
            label: 'Download History Format',
            description: [
                'Log the history of completed chapter downloads.',
                'The log file(s) can be found in HakuNeko\'s user data directory.'
            ].join('\n'),
            input: types.select,
            options: [
                { value: extensions.none, name: 'Disabled' },
                /*
                 *{ value: extensions.json, name: 'JSON (*.json)' },
                 *{ value: extensions.csv, name: 'CSV (*.csv)' },
                 */
            ],
            value: extensions.none
        };

        this.postChapterDownloadCommand = {
            label: 'Post Command',
            description: [
                'This command will be executed after a chapter download is complete.',
                'The working directory is the folder containing the downloaded chapter.',
                'Leave blank to ignore.',
                '',
                'Supported placeholders:',
                '  %PATH% - Path to downloaded chapter folder/file',
                '  %C% - Connector title',
                '  %M% - Manga title',
                '  %O% - Chapter title',
                '',
                'Examples:',
                '  convert "%PATH%\\*.webp" -scene 1 "%PATH%\\%03d.png"',
                '  md "%O%_conv" & convert "%PATH%\\*.*" -scene 1 "%O%_conv\\%03d.png"'
            ].join('\n'),
            input: types.text,
            value: ''
        };

        this.discordPresence = {
            label: 'Discord Presence',
            description: [
                'Provides what you are currently reading as discord activity',
                'information to the public.',
                ''
            ].join('\n'),
            input: types.select,
            options: [
                { value: 'none', name: 'No presence' },
                { value: 'nohentai', name: 'All, but NO hentai' },
                { value: 'hentai', name: 'All INCLUDING hentai' }
            ],
            value: 'none'
        };

        this.NovelColorProfiles = {
            label: 'Light/Dark mode for Novels',
            description: [
                'Choose between light and dark mode for novels.',
                'This changes the image itself not just the reader view.',
                'This may not work for all connectors that support novels.'
            ].join('\n'),
            input: types.select,
            options: [
                {val: { background: 'black', text: 'white' }, value: 'Dark', name: 'Dark' },
                {val: { background: 'white', text: 'black' }, value: 'Light', name: 'Light' }
            ],
            value: 'Light',
        };
    }

    /** Resolve async paths that cannot be fetched in the constructor. */
    async initialize(): Promise<void> {
        try {
            let docs = await window.hakunekoAPI.app.getPath('documents');
            if (docs) {
                this.baseDirectory.value = await window.hakunekoAPI.path.join(docs, 'Mangas');
            }
        } catch (_) {
            // documents directory not found — keep default
        }
        let userData = await window.hakunekoAPI.app.getPath('userData');
        if (userData) {
            this.bookmarkDirectory.value = userData;
        }
    }

    NovelColorProfile(): Record<string, string> {
        return this.NovelColorProfiles.options!.find(ele => ele.value.toLowerCase() == this.NovelColorProfiles.value.toLowerCase())!.val!;
    }

    *[Symbol.iterator](): Generator<SettingDef> {
        for (let key in this) {
            let property = (this as unknown as Record<string, unknown>)[key];
            if (property instanceof Object && (property as SettingDef).input) {
                yield property as SettingDef;
            }
        }
    }

    *_getCategorizedSettings(): Generator<{ category: string; settings: SettingDef[] }> {
        yield {
            category: 'General',
            settings: [...(this as Iterable<SettingDef>)]
        };
        for (let connector of Engine.Connectors) {
            if (connector.config instanceof Object) {
                yield {
                    category: connector.label,
                    settings: Object.keys(connector.config!).map(key => connector.config![key])
                };
            }
        }
    }

    getCategorizedSettings(): Array<{ category: string; settings: SettingDef[] }> {
        return [...this._getCategorizedSettings()];
    }

    async load(): Promise<void> {
        try {
            let data = await Engine.Storage.loadConfig('settings') as Record<string, unknown>;
            // apply general settings
            for (let key in this) {
                let setting = (this as unknown as Record<string, SettingDef>)[key];
                if (data
                    && data[key] !== undefined
                    && setting
                    && setting.input
                    && setting.input !== types.disabled) {
                    setting.value = this._getDecryptedValue(setting.input, data[key] as string);
                    setting.value = this._getValidValue('General', setting) as string;
                }
            }
            // apply settings to each connector
            for (let connector of Engine.Connectors) {
                const connectors = data && (data.connectors as Record<string, Record<string, unknown>>);
                for (let key in connector.config) {
                    if (data
                        && connectors
                        && connectors[connector.id as string]
                        && connectors[connector.id as string][key] !== undefined
                        && connector.config[key]
                        && connector.config[key].input) {
                        connector.config[key].value = this._getDecryptedValue(connector.config[key].input, connectors[connector.id as string][key] as string);
                        connector.config[key].value = this._getValidValue(connector.label, connector.config[key], true) as string;
                    }
                }
            }
            this.dispatchEvent(new CustomEvent(events.loaded, { detail: this }));
        } catch (error) {
            console.error('Failed to load HakuNeko settings!', error);
        }
    }

    async save(): Promise<void> {
        try {
            let data: Record<string, unknown> = {};
            // gather general settings
            for (let key in this) {
                let setting = (this as unknown as Record<string, SettingDef>)[key];
                if (setting && setting.input && setting.input !== types.disabled) {
                    data[key] = this._getEncryptedValue(setting.input, setting.value as string);
                }
            }
            // gather settings from each connector
            data['connectors'] = {};
            for (let connector of Engine.Connectors) {
                (data.connectors as Record<string, Record<string, unknown>>)[connector.id as string] = {};
                for (let key in connector.config) {
                    (data.connectors as Record<string, Record<string, unknown>>)[connector.id as string][key] = this._getEncryptedValue(connector.config[key].input, connector.config[key].value as string);
                }
            }
            await Engine.Storage.saveConfig('settings', data, 2);
            this.dispatchEvent(new CustomEvent(events.saved, { detail: this }));
        } catch (error) {
            console.error('Failed to save HakuNeko settings!', error);
        }
    }

    _getEncryptedValue(inputType: string, decryptedValue: string): string {
        if (inputType !== types.password || !decryptedValue || decryptedValue.length < 1) {
            return decryptedValue;
        }
        return CryptoJS.AES.encrypt(decryptedValue, 'HakuNeko!').toString();
    }

    _getDecryptedValue(inputType: string, encryptedValue: string): string {
        if (inputType !== types.password || !encryptedValue || encryptedValue.length < 1) {
            return encryptedValue;
        }
        return CryptoJS.AES.decrypt(encryptedValue, 'HakuNeko!').toString(CryptoJS.enc.Utf8);
    }

    _getValidValue(scope: string, setting: SettingDef, silent?: boolean): unknown {
        let value = setting.value;
        switch (setting.input) {
            case types.numeric:
                if (setting.min !== undefined && (value as unknown as number) < setting.min) {
                    return setting.min;
                }
                if (setting.max !== undefined && (value as unknown as number) > setting.max) {
                    return setting.max;
                }
                return value;
            case types.directory:
                Engine.Storage.directoryExist(value as string)
                    .catch(error => {
                        let message = `WARNING: Cannot access the directory for "${setting.label}" from "${scope}" settings!\n\n${error.message}`;
                        if (silent) {
                            console.warn(message, error);
                        } else {
                            alert(message);
                        }
                    });
                return value;
            default:
                return value;
        }
    }
}
