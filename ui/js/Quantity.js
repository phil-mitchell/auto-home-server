var PREFIXES = [
    { name: 'yotta', symbol: 'Y', factor: 1e24 },
    { name: 'zetta', symbol: 'Z', factor: 1e21 },
    { name: 'exa', symbol: 'E', factor: 1e18 },
    { name: 'peta', symbol: 'P', factor: 1e15 },
    { name: 'tera', symbol: 'T', factor: 1e12 },
    { name: 'giga', symbol: 'G', factor: 1e9},
    { name: 'mega', symbol: 'M', factor: 1e6},
    { name: 'kilo', symbol: 'k', factor: 1e3},
    { name: 'hecto', symbol: 'h', factor: 1e2},
    { name: 'deca', symbol: 'da', factor: 1e1},
    { name: '', symbol: '', factor: 1},
    { name: 'deci', symbol: 'd', factor: 1e-1},
    { name: 'centi', symbol: 'c', factor: 1e-2},
    { name: 'milli', symbol: 'm', factor: 1e-3},
    { name: 'micro', symbol: 'μ', factor: 1e-6},
    { name: 'nano', symbol: 'n', factor: 1e-9},
    { name: 'pico', symbol: 'p', factor: 1e-12},
    { name: 'femto', symbol: 'f', factor: 1e-15},
    { name: 'atto', symbol: 'a', factor: 1e-18},
    { name: 'zepto', symbol: 'z', factor: 1e-21},
    { name: 'yocto', symbol: 'y', factor: 1e-24}
];

function MCUtoSRM( mcu ) {
    if( mcu >= 10 ) {
        return ( 2.0 / 7.0 ) * mcu + ( 50 / 7 );
    }  else {
        return ( -1 * Math.pow( ( mcu - 10 ), 2 ) + 100 ) / 10;
    }
}

function SRMtoMCU( srm ) {
    if( srm >= 10 ) {
        return( srm - ( 50.0 / 7.0 ) ) * ( 7.0 / 2.0 );
    } else {
        return( -1 * Math.sqrt( 100.0 - srm * 10.0 ) + 10.0 );
    }
}

