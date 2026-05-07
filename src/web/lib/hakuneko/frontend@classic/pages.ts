import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { themeStyles } from './theme.js';

@customElement('hakuneko-pages')
export class HakunekoPages extends LitElement {
    static styles = [themeStyles, css`
        #container {
            width: calc(100% - 2em);
            height: calc(100% - 2em);
            padding: 1em;
            overflow-y: scroll;
            background-image: var(--page-background-image);
            background-size: cover;
            background-repeat: no-repeat;
            background-position: left top;
            user-select: none;
        }
        .thumbnail {
            display: inline-block;
            border: var(--page-thumbnail-border);
            background-color: var(--page-thumbnail-background-color);
            background-position: center;
            background-size: contain;
            background-repeat: no-repeat;
            border-radius: 1em;
            margin: 0.5em;
            width: 16em;
            height: 16em;
            cursor: pointer;
            -webkit-box-shadow: var(--page-thumbnail-shadow);
                    box-shadow: var(--page-thumbnail-shadow);
        }
        .show { display: block; }
        .hide { display: none; }
        .image { display: block; margin-left: auto !important; margin-right: auto !important; }
        #buttons {
            position: fixed; top: 0; right: 0;
            padding-left: 1em; padding-right: 2.0em;
            opacity: 0.05; transition: opacity 0.25s;
            background-color: var(--page-viewer-title-background-color);
            border-bottom-left-radius: 1em;
            box-shadow: var(--page-viewer-title-shadow);
            outline: none;
        }
        #buttons:hover { opacity: 1.0; }
        #buttons:hover > .title { display: inline; }
        .title { display: none; font-weight: bold; font-size: 1.25em; color: var(--page-chapter-title-color); }
        .button { cursor: pointer; margin: 0.25em; }
        #fullscreen { width: 100%; height: 100%; background-color: var(--page-video-background-color); }
        #video { width: 100%; height: 100%; object-fit: contain; outline: none !important; }
        video::-webkit-media-controls-fullscreen-button { display: none; }
        .ASS-container, .ASS-container svg { width: 100% !important; height: 100% !important; }
        .ASS-stage { z-index: 2147483647; }
    `];

    @property({ type: Object }) selectedChapter: any = undefined;
    @property({ type: Number }) selectedMedia = -1;

    @state() private _media: any = undefined;
    @state() private _imageWidth = 75;
    @state() private _imagePadding = 2;

    private _selectedSubtitle = -1;
    private _hls: any = undefined;
    private _ass: any = undefined;
    private _videoResizeObserver: ResizeObserver | undefined;
    private _autoNextChapter = false;

    connectedCallback() {
        super.connectedCallback();
        this._videoResizeObserver = new ResizeObserver(this._onVideoResized);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._videoResizeObserver?.disconnect();
    }

    updated(changedProps: Map<string, unknown>) {
        if (changedProps.has('selectedChapter')) {
            this._onSelectedChapterChanged(this.selectedChapter);
        }
        if (changedProps.has('selectedChapter') || changedProps.has('_media')) {
            if (this._videoViewMode()) {
                requestAnimationFrame(() => this._onVideoElementChanged());
            }
        }
    }

    private _onSelectedChapterChanged(chapter: any) {
        this._media = undefined;
        if (!chapter) return;
        chapter.getPages((error: any, media: any) => {
            if (chapter === this.selectedChapter) {
                this._media = media;
                if (error) alert(error.message);
                if (this.selectedMedia > -1) {
                    this.selectedMedia = 0;
                    this.dispatchEvent(new CustomEvent('selected-media-changed', { detail: 0, bubbles: true, composed: true }));
                }
            }
        });
        this._resetSubtitles(true);
    }

    private _resetSubtitles(clearTracks: boolean) {
        this._selectedSubtitle = -1;
        if (this._ass) {
            this._ass.destroy();
            this._ass = undefined;
        }
        if (clearTracks) {
            const element = this.shadowRoot?.querySelector('#video') as HTMLVideoElement;
            if (element) {
                const tracks = element.textTracks;
                let i = 0;
                while (tracks[i]) {
                    tracks[i].mode = 'disabled';
                    i++;
                }
                tracks.onchange = this._onSelectedSubtitleChanged;
            }
        }
    }

