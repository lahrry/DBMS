/*!
 Copyright (c) 2020, 2021, Oracle and/or its affiliates. All rights reserved.
*/
/*
 * The single checkbox item of Oracle APEX.
 */
(function( item, $, util, debug ) {
    "use strict";

    const C_CHECKBOX = "u-checkbox",
        P_DISABLED = "disabled";

    let checkboxItemPrototype = {
        item_type: "SINGLE_CHECKBOX",
        enable: function () {
            this.element.prop( P_DISABLED, false );
        },
        disable: function () {
            this.element.prop( P_DISABLED, true );
        },
        isDisabled: function () {
            return this.element.prop( P_DISABLED ) === true;
        },
        setValue: function ( value ) {
            if ( value !== this._checkedValue && value !== this._uncheckedValue ) {
                debug.warn("Checkbox item corrected invalid set value.");
                value = this._uncheckedValue;
            }
            this.element.prev().val( value );
            this.node.checked = value === this._checkedValue;
        },
        getValue: function () {
            return $( "#" + util.escapeCSS( this.id + "_HIDDENVALUE" ) ).val();
        },
        isChanged: function () {
            return this.node.defaultChecked !== ( this.getValue() === this._checkedValue );
        },
        setStyleTo: function() {
            return this.element.parent().find( "." + C_CHECKBOX );
        },
        displayValueFor: function ( value, state ) {
            let checked =  value === this._checkedValue,
                text = apex.lang.getMessage( "APEX.ITEM_TYPE.CHECKBOX." + ( checked ? "CHECKED" : "UNCHECKED" ) );

            // Checkbox diaplayValueFor is mainly intended to be used in a grid view or something like it and with the
            // model. It allows interaction with the checkbox as part of the fly-weight pattern. So the model value
            // can be changed while in navigation mode. It can also be used to provide a visual representation of the
            // checkbox rather than just static text.
            // The state parameter contains information from the model about the state of the value.
            // If there is no state or it is readonly or disabled then the user cannot interact with the value
            // and a simple span with pseudo checkbox markup is returned.
            // If there is state but it is not disabled or readonly then a real checkbox input is used as part of the
            // markup for accessibility but it is still not the full markup of a checkbox item.
            // In both cases text is included that says if the checkbox is checked. In the first case it is for the benefit
            // of AT and in the other it is just for copy to clip board.
            if ( !state || state.disabled || state.readonly ) {
                return "<span class='" + C_CHECKBOX + ( checked ? " is-checked" : "" ) +
                    "'><span class='u-vh'>" + text + "</span></span>";
            } else {
                return "<div class='apex-item-single-checkbox'><input type='checkbox'" +
                    ( checked ? " checked" : "" ) + " tabindex='-1'><span class='" + C_CHECKBOX +
                    "'></span><span class='u-vh' aria-hidden='true'>" + text + "</span></div>";
            }
        },
        // IG integration:  Internal use only for now.
        getInteractionSelector: function() {
            return "." + C_CHECKBOX + ",.apex-item-single-checkbox";
        },
        // todo consider need to influence grid tabbableCellContent for now input added to default
        // todo future clickable overlay
        onInteraction: function( event, model, record, field ) {
            let val;

            if ( event.type === "keydown" ) {
                return; // this turns into a click and we will be called again then
            } else if ( event.type === "click" ) {
                // check event?
                val = model.getValue( record, field );
                val = val === this._checkedValue ? this._uncheckedValue : this._checkedValue;
                model.setValue( record, field, val );
            } else if ( event.type === "activate" ) {
                val = this.getValue();
                val = val === this._checkedValue ? this._uncheckedValue : this._checkedValue;
                this.setValue( val );
            }
            return false;
        },
        // For the case where the label comes from model column configuration.
        setLabel: function( label ) {
            if ( label !== this._label ) {
                this._label = label;
                if ( label ) {
                    this.element.parent().find( "." + C_CHECKBOX )
                        .replaceWith( "<label class='" + C_CHECKBOX + "' for='" + this.id + "'>" + label + "</label>" );
                } else {
                    this.element.parent().find( "." + C_CHECKBOX )
                        .replaceWith( "<span class='" + C_CHECKBOX + "'></span>" );
                }
            }
        }
    };

    function attachSingleCheckbox( context$ ) {
        /*
         * expected markup:
         * <div class="apex-item-single-checkbox">
         *   <input type="hidden" name="{NAME}" id="{NAME}_HIDDENVALUE" value="{INITIAL_VALUE}">
         *   <input type="checkbox" id="{NAME}" value="{Y}" [checked] [disabled] data-unchecked-value="{N}">
         * </div>
         * The checked attribute is only present when the initial value equals the checked value.
         * The disabled attribute is present if the item is readonly or printer friendly and there must also be a
         * session state protection hidden input before the checkbox input.
         * If there is a label (label where for attribute value is {name}) it is appended to the div otherwise
         * <span class="u-checkbox"></span> is appended.
         * The label has its class set to u-checkbox.
         *
         * Checkbox quirks:
         * While a little odd these behaviors are consistent and intended.
         * In general a disabled checkbox will cause an error on submit because disabled items send empty string.
         * In general the isEmpty method always returns false.
         * The exception to both of the above is when the off value is empty string.
         */
        $( ".apex-item-single-checkbox > input[type='checkbox']", context$ ).each( ( _, el ) => {
            let label$, value, thisItem,
                cbItem$ = $( el ),
                w$ = cbItem$.parent(),
                id = el.id, // escape to use
                hidden$ = $( "#" + util.escapeCSS( id + "_HIDDENVALUE" ) ),
                onValue = cbItem$.attr( "value" ) || "Y",
                offValue = cbItem$.attr( "data-unchecked-value");

            // empty string is a valid offValue so can't use || to default like onValue
            if ( offValue === undefined ) {
                offValue = "N";
            }

            // move label if there is one and not already directly following input
            label$ = cbItem$.next( "label" );
            if ( !label$.length ) {
                // if a label doesn't follow the input then move it there if it exists
                label$ = $( 'label[for="' + util.escapeCSS( id ) + '"]' );
                if ( !label$.length ) {
                    // otherwise add a placeholder for the pseudo checkbox
                    label$ = $( '<span class="' + C_CHECKBOX + '"></span>' );
                } else {
                    // remove any existing classes and add u-checkbox to label
                    label$.attr( "class", C_CHECKBOX );
                }
                w$.append( label$ );
            }

            // the hidden item must have either the on or off value
            value = hidden$.val();
            if ( value !== onValue && value !== offValue ) {
                value = offValue;
                hidden$.val( value );
                debug.warn("Checkbox item corrected invalid initial value.");
            }

            // the checkbox input checked state must match the hidden input value
            if ( cbItem$[0].checked !== ( value === onValue ) ) {
                cbItem$[0].checked = cbItem$[0].defaultChecked = ( value === onValue );
                debug.warn("Checkbox item initial checked state adjusted to match value.");
            }

            // Click handler to keep hidden value in sync
            // mousedown handler on pseudo checkbox to stand in for label
            cbItem$.click( () => {
                hidden$.val( cbItem$[0].checked ? onValue : offValue );
            } ).parent().on( "mousedown", "span." + C_CHECKBOX, event => {
                cbItem$[0].focus();
                cbItem$.trigger("click");
                event.preventDefault();
            } );

            item.create( id, checkboxItemPrototype );
            thisItem = item( id );
            thisItem._checkedValue = onValue;
            thisItem._uncheckedValue = offValue;
        } );
    }

    // register updateSingleCheckbox to run again when needed
    item.addAttachHandler( attachSingleCheckbox );

})( apex.item, apex.jQuery, apex.util, apex.debug );