var TYPES = [ {
    name: 'scalar',
    dimension: { M: 0, L: 0, T: 0, I: 0, K: 0, N: 0 },
    units: [ {
        name: '',
        symbol: '',
        aliases: [],
        factor: 1,
        category: [ 'number', 'ph' ]
    }, {
        name: 'percent',
        symbol: '%',
        aliases: [],
        factor: 1e-2,
        category: [ 'number' ]
    }, {
        name: 'point',
        symbol: 'p',
        aliases: [],
        factor: 1e-3,
        category: [ 'gravity' ]
    }, {
        name: 'specific gravity',
        symbol: 'SG',
        aliases: [],
        toBase: x => x - 1,
        fromBase: x => x + 1,
        category: [ 'gravity' ]
    }, {
        name: 'malt colour unit',
        symbol: 'MCU',
        aliases: [ 'malt color unit' ],
        factor: 1,
        category: [ 'colour' ]
    }, {
        name: 'standard reference method',
        symbol: 'SRM',
        aliases: [],
        toBase: SRMtoMCU,
        fromBase: MCUtoSRM,
        category: [ 'colour' ]
    }, {
        name: 'European brewing convention',
        symbol: 'EBC',
        aliases: [],
        toBase: ebc => {
            return SRMtoMCU( ebc / 1.97 );
        },
        fromBase: mcu => {
            return MCUtoSRM( mcu ) * 1.97;
        },
        category: [ 'colour' ]
    }, {
        name: 'international bitterness unit cubic metre per kilogram',
        symbol: 'IBU*l/kg',
        aliases: [ 'international bitterness unit cubic meter per kilogram' ],
        factor: 1,
        category: [ 'bitterness' ]
    }, {
        name: 'international bitterness unit litre per kilogram',
        symbol: 'IBU*l/kg',
        aliases: [ 'international bitterness unit litre per kilogram' ],
        factor: 1e-3,
        category: [ 'bitterness' ]
    }, {
        name: 'international bitterness unit gallon per pound',
        symbol: 'IBU*gal/lb',
        aliases: [],
        factor: 264/2.205,
        category: [ 'bitterness' ]
    } ],
    base: ''
}, {
    name: 'length',
    dimension: { M: 0, L: 1, T: 0, I: 0, K: 0, N: 0 },
    units: [ {
        name: 'metre',
        symbol: 'm',
        aliases: [ 'meter' ],
        factor: 1,
        category: [ 'length' ]
    } ],
    base: 'metre'
}, {
    name: 'mass',
    dimension: { M: 1, L: 0, T: 0, I: 0, K: 0, N: 0 },
    units: [ {
        name: 'gram',
        symbol: 'g',
        aliases: [],
        factor: 1,
        category: [ 'mass' ]
    }, {
        name: 'kilogram',
        symbol: 'kg',
        aliases: [],
        factor: 1,
        category: [ 'mass' ]
    }, {
        name: 'milligram',
        symbol: 'mg',
        aliases: [],
        factor: 1,
        category: [ 'mass' ]
    }, {
        name: 'pound',
        symbol: 'lb',
        aliases: [],
        factor: 453.59237,
        category: [ 'mass' ]
    }, {
        name: 'ounce',
        symbol: 'oz',
        aliases: [],
        factor: 28.34952,
        category: [ 'mass' ]
    }, {
        name: 'alpha acid unit',
        symbol: 'AAU',
        aliases: [ 'alpha acid units' ],
        factor: 1,
        category: [ 'bitterness' ]
    }, {
        name: 'beta acid unit',
        symbol: 'BAU',
        aliases: [ 'beta acid units' ],
        factor: 1,
        category: [ 'bitterness' ]
    } ],
    base: 'kilogram'
}, {
    name: 'time',
    dimension: { M: 0, L: 0, T: 1, I: 0, K: 0, N: 0 },
    units: [ {
        name: 'second',
        symbol: 's',
        aliases: [ 'sec', 'secs', 'seconds' ],
        factor: 1
    }, {
        name: 'minute',
        symbol: 'm',
        aliases: [ 'min', 'mins', 'minutes' ],
        factor: 60
    }, {
        name: 'hour',
        symbol: 'h',
        aliases: [ 'hours' ],
        factor: 3600
    }, {
        name: 'day',
        symbol: 'D',
        aliases: [ 'days' ],
        factor: 86400
    }, {
        name: 'week',
        symbol: 'W',
        aliases: [ 'weeks' ],
        factor: 604800
    } ],
    base: 'second'
}, {
    name: 'electric current',
    dimension: { M: 0, L: 0, T: 0, I: 1, K: 0, N: 0 },
    units: [ {
        name: 'ampere',
        symbol: 'A',
        aliases: [ 'amp' ],
        factor: 1
    } ],
    base: 'ampere'
}, {
    name: 'temperature',
    dimension: { M: 0, L: 0, T: 0, I: 0, K: 1, N: 0 },
    units: [ {
        name: 'kelvin',
        symbol: 'K',
        aliases: [],
        factor: 1
    }, {
        name: 'celsius',
        symbol: '°C',
        aliases: [ 'centigrade' ],
        symmbolAliases: [ 'C' ],
        toBase: x => x + 273.15,
        fromBase: x => x - 273.15
    }, {
        name: 'fahrenheit',
        symbol: '°F',
        symbolAliases: [ 'F' ],
        toBase: x => ( x - 32 ) * 5 / 9 + 273.15,
        fromBase: b => ( b - 273.15 ) * 9 / 5 + 32
    } ],
    base: 'kelvin'
}, {
    name: 'area',
    dimension: { M: 0, L: 2, T: 0, I: 0, K: 0, N: 0 },
    units: [ {
        name: 'square metre',
        symbol: 'm^2',
        aliases: [],
        factor: 1,
        category: [ 'area' ]
    } ],
    base: 'square metre'
}, {
    name: 'volume',
    dimension: { M: 0, L: 3, T: 0, I: 0, K: 0, N: 0 },
    units: [ {
        name: 'cubic metre',
        symbol: 'm^3',
        aliases: [],
        factor: 1,
        category: [ 'volume' ]
    }, {
        name: 'litre',
        symbol: 'l',
        aliases: [ 'liter' ],
        symbolAliases: [ 'L', 'ℓ' ],
        factor: 1e-3,
        category: [ 'volume' ]
    }, {
        name: 'US fluid ounce',
        symbol: 'us fl oz',
        aliases: [],
        symbolAliases: [],
        factor: 2.95735e-5,
        category: [ 'volume' ]
    }, {
        name: 'US teaspoon',
        symbol: 'us tsp',
        aliases: [],
        symbolAliases: [],
        factor: 4.92892e-6,
        category: [ 'volume' ]
    }, {
        name: 'US tablespoon',
        symbol: 'us tbsp',
        aliases: [],
        symbolAliases: [],
        factor: 1.47868e-5,
        category: [ 'volume' ]
    }, {
        name: 'US cup',
        symbol: 'us c',
        aliases: [],
        symbolAliases: [],
        factor: 0.000236588,
        category: [ 'volume' ]
    }, {
        name: 'US pint',
        symbol: 'us pt',
        aliases: [],
        symbolAliases: [],
        factor: 0.000473176,
        category: [ 'volume' ]
    }, {
        name: 'US quart',
        symbol: 'us qt',
        aliases: [],
        symbolAliases: [],
        factor: 0.000946353,
        category: [ 'volume' ]
    }, {
        name: 'US gallon',
        symbol: 'us gal',
        aliases: [],
        symbolAliases: [],
        factor: 0.00378541,
        category: [ 'volume' ]
    }, {
        name: 'UK fluid ounce',
        symbol: 'uk fl oz',
        aliases: [],
        symbolAliases: [],
        factor: 2.84131e-5,
        category: [ 'volume' ]
    }, {
        name: 'UK teaspoon',
        symbol: 'uk tsp',
        aliases: [],
        symbolAliases: [],
        factor: 5.91939e-6,
        category: [ 'volume' ]
    }, {
        name: 'UK tablespoon',
        symbol: 'uk tbsp',
        aliases: [],
        symbolAliases: [],
        factor: 1.77582e-5,
        category: [ 'volume' ]
    }, {
        name: 'UK cup',
        symbol: 'uk c',
        aliases: [],
        symbolAliases: [],
        factor: 0.0002841306,
        category: [ 'volume' ]
    }, {
        name: 'UK pint',
        symbol: 'uk pt',
        aliases: [],
        symbolAliases: [],
        factor: 0.000568261,
        category: [ 'volume' ]
    }, {
        name: 'UK quart',
        symbol: 'uk qt',
        aliases: [],
        symbolAliases: [],
        factor: 0.00113652,
        category: [ 'volume' ]
    }, {
        name: 'UK gallon',
        symbol: 'uk gal',
        aliases: [],
        symbolAliases: [],
        factor: 0.00454609,
        category: [ 'volume' ]
    } ],
    base: 'cubic metre'
}, {
    name: 'density',
    dimension: { M: 1, L: -3, T: 0, I: 0, K: 0, N: 0 },
    units: [ {
        name: 'kilogram per cubic metre',
        symbol: 'kg/m^3',
        aliases: [ 'kilograms per cublic metre' ],
        factor: 1
    },  {
        name: 'pound per gallon',
        symbol: 'lb/g',
        aliases: [ 'pounds per gallon' ],
        factor: 264/2.205
    },  {
        name: 'malt colour unit',
        symbol: 'MCU',
        aliases: [ 'malt color unit' ],
        factor: 264/2.205
    },  {
        name: 'international bitterness unit',
        symbol: 'IBU',
        aliases: [ 'international bitterness units' ],
        factor: 1e-3
    } ],
    base: 'kilogram per cubic metre'
}, {
    name: 'specific volume',
    dimension: { M: -1, L: 3, T: 0, I: 0, K: 0, N: 0 },
    units: [ {
        name: 'cubic metre per kilogram',
        symbol: 'm^3/kg',
        aliases: [],
        factor: 1
    }, {
        name: 'cubic metre per gram',
        symbol: 'm^3/g',
        aliases: [],
        factor: 1e3
    }, {
        name: 'litre per kilogram',
        symbol: 'l/kg',
        aliases: [ 'liter per kilogram' ],
        factor: 1e-3
    }, {
        name: 'point per kilogram per litre',
        symbol: 'p/kg/l',
        aliases: [ 'points per kilogram per litre' ],
        factor: 1e-6,
        category: [ 'gravity' ]
    }, {
        name: 'degree Lovibond',
        symbol: '°L',
        aliases: [ 'degrees Lovibond' ],
        factor: 2.205/264.172,
        category: [ 'colour' ]
    } ],
    base: 'cubic metre per kilogram'
}, {
    name: 'volume flow rate',
    dimension: { M: 0, L: 3, T: -1, I: 0, K: 0, N: 0 },
    units: [ {
        name: 'cubic metre per second',
        symbol: 'm^3/s',
        aliases: [],
        factor: 1
    }, {
        name: 'litre per hour',
        symbol: 'l/h',
        aliases: [ 'liter per hour' ],
        factor: 2.7778e-7
    } ],
    base: 'cubic metre per second'
}, {
    name: 'catalytic activity',
    dimension: { M: 0, L: 0, T: -1, I: 0, K: 0, N: 1 },
    units: [ {
        name: 'katal',
        symbol: 'kat',
        aliases: [],
        factor: 1
    }, {
        name: 'degree Lintner',
        symbol: '°L',
        aliases: [ 'degrees Lintner' ],
        factor: 3.014e-9
    }, {
        name: 'enzyme unit',
        symbol: 'U',
        aliases: [ 'enzyme units' ],
        symbolAliases: 'IU',
        factor: 1.66666667e-8
    }, {
        name: 'windisch-kolbach',
        symbol: '°WK',
        aliases: [],
        toBase: x => ( x + 16 ) * 3.014e-9 / 3.5,
        fromBase: b => ( b * 3.5 / 3.014e-9 ) - 16
    } ],
    base: 'katal'
} ];

