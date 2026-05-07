import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { themeStyles } from './theme.js';

// Import all child components so they self-register
import './menu.js';
import './mangas.js';
import './chapters.js';
import './pages.js';
import './jobs.js';
import './start.js';

@customElement('hakuneko-app')
export class HakunekoApp extends LitElement {
    static styles = [themeStyles, css`
        :host { display: flex; flex-direction: row; width: 100%; height: 100%; }
        .control {
            flex-direction: column;
            width: calc(100% - 1px);
            height: 100%;
            flex: 1;
            border-right: var(--app-control-border);
            -webkit-box-shadow: var(--app-control-shadow);
                    box-shadow: var(--app-control-shadow);
            z-index: 1;
        }
        .show { display: flex; }
        .hide { display: none; }
        .mangas {
            display: flex; flex-direction: row;
            flex: 1;
            border-top: var(--app-control-border);
            border-bottom: var(--app-control-border);
            min-height: 0;
        }
        .content { width: 100%; height: 100%; flex: 100; z-index: 0; overflow-x: hidden; }
        hakuneko-menu { flex: 0; -webkit-app-region: drag; }
        hakuneko-mangas { box-sizing: border-box; }
        hakuneko-chapters { box-sizing: border-box; }
        hakuneko-jobs { flex: 0; }
        hakuneko-pages { flex: 100; z-index: 0; overflow-x: hidden; }
        hakuneko-start { flex: 100; z-index: 0; overflow-x: hidden; }
    `];

    @state() private _connector: any = undefined;
    @state() private _manga: any = undefined;
    @state() private _chapter: any = undefined;
    @state() private _selectedMediaIndex = -1;
    @state() private _readerEnabled = false;

    connectedCallback() {
        super.connectedCallback();
        this._readerEnabled = (window as any).Engine.Settings.readerEnabled.value;
        (window as any).Engine.Settings.addEventListener('saved', this._onSettingsSaved);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        (window as any).Engine.Settings.removeEventListener('saved', this._onSettingsSaved);
    }

    private _onSettingsSaved = () => {
        this._readerEnabled = (window as any).Engine.Settings.readerEnabled.value;
    };

    private _getControlClass(): string {
        return this._selectedMediaIndex < 0 ? 'show' : 'hide';
    }

    private _getMangaListStyle(): string {
        return this._readerEnabled ? 'width: 20em;' : 'flex: 1; max-width: 50%;';
    }

    private _getContentPanelStyle(): string {
        return this._readerEnabled ? '' : 'display: none;';
    }

    private _getPagePanelStyle(): string {
        return (!this._readerEnabled || this._chapter === undefined) ? 'display: none;' : '';
    }

    private _getStartPanelStyle(): string {
        return (!this._readerEnabled || this._chapter !== undefined) ? 'display: none;' : '';
    }

    render() {
        return html`
            <div class="control ${this._getControlClass()}">
                <hakuneko-menu></hakuneko-menu>
                <div class="mangas">
                    <hakuneko-mangas
                        style="${this._getMangaListStyle()}"
                        .selectedConnector=${this._connector}
                        .selectedManga=${this._manga}
                        @selected-connector-changed=${(e: CustomEvent) => { this._connector = e.detail; }}
                        @selected-manga-changed=${(e: CustomEvent) => { this._manga = e.detail; }}
                    ></hakuneko-mangas>
                    <hakuneko-chapters
                        style="${this._getMangaListStyle()}"
                        .selectedConnector=${this._connector}
                        .selectedManga=${this._manga}
                        .selectedChapter=${this._chapter}
                        @selected-chapter-changed=${(e: CustomEvent) => { this._chapter = e.detail; }}
                    ></hakuneko-chapters>
                </div>
                <hakuneko-jobs></hakuneko-jobs>
            </div>
            <div style="${this._getContentPanelStyle()}" class="content">
                <hakuneko-start style="${this._getStartPanelStyle()}"></hakuneko-start>
                <hakuneko-pages
                    style="${this._getPagePanelStyle()}"
                    .selectedChapter=${this._chapter}
                    .selectedMedia=${this._selectedMediaIndex}
                    @selected-media-changed=${(e: CustomEvent) => { this._selectedMediaIndex = e.detail; }}
                ></hakuneko-pages>
            </div>
        `;
    }
}
