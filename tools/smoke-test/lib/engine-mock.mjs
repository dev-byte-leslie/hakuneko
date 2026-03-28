/**
 * Engine mock layer — must be imported before any connector.
 * Stubs all Electron/browser globals that connectors depend on,
 * allowing them to instantiate and run in a plain Bun/Node process.
 */
import { parseHTML } from 'linkedom';

const { document: linkedomDocument } = parseHTML('<html><head></head><body></body></html>');

/** Stub for Engine.Request — connectors call fetchUI during _initializeConnector */
const RequestStub = {
    fetchUI: async () => {
        throw new Error('ElectronRequired');
    },
};

/** Stub for Engine.Storage — connectors call these during manga list operations */
const StorageStub = {
    loadMangaList: async () => [],
    saveMangaList: async () => {},
    getExistingMangaTitles: async () => [],
    getExistingChapterTitles: async () => [],
    loadChapterPages: async () => [],
    sanatizePath: (path) => path.replace(/[\\/:*?"<>|]/g, '_'),
};

/** Stub for Engine.Settings — chapter title formatting depends on this */
const SettingsStub = {
    save: () => {},
    chapterTitleFormat: { value: '' },
    chapterFormat: { value: 'img' },
};

/** Full Engine stub installed on globalThis */
const EngineStub = {
    Request: RequestStub,
    Storage: StorageStub,
    Settings: SettingsStub,
    Connectors: [],
};

/** Minimal CryptoJS stubs for createConnectorURI / handleConnectorURI */
const CryptoJSStub = {
    enc: {
        Utf8: {
            parse: (str) => ({ words: [], sigBytes: str.length, _str: str }),
        },
        Base64: {
            stringify: (wordArray) => Buffer.from(wordArray._str || '').toString('base64'),
            parse: (base64) => {
                const str = Buffer.from(base64, 'base64').toString('utf8');
                return { words: [], sigBytes: str.length, _str: str, toString: () => str };
            },
        },
    },
};

/** Stub for protobuf (used by fetchPROTO in a few connectors) */
const ProtobufStub = {
    load: async () => {
        throw new Error('Not available');
    },
};

/**
 * Stub EventListener global — Manga.mjs and Chapter.mjs dispatch custom events
 * using EventListener.onMangaStatusChanged / onChapterStatusChanged
 */
const EventListenerStub = {
    onMangaStatusChanged: 'onMangaStatusChanged',
    onChapterStatusChanged: 'onChapterStatusChanged',
    onSelectChapter: 'onSelectChapter',
};

/** Install all stubs on globalThis */
export function installMocks() {
    globalThis.Engine = EngineStub;
    globalThis.CryptoJS = CryptoJSStub;
    globalThis.protobuf = ProtobufStub;
    globalThis.EventListener = EventListenerStub;

    // linkedom document provides createElement, innerHTML, querySelectorAll
    globalThis.document = linkedomDocument;

    globalThis.window = {
        location: {
            origin: 'https://hakuneko.app',
            protocol: 'https:',
        },
    };

    // CustomEvent may not exist in all runtimes
    if (typeof globalThis.CustomEvent === 'undefined') {
        globalThis.CustomEvent = class CustomEvent extends Event {
            constructor(type, params = {}) {
                super(type);
                this.detail = params.detail;
            }
        };
    }
}

installMocks();