TYPES.findByName = function( name ) {
    name = name.toLowerCase();
    return TYPES.filter( x => x.name === name )[0];
}

TYPES.findByDimension = function( dimension ) {
    let results = [];
    for( let type of TYPES ) {
        if( type.dimension.M === dimension.M &&
            type.dimension.L === dimension.L &&
            type.dimension.T === dimension.T &&
            type.dimension.I === dimension.I &&
            type.dimension.K === dimension.K ) {
            results.push( type );
        }
    }
    return results;
}

function addDimensions( left, right ) {
    return{
        M: left.M + right.M,
        L: left.L + right.L,
        T: left.T + right.T,
        I: left.I + right.I,
        K: left.K + right.K,
        N: left.N + right.N
    };
}

function subtractDimensions( left, right ) {
    return{
        M: left.M - right.M,
        L: left.L - right.L,
        T: left.T - right.T,
        I: left.I - right.I,
        K: left.K - right.K,
        K: left.N - right.N
    };
}

class Quantity {
    constructor( type, value, unit ) {
        if( arguments.length === 1 ) {
            this._type = type.type;
            this._unit = type.unit;
            this._value = type.value;
        } else {
            this._type = type;
        }

        this._parsedType = Quantity.parseType( this._type );
        if( !this._parsedType ) {
            throw new Error( `Unknown type ${this._type}` );
        }

        if( arguments.length === 2 && typeof( value ) === 'object' ) {
            this._unit = value.unit;
            this._value = value.value;
        } else {
            this._unit = unit;
            this._value = value;
        }

        if( this._unit == null || this._unit == '' ) {
            this._unit = this._parsedType.base;
        }

        this._parsedUnit = Quantity.parseUnit( this.type, this.unit );
    }

