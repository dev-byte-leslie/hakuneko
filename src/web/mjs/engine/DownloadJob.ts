import type Chapter from './Chapter';
import type { EntityStatus, HLSEpisode, VideoEpisode } from './types';

const events = {
    updated: 'updated'
} as const;

const statusDefinitions: Record<string, EntityStatus> = {
    unavailable: 'unavailable', // chapter/manga that cannot be downloaded
    offline: 'offline', // chapter/manga that cannot be downloaded, but exist in manga directory
    available: 'available', // chapter/manga that can be added to the download list
    queued: 'queued', // chapter/manga that is queued for download to the users device
    downloading: 'downloading', // chapter/manga that is currently downloaded to the users device
    completed: 'completed', // chapter/manga that already exist on the users device
    failed: 'failed' // chapter/manga that failed to be downloaded
};

/** Shape of a single HLS segment packet used during playlist download */
type HLSPacket = { needle: string; source: URL; target: string };

export default class DownloadJob extends EventTarget {

    id: symbol;
    chapter: Chapter;
    labels: { connector: string; manga: string; chapter: string };
    requestOptions: RequestInit;
    chunkSize: number;
    throttle: number;
    status: EntityStatus | undefined;
    progress: number;
    errors: Error[];

    // TODO: use dependency injection instead of globals for Engine.Storage, Enums
    constructor( chapter: Chapter ) {
        super();
        this.id = Symbol();
        this.chapter = chapter;
        this.labels = {
            connector: chapter.manga.connector.label,
            manga: chapter.manga.title,
            chapter: chapter.title
        };
        this.requestOptions = chapter.manga.connector.requestOptions || {};
        // TODO: initialize requestOptions.headers = new Headers() if not set
        this.chunkSize = 8388608; // 8 MB
        this.throttle = chapter.manga.connector.config && chapter.manga.connector.config['throttle'] ? chapter.manga.connector.config['throttle'].value as number : 0;
        this.status = undefined;
        this.progress = 0;
        this.errors = [];
    }

    /**
     *
     */
    isSame( job: DownloadJob ): boolean {
        // comparing chapter objects works, because chapters for each manga are cached
        return this.chapter === job.chapter;
        //return ( this.chapter.id === job.chapter.id && this.chapter.manga.id === job.chapter.manga.id && this.chapter.manga.connector.id === job.chapter.manga.connector.id );
    }

    /**
     * Apply a new status for the job and publish the corresponding event.
     */
    setStatus( status: EntityStatus ): void {
        if( status !== this.status ) {
            this.status = status;
            this.chapter.setStatus( status );
            this.chapter.manga.updateStatus();
            this.dispatchEvent( new CustomEvent( events.updated, { detail: this } ) );
        }
    }

    /**
     * Apply a new status for the job and publish the corresponding event.
     */
    setProgress( progress: number ): void {
        if( progress !== this.progress ) {
            this.progress = progress;
            this.dispatchEvent( new CustomEvent( events.updated, { detail: this } ) );
        }
    }

    /**
     *
     */
    downloadPages( directory: string, callback: () => void ): void {
        this.setStatus( statusDefinitions.downloading );
        this.chapter.getPages( ( error, data ) => {
            if( !error && data ) {
                // manga pages
                if( data instanceof Array ) {
                    this._downloadPages( data, directory, callback );
                    return;
                }
                // anime playlist
                if( (data as HLSEpisode).mirrors instanceof Array ) {
                    this._downloadPlaylistHLS( data as HLSEpisode, directory, callback );
                    return;
                }
                // anime stream
                if( typeof (data as VideoEpisode).video === 'string' ) {
                    this._downloadVideoStream( data as VideoEpisode, directory, callback );
                    return;
                }
            }

            if( error ) {
                this.errors.push( error );
            } else {
                this.errors.push( new Error( 'Page list is empty' ) );
            }
            this.setStatus( statusDefinitions.failed );
            this.setProgress( 100 );
            callback();
        } );
    }

