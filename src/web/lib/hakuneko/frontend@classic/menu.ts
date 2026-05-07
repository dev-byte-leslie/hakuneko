import { LitElement, html, css } from 'lit';
import { customElement, state, query } from 'lit/decorators.js';
import { themeStyles } from './theme.js';
import './input.js';

@customElement('hakuneko-menu')
export class HakunekoMenu extends LitElement {
    static styles = [themeStyles, css`
        :host { background-color: var(--menu-control-background-color); }
        a { text-decoration: none; }
        .item { margin: 0.25em; cursor: pointer; }
        .title { font-weight: bold; font-size: 1.5em; color: var(--menu-control-title-color); }
        .popup {
            flex-direction: column;
            position: absolute; left: 0; top: 0; bottom: 0;
            border: var(--menu-control-border);
            background-color: var(--menu-control-background-color);
            padding: 0; margin: 0.5em; border-radius: 0;
            -webkit-box-shadow: var(--menu-control-shadow);
                    box-shadow: var(--menu-control-shadow);
            z-index: 1;
        }
        .show { display: flex; }
        .hide { display: none; }
        .separator {
            font-weight: bold; color: var(--menu-control-category-color);
            border-bottom: var(--menu-control-separator);
            padding-left: 0.5em; padding-top: 0.5em; padding-bottom: 0.25em;
            text-transform: uppercase;
        }
        .about { display: flex; margin: 0.5em; }
        .logo { flex: 0; }
        .logo img { border: var(--menu-control-border); }
        .info { flex: 1; margin-left: 0.5em; }
        .credits { background-color: var(--menu-credits-background-color); padding: 0.5em; border: var(--menu-control-border); margin-bottom: 0.5em; }
        .people { width: 100%; }
        .people td { vertical-align: top; padding-right: 0.5em; }
        .settings { flex: 1; overflow-y: scroll; background-color: var(--menu-settings-background-color); padding: 0.5em; }
        td { white-space: nowrap; overflow-x: hidden; border-bottom: var(--menu-settings-row-border); }
        .group { font-weight: bold; color: var(--menu-control-category-color); padding: 0.5em; text-align: center; text-transform: uppercase; }
        .link { color: var(--menu-credits-link-color); }
        .button { cursor: pointer; -webkit-app-region: no-drag; }
        .right { float: right; }
        .buttons { display: flex; }
        .buttonsLeft { flex: 1; text-align: left; }
        .buttonsRight { flex: 1; text-align: right; white-space: nowrap; }
        #importFile { display: none; }
    `];

    @state() private _popupVisible = false;
    @state() private _settingCategories: any[] = [];
    @state() private _year = new Date().getFullYear();
    @state() private _version: any = undefined;

    @query('#importFile') private _importFileInput!: HTMLInputElement;

    connectedCallback() {
        super.connectedCallback();
        this._version = (window as any).Engine.Version;
    }

    private async _togglePopup() {
        const visible = !this._popupVisible;
        this._settingCategories = visible ? (window as any).Engine.Settings.getCategorizedSettings() : [];
        this._popupVisible = visible;
    }

    private _closeDiscardChanges() {
        (window as any).Engine.Settings.load();
        this._settingCategories = [];
        this._popupVisible = false;
    }

    private _closeSaveChanges() {
        (window as any).Engine.Settings.save();
        this._settingCategories = [];
        this._popupVisible = false;
    }

    private _openWindow(href: string) {
        const popup = window.open(href, '', 'nodeIntegration=no,contextIsolation=yes');
        if (!popup) return;
        const watchdog = setInterval(() => {
            if (popup.closed) {
                clearInterval(watchdog);
            } else {
                try {
                    popup.onbeforeunload = () => undefined;
                    popup.document.querySelector('div.unsupported-browser')?.remove();
                    popup.document.querySelector('div.signup-prompt')?.remove();
                } catch { /* cross-origin — ignore */ }
            }
        }, 500);
    }

    private _import() {
        this._importFileInput.click();
    }

    private _onImport(event: Event) {
        const files = (event.target as HTMLInputElement).files;
        try {
            if (files?.[0]) (window as any).Engine.BookmarkManager.importBookmarks(files[0]);
        } catch (error: any) {
            alert(error.message);
        } finally {
            this._importFileInput.value = '';
        }
    }

