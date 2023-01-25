/*!
 Copyright (c) 2012, 2021, Oracle and/or its affiliates. All rights reserved.
*/
/*
 * The {@link apex.widget}.yesNo is used for the Yes/No widget of Oracle APEX.
 */
/*global $x_FormItems*/
(function( item, $, util ) {
    "use strict";
/**
 * @param {string} pPageItemId APEX page item identified by its name/DOM ID or the entire DOM node.
 * @param {string} pDisplayStyle The display style can be either SWITCH (Pill Button) or SWITCH_CB (True switch).
 *
 * @function yesNo
 * @memberOf apex.widget
 * */
apex.widget.yesNo = function( pPageItemId, pDisplayStyle ) {

    var lItem$;

    if ( pDisplayStyle === "SWITCH" ) {
        lItem$ = $( ":radio", "#" + util.escapeCSS( pPageItemId ), apex.gPageContext$ );
    } else {
        lItem$ = $( "#" + util.escapeCSS( pPageItemId ), apex.gPageContext$ );
    }

    // Add click handler on 'a-Switch' SPAN to update checked state. This is needed because we no longer use an implicit label around
    // the checkbox, so need custom logic to take care of the scenario where the user clicks on the SPAN with the mouse. 
    // Note: There are 2 other ways the user can update checked state, either by clicking on the checkbox label, or pressing 
    // space when the switch has focus. Both of these scenarios are automatically handled by the existing input / label markup.
    // This default handling actually results in a 'click' event bubbling up to the SPAN, so we have to exclude events that
    // emanate from the checkbox in this handling, to avoid setting it back to what it was before.
    if ( pDisplayStyle === "SWITCH_CB" ) {         
        lItem$.closest( "span.a-Switch" ).on( "click", function( e ) {

            // To proceed with the change, this must meet the following 2 conditions:
            //   1. The event target must not be the checkbox
            //   2. The checkbox must not be disabled
            if ( !$( e.target ).is( ":checkbox" ) && !lItem$.is( ":disabled" ) ) {
                lItem$
                    .prop( "checked", !lItem$.prop( "checked" ) )
                    .trigger( 'change' );

                // We also need to set the checkbox indeterminate value, in case this had been set to true programatically.
                // We can safely do this, because by virtue of being in the click event, we can be sure the user intends to 
                // either change to checked or unchecked, and therefore remove the indeterminate state.
                lItem$[ 0 ].indeterminate = false;
            }
        });
    }

    item.create( pPageItemId, {
        enable : function() {
            lItem$.prop( "disabled", false );
        },
        disable : function() {
            lItem$.prop( "disabled", true );
        },
        isDisabled : function() {
            if ( pDisplayStyle === "SWITCH" ) {
                return lItem$.first().prop( "disabled" ) === true;
            } else {
                return lItem$.prop( "disabled" ) === true;
            }
        },
        setValue : function( pValue ) {
            if ( pDisplayStyle === "SWITCH" ) {
                lItem$
                    .prop( "checked", false )
                    .filter( "[value='" + util.escapeCSS( pValue ) + "']" )
                        .prop( "checked", true );
            } else {
                lItem$.prop( "checked", ( lItem$.prop( "value" ) === pValue ) );
            }
        },
        getValue : function() {
            // get checked input value, in the context of the fieldset, return an empty string if nothing has been checked
            // Note: we are using attr to get the value, because .val() returns a wrong value if the radio doesn't have
            //       a value attribute
            var pValue;

            if ( pDisplayStyle === "SWITCH" ) {
                pValue = lItem$.filter( ":checked" ).attr( "value" );
            } else {
                if ( lItem$.prop( "checked" )) {
                    pValue = lItem$.attr( "value" );
                } else {
                    pValue = lItem$.attr( "data-off-value" );
                }
            }
            // todo: to be extra safe. consider removing.
            pValue = pValue === undefined ? "" : pValue + "";

            return pValue;
        },
        isChanged : function() {
            var i,
                curValue,
                origValue = "",
                itemChecked,
                elements;
            if ( pDisplayStyle === "SWITCH" ) {
                curValue = this.getValue();
                elements = $x_FormItems( this.node, "RADIO" );
                for ( i = 0; i < elements.length; i++ ) {
                    if ( elements[ i ].defaultChecked ) {
                        origValue = elements[ i ].value;
                        break;
                    }
                }
                return curValue !== origValue;
            } else {
                itemChecked = lItem$.prop( "checked" );
                return lItem$[ 0 ].defaultChecked !== itemChecked;
            }
        },
        setFocusTo: function() {
            if ( pDisplayStyle === "SWITCH" ) {

                // set focus to first radio in the fieldset
                return lItem$.first();
            } else {
                return lItem$;
            }
        },
        displayValueFor: function( pValues ) {
            var lblId,
                display = "";

            if ( pValues !== null && pValues !== undefined ) {
                if ( pDisplayStyle === "SWITCH" ) {

                    // there should be just one value and it must be a string
                    lblId = lItem$.filter( "[value='" + apex.util.escapeCSS( pValues + "" ) + "']" ).prop( "id" );
                    if ( lblId ) {
                        display = $( "[for='" + apex.util.escapeCSS( lblId ) + "']" ).html() || "";
                    }
                } else {
                    // for checkbox based switch, we will return the on 
                    // or off label based if it matches the value or not
                    if ( pValues === lItem$.attr( "value" ) ) {
                        display = lItem$.attr( "data-on-label" );
                    } else if ( pValues === lItem$.attr( "data-off-value" ) ) {
                        display = lItem$.attr( "data-off-label" );
                    }
                }
            }
            return display;
        }
    });

}; // yesNo

})( apex.item, apex.jQuery, apex.util );