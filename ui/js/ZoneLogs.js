import './QuantityInput.js';

import clientAPI from './ClientAPI.js';
import Binding from './Binding.js';
import Quantity from './Quantity.js';

var template = null;

class AutoHomeZoneLogs extends HTMLElement {
    constructor() {
        super();
    }

    async connectedCallback() {
        if( !template ) {
            template = await ( await fetch( './tmpl/ZoneLogs.tmpl.html' ) ).text();
        }

        if( !this.shadowRoot ) {
            this.attachShadow({ mode: 'open' });
            this.shadowRoot.innerHTML = template;

            this.shadowRoot.querySelector( '#last-input' ).addEventListener( 'change', this.refresh.bind( this ) );
            this.shadowRoot.querySelector( '#start-input' ).addEventListener( 'change', this.refresh.bind( this ) );
            this.shadowRoot.querySelector( '#end-input' ).addEventListener( 'change', this.refresh.bind( this ) );
            for( let option of this.shadowRoot.querySelectorAll( 'ui5-radio-button' ) ) {
                option.addEventListener( 'change', this.refresh.bind( this ) );
            }

            clientAPI.on( 'zoneChange', () => {
                this.refresh();
            });
        }

        this.refresh();
    }

    _upgradeProperty( prop ) {
        if( this.hasOwnProperty( prop )) {
            let value = this[prop];
            delete this[prop];
            this[prop] = value;
        }
    }
    
    async refresh() {
        if( !this.shadowRoot ) {
            return;
        }

        let lastInput = this.shadowRoot.querySelector( '#last-input' );
        let startInput = this.shadowRoot.querySelector( '#start-input' );
        let endInput = this.shadowRoot.querySelector( '#end-input' );

        if( !lastInput.quantity ) {
            lastInput.quantity = new Quantity( 'time', 15, 'minute' );
        }

        let start = null;
        let end = new Date().toISOString();

        for( let option of this.shadowRoot.querySelectorAll( 'ui5-radio-button[name="timerange"]' ) ) {
            if( option.checked ) {
                switch( option.text ) {
                case'Last':
                    start = new Date(
                        new Date( end ).getTime() - lastInput.quantity.convert( 'ms' ).value
                    ).toISOString();
                    break;
                default:
                    end = endInput.isotime || new Date().toISOString();
                    start = startInput.isotime;
                }
            }
        }

        if( !start ) {
            start = new Date( end );
            start.setDate( start.getDate() - 1 );
            start = start.toISOString();
        }

        startInput.isotime = start;
        endInput.isotime = end;
        
        let logs = await clientAPI.queryZoneLogs( start,  end );

        let logText = logs.logs.map( entry => `${ new Date( entry.time ) }\t${entry.level}\t${entry.tag.padEnd( 8 )}\t${entry.message}` ).join( '\n' );
        this.shadowRoot.querySelector( 'ui5-textarea' ).value = logText;
    }
}


customElements.define( 'autohome-zone-logs', AutoHomeZoneLogs );
