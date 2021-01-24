async function authorize( url ) {
    const windowArea = {
        width: Math.floor( window.outerWidth * 0.8 ),
        height: Math.floor( window.outerHeight * 0.5 )
    };

    if( windowArea.width < 1000 ) { windowArea.width = 1000; }
    if( windowArea.height < 630 ) { windowArea.height = 630; }
    windowArea.left = Math.floor( window.screenX + ( ( window.outerWidth - windowArea.width ) / 2 ) );
    windowArea.top = Math.floor( window.screenY + ( ( window.outerHeight - windowArea.height ) / 8 ) );

    const sep = ( url.indexOf( '?' ) !== -1 ) ? '&' : '?';
    url = `${url}${sep}`;
    const windowOpts = `toolbar=0,scrollbars=1,status=1,resizable=1,location=1,menuBar=0,` +
                       `width=${windowArea.width},height=${windowArea.height},left=${windowArea.left},top=${windowArea.top}`;

    const authWindow = window.open( url, 'producthuntPopup', windowOpts );
    // Create IE + others compatible event handler
    const eventMethod = window.addEventListener ? 'addEventListener' : 'attachEvent';
    const eventer = window[eventMethod];
    const messageEvent = eventMethod === 'attachEvent' ? 'onmessage' : 'message';

    // Listen to message from child window
    return new Promise( ( resolve, reject ) => {
        eventer( messageEvent, ( e ) => {
            if( e.origin !== window.origin ) {
                authWindow.close();
                reject( new Error( 'Not allowed' ) );
            }

            authWindow.close();
            if( e.data && e.data.token ) {
                resolve( e.data );
            } else {
                reject( new Error( 'Unauthorised' ) );
            }
        });
    });
}

export default authorize;
