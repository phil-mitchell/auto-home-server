import './HistoryChart.js';

import clientAPI from './ClientAPI.js';
import Binding from './Binding.js';
import Quantity from './Quantity.js';

var template = null;

class AutoHomeDeviceHistory extends HTMLElement {
    constructor() {
        super();

        this.attachShadow({ mode: 'open' });
    }

    async connectedCallback() {
        if( !template ) {
            template = await ( await fetch( './tmpl/DeviceHistory.tmpl.html' ) ).text();
        }
        this.shadowRoot.innerHTML = template;

        this.shadowRoot.querySelector( '#start-input' ).addEventListener( 'change', this.refresh.bind( this ) );
        this.shadowRoot.querySelector( '#end-input' ).addEventListener( 'change', this.refresh.bind( this ) );

        this.refresh();
    }

    _upgradeProperty( prop ) {
        if( this.hasOwnProperty( prop )) {
            let value = this[prop];
            delete this[prop];
            this[prop] = value;
        }
    }
    
    set devices( value ) {
        if( !value ) {
            value = [];
        }
        if( !Array.isArray( value ) ) {
            value = [ value ];
        }
        this._devices = value;
        this.refresh();
    }

    get devices() {
        return this._devices;
    }

    async refresh() {
        var container = this.shadowRoot.querySelector( 'slot:not([name])' );
        if( !container ) {
            return;
        }

        var startInput = this.shadowRoot.querySelector( '#start-input' );
        var endInput = this.shadowRoot.querySelector( '#end-input' );

        let end = endInput.isotime || new Date().toISOString();
        let start = startInput.isotime;
        if( !start ) {
            start = new Date( end );
            start.setDate( start.getDate() - 1 );
            start = start.toISOString();
        }

        startInput.isotime = start;
        endInput.isotime = end;
        
        let readings = await clientAPI.querySensorReadings( start,  end );
        let rowTemplate = this.shadowRoot.getElementById( 'device-chart-template' ).content;
        let rows = container.assignedElements();

        var rowIdx = 0;
        for( ; rowIdx < ( readings.readings || [] ).length; ++rowIdx ) {
            let deviceReadings = readings.readings[rowIdx];
            let device = ( this.devices || [] ).filter( d => d.id === deviceReadings.sensor )[0] || {};
            let row = rows[rowIdx];
            if( row ) {
                row.binding.update({
                    start: start,
                    end: end,
                    title: `${device.name} - ${deviceReadings.type}`,
                    readings: [ deviceReadings ]
                });
            } else {
                row = rowTemplate.cloneNode( true ).querySelector( 'div' );
                row.binding = new Binding( row, {
                    start: start,
                    end: end,
                    title: `${device.name} - ${deviceReadings.type}`,
                    readings: [ deviceReadings ]
                }, {
                    readOnly: true
                });
                row.binding.on( 'change', () => {
                    clientAPI.saveZone();
                });
                this.appendChild( row );
            }
        }

        for( ; rowIdx < rows.length; ++rowIdx ) {
            this.removeChild( rows[rowIdx] );
        }
    }
}


customElements.define( 'autohome-device-history', AutoHomeDeviceHistory );
