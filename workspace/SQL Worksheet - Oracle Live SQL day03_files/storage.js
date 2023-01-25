/*
 * Copyright (c) 2012, 2022, Oracle and/or its affiliates. All rights reserved.
 */
/**
 * @namespace
 *
 * @desc
 * <p>The {@link apex}.storage namespace contains all functions related browser storage features such as cookies and session storage.</p>
 *
 * <div class="hw">
 *     <h3 class="name" id="about-section">
 *         About local and session storage
 *         <a class="bookmarkable-link" title="Bookmarkable Link" aria-label="Bookmark About local and session storage" href="#about-section"></a>
 *     </h3>
 * </div>
 * <p>Local storage and session storage, collectively known as web storage, are a browser feature that securely stores key value pairs
 * associated with an origin (web site). The keys and values are strings. The amount of storage space for web storage is greater than
 * that of cookies but it is not unlimited. Another advantage over cookies is that the key value pars are not transmitted with each request.</p>
 *
 * <p>Both local storage and session storage use the same API to set, get, and remove name value pairs. The difference is that
 * session storage goes away when the browser session ends and local storage is available even when the browser restarts.
 * Keep in mind that the browser is free to limit or delete data stored in local storage at the user's request. Unlike data
 * stored on the server local storage is not shared between browsers on different machines or even different browsers on the same machine.</p>
 *
 * <p>Because APEX supports multiple applications, multiple workspaces and even instances of the same application running in multiple
 * workspaces there can arise conflicts with using web storage because all the apps from a single APEX instance (which is a single
 * origin or web site) share the same web storage space. The {@link apex.storage.getScopedLocalStorage} and {@link apex.storage.getScopedSessionStorage}
 * solve this problem buy partitioning the storage into a scope based on application id an optionally additional information such as
 * page id and region id. The scope is crated by using a prefix on all the storage keys. This avoids conflicts when different apps or
 * different instances of the same app use the same keys but it is not a secure partition. Consider this carefully before storing
 * sensitive information in web storage.</p>
 */
apex.storage = {};

