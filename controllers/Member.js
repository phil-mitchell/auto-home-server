'use strict';

const UserController = require( './User' );

module.exports = class MemberController {
    static async getMembershipForCurrentUserAndHome( reqContext, home, needsWrite ) {
        if( needsWrite == null && typeof( home ) !== 'object' ) {
            needsWrite = home;
            home = null;
        }

        var currentUser = await UserController.getCurrentUser( reqContext, needsWrite );
        if( !currentUser ) {
            return null;
        }

        let members = reqContext.extraContext.store.db.table( 'members' );
        let homeId = home ? home.id : ( reqContext.home.home ? reqContext.home.home.id : reqContext.requestObjectPath[2] );

        if( !reqContext.home || !reqContext.home.membership ) {
            reqContext.home = reqContext.home || {};
            reqContext.home.membership = ( await members.filter({
                'home': homeId,
                'active': true,
                'user': currentUser.id
            }).run() )[0];
        }

        return reqContext.home.membership;
    }

    static async getMembershipsForCurrentUser( reqContext, needs_write ) {
        var currentUser = await UserController.getCurrentUser( reqContext, needs_write );
        if( !currentUser ) {
            return null;
        }

        let members = reqContext.extraContext.store.db.table( 'members' );

        if( !reqContext.home || !reqContext.home.memberships ) {
            reqContext.home = reqContext.home || {};
            reqContext.home.memberships = await members.filter({
                'active': true,
                'user': currentUser.id
            }).run();
        }

        return reqContext.home.memberships;
    }

    static async getMembershipsForRequestUser( reqContext ) {
        var currentUser = await UserController.getRequestUser( reqContext );
        if( !currentUser ) {
            return null;
        }

        let members = reqContext.extraContext.store.db.table( 'members' );

        if( !reqContext.home || !reqContext.home.requestMemberships ) {
            reqContext.home = reqContext.home || {};
            reqContext.home.requestMemberships = await members.filter({
                'active': true,
                'user': currentUser.id
            }).run();
        }

        return reqContext.home.requestMemberships;
    }

    static async getRequestMembership( reqContext, needs_write, inactive ) {
        var currentUser = await UserController.getCurrentUser( reqContext, needs_write );
        if( !currentUser ) {
            return null;
        }

        let members = reqContext.extraContext.store.db.table( 'members' );

        if( reqContext.requestObjectPath[1].toLowerCase() === 'users' ) {
            var requestUser = await UserController.getRequestUser( reqContext );
            if( !requestUser ) {
                throw reqContext.makeError( 404, `No user found with id ${reqContext.requestObjectPath[2]}` );
            }

            return( await members.filter({
                'active': !inactive,
                'user': requestUser.id,
                'id': reqContext.requestObjectPath[4]
            }).run() )[0];
        } else if( reqContext.requestObjectPath[1].toLowerCase() === 'user' ) {
            return( await members.filter({
                'active': !inactive,
                'user': currentUser.id,
                'id': reqContext.requestObjectPath[3]
            }).run() )[0];
        } else {
            let currentMembership = await module.exports.getMembershipForCurrentUserAndHome( reqContext, needs_write );
            if( !currentMembership ) {
                throw reqContext.makeError( 404, `No home found with id ${reqContext.requestObjectPath[2]}` );
            }

            return( await members.filter({
                'active': !inactive,
                'home': currentMembership.home,
                'id': reqContext.requestObjectPath[4]
            }).filter( membership => currentMembership.manager || membership( 'user' ).eq( currentMembership.user ) ).run() )[0];
        }
    }

    static async find( reqContext ) {
        if( reqContext.requestObjectPath[1].toLowerCase() === 'user' ) {
            return this.getMembershipsForCurrentUser( reqContext, false );
        } else if( reqContext.requestObjectPath[1].toLowerCase() === 'users' ) {
            return this.getMembershipsForRequestUser( reqContext );
        } else {
            var currentMembership = await this.getMembershipForCurrentUserAndHome( reqContext, false );
            if( !currentMembership ) {
                throw reqContext.makeError( 404, `No home found with id ${reqContext.requestObjectPath[2]}` );
            }

            let members = reqContext.extraContext.store.db.table( 'members' );

            return members.filter({
                'active': true,
                'home': currentMembership.home
            }).filter( membership => currentMembership.manager || membership( 'user' ).eq( currentMembership.user ) ).run();
        }
    }

    static async get( reqContext ) {
        return this.getRequestMembership( reqContext, false );
    }

    static async update( reqContext ) {
        let member = await this.getRequestMembership( reqContext, true );

        if( !member ) {
            throw reqContext.makeError( 404, `Membership not found` );
        }

        if( member['@etag'] !== reqContext.requestBody['@etag'] ) {
            throw reqContext.makeError( 409, `Membership was edited by another request` );
        }
        delete reqContext.requestBody['@etag'];
        delete reqContext.requestBody.user;
        delete reqContext.requestBody.home;

        let memberships = reqContext.extraContext.store.db.table( 'memberships' );
        let res = await memberships.get( member.id ).update( reqContext.requestBody, { returnChanges: 'always' }).run();
        return res.changes[0].new_val;
    }

    static async remove( reqContext ) {
        let member = await this.getRequestMembership( reqContext, true );

        if( !member ) {
            throw reqContext.makeError( 404, `Membership not found` );
        }

        let members = reqContext.extraContext.store.db.table( 'members' );
        await members.get( member.id ).delete().run();
        return true;
    }

    static async formatResponse( reqContext, value ) {
        if( !value['@etag'] ) {
            delete value['@etag'];
            value['@etag'] = reqContext.extraContext.store.etag( value );
        }
        if( typeof( value.user ) !== 'object' ) {
            let user = await UserController.getUserById( reqContext, value.user );
            value.user = {
                id: value.user,
                name: ( user || {}).name,
                image: ( user || {}).image
            };
        }
        if( typeof( value.home ) === 'string' ) {
            const HomeController = require( './Home' );
            let home = await HomeController.getHomeById( reqContext, value.home );
            value.home = {
                id: value.home,
                name: ( home || {}).name
            };
        }
        return value;
    }

    static async callOperation( reqContext ) {
        let member = await this.getRequestMembership( reqContext, true, true );

        if( !member ) {
            throw reqContext.makeError( 404, `Membership not found or already activated` );
        }

        let members = reqContext.extraContext.store.db.table( 'members' );
        await members.get( member.id ).update({ active: true }).run();
    }
};
