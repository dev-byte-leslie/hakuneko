/** Status strings used by Manga, Chapter, DownloadJob */
export type EntityStatus = 'offline' | 'available' | 'completed' | 'unavailable' | 'queued' | 'downloading' | 'failed';

/** Chapter file info — returned by Chapter._getRawFileName / _getSanatizedFileName */
export interface ChapterFile {
    name: string;
    extension: string;
    full: string;
}

/** MimeTypedBuffer — returned by Connector._blobToBuffer */
export interface MimeTypedBuffer {
    mimeType: string;
    data: Uint8Array;
}

/** Setting definition shape — used by Settings and connector configs */
export interface SettingOption<T = string> {
    value: T;
    name: string;
    val?: Record<string, string>;
}

export interface SettingDef<T = string> {
    label: string;
    description: string;
    input: string;
    value: T;
    options?: SettingOption<T>[];
    min?: number;
    max?: number;
}

/** Connector config entry — connectors define this.config */
export type ConnectorConfig = Record<string, SettingDef>;

/** Format regex pair returned by Connector.getFormatRegex */
export interface FormatRegex {
    chapterRegex: RegExp;
    volumeRegex: RegExp;
}

/** Episode/media data structures returned by _getPages for anime connectors */
export interface HLSEpisode {
    mirrors: string[];
    subtitles: Subtitle[];
    referer?: string;
}

export interface VideoEpisode {
    video: string;
    subtitles: Subtitle[];
    referer?: string;
}

export interface Subtitle {
    format: string;
    locale: string;
    url: string;
    content?: string;
}

/** Page data structure used by Storage.saveChapterPages */
export interface PageData {
    name: string;
    type: string;
    data: Blob;
}

/** Request options matching Web API RequestInit shape */
export interface ConnectorRequestOptions {
    method: string;
    mode: RequestMode;
    redirect: RequestRedirect;
    credentials: RequestCredentials;
    headers: Headers;
}

/** EventListener enum constants (from Enums.mjs) */
export const EventListenerNames = {
    onMangaStatusChanged: 'onMangaStatusChanged',
    onChapterStatusChanged: 'onChapterStatusChanged',
    onSelectChapter: 'onSelectChapter',
    onSelectConnector: 'onSelectConnector',
    onSelectManga: 'onSelectManga',
} as const;

export type EventListenerName = typeof EventListenerNames[keyof typeof EventListenerNames];
