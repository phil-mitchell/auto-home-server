import "@ui5/webcomponents/dist/ResponsivePopover.js";

import './QuantityInput.js';

import MultiInput from "@ui5/webcomponents/dist/MultiInput.js";
import Binding from './Binding.js';
import Quantity from './Quantity.js';

var template = null;

class ChangesInput extends MultiInput {
    constructor() {
        super();
    }

    updateValueHelp() {
        let valueHelp = this.shadowRoot.querySelector( '#change-editor' );

        valueHelp.binding.update( valueHelp.binding.data, {
            editable: this.showValueHelpIcon
        } );

        let inputs = valueHelp.querySelectorAll( 'quantity-input' );
        for( let input of inputs ) {
            if( input.quantitytype !== valueHelp.binding.data.type ) {
                if( input.quantitytype ) {
                    input.quantity = Object.assign( input.quantity, { unit: null });
                }
            
                input.quantitytype = valueHelp.binding.data.type;
            }
        }
    }

    openValueHelp( event ) {
        let valueHelp = this.shadowRoot.querySelector( '#change-editor' );
        valueHelp.change = event.target.change;

        let inputs = valueHelp.querySelectorAll( 'quantity-input' );
        for( let input of inputs ) {
            input.quantity = null;
            input.quantitytype = null;
        }

        valueHelp.binding.data = JSON.parse( JSON.stringify( valueHelp.change || {
            device: ( this._devices[0] || {}).id,
            type: 'temperature',
            value: {
                value: null,
                unit: null
            },
            data: {}
        }) );

        this.updateValueHelp();
        valueHelp.showAt( event.target );
    }

    saveValueHelp( event ) {
        let valueHelp = this.shadowRoot.querySelector( '#change-editor' );
        let origChange = valueHelp.change;
        let newChange = valueHelp.binding.data;

        newChange.value.unit = newChange.value.unit || '';

        let newChanges = [].concat( this.changes );

        if( origChange ) {
            Object.assign( origChange, newChange );
        } else {
            newChanges.push( newChange );
        }

        this.changes = newChanges;
        
        this.fireEvent( 'change', {
            change: newChange
        });
        valueHelp.close();
    }

    deleteValueHelp( event ) {
        let valueHelp = this.shadowRoot.querySelector( '#change-editor' );
        let origChange = valueHelp.change;

        let newChanges = this.changes.filter( c => c !== origChange );

        this.changes = newChanges;
        
        this.fireEvent( 'change', {
            change: origChange
        });
        valueHelp.close();
    }

    async connectedCallback() {
        await super.connectedCallback();

        if( !template ) {
            template = await ( await fetch( './tmpl/ChangesInput.tmpl.html' ) ).text();
        }

        var children = document.createElement( 'div' );
        children.innerHTML = template;
        
        this.shadowRoot.appendChild( children );

        let valueHelp = this.shadowRoot.querySelector( '#change-editor' );
        valueHelp.binding = new Binding( valueHelp, {}, { editable: this.showValueHelpIcon });
        valueHelp.binding.on( 'change', this.updateValueHelp.bind( this ) );

        valueHelp.querySelector( '#save-change' ).addEventListener( 'click', this.saveValueHelp.bind( this ) );
        valueHelp.querySelector( '#delete-change' ).addEventListener( 'click', this.deleteValueHelp.bind( this ) );

        this._upgradeProperty( 'changes' );
        this._upgradeProperty( 'devices' );

        this.addEventListener( 'value-help-trigger', this.openValueHelp.bind( this ) );
    }

    refresh() {
        for( let item of this.querySelectorAll( '[slot=tokens]' ) ) {
            item.parentNode.removeChild( item );
        }

        for( let change of ( this._changes || [] ) ) {
            let item = document.createElement( 'ui5-token' );

            let value = `${change.value.value} ${change.value.unit}`;

            for( let device of ( this._devices || [] ) ) {
                if( change.device === device.id ) {
                    try {
                        value = new Quantity( change.type, change.value ).toString();
                    } catch( e ) {
                    }
                    break;
                }
            }

            let device = ( this.devices || [] ).filter( d => d.id === change.device )[0] || {
                name: change.device
            };

            item.setAttribute( 'text', `${device.name}:${change.type}=${value}` );
            item.setAttribute( 'slot', 'tokens' );
            if( !this.showValueHelpIcon ) {
                item.setAttribute( 'readonly', true );
            }
            item.change = change;

            item.addEventListener( 'select', this.openValueHelp.bind( this ) );
            this.appendChild( item );
            
        }

        let valueHelp = this.shadowRoot.querySelector( '#change-editor' );
        let deviceInput = valueHelp.querySelector( '#device-input' );

        while( deviceInput.firstChild ) {
            deviceInput.removeChild( deviceInput.lastChild );
        }

        for( let device of ( this._devices || [] ) ) {
            let item = document.createElement( 'ui5-option' );
            item.appendChild( document.createTextNode( device.name ) );
            item.setAttribute( 'value', device.id );
            item.device = device;
            deviceInput.appendChild( item );
        }
    }

    _upgradeProperty( prop ) {
        if( this.hasOwnProperty( prop )) {
            let value = this[prop];
            delete this[prop];
            this[prop] = value;
        }
    }

    set changes( changes ) {
        this._changes = changes;
        this.refresh();
    }

    get changes() {
        return this._changes;
    }

    set devices( value ) {
        this._devices = value;
        this.refresh();
    }

    get devices() {
        return this._devices;
    }
}


customElements.define( 'schedule-changes-input', ChangesInput );
