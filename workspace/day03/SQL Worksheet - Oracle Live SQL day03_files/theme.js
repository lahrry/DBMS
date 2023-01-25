/*!
 Copyright (c) 2012, 2022, Oracle and/or its affiliates.
*/
/**
 * The apex.theme namespace contains functions useful for theme developers or that work closely with theme
 * related functionality. The functionality in this namespace may not be fully supported by all themes particularly
 * legacy, custom, or third party themes.
 * @namespace
 **/
apex.theme = {};

(function( theme, navigation, $, lang, util, widgetUtil, env , item) {
    "use strict";

    var C_HELP_DLG = "apex_popup_field_help",
        SEL_HELP_DLG = "#" + C_HELP_DLG,
        C_HELP_AREA = "apex_popup_help_area",
        SEL_HELP_AREA = "#" + C_HELP_AREA,
        C_STRETCHED = "ui-dialog--stretch",
        C_DIALOG_IS_CLOSING = "is-closing";

    var gFieldHelpReturnFocusTo = null,
        gFieldHelpCache = {}; // map helpid -> help info object

    var modalDialogHeight;

    const hasOwnProperty = util.hasOwnProperty;

    /**
     * <p>Display a standard item help dialog. This function may be useful for theme developers.
     * Theme requirements for the label Help Template:</p>
     * <ul>
     * <li>A click handler or javascript <code class="prettyprint">href</code> can invoke this function directly. For example:
     *     <code class="prettyprint"><pre>
     *         &lt;button ... onclick="apex.theme.popupFieldHelp('#CURRENT_ITEM_ID#','&SESSION.');" ...>Help&lt;/button></pre></code>
     * </li>
     * <li>The preferred way it to use the built-in delegated click event handler. For this give the
     *   clickable help element a class of <code class="prettyprint">js-itemHelp</code> and add a
     *   <code class="prettyprint">data-itemhelp</code> attribute with the current item id.
     *   For example:
     *   <code class="prettyprint"><pre>
     *     &lt;button class="... js-itemHelp" data-itemhelp="#CURRENT_ITEM_ID#" ...>Help&lt;/button></pre></code>
     * </li>
     * </ul>
     *
     * <p>The second method is preferred because you get Alt-F1 keyboard accessibility. For Alt+F1 to work the
     * label template Before Label and Item template attribute must include:
     *     <code class="prettyprint"><pre>
     *         id="#CURRENT_ITEM_CONTAINER_ID#"</pre></code>
     * With the first method you could add your own inline keydown handler.</p>
     *
     * @param {string|Object} pItemId item id to display help for or an object with properties <code class="prettyprint">helpText</code>,
     *     and <code class="prettyprint">title</code>. When an object is given the other parameters are ignored.
     * @param {string} [pSessionId] Current session id
     * @param {string} [pUrl] Override to specify the URL to use to fetch the help content. It should not include
     *          the <code class="prettyprint">p_output_format</code> param. This is an advanced parameter that is normally not needed.
     * @function popupFieldHelp
     * @memberOf apex.theme
     * @example <caption>The following example shows how a custom help message that looks like standard page item help
     * can be displayed.</caption>
     * apex.theme.popupFieldHelp( {title: "Custom Help", helpText: "Some helpful text"} );
     */
    theme.popupFieldHelp = function ( pItemId, pSessionId, pUrl ) {
        var url;

        gFieldHelpReturnFocusTo = document.activeElement || null;

        function cleanTitle( title ) {
            var result, t$ = $("<span></span>");
            result = title.replace( /&#?\w+;/g, function(m) {
                t$.html( m );
                return t$.text();
            } );
            return result;
        }

        function showDialog( helpInfo ) {
            var lDialog$ = util.getTopApex().jQuery( SEL_HELP_DLG ), // see below for why top is used here
                lDialogArea$ = util.getTopApex().jQuery( SEL_HELP_AREA );

            if ( lDialog$.length === 0 ) {

                if ( lDialogArea$.length === 0 ) {
                    // There is a bad interaction between dialogs and iframes. Dialogs move to the end
                    // of their container for proper stacking. Iframes reload when moved in the DOM
                    // APEX modal pages (and some other cases) use iframes in dialogs. Therefore
                    // we put the help non-modal dialog in its own container and use z-index to
                    // put it on top of other dialogs so that it is always on top and never disturbs the
                    // DOM order of other dialogs.
                    util.getTopApex().jQuery( "#wwvFlowForm" ).after( "<div id='" + C_HELP_AREA + "'></div>" );
                }
                // Add a new div with the retrieved page
                // Always create help dialogs in the context of the top level window. This is necessary because
                // of APEX modal pages which use an iframe. If this was not done the item help dialog would
                // be constrained to the iframe.
                lDialog$ = util.getTopApex().jQuery( "<div id='" + C_HELP_DLG + "' tabindex='0'>" + helpInfo.helpText + "</div>" );

                // open created div as a dialog
                lDialog$.dialog( {
                    closeText:   lang.getMessage( "APEX.DIALOG.CLOSE" ),
                    title:       cleanTitle( helpInfo.title ),
                    appendTo:    SEL_HELP_AREA,
                    dialogClass: "ui-dialog--helpDialog",
                    width:       500,
                    minHeight:   96,
                    create: function( ) {
                        // don't scroll the dialog with the page
                        lDialog$.closest( ".ui-dialog" ).css( "position", "fixed" );
                    },
                    resize: function( ) {
                        // resize sets position it to absolute so fix what resizable broke
                        lDialog$.closest( ".ui-dialog" ).css( "position", "fixed" );
                    },
                    close: function() {
                        // normally a dialog does a fine job restoring focus on close but because this dialog
                        // may have been open in a different browsing context from the actual item a little help is needed
                        // also lets us return to the last help field/button
                        if ( gFieldHelpReturnFocusTo ) {
                            $( gFieldHelpReturnFocusTo ).focus();
                        }
                    }
                } ).keydown(function(event) {
                        // let Alt+F6 return to the item but leave the help dialog open
                        if ( event.which === 117 && event.altKey ) {
                            if ( gFieldHelpReturnFocusTo ) {
                                $( gFieldHelpReturnFocusTo ).focus();
                            }
                        }
                    } );
            } else {

                // replace the existing dialog and open it again
                lDialog$
                    .html( helpInfo.helpText )
                    .dialog( "option", "title", cleanTitle ( helpInfo.title ) )
                    .dialog( "open" );
            }
            // todo this doesn't work when the help item is in a modal page
            lDialog$.focus();
        }

        if ( pUrl ) {
            url = pUrl;
        } else {
            url = "wwv_flow_item_help.show_help?p_item_id=" + pItemId + "&p_session=" + pSessionId;
        }

        if ( $.isPlainObject( pItemId ) ) {

            // it isn't really the item id it is a helpInfo object
            if ( pItemId.helpText.indexOf( "apex-help-dialog") < 0 ) {
                pItemId.helpText = "<div class='apex-help-dialog'>" + pItemId.helpText + "</div>";
            }
            showDialog( pItemId );
        } else {
            if ( gFieldHelpCache[pItemId]) {
                showDialog(gFieldHelpCache[pItemId]);
            } else {
                $.getJSON(
                    url + "&p_output_format=JSON",
                    function( pData ) {
                        if ( pData.title && pData.helpText ) {
                            showDialog( pData );
                            // Only cache items, don't cache URLs used by the Builder for dynamic plug-in attributes
                            if ( pItemId ) {
                                gFieldHelpCache[pItemId] = pData;
                            }
                        }
                    }
                );
            }
        }
    }; //popupFieldHelp

    $( function() {
        /*
         * Support item help. See comments for popupFieldHelp
         */
        $( document.body ).on( "click", ".js-itemHelp", function( /*event*/ ) {
            var itemId = $( this ).attr( "data-itemhelp" );
            if ( itemId ) {
                theme.popupFieldHelp( itemId, env.APP_SESSION );
            }
        } ).on( "keydown", function( event ) {
            // if Alt+F1 pressed show item help if on an item
            if ( event.which === 112 && event.altKey ) {
                // look for associated item help
                // There is no direct association between anything related to an item that takes focus
                // and the help button which gives the item id
                // Rely on the label template Before Label and Item template attribute to include id="#CURRENT_ITEM_CONTAINER_ID#"
                // so we can rely on a parent having an id that ends in "_CONTAINER"
                // from the container simply find the .js-itemHelp element
                // Also check for TD element to handle table based layouts.
                $( event.target ).parents().each(function() {
                    var helpElement$, itemId;

                    if ( ( this.id && /_CONTAINER$/.test( this.id ) ) || this.nodeName === "TD" ) {
                        helpElement$ = $( this ).find( ".js-itemHelp" );
                        if ( helpElement$.length ) {
                            itemId = helpElement$.attr( "data-itemhelp" );
                            if ( itemId ) {
                                theme.popupFieldHelp( itemId, env.APP_SESSION );
                                return false;
                            }
                        }
                        if ( this.nodeName !== "TD" ) {
                            return false;
                        }
                        // otherwise keep looking
                    }
                });
            }
        });

        /*
         * When modal dialogs open or close, close item help
         * We do this because the dialog (or popup) could have opened the help dialog and when the dialog closes
         * the help dialog now applies to a field that isn't even visible.
         */
        $( document.body ).on( "dialogopen dialogclose popupopen popupclose", function( event ) {
            var helpDlg$ = $( SEL_HELP_DLG ),
                dlg$ = $( event.target );
            // close help if exists, open, and not the help dialog and is modal (note popups behave modal even if modal option is false )
            if ( helpDlg$[0] && helpDlg$.dialog("isOpen" ) &&
                    dlg$[0] !== helpDlg$[0] && ( dlg$.is(":data(apexPopup)") || dlg$.dialog( "option", "modal" ) ) ) {
                // don't want closing the help dialog to steal focus away from what the other dialog opening or closing
                // has set focus to. Don't let the dialog or the apex field help logic steal focus.
                gFieldHelpReturnFocusTo = null;
                helpDlg$.data( "ui-dialog" ).opener = $( $.ui.safeActiveElement(document) ); // using an internal property
                helpDlg$.dialog( "close" );
            }
        } );

        /*
         * Label click handling, to handle focusing non-standard form elements
         */
        $( document.body ).on( "click", "label", function( pEvent ) {

            var lItem$,
                lLabelFor = $( this ).attr( "for" );

            if ( lLabelFor ) {
                lItem$ = $( "#" + util.escapeCSS( lLabelFor ) );

                // if the label is for an input, textarea or select do nothing, browser handles focus here
                // if the label is for something that is disabled or not visible again do nothing
                // also if the label contains an anchor do nothing - putting a link in a label is a bad practice but people do it
                if ( !( lItem$.is( "input,textarea,select" ) &&
                     !lItem$.prop( "disabled" ) &&
                     lItem$.is( ":visible" )) && $( this ).find( "a" ).length === 0 ) {

                    apex.item( lLabelFor ).setFocus();
                    pEvent.preventDefault();

                }
            }

        });

        /*
         * Initialize Region Dialogs
         *
         * Region Dialogs are APEX regions where the outer template element should be something very much like the following
         * <div id="#REGION_STATIC_ID#"  class="js-regionDialog ... #REGION_CSS_CLASSES#" #REGION_ATTRIBUTES# style="display:none" title="#TITLE#">
         * </div>
         * The important parts are that class includes js-regionDialog and the title contains the region title.
         *
         * The dialog region gets turned into a jQuery UI dialog widget when the page loads. To open the dialog use a DA
         * with JavaScript action containing:
         *   $("#<region_static_id>").dialog("open");
         * To close the dialog use a DA with JavaScript action containing:
         *   $("#<region_static_id>").dialog("close");
         *
         * The following template option classes are supported
         *   js-resizable: will make the dialog resizable
         *   js-draggable: will make the dialog draggable
         *   js-modal: will make the dialog modal
         *   js-dialog-sizeWWWxHHH: will set the dialog width to WWW and height to HHH
         *   js-dialog-width-WWW: will set just the dialog width to WWW
         *   js-dialog-height-HHH: will set just the dialog height to HHH
         *   js-dialog-class-XXX: will add class XXX to the dialog
         *
         * The following data attributes can be added using region Custom Attributes to give more control over
         * the dialog size and other jQuery UI dialog options
         *   data-width, data-height, data-minwidth, data-minheight, data-maxwidth, data-maxheight, data-dialogClass, data-appendTo
         *
         * More advanced settings can be made with a DA that runs on page load to set dialog options such as hide, show, and position
         *
         * A note about non-modal dialogs: Non modal dialogs can have a negative impact on dialogs that contain an iframe
         * The issue is that iframes get reloaded when they move in the DOM and jQuery UI dialogs will move in order to be
         * on top. This is not specific to APEX but APEX does use iframes as part of modal dialog pages and rich text
         * editor items. The solution is to put non-modal dialogs in their own container DIV and set the z-index thus
         * creating a "layer" so that other dialogs will not move in the DOM. To do this add a custom attribute
         * data-appendTo="#myDialogLayer". The myDialogLayer div will get created if needed or you could add it to your
         * page template. Then add a CSS rule (for example on the Page CSS Inline)
         *     #myDialogLayer .ui-dialog {
         *         z-index: 890;
         *     }
         */
        /*
         * Initialize Region Popups
         *
         * Region Popups are APEX regions where the outer template element should be something very much like the following
         * <div id="#REGION_STATIC_ID#"  class="js-regionPopup ... #REGION_CSS_CLASSES#" #REGION_ATTRIBUTES# style="display:none" title="#TITLE#">
         * </div>
         * The important parts are that class includes js-regionPopup and the title contains the region title.
         *
         * The popup region gets turned into a jQuery UI popup widget when the page loads. To open the popup use a DA
         * with JavaScript action containing:
         *   $("#<region_static_id>").popup("open");
         * To close the dialog use a DA with JavaScript action containing:
         *   $("#<region_static_id>").popup("close");
         *
         * The following template option classes are supported
         *   js-popup-noOverlay: the popup will not use an overlay
         *   js-dialog-sizeWWWxHHH: will set the dialog width to WWW and height to HHH
         *   js-dialog-width-WWW: will set just the dialog width to WWW
         *   js-dialog-height-HHH: will set just the dialog height to HHH
         *   js-popup-callout: the popup will have the callout option set to true. Only applies if the data-parent-element is used.
         *   js-popup-pos-PPP: the popup will be positioned relative to the parent. Only applies if the data-parent-element is used.
         *       Where PPP is one of "below", "above", "before", "after", "inside";
         *   js-dialog-class-XXX: will add class XXX to the dialog
         *
         * The following data attributes can be added using region Custom Attributes to give more control over
         * the dialog size and other jQuery UI dialog options
         *   data-width, data-height, data-minwidth, data-minheight, data-maxwidth, data-maxheight, data-dialogClass, data-appendTo
         *
         * The data-parent-element attribute is the selector for the parent element that the popup should be positioned
         * relative to.
         *
         * More advanced settings can be made with a DA that runs on page load to set dialog options such as hide, show, and position
         */
        $( ".js-regionDialog,.js-regionPopup" ).each( function() {
            var inst$ = $(this),
                isPopup = inst$.hasClass("js-regionPopup"),
                size = /js-dialog-size(\d+)x(\d+)/.exec( this.className ),
                width = /js-dialog-width-(\d+)/.exec( this.className ),
                height = /js-dialog-height-(\d+)/.exec( this.className ),
                relPos = /js-popup-pos-(\w+)/.exec( this.className ),
                parent = inst$.attr( "data-parent-element" ),
                options = {
                    autoOpen: false,
                    noOverlay: inst$.hasClass( "js-popup-noOverlay" ),
                    appendTo: "form[name='wwv_flow']", // use same default selector as page.js
                    closeText: apex.lang.getMessage( "APEX.DIALOG.CLOSE" ),
                    modal: isPopup || inst$.hasClass( "js-modal" ),
                    resizable: isPopup ? false : inst$.hasClass( "js-resizable" ),
                    draggable: isPopup ? false : inst$.hasClass( "js-draggable" ),
                    dialogClass: 'ui-dialog--inline',
                    create: function() {
                        $( this ).closest( ".ui-dialog" )
                            .css( "position", "fixed" )                 // don't scroll the dialog with the page
                            .attr( "aria-modal", options.modal );       // add aria-modal for accessibility    
                    }
                },
                widget = isPopup ? "popup" : "dialog";

            if ( size ) {
                options.width = size[1];
                options.height = size[2];
            }
            if ( width ) {
                options.width = width[1];
            }
            if ( height ) {
                options.height = height[1];
            }

            if ( parent && isPopup ) {
                options.parentElement = parent;
                if ( inst$.hasClass( "js-popup-callout" ) ) {
                    options.callout = true; // don't explicitly set to false
                }
                if ( relPos ) {
                    options.relativePosition = relPos[1];
                }
            }
            $.each(["width", "height", "minWidth", "minHeight", "maxWidth", "maxHeight"], function( i, prop ) {
                var attrValue = parseInt(inst$.attr( "data-" + prop.toLowerCase() ), 10);
                if ( !isNaN( attrValue ) ) {
                    options[prop] = attrValue;
                }
            });
            $.each(["appendTo", "dialogClass"], function( i, prop ) {
                var attrValue = inst$.attr( "data-" + prop.toLowerCase() );
                if ( attrValue ) {
                    options[prop] = attrValue;
                }
            });

            // append any js-dialog-class- class to the dialog's dialogClass option
            this.className.split(" ").forEach( jsCls => {
                let cls = /js-dialog-class-(.+)/.exec( jsCls );
                if (cls) {
                    options.dialogClass += " " + cls[1];
                }
            });

            if ( options.appendTo && options.appendTo.substring(0,1) === "#" &&  $( options.appendTo ).length === 0 ) {
                $("#wwvFlowForm").after( '<div id="' + util.escapeHTML( options.appendTo.substring( 1 ) ) + '"></div>' );
            }
            inst$[widget]( options )
                .on( widget + "open", function( ) {
                    if ( options.modal ) {
                        navigation.beginFreezeScroll();
                    }
                    widgetUtil.visibilityChange( inst$[0], true );
                    // on open if focused element is an apex item then call our items built in focus instead of 
                    // standard jQuery focus which may be different. Example of where this is an issue is for
                    // radio groups with a selected value.
                    let uiDialogFocusedElement$ = $(document.activeElement);
                    if ( item.isItem( uiDialogFocusedElement$.attr( "name" ) ) ){
                        item(uiDialogFocusedElement$.attr( "name") ).setFocus();
                    }
                })
                .on( widget + "resize", function( ) {
                    // resize sets position to absolute so fix what resizable broke
                    $(this).closest( ".ui-dialog" ).css( "position", "fixed" );
                })
                .on( widget + "beforeclose", function ( ) {
                    $(this).closest( ".ui-dialog" ).addClass( C_DIALOG_IS_CLOSING );
                })
                .on( widget + "close", function( ) {
                    if ( options.modal ) {
                        navigation.endFreezeScroll();
                    }
                    widgetUtil.visibilityChange( inst$[0], false );
                    setTimeout( () => {
                        $(this).closest( ".ui-dialog" ).removeClass( C_DIALOG_IS_CLOSING );
                    }, util.cssDurationToMilliseconds( $(this).css( "--js-dialog-close-timing" ) || "0ms" ) );
                });
        });

    });

    function callOpenOrCloseMethod( region, method ) {
        var p, inst,
            found = false,
            region$ = typeof region === "string" ? $( "#" + region ) : region,
            data = region$.data();

        function isFunction(x) {
            return typeof x === "function";
        }

        if ( data ) {
            // find a jQuery UI widget that can be opened or closed (expanded or collapsed)
            for ( p in data ) {
                if ( hasOwnProperty(data, p) ) {
                    inst = data[p];
                    if ( inst.widgetFullName && (
                            (isFunction(inst.open) && isFunction(inst.close)) ||
                            (isFunction(inst.expand) && isFunction(inst.collapse)) ) ) {
                        found = true;
                        // change method from open/close to expand/collapse if needed
                        if ( !inst.open ) {
                            method = method === "open" ? "expand" : "collapse";
                        }
                        inst[method]();
                        break;
                    }
                }
            }
        }
        if (!found) {
            throw new Error("Error: Region does not support being opened and closed.");
        }
        return region$;
    }

    /**
     * <p>Open a region that supports being opened such as an inline dialog, inline popup, or collapsible region.
     * For a region to support this function, it must be implemented with a jQuery UI widget
     * that supports either open and close methods or expand and collapse methods.</p>
     *
     * @since 18.2
     * @function openRegion
     * @memberOf apex.theme
     * @param {string|jQuery} pRegion The region to open. Either the region static id string or a jQuery object.
     * @return {jQuery} The jQuery object of the region.
     * @example <caption>The following example opens an inline dialog region with static id <code class="prettyprint">myDialog</code>.</caption>
     * apex.theme.openRegion( "myDialog" );
     */
    theme.openRegion = function( pRegion ) {
        return callOpenOrCloseMethod( pRegion, "open" );
    };

    /**
     * <p>Close a region that supports being opened such as an inline dialog, inline popup, or collapsible region.
     * For a region to support this function, it must be implemented with a jQuery UI widget
     * that supports either open and close methods or expand and collapse methods.</p>
     *
     * @since 18.2
     * @function closeRegion
     * @memberOf apex.theme
     * @param {string|jQuery} pRegion The region to close. Either the region static id string or a jQuery object.
     * @return {jQuery} The jQuery object of the region.
     * @example <caption>The following example closes an inline dialog region with static id <code class="prettyprint">myDialog</code>.</caption>
     * apex.theme.closeRegion( "myDialog" );
     */
    theme.closeRegion = function( pRegion ) {
        return callOpenOrCloseMethod( pRegion, "close" );
    };

    /**
     * <p>Test a media query. Return true if the document matches the given media query string and false otherwise.
     * This is a wrapper around <code>window.matchMedia</code>.</p>
     *
     * @since 20.1
     * @function mq
     * @memberOf apex.theme
     * @param {string} pMediaQuery The media query to test. For example: <code>(min-width: 400px)</code>
     * @return {boolean} true if the media query matches.
     * @example <caption>After each time the window is resized check and log a message if the viewport is at least 640 pixels wide.</caption>
     * apex.jQuery( window ).on( "apexwindowresized", function() {
     *     if ( apex.theme.mq( "(min-width: 640px)" ) ) {
     *         console.log( "Window resized, and viewport is at least 640px wide" );
     *     }
     * } );
     */
    theme.mq = function( pMediaQuery ) {
        var mql = matchMedia( pMediaQuery );
        return mql && mql.matches || false;
    };

    /**
     * Experimental capability to make a page fit to the size of the browser window and resize as the
     * window is resized.
     * TODO doc
     * @ignore
     */
    theme.pageResizeInit = function() {
        $( "#wwvFlowForm" ).addClass( "resize" );
        $( "body > link" ).hide(); // for some reason these are taking up space on Firefox
        $( "body" ).css( "overflow", "hidden" ); // This keeps scroll bars from messing up the size calculation

        // The page resize logic doesn't play well with flex box layout. Just in case the page or region templates
        // use flex box layout override that here.
        $( ".resize" ).each( function() {
            if ( $( this ).css( "display" ) === "flex" ) {
                $( this ).css ( "display", "block" );
            }
        } );

        /*
         * Default resize handler.
         * This only handles sharing the height with non-resized siblings.
         * A more specific handler should stop propagation.
         * Any element with a resize class expects to be sized to fill as much space as it can and then
         * be notified with a resize event that its size has changed so that it can resize its contents if needed
         */
        $( "body" ).on( "resize", function( event ) {
            var h, w, resize$, pos, computedStyle,
                parent$ = $( event.target );

            if ( event.target.nodeName === "BODY" ) {
                computedStyle = window.getComputedStyle( document.body );

                h = document.documentElement.clientHeight
                    - parseFloat( computedStyle.paddingTop )
                    - parseFloat( computedStyle.paddingBottom );
                w = document.documentElement.clientWidth
                    - parseFloat( computedStyle.paddingLeft )
                    - parseFloat( computedStyle.paddingRight );
            } else {
                h = parent$.height();
                w = parent$.width();
            }
            resize$ = parent$.children( ".resize" ).filter( ":visible" );
            if ( resize$.length > 0 ) {
                parent$.children( ":not(.resize)" ).filter( ":visible" ).each( function() {
                    pos = $( this ).css( "position" );
                    if ( pos !== "fixed" && pos !== "absolute" ) {
                        h -= $( this ).outerHeight( true );
                    }
                });
                h = Math.floor( h / resize$.length );
                resize$.each( function() {
                    var el$ = $(this);
                    util.setOuterHeight( el$, h );
                    util.setOuterWidth( el$, w );
                    el$.filter( ":visible" ).trigger( "resize" );
                });
            }
            event.stopPropagation();
        });

        $( ".ui-accordion.resize" ).on( "resize", function( event ) {
            if ( event.target !== this ) {
                return;
            }
            // accordion widget doesn't handle when its size changes automatically
            $( this ).accordion( "refresh" );
            // TODO THINK need a way to resize items. currently rely on accordion default behavior resize stops at this point!
            event.stopPropagation();
        });

        $( ".ui-tabs.resize" ).on( "resize", function( event ) {
            if ( event.target !== this ) {
                return;
            }
            // tabs widget doesn't handle when its size changes automatically
            $( this ).tabs( "refresh" )
                .children( ".ui-tabs-panel.resize" ).trigger( "resize" );
            event.stopPropagation();
        });

        $( window ).on( "apexwindowresized", function() {
            $( "body" ).trigger( "resize" );
        });
        $( "body" ).trigger( "resize" );

    };

    /**
     * Override this variable via apex.theme with a callback specifying what the page's default sticking position
     * should be.
     * @type {function}
     * @ignore
     */
    theme.defaultStickyTop = function() {
        return 0;
    };

    /**
     * Adds state information to wizard progress list template
     * @ignore
     */
    theme.initWizardProgressBar = function( pBaseClass ) {
        var lBaseClass = ( pBaseClass ) ? pBaseClass : "t-WizardSteps",
            lBaseClassSelector = "." + lBaseClass;

        $( lBaseClassSelector )
            .find( lBaseClassSelector + "-step.is-active" )
            .find( "span" + lBaseClassSelector + "-labelState" ).text( lang.getMessage( "APEX.ACTIVE_STATE" ) )
            .end()
            .prevAll( lBaseClassSelector + "-step" )
            .addClass( "is-complete" )
            .find( "span" + lBaseClassSelector + "-labelState" ).text( lang.getMessage( "APEX.COMPLETED_STATE" ) );
    };
    
    /**
     * Check if dialog has been moved by user.
     * @ignore
     */
    var hasMoved = function ( elem$ ) {
        var isPopup = elem$.hasClass( "js-regionPopup" ),
            result;

        if ( isPopup ){
            // popup callout dialog are not supposed to be moved
            // and don't need to be re-centered,
            // we assume its position is set by user so re-center won't apply.
            result = true;
        } else {
            result = elem$.dialog( "option", "position" ).my !== 'center';
        }

        return result;
    };

    /**
     * Forces all jQueryUI dialogs to be responsive.
     * This makes it so that on dialog creation and on window resize:
     * 1) The dialog is always completely visible.
     * 2) The height of the dialog and the width do not exceed the bounds of the page. Unless a min-width or height
     *      is specified.
     * @ignore
     */
    theme.initResponsiveDialogs = function() {
        $( "body" ).on( 'dialogopen' , ".ui-dialog-content", function() {
            var uiDialogContent$ = $( this ),
                uiDialog$ = uiDialogContent$.closest( ".ui-dialog" ),
                timeoutId;
            //Don't try to make non responsive dialogs responsive. More checks can be added here in the future if need be.
            if ( uiDialogContent$.hasClass( "non-responsive" ) || uiDialog$.find(".utr-container").length > 0 ) {
                return;
            }
            uiDialog$.css("maxWidth", "100%");
            var uiButtonPane$ = uiDialog$.find( ".ui-dialog-buttonpane" ); // Region dialogs need this div to be at the bottom
                                                                          // of the form.
            var uiButtonPaneHeight = 0;
            if (uiButtonPane$.length > 0) {
                uiButtonPaneHeight = uiButtonPane$.outerHeight() + 20; // Right now, 20 appears to be the extra offset that's needed if a uiButtonPane is in the region dialog.
            }
            var minHeight = parseInt(uiDialogContent$.dialog( "option", "minHeight" ), 10); //The value must be supplied as a decimal.
            if ( !minHeight ) {
                minHeight = 0;
            }
            var onPageResize = function() {
                var offset = uiDialog$.offset();
                var window$ = $( window );
                offset.top -= window$.scrollTop(); //Get the offset relative to the view port/the window!
                offset.left -= window$.scrollLeft();
                var windowWidth = window$.width();
                var dialogWidth = uiDialog$.outerWidth();
                if (offset.left + dialogWidth  > windowWidth) {
                    uiDialog$.css("left", windowWidth - dialogWidth);
                }
                var windowHeight = $( window ).height();
                var dialogHeight = uiDialog$.height();

                var initialHeight = uiDialogContent$.height();
                // If there is a show animation, then the initial height is wrong! Get something close to the
                // initial height from the ui dialog.
                if ( uiDialogContent$.dialog( "option", "show" ) ) {
                    initialHeight = parseInt(uiDialogContent$.dialog( "option", "height" ), 10);
                }

                // Select Modal Dialog only, not Theme Roller/Live Template Options dialog,
                // because they don't need re-center feature.
                var modalDialog$ = $('.ui-dialog--apex .ui-dialog-content:visible');
                var inlineDialog$ = $(".ui-dialog .js-regionDialog:visible");
                var centerPosition = { my: "center", at: "center", of: window };

                var reCenter = function( dlg ){
                    var inst$ = $( dlg );
                    if ( !hasMoved( inst$ ) ) {
                        inst$.dialog( "option", "position", centerPosition );
                    } 
                };

                //check if it's a resizable dialog if so it adjusts the max width to current window width
                if ( hasOwnProperty(uiDialog$, 'resizable') && !uiDialog$.resizable("option","disabled") ) {
                    uiDialog$.resizable( "option", "maxWidth", windowWidth );

                    uiDialogContent$.css({
                        "max-width": windowWidth,
                        "width": "100%"
                    });
                }

                if (windowHeight < initialHeight + uiButtonPaneHeight) {
                    var newHeight = windowHeight - uiDialog$.find( ".ui-dialog-titlebar" ).outerHeight() - uiButtonPaneHeight;
                    uiDialogContent$.height( Math.max(newHeight, minHeight) );
                    dialogHeight = uiDialog$.height();
                } else if (initialHeight + uiButtonPaneHeight < windowHeight) {
                    uiDialogContent$.height(initialHeight);
                }
                if (offset.top + dialogHeight  > windowHeight) {
                    var scrollOffset = 0;
                    if (uiDialog$.css("position") === "absolute") {
                        scrollOffset = window$.scrollTop();
                    }
                    uiDialog$.css( "top" , Math.max(windowHeight - dialogHeight + scrollOffset, 0));
                }

                modalDialog$.each(function(){
                    reCenter( this );
                });

                inlineDialog$.each(function(){
                    reCenter( this );
                });
                
            };

            timeoutId = setTimeout(function(){
                onPageResize();
            }, 250);

            $( window ).on( "apexwindowresized", onPageResize);

            uiDialogContent$.on( 'dialogclose', function() {
                $( window ).off( "apexwindowresized", onPageResize);
                clearTimeout( timeoutId );
            });
        }).on( 'popupopen' , ".ui-dialog-content", function() {
            // for popups just make sure they are not bigger than the screen don't need to track window resize.
            var uiDialogContent$ = $( this ),
                uiDialog$ = uiDialogContent$.closest( ".ui-dialog" ),
                window$ = $( window ),
                windowWidth = window$.width() - 10, // shrink it a bit
                windowHeight = $( window ).height() - 10, // shrink it a bit
                popupWidth = uiDialog$.outerWidth(),
                popupHeight = uiDialog$.height();

            // don't be responsive if the popup doesn't want to be
            if ( uiDialogContent$.hasClass( "non-responsive" ) ) {
                return;
            }

            if ( popupWidth > windowWidth ) {
                uiDialogContent$.popup("option", "width", windowWidth  );
            }
            if ( popupHeight > windowHeight ) {
                uiDialogContent$.popup("option", "height", windowHeight );
            }
        });
    };

    /**
     * Opens the #CUSTOMIZE# dialog window to be used by the #CUSTOMIZE_URL# substitution. 
     * In order to reload the * page after the user has changed customization, an 
     * "afterdialogclosed" event * handler is created on #pFlowStepId.
     * Not for public use
     * @ignore
     */
    theme.openCustomizeDialog = function ( pTitle, pLang ) {
        apex.jQuery( $( "#pFlowStepId" ) ).on( 
            "apexafterclosedialog", 
            function( pEvent, pData ) { 
                var lNewUrl = document.location.href.replace(/&?success_msg=([^&]$|[^&]*)/i, "" ) + 
                    pData.successMessage.urlSuffix; 
              
                document.location.href = lNewUrl;
            });
        navigation.dialog(
            "wwv_flow_customize.show" + 
                "?p_flow="    + $v("pFlowId") + 
                "&p_page="    + $v("pFlowStepId") + 
                "&p_session=" + $v("pInstance") + 
                "&p_lang="    + pLang + 
                "&" + util.getContextString(),
            {
                title:     pTitle,
                height:    450,
                scroll:    "no",
                width:     600,
                maxWidth:  800,
                modal:     true,
                resizable: true
            },
            null,
            $("#pFlowStepId")
        );
    };

    /**
     * Position a dialog in the center of a window.
     * @param dialog$ is a jQuery dialog
     * @ignore
     */
    // todo: similar logic to be removed from theme42 and use this
    var centerDialog = function ( dialog$ ) {
        dialog$.dialog("option", "position", {
            my: "center",
            at: "center",
            of: window.parent
        });
    };

    /*
     * Stretches the dialog to take most of the screen.
     * @param {jQuery} dialog$ is a jQuery dialog
     * @param {number} dialogSize is a number percentage of its height and width relative to browser window
     * @ignore
     */
    // todo: similar logic to be removed from theme42 and use this
    var stretchDialog = theme.stretchDialog = function ( dialog$, size ) {
        var dialogSize = "95%";

        if ( size ) {
            dialogSize = size + '%';
        }

        dialog$
            .parent()
            .css({
                "height": dialogSize,
                "width":  dialogSize
            })
            .addClass( C_STRETCHED );

        centerDialog( dialog$ );
    };

    /**
     *  Monitors DOM changes using MutationObserver.
     *  Used by Modal Dialog auto resize and inline dialog in UT.
     *
     *  See doc:
     *  https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver
     *
     * @ignore
     * @param {string} pSelector - A CSS class or an ID of the content to observe.
     * @param {function} pCallBack - function to run after mutation.
     * @returns {MutationObserver} - therefore disconnect() method is possible.
     */
    var observeAttrChanges = theme.observeAttrChanges = function ( pSelector, pCallBack ) {
        // Avoid document.querySelector( elem ) as user may enter numeric ID for IR region
        // and cause JS error when Action > Filter dialog is opened.
        var target = $( pSelector )[ 0 ],
            config = {
                attributes: true,
                childList: true,
                characterData: true,
                subtree: true,
                attributeOldValue: false,
                characterDataOldValue: false,
                attributeFilter: [ "class", "id", "style" ]
            };

        var act = function () {
            pCallBack( pSelector );
        };

        var obs = new MutationObserver(function() {
            util.debounce( act, 50 )();
        });

        obs.observe( target, config );

        return obs;
    };

    /**
     * 
     * Automatically set the height of the Modal Dialog based on the height of its contents.
     * It also streches if "Stretch to Fit Window" is checked in Template Options.
     * 
     * It is used by both Universal Theme and Builder.
     *
     * @param pParts is an object.
     *        pParts.observeClass is the DIV to be observed for DOM changes.
     *        pParts.sections     is an array the DIVs that make up the height of the content.
     *
     * @returns {boolean}
     * @ignore
     * @example
     * theme.modalAutoSize({
     *    observeClass: '.a-Dialog-body',
     *    sections:   [ '.a-Dialog-body', '.a-Dialog-wizardSteps', '.a-Dialog-footer' ]});
     */
    var modalAutoSize = theme.modalAutoSize = function( pParts ) {
        var CL_READY      = 'js-dialogReady',
            body$         = $( 'body' ),
            l$            = util.getTopApex().jQuery,
            // DIV with id = "apex_dialog_n" in parent window,
            //
            // We handle the height adjustments differently in UT and Bulder:
            // In UT, the height of the parent of dialog$ will be set for resize.
            // In Builder, the height of dialog$ will be set for resize.
            dialogId,
            dialog$,
            // Class of the DOM and its children to be observed for changes.
            divObserved    = pParts.observeClass,
            // Template in Builder is different from UT Template, therefore handle it differently
            // We may need to update Builder templates in the future to be consistent with UT.
            isBuilder      = apex.builder !== undefined,
            isStreching    = $( '.' + C_STRETCHED ).length !== 0,
            dialogHeight;

        // add a class so iframe loading feels smoother
        var addDialogReadyClass = function () {
            body$.addClass( CL_READY );
            dialog$.addClass( CL_READY );
        };

        var isResizeHeightRequired = function () {
            var isAutoHeight    = dialog$.dialog( 'option', 'height' ) === 'auto',
                isHeightChanged = dialogHeight !== modalDialogHeight;
            return isAutoHeight && isHeightChanged;
        };

        var getDialogHeight = function () {
            var i,
                sections   = pParts.sections,
                len        = sections.length,
                titlebar   = dialog$.parent().find( '.ui-dialog-titlebar' ).outerHeight(),
                // parentWH is used as default value of dMaxHeight,
                // and is smaller than window size to leave a bit of space on top and bottom.
                parentWH        = l$( parent.window ).height() - 20,
                dMinHeight      = parseInt( dialog$.dialog( 'option', 'minHeight' ), 10 ),
                dMaxHeight      = parseInt( dialog$.dialog( 'option', 'maxHeight' ), 10 ) || parentWH,
                //
                totalH     = 0,
                myHeight   = 0,
                elem$;

            var getChildrenHeights = function( elem$ ){
                var childrenHeights = 0,
                    selfPadding = parseInt( elem$.css( 'padding-top' ), 10 ) +
                                  parseInt( elem$.css( 'padding-bottom' ), 10 );

                elem$.children().each(function(){
                    // use offsetHeight to get the height of an invisible element that has css display:none
                    childrenHeights += $( this )[ 0 ].offsetHeight;
                });
                
                return childrenHeights + selfPadding;
            };

            for ( i = 0; i < len; i++ ) {
                elem$ = $( sections[ i ] );
                if ( elem$[ 0 ] ) {
                    if ( isBuilder ) {
                        totalH += getChildrenHeights( elem$ );
                    } else {
                        totalH += elem$.outerHeight();
                    }
                }
            }

            totalH += titlebar;

            if ( totalH > dMinHeight ) {
                myHeight = totalH < dMaxHeight ? totalH : dMaxHeight;
            } else {
                myHeight = dMinHeight;
            }

            // Ensure dialog height never exceeds the height of its parent window
            myHeight = myHeight > parentWH ? parentWH : myHeight;

            if ( isBuilder ) {
                myHeight -= titlebar;
            }

            return myHeight;
        };

        if ( window.parent === window.self ) {
            // If Page Mode is "Non-Modal Dialog" (not in iframe)
            // simply display page and return.
            body$.addClass( CL_READY );
            return false;

        } else {

            dialogId = "#" + window.frameElement.parentNode.id;
            dialog$  = l$( dialogId ) || $( dialogId );

            if ( isStreching ) {
                // No need to do height resizing if streching is defined in template options
                stretchDialog( dialog$ );

            } else {
                
                dialogHeight = getDialogHeight();

                if ( isResizeHeightRequired() ) {

                    if ( isBuilder ) {
                        dialog$.css( 'height', dialogHeight );
                    } else {
                        dialog$.parent().css( 'height', dialogHeight );
                    }
                    
                    // if user moved the dialog, don't re-center
                    if ( !hasMoved( dialog$ ) ) {
                        centerDialog( dialog$ );
                    }

                    // Keep the latest height to be used isResizeHeightRequired() to avoid overhead.
                    modalDialogHeight = dialogHeight;

                    // observe content change on the iframe page and resize if needed.
                    observeAttrChanges( divObserved, function(){
                        modalAutoSize( pParts );
                    });
                }
            }

            addDialogReadyClass();
            return true;
        }        
    };

    /**
     * 
     * Automatically set the height of the Inline Dialog based on the height of its contents.
     * 
     * It is used by both Universal Theme and Interactive Report Actions Dialog.
     *
     * @param pClass is the name of the dialog class.
     *
     * @returns {object}
     * @ignore
     * @example
     * theme.dialogAutoHeight( '.js-dialog-autoheight' );
     */
    theme.dialogAutoHeight = function( pClass ) {
            // dialog could be .js-regionDialog or.js-regionPopup initialized by theme.js
            var instances$ = $( pClass ),
                obs; // For disconnecting observer when resized or closed

            var updateHeight = function ( pId, isPopup ) {
                var elem$ = $( pId ),

                    widget = isPopup ? "popup" : "dialog",
                    stopObsEvents = isPopup ? 'popupresizestart popupclose' : 'dialogresizestart dialogclose',

                    hTitle = isPopup ? 0 : elem$.prev().outerHeight(), // popup doesn't have title bar
                    hContent = $( pId + ' .t-DialogRegion-body').outerHeight(),
                    hBottom = elem$.find( '.t-DialogRegion-buttons' ).outerHeight(),
                    hTotal = hTitle + hContent + hBottom,
                    hWin = $( window ).height() - 48,
                    newHeight = hTotal > hWin ? hWin : hTotal;

                if ( newHeight || newHeight !== 0) {

                    elem$
                        .css( 'height', 'auto' )
                        .parent()
                        .css( 'height', newHeight );

                    // if user moved the dialog, don't re-center.
                    if ( !hasMoved( elem$ ) ) {
                        elem$[ widget ]("option", "position", "center");
                    }

                    // Start observing for DOM changes.
                    if ( !obs ) {
                        obs = observeAttrChanges( pId, function () {
                            updateHeight( pId, isPopup );
                        });
                    }

                    // Stop observing if user resizes or closes dialog
                    elem$.on( stopObsEvents, function () {
                        if ( obs !== null ) {
                            obs.disconnect();
                            obs = null;
                        }
                    });
                }
            };

            instances$.each(function () {
                var inst$   = $( this ),
                    instId  = "#" + util.escapeCSS( inst$.attr( 'id' ) ),
                    isPopup = inst$.hasClass("js-regionPopup"),
                    widget  = isPopup ? "popup" : "dialog";

                inst$.on( widget + 'open', function () {
                    updateHeight( instId, isPopup );
                });

                updateHeight( instId, isPopup );
            });

            return instances$;

        };

})( apex.theme, apex.navigation, apex.jQuery, apex.lang, apex.util, apex.widget.util, apex.env, apex.item );