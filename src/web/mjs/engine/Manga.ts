import Chapter from './Chapter';
import type { EntityStatus, FormatRegex } from './types';

const events = {
    updated: 'updated'
} as const;

const extensions = {
    m3u8: '.m3u8',
    mkv:  '.mkv',
    mp4:  '.mp4'
} as const;

const statusDefinitions: Record<string, EntityStatus> = {
    offline: 'offline', // chapter/manga that cannot be downloaded, but exist in manga directory
    available: 'available', // chapter/manga that can be added to the download list
    completed: 'completed', // chapter/manga that already exist on the users device
};

/** Minimal connector shape used by Manga (avoids importing full Connector to prevent circular deps) */
interface MangaConnector {
    id: string | symbol;
    label: string;
    existingMangas: Record<string, boolean>;
    initialize(): Promise<void>;
    _getChapterList(manga: Manga, callback: (error: Error | null, chapters: Array<{ id: string; title: string; language: string }>) => void): void;
    _getPageList(manga: Manga, chapter: Chapter, callback: (error: Error | null, pages: string[] | object) => void): void;
    getFormatRegex(): FormatRegex;
}

export default class Manga extends EventTarget {

    connector: MangaConnector;
    id: string;
    title: string;
    status: EntityStatus | undefined;
    chapterCache: Chapter[];
    existingChapters: Record<string, boolean>;

    // TODO: use dependency injection instead of globals for Engine.Settings, Engine.Storage, all Enums
    constructor( connector: MangaConnector, id: string, title: string, status?: EntityStatus ) {
        super();
        this.connector = connector;
        this.id = id;
        this.title = title;
        this.status = status;
        this.chapterCache = [];
        this.existingChapters = {} as Record<string, boolean>;

        if( !this.status ) {
            this.updateStatus();
        }
    }

    /**
     *
     */
    setStatus( status: EntityStatus ): void {
        if( this.status !== status ) {
            this.status = status;
            this.dispatchEvent( new CustomEvent( events.updated, { detail: this } ) );
            document.dispatchEvent( new CustomEvent( EventListener.onMangaStatusChanged, { detail: this } ) );
        }
    }

    /**
     *
     */
    updateStatus(): void {
        // look in the connector's list of existing mangas (found in directory), if this manga already exist
        if( !this.connector || !this.connector.existingMangas ) {
            return;
        }
        const sanatizedTitle = Engine.Storage.sanatizePath ( this.title );
        if( this.connector.existingMangas[sanatizedTitle] ) {
            this.setStatus( statusDefinitions.completed );
        } else {
            this.setStatus( statusDefinitions.available );
        }
    }

    isChapterFileExisting( chapter: Chapter ): boolean {
        if( !this.existingChapters ) {
            return false;
        }
        return !!(this.existingChapters[chapter.file.full]
            || this.existingChapters[chapter.file.name + extensions.mp4]
            || this.existingChapters[chapter.file.name + extensions.mkv]
            || this.existingChapters[chapter.file.name + extensions.m3u8]);
    }

    isChapterFileCached( fileName: string ): boolean {
        // use !! to convert result to bool
        return !!this.chapterCache.find( chapter => {
            return fileName === chapter.file.full
                || fileName === chapter.file.name + extensions.mp4
                || fileName === chapter.file.name + extensions.mkv
                || fileName === chapter.file.name + extensions.m3u8;
        } );
    }

    /**
     * Get all chapters for the manga.
     * Callback will be executed after completion and provided with a reference to the chapter list (empty on error).
     */
    getChapters( callback: (error: Error | null, chapters: Chapter[]) => void ): void {
        // find all chapter titles (sanitized) that are found in the directory for this manga
        Engine.Storage.getExistingChapterTitles( this )
            .catch( () => {
                // Ignore chapter file reading errors (e.g. manga directory not exist yet)
                return Promise.resolve( {} as Record<string, boolean> );
            } )
            .then( (existingChapterTitles: Record<string, boolean>) => {
                this.existingChapters = existingChapterTitles;
                // check if chapter list is cached and has access to online chapters
                const onlineChapters = (chapter: Chapter) => chapter.status === statusDefinitions.completed || chapter.status === statusDefinitions.available;
                return this.chapterCache && this.chapterCache.some(onlineChapters) ? this._getUpdatedChaptersFromCache() : this._getUpdatedChaptersFromWebsite();
            } )
            .then( () => {
                for( const existingChapterTitle in this.existingChapters ) {
                    if( !this.isChapterFileCached( existingChapterTitle ) ) {
                        this.chapterCache.push( new Chapter( this, existingChapterTitle, existingChapterTitle, undefined as unknown as string, statusDefinitions.offline ) );
                    }
                }
                callback( null, this.chapterCache );
            } )
            .catch( (error: Error) => {
                // TODO: remove log ... ?
                console.warn( 'getChapters', error );
                return callback( error, this.chapterCache );
            } );
    }