    private _onSelectedSubtitleChanged = (event: Event) => {
        setTimeout(() => {
            const video = this.shadowRoot?.querySelector('#video') as HTMLVideoElement;
            const subtitle = [...(event.target as TextTrackList)].findIndex(track => track.mode === 'showing');
            if (this._selectedSubtitle !== subtitle) {
                this._resetSubtitles(false);
                this._selectedSubtitle = subtitle;
                if (subtitle > -1 && this._media?.subtitles) {
                    const sub = this._media.subtitles[this._selectedSubtitle];
                    if (sub.content) {
                        this._ass = new (window as any).ASS(sub.content, video);
                    } else {
                        fetch(sub.url)
                            .then(r => { if (r.status !== 200) throw new Error(); return r.text(); })
                            .then(data => { sub.content = data; this._ass = new (window as any).ASS(sub.content, video); })
                            .catch(err => console.warn(err, sub.url));
                    }
                }
            }
        }, 250);
    };

    private _showViewer(index: number) {
        this.selectedMedia = index;
        this.dispatchEvent(new CustomEvent('selected-media-changed', { detail: index, bubbles: true, composed: true }));
    }

    private _hideViewer() {
        this.selectedMedia = -1;
        this.dispatchEvent(new CustomEvent('selected-media-changed', { detail: -1, bubbles: true, composed: true }));
        (window as any).Engine.ChaptermarkManager.addChaptermark(this.selectedChapter);
    }

    private _getContainerColor(): string {
        return this.selectedMedia > -1 ? 'var(--page-reader-background-color)' : 'var(--page-control-background-color)';
    }

    private _thumbnailViewMode(): boolean {
        return !!(this._media && this._media.length && this.selectedMedia < 0);
    }

    private _pageViewMode(): boolean {
        if (this._media instanceof Array) {
            setTimeout(() => {
                const container = this.shadowRoot?.querySelector('#container') as HTMLElement;
                if (!container) return;
                if (this.selectedMedia > -1) {
                    const page = container.querySelector(`#page_${this.selectedMedia}`) as HTMLElement;
                    if (page) container.scrollTop = page.offsetTop;
                    (container.querySelector('#buttons') as HTMLElement)?.focus();
                } else {
                    container.scrollTop = 0;
                }
            }, 0);
        }
        return this._media instanceof Array && this.selectedMedia > -1;
    }

    private _videoViewMode(): boolean {
        return !!(this._media && (this._media.mirrors instanceof Array || typeof this._media.video === 'string'));
    }

    private _onVideoElementChanged() {
        this._resetSubtitles(true);
        const element = this.shadowRoot?.querySelector('#video') as HTMLVideoElement;
        if (element) {
            element.pause();
            if (this._hls) this._hls.destroy();
            element.src = '';
            if (this._media?.mirrors) {
                this._hls = new (window as any).Hls();
                this._hls.attachMedia(element);
                this._hls.loadSource(this._media.mirrors[0]);
            }
            if (this._media?.video) {
                element.src = this._media.video;
            }
            this._videoResizeObserver?.observe(element);
        }
    }

    private _onVideoResized = () => {
        if (this._ass) this._ass.resize();
    };

