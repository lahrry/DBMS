/*!
 Copyright (c) 2020, 2021, Oracle and/or its affiliates. All rights reserved.
*/
/*
 * The text field item of Oracle APEX.
 */
(function( item, $ ) {
    "use strict";

    const CASE_NONE  = "NONE",
        CASE_UPPER = "UPPER",
        CASE_LOWER = "LOWER",
        WS_NONE = "NONE",
        WS_LEADING = "LEADING",
        WS_TRAILING = "TRAILING",
        WS_BOTH = "BOTH";

    // Matches spaces, tabs, and new lines at the end or start
    const TRAILING_WS_RE = /\s+$/,
        LEADING_WS_RE  = /^\s+/;

    /*
     * Utility function to transform the case
     */
    let getCaseTransform = ( value, transform ) => {
        if ( transform !== CASE_NONE ) {
            value = value == null ? "" : "" + value; // force value to be a string, use == to catch undefined as well
            // handling text case base on the transform type
            if ( transform === CASE_UPPER ) {
                value = value.toUpperCase();
            } else if ( transform === CASE_LOWER ) {
                value = value.toLowerCase();
            }
        }

        return value;
    };

    /*
     * Utility function to trim whitespaces
     * Also used in widget.textarea
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

    let textFieldItemPrototype = {
        item_type: "TEXT",
        setValue: function ( value, displayValue, suppressChangeEvent ) {
            // handling text case
            value = getCaseTransform( value, this._textCase );

            // handling whitespace trim
            value = getWhitespaceTrim( value, this._whitespaceTrim );

            this.element.val( value );

            if ( !suppressChangeEvent ) {
                // used to prevent the attached change event in order to prevent a second call to the case and whitespace functions
                this._preventChangeHandler = true;
            }
        },
        getValue: function () {
            let value = this.element.val();

            // handling text case
            value = getCaseTransform( value, this._textCase );

            //handling whitespace trim
            value = getWhitespaceTrim( value, this._whitespaceTrim );

            return value;
        }
    };
 
    function attachTextInput( context$ ) {
        /*
         * expected markup:
         * <input type="text" id="{NAME}" name="{NAME}" value="{...}" data-trim-spaces="{BOTH|LEADING|TRAILING|NONE}" data-text-case="{NONE|UPPER|LOWER}">
         * The type can also be one of the text sub types such as url or email.
         * The default for data-trim-spaces is BOTH and the default for data-text-case is NONE. The attributes can be
         * omitted if the value is the default.
         * Can have any other attribute appropriate for input type=text such as readonly, disabled, size, and maxlength.
         */
        $( ".apex-item-text.text_field", context$ ).each( function() {
            let thisItem,
                item$ = $( this ),
                id = this.id, // escape to use
                // keep these defaults in sync with server logic
                trimValue = item$.attr('data-trim-spaces') || WS_BOTH,
                caseValue = item$.attr('data-text-case') || CASE_NONE;

            // Change handler to keep the case and whitespace in sync
            item$.change( () => {
                //if the change event is triggered by the setValue, we don't need to do any transformation
                if ( thisItem._preventChangeHandler ) {
                    thisItem._preventChangeHandler = false;
                    return;
                }

                let value = item$.val();

                // handling text case
                value = getCaseTransform( value, caseValue );

                //handling whitespace trim
                value = getWhitespaceTrim( value, trimValue );

                item$.val( value );
            } );

            item.create( id, textFieldItemPrototype );

            thisItem = item( id );
            thisItem._whitespaceTrim = trimValue;
            thisItem._textCase = caseValue;
            thisItem._preventChangeHandler = false;
        } );
    }

    // register attachTextInput to run when needed
    item.addAttachHandler( attachTextInput );

})( apex.item, apex.jQuery );
