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

import './DeviceTable.js';
import './DeviceHistory.js';
import './DeviceChangesInput.js';

import clientAPI from './ClientAPI.js';
import Binding from './Binding.js';
import BaseEditor from './BaseEditor.js';

var template = null;

class AutoHomeDeviceEditor extends BaseEditor {
    constructor() {
        super( 'device', 'deviceChange' );
    }

    inviteMember() {
        console.log( 'invite member' );
    }

    get template() {
        return template;
    }

    async save() {
        return clientAPI.saveDevice();
    }

    async delete() {
        return clientAPI.deleteDevice();
    }

    handleDevicesChange( devices ) {
        this.shadowRoot.querySelector( 'device-changes-input' ).devices = devices;
    }

    async connectedCallback() {
        if( !this.template ) {
            template = await ( await fetch( './tmpl/DeviceEditor.tmpl.html' ) ).text();
        }

        await super.connectedCallback();

        clientAPI.on( 'devicesChange', this.handleDevicesChange.bind( this ) );

        this.refresh();
    }

    async refresh() {
        return clientAPI.setDevice( clientAPI.device.id );
    }
}


customElements.define( 'autohome-device-editor', AutoHomeDeviceEditor );
