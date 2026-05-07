import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { themeStyles } from './theme.js';

interface QueueItem {
    id: symbol;
    text: string;
}

@customElement('hakuneko-status')
export class HakunekoStatus extends LitElement {
    static styles = [themeStyles, css`
        :host {
            display: flex;
            flex-direction: row;
        }
        .status { flex: 0; }
        .message { flex: 1; }
        .popup { padding: 0.5em; background-color: #ffffff; }
        .show { display: block; }
        .hide { display: none; }
    `];

    @state() private _message = '';
    @state() private _queue: QueueItem[] = [];

    get message(): string {
        return this._message;
    }

    set message(val: string) {
        this._message = val;
        this.dispatchEvent(new CustomEvent('message-changed', { detail: val, bubbles: true, composed: true }));
        this.requestUpdate();
    }

    /** Add a status item and return its unique ID for removal. */
    addToQueue(text: string): symbol {
        const id = Symbol(text);
        this._queue = [...this._queue, { id, text }];
        return id;
    }

    /** Remove a status item by its ID. */
    removeFromQueue(id: symbol): void {
        this._queue = this._queue.filter(item => item.id !== id);
    }

    private _getStatusClass(): string {
        return this._queue.length > 0 ? 'show' : 'hide';
    }

    private _getQueueContent(): string {
        return this._queue.map(item => item.text).join('\n');
    }

    render() {
        return html`
            <div class="status ${this._getStatusClass()}" title="${this._getQueueContent()}">
                ${this._queue.length}
                <i class="fas fa-spinner fa-pulse fa-fw"></i>
            </div>
            <div class="message">${this._message}</div>
        `;
    }
}