    /**
     *
     */
    _getUpdatedChaptersFromCache(): Promise<Chapter[]> {
        if( this.chapterCache ) {
            this.chapterCache.forEach( chapter => {
                chapter.updateStatus();
            } );
        }
        return Promise.resolve( this.chapterCache );
    }

    /**
     *
     */
    _getUpdatedChaptersFromWebsite(): Promise<Chapter[]> {
        return this.connector.initialize()
            .then( () => {
                return new Promise<Array<{ id: string; title: string; language: string }>>( ( resolve, reject ) => {
                    this.connector._getChapterList( this, ( error: Error | null, chapters: Array<{ id: string; title: string; language: string }> ) => {
                        if( error ) {
                            reject( error );
                        } else {
                            resolve( chapters );
                        }
                    } );
                } );
            } )
            .then( (chapters: Array<{ id: string; title: string; language: string }>) => {
                const chapterFormat = Engine.Settings.chapterTitleFormat.value;
                // de-serialize chapters into objects
                this.chapterCache = chapters.map( chapter => {
                    return new Chapter( this, chapter.id, this.formatChapterTitle( chapter.title, chapterFormat, this.connector.getFormatRegex() ), chapter.language );
                } );
                return Promise.resolve( this.chapterCache );
            } )
            .catch( (error: Error) => {
                // TODO: remove log ... ?
                console.warn( '_getUpdatedChaptersFromWebsite', error );
                return Promise.resolve( this.chapterCache || [] );
            } );
    }

    /**
     *
     */
    formatChapterTitle( title: string, format: string, formatRegex: FormatRegex ): string {
        //
        let result = format;
        // do not extract volume/chapter
        if( result === '' ) {
            return title;
        }

        let name = title;
        const reVol = formatRegex.volumeRegex;
        const reCh = formatRegex.chapterRegex;

        // extract volume number
        let volume: string | RegExpMatchArray | null = name.match( reVol );
        if( volume && volume.length > 1 ) {
            volume = volume[1] ? volume[1] : '';
        } else {
            volume = '';
        }
        name = name.replace( reVol, '' ).trim();
        volume = this._padNumberPrefixWithZeros( volume as string, 3 );

        // extract chapter number
        let chapter: string | RegExpMatchArray | null = name.match( reCh );
        if( chapter && chapter.length > 1 ) {
            chapter = chapter[1] ? chapter[1] : '';
        } else {
            chapter = '';
        }
        name = name.replace( reCh, '' ).trim();
        chapter = this._padNumberPrefixWithZeros( chapter as string, 4 );

        // apply extracted parts to format from user settings
        result = result.replace( /%VOL%/i, volume ); // volume number replacement
        result = result.replace( /%CH%/i, chapter ); // chapter number replacement
        result = result.replace( /%T%/i, name ); // clean title replacement
        result = result.replace( /%O%/i, title ); // original title replacement
        result = result.replace( /%M%/i, this.title ); // original title replacement
        result = result.replace( /%C%/i, this.connector.label ); // original title replacement

        return result;
    }

    /**
     * Prepend the given text with zeros until the
     */
    _padNumberPrefixWithZeros( text: string, digits: number ): string {
        const prefix = text.toString().match( /^\d+/ );
        let count = prefix && prefix.length > 0 ? prefix[0].length : 0;
        count = Math.min( digits, count );
        return '0'.repeat( digits - count ) + text;
    }
}
