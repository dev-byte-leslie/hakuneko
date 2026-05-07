import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { themeStyles } from './theme.js';
import Enums from '../../../mjs/engine/Enums.js';
import './status.js';

const EventListener = Enums.EventListener;

const SortDirection = { none: 'none', asc: 'asc', desc: 'desc' } as const;
type SortDir = typeof SortDirection[keyof typeof SortDirection];

@customElement('hakuneko-chapters')
export class HakunekoChapters extends LitElement {
    static styles = [themeStyles, css`
        :host { display: flex; flex-direction: column; padding: 0.5em; background-color: var(--chapter-control-background-color); }
        .separator { border-bottom: var(--chapter-control-separator); }
        .header { flex: 0; font-weight: bold; font-size: 1.25em; padding: 0.25em; }
        .filter { flex: 0; width: 100%; }
        .list {
            flex: 1; margin-top: 0.5em; margin-bottom: 0.5em;
            border: var(--chapter-list-border);
            background-color: var(--chapter-list-background-color);
            overflow-y: scroll; white-space: nowrap; list-style-type: none; padding: 0.25em;
        }
        .list li { overflow-x: hidden; text-overflow: ellipsis; }
        .list li:hover { background-color: var(--chapter-list-highlighted); }
        .title { user-select: none; cursor: default; }
        .focus { background-color: var(--chapter-list-selected) !important; }
        .button { cursor: pointer; }
        .buttonOffline { color: var(--chapter-button-offline-color); }
        .buttonAvailable { color: var(--chapter-button-available-color); }
        .buttonQueued { color: var(--chapter-button-queued-color); }
        .buttonDownloading { color: var(--chapter-button-downloading-color); }
        .buttonCompleted { color: var(--chapter-button-completed-color); }
        .buttonFailed { color: var(--chapter-button-failed-color); }
        .markerActive { color: var(--chapter-marker-active-color); }
        .markerInactive { color: var(--chapter-marker-inactive-color); }
        .markerRemoved { color: var(--chapter-marker-removed-color); }
        .markerDisabled { visibility: hidden !important; }
        .footer { flex: 0; }
    `];

    @property({ type: Object }) selectedConnector: any = undefined;
    @property({ type: Object }) selectedManga: any = undefined;
    @property({ type: Object }) selectedChapter: any = undefined;

    @state() private _chapterList: any[] = [];
    @state() private _languageList: string[] = [];
    @state() private _markedChapter: any = undefined;
    @state() private _chapterSort: SortDir = SortDirection.none;
    @state() private _searchPattern = '';
    @state() private _searchLanguage = '';
    @state() private _readerEnabled = false;
    @state() private _statusMessage = '';

    private readonly _bookmarkConnectorID = 'bookmarks';
    private readonly _clipboardConnectorID = 'clipboard';

    connectedCallback() {
        super.connectedCallback();
        this._readerEnabled = (window as any).Engine.Settings.readerEnabled.value;
        (window as any).Engine.Settings.addEventListener('saved', this._onSettingsSaved);
        document.addEventListener(EventListener.onChapterStatusChanged, this._onChapterStatusChanged);
        window.addEventListener('chapterUp', this._onRequestChapterUp);
        window.addEventListener('chapterDown', this._onRequestChapterDown);
        (window as any).Engine.ChaptermarkManager.addEventListener('changed', this._onChaptermarksChanged);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        (window as any).Engine.Settings.removeEventListener('saved', this._onSettingsSaved);
        document.removeEventListener(EventListener.onChapterStatusChanged, this._onChapterStatusChanged);
        window.removeEventListener('chapterUp', this._onRequestChapterUp);
        window.removeEventListener('chapterDown', this._onRequestChapterDown);
        (window as any).Engine.ChaptermarkManager.removeEventListener('changed', this._onChaptermarksChanged);
    }

    updated(changedProps: Map<string, unknown>) {
        if (changedProps.has('selectedConnector')) {
            this._onSelectedConnectorChanged();
        }
        if (changedProps.has('selectedManga')) {
            this._onSelectedMangaChanged(this.selectedManga);
        }
    }

