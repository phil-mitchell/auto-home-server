import "@ui5/webcomponents/dist/ResponsivePopover.js";

import MultiInput from "@ui5/webcomponents/dist/MultiInput.js";
import Binding from './Binding.js';

var template = null;

class DeviceChangesInput extends MultiInput {
    constructor() {
        super();
    }

    updateValueHelp() {
        let valueHelp = this.shadowRoot.querySelector( '#change-editor' );
        let deviceId = valueHelp.binding.data.device;
        let device = ( this.devices || [] ).filter( d => d.id === deviceId )[0] || {};

        valueHelp.binding.update( valueHelp.binding.data, {
            editable: this.showValueHelpIcon
        } );
    }

    openValueHelp( event ) {
        let valueHelp = this.shadowRoot.querySelector( '#change-editor' );
        valueHelp.change = event.target.change;

        valueHelp.binding.data = JSON.parse( JSON.stringify( valueHelp.change || {
            device: ( ( this.devices || [] )[0] || {}).id,
            direction: 'none',
            data: {}
        }) );

        this.updateValueHelp();
        valueHelp.open( event.target );
    }

    saveValueHelp( event ) {
        let valueHelp = this.shadowRoot.querySelector( '#change-editor' );
        let origChange = valueHelp.change;
        let newChange = valueHelp.binding.data;

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
            template = await ( await fetch( './tmpl/DeviceChangesInput.tmpl.html' ) ).text();
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

            let value = `${change.direction}`;
            let device = ( this.devices || [] ).filter( d => d.id === change.device )[0] || {
                name: change.device
            };

            item.setAttribute( 'text', `${device.name}=${value}` );
            item.setAttribute( 'slot', 'tokens' );
            if( !this.showValueHelpIcon ) {
                item.setAttribute( 'readonly', true );
            }
            item.change = change;

            item.addEventListener( 'select', this.openValueHelp.bind( this ) );
            this.appendChild( item );
            
        }

        try {
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
        } catch( e ) {
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


customElements.define( 'device-changes-input', DeviceChangesInput );
