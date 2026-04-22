import EbookGenerator from './EbookGenerator';
import Chapter from './Chapter';

const extensions = {
    // chapter format
    img: 'img',
    cbz: '.cbz',
    pdf: '.pdf',
    epub: '.epub',
    // episode format
    m3u8: '.m3u8',
    mkv: '.mkv',
    mp4: '.mp4'
};

const statusDefinitions = {
    offline: 'offline', // chapter/manga that cannot be downloaded, but exist in manga directory
};

export default class Storage {

    // TODO: use dependency injection instead of globals for EbookGenerator
    constructor() {
        this.platform = window.hakunekoAPI.platform;
        this.fs = window.hakunekoAPI.fs; // IPC proxy — HAKU-0032
        this.pathAPI = window.hakunekoAPI.path; // IPC proxy — HAKU-0032
        this.config = null; // set in initialize()
        this.temp = null; // set in initialize()

        this.pdfTargetHeight = 1600;
        this.fileURISubstitutions = {
            rgx: /['#?;]/g,
            map: {
                '\'': '%27',
                '#': '%23',
                '?': '%3F',
                ';': '%3B'
            }
        };
    }

    /** Resolve async paths that cannot be fetched in the constructor. */
    async initialize() {
        const tmpdir = await window.hakunekoAPI.os.tmpdir();
        this.temp = await this.pathAPI.join(tmpdir, 'hakuneko');
        await this._createDirectoryChain(this.temp);
        let userDataPath = await window.hakunekoAPI.app.getPath('userData') || '.';
        this.config = await this.pathAPI.join(userDataPath, 'hakuneko.');
    }

    /**
     * Open the system's file browser and navigate to the given chapter item
     */
    async showFolderContent(chapter) {
        window.hakunekoAPI.shell.showItemInFolder(await this._chapterOutputPath(chapter));
    }

    /**
     * Save the given value for the given key in the persistant storage
     */
    async saveConfig(key, value, indentation) {
        await this.fs.writeFile(this.config + key, JSON.stringify(value, undefined, indentation));
    }

    /**
     * Load the value for the given key from the persistant storage
     */
    async loadConfig(key) {
        const data = await this.fs.readFile(this.config + key, 'utf8');
        return JSON.parse(data);
    }

    /**
     * Convenience function wrapping key value saving for mangas collection
     */
    saveMangaList(connectorID, mangas) {
        return this.saveConfig('mangas.' + connectorID, mangas);
    }

    /**
     * Convenience function wrapping key value loading for mangas collection
     */
    loadMangaList(connectorID) {
        return this.loadConfig('mangas.' + connectorID);
    }

    /**
     * https://github.com/electron/electron/blob/master/docs/api/dialog.md#dialogshowopendialogbrowserwindow-options
     */
    async folderBrowser(rootPath) {
        let result = await window.hakunekoAPI.dialog.showOpenDialog({
            title: 'Download Directory for Mangas',
            //message: 'MESSAGE',
            defaultPath: rootPath,
            properties: ['openDirectory']
        });
        return !result.canceled && result.filePaths.length ? result.filePaths[0] : null;
    }

    /**
     * Return a promise that will be fulfilled if the corresponding path is an existing directory.
     */
    async directoryExist(dirPath) {
        const stats = await this.fs.stat(dirPath);
        if (!stats.isDirectory) {
            throw new Error(`The given path "${dirPath}" is not a directory!`);
        }
    }

    /**
     * Return a promise that will be fulfilled if the corresponding manga directory exist.
     * Due to performance this method must not be used for bulk existing checks.
     */
    async mangaDirectoryExist(manga) {
        return this.directoryExist(await this._mangaOutputPath(manga));
    }

    /**
     * Wrapper for fs.readdir that returns a promise
     */
    _readDirectoryEntries(directory) {
        return this.fs.readdir(directory);
    }

    /**
     * Find all directories/files in the base directory.
     * This key-value map can than be used to look up for existing manga titles (where the key represents the title and the value is always true).
     * Keep in mind that the manga titles in this map are sanitized and may not equal the raw (original) manga title.
     */
    async getExistingMangaTitles(connector) {
        let directory = await this._connectorOutputPath(connector);
        const entries = await this._readDirectoryEntries(directory);
        let titleMap = [];
        entries.forEach(entry => {
            titleMap[entry] = true;
        });
        return titleMap;
    }

    /**
     * Find all directories/files in the manga directory.
     * This list can than be used to look for existing chapter titles.
     * Keep in mind that the chapter titles in this list are sanitized and may not equal the raw (original) chapter title.
     */
    async getExistingChapterTitles(manga) {
        let directory = await this._mangaOutputPath(manga);
        const entries = await this._readDirectoryEntries(directory);
        let titleMap = [];
        entries.forEach(entry => {
            titleMap[entry] = true;
        });
        return titleMap;
    }

    /**
     * ...
     * Callback will be executed after completion and provided with an array of errors (or an empty array when no errors occured)
     * and a reference to the page list (undefined on error).
     */
    async loadChapterPages(chapter) {
        let chapterPath = chapter instanceof Chapter ? await this._chapterOutputPath(chapter) : chapter;
        if (typeof chapterPath !== 'string') {
            return Promise.reject(new Error('Invalid parameter "chapter", must be <String> or <Chapter> type!'));
        }
        if (chapterPath.endsWith(extensions.m3u8)) {
            return this._loadEpisodeM3U8(chapterPath);
        }
        if (chapterPath.endsWith(extensions.mkv)) {
            return this._loadEpisodeMKV(chapterPath);
        }
        if (chapterPath.endsWith(extensions.mp4)) {
            return this._loadEpisodeMP4(chapterPath);
        }
        if (chapterPath.endsWith(extensions.epub)) {
            return this._loadChapterPagesEPUB(chapterPath);
        }
        if (chapterPath.endsWith(extensions.pdf)) {
            return this._loadChapterPagesPDF(chapterPath);
        }
        if (chapterPath.endsWith(extensions.cbz)) {
            return this._loadChapterPagesCBZ(chapterPath);
        }
        return this._loadChapterPagesFolder(chapterPath);
    }

    /**
     *
     */
    async _loadEpisodeM3U8(directory) {
        const files = await this.fs.readdir(directory);
        let playlist = files.find(file => file.endsWith(extensions.m3u8));
        let subtitles = files.filter(file => file.endsWith('.ass') || file.endsWith('.ssa'));
        let media = {
            mirrors: [await this._makeValidFileURL(directory, playlist)],
            subtitles: await Promise.all(subtitles.sort().map(async subtitle => {
                let parts = subtitle.split('.');
                return {
                    format: parts[parts.length - 1],
                    locale: parts[parts.length - 2],
                    url: await this._makeValidFileURL(directory, subtitle),
                    content: await this.fs.readFile(await this.pathAPI.join(directory, subtitle), 'utf-8')
                };
            }))
        };
        return media;
    }

    /**
     *
     */
    async _loadEpisodeMKV(matroska) {
        // TODO: load subtitles
        let media = {
            video: await this._makeValidFileURL(matroska, ''),
            subtitles: []
        };
        return media;
    }

    /**
     *
     */
    async _loadEpisodeMP4(mpeg4) {
        // TODO: load subtitles
        let media = {
            video: await this._makeValidFileURL(mpeg4, ''),
            subtitles: []
        };
        return media;
    }

    /**
     * Return a promise with the loaded opened zip archive data
     */
    async _openZipArchive(file) {
        const data = await this.fs.readFile(file);
        let zip = new JSZip();
        return zip.loadAsync(data, {});
    }

    /**
     * Extract file from zip entry to temp and returns a promise that
     * will be resolved with the URI to the extracted file.
     */
    async _extractZipEntry(archive, file) {
        const data = await archive.files[file].async('uint8array');
        const name = await this.pathAPI.join(this.temp, await this.pathAPI.basename(file));
        // attach timestamp to force reload of already existing, but overwritten temp files
        let page = encodeURI('hakuneko-local://' + name.replace(/\\/g, '/') + '?ts=' + Date.now());
        await this.fs.writeFile(name, data);
        return page;
    }

    /**
     * Read image data from e-book.
     * Callback will be executed after completion and provided with an array of errors (or an empty array when no errors occured)
     * and a reference to the page list (undefined on error).
     */
    _loadChapterPagesEPUB(ebook) {
        return this._openZipArchive(ebook)
            .then(archive => {
                let promises = Object.keys(archive.files).filter(file => {
                    return /^OEBPS[/\\]img[/\\][^/\\]+$/.test(file);
                }).map(file => {
                    return this._extractZipEntry(archive, file);
                });
                return Promise.all(promises);
            })
            .then(pages => {
                return Promise.resolve(pages.sort());
            });
    }

    /**
     * Read image data from portable document format.
     * Callback will be executed after completion and provided with an array of errors (or an empty array when no errors occured)
     * and a reference to the page list (undefined on error).
     */
    _loadChapterPagesPDF( /*pdf*/) {
        return Promise.reject(new Error('PDF preview not yet supported!'));
    }

    /**
     * Read image data from CBZ archive.
     * Callback will be executed after completion and provided with an array of errors (or an empty array when no errors occured)
     * and a reference to the page list (undefined on error).
     */
    _loadChapterPagesCBZ(cbz) {
        return this._openZipArchive(cbz)
            .then(archive => {
                let promises = Object.keys(archive.files).filter(file => {
                    return /^[^/\\]+$/.test(file);
                }).map(file => {
                    return this._extractZipEntry(archive, file);
                });
                return Promise.all(promises);
            })
            .then(pages => {
                return Promise.resolve(pages.sort());
            });
    }

    /**
     * Read image data from directory.
     * Callback will be executed after completion and provided with an array of errors (or an empty array when no errors occured)
     * and a reference to the page list (undefined on error).
     */
    async _loadChapterPagesFolder(directory) {
        const files = await this.fs.readdir(directory);
        const pages = await Promise.all(files.map(file => this._makeValidFileURL(directory, file)));
        return pages;
    }

    /**
     * HAKU-0004: Generate hakuneko-local:// URLs for displaying downloaded content.
     * Uses custom protocol instead of file:// so webSecurity: true doesn't block cross-origin loads.
     */
    async _makeValidFileURL(directory, file) {
        const joined = await this.pathAPI.join(directory, file);
        return encodeURI('hakuneko-local://' + joined.replace(/\\/g, '/'))
            // some special cases are not covered with encodeURI and needs to be replaced manually
            .replace(this.fileURISubstitutions.rgx, m => this.fileURISubstitutions.map[m]);
    }

    /**
     * Save the pages of the given chapter.
     * The given content is a list of raw data for each corresponding page in the chapter.
     * The storage decides depending on the engine and available settings where the pages will be stored!
     * Callback will be executed after completion and provided with an array of errors (or an empty array when no errors occured).
     *
     * content is an array of blobs
     */
    async saveChapterPages(chapter, content) {
        try {
            let corrected = await Promise.all(content.map(page => this._correctBlobMime(page)));
            let leadingZeroes = String(corrected.length).length;
            let pageData = corrected.map((page, index) => {
                return {
                    name: this._pageFileName(index + 1, page.type, leadingZeroes),
                    type: page.type,
                    data: page
                };
            });

            let promise = undefined;
            let output = await this._chapterOutputPath(chapter);
            if (Engine.Settings.chapterFormat.value === extensions.img) {
                await this._createDirectoryChain(output);
                promise = this._saveChapterPagesFolder(output, pageData)
                    .then(() => this._runPostChapterDownloadCommand(chapter, output));
            }
            if (Engine.Settings.chapterFormat.value === extensions.cbz) {
                await this._createDirectoryChain(await this.pathAPI.dirname(output));
                promise = this._saveChapterPagesCBZ(output, pageData, chapter.manga.title, chapter.title)
                    .then(() => this._runPostChapterDownloadCommand(chapter, output));
            }
            if (Engine.Settings.chapterFormat.value === extensions.pdf) {
                await this._createDirectoryChain(await this.pathAPI.dirname(output));
                promise = this._saveChapterPagesPDF(output, pageData)
                    .then(() => this._runPostChapterDownloadCommand(chapter, output));
            }
            if (Engine.Settings.chapterFormat.value === extensions.epub) {
                await this._createDirectoryChain(await this.pathAPI.dirname(output));
                promise = this._saveChapterPagesEPUB(output, pageData)
                    .then(() => this._runPostChapterDownloadCommand(chapter, output));
            }
            return promise || Promise.reject(new Error('Unsupported output format: ' + Engine.Settings.chapterFormat.value));
        } catch (error) {
            return Promise.reject(error);
        }
    }

    /**
     * Create and save pages to the given e-book file.
     * Callback will be executed after completion and provided with an array of errors (or an empty array when no errors occured).
     */
    async _saveChapterPagesEPUB(ebook, pageData) {
        let zip = new JSZip();
        zip.file('mimetype', EbookGenerator.createMimetype());
        zip.folder('META-INF').file('container.xml', EbookGenerator.createContainerXML());
        let oebps = zip.folder('OEBPS');
        oebps.folder('css').file('style.css', EbookGenerator.createStyleCSS());
        let img = oebps.folder('img');
        let xhtml = oebps.folder('xhtml');
        let params = [];
        pageData.forEach((page, index) => {
            img.file(page.name, page.data);
            xhtml.file(index + '.xhtml', EbookGenerator.createPageXHTML(page.name));
            params.push({
                img: page.name,
                xhtml: index + '.xhtml',
                mime: page.type
            });
        });
        let uid = btoa(encodeURIComponent(ebook)).replace(/[^a-zA-Z]/g, '');
        const mangaName = await this.pathAPI.basename(await this.pathAPI.dirname(ebook));
        const chapterName = await this.pathAPI.basename(ebook, extensions.epub);
        let title = `${mangaName} ${this.pathAPI.sep} ${chapterName}`;
        oebps.file('content.opf', EbookGenerator.createContentOPF(uid, title, params));
        oebps.file('toc.ncx', EbookGenerator.createTocNCX(uid, '', params));
        return zip.generateAsync({ compression: 'STORE', type: 'uint8array' })
            .then(data => {
                return this._writeFile(ebook, data);
            });
    }

    /**
     * Create and save pages to the given portable document file.
     * Collects PDF chunks in memory (no createWriteStream needed) — HAKU-0032.
     * Callback will be executed after completion and provided with an array of errors (or an empty array when no errors occured).
     */
    async _saveChapterPagesPDF(pdf, pageData) {
        const doc = new PDFDocument({ autoFirstPage: false });
        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        const done = new Promise((resolve, reject) => {
            doc.on('end', resolve);
            doc.on('error', reject);
        });
        for (let page of pageData) {
            await this._addImageToPDF(doc, page);
        }
        doc.end();
        await done;
        // Manual Uint8Array concat — Buffer.concat not available without nodeIntegration
        const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
        const buffer = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
            buffer.set(chunk, offset);
            offset += chunk.length;
        }
        await this.fs.writeFile(pdf, buffer);
    }