    private _onSelectedConnectorChanged() {
        this._setSelectedChapter(undefined);
    }

    private _onSelectedMangaChanged(manga: any) {
        this._setSelectedChapter(undefined);
        this._chapterList = [];
        this._languageList = [];
        if (!this.selectedConnector || !manga) return;

        this._onChaptermarksChanged();

        const statusElem = this.shadowRoot?.querySelector('hakuneko-status') as any;
        const statusID = statusElem?.addToQueue?.(`Loading chapter list (${manga.title})`);
        manga.getChapters((error: any, chapters: any[]) => {
            if (manga === this.selectedManga) {
                this._chapterList = chapters ?? [];
                this._languageList = Array.from(new Set(
                    this._chapterList.map(ch => ch.language).filter(Boolean).sort()
                ));
                this._searchLanguage = '';
            }
            statusElem?.removeFromQueue?.(statusID);
            this._updateStatusMessage();
        });
    }

    private _setSelectedChapter(chapter: any) {
        this.selectedChapter = chapter;
        this.dispatchEvent(new CustomEvent('selected-chapter-changed', { detail: chapter, bubbles: true, composed: true }));
    }

    private _updateStatusMessage() {
        const visible = this._getVisibleChapters();
        this._statusMessage = `Chapters: ${visible.length} / ${this._chapterList.length}`;
    }

    private _getVisibleChapters(): any[] {
        let chapters = this._chapterList;
        const filterFn = this._buildFilter(this._searchPattern, this._searchLanguage);
        if (filterFn) chapters = chapters.filter(filterFn);
        const sortFn = this._buildSort();
        if (sortFn) chapters = [...chapters].sort(sortFn);
        return chapters;
    }

    private _buildFilter(pattern: string, language: string): ((ch: any) => boolean) | null {
        if ((!pattern || pattern.length < 1) && (!language || language.length < 1)) return null;
        return (chapter: any) => {
            let matchTitle: boolean;
            const regex = pattern ? pattern.split('/') : undefined;
            if (regex && regex.length === 3 && regex[0].length === 0 && regex[1].length > 0) {
                try {
                    matchTitle = new RegExp(regex[1], regex[2]).test(chapter.title);
                } catch {
                    matchTitle = false;
                }
            } else {
                matchTitle = !pattern || chapter.title.toLowerCase().includes(pattern.toLowerCase());
            }
            const chLang = chapter.language?.toLowerCase() ?? chapter.language;
            const matchLang = !language || language.toLowerCase() === chLang;
            return matchTitle && matchLang;
        };
    }

    private _buildSort(): ((a: any, b: any) => number) | null {
        const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
        if (this._chapterSort === SortDirection.asc) return (a, b) => collator.compare(a.title, b.title);
        if (this._chapterSort === SortDirection.desc) return (a, b) => -1 * collator.compare(a.title, b.title);
        return null;
    }

    private _getSortClass(): string {
        if (this._chapterSort === SortDirection.asc) return 'fa-sort-alpha-down';
        if (this._chapterSort === SortDirection.desc) return 'fa-sort-alpha-up';
        return 'fa-sort';
    }

    private _onToggleSortClick() {
        if (this._chapterSort === SortDirection.none) this._chapterSort = SortDirection.asc;
        else if (this._chapterSort === SortDirection.asc) this._chapterSort = SortDirection.desc;
        else this._chapterSort = SortDirection.none;
        this._updateStatusMessage();
    }

    private async _onDownloadChaptersClick() {
        if (!this._chapterList || this._chapterList.length < 1) return;
        const visible = this._getVisibleChapters().filter(ch => ch.status === 'available');
        if (visible.length > 0 && await confirm(`Download ${visible.length} new chapter(s) from the current chapter list?`)) {
            visible.forEach(ch => (window as any).Engine.DownloadManager.addDownload(ch));
        }
    }

    private _getChapterClass(chapter: any): string {
        return (!this.selectedChapter || this.selectedChapter.id !== chapter.id) ? '' : 'focus';
    }

