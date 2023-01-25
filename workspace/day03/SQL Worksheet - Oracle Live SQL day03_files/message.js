/*
 message.js
 Copyright (c) 2017, 2022, Oracle and/or its affiliates.
 */
/**
 * Requirements from server for this API to work:
 * - Server replaces the Page Template substitution "#SUCCESS_MESSAGE#" with: <span id="APEX_SUCCESS_MESSAGE" data-template-id="[template ID]"></span>
 * - Server replaces the Page Template substitution "#NOTIFICATION_MESSAGE#" with: <span id="APEX_ERROR_MESSAGE" data-template-id="[template ID]"></span>
 * - Server replaces label template substitution "#ERROR_TEMPLATE#" for each page item with: <span id="[item name]_error_placeholder" class="a-Form-error" data-template-id="[template id]"></span>
 * - Server calls apex.message.registerTemplates() for any templates required by the API (eg page success sub-template, page error sub-template, distinct label templates used on the page).
 *
 * To Do
 * - Allow messages to be stackable, and individually dismissable
 * - Handle when template ID may have a null sub-template, with some default?
 * - Optimise by caching success / error placeholder jQuery reference (there were issues with lost references when I tried this)
 * - Global storage for both success and errors, type="success", array gMessages, in the future have 'warnings', 'info'
 * - close handler for messages driven by data attribute, need to avoid having to go into old themes.
 * - ability to have custom class inline, defineable in the label template
 * - Handling of additional and technical info for any message, perhaps tooltip for additional, and dialog for technical
 *
 * Open Questions:
 * - Message 'location' structure, seems to allow for some odd combinations
 *
 * Dependencies:
 *  util.js
 *  lang.js
 *  jquery.ui.dialog.js - optional
 *  navigation.js - for dialogs
 *
 **/

/**
 * The apex.message namespace is used to handle client-side display and management of messages in Oracle APEX.
 * @namespace
 **/
apex.message = {};

