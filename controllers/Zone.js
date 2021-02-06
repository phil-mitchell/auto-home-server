'use strict';

const HomeController = require( './Home' );
const Influx = require( 'influx' );
const debug = require( 'debug' )( 'ZoneController' );

module.exports = class ZoneController {
    static async getRequestZone( reqContext, need_write ) {
        let db = reqContext.extraContext.store.db;
        let zones = db.table( 'zones' );

        if( !reqContext.home || !reqContext.home.zone ) {
            reqContext.home = reqContext.home || {};
            var home = await HomeController.getRequestHome(
                reqContext, need_write ? HomeController.EDIT : HomeController.READ_ONLY );

            let zone_path = reqContext.requestObjectPath.indexOf( 'zones' );
            if( zone_path === -1 || reqContext.requestObjectPath.length <= zone_path ) {
                throw reqContext.makeError( 500, `No zone in the path` );
            }

            reqContext.home.zone = ( await zones.filter({
                home: home.id,
                id: reqContext.requestObjectPath[zone_path + 1]
            }).run() )[0];

            if( !reqContext.home.zone ) {
                throw reqContext.makeError( 404, `Zone not found` );
            }

            delete reqContext.home.zone['@etag'];
            reqContext.home.zone['@etag'] = reqContext.extraContext.store.etag(
                reqContext.home.zone );
        }

        return reqContext.home.zone;
    }

    static async find( reqContext, nameFilter ) {
        let db = reqContext.extraContext.store.db;
        let zones = db.table( 'zones' );

        if( ( nameFilter || [] ).length > 0 && nameFilter[0] !== 'all' ) {
            zones = zones.filter(
                zone => reqContext.extraContext.store.r.expr( nameFilter ).contains( zone( 'name' ) )
            );
        }

        let home = await HomeController.getRequestHome( reqContext, HomeController.READ_ONLY );
        return zones.filter({ home: home.id }).orderBy( 'name' );
    }

    static async get( reqContext ) {
        return this.getRequestZone( reqContext, false );
    }

    static async create( reqContext ) {
        let home = await HomeController.getRequestHome( reqContext, HomeController.EDIT );
        reqContext.requestBody.home = home.id;

        let db = reqContext.extraContext.store.db;
        let zones = db.table( 'zones' );

        delete reqContext.requestBody.id;
        delete reqContext.requestBody['@etag'];

        if( reqContext.requestBody.sensors ) {
            for( let sensor of reqContext.requestBody.sensors ) {
                delete sensor.reading;
            }
        }

        delete reqContext.requestBody.targets;

        let res = await zones.insert( reqContext.requestBody, { returnChanges: true }).run();
        reqContext.extraContext.store.aedes.publish({
            topic: `homes/${reqContext.home.home.id}/zoneCreated`,
            payload: Buffer.from( JSON.stringify( res.changes[0].new_val ), 'utf-8' ),
            qos: 1
        });
        return res.changes[0].new_val;
    }

    static async update( reqContext ) {
        var zone = await this.getRequestZone( reqContext, true );
        var replace = reqContext.req.method === 'PUT';
        
        if( zone['@etag'] !== reqContext.requestBody['@etag'] ) {
            throw reqContext.makeError( 409, `Zone was edited by another request` );
        }
        delete reqContext.requestBody['@etag'];

        let db = reqContext.extraContext.store.db;
        let zones = db.table( 'zones' );

        delete reqContext.requestBody.devices;
        delete reqContext.requestBody.targets;

        reqContext.requestBody.id = zone.id;
        reqContext.requestBody.home = zone.home;

        let res = zones.get( zone.id );
        if( replace ) {
            res = res.replace( reqContext.requestBody, { returnChanges: 'always' });
        } else {
            res = res.update( reqContext.requestBody, { returnChanges: 'always' });
        }
        res = await res.run();
        reqContext.extraContext.store.aedes.publish({
            topic: `homes/${zone.home}/zones/${zone.id}/zoneUpdated`,
            payload: Buffer.from( JSON.stringify( res.changes[0].new_val ), 'utf-8' ),
            qos: 1
        });
        return res.changes[0].new_val;
    }

    static async remove( reqContext ) {
        var zone = await this.getRequestZone( reqContext, true );

        let db = reqContext.extraContext.store.db;
        let zones = db.table( 'zones' );

        let res = await zones.get( zone.id ).delete().run();
        reqContext.extraContext.store.aedes.publish({
            topic: `homes/${zone.home}/zones/${zone.id}/zoneRemoved`,
            payload: Buffer.from( JSON.stringify( zone ), 'utf-8' ),
            qos: 1
        });

        return res;
    }

    static computeCurrentTargets( zone, timezone, now, ignoreOverrides ) {
        if( zone.targets ) {
            return zone.targets;
        }
        zone.schedules = zone.schedules || [];
        zone.schedules.sort( ( a, b ) => {
            return a.start.localeCompare( b.start );
        });

        zone.overrides = zone.overrides || [];
        zone.overrides.sort( ( a, b ) => {
            return a.start.localeCompare( b.start );
        });

        let targets = {};

        now = now || new Date();

        timezone = timezone || 'UTC';
        let nowParts = Intl.DateTimeFormat(
            'en-CA', {
                timeZone: timezone,
                weekday: 'long',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            }).formatToParts( new Date() );

        let day = [
            'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
        ].indexOf( nowParts[0].value );

        let time = nowParts.slice( 2 ).map( p => p.value ).join( '' );
        debug( `Current time is ${time} on day ${day}` );

        for( let schedule of zone.schedules ) {
            if( schedule.days.indexOf( day ) > -1 ) {
                for( let change of schedule.changes ) {
                    let scheduleStart = new Date( now );
                    scheduleStart.setUTCHours( Number( schedule.start.split( ':' )[0] ) + 5 );
                    scheduleStart.setMinutes( Number( schedule.start.split( ':' )[1] ) );
                    scheduleStart.setSeconds( 0 );
                    scheduleStart.setMilliseconds( 0 );
                    
                    if( schedule.start <= time ) {
                        debug( `Found past schedule starting at ${schedule.start}; setting ${change.device} to ${JSON.stringify( change )} until ${scheduleStart.toISOString()}` );
                        targets[change.device] = {
                            value: change.value
                        };
                        targets[change.device].until = new Date( now );
                        targets[change.device].until.setUTCHours( 23 + 5 );
                        targets[change.device].until.setMinutes( 59 );
                        targets[change.device].until.setSeconds( 59 );
                        targets[change.device].until.setMilliseconds( 999 );
                    } else if( targets[change.device] && targets[change.device].until > scheduleStart ) {
                        debug( `Found future schedule starting at ${schedule.start}; setting ${change.device} until ${scheduleStart.toISOString()}` );
                        targets[change.device].until = scheduleStart;
                    }
                }
            }
        }

        if( !ignoreOverrides ) {
            for( let override of zone.overrides ) {
                for( let change of override.changes ) {
                    let overrideStart = new Date( override.start );
                    let overrideEnd = new Date( override.end );

                    if( overrideStart <= now && overrideEnd >= now ) {
                        targets[change.device] = {
                            value: change.value
                        };
                        targets[change.device].until = override.end;
                    } else if( overrideStart > now && targets[change.device] && targets[change.device].until > overrideStart ) {
                        targets[change.device].until = overrideStart;
                    }
                }
            }
        }

        zone.targets = targets;
        return targets;
    }

    static async formatResponse( reqContext, value ) {
        if( typeof( value ) === 'object' && !value['@etag'] ) {
            delete value['@etag'];
            value['@etag'] = reqContext.extraContext.store.etag( value );
        }

        if( typeof( value ) === 'object' && value.devices ) {
            for( let device of value.devices ) {
                let home = reqContext.home.home;

                let influx = reqContext.extraContext.store.influx;
                let filter = reqContext.requestBody;

                let query = `select time, value, unit, data from sensor_readings where ` +
                    `home = ${Influx.escape.stringLit( home.id )} and ` +
                    `zone = ${Influx.escape.stringLit( value.id )} and ` +
                    `sensor = ${Influx.escape.stringLit( device.name )} ` +
                    `order by time desc limit 1`;

                device.current = ( await influx.query( query ) )[0] || {};
                if( device.current.value != null ) {
                    device.current.value = {
                        value: device.current.value,
                        unit: device.current.unit
                    };
                    delete device.current.unit;
                }
                try {
                    device.current.data = JSON.parse( device.current.data || '{}' );
                } catch( e ) {
                    device.current.data = {};
                }
            }
        }

        if( typeof( value ) === 'object' ) {
            value.schedules = value.schedules || [];
            value.overrides = value.overrides || [];

            if( value.devices ) {
                var home = await HomeController.getRequestHome( reqContext, HomeController.READ_ONLY );
                this.computeCurrentTargets( value, home.timezone );
            }
        }
        return value;
    }

    static nextScheduleStart( zone, timezone, now ) {
        this.computeCurrentTargets( zone, timezone, now, true );
        let nextStart = null;
        
        for( let device of zone.devices.filter( x => x.target.until ) ) {
            let until = new Date( device.target.until );
            if( !nextStart || until < nextStart ) { 
                nextStart = until;
            }
        }

        if( !nextStart ) {
            nextStart = new Date( now );
            nextStart.setUTCHours( 23 + 5 );
            nextStart.setMinutes( 59 );
            nextStart.setSeconds( 59 );
            nextStart.setMilliseconds( 999 );
        }

        return nextStart;
        
    }

    static async querySensorReadings( reqContext, home, zone ) {
        let influx = reqContext.extraContext.store.influx;
        let filter = reqContext.requestBody;

        let query = `select * from sensor_readings where ` +
            `time >= ${Influx.escape.stringLit( filter.start )} and ` +
            `time <= ${Influx.escape.stringLit( filter.end )} and ` +
            `home = ${Influx.escape.stringLit( home )}`;

        if( zone ) {
            query = `${query} and zone = ${Influx.escape.stringLit( zone )}`;
        }

        if( filter.sensor ) {
            query = `${query} and sensor = ${Influx.escape.stringLit( filter.sensor )}`;
        }

        if( filter.type ) {
            query = `${query} and type = ${Influx.escape.stringLit( filter.type )}`;
        }

        query = `${query} order by time asc`;

        let results = ( await influx.query( query ) ).map( r => {
            r.value = {
                value: r.value,
                unit: r.unit
            };
            if( r.target != null ) {
                r.target = {
                    value: r.target,
                    unit: r.unit
                };
            }
            delete r.unit;
            try {
                r.data = JSON.parse( r.data || '{}' );
            } catch( e ) {
                r.data = {};
            }
            return r;
        });

        let readings = {};

        for( let result of results ) {
            let key = `${result.home}/${result.zone}/${result.sensor}`;
            readings[key] = readings[key] || {
                home: result.home,
                zone: result.zone,
                sensor: result.sensor,
                type: result.type,
                fields: []
            };

            readings[key].fields.push({
                time: result.time,
                data: result.data,
                value: result.value,
                target: result.target
            });
        }

        return { readings: Object.values( readings ) };
    };

    static async callOperation( reqContext ) {
        let operationName = reqContext.requestObjectPath[reqContext.requestObjectPath.length-1];

        let db = reqContext.extraContext.store.db;
        let zones = db.table( 'zones' );

        if( operationName === 'addOverride' ) {
            const DeviceController = require( './DeviceController' );
            let zone = await this.getRequestZone( reqContext, true );
            let home = reqContext.home.home;

            let override = reqContext.requestBody;
            if( !override.start ) {
                override.start = new Date().toISOString();
            }
            if( !override.end ) {
                override.end = ( await this.nextScheduleStart( zone, home.timezone, new Date( override.start ) ) ).toISOString();
            }

            for( let change of override.changes ) {
                change.device = ( ( await DeviceController.find( reqContext ) ).filter( d => d.name === change.device )[0] || {}).id;
            }

            let overrides = zone.overrides.filter(
                o => o.name !== override.name
            );

            overrides.push( override );

            await zones.get( zone.id ).update({
                overrides: overrides
            }).run();
            return true;
        } else if( operationName === 'cancelOverride' ) {
            let zone = await this.getRequestZone( reqContext, true );
            let home = reqContext.home.home;

            let name = reqContext.requestBody.name;
            let overrides = name ? ( zone.overrides || [] ).filter(
                override => override.name !== name
            ) : [];

            await zones.get( zone.id ).update({
                overrides: overrides
            }).run();
            return true;
        } else if( operationName === 'querySensorReadings' ) {
            let zone = await this.getRequestZone( reqContext, false );
            let home = reqContext.home.home;

            const DeviceController = require( './Device' );
            return DeviceController.querySensorReadings( reqContext, home.id, zone.id );
        }

        throw new Error( `Unknown operation ${operationName}` );
    }
};

