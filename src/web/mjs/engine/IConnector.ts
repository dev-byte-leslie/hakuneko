import type Manga from './Manga';
import type Chapter from './Chapter';
import type { ConnectorConfig, ConnectorRequestOptions, FormatRegex } from './types';

export interface IConnector {
    id: string | symbol;
    label: string;
    tags: string[];
    url: string;
    isLocked: boolean | symbol;
    initialized: boolean;
    certBypass: boolean;
    isUpdating: boolean;
    mangaCache: Manga[] | undefined;
    existingMangas: Record<string, boolean>;
    existingManga: Record<string, boolean>;
    requestOptions: ConnectorRequestOptions;
    config?: ConnectorConfig;

    readonly icon: string;

    canHandleURI(uri: URL): boolean;
    initialize(): Promise<void>;
    _initializeConnector(): Promise<unknown>;
    findMatchingManga(pattern: string): Promise<Manga | undefined>;
    updateMangas(callback: (error: Error | null, mangas: Manga[] | undefined) => void): void;
    getMangas(callback: (error: Error | null, mangas: Manga[] | undefined) => void): Promise<Manga[]>;
    getMangaFromURI(uri: URL): Promise<Manga>;
    _getMangaFromURI(uri: URL): Promise<Manga>;

    _getMangas(): Promise<Manga[]>;
    _getChapters(manga: Manga): Promise<Chapter[]>;
    _getPages(chapter: Chapter): Promise<string[] | object>;

    wait(time: number): Promise<void>;
    lock(): symbol | null;
    unlock(key: symbol | boolean): void;

    fetchDOM(request: string | URL | Request, selector?: string, retries?: number, encoding?: string): Promise<Element[] | HTMLElement>;
    fetchJSON(request: string | URL | Request, retries?: number): Promise<unknown>;
    fetchGraphQL(request: string | URL, operationName: string, query: string, variables: Record<string, unknown>): Promise<unknown>;
    fetchRegex(request: Request, regex: RegExp): Promise<string[]>;
    fetchPROTO(request: Request, protoTypes: string, rootType: string): Promise<unknown>;

    createConnectorURI(payload: unknown): string;
    handleConnectorURI(uri: URL): Promise<unknown>;
    getFormatRegex(): FormatRegex;

    createDOM(content: string, replaceImageTags?: boolean, clearIframettributes?: boolean): HTMLElement;
    getRelativeLink(element: HTMLElement): string | undefined;
    getAbsolutePath(reference: URL | string | HTMLElement, base: URL | string): string;
    getRootRelativeOrAbsoluteLink(reference: URL | string | HTMLElement, base: string): string;
    adLinkDecrypt(element: HTMLAnchorElement): void;
    cfMailDecrypt(element: HTMLElement): void;
}
