import "@ui5/webcomponents/dist/Popover.js";
import "@ui5/webcomponents/dist/ResponsivePopover.js";
import "@ui5/webcomponents/dist/Button.js";

import clientAPI from './ClientAPI.js';
import Binding from './Binding.js';

var template = null;

class BaseEditor extends HTMLElement {

    constructor( bindingPath, changeEvent ) {
        super();
        this.bindingPath = bindingPath;
        this.changeEvent = changeEvent;
        this.attachShadow({ mode: 'open' });
    }

    get template() {
        return null;
    }

    clearMessages( el ) {
        if( el.errorMessages ) {
            for( let errorMessage of el.errorMessages ) {
                errorMessage.parentNode.removeChild( errorMessage );
            }
            delete el.errorMessages;
        }
    }

    addMessage( el, message, type ) {
        let item = document.createElement( 'ui5-messagestrip' );
        item.appendChild( document.createTextNode( message ) );
        item.setAttribute( 'type', type || 'Negative' );
        item.setAttribute( 'style', 'height: max-content' );
        item.setAttribute( 'slot', 'messages' );

        el.errorMessages = el.errorMessages || [];
        el.errorMessages.push( item );
        el.appendChild( item );
    }

    async handleErrors( func, ...params ) {
        this.parentNode.clearMessages();
        try {
            await func.apply( this, params );
        } catch( e ) {
            if( e.data && e.data.errors ) {
                for( let error of e.data.errors ) {
                    if( error.location.path ) {
                        this.parentNode.showMessage( `${error.location.path} ${error.message}`, 'Negative' );
                    } else {
                        this.parentNode.showMessage( error.message, 'Negative' );
                    }
                }
            } else {
                this.parentNode.showMessage( e.message, 'Negative' );
            }
        }
    }

    confirmDelete( callback, event ) {
        let popover = this.shadowRoot.getElementById( 'confirm-delete-popover' );
        this.clearMessages( popover.querySelector( '.messages' ) );
        popover.callback = callback;
        popover.open( event.target );
    }

    async doDelete() {
        let popover = this.shadowRoot.getElementById( 'confirm-delete-popover' );
        try {
            await popover.callback();
            popover.close();
        } catch( e ) {
            if( e.data && e.data.errors ) {
                for( let error of e.data.errors ) {
                    if( error.location.path ) {
                        this.addMessage( popover.querySelector( '.messages' ), `${error.location.path} ${error.message}` );
                    } else {
                        this.addMessage( popover.querySelector( '.messages' ), error.message );
                    }
                }
            } else {
                this.addMessage( popover.querySelector( '.messages' ), e.message );
            }
        }
    }
    
    populateList( values, panelSelector, templateSelector, nodeSelector, editable, processNodeCb ) {
        var panel = this.shadowRoot.querySelector( panelSelector );
        if( !panel ) {
            // not configured yet
            return;
        }

        var nodeTemplate = this.shadowRoot.getElementById( templateSelector ).content;
        var nodes = panel.querySelectorAll( nodeSelector );

        var path = null;
        if( typeof( values ) === 'string' ) {
            path = values;
            values = Binding.resolvePath( clientAPI, path ) || [];
        }

        var idx = 0;
        for( ; idx < values.length; ++idx ) {
            let value = values[idx];
            if( nodes[idx] ) {
                nodes[idx].binding.update( path ? clientAPI : value, {
                    editable: editable
                });
            } else {
                let node = nodeTemplate.cloneNode( true ).querySelector( nodeSelector );
                node.binding = new Binding( node, path ? clientAPI : value, {
                    path: path && `${path}[${idx}]`,
                    readOnly: true,
                    editable: editable
                });
                if( processNodeCb ) {
                    processNodeCb( node, value );
                }
                panel.appendChild( node );
            }
        }

        for( ; idx < nodes.length; ++idx ) {
            panel.removeChild( nodes[idx] );
        }
    }

    async connectedCallback() {
        if( !template ) {
            template = await ( await fetch( './tmpl/BaseEditor.tmpl.html' ) ).text();
        }

        this.shadowRoot.innerHTML = ( this.template || '' ) + template;

        this.editButton = this.shadowRoot.getElementById( 'edit-button' );
        if( this.editButton ) {
            this.editButton.addEventListener( 'click', this.refresh.bind( this ) );
        }

        if( this.bindingPath != null ) {
            this.binding = new Binding( this.shadowRoot, clientAPI, {
                path: this.bindingPath,
                editable: this.editButton && this.editButton.pressed
            });
            this.binding.on( 'change', this.handleErrors.bind( this, this.save ) );

            if( this.changeEvent != null ) {
                clientAPI.on( this.changeEvent, () => {
                    this.binding.update( clientAPI, {
                        editable: this.editButton && this.editButton.pressed
                    });
                });
            }
        }

        this.editButton = this.shadowRoot.getElementById( 'edit-button' );
        this.editButton.addEventListener( 'click', this.refresh.bind( this ) );

        this.shadowRoot.getElementById( 'refresh-button' ).addEventListener( 'click', this.refresh.bind( this ) );
        this.shadowRoot.getElementById( 'delete-button' ).addEventListener( 'click', this.confirmDelete.bind( this, this.delete.bind( this ) ) );
        this.shadowRoot.getElementById( 'confirm-delete-popover-submit' ).addEventListener( 'click', this.doDelete.bind( this ) );
    }

    async refresh() {
        throw new Error( 'Method refresh not implemented' );
    }
}

export default BaseEditor;
