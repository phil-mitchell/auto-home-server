import MultiComboBox from "@ui5/webcomponents/dist/MultiComboBox.js";

const DAYS = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday'
];

class DOWPicker extends MultiComboBox {
    constructor() {
        super();
    }

    async connectedCallback() {
        await super.connectedCallback();

        let i = 0;
        for( let day of DAYS ) {
            let item = document.createElement( 'ui5-mcb-item' );
            item.setAttribute( 'id', 'item-day-' + i++ );
            item.setAttribute( 'text', day );
            this.appendChild( item );
        }
        
        this._upgradeProperty( 'days' );
    }

    _upgradeProperty( prop ) {
        if( this.hasOwnProperty( prop )) {
            let value = this[prop];
            delete this[prop];
            this[prop] = value;
        }
    }

    set days( days ) {
        for( let day of days ) {
            this.querySelector( '#item-day-' + day ).selected = true;
        }
    }

    get days() {
        let days = [];
        for( let day = 0; day < DAYS.length; day++ ) {
            if( this.querySelector( '#item-day-' + day ).selected ) {
                days.push( day );
            }
        }
    }
}


customElements.define( 'dow-picker', DOWPicker );
