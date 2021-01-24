import DateTimePicker from "@ui5/webcomponents/dist/DateTimePicker.js";

var template = null;

class LocalDateTimePicker extends DateTimePicker {
    constructor() {
        super();
    }

    async connectedCallback() {
        await super.connectedCallback();
        this._upgradeProperty( 'isotime' );
    }

    _upgradeProperty( prop ) {
        if( this.hasOwnProperty( prop )) {
            let value = this[prop];
            delete this[prop];
            this[prop] = value;
        }
    }

    set isotime( isotime ) {
        this.setAttribute( 'value', this.getFormat().format( new Date( isotime ) ) );
    }

    get isotime() {
        return this.dateValue.toISOString();
    }
}


customElements.define( 'local-datetime-picker', LocalDateTimePicker );
