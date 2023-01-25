/*!
 Copyright (c) 2014, 2021, Oracle and/or its affiliates. All rights reserved.
*/
/**
 * Jquery UI Widget to stick certain "widgets" on the screen.
 *
 * Sticky widget turns an element into an element that will stick to the top (or bottom) of the view port. The
 * view port is typically the browser window but could be a fixed size element with scrolling content (a div with
 * height and width and css property overflow auto). todo does non window view port really work what are the limitations
 * The element is known as the "fixed" element because when it is stuck it uses position:fixed. The element is typically
 * something thin like a toolbar or header. It scrolls with the document content in its normal position until it reaches
 * the top (or bottom) of the view port at which point it becomes fixed. The sticky behavior is accomplished by
 * making the fixed element position absolute and adding a replacement (empty div) element just after it with exactly
 * the same size. Because the fixed element becomes positioned absolute they will occupy the same space (the fixed
 * element is on top of the replacement). When the fixed element becomes positioned fixed the replacement element
 * keeps the rest of the content from shifting.  A requirement for the fixed element is that it can be positioned absolute.
 *
 * Sticky widget supports stacked and nested sticky content as well as a static fixed header.
 *
 * Sample usage:
 *  $("aside").stickyWidget({toggleHeight: true}); // A toolbar on the right
 *  $(".a-IRR-toolbar").stickyWidget({toggleWidth: true}); // A toolbar on top
 *
 * todo:
 *  consider if there are better simpler methods now that browsers support css property position:sticky
 *
 * Depends:
 *    jquery.ui.core.js
 *    jquery.ui.widget.js
 *    apex/theme.js
 */

