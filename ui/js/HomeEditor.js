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

import './ZoneCard.js';

import clientAPI from './ClientAPI.js';
import Binding from './Binding.js';
import BaseEditor from './BaseEditor.js';
import './TZSelect.js';

var template = null;

class AutoHomeHomeEditor extends BaseEditor {
    constructor() {
        super( 'home', 'homeChange' );
    }

    inviteMember() {
        console.log( 'invite member' );
    }

    get template() {
        return template;
    }

    async save() {
        return clientAPI.saveHome();
    }

    async delete() {
        return clientAPI.deleteHome();
    }

    addZone() {
        let popover = this.shadowRoot.getElementById( 'add-zone-popover' );
        this.clearMessages( popover );
        popover.querySelector( '#nameInput' ).value = '';
        this.shadowRoot.getElementById( 'add-zone-popover' ).showAt( this.addZoneButton );
    }

    async submitNewZone() {
        let popover = this.shadowRoot.getElementById( 'add-zone-popover' );

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
            await clientAPI.postZone( data );
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
    
    handleZonesChange( zones ) {
        zones = zones || this.zones || [];
        this.zones = zones;

        let nameFilter = new RegExp( `${this.shadowRoot.getElementById( 'zone-search' ).value || ''}`, 'i' );
        zones = zones.filter(
            zone => nameFilter.test( zone.name )
        );

        this.populateList(
            zones, '#zones-panel', 'zone-template', 'autohome-zone-card',
            this.editButton.pressed, ( card, value ) => {
                card.addEventListener( 'click', () => {
                    clientAPI.setZone( value );
                });
            });
    }

    addMember() {
        let popover = this.shadowRoot.getElementById( 'add-member-popover' );
        this.clearMessages( popover );
        popover.querySelector( '#emailInput' ).value = '';
        this.shadowRoot.getElementById( 'add-member-popover' ).open( this.addMemberButton );
    }

    async submitNewMember() {
        let popover = this.shadowRoot.getElementById( 'add-member-popover' );

        if( popover.errorMessages ) {
            for( let errorMessage of popover.errorMessages ) {
                errorMessage.parentNode.removeChild( errorMessage );
            }
            delete popover.errorMessages;
        }

        let data = {
            email: popover.querySelector( '#emailInput' ).value || undefined
        };

        try {
            await clientAPI.postMember( data );
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

    handleMembersChange( members ) {
        members = members || this.members || [];
        this.members = members;

        let nameFilter = new RegExp( `${this.shadowRoot.getElementById( 'member-search' ).value || ''}`, 'i' );
        members = members.filter(
            member => nameFilter.test( member.user.name )
        );

        this.populateList(
            members, '#members-panel', 'member-template', 'ui5-card',
            this.editButton.pressed, ( card, value ) => {
                card.addEventListener( 'click', () => {
                    clientAPI.setMember( value );
                });
            });
    }

    async connectedCallback() {
        if( !this.template ) {
            template = await ( await fetch( './tmpl/HomeEditor.tmpl.html' ) ).text();
        }

        if( !this.shadowRoot ) {
            await super.connectedCallback();

            clientAPI.on( 'zonesChange', this.handleZonesChange.bind( this ) );
            clientAPI.on( 'membersChange', this.handleMembersChange.bind( this ) );

            //this.shadowRoot.getElementById( 'add-member-button' ).addEventListener( 'click', this.inviteMember.bind( this ) );

            this.addZoneButton = this.shadowRoot.getElementById( 'add-zone-button' );
            this.addZoneButton.addEventListener( 'click', this.addZone.bind( this ) );
            this.shadowRoot.getElementById( 'add-zone-popover-submit' ).addEventListener( 'click', this.submitNewZone.bind( this ) );
            this.shadowRoot.getElementById( 'zone-search' ).addEventListener( 'input', () => this.handleZonesChange() );
            
            this.addMemberButton = this.shadowRoot.getElementById( 'add-member-button' );
            this.addMemberButton.addEventListener( 'click', this.addMember.bind( this ) );
            this.shadowRoot.getElementById( 'add-member-popover-submit' ).addEventListener( 'click', this.submitNewMember.bind( this ) );
            this.shadowRoot.getElementById( 'member-search' ).addEventListener( 'input', () => this.handleMembersChange() );
        }
        
        this.refresh();
    }

    async refresh() {
        return clientAPI.setHome( clientAPI.home.id );
    }
}


customElements.define( 'autohome-home-editor', AutoHomeHomeEditor );