    async _wait(delay: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, delay));
    }

    async _downloadPages(pages: string[], directory: string, callback: () => void): Promise<void> {
        try {
            const content = Engine.Settings.useSequentialMediaDownloads.value ? await this._downloadPagesSequential(pages) : await this._downloadPagesConcurrent(pages);
            await Engine.Storage.saveChapterPages(this.chapter, content);
            this.setProgress(100);
            this.setStatus(statusDefinitions.completed);
            callback();
        } catch(error) {
            this.errors.push(error as Error);
            console.error(error, pages);
            this.setProgress(100);
            this.setStatus(statusDefinitions.failed);
            callback();
        }
    }

    async _downloadPagesSequential(pages: string[]): Promise<Blob[]> {
        const result: Blob[] = [];
        for(let page of pages) {
            await this._wait(this.throttle);
            const response = await fetch(page, this.requestOptions);
            if(response.status !== 200 && !Engine.Settings.ignoreErrorOnDownload.value) {
                throw new Error(`Page " ${page}" returned status: ${response.status} - ${response.statusText}`);
            }
            result.push(await response.blob());
            this.setProgress(this.progress + (pages.length ? 100/pages.length : 0));
        }
        return result;
    }

    async _downloadPagesConcurrent(pages: string[]): Promise<Blob[]> {
        const throttle = this.throttle || 50;
        // get data for all pages of chapter
        let promises = pages.map(async (page, index) => {
            await this._wait(index * throttle);
            const response = await fetch(page, this.requestOptions);
            if(response.status !== 200 && !Engine.Settings.ignoreErrorOnDownload.value) {
                throw new Error(`Page " ${page}" returned status: ${response.status} - ${response.statusText}`);
            }
            this.setProgress(this.progress + (pages.length ? 100/pages.length : 0));
            return response.blob();
        });
        /*
         * TODO: abort/block all other page downloads that are still running for this job ...
         * https://stackoverflow.com/questions/31424561/wait-until-all-es6-promises-complete-even-rejected-promises
         */
        return Promise.all(promises);
    }

    /**
     *
     */
    _downloadPlaylistHLS( episode: HLSEpisode, directory: string, callback: () => void ): void {
        let ffmpeg: { command: string[]; inputs: string[]; maps: string[]; metas: string[] } = {
            command: ['ffmpeg', '-loglevel', 'error', '-allowed_extensions', 'ALL', '-protocol_whitelist', 'concat,file,http,https,tcp,tls,crypto'],
            inputs: [],
            maps: ['-map', '0:v', '-map', '0:a'],
            metas: []
        };
        let playlistURL: string | undefined = undefined;
        let promises = episode.mirrors.map( mirror => {
            let request = new Request(mirror, this.requestOptions);
            if(episode.referer) {
                request.headers.set('x-referer', episode.referer);
            }
            return fetch(request)
                .then( response => {
                    if( response.status !== 200 ) {
                        throw new Error( 'Playlist "' + mirror + '" returned status: ' + response.status + ' - ' + response.statusText );
                    }
                    return response.text();
                } )
            // swap resolve and reject so we can use Promise.all to get the first "resolved" promise
                .then( data => {
                    playlistURL = playlistURL || mirror;
                    return Promise.reject( data );
                }, error => {
                    return Promise.resolve( error );
                } );
        } );
        Promise.all( promises )
        // swap the rejected promise back to its initial resolved state
            .catch( data => Promise.resolve( data ) )
            .then( (playlist: string) => {
                const matchStrings = [...new Set(playlist.match(/^[^\s#].+$/gm))] as string[];
                let packets: HLSPacket[] = matchStrings.map((packet: string, index: number) => {
                    return {
                        needle: packet,
                        source: new URL(packet, playlistURL),
                        target: ('00000' + index).slice(-5) + '.ts'
                    };
                });
                let key = playlist.match(/URI\s*=\s*"(.*?)"/);
                if(key) {
                    packets.push({
                        needle: key[1],
                        source: new URL(key[1], playlistURL),
                        target: 'media.key'
                    });
                }
                // modify playlist to use local files
                for(let packet of packets) {
                    //playlist = playlist.replace(new RegExp(packet.needle, 'g'), packet.target);
                    playlist = playlist.split(packet.needle).join(packet.target);
                }
                ffmpeg.inputs.push( '-i', '"media.m3u8"' );
                return Engine.Storage.saveChapterFileM3U8( this.chapter, { name: 'media.m3u8', data: playlist } )
                    .then( () => {
                        return Promise.resolve( packets );
                    } );
            } )
        // download all packets
            .then( (packets: HLSPacket[]) => {
                const packetDownload = async (packet: HLSPacket, delay: number): Promise<void> => {
                    await this._wait(delay);
                    const request = new Request(packet.source, this.requestOptions);
                    if(episode.referer) {
                        request.headers.set('x-referer', episode.referer);
                    }
                    const response = await fetch(request);
                    if(response.status !== 200) {
                        throw new Error(`Packet "${packet.target}" returned status: '${response.status}' - '${response.statusText}`);
                    }
                    const data = await response.arrayBuffer();
                    await Engine.Storage.saveChapterFileM3U8(this.chapter, { name: packet.target, data: new Uint8Array(data) });
                    this.setProgress(this.progress + 100/packets.length);
                };

                if(Engine.Settings.useSequentialMediaDownloads.value ) {
                    return (async () => {
                        for(let packet of packets) {
                            await packetDownload(packet, this.throttle);
                        }
                    })();
                } else {
                    const promises = packets.map(async (packet, index) => {
                        const throttle = this.throttle || 250;
                        return packetDownload(packet, index * throttle);
                    });
                    return Promise.all(promises).then(() => {});
                }
            })
        // download all subtitles
            .then( () => {
                let promises = episode.subtitles.map( ( subtitle, index ) => {
                    let file = 'media.' + subtitle.locale + '.' + subtitle.format;
                    ffmpeg.inputs.push( '-i', `"${file}"` );
                    ffmpeg.maps.push( '-map', index + 1 + ':s' );
                    ffmpeg.metas.push( '-metadata:s:s:' + index, 'language=' + subtitle.locale );
                    // make english the default subtitle
                    if( subtitle.locale.toLowerCase() === 'en-us' ) {
                        ffmpeg.metas.push( '-disposition:s:' + index, 'default' );
                    }
                    return this._wait( index * 50 )
                        .then( () => {
                            let request = new Request(subtitle.url, this.requestOptions);
                            if(episode.referer) {
                                request.headers.set('x-referer', episode.referer);
                            }
                            return fetch(request);
                        } )
                        .then( response => {
                            if( response.status !== 200 ) {
                                throw new Error( 'Subtitle "' + subtitle.url + '" returned status: ' + response.status + ' - ' + response.statusText );
                            }
                            return response.text();
                        } )
                        .then( data => {
                            return Engine.Storage.saveChapterFileM3U8( this.chapter, { name: file, data: data } );
                        } );
                } );
                return Promise.all( promises );
            } )
        // multiplex
            .then( () => {
            // compose ffmpeg command for multiplexing
                let args = ffmpeg.command;
                args = args.concat( ffmpeg.inputs );
                args = args.concat( ffmpeg.maps );
                args = args.concat( ffmpeg.metas );
                args = args.concat( [ '-c', 'copy' ] );
                // multiplex media
                return Engine.Storage.muxPlaylistM3U8( this.chapter, args.join( ' ' ) );
            } )
        // finalize
            .then( () => {
                this.setProgress( 100 );
                this.setStatus( statusDefinitions.completed );
                callback();
            } )
        // process error
            .catch( error => {
            /*
             * TODO: abort/block all other packet downloads that are still running for this job ...
             * https://stackoverflow.com/questions/31424561/wait-until-all-es6-promises-complete-even-rejected-promises
             */
                this.errors.push( error );
                console.error( error, episode );
                this.setProgress( 100 );
                this.setStatus( statusDefinitions.failed );
                callback();
            } );
    }

    // TODO: read from the stream directly to the file instead of processing chunks
    // => https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream | response.body.pipe(...)
    _downloadVideoStream( episode: VideoEpisode, directory: string, callback: () => void ): void {
        let basename = Date.now(); // episode.video.split( '/' ).pop();
        this.requestOptions['method'] = 'HEAD';
        let request = new Request( episode.video, this.requestOptions );
        request.headers.set( 'x-referer', episode.referer || episode.video );
        this.requestOptions['method'] = 'GET';
        fetch( request )
            .then( response => {
                if( response.status !== 200 ) {
                    throw new Error( 'Video "' + episode.video + '" returned status: ' + response.status + ' - ' + response.statusText );
                }
                /*
                 *if( response.headers.get( 'Accept-Ranges' ).toLowerCase() !== 'bytes' ) {
                 *    throw new Error( 'Video "' + episode.video + '" does not accept chunked download!' );
                 *}
                 */
                let size = response.headers.get( 'Content-Length' );
                if( !size ) {
                    throw new Error( 'Failed to determine the size of the video packet!\nThe server may not use "Access-Control-Expose-Headers: Content-Length" for CORS requests.' );
                }
                return Promise.resolve( parseInt( size ) );
            } )
            .then( size => {
                let fn = ( chunks: string[], index?: number, files?: string[] ): Promise<string[]> => {
                    index = index || 0;
                    files = files || [];
                    if( index >= chunks.length ) {
                        return Promise.resolve( files );
                    }
                    return this._wait( 0 )
                        .then( () => {
                            let request = new Request( episode.video, this.requestOptions );
                            request.headers.set( 'Range', 'bytes=' + chunks[index] );
                            request.headers.set( 'x-referer', episode.referer || episode.video );
                            return fetch( request );
                        } )
                        .then( response => {
                            if( response.status !== 200 && response.status !== 206 ) {
                                throw new Error( 'Video stream "' + episode.video + '" returned status: ' + response.status + ' - ' + response.statusText );
                            }
                            return response.arrayBuffer();
                        } )
                        .then( data => {
                            let file = basename + '.part' + ( '00000' + index ).slice( -5 );
                            return Engine.Storage.saveVideoChunkTemp( { name: file, data: new Uint8Array( data ) } );
                        } )
                        .then( tempFile => {
                            this.setProgress( this.progress + 100/chunks.length );
                            return fn( chunks, index + 1, files.concat( tempFile ) );
                        } );
                };
                return fn( this._splitRange( size ) );
            } )
        // multiplex
            .then( tempFiles => Engine.Storage.concatVideoChunks( this.chapter, tempFiles ) )
        // finalize
            .then( () => {
                this.setProgress( 100 );
                this.setStatus( statusDefinitions.completed );
                callback();
            } )
        // process error
            .catch( error => {
                this.errors.push( error );
                console.error( error, episode );
                this.setProgress( 100 );
                this.setStatus( statusDefinitions.failed );
                callback();
            } );
    }

    /**
     *
     */
    _splitRange( size: number ): string[] {
        let part = this.chunkSize;
        let chunkCount = Math.ceil( size / part );
        return [...new Array( chunkCount ).keys()].map(index => {
            let start = index * part;
            let end = start + part - 1;
            return start + '-' + Math.min( end, size - 1 );
        });
    }
}
