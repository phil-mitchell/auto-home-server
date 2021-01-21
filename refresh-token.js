'use strict';

const semver = require( 'semver' );
const url = require( 'url' );

const controllerName = 'exegesis-plugin-refresh-token';

class RefreshTokenPlugin {
    constructor( apiDoc, options ) {
        // Verify the apiDoc is an OpenAPI 3.x.x document, because this plugin
        // doesn't know how to handle anything else.
        if( !apiDoc.openapi ) {
            throw new Error( "OpenAPI definition is missing 'openapi' field" );
        }

        if( !semver.satisfies( apiDoc.openapi, '>=3.0.0 <4.0.0' ) ) {
            throw new Error( `OpenAPI version ${apiDoc.openapi} not supported` );
        }

        options = Object.assign({}, options );

        if( typeof( options.callback ) !== 'function' ) {
            throw new Error( 'options requires callback function' );
        }

        options.path = options.path || '/auth/refresh';

        this._options = options;

        apiDoc.paths = apiDoc.paths || {};
        apiDoc.paths[options.path] = {
            'get': {
                summary: 'Authenticate with a refresh token',
                'x-exegesis-controller': controllerName,
                operationId: 'authenticate ' + options.path,
                security: [],
                parameters: [ {
                    'in': 'query',
                    name: 'token',
                    required: true,
                    description: 'The refresh token',
                    schema: {
                        type: 'string'
                    }
                } ],
                responses: {
                    '200': {
                        description: 'Authentication was successful'
                    }
                }
            }
        };
    }

    preCompile({ options }) {
        var authOptions = this._options;

        options.controllers[controllerName] = options.controllers[controllerName] || {};
        options.controllers[controllerName]['authenticate ' + authOptions.path ] = async function( context ) {
            return authOptions.callback( context.params.query.token );
        };
    }
}

module.exports = function plugin( options ) {
    return{
        info: {
            name: 'exegesis-plugin-refresh-token'
        },
        options: options,
        makeExegesisPlugin: function makeExegesisPlugin({ apiDoc }) {
            return new RefreshTokenPlugin( apiDoc, options );
        }
    };
};
