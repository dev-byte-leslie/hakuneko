import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { themeStyles } from './theme.js';

@customElement('hakuneko-bookmarks')
export class HakunekoBookmarks extends LitElement {
    static styles = [themeStyles, css`
        .bookmark {
            cursor: pointer;
            color: var(--bookmark-button-default-color);
            text-shadow: var(--bookmark-button-shadow);
        }
        .bookmarkAdd { color: var(--bookmark-button-add-color) !important; }
        .bookmarkDelete { color: var(--bookmark-button-delete-color) !important; }
        .bookmarkInvalid { color: var(--bookmark-button-invalid-color) !important; }
    `];

    @property({ type: Object }) selectedManga: any = undefined;
    @state() private _bookmarkList: any[] = [];

    connectedCallback() {
        super.connectedCallback();
        // Load bookmarks immediately in case the event fired before component was ready
        this._bookmarkList = (window as any).Engine.BookmarkManager.bookmarks;
        (window as any).Engine.BookmarkManager.addEventListener('changed', this._onBookmarksChanged);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        (window as any).Engine.BookmarkManager.removeEventListener('changed', this._onBookmarksChanged);
    }

    private _onBookmarksChanged = (e: CustomEvent) => {
        this._bookmarkList = e.detail;
    };

    private _getBookmarkClass(): string {
        const manga = this.selectedManga;
        if (manga) {
            if (manga.connector instanceof (window as any).Connector) {
                const index = this._bookmarkList.findIndex(b => b.key.manga === manga.id && b.key.connector === manga.connector.id);
                return index > -1 ? 'fa-minus-circle bookmarkDelete' : 'fa-plus-circle bookmarkAdd';
            }
            return 'fa-ban bookmarkInvalid';
        }
        return '';
    }

    private _getBookmarkTitle(): string {
        const manga = this.selectedManga;
        if (manga) {
            if (manga.connector instanceof (window as any).Connector) {
                const index = this._bookmarkList.findIndex(b => b.key.manga === manga.id && b.key.connector === manga.connector.id);
                return index > -1
                    ? 'Click to remove the selected manga from the bookmark list'
                    : 'Click to add the selected manga to the bookmark list';
            }
            return `Cannot bookmark mangas from this ${manga.connector.label}!`;
        }
        return 'Please select a manga to use the bookmark feature';
    }

    private _processBookmark() {
        const manga = this.selectedManga;
        if (manga && manga.connector instanceof (window as any).Connector) {
            const bookmark = this._bookmarkList.find(b => b.key.manga === manga.id && b.key.connector === manga.connector.id);
            if (bookmark) {
                (window as any).Engine.BookmarkManager.deleteBookmark(bookmark);
            } else {
                (window as any).Engine.BookmarkManager.addBookmark(manga);
            }
        }
    }

    render() {
        return html`
            <div>
                <span title="${this._getBookmarkTitle()}" @click=${this._processBookmark}>
                    <i class="fas fa-star bookmark"></i>
                    <i class="fas fa-suberlay ${this._getBookmarkClass()} bookmark"></i>
                </span>
            </div>
        `;
    }
}
