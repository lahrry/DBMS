/*!
 Date Picker - APEX widget for picking dates, supports rendering as either JET or Native date form controls
 Copyright (c) 2021, 2022, Oracle and/or its affiliates.
 */
/* eslint-env amd */
/**
 * @fileOverview
 * APEX widget for picking dates, supports rendering as either JET or Native date form controls
 * 
 * Documentation 
 * Note: Both JET and Native HTML date controls require the date to be in ISO Format. This is different to Oracle date format.
 * getValue and setValue both work by using the Oracle date format.
 * 
 * Expected markup
 * 
 * - Display As = Popup / Show Time = No
 *      <oj-input-date
 *          Note: See below for details on relevant attributes for this web component
 *      ></oj-input-date>
 *
 * - Display As = Popup / Show Time = Yes
 *      <oj-input-date-time
 *          Note: See below for details on relevant attributes for this web component
 *      ></oj-input-date-time>
 *
 * - Display As = Inline / Show Time = No
 *      <input type='hidden' id='[item name]_HIDDENVALUE' 
 *          name='[input name from server]' value='[value in Oracle format, used as main value store]'      todo value may not be needed
 *          class='js-ignoreChange' [depends on item ignore change setting]
 *      />
 *      <oj-date-picker
 *          Note: See below for details on relevant attributes for this web component
 *      ></oj-date-picker>  
 *
 * - Display As = Inline / Show Time = Yes:
 *      <input type='hidden' id='[item name]_HIDDENVALUE' 
 *          name='[input name from server]' value='[value in Oracle format, used as main value store]'      todo value may not be needed
 *          class='js-ignoreChange' [depends on item ignore change setting]
 *      />
 *      <oj-date-time-picker
 *          Note: See below for details on relevant attributes for this web component
 *      ></oj-date-time-picker>  
 *
 * - Display As = Native HTML:
 *      <input type=['date' or 'datetime-local': depending on server show time setting] maxlength='10' autocomplete='off' 
 *          Note: In addition see below 'Attributes common to both JET and Native types'
 *      />
 *
 * - Attributes common to both JET and Native types:
 *      - min                               The minimum allowed value, in ISO date format (set by server when min type is static)
 *      - max                               The maximum allowed value, in ISO date format (set by server when max type is static)
 *      - data-dynamic-min                  When min is calculated rather than static, this will be set to an item / DOM ID and 
 *                                          this client-side logic sets up and maintains the min attribute value.
 *      - data-dynamic-max                  When max is calculated rather than static, this will be set to an item / DOM ID and 
 *                                          this client-side logic sets up and maintains the max attribute value.
 *      - value                             Date value in ISO date format
 *
 * - Attributes common to JET types (Display As = Popup or Inline):
 *      - date-picker.number-of-months      JET attribute: Numeric number of months displayed
 *      - date-picker.days-outside-month    JET attribute: Either 'hidden', 'selectable', or 'visible'
 *      - date-picker.week-display          JET attribute: Either 'number' or 'none'
 *      - date-picker.change-month          JET attribute: Either 'select' or 'none'
 *      - date-picker.change-year           JET attribute: Either 'select' or 'none'
 *      - translations.next-text            JET attribute: Message text for next month button
 *      - translations.previous-text        JET attribute: Message text for previous month button
 *      - data-format                       Custom attribute that stores format of the date
 *
 * - Attributes common to JET popup types (Display As = Popup):
 *      - data-size                         Custom attribute used to set JET's shadow DOM input 'size' attribute
 *      - data-maxlength                    Custom attribute used to set JET's shadow DOM input 'maxlength' attribute
 *      - data-name                         Custom attribute used to set JET's shadow DOM input 'name' attribute. 
 *      - Note: For labelling the shadow DOM input with popup types, we add aria-labelledby to the shadow DOM input element. 
 *              See comments in relevant code section below.
 *
 * - Attributes common to JET time types (Display As = Popup or Inline, with Show Time = Yes):
 *      - time-picker.time-increment        Time increment in format hh:mm:ss:SS
 *
 * Note: In APEX we turn off all JET messaging / user assistance, so server sets all the following to 'none':
 *  - display-options.converter-hint
 *  - display-options.messages
 *  - display-options.validator-hint
 * 
 * In addition, it's worth noting that for the JET types, it is possible to use any other  attributes that JET support,
 * (for example dayFormatter), it's just that we don't currently expose those in APEX, so they are not mentioned above.
 *
 * 
 * Assumptions
 * 
 * Depends:
 *
 */