(function( storage, $ ) {
    "use strict";

    /**
     * @ignore
     **/
    storage.getCookieVal = function ( pOffset ) {
        var lEndPos = document.cookie.indexOf ( ";", pOffset );
        if ( lEndPos === -1 ) {
            lEndPos = document.cookie.length;
        }
        // todo unescape is deprecated?
        return unescape( document.cookie.substring( pOffset, lEndPos ) );
    };

    /**
     * <p>Returns the value of the specified cookie.</p>
     *
     * @function getCookie
     * @memberof apex.storage
     * @param {string} pName The name of the cookie.
     * @return {string} The string value of the cookie.
     *
     * @example <caption>Returns the value of the cookie TEST</caption>
     *
     * var value = apex.storage.getCookie( "TEST" );
     */
    storage.getCookie = function ( pName ) {
        var lArg = pName + "=",
            lArgLength = lArg.length,
            lCookieLength = document.cookie.length,
            i = 0;
        while ( i < lCookieLength ) {
            var j = i + lArgLength;
            if ( document.cookie.substring( i, j ) === lArg ) {
                return storage.getCookieVal( j );
            }
            i = document.cookie.indexOf( " ", i ) + 1;
            if ( i === 0 ) {
                break;
            }
        }
        return null;
    };

    /**
     * <p>Sets a cookie to the specified value.</p>
     *
     * @function setCookie
     * @memberof apex.storage
     * @param {string} pName The name of the cookie.
     * @param {String} pValue The value to set the cookie to.
     *
     * @example <caption>Sets the value APEX for the cookie TEST</caption>
     *
     * apex.storage.setCookie( "TEST", "APEX" );
     */
    storage.setCookie = function ( pName, pValue ) {
        var argv     = arguments,
            argc     = arguments.length,
            base     = $( "base" ).attr( "href" ), 
            basePath = base ?  "; path=" + base : "", // with friendly URLs, path has to be base-path rather then null (document path)
            expires  = ( argc > 2 ) ? argv[ 2 ]  : null,
            path     = ( argc > 3 ) ? argv[ 3 ]  : null,
            domain   = ( argc > 4 ) ? argv[ 4 ]  : null,
            secure   = argc > 5;

        // todo escape is deprecated?
        document.cookie = pName + "=" + escape ( pValue ) +
            ( ( expires === null ) ? "" : ( "; expires=" + expires.toGMTString() ) ) + // todo toGMTString is deprecated, research if any difference in using toUTCString
            ( ( path    === null ) ? basePath : ( "; path=" + path ) ) +
            ( ( domain  === null ) ? "" : ( "; domain=" + domain ) ) +
            ( ( secure  === true || window.location.protocol === "https:" ) ? "; secure" : "" );
    };

    /**
     * <p>Returns <code class="prettyprint">true</code> if the browser supports the local storage API and <code class="prettyprint">false</code> otherwise. Most modern browsers support this feature but some allow the user to turn it off.</p>
     *
     * @function hasLocalStorageSupport
     * @memberof apex.storage
     * @return {boolean} <code class="prettyprint">true</code> if the browser supports the local storage API and <code class="prettyprint">false</code> otherwise.
     *
     * @example <caption>Sets the local storage <code class="prettyprint">"setting1"</code> to on if local storage is supported by the browser.</caption>
     *
     * var myStorage;
     * if ( apex.storage.hasLocalStorageSupport() ) {
     *   myStorage = apex.storage.getScopedLocalStorage({ prefix: "Acme" });
     *   myStorage.setItem( "setting1", "on" );
     * }
     */
    storage.hasLocalStorageSupport = (function() {
        var localStorageSupport = null,
            test = "$test$";

        return function() {
            if ( localStorageSupport !== null ) {
                return localStorageSupport;
            }
            // use the same method that Modernizr uses for detection
            // see Modernizr source for why it is not as simple as if ( window.localStorage )
            try {
                localStorage.setItem( test, test );
                localStorage.removeItem( test );
                localStorageSupport = true;
            } catch(e) {
                localStorageSupport = false;
            }
            return localStorageSupport;
        };
    })();

    /**
     * <p>Returns <code class="prettyprint">true</code> if the browser supports the session storage API and <code class="prettyprint">false</code> otherwise. Most modern browsers support this feature but some allow the user to turn it off.</p>
     *
     * @function hasSessionStorageSupport
     * @memberof apex.storage
     * @return {boolean} <code class="prettyprint">true</code> if the browser supports the session storage API and <code class="prettyprint">false</code> otherwise.
     *
     * @example <caption>Sets the session storage <code class="prettyprint">"setting1"</code> to on if session storage is supported by the browser.</caption>
     *
     * var myStorage;
     * if ( apex.storage.hasSessionStorageSupport() ) {
     *   myStorage = apex.storage.getScopedSessionStorage({ prefix: "Acme" });
     *   myStorage.setItem( "setting1", "on" );
     * }
     */
    storage.hasSessionStorageSupport = (function() {
        var sessionStorageSupport = null,
            test = "$test$";

        return function() {
            if ( sessionStorageSupport !== null ) {
                return sessionStorageSupport;
            }
            // use the same method that Modernizr uses for detection
            // see Modernizr source for why it is not as simple as if ( window.localStorage )
            try {
                sessionStorage.setItem( test, test );
                sessionStorage.removeItem( test );
                sessionStorageSupport = true;
            } catch(e) {
                sessionStorageSupport = false;
            }
            return sessionStorageSupport;
        };
    })();

    /**
     * @ignore
     **/
    function makeDomStorage( check, store, options ) {
        var that;
        if ( check() ) {
            that = Object.create( storagePrototype );
            that.prefix = makeKeyPrefix( options );
            that._store = store;
            that._re = new RegExp( "^" + that.prefix );
            that.length = countKeys( that._store, that._re );
        } else {
            that = Object.create( noopStoragePrototype );
            that.prefix = makeKeyPrefix( options );
        }
        return that;
    }

    /**
     * @ignore
     **/
    function makeKeyPrefix( options ) {
        var prefix = ( options.prefix || "" ) + ".";

        if ( options.useAppId === undefined || options.AppId === null ) {
            options.useAppId = true;
        }
        if ( options.useAppId ) {
            prefix += $( "#pFlowId" ).val() + ".";
        }
        if ( options.usePageId ) {
            prefix += $( "#pFlowStepId" ).val() + ".";
        }
        if ( options.regionId ) {
            prefix += options.regionId + ".";
        }
        return prefix;
    }

    /**
     * @ignore
     **/
    function countKeys( store, re ) {
        var i,
            count = 0;
        for ( i = 0; i < store.length; i++ ) {
            if ( re.test( store.key( i ) ) ) {
                count += 1;
            }
        }
        return count;
    }

    /**
     * @typedef storageWrapper
     * @memberof apex.storage
     * @desc
     * <p>A storage wrapper object. This object has the same properties and functions as the native browser Storage interface.</p>
     *
     * @property {string} prefix APEX specific property. The prefix for this scoped storage object.
     * @property {number} length The number of items in the scoped storage object.
     * @property {function} key The <code class="prettyprint">key( n )</code> function returns the nth key in the scoped storage object.
     * @property {function} getItem The <code class="prettyprint">getItem( key )</code> function returns the value for the given key.
     * @property {function} setItem The <code class="prettyprint">setItem( key, data )</code> function sets the value of the given key to data.
     * @property {function} removeItem The <code class="prettyprint">removeItem( key )</code> function removes the given key.
     * @property {function} clear The <code class="prettyprint">clear</code> function removes all keys from the scoped storage object.
     * @property {function} sync The APEX specific <code class="prettyprint">sync</code> function. Use to ensure the length property is correct if keys may have been added or removed by means external to this object.
     */
    var storagePrototype = {
        prefix: "",
        length: 0,
        key: function( index ) {
            var i, k,
                scopeIndex = 0;

            if ( index < this._store.length ) {
                for ( i = 0; i < this._store.length; i++ ) {
                    k = this._store.key( i );
                    if ( this._re.test( k ) ) {
                        if ( index === scopeIndex ) {
                            return k;
                        }
                        scopeIndex += 1;
                    }
                }
            }
            return null;
        },
        getItem: function( key ) {
            return this._store.getItem( this.prefix + key );
        },
        setItem: function( key,  data ) {
            var old = this.getItem( key );
            this._store.setItem( this.prefix + key, data );
            // if there was no item before then one was added so increment length
            if ( old === null ) {
                this.length += 1;
            }
        },
        removeItem: function( key ) {
            var old = this.getItem( key );
            this._store.removeItem( this.prefix + key );
            // if there was an item it was removed so decrement length
            if ( old !== null ) {
                this.length -= 1;
            }
        },
        clear: function() {
            var i, k;

            for ( i = 0; i < this._store.length; i++ ) {
                k = this._store.key( i );
                if ( this._re.test( k ) ) {
                    this._store.removeItem( k );
                }
            }
            this.length = 0;
        },
        sync: function() {
            this.length = countKeys( this._store, this._re );
        }
    };

    var noopStoragePrototype = {
        prefix: "",
        length: 0,
        key: function() {
            return null;
        },
        getItem: function() {
            return null;
        },
        setItem: function() { },
        removeItem: function() { },
        clear: function() { }
    };

    /**
     * <p>Returns a thin wrapper around the <code class="prettyprint">sessionStorage</code> object that scopes all keys to a prefix defined by the <code class="prettyprint">options</code> parameter. If sessionStorage is not supported, the returned object can be used but has no effect so it is not necessary test for support using {@link apex.storage.hasSessionStorageSupport} before calling this function.</p>
     *
     * @function getScopedSessionStorage
     * @memberof apex.storage
     * @param {Object} options An object used to define the scope of the session storage. This defines the storage key prefix used by the <code class="prettyprint">sessionStorage</code> wrapper object.
     * @param {string} [options.prefix] A static prefix string to add to all keys. The default is an empty string.
     * @param {boolean} [options.useAppId] Whether the application id will be included in the key. The default is true.
     * @param {boolean} [options.usePageId] Whether the application page id will be included in the key. The default is false.
     * @param {string} [options.regionId] An additional string to identify a region or other part of a page. The default is an empty string.
     * @return {sessionStorage} A {@link apex.storage.storageWrapper|sessionStorage} wrapper object.
     *
     * @example <caption>Creates a session storage object that scopes all the keys using a prefix <code class="prettyprint">"Acme"</code> and the application id. It then sets and gets an item called <code class="prettyprint">"setting1"</code>.</caption>
     *
     * var myStorage,
     *     setting1;
     * if ( apex.storage.hasSessionStorageSupport() ) {
     *   myStorage = apex.storage.getScopedSessionStorage({ prefix: "Acme" });
     *   myStorage.setItem( "setting1", "on" );
     *   setting1 = myStorage.getItem( "setting1" );
     * }
     */
    storage.getScopedSessionStorage = function( options ) {
        return makeDomStorage( storage.hasSessionStorageSupport, window.sessionStorage, options );
    };

    /**
     * <p>Returns a thin wrapper around the <code class="prettyprint">localStorage</code> object that scopes all keys to a prefix defined by the <code class="prettyprint">options</code> parameter. If localStorage is not supported, the returned object can be used but has no effect so it is not necessary test for support using {@link apex.storage.hasLocalStorageSupport} before calling this function.</p>
     *
     * @function getScopedLocalStorage
     * @memberof apex.storage
     * @param {Object} options An object used to define the scope of the local storage. This defines the storage key prefix used by the <code class="prettyprint">localStorage</code> wrapper object.
     * @param {string} [options.prefix] A static prefix string to add to all keys. The default is an empty string.
     * @param {boolean} [options.useAppId] Whether the application id will be included in the key. The default is true.
     * @param {boolean} [options.usePageId] Whether the application page id will be included in the key. The default is false.
     * @param {string} [options.regionId] An additional string to identify a region or other part of a page. The default is an empty string.
     * @return {localStorage} A {@link apex.storage.storageWrapper|localStorage} wrapper object.
     *
     * @example <caption>Creates a local storage object that scopes all the keys using a prefix <code class="prettyprint">"Acme"</code> and the application id. It then sets and gets an item called <code class="prettyprint">"setting1"</code>.</caption>
     *
     * var myStorage,
     *     setting1;
     * if ( apex.storage.hasLocalStorageSupport() ) {
     *   myStorage = apex.storage.getScopedLocalStorage({ prefix: "Acme" });
     *   myStorage.setItem( "setting1", "on" );
     *   setting1 = myStorage.getItem( "setting1" );
     * }
     */
    storage.getScopedLocalStorage = function( options ) {
        return makeDomStorage( storage.hasLocalStorageSupport, window.localStorage, options );
    };

})(apex.storage, apex.jQuery);
