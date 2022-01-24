import "@ui5/webcomponents/dist/ResponsivePopover.js";

import MultiInput from "@ui5/webcomponents/dist/MultiInput.js";
import Binding from './Binding.js';
import Quantity from './Quantity.js';

var template = null;

class DeviceCalibrationsInput extends MultiInput {
    constructor() {
        super();
    }

    updateValueHelp() {
        let valueHelp = this.shadowRoot.querySelector( '#calibration-editor' );

        valueHelp.binding.update( valueHelp.binding.data, {
            editable: this.showValueHelpIcon
        } );
    }

    openValueHelp( event ) {
        let valueHelp = this.shadowRoot.querySelector( '#calibration-editor' );
        valueHelp.calibration = event.target.calibration;

        valueHelp.binding.data = JSON.parse( JSON.stringify( valueHelp.calibration || {
            type: 'temperature',
            calibration: {
                value: 0,
                unit: null
            },
            threshold: {
                value: 0,
                unit: null
            }
        }) );

        this.updateValueHelp();
        valueHelp.showAt( event.target );
    }

    saveValueHelp( event ) {
        let valueHelp = this.shadowRoot.querySelector( '#calibration-editor' );
        let origCalibration = valueHelp.calibration;
        let newCalibration = valueHelp.binding.data;

        newCalibration.calibration.unit = newCalibration.calibration.unit || '';
        newCalibration.threshold.unit = newCalibration.threshold.unit || '';

        let newCalibrations = [].concat( this.calibrations || [] );

        if( origCalibration ) {
            Object.assign( origCalibration, newCalibration );
        } else {
            newCalibrations.push( newCalibration );
        }

        this.calibrations = newCalibrations;
        
        this.fireEvent( 'change', {
            change: newCalibration
        });
        valueHelp.close();
    }

    deleteValueHelp( event ) {
        let valueHelp = this.shadowRoot.querySelector( '#calibration-editor' );
        let origCalibration = valueHelp.calibration;

        let newCalibrations = this.calibrations.filter( c => c !== origCalibration );

        this.calibrations = newCalibrations;
        
        this.fireEvent( 'change', {
            change: origCalibration
        });
        valueHelp.close();
    }

    async connectedCallback() {
        if( !this._initialized ) {
            await super.connectedCallback();

            if( !template ) {
                template = await ( await fetch( './tmpl/DeviceCalibrationsInput.tmpl.html' ) ).text();
            }

            var children = document.createElement( 'div' );
            children.innerHTML = template;
            
            this.shadowRoot.appendChild( children );

            let valueHelp = this.shadowRoot.querySelector( '#calibration-editor' );
            valueHelp.binding = new Binding( valueHelp, {}, { editable: this.showValueHelpIcon });
            valueHelp.binding.on( 'change', this.updateValueHelp.bind( this ) );

            valueHelp.querySelector( '#save-calibration' ).addEventListener( 'click', this.saveValueHelp.bind( this ) );
            valueHelp.querySelector( '#delete-calibration' ).addEventListener( 'click', this.deleteValueHelp.bind( this ) );

            this._upgradeProperty( 'calibrations' );

            this.addEventListener( 'value-help-trigger', this.openValueHelp.bind( this ) );
            this._initialized = true;
        }
    }

    refresh() {
        for( let item of this.querySelectorAll( '[slot=tokens]' ) ) {
            item.parentNode.removeChild( item );
        }

        for( let calibration of ( this._calibrations || [] ) ) {
            let item = document.createElement( 'ui5-token' );

            let calibrationValue = `${calibration.calibration.value} ${calibration.calibration.unit}`;
            try {
                calibrationValue = new Quantity( calibration.type, calibration.calibration.value ).toString();
            } catch( e ) {
            }

            let thresholdValue = `${calibration.threshold.value} ${calibration.threshold.unit}`;
            try {
                thresholdValue = new Quantity( calibration.type, calibration.threshold.value ).toString();
            } catch( e ) {
            }
            
            
            item.setAttribute( 'text', `${calibration.type}=${calibrationValue} ± ${thresholdValue}` );
            item.setAttribute( 'slot', 'tokens' );
            if( !this.showValueHelpIcon ) {
                item.setAttribute( 'readonly', true );
            }
            item.calibration = calibration;

            item.addEventListener( 'select', this.openValueHelp.bind( this ) );
            this.appendChild( item );
            
        }
    }

    _upgradeProperty( prop ) {
        if( this.hasOwnProperty( prop )) {
            let value = this[prop];
            delete this[prop];
            this[prop] = value;
        }
    }

    set calibrations( calibrations ) {
        this._calibrations = calibrations;
        this.refresh();
    }

    get calibrations() {
        return this._calibrations;
    }
}


customElements.define( 'device-calibrations-input', DeviceCalibrationsInput );
