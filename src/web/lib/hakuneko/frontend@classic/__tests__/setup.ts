/**
 * Global test setup for Lit component tests.
 * Mocks window.Engine and other globals that components access during registration/connectedCallback.
 */
import { vi } from 'vitest';

// Base Connector class used in instanceof checks
class MockConnector {
    id = '';
    label = '';
}

const mockSettings = {
    readerEnabled: { value: false },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    getCategorizedSettings: vi.fn(() => []),
    load: vi.fn(),
    save: vi.fn(),
};

const mockBookmarkManager = {
    bookmarks: [],
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addBookmark: vi.fn(),
    deleteBookmark: vi.fn(),
    importBookmarks: vi.fn(),
};

const mockDownloadManager = {
    jobs: [],
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
};

const mockChaptermarkManager = {
    getChaptermarks: vi.fn(() => []),
    getChaptermark: vi.fn(() => undefined),
    isChapterMarked: vi.fn(() => false),
    addChaptermark: vi.fn(),
    deleteChaptermark: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
};

(window as any).Engine = {
    Settings: mockSettings,
    Version: { branch: { label: 'test' }, revision: { label: 'abc123', link: '' } },
    BookmarkManager: mockBookmarkManager,
    DownloadManager: mockDownloadManager,
    ChaptermarkManager: mockChaptermarkManager,
    Connectors: [],
    Storage: { folderBrowser: vi.fn() },
};

(window as any).Connector = MockConnector;
(window as any).Hls = class {
    attachMedia = vi.fn();
    loadSource = vi.fn();
    destroy = vi.fn();
};
(window as any).ASS = class {
    destroy = vi.fn();
    resize = vi.fn();
};
(window as any).hakunekoAPI = { ipc: { on: vi.fn(), off: vi.fn() } };
(window as any).minimizeWindow = vi.fn();
(window as any).maximizeWindow = vi.fn();
(window as any).closeWindow = vi.fn();

// Suppress unhandled rejections from async Lit lifecycle effects during tests
// (e.g., instanceof checks on mocked classes, chapter.getPages calls from parent updates)
window.addEventListener('unhandledrejection', (e) => {
    e.preventDefault();
});

export { MockConnector, mockSettings, mockBookmarkManager, mockDownloadManager, mockChaptermarkManager };
