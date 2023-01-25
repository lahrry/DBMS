/*!
 Copyright (c) 2012, 2022, Oracle and/or its affiliates. All rights reserved.
*/
/*
 * The {@link apex.widget}.selectList is used for the select list widget of Oracle APEX.
 */
(function( widget, util, $ ) {
"use strict";

/**
 * @param {String} pSelector  jQuery selector to identify APEX page item(s) for this widget.
 * @param {Object} [pOptions]
 *
 * @function selectList
 * @memberOf apex.widget
 * */
widget.selectList = function( pSelector, pOptions ) {

    // Default our options and store them with the "global" prefix, because it's
    // used by the different functions as closure
    var gOptions     = $.extend({
                           optionAttributes: null,
                           nullValue:        ""
                           }, pOptions ),
        gSelectList$ = $( pSelector, apex.gPageContext$ );

    // Register apex.item callbacks
    gSelectList$.each( function() {

        var lItemImpl = {
                nullValue: gOptions.nullValue
            };

        // If this is a cascading LOV, we need to define a reinit callback...
        if ( gOptions.dependingOnSelector ) {

            lItemImpl.reinit = function( pValue, pDisplayValue ) {
                var self = this,
                    lValue = pValue,
                    lDisplayValue = pDisplayValue || lValue;

                // Clear current options
                if ( "nullValue" in pOptions ) {

                    // Except null value option if there is one
                    $( 'option[value!="' + util.escapeCSS( lItemImpl.nullValue ) + '"]', gSelectList$ ).remove();
                } else {
                    $( 'option', gSelectList$ ).remove();
                }

                // If the value is not the null value (or there is no null value), add a new option for the value
                // (used as intermittent storage until cascade call returns).
                if ( pOptions.nullValue !== lValue ) {
                    gSelectList$.append( "<option value='" + util.escapeHTML( lValue ) + "'>" + util.escapeHTML( lDisplayValue ) + "</option>" );
                }

                // set value and suppress change event
                this.setValue( lValue, null, true );

                // return function for cascade: don't clear value, get new values, and set
                return function() {

                    // get new values and set in the callback
                    widget.util.cascadingLov(
                        gSelectList$,
                        gOptions.ajaxIdentifier,
                        {
                            pageItems: $( gOptions.pageItemsToSubmit, apex.gPageContext$ )
                        },
                        {
                            optimizeRefresh: gOptions.optimizeRefresh,
                            dependingOn: $( gOptions.dependingOnSelector, apex.gPageContext$ ),
                            success: function( pData ) {
                                _clearList();
                                _addResult( pData );

                                // suppress change event because this is just reinstating the value that was already there
                                self.setValue( lValue, null, true );

                            },
                            target: self.node
                        }
                    );
                };
            };
        }

        lItemImpl.hasDisplayValue = function() {
            // when item has multiple selection just check if there are options
            let lAttr = $( this.element ).attr( "multiple" );
            if ( typeof lAttr !== typeof undefined && lAttr !== false ) {
                // item has only no display value when there are no options to select
                return ( $( this.element ).children().length > 0 ) ? true : false;
            } else {
                // check if selected tag has a text value
                let lselectedText = $( this.element ).find( ":selected" ).text();
                return ( lselectedText && lselectedText.length > 0 ) ? true : false;
            }
        };

        apex.item.create( this.id, lItemImpl );
    });

    // Clears the existing options
    function _clearList() {
        // remove everything except of the null value. If no null value is defined,
        // all options will be removed (bug #14738837)
        if ( "nullValue" in pOptions ) {
            $( 'option[value!="' + util.escapeCSS( gOptions.nullValue ) + '"]', gSelectList$ ).remove();
        } else {
            $( 'option', gSelectList$ ).remove();
        }
        // remove all the option groups
        $( 'optgroup', gSelectList$ ).remove();
    } // _clearList

    // Called by the AJAX success callback and adds the entries stored in the
    // JSON structure: {"values":[{"r":"10","d":"SALES","g":"AMERICAS"},...], "default":"xxx"}
    function _addResult( pData ) {
        var i, lPrevRow, lThisRow, lNextRow,
            lHtml = "";

        // Create an HTML string first and append it, that's faster.
        // Return 'r', display 'd' and group 'g' are HTML escaped on the server
        for ( i = 0; i < pData.values.length; i++ ) {
            lPrevRow = pData.values[ i - 1 ];
            lThisRow = pData.values[ i ];
            lNextRow = pData.values[ i + 1 ];

            /*
             * If there are groups, we need the OPTGROUP tag
             */

            if ( lThisRow.g ) {

                // If either there is no prev row (so this is the first), or there is a previous row and it's different,
                // open the OPTGROUP.
                if ( !lPrevRow || lPrevRow.g !==  lThisRow.g ) {
                    lHtml = lHtml + '<optgroup label="' + lThisRow.g + '">';
                }
            }
            
            // If either d or r is null, then render an empty string. This is valid and consistent with how the server deals with null values
            lHtml = lHtml + '<option value="' + ( lThisRow.r ? lThisRow.r : "" ) + '" ' + ( gOptions.optionAttributes ? gOptions.optionAttributes : "" ) + '>' + 
                                ( lThisRow.d ? lThisRow.d : "" ) + 
                            '</option>';

            if ( lThisRow.g ) {

                // If either there is no next row (so this is the last), or there is a next row and it's different,
                // close the OPTGROUP
                if ( !lNextRow || lNextRow.g !== lThisRow.g ) {
                    lHtml = lHtml + '</optgroup>';
                }
            }
        }

        gSelectList$.append( lHtml );
    } // _addResult

    // Clears the existing options and executes an AJAX call to get new values based
    // on the depending on fields
    function refresh( pEvent ) {

        widget.util.cascadingLov(
            gSelectList$,
            gOptions.ajaxIdentifier,
            {
                pageItems: $( gOptions.pageItemsToSubmit, apex.gPageContext$ )
            },
            {
                optimizeRefresh: gOptions.optimizeRefresh,
                dependingOn:     $( gOptions.dependingOnSelector, apex.gPageContext$ ),
                success:         function( pData ) {

                    _addResult( pData );

                    // Set the default value of the page item.
                    // The change event is also needed by cascading LOVs so that they are refreshed with the
                    // current selected value as well (bug# 9907473)
                    $s( gSelectList$[0], pData.default );

                },
                clear:           _clearList,
                target:          pEvent.target
            });

    } // refresh

    // if it's a cascading select list we have to register apexbeforerefresh and change events for our masters
    if ( gOptions.dependingOnSelector ) {

        $( gOptions.dependingOnSelector, apex.gPageContext$ )
            .on( "change", refresh );

    }

    // register the refresh event which is triggered by a manual refresh
    gSelectList$.on( "apexrefresh", refresh );

}; // selectList

})( apex.widget, apex.util, apex.jQuery );
