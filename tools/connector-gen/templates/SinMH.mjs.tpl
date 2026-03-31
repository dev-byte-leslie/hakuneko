import SinMH from './templates/SinMH.mjs';

export default class {{{ className }}} extends SinMH {

    constructor() {
        super();
        super.id = '{{{ id }}}';
        super.label = '{{{ label }}}';
        this.tags = [ {{{ tags }}} ];
        this.url = '{{{ url }}}';
    }
}
