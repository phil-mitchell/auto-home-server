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
        let time = isotime ? this.getFormat().format( new Date( isotime ) ) : '';
        this.setAttribute( 'value', time );
    }

    get isotime() {
        return( this.dateValue && this.dateValue.toISOString() ) || null;
    }
}


customElements.define( 'local-datetime-picker', LocalDateTimePicker );