    /**
     * Add a single image as PDF page to the given document.
     */
    async _addImageToPDF(pdfDocument, page) {
        let bitmap = await new Promise((resolve, reject) => {
            let img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Failed to load image!'));
            img.src = URL.createObjectURL(page.data);
        });
        let pdfImgType = this._pdfImageType(page);
        let blob;

        // Verify magic bytes match the claimed type before trusting it
        if (pdfImgType) {
            let checkBytes = new Uint8Array(await page.data.slice(0, 4).arrayBuffer());
            let bytesMatchClaim = false;
            if (pdfImgType === 'JPEG' && checkBytes[0] === 0xFF && checkBytes[1] === 0xD8) {
                bytesMatchClaim = true;
            } else if (pdfImgType === 'PNG' && checkBytes[1] === 0x50 && checkBytes[2] === 0x4E && checkBytes[3] === 0x47) {
                bytesMatchClaim = true;
            }
            if (!bytesMatchClaim) {
                pdfImgType = null;
            }
        }

        if (!pdfImgType) {
            pdfImgType = 'JPEG';
            let canvas = document.createElement('canvas');
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            let ctx = canvas.getContext('2d');
            ctx.drawImage(bitmap, 0, 0);
            blob = await new Promise(resolve => {
                canvas.toBlob(data => resolve(data), 'image/jpeg', 0.90);
            });
        } else {
            blob = page.data;
        }

        let bytes = await this._blobToBytes(blob);
        let pdfTargetWidth = this.pdfTargetHeight * bitmap.width / bitmap.height;
        pdfDocument.addPage({ size: [pdfTargetWidth, this.pdfTargetHeight] });
        pdfDocument.image(bytes.buffer, 0, 0, { width: pdfTargetWidth, height: this.pdfTargetHeight });
    }

