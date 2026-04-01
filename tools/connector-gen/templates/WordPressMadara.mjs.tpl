import WordPressMadara from './templates/WordPressMadara.mjs';

export default class {{{ className }}} extends WordPressMadara {

    constructor() {
        super();
        super.id = '{{{ id }}}';
        super.label = '{{{ label }}}';
        this.tags = [ {{{ tags }}} ];
        this.url = '{{{ url }}}';
        this.path = '{{{ path }}}';
    }
}
