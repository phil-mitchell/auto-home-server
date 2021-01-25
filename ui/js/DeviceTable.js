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

        this.shadow = this.attachShadow({ mode: 'open' });
    }

    async connectedCallback() {
        if( !template ) {
            template = await ( await fetch( './tmpl/DeviceTable.tmpl.html' ) ).text();
        }
        this.shadow.innerHTML = template;

        this._upgradeProperty( 'readonly' );
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
        this._devices = value;
        this.refresh();
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

    async addDevice() {
        ( this.devices || [] ).push({
            start: new Date(),
            end: new Date(),
            name: 'new device',
            changes: []
        });

        await clientAPI.saveZone();
        this.refresh();
    }

    async removeItem( idx ) {
        ( this.devices || [] ).splice( idx, 1 );
        await clientAPI.saveZone();
        this.refresh();
    }

    async refresh() {
        var container = this.shadowRoot.querySelector( 'ui5-table' );
        if( !container ) {
            return;
        }

        let rowTemplate = this.shadowRoot.getElementById( 'table-row-template' ).content;
        let deleteTemplate = this.shadowRoot.getElementById( 'delete-button-template' ).content;
        let rows = container.querySelectorAll( 'ui5-table-row' );

        var rowIdx = 0;
        for( ; rowIdx < ( this.devices || [] ).length; ++rowIdx ) {
            let device = this.devices[rowIdx];
            let row = rows[rowIdx];
            if( row ) {
                row.binding.update( device, {
                    editable: !this.readonly
                });
            } else {
                row = rowTemplate.cloneNode( true ).querySelector( 'ui5-table-row' );
                row.binding = new Binding( row, device, {
                    editable: !this.readonly
                });
                row.binding.on( 'change', () => {
                    clientAPI.saveZone();
                });
                container.appendChild( row );
            }

            let deleteButtonSlot = row.querySelector( '#delete-button-slot' );
            if( !this.readonly ) {
                if( !deleteButtonSlot.hasChildNodes() ) {
                    let deleteButton = deleteTemplate.cloneNode( true ).querySelector( 'ui5-button' );
                    deleteButton.addEventListener( 'click', this.removeItem.bind( this, rowIdx ) );
                    deleteButtonSlot = deleteButtonSlot.appendChild( deleteButton );
                }
            } else {
                deleteButtonSlot.innerHTML = '';
            }
        }

        for( ; rowIdx < rows.length; ++rowIdx ) {
            container.removeChild( rows[rowIdx] );
        }
    }
}


customElements.define( 'autohome-device-table', AutoHomeDeviceTable );