    private _toggleFullscreen(event: Event) {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            (this.shadowRoot?.querySelector('#fullscreen') as HTMLElement)?.requestFullscreen();
        }
        event.preventDefault();
    }

    private _requestChapterUp() {
        this._autoNextChapter = false;
        window.dispatchEvent(new CustomEvent('chapterUp', { detail: this.selectedChapter }));
    }

    private _requestChapterDown() {
        window.dispatchEvent(new CustomEvent('chapterDown', { detail: this.selectedChapter }));
    }

    private _onKeyDown(event: KeyboardEvent) {
        const container = this.shadowRoot?.querySelector('#container') as HTMLElement;
        switch (true) {
            case event.code === 'ArrowUp' && !event.ctrlKey:
                this._scrollSmoothly(container, -64); break;
            case event.code === 'ArrowDown' && !event.ctrlKey:
                this._scrollSmoothly(container, 64); break;
            case event.code === 'PageUp' && !event.ctrlKey:
                container?.scrollBy({ top: -window.innerHeight * 0.95, behavior: 'smooth' }); break;
            case event.code === 'PageDown' && !event.ctrlKey:
                container?.scrollBy({ top: window.innerHeight * 0.95, behavior: 'smooth' }); break;
            case event.code === 'ArrowRight' && !event.ctrlKey:
                this._requestChapterUp(); break;
            case event.code === 'ArrowLeft' && !event.ctrlKey:
                this._requestChapterDown(); break;
            case event.key === '*' && !event.ctrlKey:
                this._imageWidth = 100; break;
            case event.key === '/' && !event.ctrlKey:
                this._imageWidth = 75; break;
            case event.key === '+' && !event.ctrlKey:
                this._zoomIn(); break;
            case event.key === '-' && !event.ctrlKey:
                this._zoomOut(); break;
            case event.key === '+' && event.ctrlKey:
                this._setImagePadding(this._imagePadding + 1); break;
            case event.key === '-' && event.ctrlKey:
                this._setImagePadding(this._imagePadding - 1); break;
            case event.code === 'Escape' && !event.ctrlKey:
                this._hideViewer(); break;
            case event.code === 'Space' && !event.ctrlKey:
                this._scrollMagic(window.innerHeight * 0.80); break;
        }
    }

    private _setImagePadding(padding: number) {
        const container = this.shadowRoot?.querySelector('#container') as HTMLElement;
        const offset = container ? container.scrollTop / container.scrollHeight : 0;
        this._imagePadding = Math.max(0, padding);
        if (container) container.scrollTop = offset * container.scrollHeight;
    }

    private _zoomIn() {
        const scale = this._imageWidth + 15;
        this._zoom(scale > 400 ? 400 : scale);
    }

    private _zoomOut() {
        const scale = this._imageWidth - 15;
        this._zoom(scale < 25 ? 25 : scale);
    }

    private _zoom(scale: number) {
        const container = this.shadowRoot?.querySelector('#container') as HTMLElement;
        const prevHeight = container?.scrollHeight ?? 0;
        const prevOffset = container?.scrollTop ?? 0;
        this._imageWidth = scale;
        if (container) container.scrollTop = prevOffset * container.scrollHeight / prevHeight;
    }

    private _scrollMagic(defaultDistance: number) {
        const container = this.shadowRoot?.querySelector('#container') as HTMLElement;
        const images = container?.querySelectorAll('.image') ?? [];
        if (images.length === 0) return;

        const lastImage = images[images.length - 1];
        if (lastImage.getBoundingClientRect().bottom - window.innerHeight < 1) {
            if (this._autoNextChapter) { this._requestChapterUp(); return; }
            this._autoNextChapter = true;
            setTimeout(() => { this._autoNextChapter = false; }, 4000);
            return;
        }

        const targetScrollImages = [...images].filter(img => {
            const rect = img.getBoundingClientRect();
            return rect.top <= window.innerHeight && rect.bottom > 1;
        });
        const targetScrollImage = targetScrollImages[targetScrollImages.length - 1] || images[0];

        if (targetScrollImage.getBoundingClientRect().top > 1) {
            targetScrollImage.scrollIntoView({ behavior: 'smooth' });
        } else if (window.innerHeight + 1 < targetScrollImage.getBoundingClientRect().bottom) {
            container?.scrollBy({
                top: Math.min(defaultDistance, targetScrollImage.getBoundingClientRect().bottom - window.innerHeight),
                behavior: 'smooth'
            });
        } else {
            targetScrollImage.nextElementSibling?.scrollIntoView({ behavior: 'smooth' });
        }
    }

    private _scrollSmoothly(element: HTMLElement, distance: number) {
        const speed = Math.abs(Math.floor(distance / 10));
        const end = Math.abs(distance % speed);
        const doTinyScroll = () => {
            if (Math.abs(distance) === end) return;
            if (distance > 0) {
                element.scrollBy({ top: speed });
                distance -= speed;
            } else {
                element.scrollBy({ top: -speed });
                distance += speed;
            }
            window.requestAnimationFrame(doTinyScroll);
        };
        window.requestAnimationFrame(doTinyScroll);
    }

    private _escapeBackgroundURI(uri: string): string {
        return uri.replace(/'/g, "\\'");
    }

    private _imgError(img: HTMLImageElement) {
        if (!Object.prototype.hasOwnProperty.call(img, 'retryCount')) {
            (img as any).retryCount = 0;
        }
        if ((img as any).retryCount < 3) {
            setTimeout(() => {
                img.src += '?' + +new Date();
                (img as any).retryCount += 1;
            }, 1000);
        }
    }

    render() {
        return html`
            <div id="container" style="background-color: ${this._getContainerColor()};">
                ${this._thumbnailViewMode() ? html`
                    ${(this._media as string[]).map((item, index) => html`
                        <div class="thumbnail"
                             style="background-image: url('${this._escapeBackgroundURI(item)}');"
                             @click=${() => this._showViewer(index)}
                             title="Page ${index}"></div>
                    `)}
                ` : nothing}

                ${this._pageViewMode() ? html`
                    <div id="buttons" tabindex="0" @blur=${(e: FocusEvent) => (e.target as HTMLElement).focus()} @keydown=${this._onKeyDown}>
                        <span class="title">${this.selectedChapter?.title}</span>
                        <i class="fas fa-chevron-left fa-2x button" title="Previous Chapter (ArrowLeft)" @click=${this._requestChapterDown}></i>
                        <i class="fas fa-chevron-right fa-2x button" title="Next Chapter (ArrowRight)" @click=${this._requestChapterUp}></i>
                        &nbsp;
                        <i class="fas fa-compress fa-2x button" title="Decrease spacing between images (CTRL ➖)" @click=${() => this._setImagePadding(this._imagePadding - 1)}></i>
                        <i class="fas fa-expand fa-2x button" title="Increase spacing between images (CTRL ➕)" @click=${() => this._setImagePadding(this._imagePadding + 1)}></i>
                        &nbsp;
                        <i class="fas fa-search-plus fa-2x button" title="Zoom In (➕)" @click=${this._zoomIn}></i>
                        <i class="fas fa-search-minus fa-2x button" title="Zoom Out (➖)" @click=${this._zoomOut}></i>
                        &nbsp;
                        <i class="fas fa-compress-arrows-alt fa-2x button" title="Default Image Width (*)" @click=${() => { this._imageWidth = 75; }}></i>
                        <i class="fas fa-expand-arrows-alt fa-2x button" title="Zoom to Fit Window (/)" @click=${() => { this._imageWidth = 100; }}></i>
                        &nbsp;
                        <i>Image Width: ${this._imageWidth}%</i>
                        <i class="fas fa-angle-double-down fa-2x button" title="Magic Scroll Down (SPACEBAR)" @click=${() => this._scrollMagic(window.innerHeight * 0.80)}></i>
                        <i class="fas fa-times-circle fa-2x button" title="Close (ESC)" @click=${this._hideViewer}></i>
                    </div>
                    ${(this._media as string[]).map((item, index) => html`
                        <img id="page_${index}" class="image"
                             src="${item}"
                             style="width: ${this._imageWidth}%; margin: ${this._imagePadding}em;"
                             @error=${(e: Event) => this._imgError(e.target as HTMLImageElement)}>
                    `)}
                ` : nothing}

                ${this._videoViewMode() ? html`
                    <div id="fullscreen" @dblclick=${this._toggleFullscreen}>
                        <video id="video" controls disablepictureinpicture controlslist="nodownload nofullscreen">
                            ${this._media?.subtitles?.map((sub: any) => html`
                                <track kind="subtitles" src="data:text/vtt,WEBVTT" label="${sub.locale}" srclang="${sub.locale}" />
                            `) ?? nothing}
                        </video>
                    </div>
                ` : nothing}
            </div>
        `;
    }

}
