'use strict';

const express = require( 'express' );
const exegesisExpress = require( 'exegesis-express' );
const http = require( 'http' );
const path = require( 'path' );
const parseUrl = require( 'parseurl' );
const fs = require( 'fs' );
const Influx = require( 'influx' );

const crypto = require( 'crypto' );

var exegesisPassport = require( 'exegesis-passport' ).exegesisPassport;
var passport = require( 'passport' );
var jwt = require( 'jsonwebtoken' );
var passportJWT = require( 'passport-jwt' );

var UserController = require( './controllers' ).User;

var rethinkdb = null;
var influxdb = null;

class Model {
    static get r() {
        if( !rethinkdb ) {
            var config = require( 'config' );
            rethinkdb = require( 'rethinkdbdash' )( config.rethinkdb );
        }
        return rethinkdb;
    }

    static get db() {
        return rethinkdb.db( 'home' );
    }

    static get authdb() {
        return rethinkdb.db( 'auth' );
    }

    static get influx() {
        if( !influxdb ) {
            var config = require( 'config' );
            influxdb = new Influx.InfluxDB( Object.assign({
                schema: [ {
                    measurement: 'sensor_readings',
                    fields: {
                        value: Influx.FieldType.FLOAT,
                        unit: Influx.FieldType.STRING,
                        data: Influx.FieldType.STRING
                    },
                    tags: [
                        'home', 'zone', 'sensor', 'type'
                    ]
                } ]
            }, config.influx ) );
        }
        return influxdb;
    }

    static etag( data ) {
        const hash = crypto.createHash( 'sha256' );
        hash.update( JSON.stringify( data ) );
        return hash.digest( 'hex' );
    }
}

async function initDatabase() {
    try {
        await Model.r.dbCreate( 'home' );
    } catch( e ) {
    }

    let db = Model.r.db( 'home' );
    for( let table of[
        'users', 'homes', 'members', 'zones', 'temperatures'
    ] ) {
        try {
            await db.tableCreate( table );
        } catch( e ) {
        }
    }

    try {
        await Model.r.dbCreate( 'auth' );
    } catch( e ) {
    }

    db = Model.r.db( 'auth' );
    for( let table of[
        'refresh_tokens', 'api_keys'
    ] ) {
        try {
            await db.tableCreate( table );
        } catch( e ) {
        }
    }

    try {
        var config = require( 'config' );
        let influxDatabases = await Model.influx.getDatabaseNames();
        if( !influxDatabases.includes( config.influx.database ) ) {
            await Model.influx.createDatabase( config.influx.database );
        }
    } catch( e ) {
        console.error( e.stack );
    }
}

async function apiKeyAuthenticator( context, info ) {
    let key = context.req.query.api_key;
    if( !key ) {
        return{ type: 'missing', statusCode: 401, message: 'API key not provided' };
    }
    
    let db = Model.r.db( 'auth' );
    let apiKeys = db.table( 'api_keys' );

    let foundKey = ( await apiKeys.filter({
        value: key
    }).run() )[0];

    if( !foundKey ) {
        return{ type: 'invalid', statusCode: 401, message: 'Invalid API key' };
    }

    return{ type: 'success', user: { id: foundKey.user, read_only: false } };
}

async function cleanRefreshTokens() {
    await Model.r.db( 'auth' ).table( 'refresh_tokens' ).filter(
        Model.r.row( 'exp' ).lt( Math.ceil( new Date().getTime() / 1000 ) )
    ).delete().run();
}

async function createRefreshToken( userInfo ) {
    var config = require( 'config' );

    await cleanRefreshTokens();
    return( await Model.r.db( 'auth' ).table( 'refresh_tokens' ).insert({
        userInfo: userInfo,
        exp: Math.ceil( new Date().getTime() / 1000 ) + ( config.refresh_token_expiry || 86400 )
    }, { returnChanges: true }).run() ).changes[0].new_val;
}

async function replaceRefreshToken( token, userInfo ) {
    await Model.r.db( 'auth' ).table( 'refresh_tokens' ).get( token ).run();
    return createRefreshToken( userInfo );
}

async function lookupRefreshToken( token ) {
    await cleanRefreshTokens();
    return Model.r.db( 'auth' ).table( 'refresh_tokens' ).get( token ).run();
}

async function googleAuthHandler( context, tokens, me ) {

    var reqContext = {
        extraContext: {
            store: context.extraContext.store
        },
        requestBody: {
            name: me.names[0].displayName,
            email: ( me.emailAddresses && me.emailAddresses.map( x => x.value ) ) || [],
            image: me.photos && me.photos[0] && me.photos[0].url,
            active: true,
            read_only: false
        }
    };

    var user = await UserController.findOrCreateUser( reqContext );
    if( !user || !user.active ) {
        context.res.status( 404 );
        context.res.set( 'Content-Type', 'text/html' );
        return`
<html>
<head>
<script>window.opener.postMessage(${ JSON.stringify({ message: 'Unauthorized' }) });</script>
</head>
<body>
Unauthorized.
</body>
</html>
`;
    }

    var config = require( 'config' );
    var jwtSecret = config.jwt_secret || 'mysecret';

    var token = {
        exp: Math.ceil( new Date().getTime() / 1000 ) + ( config.user_token_expiry || 1800 ),
        userInfo: {
            id: user.id,
            read_only: user.read_only
        }
    };

    let refreshToken = await createRefreshToken( token.userInfo );

    context.res.set( 'Content-Type', 'text/html' );

    var data = { token: jwt.sign( token, jwtSecret ), refresh_token: refreshToken.id, expiry_date: token.exp * 1000 };
    return`
<html>
<head>
<script>window.opener.postMessage(${ JSON.stringify( data ) });</script>
</head>
<body>
Authentication success: ${data.token}
</body>
</html>
`;
}

