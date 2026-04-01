import FoolSlide from './templates/FoolSlide.mjs';

export default class {{{ className }}} extends FoolSlide {

    constructor() {
        super();
        super.id = '{{{ id }}}';
        super.label = '{{{ label }}}';
        this.tags = [ {{{ tags }}} ];
        this.url = '{{{ url }}}';
        this.path = '{{{ path }}}';
    }
}
