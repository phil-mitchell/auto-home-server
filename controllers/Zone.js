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

            reqContext.home.zone = ( await zones.filter({
                home: home.id,
                id: reqContext.requestObjectPath[4]
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

        if( reqContext.requestBody.devices ) {
            for( let device of reqContext.requestBody.devices ) {
                delete device.current;
                delete device.target;
            }
        }

        reqContext.requestBody.id = zone.id;
        reqContext.requestBody.home = zone.home;

        let res = zones.get( zone.id );
        if( replace ) {
            res = res.replace( reqContext.requestBody, { returnChanges: 'always' });
        } else {
            res = res.update( reqContext.requestBody, { returnChanges: 'always' });
        }
        res = await res.run();
        return res.changes[0].new_val;
    }

    static async remove( reqContext ) {
        var zone = await this.getRequestZone( reqContext, true );

        let db = reqContext.extraContext.store.db;
        let zones = db.table( 'zones' );

        return zones.get( zone.id ).delete().run();
    }

    static computeCurrentTargets( zone, timezone, now, ignoreOverrides ) {
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

        for( let device of zone.devices ) {
            device.target = targets[device.name] || {};
        }
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

        if( typeof( value ) === 'object' && ( value.schedules || value.overrides ) ) {
            var home = await HomeController.getRequestHome( reqContext, HomeController.READ_ONLY );
            this.computeCurrentTargets( value, home.timezone );
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

    static async callOperation( reqContext ) {
        let operationName = reqContext.requestObjectPath[reqContext.requestObjectPath.length-1];

        let db = reqContext.extraContext.store.db;
        let zones = db.table( 'zones' );

        if( operationName === 'addOverride' ) {
            let zone = await this.getRequestZone( reqContext, true );
            let home = reqContext.home.home;

            let override = reqContext.requestBody;
            if( !override.start ) {
                override.start = new Date().toISOString();
            }
            if( !override.end ) {
                override.end = ( await this.nextScheduleStart( zone, home.timezone, new Date( override.start ) ) ).toISOString();
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
        } else if( operationName === 'addSensorReading' ) {
            let zone = await this.getRequestZone( reqContext, true );
            let home = reqContext.home.home;

            let influx = reqContext.extraContext.store.influx;
            let reading = reqContext.requestBody;
            let sensor = ( zone.sensors || [] ).filter( s => s.name === reading.sensor )[0];
            let type = ( sensor || {}).type || reading.type || 'unknown';

            let timestamp = new Date( reading.time ).getTime() * 1000000;

            await influx.writePoints( [ {
                measurement: 'sensor_readings',
                tags: {
                    home: home.id,
                    zone: zone.id,
                    sensor: reading.sensor,
                    type: type
                },
                fields: {
                    value: Number( reading.value.value ),
                    target: reading.target && Number( reading.target.value ),
                    unit: reading.value.unit || '',
                    data: JSON.stringify( reading.data || '{}' )
                },
                timestamp: timestamp
            } ] );
            return true;
        } else if( operationName === 'querySensorReadings' ) {
            let zone = await this.getRequestZone( reqContext, false );
            let home = reqContext.home.home;

            let influx = reqContext.extraContext.store.influx;
            let filter = reqContext.requestBody;

            let query = `select * from sensor_readings where ` +
                `time >= ${Influx.escape.stringLit( filter.start )} and ` +
                `time <= ${Influx.escape.stringLit( filter.end )} and ` +
                `home = ${Influx.escape.stringLit( home.id )} and ` +
                `zone = ${Influx.escape.stringLit( zone.id )}`;

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
            }) };
        }

        throw new Error( `Unknown operation ${operationName}` );
    }
};