( function( message, $, util, lang, debug ) {
    "use strict";

    // Constants
    const PAGE = "page",
        INLINE = "inline",
        TEMPLATE_ID = "template-id",
        FALLBACK_TEMPLATE = "FALLBACK_ET";

    const C_VISIBLE = "u-visible",
        C_HIDDEN = "u-hidden",
        C_ITEM_ERROR = "apex-page-item-error",
        C_FORM_ERROR = "a-Form-error";

    const A_DESCRIBEDBY = "aria-describedby",
        A_INVALID = "aria-invalid";

    const D_OLD_A_DESCRIBEDBY = "data-old-aria-describedby";

    // Globals
    var gTemplates = {},
        gErrors = [],
        gCheckVisibilityFunctions = [],
        gThemeHooks = {
            beforeShow: null,
            beforeHide: null,
            closeNotificationSelector: "button.t-Button--closeAlert",
            pageErrorsContainerSelector: '#t_Alert_Notification'
        };

    /**
     * Message type constants
     * @member {object} TYPE
     * @memberof apex.message
     * @property {string} SUCCESS Success message Value "success".
     * @property {string} ERROR Error message Value "error".
     */
    message.TYPE = {
        SUCCESS: "success",
        ERROR: "error"
    };

    /**
     * *** FOR INTERNAL USE ONLY ***
     *
     * Register templates with the page, that will be used by the APIs to display errors. Adds to existing templates
     * registered, if you want to clear the templates, first call clearTemplates().
     *
     * @ignore
     * @function registerTemplates
     * @memberof apex.message
     * @param {Array | Object} pTemplates Can be either an array or object, in the following formats:
     *   - Array of objects, where the object contains a 'markup' property with the template markup, and an 'ids'
     *     property with a comma separated list of all the template, or sub-template IDs that use this markup. This is
     *     the format used by our engine to emit the template information.
     *     [
     *         {
     *             "markup":"<span>...</span>",
     *             "ids":"480863097675702239_S,480863952955702254_S"
     *         },...
     *     ]
     *  - A plain object where the property is the template Identifier and the value is the markup:
     *  {
     *     "480866225768702257_E": "<span>...</span>",
     *     "480863097675702239_S": "<span>...</span>"
     *  }
     */
    message.registerTemplates = function( pTemplates ) {
        var i, j, lIDArray, lTemplate;

        if ( $.isPlainObject( pTemplates ) ) {
            gTemplates = $.extend( gTemplates, pTemplates );
        } else {
            for ( i = 0; i < pTemplates.length; i++ ) {
                lIDArray = pTemplates[ i ].ids.split( "," );

                // Loop through ID array and register each template reference by calling this API
                for ( j = 0; j < lIDArray.length; j++ ) {
                    lTemplate = {};
                    lTemplate[ lIDArray[ j ] ] = pTemplates[ i ].markup;
                    message.registerTemplates( lTemplate );
                }

            }
        }

    };


    /**
     * *** FOR INTERNAL USE ONLY ***
     *
     * Clears the current templates registered with the page.
     *
     * @ignore
     * @function clearTemplates
     * @memberof apex.message
     */
    message.clearTemplates = function() {
        gTemplates = {};
    };

    /**
     * *** FOR INTERNAL USE ONLY ***
     *
     * Returns all the templates registered
     *
     * @ignore
     * @function getTemplates
     * @memberof apex.message
     */
    message.getTemplates = function() {
        return gTemplates;
    };


    /**
     * Allows a theme to influence some behavior offered by the apex.message API. Call this function from theme page
     * initialization code.
     *
     * @function setThemeHooks
     * @memberOf apex.message
     * @param {Object} pOptions An object that contains the following properties:
     * @param {function} pOptions.beforeShow Callback function that will be called prior to the default show
     *     page notification functionality. Optionally return false from the callback to completely override default
     *     show functionality. Callback passes the following parameters:
     *     <ul>
     *         <li>pMsgType: Identifies the message type. Use {@link apex.message.TYPE} to identify whether showing an error or success message.</li>
     *         <li>pElement$: jQuery object containing the element being shown.</li>
     *     </ul>
     * @param {function} pOptions.beforeHide Callback function that will be called prior to the default hide
     *     page notification functionality. Optionally return false from the callback to completely override default
     *     hide functionality. Callback passes the following parameters:
     *     <ul>
     *         <li>pMsgType: Identifies the message type. Use {@link apex.message.TYPE} to identify whether showing an error or success message.</li>
     *         <li>pElement$: jQuery object containing the element being hidden.</li>
     *     </ul>
     * @param {string} pOptions.closeNotificationSelector jQuery selector to identify the close buttons in notifications,
     *     defaults to that used by Universal Theme (“button.t-Button—closeAlert”). May be required by custom themes if
     *     you still want to have APEX handle the hide logic, and where messaging contains a close notification button
     *     with a different class.
     * @param {string} pOptions.pageErrorsContainerSelector jQuery selector to identify the HTML element used to display the errors,
     *     defaults to that used by Universal Theme (“#t_Alert_Notification”). May be required by custom themes if
     *     you still want to have APEX to focus the error region after the page level errors are displayed.
     *
     * @example <caption>The following example shows beforeShow and beforeHide callbacks defined, that add and remove an
     * additional class ‘animate-msg’ on the notification element, before the default show and hide logic. This will only
     * happen for success messages because of the check on pMsgType.<br/>
     * Note: The callbacks do not return anything, therefore the default show / hide behavior will happen after the
     * callback.</caption>
     * apex.message.setThemeHooks({
     *     beforeShow: function( pMsgType, pElement$ ){
     *         if ( pMsgType === apex.message.TYPE.SUCCESS ) {
     *             pElement$.addClass( "animate-msg" );
     *         }
     *     },
     *     beforeHide: function( pMsgType, pElement$ ){
     *         if ( pMsgType === apex.message.TYPE.SUCCESS ) {
     *             pElement$.removeClass( "animate-msg" );
     *         }
     *     }
     * });
     */
    message.setThemeHooks = function( pOptions ) {
        gThemeHooks = $.extend( gThemeHooks, pOptions );
    };


    /**
     * <p>This function displays all errors on the apex.message error stack. If you do not want to add to the stack,
     * you must first call clearErrors(). Errors will display using the current app’s theme’s templates. For page level
     * messages (where location = “page”), error messages use markup from the page template’s ‘Subtemplate > Notification’
     * attribute. For item level messages (where location = “inline”), error messages use markup from the item’s
     * label template’s ‘Error Display > Error Template’ attribute. A side effect of calling this function is that
     * if there are page level errors, APEX will focus the errors container, please refer to {@link apex.message.setThemeHooks}
     * (specifically property pageErrorsContainerSelector), and if only displaying inline errors it will try to focus the first inline error
     * on the page following the display order.</p>
     * <p>Note Theme Developers should bear in mind the following:
     * <ul>
     *     <li>To display errors for a theme correctly, it must define both of the template attributes described above.
     *     In addition, for inline errors the label template must reference the #ERROR_TEMPLATE# substitution string in
     *     either the ‘Before Item’ or ‘After Item’ attributes of your label templates.</li>
     *     <li>As a theme developer, you can influence or override what happens when showing page level errors. For more
     *     information, please refer to {@link apex.message.setThemeHooks}, (specifically the beforeShow
     *     callback function, where you would need to check for ‘pMsgType === apex.message.TYPE.ERROR’ to isolate when
     *     showing page level errors).</li>
     * </ul>
     *
     * @function showErrors
     * @memberOf apex.message
     * @param {Object|Object[]} pErrors An object, or array of objects with the following properties:
     * @param {string} pErrors.type Must pass “error”, although may support different notification types in the future.
     * @param {string|string[]} pErrors.location Possible values are: “inline”, “page” or [ “inline”, “page” ].
     * @param {string} pErrors.pageItem Item reference where an ‘inline’ error should display.
     *     Required when location = “inline”.
     * @param {string} pErrors.message The error message.
     * @param {boolean} [pErrors.unsafe=true] Pass true so that the message will be escaped by showErrors. Pass false if the
     *     message is already escaped and does not need to be escaped by showErrors.
     *
     * @example <caption>In this example, we have 2 new errors to display. We do not want to add to any existing errors
     * that may be displayed, so we first clear any errors. Because we are displaying 2 errors, we pass an array containing
     * 2 error objects. The first error states ‘Name is required!’, and will display at both ‘page’ level, and ‘inline’
     * with the item ‘P1_ENAME’. The message text is considered safe and therefore will not be escaped. The second error
     * states ‘Page error has occurred!’, and will just display at page level, and the message text is considered safe
     * and therefore will not be escaped.</caption>
     * // First clear the errors
     * apex.message.clearErrors();
     *
     * // Now show new errors
     * apex.message.showErrors([
     *     {
     *         type:       "error",
     *         location:   [ "page", "inline" ],
     *         pageItem:   "P1_ENAME",
     *         message:    "Name is required!",
     *         unsafe:     false
     *     },
     *     {
     *         type:       "error",
     *         location:   "page",
     *         message:    "Page error has occurred!",
     *         unsafe:     false
     *     }
     * ]);
     */
    message.showErrors = function( pErrors ) {
        let lError, lLocation,
            lErrors = ( $.isPlainObject( pErrors ) ? [ pErrors ] : pErrors ),
            lPageErrors = [],
            lSuccessMessagePlaceholder$ = $( "#APEX_SUCCESS_MESSAGE" ),
            lInlineErrorsCounter = 0;

        // Add to existing stack
        for ( let i = 0; i < lErrors.length; i++ ) {
            gErrors.push( lErrors[ i ] );
        }

        sortErrors( gErrors );

        for ( let i = 0; i < gErrors.length; i++ ) {
            lError = gErrors[ i ];
            lLocation = ( typeof lError.location === "string" ? [ lError.location ] : lError.location );

            if ( $.inArray( INLINE, lLocation ) > -1 && lError.pageItem ) {
                _showPageItemError( lError );
                lInlineErrorsCounter += 1;
            }
            if ( $.inArray( PAGE, lLocation ) > -1 ) {
                lPageErrors.push( lError );
            }
        }

        if ( lPageErrors.length > 0 ) {
            _showPageErrors( lPageErrors );
            // todo for accessibility I think we need to focus either the notification area or the first error message in the notification area
        }

        // Hide success
        lSuccessMessagePlaceholder$
            .removeClass( C_VISIBLE )
            .addClass( C_HIDDEN );

        if ( lPageErrors.length === 0 && lInlineErrorsCounter > 0 ) {
            message.goToErrorByIndex( 0 );
        }
    };


    /* todo For clearErrors, pItemId is intentionally omitted from JSDoc as it doesn't yet work. Add this when it does:
     *     @param {string} pItemId Item identifier which if passed clears a specific item error
     */

    /**
     * This function clears all the errors currently displayed on the page.
     *
     * @function clearErrors
     * @memberOf apex.message
     * @example <caption>The following example demonstrates clearing all the errors currently displayed on the page.</caption>
     * apex.message.clearErrors();
     */
    message.clearErrors = function( pItemId ) {
        var i, lError, lItemErrors$, lLocation,
            lDoDefaultHide = true,
            lErrorMessagePlaceholder$ = $( "#APEX_ERROR_MESSAGE" );

        // Resets an items's focusable element to it's original state (this is modified in _showPageItemError)
        function resetItem( pItemId ) {
            var lItem$ = _getItemsFocusableElement( pItemId ),
                lOldAriaDescribedBy = lItem$.attr( D_OLD_A_DESCRIBEDBY );

            // If the item previously had aria-describedby, then we handle the clear slightly differently
            if ( lOldAriaDescribedBy ) {
                lItem$
                    .attr( A_DESCRIBEDBY, lOldAriaDescribedBy )
                    .removeAttr( A_INVALID + " " + D_OLD_A_DESCRIBEDBY )
                    .removeClass( C_ITEM_ERROR );
            } else {
                lItem$
                    .removeAttr( A_INVALID + " " + A_DESCRIBEDBY )
                    .removeClass( C_ITEM_ERROR );
            }
        }

        if ( pItemId ) {

            resetItem( pItemId );

            lItemErrors$ = $( "#" + pItemId + "_error_placeholder." + C_FORM_ERROR );

            // todo remove the specific error from page errors, if last error remove entire notification, decrement 'x' errors have occurred

        } else {

            // Loop through errors and find inline item errors...
            for ( i = 0; i < gErrors.length; i++ ) {
                lError = gErrors[ i ];
                lLocation = ( typeof lError.location === "string" ? [ lError.location ] : lError.location );

                if ( $.inArray( INLINE, lLocation ) > -1 && lError.pageItem ) {
                    resetItem( lError.pageItem );
                }
            }

            lItemErrors$ = $( "span." + C_FORM_ERROR );

            // If a theme has registered a beforeHide callback, then call it here
            if ( gThemeHooks.beforeHide ) {
                lDoDefaultHide = gThemeHooks.beforeHide( message.TYPE.ERROR, lErrorMessagePlaceholder$ );
            }

            // Theme's beforeHide has the ability to do it's own hiding, in which case it will return false and we know not to.
            // If beforeHide either returns true, or nothing (undefined), then we continue with our hiding
            if ( lDoDefaultHide === undefined || lDoDefaultHide ) {

                // Hide page error placeholder and reset back to sub-template default
                lErrorMessagePlaceholder$
                    .removeClass( C_VISIBLE )
                    .addClass( C_HIDDEN )
                    .html( "" );
            }

        }

        // Clear all form error span's and hide them
        lItemErrors$
            .html( "" )
            .removeClass( C_VISIBLE )
            .addClass( C_HIDDEN );

        // Clear the stack
        gErrors = [];

    };

    /**
     * *** FOR INTERNAL USE ONLY ***
     *
     * Set the browser focus on the associated element for the error equal to the passed error number, the focus will
     * be set only if an error with that error number exist in the page and if that error has either an item or a region
     * associated with it.
     *
     * Note: It cannot be documented until, we get an API to get all the errors in a page
     *
     * @ignore
     * @function goToErrorByNumber
     * @memberOf apex.message
     * @param {number} errorIndex any valid number, it is 0-based
     *
     * @example
     * // pagerErrors = [ errorObject{}, errorObject{} ]
     *
     * // if you want to navigate to the 2nd error you pass the errorNumber 1  to the function
     * apex.message.goToErrorByIndex( 1 );
     */
    message.goToErrorByIndex = function ( errorIndex ) {
        let error = gErrors[ errorIndex ],
            errorContext = {};

        if ( error ) {
            errorContext.region = error.regionStaticId;
            errorContext.instance = error.instance;
            errorContext.record = error.recordId;
            errorContext.column = error.columnName;
            errorContext.for = error.pageItem;

            _goToError( errorContext );
        }
    };


    /**
     * Displays a page-level success message. This will clear any previous success messages displayed, and also assumes
     * there are no errors, so will clear any errors previously displayed. Success messages will display using the
     * current app’s theme’s template. Specifically for page success messages, the markup from the page template’s
     * ‘Subtemplate > Success Message’ attribute will be used.
     *
     * Tip: As a theme developer, you can influence or override what happens when showing a page-level success message.
     * For more information, please refer to the apex.message.setThemeHooks function (specifically the beforeShow
     * callback function, where you would need to check for ‘pMsgType === apex.message.TYPE.SUCCESS’ to isolate when
     * showing a page-level success message).
     *
     * Tip: As a theme developer, you can influence or override what happens when showing a page-level success message.
     * For more information, please refer to the apex.message.setThemeHooks function (specifically the beforeShow
     * callback function, where you would need to check for ‘pMsgType === apex.message.TYPE.SUCCESS’ to isolate when
     * showing a page-level success message).
     *
     * @param {String} pMessage The success message to display.
     *
     * @example
     * // Displays a page-level success message ‘Changes saved!’.
     * apex.message.showPageSuccess( "Changes saved!" );
     *
     * @function showPageSuccess
     * @memberOf apex.message
     */
    message.showPageSuccess = function( pMessage ) {
        var lDoDefaultShow = true,
            lSuccessMessagePlaceholder$ = $( "#APEX_SUCCESS_MESSAGE" ),
            lTemplateData = {
                placeholders: {
                    SUCCESS_MESSAGE:            pMessage,
                    CLOSE_NOTIFICATION:         lang.getMessage( "APEX.CLOSE_NOTIFICATION" ),
                    SUCCESS_MESSAGE_HEADING:    lang.getMessage( "APEX.SUCCESS_MESSAGE_HEADING" ),
                    IMAGE_PREFIX:               window.apex_img_dir || ""
                }
            };

        // Clear the errors
        message.clearErrors();

        // Substitute template strings and copy that to the success placeholder tag, then show it
        lSuccessMessagePlaceholder$.html( util.applyTemplate( gTemplates[ lSuccessMessagePlaceholder$.data( TEMPLATE_ID ) ], lTemplateData ) );

        // If a theme has registered a beforeShow callback, then call it here
        if ( gThemeHooks.beforeShow ) {
            lDoDefaultShow = gThemeHooks.beforeShow( message.TYPE.SUCCESS, lSuccessMessagePlaceholder$ );
        }

        // Theme's beforeShow has the ability to do it's own showing, in which case it will return false and we know not to.
        // If beforeShow either returns true, or nothing (undefined), then we continue with our showing
        if ( lDoDefaultShow === undefined || lDoDefaultShow ) {
            lSuccessMessagePlaceholder$
                .removeClass( C_HIDDEN )
                .addClass( C_VISIBLE );
        }

    };

    /**
     * Hides the page-level success message.
     *
     * Tip: As a theme developer, you can influence or override what happens when hiding a page-level success message.
     * For more information, please refer to the apex.message.setThemeHooks function (specifically the beforeHide
     * callback function, where you would need to check for ‘pMsgType === apex.message.TYPE.SUCCESS’ to isolate when
     * hiding a page-level success message).
     *
     * @example
     * // Hides the page-level success message.
     * apex.message.hidePageSuccess();
     *
     * @function hidePageSuccess
     * @memberOf apex.message
     */
    message.hidePageSuccess = function() {
        var lDoDefaultHide = true,
            lSuccessMessagePlaceholder$ = $( "#APEX_SUCCESS_MESSAGE" );

        // If a theme has registered a beforeHide callback, then call it here
        if ( gThemeHooks.beforeHide ) {
            lDoDefaultHide = gThemeHooks.beforeHide( message.TYPE.SUCCESS, lSuccessMessagePlaceholder$ );
        }

        // Theme's beforeHide has the ability to do it's own hiding, in which case it will return false and we know not to.
        // If beforeHide either returns true, or nothing (undefined), then we continue with our hiding
        if ( lDoDefaultHide === undefined || lDoDefaultHide ) {
            lSuccessMessagePlaceholder$
                .removeClass( C_VISIBLE )
                .addClass( C_HIDDEN );
        }

    };


    /**
     * Displays a confirmation dialog with the given message and OK and Cancel buttons. The callback function passed as
     * the pCallback parameter is called when the dialog is closed, and passes true if OK was pressed and false
     * otherwise. The dialog displays using the jQuery UI ‘Dialog’ widget.
     *
     * There are some differences between this function and a browser’s built-in confirm function:
     * - The dialog style will be consistent with the rest of the app.
     * - The dialog can be moved.
     * - The call to apex.message.confirm does not block, and does not return true or false. Any code defined following
     *   the call to apex.message.confirm will run before the user presses OK or Cancel. Therefore acting on the user’s
     *   choice must be done from within the callback, as shown in the example.
     *
     * Note: If either of the following 2 pre-requisites are not met, the function falls back to using the browser’s
     * built-in confirm:
     * - jQuery UI dialog widget code must be loaded on the page.
     * - The browser must be running in ‘Standards’ mode. This is because if it is running in ‘Quirks’ mode (as is the
     *   case with some older themes), this can cause issues with display position, where the dialog positions itself in
     *   the vertical center of the page, rather than the center of the visible viewport.
     *
     * @param {string} pMessage     The message to display in the confirmation dialog
     * @param {function} pCallback  Callback function called when dialog is closed. Function passes the following
     *                              parameter:
     *                              - okPressed: True if OK was pressed, False otherwise (if Cancel pressed, or the
     *                                           dialog was closed by some other means).
     *
     * @example
     * // Displays a confirmation message ‘Are you sure?’, and if OK is pressed executes the ‘deleteIt()’ function.
     * apex.message.confirm( "Are you sure?", function( okPressed ) {
     *     if( okPressed ) {
     *         deleteIt();
     *     }
     * });
     *
     * @function confirm
     * @memberOf apex.message
     */
    message.confirm = function( pMessage, pCallback ) {
        // Put it at end of execution queue for sync AJAX callbacks
        setTimeout(function () {
            showDialog( "" + pMessage, {
                confirm: true,
                modern: true,
                callback: pCallback
            } );
        }, 0);
    };


    /**
     * Displays an alert dialog with the given message and OK button. The callback function passed as the pCallback
     * parameter is called when the dialog is closed. The dialog displays using the jQuery UI ‘Dialog’ widget.
     *
     * There are some differences between this function and a browser’s built-in alert function:
     * - The dialog style will be consistent with the rest of the app.
     * - The dialog can be moved.
     * - The call to apex.message.alert does not block. Any code defined following the call to apex.message.alert will
     *   run before the user presses OK. Therefore code to run after the user closes the dialog must be done from within
     *   the callback, as shown in the example.
     *
     * Note: If either of the following 2 pre-requisites are not met, the function falls back to using the browser’s
     * built-in confirm:
     * - jQuery UI dialog widget code must be loaded on the page.
     * - The browser must be running in ‘Standards’ mode. This is because if it is running in ‘Quirks’ mode (as is the
     *   case with some older themes), this can cause issues with display position, where the dialog positions itself in
     *   the vertical center of the page, rather than the center of the visible viewport.
     *
     * @param {String} pMessage     The message to display in the alert dialog
     * @param {Function} pCallback  Callback function called when dialog is closed.
     *
     * @example
     * // Displays an alert ‘Load complete.’, then after the dialog closes executes the ‘afterLoad()’ function.
     * apex.message.alert( "Load complete.", function(){
     *     afterLoad();
     * });
     *
     * @function alert
     * @memberOf apex.message
     */
    message.alert = function( pMessage, pCallback ) {
        // Put it at end of execution queue for sync AJAX callbacks
        setTimeout(function () {
            showDialog( "" + pMessage, {
                modern: true,
                callback: pCallback
            } );
        }, 0);
    };

    /**
     * In order to navigate to items (page items or column items) that have an error (or anything else that can be in an
     * error state), the error item must be visible before it is focused. Any region type that can possibly hide its
     * contents should add a visibility check function using this method. Each function added is called for any region
     * or item that needs to be made visible. This function is for APEX region plug-in developers.
     *
     * @param {function} pFunction  A function that is called with an element ID. The function should ensure that the
     *                              element is visible if the element is managed or controlled by the region type that
     *                              added the function.
     *
     * @example
     * // For example let’s assume we have a Region plug-in type called 'Expander', that can show or hide its contents
     * // and can contain page items. For purposes of example, this plug-in adds an 't-Expander' class to its region
     * // element and also has an 'expand' method available, to expand its contents. This region should register a
     * // visibility check function as follows:
     * apex.message.addVisibilityCheck( function( id ) {
     *     var lExpander$ = $( "#" + id ).closest( ".t-Expander" );
     *
     *     // Check if parent element of the element passed is an 'expander' region
     *     if ( lExpander$.hasClass( "t-Expander" ) ) {
     *
     *         // If so, expander region must show its contents
     *         lExpander$.expander( "expand" );
     *     }
     * });
     *
     * @function addVisibilityCheck
     * @memberOf apex.message
     */
    message.addVisibilityCheck = function( pFunction ) {
        gCheckVisibilityFunctions.push( pFunction );
    };

    /*
     * Private methods
     */

    var gTopDialogList = [],
        gDialogCleanupHandler = null,
        gShowDialogReturnFocusTo = null;

    /**
     * Shows a dialog or popup in the top APEX context.
     * For internal use only.
     *
     * @ignore
     * @param messageContent Defines the content of the dialog or popup. This is only used when the dialog is created.
     * Is one of:
     *  - simple string message. The message will be escaped unless options.unsafe is set to false.
     *  - a function that is called that returns a string of markup. This will be inserted in the DOM using
     *    the top APEX jQuery.
     *  - a jQuery object that is the content of the dialog. In this case care must be taken with respect
     *    to possible cross context issues.
     * @param {Object} options
     * @param {string} [options.id] If given the dialog id will be set to this value and it will not be destroyed
     *     when it closes. This allows the dialog to be reused. Normally the dialog or popup is destroyed on close.
     *     The ID should be globally unique for the app not just unique on the page. This is because the dialog
     *     could be opened in the top/main page from many other pages.
     * @param {string} [options.title] The dialog title. Not visible for popups.
     *      By default no title is shown, which mirrors the native browser alert / confirm dialogs.
     * @param {boolean} [options.isPopup] If true a popup widget is opened. If false a dialog widget is opened. Default is false.
     * @param {boolean} options.noOverlay Only applies if isPopup is true. See popup widget noOverlay option.
     * @param {jQuery} options.parentElement Only applies if isPopup is true. See popup widget parentElement option.
     * @param {boolean} options.draggable Only applies if isPopup is false. See dialog widget draggable option.
     * @param {boolean} options.resizable Only applies if isPopup is false. See dialog widget resizable option.
     * @param {number} options.width The dialog/popup width.
     * @param {number} options.height The dialog/popup height.
     * @param {function} options.init Called during dialog/popup create. The dialog jQuery object is passed in.
     * @param {function} options.open Called during the dialog/popup open callback.
     * @param {function} options.callback Called when the dialog is closed. If confirm is true the function is passed
     *     true if the OK button was pressed and false otherwise.
     * @param {function} options.beforeClose The dialog/popup beforeClose callback.
     * @param {function} options.resize The dialog/popup resize callback.
     * @param {function} options.resizeStop The dialog/popup resizeStop callback.
     * @param {string} [options.dialogClass] Extra classes to add to the dialog.
     * @param {boolean} options.defaultButton Default is false. If true pressing enter in any input field will activate
     *     the OK/hot button.
     * @param {boolean} [options.confirm] If true there is a "cancel" button. Also the callback function receives
     *     a boolean indicating if the OK button was pressed. Default is false.
     * @param {boolean} [options.notification] Default is true. Determines the role of the dialog.
     * @param {boolean} [options.okButton] Default is true. If true the dialog will have an "Ok" button.
     * @param {string} [options.okButtonClass] Depends on okButton. Class to be applied to the "Ok" button. Defaults to "ui-button--hot"
     * @param {string} [options.okLabel] Message for the OK button label.
     * @param {string} [options.okLabelKey] Message key for the OK button label. Will be used if options.okLabel is not provided.
     * @param {string} [options.cancelLabel] Message for the Cancel button label.
     * @param {string} [options.cancelLabelKey] Message key for the Cancel button label. Will be used if options.cancelLabel is not provided.
     * @param {array} [options.extraButtons] An array of extra button definitions.
     * @param {Element} [options.returnFocusTo] Element to return focus to. The default is document.activeElement.
     * @param {boolean} [options.unsafe] Pass true so that the message and title will be escaped by showDialog. Pass false if the
     *     message and title are considered safe as is. Defaults to true. This option always applies to the title, but only applies to messageContent if it is of type String.
     *
     * @param {boolean} [options.modern] In "modern" mode, the title is embedded above the message in the dialog body, as opposed to the title bar.
     *      For simplicity, the "X" close button is removed. This mode is ideal for simpler dialogs like alert and confirm. Defaults to false.
     * @param {string} [options.style] An optional style to apply to the dialog.
     *      The supported styles are "information", "warning", "danger" and "success".
     *      The style will override options.okButtonClass.
     *      The icon applied by the style can be overridden by options.iconClass.
     *      If nothing is provided, no icon will be shown. Only available in modern mode. Example: "fa fa-warning"
     * @param {string} [options.iconClass] Extra classes to be set for an icon which is displayed before the message. Only available in modern mode.
     * 
     * @returns {jQuery} the dialog.
     * @function showDialog
     * @memberOf apex.message
     */
    function showDialog( messageContent, options ) {
        var uiDialog$, dialog$, closeButton$, temp$, dialogOptions, // could be a popup or dialog widget
            okBtn$, widget, offset, iframeOffset, parentElement, sp$,
            proxyParentElementCreated = false,
            navigation = apex.navigation,
            jQuery = util.getTopApex().jQuery, // make sure dialog is added/created/opened in top level page so not confined to iframe
            topBody$ = jQuery( "body" ),
            result = null,
            buttons = [],
            idLabelledby, idDescribedby;

        // set defaults
        options = $.extend( {
            id: null,
            isPopup: false,
            noOverlay: false,
            draggable: true,
            resizable: false,
            notification: true,
            dialogClass: "ui-dialog--notification",
            okButton: true,
            okButtonClass: "ui-button--hot",
            okLabel: null,
            okLabelKey: "APEX.DIALOG.OK",
            cancelLabel: null,
            cancelLabelKey: "APEX.DIALOG.CANCEL",
            confirm: false,
            defaultButton: false,
            title: "",
            unsafe: true,

            modern: false,
            style: null,
            iconClass: null,
        }, options );


        if ( options.title ) {
            options.dialogClass += " ui-dialog--hasTitle";
        }

        if ( options.modern ) {

            options.dialogClass += " ui-dialog--modern";

            // a predefined style can affect the dialogClass, okButtonClass and iconClass
            if ( [ "information", "warning", "danger", "success" ].includes( options.style ) ) {
                // the style class is appended to any passed-in classes
                options.dialogClass += " ui-dialog--" + ( options.style === "information" ? "info" : options.style );

                // option okButtonClass is overridden
                options.okButtonClass = options.style === "danger" ? "ui-button--danger" : "ui-button--hot";

                // iconClass can override the style icon
                if ( options.iconClass === null ){
                    options.iconClass = "a-Icon"; // the actual style icon is applied in CSS
                }
            } else if ( options.style !== null ) {
                debug.error( `"${options.style}" is not a valid style for apex.message.showDialog` );
            }
        }

        widget = options.isPopup ? "popup" : "dialog";
        parentElement = options.parentElement;

        if ( options.id ) {
            dialog$ = jQuery( "#" + util.escapeCSS( options.id ) );
        }

        /*
         * Because the dialog may be opened in a different context the normal dialog
         * close functionality that returns focus to where it was doesn't work so we
         * track it ourselves.
         */
        gShowDialogReturnFocusTo = options.returnFocusTo || document.activeElement || null;

        /*
         * If the context is not the same the parentElement makes no sense for positioning because
         * the offset will be wrong. Create a proxy parentElement in the top context with proper offset.
         */
        if ( parentElement  && jQuery !== apex.jQuery ) {
            parentElement = $( parentElement ); // make sure it is a jQuery object
            offset = parentElement.offset();
            // get offset of this iframe
            iframeOffset = jQuery( "iframe" ).filter( function() { return this.contentWindow === window; } ).offset();
            sp$ = $( window ); // take into consideration the scroll offsets of the window
            offset.top += iframeOffset.top - sp$.scrollTop();
            offset.left += iframeOffset.left - sp$.scrollLeft();
            proxyParentElementCreated = true;
            options.parentElement = jQuery( "<div>" )
                .css( "position", "absolute" )
                .appendTo( topBody$ )
                .outerWidth( parentElement.outerWidth() )
                .outerHeight( parentElement.outerHeight() )
                .offset( offset );
        }

        if ( dialog$ && dialog$[0] ) {
            // The dialog exists so just open it
            if ( proxyParentElementCreated ) {
                dialog$[widget]( "option", "parentElement", options.parentElement );
            }
            dialog$[widget]( "open" );
        } else {
            // Create dialog
            if ( typeof messageContent === "string" ) {
                dialog$ = jQuery( "<div>" + ( options.unsafe ? util.escapeHTML( messageContent ).replace( /\r\n|\n/g, "<br>" ) : messageContent ) + "</div>" );
            } else if ( typeof messageContent === "function" ) {
                dialog$ = jQuery( messageContent() );
            } else {
                dialog$ = messageContent;
            }

            if ( options.modern ) {
                temp$ = jQuery(
                    `<div>
                         <div class="a-AlertMessage">
                             ${ options.iconClass
                                 ? `<div class="a-AlertMessage-icon">
                                         <span aria-hidden="true" class="${ util.escapeHTMLAttr( options.iconClass ) }"></span>
                                 </div>`
                                 : ""
                             }
                             <div class="a-AlertMessage-body">
                                 ${ options.title ? `<div class="a-AlertMessage-title">${ options.unsafe ? util.escapeHTML( options.title || "" ) : options.title || "" }</div>` : "" }
                                 <div class="a-AlertMessage-details"></div>
                             </div>
                         </div>
                     </div>` );

                // in the case of a string message, do not append the extra div wrapper. only its contents
                temp$.find( ".a-AlertMessage-details" ).append( typeof messageContent === "string" ? dialog$.contents() : dialog$ );

                dialog$ = temp$;
            }

            if ( options.id ) {
                dialog$.attr( "id", options.id );
            }
            if ( options.okButton ) {
                buttons.unshift( {
                    class: "js-confirmBtn",
                    text: options.okLabel !== null ? options.okLabel : lang.getMessage( options.okLabelKey ),
                    click: function () {
                        result = true;
                        dialog$[widget]( "close" );
                    }
                } );
            }

            if ( options.confirm ) {
                buttons.unshift( {
                    text: options.cancelLabel !== null ? options.cancelLabel : lang.getMessage( options.cancelLabelKey ),
                    click: function () {
                        result = false;
                        dialog$[widget]( "close" );
                    }
                } );
            }

            if ( options.extraButtons ) {
                options.extraButtons.forEach( function ( b ) {
                    buttons.unshift( b );
                } );
            }

            /*
             * If opening a dialog in the top context (that is not this context) and leaving it there,
             * need to clean it up when this context goes away.
             */
            if ( options.id && jQuery !== apex.jQuery ) {
                gTopDialogList.push( {
                    dialogId: options.id,
                    widget: widget
                } );
                if ( !gDialogCleanupHandler ) {
                    gDialogCleanupHandler = function () {
                        var i, d;
                        for ( i = 0; i < gTopDialogList.length; i++ ) {
                            d = gTopDialogList[i];
                            jQuery( "#" + d.dialogId )[d.widget]( "close" ).remove();
                        }
                        $( window ).off( "unload", gDialogCleanupHandler );
                    };
                    $( window ).on( "unload", gDialogCleanupHandler );
                }
            }

            topBody$.append( dialog$ );

            dialogOptions = {
                closeText: lang.getMessage( "APEX.DIALOG.CLOSE" ),
                autoOpen: true,
                noOverlay: options.noOverlay, // ignored by dialog
                modal: true,
                classes: {
                    "ui-dialog": options.dialogClass
                },
                parentElement: options.isPopup ? options.parentElement : undefined, // ignored by dialog
                title: options.modern ? "" : options.title,
                closeOnEscape: true,
                create: function () {

                    uiDialog$ = jQuery( this ).closest( ".ui-dialog" );
                    okBtn$ = uiDialog$.find( ".js-confirmBtn" );
                    closeButton$ = uiDialog$.find( "button.ui-dialog-titlebar-close" );
                    
                    uiDialog$
                        .css( "position", "fixed" )         // don't scroll the dialog with the page
                        .attr( "role", options.notification ? "alertdialog" : "dialog" );

                    /* If dialog is for notification then make an alert dialog, which is what we want for this type of alert,
                     such that the user is interrupted and alerted to the messageContent. */

                    if ( options.init ) {
                        options.init( dialog$ );
                    }

                    // add OK button classes
                    if ( options.okButtonClass ) {
                        okBtn$.addClass( options.okButtonClass );
                    }

                    // in modern mode
                    //  - the title is embedded in the content, so the automatic aria attributes must be pointed to the right elements
                    //  - the original title element, and X button are removed. note we do not remove the entire title bar so that the dialog is still draggable
                    if ( options.modern ) {
                        idLabelledby = uiDialog$.attr( "aria-labelledby" );     // should be the id of the title
                        idDescribedby = uiDialog$.attr( "aria-describedby" );   // should be the id of the message

                        // title element is removed, but we reuse its ID for the custom title element
                        uiDialog$.find( "#" + util.escapeCSS( idLabelledby ) ).remove();
                        uiDialog$.find( ".a-AlertMessage-title" ).attr( "id", idLabelledby );

                        // message id is removed and applied to the custom message element
                        uiDialog$.find( "#" + util.escapeCSS( idDescribedby ) ).removeAttr( "id" );
                        uiDialog$.find( ".a-AlertMessage-details" ).attr( "id", idDescribedby );

                        // "X" close button is removed
                        closeButton$.remove();
                    } else {
                        // removing the "Close" text node of the X button as it makes styling difficult
                        // It already has the title attribute which is enough
                        closeButton$.contents().filter( ( i, elem ) => ( elem.nodeType === Node.TEXT_NODE ) ).remove();
                    }

                },
                open: function ( event ) {
                    navigation.beginFreezeScroll();

                    if ( options.open ) {
                        options.open( event );
                    } else {
                        /* Set focus to confirm button, which mirrors browser-based alerts. The dialog is automatically read by
                         screen readers by virtue of the aria-describedby pointing to the dialog contents. */
                        okBtn$.focus();
                    }
                },
                close: function () {
                    navigation.endFreezeScroll();
                    if ( options.callback ) {
                        if ( result === null ) {
                            result = false;
                        }
                        if ( options.confirm ) {
                            options.callback( result );
                        } else {
                            options.callback();
                        }
                    }
                    if ( proxyParentElementCreated ) {
                        dialog$[widget]( "option", "parentElement" ).remove();
                    }
                    if ( gShowDialogReturnFocusTo ) {
                        $( gShowDialogReturnFocusTo ).focus();

                    }
                    if ( !options.id ) {
                        dialog$.remove();
                    }
                },
                beforeClose: options.beforeClose,
                resize: options.resize,
                resizeStop: options.resizeStop,
                buttons: buttons
            };
            [ "draggable", "resizable", "width", "height", "minWidth", "minHeight", "maxWidth", "maxHeight" ].forEach( function( prop ) {
                if ( options[prop] !== undefined ) {
                    dialogOptions[prop] = options[prop];
                }
            } );
            dialog$[widget]( dialogOptions );
            if ( options.defaultButton ) {
                // Pressing enter in any text field will activate the default (hot) button
                dialog$.on( "keydown", function ( event ) {
                    if ( event.which === 13 && event.target.nodeName === "INPUT" ) {
                        okBtn$.click();
                        event.preventDefault();
                    }
                } );
            }
        }
        return dialog$;
    }

    /**
     * Internal use only
     * @ignore
     */
    message.showDialog = showDialog;

    function insertPlaceholder( pageItemId, itemElement$ ) {
        var parent$ = itemElement$.closest( "fieldset" ).parent();

        if ( !parent$.length ) {
            parent$ = itemElement$.parent();
        }
        return $( "<div id='" + pageItemId +"_error_placeholder' data-template-id='FALLBACK_ET' class='u-hidden'></div>" ).appendTo( parent$ );
    }

    // Sort the errors if they have an item or region associated to it in the order they are placed in the DOM, the errors
    // without an item or region associated to it will be sorted last and will keep the order they have previous sorting,
    // usually this will be the order they were generated in the server, if more than  one error is associated to the same
    // region e.g. 2 or more records has errors in an IG, they will be sorted by the IG region ID and then they will keep
    // the order they have between them.
    function sortErrors( errors ) {
        let elementIds = [],
            sortedElementIds = [];

        // It gets all the items and regions associated with an error
        errors.forEach( ( value ) => {
            if ( value.pageItem ) {
                elementIds.push( '#' + util.escapeCSS( value.pageItem ) );
            } else if ( value.regionStaticId ) {
                elementIds.push( '#' + util.escapeCSS( value.regionStaticId ) );
            }
        } );

        if ( elementIds.length > 0 ) {
            // Creates a selector with all the items and columns associated with errors, jQuery will always return them
            // in the order they are placed in the DOM.
            $( elementIds.join( ', ' ) ).each( ( _, element ) => sortedElementIds.push( element.id ) );
        }

        // Sorts the array of errors based on the list of sorted Element IDs
        errors.sort( ( firstElement, secondElement ) => {
            let firstElementDomPos,
                secondElementDomPos,
                result;

            if ( firstElement.pageItem ) {
                firstElementDomPos = sortedElementIds.indexOf( firstElement.pageItem );
            } else if ( firstElement.regionStaticId ) {
                firstElementDomPos = sortedElementIds.indexOf( firstElement.regionStaticId );
            }
            if ( firstElementDomPos === -1 ) {
                firstElementDomPos = undefined;
            }

            if ( secondElement.pageItem ) {
                secondElementDomPos = sortedElementIds.indexOf( secondElement.pageItem );
            } else if ( secondElement.regionStaticId ) {
                secondElementDomPos = sortedElementIds.indexOf( secondElement.regionStaticId );
            }
            if ( secondElementDomPos === -1 ) {
                secondElementDomPos = undefined;
            }

            if ( typeof firstElementDomPos !== 'undefined' && typeof secondElementDomPos === 'undefined' ) {
                result = -1;
            } else if ( typeof secondElementDomPos !== 'undefined' && typeof firstElementDomPos === 'undefined' ) {
                result = 1;
            } else if ( typeof firstElementDomPos === 'undefined' && typeof secondElementDomPos === 'undefined' ) {
                result = 0;
            } else if ( typeof firstElementDomPos !== 'undefined' && typeof secondElementDomPos !== 'undefined' ) {
                result = firstElementDomPos - secondElementDomPos;
            }

            return result;
        } );
    }

    // Gets an items focusable element by using the setFocusTo callback value if defined, if not just uses the element
    // with an ID set to the item name.
    // todo consider extending item API to return this element, as currently this code is duplicated with that performed
    // in item.js setFocus handling.
    function _getItemsFocusableElement( pItem ) {
        var lItemsFocusableElement$,
            lApexItem = apex.item( pItem );

        if ( lApexItem.callbacks && 
             lApexItem.callbacks.setFocusTo && 
             !( $( "#" + util.escapeCSS( pItem )).hasClass( "rich_text_editor") ) 
        ) {
            if ( $.isFunction( lApexItem.callbacks.setFocusTo ) ) {
                lItemsFocusableElement$ = lApexItem.callbacks.setFocusTo.call ( lApexItem );
            } else {

                lItemsFocusableElement$ = $( lApexItem.callbacks.setFocusTo );
            }
        } 
        else if ( $.isFunction( lApexItem.setFocusTo ) ) {
          lItemsFocusableElement$ = $( lApexItem.setFocusTo() );
        }
        else {
            lItemsFocusableElement$ = $( "#" + util.escapeCSS( pItem ) );
        }

        return lItemsFocusableElement$;
    }

    // Function to show inline page item errors
    function _showPageItemError( pError ) {
        var lAttributes = {}, lTemplateData = {},
            lErrorElementId = util.escapeCSS( pError.pageItem ) + "_error",
            lFocusableElement$ = _getItemsFocusableElement( pError.pageItem ),
            lErrorPlaceholder$ = $( "#" + util.escapeCSS( pError.pageItem ) + "_error_placeholder" ),
            lCurrentAriaDescribedBy = lFocusableElement$.attr( A_DESCRIBEDBY ),
            lErrorMsg = util.htmlBuilder();

        if ( !lErrorPlaceholder$.length ) {

            // any new theme should have an error placeholder. If we don't find one then it may be a legacy theme
            // or 3rd party or custom theme not yet updated to this new way so insert a placeholder.
            // The better solution is to update the theme template to include the new
            // error placeholder markup. The fallback logic cannot know exactly where it is best to include the
            // inline message. Better to show something in the wrong place than to show nothing at all.
            lErrorPlaceholder$ = insertPlaceholder( pError.pageItem, lFocusableElement$ );

            // Make sure there is a fallback template to use.
            if ( !gTemplates[FALLBACK_TEMPLATE] ) {
                gTemplates[FALLBACK_TEMPLATE] = "<div class='t-Form-error'>#ERROR_MESSAGE#</div>";
            }
        }

        // Wrap message with DIV with known ID (mirroring wwv_flow_error.prepare_inline_error_output), which is used by
        // the item to provide an accessible error message
        lErrorMsg.markup( "<div" )
            .attr( "id", lErrorElementId )
            .markup( ">" );
        // Escape if unsafe is true, or not passed
        if ( pError.unsafe === undefined || pError.unsafe ) {
            lErrorMsg.content( pError.message );
        } else {
            lErrorMsg.markup( pError.message );
        }
        lErrorMsg.markup( "</div>" );

        lTemplateData.placeholders = {
            ERROR_MESSAGE: lErrorMsg.toString()
        };

        // Copy sub-template to placeholder
        lErrorPlaceholder$.html( gTemplates[ lErrorPlaceholder$.data( TEMPLATE_ID ) ] );

        lErrorPlaceholder$
            .html( util.applyTemplate( lErrorPlaceholder$.html(), lTemplateData ) )
            .removeClass( C_HIDDEN )
            .addClass( C_VISIBLE );

        // Item's focusable element needs some modification
        if ( lCurrentAriaDescribedBy ) {

            // Retain whatever may be defined in the item's aria-describedby (for example inline help)
            lAttributes[ D_OLD_A_DESCRIBEDBY ] = lCurrentAriaDescribedBy;

            // Add error ID before described by, as the error should be reported first
            lAttributes[ A_DESCRIBEDBY ] = lErrorElementId + " " + lCurrentAriaDescribedBy;
        } else {

            // If there was no current describedby, just set the error ID
            lAttributes[ A_DESCRIBEDBY ] = lErrorElementId;
        }
        lAttributes[ A_INVALID ] = true;

        // Update item
        lFocusableElement$
            .addClass( C_ITEM_ERROR )
            .attr( lAttributes );

    }

    function _showPageErrors( pErrors ) {
        var lErrorSummary,
            out = util.htmlBuilder(),
            lTemplateData = {},
            lDoDefaultShow = true,
            lErrorMessagePlaceholder$ = $( "#APEX_ERROR_MESSAGE" );

        lErrorMessagePlaceholder$.html( gTemplates[ lErrorMessagePlaceholder$.data( TEMPLATE_ID ) ] );

        // Following markup needs to be kept in sync with what is emitted by the server for full page error display (wwv_flow_page.plb)
        out.markup( "<div" )
            .attr( "class", "a-Notification a-Notification--error" )
            .markup( ">" );

        out.markup( "<h2" )
            .attr( "class", "a-Notification-title aErrMsgTitle" )
            .markup( ">" );

        if( pErrors.length === 1 ) {
            lErrorSummary = lang.getMessage( "FLOW.SINGLE_VALIDATION_ERROR" );
        } else {
            lErrorSummary = lang.formatMessage( "FLOW.VALIDATION_ERROR", pErrors.length );
        }

        out.content( lErrorSummary )
            .markup( "</h2>" );

        out.markup( "<ul" )
            .attr( "class", "a-Notification-list htmldbUlErr" )
            .markup( ">" );

        for( let i = 0; i < pErrors.length; i++ ) {
            let lError   = pErrors[i],
                // Check if this error supports navigation to a component, currently we support going to items or regions
                lHasLink = ( lError.pageItem || lError.regionStaticId );

            out.markup( "<li" )
                .attr( "class", "a-Notification-item htmldbStdErr" )
                .markup( ">" );

            if ( lHasLink ) {
                // Keep list of attribute in sync with click handler code that uses them below
                out.markup( "<a")
                    .attr( "href", "#" )
                    .optionalAttr( "data-region", lError.regionStaticId )
                    .optionalAttr( "data-instance", lError.instance )
                    .optionalAttr( "data-record", lError.recordId )
                    .optionalAttr( "data-column", lError.columnName )
                    .optionalAttr( "data-for", lError.pageItem )
                    .attr( "class", "a-Notification-link" )
                    .markup( ">") ;
            }

            // Escape if unsafe is true, or not passed
            if ( lError.unsafe === undefined || lError.unsafe ) {
                out.content( lError.message );
            } else {
                out.markup( lError.message );
            }

            if ( lHasLink ) {
                out.markup( "</a>" );
            }

            if ( lError.techInfo ) {
                let lDetail,
                    lTitle = lang.getMessage( "APEX.ERROR.TECHNICAL_INFO" );

                out.markup( "<button class='a-Button a-Button--notification js-showDetails' tabindex='-1' type='button'" )
                    .attr( "aria-label", lTitle )
                    .attr( "title", lTitle )
                    .markup( "><span class='a-Icon icon-info' aria-hidden='true'></span></button>" );
                out.markup( "<div class='a-Notification-details' style='display:none'><h2>" )
                    .content( lTitle )
                    .markup( "</h2><ul class='error_technical_info'>" );
                for ( let j = 0; j < lError.techInfo.length; j++ ) {
                    lDetail = lError.techInfo[j];
                    out.markup( "<li><span class='a-Notification-detailName'>" )
                        .content( lDetail.name + ": " )
                        .markup( "</span>" );
                    if ( lDetail.usePre ) {
                        out.markup( "<br>" );
                    }
                    out.markup( "<span")
                        .attr( "class", "a-Notification-detailValue" + ( lDetail.usePre ? " a-Notification--pre" : "" ) )
                        .markup( ">" )
                        .content( lDetail.value )
                        .markup( "</span></li>");
                }
                out.markup( "</ul></div>");
            }

            out.markup( "</li>" );
        }

        out.markup( "</ul>" );
        out.markup( "</div>" );

        lTemplateData.placeholders = {
            MESSAGE:                out.toString(),
            CLOSE_NOTIFICATION:     lang.getMessage( "APEX.CLOSE_NOTIFICATION" ),
            ERROR_MESSAGE_HEADING:  lang.getMessage( "APEX.ERROR_MESSAGE_HEADING" ),
            IMAGE_PREFIX:           window.apex_img_dir || ""
        };

        // Substitute template strings
        lErrorMessagePlaceholder$.html( util.applyTemplate( lErrorMessagePlaceholder$.html(), lTemplateData ) );

        // If a theme has registered a beforeShow callback, then call it here
        if ( gThemeHooks.beforeShow ) {
            lDoDefaultShow = gThemeHooks.beforeShow( message.TYPE.ERROR, lErrorMessagePlaceholder$ );
        }

        // Theme's beforeShow has the ability to do it's own showing, in which case it will return false and we know not to.
        // If beforeShow either returns true, or nothing (undefined), then we continue with our showing
        if ( lDoDefaultShow === undefined || lDoDefaultShow ) {
            lErrorMessagePlaceholder$
                .removeClass( C_HIDDEN )
                .addClass( C_VISIBLE );

            if ( gThemeHooks.pageErrorsContainerSelector ) {
                // If errors are being displayed at page level, we try to focus the error container
                $( gThemeHooks.pageErrorsContainerSelector ).attr( 'tabindex', '-1' ).focus();
            }
        }

    }

    function _hidePageErrors() {
        $( "#APEX_ERROR_MESSAGE" )
            .removeClass( C_VISIBLE )
            .addClass( C_HIDDEN );
    }

    function _goToError( errorContext ) {
        let item = errorContext.for;

        function makeVisible( id ) {
            for ( let i = 0; i < gCheckVisibilityFunctions.length; i++ ) {
                gCheckVisibilityFunctions[ i ]( id );
            }
        }

        if ( errorContext.for ) {
            let apexItem = apex.item( item );

            // make sure item can be seen if it is collapsed or on a non-active tab
            makeVisible( item );
            if ( $( '#' + item + '_CONTAINER,#' + item + '_DISPLAY,#' + item, apex.gPageContext$ ).filter( ":visible" ).length === 0 ) {
                apexItem.show();
            }
            apexItem.setFocus();
        } else if ( errorContext.region ) {
            let regionId = errorContext.region,
                region;

            // make sure region can be seen if it is collapsed or on a non-active tab
            makeVisible( regionId );

            region = apex.region( regionId );
            if ( region ) {
                region.gotoError( errorContext );
            }
        }
    }

    /*
     * Document ready logic
     */
    $( function() {
        $( "#APEX_SUCCESS_MESSAGE" ).on( "click", gThemeHooks.closeNotificationSelector, function ( pEvent ) {
            message.hidePageSuccess();
            pEvent.preventDefault();
        });

        $( "#APEX_ERROR_MESSAGE" )
            .on( "click", gThemeHooks.closeNotificationSelector, function( pEvent ) {
                _hidePageErrors();
                pEvent.preventDefault();
            })
            .on( "click", "a.a-Notification-link", function( pEvent ) {
                var lLink$ = $( this ),
                    lErrorContext = {};

                // don't use lLink$.data() to populate lErrorContext because it turns strings into arrays
                // Keep list of attribute in sync with code that adds them above
                $.each( ["data-region", "data-instance", "data-record", "data-column", "data-for"], function( i, attr ) {
                    var prop = attr.substr( 5 ),
                        value = lLink$.attr( attr );
                    if ( value !== undefined ) {
                        lErrorContext[prop] = value;
                    }
                });

                _goToError( lErrorContext );
                pEvent.preventDefault();
            })
            .on( "click", ".js-showDetails", function() {
                var btn$ = $( this ),
                    details$ = btn$.next();

                showDialog( details$, {
                    callback: function() {
                        btn$.after( details$ );
                    },
                    dialogClass: "ui-dialog--notificationLarge"
                } );
            })
            .on( "keydown", ".a-Notification-link", function( pEvent ) {
                if ( pEvent.which === 112 && pEvent.altKey ) {
                    $(this ).parent().find( ".js-showDetails" ).click();
                }
            });

    });

})( apex.message, apex.jQuery, apex.util, apex.lang, apex.debug );
