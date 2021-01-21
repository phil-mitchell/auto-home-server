'use strict';

const HomeController = require( './Home' );
const Influx = require( 'influx' );

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

        if( ( nameFilter || [] ).length > 0 ) {
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

        let res = await zones.insert( reqContext.requestBody, { returnChanges: true }).run();
        return res.changes[0].new_val;
    }

    static async update( reqContext ) {
        var zone = await this.getRequestZone( reqContext, true );

        if( zone['@etag'] !== reqContext.requestBody['@etag'] ) {
            throw reqContext.makeError( 409, `Zone was edited by another request` );
        }
        delete reqContext.requestBody['@etag'];

        let db = reqContext.extraContext.store.db;
        let zones = db.table( 'zones' );

        if( reqContext.requestBody.sensors ) {
            for( let sensor of reqContext.requestBody.sensors ) {
                delete sensor.reading;
            }
        }

        let res = await zones.get( zone.id ).update( reqContext.requestBody, { returnChanges: 'always' }).run();
        return res.changes[0].new_val;
    }

    static async remove( reqContext ) {
        var zone = await this.getRequestZone( reqContext, true );

        let db = reqContext.extraContext.store.db;
        let zones = db.table( 'zones' );

        return zones.get( zone.id ).delete().run();
    }

    static async formatResponse( reqContext, value ) {
        if( typeof( value ) === 'object' && !value['@etag'] ) {
            delete value['@etag'];
            value['@etag'] = reqContext.extraContext.store.etag( value );
        }

        if( typeof( value ) === 'object' && value.sensors ) {
            for( let sensor of value.sensors ) {
                let home = reqContext.home.home;

                let influx = reqContext.extraContext.store.influx;
                let filter = reqContext.requestBody;

                let query = `select time, value, unit, data from sensor_readings where ` +
                    `home = ${Influx.escape.stringLit( home.id )} and ` +
                    `zone = ${Influx.escape.stringLit( value.id )} and ` +
                    `sensor = ${Influx.escape.stringLit( sensor.name )} ` +
                    `order by time desc limit 1`;

                sensor.reading = ( await influx.query( query ) )[0];
            }
        }
        return value;
    }

    static nextScheduleStart( zone, now ) {
        now = now || new Date();
        let day = now.getDay();
        let time = now.toTimeString().slice( 0, 5 );
        let schedule = null;
        
        let schedules = zone.schedules.sort( ( a, b ) => {
            return a.start.localeCompare( b.start );
        });

        for( let i = 0; i < schedules.length; i++ ) {
            if( schedules[i].days.indexOf( now.getDay() ) > -1 ) {
                if( schedules[i].start > time ) {
                    schedule = schedules[i];
                    break;
                }
            }
        }

        let nextStart = new Date( now );
        if( !schedule ) {
            // no schedule; return end of current day
            nextStart.setHours( 23 );
            nextStart.setMinutes( 59 );
        } else {
            let hhmm = schedule.start.split( ':' );
            nextStart.setHours( hhmm[0] );
            nextStart.setMinutes( hhmm[1] );
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
                override.end = ( await this.nextScheduleStart( zone, new Date( override.start ) ) ).toISOString();
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
            await zones.get( zone.id ).update({
                overrides: ( zone.overrides || [] ).filter(
                    override => override.name !== name
                )
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
                    value: Number( reading.value ),
                    unit: reading.unit || '',
                    data: reading.data || ''
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

            return{ readings: await influx.query( query ) };
        }

        throw new Error( `Unknown operation ${operationName}` );
    }
};

