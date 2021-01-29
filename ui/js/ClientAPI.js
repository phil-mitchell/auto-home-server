import ClientAPI from '../client/api.js';
import Quantity from './Quantity.js';

class AutoHomeClient extends ClientAPI{
    constructor() {
        super();
        
        this.events = {};
        this.login( JSON.parse( localStorage.getItem( 'autohomeauth' ) ) );

        window.addEventListener( 'popstate', event => {
            this.setState( event.state );
        });

        var hash = window.location.hash.split( '#' ).slice( 1 ).join( '#' ).split( '/' );
        var state = {};
        for( let i = 1; i < hash.length; i += 2 ) {
            state[hash[i]] = hash[i+1];
        }
        this.setState( state );
    }

    async setState( state ) {
        this.historyFrozen = true;
        await this.setHome( state.home );
        await this.setZone( state.zone );
        await this.setDevice( state.device );
        this.historyFrozen = false;
        this.updateHistory( true );
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

    _login( auth ) {
        if( !auth || !auth.token ) {
            this.logout();
            return false;
        }

        localStorage.setItem( 'autohomeauth', JSON.stringify( auth ) );
        
        this.setSecurity( 'jwt', auth.token, auth.expiry_date, async() => {
            if( auth.refresh_token ) {
                console.log( 'sending refresh request' );
                let newAuth = await this['get /auth/refresh']({
                    token: auth.refresh_token
                });
                console.log( 'setting new token value' );
                this._login( newAuth );
            }
            console.log( 'done refresh' );
        });

        return true;
    }

    login( auth ) {
        if( !this._login( auth ) ) {
            return;
        }
        this['get /api/user']().then( profile => {
            this.profile = profile;
            this.emit( 'profileChange' );
            this.loadHomes();
        }, error => {
            this.logout( error.message );
        });
    }

    logout( reason ) {
        localStorage.removeItem( 'autohomeauth' );
        this.clearSecurity();
        this.profile = null;
        this.emit( 'profileChange', reason );
        this.loadHomes();
    }

    isLoggedIn() {
        return !!( this.profile );
    }

    updateHistory( replace ) {
        if( this.historyFrozen ) {
            return;
        }
        var state = {};
        var title = '';
        if( this.home ) {
            state.home = this.home.id;
            title += '/home/' + state.home;
        }
        if( this.zone ) {
            state.zone = this.zone.id;
            title += '/zone/' + state.zone;
        }
        if( this.device ) {
            state.device = this.device.id;
            title += '/device/' + state.device;
        }

        var hash = `#${title}`;
        if( replace || window.location.hash === hash ) {
            history.replaceState( state, title, '#' + title );
        } else {
            history.pushState( state, title, '#' + title );
        }
        this.emit( 'stateChange', state );
    }

    loadHomes() {
        this['get /api/homes']().then( homes => {
            if( this.home && homes.filter( b => b.id === this.home.id ).length === 0 ) {
                this.setHome( null );
            }
            this.homes = homes;
            this.emit( 'homesChange', homes );
        }, error => {
            this.emit( 'apiError', error );
            this.setHome( null );
            this.homes = [];
            this.emit( 'homesChange', [] );
        });
    }

    async setHome( home ) {
        if( !home ) {
            if( this.home ) {
                this.home = null;
                this.loadHomes();
                this.updateHistory();
                this.emit( 'homeChange', null );
            }
            return null;
        }

        if( typeof( home ) === 'object' ) {
            this.home = home;
            this.updateHistory();
            this.emit( 'homeChange', home );
            this.loadZones();
            return home;
        }

        try {
            return this.setHome( await this['get /api/homes/{pathParam0}']( home ) );
        } catch( error ) {
            this.emit( 'apiError', error );
            return this.setHome( null );
        }
    }

    async saveHome() {
        let updatedHome = this.home;
        try {
            let home = await clientAPI['put /api/homes/{pathParam0}'](
                updatedHome.id, updatedHome
            );

            this.emit( 'homeSaved', home );
            return this.setHome( home );
        } catch( error ) {
            this.emit( 'apiError', error );
            throw error;
        }
    }

    async deleteHome() {
        let deletedHome = this.home;
        return clientAPI['delete /api/homes/{pathParam0}'](
            deletedHome.id
        ).then( () => {
            return this.setHome( null );
            this.emit( 'homeDeleted', deletedHome );
        }, error => {
            this.emit( 'apiError', error );
            return this.loadHomes();
        });
    }

    async loadMembers() {
        if( !this.home ) {
            this.setMember( null );
            this.emit( 'membersChange', [] );
            return;
        }
        try {
            let members = await clientAPI['get /api/homes/{pathParam0}/members']( this.home.id );
            if( this.member && members.filter( b => b.id === this.member.id ).length === 0 ) {
                this.setMember( null );
            }

            this.emit( 'membersChange', members );
        } catch( error ) {
            this.emit( 'apiError', error );
            this.setMember( null );
            this.emit( 'membersChange', [] );
        }
    }

    async postMember( data ) {
        if( !this.home ) {
            this.setMember( null );
            this.emit( 'membersChange', [] );
            return;
        }
        try {
            let member = await clientAPI['post /api/homes/{pathParam0}/members']( this.home.id, data );
            await this.loadMembers();
            await this.setMember( member );
        } catch( error ) {
            this.emit( 'apiError', error );
            throw error;
        }
    }

    async setMember( member ) {
        if( !member ) {
            if( this.member ) {
                this.member = null;
                this.loadMembers();
                this.updateHistory();
                this.emit( 'memberChange', null );
            }
            return{};
        }

        if( typeof( member ) === 'object' ) {
            this.member = member;
            this.updateHistory();
            this.emit( 'memberChange', member );
            return member;
        }

        try {
            return this.setMember( await this['get /api/homes/{pathParam0}/members/{pathParam1}'](
                this.home.id, member
            ) );
        } catch( error ) {
            this.emit( 'apiError', error );
            return this.setMember( null );
        }
    }

    async saveMember() {
        let updatedMember = this.member;
        try {
            let member = await clientAPI['put /api/homes/{pathParam0}/members/{pathParam1}'](
                this.home.id, updatedMember.id, updatedMember
            );
        
            this.emit( 'memberSaved', member );
            return this.setMember( member );
        } catch( error ) {
            this.emit( 'apiError', error );
            throw error;
        }
    }

    async deleteMember() {
        let deletedMember = this.member;
        return clientAPI['delete /api/homes/{pathParam0}/members/{pathParam1}'](
            this.home.id, deletedMember.id
        ).then( () => {
            return this.setMember( null );
            this.emit( 'memberDeleted', deletedMember );
        }, error => {
            this.emit( 'apiError', error );
            return this.loadMembers();
        });
    }

    async loadZones() {
        if( !this.home ) {
            this.setZone( null );
            this.emit( 'zonesChange', [] );
            return;
        }
        try {
            let zones = await clientAPI['get /api/homes/{pathParam0}/zones']( this.home.id );
            if( this.zone && zones.filter( b => b.id === this.zone.id ).length === 0 ) {
                this.setZone( null );
            }

            this.emit( 'zonesChange', zones );
        } catch( error ) {
            this.emit( 'apiError', error );
            this.setZone( null );
            this.emit( 'zonesChange', [] );
        }
    }

    async postZone( data ) {
        if( !this.home ) {
            this.setZone( null );
            this.emit( 'zonesChange', [] );
            return;
        }
        try {
            let zone = await clientAPI['post /api/homes/{pathParam0}/zones']( this.home.id, data );
            await this.loadZones();
            await this.setZone( zone );
        } catch( error ) {
            this.emit( 'apiError', error );
            throw error;
        }
    }

    async setZone( zone ) {
        if( !zone ) {
            if( this.zone ) {
                this.zone = null;
                this.loadZones();
                this.updateHistory();
                this.emit( 'zoneChange', null );
            }
            return{};
        }

        if( typeof( zone ) === 'object' ) {
            this.zone = zone;
            this.updateHistory();
            this.emit( 'zoneChange', zone );
            this.loadDevices();
            return zone;
        }

        try {
            return this.setZone( await this['get /api/homes/{pathParam0}/zones/{pathParam1}'](
                this.home.id, zone
            ) );
        } catch( error ) {
            this.emit( 'apiError', error );
            return this.setZone( null );
        }
    }

    async saveZone() {
        let updatedZone = this.zone;
        try {
            let zone = await clientAPI['put /api/homes/{pathParam0}/zones/{pathParam1}'](
                this.home.id, updatedZone.id, updatedZone
            );
        
            this.emit( 'zoneSaved', zone );
            return this.setZone( zone );
        } catch( error ) {
            this.emit( 'apiError', error );
            throw error;
        }
    }

    async deleteZone() {
        let deletedZone = this.zone;
        return clientAPI['delete /api/homes/{pathParam0}/zones/{pathParam1}'](
            this.home.id, deletedZone.id
        ).then( () => {
            return this.setZone( null );
            this.emit( 'zoneDeleted', deletedZone );
        }, error => {
            this.emit( 'apiError', error );
            return this.loadZones();
        });
    }

    async loadDevices() {
        if( !this.home ) {
            this.setDevice( null );
            this.emit( 'devicesChange', [] );
            return;
        }
        try {
            let devices = await clientAPI['get /api/homes/{pathParam0}/zones/{pathParam1}/devices']( this.home.id, this.zone.id );
            if( this.device && devices.filter( b => b.id === this.device.id ).length === 0 ) {
                this.setDevice( null );
            }

            this.emit( 'devicesChange', devices );
        } catch( error ) {
            this.emit( 'apiError', error );
            this.setDevice( null );
            this.emit( 'devicesChange', [] );
        }
    }

    async postDevice( data ) {
        if( !this.home ) {
            this.setDevice( null );
            this.emit( 'devicesChange', [] );
            return;
        }
        try {
            let device = await clientAPI['post /api/homes/{pathParam0}/zones/{pathParam1}/devices']( this.home.id, this.zone.id, data );
            await this.loadDevices();
            await this.setDevice( device );
        } catch( error ) {
            this.emit( 'apiError', error );
            throw error;
        }
    }

    async setDevice( device ) {
        if( !device ) {
            if( this.device ) {
                this.device = null;
                this.loadDevices();
                this.updateHistory();
                this.emit( 'deviceChange', null );
            }
            return{};
        }

        if( typeof( device ) === 'object' ) {
            this.device = device;
            this.updateHistory();
            this.emit( 'deviceChange', device );
            this.loadDevices();
            return device;
        }

        try {
            return this.setDevice( await this['get /api/homes/{pathParam0}/zones/{pathParam1}/devices/{pathParam2}'](
                this.home.id, this.zone.id, device
            ) );
        } catch( error ) {
            this.emit( 'apiError', error );
            return this.setDevice( null );
        }
    }

    async saveDevice() {
        let updatedDevice = this.device;
        try {
            let device = await clientAPI['put /api/homes/{pathParam0}/zones/{pathParam1}/devices/{pathParam2}'](
                this.home.id, this.zone.id, updatedDevice.id, updatedDevice
            );
        
            this.emit( 'deviceSaved', device );
            return this.setDevice( device );
        } catch( error ) {
            this.emit( 'apiError', error );
            throw error;
        }
    }

    async deleteDevice() {
        let deletedDevice = this.device;
        return clientAPI['delete /api/homes/{pathParam0}/zones/{pathParam1}/devices/{pathParam2}'](
            this.home.id, this.zone.id, deletedDevice.id
        ).then( () => {
            return this.setDevice( null );
            this.emit( 'deviceDeleted', deletedDevice );
        }, error => {
            this.emit( 'apiError', error );
            return this.loadDevices();
        });
    }

    async querySensorReadings( start, end ) {
        if( !this.home ) {
            return{
                readings: []
            };
        }
        if( typeof( start ) === 'object' ) {
            start = start.toISOString();
        }
        if( typeof( end ) === 'object' ) {
            end = end.toISOString();
        }
        try {
            let url = 'post /api/homes/{pathParam0}';
            let params = [ this.home.id ];
            if( this.zone ) {
                url += '/zones/{pathParam1}';
                params.push( this.zone.id );
            }

            if( this.device ) {
                url += '/devices/{pathParam2}';
                params.push( this.device.id );
            }

            url += '/querySensorReadings';
            params.push({
                start: start,
                end: ( end || new Date().toISOString() )
            });

            return await clientAPI[url].apply( this, params ); 
        } catch( error ) {
            this.emit( 'apiError', error );
            throw error;
        }
    }

};

var clientAPI = new AutoHomeClient();
export default clientAPI;

