/*!
 Copyright (c) 2012, 2022 Oracle and/or its affiliates.
*/
/**
 * <p>The apex.util namespace contains general utility functions of Oracle APEX.</p>
 *
 * @namespace
 */
apex.util = (function( $, debug, env ) {
    "use strict";

    function escapeRegExp( pValue ) {
        if ( typeof pValue === "string" ) {
            return pValue.replace(/([.$*+\-?(){}|^[\]\\])/g,'\\$1');
        } // else
        return "";
    } // escapeRegExp

    function escapeHTML( pValue ) {
        return pValue.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#x27;") // xss prevention recommendation says this is better than &apos; but doesn't say why
            .replace(/\//g, "&#x2F;"); // because it is part of the tag end
    } // escapeHTML

    function escapeHTMLAttr( pValue ) {
        // note for legacy reasons this converts to a string but escapeHTML does not
        pValue = "" + pValue; // make sure pValue is a string
        return pValue.replace(/[^A-Za-z0-9\-_.,]/ug, function( m ) {
            let hex = m.codePointAt().toString( 16 ).toUpperCase();
            if ( hex.length % 2 !== 0 ) {
                hex = "0" + hex;
            }
            return "&#x" + hex + ";";
        });
    } // escapeHTMLAttr    

    const escapeHTMLContent = function( s ) {
        return escapeHTML( "" + s );
    };

    /*
     * For iterating over object property keys (not symbol keys)
     * Use like:
     *   for ( const [k, v] of objectEntries(myObject) ) { ... }
     * Use in place of
     *   for ( let k in myObject ) {
     *       if ( myObject.hasOwnProperty( k ) ) { ...
     * But also consider if a Map would be better than an Object
     */
    let objectEntries = function* ( obj ) {
        const propKeys = obj ? Object.keys( obj ) : [];

        for (const propKey of propKeys) {
            yield [propKey, obj[propKey]];
        }
    };

    /*
     * Use this in place of myObj.hasOwnProperty("X")
     */
    let hasOwnProperty = ( o, p ) => {
        return Object.prototype.hasOwnProperty.call( o, p);
    };

    /*
     *CSS meta-characters (based on list at http://api.jquery.com/category/selectors/)
     *Define a closure to just do the escaping once
     */
    const CSS_META_CHARS_REGEXP = new RegExp( "([" + escapeRegExp( " !#$%&'()*+,./:;<=>?@[\\]^`{|}~" + '"' ) + "])", "g" ); // eslint-disable-line no-useless-concat

    /* for stripHTML */
    const STRIP_TAG_RE = /<[^<>]+>/;

    let gScrollbarSize = null,
        /*
         * Cache the top most APEX object. The top most APEX object is
         * the one in the window object closest to the top that we have access to.
         */
        gTopApex = null,
        gPageTemplateData = null,
        /*
         * Global list of templates used by applyTemplate
         */
        gTemplates = new Map();

    const gItemCache = new Map(),
        gNoItem = {node: false, element: {}, item_type: false, id: false};

    /* regular expressions used by applyTemplate */
    const SUBST_RE = /&(([A-Z0-9_$#]+(?:%[A-Za-z0-9_]+)?)|"([^"\r\n]+)")(!([A-Z]+))?\./g, // &item[!format]. or &"quoted-item"[!format] capture the item, quoted-item, and format.
        PROP_SUFFIX_RE = /%([A-Za-z0-9_]+)$/, // convention for pseudo property access name%prop
        HASH_OR_DIR_RE = /#([_$A-Z0-9]+)#|{([iIcClLeEoOwWaA{!]([^/\r\n]|\/(?!}))*)\/}/g, // #hash# or {directive/} capture the hash or directive
        DIR_RE = /^(!|\w+(?:\s+|$))(.*)?$/, // ! or word captured (the word is followed by space or eol that we don't care about) then all the rest captured
        COL_LABEL_RE = /^(.+)_LABEL$/, // legacy. better to use the label property
        PH_NAME_RE = /^[_$A-Z0-9]+$/,
        NAME_RE = /^[^"\r\n]+$/,
        SCRIPT_RE = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script\s*>/gi,
        LANG_RE = /\$[^$]*$/,
        ITEM_SEP_RE = /^"([^"]+)"\s+([^"&\r\n]+)$/,
        ARG_ASSIGNMENT_RE = /\n\s*([_$A-Z0-9]+)\s*:=/g,
        POSSIBLE_TEMPLATE_SUBST_RE = /[#&]|\/}/;

    const isArray = Array.isArray,
        extend = $.extend,
        gConditionOps = {
            // returns true if any of the v1 values are equal to v2
            "eq": function( v1, v2 )  {
                if ( isArray( v1 ) ) {
                    for (let i = 0; i < v1.length; i++) {
                        if ( v1[i] === v2 ) {
                            return true;
                        }
                    }
                    return false;
                } //  else
                return v1 === v2;
            },
            // returns true if none of the v1 values are equal to v2 (all of the v1 values are not equal to v2)
            "neq": function( v1, v2 ) {
                return !gConditionOps.eq( v1, v2 );
            },
            // returns true if the v1 is null, empty string, or an empty array
            "null": function( v1 ) {
                return v1 === null || v1 === "" || (isArray(v1) && v1.length === 0);
            },
            // returns true if v1 is not null and not empty string and not empty array
            "notnull": function( v1 ) {
                return !gConditionOps.null( v1 );
            },
            // returns true if any of the v1 values are in the comma separated list in v2
            "in": function( v1, v2 ) {
                if ( typeof v2 === "string" ) {
                    v2 = "," + v2 + ",";
                } else {
                    return false; // v2 must be a string
                }
                if ( isArray( v1 ) ) {
                    for ( let i = 0; i < v1.length; i++ ) {
                        if ( v2.indexOf( "," + v1[i] + "," ) >= 0 ) {
                            return true;
                        }
                    }
                    return false;
                } //  else
                return v2.indexOf( "," + v1 + "," ) >= 0;
            },
            // returns true if none of the v1 values are in the comma separated list in v2 (all of the v1 values are not in the comma separated list in v2)
            "notin": function( v1, v2 ) {
                return !gConditionOps.in( v1, v2 );
            }
            /* todo Consider
            "gt" returns true if the item is scalar and greater than value
            "gte" returns true if the item is scalar and greater than or equal to value
            "lt" returns true if the item is scalar and less than value
            "lte" returns true if the item is scalar and less than or equal to value
            "between"
            */
        };
    let gWatchConditionIndex = 1;

    /*
     * todo think should this be smarter about numeric attribute values?
     * todo consider an attrs method that takes a plain object
     */
    /**
     * <p>The htmlBuilder interface is used create HTML markup. It makes it easy to generate markup that is
     * well formed and properly escaped. It is simpler and safer than using string concatenation and doesn't
     * require the overhead of using a template library. For simple templates see {@link apex.util.applyTemplate}</p>
     *
     * @interface htmlBuilder
     * @example <caption>This example creates an HTML string consisting of a label and text input and inserts it
     *     into the DOM. Data to be mixed into the markup is in an options object. The options values will be
     *     properly escaped to avoid cross site scripting security issues. With an options object
     *     <code class="prettyprint">{ id: "nameInput", label: "Name", size: 10, maxChars: 15 }</code>
     *     the resulting markup will be:<br>
     *     <code>&lt;label for='nameInput'>Name&lt;/label>&lt;input type='text' id='nameInput' class='specialInput' size='10' maxlength='15' value='' /></code></caption>
     * var out = apex.util.htmlBuilder();
     * out.markup( "<label" )
     *     .attr( "for", options.id )
     *     .markup( ">" )
     *     .content( option.label )
     *     .markup( "</label><input type='text'" )
     *     .attr( "id", options.id )
     *     .attr( "class", "specialInput" )
     *     .optionalAttr( "title", options.title )
     *     .attr( "size", options.size )
     *     .attr( "maxlength",  options.maxChars )
     *     .attr( "value", "" )
     *     .markup( " />" );
     * $( "#myContainer", out.toString() );
     */
    /**
     * @lends htmlBuilder.prototype
     */
    const htmlBuilderPrototype = {
        /**
         * <p>Add markup.</p>
         * @param {string} pMarkup The markup to add. No escaping is done.
         * @return {this} This htmlBuilder instance for method chaining.
         */
        markup: function( pMarkup ) {
            this.html += pMarkup;
            return this;
        },
        /**
         * <p>Add an attribute.<p>
         * @param {string} [pName] Attribute name. A leading space and trailing = is added and the value is quoted.
         *     If not given just the value is added without being quoted.
         * @param {string} pValue Attribute value. This will be escaped.
         * @return {this} This htmlBuilder instance for method chaining.
         */
        attr: function( pName, pValue ) {
            if ( arguments.length === 1 ) { // name is optional
                pValue = pName;
                pName = null;
            }
            if ( pName ) {
                this.html += " " + pName + "='";
            }
            this.html += escapeHTMLAttr( pValue );
            if ( pName ) {
                this.html += "'";
            }
            return this;
        },
        /**
         * <p>Add an optional attribute. The attribute and its value is only added if the value is a non-empty
         * string or a non-zero number or true.</p>
         * @param {string} pName Attribute name. A leading space and trailing = is added and the value is quoted.
         * @param {string} pValue Attribute value. This will be escaped.
         * @return {this} This htmlBuilder instance for method chaining.
         */
        optionalAttr: function( pName, pValue ) {
            if (pValue && typeof pValue !== "object") {
                this.html += " " + pName + "='" + escapeHTMLAttr(pValue) + "'";
            }
            return this;
        },
        /**
         * <p>Add an optional Boolean attribute. The attribute is added only if the value is true.</p>
         * @param {string} pName Attribute name. A leading space is added.
         * @param {boolean} pValue If true the attribute is added. If false the attribute is not added.
         * @return {this} This htmlBuilder instance for method chaining.
         */
        optionalBoolAttr: function( pName, pValue ) {
            // must be boolean and must be true - not just truthy
            if ( pValue === true ) {
                this.html += " " + pName;
            }
            return this;
        },
        /**
         * <p>Add element content. The content is escaped.<p>
         * @param {string} pContent The content to add between an element open and closing tags.
         * @return {this} This htmlBuilder instance for method chaining.
         */
        content: function( pContent ) {
            this.html += escapeHTMLContent(pContent);
            return this;
        },
        /**
         * <p>Remove all markup from this builder interface instance. Use this when you want to reuse the builder
         * instance for new markup.</p>
         */
        clear: function() {
            this.html = "";
        },
        /**
         * <p>Return the HTML markup.</p>
         * @return {string} The markup that has been built so far.
         */
        toString: function() {
            return this.html;
        }
    };

    /**
     * @lends apex.util
     */
    const util = {

    /**
     * <p>Returns a new function that calls <code class="prettyprint">pFunction</code> but not until
     * <code class="prettyprint">pDelay</code> milliseconds after the last time the returned function is called.</p>
     *
     * @param {function} pFunction The function to call.
     * @param {number} pDelay The time to wait before calling the function in milliseconds.
     * @return {function} The debounced version of <code class="prettyprint">pFunction</code>.
     * @example <caption>This example calls the function formatValue in response to the user typing characters but only
     * after the user pauses typing. In a case like this formatValue would also be called from the blur event on the same item.</caption>
     * function formatValue() {
     *     var value = $v("P1_PHONE_NUMBER");
     *     // code to format value as a phone number
     *     $s("P1_PHONE_NUMBER_DISPLAY", value);
     * }
     * apex.jQuery( "#P1_PHONE_NUMBER" ).on( "keypress", apex.util.debounce( formatValue, 100 ) );
     */
    debounce: function( pFunction, pDelay ) {
        let timer;
        return function() {
            let args = arguments,
                context = this;

            clearTimeout( timer );
            timer = setTimeout( function() {
                timer = null;
                pFunction.apply( context, args );
            }, pDelay );
        };
    }, // debounce

    // todo consider if it would be nice if a = [1,2,3]; a === apex.util.toArray(a) // nice if true but currently not
    /**
     * <p>Function that returns an array based on the value passed in <code class="prettyprint">pValue</code>.</p>
     *
     * @param {string|*} pValue If this is a string, then the string will be split into an array using the
     *                          <code class="prettyprint">pSeparator</code> parameter.
     *                          If it's not a string, then we try to convert the value with
     *                          <code class="prettyprint">apex.jQuery.makeArray</code> to an array.
     * @param {string} [pSeparator=":"] Separator used to split a string passed in <code class="prettyprint">pValue</code>,
     *   defaults to colon if not specified. Only needed when <code class="prettyprint">pValue</code> is a string.
     *   It is ignored otherwise.
     * @return {Array}
     *
     * @example <caption>This example splits the string into an array with 3 items:
     * <code class="prettyprint">["Bags","Shoes","Shirts"]</code>.</caption>
     * lProducts = apex.util.toArray( "Bags:Shoes:Shirts" );
     * @example <caption>This example splits the string into an array just like in the previous example. The only
     * difference is the separator character is ",".</caption>
     * lProducts = apex.util.toArray( "Bags,Shoes,Shirts", "," );
     * @example <caption>This example returns the jQuery object as an array.</caption>
     * lTextFields = apex.util.toArray( jQuery("input[type=text]") );
     */
    toArray: function( pValue, pSeparator ) {
        let lSeparator, lReturn;

        // If pValue is a string, we have to split the string with the separator
        if ( typeof pValue === "string" ) {

            // Default separator to a colon, if not supplied
            if ( pSeparator === undefined ) {
                lSeparator = ":";
            } else {
                lSeparator = pSeparator;
            }

            // Split into an array, using the defined separator
            lReturn = pValue.split( lSeparator );

            // If it's not a string, we try to convert pValue to an array and return it
        } else {
            lReturn = $.makeArray( pValue );
        }
        return lReturn;
    }, // toArray

    /**
     * <p>Compare two arrays and return true if they have the same number of elements and
     * each element of the arrays is strictly equal to each other. Returns false otherwise.
     * This is a shallow comparison.</p>
     *
     * @param {Array} pArray1 The first array.
     * @param {Array} pArray2 The second array.
     * @return {boolean} true if a shallow comparison of the array items are equal
     * @example <caption>This example returns true.</caption>
     * apex.util.arrayEqual( [1,"two",3], [1, "two", 3] );
     * @example <caption>This example returns false.</caption>
     * apex.util.arrayEqual( [1,"two",3], [1, "two", "3"] );
     */
    arrayEqual: function(pArray1, pArray2) {
        let len = pArray1.length;

        if ( len !== pArray2.length ) {
            return false;
        } // else
        for ( let i = 0; i < len; i++ ) {
            if (pArray1[i] !== pArray2[i] ) {
                return false;
            }
        }
        return true;
    }, // arrayEqual

    /**
     * @ignore
     * @param pArray
     * @param pItem
     * @param pCompare
     * @returns {number}
     */
    binarySearch: function( pArray, pItem, pCompare ) {
        let k, cmp,
            s = 0,
            e = pArray.length - 1;

        while ( s <= e ) {
            // half way between
            k = (e + s) >> 1; // eslint-disable-line no-bitwise
            cmp = pCompare( pItem, pArray[k] );
            if ( cmp > 0 ) {
                s = k + 1;
            } else if( cmp < 0 ) {
                e = k - 1;
            } else {
                return k;
            }
        }
        return s;
    },

    /**
     * <p>Returns string <code class="prettyprint">pValue</code> with any special HTML characters in element content
     * context escaped to prevent cross site scripting (XSS) attacks. It escapes the characters: ampersand,
     * double quote, quote, less than, greater than, and forward slash.
     * It provides the same functionality as <code class="prettyprint">APEX_ESCAPE.HTML</code> (in extended mode) in PL/SQL.</p>
     *
     * <p>This function should always be used when inserting untrusted data into the DOM in element content context.</p>
     *
     * @function
     * @param {string} pValue The string that may contain special HTML characters to be escaped.
     * @return {string} The escaped string.
     *
     * @example <caption>This example appends text to a DOM element where the text comes from a page item called
     *     P1_UNTRUSTED_NAME. Data entered by the user cannot be trusted to not contain malicious markup.</caption>
     * apex.jQuery( "#show_user" ).append( apex.util.escapeHTML( $v("P1_UNTRUSTED_NAME") ) );
     */
    escapeHTML: escapeHTML,

    /**
     * <p>Returns string <code class="prettyprint">pValue</code> with any special HTML characters in attribute value
     * context escaped to prevent cross site scripting (XSS) attacks. It hex escapes everything that is not
     * alphanumeric or one of the following characters: comma, period, dash, underscore.
     * It provides the same functionality as <code class="prettyprint">APEX_ESCAPE.HTML_ATTRIBUTE</code> in PL/SQL.</p>
     *
     * <p>This function should always be used when inserting untrusted data into the DOM in attribute value context.</p>
     *
     * @function
     * @param {string} pValue The string that may contain special HTML characters to be escaped.
     * @return {string} The escaped string.
     *
     * @example <caption>This example sets the title of a DOM element where the text comes from a page item called
     *     P1_UNTRUSTED_NAME. Data entered by the user cannot be trusted to not contain malicious markup.</caption>
     * apex.jQuery( "#show_user" ).attr( "title", apex.util.escapeHTMLAttr( $v("P1_UNTRUSTED_NAME") ) );
     */
    escapeHTMLAttr: escapeHTMLAttr,

    /**
     * Function that returns a string where Regular Expression special characters (\.^$*+-?()[]{}|) are escaped which can
     * change the context in a regular expression. It has to be used to secure user input.
     *
     * @ignore
     * @param {string} pValue   String which should be escaped.
     * @return {string} The escaped string, or an empty string if pValue is null or undefined
     *
     * @example
     * searchValue = new RegExp( "^[-!]?" + apex.util.escapeRegExp( pInputText ) + "$" );
     *
     * @function escapeRegExp
     */
    escapeRegExp:  escapeRegExp,

    /**
     * <p>Returns string <code class="prettyprint">pValue</code> with any CSS meta-characters escaped.
     * Use this function when the value is used in a CSS selector.
     * Whenever possible if a value is going to be used as a selector, constrain the value so
     * that it cannot contain CSS meta-characters making it unnecessary to use this function.</p>
     *
     * @param {string} pValue The string that may contain CSS meta-characters to be escaped.
     * @return {string} The escaped string, or an empty string if pValue is null or undefined.
     * @example <caption>This example escapes an element id that contains a (.) period character so that it finds the
     *     element with id = "my.id". Without using this function the selector would have a completely
     *     different meaning.</caption>
     * apex.jQuery( "#" + apex.util.escapeCSS( "my.id" ) );
     */
    escapeCSS: function( pValue ) {
        if ( pValue ) {
            // first try to use CSS.escape (currently just a working draft but supported by all browsers we support)
            if ( CSS && CSS.escape ) {
                return CSS.escape( pValue );
            }
            // else fall back to our regex method (there is a poly-fill but it is much more complex and this simple
            // way has served us well so far)
            // Escape any meta-characters (based on list at http://api.jquery.com/category/selectors/)
            return pValue.replace( CSS_META_CHARS_REGEXP, "\\$1" );
        } // else
        return "";
    }, // escapeCSS

    /**
     * For internal use only
     * @ignore
     */
    getContextString: function() {
        return "p_context=" + $v( 'pContext' );
    },

    /**
     * <p>Return an {@link htmlBuilder} interface.</p>
     * @return {htmlBuilder}
     */
    htmlBuilder: function() {
        const that = Object.create( htmlBuilderPrototype );
        that.clear();
        return that;
    },

    // todo consider adding to doc needs unit tests
    /**
     * Creates a URL to an APEX application page from properties given in pArgs and information on the current page
     * pArgs is an object containing any of the following optional properties
     * - appId the application id (flow id). If undefined or falsey the value is taken from the current page
     * - pageId the page id (flow step id). If undefined or falsey the value is taken from the current page
     * - session the session (instance). If undefined or falsey the value is taken from the current page
     * - request a request string used for button processing. If undefined or falsey the value is taken from the current page
     * - debug YES, NO, LEVEL<n> sets the debug level. If undefined or falsey the value is taken from the current page
     * - clearCache a comma separated list of pages RP, APP, SESSION. The default is empty string
     * - itemNames an array of item names to set in session state
     * - itemValues an array of values corresponding to each item name in the itemNames array.
     * - todo consider a map alternative for items
     * - printerFriendly Yes or empty string. Default is empty string.
     *
     * @ignore
     * @param {object} pArgs
     * @return {string}
     */
    makeApplicationUrl: function ( pArgs ) {
        let lUrl = "f?p=";

        lUrl += pArgs.appId || env.APP_ID;
        lUrl += ":";
        lUrl += pArgs.pageId || env.APP_PAGE_ID;
        lUrl += ":";
        lUrl += pArgs.session || env.APP_SESSION;
        lUrl += ":";
        lUrl += pArgs.request || $v( "pRequest" );
        lUrl += ":";
        lUrl += pArgs.debug || $v( "pdebug" ) || "";
        lUrl += ":";
        lUrl += pArgs.clearCache || "";
        lUrl += ":";
        if ( pArgs.itemNames ) {
            lUrl += pArgs.itemNames.join( "," );
        }
        lUrl += ":";
        if (pArgs.itemValues) {
            for ( let i = 0; i < pArgs.itemValues.length; i++ ) {
                if ( i > 0 ) {
                    lUrl += ",";
                }
                lUrl += encodeURIComponent( pArgs.itemValues[ i ] );
            }
        }
        lUrl += ":";
        lUrl += pArgs.printerFriendly || "";

        return lUrl;
    },

    /**
     * <p>Function that renders a spinning alert to show the user that processing is taking place. Note that the alert is
     * defined as an ARIA alert so that assistive technologies such as screen readers are alerted to the processing status.</p>
     * <p>The spinner can be used with {@link apex.util.delayLinger} for better control over if, when, and for how long
     * it is shown.</p>
     *
     * @param {string|jQuery|Element} [pContainer] Optional jQuery selector, jQuery, or DOM element identifying the
     *     container within which you want to center the spinner. If not passed, the spinner will be centered on
     *     the whole page. The default is $("body").
     * @param {Object} [pOptions] Optional object with the following properties:
     * @param {string} [pOptions.alert] Alert text visually hidden, but available to Assistive Technologies.
     *     Defaults to "Processing".
     * @param {string} [pOptions.spinnerClass] Adds a custom class to the outer SPAN for custom styling.
     * @param {boolean} [pOptions.fixed] If true the spinner will be fixed and will not scroll. When fixed is true
     *     the pContainer parameter is ignored and the spinner is always appended to the body.
     * @return {jQuery} A jQuery object for the spinner. Use the jQuery remove method when processing is complete.
     * @example <caption>To show the spinner when processing starts.</caption>
     * var lSpinner$ = apex.util.showSpinner( $( "#container_id" ) );
     * @example <caption>To remove the spinner when processing ends.</caption>
     * lSpinner$.remove();
     */
    showSpinner: function( pContainer, pOptions ) {
        const out       = util.htmlBuilder(),
            lWindow$    = $( window );
        let lSpinner$, lLeft, lTop, lBottom, lYPosition, lYOffset,
            lOptions    = extend ({
                alert:          apex.lang.getMessage( "APEX.PROCESSING" ),
                spinnerClass:   ""
            }, pOptions ),
            // must distinguish between a selector and markup; find does $() doesn't
            lContainer$ = ( pContainer && !lOptions.fixed ) ? typeof pContainer === "string" ? $( document ).find( pContainer ) : $( pContainer ) : $( "body" ),
            lContainer  = lContainer$.offset(),
            lViewport   = {
                top:  lWindow$.scrollTop(),
                left: lWindow$.scrollLeft()
            };

        // The spinner markup
        out.markup( "<span" )
            .attr( "class", "u-Processing" + ( lOptions.spinnerClass ? " " + lOptions.spinnerClass : "" ) )
            .attr( "role", "alert" )
            .markup( ">" )
            .markup( "<span" )
            .attr( "class", "u-Processing-spinner" )
            .markup( ">" )
            .markup( "</span>" )
            .markup( "<span" )
            .attr( "class", "u-VisuallyHidden" )
            .markup( ">" )
            .content( lOptions.alert )
            .markup( "</span>" )
            .markup( "</span>" );

        // And render and position the spinner and overlay
        lSpinner$ = $( out.toString() );
        lSpinner$.appendTo( lContainer$ );

        if ( lOptions.fixed ) {
            lTop = ( lWindow$.height() - lSpinner$.height() ) / 2;
            lLeft = ( lWindow$.width() - lSpinner$.width() ) / 2;
            lSpinner$.css( {
                position: "fixed",
                top:  lTop + "px",
                left: lLeft +  "px"
            } );
        } else {
            // Calculate viewport bottom and right
            lViewport.bottom = lViewport.top + lWindow$.height();
            lViewport.right = lViewport.left + lWindow$.width();

            // Calculate container bottom and right
            lContainer.bottom = lContainer.top + lContainer$.outerHeight();
            lContainer.right = lContainer.left + lContainer$.outerWidth();

            // If top of container is visible, use that as the top, otherwise use viewport top
            if ( lContainer.top > lViewport.top ) {
                lTop = lContainer.top;
            } else {
                lTop = lViewport.top;
            }

            // If bottom of container is visible, use that as the bottom, otherwise use viewport bottom
            if ( lContainer.bottom < lViewport.bottom ) {
                lBottom = lContainer.bottom;
            } else {
                lBottom = lViewport.bottom;
            }
            lYPosition = ( lBottom - lTop ) / 2;

            // If top of container is not visible, Y position needs to add an offset equal hidden container height,
            // this is required because we are positioning in the container element
            lYOffset = lViewport.top - lContainer.top;
            if ( lYOffset > 0 ) {
                lYPosition = lYPosition + lYOffset;
            }

            lSpinner$.position({
                my:         "center",
                at:         "left+50% top+" + lYPosition + "px",
                of:         lContainer$,
                collision:  "fit"
            });
        }

        return lSpinner$;
    },

    /**
     * <p>The delayLinger namespace solves the problem of flashing progress indicators (such as spinners).</p>
     *
     * <p>For processes such as an Ajax request (and subsequent user interface updates) that may take a while
     * it is important to let the user know that something is happening.
     * The problem is that if an async process is quick there is no need for a progress indicator. The user
     * experiences the UI update as instantaneous. Showing and hiding a progress indicator around an async
     * process that lasts a very short time causes a flash of content that the user may not have time to fully perceive.
     * At best this can be a distraction and at worse the user wonders if something is wrong or if they missed something
     * important. Simply delaying the progress indicator doesn't solve the problem because the process
     * could finish a short time after the indicator is shown. The indicator must be shown for at least a short but
     * perceivable amount of time even if the request is already finished.</p>
     *
     * <p>You can use this namespace to help manage the duration of a progress indication such as
     * {@link apex.util.showSpinner} or with any other progress implementation. Many of the Oracle
     * APEX asynchronous functions such as the ones in the {@link apex.server} namespace
     * already use delayLinger internally so you only need this API for your own custom long running
     * asynchronous processing.</p>
     *
     * @namespace apex.util.delayLinger
     * @example <caption>This example shows using {@link apex.util.delayLinger.start} and
     *     {@link apex.util.delayLinger.finish} along with {@link apex.util.showSpinner} to show a
     *     progress spinner, only when needed and for long enough to be seen, around a long running asynchronus process
     *     started in function doLongProcess.</caption>
     * var lSpinner$, lPromise;
     * lPromise = doLongProcess();
     * apex.util.delayLinger.start( "main", function() {
     *     lSpinner$ = apex.util.showSpinner( $( "#container_id" ) );
     * } );
     * lPromise.always( function() {
     *     apex.util.delayLinger.finish( "main", function() {
     *         lSpinner$.remove();
     *     } );
     * } );
     */
    delayLinger: (function() {
        var scopes = {},
            busyDelay = 200,
            busyLinger = 1000; // visible for min 800ms

        function getScope( scopeName ) {
            var s = scopes[scopeName];
            if ( !s ) {
                s = {
                    count: 0,
                    timer: null
                };
                scopes[scopeName] = s;
            }
            return s;
        }

        function removeScope( scopeName ) {
            delete scopes[scopeName];
        }

        /**
         * @lends apex.util.delayLinger
         */
        const ns = {
            /**
             * <p>Call this function when a potentially long running async process starts. For each call to start with
             * a given pScopeName a corresponding call to finish with the same <code class="prettyprint">pScopeName</code> must be made.
             * Calls with different <code class="prettyprint">pScopeName</code> arguments will not interfere with each other.</p>
             *
             * <p>Multiple calls to start for the same <code class="prettyprint">pScopeName</code> before any calls to
             * finish is allowed but only the <code class="prettyprint">pAction</code> from the first call is called at most once.</p>
             *
             * @param {string} pScopeName A unique name for each unique progress indicator.
             * @param {function} pAction A no argument function to call to display the progress indicator.
             *     This function may or may not be called depending on how quickly finish is called.
             */
            start: function( pScopeName, pAction ) {
                var s = getScope( pScopeName );
                s.count += 1;
                if ( s.count === 1 && s.timer === null && !s.showing ) {
                    s.start = (new Date()).getTime();
                    s.timer = setTimeout( () => {
                        s.timer = null;
                        s.showing = true;
                        pAction();
                    }, busyDelay );
                }
            },

            /**
             * <p>Call this function when the potentially long running async process finishes. For each call to start with
             * a given <code class="prettyprint">pScopeName</code> a corresponding call to finish with
             * the same <code class="prettyprint">pScopeName</code> must be made.
             * The <code class="prettyprint">pAction</code> is called exactly once if and only if the corresponding
             * start <code class="prettyprint">pAction</code> was called.
             * If there are multiple calls to finish the <code class="prettyprint">pAction</code> from the last one is called.</p>
             *
             * @param {string} pScopeName A unique name for each unique progress indicator.
             * @param {function} pAction A no argument function to call to hide and/or remove the progress indicator.
             *     This function is only called if the action passed to start was called.
             */
            finish: function( pScopeName, pAction ) {
                var elapsed,
                    s = getScope( pScopeName );

                if ( s.count === 0 ) {
                    throw new Error( "delayLinger.finish called before start for scope " + pScopeName );
                }
                elapsed = (new Date()).getTime() - s.start;
                s.count -= 1;

                if ( s.count === 0 ) {
                    if ( s.timer === null) {
                        // the indicator is showing so don't flash it
                        if ( elapsed < busyLinger ) {
                            setTimeout( () => {
                                // during linger another start for this scope could have happened
                                if ( s.count === 0 ) {
                                    s.showing = false;
                                    pAction();
                                    removeScope( pScopeName );
                                }
                            }, busyLinger - elapsed);
                        } else {
                            s.showing = false;
                            pAction();
                            removeScope( pScopeName );
                        }
                    } else {
                        // the request(s) went quick no need for spinner
                        clearTimeout( s.timer );
                        s.timer = null;
                        removeScope( pScopeName );
                    }
                }
            }
        };
        return ns;
    })(),

    /**
     * @ignore
     * @param $e
     * @param h
     */
    setOuterHeight: function ( $e, h ) {
        $.each( ["borderTopWidth", "borderBottomWidth", "paddingTop", "paddingBottom", "marginTop", "marginBottom"], function( i, p ) {
            let v = parseInt( $e.css( p ), 10 );
            if ( !isNaN( v ) ) {
                h -= v;
            }
        });
        $e.height( h );
    },

    /**
     * @ignore
     * @param $e
     * @param w
     */
    setOuterWidth: function ( $e, w ) {
        $.each( ["borderLeftWidth", "borderRightWidth", "paddingLeft", "paddingRight", "marginLeft", "marginRight"], function( i, p ) {
            let v = parseInt( $e.css( p ), 10 );
            if ( !isNaN( v ) ) {
                w -= v;
            }
        });
        $e.width( w );
    },

    /**
     * Get a JavaScript Date object corresponding to the input date string which must be in simplified ISO 8601 format.
     * In the future Date.parse could be used but currently there are browsers we support that don't yet support the ISO 8601 format.
     * This implementation is a little stricter about what parts of the date and time can be defaulted. The year, month, and day are
     * always required. The whole time including the T can be omitted but if there is a time it must contain at least the hours
     * and minutes. The only supported time zone is "Z".
     *
     * This function is useful for turning the date strings returned by the
     * <code class="prettyprint">APEX_JSON.STRINGIFY</code> and <code class="prettyprint">APEX_JSON.WRITE</code>
     * procedures that take a DATE value into Date objects that the client can use.
     *
     * @param {string} pDateStr String representation of a date in simplified ISO 8601 format
     * @return {Date} Date object corresponding to the input date string.
     * @example <caption>This example returns a date object from the date string in result.dateString. For example
     * "1987-01-23T13:05:09.040Z"</caption>
     * var date1 getDateFromISO8601String( result.dateString );
     */
    getDateFromISO8601String: function( pDateStr ) {
        var date, year, month, day,
            hr = 0,
            min = 0,
            sec = 0,
            ms = 0,
            m = /^(\d\d\d\d)-(\d\d)-(\d\d)(T(\d\d):(\d\d)(:(\d\d)(.(\d\d\d))?)?Z?)?$/.exec( pDateStr );

        if ( !m ) {
            throw new Error( "Invalid date format" );
        }

        year = parseInt( m[1], 10 );
        month = parseInt( m[2], 10 ) - 1;
        day = parseInt( m[3], 10 );
        if ( m[5] ) {
            hr = parseInt( m[5], 10 );
            min = parseInt( m[6], 10 );
            if ( m[8] ) {
                sec = parseInt( m[8], 10 );
                if ( m[10] ) {
                    ms = parseInt( m[10], 10 );
                }
            }
        }
        date = new Date( Date.UTC( year, month, day, hr, min, sec, ms ) );
        return date;
    },

    // todo consider documenting this. People use it. needs unit tests
    /*
     * Return the apex object from the top most APEX window.
     * This is only needed in rare special cases involving iframes
     * Not for public use
     * @ignore
     */
    getTopApex: function() {
        var curWindow, lastApex;

        function get(w) {
            var a;
            try {
                a = w.apex || null;
            } catch( ex ) {
                a = null;
            }
            return a;
        }

        // return cached answer if any
        if ( gTopApex !== null ) {
            return gTopApex;
        }

        // try for the very top
        gTopApex = get( top );
        if ( gTopApex !== null ) {
            return gTopApex;
        }

        // stat at the current window and go up the parent chain until there is no apex that we can access
        curWindow = window;
        for (;;) {
            lastApex = get( curWindow );
            if ( lastApex === null || !curWindow.parent || curWindow.parent === curWindow ) {
                break;
            }
            gTopApex = lastApex;
            curWindow = curWindow.parent;
        }
        return gTopApex;
    },

    /**
     * <p>Gets the system scrollbar size for cases in which the addition or subtraction of a scrollbar
     * height or width would effect the layout of elements on the page. The page need not have a scrollbar on it
     * at the time of this call.</p>
     *
     * @returns {object} An object with height and width properties that describe any scrollbar on the page.
     * @example <caption>The following example returns an object such as <code class="prettyprint">{ width: 17, height: 17 }</code>. Note
     * the actual height and width depends on the Operating System and its various display settings.</caption>
     * var size = apex.util.getScrollbarSize();
     */
    getScrollbarSize: function() {
        // Store the scrollbar size, because it will not change during page run time, thus there is no
        // need to manipulate the dom every time this function is called.
        if ( gScrollbarSize === null ) {
            // To figure out how wide a scroll bar is, we need to create a fake element
            // and then measure the difference
            // between its offset width and the clientwidth.
            let scrollbarMeasure$ = $( "<div>" ).css({
                "width": "100px",
                "height": "100px",
                "overflow": "scroll",
                "position": "absolute",
                "top": "-9999px"
            }).appendTo( "body" );
            gScrollbarSize = {
                width: scrollbarMeasure$[0].offsetWidth - scrollbarMeasure$[0].clientWidth,
                height: scrollbarMeasure$[0].offsetHeight - scrollbarMeasure$[0].clientHeight
            };
            scrollbarMeasure$.remove();
        }
        return gScrollbarSize;
    },

    // todo consider if these are needed given our current browser support. Also they have very bad names
    /**
     * <p>Wrapper around requestAnimationFrame that can fallback to <code class="prettyprint">setTimeout</code>.
     * Calls the given function before next browser paint. See also {@link apex.util.cancelInvokeAfterPaint}.</p>
     * <p>See HTML documentation for <code class="prettyprint">window.requestAnimationFrame</code> for details.</p>
     *
     * @function
     * @param {function} pFunction function to call after paint
     * @returns {*} id An id that can be passed to {@link apex.util.cancelInvokeAfterPaint}
     * @example <caption>This example will call the function myAnimationFunction before the next browser repaint.</caption>
     * var id = apex.util.invokeAfterPaint( myAnimationFunction );
     * // ... if needed it can be canceled
     * apex.util.cancelInvokeAfterPaint( id );
     */
    invokeAfterPaint: ( window.requestAnimationFrame || window.mozRequestAnimationFrame ||
            window.webkitRequestAnimationFrame ||
            function( pFunction ) {
                return window.setTimeout( pFunction, 0 );
            }
        ).bind( window ),

    /**
     * <p>Wrapper around cancelAnimationFrame that can fallback to <code class="prettyprint">clearTimeout</code>.
     * Cancels the callback using the id returned from {@link apex.util.invokeAfterPaint}.</p>
     *
     * @function
     * @param {*} pId The id returned from {@link apex.util.invokeAfterPaint}.
     * @example <caption>See example for function {@link apex.util.invokeAfterPaint}</caption>
     */
    cancelInvokeAfterPaint: ( window.cancelAnimationFrame || window.mozCancelAnimationFrame ||
            window.webkitCancelAnimationFrame ||
            function( pId ) {
                return window.clearTimeout( pId );
            }
        ).bind( window ),

    /**
     * <p>Returns string <code class="prettyprint">pText</code> with all HTML tags removed.</p>
     *
     * @param {string} pText The string that may contain HTML markup that you want removed.
     * @return {string} The input string with all HTML tags removed.
     * @example <caption>This example removes HTML tags from a text string.</caption>
     * apex.util.stripHTML( "Please <a href='www.example.com/ad'>click here</a>" );
     * // result: "Please click here"
     */
    stripHTML: function( pText ) {
        while ( STRIP_TAG_RE.exec( pText ) ) {
            pText = pText.replace( STRIP_TAG_RE, "" );
        }
        return pText;
    },

    /**
     * <p>Returns the nested object at the given path <code class="prettyprint">pPath</code> within the nested object structure in
     * <code class="prettyprint">pRootObject</code> creating any missing objects along the path as needed.
     * This function is useful when you want to set the value of a property in a deeply
     * nested object structure and one or more of the nested objects may or may not exist.
     * </p>
     *
     * @param {Object} pRootObject The root object of a nested object structure.
     * @param {string} pPath A dot (".") separated list of properties leading from the root object to the desired object
     *   to return.
     * @returns {Object}
     * @example <caption>This example sets the value of <code class="prettyprint">options.views.grid.features.cellRangeActions</code>
     * to <code class="prettyprint">false</code>.
     * It works even when the options object does not contain a views.grid.features object or a views.grid object
     * or even a views object.</caption>
     * var o = apex.util.getNestedObject( options, "views.grid.features" );
     * o.cellRangeActions = false; // now options.views.grid.features.cellRangeActions === false
     */
    getNestedObject: function( pRootObject, pPath) {
        let o = pRootObject;
        if ( pPath.length > 0 ) {
            pPath.split( "." ).forEach( function ( p ) {
                if ( o[p] === undefined ) {
                    o[p] = {};
                }
                o = o[p];
            } );
        }
        return o;
    },

    /**
     * Evaluate the given condition.
     *
     * @ignore
     * @param {Object} pCondition
     * @param {string} pCondition.op
     * @param {string} pCondition.item
     * @param {*} [pCondition.value]
     * @param {*} [pCondition.value2]
     * @param {Object} [pOptions] all the options supported by applyTemplate plus multiValued, doSubstitution
     * @returns {boolean}
     */
    checkCondition: function( pCondition, pOptions ) {
        let item, itemValue, value, value2;

        pOptions = pOptions || {};

        if ( pCondition.item ) {
            item = apex.item( pCondition.item );
            if ( !item.node ) {
                debug.warn("No such item: ", pCondition.item );
                return false; // item must exist
            }
            itemValue = item.getValue();
            if ( pOptions.multiValued && !isArray( itemValue ) && itemValue !== "" ) {
                itemValue = itemValue.split( ":" );
            }
            // todo check for column items
        }
        // todo option to trim, ignore line ending like rtrim_ws
        // todo consider standard_condition support colon separated lists as well, is [not] null or zero, never, always, page [not] in, page [not]eq, [not]is zero
        // todo consider data type
        if ( pCondition.value !== undefined ) {
            value = pCondition.value;
            if ( pOptions.doSubstitution && value.match( POSSIBLE_TEMPLATE_SUBST_RE ) ) {
                value = util.applyTemplate( value, pOptions );
            }
        }
        if ( pCondition.value2 !== undefined ) {
            value2 = pCondition.value2;
            if ( pOptions.doSubstitution && value2.match( POSSIBLE_TEMPLATE_SUBST_RE ) ) {
                value2 = util.applyTemplate( value2, pOptions );
            }
        }
        return !!gConditionOps[pCondition.op](itemValue, value, value2);
    },

    /**
     * @ignore
     * @param pCondition
     * @param pOptions
     * @param pCallback
     */
    watchCondition: function( pCondition, pOptions, pCallback ) {
        let item, lastValue,
            watchId = "watchCond" + gWatchConditionIndex;

        gWatchConditionIndex += 1;
        pOptions = pOptions || {};

        if ( pCondition.item ) {
            item = apex.item( pCondition.item );
            if ( !item.node ) {
                debug.warn("No such item: ", pCondition.item );
                return; // item must exist
            }
            $( item.node ).on( "change." + watchId, function() {
                let item = apex.item( pCondition.item ),
                    itemValue = item.getValue();

                if ( itemValue !== lastValue ) {
                    lastValue = itemValue;
                    pCallback( util.checkCondition( pCondition, pOptions ) );
                }
            } );
        }
        pCallback( util.checkCondition( pCondition, pOptions ) );
        return watchId;
    },

    unwatchCondition: function( pCondition, watchId ) {
        let item;

        if ( pCondition.item ) {
            item = apex.item( pCondition.item );
            if ( !item.node ) {
                return; // item must exist
            }
            $( item.node ).off( "change." + watchId );
        }
    },

    /**
     * Define one or more named templates.
     * todo doc
     * @ignore
     * @param {Object[]} pTemplates An array of template definitions
     * Template definition properties:
     * {string} name The template name.
     * {string} template The template text.
     * {Object[]} args
     * {string} args.name The name of the argument
     * {boolean} [args.required] If true the formal argument must be given and have a non-empty value. Any argument that
     *  is not required is optional and if no formal argument is given its value is empty string or the value of default if defined.
     * {string} [args.default] A default value to use if one is not supplied in {with/} {apply /}
     * {string} [args.escape] The actual argument value is escaped after any substitutions Possible values are "ATTR", "HTML", and "STRIPHTML"
     */
    // previously pTemplates could be an object where the property names are the template names and the property values are the template text.
    defineTemplates: function( pTemplates ) {

        if ( !isArray( pTemplates ) ) {
            // legacy, todo remove this
            for ( const [name, t] of objectEntries( pTemplates ) ) {
                if ( name.match( PH_NAME_RE ) ) {
                    gTemplates.set( name, {
                        name: name,
                        args: [],
                        template: t
                    } );
                } else {
                    debug.warn( "defineTemplates template with invalid name ignored: " + name );
                }
            }
        } else {
            for ( let i = 0; i < pTemplates.length; i++ ) {
                let template = pTemplates[i],
                    name = template.name;

                if ( name && name.match( PH_NAME_RE ) ) {
                    if ( template.template ) {
                        if ( !template.args ) {
                            template.args = [];
                        }
                        for ( let j = 0; j < template.args.length; j++ ) {
                            let arg = template.args[j];
                            if ( arg.required && arg.default ) {
                                delete arg.default;
                                debug.warn( "defineTemplates default value for required arg removed: " + name );
                            }
                            if ( arg.escape !== undefined && !["ATTR", "HTML", "STRIPHTML"].includes( arg.escape ) ) {
                                delete arg.escape;
                                debug.warn( "defineTemplates invalid escape value removed: " + name );
                            }
                            if ( !arg.name || !arg.name.match( PH_NAME_RE )) {
                                template.args.splice( j, 1 ); // remove this no-name argument
                                j -= 1;
                                debug.warn( "defineTemplates argument with missing or invalid name removed: " + name );
                            }
                        }
                        gTemplates.set( name, template );
                    } else {
                        debug.warn( "defineTemplates missing template ignored: " + name );
                    }
                } else {
                    debug.warn( "defineTemplates template with invalid name ignored: " + name );
                }
            }
        }
    },


    /**
     * List all the defined template names.
     * @ignore
     * @returns {string[]}
     */
    listTemplates: function() {
        return [...gTemplates.keys()];
    },

    /**
     * Get the template definition for the given template name.
     * @ignore
     * @param pTemplateName
     * @returns {object|null}
     */
    getTemplateDef: function( pTemplateName ) {
        return gTemplates.get( pTemplateName ) || null;
    },

    /**
     * <p>This function applies data to a template. It processes the template string given in
     * <code class="prettyprint">pTemplate</code> by substituting
     * values according to the options in <code class="prettyprint">pOptions</code>.
     * The template supports APEX server style placeholder and item substitution syntax.</p>
     *
     * <p>This function is intended to process APEX style templates in the browser.
     * However it doesn't have access to all the data that the server has. When substituting page items and column
     * items it uses the current value stored in the browser not what is in session state on the server.
     * It does not support the old non-exact substitutions (with no trailing dot e.g. &ITEM). It does not support
     * the old column reference syntax that uses #COLUMN_NAME#. It cannot call
     * <code class="prettyprint">PREPARE_URL</code> (this must be done on the server).
     * Using a template to insert JavaScript into the DOM is not supported.
     * After processing the template all script tags are removed.</p>
     *
     * <p>The format of a template string is any text intermixed with any number of replacement tokens
     * or directives. Two kinds of replacement tokens are supported: placeholders and data substitutions.
     * Directives control the processing of the template. Directives are processed first, then placeholders and finally
     * data subsitutions.</p>
     *
     * <div class="hw">
     * <h3 id="placeholders-section">Placeholders</h3>
     * <a class="bookmarkable-link" title="Bookmarkable Link" aria-label="Bookmark Placeholders" href="#placeholders-section"></a>
     * </div>
     * <p>This is also known as a hash substitution.</p>
     * <p>Placeholder syntax is:</p>
     * <pre class="prettyprint"><code>#&lt;placeholder-name>#
     * </code></pre>
     * <p>The &lt;placeholder-name> is an uppercase alpha numeric plus "_", and "$" string that must be a property
     * name in option object <code class="prettyprint">placeholders</code> that gets replaced with the property value.
     * Any placeholder tokens that don't match anything in the placeholders object are left as is (searching for the
     * next placeholder begins with the trailing # character).</p>
     *
     * <div class="hw">
     * <h3 id="substitutions-section">Data substitutions</h3>
     * <a class="bookmarkable-link" title="Bookmarkable Link" aria-label="Bookmark Data substitutions" href="#substitutions-section"></a>
     * </div>
     * <p>Substitution syntax is any of the following:</p>
     * <pre class="prettyprint"><code>&&lt;item-name>.
     * &&lt;item-name>!&lt;escape-filter>.
     * &"&lt;quoted-item-name>".
     * &"&lt;quoted-item-name>"!&lt;escape-filter>.
     * &APP_TEXT$&lt;message-key>.
     * &APP_TEXT$&lt;message-key>!&lt;escape-filter>.
     * &"APP_TEXT$&lt;message-key>".
     * &"APP_TEXT$&lt;message-key>"!&lt;escape-filter>.
     * </code></pre>
     *
     * <p>The &lt;item-name> is an uppercase alpha numeric plus "_", "$", and "#" string. The &lt;quoted-item-name>
     * is a string of any characters except carriage return, line feed, and double quote.
     * In both cases the item name is the name of a page item (unless option <code class="prettyprint">includePageItems</code> is false),
     * a column item (if <code class="prettyprint">model</code> and <code class="prettyprint">record</code> options are given
     * or when looping over a model), a built-in substitution (unless option
     * <code class="prettyprint">includeBuiltinSubstitutions</code> is false),
     * or an extra substitution (if option <code class="prettyprint">extraSubstitutions</code> is given or within a
     * loop directive).</p>
     * <p>Note: While a quoted item name can contain almost any characters it cannot contain a placeholder or directive.
     * So for example <code class="prettyprint">&"X#Y#Z".</code> will not work if there is a placeholder named
     * <code class="prettyprint">Y</code> and <code class="prettyprint">&"X{if Y/}Z".</code> will not work
     * because <code class="prettyprint">if</code> is a directive.</p>
     *
     * <p>The &lt;item-name> can include a property reference. A "%" character separates the item-name from the property name.
     * For example <code class="prettyprint">&P1_NAME%LABEL.</code> will return the label of the P1_NAME item.
     * The property name is case insensitive for the following item and column properties. If the item value
     * is an object the property name is case sensitive and accesses the value of the object property with that name.</p>
     *
     * <p>The properties and the values they return for a page item are:</p>
     * <ul>
     *     <li><strong>LABEL</strong> - The item label.</li>
     *     <li><strong>DISPLAY</strong> - The display value of the item's current value.</li>
     *     <li><strong>CHANGED</strong> - "Y" if the item has been changed and "N" otherwise.</li>
     *     <li><strong>DISABLED</strong> - "Y" if the item is disabled and "N" otherwise.</li>
     * </ul>
     *
     * <p>The properties for a column item are:</p>
     * <ul>
     *     <li><strong>HEADING</strong> - The column heading text. The heading may include markup. If there is no heading
     *        the label will be used if there is one.</li>
     *     <li><strong>LABEL</strong> - The column label. If there is no label the heading will be used with markup removed.</li>
     *     <li><strong>DISPLAY</strong> - The display value of the column value for the current row/record.</li>
     *     <li><strong>HEADING_CLASS</strong> - Any CSS classes defined for the column heading.</li>
     *     <li><strong>COLUMN_CLASS</strong> - Any CSS classes defined for the column.</li>
     *     <li><strong>REQUIRED</strong> - "Y" if the column is required and "N" otherwise.</li>
     * </ul>
     *
     * <p>The &lt;message-key> is a message key suitable for use in {@link apex.lang.getMessage} and
     * is replaced with the localized message text for the given key. The message must already be loaded on the
     * client by setting the Text Message attribute <em>Used in JavaScript</em> to On or otherwise adding it such as with
     * {@link apex.lang.addMessages}.
     * If no replacement for a substitution can be found it is replaced with the message key. The language specifier
     * that is supported for server side message substitutions is not supported by the client and will be ignored
     * if present.</p>
     *
     * <p>When substituting a column item the given record of the given model is used to find a matching column name.
     * If not found and if the model has a parent model then the parent model's columns are checked.
     * This continues as long as there is a parent model. The order to resolve a data substitution is: message key,
     * column item, column item from ancestor models, page item, built-in substitutions, and finally extra substitutions.
     * For backward compatibility column items support the "_LABEL" suffix to access the defined column label.
     * For example if there is a column item named <code class="prettyprint">NOTE</code> the substitution
     * <code class="prettyprint">&NOTE_LABEL.</code> will return the label string for column <code class="prettyprint">NOTE</code>.
     * It is better to use the label property in this case, for example: <code class="prettyprint">&NOTE%label.</code>.</p>
     *
     * <p>The built-in substitution names are:</p>
     * <ul>
     * <li>&APP_USER.</li>
     * <li>&APP_ID.</li>
     * <li>&APP_PAGE_ID.</li>
     * <li>&APP_SESSION.</li>
     * <li>&APP_FILES.</li>
     * <li>&WORKSPACE_FILES.</li>
     * <li>&REQUEST.</li>
     * <li>&DEBUG.</li>
     * <li>&APEX_FILES.</li>
     * <li>&IMAGE_PREFIX. (legacy- use &APEX_FILES. instead)</li>
     * <li>&APEX_VERSION.</li>
     * <li>&APEX_BASE_VERSION.</li>
     * </ul>
     * 
     * <p>See {@link apex.env} for the meaning of these substitutions.</p>
     *
     * <p>The escape-filter controls how the replacement value is escaped or filtered. It can be one of the following
     * values:</p>
     * <ul>
     * <li>HTML the value will have HTML characters escaped using {@link apex.util.escapeHTML}.</li>
     * <li>ATTR the value will be escaped for an HTML attribute value context using {@link apex.util.escapeHTMLAttr}.</li>
     * <li>RAW does not change the value at all.</li>
     * <li>STRIPHTML the value will have HTML tags removed and HTML characters escaped.</li>
     * </ul>
     * <p>This will override any default escape filter set with option <code class="prettyprint">defaultEscapeFilter</code>
     * or from the column definition <code class="prettyprint">escape</code> property.</p>
     *
     * <div class="hw">
     * <h3 id="directives-section">Directives</h3>
     * <a class="bookmarkable-link" title="Bookmarkable Link" aria-label="Bookmark Directives" href="#directives-section"></a>
     * </div>
     * <p>Directive syntax is:</p>
     * <pre class="prettyprint"><code>{&lt;directive-name>[ &lt;directive-arguments>]/}
     * </code></pre>
     * <p>The directive name determines what it does as described below. Directive names are case insensitive.
     * There can be no whitespace between the open bracket "{" and the directive name.
     * Directives often come in sets that work together. A directive may have additional arguments.</p>
     *
     * <h4>If condition directives</h4>
     * <p>Syntax:</p>
     * <pre class="prettyprint"><code>{if [!][?|=]NAME/}
     * TRUE_TEMPLATE_TEXT
     * {elseif [!][?|=]NAME2/}
     * ELSE_TRUE_TEMPLATE_TEXT
     * {else/}
     * FALSE_TEMPLATE_TEXT
     * {endif/}
     * </code></pre>
     *
     * <p>The entire text from the <strong>if</strong> directive to the matching <strong>endif</strong> directive is
     * replaced with the processed template text following the first <strong>if</strong> or <strong>elseif</strong>
     * directive that evaluates to true or the template text following the <strong>else</strong>
     * directive if none are true. There must be an <strong>if</strong> and <strong>endif</strong> directive.
     * The <strong>elseif</strong> and <strong>else</strong> directives are optional.
     * There can be any number of <strong>elseif</strong> directives. The directives must go in the order shown.
     * <strong>If</strong> directives can be nested.
     * That means any of the template texts can contain another <strong>if</strong> directive.</p>
     *
     * <p>The <strong>if</strong> and <strong>elseif</strong> directives test the value of NAME
     * and if it is true process the following template text.
     * The NAME can be an item-name, quoted-item-name, or placeholder-name. The value of an item-name or quoted-item-name
     * is the value of that page item or column item. The value of a placeholder-name is the text of the placeholder.
     * If no data substitution or placeholder with that name exists then the value is empty string.</p>
     *
     * <p>A value is false if after trimming leading and trailing spaces it is an empty string,
     * or for a page item the item {@link item#isEmpty} method returns true,
     * or if the value is equal to any of the values in the <code class="prettyprint">falseValues</code> option.
     * Any value that is not false is true. If the name is prefixed with exclamation mark (!) operator then the logic is
     * negated and the following template text is processed if the value is false.</p>
     *
     * <p>The if condition directive handles both empty (or not empty) tests and Boolean true/false tests (using the
     * convention of character true/false values such as 'Y'/'N') at the same time. This results in confusion for
     * rare case where the intention is to test for not empty but the actual value is 'N', which is not empty but
     * still considered false. The optional '?' prefix operator can be used to explicitly test if the value is empty.
     * The optional '=' prefix operator can be used to explicitly test if the value is true or false.</p>
     *
     * <p>Example:<br>
     * The page contains items P1_TITLE, P_ICON, P1_DESCRIPTION, and P1_DETAILS and all have optional values.
     * The template outputs a default title if P1_TITLE is empty. An optional icon is shown only if there is a title.
     * The template output includes markup for the description if it is not empty or details if it is not empty and
     * nothing otherwise.</p>
     *
     * <pre class="prettyprint"><code>&lt;h3>{if ?P1_TITLE/}&P1_TITLE. {if P1_ICON/}&lt;span class="fa &P1_ICON.">&lt;/span>{endif/}
     * {else/}Untitled{endif/}&lt;/h3>
     * {if P1_DESCRIPTION/}
     *   &lt;p class="description">&P1_DESCRIPTION.&lt;/p>
     * {elseif P1_DETAILS/}
     *   &lt;p class="details">&P1_DETAILS.&lt;/p>
     * {endif/}
     * </code></pre>
     *
     * <h4>Case condition directives</h4>
     * <p>Syntax:</p>
     * <pre class="prettyprint"><code>{case NAME/}
     * {when string1/}
     * TEMPLATE_TEXT1
     * {when string2/}
     * TEMPLATE_TEXT2
     * {otherwise/}
     * TEMPLATE_TEXT
     * {endcase/}
     * </code></pre>
     *
     * <p>The entire text from the <strong>case</strong> directive to the matching <strong>endcase</strong> directive
     * is replaced with the processed template text after the <strong>when</strong> directive that matches the NAME value.
     * The value of NAME is compared with each of the strings in the <strong>when</strong> directive and if it is equal the following
     * template (TEMPLATE_TEXTn) is processed. If no <strong>when</strong> directive matches then the template after
     * the <strong>otherwise</strong> directive is processed if there is one. The <strong>otherwise</strong> directive is optional
     * but it must come at the end and there can only be one. <strong>Case</strong> directives can be nested.
     * That means any of the template texts can contain another <strong>case</strong> directive.</p>
     *
     * <p>The NAME can be an item-name, quoted-item-name, or placeholder-name. The value of an item-name or quoted-item-name
     * is the value of that page item or column item. The value of a placeholder-name is the text of the placeholder.
     * If no data substitution or placeholder with that name exists then the value is empty string. The NAME value and each string
     * is trimmed of leading and trailing spaces before comparison. The comparison is case sensitive.</p>
     *
     * <p>Example:<br>
     * The page contains items P1_NAME and P1_DETAILS, and P1_DETAIL_STYLE that can have a value of "FULL" or "BRIEF".
     * The intention is to control the markup according to the detail style.</p>
     * <pre class="prettyprint"><code>{case P1_DETAIL_STYLE/}
     * {when FULL/}
     *     &lt;div class="full">
     *         &lt;span>&P1_NAME!HTML.&lt;/span>
     *         &lt;p class="description">&P1_DETAILS!HTML.&lt;/p>
     *     &lt;/div>
     * {when BRIEF/}
     *   &lt;div class="brief">
     *       &lt;span>&P1_NAME!HTML.&lt;/span>
     *   &lt;/div>
     * {endcase/}
     * </code></pre>
     *
     * <h4>Loop directives</h4>
     * <p>Syntax:</p>
     * <pre class="prettyprint"><code>{loop ["SEP"] NAME/}
     * TEMPLATE_TEXT
     * {endloop/}</code></pre>
     * or
     * <pre class="prettyprint"><code>{loop MODEL_ID/}
     * TEMPLATE_TEXT
     * {endloop/}
     * </code></pre>
     *
     * <p>The entire text from the <strong>loop</strong> directive to the matching <strong>endloop</strong> directive is
     * replaced with the template text evaluated once for each item in the NAME value or each record in the
     * {@link model} with id MODEL_ID.</p>
     *
     * <p>In the first syntax, the NAME can be an item-name, quoted-item-name, or placeholder-name.
     * The value of an item-name or quoted-item-name is the value of that page item or column item.
     * The value of a placeholder-name is the text of the placeholder.
     * If no data substitution or placeholder with that name exists then the value is empty string. The NAME value should
     * be a separator delimited string that contains a list of items. The optional SEP argument defines the separator
     * character. The default separator is ":". If SEP is more than one character it is treated as a regular expression.</p>
     *
     * <p>Within the loop there are two extra data substitutions available:</p>
     * <ul>
     *     <li><strong>APEX$ITEM</strong> - This is the value of the current item in the list.</li>
     *     <li><strong>APEX$I</strong> - This is 1 based index of the current item in the list.</li>
     * </ul>
     *
     * <p>In the second syntax, the MODEL_ID identifies a model created with {@link apex.model.create} (this
     * includes models created by regions such as Interactive Grid and Cards).
     * If the MODEL_ID is omitted then the model passed in the <code class="prettyprint">pOptions.model</code>
     * property is used. A model name can either be a string or, for detail models, an array of this
     * form: <code class="prettyprint">["name", "instance"]</code> (see {@link model.ModelId}).
     * The MODEL_ID allows data substitutions as shown in the nested loop example below.</p>
     *
     * <p>Within the loop there are three extra data substitutions available:</p>
     * <ul>
     *     <li><strong>APEX$ID</strong> - This is the identity of the record. See {@link model#getRecordId}.</li>
     *     <li><strong>APEX$I</strong> - This is 1 based index of the current record.</li>
     *     <li><strong>APEX$META</strong> - This is an object with metadata about the current record. The metadata
     *     comes from {@link model.RecordMetadata} but in a form that is easier to use from templates.
     *     The object has these properties (case is significant):
     *     <ul>
     *     <li><strong>valid</strong> - This is "Y" (true) unless the record is deleted, an aggregate record
     *       or has an error or warning.</li>
     *     <li><strong>state</strong> - This is "O" for original, "D" for deleted, "I" for inserted,
     *       "U" for updated and empty string for non-data records.</li>
     *     <li><strong>allowedOperations</strong> - This is one of "" for no editing, "U" update only,
     *       "D" for delete only, "UD" for update and delete.</li>
     *     <li><strong>selected</strong> - This is "Y" (true) if the record is selected and "N" otherwise.
     *       This only applies if the view widget is keeping the selected state in the model.</li>
     *     <li><strong>agg</strong> - This is the aggregate name of an aggregate record (example: "SUM")
     *       or empty string otherwise.</li>
     *     <li><strong>highlight</strong> - This is the highlight name.</li>
     *     <li><strong>endControlBreak</strong> - This is "Y" (true) if this record marks the end of a control break.</li>
     *     <li><strong>grandTotal</strong> - This is "Y" (true) if this is an aggregate record and it is
     *       the grand total (overall value) for the aggregate.</li>
     *     <li><strong>errorMessage</strong> - This is the error message for the record if there is one.</li>
     *     <li><strong>warningMessage</strong> - This is the warning message for the record if there is one.</li>
     *     </ul></li>
     * </ul>
     *
     * <p>Example:<br>
     * The following example takes a page item, <code class="prettyprint">P1_TAGS</code> that contains a bar "|"
     * separated list of tags such as "apples|cherries|pears" and turns it into an HTML list that can be nicely styled.</p>
     * <pre class="prettyprint"><code>&lt;ul class="tags">{loop "|" P1_TAGS/}
     *   &lt;li class="tag-item">APEX$ITEM&lt;/li>
     * {endloop/}&lt;/ul>
     * </code></pre>
     *
     * <p>Example:<br>
     * The following example loops over a model with id "emp_grid" and turns it into a list of names.
     * The model includes EMPNO and ENAME columns. Aggregate and deleted records are not included.</p>
     * <pre class="prettyprint"><code>&lt;ul>{loop emp_grid/}{if APEX$META%valid/}
     * &lt;li id="list_&EMPNO!ATTR.">&ENAME.&lt;/li>
     * {endif/}{endloop/}&lt;/ul>
     * </code></pre>
     *
     * <p>Example:<br>
     * The following example shows a nested loop over master and detail models. This uses the sample DEPT and EMP
     * tables. It produces nested UL list elements.</p>
     * <p>Note the inner loop uses &DEPTNO. from the outer loop to form the model id of the detail model.</p>
     * <p>Note loops over models only include records that have already been fetched from the server and
     * detail models that have been created.</p>
     * For brevity the {if APEX$META%valid/} is omitted from the inner loop.</p>
     * <pre class="prettyprint"><code>&lt;ul>{loop dept_grid/}{if APEX$META%valid/}
     * &lt;li>&DNAME. - &LOC.:&lt;ul>{loop ["emp_grid", "&DEPTNO."]/}
     *   &lt;li>&ENAME.&lt;/li>
     *   {endloop/}&lt;/ul>&lt;/li>
     * {endif/}{endloop/}&lt;/ul>
     * </code></pre>
     *
     * <h4>Comments</h4>
     * <p>Syntax:</p>
     * <pre class="prettyprint"><code>{!&lt;comment-text>/}
     * </code></pre>
     *
     * <p>This directive is substituted with nothing. It allows adding comments to templates.
     * The comment-text can be any characters except new line and the "/}" sequence.</p>
     *
     * <p>Example:<br>
     * This example includes a comment reminding the developer to complete something. In this case
     * replace a hard coded English string with a localizable text message.</p>
     * <pre class="prettyprint"><code>&lt;span>Name: &P1_NAME.&lt;/span> {!to do replace Name: with text message/}
     * </code></pre>
     *
     * <h4>Escape open bracket "{"</h4>
     * <p>Syntax:</p>
     * <pre class="prettyprint"><code>{{/}
     * </code></pre>
     *
     * <p>In rare cases a lone open bracket "{" can be confused for the start of a directive if another directive
     * follows it on the same line.</p>
     *
     * <p>Example:<br>
     * This is an example where the open bracket "{" has to be escaped. </p>
     * <pre class="prettyprint"><code>&lt;span>The coordinates {{/}c, d} = {if VAL/}&VAL.{else/}unknown{endif/}&lt;/span>
     * </code></pre>
     * <p>Here are similar cases that don't require an escape.</p>
     * <pre class="prettyprint"><code>&lt;span>The coordinates { c, d } = {if VAL/}&VAL.{else/}unknown{endif/}&lt;/span>
     * </code></pre>
     * <pre class="prettyprint"><code>&lt;span>The coordinates {c, d} =
     * {if VAL/}&VAL.{else/}unknown{endif/}&lt;/span>
     * </code></pre>
     *
     * @param {string} pTemplate A template string with any number of replacement tokens as described above.
     * @param {Object} [pOptions] An options object with the following properties that specifies how the template
     *     is to be processed:
     * @param {Object} [pOptions.placeholders] An object map of placeholder names to values.  The default is null.
     * @param {boolean} [pOptions.directives] Specify if directives are processed. If true directives are processed.
     *    If false directives are ignored and remain part of the text. The default is true.
     * @param {string|false} [pOptions.defaultEscapeFilter] One of the above escape-filter values or false. The default is HTML.
     *    This is the escaping/filtering that is done if the substitution token doesn't specify an escape-filter.
     *    If a model column definition has an <code class="prettyprint">escape</code> property
     *    then it will override the default escaping.
     *    This can also be false to turn off escaping (even when the substitution token includes an escape-filter)
     *    for the case where the return value of <code class="prettyprint">applyTemplate</code> is going to be escaped.
     *    Setting <code class="prettyprint">defaultEscapeFilter</code> to false avoids double escaping when the
     *    template result is going to be passed to an API that does its own escaping.
     *    Note: when false the STRIPHTML escape-filter will still strip HTML tags but it will not HTML escape
     *    the result.
     * @param {boolean} [pOptions.includePageItems] If true the current value of page items are substituted.
     *     The default is true.
     * @param {model} [pOptions.model] The model interface used to get column item values. The default is null.
     * @param {model.Record} [pOptions.record] The record in the model to get column item values from.
     *     Option <code class="prettyprint">model</code> must also be provided. The default is null.
     * @param {Object} [pOptions.extraSubstitutions] An object map of extra substitutions. The default is an empty object.
     * @param {boolean} [pOptions.includeBuiltinSubstitutions] If true built-in substitutions such as APP_ID are done.
     *     The default is true.
     * @param {string[]} [pOptions.falseValues] An array of values that are considered false in if directive tests.
     *     Empty string and an item that doesn't exist are always considered false.
     *     The default is ["F", "f", "N", "n", "0"]
     * @param {function} [pOptions.iterationCallback] A function called during loop directive iteration before each
     *     item or record and just once before processing a template when options <code class="prettyprint">model</code>
     *     and <code class="prettyprint">record</code> are provided. The function signature is: <br>
     *     <code class="prettyprint">callback(loopArg, model, record, index, placeholders, extraSubstitutions)</code>.
     *     The <code class="prettyprint">index</code> parameter is the 0 based index of the item or record in the
     *     collection being iterated over. The <code class="prettyprint">extraSubstitutions</code> parameter is an
     *     object that contains the properties in the extraSubstitutions option passed to applyTemplate
     *     as well as any extra data substitutions defined by the loop directive.
     *     This allows making additional substitutions available to the template by assigning a value to a property
     *     of <code class="prettyprint">extraSubstitutions</code>. When looping over an item value the model and record
     *     parameters will be null. When called once before template processing (when options
     *     <code class="prettyprint">model</code> and <code class="prettyprint">record</code> are provided) the loopArg
     *     and index parameters will be null.
     *
     * @return {string} The template string with replacement tokens substituted with data values.
     *
     * @example <caption>This example inserts an image tag where the path to the image comes from the built-in
     * APEX_FILES substitution and a page item called P1_PROFILE_IMAGE_FILE.</caption>
     * apex.jQuery( "#photo" ).html(
     *     apex.util.applyTemplate(
     *         "<img src='&APEX_FILES.people/&P1_PROFILE_IMAGE_FILE.'>" ) );
     *
     * @example <caption>This example inserts a div with a message where the message text comes from a
     *     placeholder called MESSAGE.</caption>
     * var options = { placeholders: { MESSAGE: "All is well." } };
     * apex.jQuery( "#notification" ).html( apex.util.applyTemplate( "<div>#MESSAGE#</div>", options ) );
     */
    // todo doc directives with/apply
    // todo doc more item/column properties
    // pArgs, pModelStack are for internal use
    applyTemplate: function( pTemplate, pOptions, pArgs, pModelStack ) {
        let result, src, m, m2, pos, lastPos, ph, dir, value, doPlaceholders, doDirectives,
            tokenIndex, directive, lastTokenType,
            apexModel = apex.model,
            tokens = [],
            ifStack = [],
            caseStack = [],
            loopStack = [],
            modelStack = pModelStack || [],
            applyArgs = new Map();

        function getItem( name ) {
            let item = gItemCache.get( name );
            if ( !item ) {
                let el = apex.gPageContext$[0].getElementById( name );
                if ( el ) {
                    item = apex.item( el );
                } else {
                    item = gNoItem;
                }
                gItemCache.set( name, item );
            }
            return item.node ? item : null;
        }

        function makeMeta( meta ) {
            let op = "",
                state = "O"; // original

            if ( meta.agg ) {
                state = ""; // not a data record
            } if ( meta.deleted ) {
                state = "D"; // deleted
            } else if ( meta.inserted ) {
                state = "I"; // inserted
            } else if ( meta.updated ) {
                state = "U"; // updated
            }

            if ( meta.canEdit ) {
                op += "U";
            }
            if ( meta.canDelete ) {
                op += "D";
            }

            let returnMeta = {
                selected: !!meta.sel,
                state: state,
                allowedOperations: op,
                valid: !meta.deleted && !meta.agg && !meta.error && !meta.warn,
                agg: meta.agg || "",
                highlight: meta.highlight || "",
                endControlBreak: !!meta.endControlBreak,
                grandTotal: !!meta.grandTotal,
                errorMessage: meta.error ? meta.message : "",
                warningMessage: meta.warning ? meta.message : ""
            };
            return returnMeta;
        }

        const directives = {
                if: function ( index, arg ) {
                    let test,
                        stackFrame = {
                            matched: false
                        };

                    if ( !validName( arg ) ) {
                        return index;
                    }
                    test = testIfCondition( arg );
                    ifStack.push(stackFrame);
                    if ( test ) {
                        stackFrame.matched = true;
                        return index;
                    } // else
                    // look for the elseif or else block if there is one
                    return lookAhead( index, {else:1,elseif:1,endif:1}, "if", "endif" );
                },
                elseif: function( index, arg ) {
                    let test,
                        stackFrame = ifStack[ifStack.length -1];

                    if ( !validName( arg ) || checkMismatch( ifStack, "elseif", "if" ) ) {
                        return index;
                    }
                    test = testIfCondition( arg );
                    if ( stackFrame.hasElse ) {
                        debug.error( "applyTemplate 'elseif' must come before 'else'" );
                    }
                    if ( !stackFrame.matched && test ) {
                        stackFrame.matched = true;
                        return index;
                    } // else
                    // look for the elseif or else block if there is one
                    return lookAhead( index, {else:1,elseif:1,endif:1}, "if", "endif" );
                },
                else: function( index, arg ) {
                    let stackFrame = ifStack[ifStack.length -1];

                    checkNoArg( "else", arg );
                    if ( checkMismatch( ifStack, "else", "if" ) ) {
                        return index;
                    }
                    if ( stackFrame.hasElse ) {
                        debug.error( "applyTemplate 'if' must have only one 'else'" );
                    }
                    stackFrame.hasElse = true;
                    if ( !stackFrame.matched ) {
                        stackFrame.matched = true;
                        return index;
                    }
                    return lookAhead( index, {endif:1}, "if", "endif" );
                },
                endif: function( index, arg ) {
                    checkNoArg( "endif", arg );
                    if ( !checkMismatch( ifStack, "endif", "if" ) ) {
                        ifStack.pop();
                    }
                    return index;
                },
                case: function( index, arg ) {
                    let t,
                        stackFrame = {
                            matched: false
                        };

                    t = tokens[index];
                    if ( t.type === "text" && t.text.trim() === "" ) {
                        index += 1;
                    }
                    t = tokens[index];
                    if ( t.type === "directive" && t.name === "when" ) {
                        if ( !validName( arg ) ) {
                            return index;
                        }
                        caseStack.push(stackFrame);
                        stackFrame.value = dataOrPlaceholderValue( arg, false ).trim();
                    } else {
                        debug.error( "applyTemplate must have 'when' right after 'case'" );
                    }
                    return index;
                },
                when: function( index, arg ) {
                    let stackFrame = caseStack[caseStack.length -1];

                    if ( checkMismatch( caseStack, "when", "case" ) ) {
                        return index;
                    }
                    if ( stackFrame.hasOtherwise ) {
                        debug.error( "applyTemplate 'when' must come before 'otherwise'" );
                    }
                    if ( stackFrame.matched ) {
                        return lookAhead( index, {endcase:1}, "case", "endcase" );
                    }
                    if ( stackFrame.value === arg.trim() ) {
                        stackFrame.matched = true;
                        return index;
                    } // else
                    return lookAhead( index, {when:1,otherwise:1,endcase:1}, "case", "endcase" );
                },
                otherwise: function( index, arg ) {
                    let stackFrame = caseStack[caseStack.length -1];

                    checkNoArg( "otherwise", arg );
                    if ( checkMismatch( caseStack, "otherwise", "case" ) ) {
                        return index;
                    }
                    if ( stackFrame.hasOtherwise ) {
                        debug.error( "applyTemplate 'case' must have only one 'otherwise'" );
                    }
                    stackFrame.hasOtherwise = true;
                    if ( stackFrame.matched ) {
                        return lookAhead( index, {endcase:1}, "case", "endcase" );
                    }
                    stackFrame.matched = true;
                    return index;
                },
                endcase: function( index, arg ) {
                    checkNoArg( "endcase", arg );
                    if ( !checkMismatch( caseStack, "endcase", "case" ) ) {
                        caseStack.pop();
                    }
                    return index;
                },
                with: function( index /*, arg */ ) {
                    let i, m, t, formalArgName, pos, start, end, text,
                        withCount = 0,
                        mapText = "",
                        endIndex = lookAhead( index, {apply:1}, "with", "apply" );

                    for ( i = index; i < endIndex; i++ ) {
                        mapText += tokens[i].text;
                    }

                    index = i;
                    t = tokens[index];
                    if ( t && t.type === "directive" && t.name === "apply" ) {
                        applyArgs.clear();
                        m = ARG_ASSIGNMENT_RE.exec( mapText );
                        while ( m ) {
                            pos = m.index + m[0].length;
                            if ( withCount === 0 ) {
                                formalArgName = m[1];
                                start = pos;
                            }
                            m = ARG_ASSIGNMENT_RE.exec( mapText );
                            end = m ? m.index : mapText.length;
                            text = mapText.substring( pos, end );
                            if ( text.includes( "{with" ) ) {
                                withCount += 1;
                            }
                            if ( text.includes( "{apply" ) ) {
                                withCount -= (text.split("{apply").length - 1); // this counts the number of {apply substrings in text
                            }
                            if ( withCount === 0 ) {
                                applyArgs.set(formalArgName, mapText.substring( start, end ).trim());
                            }
                        }
                        // todo consider cache parsed args in with token
                    } else {
                        debug.error( "applyTemplate missing 'apply' after 'with'" );
                    }
                    return index;
                },
                apply: function( index, templateName ) {
                    let found = false;

                    if ( templateName ) {
                        let def = gTemplates.get( templateName );

                        if ( def ) {
                            found = true;
                            // call to applyTemplate JavaScript provides the new stack context for the template invocation
                            // copy any current args
                            let args = extend( {}, pArgs ),
                                formalArgs = def.args || [];

                            // check the formal args for any that are required or optional or have a default value
                            for ( let i = 0; i < formalArgs.length; i++ ) {
                                let formalArg = formalArgs[i],
                                    name = formalArg.name;

                                // Log an error if a required argument is not given or has an empty value
                                if ( formalArg.required === true && ( !applyArgs.has( name ) || applyArgs.get( name ) === "" ) ) {
                                    debug.error( "applyTemplate 'apply' missing required argument " + name );
                                }
                                // Supply a default or empty value for any formal arguments that are not given.
                                // Note required arguments are treated the same (get an empty value) but an error has already been logged
                                if ( !applyArgs.has( name ) ) {
                                    applyArgs.set( name, formalArg.default || "" );
                                }
                            }

                            // named template argument values are templates: evaluate (apply) each one
                            for ( const [p, value] of applyArgs.entries() ) {
                                let saveDefEscapeFilter, argValue,
                                    argEscapeAfter = null,
                                    formalArg = formalArgs.find( x => x.name === p );

                                if ( formalArg && formalArg.escape ) {
                                    argEscapeAfter = formalArg.escape; // invalid values removed when template defined
                                }
                                if ( value.match( POSSIBLE_TEMPLATE_SUBST_RE ) ) {
                                    saveDefEscapeFilter = pOptions.defaultEscapeFilter;
                                    if ( argEscapeAfter ) {
                                        pOptions.defaultEscapeFilter = false; // turn off escaping because the whole template result will be escaped
                                    }
                                    argValue = util.applyTemplate( value, pOptions, pArgs, modelStack );
                                    pOptions.defaultEscapeFilter = saveDefEscapeFilter;
                                } else {
                                    argValue = value;
                                }
                                if ( argEscapeAfter === "ATTR" ) {
                                    argValue = escapeHTMLAttr( argValue );
                                } else if ( argEscapeAfter === "HTML" ) {
                                    argValue = escapeHTML( argValue );
                                } else if ( argEscapeAfter === "STRIPHTML" ) {
                                    argValue = escapeHTML( util.stripHTML( argValue.replace( "&nbsp;", "" ) ) );
                                }
                                args[p] = argValue;
                            }
                            result += util.applyTemplate( def.template, pOptions, args );
                            applyArgs.clear();
                        }
                    }
                    if ( !found ) {
                        debug.warn( "applyTemplate 'apply' missing or unknown template name" );
                    }
                    return index;
                },
                loop: function( index, arg ) {
                    let model, value, items, extraData,
                        modelName,
                        endIndex = null,
                        stackFrame = {};

                    loopStack.push( stackFrame );
                    if ( arg ) {
                        modelName = substitute( arg ); // allow indirection in loop argument mainly for instance models
                        // first see if it is the id of a model (note that model names can have spaces in them)
                        if ( /^\[.*,.*]$/.test( modelName ) ) {
                            try {
                                // model ids can be an array like this ["NAME", "INSTANCE"]
                                modelName = JSON.parse( modelName );
                                // just do a few quick tests here, apex.model.get does more checking
                                if ( !( isArray( modelName ) && modelName.length === 2 ) ) {
                                    modelName = null;
                                }
                            } catch ( ex ) {
                                // it must have been a parse error. don't care about the details
                                modelName = null;
                            }
                        }
                        if ( modelName ) {
                            model = apexModel && apexModel.get( modelName );
                        }
                    } else {
                        // if no arg loop over given model
                        modelName = null;
                        model = pOptions.model;
                        if ( !model ) {
                            debug.error( "applyTemplate no model or item to loop over" );
                        }
                    }
                    if ( model ) {
                        extraData = pOptions.extraSubstitutions;
                        stackFrame.prevExtraData = extraData; // remember this previous one
                        // create a new object for extraSubstitutions with the previous one on the prototype chain
                        // this is done so that properties added by this loop and iterationCallback are removed after the iteration
                        extraData = pOptions.extraSubstitutions = Object.create(extraData);

                        stackFrame.model = model;
                        modelStack.push(stackFrame);

                        // todo consider adding a substitution that tells what non-empty detail models exist
                        //   not easy to do in general, for now as a workaround use iterationCallback
                        model.forEach( function ( record, rIndex, id ) {
                            let meta = model.getRecordMetadata( id );

                            lastTokenType = "directive";
                            stackFrame.record = record;
                            stackFrame.recMeta = meta;

                            // make rIndex and id available to loop template
                            extraData.APEX$I = "" + ( rIndex + 1 );
                            extraData.APEX$ID = id;
                            extraData.APEX$META = makeMeta( meta );
                            if ( pOptions.iterationCallback ) {
                                pOptions.iterationCallback( arg, model, record, rIndex, pOptions.placeholders, extraData );
                            }
                            endIndex = doLoopBody( tokens, index );
                        } );
                        pOptions.extraSubstitutions = stackFrame.prevExtraData;
                        if ( modelName ) {
                            apexModel.release( modelName );
                        }
                        modelStack.pop();
                        if ( endIndex !== null ) {
                            processToken( endIndex - 1 ); // process endloop directive
                        }
                    } else if ( arg ) {
                        // if there is an arg it could be for a multi valued item
                        let sep, name,
                            m = ITEM_SEP_RE.exec( arg );

                        if ( m ) {
                            sep = m[1];
                            name = m[2];
                        } else {
                            name = arg;
                            // no separator given and arg may be an item name
                            let item = getItem( name );
                            // fist check if it is an item and if the item defines the separator
                            if ( item ) {
                                sep = item.getSeparator();
                            }
                            // fall back to the default separator
                            sep = sep || ":";
                        }
                        if ( sep.length > 1 ) {
                            // treat it like a regular expression
                            sep = new RegExp( sep );
                        }
                        value = dataOrPlaceholderValue( name, true ); // get raw value which could be an array
                        if ( value ) {
                            extraData = pOptions.extraSubstitutions;
                            stackFrame.prevExtraData = extraData; // remember this previous one
                            // create a new object for extraSubstitutions with the previous one on the prototype chain
                            // this is done so that properties added by this loop and iterationCallback are removed after the iteration
                            extraData = pOptions.extraSubstitutions = Object.create(extraData);

                            if ( isArray( value ) ) {
                                items = value;
                            } else {
                                items = value.split( sep );
                            }
                            for ( let i = 0; i < items.length; i++ ) {
                                lastTokenType = "directive";

                                // todo consider allow naming them so can access ones in outer loop?
                                //   workaround is to do this in iterationCallback
                                extraData.APEX$I = "" + ( i + 1 );
                                extraData.APEX$ITEM = items[i];
                                if ( pOptions.iterationCallback ) {
                                    pOptions.iterationCallback( arg, null, null, i, pOptions.placeholders, extraData );
                                }
                                endIndex = doLoopBody( tokens, index );
                            }
                            pOptions.extraSubstitutions = stackFrame.prevExtraData;
                            if ( endIndex !== null ) {
                                processToken( endIndex - 1 ); // process endloop directive
                            }
                        }
                    }

                    // doLoopBody processed the endloop directive
                    // handle case when doLoopBody was never called because collection is empty.
                    if ( endIndex === null ) {
                        endIndex = lookAhead( index, {endloop:1}, "loop", "endloop" );
                        if ( endIndex < tokens.length ) {
                            endIndex = processToken( endIndex ); // process endloop directive
                        }
                    }
                    return endIndex;
                },
                endloop: function( index, arg ) {
                    checkNoArg( "endloop", arg );
                    if ( !checkMismatch( loopStack, "endloop", "loop" ) ) {
                        loopStack.pop();
                    }
                    return index;
                },
                "!": function ( index ) {
                    src = src.substring( pos + dir.length + 3 );
                    return index;
                }
            };

        function validName( name ) {
            if ( name == null || !NAME_RE.test( name ) ) {
                debug.error( "applyTemplate missing or invalid name for 'if', 'elseif', or 'case'" );
                return false;
            }
            return true;
        }

        function testIfCondition( cond ) {
            let test, type,
                item = null,
                not = false;

            // check for not operator !
            if ( cond.startsWith( "!" ) ) {
                not = true;
                cond = cond.substr( 1 ).trim();
            }
            // check for condition type operator ? or =
            type = cond.substr( 0, 1 );
            if ( "?=".includes( type ) ) {
                cond = cond.substr( 1 ).trim();
            } else {
                type = null;
            }
            test = dataOrPlaceholderValue( cond, false ); // force value be a string
            test = test.trim();
            // see if the condition name is an item
            if ( pOptions.includePageItems ) {
                item = getItem( cond );
            }
            // todo handle model columns with an item with nullValue defined

            // todo Consider isEmpty is not too useful when the item value is passed to a named template
            //   workaround ARG:={if P1_SELECT/}&P1_SELECT.{/if}
            if ( type === "?" ) {
                // null test
                // false when empty or null all others true
                test = !( ( item && item.isEmpty() ) || test === "" );
            } else if ( type === "=" ) {
                // boolean test
                // false when one of the falseValues all others true
                test = !pOptions.falseValues.includes( test );
            } else {
                // false when empty or null or one of the falseValues all others true
                test = !((item && item.isEmpty()) || test === "" || pOptions.falseValues.includes( test ));
            }
            if ( not ) {
                test = !test;
            }
            return test;
        }

        function checkMismatch( stack, found, missing ) {
            let test = stack.length < 1;

            if ( test ) {
                debug.error( "applyTemplate '" + found + "' without '" + missing + "'" );
            }
            return test;
        }

        function checkNoArg( name, arg ) {
            if ( arg !== "" ) {
                debug.warn( "applyTemplate extra text after directive '" + name + "' ignored" );
            }
        }

        function boolToString( value ) {
            // with 20/20 hind sight this would be better to return 0 or 1 but that would not be backward compatible
            // instead make sure that N is always a falseValue which should be OK now that if directive supports = (bool test)
            return value === true ? "Y" : "N";
        }

        function getColumnProp( model, col, prop, type ) {
            let fields = model.getOption( "fields" ),
                value = null;

            if ( fields[col] !== undefined ) {
                value = fields[col][prop] || "";
                if ( type === "tmpl" ) {
                    value = util.applyTemplate( value, pOptions );
                } else if ( type === "bool" ) {
                    value = boolToString( value );
                }
                value = "" + value;
            }
            return value;
        }

        const itemPropAccess = {
            label: function( item ) {
                let cont$ = $( "#" + util.escapeCSS( item.id ) + "_CONTAINER");

                if ( !cont$.length ) {
                    cont$ = $( "body" );
                }
                // todo update this if/when we fix labels for non form elements and use aria-labelledby
                return cont$.find("[for='" + util.escapeCSS( item.id ) + "']").text();
            },
            display: function( item ) {
                let disp = item.displayValueFor( item.getValue() );
                if ( isArray( disp ) ) {
                    disp = disp.join( ", " );
                }
                return disp;
            },
            valid: function( item ) {
                return boolToString( item.getValidity().valid );
            },
            message: function( item ) {
                return item.getValidationMessage();
            },
            changed: function( item ) {
                return boolToString( item.isChanged() );
            },
            disabled: function( item ) {
                return boolToString( item.isDisabled() );
            }
        }, columnPropAccess = {
            display: function( itemName, model, rec ) {
                let field,
                    fields = model.getOption( "fields" ),
                    value = model.getValue( rec, itemName );

                if ( fields[itemName] !== undefined ) {
                    field = fields[itemName];
                }

                if ( field && field.cellTemplate ) {
                    value = util.applyTemplate( field.cellTemplate, pOptions );
                } else if ( typeof value === "object" && value.d ) {
                    value = value.d;
                } else if ( field && field.elementId ) {
                    let item = getItem( field.elementId );
                    if ( item ) {
                        value = item.displayValueFor( value );
                    }
                }
                // todo share code with _renderFieldDataValue
                return value;
            },
            label: function( itemName, model ) {
                let fields = model.getOption( "fields" ),
                    value = null;

                if ( fields[itemName] !== undefined ) {
                    let field = fields[itemName];
                    value = util.stripHTML( field.label || field.heading || "" );
                }
                return value;
            },
            heading: function( itemName, model ) {
                let fields = model.getOption( "fields" ),
                    value = null;

                if ( fields[itemName] !== undefined ) {
                    let field = fields[itemName];
                    value = field.heading || field.label || "";
                }
                return value;
            },
            heading_class: function( itemName, model ) {
                return getColumnProp( model, itemName, "headingCssClasses" );
            },
            column_class: function( itemName, model ) {
                return getColumnProp( model, itemName, "columnCssClasses" );
            },
            field_class: function( itemName, model ) {
                return getColumnProp( model, itemName, "fieldCssClasses" );
            },
            field_col_span: function( itemName, model ) {
                return getColumnProp( model, itemName, "fieldColSpan" );
            },
            width: function( itemName, model) {
                return getColumnProp( model, itemName, "width" );
            },
            required: function( itemName, model ) {
                return getColumnProp( model, itemName, "isRequired", "bool" );
            },
            readonly: function( itemName, model, rec, recMeta ) {
                let cellMeta,
                    ro = getColumnProp( model, itemName, "readonly", "bool" );

                if ( ro !== "Y" ) {
                    if ( recMeta && recMeta.fields && recMeta.fields[itemName] ) {
                        cellMeta = recMeta.fields[itemName];
                    }
                    // check with model
                    if ( ( cellMeta && cellMeta.ck ) || !model.allowEdit( rec ) ) {
                        ro = "Y";
                    }
                }
                return ro;
            },
            link: function( itemName, model, rec, recMeta ) {
                let field, cellMeta,
                    targetUrl = "",
                    fields = model.getOption( "fields" );

                if ( recMeta && recMeta.fields && recMeta.fields[itemName] ) {
                    cellMeta = recMeta.fields[itemName];
                }
                if ( fields[itemName] !== undefined ) {
                    field = fields[itemName];
                    value = field.heading || field.label || "";
                }
                if ( ( ( cellMeta && cellMeta.url ) || field.linkTargetColumn ) ) {
                    if ( field.linkTargetColumn ) {
                        targetUrl = model.getValue( rec, field.linkTargetColumn ) || null;
                    } else {
                        targetUrl = cellMeta.url;
                    }
                }
                return targetUrl;
            },
            link_text: function( itemName, model ) {
                return getColumnProp( model, itemName, "linkText", "tmpl" );
            },
            link_attrs: function( itemName, model ) {
                return getColumnProp( model, itemName, "linkAttributes", "tmpl" );
            },
            hidden: function( itemName, model ) {
                return getColumnProp( model, itemName, "hidden", "bool" );
            }
        };
        // todo consider property access to model metadata: defaultValue, error, warning, message, disabled, highlight
        //     column config:  alignment, headingAlignment, cellCssClassesColumn, noStretch, helpId, useAsRowHeader

        function getSubstMessage( itemName ) {
            let value = null;

            if ( itemName.startsWith( "APP_TEXT$" ) ) {
                let messageKey = itemName.substr( 9 ),
                    lang = LANG_RE.exec( messageKey );

                if ( lang ) {
                    // Remove language from message key. It is used by server symbol substitution but not supported by client
                    // Allow a lone trailing $ to support message keys that include $ in them.
                    if ( lang[0].length > 1 ) {
                        debug.warn("applyTemplate message text substitution " + lang[0] + " language ignored.");
                    }
                    messageKey = messageKey.replace( LANG_RE, "" );
                }
                if ( messageKey ) {
                    value = apex.lang.getMessage( messageKey );
                }
            }
            return value;
        }

        function getSubstItem( itemName, altItemName, prop ) {
            let item,
                value = null;

            if ( altItemName && itemPropAccess[prop] ) {
                item = getItem( altItemName );
                if ( item ) {
                    value = itemPropAccess[prop]( item );
                }
            } else {
                item = getItem( itemName );
                if ( item ) {
                    value = item.getValue();
                    // be consistent with the server and return the value not the display value.
                }
            }
            // todo consider pass back defaultEscape similar to columns, currently only display only item has escape prop/its not formalized like for columns
            return [value, item];
        }

        function getSubstColumn( itemName, altItemName, prop, defaultEscape ) {
            let parentM, parentID, elementId, recId, labelName, fields, field, match,
                modelStackIndex = modelStack.length - 1,
                msf = modelStack[modelStackIndex],
                model = msf.model,
                rec = msf.record,
                recMeta = msf.recMeta,
                models = [],
                item = null,
                value = null;

            while ( value === null && rec && model ) {
                let colName;
                if ( altItemName && columnPropAccess[prop] ) {
                    value = columnPropAccess[prop]( altItemName, model, rec, recMeta );
                    colName = altItemName;
                } else {
                    value = model.getValue( rec, itemName );
                    if ( value === undefined ) {
                        value = null;
                    }
                    colName = itemName;
                    if ( value === null ) {
                        // try <col>_LABEL to get the column heading label (this is the legacy way)
                        match = COL_LABEL_RE.exec( itemName );
                        if ( match ) {
                            labelName = match[1];
                            fields = model.getOption( "fields" );
                            if ( fields[labelName] !== undefined ) {
                                value = fields[labelName].label || fields[labelName].heading || null;
                            }
                            colName = labelName;
                        }
                    }
                }
                rec = null;
                if ( value === null ) {
                    // next try a parent model if any
                    parentM = model.getOption( "parentModel" );
                    parentID = model.getOption( "parentRecordId" );
                    if ( parentM && parentID ) {
                        model = apexModel.get( parentM );
                        if ( model ) {
                            models.push( parentM );
                            rec = model.getRecord( parentID );
                            recId = model.getRecordId( rec );
                            recMeta = null;
                            if ( recId ) {
                                recMeta = model.getRecordMetadata( recId );
                            }
                        }
                    } else if ( modelStackIndex > 0 ) {
                        modelStackIndex -= 1;
                        msf = modelStack[modelStackIndex];
                        model = msf.model;
                        rec = msf.record;
                        recMeta = msf.recMeta;
                    }
                } else {
                    rec = null;
                    fields = model.getOption( "fields" );
                    field = fields[colName];
                    if ( field && field.escape !== undefined ) {
                        defaultEscape = field.escape ? "HTML" : "RAW";
                    }
                    if ( field && field.elementId !== undefined ) {
                        elementId = field.elementId;
                        item = getItem( elementId );
                    }
                }
            }
            for ( let i = 0; i < models.length; i++ ) {
                apexModel.release( models[i] );
            }
            return [value, item, defaultEscape];
        }

        // when escFilter is false do no escaping
        function getSubstValue( itemName, escFilter, raw ) {
            let value, item, match, prop, propOC, altItemName,
                defaultEscape = pOptions.defaultEscapeFilter;

            // naming convention for accessing additional properties/metadata about an item <item>_$<property>
            match = PROP_SUFFIX_RE.exec( itemName );
            if ( match ) {
                altItemName = itemName.substring( 0, match.index );
                propOC = match[1]; // original (as is) case
                prop = propOC.toLowerCase();
            }

            // first check for a message key
            value = getSubstMessage( itemName );
            // if still no value found then check for a model record
            if ( value === null && modelStack.length > 0 ) {
                [value, item, defaultEscape] = getSubstColumn( itemName, altItemName, prop, defaultEscape );
            }
            // if still no value check for a page item
            if ( value === null && pOptions.includePageItems ) {
                [value, item] = getSubstItem( itemName, altItemName, prop );
            }
            // if still no value found then check built-in substitutions
            if ( value === null && pOptions.includeBuiltinSubstitutions ) {
                value = gPageTemplateData[itemName] || null;
            }
            // if still no value found then check extra substitutions
            if ( value === null && pOptions.extraSubstitutions ) {
                value = pOptions.extraSubstitutions[altItemName || itemName] || null;
                if ( value != null && altItemName && typeof value === "object" ) {
                    value = value[propOC]; // todo support nested objects?
                    if ( typeof value === "boolean" ) {
                        value = boolToString( value );
                    } else if ( value === undefined ) {
                        value = null;
                    }
                }
            }
            if ( value === null ) {
                value = "";
            } else {
                if ( typeof value === "object" && hasOwnProperty( value, "v" ) ) {
                    value = value.v;
                }
                if ( typeof value !== "string" && ( escFilter || !raw ) ) {
                    // if there is an escape filter then must have a string otherwise
                    // still force a string unless raw is true.
                    if ( isArray( value ) ) {
                        let sep = ":";
                        if ( item ) {
                            sep = item.getSeparator();
                        }
                        value = value.join( sep );
                    } else {
                        value = "" + value;
                    }
                }
                if ( escFilter !== false ) {
                    if ( !escFilter ) {
                        escFilter = defaultEscape;
                    }
                    if ( defaultEscape === false ) {
                        if ( escFilter !== "STRIPHTML" ) {
                            escFilter = "RAW";
                        }
                    }
                    if ( escFilter === "HTML" ) {
                        value = escapeHTML( value );
                    } else if ( escFilter === "ATTR" ) {
                        value = escapeHTMLAttr( value );
                    } else if ( escFilter === "STRIPHTML" ) {
                        value = util.stripHTML( value.replace( "&nbsp;", "" ) );
                        if ( defaultEscape !== false ) {
                            value = escapeHTML( value );
                        }
                    } else if ( escFilter !== "RAW" && escFilter ) {
                        throw new Error( "Invalid template filter: " + escFilter );
                    }
                }
            }
            return value;
        }

        function dataOrPlaceholderValue( name, raw ) {
            const placeholders = pOptions.placeholders;

            if ( PH_NAME_RE.test( name ) ) {
                if ( pArgs && pArgs[name] !== undefined ) {
                    return pArgs[name];
                }

                if ( placeholders && placeholders[name] !== undefined ) {
                    return placeholders[name];
                }
            }
            return getSubstValue( name, false, raw );
        }

        function resolvePlaceholder( name ) {
            // first check if there is an actual argument for this name
            if ( pArgs && pArgs[name] !== undefined ) {
                return pArgs[name];
            } // else
            return pOptions.placeholders[ph];
        }

        function substitute( fragment ) {
            return fragment.replace( SUBST_RE, ( m, _1, itemName, itemQName, _2, escFilter ) => {
                let value = "";

                if ( itemQName ) {
                    itemName = itemQName;
                }
                if ( itemName ) {
                    value = getSubstValue( itemName, escFilter );
                }
                return value;
            });
        }

        function lookAhead( index, match, inc, dec ) {
            let i, t, name,
                level = 0;

            for ( i = index; i < tokens.length; i++ ) {
                t = tokens[i];
                name = t.name;
                if ( t.type === "directive" ) {
                    if ( match[name] && level === 0 ) {
                        break;
                    } else if ( name === inc ) {
                        level += 1;
                    } else if ( name === dec ) {
                        level -= 1;
                    }
                }
                // just in case
                if ( level < 0 ) {
                    break;
                }
            }
            return i;
        }

        function doLoopBody( tokens, startIndex ) {
            let t,
                tokenIndex = startIndex;

            for ( ; ; ) {
                if ( tokenIndex >= tokens.length ) {
                    tokenIndex = null;
                    break;
                }
                tokenIndex = processToken( tokenIndex );
                t = tokens[tokenIndex];
                if ( t && t.type === "directive" && t.name === "endloop" ) {
                    // don't process the endloop but do skip over it
                    tokenIndex += 1;
                    break;
                }
            }
            return tokenIndex;
        }

        function processToken( tokenIndex ) {
            let t = tokens[tokenIndex];

            tokenIndex += 1;
            if ( t.type === "text" ) {
                let text = t.text;
                // normalize whitespace after a directive.
                if ( lastTokenType === "directive" ) {
                    text = text.replace( /^\s+/, " " );
                }
                result += substitute( text );
                lastTokenType = t.type;
            } else if ( t.type === "ph" ) {
                result += t.value;
                lastTokenType = t.type;
            } else if ( t.type === "directive" ) {
                directive = directives[t.name];
                if ( directive ) {
                    lastTokenType = t.type;
                    tokenIndex = directive( tokenIndex, t.arg );
                } else {
                    // an unknown directive is just text
                    result += substitute( t.text );
                    lastTokenType = "text";
                }
            }
            return tokenIndex;
        }

        pOptions = extend( {
            placeholders: null,
            directives: true,
            defaultEscapeFilter: "HTML",
            includePageItems: true,
            model: null,
            record: null,
            extraSubstitutions: {},
            includeBuiltinSubstitutions: true,
            falseValues: ["F", "f", "N", "n", "0"],
            clearItemCache: true // todo doc?
        }, pOptions || {} );

        // because we use Y/N for boolean values make sure falseValues contains "N"
        if ( !pOptions.falseValues.includes("N") ) {
            pOptions.falseValues.push("N");
        }

        if ( !pArgs && pOptions.clearItemCache ) {
            gItemCache.clear();
        }

        if ( pOptions.model && pOptions.record && modelStack.length === 0 ) {
            let recMeta = null,
                model = pOptions.model,
                record = pOptions.record,
                recordId = model.getRecordId( record );

            if ( recordId ) {
                recMeta = model.getRecordMetadata( recordId );
            }
            modelStack.push( {model: model, record: record, recMeta: recMeta} );
        }

        // initialize page substitution tokens just once when needed
        if ( !gPageTemplateData && pOptions.includeBuiltinSubstitutions ) {
            gPageTemplateData = {
                "APP_USER": env.APP_USER,
                "APP_ID": env.APP_ID,
                "APP_PAGE_ID": env.APP_PAGE_ID,
                "APP_SESSION": env.APP_SESSION,
                "APP_FILES": env.APP_FILES,
                "WORKSPACE_FILES": env.WORKSPACE_FILES,
                "REQUEST": $v( "pRequest" ),
                "DEBUG": $v( "pdebug" ),
                "IMAGE_PREFIX": env.APEX_FILES,
                "APEX_FILES": env.APEX_FILES,
                "APEX_VERSION": env.APEX_VERSION,
                "APEX_BASE_VERSION": env.APEX_BASE_VERSION
            };
        }

        // tokenize the source template
        if ( ( pArgs || pOptions.directives ) && pOptions.placeholders === null ) {
            pOptions.placeholders = {};
        }
        doPlaceholders = pOptions.placeholders !== null;
        doDirectives = pOptions.directives;
        if ( doPlaceholders || doDirectives ) {
            src = pTemplate;
            m = HASH_OR_DIR_RE.exec( src );
            pos = m ? m.index : -1;
            lastPos = 0;
            while ( m ) {
                ph = m[1];
                dir = m[2];
                if ( m[0] === "{{/}" ) {
                    // this is a escape for lone { char
                    tokens.push( {
                        type: "text",
                        text: src.substring( lastPos, pos ) + "{"
                    } );
                    lastPos = pos + m[0].length;
                } else if ( ph && doPlaceholders ) {
                    /* It would be tempting to cache the parsed template string to avoid doing this parsing again
                     * but the rules for parsing placeholders makes that tricky.
                     * The token for #FOO# depends on if placeholder FOO exists or not. For caching
                     * to work the result would need to be independent of the data.
                     */
                    value = resolvePlaceholder( ph );
                    if ( value !== undefined ) { // empty string is still a value to substitute.
                        if ( pos > lastPos ) {
                            // add any text before the placeholder
                            tokens.push( {
                                type: "text",
                                text: src.substring( lastPos, pos )
                            } );
                        }
                        // add placeholder
                        tokens.push( {
                            type: "ph",
                            text: m[0],
                            value: value
                        } );
                    } else {
                        // the text before the placeholder and placeholder are all just text
                        tokens.push( {
                            type: "text",
                            text: src.substring( lastPos, pos + ph.length + 2 )
                        } );
                        // backup one
                        HASH_OR_DIR_RE.lastIndex -= 1;
                    }
                    lastPos = pos + m[0].length;
                } else if ( dir && doDirectives ) {
                    if ( pos > lastPos ) {
                        // add any text before the directive
                        tokens.push( {
                            type: "text",
                            text: src.substring( lastPos, pos )
                        } );
                    }
                    m2 = DIR_RE.exec( dir );
                    if ( m2 ) {
                        // add the potential directive. include the text just in case it isn't a recognized directive
                        tokens.push( {
                            type: "directive",
                            text: m[0],
                            name: m2[1].trim().toLowerCase(), // directives are not case sensitive
                            arg: ( m2[2] || "" ).trim()
                        } );
                    } else {
                        // treat something that looks like a directive but isn't as static text
                        tokens.push( {
                            type: "text",
                            text: m[0]
                        } );
                    }
                    lastPos = pos + m[0].length;
                }
                // else no token was added so don't advance lastPos
                m = HASH_OR_DIR_RE.exec( src );
                pos = m ? m.index : -1;
            }
            if ( src.length > lastPos ) {
                tokens.push( {
                    type: "text",
                    text: src.substring( lastPos )
                } );
            }
        } else {
            tokens.push( {
                type: "text",
                text: pTemplate
            } );
        }

        // merge text tokens to handle things like &A#P#B.
        for ( let i = 1; i < tokens.length; i++ ) {
            let curTok = tokens[i],
                prevTok = tokens[i - 1];
            if ( curTok.type === "text" && prevTok.type === "text" ) {
                prevTok.text += curTok.text;
                tokens.splice( i, 1 ); // remove current token
                i -= 1; // don't advance
            }
        }

        if ( pOptions.iterationCallback && pOptions.model && pOptions.record ) {
            pOptions.iterationCallback( null, pOptions.model, pOptions.record, null, pOptions.placeholders, pOptions.extraSubstitutions );
        }
        result = "";
        tokenIndex = 0;
        lastTokenType = null;
        while ( tokenIndex < tokens.length ) {
            tokenIndex = processToken( tokenIndex );
        }
        if ( ifStack.length > 0 || caseStack.length > 0 || loopStack.length > 0 ) {
            debug.error( "applyTemplate missing 'endif', 'endcase', or 'endloop'" );
        }

        // Templates are trusted. They should only come from the developer. However in no case should script
        // tags be allowed. There is just no reasonable use case for this. Scripts should be added to the page
        // in other ways and generally by the server.
        while ( SCRIPT_RE.test( result ) ) {
            result = result.replace( SCRIPT_RE, "" );
        }
        return result;
    },

    /**
     * Given a template string return an array of all the item or column names (data substitutions) in it.
     * todo doc
     * @ignore
     * @param {string} pTemplate A template string suitable for {@link apex.util.applyTemplate}.
     * @returns {string[]}
     */
    extractTemplateDependencies: function( pTemplate ) {
        let m,
            names = []; // convention for pseudo property access name%prop

        m = SUBST_RE.exec( pTemplate );
        while ( m ) {
            let name = m[2] || m[3];

            names.push( name );
            // todo make sure there is an item or column?, check/remove suffix?
            // current thinking is that the property access should be included. consider an object {item: name, property: propName}
            m = SUBST_RE.exec( pTemplate );
        }
        return names;
    },

    /**
     * For internal use only
     * 
     * Returns the numeric representation of a CSS duration value in milliseconds
     * Eg:
     *  "0.5s"  => 500
     *  "1.2s"  => 1200
     *  "300ms" => 300
     *  undefined / null / "" / "abc" => 0
     * 
     * @ignore
     * @param {string} pStr
     * @returns {number}
     */
    cssDurationToMilliseconds: ( pStr ) => {
        // the s or ms suffix are removed by parseFloat
        let duration = parseFloat( pStr );
        if ( isNaN( duration ) ) {
            return 0;
        } else if ( pStr.includes( "ms") ) {
            return duration;
        } else {
            // an s suffix is assumed
            return duration * 1000;
        }
    }
    };

    util.escapeHTMLContent = escapeHTMLContent;

    // for internal use
    util.objectEntries = objectEntries;
    util.hasOwnProperty = hasOwnProperty;

    return util;

})( apex.jQuery, apex.debug, apex.env );
