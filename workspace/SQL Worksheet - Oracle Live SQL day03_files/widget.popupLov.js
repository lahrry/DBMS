/*!
 Copyright (c) 2012, 2022, Oracle and/or its affiliates. All rights reserved.
*/
/*
 * Implements behaviors for the APEX Popup LOV item type.
 */
(function( widget, item, util, $ ) {
    "use strict";

    const P_DISABLED = "disabled",
        C_IS_ACTIVE = "is-active",
        SEL_IS_ACTIVE = "." + C_IS_ACTIVE,
        C_MULTI_REMOVE = "apex-item-multi-remove",
        SEL_MULTI_REMOVE = "." + C_MULTI_REMOVE,
        C_MULTI_ITEM = "apex-item-multi-item",
        SEL_MULTI_ITEM = "." + C_MULTI_ITEM,
        A_DATA_VALUE = "data-value",
        A_ARIA_EXPANDED = "aria-expanded",
        INPUT_TRAP_ID = "apexPopupLovInputTrap";

    const keys = $.ui.keyCode,
        hasOwnProperty = util.hasOwnProperty,
        MULTI_INPUT_MIN_WIDTH = 60;

    /**
     * Initialize an APEX Popup LOV item.
     * The server renders some basic markup but this may augment it.
     * Internal use
     * @ignore
     *
     * @param {Object} options Options settings that control the look and behavior of the Popup LOV item.
     * @param {string} options.itemId Required. The id and name of the item.
     * @param {string} options.ajaxIdentifier
     * @param {string} options.dependingOnSelector jQuery selector of items that this item depends on.
     * @param {boolean} options.optimizeRefresh Not used by popupLov because it only fetches data from the popup dialog
     * @param {string} options.pageItemsToSubmit jQuery selector of additional items that this item depends on.
     * @param {string} options.nullValue
     * @param {string} options.nullDisplayValue
     * @param {boolean} options.dynamicDefault If true, when refreshed, the server must be asked what the
     *   default value should be. Otherwise the null value is used.
     * @param {string} options.initialFetch One of "none", "empty", "value". Determines what if anything will be fetched
     *   the first time the popup is opened or after a refresh. "none" - don't fetch anything until user explicitly searches.
     *   "empty" - fetch with empty search filter. "value" fetch with initial value as search filter. Value "value" is
     *   ignored if multiple option is true.
     *   Default "empty".
     * @param {boolean} options.multiple If true multiple values can be chosen. Default false.
     * @param {string} options.separator Only used when multiple is true. Default ":". Set to "," for backward compatibility.
     * @param {boolean} options.enterable If true the item has combobox semantics where a value can be entered or selected.
     *     If false the item has select list semantics where the value must be chosen from the list. Default false.
     * @param {string} options.display One of "list" or "grid". Default is "list".
     * @param {string} options.title Dialog title. Default comes from message "APEX.POPUP_LOV.TITLE"
     * @param {boolean} options.isPopup Default false.
     * @param {number} options.width Width of the dialog or popup in pixels. Default 500.
     * @param {number} options.height Height of the dialog or popup in pixels. Default 450.
     * @param {boolean} options.incrementalSearch If true search results are shown as you type in the search filter.
     *     Otherwise search results are shown when press enter or click the search button.
     * @param {number} options.minSearchChars A small non-negative integer. The number of characters that must be typed
     *     in the search field before search results will be shown.
     * @param {Object} options.columns Required.
     * @param {string} options.valueColumn Required.
     * @param {string} options.displayColumn
     * @param {string} options.iconColumn
     * @param {boolean} options.hasDisplayValue Note this is currently derived
     * @param {string} options.recordTemplate A custom template to use. Only applies when display is "list".
     * @param {object} options.extraOut Mapping of column names to item names and initial values
     * @param {boolean} options.persistState Default true.
     * @param {object} options.defaultGridOptions
     * @param {object} options.defaultIconListOptions
     */
    widget.popupLov = function( options ) {
        var theItem, allItems, values$, valuesWidth, field$, fixMultipleWidth,
            originalValue, originalPlaceholder, itemInstance, values, displayValues,
            forwardKey = keys.RIGHT,
            backwardKey = keys.LEFT,
            forceRefresh = false,
            popupOpen = false,
            popupRecentlyOpen = false,
            lastOpenValue = "",
            itemId = options.itemId,
            button$ = $( "#" + util.escapeCSS( itemId ) + "_lov_btn", apex.gPageContext$ ),
            group$ = button$.parent(),
            input$ = $( "#" + util.escapeCSS( itemId ), apex.gPageContext$ ),
            hidden$ = $( "#" + util.escapeCSS( itemId ) + "_HIDDENVALUE", apex.gPageContext$ ), // optional
            ctrls$ = $().add(button$).add(input$).add(hidden$),
            visibleCtrls$ = $().add(button$).add(input$);

        // Opens the popup/dialog
        function open( searchChar ) {
            var searchText,
                typeAhead = false,
                itemValue = input$.val();
            // For combobox seems reasonable to use existing text as filter once opened if entered value has changed
            if ( options.enterable && itemValue !== lastOpenValue ) {
                searchText = itemValue;
            } else if ( searchChar ) {
                searchText = searchChar;
                typeAhead = true;
            } else {
                searchText = null;
            }
            lastOpenValue = itemValue;
            input$.attr( A_ARIA_EXPANDED, "true" );
            popupOpen = true;
            // share options object because there is so much overlap
            widget.util.openPopupLov( forceRefresh, searchText, typeAhead, options, function( result ) {
                if ( result ) {
                    lastOpenValue = result.d || result.v || result;
                    if ( options.multiple ) {
                        input$.val( "" );
                    }
                }
                input$.attr( A_ARIA_EXPANDED, "false" );
                popupOpen = false;
            } );
            forceRefresh = false;
        }

        function renderMultiItem( value, displayValue ) {
            var display = displayValue || value;
            return "<li class='" + C_MULTI_ITEM + "' data-value='" +
                util.escapeHTMLAttr( value ) + "'><span>" +
                util.escapeHTML( display ) +
                "<button class='" + C_MULTI_REMOVE + "' type='button' tabindex='-1' aria-label='" +
                apex.lang.formatMessage( "APEX.POPUP_LOV.REMOVE_VALUE", display ) + // todo acc will this even be read since button and even item doesn't take focus
                "'><span class='a-Icon icon-multi-remove'></span></button></span></li>";
        }

        function setExtraOut( clear ) {
            let map = options.extraOut;

            // store additional outputs
            for ( const [, extra] of util.objectEntries( map ) ) {
                let value, display;
                if ( clear ) {
                    value = "";
                    display = null;
                } else {
                    value = extra.initialValue;
                    display = null;
                    if ( value !== null && typeof value === "object" && hasOwnProperty( value, "d" ) ) {
                        value = value.v;
                        display = value.d;
                    }
                }
                $s( extra.item, value, display );
            }
        }

        function clearModel() {
            var modelName, model;

            // Clear the model
            modelName = input$.data( "popupLovModelName" );
            if ( modelName ) {
                model = apex.model.get( modelName );
                if ( model ) {
                    model.setData( [] );
                    apex.model.release( modelName );
                }
            }
            forceRefresh = true; // request that new data is fetched as needed next time popup is opened
        }

        options = $.extend( {
            dependingOnSelector: null,
            pageItemsToSubmit: null,
            height: options.isPopup ? 280 : 380, // default height depends on if it is an inline popup or dialog
            width: null, // popup default
            isPopup: false,
            display: "list",
            nullValue: "",
            dynamicDefault: false,
            initialFetch: "empty",
            multiple: false,
            separator: ":",
            enterable: false,
            incrementalSearch: false,
            minSearchChars: 0,
            displayColumn: null,
            iconColumn: null,
            extraOut: {},
            persistState: true
        }, options );
        // set default width unless the dialog is a popup in which case it defaults to null which mean it will be the width of the input field
        if ( !options.width && !options.isPopup ) {
            options.width = options.display === "grid" ? 500 : 300;
        }

        if ( options.nullDisplayValue === undefined ) {
            options.nullDisplayValue = options.nullValue;
        }

        // Currently if not enterable then there can be no distinct display value and also must have a displayColumn
        // to have a display value.
        // todo consider having this option set independently
        options.hasDisplayValue = !options.enterable && options.displayColumn;

        /* todo acc wai-aria stuff
         aria-owns="oj-listbox-results-1" ???
         */

        input$.attr( "role", "combobox" )
            .attr( "aria-autocomplete", "list" )
            .attr( A_ARIA_EXPANDED, "false" )
            .attr( "aria-haspopup", "dialog" );
        // todo acc should the combobox own the dialog?

        if ( options.multiple ) {
            // todo acc should the focus move to the other items
            originalPlaceholder = input$.attr( "placeholder" );
            values$ = input$.parent().parent();
            if ( values$.css( "direction" ) === "rtl" ) {
                forwardKey = keys.LEFT;
                backwardKey = keys.RIGHT;
            }

            // keep the list (apex-item-multi) from stretching the field (apex-item-group--popup-lov). The field
            // can stretch if and how ever it may be configured to do so (theme dependent) and the list should
            // adjust but adding more values to the list must not stretch the field.
            // for resize sensor to work the field group must be position relative
            field$ = values$.parent();
            field$.css( "position", "relative" );
            input$.css( "flex-grow", 0 );
            fixMultipleWidth = function() {
                var w = field$.width() - button$.outerWidth(true);
                // it is very important that the width set on the values ul exactly fits (with the button) in the
                // width of the field otherwise if the field doesn't have a fixed given size it will grow or
                // shrink continuously because of the resize tracker.
                values$.css( "max-width", w );
                valuesWidth = w - parseInt(values$.css("border-left-width"), 10) -
                    parseInt(values$.css("border-right-width"), 10) -
                    parseInt(values$.css("padding-left"), 10) -
                    parseInt(values$.css("padding-right"), 10);
            };
            widget.util.onElementResize( field$[0], function() {
                fixMultipleWidth();
                theItem.afterModify(); // let the input width adjust
            } );
            widget.util.onVisibilityChange( field$[0], function( pShow ) {
                if ( pShow ) {
                    // In the case of show, we need to update any resize sensors used by the widget, as they will not
                    // work properly if only initialised in a hidden state (with 'display: none').
                    widget.util.updateResizeSensors( field$[0] );
                }
            });
            fixMultipleWidth();

            // fix up the simple markup that comes from the server
            values = [];
            displayValues = [];
            values$.children().not(":last").each( function() {
                var li$ = $( this );
                values.push(li$.attr( A_DATA_VALUE ) );
                displayValues.push(li$.text());
            } ).remove();
            // the value is set after the item is initialized

            values$.click( function( event ) {
                var focus = false,
                    target$ = $( event.target ),
                    button$ = target$.closest( SEL_MULTI_REMOVE ),
                    item$ = target$.closest( SEL_MULTI_ITEM );

                if ( theItem.isDisabled() ) {
                    return;
                }
                if ( button$[0] ) {
                    theItem.removeValue( item$.attr( A_DATA_VALUE ) );
                    focus = true;
                } else if ( !item$.find( "input" )[0] ) {
                    values$.children( SEL_IS_ACTIVE ).removeClass( C_IS_ACTIVE );
                    item$.addClass( C_IS_ACTIVE );
                    focus = true;
                }
                if ( focus ) {
                    setTimeout( function () {
                        input$.focus();
                    }, 1 );
                }
            } ).keydown( function( event ) {
                var kc = event.which,
                    curItem$ = values$.children( SEL_IS_ACTIVE );

                if ( theItem.isDisabled() ) {
                    return;
                }
                if ( input$.val() === "" ) {
                    if ( kc === keys.DELETE || kc === keys.BACKSPACE ) {
                        if ( event.target === input$[0] && kc === keys.BACKSPACE && !curItem$[0] ) {
                            // if focus is in the input and no other item is active
                            // then backspace should delete the previous item if any
                            curItem$ = input$.parent().prev();
                        }
                        if ( curItem$[0] ) {
                            theItem.removeValue( curItem$.attr( A_DATA_VALUE ) );
                        }
                    } else if ( kc === backwardKey ) {
                        if ( curItem$[0] ) {
                            if ( curItem$.prev()[0] ) {
                                curItem$.removeClass( C_IS_ACTIVE );
                                curItem$.prev().addClass( C_IS_ACTIVE );
                            }
                        } else {
                            input$.parent().prev().addClass( C_IS_ACTIVE );
                        }
                    } else if ( kc === forwardKey ) {
                        if ( curItem$[0] ) {
                            if ( curItem$.next()[0] ) {
                                curItem$.removeClass( C_IS_ACTIVE );
                                curItem$ = curItem$.next();
                                if ( !curItem$.find( "input" )[0] ) {
                                    curItem$.addClass( C_IS_ACTIVE );
                                }
                            }
                        }
                    }
                } else if ( options.enterable && kc === keys.ENTER && input$.val() ) {
                    // if enterable and a value is entered add it.
                    theItem.addValue( input$.val() );
                    input$.val( "" );
                    event.stopPropagation(); // this keeps higher level controls like grid from acting on the enter key
                }
                if ( kc === keys.ENTER ) {
                    // prevent the browser default to submit the page when this is the only text item on the page
                    event.preventDefault();
                }
            } ).focusin( function( event ) {
                values$.addClass( "is-focused" );
                if ( event.target.nodeName.toUpperCase() !== "INPUT" ) {
                    input$.focus();
                }
            } ).focusout( function() {
                values$
                    .removeClass( "is-focused" )
                    .children( SEL_IS_ACTIVE ).removeClass( C_IS_ACTIVE );
                // if enterable and a value is entered add it but not if lose focus because of opening popup
                if ( options.enterable && input$.val() && !popupOpen ) {
                    theItem.addValue( input$.val() );
                    input$.val( "" );
                }
            } );
        }

        options.initialSearch = "";
        forceRefresh = true; // this gets cleared by open
        if ( options.initialFetch === "value" && !options.multiple ) {
            options.initialSearch = input$.val(); // want the initial display value
        }
        if ( options.pageItemsToSubmit || options.dependingOnSelector ) {
            allItems = options.pageItemsToSubmit || "";
            if ( options.dependingOnSelector ) {
                if ( allItems.length > 0 ) {
                    allItems += ",";
                }
                allItems += options.dependingOnSelector;
            }
            options.itemsToSubmit = allItems.replace( /#/g, "" ).split( /\s*,\s*/ );
        }
        if ( options.itemsToSubmit ) {
            options.pluginTarget = input$[0];
        }

        if ( options.isPopup && !options.enterable ) {
            // when popup under and not a combobox field behave more like a select list and open when mouse down anywhere.
            group$.mousedown( function( event ) {
                // if right mouse button and not disabled
                if ( event.button === 0 && !theItem.isDisabled() ) {
                    open();
                    // prevent default so that the focus isn't stolen from the popup
                    event.preventDefault();
                }
            } );
        } else {
            // when open as a dialog or input is a combobox then only allow click on the button area
            button$.click( function() {
                if ( !popupRecentlyOpen ) {
                    open();
                }
                popupRecentlyOpen = false;
            } ).mousedown( function() {
                if ( popupOpen ) {
                    // avoid re-opening the inline popup if the same mousedown that turns into a click closed it
                    popupRecentlyOpen = true;
                }
            });
        }

        // When enterable and not multiple, additional outputs are set when a value is selected from the 
        // popup / dialog, however they are not set / cleared when a value is manually entered.
        if ( options.enterable && !options.multiple && !$.isEmptyObject( options.extraOut ) ) { 
            let oldValue;

            // Note: We need to detect when the value has changed, but can't use a change event because that would 
            // also be triggered from other places (eg setValue with suppress = false, from the popup). Instead
            // let's use focus / blur events on the input.
            input$
                .focus( e => {
                    oldValue = e.target.value;
                })
                .blur( e => {
                    let value = e.target.value;
                    if ( oldValue !== value ) {

                        // call setValue to update the additional outputs
                        // todo would be better to call setAdditionalOutputs here
                        theItem.setValue( value, null, true );     // suppress true to avoid infinite loop
                    }
                });
        }

        // various keys will also open
        input$.keydown( function( event ) {
            var inputTrap$,
                kc = event.which,
                printable = false;

            if ( kc === keys.DOWN || kc === keys.UP ) {
                open();
            } else if ( kc === keys.ENTER ) {
                // prevent the browser default to submit the page when this is the only text item on the page
                event.preventDefault();
            } else if ( !options.enterable ) {
                // If select list semantics (not enterable) then typing keys should open the dialog/popup and start filtering
                // Note there is no easy way to know for sure if a printing character will result. This is a reasonable
                // approximation. It may include some key combinations that could be used for keyboard shortcuts.
                // See key handling in actions.js for more info.
                // See check on value of inputTrap$ that makes sure a character was typed
                printable = !( ( kc >= 112 && kc <= 123 ) || ( kc >= 33 && kc <= 46 ) || kc < 32 );
                // a few printable keys are used for editing when used with a modifier
                if ( printable && ( event.ctrlKey || event.metaKey ) &&
                    {
                        65: 1, // "A"
                        67: 1, // "C"
                        86: 1, // "V"
                        88: 1, // "X"
                        89: 1, // "Y"
                        90: 1 // "Z"
                    }[kc] ) {
                    printable = false;
                }

                if ( printable ) {
                    // If just called open, by changing focus during key processing the event would result in the
                    // character being typed into the popup search field (which is what we want)
                    // except when crossing browsing contexts (iframes). Also don't want this to add to the filter but replace it.
                    // So instead use a hidden input to trap the typed character.
                    inputTrap$ = $( "#" + INPUT_TRAP_ID ); // all popupLov's can share this
                    if ( !inputTrap$[0] ) {
                        inputTrap$ = $( "<input id='" + INPUT_TRAP_ID + "' type='text' class='u-vh' aria-hidden='true' tabindex='-1'>" );
                    }
                    inputTrap$.insertAfter( input$ ).focus(); // move it around (insertAfter) so no scroll due to focus change
                    setTimeout( function() {
                        var ch = inputTrap$.val();
                        inputTrap$.val("");
                        if ( ch.length > 0 ) { // check that a character was really typed
                            open( ch );
                        } else if ( document.activeElement === inputTrap$[0] ) {
                            // if focus didn't change return it to the input
                            input$.focus();
                        }
                    }, 10 );
                } // Otherwise the typing keys could be used to enter a value
            }

        } );

        button$.on( "focus", function() {
            // the button is not a separate entity to focus
            input$.focus();
        });

        itemInstance = {
            enable: function() {
                ctrls$.prop( P_DISABLED, false );
                input$.removeClass( "apex_disabled" );
                if ( options.multiple ) {
                    values$.find( SEL_MULTI_REMOVE ).prop( P_DISABLED, false );
                }
            },
            disable: function() {
                ctrls$.prop( P_DISABLED, true );
                input$.addClass( "apex_disabled" );
                if ( options.multiple ) {
                    values$.find( SEL_MULTI_REMOVE ).prop( P_DISABLED, true );
                }
            },
            isDisabled: function() {
                return input$.prop( P_DISABLED );
            },
            show: function() {
                visibleCtrls$.show(); // todo think how to test show/hide? most of the time they are not used
            },
            hide: function() {
                visibleCtrls$.hide();
            },
            refresh: function() {
                // Clears the existing value(s) from the popup lov fields and fires the before and after refresh events
                /*
                 * A Popup LOV doesn't in general have all the options rendered on the page such as in
                 * children option elements. So there is no need to use the widget.util.cascadingLov.
                 * So nothing is really being refreshed right now but the model is cleared.
                 */
                // trigger the before refresh event
                input$.trigger( "apexbeforerefresh" );

                // Restore the current value
                if ( options.dynamicDefault ) {
                    apex.server.plugin ( options.ajaxIdentifier, {
                        p_widget_action:            "get-default-values",
                        pageItems:                  $(options.pageItemsToSubmit).add( options.dependingOnSelector )
                     }, {
                        loadingIndicator:           "#" + util.escapeCSS( theItem.id ), 
                        success: function( data ) {
                            let returnArray = [], displayArray = [];
                            for ( const returnValue in data ) {
                                if ( hasOwnProperty( data, returnValue ) ) {
                                    returnArray.push( returnValue );
                                    displayArray.push( data[ returnValue ].display );
                                }
                            }
                            if ( returnArray.length > 0 ) {
                                theItem.setValue( returnArray, displayArray );
                            } else {
                                theItem.setValue( options.nullValue, options.nullDisplayValue );
                            }
                        }
                    }); 
                } else {
                    theItem.setValue( options.nullValue, options.nullDisplayValue );
                }
                setExtraOut( true ); // clear out extra outputs

                clearModel();

                // trigger the after refresh event
                input$.trigger( "apexafterrefresh" );
            },
            setValue: function( value, displayValue, pSuppressChangeEvent ) { 

                // Function to get display values from server, function with callback used because we need access to the original
                // value from the result (in order to be sure we set the values in the correct order)
                function getRowValues( value, callback ) {

                    // setValue is also called from logic in widget.util.openPopupLov. We don't ever want to get values that have 
                    // already been set from openPopupLov (for example display values, or additional output values that have been 
                    // passed and set from the popup / dialog logic). So to prevent this from happening, do nothing when the popup 
                    // is currently open.
                    if ( popupOpen ) {
                        return;
                    }

                    apex.server.plugin ( options.ajaxIdentifier, {
                        p_widget_action:            "get-row-values",
                        f01:                        value,
                        pageItems:                  options.pageItemsToSubmit
                     }, {
                        loadingIndicator:           "#" + util.escapeCSS( theItem.id ), 
                        success: function( data ) {
                            /* Expected 'data' JSON format (index is return value):
                                {
                                    "7788": {       
                                        "display": "SCOTT",
                                        "columns": {
                                            "HIREDATE": "12/9/1982",
                                            "JOB": "ANALYST",
                                            "SAL": "3000",
                                            ...
                                        }
                                    },
                                    ...
                                }
                            */
                            callback( data );
                        }
                    });
                }
                function setMultiValues( values, displayValues ) {
                    let i, items = "";
                    for ( i = 0; i < values.length; i++ ) {
                        items += renderMultiItem( values[ i ], displayValues ? displayValues[ i ] : null );
                    }
                    input$.parent().before( $( items ) );
                }
                function setAdditionalOutputs( colValues ) {
                    let val,
                        map = options.extraOut;
                    if ( !$.isEmptyObject( map ) ) {
                        for ( const [ p, entry ] of Object.entries( map ) ) {
                            val = ( colValues ? colValues[ p ] : "" );
                            item( entry.item ).setValue( val, null, pSuppressChangeEvent );
                        }
                    }   
                }

                // Multiple: value / displayValue could be single values, or arrays of values
                // Note: Additional outputs not supported for multiple
                if ( options.multiple ) {
                    let values = util.toArray( value, options.separator );

                    // clear old values
                    input$.val( "" );
                    values$.children().not( ":last" ).remove();

                    // if value is "" then the intent is to clear all the values
                    if ( value !== "" ) {

                        // If displayValue is passed, use it
                        if ( displayValue ) {
                            setMultiValues( values, util.toArray( displayValue, ", " ) );

                            // set hidden input 
                            hidden$.val( values.join( options.separator ) );
                        } else {

                            // If no display value, get and set
                            // Note: No need to set additional outputs here, not supported for multiple
                            getRowValues( values, data => {
                                if ( !$.isEmptyObject( data ) ) {
                                    let i, displayValues = [],
                                        values = util.toArray( value, options.separator );

                                    // build displayValues array from server response
                                    for ( i = 0; i < values.length; i++ ) {
                                        
                                        // If the return value was not found and display extra is false, server will not return display value
                                        // When this happens, this value will not be included in the new values set.
                                        if ( data[ values[ i ] ] ) {
                                            displayValues.push( data[ values[ i ] ].display );
                                        } else {
                                            // remove unknown value from values array
                                            values.splice( i, 1 );
                                        }
                                    }
                                    setMultiValues( values, displayValues );

                                    // set hidden input
                                    hidden$.val( values.join( options.separator ) );                                    
                                }
                            });
                        }
                    }
                    
                } else if ( options.hasDisplayValue ) {

                    // if there is a display column then the value is in the hidden input and the display value is in the input.
                    hidden$.val( value );

                    if ( !displayValue && value === options.nullValue ) {

                        // If no display value and return value equals null value
                        input$.val( options.nullDisplayValue );
                        setAdditionalOutputs();
                        
                    } else if ( !displayValue ) {

                        // No display value, so let's deal with it here
                        if ( value ) {
                            getRowValues( value, data => {
                                if ( !$.isEmptyObject( data ) ) {
                                    input$.val( data[ value ].display );
                                    setAdditionalOutputs( data[ value ].columns );
                                } else {

                                    // If call returns empty object we just clear everything
                                    input$.val( "" );
                                    setAdditionalOutputs();
                                }
                            });
                        } else {

                            // if value is falsey, then just clear both input and additional outputs
                            input$.val( "" );
                            setAdditionalOutputs();
                        }

                    } else {

                        // Important to still support if display value is just passed with setValue
                        input$.val( displayValue );

                        // No need to lookup display value, but if there are additional outputs, get and set
                        if ( !$.isEmptyObject( options.extraOut ) ) {
                            getRowValues( value, data => {
                                if ( !$.isEmptyObject( data ) ) {
                                    setAdditionalOutputs( data[ value ].columns );
                                } else {
                                    setAdditionalOutputs();
                                }
                            });
                        }
                    }
                } else {

                    // Enterable, set value directly
                    input$.val( value );    

                    // No need to set display value (there isn't one for enterable), but if there are additional outputs, get and set
                    if ( !$.isEmptyObject( options.extraOut ) ) {
                        getRowValues( value, data => {
                            if ( !$.isEmptyObject( data ) ) {
                                setAdditionalOutputs( data[ value ].columns );
                            } else {
                                setAdditionalOutputs();
                            }
                        });
                    }
                }
            },
            addValue: function( value, displayValue ) {
                var item$, unique;
                if ( options.multiple ) {
                    // make sure the value is unique
                    unique = true;
                    values$.children().not(":last").each( function() {
                        var curVal = $( this ).attr( A_DATA_VALUE );
                        if ( curVal === value ) {
                            unique = false;
                            return false;
                        }
                    } );
                    if ( unique ) {
                        item$ = $( renderMultiItem( value, displayValue ) );
                        input$.parent().before( item$ );
                        hidden$.val( this.getValue().join( options.separator ) );
                        input$.change();
                    }
                }
            },
            removeValue: function( value ) {
                var toRemove = [];
                if ( options.multiple ) {
                    values$.children().not(":last").each( function() {
                        var curVal = $( this ).attr( A_DATA_VALUE );
                        if ( curVal === value ) {
                            toRemove.push( this );
                        }
                    } );
                    $( toRemove ).remove();
                    hidden$.val( this.getValue().join( options.separator ) );
                    if ( toRemove.length ) {
                        input$.change();
                    }
                }
            },
            isChanged: function() {
                var curVal = this.getValue();

                if ( $.isArray( curVal ) ) {
                    curVal = curVal.join( options.separator );
                }
                return originalValue !== curVal;
            },
            getValue: function() {
                var results;
                if ( options.multiple ) {
                    results = [];
                    values$.children().not(":last").each( function() {
                        results.push( $( this ).attr( A_DATA_VALUE ) );
                    } );
                    // Note: In previous releases popupLov getValue would return a comma separated string for multiple
                    // values, which is inconsistent with other multi value items. Now getValue works like other
                    // multi value capable items and returns an array.
                    // For previous behavior set options.separator = "," and use $v to get the value as a string.
                    return results;
                } else if ( options.hasDisplayValue ) {
                    // if there is a display column then the value is in the hidden input
                    return hidden$.val();
                } else {
                    return input$.val();
                }
            },
            hasDisplayValue: function() {
                let lItemContent = (options.multiple) ? this.getValue() : $( this.node ).val();
                return ( lItemContent && lItemContent.length > 0 ) ? true : false;
            },
            afterModify: function() {
                var w, maxW, val$, top, prevTop, margin;
                if ( options.multiple ) {
                    if ( originalPlaceholder ) {
                        input$.attr( "placeholder", this.isEmpty() ? originalPlaceholder : "" );
                    }
                    val$ = input$.parent();
                    margin = parseInt(val$.css("margin-left"), 10) + parseInt(val$.css("margin-right"), 10);
                    w = maxW = valuesWidth;
                    if ( !this.isEmpty() ) {
                        val$ = val$.prev();
                        prevTop = val$.offset().top;
                        for ( ;; ) {
                            w -= val$.outerWidth( true );
                            val$ = val$.prev();
                            if ( !val$.length ) {
                                break;
                            }
                            top = val$.offset().top;
                            if ( top !== prevTop ) {
                                break;
                            }
                            prevTop = top;
                        }
                    }
                    if ( w < MULTI_INPUT_MIN_WIDTH ) {
                        w = maxW;
                    }
                    input$.css( "max-width", w - margin );
                }
            },
            setFocusTo: function() {
                return input$;
            },
            displayValueFor: function( value ) {
                var i, forValues, values;

                if ( options.hasDisplayValue ) {
                    if ( options.multiple ) {
                        forValues = util.toArray( value, options.separator );
                        values = this.getValue();
                        if ( values.length !== forValues.length ) {
                            return value;
                        }
                        // values must be in the same order
                        for ( i = 0; i < forValues.length; i++ ) {
                            if ( forValues[i] !== values[i] ) {
                                return value;
                            }
                        }
                        // if not returned yet all values must be equal
                        return $.map( values$.children().not(":last"), function( el ) { return $( el ).text(); } ).join( ", " );
                    }
                    if ( value === this.getValue() ) {
                        return $( this.node ).val();
                    }
                } // else
                return value;
            },
            getPopupSelector: function() {
                return ".ui-dialog-popuplov";
            },
            getValidity: function () {
                const attr = input$.prop( "required" );
                if ( attr !== undefined && attr !== false ) {
                    if ( this.isEmpty() ) { 
                        return { valid: false, valueMissing: true };
                    }
                }

                return { valid: true };
            },
            nullValue: options.nullValue,
            // logic to return ':' or ',' based on enterable (,), non-enterable (:)
            separator: options.multiple ? options.separator : null
        };
        if ( options.itemsToSubmit ) {
            // when depending on other items need to clear the model on reinit
            itemInstance.reinit = function( value, displayValue ) {
                // set value and suppress change event
                this.setValue( value, displayValue, true );
                return function() {
                    clearModel();
                };
            };
        }

        item.create( itemId, itemInstance );

        // get the item interface after it is created
        theItem = apex.item( itemId );
        if ( options.multiple ) {
            theItem.setValue( values, displayValues, true );
            theItem.afterModify(); // let the input width adjust
        }
        lastOpenValue = input$.val();
        originalValue = theItem.getValue();
        if ( $.isArray( originalValue ) ) {
            originalValue = originalValue.join( options.separator );
        }

        function refresh() {
            theItem.refresh();
        }

        // if it's a cascading popup lov we have to register change events for our masters
        if ( options.dependingOnSelector) {
            $( options.dependingOnSelector ).change( refresh );
            // xxx does the model need to be cleared when parents refresh? like select:  .on( "apexbeforerefresh", _clearList )
        }

        // For backward compatibility handle the apexrefresh event
        input$.on( "apexrefresh", refresh );
    };

})( apex.widget, apex.item, apex.util, apex.jQuery );