    static parseType( type ) {
        return TYPES.findByName( type );
    }

    static parseUnit( type, unitString ) {
        function toString() {
            return `${this.prefix.symbol}${this.unit.symbol}`;
        }
        for( let unit of TYPES.findByName( type ).units ) {
            for( let prefix of PREFIXES ) {
                if( unitString === `${prefix.name}${unit.name}` ||
                    unitString === `${prefix.symbol}${unit.symbol}` ) {
                    return{
                        prefix,
                        unit,
                        toString
                    };
                }

                for( let alias of unit.aliases || [] ) {
                    if( unitString === `${prefix.name}${alias}` ) {
                        return{
                            prefix,
                            unit,
                            toString
                        };
                    }
                }

                for( let alias of unit.symbolAliases || [] ) {
                    if( unitString === `${prefix.symbol}${alias}` ) {
                        return{
                            prefix,
                            unit,
                            toString
                        };
                    }
                }
            }
        }
        throw new Error( `No known unit for type ${type} that matches ${unitString}` );
    }

    get type() {
        return this._type;
    }

    get dimension() {
        return Object.assign({}, this._parsedType.dimension );
    }

    get unit() {
        return this._unit;
    }

    get value() {
        return this._value;
    }

    get parsedUnit() {
        return this._parsedUnit;
    }

    convert( unit ) {
        if( unit == null ) {
            unit = this._parsedType.base;
        }

        if( this.unit === unit ) {
            return this;
        }

        let parsedUnit = this.parsedUnit;
        let targetUnit = Quantity.parseUnit( this.type, unit );

        let value = this.value;

        value = value * parsedUnit.prefix.factor;

        if( parsedUnit.unit.name !== targetUnit.unit.name ) {
            if( typeof( parsedUnit.unit.toBase ) === 'function' ) {
                value = parsedUnit.unit.toBase( value );
            } else {
                value = value * parsedUnit.unit.factor;
            }
            
            if( typeof( targetUnit.unit.fromBase ) === 'function' ) {
                value = targetUnit.unit.fromBase( value );
            } else {
                value = value / targetUnit.unit.factor;
            }
        }

        value = value / targetUnit.prefix.factor;
     
        return new Quantity( this.type, value, unit );
    }