    /**
     * Create and save pages to the given archive file.
     * Callback will be executed after completion and provided with an array of errors (or an empty array when no errors occured).
     */
    _saveChapterPagesCBZ(archive, pageData, mangaName = '', chapterName = '') {
        let zip = new JSZip();

        let comicFile = Engine.ComicInfoGenerator.createComicInfoXML(mangaName, chapterName, pageData.length);
        zip.file('ComicInfo.xml', comicFile);

        pageData.forEach(page => {
            zip.file(page.name, page.data);
        });
        return zip.generateAsync({ compression: 'STORE', type: 'uint8array' })
            .then(data => {
                return this._writeFile(archive, data);
            });
    }

    /**
     * Save pages to the given directory.
     * Callback will be executed after completion and provided with an array of errors (or an empty array when no errors occured).
     */
    async _saveChapterPagesFolder(directory, pageData) {
        const promises = pageData.map(async page => {
            const data = await this._blobToBytes(page.data);
            return this._writeFile(await this.pathAPI.join(directory, page.name), data);
        });
        return Promise.all(promises);
    }

    /**
     *
     */
    async _runPostChapterDownloadCommand(chapter, chapterPath) {
        let command = Engine.Settings.postChapterDownloadCommand.value; // `echo "%C% | %M% | %O%" > "%PATH%.txt"`;
        if (command) {
            command = command.replace(/%PATH%/g, chapterPath);
            command = command.replace(/%C%/g, chapter.manga.connector.label);
            command = command.replace(/%M%/g, chapter.manga.title);
            command = command.replace(/%O%/g, chapter.title);
            window.hakunekoAPI.exec.postCommand(command, {
                cwd: await this.pathAPI.dirname(chapterPath),
                windowsHide: true
            }).catch(error => {
                console.error(error);
            });
        }
        return Promise.resolve();
    }

