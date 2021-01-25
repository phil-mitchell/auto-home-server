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

    addDevice( event ) {
        this.shadowRoot.querySelector( 'autohome-device-table' ).addDevice();
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

        await super.connectedCallback();

        this.addDeviceButton = this.shadowRoot.getElementById( 'add-device-button' );
        this.addDeviceButton.addEventListener( 'click', this.addDevice.bind( this ) );
        
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
