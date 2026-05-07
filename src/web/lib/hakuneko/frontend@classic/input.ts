import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { themeStyles } from './theme.js';

const inputTypes = {
    disabled: 'disabled',
    text: 'text',
    password: 'password',
    numeric: 'numeric',
    select: 'select',
    checkbox: 'checkbox',
    file: 'file',
    directory: 'directory',
} as const;

@customElement('hakuneko-input')
export class HakunekoInput extends LitElement {
    static styles = [themeStyles, css`
        :host {
            display: flex;
            flex-direction: row;
            vertical-align: middle;
        }
        .item { margin: 0.25em; cursor: pointer; }
        .stretch { flex: 1; }
        .shrink { flex: 0; }
        .shrink:before {
            content: "";
            display: inline-block;
            height: 100%;
            vertical-align: middle;
        }
    `];

    @property({ type: Object }) item: any = undefined;

    private _isType(expected: string): boolean {
        return this.item?.input === expected;
    }

    private _onChange(e: Event) {
        const target = e.target as HTMLInputElement | HTMLSelectElement;
        this.item = { ...this.item, value: target.value };
        this.dispatchEvent(new CustomEvent('item-changed', { detail: this.item, bubbles: true, composed: true }));
    }

    private _onCheckboxChange(e: Event) {
        const target = e.target as HTMLInputElement;
        this.item = { ...this.item, value: target.checked };
        this.dispatchEvent(new CustomEvent('item-changed', { detail: this.item, bubbles: true, composed: true }));
    }

    private _clickChooseFile() {
        console.log(this.item);
    }

    private async _clickChooseDirectory() {
        const path = await (window as any).Engine.Storage.folderBrowser(this.item.value);
        if (path) {
            this.item = { ...this.item, value: path };
            this.dispatchEvent(new CustomEvent('item-changed', { detail: this.item, bubbles: true, composed: true }));
        }
    }

    render() {
        if (!this.item) return nothing;

        const dataListId = `DataList: ${this.item?.label ?? ''}`;

        return html`
            ${this._isType(inputTypes.disabled) ? html`
                <div class="stretch">
                    <input type="text" .value=${this.item.value ?? ''} title="${this.item.value ?? ''}" disabled/>
                </div>
            ` : nothing}

            ${this._isType(inputTypes.text) ? html`
                <div class="stretch">
                    <input type="text" .value=${this.item.value ?? ''} list="${dataListId}" @change=${this._onChange}/>
                    <datalist id="${dataListId}">
                        ${(this.item.options ?? []).map((option: any) => html`
                            <option value="${option.value}">${option.name}</option>
                        `)}
                    </datalist>
                </div>
            ` : nothing}

            ${this._isType(inputTypes.password) ? html`
                <div class="stretch">
                    <input type="password" .value=${this.item.value ?? ''} title="${this.item.value ?? ''}" @change=${this._onChange}/>
                </div>
            ` : nothing}

            ${this._isType(inputTypes.numeric) ? html`
                <div class="stretch">
                    <input type="number" min="${this.item.min ?? ''}" max="${this.item.max ?? ''}" .value=${String(this.item.value ?? '')} @change=${this._onChange}/>
                </div>
            ` : nothing}

            ${this._isType(inputTypes.select) ? html`
                <div class="stretch">
                    <select @change=${this._onChange}>
                        ${(this.item.options ?? []).map((option: any) => html`
                            <option value="${option.value}" ?selected=${this.item.value === option.value}>${option.name}</option>
                        `)}
                    </select>
                </div>
            ` : nothing}

            ${this._isType(inputTypes.checkbox) ? html`
                <div class="stretch">
                    <input type="checkbox" ?checked=${!!this.item.value} @change=${this._onCheckboxChange}/>
                </div>
            ` : nothing}

            ${this._isType(inputTypes.file) ? html`
                <div class="stretch">
                    <input type="text" .value=${this.item.value ?? ''} disabled title="${this.item.value ?? ''}"/>
                </div>
                <div class="shrink">
                    <i class="fas fa-fw fa-file item" @click=${this._clickChooseFile}></i>
                </div>
            ` : nothing}

            ${this._isType(inputTypes.directory) ? html`
                <div class="stretch">
                    <input type="text" .value=${this.item.value ?? ''} disabled title="${this.item.value ?? ''}"/>
                </div>
                <div class="shrink">
                    <i class="fas fa-fw fa-folder-open item" title="Browse &hellip;" @click=${this._clickChooseDirectory}></i>
                </div>
            ` : nothing}
        `;
    }
}
