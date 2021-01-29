//import '@ui5/webcomponents-fiori/dist/Assets.js';
import '@ui5/webcomponents-icons/dist/json-imports/Icons.js';
import '@ui5/webcomponents-fiori/dist/ShellBar.js';
import '@ui5/webcomponents/dist/Button.js';
import '@ui5/webcomponents/dist/Title.js';
import "@ui5/webcomponents/dist/MessageStrip.js";
import "@ui5/webcomponents/dist/Card.js";
import "@ui5/webcomponents/dist/Popover.js";

import clientAPI from './ClientAPI.js';
import authorize from './window-auth-popup.js';

var template = null;

class AutoHomeApp extends HTMLElement {
    constructor() {
        super();

        this.attachShadow({ mode: 'open' });
    }

    async connectedCallback() {
        if( !template ) {
            template = await ( await fetch( './tmpl/AutoHome.tmpl.html' ) ).text();
        }
        this.shadowRoot.innerHTML = template;

        clientAPI.on( 'profileChange', this.handleProfileChange.bind( this ) );
        clientAPI.on( 'stateChange', this.updatePage.bind( this ) );
        clientAPI.on( 'homesChange', this.handleHomesChange.bind( this ) );

        var shellbar = this.shadowRoot.querySelector( 'ui5-shellbar' );
        shellbar.addEventListener( 'profileClick', event => {
            var menu = clientAPI.isLoggedIn() ?
                this.shadowRoot.querySelector( '#user-menu' ) :
                this.shadowRoot.querySelector( '#auth-menu' );
            menu.openBy( event.detail.targetRef );
        });
        shellbar.addEventListener( 'menuItemClick', event => {
            clientAPI.setState( JSON.parse( event.detail.item.dataset.state ) );
        });

        this.shadowRoot.querySelector( '#auth-google' ).addEventListener( 'click', this.authorizeGoogle.bind( this ) );
        //this.shadowRoot.querySelector( '#settings-button' ).addEventListener( 'click', this.authorizeGoogle.bind( this ) );
        this.shadowRoot.querySelector( '#logout-button' ).addEventListener( 'click', this.logout.bind( this ) );

        this.shadowRoot.querySelector( '#back-button' ).addEventListener( 'click', this.goBack.bind( this ) );

        this.handleProfileChange();
    }

    goBack() {
        history.back();
    }

    showMessage( message, type, duration ) {
        let item = document.createElement( 'ui5-messagestrip' );
        item.appendChild( document.createTextNode( message ) );
        item.setAttribute( 'slot', 'messages' );
        item.setAttribute( 'type', type || 'Information' );
        item.setAttribute( 'style', 'height: max-content' );
        this.appendChild( item );

        var timer = null;
        if( duration ) {
            timer = setTimeout( () => {
                timer = null;
                item.parentNode.removeChild( item );
            }, duration );
        }

        item.addEventListener( 'close', () => {
            if( timer ) {
                clearTimeout( timer );
                timer = null;
            }
            item.parentNode.removeChild( item );
        });

        return item;
    }

    clearMessages() {
        for( let item of this.querySelectorAll( '[slot=messages]' ) ) {
            item.parentNode.removeChild( item );
        }
    }

    logout() {
        this.shadowRoot.querySelector( '#user-menu' ).close();
        clientAPI.logout();
    }

    authorizeGoogle() {
        this.shadowRoot.querySelector( '#auth-menu' ).close();
        authorize( './auth/google' ).then( ( auth ) => {
            return clientAPI.login( auth );
        }, ( err ) => {
            return clientAPI.logout( err );
        });
    }

    async updatePage() {
        var shellbar = this.shadowRoot.querySelector( 'ui5-shellbar' );
        var title = 'AutoHome';
        var state = {};

        for( let item of shellbar.querySelectorAll( '[slot=menuItems]' ) ) {
            item.parentNode.removeChild( item );
        }
        
        function addMenuItem() {
            let item = document.createElement( 'ui5-li' );
            item.appendChild( document.createTextNode( title ) );
            item.setAttribute( 'slot', 'menuItems' );
            item.setAttribute( 'data-state', JSON.stringify( state ) );
            shellbar.insertBefore( item, shellbar.firstChild );
        }

        shellbar.secondaryTitle = 'Home';
        var page = 'home';
        if( clientAPI.home ) {
            addMenuItem();
            title += ' > ' + clientAPI.home.name;
            page = 'home-editor';
            shellbar.secondaryTitle = 'Home';
            state.home = clientAPI.home.id;
        }
        if( clientAPI.zone ) {
            addMenuItem();
            title += ' > ' + clientAPI.zone.name;
            page = 'zone-editor';
            shellbar.secondaryTitle = 'Zone';
            state.zone = clientAPI.zone.id;
        }
        if( clientAPI.device ) {
            addMenuItem();
            title += ' > ' + clientAPI.device.name;
            page = 'device-editor';
            shellbar.secondaryTitle = 'Device';
            state.zone = clientAPI.device.id;
        }
        shellbar.primaryTitle = title;

        if( !this.pageNode || this.page !== page ) {
            this.clearMessages();
            this.page = page;

            var content = this.shadowRoot.querySelector( 'slot:not([name])' ).assignedNodes();
            content.forEach( item => {
                item.parentNode.removeChild( item );
            });

            switch( page ) {
            case'home-editor':
                await import( './HomeEditor.js' );
                break;
            case'zone-editor':
                await import( './ZoneEditor.js' );
                break;
            case'device-editor':
                await import( './DeviceEditor.js' );
                break;
            }


            console.log( `loading page ${page}` ); 
            var template = this.shadowRoot.querySelector( `#page-autohome-${page}-template` ).content;
            this.pageNode = template.cloneNode( true );
            this.appendChild( this.pageNode );
        }
    }

    handleProfileChange( reason ) {
        var shellbar = this.shadowRoot.querySelector( 'ui5-shellbar' );
        var profile = shellbar.querySelector( 'ui5-avatar' );
        var usermenu = this.shadowRoot.querySelector( '#user-menu' );
        var usermenuBindings = usermenu.querySelectorAll( '[data-bind]' );

        if( clientAPI.isLoggedIn() ) {
            profile.image = clientAPI.profile.image;
            usermenuBindings.forEach( node => {
                let field = node.dataset.bind;
                let value = clientAPI.profile[field];
                node.innerText = value;
            });
        } else {
            profile.image = './img/guest.png';
            usermenuBindings.forEach( node => {
                node.innerText = '';
            });
        }

        if( reason ) {
            this.showMessage( `You have been logged out: ${reason}`, 'Warning', 5000 );
        }
    }

    handleHomesChange( homes ) {
        var shellbar = this.shadowRoot.querySelector( 'ui5-shellbar' );

        let template = this.shadowRoot.querySelector( '#card-home-template' ).content;

        if( !clientAPI.home ) {
            shellbar.secondaryTitle = 'Homes';

            var content = this.shadowRoot.querySelector( 'slot:not([name])' ).assignedNodes();
            content.forEach( item => {
                item.parentNode.removeChild( item );
            });

            for( let home of homes ) {
                let card = template.cloneNode( true );

                card.querySelector( 'ui5-card' ).heading = home.name;
                card.querySelector( 'ui5-card' ).addEventListener( 'ui5-headerClick', () => {
                    clientAPI.setHome( home.id );
                });
                this.appendChild( card );
            }
        }
    }
}


customElements.define( 'autohome-app', AutoHomeApp );