    private _getChapterDownloadClass(status: string): string {
        switch (status) {
            case 'unavailable': return 'fa-exclamation-triangle';
            case 'offline': return 'fa-folder buttonOffline';
            case 'available': return 'fa-cloud buttonAvailable';
            case 'queued': return 'fa-cloud-download-alt buttonQueued';
            case 'downloading': return 'fa-cloud-download-alt buttonDownloading';
            case 'completed': return 'fa-folder-open buttonCompleted';
            case 'failed': return 'fa-exclamation-triangle buttonFailed';
            default: return '';
        }
    }

    private _getChapterDownloadTooltip(status: string): string {
        switch (status) {
            case 'unavailable': return 'Chapter is not available';
            case 'offline': return 'OFFLINE\nThe chapter is only accessable from the manga directory';
            case 'available': return 'AVAILABLE\nClick to download chapter';
            case 'queued': return 'QUEUED\nClick to remove chapter from download manager';
            case 'downloading': return 'DOWNLOADING';
            case 'completed': return 'DOWNLOADED\nClick to delete and re-download chapter';
            case 'failed': return 'DOWNLOAD FAILED\nCheck the exclamation mark in the joblist for details\nClick to delete and re-download the chapter';
            default: return 'No tooltip available!';
        }
    }

    private async _onProcessChapterClick(chapter: any) {
        switch (chapter.status) {
            case 'available':
                (window as any).Engine.DownloadManager.addDownload(chapter);
                break;
            case 'completed':
                if (await confirm('Re-download existing chapter?')) {
                    (window as any).Engine.DownloadManager.addDownload(chapter);
                }
                break;
            case 'failed':
                (window as any).Engine.DownloadManager.addDownload(chapter);
                break;
            default:
                alert('No action available!');
        }
    }

    private _onSelectChapterClick(chapter: any) {
        this._setSelectedChapter(chapter);
    }

    private _onMarkChapterClick(chapter: any) {
        const Engine = (window as any).Engine;
        if (Engine.ChaptermarkManager.isChapterMarked(chapter, this._markedChapter)) {
            Engine.ChaptermarkManager.deleteChaptermark(this._markedChapter);
        } else {
            Engine.ChaptermarkManager.addChaptermark(chapter);
        }
    }

    private _onUnmarkChapterClick() {
        (window as any).Engine.ChaptermarkManager.deleteChaptermark(this._markedChapter);
    }

    private _onShowFileManagerClick(chapter: any) {
        (window as any).Engine.Storage.showFolderContent(chapter);
    }

    private _getChapterMarkClass(chapter: any): string {
        return (window as any).Engine.ChaptermarkManager.isChapterMarked(chapter, this._markedChapter)
            ? 'fas markerActive'
            : 'far markerInactive';
    }

    private _getChapterMarkTooltip(chapter: any): string {
        return (window as any).Engine.ChaptermarkManager.isChapterMarked(chapter, this._markedChapter)
            ? 'Remove the "recently read" marker from this chapter'
            : 'Mark this chapter as "recently read"';
    }

    private _existChaptermarkForChapters(): boolean {
        return !!(this._markedChapter && this._chapterList && !this._chapterList.find(ch => (window as any).Engine.ChaptermarkManager.isChapterMarked(ch, this._markedChapter)));
    }

    private _getPagePreviewStyle(): string {
        return this._readerEnabled ? '' : 'display: none;';
    }

    private _onChaptermarksChanged = () => {
        this._markedChapter = (window as any).Engine.ChaptermarkManager.getChaptermark(this.selectedManga);
    };

    private _onChapterStatusChanged = (e: Event) => {
        const ce = e as CustomEvent;
        const chapter = ce.detail;
        if (!this._chapterList || !this.selectedManga || !this.selectedConnector) return;
        if (this.selectedManga.id !== chapter.manga.id) return;
        if (this.selectedConnector.id !== this._bookmarkConnectorID
            && this.selectedConnector.id !== this._clipboardConnectorID
            && this.selectedConnector.id !== chapter.manga.connector.id) return;
        // Trigger reactive update for the changed chapter
        this._chapterList = [...this._chapterList];
    };

