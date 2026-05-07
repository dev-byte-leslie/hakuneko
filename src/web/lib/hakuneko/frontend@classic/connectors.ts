import { LitElement, html, css } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import { themeStyles } from './theme.js';
import Enums from '../../../mjs/engine/Enums.js';

const EventListener = Enums.EventListener;

@customElement('hakuneko-connectors')
export class HakunekoConnectors extends LitElement {
    static styles = [themeStyles, css`
        :host { flex: 1; }
        .popup {
            flex-direction: column;
            position: absolute;
            left: 0; right: 0; top: 0; bottom: 0;
            border: var(--connector-dialog-border);
            background-color: var(--connector-dialog-background-color);
            padding: 0;
            margin: 1em;
            border-radius: 0;
            -webkit-box-shadow: var(--connector-dialog-shadow);
                    box-shadow: var(--connector-dialog-shadow);
            z-index: 1;
        }
        .show { display: flex; }
        .hide { display: none; }
        .button { cursor: pointer; }
        .link { margin-left: 0.5em; }
        .active { cursor: pointer; }
        .disabled { cursor: not-allowed; opacity: 0.25; }
        .clear { color: var(--connector-button-clear-color); }
        .controls { flex: 0; text-align: right; padding: 0.5em; }
        .content { flex: 1; display: flex; flex-direction: row; overflow-y: hidden; }
        .filters { flex: 0; display: flex; flex-direction: column; margin: 0.5em; max-height: 100%; }
        .connectors { flex: 1; display: flex; flex-direction: column; margin: 0.5em; max-height: 100%; }
        .pattern { flex: 0; width: 100%; min-width: 16em; }
        .scroll { flex: 1; overflow-y: scroll; }
        .tags { background-color: var(--connector-tag-list-background-color); line-height: 1.5em; padding: 0.5em; }
        .separator {
            flex: 0;
            font-weight: bold;
            color: var(--connector-dialog-category-color);
            border-bottom: var(--connector-dialog-separator);
            padding-left: 0.5em;
            padding-top: 0.5em;
            padding-bottom: 0.25em;
            text-transform: uppercase;
        }
        .card {
            display: flex; flex-direction: row;
            width: 30em; float: left;
            background-color: var(--connector-card-background-color);
            border: var(--connector-card-border);
            -webkit-box-shadow: var(--connector-card-shadow);
                    box-shadow: var(--connector-card-shadow);
            margin: 1em; padding: 0.5em;
        }
        .card:hover { background-color: var(--connector-card-highlighted); }
        .cardSelected { background-color: var(--connector-card-selected) !important; }
        .icon { width: 3.25em; height: 3.25em; }
        .description { flex: 1; margin-left: 0.5em; }
        .heading { display: flex; flex-direction: row; flex: 0; margin-bottom: 0.25em; border-bottom: var(--connector-title-border); }
        .title { flex: 1; font-size: 1.25em; font-weight: bold; }
        .control { flex: 0; white-space: nowrap; }
        .tag {
            white-space: nowrap;
            color: var(--connector-tag-color);
            background-color: var(--connector-tag-background-color);
            border-radius: 0.5em;
            padding-left: 0.3em;
            padding-right: 0.3em;
        }
        .tagSelected { background-color: var(--connector-tag-selected) !important; }
    `];

    @property({ type: Object }) selectedConnector: any = undefined;

    @state() private _popupVisible = false;
    @state() private _connectorList: any[] = [];
    @state() private _tags: any[] = [];
    @state() private _selectedTags: any[] = [];
    @state() private _connectorPattern = '';
    @state() private _mangaPattern = '';

    @query('#connectorPattern') private _connectorPatternInput!: HTMLInputElement;
    @query('#mangaPattern') private _mangaPatternInput!: HTMLInputElement;

    connectedCallback() {
        super.connectedCallback();
        this._connectorList = (window as any).Engine.Connectors;
        this.selectedConnector = this.selectedConnector ?? (window as any).Engine.Connectors[0];
        this._tags = this._getAvailableTags();
    }

    private _getAvailableTags(): any[] {
        const tags = this._connectorList.reduce((acc: string[], connector: any) => {
            const newTags = connector.tags.filter((t: string) => !acc.includes(t));
            return acc.concat(newTags);
        }, []);
        return [...new Set(tags)].sort().map(t => ({ tag: t, selected: false }));
    }

    private _showPopup() {
        this._popupVisible = true;
        // Focus after render
        requestAnimationFrame(() => {
            this._connectorPatternInput?.select();
            this._connectorPatternInput?.focus();
        });
    }

    private _closePopup() {
        this._popupVisible = false;
    }

    private _selectConnector(connector: any) {
        this.selectedConnector = connector;
        this.dispatchEvent(new CustomEvent('selected-connector-changed', { detail: connector, bubbles: true, composed: true }));
        document.dispatchEvent(new CustomEvent(EventListener.onSelectConnector, { detail: connector }));
        this._closePopup();
    }

    private _openLink(evt: Event, link: string | undefined) {
        if (link) {
            const popup = window.open(link, '', 'nodeIntegration=no,contextIsolation=yes');
            if (popup) {
                const watchdog = setInterval(() => {
                    if (popup.closed) {
                        clearInterval(watchdog);
                    } else {
                        try {
                            popup.onbeforeunload = () => undefined;
                        } catch { /* cross-origin */ }
                    }
                }, 500);
            }
        }
        evt.stopPropagation();
    }

    private _openWebsite(evt: Event, item: any) {
        this._openLink(evt, item.url);
    }

    private _openLogin(evt: Event, item: any) {
        this._openLink(evt, item.links?.login);
    }

