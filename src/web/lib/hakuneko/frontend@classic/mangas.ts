import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { themeStyles } from './theme.js';
import Enums from '../../../mjs/engine/Enums.js';
import './connectors.js';
import './bookmarks.js';
import './status.js';

const EventListener = Enums.EventListener;

@customElement('hakuneko-mangas')
export class HakunekoMangas extends LitElement {
    static styles = [themeStyles, css`
        :host { display: flex; flex-direction: column; padding: 0.5em; background-color: var(--manga-control-background-color); }
        .separator { border-bottom: var(--manga-control-separator); }
        .header { flex: 0; font-weight: bold; font-size: 1.25em; padding: 0.25em; }
        #paste { position: absolute; z-index: -9999; height: 0; width: 0; opacity: 0; }
        .filter { flex: 0; width: 100%; }
        .notification {
            padding: 0.5em; font-weight: bold; text-align: center; line-height: 150%;
            background-color: var(--manga-list-notification-color);
            border: var(--manga-list-notification-border);
        }
        .list {
            flex: 1; margin-top: 0.5em; margin-bottom: 0.5em;
            border: var(--manga-list-border);
            background-color: var(--manga-list-background-color);
            overflow-y: scroll; white-space: nowrap; list-style-type: none; padding: 0.25em;
        }
        .manga { overflow-x: hidden; text-overflow: ellipsis; cursor: pointer; }
        .manga:hover { background-color: var(--manga-list-highlighted); }
        .focus { background-color: var(--manga-list-selected) !important; }
        .button { cursor: pointer; }
        .refresh { cursor: pointer; color: var(--manga-refresh-button-color); text-shadow: var(--manga-refresh-button-shadow); }
        .disabled { color: var(--manga-button-disabled-color); cursor: progress !important; }
        .footer { flex: 0; }
    `];

    @property({ type: Object }) selectedConnector: any = undefined;
    @property({ type: Object }) selectedManga: any = undefined;

    @state() private _mangaList: any[] = [];
    @state() private _mangaPattern = '';
    @state() private _statusMessage = '';

    private readonly _bookmarkConnectorID = 'bookmarks';
    private _statusRef: any = null;

    connectedCallback() {
        super.connectedCallback();
        document.addEventListener(EventListener.onMangaStatusChanged, this._onMangaStatusChanged);
        (window as any).Engine.BookmarkManager.addEventListener('changed', this._onBookmarksChanged);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        document.removeEventListener(EventListener.onMangaStatusChanged, this._onMangaStatusChanged);
        (window as any).Engine.BookmarkManager.removeEventListener('changed', this._onBookmarksChanged);
    }

    updated(changedProps: Map<string, unknown>) {
        if (changedProps.has('selectedConnector')) {
            this._onSelectedConnectorChanged(this.selectedConnector);
        }
    }

    private _onSelectedConnectorChanged(connector: any) {
        this.selectedManga = undefined;
        this.dispatchEvent(new CustomEvent('selected-manga-changed', { detail: undefined, bubbles: true, composed: true }));
        if (!connector) {
            this._mangaList = [];
            return;
        }
        const statusElem = this.shadowRoot?.querySelector('hakuneko-status') as any;
        const statusID = statusElem?.addToQueue?.(`Loading manga list (${connector.label})`);
        this._mangaList = [];
        connector.getMangas((error: any, mangas: any[]) => {
            if (connector === this.selectedConnector) {
                this._mangaList = mangas ?? [];
            }
            statusElem?.removeFromQueue?.(statusID);
            this._updateStatusMessage();
        });
    }

    private _updateStatusMessage() {
        const filtered = this._getFilteredMangas();
        this._statusMessage = `Mangas: ${filtered.length} / ${this._mangaList.length}`;
    }

    private _getFilteredMangas(): any[] {
        const filter = this._buildFilter(this._mangaPattern);
        return filter ? this._mangaList.filter(filter) : this._mangaList;
    }

    private _buildFilter(pattern: string): ((manga: any) => boolean) | null {
        const isLatin = /^[a-zA-Z0-9]+$/.test(pattern);
        const threshold = isLatin ? 3 : 2;
        if (!pattern || pattern.length < threshold) return null;
        const p = pattern.toLowerCase();
        return (manga: any) => manga.title.toLowerCase().includes(p) || manga.connector.label.toLowerCase().includes(p);
    }

    private _onUpdateMangaListClick() {
        const connector = this.selectedConnector;
        if (!connector || connector.isUpdating) return;
        const statusElem = this.shadowRoot?.querySelector('hakuneko-status') as any;
        const statusID = statusElem?.addToQueue?.(`Updating manga list (${connector.label})`);
        connector.updateMangas((error: any, mangas: any[]) => {
            if (connector === this.selectedConnector) {
                if (!error) this._mangaList = mangas ?? [];
                this.requestUpdate(); // trigger refresh button style
            }
            statusElem?.removeFromQueue?.(statusID);
            this._updateStatusMessage();
            if (error) {
                (alert as any)(`Failed to update manga list for ${connector.label}\n\n${error.message}`, `HakuNeko - ${connector.label}`, 'error');
            }
        });
        this.requestUpdate();
    }

