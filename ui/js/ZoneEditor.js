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
import './DeviceTable.js';
import './DeviceHistory.js';

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

    selectDevice( event ) {
        clientAPI.setDevice( event.detail.row.binding.data.id );
    }

    addDevice() {
        let popover = this.shadowRoot.getElementById( 'add-device-popover' );
        this.clearMessages( popover );
        popover.querySelector( '#nameInput' ).value = '';
        this.shadowRoot.getElementById( 'add-device-popover' ).open( this.addDeviceButton );
    }

    async submitNewDevice() {
        let popover = this.shadowRoot.getElementById( 'add-device-popover' );

        if( popover.errorMessages ) {
            for( let errorMessage of popover.errorMessages ) {
                errorMessage.parentNode.removeChild( errorMessage );
            }
            delete popover.errorMessages;
        }

        let data = {
            name: popover.querySelector( '#nameInput' ).value || undefined,
            type: 'switch',
            threshold: 0,
            direction: 'output',
            calibrate: 0,
            interface: {
                type: 'gpio',
                address: ''
            },
            changes: []
        };

        try {
            await clientAPI.postDevice( data );
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
    
    handleDevicesChange( devices ) {
        this.shadowRoot.querySelector( 'autohome-device-table' ).devices = devices;
        this.shadowRoot.querySelector( 'autohome-device-history' ).devices = devices;
        this.shadowRoot.querySelector( 'autohome-schedule-table' ).devices = devices;
        this.shadowRoot.querySelector( 'autohome-override-table' ).devices = devices;
    }

    addSchedule( event ) {
        this.shadowRoot.querySelector( 'autohome-schedule-table' ).addSchedule();
    }

    addOverride() {
        this.shadowRoot.querySelector( 'autohome-override-table' ).addOverride();
    }

    async connectedCallback() {
        if( !this.template ) {
            template = await ( await fetch( './tmpl/ZoneEditor.tmpl.html' ) ).text();
        }

        clientAPI.on( 'devicesChange', this.handleDevicesChange.bind( this ) );

        await super.connectedCallback();

        this.shadowRoot.querySelector( 'autohome-device-table' ).addEventListener( 'row-click', this.selectDevice.bind( this ) );
        
        this.addDeviceButton = this.shadowRoot.getElementById( 'add-device-button' );
        this.addDeviceButton.addEventListener( 'click', this.addDevice.bind( this ) );
        this.shadowRoot.getElementById( 'add-device-popover-submit' ).addEventListener( 'click', this.submitNewDevice.bind( this ) );
        
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
