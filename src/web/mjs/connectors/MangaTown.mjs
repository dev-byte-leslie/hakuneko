import Connector from '../engine/Connector.mjs';

export default class MangaTown extends Connector {

    constructor() {
        super();
        super.id = 'mangatown';
        super.label = 'MangaTown';
        this.tags = [ 'manga', 'english' ];
        this.url = 'https://www.mangatown.com';
    }

    async _getMangas() {
        let mangaList = [];
        let request = new Request(this.url + '/directory/', this.requestOptions);
        let data = await this.fetchDOM(request, 'div.next-page a:nth-last-child(3)');
        let pageCount = parseInt(data[0].text.trim());
        for(let page = 1; page <= pageCount; page++) {
            let mangas = await this._getMangasFromPage(page);
            mangaList.push(...mangas);
        }
        return mangaList;
    }

    async _getMangasFromPage(page) {
        let request = new Request(this.url + '/directory/0-0-0-0-0-0/' + page + '.htm', this.requestOptions);
        let data = await this.fetchDOM(request, 'ul.manga_pic_list li p.title a');
        return data.map(element => {
            return {
                id: this.getRootRelativeOrAbsoluteLink(element, request.url),
                title: element.title.trim()
            };
        });
    }

    async _getChapters(manga) {
        let request = new Request(this.url + manga.id, this.requestOptions);
        let data = await this.fetchDOM(request, 'ul.chapter_list li');
        return data.map(element => {
            let link = element.querySelector('a');
            let title = link.text.replace(manga.title, '').trim();
            let texts = [...element.querySelectorAll('span')];
            for(let i = 0; i < texts.length; i++) {
                if(texts[i].getAttribute('class') != 'time') {
                    if(texts[i].textContent.match(/^Vol \d+/i)) {
                        title = '[' + texts[i].textContent + '] ' + title;
                    } else {
                        title = title + ' ' + texts[i].textContent;
                    }
                }
            }
            return {
                id: this.getRootRelativeOrAbsoluteLink(link, request.url),
                title: title,
                language: ''
            };
        });
    }

    async _getPages(chapter) {
        // MangaTown embeds every page image directly in the chapter page inside
        // #viewer (the old div.page_select dropdown is now populated client-side and
        // is empty in the served HTML, so scraping it yields no pages).
        // Note: createDOM() rewrites <img> to <source>, so match source.image.
        let request = new Request(new URL(chapter.id, this.url), this.requestOptions);
        let data = await this.fetchDOM(request, 'div#viewer source.image');
        return data.map(image => this.createConnectorURI(this.getAbsolutePath(image, request.url)));
    }

    async _handleConnectorURI(payload) {
        // payload is the absolute image URL (on the mangahere CDN, which requires a referer)
        const request = new Request(payload, this.requestOptions);
        request.headers.set('x-referer', 'mangahere.com');
        const response = await fetch(request);
        const imageData = await response.blob();
        return this._blobToBuffer(imageData);
    }
}
