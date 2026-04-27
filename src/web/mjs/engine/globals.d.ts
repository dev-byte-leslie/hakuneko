import type { EventListenerName, HLSEpisode, VideoEpisode, SettingDef } from './types';

declare global {
    const Engine: EngineGlobal;
    const EventListener: Record<string, EventListenerName>;
    /** CryptoJS is loaded as a global script tag in the Electron renderer */
    const CryptoJS: any;
    /** protobufjs is loaded as a global script tag in the Electron renderer */
    const protobuf: any;
    /** Node.js Buffer is available in the Electron renderer process */
    const Buffer: { from(data: any, encoding?: string): Uint8Array };
    /** JSZip is loaded as a global script tag in the Electron renderer */
    const JSZip: any;
    /** PDFDocument (jsPDF) is loaded as a global script tag in the Electron renderer */
    const PDFDocument: any;

    interface Window {
        hakunekoAPI: HakunekoAPI;
        Engine: EngineGlobal;
        EventListener: Record<string, EventListenerName>;
        Request: typeof globalThis.Request;
        /** sql.js SQLite database — loaded as a global script tag in the Electron renderer */
        SQL: { Database: new (data: Uint8Array) => { exec(query: string): Array<{ columns: string[]; values: unknown[][] }> } };
    }

    interface HakunekoFS {
        readFile(path: string, encoding?: string): Promise<string | Uint8Array>;
        writeFile(path: string, data: string | Uint8Array): Promise<void>;
        appendFile(path: string, data: string | Uint8Array): Promise<void>;
        readdir(path: string): Promise<string[]>;
        stat(path: string): Promise<{ isDirectory: boolean }>;
        exists(path: string): Promise<boolean>;
        mkdir(path: string): Promise<void>;
        unlinkSync(path: string): Promise<void>;
    }

    interface HakunekoPath {
        join(...parts: string[]): Promise<string>;
        dirname(path: string): Promise<string>;
        basename(path: string, ext?: string): Promise<string>;
        extname(path: string): Promise<string>;
        parse(path: string): Promise<{ root: string; dir: string; base: string; ext: string; name: string }>;
        sep: string;
    }
}

/** Minimal connector shape used in EngineGlobal — avoids circular imports */
interface EngineConnectorItem {
    id: string | symbol;
    label: string;
    config?: Record<string, SettingDef> | null;
}

/** Shape of the HakuNeko engine instance exposed on window.Engine */
interface EngineGlobal {
    Storage: {
        sanatizePath(path: string): string;
        loadChapterPages(chapter: unknown): Promise<string[] | HLSEpisode | VideoEpisode>;
        getExistingChapterTitles(manga: unknown): Promise<Record<string, boolean>>;
        getExistingMangaTitles(connector: unknown): Promise<Record<string, boolean>>;
        loadMangaList(id: string | symbol): Promise<Array<{ id: string; title: string }>>;
        saveMangaList(id: string | symbol, mangas: Array<{ id: string; title: string }>): Promise<void>;
        saveChapterPages(chapter: unknown, content: Blob[]): Promise<void>;
        saveChapterFileM3U8(chapter: unknown, file: { name: string; data: string | Uint8Array }): Promise<void>;
        saveVideoChunkTemp(file: { name: string; data: Uint8Array }): Promise<string>;
        muxPlaylistM3U8(chapter: unknown, command: string): Promise<void>;
        concatVideoChunks(chapter: unknown, tempFiles: string[]): Promise<void>;
        loadConfig(key: string): Promise<unknown>;
        saveConfig(key: string, value: unknown, indentation?: number): Promise<void>;
        directoryExist(dirPath: string): Promise<void>;
        showFolderContent(chapter: unknown): Promise<void>;
        loadBookmarks(key: string): Promise<unknown>;
        saveBookmarks(key: string, value: unknown, indentation?: number): Promise<void>;
    };
    Settings: {
        chapterFormat: SettingDef;
        chapterTitleFormat: SettingDef;
        downloadHistoryLogFormat: SettingDef;
        useSequentialMediaDownloads: SettingDef<boolean>;
        ignoreErrorOnDownload: SettingDef<boolean>;
        postChapterDownloadCommand: SettingDef;
        bookmarkDirectory: SettingDef;
        baseDirectory: SettingDef;
        useSubdirectory: SettingDef<boolean>;
        recompressionFormat: SettingDef;
        recompressionQuality: SettingDef<number>;
        proxyRules: SettingDef;
        proxyAuth: SettingDef;
        hCaptchaAccessibilityUUID: SettingDef;
        discordPresence: SettingDef;
        NovelColorProfiles: SettingDef;
        readerEnabled: SettingDef<boolean>;
        frontend: SettingDef;
    };
    Request: {
        fetchUI(request: globalThis.Request, script: string, timeout: number, images: boolean): Promise<unknown>;
    };
    Blacklist: {
        patterns: string[];
    };
    Connectors: Array<EngineConnectorItem>;
    ComicInfoGenerator: {
        createComicInfoXML(series: string, title: string, pagesCount: number): string;
    };
    BookmarkManager: unknown;
    ChaptermarkManager: unknown;
    DownloadManager: unknown;
    Version: { branch: { label: string; link: string }; revision: { label: string; link: string } };
}

/** Shape of window.hakunekoAPI — IPC bridge to Electron main process */
interface HakunekoAPI {
    platform: string;
    isPortable: boolean;
    fs: HakunekoFS;
    path: HakunekoPath;
    os: { tmpdir(): Promise<string> };
    app: { getPath(name: string): Promise<string> };
    shell: { showItemInFolder(path: string): void };
    dialog: { showOpenDialog(options: Record<string, unknown>): Promise<{ canceled: boolean; filePaths: string[] }> };
    session: {
        cookies: { get(filter: Record<string, string>): Promise<Array<{ expirationDate: number }>> };
        setProxy(config: Record<string, string>): void;
    };
    exec: {
        postCommand(command: string, options: Record<string, unknown>): Promise<void>;
        ffmpeg(command: string, options: Record<string, unknown>): Promise<void>;
    };
    browser: {
        fetchJapscan(url: string, preload: string, runtime: string, prefs: Record<string, unknown>, timeout: number, options: Record<string, unknown>): Promise<unknown>;
        fetchBrowser(url: string, preload: string, runtime: string, prefs: Record<string, unknown>, timeout: number, options: Record<string, unknown>, blacklist: string[]): Promise<unknown>;
        fetchUI(url: string, script: string, timeout: number, images: boolean | undefined, options: Record<string, unknown>, blacklist: string[]): Promise<unknown>;
    };
    discord: {
        start(): Promise<void>;
        stop(): Promise<void>;
        setActivity(status: Record<string, unknown>): Promise<{ connected: boolean }>;
    };
    cert?: {
        registerBypassDomains(domains: string[]): void;
    };
}

export {};
