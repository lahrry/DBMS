/*!
 * Copyright (c) 2013, 2022, Oracle and/or its affiliates.
 */
/**
 * Require JS configuration
 */
/* global requirejs define */
( function( env, libVersions ) {
    "use strict";

    const dbg = !!$v( "pdebug" );
    const
        versionJet = libVersions.oraclejet,
        versionJquery = libVersions.jquery,
        versionJqueryUi = libVersions.jqueryUi,
        versionHammer = libVersions.hammer;

    define( "jquery",                        [], () => apex.jQuery );
    define( "hammerjs",                      [], () => window.Hammer );
    define( "jqueryui-amd/widget",           [], () => apex.jQuery.widget );
    define( "jqueryui-amd/focusable",        [], () => apex.jQuery.ui.focusable );
    define( "jqueryui-amd/widgets/draggable",[], () => apex.jQuery.ui.draggable );
    define( "jqueryui-amd/widgets/sortable", [], () => apex.jQuery.ui.sortable );
    define( "jqueryui-amd/widgets/mouse",    [], () => apex.jQuery.ui.mouse );
    define( "jqueryui-amd/plugin",           [], () => apex.jQuery.ui.plugin );
    define( "jqueryui-amd/position",         [], () => apex.jQuery.ui.position );
    define( "jqueryui-amd/keycode",          [], () => apex.jQuery.ui.keyCode );
    define( "jqueryui-amd/unique-id",        [], () => apex.jQuery.fn );
    define( "jqueryui-amd/tabbable",         [], () => {
        return {
            tabbable: () => {
                apex.debug.info("Unexpected call: jQuery UI tabbable function");
            }
        };
    } );

    requirejs.config({

        // Path mappings for the logical module names
        baseUrl: env.APEX_FILES + "libraries/",
        paths: {
            "ojs":                  `./oraclejet/${ versionJet }/js/libs/oj/v${ versionJet }/` + ( dbg ? "debug" : "min" ),
            "ojL10n":               `./oraclejet/${ versionJet }/js/libs/oj/v${ versionJet }/ojL10n`,
            "ojtranslations":       `./oraclejet/${ versionJet }/js/libs/oj/v${ versionJet }/resources`,
            "knockout":             `./oraclejet/${ versionJet }/js/libs/knockout/knockout-3.5.1`,
            "jquery":               `./jquery/${ versionJquery }/jquery-${ versionJquery }.min`,
            "jqueryui-amd":         `./jquery-ui/${ versionJqueryUi }/jquery-ui-apex.min`,
            "text":                 `./oraclejet/${ versionJet }/js/libs/require/text`,
            "hammerjs":             `./hammer/${ versionHammer }/hammer-${ versionHammer }.min`,
            "signals":              `./oraclejet/${ versionJet }/js/libs/js-signals/signals.min`,
            "ojdnd":                `./oraclejet/${ versionJet }/js/libs/dnd-polyfill/dnd-polyfill-1.0.2.min`,
            "css":                  `./oraclejet/${ versionJet }/js/libs/require-css/css.min`,
            "css-builder":          `./oraclejet/${ versionJet }/js/libs/require-css/css-builder`,
            "normalize":            `./oraclejet/${ versionJet }/js/libs/require-css/normalize`,
            "preact":               `./oraclejet/${ versionJet }/js/libs/preact/dist/preact.umd`,
            "preact/hooks":         `./oraclejet/${ versionJet }/js/libs/preact/hooks/dist/hooks.umd`,
            "preact/compat":        `./oraclejet/${ versionJet }/js/libs/preact/compat/dist/compat.umd`,
            "proj4":                `./oraclejet/${ versionJet }/js/libs/proj4js/dist/proj4`,
            "touchr":               `./oraclejet/${ versionJet }/js/libs/touchr/touchr`
        },

        // Shim configurations for modules that do not expose AMD
        shim: {
            "jquery": {
                exports: [ "jQuery", "$" ]
            }
        },

        // This section configures the i18n plugin. It is merging the Oracle JET built-in translation
        // resources with a custom translation file.
        // Any resource file added, must be placed under a directory named "nls". You can use a path mapping or you can define
        // a path that is relative to the location of this main.js file.
        config: {
            ojL10n: {
                merge: {
                    //"ojtranslations/nls/ojtranslations": "./oraclejet/3.0.0/js/libs/oj/v3.0.0/resources/nls/myTranslations"
                }
            },
            text: {
                // Override for the requirejs text plugin XHR call for loading text resources on CORS configured servers
                // eslint-disable-next-line no-unused-vars
                useXhr: function (url, protocol, hostname, port) {
                    // Override function for determining if XHR should be used.
                    // url: the URL being requested
                    // protocol: protocol of page text.js is running on
                    // hostname: hostname of page text.js is running on
                    // port: port of page text.js is running on
                    // Use protocol, hostname, and port to compare against the url being requested.
                    // Return true or false. true means "use xhr", false means "fetch the .js version of this resource".
                    return true;
                }
            }
        }
    });

})( apex.env, apex.libVersions );