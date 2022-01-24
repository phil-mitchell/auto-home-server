import Select from "@ui5/webcomponents/dist/Select.js";
import "@ui5/webcomponents/dist/Option.js";

class BindableSelect extends Select {
    constructor() {
        super();
    }

    async connectedCallback() {
        if( !this._inited ) {
            await super.connectedCallback();
            this._inited = true;
            this._upgradeProperty( 'value' );
        }
        this.refresh();
    }

    _upgradeProperty( prop ) {
        if( this.hasOwnProperty( prop ) && BindableSelect.prototype.hasOwnProperty( prop ) ) {
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

    async refresh() {
        if( !this._inited ) {
            return;
        }
        let value = this._value;
        let options = this.querySelectorAll( 'ui5-option' );
        let selectedOption = null;
        for( let option of options ) {
            option.selected = ( option.value === value );
            if( option.value === value ) {
                selectedOption = option;
            }
        }
        if( selectedOption == null && options.length > 0 ) {
            options[0].selected = true;
            selectedOption = options[0];
        }
        if( selectedOption && selectedOption.value !== this._value ) {
            this._value = selectedOption.value;
            this.fireEvent( 'change', {
                selectedOption: selectedOption
            });
        }
    }

    get value() {
        return( this.selectedOption || {}).value;
    }

    set value( value ) {
        this._value = value;
        this.refresh();
    }
}


customElements.define( 'bindable-select', BindableSelect );
