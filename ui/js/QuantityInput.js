import Quantity from './Quantity.js';
import Input from "@ui5/webcomponents/dist/Input.js";
import ComboBox from "@ui5/webcomponents/dist/ComboBox.js";

class QuantityInput extends Input {
    constructor() {
        super();
    }

    static get staticAreaStyles() {
        return ComboBox.staticAreaStyles;
    }

    static get staticAreaTemplate() {
        return ComboBox.staticAreaTemplate;
    }
    
    async _respPopover() {
        const staticAreaItem = await this.getStaticAreaItemDomRef();
        if( staticAreaItem ) {
            this.responsivePopover = staticAreaItem.querySelector("[ui5-responsive-popover]");
        }
        return this.responsivePopover;
    }

    _afterClosePopover() {
    }

    async openUnitSelector( event ) {
        if( this.readonly ) {
            return;
        }
        await this._respPopover();
        this.responsivePopover.showAt( this );
    }

    async openCalculator( event ) {
        if( this.readonly ) {
            return;
        }
        this.fireEvent( 'open-calculator', {
            target: this
        });
    }

    _selectItem( event ) {
        this.unit = event.detail.item.mappedItem.name;
        this.responsivePopover.close();
        this.fireEvent( 'change', {
            unit: event.detail.item.mappedItem.name
        });
    }

    async connectedCallback() {
        if( !this._initialized ) {
            await super.connectedCallback();
            this._initialized = true;
            this.setAttribute( 'type', 'Number' );

            let unit = document.createElement( 'span' );
            unit.setAttribute( 'slot', 'icon' );
            unit.setAttribute( 'id', 'unit' );
            this.appendChild( unit );

            unit.addEventListener( 'click', this.openUnitSelector.bind( this ) );

            let calculator = document.createElement( 'ui5-button' );
            calculator.setAttribute( 'slot', 'icon' );
            calculator.setAttribute( 'id', 'calculator' );
            calculator.setAttribute( 'icon', 'simulate' );
            calculator.setAttribute( 'design', 'transparent' );
            calculator.style['margin-left'] = '10px';
            this.appendChild( calculator );
            
            calculator.addEventListener( 'click', this.openCalculator.bind( this ) );

            this._upgradeProperty( 'quantitytype' );
            this._upgradeProperty( 'quantitycategory' );
            this._upgradeProperty( 'unit' );
            this._upgradeProperty( 'quantity' );
            this._upgradeProperty( 'quantitymax' );
            this._upgradeProperty( 'quantitymin' );
            this._upgradeProperty( 'decimal' );
            this._upgradeProperty( 'step' );
            this._upgradeProperty( 'default' );
        }

        this.refresh();
    }

