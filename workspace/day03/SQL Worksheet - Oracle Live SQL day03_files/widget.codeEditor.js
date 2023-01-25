/*!
 * Copyright (c) 2013, 2022, Oracle and/or its affiliates.
 */

/**
 * Turns an empty div into code editor for css, javascript, html and pl/sql
 *   apex.jQuery( "#myEditor" ).codeEditor( {...} );
 */

/* global monaco,require */
/* eslint-disable no-bitwise */
/* eslint quotes: ["error", "double"] */
/* eslint no-var: "error" */

/// <reference path="../../libraries/monaco-editor/0.32.1/monaco.d.ts"/>

( function( $, util, lang, locale, debug, actions, server, env ) {
    "use strict";

    const msg = key => lang.getMessage( "CODE_EDITOR." + key );

    // constants
    const C_ACTIVE = "is-active";

    const LANG_JAVASCRIPT = "javascript",
        LANG_SQL = "sql",
        LANG_MLE_JAVASCRIPT = "mle-javascript",
        LANG_QUICKSQL = "quicksql",
        LANG_FILE_URLS_JAVASCRIPT = "file-urls-javascript",
        LANG_FILE_URLS_CSS = "file-urls-css";

    const CONTEXT_KEY_ISSQL = "isSql",
        CONTEXT_KEY_DBHINT = "dbHint";

    // text messages
    const MSG_ACCESSIBILITY_MODE = msg( "ACCESSIBILITY_MODE" ),
        MSG_CLOSE = msg( "CLOSE" ),
        MSG_FIND = msg( "FIND" ),
        MSG_HINT = msg( "HINT" ),
        MSG_INDENTATION = msg( "INDENTATION" ),
        MSG_INDENT_SIZE = msg( "INDENT_SIZE" ),
        MSG_INDENT_WITH_TABS = msg( "INDENT_WITH_TABS" ),
        MSG_MINIMAP = msg( "MINIMAP" ),
        MSG_MINIMAP_CONDITIONAL = msg( "MINIMAP_CONDITIONAL" ),
        MSG_QUERY_BUILDER = msg( "QUERY_BUILDER" ),
        MSG_REDO = msg( "REDO" ),
        MSG_SETTINGS = msg( "SETTINGS" ),
        MSG_SHOW_LINE_NUMBERS = msg( "SHOW_LINE_NUMBERS" ),
        MSG_SHOW_RULER = msg( "SHOW_RULER" ),
        MSG_SUGGESTIONS = msg( "SUGGESTIONS" ),
        MSG_TAB_SIZE = msg( "TAB_SIZE" ),
        MSG_THEMES = msg( "THEMES" ),
        MSG_THEME_AUTOMATIC = msg( "THEME_AUTOMATIC" ),
        MSG_THEME_LIGHT = msg( "THEME_LIGHT" ),
        MSG_THEME_DARK = msg( "THEME_DARK" ),
        MSG_THEME_HIGH_CONTRAST_DARK = msg( "THEME_HIGH_CONTRAST_DARK" ),
        MSG_TRANSFORM_CODE_CASE = msg( "TRANSFORM_CODE_CASE" ),
        MSG_UNDO = msg( "UNDO" ),
        MSG_UTIL_OFF = msg( "UTIL_OFF" ),
        MSG_UTIL_ON = msg( "UTIL_ON" ),
        MSG_VALIDATE = msg( "VALIDATE" ),
        MSG_VALIDATION_SUCCESS = msg( "VALIDATION_SUCCESS" ),
        MSG_WHITESPACE = msg( "WHITESPACE" ),
        MSG_BRACKET_PAIR_COLORIZATION = msg( "BRACKET_PAIR_COLORIZATION" );
    // additionally there is another message ITEM_DOES_NOT_EXIST
    // which takes a parameter, and is used further down

    let currentTheme,
        latestJsLanguage,
        globalFlags = {
            jsApiDtsLoaded: false,
            mleJsApiDtsLoaded: false
        };

    /**
     * To add a new editor preference:
     *  - extend the PREF object
     *  - extend the jQuery widget options under "settings which can be overridden by user preference"
     *  - reference the widget option in the appropriate place
     *  - extend the widget's _setOption
     *  - extend _populateContext
     *  - extend _initToolbar
     *  - extend $.apex.codeEditor.preferencesObjectFromString
     */

    // Editor User Preferences
    // these values are stored on the server as serialized JSON in a user preference, and they transcend APEX upgrades. change carefully
    const PREF = {
        THEME: "theme",
        TABS_INSERT_SPACES: "tabsInsertSpaces",
        INDENT_SIZE: "indentSize",
        TAB_SIZE: "tabSize",
        RULER: "ruler",
        MINIMAP: "minimap",
        ACCESSIBILITY_MODE: "accessibilityMode",
        LINE_NUMBERS: "lineNumbers",
        WHITESPACE: "whitespace",
        SHOW_SUGGESTIONS: "showSuggestions",
        BRACKET_PAIR_COLORIZATION: "bracketPairColorization"
        // SEMANTIC_HIGHLIGHTING: "semanticHighlighting",
        // INLAY_HINTS: "inlayHints"
    };

    const OPTIONS_THEME = [
        // automatic will be either vs or vs-dark depending on the builder setting
        { label: MSG_THEME_AUTOMATIC, value: "automatic" },
        { label: MSG_THEME_LIGHT, value: "vs" },
        { label: MSG_THEME_DARK, value: "vs-dark" },
        { label: MSG_THEME_HIGH_CONTRAST_DARK, value: "hc-black" }
    ],
        MINIMAP_OFF = "off",
        MINIMAP_ON = "on",
        MINIMAP_CONDITIONAL = "conditional",
        OPTIONS_MINIMAP = [
            { label: MSG_UTIL_ON, value: MINIMAP_ON },
            { label: MSG_UTIL_OFF, value: MINIMAP_OFF },
            { label: MSG_MINIMAP_CONDITIONAL, value: MINIMAP_CONDITIONAL },
        ],
        OPTIONS_TAB_SIZE = [
            { label: "2", value: "2" },
            { label: "3", value: "3" },
            { label: "4", value: "4" },
            { label: "8", value: "8" }
        ],
        OPTIONS_INDENT_SIZE = [
            { label: "2", value: "2" },
            { label: "3", value: "3" },
            { label: "4", value: "4" },
            { label: "8", value: "8" }
        ];

    // absolute paths are needed by the webworkers
    // if the image directory starts with "/" or ".", it is a relative path which must be made absolute
    const ABSOLUTE_PATH = [ "/", "." ].includes( env.APEX_FILES[ 0 ] )
            ? document.location.protocol + "//" + document.location.host + ( env.APEX_FILES[ 0 ] === "." ? "/" : "" ) + env.APEX_FILES
            : env.APEX_FILES,
        MONACO_BASE_PATH = ABSOLUTE_PATH + `libraries/monaco-editor/${ apex.libVersions.monacoEditor }/min`,
        MONACO_CUSTOM_LANGUAGES_PATH = ABSOLUTE_PATH + "libraries/monaco-editor/apex/custom-languages",
        BROWSER_DTS_PATH = ABSOLUTE_PATH + "libraries/monaco-editor/apex/types/browser/types.d.ts?v=" + env.APEX_VERSION,
        MLE_DTS_PATH = ABSOLUTE_PATH + `libraries/monaco-editor/apex/types/mle/${ env.DB_VERSION }/types.d.ts?v=` + env.APEX_VERSION,
        QUICKSQL_PATH = ABSOLUTE_PATH + "libraries/monaco-editor/apex/quicksql.js?v=" + env.APEX_VERSION;

    // Disposable keys
    const   // DISP_DTS_APEX = "dts-apex",
        // DISP_DTS_APEX_ITEMS_REGIONS = "dts-apex-items-regions",
        // DISP_DTS_APEX_MLE = "dts-mle",
        DISP_MLE_ENV = "mle-env",
        DISP_MINIMAP = "minimap";

    // everything else will be defaulted to the base "item" or "region" type
    // should be kept in sync with the currently documented item/region types
    const DTS_TYPES = {
        ITEM: {
            NATIVE_NUMBER_FIELD: "numberFieldItem",
            NATIVE_COLOR_PICKER: "colorPickerItem"
        },
        REGION: {
            NATIVE_FACETED_SEARCH: "facetsRegion",
            NATIVE_SMART_FILTERS: "facetsRegion",
            NATIVE_MAP_REGION: "mapRegion"
        }
    };

    // registers languages File URLs - JavaScript / CSS
    const _registerFileUrlsLanguages = () => {

        [ LANG_FILE_URLS_JAVASCRIPT, LANG_FILE_URLS_CSS ].forEach( langId => {

            monaco.languages.register({id: langId });

            // the same language config for both languages
            monaco.languages.setLanguageConfiguration( langId, {
                // needed by the Comment Out shortcuts
                comments: {
                    lineComment: "--",
                    blockComment: [ "/*", "*/" ],
                },
                brackets: [["[", "]"]]
            } );

            // the same syntax highlighting for both languages
            monaco.languages.setMonarchTokensProvider( langId, {
                tokenizer: {
                    root: [
                        { include: "@whitespace" },
                        [/^\[.+?\]/, "variable"] // highlight the url hints [...]
                    ],
                    whitespace: [
                        [/\/\*/,    "comment", "@comment"],
                        [/^--.*$/,  "comment"],
                        [/#(MIN|MIN_DIRECTORY)#/, "string"],
                        [/#(APEX|APP|WORKSPACE|PLUGIN|THEME|THEME_DB)_FILES#/, "string"],
                        [/#APP_VERSION#/, "string"],
                    ],
                    comment: [
                        // slightly over-escaping on purpose
                        // else the syntax highlighting for this file would be broken in some IDEs
                        // eslint-disable-next-line no-useless-escape
                        [/[^\/\*]+/, "comment"],
                        [/\*\//, "comment", "@pop"]
                    ]
            } } );

            // the same hash autocomplete for both languages
            monaco.languages.registerCompletionItemProvider( langId, {
                triggerCharacters: [ "#" ],
                provideCompletionItems: function ( model, position, context ) {
                    // only suggest when # is pressed
                    if ( context.triggerCharacter === "#" ) {
                        const word = model.getWordUntilPosition(position);
                        return {
                            suggestions: [
                                "#MIN#",
                                "#MIN_DIRECTORY#",
                                "#APEX_FILES#",
                                "#APP_FILES#",
                                "#WORKSPACE_FILES#",
                                "#PLUGIN_FILES#",
                                "#THEME_FILES#",
                                "#THEME_DB_FILES#",
                                "#APP_VERSION#"
                            ].map( sub => {
                                return {
                                    label: sub,
                                    insertText: sub,
                                    kind: monaco.languages.CompletionItemKind.Keyword,
                                    range: {
                                        startLineNumber: position.lineNumber,
                                        endLineNumber: position.lineNumber,
                                        startColumn: word.startColumn - 1,
                                        endColumn: word.endColumn
                                    }
                                };
                            })
                        };
                    } else {
                        return undefined;
                    }
                }
            } );

            // slightly different URL hints for the two languages
            monaco.languages.registerCompletionItemProvider( langId, {
                triggerCharacters: [ "[", ",", " " ],
                provideCompletionItems: function ( model, position ) {

                    let toReturn;

                    const lineContent = model.getLineContent( position.lineNumber );

                    // only suggest when the line is in the form of [...]...
                    // and the current position is in the starting bracket pair
                    if ( !lineContent.slice( 0, position.column - 1 ).startsWith( "[" ) ||
                            !lineContent.slice( position.column - 1 ).includes( "]" ) ) {
                        return undefined;
                    }

                    if( langId === LANG_FILE_URLS_JAVASCRIPT ) {
                        // url hints already present
                        let currentHints = [];
                        const match = lineContent.match(/^\[(.*)\].*/);
                        if ( match ) {
                            currentHints = match[ 1 ].split( "," ).map( hint => hint.trim() );
                        }
                        
                        const suggestions = [
                            "module",
                            "async",
                            "defer",
                            "require requirejs",
                            "require jet",
                            "define"
                        ].filter( hint => !currentHints.includes( hint ) );

                        toReturn = {
                            suggestions: suggestions.map(sub => {
                                return {
                                    label: sub,
                                    insertText: sub,
                                    kind: monaco.languages.CompletionItemKind.Keyword,
                                    range: {
                                        startLineNumber: position.lineNumber,
                                        endLineNumber: position.lineNumber,
                                        startColumn: position.column,
                                        endColumn: position.column,
                                    }
                                };
                            })
                        };
                    } else if ( langId === LANG_FILE_URLS_CSS ) {
                        toReturn = {
                            suggestions: [{
                                label: "media",
                                insertText: "media=\"${1}\"",
                                kind: monaco.languages.CompletionItemKind.Keyword,
                                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                range: {
                                    startLineNumber: position.lineNumber,
                                    endLineNumber: position.lineNumber,
                                    startColumn: position.column,
                                    endColumn: position.column,
                                }
                            }]
                        };
                    }

                    return toReturn;
                }
            } );
        } );
    };


    /**
     * 
     * CONTEXT_JS_CODE_MANAGER is a utility to manage external client-side JavaScript snippets used for Autocomplete, Intellisense etc
     * 
     * Notes:
     *  - The content of a JavaScript model is global.
     *      That means the variables it declares are made available to other models as intellisense.
     *      We leverage this to provide more "context" to JavaScript editors.
     *      E.g, each JavaScript editor in PD should be aware of the "Function and Global Variable Declaration" code.
     *  - a model unfortunately cannot be temporarily disabled. it must be disposed
     *  - a model unfortunately applies to both JavaScript and MLE JavaScript
     *      which is why we must reevaluate the manager on each editor focus
     *  - both the javascript and mle-javascript modules must be created as javascript modules.
     * 
     *  - TODO: investigate passing a model URI like monaco.Uri.parse( "ts://apex.d.ts" ) on model creation, which should help enable things like Go To Definition
     */
    const CONTEXT_JS_CODE_MANAGER = ( () => {
        /**
         * Object holding all contexts, indexed by the context name
         * 
         * A member context has the form:
         * name: {
         *  code,   // holds the code of the context, always up to data, no matter if enabled or disabled
         *  model,  // holds the monaco model instance. null if disabled
         *  lang    // LANG_JAVASCRIPT or LANG_MLE_JAVASCRIPT
         * }
         */
        const contexts = {};

        /**
         * flag that keeps track of the current manager language
         * if set, it also means the monaco and the typescript worker are ready to be configured
         */
        let managerLang;

        const _verifyLang = lang => {
            if( ![ LANG_JAVASCRIPT, LANG_MLE_JAVASCRIPT ].includes( lang ) ) {
                throw new Error( "Only JavaScript and MLE JavaScript are supported" );
            }
        };

        /**
         * Adds a new context or overrides an existing context by the same name
         * The model will only be updated if the context is enabled, and if the language matches the current manager language
         */
        const setContext = ( name, code, lang ) => {

            _verifyLang( lang );

            if( !contexts[ name ] ) {
                contexts[ name ] = {
                    code: null,
                    model: null,
                    lang: lang
                };
            }

            // the code is always set/ updated
            contexts[ name ].code = code;

            // only if enabled, do we create/ update the model
            if( managerLang === lang ) {
                if( contexts[ name ].model ) {
                    contexts[ name ].model.setValue( code );
                } else {
                    contexts[ name ].model = monaco.editor.createModel( code, LANG_JAVASCRIPT );
                }
            }

            debug.trace( "CONTEXT_JS_CODE_MANAGER added context", name );
        };

        /**
         * Drops a context
         */
        const dropContext = name => {
            if( contexts[ name ] ) {
                if( contexts[ name ].model ) {
                    contexts[ name ].model.dispose();
                    contexts[ name ].model = null;
                }
                contexts[ name ] = undefined;
            }

            debug.trace( "CONTEXT_JS_CODE_MANAGER dropped context", name );
        };

        /**
         * Should be called when initializing, or focusing inside of a JavaScript or MLE JavaScript Editor
         */
        const reevaluate = lang => {

            _verifyLang( lang );

            managerLang = lang;

            Object.keys( contexts ).forEach( name => {
                const context = contexts[ name ];

                if( managerLang !== context.lang ) {
                    // if the new language is not the same as the old language, disable the model
                    if( context.model ) {
                        context.model.dispose();
                        context.model = null;
                    }
                } else {
                    // otherwise, update the model
                    if( context.model ) {
                        context.model.setValue( context.code );
                    } else {
                        context.model = monaco.editor.createModel( contexts[ name ].code, LANG_JAVASCRIPT );
                    }
                }
            } );

            debug.trace( "CONTEXT_JS_CODE_MANAGER contexts reevaluated" );
        };

        return {
            setContext,
            dropContext,
            reevaluate
        };
    } )();

    /**
     * DISPOSABLE_MANAGER is a utility that helps keep track of editor specific as well as global disposable objects
     */
    const DISPOSABLE_MANAGER = ( () => {
        const DISPOSABLES = {
            GLOBAL: {} // for disposables shared across all instances, eg. javascript language defaults
            // other keys will be added as editors are created
        };

        return {
            // global disposables
            existsGlobally: key => {
                return DISPOSABLES.GLOBAL[ key ] !== undefined;
            },
            registerGlobally: ( key, disposable ) => {
                DISPOSABLES.GLOBAL[ key ] = disposable;
            },
            disposeGlobally: key => {
                if( DISPOSABLES.GLOBAL[ key ] ) {
                    DISPOSABLES.GLOBAL[ key ].dispose();
                    delete DISPOSABLES.GLOBAL[ key ];
                }
            },
            // editor specific disposables
            deregisterEditor: ( editorId ) => {
                if( DISPOSABLES[ editorId ] ) {
                    for( let key of Object.keys( DISPOSABLES[ editorId ] ) ) {
                        DISPOSABLES[ editorId ][ key ].dispose();
                        delete DISPOSABLES[ editorId ][ key ];
                    }
                    delete DISPOSABLES[ editorId ];
                }
            },
            existsForEditor: ( editorId, key ) => {
                return DISPOSABLES[ editorId ] && DISPOSABLES[ editorId ][ key ] !== undefined;
            },
            registerForEditor: ( editorId, key, disposable ) => {
                DISPOSABLES[ editorId ] = DISPOSABLES[ editorId ] || {};
                if( DISPOSABLES[ editorId ][ key ] ) {
                    DISPOSABLES[ editorId ][ key ].dispose();
                }
                DISPOSABLES[ editorId ][ key ] = disposable;
            },
            disposeForEditor: ( editorId, key ) => {
                if( DISPOSABLES[ editorId ] && DISPOSABLES[ editorId ][ key ] ) {
                    DISPOSABLES[ editorId ][ key ].dispose();
                    delete DISPOSABLES[ editorId ][ key ];
                }
            }
        };
    } )();

    /**
     * Should be called when initializing, or focusing inside of a JavaScript or MLE JavaScript Editor
     */
    function reevaluateGlobalJsSettings ( language, pageInfo ) {
        // setJsInlayHints( options.inlayHints );

        // always reevaluating the page items in case they have changed
        CONTEXT_JS_CODE_MANAGER.setContext( "JS_EXTRAS", `
            declare namespace apex {
                var items: {
                    ${pageInfo.items.map( item => `${JSON.stringify( item.name )}: ${DTS_TYPES.ITEM[ item.type ] || "item"};` ).join( "\n" )}
                };
                var regions: {
                    ${pageInfo.regions.map( region => `${JSON.stringify( region.staticId )}: ${DTS_TYPES.REGION[ region.type ] || "region"};` ).join( "\n" )}
                };
            }
        `, LANG_JAVASCRIPT );

        // Note: as of monaco 0.32.1 whenever we touch javascriptDefaults, the entire worker gets loaded again
        // This seems to be a bug. https://github.com/microsoft/monaco-editor/issues/2960
        // We must therefore only do so when the language really has changed.

        if( latestJsLanguage === language ) {
            return;
        } else {
            latestJsLanguage = language;
        }

        monaco.languages.typescript.javascriptDefaults.setCompilerOptions( {
            target: monaco.languages.typescript.ScriptTarget.Latest,
            allowJs: true,
            allowNonTsExtensions: true,
            // for MLE JavaScript, browser globals like window should be hidden
            noLib: language === LANG_MLE_JAVASCRIPT
        } );

        monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions( {
            // do not mark nameless functions as errors
            // needed for Init JS Code
            diagnosticCodesToIgnore: [ 1003 ]
        } );

        // note that we choose to create a model over an extra lib via javascriptDefaults.addExtraLib
        // on purpose. see discussion here github.com/microsoft/monaco-editor/issues/2813
        if( language === LANG_JAVASCRIPT ) {
            if( !globalFlags.jsApiDtsLoaded ) {
                globalFlags.jsApiDtsLoaded = true;
                ( async () => {
                    const response = await fetch( BROWSER_DTS_PATH );
                    if( !response.ok ) {
                        debug.error( "Could not fetch file", response );
                    } else {
                        CONTEXT_JS_CODE_MANAGER.setContext( "JS_DTS", await response.text(), LANG_JAVASCRIPT );
                    }
                } )();
            }
        } else if( language === LANG_MLE_JAVASCRIPT ) {
            if( !globalFlags.mleJsApiDtsLoaded ) {
                globalFlags.mleJsApiDtsLoaded = true;
                ( async () => {
                    const response = await fetch( MLE_DTS_PATH );
                    if( !response.ok ) {
                        debug.error( "Could not fetch file", response );
                    } else {
                        CONTEXT_JS_CODE_MANAGER.setContext( "MLE_JS_DTS", await response.text(), LANG_MLE_JAVASCRIPT );

                        // conditionally add the apex namespace
                        // don't add it on the Create/Edit Module pages, as we're dealing with pure module code
                        if( env.DB_VERSION >= 23 && !( env.APP_ID === "4500" && [ "5010", "5015" ].includes( env.APP_PAGE_ID ) ) ) {
                            CONTEXT_JS_CODE_MANAGER.setContext( "MLE_JS_DTS_2", `
                                import { defaultConnection, default as oracledb } from "mle-js-oracledb";

                                globalThis.apex = {
                                    db: oracledb,
                                    conn: oracledb.defaultConnection(),
                                    env: {}
                                };
                            `, LANG_MLE_JAVASCRIPT );
                        }
                    }
                } )();
            }
        }

        CONTEXT_JS_CODE_MANAGER.reevaluate( language );
    }

    function loadLanguageDependencies ( language, options ) {
        return new Promise( resolve => {

            if( [ LANG_JAVASCRIPT, LANG_MLE_JAVASCRIPT ].includes( language ) ) {
                reevaluateGlobalJsSettings( language, options.pageInfo );
                resolve();
            } else if( language === LANG_QUICKSQL ) {
                if( !monaco.languages.getEncodedLanguageId( LANG_QUICKSQL ) ) {
                    server.loadScript( {
                        path: QUICKSQL_PATH
                    }, resolve );
                } else {
                    resolve();
                }
            } else {
                resolve();
            }
        } );
    }

    // should be called once, before monaco was loaded, but after requirejs was loaded
    function configureMonacoPreLoad () {
        // configuring monaco
        // https://github.com/microsoft/monaco-editor/blob/master/docs/integrate-amd-cross.md
        // Before loading vs/editor/editor.main, define a global MonacoEnvironment that overwrites
        // the default worker url location (used when creating WebWorkers). The problem here is that
        // HTML5 does not allow cross-domain web workers, so we need to proxy the instantiation of
        // a web worker through a same-domain script
        window.MonacoEnvironment = {
            getWorkerUrl: function() {
                return "data:text/javascript;charset=utf-8," + encodeURIComponent( `
                    self.MonacoEnvironment = {
                        baseUrl: "${MONACO_BASE_PATH}"
                    };
                    importScripts("${MONACO_BASE_PATH}/vs/base/worker/workerMain.js");
                `);
            }
        };
        require.config( {
            paths: {
                "vs": MONACO_BASE_PATH + "/vs",
                "custom-languages": MONACO_CUSTOM_LANGUAGES_PATH,
            },
            waitSeconds: 0
        } );
        // monaco supports en, de, es, fr, it, ja, ko, ru, zh-tw and zh-cn
        // if none is matched by the current locale, we default to english
        let browserLang = locale.getLanguage().toLowerCase();
        let monacoLang;
        // only ones for which we need to take into account the country
        if( [ "zh-tw", "zh-cn" ].includes( browserLang ) ) {
            monacoLang = browserLang;
        } else {
            // slicing off a possible country portion
            browserLang = browserLang.split( "-" )[ 0 ];
            if( [ "de", "es", "fr", "it", "ja", "ko", "ru" ].includes( browserLang ) ) {
                monacoLang = browserLang;
            }
        }
        // if a special language was matched, we set it. otherwise english stays
        if( monacoLang ) {
            require.config( {
                "vs/nls": {
                    availableLanguages: {
                        "*": monacoLang
                    }
                }
            } );
        }
    }

    // should be called once, after monaco was loaded
    function configureMonacoPostLoad () {

        // override sql language loader to point to the oracle-sql file
        monaco.languages.getLanguages().filter( lang => lang.id === "sql" )[ 0 ].loader = () => {
            return new Promise( ( resolve, reject ) => {
                require( [ "custom-languages/sql" ], resolve, reject );
            } );
        };

        monaco.editor.defineTheme( "apex-vs", {
            inherit: true,
            base: "vs",
            rules: [
                // background color: fffffe
                // sql
                { token: "string.sql", foreground: "b26100" },          // 4.56  AA
                { token: "keyword.sql", foreground: "c74634" },         // 4.82  AA
                { token: "predefined.sql", foreground: "7e5e8a" },      // 5.44  AA
                { token: "operator.sql", foreground: "000000" },        // 20.99 AAA
                { token: "atom.sql", foreground: "398459" },            // 4.54  AA
                { token: "function.sql", foreground: "795E26" },        // 6.10  AA
                { token: "pageitem.sql", foreground: "008080", fontStyle: "bold" },
                // quicksql
                { token: "table.quicksql", foreground: "1E84BF", fontStyle: "bold" },   // 4.11 AA Large
                { token: "view.quicksql", foreground: "008855", fontStyle: "bold" },    // 4.51 AA
                { token: "list.quicksql", foreground: "b26100" },                       // 4.56 AA
                { token: "keywords.quicksql", foreground: "c74634" },                   // 4.82 AA
                { token: "types.quicksql", foreground: "398459" },                      // 4.54 AA
            ],
            colors: {
                // bracket pair colorization
                "editorBracketHighlight.foreground1": "#0431FA",    // 7.42
                "editorBracketHighlight.foreground2": "#008000",    // 5.13
                "editorBracketHighlight.foreground3": "#7B3814"     // 8.67
            }
        } );
        monaco.editor.defineTheme( "apex-vs-dark", {
            inherit: true,
            base: "vs-dark",
            rules: [
                // to be enabled in a future APEX version
                // semantic tokens. for now only JavaScript makes use of them
                /*
                // TODO add to other 2 themes
                { token: "function", foreground: "DCDCAA" },
                { token: "method", foreground: "DCDCAA" },
                { token: "keyword", foreground: "C586C0" },
                { token: "variable", foreground: "4FC1FF" },
                { token: "parameter", foreground: "9CDCFE" },
                { token: "class", foreground: "4EC9B0" },
                { token: "namespace", foreground: "9CDCFE" },
                { token: "property", foreground: "9CDCFE" },
                */
                // background color: 1e1e1e
                // sql
                { token: "string.sql", foreground: "ecbb76" },          // 9.48  AAA
                { token: "keyword.sql", foreground: "f14840" },         // 4.56  AA
                { token: "predefined.sql", foreground: "a687b3" },      // 5.35  AA
                { token: "operator.sql", foreground: "D4D4D4" },        // 11.25 AAA
                { token: "atom.sql", foreground: "259856" },            // 4.53  AA
                { token: "function.sql", foreground: "DCDCAA" },        // 11.80 AAA
                { token: "pageitem.sql", foreground: "3dc9b0", fontStyle: "bold" },
                // quicksql
                { token: "table.quicksql", foreground: "1E84BF", fontStyle: "bold" },   // 4.06 AA   Large
                { token: "view.quicksql", foreground: "259856", fontStyle: "bold" },    // 4.53 AA
                { token: "list.quicksql", foreground: "ecbb76" },                       // 9.48 AAA
                { token: "keywords.quicksql", foreground: "f14840" },                   // 4.56 AA
                { token: "types.quicksql", foreground: "A3CDFF" },                      // 4.53 AA
            ],
            colors: {
                // bracket pair colorization
                "editorBracketHighlight.foreground1": "#ffd700",    // 11.88
                "editorBracketHighlight.foreground2": "#da70d6",    // 5.77
                "editorBracketHighlight.foreground3": "#179fff"     // 5.9
            }
        } );
        monaco.editor.defineTheme( "apex-hc-black", {
            inherit: true,
            base: "hc-black",
            rules: [
                // background color: 000000
                // sql
                { token: "string.sql", foreground: "ecbb76" },          // 11.94 AAA
                { token: "keyword.sql", foreground: "f14840" },         // 5.74  AA
                { token: "predefined.sql", foreground: "a687b3" },      // 6.74  AA
                { token: "operator.sql", foreground: "D4D4D4" },        // 14.17 AAA
                { token: "atom.sql", foreground: "259856" },            // 5.70  AA
                { token: "function.sql", foreground: "DCDCAA" },        // 14.86 AAA
                { token: "pageitem.sql", foreground: "3dc9b0", fontStyle: "bold" },
                // quicksql
                { token: "table.quicksql", foreground: "1E84BF", fontStyle: "bold" },   // 5.11  AA
                { token: "view.quicksql", foreground: "259856", fontStyle: "bold" },    // 5.73  AA
                { token: "list.quicksql", foreground: "ecbb76" },                       // 11.94 AAA
                { token: "keywords.quicksql", foreground: "f14840" },                   // 5.74  AA
                { token: "types.quicksql", foreground: "259856" },                      // 5.73  AA
            ],
            colors: {
                // bracket pair colorization
                "editorBracketHighlight.foreground1": "#ffd700",    // 14.97
                "editorBracketHighlight.foreground2": "#da70d6",    // 7.26
                "editorBracketHighlight.foreground3": "#87cefa"     // 12.23
            }
        } );

        _registerFileUrlsLanguages();
    }

    // resolves when all dependencies have been loaded
    // 1) requirejs, can already be present on the page, if not, it will load async
    // 2) monaco, can already be present on the page, if not, it will load async
    const loadEditorDependencies = new Promise( mainResolve => {
        new Promise( requirejsresolve => {
            if( window.require === undefined ) {
                server.loadScript( {
                    path: MONACO_BASE_PATH + "/vs/loader.js"
                }, requirejsresolve );
            } else {
                requirejsresolve();
            }
        } )
            .then( () => {
                configureMonacoPreLoad();
                require( [ "vs/editor/editor.main" ], () => {
                    configureMonacoPostLoad();
                    mainResolve();
                } );
            } );
    } );

    /*
    function setJsInlayHints ( enabled ) {
        typeScriptWorkerLoaded.then( () => {
                // for now let's only enable parameter name hints
                monaco.languages.typescript.javascriptDefaults.setInlayHintsOptions( {
                    includeInlayParameterNameHints: enabled ? "all" : false
                    //includeInlayParameterNameHintsWhenArgumentMatchesName: true,
                    //includeInlayFunctionParameterTypeHints: true,
                    //includeInlayVariableTypeHints: true,
                    //includeInlayPropertyDeclarationTypeHints: true,
                    //includeInlayFunctionLikeReturnTypeHints: true,
                    //includeInlayEnumMemberValueHints: true
                } );
        } );
    }
    */

    // returns the external theme preference: vs or vs-dark
    function getThemeForAutomatic () {
        if( apex.builder ) {
            // if in the builder, respect the builder theme, which might or might not be based on the OS preference
            return apex.builder.isBuilderDarkMode() ? "vs-dark" : "vs";
        } else {
            // if outside of the builder, respect the OS preference
            return window.matchMedia && window.matchMedia( "(prefers-color-scheme: dark)" ).matches ? "vs-dark" : "vs";
        }
    }

    // sets the monaco theme
    // this can only be done globally
    // pass in any of the valid themes: automatic, vs, vs-dark or hc-black
    function setTheme ( theme ) {

        currentTheme = theme;

        let themeToSet;

        if( theme === "automatic" ) {
            themeToSet = getThemeForAutomatic();
        } else if( [ "vs", "vs-dark", "hc-black" ].includes( theme ) ) {
            themeToSet = theme;
        } else {
            themeToSet = getThemeForAutomatic();
            debug.info( theme + " is not a valid Monaco theme. Using automatic instead." );
        }

        // ensures we only touch monaco once it's actually loaded
        loadEditorDependencies.then( () => {
            monaco.editor.setTheme( "apex-" + themeToSet );
        } );
    }

    // when running in the APEX builder, theme automatic is superseded by the builder theme
    //  which can itself be automatic
    // when running outside of the builder, theme automatic comes straight from the OS
    //
    // in both cases, on theme change, if the current editor theme is automatic, we reevaluate it
    if( apex.builder ) {
        // triggered by builder.js on theme change
        $( "body" ).on( "apex-builder-theme-changed", () => {
            if( currentTheme === "automatic" ) {
                setTheme( "automatic" );
            }
        } );
    } else {
        if( window.matchMedia ) {
            window.matchMedia( "(prefers-color-scheme: dark)" ).addListener( () => {
                if( currentTheme === "automatic" ) {
                    setTheme( "automatic" );
                }
            } );
        }
    }

    function isMac () {
        return /(Mac|iPhone|iPod|iPad)/i.test( navigator.platform );
    }

    function getUniversalCtrlKey () {
        // WinCtrl = Ctrl on Mac, WinKey on Windows
        // CtrlCmd = Cmd on Mac, Ctrl on Windows
        // this conditional will ensure Ctrl on both
        return isMac() ? monaco.KeyMod.WinCtrl : monaco.KeyMod.CtrlCmd;
    }

    // Tries to lowercase a string. If the string is already lower-cased, it will uppercase it
    // parts of the string contained enclosed in " ", " " (strings or case sensitive aliases) are *not* transformed
    function transformCodeCase ( str ) {

        if( !str ) {
            return str;
        }

        function getRangesToIgnore ( str ) {
            let arr = [];
            let matches = str.matchAll( /('|")[\s\S]*?(\1)/gm );
            for( let match of matches ) {
                arr.push( { start: match.index, end: match.index + match[ 0 ].length, ignore: true } );
            }
            return arr;
        }

        function completeRanges ( ranges, lastIndex ) {
            let finalRanges = [];
            let currentIndex = 0;

            function addRange ( start, end, ignore ) {
                finalRanges.push( { start: start, end: end, ignore: ignore } );
            }

            if( ranges.length === 0 ) {
                addRange( 0, lastIndex, false );
            } else {
                for( let i = 0; i < ranges.length; i++ ) {
                    let range = ranges[ i ];
                    if( currentIndex < range.start ) {
                        addRange( currentIndex, range.start - 1, false );
                    }
                    addRange( range.start, range.end, true );
                    currentIndex = range.end + 1;
                }
                if( currentIndex < lastIndex - 1 ) {
                    addRange( currentIndex, lastIndex, false );
                }

            }

            return finalRanges;
        }

        function applyFunction ( ranges, func ) {
            let i, range, strPart, result = "";
            for( i = 0; i < allRanges.length; i++ ) {
                range = allRanges[ i ];
                strPart = str.slice( range.start, range.end + 1 );
                result += range.ignore ? strPart : func( strPart );
            }
            return result;
        }

        function toLowerCase ( ranges ) {
            return applyFunction( ranges, function( str ) {
                return str.toLocaleLowerCase();
            } );
        }

        function toUpperCase ( ranges ) {
            return applyFunction( ranges, function( str ) {
                return str.toLocaleUpperCase();
            } );
        }

        let rangesToIgnore = getRangesToIgnore( str );
        let allRanges = completeRanges( rangesToIgnore, str.length - 1 );

        let strLowerCase = toLowerCase( allRanges );
        if( str !== strLowerCase ) {
            return strLowerCase;
        } else {
            return toUpperCase( allRanges );
        }
    }

    $.widget( "apex.codeEditor", {
        version: "22.1",
        widgetEventPrefix: "codeEditor",
        options: {
            language: LANG_JAVASCRIPT,
            value: "",
            readOnly: false,
            autofocus: false,
            ariaLabel: "",
            errors: [],
            warnings: [],
            /*
             * Editor specific suggestions
             * Can be an array of objects:
             *  [{
             *      label: "P1_FIRST_NAME (First Name)", // required
             *      insertText: "P1_FIRST_NAME",         // optional
             *      detail: "Page Item",                 // optional
             *      documentation: "some  text"          // optional
             *  }]
             *
             * Or a callback function that will be invoked on widget load and on language change
             * It must return the same kind of array
             * function(language){
             *      if(language == "sql"){ return [...];}
             *      else if(language == "javascript"){ return [...];}
             *      else { return []; }
             * }
             */
            suggestions: null,
            /*
             * pageInfo should provided only if in Page Designer
             * {
             *    pageId: 1,
             *    items: [{
             *      name: "P1_ID",
             *      type: "NATIVE_NUMBER_FIELD"
             *    }]
             *    regions: [{
             *      staitcId: "myFacetRegion",
             *      type: "NATIVE_FACETED_SEARCH"
             *    }]
             * }
             * 
             * pageId is used by the item name validator
             * items and regions are used by the apex.items and apex.regions autocomplete
             * items.name is also used for the item name validator
             */
            pageInfo: {
                pageId: null,
                items: [],
                regions: []
            },
            showSuggestions: true,
            // should be passed as true in Page Designer, while also assuring the page items are returned by the suggestions function
            validatePageItems: false,
            accessibilityMode: false,
            // monaco options: exposing them here as opposed to arbitrarily passing them forward
            // to keep a list of all options used

            // "on", "off", "conditional" (only show when content >= 100 lines)
            minimap: MINIMAP_CONDITIONAL,
            lineNumbers: true,
            wordWrap: false,
            scrollBeyondLastLine: true,
            // wordBasedSuggestions are not scope-limited, so they can be more disturbing than useful
            wordBasedSuggestions: false,
            // toolbar is always available in the builder, but can be disabled for theme roller
            toolbar: true,
            whitespace: false,
            // settings which can be overridden by user preference
            theme: "automatic",
            tabsInsertSpaces: true,
            indentSize: "4",
            tabSize: "4",
            ruler: false,
            bracketPairColorization: false,
            // to be enabled in a future APEX version when they are stable enough
            //semanticHighlighting: true, // currently for JS only. might change with the SQL lang server
            //inlayHints: false,          // currently for JS only
            // callback functions
            onInitialized: null,  // optional. function that runs after the editor is initialized. function(editor){}
            codeComplete: null,   // optional. function( options, callback )
            validateCode: null,   // optional. function( code, callback ) callback: function( {errors:[],warnings:[]} )
            queryBuilder: null,   // optional. function( editor, code )
            heightFn: null,       // optional. function returning editor height
            // if provided, it will be called on initialization and subsequently at window resize
            // events/callbacks
            preferencesChanged: null    // function( event )
        },
        // holds monaco context keys which can be used as conditions in a number of places, eg. keyboard shortcuts
        _contextKeys: {},
        /*
         * Lifecycle methods
         */
        _create: function() {
            const self = this,
                o = this.options,
                editor$ = $( self.element[ 0 ] ).addClass( "a-MonacoEditor" );

            editor$.append( $( `
                <div class="a-MonacoEditorContent">
                    <div class="a-MonacoEditor-toolbar"></div>
                    <div class="a-MonacoEditor-notification" style="display:none;">
                        <div class="a-MonacoEditor-message"></div>
                        <button title="${MSG_CLOSE}" aria-label="${MSG_CLOSE}" class="a-Button a-Button--noLabel a-Button--withIcon a-Button--small a-CodeEditor-searchBar-closeButton" type="button">
                            <span class="a-Icon ui-icon-closethick" aria-hidden="true"></span>
                        </button>
                    </div>
                    <div class="a-MonacoEditor-editor"></div>
                </div>
            `) );

            self._editor$ = editor$;
            self._toolbar$ = editor$.find( ".a-MonacoEditor-toolbar" );
            self._notification$ = editor$.find( ".a-MonacoEditor-notification" );
            self._monacoEditor$ = editor$.find( ".a-MonacoEditor-editor" ).first();

            ( async () => {
                // load dependencies
                await loadEditorDependencies;
                await loadLanguageDependencies( self.options.language, self.options );

                // initialize toolbar
                if( o.toolbar ) {
                    self._context = actions.createContext( "codeEditor", this.element[ 0 ] );
                    self._initToolbar( self._toolbar$ );
                }

                // initialize notifications area
                self._notification$.find( "button" ).click( () => { self.resetNotification(); } );

                // monaco themes are set globally
                setTheme( o.theme );

                // TODO apply same logic for the language-specific options in _setLanguage
                const editorOptions = {
                    readOnly: o.readOnly,
                    detectIndentation: false,
                    insertSpaces: o.tabsInsertSpaces,
                    indentSize: o.indentSize,
                    tabSize: o.tabSize,
                    rulers: o.ruler ? [ 80 ] : [],
                    scrollBeyondLastLine: o.scrollBeyondLastLine,
                    lineNumbers: o.lineNumbers,
                    // slightly narrower line number column
                    lineNumbersMinChars: 4,
                    scrollbar: {
                        // allows page to scroll if bottom of editor was reached
                        alwaysConsumeMouseWheel: false
                    },
                    fixedOverflowWidgets: true,
                    ariaLabel: o.ariaLabel,
                    // when editing plaintext, enforce the wordWrap option
                    // otherwise respect the passed in options
                    wordWrap: o.language === "plaintext" ? true : ( o.wordWrap ? "on" : "off" ),
                    wordBasedSuggestions: o.wordBasedSuggestions,
                    quickSuggestions: o.showSuggestions,
                    accessibilitySupport: o.accessibilityMode ? "on" : "off",
                    renderWhitespace: o.whitespace ? "all" : "none",
                    // content should be copied plaintext for clean pasting in rich text contexts (Word, Jira etc)
                    copyWithSyntaxHighlighting: false,

                    // semanticHighlighting and bracket pair colorization to be enabled in a future APEX version
                    // enabled for all, but only JavaScript has the smarts to make use of it
                    // "semanticHighlighting.enabled": o.semanticHighlighting,
                    "bracketPairColorization.enabled": o.bracketPairColorization,

                    // TODO. could not get this option to work. either way it should be based on an editor setting
                    // "guides.bracketPairs.enabled": true,

                    // has side effect of not formatting multi-lines of SQL when indenting which is what we want
                    useTabStops: o.language === LANG_SQL ? false : true,
                    mouseWheelZoom: true,
                    // fixes the terrible word-based-suggestions coming from monaco-typescript
                    // see github.com/microsoft/monaco-editor/issues/1980
                    suggest:
                        [ LANG_JAVASCRIPT, LANG_MLE_JAVASCRIPT ].includes( o.language )
                            ? { showFiles: false }
                            : undefined
                };

                const model = monaco.editor.createModel( o.value, o.language.replace( "mle-", "" ) );

                const editor = monaco.editor.create( self._monacoEditor$[ 0 ], editorOptions );

                editor.setModel( model );

                self._model = model;
                self._modelId = model.id;
                self._editor = editor;
                self._editorId = editor.getId();

                editor.onDidDispose( () => {
                    // editor-specific disposableManager logic
                    self._disposeAllDisposables();
                    model.dispose();
                } );

                // initialize monaco context keys used as conditions for various actions
                self._evaluateContextKeys( o.language );

                if( o.toolbar ) {
                    self._updateNotifications();
                    self._populateContext();
                }

                // resizing logic
                window.addEventListener( "resize", util.debounce( () => { self.resize(); }, 200 ) );
                editor$.on( "resize", function( pEvent ) {
                    self.resize();
                    pEvent.stopPropagation();
                } );

                if( o.autofocus ) {
                    self.focus();
                }

                // Use Monaco onDidChangeContent to simulate a keypress on text area, allowing DA "Key press" to work
                model.onDidChangeContent( function( event ) {
                    self.element.children( "textarea" ).trigger( "keypress", event );
                } );

                // Combine onDidFocusEditorWidget and onDidBlurEditorWidget to simulate change event
                let oldValue;
                editor.onDidFocusEditorWidget( function() {
                    oldValue = model.getValue();
                } );

                editor.onDidBlurEditorWidget( function() {
                    let textarea$ = self.element.children( "textarea" ),
                        newValue = model.getValue();
                    // Trigger blur on the textarea, so DA "blur" will work
                    textarea$.trigger( "blur" );
                    // Simulate "change" event (on blur and value changed), so DA "change" will work
                    if( oldValue !== newValue ) {
                        textarea$.val( newValue ).trigger( "change" );
                    }
                } );

                // initialize item name validator
                if( o.validatePageItems && o.pageInfo.pageId ) {
                    self._initializeItemValidator();
                }

                // editor specific suggestion provider based on o.suggestions and o.language
                self._configureCustomSuggestionProvider();

                // configures custom shortcuts and extra editor actions
                self._initializeCustomActions();

                self._setupMinimap();

                // the accessibility mode can also be changed via the command pallette
                // we want to ensure our widget/toolbar option stays in sync with this editor option
                let accessibilitySupportId = monaco.editor.EditorOptions.accessibilitySupport.id;
                editor.onDidChangeConfiguration( function( evt ) {
                    if( evt.hasChanged( accessibilitySupportId ) ) {
                        o.accessibilityMode = ( editor.getOption( accessibilitySupportId ) === monaco.editor.AccessibilitySupport.Enabled );
                        self._notifyPreferenceChange();
                    }
                } );

                // monaco uses a textarea deep inside the widget, onto which at times a change event is triggered
                // this can cause issues when embedding the editor in other widgets, such as Theme Roller
                // a fix is to not let any internal change events propagate outside of the editor
                self._monacoEditor$.on( "change", function( e ) {
                    e.stopPropagation();
                } );

                if( self._tempValue !== undefined ) {
                    model.setValue( self._tempValue );
                    self._tempValue = undefined;
                }

                editor.onDidFocusEditorWidget( function() {
                    if( [ LANG_JAVASCRIPT, LANG_MLE_JAVASCRIPT ].includes( o.language ) ) {
                        reevaluateGlobalJsSettings( o.language, o.pageInfo );
                    }
                } );

                self._on( self._eventHandlers );

                if( o.onInitialized ) {
                    o.onInitialized( editor );
                }
            } )();
        },

        _eventHandlers: {
            resize: function( event ) {
                this.resize();
                event.stopPropagation();
            },
            focusin: function() {
                this.element.addClass( C_ACTIVE );
            },
            focusout: function() {
                this.element.removeClass( C_ACTIVE );
            }
        },

        _destroy: function() {
            if( this._editor ) {
                this._editor.dispose();
            }
        },

        _setOption: function( key, value ) {
            let self = this,
                o = self.options,
                editor = self._editor;
            self._super( key, value );
            if( [ "errors", "warnings" ].includes( key ) ) {
                self._updateNotifications();
            } else if( key === "language" ) {
                self._setLanguage( value );
            } else if( key === "tabsInsertSpaces" ) {
                editor.updateOptions( { insertSpaces: value } );
            } else if( key === "ruler" ) {
                editor.updateOptions( { rulers: value ? [ 80 ] : [] } );
            } else if( key === "theme" ) {
                o.theme = value;
                setTheme( value );
            } else if( key === "minimap" ) {
                self._setupMinimap();
            } else if( key === "lineNumbers" ) {
                editor.updateOptions( { lineNumbers: !!value } );
            } else if( key === "accessibilityMode" ) {
                editor.updateOptions( { accessibilitySupport: value ? "on" : "off" } );
            } else if( key === "whitespace" ) {
                editor.updateOptions( { renderWhitespace: value ? "all" : "none" } );
            } else if( key === "showSuggestions" ) {
                editor.updateOptions( { quickSuggestions: !!value } );
            } else if( key === "bracketPairColorization" ) {
                editor.updateOptions( { "bracketPairColorization.enabled": !!value } );
            }/* else if( key === "semanticHighlighting" ) {
                editor.updateOptions( { "semanticHighlighting.enabled": !!value } );
            } else if( key === "inlayHints" ) {
                setJsInlayHints( !!value );
            }*/
        },

        setValue: function( value ) {
            if( this._model ) {
                this._model.setValue( value );
            } else {
                this._tempValue = value;
            }
        },

        getValue: function() {
            if( this._model ) {
                return this._model.getValue();
            } else if( this._tempValue !== undefined ) {
                // the editor has not yet initialized, but a new value has already been set
                return this._tempValue;
            } else {
                // the editor has not yet initialized. returning original initial value
                return this.options.value;
            }
        },

        getEditor: function() {
            return this._editor;
        },

        resize: function() {
            let self = this,
                editor = self._editor;

            if( self.options.heightFn ) {
                self._editor$.outerHeight( self.options.heightFn() );
            }

            if( editor ) {
                editor.layout();
            }
        },

        getSelection: function() {
            return this._model.getValueInRange( this._editor.getSelection() );
        },

        /**
         * The caller is responsible for making sure that pMessage is escaped as needed.
         * @param pMessage may contain markup
         */
        showNotification: function( message ) {
            let container$ = this._notification$.show().children().first();
            if( typeof message === "string" ) {
                container$.html( message );
            } else if( typeof message === "object" && message instanceof jQuery ) {
                container$.empty();
                container$.append( message );
            } else {
                debug.error( "The notification message must be a string or a jQuery object" );
            }
            this.resize();
        },

        // removes the message content and hides the container
        resetNotification: function() {
            this._notification$
                .hide()
                .children().first().empty();
            this.resize();
        },

        // the message must be escaped externally
        showSuccessNotification: function( message ) {
            this.showNotification( `<ul><li class="is-success">${message}</li></ul>` );
        },

        focus: function() {
            this.element.addClass( C_ACTIVE );
            this._editor.focus();
        },

        // note that lineNumber and column are 1-based indexes
        setCursor: function( lineNumber, column ) {
            this._editor.setPosition( {
                lineNumber: lineNumber,
                column: column
            } );
        },

        setCursorToEnd: function( revealLine ) {
            let editor = this._editor,
                model = this._model,
                lastLine = model.getLineCount(),
                lastColumn = model.getLineMaxColumn( lastLine );

            this.setCursor( lastLine, lastColumn );

            if( revealLine ) {
                editor.revealLine( lastLine );
            }
        },

        changeGeneration: function() {
            return this._model.getAlternativeVersionId();
        },

        isClean: function( pGeneration ) {
            return this._model.getAlternativeVersionId() === pGeneration;
        },

        getPreferencesString: function() {
            let o = this.options,
                obj = {},
                prefKeys = Object.values( PREF );

            for( let i = 0; i < prefKeys.length; i++ ) {
                let key = prefKeys[ i ];
                obj[ key ] = o[ key ];
            }

            return JSON.stringify( obj );
        },

        /*
         * Private functions
         */

        // editor-specific disposable logic
        _disposableExists: function( key ) {
            return DISPOSABLE_MANAGER.existsForEditor( this._editorId, key );
        },
        _registerDisposable: function( key, disposable ) {
            DISPOSABLE_MANAGER.registerForEditor( this._editorId, key, disposable );
        },
        _disposeDisposable: function( key ) {
            DISPOSABLE_MANAGER.disposeForEditor( this._editorId, key );
        },
        _disposeAllDisposables: function() {
            DISPOSABLE_MANAGER.deregisterEditor( this._editorId );
        },
        // triggers an internal monaco action
        _triggerMonacoAction: function( actionName ) {
            const editor = this._editor;

            // the editor must be in focus for the action to take effect
            this.focus();
            editor.trigger( null, actionName );
        },

        // to be called after widget initializtion and when the language changes
        _configureCustomSuggestionProvider: function() {
            let self = this,
                editor = self._editor,
                o = self.options,
                language = o.language.replace( "mle-", "" ),
                suggestions = o.suggestions,
                finalSuggestions,
                word;

            if( suggestions ) {

                if( Array.isArray( suggestions ) ) {
                    finalSuggestions = suggestions;
                } else if( typeof suggestions === "function" ) {
                    finalSuggestions = suggestions( language );
                } else {
                    debug.error( "Suggestions type not supported" );
                    return;
                }

                finalSuggestions = finalSuggestions.map( suggestion => {
                    suggestion.insertText = suggestion.insertText || suggestion.label;
                    return suggestion;
                } );

                self._registerDisposable( "global-suggestions", monaco.languages.registerCompletionItemProvider( language, {
                    provideCompletionItems: function( model, position ) {
                        // a completion item provider is unfortunately set to the entire language and is not editor specific
                        // to get around this, whenever this provider is invoked, we check if the editor has focus
                        // if not, it means another editor with this language has focus so we don't return any suggestions
                        if( editor.hasTextFocus() ) {
                            word = model.getWordUntilPosition( position );
                            const toReturn = finalSuggestions.map( suggestion => {
                                suggestion.range = {
                                    startLineNumber: position.lineNumber,
                                    endLineNumber: position.lineNumber,
                                    startColumn: word.startColumn,
                                    endColumn: word.endColumn
                                };
                                suggestion.kind = monaco.languages.CompletionItemKind.Constructor;
                                return suggestion;
                            } );
                            if( toReturn.length ) {
                                return { suggestions: toReturn };
                            } else {
                                return;
                            }
                        } else {
                            return;
                        }
                    }
                } ) );

                // if the language is mle-javascript, we also trigger the suggestions on the dot after apex.env
                if( o.language === LANG_MLE_JAVASCRIPT ) {
                    self._registerDisposable( DISP_MLE_ENV, monaco.languages.registerCompletionItemProvider( LANG_JAVASCRIPT, {
                        triggerCharacters: [ "." ],
                        provideCompletionItems: function( model, position, context ) {
                            if( // only if this is the editor in question
                                editor.hasTextFocus() &&
                                // only if "." was pressed
                                context.triggerKind === monaco.languages.CompletionTriggerKind.TriggerCharacter &&
                                context.triggerCharacter === "." &&
                                // only if the dot follows apex.env
                                model.getLineContent( position.lineNumber ).substr( 0, position.column - 2 ).endsWith( "apex.env" )
                            ) {
                                word = model.getWordUntilPosition( position );
                                const toReturn = finalSuggestions.map( suggestion => {
                                    suggestion.range = {
                                        startLineNumber: position.lineNumber,
                                        endLineNumber: position.lineNumber,
                                        startColumn: word.startColumn,
                                        endColumn: word.endColumn
                                    };
                                    suggestion.kind = monaco.languages.CompletionItemKind.Constructor;
                                    return suggestion;
                                } );
                                if( toReturn.length ) {
                                    return {
                                        suggestions: toReturn
                                    };
                                } else {
                                    return;
                                }
                            } else {
                                return;
                            }
                        }
                    } ) );
                }
            }
        },

        // start of minimap logic
        _setupMinimap: function() {
            const self = this,
                o = self.options,
                editor = self._editor,
                model = self._model;

            if( self._disposableExists( DISP_MINIMAP ) ) {
                self._disposeDisposable( DISP_MINIMAP );
            }

            function showHideMinimap () {
                if( editor && model && !model.isDisposed() ) {
                    editor.updateOptions( {
                        minimap: {
                            enabled: o.minimap === MINIMAP_ON || ( o.minimap === MINIMAP_CONDITIONAL && ( model.getLineCount() >= 100 ) )
                        }
                    } );
                }
            }

            if( o.minimap === MINIMAP_CONDITIONAL ) {
                self._registerDisposable( DISP_MINIMAP, model.onDidChangeContent( util.debounce( showHideMinimap, 1000 ) ) );
            }

            showHideMinimap();
        },
        // end of minimap logic

        _getLineFromMessage: function( message ) {
            // An error message has the form "...ORA-06550: line xx, column yy: Error Message...""
            let index = message.indexOf( "ORA-06550" );
            if( index > -1 ) {
                let str = message.slice( index );
                let parsedError = str.match( /\d{1,}/g );
                let lineNumber = parseInt( parsedError[ 1 ], 10 );
                let columnNumber = parseInt( parsedError[ 2 ], 10 );
                if( isNaN( lineNumber ) ) {
                    lineNumber = 0;
                }
                if( isNaN( columnNumber ) ) {
                    columnNumber = 0;
                }

                return { lineNumber: lineNumber, columnNumber: columnNumber };
            } else {
                return null;
            }
        },

        // reveals line in center and sets the cursor at the given position
        // line and column must be 1-based
        // pass focus = false, if the editor should not be focused after the position was set
        //      this can avoid console errors in cases where the focus is trapped somewhere else,
        //      like alert dialogs. see bug #33264302
        gotoPosition: function( line, column, focus = true ) {
            let self = this,
                editor = self._editor;

            if( editor ) {
                editor.revealLineInCenter( line );
                editor.setPosition( {
                    lineNumber: line,
                    column: column
                } );
                if( focus ) {
                    setTimeout( function() {
                        if( editor ) {
                            editor.focus();
                        }
                    }, 100 );
                }
            }
        },

        _updateNotifications: function() {
            let self = this,
                options = self.options,
                list$ = $( "<ul/>" );

            if( options.errors.length || options.warnings.length ) {
                for( let i = 0; i < options.errors.length; i++ ) {
                    let message = util.escapeHTML( options.errors[ i ] ),
                        lineObject = self._getLineFromMessage( message ),
                        listItem$ = $( "<li class=\"is-error\" style=\"cursor: pointer;\"></li>" );

                    if( lineObject ) {
                        listItem$.append( $( `<a data-line="${lineObject.lineNumber}" data-column="${lineObject.columnNumber}"></a>` ).html( message ) );
                    } else {
                        listItem$.html( message );
                    }

                    list$.append( listItem$ );
                }
                for( let i = 0; i < options.warnings.length; i++ ) {
                    let message = util.escapeHTML( options.warnings[ i ] ),
                        lineObject = self._getLineFromMessage( message ),
                        listItem$ = $( "<li class=\"is-warning\" style=\"cursor: pointer;\"></li>" );

                    if( lineObject ) {
                        listItem$.append( $( `<a data-line="${lineObject.lineNumber}" data-column="${lineObject.columnNumber}"></a>` ).html( message ) );
                    } else {
                        listItem$.html( message );
                    }

                    list$.append( listItem$ );
                }

                self.showNotification( list$ );
            } else {
                self.resetNotification();
            }

            $( "a[data-line]", list$ ).on( "click", function() {
                self.gotoPosition( $( this ).data( "line" ), $( this ).data( "column" ) );
            } );

            self._updateLineMessages();
        },

        _updateLineMessages: function() {
            let self = this,
                options = self.options,
                model = self._model,
                lineMessages = [],
                lineMessage;

            // error have format:     ORA-20999: Failed to parse SQL query! <p>ORA-06550: line 6, column 5: ORA-00942: table or view does not exist</p>
            // warnings have format:  ORA-06550: line 1, column 78: PL/SQL: ORA-00942: table or view does not exist
            function cleanMessageForInline ( options ) {
                let newMessage = options.message.split( ":" ).slice( options.afterColonIndex ).join( ":" ).trim();

                if( options.removeHtmlTags ) {
                    newMessage = util.stripHTML( newMessage );
                }

                if( newMessage.length ) {
                    return newMessage;
                } else {
                    return options.message;
                }
            }

            for( let i = 0; i < options.errors.length; i++ ) {
                lineMessage = self._getLineFromMessage( options.errors[ i ] );
                if( lineMessage ) {
                    lineMessages.push( {
                        startLineNumber: lineMessage.lineNumber,
                        endLineNumber: lineMessage.lineNumber,
                        startColumn: lineMessage.columnNumber,
                        endColumn: 1000,
                        message: cleanMessageForInline( {
                            message: options.errors[ i ],
                            afterColonIndex: 4,
                            removeHtmlTags: true
                        } ),
                        severity: monaco.MarkerSeverity.Error
                    } );
                }
            }
            for( let i = 0; i < options.warnings.length; i++ ) {
                lineMessage = self._getLineFromMessage( options.warnings[ i ] );
                if( lineMessage ) {
                    lineMessages.push( {
                        startLineNumber: lineMessage.lineNumber,
                        endLineNumber: lineMessage.lineNumber,
                        startColumn: lineMessage.columnNumber,
                        endColumn: 1000,
                        message: cleanMessageForInline( {
                            message: options.warnings[ i ],
                            afterColonIndex: 3,
                            removeHtmlTags: false
                        } ),
                        severity: monaco.MarkerSeverity.Warning
                    } );
                }
            }

            monaco.editor.setModelMarkers( model, "lineMessages", lineMessages );

            if( lineMessages.length ) {
                self.gotoPosition( lineMessages[ 0 ].startLineNumber, lineMessages[ 0 ].startColumn );
            }
        },

        _queryBuilder: function() {
            let fn = this.options.queryBuilder;
            if( fn ) {
                fn( this, this.getValue() );
            }
        },

        _codeComplete: function() {

            // ajax-based code complete is only allowed for sql and mle-javascript, and only if a callback has been provided
            if( !( this.options.codeComplete && [ LANG_SQL, LANG_MLE_JAVASCRIPT ].includes( this.options.language ) ) ) {
                return;
            }

            let self = this,
                language = self.options.language,
                editor = self._editor,
                model = self._model,
                currentPosition = editor.getPosition(),
                lineValue = model.getLineContent( currentPosition.lineNumber ),
                word, parts, search, parent, grantParent,
                isItem = false,
                $spinner,
                elem = self.element[ 0 ];

            // the builtin model.getWordAtPosition and getWordAroundPosition functions
            // to not return values such as "x.y.z", only "z"
            // so we use our own function
            function getWordAround ( s, pos ) {
                // make pos point to a character of the word
                while( s[ pos ] === " " ) {
                    pos = pos - 1;
                }
                // find the space before that word
                // (add 1 to be at the begining of that word)
                // (note that it works even if there is no space before that word)
                pos = s.lastIndexOf( " ", pos ) + 1;
                // find the end of the word
                let end = s.indexOf( " ", pos );
                if( end === -1 ) {
                    end = s.length; // set to length if it was the last word
                }
                // return the result
                return s.substring( pos, end );
            }

            word = getWordAround( lineValue, currentPosition.column - 1 );
            parts = word.split( "." );

            if( language === LANG_SQL ) {
                if( parts.length === 1 && [ ":", "&" ].includes( word.charAt( 0 ) ) ) {
                    isItem = true;
                    search = word.slice( 1 );
                } else {
                    parent = parts[ parts.length - 2 ];
                    grantParent = parts[ parts.length - 3 ];
                }
            } else if( language === LANG_MLE_JAVASCRIPT ) {
                if( parts.length === 3 && parts[ 0 ] === "apex" && parts[ 1 ] === "env" ) {
                    isItem = true;
                    search = parts[ 2 ];
                    parent = undefined;
                    grantParent = undefined;
                } else {
                    self._triggerMonacoAction( "editor.action.triggerSuggest" );
                    return;
                }
            }

            // function invoked when the autocomplete items are returned
            // pData has to be in the format:
            //   [
            //     type:      "string", (template, application_item, page_item, package, procedure, function, constant, variable, type, table, view)
            //     title:     "string",
            //     className: "string",
            //     completions: [
            //       { d: "string", r: "string" } or "string"
            //     ]
            //   ]
            function _success ( pData ) {

                apex.util.delayLinger.finish( "autocompleteSpinner", function() {
                    if( $spinner ) {
                        $spinner.remove();
                        $spinner = null;
                    }
                } );

                let kinds = monaco.languages.CompletionItemKind;

                // There is currently no built-in way to provide our own icons
                // do not use kinds.File! as it's disabled for JavaScript
                let monacoTypes = {
                    template: kinds.Constructor,
                    application_item: kinds.Constructor,
                    page_item: kinds.Constructor,
                    package: kinds.Constructor,
                    procedure: kinds.Method,
                    function: kinds.Function,
                    constant: kinds.Constructor,
                    variable: kinds.Constructor,
                    type: kinds.Constructor,
                    table: kinds.Constructor,
                    view: kinds.Constructor,
                    keyword: kinds.Constructor,
                    sequence: kinds.Constructor
                };

                let type,
                    completion,
                    completions = [];
                for( let i = 0; i < pData.length; i++ ) {
                    type = pData[ i ];

                    for( let j = 0; j < type.completions.length; j++ ) {
                        completion = type.completions[ j ];
                        let text = completion.r || completion;

                        completions.push( {
                            label: ( completion.d || completion ),
                            insertText: text,
                            detail: type.title,
                            kind: monacoTypes[ type.type ]
                        } );
                    }
                }

                // alreadyShown ensures temporary completions are only used by the completionItemProvider once: now.
                // it would be more elegant to dispose the registerCompletionItemProvider disposable when we're done with the autocomplete
                // but we don't have enough info on this, risking to hide the popup right after it was shown
                let alreadyShown = false;
                self._registerDisposable( "ajax-suggestions", monaco.languages.registerCompletionItemProvider( model._languageId, {
                    provideCompletionItems: function() {
                        if( self.element.hasClass( C_ACTIVE ) && !alreadyShown ) {
                            alreadyShown = true;
                            if( completions.length ) {
                                return {
                                    suggestions: completions
                                };
                            } else {
                                return;
                            }
                        } else {
                            return;
                        }
                    }
                } ) );

                // show the completion suggestions menu by force
                self._triggerMonacoAction( "editor.action.triggerSuggest" );
            } // _success


            util.delayLinger.start( "autocompleteSpinner", function() {
                $spinner = util.showSpinner( elem );
            } );

            self.options.codeComplete( {
                type: isItem ? "item" : "",
                search: isItem ? search : parts[ parts.length - 1 ],
                parent: parent,
                grantParent: grantParent
            }, _success );
        },

        _validateCode: function() {
            if( !this.options.validateCode ) {
                return;
            }

            let self = this;

            self.options.validateCode( self.getValue(), function( results ) {
                results = $.extend( {}, { errors: [], warnings: [] }, results );
                self._setOption( "errors", results.errors );
                self._setOption( "warnings", results.warnings );
                if( results.errors.length === 0 && results.warnings.length === 0 ) {
                    // indicate that all is well
                    self.showSuccessNotification( util.escapeHTML( MSG_VALIDATION_SUCCESS ) );
                }
            } );
        },

        _notifyPreferenceChange: function() {
            let self = this,
                element = self.element[ 0 ];
            self._trigger( "preferencesChanged", $.Event( "click", { target: element } ) );
        },

        _populateContext: function() {
            let self = this,
                o = self.options,
                language = o.language,
                editor = self._editor,
                model = self._model,
                context = self._context;

            function updateIndentation () {
                model.updateOptions( {
                    insertSpaces: o.tabsInsertSpaces,
                    tabSize: o.tabSize,
                    indentSize: o.indentSize
                } );
            }

            context.add( [ {
                name: "undo",
                action: function() {
                    self._triggerMonacoAction( "undo" );
                }
            }, {
                name: "redo",
                action: function() {
                    self._triggerMonacoAction( "redo" );
                }
            }, {
                name: "find",
                action: function() {
                    // findReplace does not exist in readOnly mode, so we must invoke the regular find
                    self._triggerMonacoAction( o.readOnly ? "actions.find" : "editor.action.startFindReplaceAction" );
                }
            }, {
                name: "theme",
                get: function() {
                    return o.theme;
                },
                set: function( v ) {
                    o.theme = v;
                    setTheme( v );
                    self._notifyPreferenceChange();
                },
                choices: OPTIONS_THEME
            }, {
                name: "minimap",
                get: function() {
                    return o.minimap;
                },
                set: function( v ) {
                    o.minimap = v;
                    self._setupMinimap();
                    self._notifyPreferenceChange();
                },
                choices: OPTIONS_MINIMAP
            }, {
                name: "tabs-insert-spaces",
                label: MSG_INDENT_WITH_TABS,
                get: function() {
                    return o.tabsInsertSpaces;
                },
                set: function( v ) {
                    o.tabsInsertSpaces = v;
                    updateIndentation();
                    self._notifyPreferenceChange();
                }
            }, {
                name: "tab-size",
                get: function() {
                    return o.tabSize;
                },
                set: function( v ) {
                    o.tabSize = v;
                    updateIndentation();
                    self._notifyPreferenceChange();
                },
                choices: OPTIONS_TAB_SIZE
            }, {
                name: "indent-size",
                get: function() {
                    return o.indentSize;
                },
                set: function( v ) {
                    o.indentSize = v;
                    updateIndentation();
                    self._notifyPreferenceChange();
                },
                choices: OPTIONS_INDENT_SIZE
            }, {
                name: "show-ruler",
                label: MSG_SHOW_RULER,
                get: function() {
                    return o.ruler;
                },
                set: function( v ) {
                    self._setOption( "ruler", v );
                    self._notifyPreferenceChange();
                }
            }, {
                name: "line-numbers",
                label: MSG_SHOW_LINE_NUMBERS,
                get: function() {
                    return o.lineNumbers;
                },
                set: function( v ) {
                    self._setOption( "lineNumbers", v );
                    self._notifyPreferenceChange();
                }
            }, {
                name: "whitespace",
                label: MSG_WHITESPACE,
                get: function() {
                    return o.whitespace;
                },
                set: function( v ) {
                    self._setOption( "whitespace", v );
                    self._notifyPreferenceChange();
                }
            }, {
                name: "show-suggestions",
                label: MSG_SUGGESTIONS,
                get: function() {
                    return o.showSuggestions;
                },
                set: function( v ) {
                    self._setOption( "showSuggestions", v );
                    self._notifyPreferenceChange();
                }
            }, {
                name: "accessibility-mode",
                label: MSG_ACCESSIBILITY_MODE,
                get: function() {
                    return o.accessibilityMode;
                },
                set: function( v ) {
                    self._setOption( "accessibilityMode", v );
                    self._notifyPreferenceChange();
                }
            }, {
                name: "bracket-pair-colorization",
                label: MSG_BRACKET_PAIR_COLORIZATION,
                get: function() {
                    return o.bracketPairColorization;
                },
                set: function( v ) {
                    self._setOption( "bracketPairColorization", v );
                    self._notifyPreferenceChange();
                }
            },/* {
                name: "semantic-highlighting",
                label: "Semantic Highlighting", // TODO localize
                get: function() {
                    return o.semanticHighlighting;
                },
                set: function( v ) {
                    self._setOption( "semanticHighlighting", v );
                    self._notifyPreferenceChange();
                }
            }, {
                name: "inlay-hints",
                label: "Inlay Hints", // TODO localize
                get: function() {
                    return o.inlayHints;
                },
                set: function( v ) {
                    self._setOption( "inlayHints", v );
                    self._notifyPreferenceChange();
                }
            } */ ] );

            if( o.queryBuilder ) {
                context.add( {
                    name: "query-builder",
                    hide: language !== LANG_SQL,    // initial hidden state
                    action: function() {
                        self._queryBuilder();
                    }
                } );
            }

            if( o.codeComplete ) {
                context.add( {
                    name: "code-complete",
                    hide: ![ LANG_SQL, LANG_MLE_JAVASCRIPT ].includes( language ),    // initial hidden state
                    action: function() {
                        self._codeComplete();
                    }
                } );

                editor.addAction( {
                    id: "apex-code-complete",
                    label: MSG_HINT,
                    keybindings: [ getUniversalCtrlKey() | monaco.KeyCode.Space ],
                    precondition: CONTEXT_KEY_DBHINT,
                    run: function() {
                        self._codeComplete();
                    }
                } );
            }

            if( o.validateCode ) {
                context.add( {
                    name: "validate",
                    hide: language !== LANG_SQL,    // initial hidden state
                    action: function() {
                        self._validateCode();
                    }
                } );
                editor.addAction( {
                    id: "apex-code-validate",
                    label: MSG_VALIDATE,
                    keybindings: [ getUniversalCtrlKey() | monaco.KeyMod.Alt | monaco.KeyCode.KeyV ],
                    precondition: CONTEXT_KEY_ISSQL,
                    run: function() {
                        self._validateCode();
                    }
                } );
            }

            // logic for enabling or disabling the undo/redo buttons
            ( function() {
                // save states for undo/redo button disabling logic
                let initialVersion = model.getAlternativeVersionId(),
                    currentVersion = initialVersion,
                    lastVersion = initialVersion;

                editor.onDidChangeModelContent( () => {
                    let versionId = model.getAlternativeVersionId();
                    // undoing
                    if( versionId < currentVersion ) {
                        context.enable( "redo" );
                        // no more undo possible
                        if( versionId === initialVersion ) {
                            context.disable( "undo" );
                        }
                    } else {
                        // redoing
                        if( versionId <= lastVersion ) {
                            // redoing the last change
                            if( versionId === lastVersion ) {
                                context.disable( "redo" );
                            }
                        } else { // adding new change, disable redo when adding new changes
                            context.disable( "redo" );
                            if( currentVersion > lastVersion ) {
                                lastVersion = currentVersion;
                            }
                        }
                        context.enable( "undo" );
                    }
                    currentVersion = versionId;
                } );

                // on itinialization, disable both undo and redo
                context.disable( "undo" );
                context.disable( "redo" );
            } )();
        },

        _initToolbar: function( container$ ) {
            let o = this.options,
                helper;

            let config = {
                actionsContext: this._context,
                simple: true,
                data: []
            };

            let undoControls = [];

            undoControls.push( {
                type: "BUTTON",
                title: MSG_UNDO,
                label: MSG_UNDO,
                iconOnly: true,
                icon: "icon-undo",
                action: "undo"
            } );

            undoControls.push( {
                type: "BUTTON",
                title: MSG_REDO,
                label: MSG_REDO,
                iconOnly: true,
                icon: "icon-redo",
                action: "redo"
            } );

            config.data.push( {
                id: "undoControls",
                align: "start",
                groupTogether: true,
                controls: undoControls
            } );

            let searchControls = [];
            searchControls.push( {
                type: "BUTTON",
                title: MSG_FIND,
                label: MSG_FIND,
                iconOnly: true,
                icon: "icon-cm-find",
                action: "find"
            } );

            config.data.push( {
                id: "searchControls",
                align: "start",
                groupTogether: true,
                controls: searchControls
            } );

            if( o.queryBuilder || o.codeComplete || o.validateCode ) {
                let helperGroup = {
                    id: "helperControls",
                    align: "start",
                    groupTogether: true,
                    controls: []
                };

                if( o.queryBuilder ) {
                    helperGroup.controls.push( {
                        type: "BUTTON",
                        title: MSG_QUERY_BUILDER,
                        label: MSG_QUERY_BUILDER,
                        iconOnly: true,
                        icon: "icon-cm-query-builder",
                        action: "query-builder"
                    } );
                }

                if( o.codeComplete ) {
                    helper = MSG_HINT + " - Ctrl+Space";
                    helperGroup.controls.push( {
                        type: "BUTTON",
                        title: helper,
                        label: helper,
                        iconOnly: true,
                        icon: "icon-cm-autocomplete",
                        action: "code-complete"
                    } );
                }

                if( o.validateCode ) {
                    helper = MSG_VALIDATE + " - Ctrl+Alt+V";
                    helperGroup.controls.push( {
                        type: "BUTTON",
                        title: helper,
                        label: helper,
                        iconOnly: true,
                        icon: "icon-cm-validate",
                        action: "validate"
                    } );
                }

                config.data.push( helperGroup );
            }

            config.data.push( {
                id: "menuControls",
                align: "end",
                groupTogether: false,
                controls: [ {
                    type: "MENU",
                    title: MSG_SETTINGS,
                    label: MSG_SETTINGS,
                    iconOnly: true,
                    icon: "icon-gear",
                    menu: {
                        items: [ /*{
                            type: "subMenu",
                            label: "Language Settings", // TODO localize
                            menu: {
                                items: [ {
                                    type: "subMenu",
                                    label: "JavaScript",
                                    menu: {
                                        items: [ {
                                            type: "toggle",
                                            action: "semantic-highlighting"
                                        }, {
                                            type: "toggle",
                                            action: "inlay-hints"
                                        } ]
                                    }
                                } ]
                            }
                        },*/ {
                                type: "subMenu",
                                label: MSG_INDENTATION,
                                menu: {
                                    items: [ {
                                        type: "toggle",
                                        action: "tabs-insert-spaces"
                                    }, {
                                        type: "subMenu",
                                        label: MSG_TAB_SIZE,
                                        menu: {
                                            items: [ {
                                                type: "radioGroup",
                                                action: "tab-size"
                                            } ]
                                        }
                                    }, {
                                        type: "subMenu",
                                        label: MSG_INDENT_SIZE,
                                        menu: {
                                            items: [ {
                                                type: "radioGroup",
                                                action: "indent-size"
                                            } ]
                                        }
                                    }
                                    ]
                                }
                            }, {
                                type: "subMenu",
                                label: MSG_THEMES,
                                menu: {
                                    items: [ {
                                        type: "radioGroup",
                                        action: "theme"
                                    } ]
                                }
                            }, {
                                type: "subMenu",
                                label: MSG_MINIMAP,
                                menu: {
                                    items: [ {
                                        type: "radioGroup",
                                        action: "minimap"
                                    } ]
                                }
                            }, {
                                type: "toggle",
                                action: "accessibility-mode"
                            }, {
                                type: "toggle",
                                action: "line-numbers"
                            }, {
                                type: "toggle",
                                action: "show-ruler"
                            }, {
                                type: "toggle",
                                action: "show-suggestions"
                            }, {
                                type: "toggle",
                                action: "whitespace"
                            }, {
                                type: "toggle",
                                action: "bracket-pair-colorization"
                            } ]
                    }
                } ]
            } );

            container$.toolbar( config );
        },

        // should be called on widget initialization and whenever the language changes
        // the language should not be sanatized. ie. we expect the mle- prefix in the case of mle-javascript
        _evaluateContextKeys: function( language ) {

            const keys = this._contextKeys,
                editor = this._editor;

            if( !keys[ CONTEXT_KEY_ISSQL ] ) {
                // dummy assignment
                keys[ CONTEXT_KEY_ISSQL ] = editor.createContextKey( CONTEXT_KEY_ISSQL, true );
            }
            if( !keys[ CONTEXT_KEY_DBHINT ] ) {
                // dummy assignment
                keys[ CONTEXT_KEY_DBHINT ] = editor.createContextKey( CONTEXT_KEY_DBHINT, true );
            }

            keys[ CONTEXT_KEY_ISSQL ].set( language === LANG_SQL );
            keys[ CONTEXT_KEY_DBHINT ].set( [ LANG_SQL, LANG_MLE_JAVASCRIPT ].includes( language ) );
        },

        _setLanguage: function( language ) {
            let self = this,
                model = self._model,
                o = self.options,
                context = self._context;

            // remove any error messages
            monaco.editor.setModelMarkers( model, "lineMessages", [] );
            self.resetNotification();

            // reconfigure editor specific suggestions
            self._configureCustomSuggestionProvider();

            function hide ( actionName ) {
                if( context.lookup( actionName ) ) {
                    context.hide( actionName );
                }
            }
            function show ( actionName ) {
                if( context.lookup( actionName ) ) {
                    context.show( actionName );
                }
            }

            if( [ LANG_SQL, LANG_MLE_JAVASCRIPT ].includes( language ) ) {
                show( "code-complete" );
            } else {
                hide( "code-complete" );
            }

            if( language === LANG_SQL ) {
                show( "validate" );
                show( "query-builder" );
            } else {
                hide( "validate" );
                hide( "query-builder" );
            }

            self._evaluateContextKeys( language );

            loadLanguageDependencies( language, o );

            monaco.editor.setModelLanguage( model, language.replace( "mle-", "" ) );
        },

        /*
         * Add warnings to page item references which don't exist
         * This only takes into account page items of the current page and the global page
         * as these are the only ones we currently know about
         * We assume the conventional Pnnn_[alphanum_]* name types
         */
        _initializeItemValidator: function() {
            let self = this,
                model = self._model,
                o = self.options,
                pageId = o.pageInfo.pageId,
                itemRegex = new RegExp( "P(" + pageId + "|0)_[A-Z0-9_]*", "gi" ),
                warnings = [];

            let pageItems = o.pageInfo.items.map( item => item.name.toLowerCase() );

            let verify = util.debounce( function() {
                warnings = [];
                // always check if the model still exists as we work with debounced functions
                // which might fire after the editor was closed
                if( model && !model.isDisposed() ) {
                    // loop through each line
                    const lineCount = model.getLineCount();

                    for( let lineNumber = 1; lineNumber <= lineCount; lineNumber++ ) {
                        const lineContent = model.getLineContent( lineNumber );
                        const matches = lineContent.matchAll( itemRegex );

                        for( let match of matches ) {
                            let foundItem = match[ 0 ].toLowerCase(),
                                itemFoundAt = match.index + 1; // adjusting for 1-based index

                            if( !pageItems.includes( foundItem ) ) {
                                warnings.push( {
                                    startLineNumber: lineNumber,
                                    endLineNumber: lineNumber,
                                    startColumn: itemFoundAt,
                                    endColumn: itemFoundAt + foundItem.length,
                                    message: lang.formatMessage( "CODE_EDITOR.ITEM_DOES_NOT_EXIST", foundItem.toUpperCase() ),
                                    severity: monaco.MarkerSeverity.Warning
                                } );
                            }
                        }
                    }
                    monaco.editor.setModelMarkers( model, "itemValidations", warnings );
                }
            }, 100 );

            // validating whenever the editor changed content, but debounced at 100 ms
            model.onDidChangeContent( verify );

            // valiadating on editor load as well
            verify();
        },

        /*
         * Configuration of various shortcuts and extra editor actions
         */
        _initializeCustomActions: function() {
            let self = this,
                editor = self._editor,
                model = self._model,
                universalCtrlKey = getUniversalCtrlKey();

            // adds a keybinding to a specific action
            // see https://github.com/microsoft/monaco-editor/issues/102 for more
            // there is no official API to do this, so we add another action with the same id and info
            // the new action+keybinding will appear in the Command Palette
            // but if the old action had a keybinding itself, it will still work
            function overrideActionKeybinding ( actionId, newKeyBinding ) {
                let action = editor.getAction( actionId );
                editor.addAction( {
                    id: actionId,
                    label: action.label,
                    alias: action.alias,
                    keybindings: [ newKeyBinding ],
                    run: function() {
                        action.run();
                    }
                } );
            }

            // overriding the keybindings of the Transform to Upper/Lower actions
            overrideActionKeybinding( "editor.action.transformToUppercase", universalCtrlKey | monaco.KeyMod.Alt | monaco.KeyCode.KeyU );
            overrideActionKeybinding( "editor.action.transformToLowercase", universalCtrlKey | monaco.KeyMod.Alt | monaco.KeyCode.KeyL );

            editor.addAction( {
                id: "editor.action.toggleSmartCase",
                label: MSG_TRANSFORM_CODE_CASE,
                alias: MSG_TRANSFORM_CODE_CASE,
                keybindings: [ universalCtrlKey | monaco.KeyMod.Alt | monaco.KeyCode.KeyC ],
                run: function() {
                    // adapted from linesOperators.ts AbstractCaseAction
                    let selections = editor.getSelections();
                    if( !selections.length ) {
                        return;
                    }
                    if( !model ) {
                        return;
                    }

                    let edits = [];

                    for( let i = 0; i < selections.length; i++ ) {
                        let selection = selections[ i ];
                        if( !selection.isEmpty() ) {
                            let text = model.getValueInRange( selection );
                            let transformedText = transformCodeCase( text );
                            edits.push( {
                                range: selection,
                                text: transformedText
                            } );
                        }
                    }

                    editor.pushUndoStop();
                    editor.executeEdits( null, edits );
                    editor.pushUndoStop();
                }
            } );

            // By default, the Command Palette is opened by hitting the F1 key
            // Also adding the CTRL/CMD+Shift+P shortcut to match VS Code
            // Intentionally not using universalCtrlKey here
            editor.addCommand( monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyP, () => {
                self._triggerMonacoAction( "editor.action.quickCommand" );
            } );
        }

    } );

    $.apex.codeEditor = $.apex.codeEditor || {};
    $.apex.codeEditor.LANG_JAVASCRIPT = LANG_JAVASCRIPT;
    $.apex.codeEditor.LANG_MLE_JAVASCRIPT = LANG_MLE_JAVASCRIPT;
    $.apex.codeEditor.registerClientSideJsContextCode = CONTEXT_JS_CODE_MANAGER.setContext;
    $.apex.codeEditor.deregisterClientSideJsContextCode = CONTEXT_JS_CODE_MANAGER.dropContext;
    $.apex.codeEditor.preferencesObjectFromString = function( optionsString ) {
        let rawOptions,
            finalOptions = {};

        if( !optionsString ) {
            return {};
        }

        try {
            rawOptions = JSON.parse( optionsString );
        } catch( e ) {
            debug.warn( "Code Editor: could not parse optionsString" );
            return {};
        }

        Object.values( PREF ).forEach( item => {
            let value = rawOptions[ item ],
                key = item;

            if( key === PREF.THEME ) {
                if( !OPTIONS_THEME.map( option => option.value ).includes( value ) ) {
                    debug.warn( "Code Editor: Bad theme ignored: " + value );
                    return;
                }
            } else if( [ PREF.INDENT_SIZE, PREF.TAB_SIZE ].includes( key ) ) {
                if( ![ "2", "3", "4", "8" ].includes( value ) ) {
                    debug.warn( "Code Editor: Bad number ignored: " + value );
                    return;
                }
            } else if( key === "minimap" ) {
                if( !OPTIONS_MINIMAP.map( option => option.value ).includes( value ) ) {
                    debug.warn( "Code Editor: Bad minimap ignored: " + value );
                    return;
                }
            } else if( [
                // boolean preferences
                PREF.TABS_INSERT_SPACES,
                PREF.RULER,
                PREF.ACCESSIBILITY_MODE,
                PREF.LINE_NUMBERS,
                PREF.WHITESPACE,
                PREF.SHOW_SUGGESTIONS,
                PREF.BRACKET_PAIR_COLORIZATION /*,
                PREF.SEMANTIC_HIGHLIGHTING,
                PREF.INLAY_HINTS */ ].includes( key )
            ) {
                value = !!value;
            } else {
                debug.warn( "Code Editor: Unknown preference: " + key );
                return;
            }

            finalOptions[ key ] = value;
        } );

        return finalOptions;
    };

} )( apex.jQuery, apex.util, apex.lang, apex.locale, apex.debug, apex.actions, apex.server, apex.env );