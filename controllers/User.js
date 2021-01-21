'use strict';

module.exports = class UserController {
    static async getUserById( reqContext, id ) {
        let users = reqContext.extraContext.store.db.table( 'users' );
        return users.get( id ).run();
    }

    static async _getCurrentUser( reqContext, needs_write ) {
        if( needs_write && ( !reqContext.user.id || reqContext.user.read_only ) ) {
            throw reqContext.makeError( 403, `Not authorized to make changes with read-only user` );
        }

        if( !reqContext.user.id ) {
            return null;
        }

        let users = reqContext.extraContext.store.db.table( 'users' );

        if( !reqContext.home || !reqContext.home.user ) {
            reqContext.home = reqContext.home || {};
            reqContext.home.user = await users.get( reqContext.user.id ).run();
            if( reqContext.home.user ) {
                delete reqContext.home.user['@etag'];
                reqContext.home.user['@etag'] = reqContext.extraContext.store.etag( reqContext.home.user );
            }
        }

        if( needs_write && ( !reqContext.home.user || reqContext.home.user.read_only ) ) {
            throw reqContext.makeError( 403, `Not authorized to make changes with read-only user` );
        }

        return reqContext.home.user;
    }

    static async getCurrentUser( reqContext ) {
        return await module.exports._getCurrentUser( reqContext );
    }

    static async getRequestUser( reqContext ) {
        var visibleUsers = await module.exports.find( reqContext );
        var wantId = reqContext.requestObjectPath[2];

        for( let user of visibleUsers ) {
            if( user.id === wantId ) {
                return user;
            }
        }

        return null;
    }

    static async find( reqContext ) {
        var currentUser = await module.exports._getCurrentUser( reqContext );
        if( !currentUser ) {
            return[];
        }

        let users = reqContext.extraContext.store.db.table( 'users' );

        return( await Promise.all( currentUser.email.map( async( email ) => {
            return users.filter( user => user( 'email' ).contains( email ) ).run();
        }) ) ).reduce( ( acc, val ) => acc.concat( val || [] ), [] );
    }

    static async get( reqContext ) {
        if( reqContext.requestObjectPath[1] === 'user' ) {
            return module.exports._getCurrentUser( reqContext );
        }
        return module.exports._getRequestUser( reqContext );
    }

    static async update( reqContext ) {
        var visibleUsers = await module.exports.find( reqContext );
        var wantId = reqContext.requestObjectPath[reqContext.requestObjectPath.length-1];

        var updateUser = null;
        for( let user of visibleUsers ) {
            let uid = user.id;
            if( uid === wantId ) {
                updateUser = user;
            }
        }

        if( updateUser === null ) {
            throw reqContext.makeError( 404, `No user found with id ${wantId}` );
        }

        if( updateUser['@etag'] !== reqContext.requestBody['@etag'] ) {
            throw reqContext.makeError( 409, `User ${updateUser.id} was edited by another request` );
        }

        delete reqContext.requestBody['@etag'];

        let users = reqContext.extraContext.store.db.table( 'users' );
        let res = await users.get( wantId ).update( reqContext.requestBody, { returnChanges: 'always' }).run();
        return res.changes[0].new_val;
    }

    static async formatResponse( reqContext, value ) {
        if( !value['@etag'] ) {
            delete value['@etag'];
            value['@etag'] = reqContext.extraContext.store.etag( value );
        }
        return value;
    }

    static async remove( reqContext ) {
        var wantId = reqContext.requestObjectPath[reqContext.requestObjectPath.length-1];

        let db = reqContext.extraContext.store.db;

        if( !reqContext.user.read_only && reqContext.user.id === wantId ) {
            await db.table( 'members' ).filter({ user: wantId }).delete().run();
            await db.table( 'users' ).get( wantId ).delete().run();
        }
        return true;
    }

    static async findOrCreateUser( reqContext ) {
        let users = reqContext.extraContext.store.db.table( 'users' );
        var duplicates = ( await Promise.all( reqContext.requestBody.email.map( async( email ) => {
            return users.filter( user => user( 'email' ).contains( email ) ).run();
        }) ) ).reduce( ( acc, val ) => acc.concat( val || [] ), [] );
        let res = null;
        if( duplicates.length ) {
            // update with any additional email addresses
            let item = duplicates[0];
            let updates = {
                name: item.name || reqContext.requestBody.name,
                active: true,
                email: [ ...new Set( item.email.concat( reqContext.requestBody.email ) ) ],
                image: reqContext.requestBody.image || item.image
            };
            res = await users.get( item.id ).update( updates, { returnChanges: 'always' }).run();
        } else {
            res = await users.insert( reqContext.requestBody, { returnChanges: true }).run();
        }
        return res.changes[0].new_val;
    }

    static async callOperation( reqContext ) {
        let operationName = reqContext.requestObjectPath[reqContext.requestObjectPath.length-1];

        let user = await this.getCurrentUser( reqContext );

        let r = reqContext.extraContext.store.r;
        let db = reqContext.extraContext.store.authdb;
        let apiKeys = db.table( 'api_keys' );

        if( operationName === 'addAPIKey' ) {
            return( await apiKeys.insert({
                name: reqContext.requestBody.name,
                value: r.uuid(),
                user: user.id
            }, { returnChanges: true }).run() ).changes[0].new_val;
        } else if( operationName === 'revokeAPIKey' ) {
            await apiKeys.filter({
                id: reqContext.requestBody.id,
                user: user.id
            }).delete().run();
            return true;
        }

        throw new Error( `Unknown operation ${operationName}` );
    }
};