    private _onSettingsSaved = () => {
        this._readerEnabled = (window as any).Engine.Settings.readerEnabled.value;
        if (this.selectedManga) {
            setTimeout(() => this._onSelectedMangaChanged(this.selectedManga), 0);
        }
    };

    private _onRequestChapterUp = (e: Event) => {
        const chapter = (e as CustomEvent).detail;
        const list = this._getVisibleChapters();
        const index = list.findIndex(c => c === chapter);
        if (index > 0) this._setSelectedChapter(list[index - 1]);
    };

    private _onRequestChapterDown = (e: Event) => {
        const chapter = (e as CustomEvent).detail;
        const list = this._getVisibleChapters();
        const index = list.findIndex(c => c === chapter);
        if (index < list.length - 1) this._setSelectedChapter(list[index + 1]);
    };

    render() {
        const visible = this._getVisibleChapters();
        return html`
            <div class="header separator">
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                        <td>Chapter List</td>
                        <td width="1">
                            <i class="fas fa-fw button ${this._getSortClass()}" @click=${this._onToggleSortClick} title="Click to toggle chapter sorting"></i>
                        </td>
                        <td width="1">
                            <i class="fas fa-fw fa-download button" @click=${this._onDownloadChaptersClick} title="Click to download all chapters currently shown in the filtered and sorted list"></i>
                        </td>
                    </tr>
                </table>
            </div>
            <table class="filter separator">
                <tr>
                    <td><i class="fas fa-fw fa-language" title="Select a language to filter the chapter list"></i></td>
                    <td>
                        <select .value=${this._searchLanguage} @change=${(e: Event) => { this._searchLanguage = (e.target as HTMLSelectElement).value; this._updateStatusMessage(); }}>
                            <option value="">*</option>
                            ${this._languageList.map(lang => html`<option value="${lang}">${lang}</option>`)}
                        </select>
                    </td>
                    <td></td>
                </tr>
                <tr>
                    <td><i class="fas fa-fw fa-search" title="Enter a pattern (regex support e.g. '/ch 001/i') to filter the chapter list by their titles"></i></td>
                    <td style="width: 100%;">
                        <input type="text" .value=${this._searchPattern}
                               @input=${(e: InputEvent) => { this._searchPattern = (e.target as HTMLInputElement).value; this._updateStatusMessage(); }}/>
                    </td>
                    <td></td>
                </tr>
            </table>
            <ul class="list">
                ${this._existChaptermarkForChapters() ? html`
                    <li>
                        <i class="fas fa-fw"></i>
                        <i class="fas fa-fw"></i>
                        <i class="fas fa-fw fa-bookmark button markerRemoved" title="Click to remove the marked chapter" @click=${this._onUnmarkChapterClick}></i>
                        <span class="title markerRemoved" title="The chapter has been marked as &quot;recently read&quot; but is no longer available&#10;ID: ${this._markedChapter?.chapterID}">${this._markedChapter?.chapterTitle}</span>
                    </li>
                ` : nothing}
                ${visible.map(item => html`
                    <li class="${this._getChapterClass(item)}">
                        <i class="fas fa-fw button ${this._getChapterDownloadClass(item.status)}"
                           @click=${() => this._onProcessChapterClick(item)}
                           title="${this._getChapterDownloadTooltip(item.status)}"></i>
                        <i class="far fa-fw fa-image button" style="${this._getPagePreviewStyle()}"
                           @click=${() => this._onSelectChapterClick(item)}
                           title="Show preview of chapter's pages"></i>
                        <i class="fa-fw fa-bookmark button ${this._getChapterMarkClass(item)}"
                           @click=${() => this._onMarkChapterClick(item)}
                           title="${this._getChapterMarkTooltip(item)}"></i>
                        <span class="title ${item.status}"
                              title="${item.title}&#10;Doubleclick to open the folder with your file manager"
                              @dblclick=${() => this._onShowFileManagerClick(item)}>${item.title}</span>
                    </li>
                `)}
            </ul>
            <div class="footer">
                <hakuneko-status .message=${this._statusMessage}></hakuneko-status>
            </div>
        `;
    }
}
