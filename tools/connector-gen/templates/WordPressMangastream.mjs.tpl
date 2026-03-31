import WordPressMangastream from './templates/WordPressMangastream.mjs';

export default class {{{ className }}} extends WordPressMangastream {

    constructor() {
        super();
        super.id = '{{{ id }}}';
        super.label = '{{{ label }}}';
        this.tags = [ {{{ tags }}} ];
        this.url = '{{{ url }}}';
        this.path = '{{{ path }}}';
    }
}
