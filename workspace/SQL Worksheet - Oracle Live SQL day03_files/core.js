/*!
 * Copyright (c) 1999, 2022, Oracle and/or its affiliates.
 */
/**
Oracle Database APEX, Release 5.0

The Programs (which include both the software and documentation) contain proprietary information; they are provided under a license agreement containing restrictions on use and disclosure and are also protected by copyright, patent, and other intellectual and industrial property laws. Reverse engineering, disassembly, or decompilation of the Programs, except to the extent required to obtain interoperability with other independently created software or as specified by law, is prohibited.
The information contained in this document is subject to change without notice. If you find any problems in the documentation, please report them to us in writing. This document is not warranted to be error-free. Except as may be expressly permitted in your license agreement for these Programs, no part of these Programs may be reproduced or transmitted in any form or by any means, electronic or mechanical, for any purpose.
If the Programs are delivered to the United States Government or anyone licensing or using the Programs on behalf of the United States Government, the following notice is applicable:
U.S. GOVERNMENT RIGHTS Programs, software, databases, and related documentation and technical data delivered to U.S. Government customers are "commercial computer software" or "commercial technical data" pursuant to the applicable Federal Acquisition Regulation and agency-specific supplemental regulations. As such, use, duplication, disclosure, modification, and adaptation of the Programs, including documentation and technical data, shall be subject to the licensing restrictions set forth in the applicable Oracle license agreement, and, to the extent applicable, the additional rights set forth in FAR 52.227-19, Commercial Computer Software--Restricted Rights (June 1987). Oracle USA, Inc., 500 Oracle Parkway, Redwood City, CA 94065.
The Programs are not intended for use in any nuclear, aviation, mass transit, medical, or other inherently dangerous applications. It shall be the licensee's responsibility to take all appropriate fail-safe, backup, redundancy and other measures to ensure the safe use of such applications if the Programs are used for such purposes, and we disclaim liability for any damages caused by such use of the Programs.
Oracle, JD Edwards, PeopleSoft, and Siebel are registered trademarks of Oracle Corporation and/or its affiliates. Other names may be trademarks of their respective owners.
The Programs may provide links to Web sites and access to content, products, and services from third parties. Oracle is not responsible for the availability of, or any content provided on, third-party Web sites. You bear all risks associated with the use of such content. If you choose to purchase any products or services from a third party, the relationship is directly between you and the third party. Oracle is not responsible for: (a) the quality of third-party products or services; or (b) fulfilling any of the terms of the agreement with the third party, including delivery of products or services and warranty obligations related to purchased products or services. Oracle is not responsible for any loss or damage of any sort that you may incur from dealing with any third party.
*/
/*
 * This file holds the main APEX namespace and settings for jQuery.
 */

/**
 * <p>The apex namespace is the top level Oracle APEX namespace and contains a number of sub namespaces,
 * and a few common functions and properties.</p>
 *
 * <p>The apex namespace also contains information on APEX specific events.</p>
 *
 * @namespace apex
 */
window.apex = window.apex || {};

/**
 * This namespace property holds all the {@link item} interfaces that have been created on this page.
 * See {@link apex.fn:item|apex.item} for details.
 * @memberOf apex
 * @since 21.2
 */
apex.items = {};

/**
 * This namespace property holds all the {@link region} interfaces that have been created on this page.
 * See {@link apex.fn:region|apex.region} for details.
 * @memberOf apex
 * @since 21.2
 */
apex.regions = {};

/**
 * This object holds various environment values related to the APEX instance, current application and page. 
 * @member {object} env
 * @memberof apex
 * @property {string} APP_USER           The current username
 * @property {string} APP_ID             The application ID
 * @property {string} APP_PAGE_ID        The page ID
 * @property {string} APP_SESSION        The session ID
 * @property {string} APP_FILES          The relative path of the application static files
 * @property {string} WORKSPACE_FILES    The relative path of the workspace static files
 * @property {string} APEX_FILES         The relative path of the files distributed with Oracle APEX
 * @property {string} APEX_VERSION       The full version of the Oracle APEX instance
 * @property {string} APEX_BASE_VERSION  The base version of the Oracle APEX instance
 * 
 * @example <caption>Redirect to page 2 in the current application.</caption>
 * apex.navigation.redirect( "f?p=" + apex.env.APP_ID + ":2:" + apex.env.APP_SESSION );
 * 
 * @since 21.2
 */

// apex.env is already generated by the server, with {} being a fallback
apex.env = apex.env || {};

// completing apex.env with the values already available on the page
apex.env.APEX_FILES = window.apex_img_dir || "";

/**
 * <p>This namespace property holds the jQuery function that APEX uses. Ideally there is just one copy
 * of jQuery on a page but it is possible to have multiple copies and even different versions of jQuery on a page.
 * This is sometimes necessary when using third party plugins that only work with an older version of jQuery.
 * Use this property in place of global variables $ or jQuery to ensure you are using the same jQuery library that
 * APEX is using.</p>
 *
 * @type function
 * @example <caption>The following function creates a local variable $ as a convenient way to reference jQuery
 * while ensuring that it is using the same jQuery that APEX uses.</caption>
 * function myFunction() {
 *     var $ = apex.jQuery;
 *     // use $ to access jQuery functionality
 * }
 */
apex.jQuery = jQuery;