( function( item, $, util, lang, date, debug ) {
    "use strict";

    const A_MIN                 = "min",
          A_MAX                 = "max",
          P_REQUIRED            = "required",
          JET                   = "jet",
          NATIVE                = "native",
          C_APEX_JET_COMPONENT  = "apex-jet-component",
          C_OJ_DATEPICKER_POPUP = "oj-datepicker-popup",
          S_APEX_JET_COMPONENT  = "." + C_APEX_JET_COMPONENT,
          S_OJ_DATEPICKER_POPUP = "." + C_OJ_DATEPICKER_POPUP,
          OJ_DATE_PICKER        = "oj-date-picker",
          OJ_DATE_TIME_PICKER   = "oj-date-time-picker",
          OJ_INPUT_DATE         = "oj-input-date",
          OJ_INPUT_DATE_TIME    = "oj-input-date-time",
          D_VALID_EXAMPLE       = "data-valid-example",
          D_DYNAMIC_MIN         = "data-dynamic-min",
          D_DYNAMIC_MAX         = "data-dynamic-max",
          D_SIZE                = "data-size",
          D_MAXLENGTH           = "data-maxlength",
          D_NAME                = "data-name",
          D_FORMAT              = "data-format",
          ISO_FORMAT            = "YYYY-MM-DD\"T\"HH24:MI:SS",
          ISO_FORMAT_SH         = "YYYY-MM-DD";


    // Base item prototype, contains attributes common to all date picker types (eg JET-based, and Native HTML)
    let itemPrototype = {
        // Use defaults for show, hide, enable, disable, isDisabled, setStyle
        getNativeValue: function() {

            // this.node always stores the value in ISO date format, as required by both Native HTML and JET date controls
            // For JET components, this.node is the <oj-> element, for Native HTML, this is the date input
            let nodeValue = this.node.value;

            // Append 'Z' to ISO string to ensure date / time is always in UTC
            if ( nodeValue ) {
                if ( nodeValue.length === 10 ) {
                    nodeValue += "T00:00:00Z";
                } else {
                    nodeValue += "Z";
                }

                // This ISO value can be passed directly to new Date(..), and will return a native date object
                return new Date( nodeValue );
            } else {
                return null;
            }

        },
        isChanged: function() {
            if ( this._initialValue === undefined ) {
                return false;
            }
            return this._initialValue !== this.getValue();
        },
        getValidationMessage: function() {
            let message = "",
                hasMin = this.element.attr( A_MIN ) !== undefined,
                hasMax = this.element.attr( A_MAX ) !== undefined,
                lValid = this.getValidity();

            if ( !lValid.valid ) {
                // We can determine the message to show by looking at what attributes are present and if the value is required
                // Note: Now automatically substitutes #LABEL# in getValidationMessage logic in item.js
                if ( lValid.valueMissing ) {
                    message = lang.formatMessageNoEscape( "APEX.DATEPICKER_JET.REQUIRED" );
                } else if ( hasMin && hasMax && ( lValid.rangeOverflow || lValid.rangeUnderflow ) ) {
                    message = lang.formatMessageNoEscape( "APEX.DATEPICKER_JET.VALUE_MUST_BE_BETWEEN", this._format( this.element.attr( A_MIN ) ), this._format( this.element.attr( A_MAX ) ) );
                } else if ( lValid.rangeUnderflow ) {
                    message = lang.formatMessageNoEscape( "APEX.DATEPICKER_JET.VALUE_MUST_BE_ON_OR_AFTER", this._format( this.element.attr( A_MIN ) ) );
                } else if ( lValid.rangeOverflow ) {
                    message = lang.formatMessageNoEscape( "APEX.DATEPICKER_JET.VALUE_MUST_BE_ON_OR_BEFORE", this._format( this.element.attr( A_MAX ) ) );
                } else {
                    // If none of the above, fallback to basic invalid date with example message
                    // check if it's a native or jet datepicker
                    if ( [ OJ_INPUT_DATE, OJ_INPUT_DATE_TIME ].includes( this.element.prop( "tagName" ).toLowerCase() ) ) {
                        message = lang.formatMessageNoEscape( "APEX.DATEPICKER_JET.VALUE_INVALID", this.element.attr( D_VALID_EXAMPLE )); 
                    } else {
                        message = lang.formatMessageNoEscape( "APEX.DATEPICKER_JET.NATIVE_VALUE_INVALID" ); 
                    }
                }
            }
            return message;
        },
        reinit: function( pValue ) {
            let dynamicMinId = this.element.attr( D_DYNAMIC_MIN ),
                dynamicMaxId = this.element.attr( D_DYNAMIC_MAX );
            
            this.setValue( pValue, null, true );

            // If the item has dynamic min / max item, we must set the boundary value again
            if ( dynamicMinId ) {
                setBoundaryValue( A_MIN, dynamicMinId, this );
            }
            if ( dynamicMaxId ) {
                setBoundaryValue( A_MAX, dynamicMaxId, this );
            }
        },
        // item-specific code
        _ignorePropertyChange: false
    };

    // JET item prototype extends the base prototype with some of its own..
    let jetItemPrototype = $.extend( {}, itemPrototype, {
        _datePickerType : JET,
        // displayValueFor: returns value in Oracle date format
        displayValueFor: function( value ) {
            return ( this.isReady() ? this._format( value ) : value );
        },
        getPopupSelector: function() {
            return S_OJ_DATEPICKER_POPUP;
        },
        setFocusTo: function() {

            // todo change when we have the tab stop logic in place

            if ( this._isInline ) {
                return $( this.node ).find( ":focusable" ).first();
            } else {
                return this.node;
            }
        },
        // getValue: returns value in Oracle date format
        getValue: function() {
            // If JET has loaded we can call _format, otherwise we fallback to the value rendered by the server
            if ( this.isReady() ) {
                return this._format( this.node.value );
            } else {
                return $( "#" + util.escapeCSS( this.id ) ).attr("data-oracle-date-value") ||"";
            }
        },
        setValue: function( pValue /*, pDisplayValue, pSuppressChange*/ ) {

            // Note: We always set _ignorePropertyChange flag here, because we never want to trigger the change event here (leave that to wrapSetValue in item.js)
            this._ignorePropertyChange = true;
            
            // Changing the DOM node value directly triggers valueChanged (but not change)
            if ( this.isReady() ) {
                try {
                    this.node.value = this._parse( pValue );    // transform to ISO format for this.node
                } catch ( e ) {
                    debug.info( e );
                }
            } else {
                // if JET isn't ready yet, use the passed value as is
                this.node.value = pValue;
            }
            
            this._ignorePropertyChange = false;
        },
        getValidity: function() {
            let lIsRequired = this.element.prop( P_REQUIRED ),
            lFormat = this.element.attr( D_FORMAT ),
            lMin = this.element.attr( A_MIN ),
            lMax = this.element.attr( A_MAX ),
            lValue = this.getValue(),
            lValid = {
                valid: true,
                valueMissing: false,
                rangeOverflow: false,
                rangeUnderflow: false
            };
            
            // check value is missing
            if ( lIsRequired && this.isEmpty() ) {
                lValid.valid = false;
                lValid.valueMissing = true;
                return lValid;
            }

            // check that input fits format mask
            try {
                date.parse( lValue, lFormat );
            } catch (e) {
                lValid.valid = false;
                return lValid; 
            }

            // check min
            if ( lMin && lMin.length > 0 ) {
                if ( date.parse( lMin, ISO_FORMAT ) > date.parse( lValue, lFormat ) ) {
                    lValid.rangeUnderflow = true;
                    lValid.valid = false;
                    return lValid;
                }
            }

            // check max
            if ( lMax && lMax.length > 0 ) {
                if ( date.parse( lMax, ISO_FORMAT ) < date.parse( lValue, lFormat ) ) {
                    lValid.rangeOverflow = true;
                    lValid.valid = false;
                    return lValid;
                }
            }

            return lValid;
        },
        delayLoading: true
    });

    // Native item prototype extends base also...
    let nativeItemPrototype = $.extend( {}, itemPrototype, {
        _datePickerType: NATIVE,
        getValue: function() {
            return this.node.value || "";
        },
        setValue: function( pValue /*, pDisplayValue, pSuppressChange*/ ) {

            // Note: We always set _ignorePropertyChange flag here, because we never want to trigger the change event here (leave that to wrapSetValue in item.js)
            this._ignorePropertyChange = true;
            
            // Changing the DOM node value directly triggers valueChanged (but not change)
            this.node.value = pValue;

            this._ignorePropertyChange = false;
        },
        // Native date types displays the date according to the locale of the user's browser, so be consistent with that by 
        // using native date methods toLocaleString (date and time), and toLocaleDateString (date only)
        // Reference: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/date
        displayValueFor: function( value ) {
            let displayDate = "";
            if ( value ) {
                if ( this._hasTime ) {
                    displayDate = new Date( value ).toLocaleString();
                } else {
                    displayDate = new Date( value ).toLocaleDateString();
                }
            }
            return displayDate;
        },
        _format: function( value ) {
            return this.displayValueFor( value );
        }
    });

    // check if it's ISO or oracle date format and parse as date
    function parseISOorOracleDate( pDateString, pOracleFormat ) {
        // check if string is iso format with milliseconds - jet returns sometimes with that format
        if ( /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}$/.test( pDateString ) ) {
            return date.parse( pDateString.slice(0, -4), ISO_FORMAT );
        } 
        // check if strin is iso format - jet returns sometimes with that format
        else if ( /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test( pDateString ) ) {
            return date.parse( pDateString, ISO_FORMAT );
        } 
        // check if string is short iso format - jet returns sometimes with that format
        else if ( /^\d{4}-\d{2}-\d{2}$/.test( pDateString ) ) {
            return date.parse( pDateString, ISO_FORMAT_SH );
        }
        // else try to given format mask
        else {
            try {
                return date.parse( pDateString, pOracleFormat );
            } catch ( e ) {
                debug.info( e );
                return pDateString;
            }
        }
    }

    // Function returns true if item passed has either dynamic min, or dynamic max data attribute defined
    function hasDynamicBoundary ( item ) {
        let item$ = $( "#" + util.escapeCSS( item.id ) );
        return ( item$.attr( D_DYNAMIC_MIN ) || item$.attr( D_DYNAMIC_MAX ) ? true : false );
    }

    function setBoundaryValue( pType, pBoundaryItemId, pCurrentItem ) {
        let boundaryItem = item( pBoundaryItemId ),
            currentItem$ = $( "#" + util.escapeCSS( pCurrentItem.id ) ),
            // Use the boundary item's node value, because min/max needs the date in ISO format. Note
            // this will therefore only work currently if the boundary item is also a new date picker.
            boundaryValue = ( boundaryItem.node ? ( boundaryItem.node.value || boundaryItem.getValue() ) : null ),
            dateFormat = currentItem$.attr( D_FORMAT ),
            // TODO find a solution to parse also item with custome format mask that are no date pickers
            curDate = parseISOorOracleDate( boundaryValue, dateFormat );

        if ( boundaryValue && !isNaN( curDate ) ) {

            let lValue = date.format( curDate, ISO_FORMAT );

            // And finally let's update the min/max value with the new boundary value in ISO string format
            currentItem$.attr( pType, lValue );

        } else {

            // If there is no node value, or the value is not a valid date, then remove the min/max attribute
            currentItem$.removeAttr( pType );
        }
    }   // setBoundaryValue

    // Main attach function
    function attachDatePicker( context$ ) {
        let i,
            nativeItemsWithBoundary = [],
            jetItemsWithBoundary = [],
            jetAsyncItems = [],
            jetElements$ = $(   OJ_INPUT_DATE + S_APEX_JET_COMPONENT + "," + 
                                OJ_INPUT_DATE_TIME + S_APEX_JET_COMPONENT + "," + 
                                OJ_DATE_PICKER + S_APEX_JET_COMPONENT + "," + 
                                OJ_DATE_TIME_PICKER + S_APEX_JET_COMPONENT, context$ ),
            nativeElements$ = $( "input[type=date].apex-item-datepicker,input[type=datetime-local].apex-item-datepicker", context$ );

        // Internal function used to setup min / max boundary values and handlers, when min / max is dynamic
        function initBoundaries( pItems ) {
            let i;

            function init( pType, pBoundaryItemId, pCurrentItemId, pCurrentItem ) {

                // set min/max during setup
                setBoundaryValue( pType, pBoundaryItemId, pCurrentItem );
                
                // and setup change handler to update dpItem$ min/max value when data-dynamic-min/max changes
                $( "#" + util.escapeCSS( pBoundaryItemId ) ).on( "change", function() {
                    setBoundaryValue( pType, pBoundaryItemId, pCurrentItem );
                });
            }  // setup

            for ( i = 0; i < pItems.length; i++ ) {
                let currentItem     = pItems[ i ],
                    id              = currentItem.id,
                    currentItem$    = $( "#" + util.escapeCSS( id ) ), 
                    dynamicMinId    = currentItem$.attr( D_DYNAMIC_MIN ), 
                    dynamicMaxId    = currentItem$.attr( D_DYNAMIC_MAX );

                if ( dynamicMinId ) {
                    init( A_MIN, dynamicMinId, id, currentItem );
                }
                if ( dynamicMaxId ) {
                    init( A_MAX, dynamicMaxId, id, currentItem );
                }
            }
        }

        
        /*
         * First the Native HTML display types. 
         * Note: These DON'T need to delay loading
         */
        nativeElements$.each( ( _, el ) => {
            let thisItem,
                id = el.id;
            
            // create the item 
            item.create( id, nativeItemPrototype );
            thisItem = item( id );
            thisItem._hasTime = el.type === "datetime-local";
            // set _initialValue last, as the getValue call needs to know some of the internal variables
            thisItem._initialValue = thisItem.getValue();

            // Store all items that have a dynamic boundary, as these will need to be processed when all items have been created
            if ( hasDynamicBoundary( thisItem ) ) {
                nativeItemsWithBoundary.push( thisItem );
            }
        });

        // setup min / max values / handlers. Note: Must be done after all item objects have been created
        initBoundaries( nativeItemsWithBoundary );
      

        /*
         * Now the JET based display types
         * Note: These DO delay loading
         */

        jetElements$.each( ( _, el ) => {
            let   id         = util.escapeCSS( el.id ),
                  jetItem$   = $( el ),
                  deferred   = item.create( el.id, jetItemPrototype ),   // Important to create item before JET loads
                  thisItem   = item( id );
            const dateFormat = jetItem$.attr( D_FORMAT );
            const upperDateFormat = dateFormat.toUpperCase();

            // if the list of require files is changed please change also Grunt.js list for jetDatePicker
            require( [ "ojs/ojbootstrap", "ojs/ojconverter-datetime", "ojs/ojdatetimepicker" ], function( Bootstrap, DateTimeConverter ) {
                
                // make sure the JET component has completely finished creation
                Bootstrap.whenDocumentReady().then( function() {
                    let jetInput$ = jetItem$.find( "input.oj-text-field-input" );
                    
                    // remove dummy datepicker on page load
                    jetElements$.parent().find(".placeholder-until-jet-loaded").remove();
                    // and show jet element after remove of the placeholder
                    jetElements$.removeClass("u-VisuallyHidden");

                    // IG requires popup container can recieve focus
                    $( S_OJ_DATEPICKER_POPUP ).prop( "tabindex", -1 );
        
                    /*
                    * We need to make a few modifications to the shadow DOM <input> rendered by JET:
                    * -    Labelling has to be done here because JET renders the <input> which is what needs labelling. Note: We can't
                    *      use our standard label's FOR attribute, because the oj-* element has the ID of the item name already (which is
                    *      what the label's FOR attribute references).
                    * -    Size, maxlength and name also has to be added to the <input>
                    */
                    jetInput$
                        .attr( "aria-labelledby",   id + "_LABEL" )
                        .attr( "size",              jetItem$.attr( D_SIZE ) )
                        .attr( "maxlength",         jetItem$.attr( D_MAXLENGTH ) )
                        .attr( "name",              jetItem$.attr( D_NAME ) );

                    thisItem._hasTime = jetItem$.is( OJ_INPUT_DATE_TIME + "," + OJ_DATE_TIME_PICKER );
                    thisItem._isInline = jetItem$.is( OJ_DATE_PICKER + "," + OJ_DATE_TIME_PICKER );

                    // load jet converter and set needed options
                    let converter =  new DateTimeConverter.IntlDateTimeConverter({
                        formatType: ( thisItem._hasTime ) ? "datetime" : "date",
                        timeFormat: ( upperDateFormat.includes( "SS" ) ) ? "medium" : "short",
                        hour: ( upperDateFormat.includes( "HH" ) ) ? "2-digit" : undefined,
                        minute: ( upperDateFormat.includes( "MI" ) ) ? "2-digit" : undefined,
                        second: ( upperDateFormat.includes( "SS" ) ) ? "2-digit" : undefined,
                        hour12: ( ( upperDateFormat.includes( "PM" ) || upperDateFormat.includes( "AM" ) || !upperDateFormat.includes( "HH24" ) ) && upperDateFormat.includes( "HH" ) ) ? true : false,
                        isoStrFormat: "local"
                    });
                    
                    // overwrite format and parse function to use database formats
                   converter.format = function ( pValue ) {
                        
                        debug.info( "apex.widget.jetDatePicker: format", el.id );
                        
                        // when pValue has an empty state return null because of jet implementation
                        if ( typeof pValue === "undefined" || pValue === null  || pValue === "" ) {
                            return null;
                        }

                        // parse string and format correctly if possible
                        try {
                            let valDate = parseISOorOracleDate( pValue, dateFormat );
                            return date.format( valDate , dateFormat );
                        } catch ( e ) {   
                            return pValue;
                        }
                    };

                    converter.parse = function ( pValue ) {
                        
                        debug.info( "apex.widget.jetDatePicker: parse", el.id );

                        // when pValue has an empty state return null because of jet implementation
                        if ( typeof pValue === "undefined" || pValue === null || pValue === "" ) {
                            return null;
                        }

                        // try / catch block is needed when entered data is not a parseable date
                        try {
                            let ret = parseISOorOracleDate( pValue, dateFormat );
                            return  date.toISOString( ret );
                        } catch ( e ) {   
                            return pValue;
                        }
                    };

                    el.converter = converter;
        
                    // _format function: Pass in the date value in ISO string format, returns the formatted string according 
                    // to the current converter pattern.
                    thisItem._format = function( pValue ) {
                        return el.converter.format( pValue ) || "";
                    };

                    // _parse function: Pass in a string in the Oracle date format, returns the date in ISO format
                    thisItem._parse = function( pValue ) {
                        return el.converter.parse( pValue );
                    };

                    // Hook up value property change notification to change event if needed
                    jetItem$.on( "valueChanged", function () {
                        
                        // let's ignore this event when value has been set via setValue (because setValue base item handling handles events here)
                        if ( thisItem._ignorePropertyChange ) {
                            return;
                        }
        
                        // wait until the raw value is updated
                        setTimeout( function () {
                            jetItem$.trigger( "change" );
                        }, 0 );

                    } ).change( function( event ) {
        
                        // suppress change event from internal input element (fires when you change the date with the keyboard, so must be suppressed to avoid duplicate events)
                        if ( event.target !== el ) {
                            event.stopImmediatePropagation();
                        }
                    });
                    
                    // Remove the hint div that shows 'Required' if an item is required
                    // todo causes flicker, handle with CSS
                    jetItem$.find( ".oj-required-inline-container" ).hide();

                    // Inline items are missing a programmatic link to the label, so let's add a group labelled by 
                    // the item label, to the DIV that receives focus in the shadow DOM
                    if ( thisItem._isInline ) {
                        jetItem$.find( ".oj-datepicker-popup" )
                            .attr( "role", "group" )
                            .attr( "aria-labelledby", id + "_LABEL" );
                    }

                    deferred.resolve();

                    // set _initialValue last and after resolve, so getValue goes via the isReady() case
                    thisItem._initialValue = thisItem.getValue();

                });  // context ready

            }); // require

            // Store all items that have a dynamic boundary, as these will need to be processed when all items have been created
            if ( thisItem.whenReady && hasDynamicBoundary( thisItem ) ) {
                jetItemsWithBoundary.push( thisItem );
            }

        }); // each ojElement$

        // Make new array containing all the item's whenReady deferred objects, as we need to wait until they are all ready
        for ( i = 0; i < jetItemsWithBoundary.length; i++ ) {
            jetAsyncItems.push( jetItemsWithBoundary[ i ].whenReady() );
        }
        
        // Setup min / max values / handlers. Note: Must be done after all item objects have been created
        // Note: Use apply to pass in jetAsyncItems as array of params
        $.when.apply( $, jetAsyncItems ).done( function() {
            initBoundaries( jetItemsWithBoundary );
        });
        
    } // attachDatePicker

    // Call to add main attach handler to the item interface
    item.addAttachHandler( attachDatePicker );

})( apex.item, apex.jQuery, apex.util, apex.lang, apex.date, apex.debug );