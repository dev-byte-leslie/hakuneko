export default class Bookmark {

    title: { connector: string; manga: string };
    key: { connector: string | symbol; manga: string };

    constructor( manga: { connector: { label: string; id: string | symbol }; title: string; id: string } ) {
        //this.id = Symbol();
        this.title = {
            connector: manga.connector.label,
            manga: manga.title
        };
        this.key = {
            connector: manga.connector.id,
            manga: manga.id
        };
    }
}