(function( $ ) {
    "use strict";

/**
 * <p>This namespace property stores the current page context. The current page context is set to the HTML document
 * (same as apex.jQuery(document)).</p>
 *
 * @type jQuery
 * @example <caption> This selects all elements with a CSS class of my_class, in the context of the current page.</caption>
 * apex.jQuery( ".my_class", apex.gPageContext$ );
 */
apex.gPageContext$ = $( document );

apex.gParentPageContext$ = apex.gPageContext$;

/*
 * Set up an error handler that can inform the dev toolbar that an error happened.
 * When dev toolbar is not present this does nothing.
 * todo consider in the future to use this for actual persistent logging of the errors
 * todo the intention behind calling window.onerror in server and dynamic_actions_core changes due to this
 */
function notifyErrors() {
    if ( apex._dtNotifyErrors ) {
        apex._dtNotifyErrors();
    } else {
        apex._pageHasErrors = true;
    }
}
const originalOnError = window.onerror; // If someone else has set up a handler chain to it. Hope any that come after are as kind.
window.onerror = function( messageOrEvent, source, lineno, colno, error ) {
    notifyErrors();
    if ( originalOnError ) {
        originalOnError( messageOrEvent, source, lineno, colno, error );
    }
};

// these jQuery errors are logged but don't flow through onerror
const originalJQueryDeferredExceptionHook = $.Deferred.exceptionHook;
if ( originalJQueryDeferredExceptionHook ) {
    $.Deferred.exceptionHook = function( error, stack ) {
        originalJQueryDeferredExceptionHook( error, stack );
        // check for error and not an ajax abort to avoid indicating an error when there is no error logged to the console
        if ( error && error.statusText !== "abort" ) {
            notifyErrors();
        }
    };
}

    /**
     * <p>This event is triggered on the window a couple hundred milliseconds after the window stops resizing.
     * Listen for this event to adjust or resize page content after the window is done resizing. In some cases this is
     * a better alternative to the window resize event, which is triggered many times as the window is being resized,
     * because it is triggered just once after the window stops resizing.</p>
     *
     * @event apexwindowresized
     * @memberof apex
     * @property {Event} Event <code class="prettyprint">jQuery</code> event object
     *
     * @example <caption>This example responds to the apexwindowresized event and updates page content based on
     * the new height and width.</caption>
     * apex.jQuery( window ).on( "apexwindowresized", function( event ) {
     *     var window$ = apex.jQuery( this ),
     *         height = window$.height(),
     *         width = window$.width();
     *     // update page content based on new window height and width
     * });

     */

    let resizeTimerId,
        lastStoredHeight = 0,
        lastStoredWidth = 0;

    // A simple debouncer for page resize events.
    $( window ).resize(function() {
        let window$ = $( window );
        // Certain plugins (Flotchart) and browsers (IE 8 and below) sometimes spam window resize events when the window
        // is not actually resizing. This guard prevents such spam events from triggering
        // an apexwindowresized event, by checking to see if the window height and width has changed since the
        // event was last fired.
        if ( window$.height() === lastStoredHeight && window$.width() === lastStoredWidth) {
            return;
        }
        lastStoredHeight = window$.height();
        lastStoredWidth = window$.width();
        if ( resizeTimerId ) {
            clearTimeout( resizeTimerId );
        }
        resizeTimerId = setTimeout( function() {
            $( window ).trigger( "apexwindowresized" );
            resizeTimerId = null;
        }, 200);
    });

    let gUserHasTouched = false; // set to true if the user has touched the browser/device since the session started

    $( function() {
        let lTestColour;

        /* The following code detects high contrast mode. It works because in high contrast mode the reported
           background color will not be the same as it was explicitly set.*/

        // Add an element with explicit background color set
        $( "body" ).append( "<p id='hcmtest' style='position:absolute;top:0;left:-99999px;background-color:#878787;'></p>" );

        // Get the background color
        lTestColour = $( "#hcmtest" ).css( "background-color" ).toLowerCase();

        // Remove the testing DIV, we don't need it anymore
        $( "#hcmtest" ).remove();

        // Different browsers return the color in different ways
        if ( lTestColour !== "#878787" && lTestColour !== "rgb(135, 135, 135)" ) {

            // add utility class to body tag
            $( "body").addClass( "u-HCM" );

        }

        /*
         * Code to determine if the user is touching their device. This is saved in session storage
         */
        const sessionStore = apex.storage.getScopedSessionStorage( {prefix: "APEX", useAppId: false} );
        if ( sessionStore.getItem( "userHasTouched" ) === "y" ) {
            gUserHasTouched = true;
        } else {
            // if user hasn't touched yet perhaps they will
            $( document.body ).one( "touchstart", function () {
                gUserHasTouched = true;
                // save in session
                sessionStore.setItem( "userHasTouched", "y" );
            } );
        }

        // add aria-label to the close button of all jQuery UI dialogs. see #33670212
        if ( $.ui && $.ui.dialog ) {
            $.widget( "ui.dialog", $.ui.dialog, {
                _create: function() {
                    this._super();
                    this.uiDialogTitlebarClose.attr( "aria-label", this.options.closeText );
                }
            } );
        }
    });

    /**
     * <p>Determine if the user is or has been interacting with this web app using touch since the browser session
     * began. Note: it is possible for the user to touch for the first time after this function is called.</p>
     *
     * <p>It is rare to need know this information since the app should be designed to work for both touch and non-touch environments.</p>
     *
     * @returns {boolean} true if the user has been using touch to interact with the web app and false otherwise.
     */
    apex.userHasTouched = function() {
        return gUserHasTouched;
    };

})( apex.jQuery );