    private _onMangaClicked(manga: any) {
        this.selectedManga = manga;
        this.dispatchEvent(new CustomEvent('selected-manga-changed', { detail: manga, bubbles: true, composed: true }));
        document.dispatchEvent(new CustomEvent(EventListener.onSelectManga, { detail: manga }));
        this._updateStatusMessage();
    }

    private _onMangaStatusChanged = (e: Event) => {
        const manga = (e as CustomEvent).detail;
        if (!this._mangaList || !this.selectedConnector) return;
        if (this.selectedConnector.id !== this._bookmarkConnectorID && this.selectedConnector.id !== manga.connector.id) return;
        // Trigger reactive update
        this._mangaList = [...this._mangaList];
    };

    private _onBookmarksChanged = () => {
        if (this.selectedConnector?.id === this._bookmarkConnectorID) {
            this._onSelectedConnectorChanged(this.selectedConnector);
        }
    };

    private _onPasteClick() {
        const clipboardConnector = (window as any).Engine.Connectors.find((c: any) => c.id === 'clipboard');
        this.selectedConnector = clipboardConnector;
        this.dispatchEvent(new CustomEvent('selected-connector-changed', { detail: clipboardConnector, bubbles: true, composed: true }));
        this._onUpdateMangaListClick();
    }

    private _getMangaClass(manga: any): string {
        return !this.selectedManga || this.selectedManga.id !== manga.id ? '' : 'focus';
    }

    private _getRefreshClass(): string {
        return this.selectedConnector?.isUpdating ? 'fa-pulse disabled' : '';
    }

    private _existMangasForValidConnector(): boolean {
        return !!(this.selectedConnector && this.selectedConnector.id !== this._bookmarkConnectorID && this._mangaList.length < 1);
    }

    render() {
        const filtered = this._getFilteredMangas();
        return html`
            <div class="header separator">
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                        <td>Manga List</td>
                        <td width="1">
                            <input id="paste" />
                            <i class="fas fa-fw fa-paste button" @click=${this._onPasteClick} title="Click to paste manga links from the clipboard (CTRL + V)"></i>
                        </td>
                    </tr>
                </table>
            </div>
            <table class="filter separator">
                <tr>
                    <td>
                        <i class="fas fa-fw fa-plug fa-flip-horizontal" title="Select a website from which the manga list should be shown"></i>
                    </td>
                    <td style="width: 100%;">
                        <hakuneko-connectors
                            .selectedConnector=${this.selectedConnector}
                            @selected-connector-changed=${(e: CustomEvent) => {
        this.selectedConnector = e.detail;
        this.dispatchEvent(new CustomEvent('selected-connector-changed', { detail: e.detail, bubbles: true, composed: true }));
    }}
                        ></hakuneko-connectors>
                    </td>
                    <td>
                        <i class="fas fa-fw fa-sync ${this._getRefreshClass()} refresh"
                           @click=${this._onUpdateMangaListClick}
                           title="Synchronize local manga list with online list from <${this.selectedConnector?.label ?? ''}>"></i>
                    </td>
                </tr>
                <tr>
                    <td>
                        <i class="fas fa-fw fa-search" title="Enter a pattern (at least 3 characters) to filter the manga list by their titles"></i>
                    </td>
                    <td>
                        <input type="text" .value=${this._mangaPattern}
                               @input=${(e: InputEvent) => {
        this._mangaPattern = (e.target as HTMLInputElement).value; this._updateStatusMessage();
    }}/>
                    </td>
                    <td>
                        <hakuneko-bookmarks .selectedManga=${this.selectedManga}></hakuneko-bookmarks>
                    </td>
                </tr>
            </table>
            <ul class="list">
                ${this._existMangasForValidConnector() ? html`
                    <li class="notification">
                        Manga list is loading or empty<br>
                        Click &nbsp;<i class="fas fa-sync ${this._getRefreshClass()} refresh"
                                       @click=${this._onUpdateMangaListClick}
                                       title="Synchronize local manga list with online list from <${this.selectedConnector?.label ?? ''}>"></i>&nbsp;
                        button to update list<br/>
                        <br/>
                        <i class="fas fa-info-circle"></i> Some connectors are slow<br/>
                        and may take more than 10mins<br/>
                        If the icon is still spinning,<br/>
                        it's still working<br/>
                        <br/>
                        To check the activity press F12<br/>
                        and go to the network tab
                    </li>
                ` : nothing}
                ${filtered.map(item => html`
                    <li class="manga ${item.status} ${this._getMangaClass(item)}"
                        title="${item.title}\n${item.connector.label}"
                        @click=${() => this._onMangaClicked(item)}>${item.title}</li>
                `)}
            </ul>
            <div class="footer">
                <hakuneko-status .message=${this._statusMessage}></hakuneko-status>
            </div>
        `;
    }
}