(function( $ ) {
    "use strict";
    let zIndex = 300,
        overrideScrollParent$;

    // location is start or end, pad is a string with units suffix as needed e.g. "px"
    function setStickyPad( location, pad ) {
        // this variable is used to set the scroll-padding-block-start/end properties
        // so that focus is kept within the visible part of the page.
        document.querySelector(':root').style.setProperty( "--js-sticky-scrollpad-block-" + location, pad );
    }

    $.widget("apex.stickyWidget", { //stickyWidget
        version: "5.1",
        widgetEventPrefix: "stickyWidget",
        options: {
            zIndexStart: -1,        // The z-index to apply to the fixed element. The default -1 will choose an
                                    // increasing value for z-index for each stickyWidget created starting at 300.
            toggleHeight: false,    // if true the height of the fixed container will be calculated with javascript
                                    // this may be useful since the original bounds will no longer apply to its fixed position.
            toggleWidth: false,     // if true the width of the fixed container will be calculated with javascript
                                    // this may be useful since the original bounds will no longer apply to its fixed position.
            top: null,              // a function that returns a pixel offset from the top of the view port where
                                    // the top of the fixed element will be stuck (position fixed). The function
                                    // is called in the context of this widget and takes no arguments. The purpose
                                    // is to define where the fixed element will stick.
                                    // The default is the value returned by apex.theme.defaultStickyTop.
                                    // If isFooter and stickToEnd are true the function returns an offset from the
                                    // top of the document to the top of an associated region. This is similar in
                                    // intent (but with direction reversed) to the bottom option function when isFooter is false.
            bottom: null,           // a function that returns the offset from the top of the document to the bottom
                                    // of an associated region. The function is called in the context of this widget
                                    // and takes no arguments. The purpose is to define a point in the document that
                                    // when scrolled off the top of the view port will cause the fixed element to also
                                    // scroll up off the top of the view port. This is only used if stickToEnd is true.
                                    // The default assumes the parent element of the fixed element defines the associated
                                    // region and returns the offset of the bottom of the parent.
                                    // If isFooter is true then the function returns the offset from the bottom of the
                                    // view port where the bottom of the fixed element will stick. This is similar in
                                    // intent (but with direction reversed) to the top option function when isFooter is false.
                                    // The default is 0.
            stickToEnd: false,      // if true, when the bottom of the element that the fixed element applies to (as
                                    // defined by bottom option) scrolls up off the view port the fixed element will also
                                    // scroll up and off. If isFooter is also true then when the top of the element
                                    // that the fixed element applies to (as defined by top option) scrolls down
                                    // off the bottom of the view port the fixed element will also scroll down and off.
            useWindow: true,        // if true (and the forceScrollParent method has not been used to override the
                                    // scroll parent) use the browser window as the scroll parent even if the fixed
                                    // element has a different scroll parent.
            isFooter: false,        // if true this is a footer and sticks to the bottom of the page. If false (the
                                    // default) it sticks to the top. The meaning of the top and bottom options are
                                    // reversed when this is true.
            // events
            stick: null,         // function(event, {where: <top|bottom>, offset: <n>})
            unstick: null,       // function(event, {where: <top|bottom>})
            stickEnd: null,      // function(event, {where: <top|bottom>, offset: <n>})
            unstickEnd: null     // function(event, {where: <top|bottom>})
        },

        /**
         * todo doc
         * @param {boolean} [pForce]
         */
        reStick: function( pForce = false ) {
            // if the element is not stuck, the top should not be recalculated unless, it's being
            // forced by the  unstick.
            if ( ( !this.stuck || this.stuckToEnd ) && !pForce ) {
                return;
            } // else

            let pos, pad,
                o = this.options;

            if ( o.isFooter ) {
                pos = o.bottom.call( this );
                pad = pos + this.unstuckHeight;
                setStickyPad( "end", pad + "px" );
                this.element.css( "position" , "fixed" )
                    .css( "bottom", pos );
            } else {
                pos = o.top.call( this );
                pad = pos + this.unstuckHeight;
                setStickyPad( "start", pad + "px" );
                this.element.css( "position" , "fixed" )
                    .css( "top", pos );
            }
        },

        /**
         * todo doc
         * @param pNewScrollParent$
         */
        forceScrollParent: function( pNewScrollParent$ ) {
            this._destroy(); // todo think this is probably not a good idea
            if ( pNewScrollParent$ && pNewScrollParent$.length > 0 ) {
                overrideScrollParent$ = pNewScrollParent$;
            } else {
                overrideScrollParent$ = null;
            }
            this._create();
        },

        _stickToEnd: function() {
            if ( this.stuckToEnd ) {
                return;
            } // else

            let end, where,
                o = this.options,
                element = this.element;

            this._removeScrollPadding();
            this.stuckToEnd = true;
            if ( o.isFooter ) {
                end = o.top.call( this );
                where = "bottom";
            } else {
                end = o.bottom.call( this ) - element.outerHeight();
                where = "top";
            }
            element.css( "bottom", "" )
                .css( "position", "absolute" )
            // top and bottom return offsets withing the document but setting the top while positioned
            // absolute requires a value offset from the offset parent.
            // it is important to subtract off the top of the offset parent after changing to positioned
            // absolute so that this works for elements that are descendent of elements that are positioned relative
            // and also works when positioned static.
                .css( "top",  end - element.offsetParent().offset().top );
            this._trigger( "stickEnd", null, {
                where: where,
                offset: end
            } );
        },
        _unstickFromEnd: function() {
            if ( !this.stuckToEnd ) {
                return;
            } // else

            let isFooter = this.options.isFooter;

            this.stuckToEnd = false;
            if ( isFooter ) {
                this.element.css("top",  "");
            }
            if ( this.stuck ) {
                this.stuck = false;
                this._stick();
            } else {
                this.stuck = true;
                this._unstick();
            }
            this._trigger( "unstickEnd", null, { where: isFooter ? "bottom" : "top" } );
        },
        /**
         * Stick the widget to the top of the screen, where top is defined by the number or function passed in
         * as an option.
         *
         * @private
         */
        _stick: function() {
            if ( this.stuck ) {
                return;
            } // else

            let element = this.element,
                o = this.options,
                where = o.isFooter ? "bottom" : "top";

            element.addClass( "is-stuck" );
            this.reStick( true );
            this.stuck = true;
            if ( o.toggleHeight ) {
                element.css( "height", this.unstuckHeight );
            }
            if ( o.toggleWidth ) {
                element.css( "width", this.unstuckWidth );
            }
            this._trigger( "stick", null, {
                where: where,
                offset: element.css( where )
            } );
        },
        /**
         * "Un"-stick the widget from the top of the screen.
         * @private
         */
        _unstick: function() {
            if ( !this.stuck ) {
                return;
            } // else

            let element = this.element,
                isFooter = this.options.isFooter;

            element.removeClass( "is-stuck" )
                .css( "position", "absolute" )
                .css( isFooter ? "bottom" : "top", "auto" );
            this._removeScrollPadding();
            this.stuck = false;
            // Reset the height and weight, if either were toggled, back to their CSS defaults.
            this._revertToCssWidthAndHeight();
            // Recalculate the width and height of the fixed element.
            this._recalculateFixedStuckDimensions();
            this._trigger( "unstick", null, { where: isFooter ? "bottom" : "top" } );
        },
        _removeScrollPadding: function() {
            let pad,
                scrollPadLocation = this.options.isFooter ? "end" : "start";

            pad = parseInt( getComputedStyle( document.documentElement )
                .getPropertyValue( "--js-sticky-scrollpad-block-" + scrollPadLocation ), 10 ) - this.unstuckHeight;
            if ( pad <= 0 ) {
                pad = "auto";
            } else {
                pad = pad + "px";
            }
            setStickyPad( scrollPadLocation, pad );
        },
        _revertToCssWidthAndHeight: function() {
            if ( this.options.toggleHeight ) {
                this.element.css( "height", this.cssHeight );
            }
            if ( this.options.toggleWidth ) {
                this.element.css( "width", this.cssWidth );
            }
        },
        /**
         *  Should only be called when the element is not stuck, otherwise you'll get incorrect dimensions!
         * @private
         */
        _recalculateFixedStuckDimensions: function() {
            if ( this.stuck ) {
                return;
            } // else

            this.unstuckWidth = this.element.outerWidth();
            this.unstuckHeight = this.element.outerHeight();
        },
        _setupDimensions: function() {
            this._revertToCssWidthAndHeight();
            // The replacement element should always go by the elements outerWidth and outerHeight, no exceptions/
            this.replacement
                .css( "width", this.element.outerWidth() )
                .css( "height", this.element.outerHeight() );
        },
        refresh: function() {}, // placeholder. actual function defined during _deferCreate
        _getDefaultOffset: function(){
            if ( this.options.top ) {
                return this.options.top.call( this );
            } else {
                return null;
            }
        },
        _deferCreate: function() {
            let scrollHandler,
                me = this,
                o = this.options,
                replacement = this.replacement = $( '<div class="js-stickyWidget-placeholder"></div>' ), // The replacement element is an empty div with some styling on top.
                element = this.element,
                handlerId = null;

            if ( !overrideScrollParent$ ) {
                this.scrollParent$ = element.scrollParent();
                if ( o.useWindow ) {
                    this.scrollParent$ = $( window );
                }
            } else {
                this.scrollParent$ = overrideScrollParent$;
            }
            let isWindow = this.isWindow = this.scrollParent$[0] === window,
                scrollParent$ = this.scrollParent$;

            element.addClass( "js-stickyWidget-toggle" );
            if ( o.zIndexStart < 0 ) {
                this.zIndex = zIndex;
                zIndex += 1;
            } else {
                this.zIndex = o.zIndexStart;
            }
            element.css( "z-index", this.zIndex );
            replacement.insertAfter( element ); // The replacement will not offset correctly if you use append or prepend!
            this._recalculateFixedStuckDimensions();
            // Store the cssHeight and cssWidth in case we need to toggle the width and height.
            this.cssHeight = element.css( "height" );
            this.cssWidth = element.css( "width" );
            this._setupDimensions();
            //On scroll, check if the elements to be stuck or unstuck!
            if ( o.isFooter ) {
                scrollHandler = function () {
                    let replacementBottom, top, stick,
                        offset = scrollParent$.scrollTop() + scrollParent$.height() - o.bottom.call( me );

                    if ( o.stickToEnd ) {
                        top = offset - element.outerHeight();
                        stick = o.top.call( me );
                        if ( top < stick ) {
                            me._stickToEnd();
                            return;
                        } else {
                            me._unstickFromEnd();
                        }
                    }
                    replacementBottom = replacement.offset().top + replacement.outerHeight();
                    // This would be an expensive calculation if it wasn't for _stick and _unstick's "stuck" guard.
                    if ( !isWindow ) {
                        replacementBottom += scrollParent$.scrollTop();
                    }
                    if ( offset < replacementBottom ) {
                        me._stick();
                    } else {
                        me._unstick();
                    }
                };
            } else {
                scrollHandler = function () {
                    let replacementTop, bottom, stick,
                        offset = scrollParent$.scrollTop() + o.top.call( me );

                    if ( o.stickToEnd ) {
                        bottom = offset + element.outerHeight();
                        stick = o.bottom.call( me );
                        if ( bottom >= stick ) {
                            me._stickToEnd();
                            return;
                        } else {
                            me._unstickFromEnd();
                        }
                    }
                    // This would be an expensive calculation if it wasn't for _stick and _unstick's "stuck" guard.
                    replacementTop = replacement.offset().top;
                    if ( !isWindow ) {
                        replacementTop += scrollParent$.scrollTop();
                    }
                    if ( offset >= replacementTop ) {
                        me._stick();
                    } else {
                        me._unstick();
                    }
                };
            }
            this.scrollHandler = function() {
                if ( !handlerId ) {
                    handlerId = apex.util.invokeAfterPaint( function() {
                        handlerId = null;
                        scrollHandler();
                    } );
                }
            };
            // todo: consider having a single scroll handler for all stickies
            //  one handler would loop over all stickyWidgets. This would enforce that they are handled in DOM order
            //  which is important for proper scroll padding setting. It would likely be more efficient.

            this.refresh = this.resizeHandler = function() {
                let saveZ = element.css( "z-index" );

                element.removeAttr( "style" ); // let element return to its natural state for a moment (todo what if something else put a style on it? but this is what destroy does)
                me.cssHeight = element.css( "height" );
                me.cssWidth = element.css( "width" );
                me.unstuckWidth = element.outerWidth();
                me.unstuckHeight = element.outerHeight();
                element.css( "z-index", saveZ )
                    .css( "position", "absolute" ); // gets adjusted if needed by reStick

                if ( me.stuck || me._storedTopOffset !== me._getDefaultOffset() ) {
                    // Page header may collapse
                    me.reStick();
                }

                me._setupDimensions();
                me.scrollHandler();
            };

            scrollParent$
                .on( "scroll", this.scrollHandler );

            $( window )
                .on( "apexwindowresized", this.resizeHandler );

            element
                .on( "forceresize" , this.resizeHandler )
                .css( "position" ,  "absolute" )
                .css( o.isFooter ? "bottom" : "top" , "auto" );

            this.scrollHandler();
        },
        _create: function () {
            let me = this,
                o = this.options;

            this.stuck = false;  // Simple boolean an variable to keep track of this sticky widget's stuck/unstuck state.
            this.stuckToEnd = false;
            this.cssWidth = 0;   // Store the default CSS width for the element.
            this.cssHeight = 0;  // Store the default CSS width for the element.
            this.unstuckWidth = 0; // This is the width that the replacement will use to make sure that the page is not offset incorrectly.
            this.unstuckHeight = 0; // This is the height that the replacement will use to make sure that the page is not offset incorrectly.

            this._storedTopOffset = this._getDefaultOffset();  // Stores the original offset on load, to compare with future changes.
            if ( o.isFooter ) {
                if ( !o.top ) {
                    o.top = function() {
                        let parent$ = $( this.element ).parent(), // use of this is OK because called in context of widget
                            top = parent$.offset().top;

                        if ( !this.isWindow ) {
                            top -= this.scrollParent$.offset().top - this.scrollParent$.scrollTop();
                        }
                        return top;
                    };
                }
                if ( !o.bottom ) {
                    o.bottom = function() {
                        return 0;
                    };
                }
            } else {
                if ( !o.top ) {
                    o.top = function() {
                        return apex.theme.defaultStickyTop();
                    };
                }
                if ( !o.bottom ) {
                    o.bottom = function() {
                        let parent$ = $( this.element ).parent(), // use of this is OK because called in context of widget
                            top = parent$.offset().top;

                        if ( !this.isWindow ) {
                            top -= this.scrollParent$.offset().top - this.scrollParent$.scrollTop();
                        }
                        return top + parent$.outerHeight();
                    };
                }
            }

            me._deferCreate();
        },
        _destroy: function () {
            $(window).off( "apexwindowresized", this.resizeHandler );
            this.scrollParent$.off( "scroll", this.scrollHandler );
            this.replacement.remove();
            this.element
                .removeAttr( "style" )
                .removeClass( "js-stickyWidget-toggle is-stuck" )
                .off( "forceresize", this.resizeHandler )
                .trigger( "apexstickyWidgetdestroyed" );  // trigger event, making clean up possible. // todo consider remove this event; seems not used
        }

    });
})( apex.jQuery );