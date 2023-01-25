/*!
 Copyright (c) 2015, 2022, Oracle and/or its affiliates. All rights reserved.
 */
/**
 * @namespace apex.locale
 * @since 20.1
 * @desc
 * <p>The apex.locale namespace contains Oracle APEX functions related to formatting numbers and
 * dates according to a specific locale. For localizing text messages see {@link apex.lang}.</p>
 */
/* eslint-env amd */
apex.locale = {};

( function( locale, debug, util, $ ) {
    "use strict";

    let gLocaleSettings = {   // locale depending settings
            language: "en",
            separators: {
                group:   ",",
                decimal: "."
            },
            currency: {
                local: "$", // NLS_CURRENCY
                iso: "USD", // NLS_ISO_CURRENCY
                dual: "$"   // NLS_DUAL_CURRENCY
            },
            calendar: {
                abbrMonthNames: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
                rawAbbrMonthNames: ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"],
                monthNames: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
                rawMonthNames: ["JANUARY  ", "FEBRUARY ", "MARCH    ", "APRIL    ", "MAY      ", "JUNE     ", "JULY     ", "AUGUST   ", "SEPTEMBER", "OCTOBER  ", "NOVEMBER ", "DECEMBER "],
                abbrDayNames:   ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
                rawAbbrDayNames: ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"],
                dayNames: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
                rawDayNames: ["SUNDAY   ", "MONDAY   ", "TUESDAY  ", "WEDNESDAY", "THURSDAY ", "FRIDAY   ", "SATURDAY "],
                dateFormat: "YYYY/MM/DD",
                dsDateFormat: "fmMM/DD/RRRR",
                dlDateFormat: "fmDay, Month fmdd, yyyy",
                amFormat: "AM",
                pmFormat: "PM",
                startOfWeek: "sunday"
            }
        },
        gLoading = false;

    let readyDeferred = $.Deferred(),
        ready = readyDeferred.promise();

    // just the language part
    function getBCP47Lang( language ) {
        return language.split( "-" )[0];
    }

    // cleanup the lang. Resources stored with language in lower case and territory upper case.
    function cleanBCP47Lang( language ) {
        let i, parts;

        parts = language.split( "-" );
        // there must be a language and it must be in lower case
        parts[0] = parts[0].toLowerCase();
        i = 1;
        if ( parts.length > i ) {
            if ( parts[i].length === 4 ) {
                // must be a script subtag. Should already be in proper init caps case
                i = 2;
            }
        }
        if ( parts.length > i ) {
            // if there is a territory it must be in upper case
            parts[i] = parts[i].toUpperCase();
        }
        return parts.join( "-" );
    }

    const loadJETcldrResources = function( resourcesPath, language) {

        function checkResources() {
            if ( language !== Object.keys( gLocaleSettings.cldr.main )[0]) {
                debug.warn( "HTML lang different from language set in init." );
            }
            debug.timeEnd("Load L10n Resources");
            readyDeferred.resolve();
            gLoading = false;
        }

        debug.timeBegin("Load L10n Resources");
        gLoading = true;
        gLocaleSettings.cldr = {};

        language = cleanBCP47Lang( language );

        // only use require to load localeElements if JET is present
        if ( window.require && window.define ) {
            // JET is going to load resources based on html lang attr first then fallback to browser navigator.language
            // todo why is require so much faster? works by putting script tags head and leaving them there
            // Can't move this condition to outer if because of fake define in else branch
            // Now this JET resource config should always be present but still check to be sure
            if ( require.s.contexts._.config.config.ojL10n ) {
                require( ["ojL10n!ojtranslations/nls/localeElements"], function ( data ) {
                    $.extend( true, gLocaleSettings.cldr, data );  // this gets main and supplemental
                    checkResources();
                } );
            }
        } else {
            let url, ajaxOptions, p1, p2, curLang,
                allLocales = {},
                urlBase = resourcesPath;

            window.define = function( data ) {
                if ( data.root ) {
                    allLocales = data;
                    data = data.root;
                }
                $.extend( true, gLocaleSettings.cldr, data );
            };

            ajaxOptions = {
                cache: true,
                dataType: "script"
            };

            // get supplemental
            url = urlBase + "localeElements.js";
            p1 = $.ajax( url, ajaxOptions );
            p1.done( function() {
                curLang = language;
                // check that locale is supported
                if ( !allLocales[curLang] ) {
                    // first try stripping off the territory
                    curLang = curLang.split("-")[0];
                    if ( !allLocales[curLang] ) {
                        // try browser language
                        curLang = navigator.language;
                        if ( !allLocales[curLang] ) {
                            curLang = "en";
                        }
                    }
                }
                // get main
                url = urlBase + curLang + "/localeElements.js";
                p2 = $.ajax( url, ajaxOptions );
                p2.fail( function( /*jqXHR, textStatus, errorThrown*/ ) {
                    debug.error( "Failed to load locale resource ", url );
                } ).always( function() {
                    checkResources();
                    delete window.define;
                } );
            } ).fail( function() {
                debug.error( "Failed to load locale resource ", url );
                delete window.define;
            } );

        }
    };

    /**
     * For internal use.
     * Used to configure the locale settings. This called by APEX.
     *
     * @ignore
     * @param  {object} pOptions   An object whose properties are used as language/territory depending settings.
     * @function init
     * @memberOf apex.locale
     */
    locale.init = function( pOptions ) {
        // don't expect init to be called more than once but just in case
        if ( locale.resourcesLoaded().state() !== "pending" ) {
            // must have already loaded resources. about to not be ready again
            readyDeferred = $.Deferred();
            ready = readyDeferred.promise();
        }
        gLocaleSettings = $.extend( gLocaleSettings, pOptions );

        // wait until all the other libraries have loaded
        $(function() {
            let p,
                resourcesPath = gLocaleSettings.resources;

            if ( resourcesPath ) {
                // don't expect init to be called more than once or while loading is in progress but just in case
                if ( gLoading ) {
                    p = locale.resourcesLoaded();
                    p.done( function() {
                        // anyone else waiting on this will run now but about to load again so need a new deferred
                        setTimeout(function() {
                            readyDeferred = $.Deferred();
                            ready = readyDeferred.promise();
                            loadJETcldrResources( resourcesPath, gLocaleSettings.language );
                        }, 1 );
                    } );
                } else {
                    loadJETcldrResources( resourcesPath, gLocaleSettings.language );
                }
            }
        });
    };

    /**
     * For internal use.
     * @ignore
     * @function getSettings
     * @memberOf apex.locale
     */
    locale.getSettings = function() {
        return $.extend( true, {}, gLocaleSettings );
    };

    /**
     * <p>Used to determine if the resources needed by some of the {@link apex.locale} functions
     * have been loaded.</p>
     *
     * @param {function} [pCallback] A Function to call when the resources have been loaded. If the resources
     * are already loaded the function is called right away.
     * @return {Promise} A promise object. The promise is resolved when the resources have been loaded.
     * @example <caption>Wait until the resources are loaded before formatting a number.</caption>
     * apex.locale.resourcesLoaded( function() {
     *     var formattedNumber = apex.locale.formatCompactNumber( 123456789.12 );
     *     // In the US English locale this will log: "The number is: 123.46M"
     *     console.log( "The number is: " + formattedNumber );
     * } );
     * @example <caption>This is the same as the previous example except it uses the returned promise.</caption>
     * var p = apex.locale.resourcesLoaded();
     * p.done( function() {
     *     var formattedNumber = apex.locale.formatCompactNumber( 123456789.12 );
     *     // In the US English locale this will log: "The number is: 123.46M"
     *     console.log( "The number is: " + formattedNumber );
     * } );
     * @example <caption>This checks to see if the resources are loaded.</caption>
     * if ( apex.locale.resourcesLoaded().state() === "resolved" ) {
     *     // resources are loaded
     * } else {
     *     // resources are not yet loaded
     * }
     * @function resourcesLoaded
     * @memberOf apex.locale
     */
    locale.resourcesLoaded = function( pCallback ) {
        if ( pCallback ) {
            ready.done( pCallback );
        }
        return ready;
    };

    /**
     * Return the database locale specific group separator for numeric values.
     *
     * @return {string} The group separator. For example "," (US) or "." (Germany).
     *
     * @function getGroupSeparator
     * @memberOf apex.locale
     */
    locale.getGroupSeparator = function() {
        return gLocaleSettings.separators.group;
    };

    /**
     * Return the database locale specific decimal separator for numeric values.
     *
     * @return {string} The decimal separator. For example "." (US) or "," (Germany).
     *
     * @function getDecimalSeparator
     * @memberOf apex.locale
     */
    locale.getDecimalSeparator = function() {
        return gLocaleSettings.separators.decimal;
    };

    /**
     * Return the database abbreviated month names as an array. First element of the array is the
     * first month of the year in the current locale.
     *
     * @return {array} Array of abbreviated month names. For example ["Jan","Feb","Mar", ..., "Dec"]
     *
     * @function getAbbrevMonthNames
     * @memberOf apex.locale
     */
    locale.getAbbrevMonthNames = function() {
        return gLocaleSettings.calendar.abbrMonthNames;
    };

    /**
     * Return the database month names as an array. First element of the array is the
     * first month of the year in the current locale.
     *
     * @return {array} Array of month names. For example ["January","February","March", ...,"December"]
     *
     * @function getMonthNames
     * @memberOf apex.locale
     */
     locale.getMonthNames = function() {
        return gLocaleSettings.calendar.monthNames;
    };

    /**
     * Return the database abbreviated day names as an array. First element of the array is the
     * first day of the week in the current locale. 
     *
     * @return {array} Array of abbreviated day names. For example ["Sun","Mon","Tue","Wed",...,"Sat"]
     *
     * @function getAbbrevDayNames
     * @memberOf apex.locale
     */
    locale.getAbbrevDayNames = function() {
        return gLocaleSettings.calendar.abbrDayNames;
    };

    /**
     * Return the database day names as an array. First element of the array is the
     * first day of the week in the current locale. 
     *
     * @return {array} Array of day names. For example ["Sunday","Monday","Tuesday","Wednesday", ...,"Saturday"]
     *
     * @function getDayNames
     * @memberOf apex.locale
     */
     locale.getDayNames = function() {
        return gLocaleSettings.calendar.dayNames;
    };

    /**
     * Return the database defined date format mask.
     *
     * @return {string} Date format mask. For example "YYYY/MM/DD" or "DD.MM.YYYY"
     *
     * @function getDateFormat
     * @memberOf apex.locale
     */
     locale.getDateFormat = function() {
        return gLocaleSettings.calendar.dateFormat;
    };

    /**
     * Return the database defined DS date format mask.
     *
     * @return {string} DS Date format mask. For example "fmMM/DD/RRRR" or "DD.MM.RRRR"
     *
     * @function getDSDateFormat
     * @memberOf apex.locale
     */
     locale.getDSDateFormat = function() {
        return gLocaleSettings.calendar.dsDateFormat;
    };

    /**
     * Return the database defined DL date format mask.
     *
     * @return {string} DL Date format mask. For example "fmDay, Month fmdd, yyyy" or "fmDay, dd. Month yyyy"
     *
     * @function getDLDateFormat
     * @memberOf apex.locale
     */
     locale.getDLDateFormat = function() {
        return gLocaleSettings.calendar.dlDateFormat;
    };

    /**
     * Return the current language locale.
     *
     * @return {string} current language. For example "en", "de", "en-US", ...
     *
     * @function getLanguage
     * @memberOf apex.locale
     */
    locale.getLanguage = function() {
        return gLocaleSettings.language;
    };

    /**
     * Return the database locale specific currency symbol.
     *
     * @returns {string}
     *
     * @function getCurrency
     * @memberOf apex.locale
     */
    locale.getCurrency = function() {
        return gLocaleSettings.currency.local;
    };

    /**
     * Return the database locale specific ISO currency string.
     *
     * @returns {string}
     *
     * @function getISOCurrency
     * @memberOf apex.locale
     */
    locale.getISOCurrency = function() {
        return gLocaleSettings.currency.iso;
    };

    /**
     * Return the database locale specific dual currency symbol.
     *
     * @returns {string}
     *
     * @function getDualCurrency
     * @memberOf apex.locale
     */
    locale.getDualCurrency = function() {
        return gLocaleSettings.currency.dual;
    };

    const escapeRegExp = util.escapeRegExp,
        unsupToNumFmtRE = /V|RN|TM|EEEE/,
        binOrOctRE = /^\s*0[bBoO]/,
        hexRE = /^\s*0[Xx]/,
        leadingSignZero = /^[-+]?0*/,
        trailingZero = /\.?0*$/,
        currencyRE = /[$CLU]/;

    /**
     * <p>Convert the given string value into a number. It does not strictly validate against the
     * given format but will strip potential format characters from the number so it can be
     * converted to a number. The intention is to allow natural human data entry of numbers.
     * The locale decimal and group separators are considered.</p>
     *
     * <p>The octal (0o) and binary (0b) prefixes are never allowed. Only when the format model is hex,
     * the hex (0x) prefix is allowed but not required. Although the scientific notation format model (EEEE)
     * is not supported, strings in scientific notation will be converted using the locale specific decimal
     * separator but group separators and currency symbols are not allowed.</p>
     *
     * @param {string} pValue The potentially formatted or partially formatted number string to convert.
     * @param {string} [pFormat] The optional expected format of the value to convert.
     *  This is a database format model. The format elements V, RN, TM, and EEEE are not supported and will
     *  be ignored.
     * @returns {number} the converted number or NaN if pValue cannot be converted to a number
     * @example <caption>In a locale that uses comma as the group separator, period as the
     * decimal separator and $ as the locale currency symbol the following all result in the same number 1234.56.</caption>
     * var number = apex.locale.toNumber( "1,234.56" );
     * number = apex.locale.toNumber( "$1,234.56", "FML999G999G990D00" );
     * number = apex.locale.toNumber( "$1234.56", "FML999G999G990D00" );
     * // number is 1234.56
     * @example <caption>In a locale that uses period as the group separator, comma as the
     * decimal separator and € as the locale currency symbol the following all result in the same number 1234.56.</caption>
     * var number = apex.locale.toNumber( "1.234,56" );
     * number = apex.locale.toNumber( "€1.234,56", "FML999G999G990D00" );
     * number = apex.locale.toNumber( "€1234,56", "FML999G999G990D00" );
     * // number is 1234.56
     *
     * @function toNumber
     * @memberOf apex.locale
     */
    locale.toNumber = function( pValue, pFormat ) {
        let cleanValue,
            result = NaN,
            decimalSeparator = locale.getDecimalSeparator();

        if ( typeof pValue === "number" ) {
            result = pValue;
        } else if ( typeof pValue === "string" && pValue.trim() !== "" && !binOrOctRE.test( pValue ) ) {
            if ( pFormat && ( typeof pFormat !== "string" || unsupToNumFmtRE.test( pFormat) ) ) {
                pFormat = null;
                // note SQL to_number doesn't seem to support RN or V
                debug.warn( "Unsupported format ignored: ", pFormat );
            }
            if ( !pFormat && decimalSeparator !== "." ) {
                pFormat = "GD"; // not really a valid format model but allows 1.234,56
            }
            if ( !pFormat ) {
                cleanValue = pValue.replace( /[$,]/g, "" ).trim();
                result = Number( cleanValue );
            } else if ( reNumFmtX.test( pFormat ) ) {
                if ( !hexRE.test( pValue ) ) {
                    pValue = "0x" + pValue;
                }
                result = Number( pValue );
            } else {
                let parts, m,
                    groupSeparator = locale.getGroupSeparator(),
                    sep = ".";

                // don't allow hex input unless format mask calls for it
                if ( hexRE.test( pValue ) ) {
                    return result; // still NaN
                }

                cleanValue = pValue;

                // handle special cases for negative numbers
                pFormat = pFormat.toUpperCase();
                if ( pFormat.includes( "PR" ) ) {
                    m = /^\s*<(.+)>\s*$/.exec( cleanValue );
                    if ( m ) {
                        cleanValue = "-" + m[1];
                    }
                } else if ( /(S|MI)$/.test( pFormat ) ) {
                    if ( cleanValue.includes( "-" ) ) {
                        cleanValue = "-" + cleanValue.replace( "-", "" );
                    }
                }

                // convert the decimal separator if the decimal separator is not "." via a temp char
                // it doesn't matter if the format includes D or not, see bug 32972477
                if ( decimalSeparator !== "." ) {
                    cleanValue = cleanValue.replace( decimalSeparator, "\n" );
                    sep = "\n";
                }
                // split the value on the decimal separator
                parts = cleanValue.split( sep );

                // remove any group separators before the decimal separator
                if ( pFormat.includes( "G" ) ) {
                    parts[0] = parts[0].replaceAll( groupSeparator, "" );
                } else if ( pFormat.includes( "," ) ) {
                    parts[0] = parts[0].replaceAll( ",", "" );
                } else {
                    // The format does not include a group separator so the input should not have one. This will be
                    // caught by the conversion via Number(). However "." is a special case that needs to be checked for.
                    if ( parts[0].includes( "." ) ) {
                        return result; // still NaN
                    }
                }
                // put the whole number back together with number decimal separator
                cleanValue = parts.join( "." ).trim();

                // remove any currency symbols
                if ( currencyRE.test( pFormat ) ) {
                    let re = new RegExp( "\\$|" + escapeRegExp( locale.getCurrency() ) + "|" +
                        escapeRegExp( locale.getDualCurrency() ) + "|" +
                        escapeRegExp( locale.getISOCurrency() ), "g" );
                    cleanValue = cleanValue.replace( re, "" );
                }
                result = Number( cleanValue );
            }
            if ( cleanValue && !isNaN( result ) && !/[eE]/.test( cleanValue ) ) {
                // check for numbers that are "too big" see bug 32970879
                // JavaScript gives no indication that a string converted by Number() (or any other means)
                // exceeds the precision of IEEE 754 double. We want to treat this as NaN.
                // Method of detection: If there is no loss of precision then turning the result back into a
                // string should give the same string as the input if scientific notation is not used and the result
                // is a number and after trimming insignificant leading and trailing zeros
                let resultStr = ("" + result).replace( leadingSignZero, "" ),
                    cleanStr = cleanValue.replace( leadingSignZero, "" );
                if ( resultStr.includes( "." ) ) {
                    resultStr = resultStr.replace( trailingZero, "" );
                }
                if ( cleanStr.includes( "." ) ) {
                    cleanStr = cleanStr.replace( trailingZero, "" );
                }
                if ( resultStr !== cleanStr ) {
                    debug.error( "Value exceeds number precision " + cleanValue );
                    result = NaN;
                }
            }
        }
        return result;
    };

    const reNumFmtX = /^(FM)?(0*X+)$/,
        reNumFmtL = /^(FMS|SFM|S|FM)?([CLU])?([D$09B][GD$09B]*)?(V9+)?([CLU])?(PR|MI|S)?$/,
        reNumFmt  = /^(FMS|SFM|S|FM)?([CLU])?([.$09B][,.$09B]*)?(V9+)?([CLU])?(PR|MI|S)?$/,
        overflowChars = "########################################";

    /*
     formatNumber notes:
     FM removes leading or trailing blanks if there would be any
     9: number
     0: leading/trailing zeros
     B: blank can only have one
     Group and Decimal separators - can't mix G/D with ,/. can't have leading group
     ,: , group must all be before decimal
     .: . decimal can only have one
     G: group must all be before decimal
     D: decimal can only have one
     Currency Symbols - at start or end mostly:
     $: $ anywhere between currency position but puts $ at start
     C: NLS_ISO_CURRENCY
     L: NLS_CURRENCY
     U: NLS_DUAL_CURRENCY
     Sign:
     S: +/- start or end
     PR: <n> for negative " " n " " for positive
     MI: - or blank only at end
     V99...: Scale

     No Support for: RN TM or EEEE
     todo consider how to handle +/-Infinity and NaN
     todo consider how to handle padding spaces
     Common formats:
     FML999G999G999G999G990D00
     999G999G999G999G990D00
     999G999G999G999G990D0000
     999G999G999G999G999G999G990
     999G999G999G999G990D00MI
     S999G999G999G999G990D00
     999G999G999G999G990D00PR
    */

    /**
     * <p>Formats a number using a database format model similar to the SQL <code>TO_CHAR(<i>number</i>)</code> function.</p>
     * <p>See the Oracle SQL Language reference section on Format Models for more information on the
     * pFormat parameter. The format elements RN, TM, and EEEE are not supported.</p>
     *
     * @param {number} pValue The number to format.
     * @param {string} [pFormat] The database format model. The format elements RN, TM, and EEEE are not supported.
     *     If the format is not given the number is returned as a string with only the decimal separator replaced
     *     with the locale specific decimal separator.
     * @param {object} [pOptions] Options to override default locale settings. All properties optional.
     * @param {string} pOptions.NLS_NUMERIC_CHARACTERS A string where the first letter is the decimal separator and
     *   the second letter is the group separator
     * @param {string} pOptions.NLS_CURRENCY The local currency string.
     * @param {string} pOptions.NLS_DUAL_CURRENCY The dual currency string.
     * @param {string} pOptions.NLS_ISO_CURRENCY The ISO currency string. Note: This option differs from the corresponding
     *   database parameter. It is the ISO currency string such as "CAD" rather than the territory name such as "CANADA".
     * @returns {string} The formatted number.
     * @example <caption>Format the number 1234.569 with locale specific currency symbol and 2 decimal places.</caption>
     * var formattedNumber = apex.locale.formatNumber( 1234.569, "FML999G999G999G999G990D00" );
     * // In the US English locale this will display: "The cost is: $1,234.57"
     * apex.message.alert( "The cost is: " + formattedNumber, function() {
     *      // do something after message is shown if needed
     * } );
     * @function formatNumber
     * @memberOf apex.locale
     */
    locale.formatNumber = function( pValue, pFormat, pOptions ) {
        let s, d, absVal, m, cur, sign, fm, b, numFmt, index, leadingCur, zeroPad, upCase, strNum, width, fmtWidth, src,
            formatUC, parts, left, right, fmtLeft, fmtRight, decimalSep, groupSep, scale,
            numberSettings = { // not using _toRawFixed for groups
                groupingSize: 0,
                groupingSize0: 0,
                decimalSeparator: ".",
                groupingSeparator: ""
            };

        function invalid() {
            throw( new Error( "Invalid number format model " + pFormat ) );
        }

        function overflow() {
            return overflowChars.substr( 0, width );
        }

        if ( pValue === null || pValue === '' ) {
            return "";
        }

        // init option defaults and override with given options if any
        pOptions = $.extend( {
            NLS_NUMERIC_CHARACTERS: locale.getDecimalSeparator() + locale.getGroupSeparator(),
            NLS_CURRENCY: locale.getCurrency(),
            NLS_DUAL_CURRENCY: locale.getDualCurrency(),
            NLS_ISO_CURRENCY: locale.getISOCurrency()
        }, pOptions );

        decimalSep = pOptions.NLS_NUMERIC_CHARACTERS[0];
        groupSep = pOptions.NLS_NUMERIC_CHARACTERS[1];
        if ( decimalSep === groupSep ) {
            throw( new Error( "Invalid NLS parameter") );
        }

        if ( pFormat == null ) { // intentional ==
            let isNumber = typeof pValue === "number";

            pValue = "" + pValue; // no formatting just make it a string.

            // see bug 32807876
            if ( isNumber && decimalSep !== "." && pValue.includes( "." ) ) { // todo update the doc on pFormat to include this little formatting
                pValue = pValue.replace( ".", decimalSep );
            }
            return pValue;
        }

        formatUC = pFormat.toUpperCase();

        // check format model
        m = reNumFmtX.exec( formatUC );
        if ( m ) {
            // hex case
            fm = m[1] && m[1].indexOf("FM") >= 0;
            numFmt = m[2];
            zeroPad = numFmt.substr( 0, 1 ) === "0";
            upCase = numFmt === pFormat.replace(/FM/i, ""); // a single lower case X means all lower case
            fmtWidth = numFmt.length;
            width = fmtWidth + 1; // plus 1 as if leaving space for a sign

            if ( pValue < 0 || pValue > ( Number.MAX_SAFE_INTEGER || 9007199254740991 ) ) { // IE11 doesn't have MAX_SAFE_INTEGER
                strNum = overflow();
            } else {
                strNum = Math.round( pValue ).toString( 16 );
                if ( upCase ) {
                    strNum = strNum.toUpperCase();
                }
                if ( zeroPad ) {
                    strNum = _zeroPad( strNum, numFmt.length, true );
                }
                if ( strNum.length > fmtWidth ) {
                    strNum = overflow();
                } else if ( !fm ) {
                    strNum = " " + strNum;
                }
            }
            return strNum;
        } // else not a hex format perhaps something else

        m = reNumFmtL.exec( formatUC );
        if ( !m ) {
            decimalSep = ".";
            groupSep = ",";
            m = reNumFmt.exec( formatUC );
        }
        if ( !m ) {
            invalid();
        } // else so far have a valid format model

        m[1] = m[1] || "";
        // check for currency
        if ( m[2] && m[5] ) {
            invalid(); // can't have currency at beginning and end
        } // else
        fm = m[1].indexOf("FM") >= 0;
        cur = m[2] || m[5] || "";
        leadingCur = !!m[2];
        numFmt = m[3] || "B";
        index = numFmt.indexOf( "$" );
        if ( index >= 0 ) {
            if ( cur ) {
                invalid(); // can't have both $ and other currency
            } // else
            cur = "$";
            leadingCur = true;
            // remove $ from format pattern
            numFmt = numFmt.substr( 0, index ) + numFmt.substr( index + 1 );
        }
        // check for B
        index = numFmt.indexOf( "B" );
        b = index >= 0;
        if ( b ) {
            // remove B from format pattern
            numFmt = numFmt.substr( 0, index ) + numFmt.substr( index + 1 );
        }
        // check for sign options
        sign = "";
        index = m[1].indexOf( "S" );
        if ( index >= 0 && m[6] ) {
            invalid(); // can't have S at beginning and end
        } // else
        if ( index >= 0 ) {
            sign = "LS"; // leading sign
        } else {
            sign = m[6] || "";
        }
        // check for V9+ scale
        scale = m[4] || "";
        if ( scale && numFmt.match(/[D.]/) ) {
            invalid();
        } // else
        if ( scale ) {
            scale = scale.substr(1); // remove V left with a bunch of 9s
            pValue *= parseInt(scale, 10) + 1;
            numFmt += scale;
        }
        // more validity checks and split into before and after the decimal separator
        parts = numFmt.split(/[D.]/);
        if ( parts.length > 2 || ( parts.length > 1 && parts[1].match(/[G,]/) ) || numFmt.match(/[B$]/) ) {
            invalid(); // multiple decimal separators or a group separator after the decimal separator or more than one $ or B
        } // else

        fmtLeft = parts[0];
        fmtRight = parts[1] || "";
        width = numFmt.length + 1; // 1 extra for possible - sign
        if ( sign === "PR" ) {
            width += 1; // PR format adds an extra char for < >
        }
        if ( cur ) {
            switch ( cur ) {
                case "C":
                    cur = pOptions.NLS_ISO_CURRENCY;
                    width += 7;
                    break;
                case "L":
                    cur = pOptions.NLS_CURRENCY;
                    width += 10;
                    break;
                case "U":
                    cur = pOptions.NLS_DUAL_CURRENCY;
                    width += 10;
                    break;
                case "$":
                    width += 1;
            }
        }

        absVal = Math.abs( pValue );
        if ( isNaN( absVal ) ) {
            // pValue is supposed to be a number. Implicit conversion to number is OK too.
            // But if it is not a number stop now otherwise results is NaN.00 which looks strange
            // todo consider if this should throw instead
            return "NaN";
        }
        if ( pValue < 0 ) {
            absVal = -absVal;
        }
        // only using _toRawFixed for turning number to string, zeroPad and rounding of decimal part; not groups
        numberSettings.maximumFractionDigits = fmtRight.length;
        index = fmtRight.lastIndexOf( "0" );
        numberSettings.minimumFractionDigits = fm && index >= 0 ? index + 1 : fmtRight.length;
        src = fmtLeft.replace(/[G,]/g, ""); // tmp to calculate zero pad integer digits
        index = src.indexOf( "0" );
        numberSettings.minimumIntegerDigits = index >= 0 ? src.length - index : 0;
        strNum = _toRawFixed( absVal, {}, numberSettings);

        // May need to take away a leading 0.
        if ( strNum.substr( 0, 2 ) === "0." && fmtLeft[fmtLeft.length - 1] === "9" ) {
            strNum = strNum.substr( 1 );
        }

        // Process group separator
        parts = strNum.split( "." );
        src = parts[0];
        right = parts[1] || "";

        // todo xxx does not handle leading spaces the same as to_char
        left = "";
        for ( s = fmtLeft.length - 1, d = src.length - 1; s >= 0; s-- ) {
            if ( fmtLeft[s].match( /[G,]/ ) ) {
                if ( d >= 0 ) {
                    left = groupSep + left;
                }
            } else {
                if ( d < 0 ) {
                    break;
                } else {
                    left = src[d] + left;
                    d -= 1;
                }
            }
        }
        if ( d >= 0 && !( b && numFmt === "" && strNum < 1 ) ) { // special case for strange "B" format model
            // format didn't use up all the integer part
            return overflow();
        } // else

        // put the number back together.
        strNum = left;
        if ( numFmt.match( /[D.]/ ) ) {
            strNum += decimalSep + right;
        }

        if ( b && strNum.match(/^[0.,]*$/) ) {
            strNum = "";
        }

        // add currency symbol if needed
        if ( cur ) {
            if ( leadingCur ) {
                strNum = cur + strNum;
            } else {
                strNum = strNum + cur;
            }
        }
        // all the combinations of fm and sign for negative and non negative numbers
        fm = fm ? "" : " "; // turn this into a space or nothing
        if ( pValue <  0 && strNum !== "" ) {
            switch ( sign ) {
                case "LS":
                    strNum = "-" + strNum;
                    break;
                case "S":
                    strNum = strNum + "-";
                    break;
                case "MI":
                    strNum = strNum + "-";
                    break;
                case "PR":
                    strNum = "<" + strNum + ">";
                    break;
                default:
                    strNum = "-" + strNum;
            }
        } else if ( pValue >= 0 ) {
            switch ( sign ) {
                case "LS":
                    strNum = "+" + strNum;
                    break;
                case "S":
                    strNum = strNum + "+";
                    break;
                case "MI":
                case "PR":
                    strNum = strNum + fm;
                    break;
            }
        }
        if ( strNum.length < width ) {
            strNum = fm + strNum;
        }

        return strNum;
    };

    /**
     * <p>Formats the given number in a compact, locale specific way. For example in the US English locale the
     * number 123400 would be formatted as "123.4K" and 1234000 as "1.23M".</p>
     *
     * <p>This function relies on additional resources that are loaded when the page first loads. Calling this function
     * before the resources are loaded returns the number as an unformatted string. See {@link apex.locale.resourcesLoaded}.</p>
     *
     * @param {number} pValue The number value to be formatted.
     * @param {object} [pOptions] An options object that affect the way the number is formatted. All properties optional.
     * @param {number} pOptions.maximumFractionDigits The maximum number of digits to display after the decimal point. Default 2.
     * @param {number} pOptions.minimumFractionDigits The minimum number of digits to display after the decimal point. Default 0.
     * @param {number} pOptions.minimumIntegerDigits The minimum number of integer digits to display before the decimal point. Default 1.
     * @param {string} pOptions.roundingMode One of 'DEFAULT', 'HALF_UP', 'HALF_DOWN', 'HALF_EVEN', 'UP', 'DOWN', 'CEILING', 'FLOOR'.
     *     The default is "DEFAULT".
     * @param {string} pOptions.separators The characters to use for the decimal and group separator. The default is
     *     to use the appropriate locale specific characters.
     * @param {string} pOptions.separators.decimal The decimal separator character.
     * @param {string} pOptions.separators.group The group separator character.
     * @param {boolean} pOptions.useGrouping If true use locale specific rules to separate digits into groups.
     *     The default is true.
     * @returns {string} The compact formatted number.
     * @example <caption>Format the large number 123456789.12 in a compact format and display it in an alert message.</caption>
     * var largeNumber = 123456789.12;
     * var formattedNumber = apex.locale.formatCompactNumber( largeNumber );
     * // In the US English locale this will display: "The number is: 123.46M"
     * apex.message.alert( "The number is: " + formattedNumber, function() {
     *      // do something after message is shown if needed
     * } );
     * @example <caption>Format the same large number 123456789.12 in a compact format using an option to not include
     *     any fraction digits.</caption>
     * var largeNumber = 123456789.12;
     * var formattedNumber = apex.locale.formatCompactNumber( largeNumber, { maximumFractionDigits: 0 } );
     * // In the US English locale the formattedNumber is equal to 123M"
     * @function formatCompactNumber
     * @memberOf apex.locale
     */
    locale.formatCompactNumber = function( pValue, pOptions ) {
        let result, number, numberSettings, lang, root, optSep, pattern, parts, gs, gs0,
            numbers, decimalFormats, numSysKey, numSys, minusSign;

        // don't fail if resources not loaded for any reason
        if ( locale.resourcesLoaded().state() !== "resolved" ) {
            debug.warn( "Can't format number before locale resources loaded." );
            return "" + pValue;
        } // else

        // assumes style is decimal (not currency, unit or percent)
        pOptions = $.extend( {
            useGrouping: true,
            roundingMode: "DEFAULT",
            maximumFractionDigits: 2,
            minimumFractionDigits: 0,
            minimumIntegerDigits: 1
        }, pOptions );
        delete pOptions.pattern; // don't support pattern

        root = gLocaleSettings.cldr; // NOTE don't use property _ojLocale_ it is only present when loaded via require.
        lang = Object.keys(root.main)[0]; // the name of the property under main is the lang ex: { "de-AT": {...} }.
        numbers = root.main[lang].numbers;
        numSysKey = "latn"; // JET has a way to use different values here. For now we always use "latn".
                            // The compact format config always uses latn.
                            // The impact is minimal, only affects symbols and we only use decimal, group, and minusSign.
                            // the other thing is we don't use numbering system specific digit characters.
        numSys = "symbols-numberSystem-" + numSysKey;
        minusSign = numbers[numSys].minusSign;
        decimalFormats = numbers["decimalFormats-numberSystem-latn"];

        // figure out groupingSize based on pattern
        pattern = decimalFormats.standard;
        pattern = pattern.split( "." )[0]; // just care about the LHS
        parts = pattern.split( "," );
        if ( parts.length > 2 ) {
            gs = parts[parts.length - 1].length;
            gs0 = parts[parts.length - 2].length;
        } else if ( parts.length > 1 ) {
            gs = parts[parts.length - 1].length;
            gs0 = 0;
        }

        optSep = pOptions.separators || {};
        numberSettings = {
            lang: getBCP47Lang(lang),
            shortDecimalFormat: decimalFormats.short.decimalFormat, // force short JET allows long or standard
            groupingSize: gs || 3,
            groupingSize0: gs0 || 0,
            decimalSeparator: optSep.decimal || numbers[numSys].decimal,
            groupingSeparator: optSep.group || numbers[numSys].group,
            maximumFractionDigits: pOptions.maximumFractionDigits,
            minimumFractionDigits: pOptions.minimumFractionDigits,
            minimumIntegerDigits: pOptions.minimumIntegerDigits
        };

        result = "";
        number = _toCompactNumber( pValue, pOptions, numberSettings );
        if ( pValue < 0 && ( number - 0 !== 0) ) {
            result += minusSign + number;
        } else {
            result += number;
        }
        return result;
    };

    // todo future consider formatDigitalNumber using JET _toDigitalByte

    /*
     * Oracle JET
     * Copyright (c) 2014, 2018, Oracle and/or its affiliates.
     * The Universal Permissive License (UPL), Version 1.0
     * Some code adapted from JET NumberConverter
     */

    var _REGEX_ONLY_ZEROS = /^0+$/;
    var _decimalTypeValues = {
        trillion: [100000000000000, 10000000000000, 1000000000000],
        billion: [100000000000, 10000000000, 1000000000],
        million: [100000000, 10000000, 1000000],
        thousand: [100000, 10000, 1000]
    };

    var _decimalTypeValuesMap = {
        trillion: 1000000000000,
        billion: 1000000000,
        million: 1000000,
        thousand: 1000
    };

    // maps roundingMode attributes to Math rounding modes.
    var _roundingModeMap = {
        HALF_UP: 'ceil',
        CEILING: 'ceil',
        UP: 'ceil',
        HALF_DOWN: 'floor',
        FLOOR: 'floor',
        DOWN: 'floor',
        DEFAULT: 'round'
    };

    // prepend or append count zeros to a string.
    function _zeroPad(str, count, left) {
        var l;
        for (l = str.length; l < count; l += 1) {
            // eslint-disable-next-line no-param-reassign
            str = (left ? ('0' + str) : (str + '0'));
        }
        return str;
    }

    // _toCompactNumber does compact formatting like 3000->3K for short
    // and "3 thousand" for long
    function _toCompactNumber(number, options, numberSettings) {
        function _getZerosInPattern(s) {
            var i = 0;
            var n = 0;
            var idx = 0;
            var prefix = '';
            if (s[0] !== '0') {
                while (s[i] !== '0' && i < s.length) {
                    i += 1;
                }
                prefix = s.substr(0, i);
                idx = i;
            }
            for (i = idx; i < s.length; i++) {
                if (s[i] === '0') {
                    n += 1;
                } else {
                    break;
                }
            }
            return [prefix, n];
        }

        /* To format a number N, the greatest type less than or equal to N is used, with
         * the appropriate plural category. N is divided by the type, after removing the
         * number of zeros in the pattern, less 1.
         * APIs supporting this format should provide control over the number of
         * significant or fraction digits.
         *Thus N=12345 matches <pattern type="10000" count="other">00 K</pattern>.
         *N is divided by 1000 (obtained from 10000 after removing "00" and restoring
         *one "0". The result is formatted according to the normal decimal pattern.
         *With no fractional digits, that yields "12 K".
         */
        function _matchTypeValue(n) {
            var decimalTypeKeys = Object.keys(_decimalTypeValues);
            for (var i = 0; i < decimalTypeKeys.length; i++) {
                var decimalTypeKey = decimalTypeKeys[i];
                var len = _decimalTypeValues[decimalTypeKey].length;
                for (var j = 0; j < len; j++) {
                    if (_decimalTypeValues[decimalTypeKey][j] <= n) {
                        return [decimalTypeKey, _decimalTypeValues[decimalTypeKey][j]];
                    }
                }
            }
            return [n, null];
        }
        var absVal = Math.abs(number);
        var typeVal = _matchTypeValue(absVal);
        var prefix = '';
        var decimalFormatType;
        var tokens;
        var zeros;
        if (typeVal[1] !== null) {
            var lang = numberSettings.lang;
            var plural = new Intl.PluralRules(lang).select(
                Math.floor(absVal / _decimalTypeValuesMap[typeVal[0]]));
            decimalFormatType = '' + typeVal[1] + '-count-' + plural;
            decimalFormatType = numberSettings.shortDecimalFormat[decimalFormatType];
            if (decimalFormatType === undefined) {
                plural = 'other';
                decimalFormatType = '' + typeVal[1] + '-count-' + plural;
                decimalFormatType = numberSettings.shortDecimalFormat[decimalFormatType];
            }
            tokens = _getZerosInPattern(decimalFormatType);
            zeros = tokens[1];
            prefix = tokens[0];
            if (zeros < decimalFormatType.length) {
                var i = (1 * Math.pow(10, zeros));
                i = (typeVal[1] / i) * 10;
                // eslint-disable-next-line no-param-reassign
                absVal /= i;
            }
        }
        var s = '';
        var fmt;
        if (decimalFormatType !== undefined) {
            s = decimalFormatType.substr(zeros + tokens[0].length);
        }
        if (number < 0) {
            absVal = -absVal;
        }
        fmt = _toRawFixed(absVal, options, numberSettings);
        var regExp = /'\.'/g;
        s = s.replace(regExp, '.');
        s = prefix + fmt + s;
        return s;
    }

    // _toRawFixed does the formatting based on
    // minimumFractionDigits and maximumFractionDigits.
    function _toRawFixed(number, options, numberSettings) {
        var curSize = numberSettings.groupingSize;
        var curSize0 = numberSettings.groupingSize0;
        var decimalSeparator = numberSettings.decimalSeparator;
        // First round the number based on maximumFractionDigits
        var numberString = number + '';
        var split = numberString.split(/e/i);
        var exponent = split.length > 1 ? parseInt(split[1], 10) : 0;
        numberString = split[0];
        split = numberString.split('.');
        var right = split.length > 1 ? split[1] : '';
        var precision = Math.min(numberSettings.maximumFractionDigits,
            right.length - exponent);
        // round the number only if it has decimal points
        if (split.length > 1 && right.length > exponent) {
            var mode = options.roundingMode || 'DEFAULT';
            // eslint-disable-next-line no-param-reassign
            number = _roundNumber(number, precision, mode);
        }
        // split the number into integer, fraction and exponent parts.
        numberString = Math.abs(number) + '';
        split = numberString.split(/e/i);
        exponent = split.length > 1 ? parseInt(split[1], 10) : 0;
        numberString = split[0];
        split = numberString.split('.');
        numberString = split[0];
        right = split.length > 1 ? split[1] : '';
        // pad zeros based on the exponent value and minimumFractionDigits
        if (exponent > 0) {
            right = _zeroPad(right, exponent, false);
            numberString += right.slice(0, exponent);
            right = right.substr(exponent);
        } else if (exponent < 0) {
            exponent = -exponent;
            numberString = _zeroPad(numberString, exponent + 1, true);
            right = numberString.slice(-exponent, numberString.length) + right;
            numberString = numberString.slice(0, -exponent);
        }
        if (precision > 0 && right.length > 0) {
            right = ((right.length > precision) ? right.slice(0, precision) :
                _zeroPad(right, precision, false));
            // if right is only zeros, truncate it to minimumFractionDigits
            if (_REGEX_ONLY_ZEROS.test(right) === true) {
                right = right.slice(0, numberSettings.minimumFractionDigits);
            }
            right = decimalSeparator + right;
        } else if (numberSettings.minimumFractionDigits > 0) {
            right = decimalSeparator;
        } else {
            right = '';
        }
        // insert grouping separator in the integer part based on groupingSize
        var padLen = decimalSeparator.length +
            numberSettings.minimumFractionDigits;
        right = _zeroPad(right, padLen, false);
        var sep = numberSettings.groupingSeparator;
        var ret = '';
        if (options.useGrouping === false && options.pattern === undefined) {
            sep = '';
        }
        numberString = _zeroPad(numberString,
            numberSettings.minimumIntegerDigits, true);
        var stringIndex = numberString.length - 1;
        right = right.length > 1 ? right : '';
        var rets;
        while (stringIndex >= 0) {
            if (curSize === 0 || curSize > stringIndex) {
                rets = numberString.slice(0, stringIndex + 1) +
                    (ret.length ? (sep + ret + right) : right);
                return rets;
            }
            ret = numberString.slice((stringIndex - curSize) + 1, stringIndex + 1) +
                (ret.length ? (sep + ret) : '');
            stringIndex -= curSize;
            if (curSize0 > 0) {
                curSize = curSize0;
            }
        }
        rets = numberString.slice(0, stringIndex + 1) + sep + ret + right;
        return rets;
    }

    /* rounds the number based on the following rules:
     * CEILING: Rounding mode to round towards positive infinity.
     * DOWN: Rounding mode to round towards zero.
     * FLOOR: Rounding mode to round towards negative infinity.
     * HALF_DOWN: Rounding mode to round towards "nearest neighbor" unless both neighbors are equidistant, in which case round down.
     * HALF_EVEN: Rounding mode to round towards the "nearest neighbor" unless both neighbors are equidistant, in which case, round towards the even neighbor.
     * HALF_UP: Rounding mode to round towards "nearest neighbor" unless both neighbors are equidistant, in which case round up.
     * UP: Rounding mode to round away from zero.
     */
    function _roundNumber(value, scale, mode) {
        var rounded;
        var adjustedMode = mode;
        var parts = value.toString().split('.');
        if (parts[1] === undefined) {
            return Math.abs(value);
        }
        if (mode !== 'DEFAULT') {
            // HALF_DOWN behaves as HALF_UP if the discarded fraction is > 0.5
            if (mode === 'HALF_UP' || mode === 'HALF_EVEN' || mode === 'HALF_DOWN') {
                if (parts[1][scale] === '5') {
                    var n = parts[1].substr(scale);
                    n = parseInt(n, 10);
                    if (n > 5) {
                        adjustedMode = 'HALF_UP';
                    }
                } else {
                    adjustedMode = 'DEFAULT';
                }
                // eslint-disable-next-line no-param-reassign
                value = Math.abs(value);
            }
            adjustedMode = _getRoundingMode(parts, adjustedMode, scale, value);
            rounded = _decimalAdjust(value, -scale, adjustedMode);
        } else {
            var factor = Math.pow(10, scale);
            rounded = Math.round(value * factor) / factor;
            if (!isFinite(rounded)) {
                return value;
            }
        }
        return Math.abs(rounded);
    }

    function _getRoundingMode(parts, rMode, scale, value) {
        var mode = _roundingModeMap[rMode];
        if (rMode === 'HALF_EVEN') {
            var c;
            if (scale === 0) {
                var len = parts[0].length;
                c = parseInt(parts[0][len - 1], 10);
            } else {
                c = parseInt(parts[1][scale - 1], 10);
            }
            if (c % 2 === 0) {
                mode = _roundingModeMap.HALF_DOWN;
            } else {
                mode = _roundingModeMap.HALF_UP;
            }
        } else if (rMode === 'UP' && value < 0) {
            mode = _roundingModeMap.DOWN;
        } else if (rMode === 'DOWN' && value < 0) {
            mode = _roundingModeMap.UP;
        }
        return mode;
    }

    /*
     * This function does the actual rounding of the number based on the rounding
     * mode:
     * value is the number to be rounded.
     * scale is the maximumFractionDigits.
     * mode is the rounding mode: ceil, floor, round.
     */
    function _decimalAdjust(value, scale, mode) {
        if (scale === 0) {
            return Math[mode](value);
        }
        var strValue = value.toString().split('e');
        var v0 = strValue[0];
        var v1 = strValue[1];
        // shift the decimal point based on the scale so that we can apply ceil or floor
        // scale is a number, no need to parse it, just parse v1.
        var s = v0 + 'e' + (v1 ? (parseInt(v1, 10) - scale) : -scale);
        var num = parseFloat(s);
        var _value = Math[mode](num);
        strValue = _value.toString().split('e');
        // need to extract v0 and v1 again because value has changed after applying Math[mode].
        v0 = strValue[0];
        v1 = strValue[1];
        // shift the decimal point back to its original position
        s = v0 + 'e' + (v1 ? (parseInt(v1, 10) + scale) : scale);
        num = parseFloat(s);
        return num;
    }

})( apex.locale, apex.debug, apex.util, apex.jQuery );
