/*
 * Copyright (c) 2012, 2021, Oracle and/or its affiliates. All rights reserved.
 */
/*global $s_Split*/
/**
 * <p>The apex.widget namespace stores all the general purpose widget related functions of Oracle APEX.</p>
 *
 * @namespace
 */
apex.widget = (function( debug, $ ) {
    "use strict";

    function cap( str ) {
        return str.replace(/^[a-z]/, function(c) { return c.toUpperCase(); } );
    }

    function getAttr( element, key ) {
        var data;

        element = element.jquery ? element[0] : element;

        if ( element && element.getAttribute ) {
            data = element.getAttribute( "data-" + key );
        }

        try {
            data = data === "true" ? true :
                data === "false" ? false :
                    data === "null" ? null :
                        // Only convert to a number if it doesn't change the string
                        +data + "" === data ? +data :
                            RBRACE.test( data ) ? JSON.parse( data ) :
                                data;
        } catch ( err ) { // eslint-ignore-line no-empty
        }

        return data;
    }

    const RBRACE = /(?:{[\s\S]*}|\[[\s\S]*])$/;

    const rcapitals = /[A-Z]/g,
        replaceFunction = function( c ) {
            return "-" + c.toLowerCase();
        };

    /**
     * @lends apex.widget
     */
    var widget = {
        /**
         * <p>Shows a wait popup. A wait popup consists of an overlay div that keeps the user from clicking on any part of the page
         * along with a visual "spinner" animation of some kind. It does not keep the user from interacting with the
         * page using the keyboard.</p>
         *
         * <p>This is intended to be used just prior to submitting the page such that the page (and hence this popup) will soon be
         * replaced with a new page. If you do need to close the popup, use the "remove" function of the returned object.
         * See {@link apex.util.showSpinner} and {@link apex.util.delayLinger} for a low level solution more suitable for ajax requests or
         * other long running processes.</p>
         *
         * <p>This function is rarely needed because it is automatically called in {@link apex.page.submit} based on the
         * showWait option. Also typically ajax operations don't require an overlay to disable clicking.</p>
         *
         * @param {String} [pContent] HTML code for a wait indicator. If it is not provided, the default CSS animation
         *                            wait indicator will be displayed.
         * @return {Object} Object with a no argument function "remove" that closes the popup.
         * @example <caption>The following example shows a wait spinner and disables clicking on the page while some
         * long running ajax action takes place and then removes the spinner when it is done.</caption>
         * var popup = apex.widget.waitPopup();
         * var promise = apex.server.process(...);
         * promise.always(function() {
         *     popup.remove();
         * });
         */
        waitPopup: function ( pContent ) {
            var lWaitPopup$,   // DOM for popup and wait overlay
                lPopup$,       // popup only
                lSpinner;      // spinner within wait overlay

            if ( pContent ) {
                lWaitPopup$ = $( '<div id="apex_wait_popup" class="apex_wait_popup"></div><div id="apex_wait_overlay" class="apex_wait_overlay"></div>' ).prependTo( 'body' );
                lPopup$ = lWaitPopup$.first();
                if ( pContent.indexOf( "<img" ) >= 0 ) {
                    lPopup$.hide();
                }
                // Typically if content is supplied then it will include an animated gif image. When the page is submitted right
                // after an image is inserted the browser may not actually bother to load it (why should it - the page is going away).
                // So we insert the content from a timer so that images will get loaded.
                window.setTimeout( function () {
                    lPopup$.html( pContent ).find( "img" ).hide()
                        .on( "load", function () {
                            $( this ).show();
                            lPopup$.show();
                        } );
                }, 10 );
            } else {
                lWaitPopup$ = $( '<div id="apex_wait_overlay" class="apex_wait_overlay"></div>' ).prependTo( "body" );
                window.setTimeout( function () {
                    // do this from a timer because in the fallback case where an image is used it needs to be done
                    // separate from the submit in order for the image to be shown
                    if ( lWaitPopup$ !== undefined ) {
                        lSpinner = apex.util.showSpinner();
                    }
                }, 10 );

                // it is probably already visible but just to make sure
                lWaitPopup$.css( "visibility", "visible" );
            }
            return {
                remove: function () {
                    if ( lSpinner !== undefined ) {
                        lSpinner.remove();
                    }
                    lWaitPopup$.remove();
                    lWaitPopup$ = undefined;
                }
            };
        }, // waitPopup

        /**
         * This function is a wrapper around {@link apex.item.create}. It is for backward compatibility.
         * See {@link apex.item.create} for details.
         * @deprecated
         */
        initPageItem: function ( pName, pOptions ) {
            apex.item.create( pName, pOptions );
        },

        /**
         * Allows to upload the content of a textarea as CLOB
         * Internal use only!
         * @ignore
         * @namespace
         */
        textareaClob: {
            _upload: function ( pItemName, pRequest, pValue ) {
                var p,
                    lArray = $s_Split( $v( pItemName ), 4000 );

                p = apex.server.widget( "apex_utility", {
                    p_flow_step_id: "0",
                    x04: "CLOB_CONTENT",
                    x05: "SET",
                    f01: lArray
                }, {
                    dataType: "text"
                } );
                p.done( function () {
                    $s( pItemName, pValue );
                    apex.submit( pRequest );
                } );
            },

            upload: function ( pItemName, pRequest ) {
                this._upload( pItemName, pRequest, "" );
            },

            uploadNonEmpty: function ( pItemName, pRequest ) {
                // test whether the item is empty or only contains whitespace. Submit
                // only when this is not the case. The item will be set to " " afterwards.
                // NOT NULL validations will now succeed.
                if ( $v( pItemName ).replace( /\s/g, "" ).length === 0 || $v( pItemName ) === "" || $v( pItemName ) === "." ) {
                    // If no or only whitespace data, clear the item and submit
                    // NOT NULL validations will now fail.
                    $s( pItemName, "" );
                    apex.submit( pRequest );
                } else {
                    this._upload( pItemName, pRequest, "." );
                }
            }
        },

        /**
         * Used to add context menu support to a jQuery UI widget.
         *
         * @ignore
         * @mixin contextMenuMixin
         */
        contextMenuMixin: {
            options: {
                /**
                 * <p>A callback function that is called when it is time to display a context menu.
                 * <code class="prettyprint">function( event )</code> The function is responsible for showing the
                 * context menu. It is given the event that caused this callback to be called.</p>
                 *
                 * <p>In most cases it is simpler and more consistent to use the
                 * <code class="prettyprint">contextMenu</code> option.
                 * Only specify one of <code class="prettyprint">contextMenu</code>
                 * or <code class="prettyprint">contextMenuId</code> and
                 * <code class="prettyprint">contextMenuAction</code>.
                 * If none of <code class="prettyprint">contextMenu</code>, <code class="prettyprint">contextMenuId</code>
                 * or <code class="prettyprint">contextMenuAction</code> are specified there is no context menu.</p>
                 *
                 * @memberof contextMenuMixin
                 * @instance
                 * @type {function}
                 * @default null
                 * @example
                 *  function( event ) {
                 *     // do something to display a context menu
                 *  }
                 */
                contextMenuAction: null,

                /**
                 * <p>A {@link menu} widget options object use to create the context menu.</p>
                 * <p>Only specify one of <code class="prettyprint">contextMenu</code>
                 * or <code class="prettyprint">contextMenuId</code> and <code class="prettyprint">contextMenuAction</code>.
                 * If none of <code class="prettyprint">contextMenu</code>, <code class="prettyprint">contextMenuId</code>
                 * or <code class="prettyprint">contextMenuAction</code> are specified there is no context menu.</p>
                 *
                 * <p>This option cannot be set or changed after the widget is initialized.</p>
                 *
                 * @memberof contextMenuMixin
                 * @instance
                 * @type {Object}
                 * @default null
                 * @example
                 * {
                 *     items:[
                 *         { type:"action", label: "Action 1", action: function() { alert("Action 1"); } },
                 *         { type:"action", label: "Action 2", action: function() { alert("Action 2"); } }
                 *     ]
                 * }
                 */
                contextMenu: null,

                /**
                 * <p>If option <code class="prettyprint">contextMenu</code> is given then this is the element id
                 * to give the context {@link menu} created.
                 * This allows other code to interact with the created context {@link menu} widget.</p>
                 *
                 * <p>If option <code class="prettyprint">contextMenu</code> is not given then this is the
                 * element id of an existing {@link menu} widget.</p>
                 *
                 * <p>This option cannot be set or changed after the widget is initialized.</p>
                 *
                 * @memberof contextMenuMixin
                 * @instance
                 * @type {string}
                 * @default null
                 * @example "myContextMenu"
                 */
                contextMenuId: null
            },

            /**
             * Call from _create.
             * @param {string} contextSelector A selector to identify the closest element to the event target used to
             *              position the menu.
             * @param {function} ignoreFn Called during context menu event handling.
             *              ignoreFn( event ) -> boolean
             *              Return true if the given event should not result in a context menu opening.
             * @param {function} selectElementFn Called during context menu event handling.
             *              selectElementFn( event ) -> jQuery | bool
             *              Return the element to pass to the _select method if a selection is needed
             *              (typically when the context element is not selected) or true to open the context menu
             *              without changing the selection or false to not open the context menu.
             * @param {function} updateBeforeOpenArgFn Called just before the menu is open to augment the menu
             *              beforeOpen event ui argument.
             *              updateBeforeOpenArgFn( ui )
             *              Only applies when contextMenu or contextMenuId options are set.
             * @param {function} contextArgs Called before the menu is opened to add context arguments object for actions.
             *              contextArgs( ) -> object
             *              Only applies when contextMenu or contextMenuId options are set.
             * @protected
             */
            _initContextMenu: function ( contextSelector, ignoreFn, selectElementFn, updateBeforeOpenArgFn, contextArgs ) {
                let o = this.options,
                    self = this,
                    ctrl$ = this.element,
                    propName = this.widgetName,
                    name = cap( propName );

                if ( o.contextMenu || o.contextMenuId ) {
                    if ( $.apex.menu ) {
                        if ( o.contextMenu ) {
                            if ( o.contextMenu.menubar ) {
                                throw new Error( name + " contextMenu must not be a menubar" );
                            }
                            // augment the menu
                            o.contextMenu._originalBeforeOpen = o.contextMenu.beforeOpen;
                            o.contextMenu.beforeOpen = function ( event, ui ) {
                                ui.menuElement = self.contextMenu$;
                                ui[propName] = ctrl$;
                                if ( self.getSelection ) {
                                    ui.selection = self.getSelection();
                                }
                                if ( updateBeforeOpenArgFn ) {
                                    updateBeforeOpenArgFn( ui ); // todo change args to event, ui
                                }
                                if ( o.contextMenu._originalBeforeOpen ) {
                                    o.contextMenu._originalBeforeOpen( event, ui );
                                }
                            };
                            o.contextMenu._originalAfterClose = o.contextMenu.afterClose;
                            o.contextMenu.afterClose = function ( event, ui ) {
                                ui.menuElement = self.contextMenu$;
                                ui[propName] = ctrl$;
                                if ( o.contextMenu._originalAfterClose ) {
                                    o.contextMenu._originalAfterClose( event, ui );
                                }
                                if ( !ui.actionTookFocus ) {
                                    self.focus();
                                }
                            };
                            this.contextMenu$ = $( "<div style='display:none'></div>" ).appendTo( "body" );
                            if ( o.contextMenuId ) {
                                this.contextMenu$[0].id = o.contextMenuId;
                            }
                            this.contextMenu$.menu( o.contextMenu );
                        } else {
                            // must have only a contextMenuId so use that externally defined menu
                            this.contextMenu$ = $( "#" + o.contextMenuId );
                            if ( this.contextMenu$.length === 0 || !this.contextMenu$.is( ":apex-menu" ) ) {
                                throw new Error( name + " contextMenuId not found" );
                            }
                        }
                        if ( o.contextMenuAction ) {
                            debug.warn( name + " contextMenuAction option ignored when contextMenu option present" );
                        }
                        o.contextMenuAction = function ( event ) {
                            let x, y,
                                args = contextArgs ? contextArgs( event ) : null;

                            if ( event.type === "contextmenu" && event.button !== 0 ) {
                                x = event.pageX;
                                y = event.pageY;
                            } else {
                                let target$ = $( event.target ),
                                    pos = target$.offset();

                                x = pos.left;
                                y = pos.top + target$.closest( contextSelector ).outerHeight();
                            }
                            self.contextMenu$.menu( "toggle", x, y, args );
                        };
                    } else {
                        debug.warn( name + " contextMenu option ignored because menu widget not preset" );
                    }
                }

                function handleEvent( event ) {
                    let el$,
                        action = self.options.contextMenuAction;

                    if ( !action || ignoreFn( event ) ) {
                        return;
                    } // else
                    el$ = selectElementFn( event );
                    if ( el$ ) {
                        event.preventDefault();
                        if ( el$.length ) {
                            self._select( el$, null, true, false ); // force set selection
                        }
                        action( event );
                    }
                }

                let ignoreContextMenuEvent = false;

                this._on( {
                    keydown: event => {
                        // Some browsers turn Shift+F10 into a contextmenu event and some don't!
                        if ( event.shiftKey && event.which === 121 ) { // Shift+F10
                            event.preventDefault();
                            ignoreContextMenuEvent = true;
                            setTimeout( () => {
                                handleEvent( event );
                                ignoreContextMenuEvent = false;
                            }, 50 ); // 50 seems to be enough time to ignore the contextmenu event if there is one
                        }
                    },
                    contextmenu: event => {
                        if ( ignoreContextMenuEvent ) {
                            event.preventDefault(); // the menu will already be opened
                        } else {
                            handleEvent( event );
                        }
                    }
                } );

            },

            /**
             * Call from _destroy
             * @protected
             */
            _destroyContextMenu: function () {
                // remove the menu only if we created it
                if ( this.options.contextMenu && this.contextMenu$ ) {
                    this.contextMenu$.remove();
                }
            },

            /**
             * Call from _setOption before calling _super
             * @protected
             */
            _checkContextMenuOptions: function ( key /*, value */ ) {
                let o = this.options,
                    name = cap( this.widgetName );

                if ( key === "contextMenu" || key === "contextMenuId" ) {
                    throw new Error( name + " " + key + " cannot be set" );
                } else if ( key === "contextMenuAction" && ( o.contextMenu || o.contextMenuId ) ) {
                    throw new Error( name + " contextMenuAction cannot be set when the contextMenu or contextMenuId option is used" );
                }
            }
        },

        //
        // The following are utilities needed by widgets forked from jquery mobile
        //

        // Retrieve an attribute from an element and perform some massaging of the value
        getAttribute: getAttr,

        // to be mixed into a widget
        _getCreateOptions: function() {
            let elem = this.element[0],
                options = {};

            if ( !getAttr( elem, "defaults" ) ) {
                for ( const [optionName] of apex.util.objectEntries( this.options ) ) {
                    let value = getAttr( elem, optionName.replace( rcapitals, replaceFunction ) );

                    if ( value != null ) {
                        options[optionName] = value;
                    }
                }
            }

            return options;
        }

    };

    return widget;

})( apex.debug, apex.jQuery );