    private _openDonation(evt: Event, item: any) {
        this._openLink(evt, item.links?.donation);
    }

    private _toggleTag(tag: any) {
        tag.selected = !tag.selected;
        this._selectedTags = this._tags.filter(t => t.selected);
    }

    private _filterConnectors(connector: any): boolean {
        const p = (this._connectorPattern || '').toLowerCase();
        const patternMatch = !p || (connector.id + connector.label + connector.url).toLowerCase().includes(p);
        const tagsMatch = this._selectedTags.filter(t => !connector.tags.includes(t.tag)).length < 1;
        return patternMatch && tagsMatch;
    }

    private async _filterConnectorsByManga(evt: KeyboardEvent) {
        if (evt.key !== 'Enter' || this._mangaPatternInput.disabled) return;

        this._mangaPatternInput.disabled = true;
        try {
            const results = await Promise.all(
                (window as any).Engine.Connectors.map((connector: any) => {
                    if (typeof connector.findMatchingManga === 'function') {
                        return connector.findMatchingManga(this._mangaPattern)
                            .then((r: any) => r ? connector : undefined);
                    }
                    return Promise.resolve(undefined);
                })
            );
            this._connectorList = results.filter((c: any) => !!c);
        } catch (error) {
            console.error(error);
        } finally {
            this._mangaPatternInput.disabled = false;
            this._mangaPatternInput.focus();
        }
    }

    private _clearFilters() {
        this._tags.forEach(tag => {
            tag.selected = false;
        });
        this._connectorList = (window as any).Engine.Connectors;
        this._mangaPattern = '';
        this._connectorPattern = '';
        this._selectedTags = [];
    }

    private _getConnectorClass(connector: any): string {
        return this.selectedConnector === connector ? 'cardSelected' : '';
    }

    private _getTagClass(tag: any): string {
        return this._selectedTags.includes(tag) ? 'tagSelected' : '';
    }

    private _getLoginClass(links: any): string {
        return links?.login ? 'active' : 'disabled';
    }

    private _getDonationClass(links: any): string {
        return links?.donation ? 'active' : 'disabled';
    }

    render() {
        const visibleConnectors = this._connectorList.filter(c => this._filterConnectors(c));
        return html`
            <input type="text" class="button" @click=${this._showPopup} .value=${this.selectedConnector?.label ?? ''} readonly/>
            <div class="popup ${this._popupVisible ? 'show' : 'hide'}">
                <div class="controls" title="Click to cancel the website selection">
                    <i class="fas fa-times-circle fa-2x button" @click=${this._closePopup}></i>
                </div>
                <div class="content">
                    <div class="filters">
                        <div class="separator">
                            <i class="fas fa-plug"></i>
                            <label>Website</label>
                        </div>
                        <input id="connectorPattern" class="pattern" type="text"
                               .value=${this._connectorPattern}
                               @input=${(e: InputEvent) => {
        this._connectorPattern = (e.target as HTMLInputElement).value;
    }}
                               title="Show only websites with a name that matches the entered pattern (case-insensitive)"/>
                        <div class="separator">
                            <i class="fas fa-book"></i>
                            <label>Manga</label>
                        </div>
                        <input id="mangaPattern" class="pattern" type="text"
                               .value=${this._mangaPattern}
                               @input=${(e: InputEvent) => {
        this._mangaPattern = (e.target as HTMLInputElement).value;
    }}
                               @keyup=${this._filterConnectorsByManga}
                               title="Show only websites with a manga that matches the entered pattern (case-insensitive)&#10;Searches only in local synchronized manga lists&#10;Press ENTER to perform the search"/>
                        <div class="separator">
                            <i class="fas fa-tags" title="Show only websites containing the selected tags"></i>
                            <label>Tags</label>
                        </div>
                        <div class="scroll tags">
                            ${this._tags.map(tag => html`
                                <span class="tag button ${this._getTagClass(tag)}" @click=${() => this._toggleTag(tag)}>${tag.tag}</span>
                            `)}
                        </div>
                    </div>
                    <div class="connectors">
                        <div class="separator">
                            <i class="fas fa-times button clear" title="Reset all filters" @click=${this._clearFilters}></i>
                            <label>Connectors</label>
                        </div>
                        <div class="scroll">
                            ${visibleConnectors.map(item => html`
                                <div class="card ${this._getConnectorClass(item)}"
                                     title="Click to show mangas from this website&#10;&#10;Label: ${item.label}&#10;ID: ${item.id}&#10;URL: ${item.url}"
                                     @click=${() => this._selectConnector(item)}>
                                    <img class="icon" src="${item.icon}" onerror="this.src='/img/connectors/default';" />
                                    <div class="description">
                                        <div class="heading">
                                            <div class="title">${item.label}</div>
                                            <div class="control">
                                                <i class="fas fa-sign-in-alt link ${this._getLoginClass(item.links)}"
                                                   title="Click to open the login page"
                                                   @click=${(e: Event) => this._openLogin(e, item)}></i>
                                                <i class="fas fa-coffee link ${this._getDonationClass(item.links)}"
                                                   title="Click to open the donation page"
                                                   @click=${(e: Event) => this._openDonation(e, item)}></i>
                                                <i class="fas fa-external-link-square-alt link active"
                                                   title="Click to open the website in a new window"
                                                   @click=${(e: Event) => this._openWebsite(e, item)}></i>
                                            </div>
                                        </div>
                                        <div>
                                            ${(item.tags ?? []).map((tag: string) => html`<span class="tag">${tag}</span>`)}
                                        </div>
                                    </div>
                                </div>
                            `)}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}