    /**
     * Helper function to convert a Blob to an Uint8Array
     * https://github.com/electron/electron/blob/master/docs/api/protocol.md#protocolregisterbufferprotocolscheme-handler-completion
     */
    _blobToBytes(blob) {
        return new Promise((resolve, reject) => {
            let reader = new FileReader();
            reader.onload = event => {
                // NOTE: Uint8Array() seems slightly better than Buffer.from(), but both are blazing fast
                resolve(new Uint8Array(event.target.result));
                //resolve( Buffer.from( event.target.result ) );
            };
            reader.onerror = event => {
                reject(event.target.error);
            };
            reader.readAsArrayBuffer(blob);
        });
    }

    /**
     * Wrap the async write file function into a promise
     */
    _writeFile(filePath, data) {
        return this.fs.writeFile(filePath, data);
    }

    async saveTempFile(name, data) {
        try {
            let file = await this.pathAPI.join(this.temp, this.sanatizePath(name));
            return this._writeFile(file, data);
        } catch (error) {
            return Promise.reject(error);
        }
    }

    async saveVideoChunkTemp(content) {
        return this.saveTempFile(content.name, content.data);
    }

    /**
     * Concatenate video chunk temp files into a single mp4 output file.
     * Rewrites recursive fd-based pattern to sequential async loop — HAKU-0032.
     */
    async concatVideoChunks(chapter, files) {
        let directory = await this._mangaOutputPath(chapter.manga);
        await this._createDirectoryChain(directory);
        let file = await this.pathAPI.join(directory, this.sanatizePath(chapter.title + extensions.mp4));
        let isFirst = true;
        for (const f of files) {
            let data = await this.fs.readFile(f);
            if (isFirst) {
                await this.fs.writeFile(file, data);
                isFirst = false;
            } else {
                await this.fs.appendFile(file, data);
            }
            await this.fs.unlinkSync(f);
        }
    }