    _upgradeProperty( prop ) {
        if( this.hasOwnProperty( prop ) && QuantityInput.prototype.hasOwnProperty( prop ) ) {
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
        let quantity = this._quantity;
        if( quantity === null ) {
            quantity = this._default;
        }
        if( quantity != null && typeof( quantity.convert ) !== 'function' && this.quantitytype ) {
            quantity = new Quantity( this.quantitytype, quantity );
        }
        if( quantity == null || typeof( quantity.convert ) !== 'function' ) {
            this.value = null;
            return;
        }

        if( this.unit != null ) {
            try {
                quantity = quantity.convert( this.unit );
            } catch( e ) {
            }
        }

        if( quantity.unit != null ) {
            this._unit = quantity.unit;
        }

        let quantitymin = this.quantitymin;
        if( quantitymin != null && typeof( quantitymin.convert ) !== 'function' && this.quantitytype ) {
            quantitymin = new Quantity( this.quantitytype, quantitymin );
        }
        if( quantitymin != null && typeof( quantitymin.convert ) === 'function' ) {
            quantitymin = quantitymin.convert( quantity.unit );
            this.shadowRoot.querySelector( 'input' ).setAttribute( 'min', quantitymin.value );
        }

        let quantitymax = this.quantitymax;
        if( quantitymax != null && typeof( quantitymax.convert ) !== 'function' && this.quantitytype ) {
            quantitymax = new Quantity( this.quantitytype, quantitymax );
        }
        if( quantitymax != null && typeof( quantitymax.convert ) === 'function' ) {
            quantitymax = quantitymax.convert( quantity.unit );
            this.shadowRoot.querySelector( 'input' ).setAttribute( 'max', quantitymax.value );
        }

        let unitField = this.querySelector( '#unit' );
        if( unitField ) {
            if( this.hideunit || ( quantity.unit == null && this.unit == null ) ) {
                unitField.innerText = '';
            } else {
                try {
                    unitField.innerText = Quantity.parseUnit(
                        quantity.type, this.unit == null ? quantity.unit : this.unit ).toString() || '_';
                } catch( e ) {
                    unitField.innerText = '_';
                }
            }
        }

        let calcField = this.querySelector( '#calculator' );
        if( calcField ) {
            if( !this.calculator || this.readonly ) {
                calcField.style.display = 'none';
            } else {
                calcField.style.display = 'inline-block';
            }
        }

        this.value = quantity.value == null ? '' : quantity.value.toFixed( this.decimal );
    }

    get _filteredItems() {
        if( !this.quantitytype ) {
            return [];
        }
        return Quantity.parseType( this.quantitytype ).units.filter(
            unit => !this.quantitycategory || ( unit.category || [] ).indexOf( this.quantitycategory ) >= 0                                                        
        ).map( unit => {
            return{
                name: unit.name,
                unit: unit.symbol,
                text: `${unit.name} (${unit.symbol})`
            };
        });
    }

    get quantitytype() {
        let value = this._quantitytype;
        if( value == null && this._quantity != null ) {
            value = this._quantity.type;
        }
        return value;
    }

    set quantitytype( value ) {
        this._quantitytype = value;
        this.refresh();
    }

    get unit() {
        let value = this._unit;
        if( value == null && this._quantity != null ) {
            value = this._quantity.unit;
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

    get step() {
        let value = this._step;
        return value;
    }

    set step( value ) {
        this._step = Number( value );
        this.refresh();
    }

    get quantitymin() {
        return this._quantitymin;
    }

    set quantitymin( value ) {
        this._quantitymin = value;
        if( typeof( this._quantitymin ) === 'string' ) {
            try {
                this._quantitymin = JSON.parse( this._quantitymin );
            } catch( e ) {
            }
        }
        this.refresh();
    }

    get quantitymax() {
        return this._quantitymax;
    }

    set quantitymax( value ) {
        this._quantitymax = value;
        if( typeof( this._quantitymax ) === 'string' ) {
            try {
                this._quantitymax = JSON.parse( this._quantitymax );
            } catch( e ) {
            }
        }
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
        let quantity = this._quantity;
        if( quantity == null && this.unit != null ) {
            quantity = {};
        }

        if( quantity && typeof( quantity ) === 'object' ) {
            if( typeof( quantity.convert ) === 'function' ) {
                quantity = new Quantity( quantity.type, Number( this.value ), this.unit );
            } else if( typeof( quantity ) === 'object' ) {
                quantity = Object.assign({}, quantity );
                quantity.unit = this.unit;
                quantity.value = Number( this.value );
            }
        } else if( quantity != null && this.quantitytype ) {
            let q = new Quantity( this.quantitytype, Number( this.value ), this.unit ).convert();
            quantity = q.value;
        } else {
            quantity = Number( this.value );
        }
        return quantity;
    }

    set quantity( quantity ) {
        this._quantity = quantity === '' ? null : quantity;
        if( typeof( this._quantity ) === 'string' ) {
            this._quantity = Number( this._quantity );
        }
        this.refresh();
    }

    set default( quantity ) {
        this._default = quantity === '' ? null : quantity;
        if( typeof( this._default ) === 'string' ) {
            this._default = Number( this._default );
        }
        this.refresh();
    }

    get calculator() {
        return this.hasAttribute( 'calculator' );
    }

    set calculator( value ) {
        if( Boolean( value ) ) {
            this.setAttribute( 'calculator', '' );
        } else {
            this.removeAttribute( 'calculator' );
        }
    }
}


customElements.define( 'quantity-input', QuantityInput );
