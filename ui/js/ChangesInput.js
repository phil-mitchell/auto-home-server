import MultiInput from "@ui5/webcomponents/dist/MultiInput.js";

class ChangesInput extends MultiInput {
    constructor() {
        super();
    }

    async connectedCallback() {
        await super.connectedCallback();
        this._upgradeProperty( 'changes' );
    }

    refresh() {
        for( let item of this.querySelectorAll( '[slot=tokens]' ) ) {
            item.parentNode.removeChild( item );
        }

        for( let change of this._changes ) {
            let item = document.createElement( 'ui5-token' );
            item.setAttribute( 'text', `${change.device}=${change.value.value} ${change.value.unit}` );
            item.setAttribute( 'slot', 'tokens' );
            if( !this.showValueHelpIcon ) {
                item.setAttribute( 'readonly', true );
            }
            item.change = change;
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

    set changes( changes ) {
        this._changes = changes;
        this.refresh();
    }

    get changes() {
        return this._changes;
    }
}


customElements.define( 'schedule-changes-input', ChangesInput );
