/*!
 Copyright (c) 2012, 2021, Oracle and/or its affiliates. All rights reserved.
*/
/**
 * This namespace is used to store all event related functions of Oracle APEX.
 * @namespace
 **/
apex.event = {};

(function( event, $ ) {
    "use strict";

event.gCancelFlag = false;

/**
 * Function used to trigger events, return value defines if the event should be cancelled.
 *
 * @param {jQuery} pSelector            Selector for the element upon which the event will be triggered
 * @param {string} pEvent               The name of the event
 * @param {string|Array|Object} [pData] Optional additional parameters to pass along to the event handler
 *
 * @return {boolean} true if the event is cancelled.
 *
 * @example <caption>Example shows triggering an event called 'click', on an element using the jQuery selector
 * '#myLink' (matches an element with id='myLink'), passing an array of data.</caption>
 * lCancelEvent = apex.event.trigger('#myLink', 'click', ['apples','pears']);
 *
 * @function trigger
 * @memberOf apex.event
 **/
event.trigger = function( pSelector, pEvent, pData ) {

        // Default to false, event cancelling should only be done if an event handler says so
        // (by setting this flag to true).
        event.gCancelFlag = false;

        // Trigger event
        $( pSelector, apex.gPageContext$ ).trigger( pEvent, pData );

        // Return the value of gCancelFlag
        return event.gCancelFlag;
    };
})( apex.event, apex.jQuery);
