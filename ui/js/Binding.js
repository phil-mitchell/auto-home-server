import {JSONPath} from 'jsonpath-plus/dist/index-browser-esm.min.js';

class Binding{
    constructor( element, data, options ) {
        this.element = element;
        this.events = {};
        this.options = options || {};

        if( !this.options.readOnly ) {
            this._addListeners();
        }

        this.update( data );
    }

    on( event, listener ) {
        if( typeof this.events[event] !== 'object' ) {
            this.events[event] = [];
        }
        this.events[event].push( listener );
        return() => this.removeListener( event, listener );
    }
    removeListener( event, listener ) {
        if( typeof this.events[event] === 'object' ) {
            const idx = this.events[event].indexOf( listener );
            if( idx > -1 ) {
                this.events[event].splice( idx, 1 );
            }
        }
    }
    emit( event, ...args ) {
        if( typeof this.events[event] === 'object' ) {
            this.events[event].forEach( listener => listener.apply( this, args ) );
        }
    }
    once( event, listener ) {
        const remove = this.on( event, ( ...args ) => {
            remove();
            listener.apply( this, args );
        });
    }

    get editable() {
        return !!this.options.editable;
    }

    get readonly() {
        return !this.options.editable;
    }

    get path() {
        return this.options.path || '$';
    }
    
    update( data, options ) {
        if( data !== undefined ) {
            this.data = data;
        }
        if( options !== undefined ) {
            if( typeof( options ) !== 'object' ) {
                this.options.editable = options;
            }
            Object.assign( this.options, options );
        }
        this._updating = true;
        var self = this;
        try {
            function applyValues( node ) {
                for( let field in node.dataset ) {
                    let property = node.dataset[field];
                    let value = self.format( property, node );
                    if( field === 'bind' ) {
                        field = 'innerText';
                    }
                    node[field] = value;
                }
            }

            let stk = [];
            stk.push( this.element );

            while( stk.length > 0 ){
                let currentNode = stk.pop();

                applyValues( currentNode );

                if( currentNode === this.element || !currentNode.binding ) {
                    for( let childNode of ( ( currentNode || {}).childNodes || [] ) ){
                        stk.push( childNode );
                    }
                }
            }
        } finally {
            this._updating = false;
        }
    }

    _addListeners() {
        let nodes = this.element.querySelectorAll( '*' );
        for( let node of nodes ) {
            node.addEventListener( 'change', event => {
                this._handleChange( node, event );
            });
        }
    }

    _handleChange( node, event ) {
        if( this._updating ) {
            return;
        }

        let changes = [];
        for( let field in node.dataset ) {
            let path = node.dataset[field];

            if( path === '@editable' || path === '@readonly' || path === '@path' ) {
                continue;
            }

            let value = this.parse( node[field === 'bind' ? 'innerText' : field], node );

            let pathArray = JSONPath.toPathArray( path );
            if( pathArray[0] !== '$' ) {
                pathArray = ['$'].concat( pathArray );
            }
            let property = pathArray.pop();

            let data = JSONPath({
                wrap: false,
                path: this.path,
                json: this.data
            });

            data = JSONPath({
                wrap: false,
                path: pathArray,
                json: data
            });

            let oldValue = property === '$' ? undefined : data[property];
            if( oldValue !== value ) {
                if( property === '$' ) {
                    if( typeof( data ) === 'object' ) {
                        Object.assign( data, value );
                    } else {
                        data = value;
                    }
                } else {
                    data[property] = value;
                }

                changes.push({
                    field: field,
                    property: path,
                    old: oldValue,
                    new: value,
                    data: this.data
                });
            }
        }

        if( changes.length ) {
            this.emit( 'change', {
                changes: changes,
                event: event
            });
        }
    }

    static resolvePath( data, path ) {
        return JSONPath({
            wrap: false,
            path: path,
            json: data
        });
    }

    format( path, node ) {
        if( path === '@editable' ) {
            return !this.readonly;
        }
        if( path === '@readonly' ) {
            return this.readonly;
        }
        if( path === '@path' ) {
            return this.path;
        }

        let value = JSONPath({
            wrap: false,
            path: this.path,
            json: this.data
        });

        value = JSONPath({ wrap: false, path: path, json: value });

        if( value == null ) {
            value = '';
        } else if( node.localName === 'ui5-duration-picker' ) {
            let hours = Math.floor( value / 3600 );
            value %= 3600;
            let minutes = Math.floor( value / 60 );
            let seconds = value % 60;
            
            value = `${hours}:${minutes}:${seconds}`;
        }

        return value;
    }

    parse( value, node ) {
        if( node.localName === 'ui5-duration-picker' ) {
            value = +( value.split( ':' ).reduce( ( acc, time ) => ( 60 * acc ) + +time ) );
        }
        return value;
    }
};

export default Binding;

