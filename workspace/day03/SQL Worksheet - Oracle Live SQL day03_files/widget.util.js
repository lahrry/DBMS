/*!
 Copyright (c) 2012, 2022, Oracle and/or its affiliates. All rights reserved.
 */
/**
 * The {@link apex.widget.util} namespace is used to store all widget utility functions of Oracle APEX.
 **/

/**
 * @namespace
 **/
apex.widget.util = {};

(function( widgetUtil, util, lang, navigation, $ ) {
    "use strict";

    const hasOwnProperty = util.hasOwnProperty,
        objectEntries = util.objectEntries,
        extend = $.extend;

    // this module loads before jQuery UI so can't rely on $.ui.keyCodes
    const KEY_BACKSPACE = 8,
        KEY_TAB = 9,
        KEY_ENTER = 13,
        KEY_ESCAPE = 27,
        KEY_SPACE = 32,
        KEY_LEFT = 37,
        KEY_UP = 38,
        KEY_RIGHT = 39,
        KEY_DOWN = 40,
        KEY_DELETE = 46;

    const C_CHIP = "a-Chip",
        C_CHIP_APPLIED = "a-Chip--applied",
        SEL_CHIP_APPLIED = "." + C_CHIP_APPLIED,
        SEL_CHIP_LABEL= ".a-Chip-label",
        SEL_CHIP_TEXT = ".a-Chip-text > .a-Chip-value",
        C_CHIP_OVERFLOW = "a-Chip--overflow",
        SEL_CHIP_OVERFLOW = "." + C_CHIP_OVERFLOW,
        C_IS_ACTIVE = "is-active",
        SEL_IS_ACTIVE = "." + C_IS_ACTIVE,
        C_IS_FOCUSED = "is-focused",
        SEL_IS_FOCUSED = "." + C_IS_FOCUSED,
        SEL_VISIBLE = ":visible",
        A_DATA_VALUE = "data-value",
        A_ARIA_EXPANDED = "aria-expanded";

    const REMOVE_ICON = `<span class="a-Chip-divider" role="separator" aria-orientation="vertical"></span>\
<span class="a-Chip-remove js-removeChip"><span class="a-Icon icon-multi-remove"></span></span>`;

    /**
     * Internal use
     * Common code for combobox, select list and similar things
     *
     * Primary use cases
     * - Combobox (enterable) and Many or One/Single (multiValued):
     *                      multiValued
     *                      true        false
     * enterable    true    Combo Many  Combo One
     *              false   Select Many Select One
     *
     * - Control over the popup UI and filtering:
     *    This code handles popup UI and filtering and highlighting
     *        choices is an array of all the choices
     *    This code handles popup UI but external filtering and highlighting through callbacks
     *        choices is a function called to get filtered/highlighted choices
     *        findChoice callback must be implemented
     *    External popup UI and filtering
     *        onOpen callback required
     *        Ignored options: choiceTemplate, choices, autoComplete,
     *
     * Expected Markup
     *
     * <div>
     *   <ul class=""> // a-Chips a-Chips--applied and others added
     *     <li class="" [data-value="..."]>LABEL | <span class="a-Chip-label">...</span>
     *       <span class="a-Chip-text">...</span>
     *     </li>
     *     ...
     *     [<li class="a-Chip a-Chip--applied a-Chip--overflow">
     *       <span class="a-Chip-value">+3</span>
     *     </li>]
     * [<li class="apex-item-multi-item ...">
     * <input type="..." id="P9_PLOV5" name="P9_PLOV5" ???aria-describedby="P9_PLOV5_inline_help"
     * class="..." size="..." maxlength="" value=""/>
     * </li>] // added if not present
     * </ul>
     * [<button [aria-hidden="true"] type="button" class="a-Button a-Button--popupLOV" id="..." tabindex="-1">
     * <span class="a-Icon icon-popup-lov-under"></span>
     * </button>] // added if not preseet
     * </div>
     * xxx where to get the options from DOM, init options, model given in options or none
     *
     * Minimum:
     *   <div><ul><li><input type=""></li></ul></div> (multi valued) or
     *   <div><input type=""></div> (single valued) or
     *   <div>...</div> (single button)?
     *
     * @param {jQuery} element$
     * @param {Object} options
     * @param {string} options.baseId
     * @param {boolean} [options.searchIcon]
     * @param {boolean} [options.clearIcon]
     * @param {boolean|string} [options.expandIcon] Typically only true when multiValued is false.
     *      If true a default icon is used. Can also be the CSS class of the icon to use.
     *      A separator line is used if enterable is true
     * @param {boolean} [options.enterable] If true then combobox semantics, If false then select list semantics
     * @param {boolean} [options.multiValued] If true has applied chips.
     * @param {string} [options.activeChipMessage] Only used if multiValued is true.
     * @param {boolean} [options.useOverflow] If true limit to one line and show overflow chip as needed.
     *   click overflow chip to see all values. Only applies if multiValued.
     *   todo option to edit on activate
     * @param {string} [options.autoComplete] xxx no, starts-with, full
     * @param {boolean} [options.hasIcons] True if the choices have icons. Default false.
     * @param {boolean} [options.hasGroups] True if the choices have groups. Default false. TODO
     * @param {Array|Element|Function} [options.choices] An array of objects with these properties
     *   d display
     *   r return value
     *   i icon
     *   todo label (l)? disabled? group(g)?
     *   If an element then the choices array is created by parsing the markup. The element must be a UL and the
     *   choice items come from the LI children. The display value is the text of the LI. The value comes from the
     *   LI attribute "data-value". xxx group, label?
     *   If a function then the function is called to return an array of choices. The function is passed
     *   a filter string to match and a callback function return the choices. Calls are debounced.
     *   The function is responsible for highlighting the display value if that is desired. Wrap the
     *   highlighted characters in <span class='a-ComboSelect-itemHighlight'>. This means escapeChoices needs to be false.
     * @param {string} [options.choiceTemplate] Template to use for choices.
     *   Requirements:
     *     <li role="option" class='a-ComboSelect-item ...'
     *         data-value='&APEX$ITEM%r!ATTR.'
     *         tabIndex='-1'
     *         {if APEX$ITEM%selected/}aria-selected='true'>
     *         ... &APEX$ITEM%d. ...
     *     </li>
     *   Access any properties of the choice objects with APEX$ITEM%<property-name> Example: &APEX$ITEM%d. for the display text.
     *   The item display text can optionally be wrapped in markup such as
     *       <span class="a-ComboSelect-label">&APEX$ITEM%d.</span></li>`;
     *   but the selector for the label needs to be given in itemLabelSelector.
     * xxx choice list and list item classes
     * @param {string} [options.itemLabelSelector] selector of the item display label. Default ".a-ComboSelect-label".
     * @param {boolean} [options.escapeChoices] Default escape for template processing. Default is true.
     * @param {boolean} [options.popupClasses] Classes to add to the popup.
     * @param {function} [options.onOpen] f( searchChar, callback ). Optional. Provide this function to have custom popup choice
     *   UI such as opening a dialog. When using custom UI for selecting a value the choices, escapeChoices, popupClasses,
     *     choiceTemplate, and autoComplete don't apply.
     *   In this case the dialog or popup must take focus. This is called on mouse down so
     *   focus may be set after; causing focus to be taken away from the dialog or popup. The implementation of onOpen
     *   should set focus or open the dialog or popup after setTimeout. If no selection UI is opened then the function
     *   must return false. If selection UI (a popup or dialog) is opened then the callback must be called once the
     *   selection UI is closed for any reason. If a choice was made pass an object with properties:
     *     r (the return value)
     *     d (the display value).
     *   If no choice was made pass in null.
     * // callbacks
     * @param {function} options.isDisabled f() Return true if the control is disabled xxx needed? use disabled state of input?
     * @param {function} options.removeValue f( value ) Called when a value chip is removed. Only applies when multiValued is true.
     * @param {function} options.addValue f( value, displayValue ) Called when the input or selected value is added. Only applies when multiValued is true.
     *                              The callback can optionally return an object to influence the chip: {value: "", text: "", label: ""}
     * @param {function} options.setValue f( value, displayValue )
     * @param {function} options.activateChip f( value, chip$, cb? ) return true if take focus
     * @param {function} options.findChoice f( value ) return the choice object for the given value. Required when choices is a function.
     * @param {function} options.getChipLabel f( chip$ ) return the accessible label for the chip
     *
     * @returns Object
     * return interface:
     *   addValueChip
     *   removeValueChip
     *   activate
     *   getValue
     *   clearValues?
     *   in-place edit chip
     *   todo need a way to update choices if they change such as from a cascade
     *
     * @ignore
     */
    widgetUtil.initComboSelect = function( element$, options ) {
        let values$, valuesActiveDescription$, valuesDescription$, resultsDescription$, filteredResultsCount,
            input$, popup$, originalPlaceholder, popupId, popupResult,
            externalFiltering = false, // when have choices array we do our own filtering (false) otherwise the options.choices function will do filtering
            choices$ = null,
            popupListContainer$ = null,
            isFiltering = false,
            lastFilter = "",
            currentValue = null, // save the value while filtering
            forwardKey = KEY_RIGHT,
            backwardKey = KEY_LEFT,
            topJQuery = util.getTopApex().jQuery,
            ignoreFocusout = false,
            popupIsOpen = false,
            popupIsClosing = false,
            excludeItemSelector = ".u-hidden";

        /*
         * The PopupLOV item could be in an APEX modal page iframe but needs to open in the top level APEX context
         * so that it is not constrained to the iframe window boundary.
         * The dialog itself will be created and opened in the top APEX context because of using showDialog.
         * However we can't assume that the top context will have all the needed libraries loaded and don't want
         * to store the models there anyway.
         * So the jQuery content of the dialog needs to be created in this context. This happens in the init callback.
         */
        let messageContent = function() {
            return "<div class='a-ComboSelect-popup'></div>";
        };

        function renderChoices( choices ) {
            let template = "{loop APEX$CHOICES/}" + options.choiceTemplate + "{endloop/}";

            return util.applyTemplate( template, {
                extraSubstitutions: { "APEX$CHOICES": choices },
                defaultEscapeFilter: options.escapeChoices ? "HTML" : "RAW"
            } );
        }

        function updateResults( count ) {
            let empty = count === 0;

            resultsDescription$.text( empty ? lang.getMessage( "APEX.CS.NO_MATCHES" ) : lang.formatMessage( "APEX.CS.MATCHES_FOUND", count ) );
            if ( empty ) {
                popup$.popup( "close" );
            }
        }

        function externalFilter( searchValue ) {
            options.choices( searchValue, function( choices ) {
                popupListContainer$.html( renderChoices( choices ) );
                if ( !popupIsOpen && searchValue.length > 0 && choices.length > 0 ) {
                    openDropDown();
                }
                // just in case the call back is made synchronous don't take a chance closing the dialog while it is opening (see bug 33303310)
                setTimeout( () => {
                    updateResults( choices.length );
                }, 0 );
            } );
        }

        // only used when this is in control of the popup and has a choices array
        function filterHighlight( index, searchValue ) {
            // the list markup was generated from options.choices and must be kept in sync with it
            // so use choices array for filtering
            const searchRe = new RegExp( "([<>&;])|(" + util.escapeRegExp( searchValue ) + ")", "ig" );
            let ignore = null,
                choice = options.choices[index],
                match = !( options.multiValued && choice.selected ) && ( !isFiltering || choice.lc.includes( searchValue.toLowerCase() ) );

            // xxx groups. keep a count and count by group after all done hide empty groups and close popup if empty

            if ( match ) {
                filteredResultsCount += 1;
                // highlight
                $( this ).find( options.itemLabelSelector ).html( isFiltering ? choice.d.replace( searchRe, function ( m, p1, p2 ) {
                    // don't highlight inside tags <...> or character entities &...;
                    // see RE object defined above
                    if ( p1 ) {
                        switch ( p1 ) {
                            case "<":
                                ignore = p1;
                                break;
                            case ">":
                                if ( ignore === "<" ) {
                                    ignore = null;
                                }
                                break;
                            case "&":
                                if ( !ignore ) {
                                    ignore = p1;
                                }
                                break;
                            case ";":
                                if ( ignore === "&" ) {
                                    ignore = null;
                                }
                                break;
                        }
                        return p1;
                    } else {
                        if ( ignore || !p2.length ) {
                            return p2;
                        } // else
                        return "<span class='a-ComboSelect-itemHighlight'>" + p2 + "</span>";
                    }
                } ) : choice.d );
            }
            return !match;
        }

        function dropDownClosed( result ) {
            // the popup is closing
            // if a choice was made apply it
            if ( result ) {
                let text = result.d,
                    value = result.r;

                if ( options.multiValued ) {
                    // If multiple values then picking something is to add rather than set.
                    addChoice( value, text );
                } else {
                    // otherwise set the value to the choice that was picked
                    setChoice( value, text );
                }
            }
            if ( popup$ ) {
                popup$.find( ".a-ComboSelect-list" ).children( SEL_IS_FOCUSED ).removeClass( C_IS_FOCUSED );
            }
            input$.prop( "tabIndex", 0 )
                .attr( A_ARIA_EXPANDED, "false" );
            // because this flag is checked in focus handling give things a chance to settle down first
            popupIsClosing = true;
            setTimeout( () => {
                popupIsClosing = false;
                popupIsOpen = false;
            }, 0 );
        }

        function openDropDown( searchChar ) {
            let keepFocus = true;

            popupIsOpen = true;
            if ( options.multiValued ) {
                values$.children( SEL_IS_ACTIVE ).removeClass( C_IS_ACTIVE );
            }
            if ( options.onOpen ) {
                keepFocus = false;
                if ( !options.onOpen( searchChar, dropDownClosed ) ) {
                    popupIsOpen = false;
                    return; // no popup was opened
                }
            } else {
                // first make sure there are choices to show
                // externalFiltering is async so don't know right away if there is anything to show
                // todo externalFiltering should provide away to indicate that there are no results to show when the search term is "" to avoid flash of empty drop down
                if ( !externalFiltering && ( !options.choices || options.choices.length === 0 ) ) {
                    popupIsOpen = false;
                    return; // no popup was opened
                }

                // todo issue for popup is when it displays above and during filtering it gets less tall it is no longer attached to the input.
                // todo maybe don't recreated this each time called?
                let popupOptions = {
                    id: popupId,
                    title: lang.getMessage( "APEX.POPUP.SEARCH" ), // todo acc what is a reasonable title or how to keep the title from being read?
                    isPopup: true,
                    parentElement: element$,
                    returnFocusTo: input$[0], // xxx set explicit return because of potential isPopup AND open from input trap
                    noOverlay: true,
                    width: 200, // something just in case
                    minHeight: 20,
                    maxHeight: 400,
                    okButton: false,
                    dialogClass: "ui-dialog-comboSelect" + ( options.popupClasses ? " " + options.popupClasses : "" ),
                    notification: false, // keeps the role as 'dialog'
                    callback: () => {
                        dropDownClosed( popupResult );
                    },
                    init: function ( popup$ ) {

                        function save( item$ ) {
                            popupResult = {
                                r: item$.attr( A_DATA_VALUE ),
                                d: item$.find( ".a-ComboSelect-label" ).text()
                            };
                            popup$.popup( "close" );
                        }

                        /*
                         * Create the dialog content in this context. Add to dialog later.
                         */
                        let cls = "a-ComboSelect-list";
                        if ( options.multiValued ) {
                            cls += " a-ComboSelect--multi";
                        }

                        popupListContainer$ = $( `<ul class="${cls}" role="listbox"></ul>` );

                        popup$.append( popupListContainer$ );

                        if ( !externalFiltering ) {
                            popupListContainer$.html( choices$ );

                            popupListContainer$.filterable( {
                                enhanced: true,
                                filterCallback: filterHighlight,
                                input: input$, // xxx distinguish value from filter, maybe don't filter if popup not open?
                                children: "li", // xxx todo handle groups
                                beforefilter: () => {
                                    // todo think maybe don't filter if not open but then need to filter once opened
                                    filteredResultsCount = 0;
                                },
                                filter: () => {
                                    updateResults( filteredResultsCount );
                                }
                            } );
                            // xxx also after filtering is where the autocomplete type-ahead is set
                        }

                        popupListContainer$.keydown( function ( event ) {
                            let next$,
                                kc = event.which,
                                item$ = popupListContainer$.children( SEL_IS_FOCUSED );

                            if ( kc === KEY_DOWN ) {
                                next$ = item$.nextAll( ".a-ComboSelect-item" ).not( excludeItemSelector ).first();
                            } else if ( kc === KEY_UP ) {
                                next$ = item$.prevAll( ".a-ComboSelect-item" ).not( excludeItemSelector ).first();
                            } else if ( kc === KEY_ENTER || kc === KEY_TAB ) {
                                if ( item$[0] ) {
                                    save( item$ );
                                }
                                if ( kc === KEY_ENTER ) {
                                    event.preventDefault(); // because focus returns to input keep page from submitting
                                }
                                // tabbing from the popup shouldn't work as desired because the popup is at the end of the the page
                                // but because the dialog is closed on keydown it seems focus is put back in the input field
                                // and the default tab behavior picks up from there.
                            }
                            if ( next$ && next$[0] ) {
                                item$.removeClass( C_IS_FOCUSED );
                                next$.addClass( C_IS_FOCUSED ).focus();
                                event.preventDefault();
                            }
                        } ).click( function ( event ) {
                            let item$ = $( event.target ).closest( ".a-ComboSelect-item" );

                            save( item$ );
                        } );

                        // because the popup just contains a listbox no need to give the dialog role application
                    },
                    open: function ( event ) {
                        var width, height, ww, wh,
                            popup$ = topJQuery( event.target );

                        popupResult = null;

                        if ( externalFiltering ) {
                            if ( lastFilter === "" ) {
                                // if opened with no search string make sure external filtering choices will be rendered
                                externalFilter( "" );
                            }
                        } else {
                            popupListContainer$.filterable( "refresh" );
                        }

                        if ( !options.width ) {
                            width = element$.width(); // dialog min width keeps this from getting too small
                        }
                        // A dialog is responsive at least in UT and that will adjust its size for small screens
                        // but a popup is not so make sure it isn't bigger than the window
                        ww = $( window ).width() - 10;
                        wh = $( window ).height() - 10;
                        if ( (options.width || width) > ww ) {
                            width = ww;
                        }
                        if ( options.height > wh ) {
                            height = wh;
                        }
                        // todo think if too big may just want to center
                        if ( width ) {
                            popup$.popup( "option", "width", width );
                        }
                        if ( height ) {
                            popup$.popup( "option", "height", height );
                        }
                    }
                };

                // todo think the comboSelect input owns the popup; is this a problem if it is in a parent iframe?
                popup$ = apex.message.showDialog( messageContent, popupOptions );
                input$.attr( "aria-owns", popupId );
            }

            input$.attr( A_ARIA_EXPANDED, "true" );
            if ( keepFocus ) {
                // todo want an option for popup to not take initial focus for now take it back
                input$.focus();
            }
        }

        function closeDropDown() {
            if ( popupIsOpen ) {
                popup$.popup( "close" );
            }
        }

        function makeChipActive( chip$ ) {
            let label;

            chip$.addClass( C_IS_ACTIVE );
            if ( options.getChipLabel ) {
                label = options.getChipLabel( chip$ );
            } else {
                label = chip$.find( SEL_CHIP_TEXT ).text();
            }
            valuesActiveDescription$.attr( "aria-live", "assertive" ).text( lang.format( options.activeChipMessage, label ) );
        }

        function moveToFirstChip() {
            closeDropDown();
            makeChipActive( input$.parent().prevAll( SEL_CHIP_APPLIED + "," + SEL_CHIP_OVERFLOW )
                .filter( SEL_VISIBLE ).first() );
        }

        function setChoiceSelection( value, sel = true) {
            if ( choices$ ) {
                choices$.each( function () {
                    let choice$ = $( this );

                    if ( choice$.attr( A_DATA_VALUE ) === value ) {
                        choice$.attr( "aria-selected", sel ? "true" : "false" );
                    }
                } );
            }
        }

        // only for multivalued
        function updateAccessibleValues( ) {
            let values = [];

            values$.children( SEL_CHIP_APPLIED ).each( function() {
                let label, value,
                    chip$ = $(this);

                if ( options.getChipLabel ) {
                    value = options.getChipLabel( chip$ );
                } else {
                    value = chip$.find( SEL_CHIP_TEXT ).text();
                    label = chip$.find( SEL_CHIP_LABEL ).text();
                    if ( label ) {
                        value = label + " " + value;
                    }
                }
                values.push( value );
            } );
            valuesDescription$.text( values.join( ", " ) );
        }

        function findChoice( returnValue ) {
            let choice = null;

            if ( Array.isArray( options.choices ) ) {
                choice = options.choices.find( item => item.r === returnValue );
            } else if ( options.findChoice ) {
                choice = options.findChoice( returnValue );
            }
            return choice;
        }

        // external: for multiValued
        function addValueChip( value, text, label = "" ) {
            let choice,
                chips$ = values$.children( SEL_CHIP_APPLIED );

            // find the value in the list of choices
            choice = findChoice( value );
            // if not enterable there must be a matching choice
            if ( options.enterable || choice) {
                // text is optional if there is a choice take the text from it
                if ( choice && ( !text || !options.enterable ) ) {
                    text = choice.d;
                }

                // Only add if not already added
                if ( chips$.filter( function () { return $( this ).attr( A_DATA_VALUE ) === value; } ).length === 0 ) {
                    let lastChip$ = chips$.last(),
                        chip$ = $( `<li class="${C_CHIP} ${C_CHIP_APPLIED}" data-value="${util.escapeHTMLAttr( value )}">\
${label ? `<span class="a-Chip-label">${util.escapeHTML( label )}</span>` : ""}\
<span class="a-Chip-text"><span class="a-Chip-value">${util.escapeHTML( text )}</span></span>${REMOVE_ICON}</li>` );

                    // mark the choice selected
                    if ( choice ) {
                        choice.selected = true;
                        setChoiceSelection( value );
                    }

                    // add the chip
                    if ( lastChip$[0] ) {
                        lastChip$.after( chip$ );
                    } else {
                        values$.prepend( chip$ );
                    }
                    updateAccessibleValues();
                    checkIfEmpty();
                    return true;
                }
            }
            return false;
        }

        // external: for multiValued
        function removeValueChip( value ) {
            let result = false,
                choice = findChoice( value );

            // unselect choice
            if ( choice ) {
                delete choice.selected;
                setChoiceSelection( value, false );
            }

            values$.children( SEL_CHIP_APPLIED ).each( function() {
                let chip$ = $( this );

                if ( chip$.attr( A_DATA_VALUE ) === value ) {
                    chip$.remove();
                    updateAccessibleValues();
                    checkIfEmpty();
                    result = true;
                    return false;
                }
            } );
            return result;
        }

        // external: for multiValued
        function activate( value ) {
            values$.children( SEL_IS_ACTIVE ).removeClass( C_IS_ACTIVE );
            values$.children( SEL_CHIP_APPLIED ).each( function() {
                let focus = false,
                    chip$ = $( this );

                if ( chip$.attr( A_DATA_VALUE ) === value ) {
                    focus = callActivate( focus, chip$ );
                    if ( focus ) {
                        input$.focus();
                    }
                    return false;
                }
            } );

        }

        // external: for single or multiple values
        function getValue() {
            let value;

            if ( options.multiValued ) {
                value = [];
                values$.children( SEL_CHIP_APPLIED ).each( function() {
                    let li$ = $(this),
                        chip = {
                            value: li$.attr( A_DATA_VALUE ),
                            displayValue: li$.find( SEL_CHIP_TEXT ).text()
                        },
                        label = li$.find( SEL_CHIP_LABEL ).text();

                    if ( label ) {
                        chip.label = label;
                    }
                    value.push( chip );
                } );
            } else {
                let returnValue = input$.attr( A_DATA_VALUE );

                if ( returnValue ) {
                    value = {
                        value: returnValue,
                        displayValue: input$.val()
                    };
                } else {
                    value = null;
                }
            }
            return value;
        }

        // external: for single values
        function setValue( value, displayValue ) {
            let choice = findChoice( value ),
                curSel = findChoice( input$.attr( A_DATA_VALUE ) );

            // remove selected choice
            if ( choices$ ) {
                choices$.filter( "[aria-selected='true']" ).attr( "aria-selected", "false" ); // todo acc maybe remove aria-selected
            }
            if ( curSel ) {
                delete curSel.selected;
            }

            // if not enterable there must be a matching choice
            if ( options.enterable || choice) {
                if ( choice ) {
                    choice.selected = true;
                    displayValue = choice.d; // display value from list overrides
                    setChoiceSelection( value );
                } else if ( !displayValue ) {
                    displayValue = value;
                }

                isFiltering = false;
                input$.attr( A_DATA_VALUE, value )
                    .val( displayValue );
                return true;
            } // else
            return false;
        }

        // internal
        function callActivate( focus, chip$ ) {
            chip$.addClass( C_IS_ACTIVE );
            if ( options.activateChip ) {
                focus = !options.activateChip( chip$.attr( A_DATA_VALUE ), chip$, function( focusAfter, newLabel = null, newValue = null ) {
                    if ( newLabel != null ) {
                        chip$.find( SEL_CHIP_LABEL ).text( newLabel );
                    }
                    if ( newValue != null ) {
                        chip$.find( SEL_CHIP_TEXT ).text( newValue );
                    }
                    checkOverflow();
                    if ( focusAfter ) {
                        input$.focus();
                    }
                } );
                if ( !focus ) {
                    // this means activating the chip took focus and the focusout handler will clear the active class so add it back
                    chip$.addClass( C_IS_ACTIVE );
                }
            }
            return focus;
        }

        // internal
        function clearInput() {
            input$.attr( A_DATA_VALUE, "" )
                .val( "" )
                .parent().addClass( "is-empty" );
        }

        // only for multiValued
        function checkOverflow() {
            if ( options.useOverflow ) {
                let chips$, overflowChip$, lastIndex,
                    availWidth = values$.width(),
                    usedWidth = 0,
                    overflowCount = 0,
                    overflow = false;

                values$.removeClass( "a-Chips--wrap" );

                availWidth -= availWidth / 3; // leave room for input todo consider other ways to reserve space for input
                chips$ = values$.children( SEL_CHIP_APPLIED );
                lastIndex = chips$.length - 1;
                // new chips are added to the right/end so hide them from left/start (least recently added)
                for ( let i = lastIndex; i >= 0; i-- ) {
                    let chip$ = chips$.eq( i );

                    usedWidth += chip$.removeClass( "is-overflow" ).width();
                    if ( usedWidth > availWidth && i < lastIndex ) { // always allow at least one chip
                        overflow = true;
                        overflowCount += 1;
                    }
                    if ( usedWidth > availWidth ) {
                        chip$.addClass( "is-overflow" );
                    }
                }
                overflowChip$ = values$.children( SEL_CHIP_OVERFLOW );
                overflowChip$.toggleClass( "is-overflow", overflow );
                if ( overflow ) {
                    overflowChip$.find( ".a-Chip-value" ).text( "+" + overflowCount );
                }
            }
        }

        // only for multiValued
        function checkIfEmpty() {
            let empty = values$.children( SEL_CHIP_APPLIED ).length === 0;

            if ( originalPlaceholder ) {
                input$.attr( "placeholder", empty ? originalPlaceholder : "" );
            }
            checkOverflow();
        }

        function removeChip( chip$ ) {
            let value = chip$.attr( A_DATA_VALUE );

            options.removeValue( value );
            removeValueChip( value );
        }

        // internal only when enterable
        function addInputText() {
            let choice,
                text = input$.val(),
                textLC = text.toLowerCase(),
                returnValue = text;

            if ( Array.isArray( options.choices ) ) { // xxx when external filtering or custom popup there is no way to default the return value
                // if text is in list of choices get value from choice
                choice = options.choices.find( item => item.lc === textLC );
                if ( choice ) {
                    returnValue = choice.r;
                }
            }

            if ( options.multiValued ) {
                addChoice( returnValue, text );
            } else {
                setChoice( returnValue, text );
            }
        }

        // internal non-multiValued set value from choice list
        function setChoice( returnValue, displayValue ) {
            options.setValue( returnValue, displayValue );
            setValue( returnValue, displayValue );
            lastFilter = ""; // clear last filter so get fresh choices on next open drop down
        }

        // internal multiValued add value from choice list
        function addChoice( returnValue, text ) {
            let details, label;

            // The callback may return chip data: value, text, label to influence the chip details
            details = options.addValue( returnValue, text );
            if ( details ) {
                if ( details.text != null ) {
                    text = details.text;
                }
                if ( details.value != null ) {
                    returnValue = details.value;
                }
                label = details.label || "";
            }

            addValueChip( returnValue, text, label );
            clearInput();
            lastFilter = ""; // input should be empty but just in case clear last filter so get fresh choices on next open drop down
        }

        // only used when externalFiltering is true
        const debounceFilter = util.debounce( function() {
            const minChars = 1;  // todo configure min characters
            let curFilter = input$.val(),
                curLen = curFilter.length,
                lastLen = lastFilter ? lastFilter.length : 0;

            if ( lastFilter !== curFilter && ( curLen >= minChars || curLen < lastLen ) ) {
                lastFilter = curFilter;
                externalFilter( curFilter );
            }
        }, 250 );

        // apply default options
        // because listbox is single select only need aria-selected='true' never false.
        let defaultTemplate = `<li role="option" class="a-ComboSelect-item"\
data-value="&APEX$ITEM%r!ATTR."\
tabIndex="-1" {if APEX$ITEM%selected/}aria-selected="true"{endif/}>\
<span class="a-ComboSelect-label">&APEX$ITEM%d.</span></li>`;

        if ( options.hasIcons && options.hasGroups ) {
            defaultTemplate = `<li role="option" class="{if APEX$ITEM%g/}a-ComboSelect-itemGroup{else/}a-ComboSelect-item{endif/}" \
data-value="&APEX$ITEM%r!ATTR." \
tabIndex="-1" {if APEX$ITEM%selected/}aria-selected="true"{endif/}>\
<span class="a-Icon &APEX$ITEM%i!ATTR." aria-hidden="true"></span> <span class="a-ComboSelect-label">&APEX$ITEM%d.</span></li>`;
        } else if ( options.hasIcons ) {
            defaultTemplate = `<li role="option" class='a-ComboSelect-item' data-value='&APEX$ITEM%r!ATTR.' \
tabIndex='-1' {if APEX$ITEM%selected/}aria-selected="true"{endif/}> \
<span class="a-Icon &APEX$ITEM%i!ATTR." aria-hidden="true"></span> <span class="a-ComboSelect-label">&APEX$ITEM%d.</span></li>`;
        } else if ( options.hasGroups ) {
            defaultTemplate = `<li role="option" class="{if APEX$ITEM%g/}a-ComboSelect-itemGroup{else/}a-ComboSelect-item{endif/}" \
data-value="&APEX$ITEM%r!ATTR." \
tabIndex="-1" {if APEX$ITEM%selected/}aria-selected="true"{endif/}>\
<span class="a-ComboSelect-label">&APEX$ITEM%d.</span></li>`;
        }

        options = $.extend( {
            escapeChoices: true, // default escape mode for choices
            searchIcon: false,
            clearIcon: false,
            expandIcon: false,
            enterable: false,
            multiValued: false,
            activeChipMessage: "%0. Press back space to delete.", // todo i18n not used yet APEX.CS.ACTIVE_VALUE_CHIP
            useOverflow: false,
            hasIcons: false,
            hasGroups: false,
            choiceTemplate: defaultTemplate,
            itemLabelSelector: ".a-ComboSelect-label",
            isDisabled: () => { return true; }
        }, options );

        popupId = "CS_" + $("#pFlowStepId").val() + "_" + options.baseId;
        // xxx maybe the popup widget should not get reused. perhaps one popup for all is good enough.
        popup$ = topJQuery( "#" + util.escapeCSS( popupId ) ); // the popup is in the top context.
        popup$.parent().remove();

        if ( options.multiValued ) {
            excludeItemSelector += ",[aria-selected='true']";
        } else {
            // if not multiValued useOverflow doesn't apply so force false
            options.useOverflow = false;
        }

        //
        // Upgrade the simple element markup
        //
        element$.addClass( "apex-item-comboselect" ); // todo consider require this class be present?
        if ( !options.onOpen ) {
            // unless there is a custom popup add a place for accessible messages about results
            element$.append( `<div class="u-vh js-results-description" aria-live="polite"></div>` );
            resultsDescription$ = element$.children().last();
        }
        input$ = element$.find( "input" );

        input$.attr( {
            role: "combobox", // xxx maybe not applicable for input-search?
            "aria-expanded": "false",
            autocomplete: "off",
            autocorrect: "off", // not a standard but seems to be a thing
            autocapitalize: "none",
            spellcheck: "false",
            "aria-autocomplete": "list"
            // xxx aria-busy? if we know getting choices async
        } );
        if ( options.searchIcon ) {
            // Add search icon at the start
            element$.prepend( `<span class="a-Icon icon-search" tabindex="-1" aria-hidden="true"></span>` );
        }
        // todo add back icon button for mobile
        if ( options.expandIcon ) {
            let iconName = options.expandIcon;

            // Add drop/open/expand icon at the end
            if ( iconName === true ) {
                iconName = "icon-popup-lov-under";  // todo better icon name?
            }
            if ( options.enterable ) {
                element$.append( '<span class="a-Chip-divider" role="separator" aria-orientation="vertical"></span>' ); // todo better divider class name
            }
            // todo better button class
            element$.append( `<button class="a-Button a-Button--popupLOV js-expand" type="button" tabindex="-1" aria-hidden="true">\
<span class="a-Icon ${iconName}"></span></button>` );
        }

        // configure choices
        if ( typeof options.choices === "function" ) {
            externalFiltering = true;
        } else if ( options.choices != null && !Array.isArray( options.choices ) ) {
            // if not an array or function must be an element with the choices as children. Extract the choices from the markup
            let choices$ = $( options.choices ).children(),
                choices = [];

            choices$.each( function() {
                let choice$ = $( this ),
                    value = choice$.attr( A_DATA_VALUE ),
                    selected = choice$.attr( "data-selected" ),
                    display = choice$.text(),
                    c = {
                        r: value,
                        d: display
                    };

                if ( selected && selected.toLowerCase() === "true" ) {
                    c.selected = true;
                }
                choices.push( c );
            } );
            choices$.parent().remove();
            options.choices = choices;
        }
        if ( Array.isArray( options.choices ) ) {
            // add a lower case clean version of the display for use in case independent filtering
            options.choices.forEach( c => {
                c.lc = util.stripHTML( c.d.toLowerCase() );
            } );
            // choices$ created just once from renderChoices aria selected state managed from setValue, setChoiceSelection (add/remove chips) set as popup content just once when popup created
            // xxx when choices is a function this fails > maybe choices$ is null when choices is a function (external filtering)
            choices$ = $( renderChoices( options.choices ) );
            // xxx at this point the selection property of choices should match the initial value. verify?
        }

        if ( options.multiValued ) {
            let foundInput = false,
                lastChip$ = null;

            input$.val( "" ); // for multiValued input must start out empty
            values$ = element$.find( "ul" ).first();
            if ( !values$[0] ) {
                values$ = $("<ul>");
                element$.prepend( values$ );
            }
            values$.addClass( "a-Chips a-Chips--applied" + ( !options.useOverflow ? " a-Chips--wrap" : "" ) )
                .attr( "role", "presentation" ) // avoid AT reading list because the values of the combobox are presented via described by
                .children().each( function( i ) {
                let label,
                    li$ = $(this);

                if ( li$.has( "input" )[0] ) {
                    foundInput = true;
                    li$.addClass( C_CHIP + " a-Chip--input is-empty" );
                } else {
                    // if the chip has any spans then it must be either or both of
                    // <span class="a-Chip-label">...</span><span class="a-Chip-text"><span class="a-Chip-value">...</span></span>
                    if ( !li$.has( "span" )[0] ) {
                        // otherwise it is just text to turn into a display text
                        label = li$.text();
                        li$.html( `<span class="a-Chip-text"><span class="a-Chip-value">${util.escapeHTML( label )}</span></span>` );
                    }
                    li$.append( REMOVE_ICON )
                        .addClass( C_CHIP + " " + C_CHIP_APPLIED );

                    if ( !li$.attr( A_DATA_VALUE ) ) {
                        li$.attr( A_DATA_VALUE, "" + ( i + 1 ) );
                    }
                    lastChip$ = li$;
                }

            } );

            if ( options.useOverflow ) {
                let overflow$ = $( `<li class="${C_CHIP} ${C_CHIP_OVERFLOW}"><span class="a-Chip-text"><span class="a-Chip-value"></span></span></li>` );
                if ( lastChip$ ) {
                    lastChip$.after( overflow$ );
                } else {
                    // make sure overflow chip comes before input "chip"
                    values$.prepend( overflow$ );
                }
            }
            if ( !foundInput ) {
                // input not found in the chips container so add a chip and move the input to it
                values$.append( `<li class="${C_CHIP} a-Chip--input is-empty"></li>` );
                values$.find( ".a-Chip--input" ).append( input$ );
            }
            values$.after( `<div class="u-vh js-active-description"></div><div id="${options.baseId}_desc" class="u-vh"></div>` );
            valuesActiveDescription$ = values$.next();
            valuesDescription$ = valuesActiveDescription$.next();
            input$.attr( "aria-describedby", options.baseId + "_desc" );
            updateAccessibleValues();
        }
        if ( options.clearIcon ) {
            // tabindex -1 not a tab stop but need to take focus during a click; it won't keep focus long; it goes back to the input
            input$.after( `<span class="a-Chip-clear js-clearInput" tabindex="-1"><span class="a-Icon icon-multi-remove"></span></span>` );
        }

        //
        // End of upgrade
        //

        // The interface to return
        let comboSelectInterface = {
            options: options,
            getValue: getValue
        };

        if ( options.multiValued ) {
            comboSelectInterface.addValueChip = addValueChip;
            comboSelectInterface.removeValueChip = removeValueChip;
            comboSelectInterface.activate = activate;
            comboSelectInterface.updatedValueChip = function() {
                updateAccessibleValues();
            };
            comboSelectInterface.editValue = function( value, displayValue = value ) {
                // todo edit the value in place of the chip
                removeValueChip( value );
                input$.val( displayValue )[0].select();
            };

            // todo acc should the focus move to the other items
            originalPlaceholder = input$.attr( "placeholder" );
            if ( values$.css( "direction" ) === "rtl" ) {
                forwardKey = KEY_LEFT;
                backwardKey = KEY_RIGHT;
            }
            checkIfEmpty();
            /* todo determine if this resize logic is needed
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
                        }; */
            /* xxx try without this
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
            */
//xxx            fixMultipleWidth();

        } else {
            // single value
            comboSelectInterface.setValue = setValue;
        }

        //
        // Add handlers
        //
        /* xxx This is causing some issues where in some cases after click overflow chip it snaps back to no overflow after the 300ms delay.
        const resizeDelay = util.debounce( checkOverflow, 300 );

        widgetUtil.onElementResize( element$, () => {
            resizeDelay();
        } );
        */

        element$.click( function( event ) {
            let focus = true,
                target$ = $( event.target ),
                removeButton$ = target$.closest( ".js-removeChip" ),
                clearButton$ = target$.closest( ".js-clearInput" ),
                overflowChip$ = target$.closest( SEL_CHIP_OVERFLOW ),
                chip$ = target$.closest( SEL_CHIP_APPLIED );

            if ( options.isDisabled() ) {
                return;
            }
            if ( overflowChip$[0] ) {
                values$.addClass( "a-Chips--wrap" );
            } else if ( removeButton$[0] ) {
                removeChip( chip$ );
            } else if ( clearButton$[0] ) {
                clearInput();
            } else if ( chip$[0] ) {
                values$.children( SEL_IS_ACTIVE ).removeClass( C_IS_ACTIVE );
                focus = callActivate( true, chip$ );
            }
            if ( focus ) {
                setTimeout( () => {
                    input$.focus();
                }, 0 );
            }
        } ).mousedown( function( event ) {
            let target$ = $( event.target ),
                clearButton$ = target$.closest( ".js-clearInput" ),
                chip$ = target$.closest( SEL_CHIP_APPLIED + "," + SEL_CHIP_OVERFLOW );

            if ( clearButton$[0] ) {
                ignoreFocusout = true;
            }
            // for primary mouse down only (Ignore the context menu mouse down)
            event = event.originalEvent || event;
            if ( ( event.buttons || 1 ) & 1 && !popupIsOpen && !chip$[0] && !clearButton$[0] ) { // eslint-disable-line no-bitwise
                openDropDown();
            }
        } ).focusout( function() {
            if ( values$ ) {
                values$
                    .removeClass( "is-focused" )
                    .children( SEL_IS_ACTIVE ).removeClass( C_IS_ACTIVE );
            }
            // if enterable and a value is entered add it but not if loose focus because of opening popup
            if ( options.enterable ) {
                if( input$.val() && ( !popupIsOpen || popupIsClosing ) && !ignoreFocusout ) {
                    addInputText();
                }
            } else {
                if ( isFiltering ) {
                    // restore the value
                    setValue( currentValue.value, currentValue.displayValue );
                    currentValue = null;
                }
            }
            isFiltering = false;
            ignoreFocusout = false;
        } );

        input$.focus( function() {
            if ( values$ ) {
                values$.addClass( "is-focused" );
            }
            if ( !options.enterable && !currentValue ) {
                currentValue = getValue();
            }
        } ).keydown( function( event ) {
            let inputTrap$,
                kc = event.which,
                printable = false;

            if ( options.multiValued && input$.val() === "" ) {
                let handled = false,
                    curChip$ = values$.children( SEL_IS_ACTIVE );

                if ( kc === KEY_DELETE || kc === KEY_BACKSPACE ) {
                    if ( event.target === input$[0] && kc === KEY_BACKSPACE && !curChip$[0] ) {
                        // if focus is in the input and no other item is active
                        // then backspace should act like backwardKey
                        moveToFirstChip();
                    }
                    if ( curChip$[0] ) {
                        removeChip( curChip$ );
                    }
                    handled = true;
                } else if ( kc === backwardKey ) {
                    if ( curChip$[0] ) {
                        let prev$ = curChip$.prevAll().filter( SEL_VISIBLE );
                        if ( prev$[0] ) {
                            curChip$.removeClass( C_IS_ACTIVE );
                            makeChipActive( prev$.first() );
                        }
                    } else {
                        moveToFirstChip();
                    }
                    handled = true;
                } else if ( kc === forwardKey ) {
                    if ( curChip$[0] ) {
                        let next$ = curChip$.nextAll().filter( SEL_VISIBLE );
                        if ( next$[0] ) {
                            curChip$.removeClass( C_IS_ACTIVE );
                            curChip$ = next$.first();
                            if ( !curChip$.hasClass( "a-Chip--input" ) ) {
                                makeChipActive( curChip$ );
                            } else {
                                valuesActiveDescription$.attr( "aria-live", "off" ).text( "" );
                            }
                        }
                    }
                    handled = true;
                } else if ( kc === KEY_ENTER || kc === KEY_SPACE ) {
                    if ( curChip$[0] ) {
                        if ( curChip$.hasClass( C_CHIP_OVERFLOW ) ) {
                            values$.addClass( "a-Chips--wrap" );
                        } else if ( kc === KEY_ENTER ) {
                            // space does the same thing but must be handled on keyup
                            callActivate( true, curChip$ );
                        }
                        handled = true;
                    }
                }
                if ( handled ) {
                    event.preventDefault();
                    return;
                }
            }

            if ( kc === KEY_DOWN || kc === KEY_UP ) {
                if ( !popupIsOpen ) {
                    openDropDown();
                } else if ( !options.onOpen ) {
                    let item$;

                    // move focus into popup
                    if ( !options.multiValued ) {
                        // first try for the selected item
                        item$ = popup$.find( ".a-ComboSelect-item[aria-selected='true']" ).first();
                    }
                    if ( !item$ || !item$[0] ) {
                        item$ = popup$.find( ".a-ComboSelect-item" ).not( excludeItemSelector ).first();
                    }
                    item$.addClass( C_IS_FOCUSED ).focus();
                    input$.prop( "tabIndex", -1 );
                    event.preventDefault();
                }
            } else if ( kc === KEY_ENTER ) {
                if ( options.enterable && input$.val() ) {
                    // if enterable and a value is entered add it.
                    addInputText();
                    closeDropDown();
                    event.stopPropagation(); // this keeps higher level controls like grid from acting on the enter key
                }
                // prevent the browser default to submit the page when this is the only text item on the page
                event.preventDefault();
            } else if ( kc === KEY_ESCAPE ) {
                if ( popupIsOpen ) {
                    event.preventDefault();
                }
                closeDropDown();
            } else if ( kc === KEY_TAB ) {
                if ( options.enterable && input$.val() ) {
                    // if enterable and a value is entered add it.
                    addInputText();
                }
                closeDropDown();
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
                    isFiltering = true;
                    // If just called open, by changing focus during key processing the event would result in the
                    // character being typed into the popup search field (which is what we want)
                    // except when crossing browsing contexts (iframes). Also don't want this to add to the filter but replace it.
                    // So instead use a hidden input to trap the typed character.
/*                    inputTrap$ = $( "#" + INPUT_TRAP_ID ); // all popupLov's can share this
                    if ( !inputTrap$[0] ) {
                        inputTrap$ = $( "<input id='" + INPUT_TRAP_ID + "' type='text' class='u-vh' aria-hidden='true' tabindex='-1'>" );
                    }
                    inputTrap$.insertAfter( input$ ).focus(); // move it around (insertAfter) so no scroll due to focus change

 */
                    setTimeout( function() {
                        var ch = 'x'; // inputTrap$.val(); todo input trap stuff for popuplov
//                        inputTrap$.val("");
                        if ( ch.length > 0 ) { // check that a character was really typed
                            openDropDown( ch );
                        } else if ( document.activeElement === inputTrap$[0] ) {
                            // if focus didn't change return it to the input
                            input$.focus();
                        }
                    }, 10 );
                } // Otherwise the typing keys could be used to enter a value
            }

        } ).keyup( function( event ) {
            let kc = event.which;

            if ( options.multiValued && kc === KEY_SPACE ) {
                let curChip$ = values$.children( SEL_IS_ACTIVE );

                if ( curChip$[0] && !curChip$.hasClass( C_CHIP_OVERFLOW ) ) {
                    callActivate( true, curChip$ );
                }
            }
            if ( externalFiltering ) {
                debounceFilter();
            }
        } ).on( "input", function() {
            let empty = input$[0].value === "";

            if ( !empty && options.multiValued ) {
                values$.children( SEL_IS_ACTIVE ).removeClass( C_IS_ACTIVE );
            }
            input$.parent().toggleClass( "is-empty", empty );
            if ( externalFiltering ) {
                debounceFilter();
            }
        } );

        return comboSelectInterface;
    };

    const WIDGET_IGNORE_METHODS = ["constructor", "widget", "option"],
        WIDGET_IGNORE_OPTIONS = ["create"];

    /**
     * Internal use
     * Adds to object instance all the public methods and options of the given widget.
     *
     * @ignore
     * @param {object} instance An object such as a region interface to have the methods and properties added to.
     * @param {jQuery} el$ The widget element jQuery object
     * @param {string} widgetName The name of the widget
     * @param {array} excludeMethods An array of method names that are not to be copied
     * @param {array} excludeOptions An array of option names that are not to be copied
     * @returns {*}
     */
    widgetUtil.makeInterfaceFromWidget = function( instance, el$, widgetName, excludeMethods = [], excludeOptions = [] ) {
        let widgetInst = el$[widgetName]("instance"),
            options = widgetInst.options;

        function get(prop) {
            return widgetInst.option( prop );
        }

        function set(prop, value) {
            widgetInst.option( prop, value );
        }

        for ( let p in widgetInst ) { // eslint-disable-line guard-for-in
            if ( typeof widgetInst[p] === "function" && p[0] !== "_" &&
                !excludeMethods.includes( p ) && !WIDGET_IGNORE_METHODS.includes( p ) ) {

                // focus and refresh are common methods to allow being overwritten
                if ( p !== "refresh" && p !== "focus" && instance[p] !== undefined ) {
                    throw new Error( `Can't overwrite method '${p}'` );
                }
                instance[p] = widgetInst[p].bind(widgetInst);
            }
        }
        for ( let p in options ) { // eslint-disable-line guard-for-in
            if ( !excludeOptions.includes( p ) && !WIDGET_IGNORE_OPTIONS.includes( p ) ) {
                if ( instance[p] !== undefined ) {
                    throw new Error( `Can't overwrite property '${p}'` );
                }
                Object.defineProperty( instance, p, {
                    enumerable: true,
                    get: () => { return get( p ); },
                    set: value => { set( p , value ); }
                });
            }
        }

        instance.widget = function() {
            return el$;
        };

        return instance;
    };

    /**
     * Function that implements cascading LOV functionality for an item type plug-in. This function is a wrapper of the
     * apex.server.plugin function but provides additional features.
     *
     * @param {string | jQuery | DOM} pList Identifies the page item of the item type plug-in.
     * @param {String} pAjaxIdentifier        Use the value returned by the PL/SQL package apex_plugin.get_ajax_identifier to identify your item type plug-in.
     * @param {Object} [pData]                Object which can optionally be used to set additional values which are send with the
     *                                        AJAX request. For example pData can be used to set the scalar parameters x01 - x10 and the
     *                                        arrays f01 - f20
     * @param {Object} [pOptions]             Object which can optionally be used to set additional options for the AJAX call. See apex.server.plugin
     *                                        for standard attributes. In addition pOptions supports the attributes:
     *                                          - "optimizeRefresh" Boolean to specify if the AJAX call should not be performed if one off the page items
     *                                                              specified in dependingOn is empty.
     *                                          - "dependingOn"     jQuery selector, jQuery- or DOM object which identifies the DOM element
     *                                                              of which the current page item is depending on.
     * @return {jqXHR}
     *
     * @example
     *
     * apex.widget.util.cascadingLov ( pItem, pAjaxIdentifier, {
     *     x01: "test"
     *     }, {
     *     optimizeRefresh:   true,
     *     dependingOn:       "#P1_DEPTNO",
     *     pageItemsToSubmit: "#P1_LOCATION",
     *     clear:   function() { ... do something here ... },
     *     success: function( pData ) { ... do something here ... }
     *     } );
     *
     * @memberOf apex.widget.util
     **/
    widgetUtil.cascadingLov = function( pList, pAjaxIdentifier, pData, pOptions ) {
        var lList$     = $( pList, apex.gPageContext$ ),
            lQueueName = lList$[0] ? lList$[0].id : "lov",
            lOptions   = extend( {
                optimizeRefresh: true,
                queue: { name: lQueueName, action: "replace" }
            }, pOptions ),
            lNullFound = false;

        // Always fire the before and after refresh event and show a load indicator next to the list
        if ( !lOptions.refreshObject ) {
            lOptions.refreshObject    = lList$;
        }
        if ( !lOptions.loadingIndicator ) {
            lOptions.loadingIndicator = lList$;
        }

        // We only have to refresh if all our depending values are not null
        if ( lOptions.optimizeRefresh ) {
            $( lOptions.dependingOn, apex.gPageContext$ ).each( function() {
                if ( apex.item( this ).isEmpty() ) {
                    lNullFound = true;
                    return false; // stop execution of the loop
                }
            });

            // All depending values are NULL, let's take a shortcut and not perform the AJAX call
            // because the result will always be an empty list
            if ( lNullFound ) {
                // trigger the before refresh event if defined
                lOptions.refreshObject.trigger( 'apexbeforerefresh' );

                // Call clear callback if the attribute has been specified and if it's a function
                if ( $.isFunction( lOptions.clear ) ) {
                    lOptions.clear();
                }

                // Trigger the change event for the list because the current value might have changed.
                // The change event is also needed by cascading LOVs so that they are refreshed with the
                // current selected value as well (bug# 9907473)
                // If the select list actually reads data, the change event is fired in the _addResult as soon as
                // a new value has been set (in case the LOV doesn't contain a null display entry)
                lList$.change();

                // trigger the after refresh event if defined
                lOptions.refreshObject.trigger( 'apexafterrefresh' );
                return; // we are done, exit cascadingLov
            }
        }

        // Include dependingOn page items into the pageItems list
        pData.pageItems = $( pData.pageItems, apex.gPageContext$ ).add( lOptions.dependingOn );
        return apex.server.plugin( pAjaxIdentifier, pData, lOptions );
    }; // cascadingLov

    /*
     * Internal use
     * Creates and opens the dialog or popup associated with a Popup LOV item.
     * Side effect is setting the model name on the item under key "popupLovModelName" and search state
     * info under key "popupSearchState".
     *
     * todo issues:
     *     control break/groups for tmv, disabled items,
     *     for groups icon view needs to support column breaks and have option for breaks to not be collapsible
     *     frozen column issue where non-frozen table shifts to a new row.
     *     In grid view may want home/end to go to first/last row not column in row.
     *     Icon view uses home/end to go to first/last row but doesn't support page up/down.
     *     How can user choose between scroll and load more paging?
     *
     * boolean forceRefresh if true the search results should be refreshed (or cleared if initialFetch option is "none")
     * string searchText if not null use this as the initial value of the search field
     * boolean typeAhead if true the searchText (likely just a single character) is from the user starting to type in the combobox field
     * object options:
     *  string itemId
     *  string title
     *  boolean isPopup
     *  boolean enterable
     *  number width
     *  number height
     *  object extraOut
     *  boolean persistState
     *  string initialSearch only applies when dialog is first created/initialized
     *  boolean incrementalSearch
     *  number minSearchChars
     *  boolean multiple
     *  string displayColumn
     *  string valueColumn
     *  string iconColumn
     *  boolean hasDisplayValue
     *  string display list|grid
     *  object columns If there is a meta column it must be called "_meta". Extra property bool canSearch controls highlighting
     *  object defaultGridOptions
     *  object defaultIconListOptions
     *  string ajaxIdentifier
     *  Array of strings itemsToSubmit
     *  Element pluginTarget
     */
    widgetUtil.openPopupLov = function( forceRefresh, searchText, typeAhead, options, callback ) {
        var model, view$, viewInstance, dialog$, dialogOptions,
            searchBar$, searchInput$, clearButton$, messageContent, sessionStore,
            topJQuery = util.getTopApex().jQuery,
            persistentState = null,
            isPopup = options.isPopup || false,
            noData = lang.getMessage( "APEX.POPUP_LOV.NO_RESULTS" ),
            filterRequiredNoData = null,
            incrementalSearch = options.incrementalSearch,
            initialSearch = options.initialSearch || "",
            item$ = $( "#" + util.escapeCSS( options.itemId ) ),
            baseId = "PopupLov_" + $("#pFlowStepId").val() + "_" + options.itemId, // including page to help keep it unique on top level apex page
            dialogId = baseId + "_dlg",
            result = null;

        function resize() {
            // Don't need to calculate height because dialog uses flex layout
            // but do need to let grid or tmv know about the new size.
            viewInstance.resize();
        }

        function refresh( searchControl, search, sortCol, sortDir ) {
            var searchRe,
                change = false,
                noFetch = false,
                fetchData = model.getOption( "fetchData" );

            if ( searchControl.forceRefresh ) {
                change = true;
                if ( options.initialFetch === "none" && !(searchControl.typeAhead && incrementalSearch) ) {
                    noFetch = true;
                }
                fetchData.search = null;
                searchControl.forceRefresh = false; // reset this so that subsequent fetches work
            }

            if ( search !== null && search !== fetchData.search ) {
                fetchData.search = search;
                change = true;
            }
            if ( sortCol && sortDir && ( sortCol !== fetchData.sortColumn || sortDir !== fetchData.sortDirection ) ) {
                fetchData.sortColumn = sortCol;
                fetchData.sortDirection = sortDir;
                change = true;
            }
            if ( change ) {
                // todo consider in future server could have search options for doing some other kind of search such as case insensitive or exact or regular expression
                // This assumes that the backend is using LIKE with no escape character. Turn this into a RE.
                // '_' -> '.' '%' -> '.*'
                // Rather than any character (.) exclude markup characters because they cause confusion with markup in highlightSearchTerm
                searchRe = util.escapeRegExp( fetchData.search ).replace(/[_%]/g, function(m) {
                    return "[^<>&]" + ( m === "%" ? "*" : "" );
                } );
                viewInstance.options.highlighterContext = {
                    term: fetchData.search,
                    re: new RegExp( "([<>&;])|(" + searchRe + ")", "ig" )
                };
                if ( filterRequiredNoData ) {
                    if ( search.length >= options.minSearchChars && !( noFetch || searchControl.typeAhead ) ) {
                        viewInstance._setOption( "noDataMessage", noData );
                        model.clearData();
                    } else {
                        viewInstance._setOption( "noDataMessage", filterRequiredNoData );
                        model.setData( [] );
                        fetchData.search = null; // forget the search so in the case of no initial search can force to search on nothing
                    }
                } else {
                    if ( searchControl.typeAhead && !incrementalSearch ) {
                        model.setData( [] );
                        fetchData.search = null; // forget the search char so can search on it if desired
                    } else {
                        model.clearData();
                    }
                }
                searchControl.typeAhead = false;
            }
        }

        function saveState() {
            sessionStore.setItem( "state", JSON.stringify( persistentState ) );
        }

        function loadState() {
            var obj;

            sessionStore = apex.storage.getScopedSessionStorage( {
                prefix: baseId,
                usePageId: true,
                useAppId: true
            } );

            persistentState = {};
            if ( options.display === "grid" ) {
                persistentState.columnWidths = {};
            }
            obj = sessionStore.getItem( "state" );
            if ( obj ) {
                try {
                    obj = JSON.parse( obj );
                    // Must validate data from session storage. All are optional.
                    // dialog size
                    if ( !isPopup ) {
                        persistentState.width = parseInt( obj.width, 10 ) || options.width;
                        persistentState.height = parseInt( obj.height, 10 ) || options.height;
                    }
                    // sort info
                    if ( obj.sortDirection && /^(asc|desc)$/.test( obj.sortDirection ) ) {
                        persistentState.sortDirection = obj.sortDirection;
                    }
                    if ( options.columns[obj.sortColumn] ) {
                        persistentState.sortColumn = obj.sortColumn;
                    }
                    // column widths
                    $.each( obj.columnWidths, function( prop, w ) {
                        w = parseInt( w, 10 );
                        if ( w ) {
                            persistentState.columnWidths[prop] = w;
                        }
                    } );
                } catch ( ex ) {
                    // Ignore any exception. If someone has messed with the state object no worries the next saveState will set things right
                }
            }
        }

        if ( options.persistState ) {
            loadState();
        }

        /*
         * The PopupLOV item could be in an APEX modal page iframe but needs to open in the top level APEX context
         * so that it is not constrained to the iframe window boundary.
         * The dialog itself will be created and opened in the top APEX context because of using showDialog.
         * However we can't assume that the top context will have all the needed libraries loaded and don't want
         * to store the models there anyway.
         * So the jQuery content of the dialog needs to be created in this context. This happens in the init callback.
         */
        messageContent = function() {
            return "<div class='a-PopupLOV-dialog'></div>";
        };

        // Set some values on the input for use by init and open
        item$.data( "popupSearchState", {
            forceRefresh: forceRefresh,
            typeAhead: typeAhead,
            searchText: searchText
        } );

        dialog$ = topJQuery( "#" + util.escapeCSS( dialogId ) ); // the dialog is in the top context.
        if ( !dialog$[0] && persistentState ) {
            // load options from persistent state for dialog creation
            options.width = persistentState.width || options.width;
            options.height = persistentState.height || options.height;
            if ( persistentState.sortColumn && persistentState.sortDirection ) {
                $.each( options.columns, function( prop, def ) {
                    if ( prop === persistentState.sortColumn && def.canSort ) {
                        def.sortIndex = 1; // assume there can be just one sort column
                        def.sortDirection = persistentState.sortDirection;
                    } else {
                        delete def.sortIndex;
                        delete def.sortDirection;
                    }
                } );
            }
            for ( const [prop, w] of objectEntries( persistentState.columnWidths ) ) {
                if ( options.columns[prop] ) {
                    options.columns[prop].width = w;
                }
            }
        }

        dialogOptions = {
            id: dialogId,
            title: options.title || lang.getMessage( "APEX.POPUP_LOV.TITLE" ), // "Search" see bug 31972864,
            isPopup: isPopup,
            parentElement: isPopup ? item$.closest( ".apex-item-group--popup-lov" ) : null,
            returnFocusTo: item$[0], // set explicit return because of potential isPopup AND open from input trap
            noOverlay: true, // only applies if isPopup
            draggable: true,
            resizable: true,
            width: 200, // something just in case
            height: options.height,
            okButton: false,
            dialogClass: "ui-dialog-popuplov",
            notification: false,    // keeps the role as 'dialog'
            callback: function() {
                var map, value, display,
                    setAddMethod = "setValue",
                    theItem = apex.item( options.itemId );

                if ( options.multiple ) {
                    // If multiple values then picking something is to add rather than set.
                    setAddMethod = "addValue";
                }
                if ( result ) {
                    if ( typeof result === "object" && hasOwnProperty( result, "d" ) && hasOwnProperty( result, "v" ) ) {
                        theItem[setAddMethod]( result.v, result.d );
                    } else if ( typeof result === "object" && hasOwnProperty( result, "v" ) ) {
                        theItem[setAddMethod]( result.v );
                    } else {
                        theItem[setAddMethod]( result );
                    }
                    if ( !options.multiple ) {
                        // with multiple values extra outputs makes no sense.
                        map = options.extraOut;
                        if ( map ) {
                            // store additional outputs
                            for ( const [p, entry] of objectEntries( map ) ) {
                                value = result[p];
                                display = null;
                                if ( value !== null && typeof value === "object" && hasOwnProperty( value, "d" ) ) {
                                    value = value.v;
                                    display = value.d;
                                }
                                $s( entry.item, value, display );
                            }
                        }
                    }
                }
                viewInstance.setSelectedRecords( [], false ); // clear the selection when leaving the dialog
                if ( callback ) {
                    callback( result );
                }
            },
            init: function( dialog$ ) {
                var gridOptions, listOptions, grid$, template, displayCol, debounceSearch, content$,
                    searchButton$,
                    sortColumn = null,
                    sortDirection = null,
                    modelName = baseId + "_m",
                    widget = dialog$.is( ":data(apexPopup)" ) ? "popup" : "dialog",
                    searchLabel = lang.getMessage( "APEX.POPUP.SEARCH" ),
                    searchControl = {
                        forceRefresh: forceRefresh,
                        typeAhead: typeAhead,
                        searchText: initialSearch || searchText
                    },
                    out = util.htmlBuilder();

                function makeSubstitution( name ) {
                    if ( name.match(/^[A-Z0-9_$#]+$/) ) {
                        return "&" + name + ".";
                    } // else
                    return '&"' + name + '".';
                }

                function save() {
                    var rec = viewInstance.getSelectedRecords()[0];

                    if ( rec ) {
                        result = {
                            v: model.getValue( rec, options.valueColumn )
                        };
                        if ( options.hasDisplayValue && options.displayColumn ) {
                            result.d = model.getValue( rec, options.displayColumn );
                        }
                        if ( options.extraOut ) {
                            Object.keys( options.extraOut ).forEach( function( p ) {
                                result[p] = model.getValue( rec, p );
                            } );
                        }

                        dialog$[widget]( "close" );
                    }
                }

                function saveNullValue() {
                    result = {
                        v: options.nullValue,
                        d: options.nullDisplayValue
                    };
                    // Assume best thing to do with extra outputs is clear them when the Popup LOV is set to the null value.
                    if ( options.extraOut ) {
                        Object.keys( options.extraOut ).forEach( function( p ) {
                            result[p] = "";
                        } );
                    }
                    dialog$[widget]( "close" );
                }

                function highlightSearchTerm( context, value, col ) {
                    var ignore = null;

                    if ( !context.term || ( col && col.canSearch === false ) ) {
                        // if no search term or column doesn't support searching then nothing to highlight
                        return value;
                    } // else
                    return value.replace( context.re, function( m, p1, p2 ) {
                        // don't highlight inside tags <...> or character entities &...;
                        // see context object defined above
                        if ( p1 ) {
                            switch ( p1 ) {
                                case "<":
                                    ignore = p1;
                                    break;
                                case ">":
                                    if ( ignore === "<" ) {
                                        ignore = null;
                                    }
                                    break;
                                case "&":
                                    if ( !ignore ) {
                                        ignore = p1;
                                    }
                                    break;
                                case ";":
                                    if ( ignore === "&" ) {
                                        ignore = null;
                                    }
                                    break;
                            }
                            return p1;
                        } else {
                            if ( ignore || !p2.length ) {
                                return p2;
                            } // else
                            return "<span class='popup-lov-highlight'>" + p2 + "</span>";
                        }
                    } );
                }

                // for use by open
                item$.data( "popupSearchState", searchControl );

                out.markup( "<div><div" )
                    .attr( "class", "a-PopupLOV-searchBar" + ( incrementalSearch ? " a-PopupLOV--incremental" : "" ) )
                    .markup( "><input type='text' aria-label='" + searchLabel + "' maxlength='100' class='a-PopupLOV-search apex-item-text'" )
                    .attr( "value", initialSearch )
                    .markup( ">" );
                // with incremental search there is no need for a button
                if ( !incrementalSearch ) {
                    out.markup( "<button type='button' class='a-Button a-PopupLOV-doSearch' aria-label='" + searchLabel + "'>" );
                }
                out.markup( "<span class='a-Icon icon-search' aria-hidden='true'></span>" );
                if ( !incrementalSearch ) {
                    out.markup( "</button>" );
                }
                out.markup( "</div>" );
                if ( options.nullDisplayValue ) {
                    out.markup( "<div class='a-PopupLOV-clear'><button class='a-PopupLOV-clearButton' type='button'>" )
                        .content( options.nullDisplayValue )
                        .markup( "</button></div>" );
                }
                out.markup( "<div class='a-PopupLOV-results'></div></div></div>" );
                /*
                 * Create the dialog content in this context. Add to dialog later.
                 */
                content$ = $( out.toString() );

                view$ = content$.find( ".a-PopupLOV-results" );

                searchBar$ = content$.find( ".a-PopupLOV-searchBar" );
                searchInput$ = searchBar$.find( ".a-PopupLOV-search" );
                searchButton$ = searchBar$.find( ".a-PopupLOV-doSearch" );
                clearButton$ = content$.find( ".a-PopupLOV-clearButton" );

                $.each( options.columns, function( prop, def ) {
                    // assume only one sort column
                    if ( def.sortIndex ) {
                        sortColumn = prop;
                        sortDirection = def.sortDirection;
                        return false; // break
                    }
                } );

                model = apex.model.create( modelName, {
                    shape: "table",
                    hasTotalRecords: false,
                    recordIsArray: true,
                    identityField: options.valueColumn,
                    metaField: options.columns._meta ? "_meta" : null,
                    fields: options.columns,
                    paginationType: "progressive",
                    regionId: options.itemId, // model assumes it is dealing with a region but shouldn't really care
                    fetchData: {
                        search: null,
                        sortColumn: sortColumn,
                        sortDirection: sortDirection
                    },
                    requestOptions: options.pluginTarget ? { target: options.pluginTarget } : null,
                    ajaxIdentifier: options.ajaxIdentifier,
                    pageItemsToSubmit: options.itemsToSubmit
                }, [], 0, false );

                // store the model name on the item
                item$.data( "popupLovModelName", modelName );

                displayCol = options.displayColumn || options.valueColumn; // fall back to using the value for display if there is no display column
                if ( options.display === "grid" ) {
                    options.columns[displayCol].usedAsRowHeader = true;
                    // if there is an icon column add a template to show the icon along with the display column
                    if ( options.iconColumn ) {
                        template = "<span class='" + makeSubstitution( options.iconColumn ) + "'></span> " +
                            makeSubstitution( displayCol );
                        options.columns[displayCol].cellTemplate = template;
                    }
                    gridOptions = extend( {
                        modelName: modelName,
                        columns: [options.columns],
                        columnSort: true,
                        columnSortMultiple: false, // sorting by more than one column seems like too much
                        collapsibleControlBreaks: false,
                        footer: false,
                        hasSize: true,
                        noDataMessage: noData,
                        multiple: false,
                        pagination: {
                            scroll: true,
                            loadMore: true // xxx false scroll paging broken
                        },
                        constrainNavigation: false, // let arrow navigation include search field
                        reorderColumns: false,
                        resizeColumns: true,
                        highlighter: highlightSearchTerm,
                        activateCell: function( event ) {
                            var cell$ = $( event.target ).closest( ".a-GV-cell" );

                            if ( (event.type === "keydown" && event.which !== KEY_ENTER) ||
                                cell$.hasClass( "a-GV-selHeader" ) || cell$.hasClass( "has-button" ) ) {
                                return;
                            }
                            save();
                        },
                        selectionChange: function( event ) {
                            // Assume not multiple selection
                            // This doesn't catch the case where click on current selection see click handler below
                            if ( event.originalEvent && event.originalEvent.type === "click" ) {
                                save();
                            }
                        },
                        sortChange: function( event, ui ) {
                            var i, col, index,
                                originalIndex = ui.column.sortIndex,
                                columns = grid$.grid( "getColumns" );

                            index = 1;
                            for ( i = 0; i < columns.length; i++ ) {
                                col = columns[i];
                                if ( col.sortIndex ) {
                                    if ( ui.action === "change" ) {
                                        if ( col === ui.column ) {
                                            index = col.sortIndex;
                                        }
                                    } else if ( ui.action === "add" ) {
                                        if ( col.sortIndex >= index ) {
                                            index = col.sortIndex + 1;
                                        }
                                    } else if ( ui.action === "remove" ) {
                                        if ( col === ui.column ) {
                                            delete col.sortIndex;
                                            delete col.sortDirection;
                                        } else if ( col.sortIndex > originalIndex ) {
                                            col.sortIndex -= 1;
                                        }
                                    } else if ( ui.action === "clear" || ui.action === "set" ) {
                                        delete col.sortIndex;
                                        delete col.sortDirection;
                                    }
                                }
                            }

                            if ( ui.action !== "clear" && ui.action !== "remove" ) {
                                ui.column.sortIndex = index;
                                ui.column.sortDirection = ui.direction;
                            }
                            grid$.grid( "refreshColumns" );
                            refresh( searchControl, null, ui.column.property, ui.direction );
                            if ( persistentState ) {
                                persistentState.sortColumn = ui.column.property;
                                persistentState.sortDirection = ui.direction;
                                saveState();
                            }
                        },
                        columnResize: function( event, ui ) {
                            if ( persistentState ) {
                                persistentState.columnWidths[ui.column.property] = parseInt( ui.width, 10 );
                                saveState();
                            }
                        }
                    }, options.defaultGridOptions );

                    grid$ = view$;
                    grid$.grid( gridOptions );
                    viewInstance = grid$.data( "apex-grid" );
                    grid$.click( function( event ) {
                        var row$ = $( event.target ).closest( ".a-GV-row" );
                        // if click on a row that is already selected there is no selection event so check and save if needed
                        if ( row$.hasClass( "is-selected" ) ) {
                            save();
                        }
                    } );
                } else if ( options.display === "list" ) {
                    template = options.recordTemplate;
                    if ( template ) {
                        template = template.replace("&DISPLAY.", "&" + displayCol + "." )
                            .replace( "&ICON.", "&" + options.iconColumn + "." )
                            .replace( "&RETURN.", "&" + options.valueColumn + "." );
                    } else {
                        template = "<li data-id='" + makeSubstitution( options.valueColumn ) + "'>";
                        if ( options.iconColumn ) {
                            template += "<span class='" + makeSubstitution( options.iconColumn ) + "'></span> "; // xxx acc should this have aria-hidden="true"?
                        }
                        template += makeSubstitution( displayCol ) + "</li>";
                    }

                    listOptions = extend( {
                        modelName: modelName,
                        // default before and after template is for list markup <ul>, </ul>
                        recordTemplate: template,
                        footer: false,
                        hasSize: true,
                        noDataMessage: noData,
                        highlighter: highlightSearchTerm,
                        useIconList: true,
                        constrainNavigation: false, // let arrow navigation include search field
                        iconListOptions: {
                            navigation: true,
                            multiple: false,
                            activate: function( event ) {
                                save();
                                event.preventDefault();
                            }
                        },
                        pagination: {
                            scroll: true,
                            loadMore: true // xxx false
                        }
                    }, options.defaultIconListOptions );

                    view$.tableModelView( listOptions );
                    viewInstance = view$.data( "apex-tableModelView" );
                } else {
                    throw new Error( "Invalid display value" );
                }

                dialog$.append( content$.children() );

                if ( options.minSearchChars > 0 ) {
                    filterRequiredNoData = lang.formatMessage( "APEX.POPUP_LOV.FILTER_REQ", options.minSearchChars );
                }
                if ( !filterRequiredNoData && options.initialFetch === "none" ) {
                    filterRequiredNoData = lang.getMessage( "APEX.POPUP_LOV.INITIAL_FILTER_REQ" );
                }

                if ( incrementalSearch ) {
                    debounceSearch = util.debounce( function() {
                        refresh( searchControl, searchInput$.val() );
                    }, 400 );
                }

                view$.keydown( function( event ) {
                    var kc = event.which;

                    if ( event.isDefaultPrevented() ) {
                        return;
                    }
                    if ( kc === KEY_DOWN ) {
                        // wrap around to the search field
                        topJQuery( searchInput$ ).focus();
                    } else if ( kc === KEY_UP ) {
                        // move back up to the clear button or search field if present.
                        if ( clearButton$[0] ) {
                            clearButton$.add( searchInput$ ).last().focus();
                        } else {
                            topJQuery( searchInput$ ).focus();
                            event.preventDefault();
                        }
                    }
                } ).focusin( function() {
                    var sel = viewInstance.getSelection();
                    if ( sel.length === 0 ) {
                        // use ownerDocument because document may not be the right document
                        sel = $( view$[0].ownerDocument.activeElement ).closest( ".a-IconList-item,.a-GV-row" );
                        if ( sel[0] ) {
                            viewInstance.setSelection( sel );
                        }
                    }
                } );

                searchInput$.keydown( function( event ) {
                    var rec,
                        kc = event.which;

                    if ( kc === KEY_DOWN ) {
                        if ( clearButton$[0] ) {
                            clearButton$.focus();
                        } else {
                            viewInstance.focus();
                        }
                        event.preventDefault();
                    } else if ( kc === KEY_UP ) {
                        viewInstance.focus();
                        event.preventDefault();
                    } else if ( kc === KEY_TAB && incrementalSearch ) {
                        if ( model.getTotalRecords() === 1 ) {
                            // make sure something is selected
                            if ( grid$ ) {
                                grid$.grid( "setSelection", grid$.find( ".a-GV-cell" ).eq(0) );
                            } else {
                                viewInstance.focus();
                            }
                            save();
                            event.preventDefault();
                            event.stopPropagation();
                        }
                    } else if ( kc === KEY_ENTER ) {
                        // prevent the browser default to submit the page when this is the only text item on the page
                        event.preventDefault();
                        if ( incrementalSearch && options.enterable && isPopup && searchInput$.val() ) {
                            // Special case when enter pressed in search input and doing incremental search and inline
                            // popup under and the field is enterable/no display then the value entered is the value to be selected.
                            // This makes it easier to enter things not in the list while searching to see if maybe they are.
                            // save searchInput not a selected item/record
                            result = {
                                v: searchInput$.val()
                            };
                            dialog$[widget]( "close" );
                        } else if ( incrementalSearch && !options.enterable && model.getTotalRecords() === 1 ) {
                            // special case to make it easier to select the one and only result found
                            rec = null;
                            model.forEach( function(r) { rec = r; } );
                            if ( rec ) {
                                viewInstance.setSelectedRecords([rec]);
                                save();
                            }
                        } else {
                            refresh( searchControl, searchInput$.val() );
                        }
                    } else if ( incrementalSearch ) {
                        debounceSearch();
                    }
                } );
                searchButton$.click( function() {
                    refresh( searchControl, searchInput$.val() );
                } );
                clearButton$.click( function() {
                    saveNullValue();
                } ).keydown( function( event ) {
                    var kc = event.which;
                    if ( kc === KEY_DOWN ) {
                        viewInstance.focus();
                        event.preventDefault();
                    } else if ( kc === KEY_UP ) {
                        topJQuery( searchInput$ ).focus();
                        event.preventDefault();
                    }
                } );

                // The Popup LOV dialog widget manages its own keyboard interactions, and we want screen reader 
                // users to always benefit from this same keyboard support, so make the dialog$ content element a landmark
                // application role to allow these keystrokes through
                dialog$.attr( "role", "application" );

            },
            open: function( event ) {
                var width, height, ww, wh,
                    searchControl = item$.data( "popupSearchState" ),
                    search = searchControl.searchText || "",
                    dialog$ = topJQuery( event.target ),
                    widget = dialog$.is( ":data(apexPopup)" ) ? "popup" : "dialog";

                if ( !options.width ) {
                    width = item$.closest( ".apex-item-group--popup-lov" ).width(); // dialog min width keeps this from getting too small
                }
                if ( isPopup ) {
                    // A dialog is responsive at least in UT and that will adjust its size for small screens
                    // but a popup is not so make sure it isn't bigger than the window
                    ww = $( window ).width() - 10;
                    wh = $( window ).height() - 10;
                    if ( ( options.width || width ) > ww ) {
                        width = ww;
                    }
                    if ( options.height > wh ) {
                        height = wh;
                    }
                    // todo think if too big may just want to center
                }
                if ( width ) {
                    dialog$[widget]( "option", "width", width );
                }
                if ( height ) {
                    dialog$[widget]( "option", "height", height );
                }
                resize( event.target );

                result = null;
                if ( search || searchControl.forceRefresh ) {
                    searchInput$.val( search );
                    refresh( searchControl, search );
                }

                // dialog widget has logic to set the focus on open which works very well except for Firefox when
                // opened from an APEX modal dialog page. So set the focus here to be sure.
                searchInput$.focus();
            },
            resize: function( event ) {
                resize( event.target );
            },
            resizeStop: function( event, ui ) {
                // popup should never resize but double check just in case because don't want to ever persist the size
                if ( persistentState && !isPopup ) {
                    persistentState.height = ui.size.height;
                    persistentState.width = ui.size.width;
                    saveState();
                }
            }
        };
        [ "draggable", "resizable", "width", "height", "minWidth", "minHeight", "maxWidth", "maxHeight", "noOverlay" ].forEach( function( prop ) {
            if ( options[prop] !== undefined ) {
                dialogOptions[prop] = options[prop];
            }
        } );
        apex.message.showDialog( messageContent, dialogOptions );
    };

    /**
     * helper function: Sort the chart data, to ensure the order of the series items matches the groups array
     * @param pItems
     * @param pOrder
     * @ignore
     */
    var chartSortArray = function( pItems, pOrder ) {
        pItems.sort( function( a, b ) {
            if ( a.name < b.name ) {
                return -1;
            } else if ( a.name > b.name ) {
                return 1;
            }
            return 0;
        });

        if ( pOrder === 'label-desc' ) {
            pItems.reverse();
        }
    }; // chartSortArray

    widgetUtil.chartSortArray = chartSortArray;

    /**
     * helper function: Fill gaps for missing data points, to ensure each group has an associated data point in each series
     * @ignore
     */
    widgetUtil.chartFillGaps = function( pGroups, pItems, pOrder, pConnect ) {
        chartSortArray( pItems, pOrder );

        for ( var groupIdx = 0; groupIdx < pGroups.length; groupIdx++ ) {
            // Each group entry must have a corresponding entry in the items array, required by JET
            if ( !pItems[ groupIdx ] || pItems[ groupIdx ].name !== pGroups[ groupIdx ].name ) {
                // Add a new entry for a missing data point
                // The setting of value depends on user's 'Connect Null Data Points' setting.
                // A value of 0 will result in a continuous line; a value of null will result in a broken line
                //items.splice( groupIdx, 0, pConnect ? { name: groups[ groupIdx ].name, value: 0 } : { name: groups[ groupIdx ].name, value: null } );
                pItems.splice( groupIdx, 0, { name: pGroups[ groupIdx ].name, value:  pConnect ? 0 : null } );
            } else if ( pItems[ groupIdx ].id !== groupIdx ) {
                // Correct the id if we have added new data points
                pItems[ groupIdx ].id = groupIdx;
            }
        }
    };  // chartFillGaps

    /**
     * Utility function to enable any icons descendant of $pContainer
     * If passing pClickHandler to rebind the icon's click handler, the
     * $pContainer must be the same as the element you wish to bind the
     * handler to (eg the icon's wrapping anchor).
     *
     * @param {jQuery}   $pContainer
     * @param {String}   pHref
     * @param {Function} [pClickHandler]
     *
     * @ignore
     * @memberOf apex.widget.util
     **/
    widgetUtil.enableIcon = function( $pContainer, pHref, pClickHandler ) {
        $pContainer
            .find( "img" )           // locate any images descendant of $pContainer
            .css({ "opacity" : 1,
                "cursor"  : "" }) // set their opacity and remove cursor
            .parent( "a" )           // go to parent, which should be an anchor
            .attr( "href", pHref );  // add the href
        // check if pClickHandler is passed, if so, bind it
        if ( pClickHandler ) {
            $pContainer.click( pClickHandler ); // rebind the click handler
        }
    }; // enableIcon

    /**
     * Utility function to disable any icons descendant of $pContainer
     *
     * @param {jQuery} $pContainer
     *
     * @ignore
     * @memberOf apex.widget.util
     **/
    widgetUtil.disableIcon = function( $pContainer ) {
        $pContainer
            .find( "img" )
            .css({ "opacity" : 0.5,
                "cursor"  : "default" })
            .parent( "a" )
            .removeAttr( "href" )
            .unbind( "click" );
    }; // disableIcon

    /*
     * Common functionality for widgets to check if the become visible or hidden
     */
    var visibleCheckList = [];

    function findInVisibleCheckList(element) {
        var i;
        for ( i = 0; i < visibleCheckList.length; i++ ) {
            if ( visibleCheckList[i].el === element ) {
                return i;
            }
        }
        return null;
    }

    /**
     * todo
     * @param pElement
     * @param pCallback
     */
    widgetUtil.onVisibilityChange = function( pElement, pCallback ) {
        var index = findInVisibleCheckList( pElement ),
            c = {
            el: pElement,
                cb: pCallback
        };
        if ( index !== null ) {
            visibleCheckList[index] = c;
        } else {
            visibleCheckList.push(c);
        }
    };

    /**
     * todo
     * @param pElement
     */
    widgetUtil.offVisibilityChange = function( pElement ) {
        var index = findInVisibleCheckList( pElement );
        if ( index !== null ) {
            visibleCheckList.splice( index, 1 );
        }
    };

    /**
     * Determines whether or not the element specified is visible. 
     * Checks both that the element is directly visible and that it's on the active tab if it is within a tab region.
     * @param {jQuery} pElement
     * @return {boolean}
     * @memberOf apex.widget.util
     * @ignore
     */
    widgetUtil.isVisible = function( pElement ) {

        var tabRegion$,
            activeTab$,
            isVisible = pElement.is(':visible'),
            isInTab   = pElement.closest( "div.apex-tabs-region" ).length > 0;

        // separate test for APEX tabs needed, because of timing issues
        if ( isInTab ) {
            tabRegion$ = apex.region( pElement.closest( "div.apex-tabs-region" ).attr( "id" ) ).widget();

            if ( tabRegion$ ) {
                activeTab$ = tabRegion$.aTabs( "getActive" ).el$;
                if ( pElement.parents( "#" + activeTab$.attr( "id" ) ).length === 0 ) {
                    isVisible = false;
                }
            }
        }
        return isVisible;
    };

    /**
     * Execute a supplied callback function as soon as the specified element becomes visible. 
     * If the element is visible at page load then the callback will be executed immediately.
     * Otherwise it will be executed when the element becomes visible, for example; when its containing tab is activated.
     * This is similar to the onVisibilityChange functionality except that it will only fire when an element becomes visible
     * (not when a visible element is hidden) and will only fire once, the first time an element becomes visible.
     * It is only useful for components that do not manage their size and can be initialized or refreshed while hidden. 
     * The callback is passed the jQuery object which was originally supplied to this function.
     * @param {jQuery} pElement
     * @param {Function} pCallback
     * @memberOf apex.widget.util
     * @ignore
     */
    widgetUtil.whenBecomesVisible = function ( pElement, pCallback ) {

        setTimeout( function () {
            if ( !widgetUtil.isVisible( pElement ) ) {
                widgetUtil.onVisibilityChange( pElement[ 0 ], function ( show ) {
                    if ( show ) {
                        pCallback( pElement );
                        widgetUtil.offVisibilityChange( pElement[ 0 ] );
                    }
                });
            } else {
                pCallback( pElement );
            }
        }, 0 );
    };

    /**
     * todo
     * @param pElement
     * @param pShow
     * @memberOf apex.widget.util
     */
    var visibilityChange = widgetUtil.visibilityChange = function( pElement, pShow ) {
        var i, check$, c,
            parent$ = $( pElement );
        pShow = !!pShow; // force true/false
        for ( i = 0; i < visibleCheckList.length; i++ ) {
            c = visibleCheckList[i];
            check$ = $( c.el );
            // todo can get false results because :visible may be true even if not visible because of a hidden ancestor.
            if ( pShow === check$.is( SEL_VISIBLE ) && check$.closest(parent$ ).length ) {
                c.cb( pShow );
            }
        }
    };

    // setup handler for DA Show/Hide
    $( document ).on( "apexaftershow", function( e ) {
        visibilityChange( e.target, true );
    }).on( "apexafterhide", function( e ) {
        visibilityChange( e.target, false );
    } );

    var DATA_RESIZE_SENSOR = "apex-resize-sensor";

    /**
     * Register a callback for when a DOM element's dimensions change. The element must allow element content.
     *
     * @param {Element|String} pElement DOM element or string ID of a DOM element to detect size changes on.
     * @param {Function} pResizeCallback no argument function to call when the size of the element changes
     */
    widgetUtil.onElementResize = function( pElement, pResizeCallback ) {
        var el$, tracker;
        if ( typeof pElement === "string" ) {
            pElement = "#" + pElement;
        }
        el$ = $( pElement ).first();
        tracker = el$.data( DATA_RESIZE_SENSOR );
        if ( !tracker ) {
            tracker = new ResizeTracker( el$[0] );
            el$.data( DATA_RESIZE_SENSOR, tracker );
            tracker.start();
        }
        tracker.addListener( pResizeCallback );

    /*
         DON'T use ResizeSensor for now
            var rs, el$;

            if ( typeof pElement === "string" ) {
                pElement = "#" + pElement;
            }
            el$ = $( pElement ).first();
            if ( el$.length ) {
                rs = new ResizeSensor( el$[0], pResizeCallback );
                el$.data( DATA_RESIZE_SENSOR, rs);
            }
     */
    };

    /**
     * Remove the callback registered with onElementResize for the given element.
     *
     * @param {Element|String} pElement DOM element or string ID of a DOM element to detect size changes on.
     * @param {Function} pResizeCallback no argument function to call when the size of the element changes
     */
    widgetUtil.offElementResize = function( pElement, pResizeCallback ) {
        var el$, tracker;
        if ( typeof pElement === "string" ) {
            pElement = "#" + pElement;
        }
        el$ = $( pElement ).first();
        tracker = el$.data( DATA_RESIZE_SENSOR );
        if ( tracker ) {
            if ( pResizeCallback ) {
                tracker.removeListener( pResizeCallback );
                if ( tracker.isEmpty() ) {
                    tracker.stop();
                    el$.removeData( DATA_RESIZE_SENSOR );
                }
            } else {
                tracker.destroy();
                el$.removeData( DATA_RESIZE_SENSOR );
            }
        }
    /*
     DON'T use ResizeSensor for now
        var rs, el$;

        if ( typeof pElement === "string" ) {
            pElement = "#" + pElement;
        }
        el$ = $( pElement ).first();
        rs = el$.data( DATA_RESIZE_SENSOR );
        rs.detach();
        el$.removeData( DATA_RESIZE_SENSOR );
    */
    };

    /**
     * Updates any resize sensors added when onElementResize is used. Call this function
     * when an element containing a resize sensor has been made visible or is connected to the DOM.
     *
     * @param {!Element} pElement DOM element or string ID of a DOM element that has become visible and may contain
     *                            resize sensors.
     */
    widgetUtil.updateResizeSensors = function( pElement ) {
        if ( typeof pElement === "string" ) {
            pElement = "#" + pElement;
        }
        $( pElement ).find( ".js-resize-sensor" ).parent().each( function( i, el ) {
            var tracker = $( el ).data( DATA_RESIZE_SENSOR );
            if ( tracker != null ) {
                tracker.init( true );
            }
        }
        );
    };

    /*
     * This JET code doesn't follow all the same lint rules APEX does so turn them off
     * Keep this at the end of the file or turn the rules back on after
     */
    /* eslint-disable no-plusplus, eqeqeq */

    /**
     * @preserve Oracle JET TouchProxy, ResizeTracker
     * Copyright (c) 2014, 2018, Oracle and/or its affiliates.
     * The Universal Permissive License (UPL), Version 1.0
     */
    // TODO would like to use these things directly from JET library but the global symbols are compiled away
    /*
     * Temp? replacement for ResizeSensor library
     * extracted from JET
     * Utility class for tracking resize events for a given element and dispatching them to listeners
     * Updated with changes from JET 4.2.0 but not including code for _collapsingManagers, _collapsingListeners.
     */
    var ResizeTracker = function(div) {
        var _listeners = $.Callbacks(),
            _RETRY_MAX_COUNT = 2,
            _retrySetScroll = 0,
            _invokeId = null,
            _oldWidth  = null,
            _oldHeight = null,
            _detectExpansion = null,
            _detectContraction = null,
            _resizeListener = null,
            _scrollListener = null;

        this.addListener = function(listener) {
            _listeners.add(listener);
        };

        this.removeListener = function(listener) {
            _listeners.remove(listener);
        };

        this.isEmpty = function() {
            return !_listeners.has();
        };

        this.destroy = function() {
            _listeners.empty();
            this.stop();
        };

        this.start = function() {

            function setStyles( s1, s2 ) {
                s1.direction = "ltr";
                s1.position = s2.position = "absolute";
                s1.left = s1.top = s1.right = s1.bottom = "0";
                s1.overflow = "hidden";
                s1.zIndex = "-1";
                s1.visibility = "hidden";
                s2.left = s2.top = "0";
                s2.transition = "0s";
            }

            _scrollListener = _handleScroll.bind(this);

            // : Use native onresize support on teh DIV in IE9/10 and  since no scroll events are fired on the
            // contraction/expansion DIVs in IE9
            if (div.attachEvent) {
                _resizeListener = _handleResize.bind(this);
                div.attachEvent('onresize', _resizeListener);
            } else {
                var firstChild = div.childNodes[0];

                // This child DIV will track expansion events. It is meant to be 1px taller and wider than the DIV
                // whose resize events we are tracking. After we set its scrollTop and scrollLeft to 1, any increate in size
                // will fire a scroll event
                _detectExpansion = document.createElement("div");
                // don't want css dependencies but need to find later
                _detectExpansion.className = "js-resize-sensor";

                var expansionChild = document.createElement("div");
                setStyles( _detectExpansion.style, expansionChild.style );
                _detectExpansion.appendChild(expansionChild);
                if ( firstChild ) {
                    div.insertBefore(_detectExpansion, firstChild);
                } else {
                    div.appendChild(_detectExpansion);
                }

                _detectExpansion.addEventListener("scroll", _scrollListener, false);

                // This child DIV will track contraction events. Its height and width are set to 200%. After we set its scrollTop and
                // scrollLeft to the current height and width of its parent, any decrease in size will fire a scroll event
                _detectContraction = document.createElement("div");
                // don't want css dependencies: _detectContraction.className = "oj-helper-detect-contraction";

                var contractionChild = document.createElement("div");
                setStyles( _detectContraction.style, contractionChild.style );
                contractionChild.style.width = "200%";
                contractionChild.style.height = "200%";
                _detectContraction.appendChild(contractionChild);
                div.insertBefore(_detectContraction, _detectExpansion);

                _detectContraction.addEventListener("scroll", _scrollListener, false);

                this.init(false);
            }
        };

        this.stop = function() {
            if (_invokeId !== null) {
                util.cancelInvokeAfterPaint(_invokeId);
                _invokeId = null;
            }
            if (_detectExpansion !== null) {
                _detectExpansion.removeEventListener("scroll", _scrollListener);
                _detectContraction.removeEventListener("scroll", _scrollListener);
                // Check before removing to prevent CustomElement polyfill from throwing
                // a NotFoundError when removeChild is called with an element not in the DOM
                if (_detectExpansion.parentNode) {
                    div.removeChild( _detectExpansion );
                }
                if (_detectContraction.parentNode) {
                    div.removeChild( _detectContraction );
                }
            } else {
                // assume IE9/10
                div.detachEvent('onresize', _resizeListener);
            }
        };

        this.init = function(isFixup) {
            var adjusted = _checkSize(isFixup);
            if (isFixup && !adjusted && _detectExpansion.offsetParent != null) {
                _adjust(_oldWidth, _oldHeight);
            }
        };

        function _checkSize(fireEvent) {
            var adjusted = false;
            if (_detectExpansion.offsetParent != null) {
                var newWidth = _detectExpansion.offsetWidth;
                var newHeight = _detectExpansion.offsetHeight;

                if (_oldWidth !== newWidth || _oldHeight !== newHeight) {
                    _retrySetScroll = _RETRY_MAX_COUNT;
                    _adjust(newWidth, newHeight);
                    adjusted = true;

                    if (fireEvent) {
                        _notifyListeners(true);
                    }
                }
            }

            return adjusted;
        }

        function _notifyListeners(useAfterPaint) {
            var newWidth = div.offsetWidth;
            var newHeight = div.offsetHeight;
            if (_listeners.has()) {
                if (!useAfterPaint) {
                    _listeners.fire(newWidth, newHeight);
                } else {
                    if (_invokeId !== null) {
                        util.cancelInvokeAfterPaint(_invokeId);
                    }

                    _invokeId = util.invokeAfterPaint(
                        function() {
                            _invokeId = null;
                            _listeners.fire(newWidth, newHeight);
                        }
                    );
                }
            }
        }

        function _handleScroll(evt) {
            evt.stopPropagation();
            if (!_checkSize(true)) {
                // Workaround for the WebKit issue where scrollLeft gets reset to 0 without the DIV being expanded
                // We will retry to the set the scrollTop only twice to avoid infinite loops
                if (_retrySetScroll > 0 && _detectExpansion.offsetParent != null &&
                    (_detectExpansion.scrollLeft == 0 || _detectExpansion.scrollTop == 0)) {
                    _retrySetScroll--;
                    _adjust(_oldWidth, _oldHeight);
                }
            }
        }

        function _handleResize() {
            _notifyListeners(false);
        }

        function _adjust(width, height) {
            _oldWidth = width;
            _oldHeight = height;

            var expansionChildStyle = _detectExpansion.firstChild.style;

            var delta = 1;

            // The following loop is a workaround for the WebKit issue with zoom < 100% -
            // the scrollTop/Left gets reset to 0 because it gets computed to a value less than 1px.
            // We will try up to the delta of 5 to support scaling down to 20% of the original size
            do {
                expansionChildStyle.width = width + delta + 'px';
                expansionChildStyle.height = height + delta + 'px';
                _detectExpansion.scrollLeft = _detectExpansion.scrollTop = delta;
                delta++;
            } while ((_detectExpansion.scrollTop == 0 || _detectExpansion.scrollLeft == 0) && delta <= 5);


            _detectContraction.scrollLeft = width;
            _detectContraction.scrollTop = height;
        }
    };

    /**
     * @preserve jQuery UI Touch Punch 0.2.3
     *
     * Copyright 2011-2014, Dave Furfero
     * Dual licensed under the MIT or GPL Version 2 licenses.
     */

    /**
     * Utility class for proxying touch events for a given element and mapping them to mouse events
     * @constructor
     * @ignore
     * @private
     */
    widgetUtil.TouchProxy = function(elem) {
        this._init(elem);
    };

    /**
     * Initializes the TouchProxy instance
     *
     * @param {Object} elem
     * @private
     */
    widgetUtil.TouchProxy.prototype._init = function(elem) {
        this._elem = elem;

        this._touchHandled = false;
        this._touchMoved = false;

        //add touchListeners
        this._touchStartHandler = $.proxy(this._touchStart, this);
        this._touchEndHandler = $.proxy(this._touchEnd, this);
        this._touchMoveHandler = $.proxy(this._touchMove, this);

        this._elem.on({
            "touchstart": this._touchStartHandler,
            "touchend": this._touchEndHandler,
            "touchmove": this._touchMoveHandler,
            "touchcancel": this._touchEndHandler
        });
    };

    widgetUtil.TouchProxy.prototype._destroy = function() {
        if (this._elem && this._touchStartHandler) {
            this._elem.off({
                "touchstart": this._touchStartHandler,
                "touchmove": this._touchMoveHandler,
                "touchend": this._touchEndHandler,
                "touchcancel": this._touchEndHandler
            });

            this._touchStartHandler = undefined;
            this._touchEndHandler = undefined;
            this._touchMoveHandler = undefined;
        }
    };

    /**
     * Simulate a mouse event based on a corresponding touch event
     * @param {Object} event A touch event
     * @param {string} simulatedType The corresponding mouse event
     *
     * @private
     */
    widgetUtil.TouchProxy.prototype._touchHandler = function(event, simulatedType) {
        // Ignore multi-touch events
        if (event.originalEvent.touches.length > 1) {
            return;
        }

        // - contextmenu issues: presshold should launch the contextmenu on touch devices
        if (event.type != "touchstart" && event.type != "touchend") {
            event.preventDefault();
        }

        var touch = event.originalEvent.changedTouches[0],
            simulatedEvent = document.createEvent("MouseEvent");

        // Initialize the simulated mouse event using the touch event's coordinates
        // initMouseEvent(type, canBubble, cancelable, view, clickCount,
        //                screenX, screenY, clientX, clientY, ctrlKey,
        //                altKey, shiftKey, metaKey, button, relatedTarget);
        simulatedEvent.initMouseEvent(simulatedType, true, true, window, 1,
            touch.screenX, touch.screenY,
            touch.clientX, touch.clientY, false,
            false, false, false, 0/*left*/, null);

        touch.target.dispatchEvent(simulatedEvent);
    };

    /**
     * Handle touchstart events
     * @param {Object} event The element's touchstart event
     *
     * @private
     */
    widgetUtil.TouchProxy.prototype._touchStart = function(event) {
        // Ignore the event if already being handled
        if (this._touchHandled) {
            return;
        }

        // set the touchHandled flag
        this._touchHandled = true;

        // Track movement to determine if interaction was a click
        this._touchMoved = false;

        // Simulate the mouseover, mousemove and mousedown events
        this._touchHandler(event, "mouseover");
        this._touchHandler(event, "mousemove");
        this._touchHandler(event, "mousedown");
    };

    /**
     * Handle the touchmove events
     * @param {Object} event The element's touchmove event
     *
     * @private
     */
    widgetUtil.TouchProxy.prototype._touchMove = function(event) {
        // Ignore event if not handled
        if (! this._touchHandled) {
            return;
        }

        // Interaction was not a click
        this._touchMoved = true;

        // Simulate the mousemove event
        this._touchHandler(event, "mousemove");
    };

    /**
     * Handle the touchend events
     * @param {Object} event The element's touchend event
     *
     * @private
     */
    widgetUtil.TouchProxy.prototype._touchEnd = function(event) {
        // Ignore event if not handled
        if (!this._touchHandled) {
            return;
        }

        // Simulate the mouseup and mouseout events
        this._touchHandler(event, "mouseup");
        this._touchHandler(event, "mouseout");

        // If the touch interaction did not move, it should trigger a click
        // except that the browser already creates a click and we don't want two of them
        /*
        if (!this._touchMoved && event.type == "touchend") {
            // Simulate the click event
            this._touchHandler(event, "click");
        } */

        // Unset the flag
        this._touchHandled = false;
    };

    widgetUtil.TouchProxy._TOUCH_PROXY_KEY = "apexTouchProxy";

    widgetUtil.TouchProxy.prototype.touchMoved = function() {
        return this._touchMoved;
    };

    /**
     * Adds touch event listeners
     * @param {Object} elem
     * @ignore
     */
    widgetUtil.TouchProxy.addTouchListeners = function(elem) {
        var jelem = $(elem),
            proxy = jelem.data(widgetUtil.TouchProxy._TOUCH_PROXY_KEY);

        if (!proxy) {
            proxy = new widgetUtil.TouchProxy(jelem);
            jelem.data(widgetUtil.TouchProxy._TOUCH_PROXY_KEY, proxy);
        }

        return proxy;
    };

    /**
     * Removes touch event listeners
     * @param {Object} elem
     * @ignore
     */
    widgetUtil.TouchProxy.removeTouchListeners = function(elem) {
        var jelem = $(elem),
            proxy = jelem.data(widgetUtil.TouchProxy._TOUCH_PROXY_KEY);

        if (proxy) {
            proxy._destroy();
            jelem.removeData(widgetUtil.TouchProxy._TOUCH_PROXY_KEY);
        }
    };

})( apex.widget.util, apex.util, apex.lang, apex.navigation, apex.jQuery );
