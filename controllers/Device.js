'use strict';

const HomeController = require( './Home' );
const ZoneController = require( './Zone' );
const Influx = require( 'influx' );
const debug = require( 'debug' )( 'DeviceController' );

module.exports = class DeviceController {
    static async getRequestDevice( reqContext, need_write ) {
        let db = reqContext.extraContext.store.db;
        let devices = db.table( 'devices' );

        if( !reqContext.home || !reqContext.home.device ) {
            reqContext.zone = reqContext.zone || {};
            var zone = await ZoneController.getRequestZone( reqContext, need_write );

            let device_path = reqContext.requestObjectPath.indexOf( 'devices' );
            if( device_path === -1 || reqContext.requestObjectPath.length <= device_path ) {
                throw reqContext.makeError( 500, `No device in the path` );
            }

            reqContext.home.device = ( await devices.filter({
                zone: zone.id,
                id: reqContext.requestObjectPath[device_path + 1]
            }).run() )[0];

            if( !reqContext.home.device ) {
                throw reqContext.makeError( 404, `Device not found` );
            }

            delete reqContext.home.device['@etag'];
            reqContext.home.device['@etag'] = reqContext.extraContext.store.etag(
                reqContext.home.device );
        }

        return reqContext.home.device;
    }

    static async find( reqContext, nameFilter ) {
        let db = reqContext.extraContext.store.db;
        let devices = db.table( 'devices' );

        if( ( nameFilter || [] ).length > 0 && nameFilter[0] !== 'all' ) {
            devices = devices.filter(
                device => reqContext.extraContext.store.r.expr( nameFilter ).contains( device( 'name' ) )
            );
        }

        let zone = await ZoneController.getRequestZone( reqContext, false );
        return devices.filter({ zone: zone.id }).orderBy( 'name' );
    }

    static async get( reqContext ) {
        return this.getRequestDevice( reqContext, false );
    }

    static async create( reqContext ) {
        let zone = await ZoneController.getRequestZone( reqContext, false );
        reqContext.requestBody.zone = zone.id;

        let db = reqContext.extraContext.store.db;
        let devices = db.table( 'devices' );

        delete reqContext.requestBody.id;
        delete reqContext.requestBody['@etag'];

        if( reqContext.requestBody.sensors ) {
            for( let sensor of reqContext.requestBody.sensors ) {
                delete sensor.reading;
            }
        }

        delete reqContext.requestBody.targets;

        let res = await devices.insert( reqContext.requestBody, { returnChanges: true }).run();
        reqContext.extraContext.store.aedes.publish({
            topic: `homes/${zone.home}/zones/${zone.id}/deviceCreated`,
            payload: Buffer.from( JSON.stringify( res.changes[0].new_val ), 'utf-8' ),
            qos: 1
        });
        return res.changes[0].new_val;
    }

    static async update( reqContext ) {
        var device = await this.getRequestDevice( reqContext, true );
        var replace = reqContext.req.method === 'PUT';
        
        if( device['@etag'] !== reqContext.requestBody['@etag'] ) {
            throw reqContext.makeError( 409, `Device was edited by another request` );
        }
        delete reqContext.requestBody['@etag'];

        let db = reqContext.extraContext.store.db;
        let devices = db.table( 'devices' );

        delete reqContext.requestBody.current;
        delete reqContext.requestBody.target;

        reqContext.requestBody.id = device.id;
        reqContext.requestBody.zone = device.zone;

        let res = devices.get( device.id );
        if( replace ) {
            res = res.replace( reqContext.requestBody, { returnChanges: 'always' });
        } else {
            res = res.update( reqContext.requestBody, { returnChanges: 'always' });
        }
        res = await res.run();
        reqContext.extraContext.store.aedes.publish({
            topic: `homes/${reqContext.home.home.id}/zones/${device.zone}/deviceUpdated`,
            payload: Buffer.from( JSON.stringify( res.changes[0].new_val ), 'utf-8' ),
            qos: 1
        });
        return res.changes[0].new_val;
    }

    static async remove( reqContext ) {
        var device = await this.getRequestDevice( reqContext, true );

        let db = reqContext.extraContext.store.db;
        let devices = db.table( 'devices' );

        let res = await devices.get( device.id ).delete().run();

        reqContext.extraContext.store.aedes.publish({
            topic: `homes/${reqContext.home.home.id}/zones/${device.zone}/deviceRemoved`,
            payload: Buffer.from( JSON.stringify( device ), 'utf-8' ),
            qos: 1
        });

        return res;
    }

    static async formatResponse( reqContext, value ) {
        if( typeof( value ) === 'object' && !value['@etag'] ) {
            delete value['@etag'];
            value['@etag'] = reqContext.extraContext.store.etag( value );
        }

        if( typeof( value ) === 'object' && !value.readings ) {
            let home = reqContext.home.home;
            let zone = reqContext.home.zone;

            let influx = reqContext.extraContext.store.influx;
            let influxDatabaseName = await HomeController.ensureInfluxDatabase( reqContext );
            let filter = reqContext.requestBody;

            let query = `select time, value, unit, data from sensor_readings where ` +
                `zone = ${Influx.escape.stringLit( zone.id )} and ` +
                `sensor = ${Influx.escape.stringLit( value.id )} ` +
                `order by time desc limit 1`;

            value.current = ( await influx.query( query, { database: influxDatabaseName }) )[0] || {};
            if( value.current.value != null ) {
                value.current.value = {
                    value: value.current.value,
                    unit: value.current.unit
                };
                delete value.current.unit;
            }
            try {
                value.current.data = JSON.parse( value.current.data || '{}' );
            } catch( e ) {
                value.current.data = {};
            }


            let targets = ZoneController.computeCurrentTargets( zone, home.timezone );
            value.target = targets[value.id] || {};
        }
        return value;
    }

    static async querySensorReadings( reqContext, home, zone, device ) {
        let influx = reqContext.extraContext.store.influx;
        let influxDatabaseName = await HomeController.ensureInfluxDatabase( reqContext );
        let filter = reqContext.requestBody;

        let query = `select * from sensor_readings where ` +
            `time >= ${Influx.escape.stringLit( filter.start )} and ` +
            `time <= ${Influx.escape.stringLit( filter.end )}`;

        if( zone ) {
            query = `${query} and zone = ${Influx.escape.stringLit( zone )}`;
        }

        if( device ) {
            query = `${query} and sensor = ${Influx.escape.stringLit( device )}`;
        }

        if( filter.type ) {
            query = `${query} and type = ${Influx.escape.stringLit( filter.type )}`;
        }

        query = `${query} order by time asc`;

        let results = ( await influx.query( query, { database: influxDatabaseName }) ).map( r => {
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
            let key = `${result.zone}/${result.sensor}`;
            readings[key] = readings[key] || {
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
    }

    static async addSensorReading( reqContext ) {
        let device = await this.getRequestDevice( reqContext, true );
        let zone = device.zone;

        let influx = reqContext.extraContext.store.influx;
        let influxDatabaseName = await HomeController.ensureInfluxDatabase( reqContext );
        let reading = reqContext.requestBody;

        let device_path = reqContext.requestObjectPath.indexOf( 'devices' );

        let type = reqContext.requestObjectPath[device_path+2] || reading.type ||
            ( device || {}).type || 'unknown';

        let timestamp = new Date( reading.time ).getTime() * 1000000;

        let tags = {
            zone: zone,
            sensor: device.id,
            type: type
        };
        let fields = {
            value: Number( reading.value.value ),
            unit: reading.value.unit || '',
            data: JSON.stringify( reading.data || '{}' )
        };

        if( reading.target && reading.target.value != null ) {
            fields.target = Number( reading.target.value );
        }

        await influx.writePoints( [ {
            measurement: 'sensor_readings',
            tags: tags,
            fields: fields,
            timestamp: timestamp
        }], {
            database: influxDatabaseName,
            schema: [ {
                measurement: 'sensor_readings',
                fields: {
                    value: Influx.FieldType.FLOAT,
                    target: Influx.FieldType.FLOAT,
                    unit: Influx.FieldType.STRING,
                    data: Influx.FieldType.STRING
                },
                tags: [
                    'zone', 'sensor', 'type'
                ]
            } ]
        } );
    }

    static async callOperation( reqContext ) {
        let operationName = reqContext.requestObjectPath[reqContext.requestObjectPath.length-1];

        if( operationName === 'addSensorReading' ) {
            await this.addSensorReading( reqContext );
            return true;
        } else if( operationName === 'querySensorReadings' ) {
            let device = await this.getRequestDevice( reqContext, false );
            let zone = device.zone;
            let home = reqContext.home.home.id;
            return this.querySensorReadings( reqContext, home, zone, device.id );
        }

        throw new Error( `Unknown operation ${operationName}` );
    }
};