async function refreshTokenAuthHandler( refreshToken ) {
    let info = await lookupRefreshToken( refreshToken );

    var config = require( 'config' );
    var jwtSecret = config.jwt_secret || 'mysecret';

    var token = {
        exp: Math.ceil( new Date().getTime() / 1000 ) + ( config.user_token_expiry || 1800 ),
        userInfo: info.userInfo
    };

    refreshToken = await replaceRefreshToken( refreshToken, token.userInfo );
    return{
        token: jwt.sign( token, jwtSecret ), refresh_token: refreshToken.id, expiry_date: token.exp * 1000
    };
}

function serveStaticJSON( root ) {
    if( !root ) {
        throw new TypeError( 'root path required' );
    }

    if( typeof root !== 'string' ) {
        throw new TypeError( 'root path must be a string' );
    }

    var fallthrough = express.static( root );

    return function serveStatic( req, res, next ) {
        if( req.method !== 'GET' && req.method !== 'HEAD' ) {
            // method not allowed
            res.statusCode = 405;
            res.setHeader( 'Allow', 'GET, HEAD' );
            res.setHeader( 'Content-Length', '0' );
            res.end();
            return;
        }

        var originalUrl = parseUrl.original( req );
        var urlPath = parseUrl( req ).pathname;

        if( !urlPath.endsWith( '.json' ) ) {
            fallthrough( req, res, next );
            return;
        }

        // make sure redirect occurs at mount
        if( urlPath === '/' && originalUrl.pathname.substr( -1 ) !== '/' ) {
            urlPath = '';
        }

        fs.readFile( path.join( root, urlPath ), function( err, contents ) {
            if( err ) {
                next( err );
                return;
            }
            res.setHeader( 'Content-Type', 'application/javascript' );
            res.send( 'export default ' + contents );
        });
    };
}

async function createServer() {
    // See https://github.com/exegesis-js/exegesis/blob/master/docs/Options.md
    const app = express();

    app.use( passport.initialize() );

    var config = require( 'config' );
    const jwtSecret = config.jwt_secret || 'mysecret';

    const controllers = require( './controllers' );

    await initDatabase();

    var jsonSchemaPlugin = require( 'exegesis-plugin-jsonschema' )();
    await jsonSchemaPlugin.addSchema( __dirname + '/model/root.json', '/api' );

    const options = {
        controllers: controllers,
        authenticators: {
            jwt: exegesisPassport( new passportJWT.Strategy({
                jwtFromRequest: passportJWT.ExtractJwt.fromAuthHeaderAsBearerToken(),
                secretOrKey: jwtSecret
            }, function( jwt_payload, next ) {
                next( null, jwt_payload.userInfo );
            }), {
                isPresent: ( context ) => ( context.req.headers.authorization || '' ).startsWith( 'bearer ' )
            }),
            api_key: apiKeyAuthenticator
        },
        allowMissingControllers: false,
        plugins: [
            require( 'exegesis-plugin-context' )({
                store: Model
            }),
            require( 'exegesis-plugin-clientapi' )(),
            jsonSchemaPlugin,
            require( 'exegesis-plugin-swagger-ui-express' )({
                app: app,
                path: '/api-docs',
                swaggerUIOptions: { customSiteTitle: 'Home API' }
            }),
            require( './refresh-token' )({
                path: '/auth/refresh',
                callback: refreshTokenAuthHandler
            })
        ]
    };

    if( config.authentication && config.authentication.google ) {
        options.plugins.push( require( 'exegesis-plugin-google-oauth2' )( Object.assign({
            app: app,
            path: '/auth/google',
            callback: googleAuthHandler
        }, config.authentication.google ) ) );
    }

    // This creates an exgesis middleware, which can be used with express,
    // connect, or even just by itself.
    const exegesisMiddleware = await exegesisExpress.middleware(
        path.resolve( __dirname, './openapi.yaml' ),
        options
    );

    // If you have any body parsers, this should go before them.
    app.use( exegesisMiddleware );

    app.use( '/modules', serveStaticJSON( path.join( __dirname, 'node_modules' ) ) );
    app.get( '/*', express.static( path.join( __dirname, 'ui' ) ) );

    // Return a 404
    app.use( ( req, res ) => {
        res.status( 404 ).json({ message: `Not found` });
    });

    // Handle any unexpected errors
    app.use( ( err, req, res, next ) => {
        res.status( 500 ).json({ message: `Internal error: ${err.message}` });
        next();
    });

    const server = http.createServer( app );

    return server;
}

createServer()
.then( server => {
    server.listen( 8082 );
    console.log( 'Listening on port 8082' );
    console.log( 'Try visiting http://localhost:8082/api-docs' );
})
.catch( err => {
    console.error( err.stack );
    process.exit( 1 );
});
