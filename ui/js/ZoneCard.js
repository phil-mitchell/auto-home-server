import Card from "@ui5/webcomponents/dist/Card.js";

import clientAPI from './ClientAPI.js';
import Binding from './Binding.js';

class AutoHomeZoneCard extends Card {
    constructor() {
        super();
    }

    async connectedCallback() {
        await super.connectedCallback();

        this._upgradeProperty( 'zone' );

        this.refresh();
    }

    async refresh() {
        while( this.firstChild ) {
            this.removeChild( this.firstChild );
        }

        let image = document.createElement( 'img' );
        image.setAttribute( 'src', './img/zone.png' );
        image.setAttribute( 'slot', 'avatar' );
        this.appendChild( image );

        if( this.zone && this.zone.devices ) {
            for( let device of this.zone.devices ) {
                let deviceBlock = document.createElement( 'div' );
                deviceBlock.style.display = 'inline-block';
                deviceBlock.style.margin = '5px';
                deviceBlock.style.padding = '5px';
                deviceBlock.style.border = '1px solid black';

                let deviceIcon = document.createElement( 'img' );
                deviceIcon.setAttribute( 'src', './img/zone.png' );
                //deviceBlock.appendChild( deviceIcon );

                let deviceName = document.createElement( 'h3' );
                deviceName.appendChild( document.createTextNode( device.name ) );
                deviceBlock.appendChild( deviceName );

                let value = 'unknown';
                if( ( device.current || {}).value ) {
                    value = device.current.value.value + ' ' + device.current.value.unit;

                    if( device.type === 'switch' ) {
                        value = device.current.value.value ? 'ON' : 'OFF';
                    }
                }

                let deviceValue = document.createElement( 'p' );
                deviceValue.appendChild( document.createTextNode( 'Value: ' + value ) );
                deviceBlock.appendChild( deviceValue );

                value = ( device.current || {}).time ? new Date( device.current.time ).toLocaleString() : '';
                let deviceUpdated = document.createElement( 'p' );
                deviceUpdated.appendChild( document.createTextNode(
                    'Updated: ' + value
                ) );
                deviceBlock.appendChild( deviceUpdated );

                value = 'none';
                if( ( device.target || {}).value ) {
                    value = device.target.value.value + ' ' + device.target.value.unit;

                    if( device.type === 'switch' ) {
                        value = device.target.value.value ? 'ON' : 'OFF';
                    }
                }

                deviceValue = document.createElement( 'p' );
                deviceValue.appendChild( document.createTextNode( 'Target: ' + value ) );
                deviceBlock.appendChild( deviceValue );
                
                value = ( device.target || {}).until ? new Date( device.target.until ).toLocaleString() : '';
                deviceUpdated = document.createElement( 'p' );
                deviceUpdated.appendChild( document.createTextNode(
                    'Until: ' + value
                ) );
                deviceBlock.appendChild( deviceUpdated );
                
                this.appendChild( deviceBlock );
            }
        }

        return;
    }

    _upgradeProperty( prop ) {
        if( this.hasOwnProperty( prop ) && AutoHomeZoneCard.prototype.hasOwnProperty( prop ) ) {
            let pv = this[prop];
            delete this[prop];
            this[prop] = pv;
        }
        if( this.hasAttribute( prop ) ) {
            let pv = this.getAttribute( prop );
            this.removeAttribute( prop );
            this[prop] = pv;
        }
    }

    get zone() {
        return this._zone;
    }
    
    set zone( value ) {
        this._zone = value;
        this.refresh();
    }
}


customElements.define( 'autohome-zone-card', AutoHomeZoneCard );
