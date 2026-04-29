import type Settings from './Settings';

/** Shape of the Discord rich presence activity object */
type DiscordStatus = {
    largeImageKey: string;
    largeImageText: string;
    details?: string;
    state?: string;
    startTimestamp?: number;
};

export default class DiscordPresence {

    updater: ReturnType<typeof setInterval> | null;
    connected: boolean;
    _settings: Settings;
    enabled: boolean;
    enabledHentai: boolean;
    hentai: boolean;
    status: DiscordStatus;
    statusNew: boolean;

    constructor(settings: Settings) {
        this.updater = null;
        this.connected = false;

        this._settings = settings; // Engine.Settings
        this.enabled = false;
        this.enabledHentai = false;
        this.hentai = false; // Is current item hentai?

        this._settings.addEventListener('loaded', this._onSettingsChanged.bind(this));
        this._settings.addEventListener('saved', this._onSettingsChanged.bind(this));

        // Current status
        this.status = {
            largeImageKey: 'logo',
            largeImageText: 'Manga & Anime Downloader for Linux, Windows & MacOS'
        };
        this.statusNew = true;

        // EventListener
        document.addEventListener( EventListener.onSelectConnector, this._onSelectConnector.bind(this) );
        document.addEventListener( EventListener.onSelectManga, this._onSelectManga.bind(this) );
        document.addEventListener( EventListener.onSelectChapter, this._onSelectChapter.bind(this) );
    }

    _onSettingsChanged(): void {
        this.enabled = this._settings.discordPresence.value as string !== 'none';
        this.enabledHentai = this._settings.discordPresence.value as string === 'hentai';

        if (this.enabled) {
            this.statusNew = true;
            this.startDiscordPresence();
        } else {
            this.stopDiscordPresence();
        }
    }

    _onSelectConnector(event: CustomEvent): void {
        this.isThisHentai(event.detail.tags);
        this.status['details'] = 'Browsing ' + event.detail.label;
        if (this.status.state) delete this.status.state;
        this.status.startTimestamp = + new Date();
        this.statusNew = true;
        if (this.enabled && !this.connected) this.startDiscordPresence();
    }

    _onSelectManga(event: CustomEvent): void {
        this.isThisHentai(event.detail.connector.tags);
        this.status['details'] = 'Browsing ' + event.detail.connector.label;
        this.status['state'] = 'Looking at ' + event.detail.title;
        this.status.startTimestamp = + new Date();
        this.statusNew = true;
        if (this.enabled && !this.connected) this.startDiscordPresence();
    }

    _onSelectChapter(event: CustomEvent): void {
        this.isThisHentai(event.detail.manga.connector.tags);
        this.status['details'] = 'Viewing ' + event.detail.manga.title;
        this.status['state'] = event.detail.title.padEnd(2); // State min. length is 2 char
        this.status.startTimestamp = + new Date();
        this.statusNew = true;
        if (this.enabled && !this.connected) this.startDiscordPresence();
    }

    isThisHentai(tags: string[]): void {
        tags = tags.map(t => t.toLowerCase());
        this.hentai = tags.includes('hentai') || tags.includes('porn');
    }

    async updateStatus(): Promise<void> {
        if (this.connected) {
            if (this.enabled && this.statusNew) {
                if (!this.hentai || this.hentai && this.enabledHentai) {
                    const result = await window.hakunekoAPI.discord.setActivity(this.status).catch(() => ({ connected: false }));
                    if (!result || !result.connected) {
                        console.warn('WARNING: DiscordPresence - Lost connection to Discord.');
                        this.stopDiscordPresence();
                        return;
                    }
                    this.statusNew = false;
                } else {
                    this.statusNew = false;
                }
            }
        }
    }

    stopDiscordPresence(): void {
        this.statusNew = false;
        this.connected = false;
        clearInterval(this.updater ?? undefined);
        this.updater = null;
        window.hakunekoAPI.discord.stop().catch(() => {});
    }

    async startDiscordPresence(): Promise<void> {
        if (this.connected) {
            return; // already running ...
        }
        try {
            await window.hakunekoAPI.discord.start();
            this.connected = true;
            this.status.startTimestamp = + new Date();

            // some delay for Discord to be receptive
            setTimeout(() => {
                this.updateStatus();
            }, 2000);

            // activity can only be set every 15 seconds (API limit)
            this.updater = setInterval(() => {
                this.updateStatus();
            }, 15200);
        } catch (error) {
            if (typeof error !== 'undefined') {
                if (/Could not connect/i.test((error as Error).message)) {
                    console.warn('WARNING: DiscordPresence - Could not connect (Is Discord running?)');
                    return;
                }

                if (/RPC_CONNECTION_TIMEOUT/i.test((error as Error).message)) {
                    console.warn('WARNING: DiscordPresence - RPC connection timed out.');
                    this.connected = false;

                    // Waiting delay for Discord API to allow new connection
                    setTimeout(() => {
                        // Re-evaluate if enabled
                        this._onSettingsChanged();
                    }, 120000);

                    return;
                }

                throw error; // Unknown error

            } else {
                console.warn('WARNING: DiscordPresence - Connection was closed unexpectedly.');
                this.connected = false;

                // Waiting delay for Discord API to allow new connection
                setTimeout(() => {
                    // Re-evaluate if still enabled
                    this._onSettingsChanged();
                }, 15200);
            }
        }
    }
}
