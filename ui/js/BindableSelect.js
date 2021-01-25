import Select from "@ui5/webcomponents/dist/Select.js";
import "@ui5/webcomponents/dist/Option.js";

class BindableSelect extends Select {
    constructor() {
        super();
    }

    async connectedCallback() {
        await super.connectedCallback();
        this._upgradeProperty( 'value' );
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
        let value = this._value;
        let options = this.querySelectorAll( 'ui5-option' );
        for( let option of options ) {
            option.selected = ( option.value === value );
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
