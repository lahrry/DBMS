/*!
 Copyright (c) 2021, 2022, Oracle and/or its affiliates.
 */
/**
 * @namespace apex.pwa
 * @since 21.2
 * @desc
 * <p>The apex.pwa namespace contains Oracle APEX functions related to Progressive Web App features.</p>
 * <p>These functions are useful only when an APEX application has enabled Progressive Web App in the application definition.</p>
 */
apex.pwa = {};

( function ( pwa, lang, $, debug, theme, message, env, actions ) {

    "use strict";

    const body$ = $("body"),
        // Constant selectors
        C_PWA_DLG = "a-pwaDialog",
        C_PWA_INSTALL_AVAILABLE = "a-pwaInstall--available",
        C_PWA_INSTALL = "a-pwaInstall",
        SEL_PWA_INSTALL = "." + C_PWA_INSTALL,
        PWA_INSTALL_ACTION = "a-pwa-install",
        // Constants for objects properties
        MODEL = "model",
        NAME = "name",
        VERSION = "version",
        // Constants for display modes
        DISPLAY_FULLSCREEN = "fullscreen",
        DISPLAY_STANDALONE = "standalone",
        DISPLAY_MINIMALUI = "minimal-ui",
        DISPLAY_BROWSER = "browser";

    // Initialize installPrompt for use later to show browser install prompt.
    let installPrompt;

    // Variable used for emitting installability log to the debug API when relevant.
    let installabilityLog;

    /**
     * Regex helper function
     * @ignore
     **/
    const regexMapper = function ( arrays ) {
        let i = 0,
            j,
            k,
            p,
            q,
            matches,
            match;

        // loop through all regexes maps
        while ( i < arrays.length && !matches ) {
            let regex = arrays[i], // even sequence (0,2,4,..)
                props = arrays[i + 1]; // odd sequence (1,3,5,..)
            j = k = 0;

            // try matching with regexes
            while ( j < regex.length && !matches ) {
                matches = regex[j].exec( window.navigator.userAgent );
                j += 1;

                if ( matches ) {
                    for ( p = 0; p < props.length; p++ ) {
                        k += 1;
                        match = matches[k];
                        q = props[p];
                        // check if given property is actually array
                        if ( typeof q === "object" && q.length > 0 ) {
                            if ( q.length === 2 ) {
                                if ( typeof q[1] === "function" ) {
                                    // assign modified match
                                    this[q[0]] = q[1].call( this, match );
                                } else {
                                    // assign given value, ignore regex match
                                    this[q[0]] = q[1];
                                }
                            } else if ( q.length === 3 ) {
                                // check whether function or regex
                                if ( typeof q[1] === "function" && !( q[1].exec && q[1].test ) ) {
                                    // call function (usually string mapper)
                                    this[q[0]] = match ? q[1].call( this, match, q[2] ) : undefined;
                                } else {
                                    // sanitize match using given regex
                                    this[q[0]] = match ? match.replace( q[1], q[2] ) : undefined;
                                }
                            } else if ( q.length === 4 ) {
                                this[q[0]] = match ? q[3].call( this, match.replace( q[1], q[2] ) ) : undefined;
                            }
                        } else {
                            this[q] = match ? match : undefined;
                        }
                    }
                }
            }
            i += 2;
        }
    },
    /**
     * Oracle Approved Regex List:
     * https://github.com/faisalman/ua-parser-js/blob/master/src/ua-parser.js
     **/
    regexes = {
        browser: [
            [/\bgsa\/([\w.]+) .*safari\//i],
            [[NAME, "GSA"]], // Google Search App on iOS

            [/WebView/i, /(iPhone|iPod|iPad)(?!.*Safari)/i, /Android.*(wv|.0.0.0)/i, / wv\).+(chrome)\/([\w.]+)/i, /((?:fban\/fbios|fb_iab\/fb4a)(?!.+fbav)|;fbav\/([\w.]+);)/i],
            [[NAME, "WEBVIEW"]],

            [/version\/([\w.]+) .*(mobile ?safari|safari)/i, /version\/([\w.]+) .*mobile\/\w+ (safari)/i],
            [[NAME, "SAFARI"]],

            [/\b(?:crmo|crios)\/([\w.]+)/i, /(chrome)\/v?([\w.]+)/i],
            [[NAME, "CHROME"]],

            [/edg(?:e|ios|a)?\/([\w.]+)/i],
            [[NAME, "EDGE"]],

            [/(firefox)\/([\w.]+)/i, /fxios\/([-\w.]+)/i],
            [[NAME, "FIREFOX"]],
        ],

        device: [
            [/\((iphone[\w ]*);/i],
            [[MODEL, "IPHONE"]],

            [/\((ipad);[-\w),; ]+apple/i, /applecoremedia\/[\w.]+ \((ipad)/i, /\b(ipad)\d\d?,\d\d?[;\]].+ios/i],
            [[MODEL, "IPAD"]],
        ],

        os: [
            [/microsoft (windows) (vista|xp)/i],
            [[NAME, "WINDOWS"], VERSION],

            [/ip[honead]{2,4}\b(?:.*os ([\w]+) like mac|; opera)/i, /cfnetwork\/.+darwin/i],
            [
                [VERSION, /_/g, "."],
                [NAME, "IOS"],
            ],

            [/(mac os x) ?([\w. ]*)/i, /(macintosh|mac_powerpc\b)(?!.+haiku)/i],
            [
                [NAME, "MAC_OS"],
                [VERSION, /_/g, "."],
            ],

            [/(android)[-/ ]?([\w.]*)/i],
            [[NAME, "ANDROID"], VERSION],

            [/(cros) [\w]+ ([\w.]+\w)/i],
            [[NAME, "CHROME_OS"], VERSION],

            [
                /([kxln]?ubuntu|debian|suse|opensuse|gentoo|arch(?= linux)|slackware|fedora|mandriva|centos|pclinuxos|red ?hat|zenwalk|linpus|raspbian|plan 9|minix|risc os|contiki|deepin|manjaro|elementary os|sabayon|linspire)(?: gnu\/linux)?(?: enterprise)?(?:[- ]linux)?(?:-gnu)?[-/ ]?(?!chrom|package)([-\w.]*)/i,
                /(hurd|linux) ?([\w.]*)/i,
                /(gnu) ?([\w.]*)/i,
            ],
            [[NAME, "LINUX"], VERSION],
        ],
    },
    /**
     * Get OS information based on current user agent
     * @ignore
     */
    getOS = () => {
        let os = {};
        os.name = undefined;
        os.version = undefined;
        regexMapper.call( os, regexes.os );

        if ( typeof os.version === "string" ) {
            os.major = Number( os.version.replace( /[^\d.]/g, "" ).split( "." )[0] );
        } else {
            os.major = undefined;
        }

        return os;
    },
    /**
     * Get device information based on current user agent
     * @ignore
     */
    getDevice = () => {
        let device = {};
        device.model = undefined;
        regexMapper.call( device, regexes.device );
        return device;
    },
    /**
     * Returns browser information based on current user agent
     * @ignore
     */
    getBrowser = () => {
        let browser = {};
        browser.name = undefined;
        regexMapper.call( browser, regexes.browser );
        return browser;
    },
    /**
     * Returns a curated user agent object
     * @ignore
     */
    getUserAgent = () => {
        let ua = {
            os: getOS(),
            device: getDevice(),
            browser: getBrowser(),
        };

        // Bug 33605186 User agent is wrong for iPad Pros
        // Reference 1: https://medium.com/@firt/iphone-11-ipados-and-ios-13-for-pwas-and-web-development-5d5d9071cc49
        // Reference 2: https://getpolarized.io/2019/12/20/Apple-Lying-About-User-Agent-in-iPad-Pro.html 
        // We have to check additional properties to determine if current OS
        // is actually iOS. We can do this by verifying if "standalone" property
        // exists in navigator, and if navigator.maxTouchPoints > 2,
        // then it's safe to assume the current device is iPad
        if ( ua.os.name === "MAC_OS" && ua.browser.name === "SAFARI" && "standalone" in navigator && navigator.maxTouchPoints > 2 ) {
            ua.os = { name: "IOS" };
            ua.device = { model: "IPAD" };
        }

        return ua;
    },

    /**
     * Initialize the UI for PWA related components
     * This function runs on page load and upon other events
     * Performs hide and show for PWA install buttons
     * @ignore
     */
    refreshUI = async () => {
        if ( await pwa.isInstallable() ) {
            body$.addClass( C_PWA_INSTALL_AVAILABLE );
            actions.show( PWA_INSTALL_ACTION );
        } else {
            body$.removeClass( C_PWA_INSTALL_AVAILABLE );
            actions.hide( PWA_INSTALL_ACTION );

            // Give reasonable time (2 seconds) after page load to allow for the browser
            // events to detect PWA installability criteria.
            // If the PWA can't be installed emit the reason using debug.info
            setTimeout(() => {
                if ( installabilityLog ) {
                    debug.info( installabilityLog );
                }
            }, 2000);
        }
    };

    /**
     * Registers the service worker on the current page
     * @ignore
     */
    pwa.registerServiceWorker = ( url ) => {
        if ( "serviceWorker" in navigator ) {
            window.addEventListener( "load", async () => {
                try {
                    await navigator.serviceWorker.register( url );
                    debug.info( "Service worker registered." );
                } catch ( err ) {
                    debug.warn( "Service worker failed to register.", err );
                }
            } );
        } else {
            if ( window.location.protocol === 'http:' ) {
                debug.warn( "Service workers are not supported on HTTP pages." );
            } else {
                debug.warn( "Service workers are not supported." );
            }
        }
    };

    /**
     * <p>Get the current display mode for the Progressive Web App.</p>
     * <p>Possible values are: fullscreen, standalone, minimal-ui, browser.</p>
     * <p>The display mode is set by the developer in the application definition.</p>
     * <p>This function is used to determine if the application is currently accessed through the PWA application (eg. in fullscreen) or through the browser normally.</p>
     *
     * @function getDisplayMode
     * @memberof apex.pwa
     * @return {string} Current display mode for the Progressive Web App
     *
     * @example <caption>Returns the Progressive Web App current display mode. Possible values are: fullscreen, standalone, minimal-ui, browser.</caption>
     * 
     * const displayMode = apex.pwa.getDisplayMode();
     */
    pwa.getDisplayMode = () => {
        if ( theme.mq( `(display-mode: ${DISPLAY_FULLSCREEN})` ) ) {
            return DISPLAY_FULLSCREEN;
        } else if ( theme.mq( `(display-mode: ${DISPLAY_STANDALONE})` ) ) {
            return DISPLAY_STANDALONE;
        } else if ( theme.mq( `(display-mode: ${DISPLAY_MINIMALUI})` ) ) {
            return DISPLAY_MINIMALUI;
        } else {
            return DISPLAY_BROWSER;
        }
    };

    /**
     * <p>Determines if the current session is eligible for installation of the Progressive Web App.</p>
     * <p>This function will look at:</p>
     * <ul>
     * <li>the user's operating system (Apple, Android, Window, macOS, etc).</li>
     * <li>the user's browser (Chrome, Safari, Edge, Firefox, etc).</li>
     * </ul>
     * <p>Given the user's current setup, this function will determine if installing the Progressive Web App is possible.</p>
     *
     * @function isInstallable
     * @memberof apex.pwa
     * @return {promise} A Promise returning a boolean (true or false), based on installation eligibility
     *
     * @example <caption>Returns if the APEX application is installable as a Progressive Web App..</caption>
     * 
     * const isInstallable = await apex.pwa.isInstallable();
     */
    pwa.isInstallable = async () => {
        // Reset installability log
        installabilityLog = null;

        // iOS Safari has navigator.standalone (non standard)
        if ( "standalone" in navigator ) {
            // navigator.standalone is true if app is opened from Home Screen, so it's not installable anymore
            // navigator.standalone is false if app is opened from Safari, so it's installable
            if ( navigator.standalone ) {
                installabilityLog = 'PWA is not installable. Current page view is already in PWA mode';
                return false;
            }
        }

        // Validate if app is already installed
        // This check must be done on top level navigation only (must not be an iframe)
        if ( "getInstalledRelatedApps" in navigator && window === window.parent ) {
            const relatedApps = await navigator.getInstalledRelatedApps();

            if ( relatedApps && relatedApps.length > 0 ) {
                installabilityLog = 'PWA is not installable due to being already installed on current device.';
                return false;
            }
        }

        // If display mode is fullscreen, standalone or minimalui
        // Then we are inside the PWA, so it's not installable anymore
        if ( [DISPLAY_FULLSCREEN, DISPLAY_STANDALONE, DISPLAY_MINIMALUI].includes( pwa.getDisplayMode() ) ) {
            installabilityLog = 'PWA is not installable. Current page view is already in PWA mode';
            return false;
        }

        // Bug 33551886
        // BeforeInstallPromptEvent is a non-standard event supported in a few select browsers
        // https://caniuse.com/?search=BeforeInstallPromptEvent
        // If this event exists, then we should only show the install button if the installPrompt
        // has been populated before. Otherwise the install button should be hidden.
        if ( "BeforeInstallPromptEvent" in window ) {
            if ( !installPrompt ) {
                installabilityLog = 'PWA is not installable. Browser installation criteria are not met or PWA may already be installed.';
                return false;
            }
        }

        // Fallback, the app is installable
        return true;
    };

    /**
     * <p>Returns the installation instruction text based on current user agent</p>
     * <p>Wheter the installability criteria are met or not, we provide helpful installation text to guide users to install their Progressive Web App.</p>
     *
     * @function getInstallText
     * @memberof apex.pwa
     * @return {promise} A Promise containing the installation instructions text
     *
     * @example <caption>Returns the text for the instructions for installing the Progressive Web App.</caption>
     * 
     * const installText = await apex.pwa.getInstallText();
     */
    pwa.getInstallText = async () => {
        const userAgent = getUserAgent();

        let messageText;

        /**
         * Builds the lang code for the current user agent
         * That will be used for returning the appropriate instruction text
         * @ignore
         */
        const buildMessage = ( keys ) => {
            let messageCode = "APEX.PWA.INSTRUCTIONS";

            keys.forEach( ( key ) => {
                if ( key ) {
                    messageCode += "." + String( key );
                }
            } );

            if ( lang.hasMessage( messageCode ) ) {
                messageText = lang.getMessage( messageCode );
                messageText = messageText.replace( /#IMAGE_PREFIX#/g, env.APEX_FILES );
            }
        };

        // Load all PWA messages first
        // We will load unnecessary messages but it will be useful
        // to avoid pinging the server many times
        await lang.loadMessages( ["APEX.PWA.%"] );

        // Level 1: APEX.PWA.INSTRUCTIONS.OS.BROWSER.MODEL.MAJOR
        buildMessage( [userAgent.os.name, userAgent.browser.name, userAgent.device.model, userAgent.os.major] );

        // Level 2: APEX.PWA.INSTRUCTIONS.OS.BROWSER.MODEL
        if ( !messageText ) {
            buildMessage( [userAgent.os.name, userAgent.browser.name, userAgent.device.model] );
        }

        // Level 3: APEX.PWA.INSTRUCTIONS.OS.BROWSER
        if ( !messageText ) {
            buildMessage( [userAgent.os.name, userAgent.browser.name] );
        }

        // Level 4: APEX.PWA.INSTRUCTIONS.OS
        if ( !messageText ) {
            buildMessage( [userAgent.os.name] );
        }

        // Level 5: APEX.PWA.INSTRUCTIONS (Generic)
        if ( !messageText ) {
            buildMessage( [] );
        }

        return messageText;
    };

    /**
     * <p>For browsers with automatic PWA installation, this function triggers the installation process.</p>
     * <p>For browsers without automatic PWA installation, this function opens a dialog with the instruction text for the current user agent.</p>
     * <p>This function is automatically invoked when clicking on any DOM element with the following class: <code class="prettyprint">.a-pwaInstall</code>.
     * <p>This function is also invoked on <code class="prettyprint">apex.actions</code> with action name <code class="prettyprint">a-pwaInstall</code>.
     * <p>For example when creating a new APEX application with PWA enabled, a navigation bar entry is added with the <code class="prettyprint">.a-pwaInstall</code> class and <code class="prettyprint">href="#action$a-pwaInstall"</code>. Developers can add custom buttons to their application and use the <code class="prettyprint">.a-pwaInstall</code> class or <code class="prettyprint">href="#action$a-pwaInstall"</code> to trigger the Progressive Web App installation process.</p>
     * <p>Alternatively, developers can run this function to trigger the PWA installation process programatically for a custom experience.</p>
     *
     * @function openInstallDialog
     * @memberof apex.pwa
     *
     * @example <caption>Opens the installation dialog for installing the Progressive Web App.</caption>
     * 
     * apex.pwa.openInstallDialog();
     */
    pwa.openInstallDialog = async () => {
        if ( installPrompt ) {
            // Show the browser native install prompt
            installPrompt.prompt();
        } else {
            // Otherwise show instructions
            const instructions = await pwa.getInstallText();

            // Open the dialog
            message.showDialog( instructions, {
                id: C_PWA_DLG,
                title: lang.getMessage( "APEX.PWA.DIALOG.TITLE" ),
                unsafe: false,
                width: "auto",
                okButton: false,
                dialogClass: C_PWA_DLG,
                open: () => {
                    // Accessibility helper to close the dialog when clicking
                    // outside of the dialog, since this is going to be called
                    // mostly on mobile devices
                    $( ".ui-widget-overlay" ).click( () => {
                        $( "#" + C_PWA_DLG ).dialog( "close" );
                    } );
                },
            } );
        }
    };

    /**
     * This function unregisters service workers and 
     * deletes all APEX core and app caches
     * @ignore
     */
    pwa.cleanup = () => {
        if ( "serviceWorker" in navigator ) {
            navigator.serviceWorker.getRegistrations().then( ( registrations ) => {
                for ( let registration of registrations ) {
                    registration.unregister();
                }
            } ).catch( ( error ) => {
                debug.warn( error );
            } );
        }

        if ( "caches" in window ) {
            window.caches.keys().then( ( cacheNames ) =>
                Promise.all(
                    cacheNames.map( ( cacheName ) => {
                        if ( cacheName.startsWith( "APEX-" ) ) {
                            return window.caches.delete( cacheName );
                        }
                    } )
                )
            ).catch( ( error ) => {
                debug.warn( error );
            } );
        }
    };

    window.addEventListener( "beforeinstallprompt", ( event ) => {
        // Prevent the mini-infobar from appearing on mobile
        event.preventDefault();

        // Store the event so it can be triggered later
        installPrompt = event;
        refreshUI();
    } );

    window.addEventListener( "appinstalled", () => {
        // Clear the installPrompt
        installPrompt = null;

        // Hide install buttons
        body$.removeClass( C_PWA_INSTALL_AVAILABLE );
        actions.hide( PWA_INSTALL_ACTION );
    } );

    $( () => {

        // Event listener when clicking on the "Install App" action
        actions.add( {
            name: PWA_INSTALL_ACTION,
            label: lang.getMessage( "PWA.INSTALL" ),
            icon: "fa fa-cloud-download",
            action: pwa.openInstallDialog
        } );

        // Event listener when clicking on the "Install App" button class.
        // This button is generally located in the navigation bar list
        // Usage of .not function below is to ensure we don't interfere
        // with the apex.actions handler
        $( SEL_PWA_INSTALL )
            .not(`:has([href="#action$${PWA_INSTALL_ACTION}"])`)
            .not(`[href="#action$${PWA_INSTALL_ACTION}"]`)
            .click( pwa.openInstallDialog );

        refreshUI();
    });
} )( apex.pwa, apex.lang, apex.jQuery, apex.debug, apex.theme, apex.message, apex.env, apex.actions );
