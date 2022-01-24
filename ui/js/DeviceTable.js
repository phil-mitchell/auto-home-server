import "@ui5/webcomponents/dist/Table.js";
import "@ui5/webcomponents/dist/TableColumn.js";
import "@ui5/webcomponents/dist/TableRow.js";
import "@ui5/webcomponents/dist/TableCell.js";
import "@ui5/webcomponents/dist/MultiComboBox.js";
import "@ui5/webcomponents/dist/Dialog.js";
import "@ui5/webcomponents/dist/List.js";
import "@ui5/webcomponents/dist/TimePicker.js";
import "@ui5/webcomponents/dist/ResponsivePopover.js";

import './ChangesInput.js';
import './LocalDateTimePicker.js';
import './BindableSelect.js';
import './QuantityLabel.js';

import clientAPI from './ClientAPI.js';
import Binding from './Binding.js';
import Quantity from './Quantity.js';

var template = null;

class AutoHomeDeviceTable extends HTMLElement {
    constructor() {
        super();

    }

    async connectedCallback() {
        if( !template ) {
            template = await ( await fetch( './tmpl/DeviceTable.tmpl.html' ) ).text();
        }

        if( !this.shadowRoot ) {
            this.attachShadow({ mode: 'open' });
            this.shadowRoot.innerHTML = template;

            var container = this.shadowRoot.querySelector( 'ui5-table' );
            container.addEventListener( 'row-click', event => {
                let bubbleEvent = new CustomEvent( 'row-click', {
                    detail: event.detail,
                    target: event.target,
                    timeStamp: event.timeStamp
                });
                this.dispatchEvent( bubbleEvent );
            });

            this._upgradeProperty( 'readonly' );
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
    
    set devices( value ) {
        if( Array.isArray( value ) ) {
            this._devices = value.map( device => {
                device.isOutput = device.direction === 'output';
                return device;
            });
            this.refresh();
        }
    }

    get devices() {
        return this._devices;
    }
    
    set readonly( value ) {
        if( Boolean( value ) ) {
            this.setAttribute( 'readonly', '' );
        } else {
            this.removeAttribute( 'readonly' );
        }
    }

    get readonly() {
        return this.hasAttribute( 'readonly' );
    }

    static get observedAttributes() {
        return[ 'readonly' ];
    }

    attributeChangedCallback( name, oldValue, newValue ) {
        this.refresh();
    }

    async triggerDevice( device, event ) {
        await clientAPI.addSensorReading({
            time: new Date().toISOString(),
            type: 'button',
            value: {
                value: 1,
                unit: ''
            }
        }, device );

        await clientAPI.addSensorReading({
            time: new Date().toISOString(),
            type: 'button',
            value: {
                value: 0,
                unit: ''
            }
        }, device );

        let bubbleEvent = new CustomEvent( 'triggered', {
            detail: device,
            target: event.target,
            timeStamp: event.timeStamp
        });
        console.log( bubbleEvent ); 
        this.dispatchEvent( bubbleEvent );
    }

    async refresh() {
        var container = this.shadowRoot.querySelector( 'ui5-table' );
        if( !container ) {
            return;
        }

        let rowTemplate = this.shadowRoot.getElementById( 'table-row-template' ).content;
        let rows = container.querySelectorAll( 'ui5-table-row' );

        let entries = [];
        for( let device of this.devices || [] ) {
            let measurements = {};
            for( let measurement of ( device.current || [{}] ) ) {
                measurements[measurement.type] = measurements[measurement.type] || {
                    type: measurement.type
                };

                measurements[measurement.type].current = measurement;
            }

            /*
            for( let measurement of ( device.target || [] ) ) {
                measurements[measurement.type] = measurements[measurement.type] || {
                    type: measurement.type
                };

                measurements[measurement.type].target = measurement;
            }
            */

            measurements = Object.values( measurements ) || [];
            if( measurements.length === 0 ) {
                measurements.push({});
            }

            for( let measurement of measurements ) {
                entries.push({
                    id: device.id,
                    name: device.name,
                    direction: device.direction,
                    notTriggerable: device.direction === 'output' || device.interface.type !== 'gpio',
                    interface: device.interface,
                    type: measurement.type,
                    current: measurement.current,
                    target: device.target //measurement.target
                });
            }
        }

        var rowIdx = 0;
        for( ; rowIdx < entries.length; ++rowIdx ) {
            let device = entries[rowIdx];
            let row = rows[rowIdx];
            if( row ) {
                row.binding.update( device, {
                    editable: !this.readonly
                });
            } else {
                row = rowTemplate.cloneNode( true ).querySelector( 'ui5-table-row' );
                row._getActiveElementTagName = function _localGetActiveElementTagName() {
		    return this.getRootNode().activeElement.localName.toLocaleLowerCase();
	        };
                row.binding = new Binding( row, device, {
                    editable: !this.readonly
                });
                row.querySelector( '#trigger-button' ).addEventListener( 'click', event => {
                    this.triggerDevice( row.binding.data, event );
                });
                row.binding.on( 'change', () => {
                    clientAPI.saveZone();
                });
                container.appendChild( row );
            }
        }

        for( ; rowIdx < rows.length; ++rowIdx ) {
            container.removeChild( rows[rowIdx] );
        }
    }
}


customElements.define( 'autohome-device-table', AutoHomeDeviceTable );