    /**
     * Store a file directly in the chapter directory
     */
    async saveChapterFileM3U8(chapter, content) {
        try {
            let file = await this._mangaOutputPath(chapter.manga);
            file = await this.pathAPI.join(file, this.sanatizePath(chapter.title + extensions.m3u8));
            await this._createDirectoryChain(file);
            file = await this.pathAPI.join(file, this.sanatizePath(content.name));
            return this._writeFile(file, content.data);
        } catch (error) {
            return Promise.reject(error);
        }
    }

    /**
     * Multiplex chapter playlist/streams using the given ffmpeg command (without output format & file!).
     * The chapter directory is the working directory, and will be deleted after muxing.
     * The output file will be stored directly in the manga directory.
     */
    async muxPlaylistM3U8(chapter, ffmpeg) {
        let directory = await this._mangaOutputPath(chapter.manga);
        await this._createDirectoryChain(directory);
        let file = await this.pathAPI.join(directory, this.sanatizePath(chapter.title + extensions.mkv));
        directory = await this.pathAPI.join(directory, this.sanatizePath(chapter.title + extensions.m3u8));
        ffmpeg += ` -f matroska -y "${file}"`;
        return window.hakunekoAPI.exec.ffmpeg(ffmpeg, { cwd: directory, windowsHide: true });
    }

