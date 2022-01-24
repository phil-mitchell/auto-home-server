import "@ui5/webcomponents/dist/Table.js";
import "@ui5/webcomponents/dist/TableColumn.js";
import "@ui5/webcomponents/dist/TableRow.js";
import "@ui5/webcomponents/dist/TableCell.js";
import "@ui5/webcomponents/dist/MultiComboBox.js";
import "@ui5/webcomponents/dist/Dialog.js";
import "@ui5/webcomponents/dist/List.js";
import "@ui5/webcomponents/dist/TimePicker.js";
import "@ui5/webcomponents/dist/ResponsivePopover.js";

import './DOWPicker.js';
import './ChangesInput.js';

import clientAPI from './ClientAPI.js';
import Binding from './Binding.js';
import Quantity from './Quantity.js';

var template = null;

class AutoHomeScheduleTable extends HTMLElement {
    constructor() {
        super();
    }

    async connectedCallback() {
        if( !template ) {
            template = await ( await fetch( './tmpl/ScheduleTable.tmpl.html' ) ).text();
        }

        if( !this.shadowRoot ) {
            this.attachShadow({ mode: 'open' });
            this.shadowRoot.innerHTML = template;

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
    
    set schedules( value ) {
        this._schedules = value;
        this.refresh();
    }

    get schedules() {
        return this._schedules;
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

    async addSchedule() {
        ( this.schedules || [] ).push({
            days: [],
            start: '00:00',
            changes: []
        });
        await this.save();
    }

    async removeItem( idx ) {
        ( this.schedules || [] ).splice( idx, 1 );
        await this.save();
    }

    async save() {
        await clientAPI.saveZone();
    }
    
    async refresh() {
        if( !this.shadowRoot ) {
            return;
        }

        var container = this.shadowRoot.querySelector( 'ui5-table' );
        if( !container ) {
            return;
        }

        let rowTemplate = this.shadowRoot.getElementById( 'table-row-template' ).content;
        let deleteTemplate = this.shadowRoot.getElementById( 'delete-button-template' ).content;
        let rows = container.querySelectorAll( 'ui5-table-row' );

        var rowIdx = 0;
        for( ; rowIdx < ( this.schedules || [] ).length; ++rowIdx ) {
            let schedule = this.schedules[rowIdx];
            let row = rows[rowIdx];
            if( row ) {
                row.binding.update({
                    schedule,
                    devices: this.devices
                }, {
                    editable: !this.readonly
                });
            } else {
                row = rowTemplate.cloneNode( true ).querySelector( 'ui5-table-row' );
                row.binding = new Binding( row, {
                    schedule,
                    devices: this.devices
                }, {
                    editable: !this.readonly
                });
                row.binding.on( 'change', () => {
                    this.save();
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


customElements.define( 'autohome-schedule-table', AutoHomeScheduleTable );