    toBase() {
        return this.convert( this._parsedType.base );
    }

    reInterpret( unit ) {
        return new Quantity( this.type, this.value, unit );
    }

    toObject() {
        return{
            value: this.value,
            unit: this.unit
        };
    }

    toString( decimal ) {
        let value = this.value;
        if( decimal != null ) {
            value = value.toFixed( decimal );
        }
        return `${value} ${this.parsedUnit.toString()}`;
    }

    max( other ) {
        if( this.type !== other.type ) {
            throw new Error( `Cannot compare type ${other.type} to ${this.type}` );
        }

        let normalizedOther = other.convert( this.unit );
        return this.value > normalizedOther.value ? this : other;
    }

    min( other ) {
        if( this.type !== other.type ) {
            throw new Error( `Cannot compare type ${other.type} to ${this.type}` );
        }

        let normalizedOther = other.convert( this.unit );
        return this.value < normalizedOther.value ? this : other;
    }

    equals( other ) {
        if( this.type !== other.type ) {
            throw new Error( `Cannot compare type ${other.type} to ${this.type}` );
        }

        let normalizedOther = other.convert( this.unit );
        return this.value === normalizedOther.value;
    }

    greater( other ) {
        if( this.type !== other.type ) {
            throw new Error( `Cannot compare type ${other.type} to ${this.type}` );
        }

        let normalizedOther = other.convert( this.unit );
        return this.value > normalizedOther.value;
    }

    less( other ) {
        if( this.type !== other.type ) {
            throw new Error( `Cannot compare type ${other.type} to ${this.type}` );
        }

        let normalizedOther = other.convert( this.unit );
        return this.value < normalizedOther.value;
    }

    add( other ) {
        if( this.type !== other.type ) {
            throw new Error( `Cannot add type ${other.type} to ${this.type}` );
        }

        other = other.convert( this.unit );
        return new Quantity( this.type, this.value + other.value, this.unit );
    }

    subtract( other ) {
        if( this.type !== other.type ) {
            throw new Error( `Cannot subtract type ${other.type} from ${this.type}` );
        }

        other = other.convert( this.unit );
        return new Quantity( this.type, this.value - other.value, this.unit );
    }

    multiply( other ) {
        let newTypes = TYPES.findByDimension(
            addDimensions( this.dimension, other.dimension )
        );

        if( newTypes.length === 0 ) {
            throw new Error( `No known types can result from multiplying ${this.type} with ${other.type}` );
        }

        if( newTypes.length > 1 ) {
            throw new Error( `NYI: determine result type from multiplying ${this.type} with ${other.type}` );
        }

        return new Quantity( newTypes[0].name, this.toBase().value * other.toBase().value, newTypes[0].base );
    }

    pow( exponent ) {
        let newDimension = { M: 0, L: 0, T: 0, I: 0, K: 0, N: 0 };
        if( exponent > 0 ) {
            for( let i = 0; i < exponent; ++i ) {
                newDimension = addDimensions( newDimension, this.dimension );
            }
        } else {
            for( let i = 0; i > exponent; --i ) {
                newDimension = subtractDimensions( newDimension, this.dimension );
            }
        }

        let newTypes = TYPES.findByDimension( newDimension );

        if( newTypes.length === 0 ) {
            throw new Error( `No known types can result from ${this.type} pow ${exponent}` );
        }

        if( newTypes.length > 1 ) {
            throw new Error( `NYI: determine result type from ${this.type} pow ${exponent}` );
        }

        return new Quantity( newTypes[0].name, Math.pow( this.toBase().value, exponent ), newTypes[0].base );
    }

    divide( other ) {
        let newTypes = TYPES.findByDimension(
            subtractDimensions( this.dimension, other.dimension )
        );

        if( newTypes.length === 0 ) {
            throw new Error( `No known types can result from dividing ${this.type} by ${other.type}` );
        }

        if( newTypes.length > 1 ) {
            throw new Error( `NYI: determine result type from dividing ${this.type} by ${other.type}` );
        }
        
        return new Quantity( newTypes[0].name, this.toBase().value / other.toBase().value, newTypes[0].base );
    }
}

export default Quantity;
