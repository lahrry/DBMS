/*!
 Copyright (c) 2012, 2021, Oracle and/or its affiliates. All rights reserved.
*/
/*
 * This module implements the text area widget of Oracle APEX.
 */
(function( item, $, util ) {
    "use strict";

    const SEL_TEXTAREA_GROUP = ".apex-item-group--textarea",
        C_HAS_ERROR = "has-error",
        A_DESCRIBEDBY = "aria-describedby",
        WS_NONE = "NONE",
        WS_LEADING = "LEADING",
        WS_TRAILING = "TRAILING",
        WS_BOTH = "BOTH";

    // Matches spaces, tabs, and new lines at the end or start
    const TRAILING_WS_RE = /\s+$/,
        LEADING_WS_RE  = /^\s+/;

    /*
     * Utility function to trim whitespaces
     * Also used in widget.textField
     */
    let getWhitespaceTrim = ( value, trim ) => {
        if ( trim !== WS_NONE ) {
            value = value == null ? "" : "" + value; // force value to be a string, use == to catch undefined as well
            if ( trim === WS_LEADING || trim === WS_BOTH ) {
                value = value.replace( LEADING_WS_RE, '' );
            }
            if ( trim === WS_TRAILING || trim === WS_BOTH ) {
                value = value.replace( TRAILING_WS_RE, '' );
            }
        }

        return value;
    };

    let textareaItemPrototype = {
        // Let's hide/show the div so that the resizebar is covered as well
        /* NOTE these show/hide functions only get called if the item is not contained in an element with ID
         *    '#' + _self.node.id + '_CONTAINER'
         * If there is a container element then the base item functionality takes over completely
         */
        show: function() {
            this.element.closest( SEL_TEXTAREA_GROUP ).show();
        },
        hide: function() {
            this.element.closest( SEL_TEXTAREA_GROUP ).hide();
        },
        setValue: function ( value, displayValue, suppressChangeEvent ) {
            // handling whitespace trim
            value = getWhitespaceTrim( value, this._whitespaceTrim );

            this.element.val( value );
            if ( this._charCount ) {
                // verify the maxlength and keep counter up to date if there is one
                this._charCount();
            }

            if ( !suppressChangeEvent ) {
                // used to prevent the attached change event in order to prevent a second call to the whitespace function
                this._preventChangeHandler = true;
            }
        },
        getValue: function () {
            let value = this.element.val();

            //handling whitespace trim
            value = getWhitespaceTrim( value, this._whitespaceTrim );

            return value;
        }
    };

    let gSupportsResize = document.createElement( "textarea" ).style.resize !== undefined;

    /**
     * Adds the necessary events to an object with appended size-bar to make it resizeable
     * */
    function resizable( textarea$ ) {
        // static closure variables used by startResize and performResize
        let minWidth, minHeight,
            offsetX = null,
            offsetY = null;

        /*
         * Function called when the mouse button has been pressed in the size-bar div
         */
        function startResize( pEvent ) {
            offsetX = textarea$.width()  - pEvent.pageX;
            offsetY = textarea$.height() - pEvent.pageY;
            textarea$.css( "opacity", 0.25);
            $( document )
                .on( "mousemove.apex_startResize", function( pE ) {
                    return performResize(pE, ( $( pEvent.currentTarget ).css( "cursor" ) === "se-resize" ) );
                } ).on( "mouseup.apex_startResize", endResize );
            return false;
        } // startResize

        /*
         * Function called when the mouse is moved while the button is pressed in
         * the size bar div
         * Parameter pSetWidth should only be set if the size bar has been selected
         * in the right corner of the size bar
         */
        function performResize( pEvent, pSetWidth ) {
            textarea$.height( Math.max(minHeight, offsetY + pEvent.pageY) + "px" );
            if ( pSetWidth ) {
                let lWidth = Math.max( minWidth, offsetX + pEvent.pageX );
                textarea$.width( lWidth );
            }
            return false;
        } // performResize

        /*
         * Function called when the mouse button is released in the size bar div
         * this will de-register the events and restore the opacity of the textarea.
         */
        function endResize( /* pEvent */ ) {
            $( document )
                .off( "mousemove.apex_startResize" )
                .off( "mouseup.apex_startResize" );
            textarea$.css( "opacity", 1);
        } // endResize

        // In the past a resizable textarea could not be made smaller than it's original size
        // but then when we switched to using native resizable text areas which are supported by most browsers
        // that behavior changed textareas can be made smaller than their original size.
        // So be consistent with other browser behavior.
        minWidth = parseInt( textarea$.css("min-width"), 10) || 20;
        minHeight = parseInt( textarea$.css("min-height"), 10) || 20;

        // Add the grid handler
        textarea$.after( '<div class="apex_size_bar"><div class="apex_size_grip"></div></div>' );

        // Add the mouse events to the size bar divs
        $( "div.apex_size_bar, div.apex_size_grip", textarea$.parent() ).mousedown( startResize );

        // The textarea will have a width based on cols. Need to have the size bar div under it
        // have the same width as the textarea. Copying the outerWidth of the textarea to the
        // parent would work but not if the textarea is not visible (for example if it were in a hide/show region)
        // By forcing the parent to be display: inline-block it will take whatever size its children have.
        textarea$.parent().css("display:inline-block");
    } // resizable

    /*
     * Expected markup:
     * A text area and an optional character counter div wrapped in a group div as follows:
     * <div class="apex-item-group apex-item-group--textarea">
     *   <textarea name="{ITEM_NAME}" rows="{R}" cols="{C}" maxlength="{MAXLEN}"
     *      id="{ITEM_NAME}" class="textarea apex-item-textarea"
     *      data-trim-spaces="NONE" data-resizable="true" data-counter="true" data-max-char="{MAXLEN}" >
     *   </textarea>
     *   <div id="{ITEM_NAME}_CHAR_COUNT" style="display:none;" class="apex-item-textarea-counter">
     *     <span id="{ITEM_NAME}_CHAR_COUNTER" class="apex-item-textarea-counter--length">0</span> of
     *     <span class="apex-item-textarea-counter--size">8000</span>
     *   </div>
     * </div>
     * All configuration is from standard attributes or data attributes.
     * Currently maxlength and data-max-char should be the same and data-max-char is only expected if
     * data-counter is true. todo consider removing data-max-char.
     * TODO consider that the counter markup should be added by the client and shouldn't need an id for _CHAR_COUNTER
     * and the counter may need to be included in the accessible label
     * also the client may want to sync the maxlength with the counter.
     */
    function attachTextarea( context$ ) {
        $( "textarea.apex-item-textarea", context$ ).each( function() {
            let thisItem, maxChar, counter$,
                netLength = 0, // length transmitted on the net
                pctFull = 0,
                countDiv$ = null,
                textarea = this,
                item$ = $( textarea ),
                id = textarea.id, // escape to use
                // keep these defaults in sync with server logic
                trimValue = item$.attr( "data-trim-spaces" ) || WS_BOTH,
                isResizable = item$.attr( "data-resizable" ) || false,
                hasCharCounter = item$.attr( "data-counter" ) || false;

            // debounce updating the character counter
            let updateCharCount = () => {
                    countDiv$.removeClass( "apex-item-textarea-counter--error apex-item-textarea-counter--warning" );
                    counter$.html( netLength );

                    // only show the counter area if something has been entered
                    if ( netLength > 0 ) {
                        countDiv$.show();
                    } else {
                        countDiv$.hide();
                    }
                    // show a color indicator for counter area
                    if ( pctFull > 95 ) {
                        countDiv$.addClass( "apex-item-textarea-counter--error" );
                    } else if ( pctFull >= 90 ) {
                        countDiv$.addClass( "apex-item-textarea-counter--warning" );
                    }
                },
                updateCharCountDebounce = util.debounce( updateCharCount, 200 );

            /**
             * Function called when textarea gets focus or a character is typed to update
             * the character counter attached to the textarea.
             * */
            function charCount( event ) {
                let lText = item$.val();

                // Always count line breaks as two characters, because independent of the OS it will always be transmitted as CR LF
                // http://www.w3.org/TR/html401/interact/forms.html#h-17.13.4.1 (bug #18273866)
                // Because of the difference between the raw javascript length of a text area and the network length
                // the maxlength attribute is kind of useless. We try to enforce the network max length at least for
                // new lines; multi byte characters could add a whole other layer of complexity.
                netLength  = lText.replace(/\n/g, "xx").length; // this seems to be the fastest way

                // remove characters which are above the limit and highlight the field
                if ( netLength > maxChar ) {
                    // Would like to prevent default so the char(s) are never added but input happens to late as does keyup
                    // and keypress doesn't cover all the cases where we need to update the count. Also don't want to do
                    // the counting on multiple frequent events. So just truncate the value after the fact.
                    let extra = netLength - maxChar,
                        // must save and restore the selection
                        start = textarea.selectionStart,
                        end = textarea.selectionEnd;

                    item$.val( lText.substring( 0, end - extra ) + lText.substring( end ));
                    end = end - extra;
                    netLength = maxChar;
                    if ( start < end ) {
                        start = end;
                    }
                    textarea.setSelectionRange( start, end );
                    item$.addClass( C_HAS_ERROR ); // todo seems to have no style for this class so remove if not needed
                } else if ( item$.hasClass( C_HAS_ERROR ) ) {
                    item$.removeClass( C_HAS_ERROR );
                }
                pctFull = netLength / maxChar * 100;
                if ( countDiv$ ) {
                    event ? updateCharCountDebounce() : updateCharCount();
                }
            } // charCount

            // make textarea resizable or not as specified
            if ( gSupportsResize ) {
                // Use the browser native resize
                item$.css( "resize", isResizable ? "both" : "none" );
            } else {
                // but fallback to our own resize if the browser doesn't support it
                // most browsers we care about support resize css property but prev release of Edge does not
                // todo remove this soon but not quite yet
                if ( isResizable ) {
                    resizable( item$ );
                }
            }

            // add character counter
            if ( hasCharCounter ) {
                let descby = item$.attr( A_DESCRIBEDBY ) || "",
                    escapedIdPrefix = "#" + util.escapeCSS( id );

                maxChar = parseInt( item$.attr( "data-max-char" ) || 0, 10 );

                if ( descby.length > 0 ) {
                    descby = " " + descby;
                }
                descby = id + "_CHAR_COUNT" + descby;

                countDiv$ = $( escapedIdPrefix + "_CHAR_COUNT", context$ );
                counter$ = $( escapedIdPrefix + "_CHAR_COUNTER", context$ );

                // add char counter to textarea item aria-describedby
                item$.attr( A_DESCRIBEDBY, descby );

                if ( maxChar <= 0 ) {
                    apex.debug.error( "Textarea Character Counter requires Maximum Length" );
                }
            } else {
                maxChar = parseInt( item$.attr( "maxlength" ) || 0, 10 );
            }
            if ( maxChar > 0 ) {
                item$.on( "change input", charCount );
                // Always recalculate count to avoid wrong value in FF (bug# 10011941)
                charCount();
            }

            if ( item$.closest( ".a-GV-columnItem" )[0] ) {
                // if text area is a column item let grid or whatever know that it uses the enter key
                item$.addClass( "js-uses-enter" );
            }

            if ( trimValue !== WS_NONE ) {
                item$.change( () => {
                    //if the change event is triggered by the setValue, we don't need to do any transformation
                    if ( thisItem._preventChangeHandler ) {
                        thisItem._preventChangeHandler = false;
                        return;
                    }

                    // handling whitespace trim
                    // save and restore the selection
                    let leadWSlen,
                        start = textarea.selectionStart,
                        end = textarea.selectionEnd,
                        value = item$.val();

                    if ( trimValue === WS_LEADING || trimValue === WS_BOTH ) {
                        // try to keep the selection range as stable as possible
                        leadWSlen = value.match( LEADING_WS_RE );
                        if ( leadWSlen ) {
                            leadWSlen = leadWSlen[0].length;
                            start -= leadWSlen;
                            if ( start <  0 ) {
                                start = 0;
                            }
                            end -= leadWSlen;
                            if ( end <  0 ) {
                                end = 0;
                            }
                        }
                    }
                    value = getWhitespaceTrim( value, trimValue );
                    if ( end > value.length ) {
                        // try to keep the selection range as stable as possible
                        end = value.length;
                        if ( start > end ) {
                            start = end;
                        }
                    }
                    item$.val( value );

                    textarea.setSelectionRange( start, end );
                    if ( maxChar > 0 ) {
                        charCount();
                    }
                } );
            }

            item.create( id, textareaItemPrototype );
            thisItem = item( id );
            if ( maxChar > 0 ) {
                thisItem._charCount = charCount;
            }
            thisItem._whitespaceTrim = trimValue;
            thisItem._preventChangeHandler = false;
        } );
    }

    // register attachTextarea to run when needed
    item.addAttachHandler( attachTextarea );

})( apex.item, apex.jQuery, apex.util );