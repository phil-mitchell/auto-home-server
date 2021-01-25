'use strict';

const UserController = require( './User' );
const MemberController = require( './Member' );
const Influx = require( 'influx' );

const ACCESS_READ_ONLY = Symbol( 'ReadOnlyAccess' );
const ACCESS_EDIT = Symbol( 'EditAccess' );
const ACCESS_MANAGE = Symbol( 'ManageAccess' );

module.exports = class HomeController {
    static get READ_ONLY() {
        return ACCESS_READ_ONLY;
    }
    static get EDIT() {
        return ACCESS_EDIT;
    }
    static get MANAGE() {
        return ACCESS_MANAGE;
    }

    static async checkHomePermissions( reqContext, home, permissions ) {
        if( !permissions ) {
            permissions = [ ACCESS_READ_ONLY ];
        } else if( !Array.isArray( permissions ) ) {
            permissions = [ permissions ];
        }
        permissions = new Set( permissions );

        var membership = await MemberController.getMembershipForCurrentUserAndHome(
            reqContext, home, permissions.has( ACCESS_EDIT ) || permissions.has( ACCESS_MANAGE )
        );

        if( !membership ) {
            throw reqContext.makeError( 404, `No home found with id ${home.id}` );
        }

        if( permissions.has( ACCESS_MANAGE ) && ( !membership || !membership.manager ) ) {
            throw reqContext.makeError( 403, `Not authorized to manage home ${home.name}` );
        }

        if( permissions.has( ACCESS_EDIT ) && ( !membership || !membership.editor ) ) {
            throw reqContext.makeError( 403, `Not authorized to edit contents of home ${home.name}` );
        }
    }

    static async getHomeById( reqContext, home_id, permissions ) {
        if( !home_id ) {
            return null;
        }

        let db = reqContext.extraContext.store.db;
        let homes = db.table( 'homes' );

        let home = await homes.get( home_id ).run();

        if( home ) {
            delete home['@etag'];
            home['@etag'] = reqContext.extraContext.store.etag( home );
        } else {
            throw reqContext.makeError( 404, `No home found with id ${home_id}` );
        }

        await module.exports.checkHomePermissions( reqContext, home, permissions );

        return home;
    }

    static async getRequestHome( reqContext, permissions ) {
        let home_path = reqContext.requestObjectPath.indexOf( 'homes' );
        if( home_path === -1 || reqContext.requestObjectPath.length <= home_path ) {
            throw reqContext.makeError( 500, `No home in the path` );
        }

        var home_id = reqContext.requestObjectPath[ home_path + 1 ];

        if( !reqContext.home || !reqContext.home.home ) {
            reqContext.home = reqContext.home || {};
            reqContext.home.home = await module.exports.getHomeById( reqContext, home_id, permissions );
        } else {
            await module.exports.checkHomePermissions( reqContext, reqContext.home.home, permissions );
        }

        return reqContext.home.home;
    }

    static async create( reqContext ) {
        var currentUser = await UserController._getCurrentUser( reqContext, true );

        let db = reqContext.extraContext.store.db;
        let homes = db.table( 'homes' );
        let members = db.table( 'members' );

        delete reqContext.requestBody.id;
        delete reqContext.requestBody['@etag'];

        let res = await homes.insert( reqContext.requestBody, { returnChanges: true }).run();
        let home = res.changes[0].new_val;

        await members.insert({
            user: currentUser.id,
            home: home.id,
            joined: reqContext.extraContext.store.r.now(),
            active: true,
            manager: true,
            editor: true
        }, { returnChanges: true }).run();

        return home;
    }

    static async find( reqContext ) {
        var currentUser = await UserController._getCurrentUser( reqContext, false );

        let homes = reqContext.extraContext.store.db.table( 'homes' );
        let members = reqContext.extraContext.store.db.table( 'members' );

        return homes.outerJoin(
            members, ( home, member ) => member( 'active' ).eq( true ).and(
                home( 'id' ).eq( member( 'home' ) )
            ).and(
                member( 'user' ).eq( currentUser.id )
            )
        ).filter(
            row => row( 'right' ).ne( null )
        ).map( row => row( 'left' ) ).distinct().orderBy( 'name' ).run();
    }

    static async get( reqContext ) {
        return this.getRequestHome( reqContext );
    }

    static async update( reqContext ) {
        var home = await this.getRequestHome( reqContext, ACCESS_MANAGE );
        var replace = reqContext.req.method === 'PUT';

        if( home['@etag'] !== reqContext.requestBody['@etag'] ) {
            throw reqContext.makeError( 409, `Home ${home.name} was edited by another request` );
        }
        delete reqContext.requestBody['@etag'];
        delete reqContext.requestBody['@editor'];
        delete reqContext.requestBody['@manager'];
        delete reqContext.requestBody['@editable'];

        reqContext.requestBody.id = home.id;

        let homes = reqContext.extraContext.store.db.table( 'homes' );

        let res = homes.get( home.id );
        if( replace ) {
            res = res.replace( reqContext.requestBody, { returnChanges: 'always' });
        } else {
            res = res.update( reqContext.requestBody, { returnChanges: 'always' });
        }
        res = await res.run();
        return res.changes[0].new_val;
    }

    static async remove( reqContext ) {
        var home = await this.getRequestHome( reqContext, ACCESS_MANAGE );

        let homes = reqContext.extraContext.store.db.table( 'homes' );
        let members = reqContext.extraContext.store.db.table( 'members' );

        await members.filter({ home: home.id }).delete().run();
        await homes.get( home.id ).delete().run();
        return true;
    }

    static async formatResponse( reqContext, value ) {
        let operationName = reqContext.requestObjectPath[reqContext.requestObjectPath.length-1];
        if( operationName === 'addOverride' || operationName === 'cancelOverride' || operationName === 'querySensorReadings' ) {
            const ZoneController = require( './Zone' );
            return ZoneController.formatResponse( reqContext, value );
        }

        if( !value['@etag'] ) {
            delete value['@etag'];
            value['@etag'] = reqContext.extraContext.store.etag( value );
        }

        value['@editor'] = false;
        value['@manager'] = false;
        let currentUser = await UserController._getCurrentUser( reqContext, true );
        let membership = null;
        if( currentUser ) {
            let members = reqContext.extraContext.store.db.table( 'members' );
            membership = ( await members.filter({
                'home': value.id,
                'active': true,
                'user': currentUser.id
            }).run() )[0];
        }
        value['@manager'] = !!( membership && membership.manager );
        value['@editor'] = !!( membership && membership.editor );
        value['@editable'] = !!( membership && membership.manager );
        return value;
    }

    static async callOperation( reqContext ) {
        let operationName = reqContext.requestObjectPath[reqContext.requestObjectPath.length-1];
        if( operationName === 'addOverride' || operationName === 'cancelOverride' ) {
            let home = await this.getRequestHome( reqContext, ACCESS_EDIT );

            const ZoneController = require( './Zone' );

            let zones = await ZoneController.find( reqContext, reqContext.requestBody.zones );
            let res = true;
            for( let zone of zones ) {
                reqContext.home.zone = zone;
                res = res && await ZoneController.callOperation( reqContext );
            }

            return res;
        } else if( operationName === 'querySensorReadings' ) {
            let home = await this.getRequestHome( reqContext, ACCESS_READ_ONLY );

            let influx = reqContext.extraContext.store.influx;
            let filter = reqContext.requestBody;

            let query = `select * from sensor_readings where ` +
                `time >= ${Influx.escape.stringLit( filter.start )} and ` +
                `time <= ${Influx.escape.stringLit( filter.end )} and ` +
                `home = ${Influx.escape.stringLit( home.id )}`;

            if( filter.sensor ) {
                query = `${query} and sensor = ${Influx.escape.stringLit( filter.sensor )}`;
            }

            if( filter.type ) {
                query = `${query} and type = ${Influx.escape.stringLit( filter.type )}`;
            }

            query = `${query} order by time asc`;

            return{ readings: ( await influx.query( query ) ).map( r => {
                r.value = {
                    value: r.value,
                    unit: r.unit
                };
                delete r.unit;
                try {
                    r.data = JSON.parse( r.data || '{}' );
                } catch( e ) {
                    r.data = {};
                }
            }) };
        }
        
        let home = await this.getRequestHome( reqContext, ACCESS_MANAGE );
        let memberships = reqContext.extraContext.store.db.table( 'memberships' );

        let res = await memberships.insert( Object.assign( reqContext.requestBody, {
            home: home.id,
            joined: reqContext.extraContext.store.r.now(),
            active: false
        }), { returnChanges: true }).run();

        return res.changes[0].new_val;
    }
};
