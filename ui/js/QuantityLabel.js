import Quantity from './Quantity.js';
import Label from "@ui5/webcomponents/dist/Label.js";

class QuantityLabel extends Label {
    constructor() {
        super();
    }

    async connectedCallback() {
        await super.connectedCallback();
        this._upgradeProperty( 'quantitytype' );
        this._upgradeProperty( 'unit' );
        this._upgradeProperty( 'decimal' );
        this._upgradeProperty( 'quantity' );
        this.refresh();
    }

    _upgradeProperty( prop ) {
        if( this.hasOwnProperty( prop ) && QuantityLabel.prototype.hasOwnProperty( prop ) ) {
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
        let quantity = this.quantity;
        if( quantity && typeof( quantity.convert ) !== 'function' && this.quantitytype ) {
            quantity = new Quantity( this.quantitytype, quantity );
        }
        if( !quantity || typeof( quantity.convert ) !== 'function' ) {
            this.innerText = '';
            return;
        }
        if( this.unit ) {
            quantity = quantity.convert( this.unit );
        }
        if( this.hideunit ) {
            this.innerText = quantity.value.toFixed( this.decimal );
        } else {
            this.innerText = quantity.toString( this.decimal );
        }
    }

    get quantitytype() {
        let value = this._quantitytype;
        if( value == null && this.quantity != null ) {
            value = this.quantity.type;
        }
        return value;
    }

    set quantitytype( value ) {
        this._quantitytype = value;
        this.refresh();
    }

    get unit() {
        let value = this._unit;
        if( value == null && this.quantity != null ) {
            value = this.quantity.unit;
        }
        return value;
    }

    set unit( value ) {
        this._unit = value;
        this.refresh();
    }

    get decimal() {
        let value = this._decimal;
        return value;
    }

    set decimal( value ) {
        this._decimal = Number( value );
        this.refresh();
    }

    set hideunit( value ) {
        if( Boolean( value ) ) {
            this.setAttribute( 'hideunit', '' );
        } else {
            this.removeAttribute( 'hideunit' );
        }
        this.refresh();
    }

    get hideunit() {
        return this.hasAttribute( 'hideunit' );
    }

    get quantity() {
        return this._quantity;
    }

    set quantity( quantity ) {
        this._quantity = quantity;
        this.refresh();
    }
}


customElements.define( 'quantity-label', QuantityLabel );