    /**
     * Helper function to generate the path where the bookmarks and markers are stored.
     */
    async _getBookmarkOutputPath() {
        return this.pathAPI.join(Engine.Settings.bookmarkDirectory.value, 'hakuneko.');
    }

    /**
     * Helper function to generate the path where the connector mangas are stored.
     */
    async _connectorOutputPath(connector) {
        let output = Engine.Settings.baseDirectory.value;
        // NOTE: Some (system) connectors are defining their own directory
        if (connector.config && connector.config.path) {
            output = connector.config.path.value;
        } else {
            if (Engine.Settings.useSubdirectory.value) {
                output = await this.pathAPI.join(output, this.sanatizePath(connector.label));
            }
        }
        return output;
    }

    /**
     * Helper function to generate the path where the manga chapters are stored.
     */
    async _mangaOutputPath(manga) {
        let output = await this._connectorOutputPath(manga.connector);
        output = await this.pathAPI.join(output, this.sanatizePath(manga.title));
        return output;
    }

    /**
     * Helper function to generate the path where the chapter pages are stored.
     */
    async _chapterOutputPath(chapter) {
        let output = await this._mangaOutputPath(chapter.manga);
        output = await this.pathAPI.join(output, this.sanatizePath(chapter.title));
        if (chapter.status === statusDefinitions.offline) {
            return output;
        }
        // only valid for loading anime episodes, ignored when save pages
        if (await this.fs.exists(output + extensions.m3u8)) {
            return output + extensions.m3u8;
        }
        // only valid for loading anime episodes, ignored when save pages
        if (await this.fs.exists(output + extensions.mkv)) {
            return output + extensions.mkv;
        }
        // only valid for loading anime episodes, ignored when save pages
        if (await this.fs.exists(output + extensions.mp4)) {
            return output + extensions.mp4;
        }
        // used when loading and saving manga chapters
        if (Engine.Settings.chapterFormat.value !== extensions.img) {
            output += Engine.Settings.chapterFormat.value;
        }
        return output;
    }

    /**
     * Helper function to recursively create all non-existing folders of the given path.
     */
    async _createDirectoryChain(dirPath) {
        if (await this.fs.exists(dirPath)) return;
        const parsed = await this.pathAPI.parse(dirPath);
        if (dirPath === parsed.root) return;
        await this._createDirectoryChain(await this.pathAPI.dirname(dirPath));
        await this.fs.mkdir(dirPath);
    }

