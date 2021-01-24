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

        this.shadow = this.attachShadow({ mode: 'open' });
    }

    async connectedCallback() {
        if( !template ) {
            template = await ( await fetch( './tmpl/ScheduleTable.tmpl.html' ) ).text();
        }
        this.shadow.innerHTML = template;

        this._upgradeProperty( 'readonly' );
        /*
        let popover = this.shadowRoot.querySelector( '#gravity-calculator-popover' );
        popover.querySelector( '#sg-value-input' ).addEventListener( 'change', this.computeSG.bind( this ) );
        popover.querySelector( '#temp-value-input' ).addEventListener( 'change', this.computeSG.bind( this ) );
        popover.querySelector( '#temp-value-calibration' ).addEventListener( 'change', this.computeSG.bind( this ) );
        popover.querySelector( '#gravity-calculator-popover-submit' ).addEventListener( 'click', this.saveCalculator.bind( this ) );
        */
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
/*
    openCalculator( event ) {
        let input = event.detail.target;
        let popover = this.shadowRoot.querySelector( '#gravity-calculator-popover' );
        let sg = input.quantity;
        if( typeof( sg.convert ) !== 'function' ) {
            sg = new Quantity( 'scalar', sg );
        }
        popover.querySelector( '#sg-value-computed' ).quantity = sg;
        popover.querySelector( '#sg-value-input' ).quantity = sg;
        popover.querySelector( '#temp-value-input' ).quantity = new Quantity( 'temperature', 20, 'celsius' );
        popover.querySelector( '#temp-value-calibration' ).quantity = new Quantity( 'temperature', 20, 'celsius' );

        popover.input = input;

        popover.open( input );
    }

    saveCalculator( event ) {
        let popover = this.shadowRoot.querySelector( '#gravity-calculator-popover' );
        let input = popover.input;

        let sg = popover.querySelector( '#sg-value-computed' ).quantity;
        let prevSG = input.quantity;

        if( prevSG && prevSG.unit ) {
            sg = sg.convert( prevSG.unit );
        }

        if( typeof( prevSG.convert ) !== 'function' ) {
            sg = sg.toObject();
        }

        input.quantity = sg;
        input.fireEvent( 'change', {
            quantity: sg
        });

        popover.close();
    }

    computeSG() {
        let popover = this.shadowRoot.querySelector( '#gravity-calculator-popover' );
        let measuredSG = popover.querySelector( '#sg-value-input' ).quantity;

        let sg = measuredSG.convert( 'SG' ).value;
        let temperature = popover.querySelector( '#temp-value-input' ).quantity.convert( 'celsius' ).value;
        let calibration = popover.querySelector( '#temp-value-calibration' ).quantity.convert( 'celsius' ).value;

        let calibrationDensity = 1 - ( calibration + 288.9414 ) /
            ( 508929.2 * ( calibration + 68.12963 ) ) *
            Math.pow( calibration - 3.9863, 2 );

        let density = 1 - ( temperature + 288.9414 ) /
            ( 508929.2 * ( temperature + 68.12963 ) ) *
            Math.pow( temperature - 3.9863, 2 );

        let adjustedSG = new Quantity( 'scalar', sg * calibrationDensity / density, 'SG' );

        popover.querySelector( '#sg-value-computed' ).quantity = adjustedSG.convert( measuredSG.unit );
    }
*/

    async addSchedule() {
        ( this.schedules || [] ).push({
            days: [],
            time: '00:00',
            changes: []
        });

        await clientAPI.saveZone();
        this.refresh();
    }

    async removeItem( idx ) {
        ( this.schedules || [] ).splice( idx, 1 );
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
        for( ; rowIdx < ( this.schedules || [] ).length; ++rowIdx ) {
            let schedule = this.schedules[rowIdx];
            let row = rows[rowIdx];
            if( row ) {
                row.binding.update( schedule, {
                    editable: !this.readonly
                });
            } else {
                row = rowTemplate.cloneNode( true ).querySelector( 'ui5-table-row' );
                row.binding = new Binding( row, schedule, {
                    editable: !this.readonly
                });
                row.binding.on( 'change', () => {
                    clientAPI.saveZone();
                });
                container.appendChild( row );
/*
                let valueInput = row.querySelector( '#value-input' );
                valueInput.addEventListener( 'open-calculator', this.openCalculator.bind( this ) );
*/
            
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
