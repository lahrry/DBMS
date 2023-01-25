/*
 * Oracle APEX, Release 20.1
 * Copyright (c) 2012, 2021, Oracle and/or its affiliates. All rights reserved.
 */
/**
 * @namespace
 *
 * @desc
 * <p>The {@link apex}.session namespace contains all functions related to APEX session management.</p>
 * 
 * // todo: Consider async loading, or emitting on page load with timeout info
 */
apex.session = {};

(function( session, message, navigation, lang, debug, $, env ) {
    "use strict";

    var gWarningSeconds, gMaxIdleUrl, gMaxSessionUrl, gIdleWarningTimeoutId, gIdleExpiredTimeoutId, 
        gMaxWarningTimeoutId, gMaxExpiredTimeoutId,
        cAlertDialogID = "apex_session_alert_dlg";  

    // remove the session alert dialog
    function _removeAlertDialog() {
        $( "#" + cAlertDialogID ).remove();
    }

    function _showTimeoutAlert( pMessage, pOptions ) {
        var lOptions = $.extend( {
                id:      cAlertDialogID,
                confirm: true
        }, pOptions );

        // Remove any previous alerts displayed
        _removeAlertDialog();

        return message.showDialog( pMessage, lOptions );
    }

    function _clearIdleTimeouts() {
        if ( gIdleWarningTimeoutId ) {
            clearTimeout( gIdleWarningTimeoutId ); 
            debug.info( "Idle session warning timer cleared. ID=" + gIdleWarningTimeoutId );
        } 
        if ( gIdleExpiredTimeoutId ) {
            clearTimeout( gIdleExpiredTimeoutId );
            debug.info( "Idle session expired timer cleared. ID=" + gIdleExpiredTimeoutId );
        }
    }

    function _clearMaxTimeouts() {
        if ( gMaxWarningTimeoutId ) {
            clearTimeout( gMaxWarningTimeoutId ); 
            debug.info( "Max session warning timer cleared. ID=" + gMaxWarningTimeoutId );
        } 
        if ( gMaxExpiredTimeoutId ) {
            clearTimeout( gMaxExpiredTimeoutId );
            debug.info( "Max session expired timer cleared. ID=" + gMaxExpiredTimeoutId );
        }
    }

    // calculates expiry time by adding session warning time to the current time
    function _getExpiryTime( pTimeoutData ) {
        var lExpiryTime,
            lCurrentTime = new Date(),
            lLifeTimeSeconds = pTimeoutData.life_time_ms / 1000,
            lOffsetSeconds = ( gWarningSeconds < lLifeTimeSeconds ? gWarningSeconds : lLifeTimeSeconds );
        
        lCurrentTime.setSeconds( lCurrentTime.getSeconds() + lOffsetSeconds );
        lExpiryTime = lCurrentTime.toLocaleTimeString( undefined, {
            timeStyle: "medium"
        });

        return lExpiryTime;
    }

    function _setupIdleTimeouts( pOriginalTimeoutData ) {

        // First lets clear any previous idle timeouts
        _clearIdleTimeouts();

        // Remove any previous alerts displayed
        _removeAlertDialog();

        // Idle warning timeout, takes idle time minus idle warning time
        gIdleWarningTimeoutId = setTimeout( function() {
            
            // call server to check idle time is still accurate
            session.getTimeouts( function( pNewTimeoutData ) {

                debug.info( "Is session idle time still valid?", pNewTimeoutData );

                // If new timeout data idle time is still less than idle warning time, the proceed with the warning
                // Note: -1 ms from idle time avoids making multiple calls when idle time and warning time are exactly the same
                if ( ( pNewTimeoutData.idle_time_ms - 1 ) < ( gWarningSeconds * 1000 ) ) {
                    debug.info( "...Yes, show warning." );

                    //todo add a warning icon?
                    _showTimeoutAlert( lang.formatMessage( "APEX.SESSION.ALERT.IDLE_WARN", _getExpiryTime( pNewTimeoutData ) ), {
                        okLabelKey: "APEX.SESSION.ALERT.EXTEND",
                        callback:   function( extendPressed ) {
                            if ( extendPressed ) {
                                
                                // get new session timeouts and pass true to reset idle time
                                session.getTimeouts( function( pNewTimeoutData ) {
                                    debug.info( "Session extended", pNewTimeoutData );
                                    _setupIdleTimeouts( pNewTimeoutData );
                                }, true );
                            }
                        }
                    });

                } else {
                    debug.info( "...No, reset idle timers to new values." );
                    _setupIdleTimeouts( pNewTimeoutData );
                }
            });
        }, pOriginalTimeoutData.idle_time_ms - ( gWarningSeconds * 1000 ) );

        // Idle expired timeout
        gIdleExpiredTimeoutId = setTimeout( function() {
            
            //call server to check session has expired
            session.getTimeouts( function( pNewTimeoutData ) {
                debug.info("Is session idle expired time still valid?", pNewTimeoutData );

                if ( pNewTimeoutData.idle_time_ms === 0 ) {
                    debug.info("...Yes, show expired alert.");

                    // Clear any max timeouts, no longer relevant as session has already expired
                    _clearMaxTimeouts();

                    _showTimeoutAlert( lang.getMessage( "APEX.SESSION.ALERT.EXPIRED" ), {
                        okLabelKey: "APEX.SESSION.ALERT.CREATE_NEW",
                        callback:   function( okPressed ) {
                            if ( okPressed ) {
                                navigation.redirect ( gMaxIdleUrl );
                            }
                        }
                    });
                } else {
                    debug.info( "...No, reset idle timers to new values." );
                    
                    _setupIdleTimeouts( pNewTimeoutData );
                }
            });
        }, pOriginalTimeoutData.idle_time_ms );

        debug.info( "Idle session warning timer started for " + ( ( pOriginalTimeoutData.idle_time_ms / 1000 ) - gWarningSeconds ) + " seconds. ID=" + gIdleWarningTimeoutId );
        debug.info( "Idle session expired timer started for " + ( pOriginalTimeoutData.idle_time_ms / 1000 ) + " seconds. ID=" + gIdleExpiredTimeoutId );
    }

    function _setupMaxTimeouts( pOriginalTimeoutData ) {

        // Max warning timeout, takes idle time minus idle warning time
        gMaxWarningTimeoutId = setTimeout( function() {
            debug.info( "Session max time about to expire, show warning." );

            // When we are warning about max timeout, idle time is no longer relevant (can't be extended), so let's cancel the idle timeouts...
            _clearIdleTimeouts();

            _showTimeoutAlert( lang.formatMessage( "APEX.SESSION.ALERT.MAX_WARN", _getExpiryTime( pOriginalTimeoutData ) ), {
                confirm: false       // For max time, this cannot be extended, so we just show an 'OK' button
            } );

        }, pOriginalTimeoutData.life_time_ms - ( gWarningSeconds * 1000 ) );

        // Max expired timeout
        gMaxExpiredTimeoutId = setTimeout( function() {
            debug.info( "Session max time expired, show expired alert." );

            _showTimeoutAlert( lang.getMessage( "APEX.SESSION.ALERT.EXPIRED" ), {
                okLabelKey: "APEX.SESSION.ALERT.CREATE_NEW",
                callback:   function( okPressed ) {
                    if ( okPressed ) {
                        navigation.redirect ( gMaxSessionUrl );
                    }
                }
            });
        }, pOriginalTimeoutData.life_time_ms );        

        debug.info( "Max session warning timer started for " + ( ( pOriginalTimeoutData.life_time_ms / 1000 ) - gWarningSeconds ) + " seconds. ID=" + gMaxWarningTimeoutId );
        debug.info( "Max session expired timer started for " + ( pOriginalTimeoutData.life_time_ms / 1000 ) + " seconds. ID=" + gMaxExpiredTimeoutId );     
    }


    /*
     * todo doc
     */
    session.getTimeouts = function( pSuccess, pResetIdle ) {
        $.get( {
            url:        "apex_session.emit_timeouts?" +
                            "p_app_id=" + env.APP_ID + "&" +
                            "p_session_id=" + env.APP_SESSION + "&" +
                            "p_reset_idle=" + ( pResetIdle ? "Y" : "N" ),
            dataType:   "json",
            success:    pSuccess,
            error: function( jqXHR, textStatus, errorThrown ) {
                debug.error( "Error occurred when making session.getTimeouts Ajax call.", jqXHR, textStatus, errorThrown );
            }
        });
    };

    /*
     * todo doc
     */
    session.initTimeouts = function( pWarningSeconds, pTimeoutData, pMaxIdleUrl, pMaxSessionUrl ) {
        gWarningSeconds = pWarningSeconds;
        gMaxIdleUrl = pMaxIdleUrl;
        gMaxSessionUrl = pMaxSessionUrl;

        // If 0 is defined for this in instance settings, timeout / alert functionality is switched off
        if ( gWarningSeconds > 0 ) {

            // Check in case instance warning time is greater than max idle time (unlikely, but possible). Raise JS error in this case, as 
            // this is an invalid metadata state
            if ( gWarningSeconds > ( pTimeoutData.max_idle_time_ms / 1000 ) ) {
                debug.warn( "Invalid metadata state. Session timeout warning time (" + gWarningSeconds + " seconds) " +
                             "cannot be greater than the maximum session idle time (" + ( pTimeoutData.max_idle_time_ms / 1000 ) + " seconds)." );
            } else {
                _setupIdleTimeouts( pTimeoutData );
                _setupMaxTimeouts( pTimeoutData );
            }            
        }
    };

    /*
     * Internal debugging function that allows testing the alerts. Use for development / testing purposes, leave commented out for production purposes.
     * You can recreate the 3 variations of the alerts with the following calls:
     *   - Maximum timeout warning: apex.session.debugTimeoutAlert(apex.lang.formatMessage( "APEX.SESSION.ALERT.MAX_WARN", "12:00" ), {confirm:false});
     *   - Idle timeout warning:    apex.session.debugTimeoutAlert(apex.lang.formatMessage( "APEX.SESSION.ALERT.IDLE_WARN", "12:00" ), {okLabelKey: "APEX.SESSION.ALERT.EXTEND" } );
     *   - Expired alert:           apex.session.debugTimeoutAlert(apex.lang.formatMessage( "APEX.SESSION.ALERT.EXPIRED" ), {okLabelKey: "APEX.SESSION.ALERT.CREATE_NEW" });
     */
    //session.debugTimeoutAlert = _showTimeoutAlert;

})(apex.session, apex.message, apex.navigation, apex.lang, apex.debug, apex.jQuery, apex.env);