    /**
     * Create a path without forbidden characters.
    */
    sanatizePath(path) {

        //replace C0 && C1 control codes
        // eslint-disable-next-line no-control-regex
        path = path.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
        if (this.platform.indexOf('win') === 0) {
            // TODO: max. 260 characters per path
            path = path.replace(/[\\/:*?"<>|]/g, '');
        }
        if (this.platform.indexOf('linux') === 0) {
            path = path.replace(/[/]/g, '');
        }
        if (this.platform.indexOf('darwin') === 0) {
            // TODO: max. 32 chars per part
            path = path.replace(/[/:]/g, '');
        }
        return path.replace(/[.\s]+$/g, '').trim();
    }

    /**
     * Helper function to generate an entry name for a page (picture) depending on the given number and mime type
     */
    _pageFileName(number, mimeType, leadingZeroes) {
        let fileName = String(number).padStart(leadingZeroes, 0);
        if (mimeType.indexOf('image/webp') > -1) {
            return fileName + '.webp';
        }
        if (mimeType.indexOf('image/jpeg') > -1) {
            return fileName + '.jpg';
        }
        if (mimeType.indexOf('image/png') > -1) {
            return fileName + '.png';
        }
        if (mimeType.indexOf('image/gif') > -1) {
            return fileName + '.gif';
        }
        if (mimeType.indexOf('image/bmp') > -1) {
            return fileName + '.bmp';
        }
        if (mimeType.indexOf('image/') > -1) {
            return fileName + '.img';
        }
        return fileName + '.bin';
    }

    /**
     * Helper function to get the mime type depending on the file extension of the given file name.
     */
    async _pageFileMime(file) {
        let extension = await this.pathAPI.extname(file);
        if (extension === '.webp') {
            return 'image/webp';
        }
        if (extension === '.jpeg') {
            return 'image/jpeg';
        }
        if (extension === '.jpg') {
            return 'image/jpeg';
        }
        if (extension === '.png') {
            return 'image/png';
        }
        if (extension === '.gif') {
            return 'image/gif';
        }
        if (extension === '.bmp') {
            return 'image/bmp';
        }
        if (extension === '.img') {
            return 'image/';
        }
        return 'application/octet-stream';
    }

    /**
     * Correct the MIME type of a blob by inspecting its magic bytes.
     * Servers/CDNs sometimes lie about Content-Type (e.g. serving webp as image/jpeg).
     * This mirrors the logic in Connector._applyRealMime but works on Blob objects.
     */
    async _correctBlobMime(blob) {
        let header = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
        let detectedType = null;

        // WEBP: bytes 8-11 = "WEBP"
        if (header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50) {
            detectedType = 'image/webp';
        // JPEG: bytes 0-2 = FF D8 FF
        } else if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) {
            detectedType = 'image/jpeg';
        // PNG: bytes 1-3 = "PNG"
        } else if (header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) {
            detectedType = 'image/png';
        // GIF: bytes 0-2 = "GIF"
        } else if (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46) {
            detectedType = 'image/gif';
        // BMP: bytes 0-1 = "BM"
        } else if (header[0] === 0x42 && header[1] === 0x4D) {
            detectedType = 'image/bmp';
        }

        if (detectedType && detectedType !== blob.type) {
            console.warn(`Blob MIME type "${blob.type}" does not match file signature, corrected to "${detectedType}"`);
            return new Blob([blob], { type: detectedType });
        }
        return blob;
    }

    /**
     * Helper function to get the image type for jsPDF of the given mime type.
     * If the mime is not a spported PDF image format undefined will be returned.
     */
    _pdfImageType(image) {
        if (image.type === 'image/jpeg') {
            return 'JPEG';
        }
        if (image.type === 'image/png') {
            return 'PNG';
        }
        return undefined;
    }

    /**
     * Save the given value for the given key in the bookmark storage
     */
    async saveBookmarks(key, value, indentation) {
        const bookmarkPath = await this._getBookmarkOutputPath();
        await this.fs.writeFile(bookmarkPath + key, JSON.stringify(value, undefined, indentation));
    }

    /**
     * Load the value for the given key from the bookmark storage
     */
    async loadBookmarks(key) {
        const bookmarkPath = await this._getBookmarkOutputPath();
        const data = await this.fs.readFile(bookmarkPath + key, 'utf8');
        return JSON.parse(data);
    }
}
