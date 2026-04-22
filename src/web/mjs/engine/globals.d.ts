import type { EventListenerName, HLSEpisode, VideoEpisode } from './types';

declare global {
    const Engine: EngineGlobal;
    const EventListener: Record<string, EventListenerName>;
    interface Window {
        hakunekoAPI: HakunekoAPI;
        Engine: EngineGlobal;
        EventListener: Record<string, EventListenerName>;
    }
}

/** Shape of the HakuNeko engine instance exposed on window.Engine */
interface EngineGlobal {
    Storage: {
        sanatizePath(path: string): string;
        loadChapterPages(chapter: unknown): Promise<string[] | HLSEpisode | VideoEpisode>;
        getExistingChapterTitles(manga: unknown): Promise<Record<string, boolean>>;
        getExistingMangaTitles(connector: unknown): Promise<Record<string, boolean>>;
    };
    Settings: {
        chapterFormat: { value: string };
        chapterTitleFormat: { value: string };
        downloadHistoryLogFormat: { value: string };
    };
    Request: unknown;
    Blacklist: unknown;
    Connectors: unknown;
    ComicInfoGenerator: unknown;
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
        fetchUI(url: string, script: string, timeout: number, images: boolean, options: Record<string, unknown>, blacklist: string[]): Promise<unknown>;
    };
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

export {};
