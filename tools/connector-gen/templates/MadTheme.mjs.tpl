import MadTheme from './templates/MadTheme.mjs';

export default class {{{ className }}} extends MadTheme {

    constructor() {
        super();
        super.id = '{{{ id }}}';
        super.label = '{{{ label }}}';
        this.tags = [ {{{ tags }}} ];
        this.url = '{{{ url }}}';
    }
}