    render() {
        return html`
            <i class="fas fa-fw fa-bars fa-2x item button" title="Toggle menu" @click=${this._togglePopup}></i>
            <span class="title">HakuNeko</span>
            <span class="right">
                <i class="far fa-fw fa-window-minimize item button" title="Minize HakuNeko" @click=${() => (window as any).minimizeWindow()}></i>
                <i class="far fa-fw fa-window-maximize item button" title="Maximize HakuNeko" @click=${() => (window as any).maximizeWindow()}></i>
                <i class="far fa-fw fa-2x fa-window-close item button" title="Close HakuNeko" @click=${() => (window as any).closeWindow()}></i>
            </span>
            <div class="popup ${this._popupVisible ? 'show' : 'hide'}">
                <div class="separator"><label>About</label></div>
                <div class="about">
                    <div class="logo"><img src="./img/logo_m.png"/></div>
                    <div class="info">
                        <div class="credits">
                            <div>
                                &copy; ${this._year}
                                <a class="link button" @click=${() => this._openWindow('https://git.io/hakuneko')} title="https://git.io/hakuneko">HakuNeko</a>
                                rev.
                                <a class="link button" @click=${() => this._openWindow(this._version?.revision?.link ?? '')} title="Revision History">
                                    ${this._version?.branch?.label}@${this._version?.revision?.label}
                                </a>
                                <hr>
                            </div>
                            <table class="people" cellpadding="2" cellspacing="0">
                                <tr>
                                    <td width="1">Development:</td>
                                    <td>
                                        <a class="link button" @click=${() => this._openWindow('https://github.com/orgs/manga-download/people')}>Maintainers</a><br>
                                        <a class="link button" @click=${() => this._openWindow('https://github.com/manga-download/hakuneko/graphs/contributors')}>Contributors</a>
                                    </td>
                                </tr>
                                <tr>
                                    <td width="1">Artwork:</td>
                                    <td>
                                        <a class="link button" @click=${() => this._openWindow('https://www.deviantart.com/hakuneko3kune')}>HakuNeko3Kune</a>
                                    </td>
                                </tr>
                                <tr>
                                    <td width="1">Help &amp; Info:</td>
                                    <td style="font-size: 1.5em; padding-top: 0.25em;">
                                        <i class="fas fa-fw fa-home button" @click=${() => this._openWindow('https://hakuneko.download')} title="Visit the HakuNeko Homepage"></i>
                                        <i class="fas fa-fw fa-book button" @click=${() => this._openWindow('https://hakuneko.download/docs/interface/')} title="Read the Online Documentation"></i>
                                        <i class="fas fa-fw fa-bug button" @click=${() => this._openWindow('https://hakuneko.download/docs/troubleshoot/')} title="Open a Ticket on GitHub"></i>
                                        <i class="fab fa-fw fa-discord fa-flip-horizontal button" @click=${() => this._openWindow('https://discordapp.com/invite/A5d3NDf')} title="Login to the Community Support Channel"></i>
                                        <i class="fas fa-fw fa-street-view button" @click=${() => this._openWindow('https://ipinfo.io/json')} title="Show your external IP and Geolocation"></i>
                                    </td>
                                </tr>
                            </table>
                        </div>
                    </div>
                </div>
                <div class="separator"><label>Settings</label></div>
                <div class="settings">
                    <table width="100%" cellpadding="0" cellspacing="0">
                        ${this._settingCategories.map(category => html`
                            <tr>
                                <td colspan="2" class="group"><label>${category.category}</label></td>
                            </tr>
                            ${category.settings.map((item: any) => html`
                                <tr>
                                    <td width="1">
                                        <label title="${item.description}"><i class="fas fa-fw fa-info-circle"></i> ${item.label}</label>
                                    </td>
                                    <td>
                                        <hakuneko-input .item=${item}></hakuneko-input>
                                    </td>
                                </tr>
                            `)}
                        `)}
                    </table>
                </div>
                <div class="buttons">
                    <div class="buttonsLeft">
                        <i class="fas fa-file-import fa-2x item button" title="Import bookmarks" @click=${this._import}></i>
                        <input type="file" id="importFile" accept="application/x-sqlite3,.db,.db3" @change=${this._onImport} />
                    </div>
                    <div class="buttonsRight">
                        <i class="fas fa-check-circle fa-2x item button" title="Save settings and close menu" @click=${this._closeSaveChanges}></i>
                        <i class="fas fa-times-circle fa-2x item button" title="Close menu without saving settings" @click=${this._closeDiscardChanges}></i>
                    </div>
                </div>
            </div>
        `;
    }
}
