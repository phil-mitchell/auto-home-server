import 'chart.js/dist/Chart.bundle.min.js';
//import 'chartjs-plugin-datalabels/dist/chartjs-plugin-datalabels.min.js';

import Quantity from './Quantity.js';

const template = `<div style="width: 100%; display: inline-block"><canvas height="50px" id="chart"></canvas></div>`;

class HistoryChart extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    async connectedCallback() {
        this.shadowRoot.innerHTML = template;

        this._upgradeProperty( 'history' );
        this._upgradeProperty( 'device' );
        this._upgradeProperty( 'starttime' );
        this._upgradeProperty( 'endtime' );

        let canvas = this.shadowRoot.querySelector( 'canvas' );
        this.chart = new Chart( canvas, {
            type: 'line',
            data: {},
            options: {
                scales: {
                    xAxes: [ {
                        type: 'time',
                        position: 'bottom'
                    } ]
                }
            }
        });

        this.refresh();
    }

    _upgradeProperty( prop ) {
        if( this.hasOwnProperty( prop ) && HistoryChart.prototype.hasOwnProperty( prop ) ) {
            let pv = this[prop];
            delete this[prop];
            this[prop] = pv;
        }
        if( this.hasAttribute( prop ) ) {
            let pv = this.getAttribute( prop );
            this.removeAttribute( prop );
            this[prop] = pv;
        }
    }

    async refresh() {
        if( !this.chart ) {
            return;
        }

        let devices = ( this._history || [] ).filter( h => this._device.id === h.sensor );
        let readings = [];
        let targets = [];
        let steppedLine = false;
        for( let device of devices ) {
            steppedLine = steppedLine || device.type === 'switch';
            let deviceReadings = [];
            if( this.starttime ) {
                deviceReadings.push({
                    x: this.starttime
                });
            }
            deviceReadings = deviceReadings.concat(
                device.fields.filter( reading => reading.value ).map( reading => {
                    return{
                        x: new Date( reading.time ),
                        y: reading.value.value
                    };
                })
            );
            if( this.endtime ) {
                deviceReadings.push({
                    x: this.endtime
                });
            }
            readings = readings.concat( deviceReadings );

            targets = targets.concat(
                device.fields.filter( reading => reading.target ).map( reading => {
                    return{
                        x: new Date( reading.time ),
                        y: reading.target.value
                    };
                })
            );
        }

        this.chart.data = {
            datasets: [ {
                label: 'reading',
                backgroundColor: 'lightgreen',
                data: readings,
                steppedLine: steppedLine && 'before'
            }, {
                label: 'target',
                backgroundColor: 'red',
                data: targets,
                steppedLine: 'before'
            } ]
        };

        this.chart.update();
    }

    get history() {
        return this._history;
    }

    set history( value ) {
        this._history = value;
        this.refresh();
    }

    get device() {
        return this._device;
    }

    set device( value ) {
        this._device = value;
        this.refresh();
    }
    
    get starttime() {
        return this._start;
    }

    set starttime( value ) {
        this._start = new Date( value );
        this.refresh();
    }
    
    get endtime() {
        return this._end;
    }

    set endtime( value ) {
        this._end = new Date( value );
        this.refresh();
    }
    
}


customElements.define( 'autohome-history-chart', HistoryChart );

