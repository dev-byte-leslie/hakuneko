import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { themeStyles } from './theme.js';

@customElement('hakuneko-jobs')
export class HakunekoJobs extends LitElement {
    static styles = [themeStyles, css`
        :host {
            width: 100%;
            background-color: var(--job-control-background-color);
        }
        .bar { display: flex; flex-direction: row; padding: 0.25em; }
        .expander { flex: 0; padding: 0.25em; }
        .status { flex: 1; text-align: right; padding: 0.25em; }
        .button { cursor: pointer; }
        .buttonQueued { color: var(--job-list-button-queued-color); }
        .buttonDownloading { color: var(--job-list-button-downloading-color); }
        .buttonCompleted { color: var(--job-list-button-completed-color); }
        .buttonFailed { color: var(--job-list-button-failed-color); }
        .list { height: 8em; background-color: var(--job-list-background-color); overflow-y: scroll; }
        .list table { width: 100%; table-layout: fixed; border-spacing: 0; border-collapse: collapse; }
        .list td { cursor: default; border-bottom: var(--job-list-row-border); }
        .cell { padding-left: 0.25em; padding-right: 0.25em; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
        .progress { width: 4em; }
        .show { display: block; }
        .hide { display: none; }
    `];

    @state() private _popupVisible = false;
    @state() private _jobList: any[] = [];

    connectedCallback() {
        super.connectedCallback();
        (window as any).Engine.DownloadManager.addEventListener('updated', this._onDownloadStatusUpdated);
        (window as any).window.hakunekoAPI.ipc.on('hakuneko:ipc:close', this._onClose);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        (window as any).Engine.DownloadManager.removeEventListener('updated', this._onDownloadStatusUpdated);
        (window as any).window.hakunekoAPI.ipc.off('hakuneko:ipc:close', this._onClose);
    }

    private _toggleJobList() {
        this._popupVisible = !this._popupVisible;
    }

    private _getListClass(): string {
        return this._popupVisible ? 'show' : 'hide';
    }

    private _getButtonClass(): string {
        return this._popupVisible ? 'fa-window-close' : 'fa-chart-bar';
    }

    private _getStatusClass(status: string): string {
        switch (status) {
            case 'queued': return 'fa-clock buttonQueued';
            case 'downloading': return 'fa-exchange-alt buttonDownloading';
            case 'completed': return 'fa-check button buttonCompleted';
            case 'failed': return 'fa-exclamation-triangle button buttonFailed';
            default: return '';
        }
    }

    private _getErrorTitle(errors: any[]): string {
        return (errors && errors.length > 0 ? 'Click to re-download\n' : '') + errors.map(e => e.toString()).join('\n');
    }

    private _restartDownload(job: any) {
        if (job.status === 'failed' || job.status === 'completed') {
            (window as any).Engine.DownloadManager.addDownload(job.chapter);
        }
    }

    private _onDownloadStatusUpdated = (e: CustomEvent) => {
        const job = e.detail;
        const index = this._jobList.indexOf(job);
        if (index > -1) {
            if (job.status === 'completed') {
                this._jobList = this._jobList.filter((_, i) => i !== index);
            } else {
                // Trigger reactivity for the updated job
                this._jobList = [...this._jobList];
            }
        } else {
            // Remove a failed job that matches (same chapter)
            const position = this._jobList.findIndex(item => job.isSame(item));
            let newList = this._jobList;
            if (position > -1 && this._jobList[position].status === 'failed') {
                newList = newList.filter((_, i) => i !== position);
            }
            if (job.status === 'queued' || job.status === 'downloading') {
                newList = [...newList, job];
            }
            this._jobList = newList;
        }
    };

    private _onClose = async () => {
        const index = this._jobList.findIndex(job => job.status === 'queued' || job.status === 'downloading');
        if (index < 0 || await confirm('Downloads are still in progress.\nClose application anyway?')) {
            (window as any).window.hakunekoAPI.app.quit();
        }
    };

    render() {
        return html`
            <div class="list ${this._getListClass()}">
                <table cellpadding="0">
                    ${this._jobList.map(item => html`
                        <tr title="${item.labels.connector}\n${item.labels.manga}\n${item.labels.chapter}">
                            <td class="fa-fw">
                                <i class="fas ${this._getStatusClass(item.status)} fa-fw"
                                   title="${this._getErrorTitle(item.errors)}"
                                   @click=${() => this._restartDownload(item)}></i>
                            </td>
                            <td class="cell">${item.labels.connector}</td>
                            <td class="cell">${item.labels.manga}</td>
                            <td class="cell">${item.labels.chapter}</td>
                            <td class="progress" style="background: linear-gradient(90deg, var(--job-list-progress-color) ${item.progress}%, var(--job-list-progress-background-color) 0%);"></td>
                        </tr>
                    `)}
                </table>
            </div>
            <div class="bar">
                <div class="expander">
                    <i class="fas ${this._getButtonClass()} button" title="Toggle download list" @click=${this._toggleJobList}></i>
                </div>
                <div class="status">${this._jobList.length} Download(s)</div>
            </div>
        `;
    }
}
