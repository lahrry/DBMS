/*!
 Popup - a jQuery UI based widget based on dialog
 Copyright (c) 2018, 2022, Oracle and/or its affiliates. All rights reserved.
 */
(function ( $ ) {
    "use strict";

    /*
     * A popup is a modal dialog without a title bar that closes when click/touch outside of it. It is also not
     * resizable or draggable
     */
    const C_TOP = "u-callout--top",
        C_BOTTOM = "u-callout--bottom",
        C_LEFT = "u-callout--left",
        C_RIGHT = "u-callout--right";

    $.widget( "apex.popup", $.ui.dialog, {
        version: "20.2",
        widgetEventPrefix: "popup",
        options: {
            parentElement: null,
            relativePosition: "below",
            callout: false,
            noOverlay: false
        },

        _create: function() {
            let o = this.options,
                dialog$ = this.element;

            const blurEvent = "blur.popupTracking" + this.uuid,
                mousedownEvent = "mousedown.popupTracking" + this.uuid;

            // force some options
            o.resizable = false;
            o.draggable = false;
            o.modal = !o.noOverlay; // if noOverlay still behave modal but don't use an overlay

            this._super();

            this.calloutBefore = C_RIGHT;
            this.calloutAfter = C_LEFT;
            if ( dialog$.css( "direction" ) === "rtl" ) {
                this.calloutBefore = C_LEFT;
                this.calloutAfter = C_RIGHT;
            }

            // let the popup fit the content
            if ( o.width === "auto" ) {
                this.uiDialog.css( "display", "inline-block" ).hide();
            }

            this.uiDialog.addClass( "ui-dialog--popup" );
            this.uiDialog.children(".ui-dialog-titlebar" ).hide();

            this._setPosition();

            dialog$.on( "popupopen", () => {
                if ( o.noOverlay ) {
                    /*
                     * Previously used the technique of detecting mouse down on the document bodies.
                     * This must include iframes which is doable unless the iframe is from another origin then
                     * you don't have access to the contentDocument.
                     * So now using mousedown on this documentElement and using window blur to detect
                     * clicking (focusing) on an iframe. This is what menus do.
                     * Now there are 2 differences between this and the overlay case
                     * - the click that closes the popup is acted upon (this was always the main benefit)
                     * - the popup closes if the window looses focus for any reason (this is new behavior)
                     */
                    // popup likely opened from a click and don't want mousedown to act on that click so do after
                    setTimeout( () => {
                        $( window ).on( blurEvent, () => {
                            dialog$.popup( "close" );
                        } );
                        $( "html" ).on( mousedownEvent, e => {
                            // normally dialogs allow interaction with other non-modal dialogs but a popup does not want that (bug 32355339)
                            if ( $( e.target ).closest( ".ui-dialog" ).not( ".ui-dialog--popup" ).length || !this._allowInteraction( e ) ) {
                                // if close by clicking outside don't steal focus away from what was clicked on
                                // would rather not set focus at all because this results in double focus events but dialog assumes there is always an opener
                                dialog$.data( "apex-popup" ).opener = $( e.target ); // use an internal property set the opener to what was clicked on
                                dialog$.popup( "close" );
                            }
                            // else allow mousedown and likely resulting click
                        } );
                    }, 0 );
                    // cleanup click to close handler
                    dialog$.one( "popupclose", function() {
                        $( window ).off( blurEvent );
                        $( "html" ).off( mousedownEvent );
                    } );
                } else {
                    // click outside dialog to close it
                    $( ".ui-widget-overlay" ).click( function () {
                        dialog$.popup( "close" );
                    } );
                }

                this._updateCallout();
            });
        },

        _destroy: function() {
            if ( this.callout$ ) {
                this.callout$.remove();
            }
        },

        _setPosition: function() {
            let calloutPos, position,
                space = 0,
                o = this.options,
                dialog$ = this.element,
                relPos = o.relativePosition;

            // The parentElement is what the popup is positioned relative to so validate that here
            if ( o.parentElement ) {
                // must distinguish between a selector and markup; find does $() doesn't
                this.positionTo$ = typeof o.parentElement === "string" ? $( document ).find( o.parentElement ) : $( o.parentElement );
                if ( !this.positionTo$[0] ) {
                    this.positionTo$ = null;
                }
            }
            if ( o.callout && this.positionTo$ ) {
                if ( !this.callout$ ) {
                    this.callout$ = $( "<div class='u-callout'></div>" );
                    dialog$.after( this.callout$ );
                }
                space = parseInt( dialog$.parent().css( "margin-top" ), 10 );
            } else {
                if ( this.callout$ ) {
                    this.callout$.remove();
                    this.callout$ = null;
                }
            }

            if ( this.positionTo$ ) {
                const of$ = this.positionTo$;

                // position the popup
                if ( relPos === "above" ) {
                    calloutPos = C_BOTTOM;
                    position = {
                        my: "left bottom",
                        at: "left top-" + space,
                        of: of$,
                        collision: "fit flipfit"
                    };
                } else if ( relPos === "below" ) {
                    calloutPos = C_TOP;
                    position = {
                        my: "left top",
                        at: "left bottom+" + space,
                        of: of$,
                        collision: "fit flipfit"
                    };
                } else if ( relPos === "before" ) { // left
                    calloutPos = C_RIGHT;
                    position = {
                        my: "right top",
                        at: "left-" + space + " top",
                        of: of$,
                        collision: "flipfit fit"
                    };
                } else if ( relPos === "after" ) { // right
                    calloutPos = C_LEFT;
                    position = {
                        my: "left top",
                        at: "right+" + space + " top",
                        of: of$,
                        collision: "flipfit fit"
                    };
                } else if ( relPos === "inside" ) {
                    calloutPos = C_TOP;
                    position = {
                        my: "left top",
                        at: "left+" + space + " top+" + space,
                        of: of$
                    };
                }
                if ( this.callout$ ) {
                    this.callout$.removeClass( C_TOP + " " + C_BOTTOM + " " + C_RIGHT + " " + C_LEFT )
                        .addClass( calloutPos );
                }
            } else {
                position = { my: "center", at: "center", of: window };
            }
            this.options.position = position;
        },

        _updateCallout: function() {
            let calloutLeft, calloutTop, delta, popupOffset, elOffset, callout$;

            if ( !this.callout$ || !this.positionTo$ ) {
                return;
            } // else

            callout$ = this.callout$;
            popupOffset = this.element.offset();
            elOffset = this.positionTo$.offset();
            if (callout$.hasClass( C_TOP )) {
                if (popupOffset.top < elOffset.top) {
                    callout$.removeClass( C_TOP ).addClass( C_BOTTOM );
                }
            } else if (callout$.hasClass( C_BOTTOM )) {
                if (popupOffset.top > elOffset.top) {
                    callout$.removeClass( C_BOTTOM ).addClass( C_TOP );
                }
            } else if (callout$.hasClass( this.calloutAfter )) {
                if (popupOffset.left < elOffset.left) {
                    callout$.removeClass( this.calloutAfter ).addClass( this.calloutBefore );
                }
            } else if (callout$.hasClass( this.calloutBefore )) {
                if (popupOffset.left > elOffset.left) {
                    callout$.removeClass( this.calloutBefore ).addClass( this.calloutAfter );
                }
            }

            callout$.css("left", "");
            callout$.css("top", "");
            if (callout$.hasClass( C_TOP ) || callout$.hasClass( C_BOTTOM )) {
                calloutLeft = parseInt(callout$.css("left"), 10);
                // the popup and element should be left aligned but the fit logic can shift them so make sure the callout
                // points to the right place
                delta = elOffset.left - popupOffset.left;
                if ( delta > 0 ) {
                    callout$.css("left", delta + calloutLeft );
                }
            } else if (callout$.hasClass( C_LEFT ) || callout$.hasClass( C_RIGHT )) {
                calloutTop = parseInt(callout$.css("top"), 10);
                // the popup and element should be top aligned but the fit logic can shift them so make sure the callout
                // points to the right place
                delta = elOffset.top - popupOffset.top;
                if ( delta > 0 ) {
                    callout$.css("top", delta + calloutTop );
                }
            }
        },

        _setOption: function( key, value ) {
            if ( key === "draggable" || key === "resizable" || key === "modal" ) {
                throw new Error( "Popup " + key + " cannot be set." );
            }
            this._super( key, value );
            if ( key === "parentElement" || key === "callout" || key === "relativePosition" ) {
                this._setPosition();
            }
        }
    } );

})( apex.jQuery );
