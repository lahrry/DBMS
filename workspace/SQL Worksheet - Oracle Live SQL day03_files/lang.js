/*!
 lang.js
 Copyright (c) 2015, 2021, Oracle and/or its affiliates. All rights reserved.
 */
/*
 * Depends on:
 * $v which needs item.js etc.
 * locale.js
 * server.js just for the setting jQuery.ajaxSettings.traditional = true;
*/

/**
 * <p>This namespace is used for text and message localization related functions of Oracle APEX.
 * @namespace
 */
apex.lang = ( function( util, debug, locale, env, $ ) {
    "use strict";

    const placeholderRE = /%([0-9,%])/g;

    const flowMessagesUrl = "wwv_flow.js_messages";

    // unsafe means that the arguments need to be escaped
    // set unsafe to false when the arguments are already escaped or the
    // resulting string will be escaped
    function formatMessage( pUnsafe, pPattern, ...args ) {
        let errorCase,
            count = 0;

        let result = pPattern.replace( placeholderRE, function( m, p1 ) {
            let n, v;

            if ( p1 === "%" ) {
                return "%";
            }
            n = parseInt( p1, 10 );
            count += 1;
            if ( n >= args.length ) {
                v = "?";
            } else {
                v = args[n];
            }
            return pUnsafe ? util.escapeHTML( v + "" ) : v;
        } );

        if ( count < args.length ) {
            errorCase = "many";
        } else if ( count > args.length ) {
            errorCase = "few";
        }
        if ( errorCase ) {
            debug.error( `Format('${pPattern}'): too ${errorCase} arguments. Expecting ${count}, got ${args.length}` );
        }
        return result;
    }

    /*
     * Localized text and message formatting support
     */
    let gMessages = {}; // mapping from message key to localized text

    /**
     * @lends apex.lang
     */
    const lang = {

    /**
     * <p>Add messages for use by {@link apex.lang.getMessage} and the format functions. Can be called multiple times.
     * Additional messages are merged. It is generally not necessary to call this function, because it is
     * automatically called with all the application text messages that have attribute <em>Used in JavaScript</em> set to on.</p>
     *
     * @param {Object} pMessages An object whose properties are message keys (names), and the values are localized message text.
     * @example <caption>This example adds a message with key "APPLY_BUTTON_LABEL" and message text "Apply".</caption>
     * apex.lang.addMessages( {
     *     APPLY_BUTTON_LABEL: "Apply"
     * } );
     */
    addMessages: function( pMessages ) {
        $.extend( gMessages, pMessages );
    },

    /**
     * <p>Load additional messages from the server.</p>
     * <p>When an APEX page loads it automatically loads any text messages that have attribute <em>Used in JavaScript</em>
     * set to on. This function is useful when there are strings that are not always needed on the client
     * but can be loaded on demand.</p>
     *
     * @param {string[]} pMessageKeys An array of message keys (names) to load. The message keys can end in "%" to load
     *   all the messages with keys that start with the given text.
     * @return {Promise} promise resolved (with no data) when messages are available, rejected (with no data) if the
     * ajax request fails.
     * @example <caption>This example loads two additional text messages with names "MY_MESSAGE1" and "MY_MESSAGE2".
     * Once they have been loaded it uses <code class="prettyprint">getMessage</code> to get the message text.</caption>
     * var promise = apex.lang.loadMessages( ["MY_MESSAGE1", "MY_MESSAGE2"] );
     * promise.done(function() {
     *     var text = apex.lang.getMessage("MY_MESSAGE1");
     *     // use text somehow
     * }.fail(function() {
     *     apex.debug.error( "Could not get messages." );
     * };
     * @example <caption>This example loads all the messages for a component. The component has named all its
     * message keys with a common prefix "MY_COMPONENT_". So the following would load messages such as
     * "MY_COMPONENT_MESSAGE1", "MY_COMPONENT_MESSAGE2" and so on.</caption>
     * var promise = apex.lang.loadMessages( ["MY_COMPONENT_%"] );
     * ...
     */
    loadMessages: function( pMessageKeys ) {
        let deferred = $.Deferred(),
            data = {
                p_app_id: env.APP_ID,
                p_lang: locale.getLanguage(),
                p_version: "1", // Use a dummy version number, because we don't have the real application version which could be used for better caching support
                p_names: pMessageKeys
            },
            jqXHR = $.get( flowMessagesUrl, data, null, "json" );

        jqXHR.done( function( resultData ) {
            lang.addMessages( resultData );
            deferred.resolve();
        } ).fail( function() {
            deferred.reject();
        });
        return deferred.promise();
    },

    /**
     * <p>Load additional messages from the server only if they are not already loaded.</p>
     * <p>When an APEX page loads it automatically loads any text messages that have attribute <em>Used in JavaScript</em>
     * set to on. This function is useful when there are strings that are not always needed on the client
     * but can be loaded on demand.</p>
     *
     * @param {string[]} pMessageKeys An array of message keys (names) that are needed by pCallback. These messages
     *   will be loaded if needed.
     * @param pCallback A no argument function that is called when all the keys have been loaded. If all the
     * messages have already been loaded then this function is called right away.
     * @example <caption>This example code could be put in a Dynamic Action Execute JavaScript Code action that runs
     * when a "More Details" button is pressed. It loads the "DETAILED_HELP_INFO" message and displays it in
     * an alert.</caption>
     * apex.lang.loadMessage( ["DETAILED_HELP_INFO"], function() {
     *     apex.message.alert( apex.lang.getMessage( "DETAILED_HELP_INFO" );
     * } );
     */
    loadMessagesIfNeeded: function( pMessageKeys, pCallback ) {
        let needed = [];

        for ( let i = 0; i < pMessageKeys.length; i++ ) {
            if ( !this.hasMessage( pMessageKeys[i] ) ) {
                needed.push( pMessageKeys[ i ] );
            }
        }

        if ( needed.length > 0 ) {
            lang.loadMessages( needed ).done( function() {
                pCallback();
            });
        } else {
            pCallback();
        }
    },

    /**
     * <p>Remove all messages. This method is rarely needed. Many Oracle APEX components rely on client-side
     * messages, so if you clear the messages you need to add any needed messages again.</p>
     *
     * @example <caption>This example removes all messages.</caption>
     * apex.lang.clearMessages();
     */
    clearMessages: function( ) {
        gMessages = {};
    },

    /**
     * <p>Return the message associated with the given key.
     * The key is looked up in the messages added with the {@link apex.lang.addMessages}, {@link apex.lang.loadMessages},
     * or {@link apex.lang.loadMessagesIfNeeded} functions.</p>
     *
     * @param {string} pKey The message key.
     * @return {string} The localized message text. If the key is not found then the key is returned.
     * @example <caption>This example returns "OK" when the localized text for key OK_BTN_LABEL is "OK".</caption>
     * apex.lang.getMessage( "OK_BTN_LABEL" );
     */
    getMessage: function( pKey ) {
        let msg = gMessages[ pKey ];

        return msg == null ? pKey : msg;
    },

    /**
     * <p>Return true if pKey exists in the messages added with the {@link apex.lang.addMessages},
     * {@link apex.lang.loadMessages}, or {@link apex.lang.loadMessagesIfNeeded} functions.</p>
     *
     * @param {string} pKey The message key.
     * @return {boolean} true if the given message exists and false otherwise.
     * @example <caption>This example checks for the existence of a message, "EXTRA_MESSAGE", before using it.</caption>
     * if ( apex.lang.hasMessage( "EXTRA_MESSAGE" ) ) {
     *     text += apex.lang.getMessage( "EXTRA_MESSAGE" );
     * }
     */
    hasMessage: function( pKey ) {
        let msg = gMessages[ pKey ];

        return msg != null;
    },

    /**
     * <p>Format a message. Parameters in the message, %0 to %9, are replaced with the corresponding function argument.
     * Use %% to include a single %. The replacement arguments are HTML escaped.
     *
     * @param {string} pKey The message key. The key is used to lookup the localized message text as if with getMessage.
     * @param {...*} pValues Any number of replacement values, one for each message parameter %0 to %9.
     *   Non string arguments are converted to strings.
     * @return {string} The localized and formatted message text. If the key is not found then the key is returned.
     * @example <caption>This example returns "Process 60% complete" when the PROCESS_STATUS message text is
     *   "Process %0%% complete" and the progress variable value is 60.</caption>
     *   apex.lang.formatMessage( "PROCESS_STATUS", progress );
     */
    formatMessage: function( pKey, ...pValues ) {
        let pattern = lang.getMessage( pKey );

        return lang.format( pattern, ...pValues );
    },

    /**
     * <p>Formats a message.
     * Same as {@link apex.lang.formatMessage} except the message pattern is given directly.
     * It is already localized or isn't supposed to be.
     * It is not a key. The replacement arguments are HTML escaped.</p>
     *
     * @param {string} pPattern The message pattern.
     * @param {...*} pValues Any number of replacement values, one for each message parameter %0 to %9.
     *   Non string arguments are converted to strings.
     * @return {string} The formatted message text.
     * @example <caption>This example returns "Total cost: $34.00" assuming the orderTotal variable equals "34.00".</caption>
     * apex.lang.format( "Total cost: $%0", orderTotal );
     */
    format: function( pPattern, ...pValues ) {
        return formatMessage( true, pPattern, ...pValues );
    },

    /**
     * <p>Same as {@link apex.lang.formatMessage} except the replacement arguments are not HTML escaped.
     * They must be known to be safe or will be used in a context that is safe.</p>
     *
     * @param {string} pKey The message key. The key is used to lookup the localized message text as if with getMessage.
     * @param {...*} pValues Any number of replacement values, one for each message parameter %0 to %9.
     *   Non string arguments are converted to strings.
     * @return {string} The localized and formatted message text. If the key is not found then the key is returned.
     * @example <caption>This example returns "You entered &lt;ok>" when the CONFIRM message text is "You entered %0"
     *   and the inputValue variable value is "&lt;ok>". Note this string must be used in a context where HTML escaping
     *   is done to avoid XSS vulnerabilities.</caption>
     * apex.lang.formatMessageNoEscape( "CONFIRM", inputValue );
     */
    formatMessageNoEscape: function(  pKey, ...pValues ) {
        let pattern = lang.getMessage( pKey );

        return lang.formatNoEscape( pattern, ...pValues );
    },

    /**
     * <p>Same as {@link apex.lang.format}, except the replacement arguments are not HTML escaped.
     * They must be known to be safe or are used in a context that is safe.</p>
     *
     * @param {string} pPattern The message pattern.
     * @param {...*} pValues Any number of replacement values, one for each message parameter %0 to %9.
     *   Non string arguments are converted to strings.
     * @return {string} The formatted message text.
     * @example <caption>This example returns "You entered &lt;ok>" when the inputValue variable value is "&lt;ok>".
     *   Note this string must be used in a context where HTML escaping is done to avoid XSS vulnerabilities.</caption>
     * apex.lang.formatNoEscape( "You entered %0", inputValue );
     */
    formatNoEscape: function( pPattern, ...pValues ) {
        return formatMessage( false, pPattern, ...pValues );
    }
    };
    return lang;
})( apex.util, apex.debug, apex.locale, apex.env, apex.jQuery );
