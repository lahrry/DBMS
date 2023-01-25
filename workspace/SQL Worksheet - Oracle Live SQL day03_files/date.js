/*!
 Copyright (c) 2022, Oracle and/or its affiliates. All rights reserved.
 */
/**
 * @namespace apex.date
 * @since 21.2
 * @desc
 * <p>The apex.date namespace contains Oracle APEX functions related to date operations.</p>
 */
apex.date = {};

( function ( date, locale, lang, debug ) {
    "use strict";

    /**
     * <p>Constants for the different date/time units used by apex.date functions.</p>
     *
     * @member {object} UNIT
     * @memberof apex.date
     * @property {string} MILLISECOND Constant to use for milliseconds
     * @property {string} SECOND Constant to use for seconds
     * @property {string} MINUTE Constant to use for minutes
     * @property {string} HOUR Constant to use for hours
     * @property {string} DAY Constant to use for days
     * @property {string} WEEK Constant to use for weeks
     * @property {string} MONTH Constant to use for months
     * @property {string} YEAR Constant to use for years
     *
     * @example <caption>apex.date.UNIT constant</caption>
     *
     * apex.date.UNIT = {
     *     MILLISECOND: "millisecond",
     *     SECOND: "second",
     *     MINUTE: "minute",
     *     HOUR: "hour",
     *     DAY: "day",
     *     WEEK: "week",
     *     MONTH: "month",
     *     YEAR: "year"
     * };
     *
     * @example <caption>Example usage</caption>
     *
     * apex.date.add( myDate, 2, apex.date.UNIT.DAY );
     * apex.date.add( myDate, 1, apex.date.UNIT.YEAR );
     * apex.date.subtract( myDate, 30, apex.date.UNIT.MINUTE );
     * apex.date.subtract( myDate, 6, apex.date.UNIT.HOUR );
     */
    date.UNIT = {
        MILLISECOND: "millisecond",
        SECOND: "second",
        MINUTE: "minute",
        HOUR: "hour",
        DAY: "day",
        WEEK: "week",
        MONTH: "month",
        YEAR: "year"
    };

    // helper function to prepare & normalize dates for some comparing functions
    function prepareCompareDate( pDate, pUnit ) {
        let localDate;

        if ( pUnit === date.UNIT.YEAR ) {
            localDate = new Date( pDate.getFullYear(), 0, 1, 0, 0, 0, 0 );
        } else if ( pUnit === date.UNIT.MONTH ) {
            localDate = new Date( pDate.getFullYear(), pDate.getMonth(), 1, 0, 0, 0, 0 );
        } else if ( pUnit === date.UNIT.WEEK ) {
            localDate = new Date( pDate.getFullYear(), pDate.getMonth(), pDate.getDate(), 0, 0, 0, 0 );
        } else if ( pUnit === date.UNIT.DAY ) {
            localDate = new Date( pDate.getFullYear(), pDate.getMonth(), pDate.getDate(), 0, 0, 0, 0 );
        } else if ( pUnit === date.UNIT.HOUR ) {
            localDate = new Date( pDate.getFullYear(), pDate.getMonth(), pDate.getDate(), pDate.getHours(), 0, 0, 0 );
        } else if ( pUnit === date.UNIT.MINUTE ) {
            localDate = new Date( pDate.getFullYear(), pDate.getMonth(), pDate.getDate(), pDate.getHours(), pDate.getMinutes(), 0, 0 );
        } else if ( pUnit === date.UNIT.SECOND ) {
            localDate = new Date( pDate.getFullYear(), pDate.getMonth(), pDate.getDate(), pDate.getHours(), pDate.getMinutes(), pDate.getSeconds(), 0 );
        } else if ( pUnit === date.UNIT.MILLISECOND ) {
            localDate = new Date( pDate.getFullYear(), pDate.getMonth(), pDate.getDate(), pDate.getHours(), pDate.getMinutes(), pDate.getSeconds(), pDate.getMilliseconds() );
        }

        return localDate;
    }

    /**
     * <p>Return true if a given object is a valid date object.</p>
     *
     * @function isValid
     * @memberof apex.date
     * @param {Date} pDate A date object
     * @return {boolean} is it a valid date
     *
     * @example <caption>Returns if a date object is valid.</caption>
     *
     * var isDateValid = apex.date.isValid( myDate );
     */
    date.isValid = function ( pDate ) {
        return pDate instanceof Date && !isNaN( pDate );
    };

    /**
     * <p>Return true if a given string can parse into a date object.
     * <em>Note: This could be browser specific dependent on the implementation of Date.parse.</em></p>
     * <p>Most browsers expect a string in ISO format (ISO 8601) and shorter versions of it, like "2021-06-15T14:30:00" or
     * "2021-06-15T14:30" or "2021-06-15"</p>
     *
     * @function isValidString
     * @memberof apex.date
     * @param {string} pDateString A date string
     * @return {boolean} is it a valid date
     *
     * @example <caption>Returns if a date string is valid.</caption>
     *
     * var isDateValid = apex.date.isValidString( "2021-06-29 15:30" );
     */
    date.isValidString = function ( pDateString ) {
        return !isNaN( Date.parse( pDateString ) );
    };

    /**
     * <p>Return the cloned instance of a given date object.
     * This is useful when you want to do actions on a date object without altering the original object.
     * If <em>pDate</em> is not provided it uses the current date & time.</p>
     *
     * @function clone
     * @memberof apex.date
     * @param {Date} pDate A date object
     * @return {Date} The cloned date object
     *
     * @example <caption>Returns the clone of a given date object.</caption>
     *
     * var myDate = new Date();
     * var clonedDate = apex.date.clone( myDate );
     */
    date.clone = function ( pDate ) {
        return new Date( pDate.getTime() );
    };

    /**
     * <p>Add a certain amount of time to an existing date.
     * This function returns the modified date object as well as altering the original object.
     * If the given date object should not be manipulated use {@link apex.date.clone} before calling this function.
     * If <em>pDate</em> is not provided it uses the current date & time.</p>
     *
     * @function add
     * @memberof apex.date
     * @param {Date} [pDate=new Date()] A date object
     * @param {number} pAmount The amount to add
     * @param {string} [pUnit=apex.date.UNIT.MILLISECOND] The unit to use - apex.date.UNIT constant
     * @return {Date} The modified date object
     *
     * @example <caption>Returns the modified date object.</caption>
     *
     * var myDate = new Date( "2021-06-20" );
     * myDate = apex.date.add( myDate, 2, apex.date.UNIT.DAY );
     * // myDate is now "2021-06-21"
     */
    date.add = function ( pDate, pAmount, pUnit ) {
        let localDate = pDate || new Date();

        function addMonths( pDate, pAmount ) {
            let day = pDate.getDate();
            pDate.setMonth( pDate.getMonth() + pAmount );
            if ( pDate.getDate() !== day ) {
                pDate.setDate( 0 );
            }
            return pDate;
        }

        if ( pUnit === date.UNIT.YEAR ) {
            localDate.setFullYear( localDate.getFullYear() + pAmount );
        } else if ( pUnit === date.UNIT.MONTH ) {
            localDate = addMonths( localDate, pAmount );
        } else if ( pUnit === date.UNIT.WEEK ) {
            localDate.setDate( localDate.getDate() + 7 * pAmount );
        } else if ( pUnit === date.UNIT.DAY ) {
            localDate.setDate( localDate.getDate() + pAmount );
        } else if ( pUnit === date.UNIT.HOUR ) {
            localDate.setHours( localDate.getHours() + pAmount );
        } else if ( pUnit === date.UNIT.MINUTE ) {
            localDate.setTime( localDate.getTime() + 1000 * 60 * pAmount );
        } else if ( pUnit === date.UNIT.SECOND ) {
            localDate.setTime( localDate.getTime() + 1000 * pAmount );
        } else if ( pUnit === date.UNIT.MILLISECOND ) {
            localDate.setTime( localDate.getTime() + pAmount );
        }

        return localDate;
    };

    /**
     * <p>Subtract a certain amount of time of an existing date.
     * This function returns the modified date object as well as altering the original object.
     * If the given date object should not be manipulated use {@link apex.date.clone} before calling this function.
     * If <em>pDate</em> is not provided it uses the current date & time.</p>
     *
     * @function subtract
     * @memberof apex.date
     * @param {Date} [pDate=new Date()] A date object
     * @param {number} pAmount The amount to subtract
     * @param {string} [pUnit=apex.date.UNIT.MILLISECOND] The unit to use - apex.date.UNIT constant
     * @return {Date} The modified date object
     *
     * @example <caption>Returns the modified date object.</caption>
     *
     * var myDate = new Date( "2021-06-20" )
     * myDate = apex.date.subtract( myDate, 2, apex.date.UNIT.DAY );
     * // myDate is now "2021-06-19"
     */
    date.subtract = function ( pDate, pAmount, pUnit ) {
        let localDate = pDate || new Date();

        localDate = date.add( localDate, -pAmount, pUnit );

        return localDate;
    };

    /**
     * <p>Return the ISO-8601 week number of the year of a given date object.
     * If <em>pDate</em> is not provided it uses the current date & time.</p>
     *
     * @function ISOWeek
     * @memberof apex.date
     * @param {Date} [pDate=new Date()] A date object
     * @return {number} The week number
     *
     * @example <caption>Returns the ISO-8601 week number.</caption>
     *
     * var weekNumber = apex.date.ISOWeek( myDate );
     */
    date.ISOWeek = function ( pDate ) {
        let localDate = date.clone( pDate || new Date() ),
            dayn = ( localDate.getDay() + 6 ) % 7,
            firstThursday;

        localDate.setDate( localDate.getDate() - dayn + 3 );
        firstThursday = localDate.valueOf();
        localDate.setMonth( 0, 1 );

        if ( localDate.getDay() !== 4 ) {
            localDate.setMonth( 0, 1 + ( ( 4 - localDate.getDay() + 7 ) % 7 ) );
        }

        return 1 + Math.ceil( ( firstThursday - localDate ) / 604800000 );
    };

    /**
     * <p>Return the week number of a month of a given date object.
     * If <em>pDate</em> is not provided it uses the current date & time.</p>
     *
     * @function weekOfMonth
     * @memberof apex.date
     * @param {Date} [pDate=new Date()] A date object
     * @return {number} The week number
     *
     * @example <caption>Returns the week number of given month.</caption>
     *
     * var weekNumber = apex.date.weekOfMonth( myDate );
     */
    date.weekOfMonth = function ( pDate ) {
        let localDate = date.clone( pDate || new Date() );

        localDate.setDate( localDate.getDate() - localDate.getDay() + 1 );

        return Math.ceil( localDate.getDate() / 7 );
    };

    /**
     * <p>Return the day count of a month of a given date object.
     * If <em>pDate</em> is not provided it uses the current date & time.</p>
     *
     * @function daysInMonth
     * @memberof apex.date
     * @param {Date} [pDate=new Date()] A date object
     * @return {number} The days count
     *
     * @example <caption>Returns the day count of given month.</caption>
     *
     * var dayCount = apex.date.daysInMonth( myDate );
     */
    date.daysInMonth = function ( pDate ) {
        let localDate = pDate || new Date();

        return new Date( localDate.getFullYear(), localDate.getMonth() + 1, 0 ).getDate();
    };

    /**
     * <p>Return the day number of week of a given date object.
     * If <em>pDate</em> is not provided it uses the current date & time.</p>
     *
     * @function dayOfWeek
     * @memberof apex.date
     * @param {Date} [pDate=new Date()] A date object
     * @return {number} The day number
     *
     * @example <caption>Returns the day number of given week.</caption>
     *
     * var weekDay = apex.date.dayOfWeek( myDate );
     */
    date.dayOfWeek = function ( pDate ) {
        let localDate = pDate || new Date();

        return localDate.getDay() === 0 ? 7 : localDate.getDay();
    };

    /**
     * <p>Return the day number of a year of a given date object.
     * If <em>pDate</em> is not provided it uses the current date & time.</p>
     *
     * @function getDayOfYear
     * @memberof apex.date
     * @param {Date} [pDate=new Date()] A date object
     * @return {number} The day number
     *
     * @example <caption>Returns the day number of given year.</caption>
     *
     * var dayNumber = apex.date.getDayOfYear( myDate );
     */
    date.getDayOfYear = function ( pDate ) {
        let localDate = pDate || new Date(),
            start = new Date( localDate.getFullYear(), 0, 0 ),
            diff = localDate - start,
            oneDay = 1000 * 60 * 60 * 24;

        return Math.floor( diff / oneDay );
    };

    /**
     * <p>Set the day number of a year of a given date object.
     * If the given date object should not be manipulated use {@link apex.date.clone} before calling this function.
     * If <em>pDate</em> is not provided it uses the current date & time.</p>
     *
     * @function setDayOfYear
     * @memberof apex.date
     * @param {Date} [pDate=new Date()] A date object
     * @param {number} pDay The day number
     * @return {Date} The date object
     *
     * @example <caption>Returns the date object.</caption>
     *
     * var myDate = new Date();
     * apex.date.setDayOfYear( myDate, 126 );
     */
    date.setDayOfYear = function ( pDate, pDay ) {
        let localDate = pDate || new Date();
        localDate.setMonth( 0, pDay );
    };

    /**
     * <p>Return the seconds past midnight of day of a given date object.</p>
     *
     * @function secondsPastMidnight
     * @memberof apex.date
     * @param {Date} [pDate=new Date()] A date object
     * @return {number} seconds past midnight
     *
     * @example <caption>Returns the seconds past midnight.</caption>
     *
     * var seconds = apex.date.secondsPastMidnight( myDate );
     */
    date.secondsPastMidnight = function ( pDate ) {
        let localDate = date.clone( pDate || new Date() );

        return Math.round( ( date.clone( localDate ) - localDate.setHours( 0, 0, 0, 0 ) ) / 1000, 0 );
    };

    /**
     * <p>Return a new date object for the first day a month of a given date object.
     * If <em>pDate</em> is not provided it uses the current date & time.</p>
     *
     * @function firstOfMonth
     * @memberof apex.date
     * @param {Date} [pDate=new Date()] A date object
     * @return {Date} The first day as date
     *
     * @example <caption>Returns the first day of a given month as date object.</caption>
     *
     * var firstDayDate = apex.date.firstOfMonth( myDate );
     * // output: "2021-JUN-01" (as date object)
     */
    date.firstOfMonth = function ( pDate ) {
        let localDate = pDate || new Date();

        return new Date( localDate.getFullYear(), localDate.getMonth(), 1 );
    };

    /**
     * <p>Return a new date object for the last day of a month of a given date object.
     * If <em>pDate</em> is not provided it uses the current date & time.</p>
     *
     * @function lastOfMonth
     * @memberof apex.date
     * @param {Date} [pDate=new Date()] A date object
     * @return {Date} The last day as date
     *
     * @example <caption>Returns the last day of a given month as date.</caption>
     *
     * var lastDayDate = apex.date.lastOfMonth( myDate );
     * // output: "2021-JUN-30" (as date object)
     */
    date.lastOfMonth = function ( pDate ) {
        let localDate = pDate || new Date();

        return new Date( localDate.getFullYear(), localDate.getMonth() + 1, 0 );
    };

    /**
     * <p>Return the start date of a day of a given date object.
     * If <em>pDate</em> is not provided it uses the current date & time.</p>
     *
     * @function startOfDay
     * @memberof apex.date
     * @param {Date} [pDate=new Date()] A date object
     * @return {Date} The start date of a day
     *
     * @example <caption>Returns the start date of a given day.</caption>
     *
     * var dayStartDate = apex.date.startOfDay( myDate );
     * // output: "2021-JUN-29 24:00:00" (as date object)
     */
    date.startOfDay = function ( pDate ) {
        let localDate = pDate || new Date();

        return new Date( localDate.getFullYear(), localDate.getMonth(), localDate.getDate(), 0, 0, 0, 0 );
    };

    /**
     * <p>Return the end date of a day of a given date object.
     * If <em>pDate</em> is not provided it uses the current date & time.</p>
     *
     * @function endOfDay
     * @memberof apex.date
     * @param {Date} [pDate=new Date()] A date object
     * @return {Date} The end date of a day
     *
     * @example <caption>Returns the end date of a given day.</caption>
     *
     * var dayEndDate = apex.date.endOfDay( myDate );
     * // output: "2021-JUN-29 23:59:59" (as date object)
     */
    date.endOfDay = function ( pDate ) {
        let localDate = pDate || new Date();

        return new Date( localDate.getFullYear(), localDate.getMonth(), localDate.getDate(), 23, 59, 59, 999 );
    };

    /**
     * <p>Return the count of months between 2 date objects.</p>
     *
     * @function monthsBetween
     * @memberof apex.date
     * @param {Date} pDate1 A date object
     * @param {Date} pDate2 A date object
     * @return {number} The month count
     *
     * @example <caption>Returns the count of months between 2 dates.</caption>
     *
     * var months = apex.date.monthsBetween( myDate1, myDate2 );
     */
    date.monthsBetween = function ( pDate1, pDate2 ) {
        let months;

        months = ( pDate2.getFullYear() - pDate1.getFullYear() ) * 12;
        months -= pDate1.getMonth();
        months += pDate2.getMonth();

        return Math.abs( months );
    };

    /**
     * <p>Return the minimum date of given date object arguments.
     * If <em>pDates</em> is not provided it uses the current date & time.</p>
     *
     * @function min
     * @memberof apex.date
     * @param {...date} [pDates=[new Date()]] Multiple date objects as arguments
     * @return {Date} The min date object
     *
     * @example <caption>Returns the minimum (most distant future) of the given date.</caption>
     *
     * var minDate = apex.date.min( myDate1, myDate2, myDate3 );
     */
    date.min = function ( ...pDates ) {
        let dateArray = pDates || [new Date()];

        return new Date( Math.min.apply( null, dateArray ) );
    };

    /**
     * <p>Return the maximum date of given date object arguments.
     * If <em>pDates</em> is not provided it uses the current date & time.</p>
     *
     * @function max
     * @memberof apex.date
     * @param {...date} [pDates=[new Date()]] Multiple date objects as arguments
     * @return {Date} The max date object
     *
     * @example <caption>Returns the maximum (most distant future) of the given date.</caption>
     *
     * var maxDate = apex.date.max( myDate1, myDate2, myDate3 );
     */
    date.max = function ( ...pDates ) {
        let dateArray = pDates || [new Date()];

        return new Date( Math.max.apply( null, dateArray ) );
    };

    /**
     * <p>Return true if the first date object is before the second date.
     * <em>pUnit</em> controls the precision of the comparison.</p>
     *
     * @function isBefore
     * @memberof apex.date
     * @param {Date} pDate1 A date object
     * @param {Date} pDate2 A date object
     * @param {string} [pUnit=apex.date.UNIT.MILLISECOND] The unit to use - apex.date.UNIT constant
     * @return {boolean} is the date before
     *
     * @example <caption>Returns if a date object is before another.</caption>
     *
     * var isDateBefore = apex.date.isBefore( myDate1, myDate2, apex.date.UNIT.SECOND );
     */
    date.isBefore = function ( pDate1, pDate2, pUnit ) {
        let bool = false,
            unit = pUnit || date.UNIT.MILLISECOND,
            localDate1 = prepareCompareDate( pDate1, unit ),
            localDate2 = prepareCompareDate( pDate2, unit );

        if ( unit === date.UNIT.MILLISECOND ) {
            bool = localDate1.getTime() < localDate2.getTime();
        } else {
            bool = localDate1 < date.add( date.subtract( localDate2, 1, unit ), 1, date.UNIT.MILLISECOND );
        }

        return bool;
    };

    /**
     * <p>Return true if the first date object is after the second date.
     * <em>pUnit</em> controls the precision of the comparison.</p>
     *
     * @function isAfter
     * @memberof apex.date
     * @param {Date} pDate1 A date object
     * @param {Date} pDate2 A date object
     * @param {string} [pUnit=apex.date.UNIT.MILLISECOND] The unit to use - apex.date.UNIT constant
     * @return {boolean} is the date after
     *
     * @example <caption>Returns if a date object is before another.</caption>
     *
     * var isDateAfter = apex.date.isAfter( myDate1, myDate2, apex.date.UNIT.SECOND );
     */
    date.isAfter = function ( pDate1, pDate2, pUnit ) {
        let bool = false,
            unit = pUnit || date.UNIT.MILLISECOND,
            localDate1 = prepareCompareDate( pDate1, unit ),
            localDate2 = prepareCompareDate( pDate2, unit );

        if ( unit === date.UNIT.MILLISECOND ) {
            bool = localDate1.getTime() > localDate2.getTime();
        } else {
            bool = localDate1 > date.subtract( date.add( localDate2, 1, unit ), 1, date.UNIT.MILLISECOND );
        }

        return bool;
    };

    /**
     * <p>Return true if the first date object is the same as the second date.
     * <em>pUnit</em> controls the precision of the comparison.</p>
     *
     * @function isSame
     * @memberof apex.date
     * @param {Date} pDate1 A date object
     * @param {Date} pDate2 A date object
     * @param {string} [pUnit=apex.date.UNIT.MILLISECOND] The unit to use - apex.date.UNIT constant
     * @return {boolean} is the date same
     *
     * @example <caption>Returns if a date object is the same as another.</caption>
     *
     * var isDateSame = apex.date.isSame( myDate1, myDate2, apex.date.UNIT.SECOND );
     */
    date.isSame = function ( pDate1, pDate2, pUnit ) {
        let bool = false,
            unit = pUnit || date.UNIT.MILLISECOND,
            localDate1 = prepareCompareDate( pDate1, unit ),
            localDate2 = prepareCompareDate( pDate2, unit );

        bool = localDate1.getTime() === localDate2.getTime();

        return bool;
    };

    /**
     * <p>Return true if the first date object is the same or before the second date.
     * <em>pUnit</em> controls the precision of the comparison.</p>
     *
     * @function isSameOrBefore
     * @memberof apex.date
     * @param {Date} pDate1 A date object
     * @param {Date} pDate2 A date object
     * @param {string} [pUnit=apex.date.UNIT.MILLISECOND] The unit to use - apex.date.UNIT constant
     * @return {boolean} is the date same/before
     *
     * @example <caption>Returns if a date object is the same or before another.</caption>
     *
     * var isDateSameBefore = apex.date.isSameOrBefore( myDate1, myDate2, apex.date.UNIT.SECOND );
     */
    date.isSameOrBefore = function ( pDate1, pDate2, pUnit ) {
        let bool = false,
            unit = pUnit || date.UNIT.MILLISECOND,
            localDate1 = prepareCompareDate( pDate1, unit ),
            localDate2 = prepareCompareDate( pDate2, unit );

        if ( unit === date.UNIT.MILLISECOND ) {
            bool = localDate1.getTime() <= localDate2.getTime();
        } else {
            bool = date.isSame( localDate1, localDate2 ) || localDate1 < date.add( date.subtract( localDate2, 1, unit ), 1, date.UNIT.MILLISECOND );
        }

        return bool;
    };

    /**
     * <p>Return true if the first date object is the same or after the second date.
     * <em>pUnit</em> controls the precision of the comparison.</p>
     *
     * @function isSameOrAfter
     * @memberof apex.date
     * @param {Date} pDate1 A date object
     * @param {Date} pDate2 A date object
     * @param {string} [pUnit=apex.date.UNIT.MILLISECOND] The unit to use - apex.date.UNIT constant
     * @return {boolean} is the date same/after
     *
     * @example <caption>Returns if a date object is the same or after another.</caption>
     *
     * var isDateSameAfter = apex.date.isSameOrAfter( myDate1, myDate2, apex.date.UNIT.SECOND );
     */
    date.isSameOrAfter = function ( pDate1, pDate2, pUnit ) {
        let bool = false,
            unit = pUnit || date.UNIT.MILLISECOND,
            localDate1 = prepareCompareDate( pDate1, unit ),
            localDate2 = prepareCompareDate( pDate2, unit );

        if ( unit === date.UNIT.MILLISECOND ) {
            bool = localDate1.getTime() >= localDate2.getTime();
        } else {
            bool = date.isSame( localDate1, localDate2 ) || localDate1 > date.subtract( date.add( localDate2, 1, unit ), 1, date.UNIT.MILLISECOND );
        }

        return bool;
    };

    /**
     * <p>Return true if the first date object is between the second date and the third date.
     * <em>pUnit</em> controls the precision of the comparison.</p>
     *
     * @function isBetween
     * @memberof apex.date
     * @param {Date} pDate1 A date object
     * @param {Date} pDate2 A date object
     * @param {Date} pDate3 A date object
     * @param {string} [pUnit=apex.date.UNIT.MILLISECOND] The unit to use - apex.date.UNIT constant
     * @return {boolean} is the date between
     *
     * @example <caption>Returns if a date object is between 2 another.</caption>
     *
     * var isDateBetween = apex.date.isBetween( myDate1, myDate2, myDate3, apex.date.UNIT.SECOND );
     */
    date.isBetween = function ( pDate1, pDate2, pDate3, pUnit ) {
        let bool = false,
            unit = pUnit || date.UNIT.MILLISECOND,
            localDate1 = prepareCompareDate( pDate1, unit ),
            localDate2 = prepareCompareDate( pDate2, unit ),
            localDate3 = prepareCompareDate( pDate3, unit );

        bool = localDate1 > localDate2 && localDate1 < localDate3;

        return bool;
    };

    /**
     * <p>Return true if a given date object is within a leap year.
     * If <em>pDate</em> is not provided it uses the current date & time.</p>
     *
     * @function isLeapYear
     * @memberof apex.date
     * @param {Date} [pDate=new Date()] A date object
     * @return {boolean} is a leap year
     *
     * @example <caption>Returns if it's a leap year for a given date.</caption>
     *
     * var isLeapYear = apex.date.isLeapYear( myDate );
     */
    date.isLeapYear = function ( pDate ) {
        let localDate = pDate || new Date();

        return new Date( localDate.getFullYear(), 1, 29 ).getDate() === 29;
    };

    /**
     * <p>Return the ISO format string (ISO 8601) without timezone information of a given date object.
     * If <em>pDate</em> is not provided it uses the current date & time.</p>
     *
     * @function toISOString
     * @memberof apex.date
     * @param {Date} [pDate=new Date()] A date object
     * @return {string} The formatted date string
     *
     * @example <caption>Returns date as ISO format string.</caption>
     *
     * var isoFormat = apex.date.toISOString( myDate );
     * // output: "2021-06-15T14:30:00"
     */
    date.toISOString = function ( pDate ) {
        let localDate = date.clone( pDate || new Date() );

        date.add( localDate, localDate.getTimezoneOffset() * -1, date.UNIT.MINUTE );

        return localDate.toISOString().split( "." )[0];
    };

    /**
     * <p>Return the relative date in words of a given date object
     * This is the client side counterpart of the PL/SQL function <em>APEX_UTIL.GET_SINCE</em>.
     * If <em>pDate</em> is not provided it uses the current date & time.</p>
     * @function since
     * @memberof apex.date
     * @param {string} [pDate=new Date()] A date object
     * @param {boolean} [pShort=false] Whether to return a short version of relative date
     * @return {string} The formatted date string
     *
     * @example <caption>Returns the relative date in words.</caption>
     *
     * var sinceString = apex.date.since( myDate );
     * // output: "2 days from now" or "30 minutes ago"
     *
     * var sinceString = apex.date.since( myDate, true );
     * // output: "In 1.1y" or "30m"
     */
    date.since = function ( pDate, pShort = false ) {
        let localDate = pDate || new Date(),
            now = new Date(),
            nowDateDifference = ( now - localDate ) / 1000,
            dateNowDifference = ( localDate - now ) / 1000,
            short = pShort,
            sinceText = "",
            formatMessage = lang.formatMessage,
            messages = {
                secondsAgo: short ? formatMessage( "APEX.SINCE.SHORT.SECONDS_AGO", "#time#" ) : formatMessage( "SINCE_SECONDS_AGO", "#time#" ),
                minutesAgo: short ? formatMessage( "APEX.SINCE.SHORT.MINUTES_AGO", "#time#" ) : formatMessage( "SINCE_MINUTES_AGO", "#time#" ),
                hoursAgo: short ? formatMessage( "APEX.SINCE.SHORT.HOURS_AGO", "#time#" ) : formatMessage( "SINCE_HOURS_AGO", "#time#" ),
                daysAgo: short ? formatMessage( "APEX.SINCE.SHORT.DAYS_AGO", "#time#" ) : formatMessage( "SINCE_DAYS_AGO", "#time#" ),
                weeksAgo: short ? formatMessage( "APEX.SINCE.SHORT.WEEKS_AGO", "#time#" ) : formatMessage( "SINCE_WEEKS_AGO", "#time#" ),
                monthsAgo: short ? formatMessage( "APEX.SINCE.SHORT.MONTHS_AGO", "#time#" ) : formatMessage( "SINCE_MONTHS_AGO", "#time#" ),
                yearsAgo: short ? formatMessage( "APEX.SINCE.SHORT.YEARS_AGO", "#time#" ) : formatMessage( "SINCE_YEARS_AGO", "#time#" ),
                secondsFromNow: short ? formatMessage( "APEX.SINCE.SHORT.SECONDS_FROM_NOW", "#time#" ) : formatMessage( "SINCE_SECONDS_FROM_NOW", "#time#" ),
                minutesFromNow: short ? formatMessage( "APEX.SINCE.SHORT.MINUTES_FROM_NOW", "#time#" ) : formatMessage( "SINCE_MINUTES_FROM_NOW", "#time#" ),
                hoursFromNow: short ? formatMessage( "APEX.SINCE.SHORT.HOURS_FROM_NOW", "#time#" ) : formatMessage( "SINCE_HOURS_FROM_NOW", "#time#" ),
                daysFromNow: short ? formatMessage( "APEX.SINCE.SHORT.DAYS_FROM_NOW", "#time#" ) : formatMessage( "SINCE_DAYS_FROM_NOW", "#time#" ),
                weeksFromNow: short ? formatMessage( "APEX.SINCE.SHORT.WEEKS_FROM_NOW", "#time#" ) : formatMessage( "SINCE_WEEKS_FROM_NOW", "#time#" ),
                monthsFromNow: short ? formatMessage( "APEX.SINCE.SHORT.MONTHS_FROM_NOW", "#time#" ) : formatMessage( "SINCE_MONTHS_FROM_NOW", "#time#" ),
                yearsFromNow: short ? formatMessage( "APEX.SINCE.SHORT.YEARS_FROM_NOW", "#time#" ) : formatMessage( "SINCE_YEARS_FROM_NOW", "#time#" ),
                now: formatMessage( "SINCE_NOW" )
            };

        // if a not valid date object is supplied, throw an error
        if ( !date.isValid( localDate ) ) {
            throw new Error( "Not a valid date" );
        }

        // build since text for now, seconds, minutes, hours, days, months & years
        if ( date.isSame( now, localDate, date.UNIT.SECOND ) ) {
            sinceText = messages.now;
        } else if ( nowDateDifference > 0 && nowDateDifference < 60 ) {
            sinceText = messages.secondsAgo.replace( "#time#", Math.round( nowDateDifference ) );
        } else if ( dateNowDifference > 0 && dateNowDifference < 60 ) {
            sinceText = messages.secondsFromNow.replace( "#time#", Math.round( dateNowDifference ) );
        } else if ( nowDateDifference >= 60 && nowDateDifference < 60 * 60 ) {
            sinceText = messages.minutesAgo.replace( "#time#", Math.round( nowDateDifference / 60 ) );
        } else if ( dateNowDifference >= 60 && dateNowDifference < 60 * 60 ) {
            sinceText = messages.minutesFromNow.replace( "#time#", Math.round( dateNowDifference / 60 ) );
        } else if ( nowDateDifference >= 60 * 60 && nowDateDifference < 60 * 60 * 24 * 2 ) {
            sinceText = messages.hoursAgo.replace( "#time#", Math.round( nowDateDifference / 60 / 60 ) );
        } else if ( dateNowDifference >= 60 * 60 && dateNowDifference < 60 * 60 * 24 * 2 ) {
            sinceText = messages.hoursFromNow.replace( "#time#", Math.round( dateNowDifference / 60 / 60 ) );
        } else if ( nowDateDifference >= 60 * 60 * 24 * 2 && nowDateDifference < 60 * 60 * 24 * 14 ) {
            sinceText = messages.daysAgo.replace( "#time#", Math.round( nowDateDifference / 60 / 60 / 24 ) );
        } else if ( dateNowDifference >= 60 * 60 * 24 * 2 && dateNowDifference < 60 * 60 * 24 * 14 ) {
            sinceText = messages.daysFromNow.replace( "#time#", Math.round( dateNowDifference / 60 / 60 / 24 ) );
        } else if ( nowDateDifference >= 60 * 60 * 24 * 14 && nowDateDifference < 60 * 60 * 24 * 60 ) {
            sinceText = messages.weeksAgo.replace( "#time#", Math.round( nowDateDifference / 60 / 60 / 24 / 7 ) );
        } else if ( dateNowDifference >= 60 * 60 * 24 * 14 && dateNowDifference < 60 * 60 * 24 * 60 ) {
            sinceText = messages.weeksFromNow.replace( "#time#", Math.round( dateNowDifference / 60 / 60 / 24 / 7 ) );
        } else if ( nowDateDifference >= 60 * 60 * 24 * 60 && nowDateDifference < 60 * 60 * 24 * 365 ) {
            sinceText = messages.monthsAgo.replace( "#time#", Math.round( date.monthsBetween( localDate, now ) ) );
        } else if ( dateNowDifference >= 60 * 60 * 24 * 60 && dateNowDifference < 60 * 60 * 24 * 365 ) {
            sinceText = messages.monthsFromNow.replace( "#time#", Math.round( date.monthsBetween( now, localDate ) ) );
        } else if ( nowDateDifference >= 60 * 60 * 24 * 365 ) {
            sinceText = messages.yearsAgo.replace( "#time#", ( date.monthsBetween( localDate, now ) / 12 ).toFixed( 1 ) );
        } else if ( dateNowDifference >= 60 * 60 * 24 * 365 ) {
            sinceText = messages.yearsFromNow.replace( "#time#", ( date.monthsBetween( now, localDate ) / 12 ).toFixed( 1 ) );
        }

        return sinceText;
    };

    /**
     * <p>Return the formatted string of a date with a given (Oracle compatible) format mask.
     * If <em>pDate</em> is not provided it uses the current date & time.
     * It uses the default date format mask & locale defined in the application globalization settings.</p>
     *
     * <p>Currently not supported Oracle specific formats are:
     * SYEAR,SYYYY,IYYY,YEAR,IYY,SCC,TZD,TZH,TZM,TZR,AD,BC,CC,EE,FF,FX,IY,RM,TS,E,I,J,Q,X</p>
     *
     * @function format
     * @memberof apex.date
     * @param {Date} [pDate=new Date()] A date object
     * @param {string} [pFormat=apex.locale.getDateFormat()] The format mask
     * @param {string} [pLocale=apex.locale.getLanguage()] The locale
     * @return {string} The formatted date string
     *
     * @example <caption>Returns the formatted date string.</caption>
     *
     * var dateString = apex.date.format( myDate, "YYYY-MM-DD HH24:MI" );
     * // output: "2021-06-29 15:30"
     *
     * var dateString = apex.date.format( myDate, "Day, DD Month YYYY" );
     * // output: "Wednesday, 29 June 2021"
     *
     * var dateString = apex.date.format( myDate, "Day, DD Month YYYY", "de" );
     * // output: "Mittwoch, 29 Juni 2021"
     */
    date.format = function ( pDate, pFormat, pLocale ) {
        let localDate = pDate || new Date(),
            locales = pLocale || locale.getLanguage() || "default",
            formatMask = pFormat || locale.getDateFormat(),
            formatMaskSearch = formatMask.toUpperCase(),
            formatTokenString = "FMMONTH|FMYYYY|FMRRRR|MONTH|FMMON|FMDAY|SSSSS|FMDY|FMDD|FMMM|HH12|HH24|RRRR|YYYY|DAY|DDD|MON|AM|DD|DL|DS|DY|HH|IW|MI|MM|PM|RR|SS|WW|YY|D|W",
            notSupportedTokenString = "SYEAR|SYYYY|IYYY|YEAR|IYY|SCC|TZD|TZH|TZM|TZR|AD|BC|CC|EE|FF|FX|IY|RM|TS|E|I|J|Q|X",
            amFormat = locale.getSettings().calendar.amFormat,
            pmFormat = locale.getSettings().calendar.pmFormat,
            formatTokens = [],
            formatToken = "",
            notSupportedTokens = [],
            notSupportedToken = "",
            formatMaskPart,
            findings = [],
            finding,
            formattedString,
            i;

        function _isSubstringEnquoted( pString, pSubstring ) {
            let string = ( pString.toUpperCase().match( /".*?"/g ) || [] ).join( " " ), // get only enquoted parts of string
                subString = pSubstring.toUpperCase(),
                subStringIndex = string.indexOf( subString );

            return string.substr( 0, subStringIndex ).includes( '"' ) && string.substr( subStringIndex + 1, string.length ).includes( '"' );
        }

        function _removeFM( pString = "" ) {
            if ( pString.toUpperCase().startsWith( "FM" ) ) {
                return pString.replace( new RegExp( "FM", "ig" ), "" );
            }
            return pString;
        }

        function _isUpperCase( pString = "" ) {
            let string = _removeFM( pString );
            return string === string.toUpperCase();
        }

        function _isLowerCase( pString = "" ) {
            let string = _removeFM( pString );
            return string === string.toLowerCase();
        }

        function _isInitCase( pString = "" ) {
            let string = _removeFM( pString );
            return string.charAt( 0 ) === string.charAt( 0 ).toUpperCase() && string.substr( 1 ) === string.substr( 1 ).toLowerCase();
        }

        function _toInitCase( pString = "" ) {
            return pString.charAt( 0 ).toUpperCase() + pString.substr( 1 ).toLowerCase();
        }

        function _getAbbrevMonthName( pDate ) {
            let abbrevMonthNames = locale.getAbbrevMonthNames(),
                month = "";

            if ( !locales.startsWith( "en" ) && locales !== locale.getLanguage() ) {
                throw new Error( "Only english & current application language are supported for 'MON' format" );
            }

            if ( locales.startsWith( "en" ) && locales !== locale.getLanguage() ) {
                month = pDate.toLocaleString( locales, { month: "short" } );
            } else {
                month = abbrevMonthNames[pDate.getMonth()];
            }
            
            return month.toUpperCase();
        }

        function _getMonthName( pDate ) {
            let monthNames = locale.getMonthNames(),
                month = "";

            if ( !locales.startsWith( "en" ) && locales !== locale.getLanguage() ) {
                throw new Error( "Only english & current application language are supported for 'MONTH' format" );
            }

            if ( locales.startsWith( "en" ) && locales !== locale.getLanguage() ) {
                month = pDate.toLocaleString( locales, { month: "long" } );
            } else {
                month = monthNames[pDate.getMonth()];
            }
            return month.toUpperCase();
        }

        function _getAbbrevDayName( pDate ) {
            let abbrevDayNames = locale.getAbbrevDayNames(),
                startOfWeek = locale.getSettings().calendar.startOfWeek,
                delta = startOfWeek === "sunday" ? 0 : -1,
                day = "";

            if ( !locales.startsWith( "en" ) && locales !== locale.getLanguage() ) {
                throw new Error( "Only english & current application language are supported for 'DY' format" );
            }

            if ( locales.startsWith( "en" ) && locales !== locale.getLanguage() ) {
                day = pDate.toLocaleString( locales, { weekday: "short" } );
            } else {
                day = abbrevDayNames[pDate.getDay() + delta === -1 ? abbrevDayNames.length + delta : pDate.getDay() + delta];
            }
            return day.toUpperCase();
        }

        function _getDayName( pDate ) {
            let dayNames = locale.getDayNames(),
                startOfWeek = locale.getSettings().calendar.startOfWeek,
                delta = startOfWeek === "sunday" ? 0 : -1,
                day = "";

            if ( !locales.startsWith( "en" ) && locales !== locale.getLanguage() ) {
                throw new Error( "Only english & current application language are supported for 'DAY' format" );
            }

            if ( locales.startsWith( "en" ) && locales !== locale.getLanguage() ) {
                day = pDate.toLocaleString( locales, { weekday: "long" } );
            } else {
                day = dayNames[pDate.getDay() + delta === -1 ? dayNames.length + delta : pDate.getDay() + delta];
            }
            return day.toUpperCase();
        }

        function _getDatePart( pDate, pPartFormat ) {
            const datePart = {
                YYYY: ( d ) => {
                    return ( "0000" + d.getFullYear() ).slice( -4 );
                },
                FMYYYY: ( d ) => {
                    return ( "0000" + d.getFullYear() ).slice( -4 );
                },
                YY: ( d ) => {
                    return ( "0000" + d.getFullYear() ).slice( -2 );
                },
                RRRR: ( d ) => {
                    return ( "0000" + d.getFullYear() ).slice( -4 );
                },
                FMRRRR: ( d ) => {
                    return ( "0000" + d.getFullYear() ).slice( -4 );
                },
                RR: ( d ) => {
                    return ( "0000" + d.getFullYear() ).slice( -2 );
                },
                MONTH: ( d ) => {
                    return _getMonthName( d );
                },
                FMMONTH: ( d ) => {
                    return _getMonthName( d );
                },
                MON: ( d ) => {
                    return _getAbbrevMonthName( d );
                },
                FMMON: ( d ) => {
                    return _getAbbrevMonthName( d );
                },
                MM: ( d ) => {
                    return ( "0" + ( d.getMonth() + 1 ) ).slice( -2 );
                },
                FMMM: ( d ) => {
                    return ( d.getMonth() + 1 ).toString();
                },
                IW: ( d ) => {
                    return ( "0" + date.ISOWeek( d ) ).slice( -2 );
                },
                WW: ( d ) => {
                    return ( "0" + date.ISOWeek( d ) ).slice( -2 );
                },
                W: ( d ) => {
                    return date.weekOfMonth( d );
                },
                DAY: ( d ) => {
                    return _getDayName( d );
                },
                FMDAY: ( d ) => {
                    return _getDayName( d );
                },
                DDD: ( d ) => {
                    return ( "0" + date.dayOfYear( d ) ).slice( -3 );
                },
                DD: ( d ) => {
                    return ( "0" + d.getDate() ).slice( -2 );
                },
                FMDD: ( d ) => {
                    return d.getDate().toString();
                },
                DY: ( d ) => {
                    return _getAbbrevDayName( d );
                },
                FMDY: ( d ) => {
                    return _getAbbrevDayName( d );
                },
                D: ( d ) => {
                    return d.getDay() + 1;
                },
                HH24: ( d ) => {
                    return ( "0" + d.getHours() ).slice( -2 );
                },
                HH12: ( d ) => {
                    return d.toLocaleString( "en-US", { hour: "2-digit", hour12: true } ).substr( 0, 2 );
                },
                HH: ( d ) => {
                    return d.toLocaleString( "en-US", { hour: "2-digit", hour12: true } ).substr( 0, 2 );
                },
                AM: ( d ) => {
                    return d.getHours() < 12 ? amFormat : pmFormat;
                },
                PM: ( d ) => {
                    return d.getHours() < 12 ? amFormat : pmFormat;
                },
                MI: ( d ) => {
                    return ( "0" + d.getMinutes() ).slice( -2 );
                },
                SSSSS: ( d ) => {
                    return date.secondsPastMidnight( d );
                },
                SS: ( d ) => {
                    return ( "0" + d.getSeconds() ).slice( -2 );
                }
            };

            return datePart[pPartFormat]( pDate );
        }

        // if a not valid date object is supplied, throw an error
        if ( !date.isValid( localDate ) ) {
            throw new Error( "Not a valid date" );
        }

        // special handling of SINCE format mask
        if ( formatMaskSearch === "SINCE" ) {
            return date.since( localDate );
        }

        // special handling for DS/DL format mask, get the real one from DB (apex.locale)
        if ( formatMaskSearch === "DS" ) {
            formatMask = locale.getDSDateFormat();
            formatMaskSearch = formatMask.toUpperCase();
        }
        if ( formatMaskSearch === "DL" ) {
            formatMask = locale.getDLDateFormat();
            formatMaskSearch = formatMask.toUpperCase();
        }

        debug.info( "apex.date.format: date", date.toISOString( localDate ) );
        debug.info( "apex.date.format: formatMask", formatMask );

        // find token matches in supplied format mask which we can use to translate into date parts
        formatTokens = formatTokenString.split( "|" );

        for ( i = 0; i < formatTokens.length; i++ ) {
            formatToken = formatTokens[i];

            // check for format mask tokens, but not the ones within quotes
            if ( formatMaskSearch.includes( formatToken ) ) {
                if ( !_isSubstringEnquoted( formatMask, formatToken ) ) {
                    findings.push( {
                        id: i,
                        name: formatToken,
                        textCase:
                            formatToken === "DS" || formatToken === "DL"
                                ? "original"
                                : _isUpperCase( formatMask.substr( formatMask.toUpperCase().indexOf( formatToken ), formatToken.length ) )
                                ? "upper"
                                : _isLowerCase( formatMask.substr( formatMask.toUpperCase().indexOf( formatToken ), formatToken.length ) )
                                ? "lower"
                                : _isInitCase( formatMask.substr( formatMask.toUpperCase().indexOf( formatToken ), formatToken.length ) )
                                ? "init"
                                : "upper"
                    } );
                    formatMask = formatMask.replace( new RegExp( formatToken, "ig" ), "~~" + i + "~~" );
                }
                formatMaskSearch = formatMaskSearch.replace( new RegExp( formatToken, "g" ), "" );
            }
        }

        // lookup not yet supported tokens in remaining format mask, if found and not within quotes throw an error
        notSupportedTokens = notSupportedTokenString.split( "|" );

        for ( i = 0; i < notSupportedTokens.length; i++ ) {
            notSupportedToken = notSupportedTokens[i];

            if ( formatMaskSearch.includes( notSupportedToken ) && !_isSubstringEnquoted( formatMaskSearch, notSupportedToken ) ) {
                throw new Error( "Format not supported: " + notSupportedToken );
            }
        }

        // now we are building the final formatted output from our findings
        formattedString = formatMask;

        for ( i = 0; i < findings.length; i++ ) {
            finding = findings[i];

            formatMaskPart = _getDatePart( localDate, finding.name ).toString();

            switch ( finding.textCase ) {
            case "upper":
                formatMaskPart = formatMaskPart.toUpperCase();
                break;
            case "lower":
                formatMaskPart = formatMaskPart.toLowerCase();
                break;
            case "init":
                formatMaskPart = _toInitCase( formatMaskPart );
                break;
            }

            debug.info( "apex.date.format: getDatePart", "value:", formatMaskPart, "format:", finding.name );

            formattedString = formattedString.replace( new RegExp( "~~" + finding.id + "~~", "g" ), formatMaskPart );
        }

        // remove quotes special escaped parts, like "T" in YYYY-MM-DD"T"HH:MM:SS
        if ( formattedString.includes( '"' ) ) {
            formattedString = formattedString.replace( new RegExp( '"', "g" ), "" );
        }

        return formattedString;
    };

    /**
     * <p>Return the parsed date object of a given date string and a (Oracle compatible) format mask.
     * It uses the default date format mask defined in the application globalization settings.</p>
     *
     * <p>Currently not supported Oracle specific formats are:
     * SSSSS,SYEAR,SYYYY,IYYY,YEAR,IYY,SCC,TZD,TZH,TZM,TZR,AD,BC,CC,EE,FF,FX,IW,IY,RM,TS,WW,E,I,J,Q,W,X</p>
     *
     * @function parse
     * @memberof apex.date
     * @param {string} pDateString A formatted date string
     * @param {string} [pFormat=apex.locale.getDateFormat()] The format mask
     * @return {Date} The date object
     *
     * @example <caption>Returns the parsed date object.</caption>
     *
     * var date = apex.date.parse( "2021-06-29 15:30", "YYYY-MM-DD HH24:MI" );
     * var date = apex.date.parse( "2021-JUN-29 08:30 am", "YYYY-MON-DD HH12:MI AM" );
     */
    date.parse = function ( pDateString, pFormat ) {
        let localDate = new Date( 2020, 0, 1 ), // init date to 2020-01-01, leap year + month with 31 days --> range for possible dates
            dateString = pDateString || "",
            formatMask = pFormat || locale.getDateFormat(),
            formatMaskSearch = formatMask.toUpperCase(),
            formatTokenString = "FMMONTH|FMYYYY|FMRRRR|MONTH|FMMON|FMDAY|FMDY|FMDD|FMMM|HH12|HH24|RRRR|YYYY|DAY|DDD|MON|AM|DD|DL|DS|DY|HH|MI|MM|PM|RR|SS|YY|D",
            notSupportedTokenString = "SSSSS|SYEAR|SYYYY|IYYY|YEAR|IYY|SCC|TZD|TZH|TZM|TZR|AD|BC|CC|EE|FF|FX|IW|IY|RM|TS|WW|E|I|J|Q|W|X",
            amFormat = locale.getSettings().calendar.amFormat,
            pmFormat = locale.getSettings().calendar.pmFormat,
            formatTokens = [],
            formatToken = "",
            notSupportedTokens = [],
            notSupportedToken = "",
            findings = [],
            finding,
            dateStringPart,
            datePart,
            correctFollowFindings = false,
            findingStart = 0,
            findingEnd = 0,
            correctStartIndex = 0,
            blankAfterFormat = false,
            replaceChars = ["~", "*", "#", "<", ">", "|", "§", "^", "°", "=", "$", "&", "%", "@", "€"],
            replaceChar = "",
            i;

        function _getMonthNumber( pMonth, pUseAbbrev = false ) {
            let monthNames = pUseAbbrev ? locale.getAbbrevMonthNames() : locale.getMonthNames(),
                rawMonthNames = pUseAbbrev ? locale.getSettings().calendar.rawAbbrMonthNames : locale.getSettings().calendar.rawMonthNames,
                index;

            index = rawMonthNames.findIndex( ( month ) => {
                return month.toLowerCase() === pMonth.toLowerCase();
            } );
            if ( index === -1 ) { // not found
                index = monthNames.findIndex( ( month ) => {
                    return month.toLowerCase() === pMonth.toLowerCase();
                } );
            }
            return index;
        }

        function _setDayOfWeek( pDate, pDay ) {
            const currentDay = pDate.getDay() + 1,
                  distance = pDay - currentDay;
            pDate.setDate( pDate.getDate() + distance );
        }

        function _extractMonth( pDateString, pUseAbbrev = false ) {
            let monthNames = pUseAbbrev ? locale.getAbbrevMonthNames() : locale.getMonthNames(),
                rawMonthNames = pUseAbbrev ? locale.getSettings().calendar.rawAbbrMonthNames : locale.getSettings().calendar.rawMonthNames,
                found = false,
                monthName = "";

            for ( let i = 0; i < rawMonthNames.length; i++ ) {
                monthName = rawMonthNames[i];
                if ( pDateString.toLowerCase().includes( monthName.toLowerCase() ) ) {
                    found = true;
                    break;
                }
                monthName = "";
            }
            if ( !found ) {
                for ( let i = 0; i < monthNames.length; i++ ) {
                    monthName = monthNames[i];
                    if ( pDateString.toLowerCase().includes( monthName.toLowerCase() ) ) {
                        break;
                    }
                    monthName = "";
                }
            }
            return monthName;
        }

        function _extractDay( pDateString, pUseAbbrev = false ) {
            let dayNames = pUseAbbrev ? locale.getAbbrevDayNames() : locale.getDayNames(),
                rawDayNames = pUseAbbrev ? locale.getSettings().calendar.rawAbbrDayNames : locale.getSettings().calendar.rawDayNames,
                found = false,
                dayName = "";

            for ( let i = 0; i < rawDayNames.length; i++ ) {
                dayName = rawDayNames[i];
                if ( pDateString.toLowerCase().includes( dayName.toLowerCase() ) ) {
                    found = true;
                    break;
                }
                dayName = "";
            }
            if ( !found ) {
                for ( let i = 0; i < dayNames.length; i++ ) {
                    dayName = dayNames[i];
                    if ( pDateString.toLowerCase().includes( dayName.toLowerCase() ) ) {
                        break;
                    }
                    dayName = "";
                }
            }
            return dayName;
        }

        function _extractAMPM( pDateString ) {
            let ampmName = "";

            if ( pDateString.toLowerCase().includes( amFormat.toLowerCase() ) ) {
                ampmName = amFormat;
            }

            if ( !ampmName ) {
                if ( pDateString.toLowerCase().includes( pmFormat.toLowerCase() ) ) {
                    ampmName = pmFormat;
                }
            }
            return ampmName;
        }

        function _extractFMMM_FMDD_FMHH( pDateString, pStart, pEnd ) {
            let dateString = pDateString.substring( pStart, pEnd ) || "", // get only the relevant part
                dayNumber = ( dateString.match( /\d{1,2}/ ) || [] ).join(); // search for numbers with a length of 1 or 2
            return dayNumber;
        }

        function _correctFollowFindings( pFindings, pStartIndex, pAmount ) {
            pFindings = pFindings
                .filter( function ( elem ) {
                    return elem.start > pStartIndex;
                } )
                .forEach( function ( item ) {
                    item.start = item.start + pAmount;
                    item.end = item.end + pAmount;
                } );
        }

        function _escapeRegExp( pString = "" ) {
            return pString.replace( /[.*+?^${}()|[\]\\]/g, "\\$&" );
        }

        function _setDatePart( pDate, pPartValue, pPartFormat ) {
            debug.info( "apex.date.parse: setDatePart", "value:", pPartValue, "format:", pPartFormat );

            const setDatePart = {
                YYYY: ( d, v ) => {
                    if ( !/^\d{4}$/.test( v ) ) {
                        throw new Error( "Date Parsing Error: YYYY not valid." );
                    }
                    d.setFullYear( v );
                },
                FMYYYY: ( d, v ) => {
                    if ( !/^\d{4}$/.test( v ) ) {
                        throw new Error( "Date Parsing Error: FMYYYY not valid." );
                    }
                    d.setFullYear( v );
                },
                YY: ( d, v ) => {
                    if ( !/^\d{2}$/.test( v ) ) {
                        throw new Error( "Date Parsing Error: YY not valid." );
                    }
                    d.setFullYear( d.getFullYear().toString().substr( 0, 2 ) + v );
                },
                RRRR: ( d, v ) => {
                    if ( !/^\d{4}$/.test( v ) ) {
                        throw new Error( "Date Parsing Error: RRRR not valid." );
                    }
                    d.setFullYear( v );
                },
                FMRRRR: ( d, v ) => {
                    if ( !/^\d{4}$/.test( v ) ) {
                        throw new Error( "Date Parsing Error: FMRRRR not valid." );
                    }
                    d.setFullYear( v );
                },
                RR: ( d, v ) => {
                    if ( !/^\d{2}$/.test( v ) ) {
                        throw new Error( "Date Parsing Error: RR not valid." );
                    }
                    d.setFullYear( d.getFullYear().toString().substr( 0, 2 ) + v );
                },
                MONTH: ( d, v ) => {
                    const value = _getMonthNumber( v, false );
                    if ( value === -1 ) {
                        throw new Error( "Date Parsing Error: MONTH not valid." );
                    }
                    d.setMonth( value );
                },
                FMMONTH: ( d, v ) => {
                    const value = _getMonthNumber( v, false );
                    if ( value === -1 ) {
                        throw new Error( "Date Parsing Error: FMMONTH not valid." );
                    }
                    d.setMonth( value );
                },
                MON: ( d, v ) => {
                    const value = _getMonthNumber( v, true );
                    if ( value === -1 ) {
                        throw new Error( "Date Parsing Error: MON not valid." );
                    }
                    d.setMonth( value );
                },
                FMMON: ( d, v ) => {
                    const value = _getMonthNumber( v, true );
                    if ( value === -1 ) {
                        throw new Error( "Date Parsing Error: FMMON not valid." );
                    }
                    d.setMonth( value );
                },
                MM: ( d, v ) => {
                    const value = parseInt( v, 10 );
                    if ( !/^\d+$/.test( value ) || value < 1 || value > 12 ) {
                        throw new Error( "Date Parsing Error: MM not valid." );
                    }
                    d.setMonth( value - 1 );
                },
                FMMM: ( d, v ) => {
                    const value = parseInt( v, 10 );
                    if ( !/^\d+$/.test( value ) || value < 1 || value > 12 ) {
                        throw new Error( "Date Parsing Error: FMMM not valid." );
                    }
                    d.setMonth( value - 1 );
                },
                DDD: ( d, v ) => {
                    const value = parseInt( v, 10 );
                    if ( !/^\d+$/.test( value ) || value < 1 || value > 366 ) {
                        throw new Error( "Date Parsing Error: DDD not valid." );
                    }
                    date.setDayOfYear( d, value );
                },
                DD: ( d, v ) => {
                    const value = parseInt( v, 10 );
                    if ( !/^\d+$/.test( value ) || value < 1 || value > 31 ) {
                        throw new Error( "Date Parsing Error: DD not valid." );
                    }
                    d.setDate( value );
                },
                FMDD: ( d, v ) => {
                    const value = parseInt( v, 10 );
                    if ( !/^\d+$/.test( value ) || value < 1 || value > 31 ) {
                        throw new Error( "Date Parsing Error: FMDD not valid." );
                    }
                    d.setDate( value );
                },
                D: ( d, v ) => {
                    const value = parseInt( v, 10 );
                    if ( !/^\d+$/.test( value ) || value < 1 || value > 7 ) {
                        throw new Error( "Date Parsing Error: D not valid." );
                    }
                    _setDayOfWeek( d, value );
                },
                HH24: ( d, v ) => {
                    const value = parseInt( v, 10 );
                    if ( !/^\d+$/.test( value ) || value < 0 || value > 23 ) {
                        throw new Error( "Date Parsing Error: HH24 not valid." );
                    }
                    d.setHours( value );
                },
                HH12: ( d, v ) => {
                    const value = parseInt( v, 10 );
                    if ( !/^\d+$/.test( value ) || value < 1 || value > 12 ) {
                        throw new Error( "Date Parsing Error: HH12 not valid." );
                    }
                    d.setHours( value );
                },
                HH: ( d, v ) => {
                    const value = parseInt( v, 10 );
                    if ( !/^\d+$/.test( value ) || value < 1 || value > 12 ) {
                        throw new Error( "Date Parsing Error: HH not valid." );
                    }
                    d.setHours( value );
                },
                AM: ( d, v ) => {
                    if ( ![amFormat, pmFormat].includes( v.toUpperCase() ) ) {
                        throw new Error( "Date Parsing Error: AM not valid." );
                    }
                    if ( v.toUpperCase() === amFormat && d.getHours() === 12 ) {
                        d.setHours( 0 );
                    } else if ( v.toUpperCase() === pmFormat && d.getHours() === 0 ) {
                        d.setHours( 12 );
                    } else if ( v.toUpperCase() === amFormat && d.getHours() > 12 ) {
                        d.setHours( d.getHours() - 12 );
                    } else if ( v.toUpperCase() === pmFormat && d.getHours() < 12 ) {
                        d.setHours( d.getHours() + 12 );
                    }
                },
                PM: ( d, v ) => {
                    if ( ![amFormat, pmFormat].includes( v.toUpperCase() ) ) {
                        throw new Error( "Date Parsing Error: PM not valid." );
                    }
                    if ( v.toUpperCase() === amFormat && d.getHours() === 12 ) {
                        d.setHours( 0 );
                    } else if ( v.toUpperCase() === pmFormat && d.getHours() === 0 ) {
                        d.setHours( 12 );
                    } else if ( v.toUpperCase() === amFormat && d.getHours() > 12 ) {
                        d.setHours( d.getHours() - 12 );
                    } else if ( v.toUpperCase() === pmFormat && d.getHours() < 12 ) {
                        d.setHours( d.getHours() + 12 );
                    }
                },
                MI: ( d, v ) => {
                    const value = parseInt( v, 10 );
                    if ( !/^\d+$/.test( value ) || value < 0 || value > 59 ) {
                        throw new Error( "Date Parsing Error: MI not valid." );
                    }
                    d.setMinutes( value );
                },
                SS: ( d, v ) => {
                    const value = parseInt( v, 10 );
                    if ( !/^\d+$/.test( value ) || value < 0 || value > 59 ) {
                        throw new Error( "Date Parsing Error: SS not valid." );
                    }
                    d.setSeconds( value );
                }
            };

            setDatePart[pPartFormat]( pDate, pPartValue );
        }

        // exit when no date string is provided
        if ( !dateString ) {
            return;
        }

        // reset hour, minutes, seconds, milliseconds
        localDate.setHours( 0, 0, 0, 0 );

        // special handling for DS/DL format mask, get the real one from DB (apex.locale)
        if ( formatMaskSearch === "DS" ) {
            formatMask = locale.getDSDateFormat();
            formatMaskSearch = formatMask.toUpperCase();
        }
        if ( formatMaskSearch === "DL" ) {
            formatMask = locale.getDLDateFormat();
            formatMaskSearch = formatMask.toUpperCase();
        }

        // remove enquoted string including quotes from format mask
        // These strings should not be relevant for date conversion
        if ( formatMaskSearch.includes( '"' ) ) {
            formatMask = formatMask.replace( /".*?"/g, function ( match ) {
                return " ".repeat( match.length - 2 ); // length without the wrapping quotes
            } );
            formatMaskSearch = formatMask.toUpperCase();
        }

        // Remove unicode chars from format mask
        // These chars should not be relevant for date conversion
        if ( /[\u{0080}-\u{FFFF}]/u.test( formatMaskSearch ) ) {
            formatMask = formatMask.replace( /[\u{0080}-\u{FFFF}]/gu, " " );
            formatMaskSearch = formatMask.toUpperCase();
        }

        debug.info( "apex.date.parse: dateString", dateString );
        debug.info( "apex.date.parse: formatMask", formatMask );

        // find token matches in supplied format mask which we can use to translate into date parts
        formatTokens = formatTokenString.split( "|" );

        for ( i = 0; i < formatTokens.length; i++ ) {
            formatToken = formatTokens[i];

            if ( formatMaskSearch.includes( formatToken ) ) {
                findingStart = formatMask.toUpperCase().indexOf( formatToken );
                findingEnd = formatMask.toUpperCase().indexOf( formatToken ) + formatToken.length;

                // correct start & end position if a format mask part could be longer than the real data, e.g. FMYYYY -> 2022, HH12/HH24 is handled below
                if ( formatToken === "FMYYYY" || formatToken === "FMRRRR" ) {
                    findingEnd = findingEnd - 2;
                    correctStartIndex = findingStart;
                    correctFollowFindings = true;
                }

                findings.push( {
                    id: i,
                    name: formatToken,
                    start: findingStart,
                    end: findingEnd
                } );

                formatMaskSearch = formatMaskSearch.replace( formatToken, new Array( formatToken.length + 1 ).join( i ) );
            }
        }

        // correct start & end position of following findings, if e.g. HH24 or HH12 was used
        if ( correctFollowFindings ) {
            _correctFollowFindings( findings, correctStartIndex, - 2 );
        }

        // lookup not yet supported tokens in remaining format mask, if found thow an error
        notSupportedTokens = notSupportedTokenString.split( "|" );

        for ( i = 0; i < notSupportedTokens.length; i++ ) {
            notSupportedToken = notSupportedTokens[i];

            if ( formatMaskSearch.includes( notSupportedToken ) ) {
                throw new Error( "Format not supported: " + notSupportedToken );
            }
        }

        // sort findings by start position
        findings.sort( function( a, b ) {
            return a.start - b.start;
        } );            

        // now we are building the final formatted output from our findings
        // first handle special localized format mask parts like "MON", "MONTH", "DY", "DAY"
        for ( i = 0; i < findings.length; i++ ) {
            replaceChar = replaceChars[i] || "~";
            finding = findings[i];
            blankAfterFormat = formatMask.toUpperCase().includes( finding.name + " " );
            datePart = "";

            if ( finding.name === "MONTH" || finding.name === "FMMONTH" ) {
                datePart = _extractMonth( dateString, false );

                if ( datePart ) {
                    dateString = dateString.replace( new RegExp( datePart, "ig" ), replaceChar.repeat( finding.name.length ) + ( blankAfterFormat ? " " : "" ) ); // replace with fixed length 5 or 7 for MONTH
                    _setDatePart( localDate, datePart, finding.name );
                    findings.splice( i, 1 ); // remove object from findings array to not process again
                    i = i - 1;
                }
            }
            if ( finding.name === "MON" || finding.name === "FMMON" ) {
                datePart = _extractMonth( dateString, true );

                if ( datePart ) {
                    dateString = dateString.replace( new RegExp( datePart, "ig" ), replaceChar.repeat( finding.name.length ) + ( blankAfterFormat ? " " : "" ) ); // replace with fixed length 3 or 5 for MON
                    _setDatePart( localDate, datePart, finding.name );
                    findings.splice( i, 1 ); // remove object from findings array to not process again
                    i = i - 1;
                }
            }
            if ( finding.name === "MM" || finding.name === "DD" || finding.name === "FMMM" || finding.name === "FMDD" ) {
                if ( finding.name.length === 4 ) {
                    finding.end = finding.end - 2;
                }
                datePart = dateString.substring( finding.start, finding.end );

                if ( datePart ) {
                    // it could happen that FMMONTH or some other FMxxx is set before DD, and Oracle seems to apply this FM also to DD, so 02 becomes just 2
                    // So we check if the value we have is numeric, if not find only the numeric value
                    if ( !/^\d+$/.test( datePart ) ) {
                        datePart = _extractFMMM_FMDD_FMHH( dateString, finding.start, finding.end );
                        if ( datePart ) {
                            _setDatePart( localDate, datePart, finding.name );
                        }
                    // This is normal handling where we really get 02 for example
                    } else {
                        _setDatePart( localDate, datePart, finding.name );
                    }
                    finding.end = finding.name.length === 4 ? finding.end - ( finding.name.length - datePart.length ) + 2 : finding.end - ( finding.name.length - datePart.length );
                    _correctFollowFindings( findings, finding.start, - ( finding.name.length - datePart.length ) );
                    findings.splice( i, 1 ); // remove object from findings array to not process again
                    i = i - 1;
                }
            }
            if ( finding.name === "DAY" || finding.name === "FMDAY" ) {
                datePart = _extractDay( dateString, false );

                if ( datePart ) {
                    dateString = dateString.replace( new RegExp( datePart, "ig" ), replaceChar.repeat( finding.name.length ) + ( blankAfterFormat ? " " : "" ) ); // replace with fixed length 3 or 5 for DAY
                    // not calling _setDatePart() because DAY is not specific enough, e.g. "Friday" doesn't map to a exact day
                }
                findings.splice( i, 1 ); // always remove object from findings array to not process again
                i = i - 1;
            }
            if ( finding.name === "DY" || finding.name === "FMDY" ) {
                datePart = _extractDay( dateString, true );

                if ( datePart ) {
                    dateString = dateString.replace( new RegExp( datePart, "ig" ), replaceChar.repeat( finding.name.length ) + ( blankAfterFormat ? " " : "" ) ); // replace with fixed length 2 or 4 for DY
                    // not calling _setDatePart() because DY is not specific enough, e.g. "Fri" doesn't map to a exact day
                }
                findings.splice( i, 1 ); // always remove object from findings array to not process again
                i = i - 1;
            }
            if ( finding.name === "HH" || finding.name === "HH12" || finding.name === "HH24" ) {
                if ( finding.name.length === 4 ) {
                    finding.end = finding.end - 2;
                }
                datePart = dateString.substring( finding.start, finding.end );

                if ( datePart ) {
                    // it could happen that FMMONTH or some other FMxxx is set before HH, and Oracle seems to apply this FM also to HH, so 02 becomes just 2
                    // So we check if the value we have is numeric, if not find only the numeric value
                    if ( !/^\d+$/.test( datePart ) ) {
                        datePart = _extractFMMM_FMDD_FMHH( dateString, finding.start, finding.end );
                        if ( datePart ) {
                            _setDatePart( localDate, datePart, finding.name );
                        }
                    // This is normal handling where we really get 02 for example
                    } else {
                        _setDatePart( localDate, datePart, finding.name );
                    }
                    finding.end = finding.name.length === 4 ? finding.end - ( finding.name.length - datePart.length ) + 2 : finding.end - ( finding.name.length - datePart.length );
                    _correctFollowFindings( findings, finding.start, - ( finding.name.length - datePart.length ) );
                    findings.splice( i, 1 ); // remove object from findings array to not process again
                    i = i - 1;
                }
            }
            if ( finding.name === "AM" || finding.name === "PM" ) {
                datePart = _extractAMPM( dateString );

                if ( datePart ) {
                    dateString = dateString.replace( new RegExp( datePart, "ig" ), replaceChar.repeat( finding.name.length ) + ( blankAfterFormat ? " " : "" ) ); // replace with fixed length 2 of AM/PM
                    _setDatePart( localDate, datePart, finding.name );
                    findings.splice( i, 1 ); // remove object from findings array to not process again
                    i = i - 1;
                }
            }
            // remove double spaces after specific replaced part, which could have been there since blankAfterFormat was added  
            // added "replaceChar" to make it more unique within looping
            if ( datePart && blankAfterFormat ) {
                dateString = dateString.replace( new RegExp( _escapeRegExp( replaceChar ) + "  ", "ig" ), replaceChar + " " );
            } 
        }

        // sort findings by start position
        findings.sort( function( a, b ) {
            return a.start - b.start;
        } );

        // handling for all other format mask parts
        for ( i = 0; i < findings.length; i++ ) {
            finding = findings[i];

            dateStringPart = dateString.substring( finding.start, finding.end );
            
            // remove all non alphanumeric chars (which are handled above, like MON, FMMON, DAY etc) & correct the positions of following findings
            dateStringPart = dateStringPart.replace( /[^a-zA-Z0-9]/ig, function ( match ) {
                _correctFollowFindings( findings, finding.start, - match.length );
                return "";
            } );

            _setDatePart( localDate, dateStringPart, finding.name );
        }

        // if a not valid date object is generated, throw an error
        if ( !date.isValid( localDate ) ) {
            throw new Error( "Date Parsing Error" );
        }

        return localDate;
    };

    //
    // Wrappers for functions from other namespaces, which could be date related
    // Just for convenience, already documented
    //

    date.getAbbrevMonthNames = function () {
        return locale.getAbbrevMonthNames();
    };

    date.getMonthNames = function () {
        return locale.getMonthNames();
    };

    date.getAbbrevDayNames = function () {
        return locale.getAbbrevDayNames();
    };

    date.getDayNames = function () {
        return locale.getDayNames();
    };

    date.getDSDateFormat = function () {
        return locale.getDSDateFormat();
    };

    date.getDLDateFormat = function () {
        return locale.getDLDateFormat();
    };
} )( apex.date, apex.locale, apex.lang, apex.debug );
