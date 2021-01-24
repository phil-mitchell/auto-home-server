import "@ui5/webcomponents/dist/Panel.js";
import "@ui5/webcomponents/dist/ToggleButton.js";
import "@ui5/webcomponents/dist/Input.js";
import "@ui5/webcomponents/dist/ComboBox.js";
import "@ui5/webcomponents/dist/Popover.js";
import "@ui5/webcomponents/dist/ResponsivePopover.js";
import "@ui5/webcomponents/dist/DatePicker.js";
import "@ui5/webcomponents/dist/Switch.js";
import "@ui5/webcomponents/dist/TextArea.js";
import "@ui5/webcomponents/dist/Select.js";
import "@ui5/webcomponents/dist/TabContainer.js";
import "@ui5/webcomponents/dist/Tab.js";
import "@ui5/webcomponents-fiori/dist/Bar.js";

import './ScheduleTable.js';
import './OverrideTable.js';

import clientAPI from './ClientAPI.js';
import Binding from './Binding.js';
import BaseEditor from './BaseEditor.js';

var template = null;

class AutoHomeZoneEditor extends BaseEditor {
    constructor() {
        super( 'zone', 'zoneChange' );
    }

    inviteMember() {
        console.log( 'invite member' );
    }

    get template() {
        return template;
    }

    async save() {
        return clientAPI.saveZone();
    }

    async delete() {
        return clientAPI.deleteZone();
    }

    addSensor() {
        let popover = this.shadowRoot.getElementById( 'add-sensor-popover' );
        this.clearMessages( popover );
        popover.querySelector( '#nameInput' ).value = '';
        this.shadowRoot.getElementById( 'add-sensor-popover' ).open( this.addSensorButton );
    }

    async submitNewSensor() {
        let popover = this.shadowRoot.getElementById( 'add-sensor-popover' );

        if( popover.errorMessages ) {
            for( let errorMessage of popover.errorMessages ) {
                errorMessage.parentNode.removeChild( errorMessage );
            }
            delete popover.errorMessages;
        }

        let data = {
            name: popover.querySelector( '#nameInput' ).value || undefined
        };

        try {
            await clientAPI.postSensor( data );
            popover.close();
        } catch( e ) {
            if( e.data && e.data.errors ) {
                for( let error of e.data.errors ) {
                    if( error.location.path ) {
                        this.addMessage( `${error.location.path} ${error.message}` );
                    } else {
                        this.addMessage( popover, error.message );
                    }
                }
            } else {
                this.addMessage( popover, e.message );
            }
        }
    }
    
    handleSensorsChange( sensors ) {
        sensors = sensors || this.sensors || [];
        this.sensors = sensors;

        this.populateList(
            sensors, '#sensors-panel', 'sensor-template', 'autohome-sensor-card',
            this.editButton.pressed, ( card, value ) => {
                card.addEventListener( 'ui5-headerClick', () => {
                    clientAPI.setSensor( value );
                });
            });
    }

    addOutput() {
        let popover = this.shadowRoot.getElementById( 'add-output-popover' );
        this.clearMessages( popover );
        popover.querySelector( '#nameInput' ).value = '';
        this.shadowRoot.getElementById( 'add-output-popover' ).open( this.addOutputButton );
    }

    async submitNewOutput() {
        let popover = this.shadowRoot.getElementById( 'add-output-popover' );

        if( popover.errorMessages ) {
            for( let errorMessage of popover.errorMessages ) {
                errorMessage.parentNode.removeChild( errorMessage );
            }
            delete popover.errorMessages;
        }

        let data = {
            name: popover.querySelector( '#nameInput' ).value || undefined
        };

        try {
            await clientAPI.postOutput( data );
            popover.close();
        } catch( e ) {
            if( e.data && e.data.errors ) {
                for( let error of e.data.errors ) {
                    if( error.location.path ) {
                        this.addMessage( `${error.location.path} ${error.message}` );
                    } else {
                        this.addMessage( popover, error.message );
                    }
                }
            } else {
                this.addMessage( popover, e.message );
            }
        }
    }
    
    handleOutputsChange( outputs ) {
        outputs = outputs || this.outputs || [];
        this.outputs = outputs;

        this.populateList(
            outputs, '#outputs-panel', 'output-template', 'autohome-output-card',
            this.editButton.pressed, ( card, value ) => {
                card.addEventListener( 'ui5-headerClick', () => {
                    clientAPI.setOutput( value );
                });
            });
    }

    addSchedule( event ) {
        this.shadowRoot.querySelector( 'autohome-schedule-table' ).addSchedule();
    }

    addOverride() {
        this.shadowRoot.querySelector( 'autohome-schedule-table' ).addSchedule();
    }

    async connectedCallback() {
        if( !this.template ) {
            template = await ( await fetch( './tmpl/ZoneEditor.tmpl.html' ) ).text();
        }

        await super.connectedCallback();

        clientAPI.on( this.changeEvent, () => {
            this.handleSensorsChange( ( clientAPI.zone || {}).sensors || [] );
            this.handleOutputsChange( ( clientAPI.zone || {}).outputs || [] );
        });

        
        this.addSensorButton = this.shadowRoot.getElementById( 'add-sensor-button' );
        this.addSensorButton.addEventListener( 'click', this.addSensor.bind( this ) );
        this.shadowRoot.getElementById( 'add-sensor-popover-submit' ).addEventListener( 'click', this.submitNewSensor.bind( this ) );
        
        this.addOutputButton = this.shadowRoot.getElementById( 'add-output-button' );
        this.addOutputButton.addEventListener( 'click', this.addOutput.bind( this ) );
        this.shadowRoot.getElementById( 'add-output-popover-submit' ).addEventListener( 'click', this.submitNewOutput.bind( this ) );

        this.addScheduleButton = this.shadowRoot.getElementById( 'add-schedule-button' );
        this.addScheduleButton.addEventListener( 'click', this.addSchedule.bind( this ) );

        this.addOverrideButton = this.shadowRoot.getElementById( 'add-override-button' );
        this.addOverrideButton.addEventListener( 'click', this.addOverride.bind( this ) );
        
        
        this.refresh();
    }

    async refresh() {
        return clientAPI.setZone( clientAPI.zone.id );
    }
}


customElements.define( 'autohome-zone-editor', AutoHomeZoneEditor );
