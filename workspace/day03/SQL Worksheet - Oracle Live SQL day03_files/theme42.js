/*!
* Copyright (c) 2022, Oracle and/or its affiliates. All rights reserved.
* apex-ut v22.1.0
* https://apex.oracle.com/ut
*//*!
 Copyright (c) 2014, 2022, Oracle and/or its affiliates. All rights reserved.
*/

/**
 * The apex.theme42 namespace contains functions useful for theme developers or that work closely with theme
 * related functionality. The functionality in this namespace may not be fully supported by all themes particularly
 * legacy, custom, or third party themes.
 * @namespace
 **/
apex.theme42 = {};

(function ($, ut, theme) {
  "use strict";

  // All events used
  const EVENTS = {
    preload:      "theme42preload",
    utReady:      "theme42ready",
    layoutChange: "theme42layoutchanged",
    apexResized:  "apexwindowresized",
    readyEnd:     "apexreadyend",
    resize:       "resize",
    forceResize:  "forceresize",
  };

  let win$          = $(window),
      doc$          = $(document),
      body$         = $("body"),
      pageCtx$      = apex.gPageContext$,
      header$       = $("#t_Header"),
      footer$       = $("#t_Footer"),
      mainBody$     = $(".t-Body-main"),
      pageTitle$    = $("#t_Body_title"),
      treeNav$      = $("#t_TreeNav"),
      pageBody$     = $("#t_PageBody"),
      bodyContent$  = $("#t_Body_content"),
      sideCol$      = $("#t_Body_side"),
      actionsCol$   = $("#t_Body_actions"),
      scrollTitle   = body$.hasClass("t-PageBody--scrollTitle"),
      scrollAll     = body$.hasClass("t-PageBody--scrollAll"),
      marqueeRDS$   = $(".t-Body-info .apex-rds-container");

  const C_DOCUMENT_STYLES = getComputedStyle(document.documentElement);
  const C_REPLACE_UNITS = `/px|em|rem/gi`;

  let mq_xs = parseInt(C_DOCUMENT_STYLES.getPropertyValue("--js-mq-xs").replace(C_REPLACE_UNITS,""),10) || 480,
      mq_sm = parseInt(C_DOCUMENT_STYLES.getPropertyValue("--js-mq-sm").replace(C_REPLACE_UNITS,""),10) || 640,
      mq_md = parseInt(C_DOCUMENT_STYLES.getPropertyValue("--js-mq-md").replace(C_REPLACE_UNITS,""),10) || 768,
      mq_lg = parseInt(C_DOCUMENT_STYLES.getPropertyValue("--js-mq-lg").replace(C_REPLACE_UNITS,""),10) || 1200;

  ut.util = {};
  ut.page = {};

  /**
   * <p>Scroll to the anchor smoothly, taking sticky top height into account.</p>
   *
   * @function scrollTo
   * @param {string} id could be the ID of a region.
   */
  var scrollTo = function (id) {
    var elem$, elemOffset;

    if (id) {
      elem$ = document.getElementById(id.replace("#", ""));
      if (elem$) {
        elemOffset = elem$.getBoundingClientRect().top - theme.defaultStickyTop() + window.pageYOffset;
        $("html, body", pageCtx$).animate({
          scrollTop: elemOffset,
        });
      }
    }
  };

  /**
   * Returns boolean for media query
   * @param {string} mediaQueryString e.g. (min-width: 400px)
   * @return {boolean}
   */
  var mediaQuery = theme.mq;

  /**
   * Initializes passed selector with stickyWidget
   * @param {string} selector
   */
  var sticky = function (selector) {
    $(selector).stickyWidget({
      zIndexStart: 200,
      toggleWidth: true,
      stickToEnd: true,
    });
  };

  /**
   * Function checks classes on the body to determine if sticky should be turned off on select page elements
   * if it's off then it adds classes to allow elements to scroll properly and if it's on then it
   * calculaets and sets the needed css properties  for the element to remain sticky.
   *
   * Classes can be:    "t-PageBody--scrollHeader"  allows page header to scroll
   *                    "t-PageBody--scrollTitle"   allows page title and sidebars to scroll
   *                    "t-PageBody--scrollAll"     allows all elements to scroll
   *
   * @function resetHeaderOffset
   * @type {Function}
   */
  let resetHeaderOffset = function () {

    let C_UNSTUCK = "u-unstick";
    $('.'+C_UNSTUCK).removeClass(C_UNSTUCK);

    let cssVarTop    = parseInt(C_DOCUMENT_STYLES.getPropertyValue('--js-sticky-top').replace(C_REPLACE_UNITS,""),10);
    let headerHeight = header$.outerHeight() || 0;

    if (!cssVarTop || headerHeight !== cssVarTop) {
      document.querySelector(':root').style.setProperty('--js-sticky-top', headerHeight + 'px');
    }


    if (sideCol$.length) {
      let cssVarPageTitle = parseInt(C_DOCUMENT_STYLES.getPropertyValue('--js-page-title-height').replace(C_REPLACE_UNITS,""),10);
      let pageTitleHeight = pageTitle$.outerHeight() + headerHeight;

      if (!cssVarPageTitle || pageTitleHeight !== cssVarPageTitle) {
        document.querySelector(':root').style.setProperty('--js-page-title-height', pageTitleHeight + 'px');
      }
    }

    // If header scrolls then everything scrolls
    if (scrollAll) {
      header$.addClass(C_UNSTUCK);
      treeNav$.addClass(C_UNSTUCK);
      pageTitle$.addClass(C_UNSTUCK);
      sideCol$.addClass(C_UNSTUCK);

      return;
    }

    if (!mediaQuery("(min-width: " + (mq_sm + 1) + "px)")) {
      // Fix for bug 33526376, checking if template option is set
      if (!body$.hasClass("js-pageStickyMobileHeader")) {
        pageTitle$.addClass(C_UNSTUCK);
      }

      sideCol$.addClass(C_UNSTUCK);

      return;
    }

    // set page title
    if (scrollTitle) {
      pageTitle$.addClass(C_UNSTUCK);
      sideCol$.addClass(C_UNSTUCK);
    }

  };

  /**
   * Configure the display behavior of success message.
   * User may use this API to programmatically determine how long the success message gets to be displayed.
   *
   * For example, on DOM ready:
   *
   * apex.theme42.util.configAPEXMsgs({
   *   autoDismiss: true,
   *   duration: 5000
   * });
   *
   * @param {Object} [pOptions]       possible values are:
   *                                    - "autoDismiss":  Boolean to specify if the success message should be dismissed
   *                                                      after displaying for certain duration.
   *                                    - "duration":     Number. Default is 3000. Duration in milliseconds.
   *
   *                                    If the message div is clicked, has focus, or on mouse over,
   *                                    it won't get dismissed, while clicking out side, and on mouse out will resume
   *                                    the dismissing behavior.
   */
  var configAPEXMsgs = function (pOptions) {

    let alertSuccess$ = $("#t_Alert_Success"),
        timeOut;

    if (!ut.page.APEXMsgConfig) {
      ut.page.APEXMsgConfig = {};
    }

    if (pOptions) {
      // save options, in case user wants to use JS to invoke another success message,
      // which should still honor these options.
      ut.page.APEXMsgConfig = pOptions;

      if (pOptions.autoDismiss && alertSuccess$[0]) {
        var hide = function () {
          timeOut = setTimeout(function () {
            apex.message.hidePageSuccess();
            alertSuccess$.off();
            doc$.off("click", hide);
          }, pOptions.duration || 3000);
        };

        var clear = function () {
          clearTimeout(timeOut);
        };

        hide();

        alertSuccess$
          .on("click", function (e) {
            e.stopPropagation();
            ut.page.APEXMsgConfig.clicked = true;
            clear();
          })
          .on("mouseover", clear)
          .on("mouseout", function () {
            if (!ut.page.APEXMsgConfig.clicked) {
              hide();
            }
          })
          .find(".t-Button--closeAlert")
          .on("focus", clear)
          .on("click", function () {
            apex.message.hidePageSuccess();
          });

        doc$.on("click", hide);
      }
    }
  };

  /*
   * Expose utility functions
   */
  ut.util.scrollTo       = scrollTo;
  ut.util.mq             = mediaQuery;
  ut.util.fixLayout      = resetHeaderOffset;
  ut.util.configAPEXMsgs = configAPEXMsgs;
  ut.util.sticky         = sticky;

  ut.configureSuccessMessages = configAPEXMsgs;

  /**
   * Exposes sticky for legacy support, new development should all use ut.util.sticky
   */
  ut.sticky = sticky;

  /**
   * Wrappers for apex.navigation.dialog
   *
   * Used to overcome the inability to set dialog classes based on template options.
   * Template options get added as classes to the body element.
   * This function scans these classes for some special `js-` classes.
   * If any of them match, they either override the dialog options or add new dialog classes
   *  *before* the dialog is opened, allowing for things like transitions.
   *
   * @param {string} url
   * @param {Object} options
   * @param {string} templateOptions    The template options classes of the dialog page
   * @param {string} triggeringElement
   *
   */
  ut.dialog = (url, options, templateOptions = "", triggeringElement) => {

    // workaround for the limited size of the Dialog Initialization Code attribute
    options.height = options.h;
    options.width = options.w;
    options.maxWidth = options.mxw;
    options.dialogClass = options.dlgCls;
    delete options.h;
    delete options.w;
    delete options.mxw;
    delete options.dlgCls;

    let size,
      defaults = {
        width:          500,
        maxWidth:       1500,
        height:         500,
        modal:          false,
        draggable:      options.dialogClass.includes("t-Drawer") ? false : true, // Bug 33551894
        resizable:      false,
        scroll:         "auto",
        closeOnEscape:  true,
        dialog:         null,
        dialogClass:    ""
    },
    finalOptions  = $.extend( defaults, options );

    if( templateOptions.includes("js-modal") ){
      finalOptions.modal = true;
    }
    if( templateOptions.includes("js-draggable") ){
      finalOptions.draggable = true;
    }
    if( templateOptions.includes("js-resizable") ){
      finalOptions.resizable = true;
    }

    size = /js-dialog-size(\d+)x(\d+)/.exec( templateOptions );

    if(size){
      finalOptions.width = size[1];
      finalOptions.height = size[2];
    }

    // move up any page body classes starting with js-dialog-class, to the dialog level
    templateOptions.split(" ").forEach( jsCls => {
      let cls = /js-dialog-class-(.+)/.exec( jsCls );
      if (cls) {
        finalOptions.dialogClass += " " + cls[1];
      }
    });

    // leaving the 3rd parameter (pCssClasses) empty, as the dialog classes
    //  are already included in finalOptions.dialogClass
    apex.navigation.dialog(url, finalOptions, null, triggeringElement);
  };

  ut.dialog.close = (...args) => {
    apex.navigation.dialog.close(...args);
  };

  ut.dialog.cancel = (...args) => {
    apex.navigation.dialog.cancel(...args);
  };

  /**
   * Functions to open and close an inline modal dialog on the page
   * @param {string} pDialogId
   */
  window.openModal  = (pDialogId) => $("#" + pDialogId).dialog("open");
  window.closeModal = () => $(".ui-dialog-content").dialog("close");

  /**
   * Function return bool - true if treeNav$
   */
  let hasTreeNav = () => treeNav$.length > 0;

  /**
   * Function returns a bool
   */
  let isSmall = () => {

    let small = mediaQuery("(max-width: " + (mq_sm - 1) + "px)") ||
                (hasTreeNav() &&
                    pageBody$.hasClass("t-PageBody--showLeft") &&
                    mediaQuery("(max-width: " + (mq_lg - 1) + "px)")
                ) ? true : false;

    return small;
  };

  /**
   * Determine the base window Y value for all stickied elements to stick.
   * @type {Function}
   */
   let getFixedHeight = function () {
    let headerHeight = $("header").outerHeight(),
        rdsHeight = ( marqueeRDS$.length > 0 ) ? marqueeRDS$.outerHeight() : 0,
        pageTitleHeight = ( pageTitle$.css( "position" ) === 'sticky' ) ? pageTitle$.outerHeight() : 0;


    if (isSmall()) {
      if (pageBody$.hasClass("js-HeaderContracted")) {
        return rdsHeight + pageTitleHeight;
      }

      return headerHeight + rdsHeight + pageTitleHeight;
    }

    if ($(".js-stickyTableHeader").length > 0) {
      rdsHeight -= 1;
    }

    return pageTitleHeight + headerHeight + rdsHeight;
  };


  theme.defaultStickyTop = getFixedHeight;

  /**
   * Function that delays resize event triggers to allow any CSS animations to complete
   * this is necessary to be able to get the correct calculations for heights and widths
   */
  var delayResize = function () {

    var delay = function () {
      var forceResize = EVENTS.forceResize;
      $(".js-stickyWidget-toggle").each(function () {
        $(this).trigger(forceResize);
      });

      $(".js-stickyTableHeader").each(function () {
        $(this).trigger(forceResize);
      });

      $(".a-MenuBar").menu(EVENTS.resize);
    };

    apex.util.debounce(delay, 201)();
  };

  /**
   * Function takes in a jQuery selector and a class string and creates a badge for each
   * of the DOM elements with that selector and assigns the passed string
   *
   * @function renderBadges
   * @param {object} children$
   * @param {string} labelClass
   */
  var renderBadges = function (children$, labelClass) {

    children$.each(function () {
      var label = this.innerHTML;

      if (label.indexOf(`<span class="${labelClass}">`) !== -1)  {
        return;
      }

      var regex = /\[(.*)\]/,
        match = regex.exec(label);
      if (match !== null && match.length > 1) {
        if (match[1] === "") {
          this.innerHTML = label.replace(regex, "");
        } else {
          label = label.replace(/\[.*\]/, "") + `<span class="${labelClass}">${match[1]}</span>`;
          this.innerHTML = label;
        }
      }
    });
  };

  /**
   * Function takes in the current html DOM element and then replaces
   * it with a new element from the of the passed tag with all of the
   * same attributes as the original.
   *
   * @function replaceTag
   * @param {string} tag
   * @param {object} curr
   */
  let replaceTag = (tag, curr) => {
      let text = curr.innerHTML;
      let newEle = document.createElement(tag);
      newEle.innerHTML = text;
      if (curr.hasAttributes()) {
          let attr = curr.attributes;
          for (let i = attr.length - 1; i >= 0; i--) {
              newEle.setAttribute(attr[i].name, attr[i].value);
          }
      }
      curr.replaceWith(newEle);
  };

  /**
   *
   * Function takes in a jquery object and gets the classes for that element
   * it returns a string based on the existence of one of 6 classes.
   *
   * @function getHeadingLevel
   * @param {object} ele
   */
  let getHeadingLevel = (ele) => {
      let classes = ele[0].className;
      if (classes.includes('js-headingLevel-1')) {
        return 'h1';
      }
      if (classes.includes('js-headingLevel-2')) {
        return 'h2';
      }
      if (classes.includes('js-headingLevel-3')) {
        return 'h3';
      }
      if (classes.includes('js-headingLevel-4')) {
        return 'h4';
      }
      if (classes.includes('js-headingLevel-5')) {
        return 'h5';
      }
      if (classes.includes('js-headingLevel-6')) {
        return 'h6';
      }
      return 'h1';
  };


  /**
   *
   * Function to remove all landmark labels when hidden from view and readers
   * runs for each region with the class
   *
   * @function removeLandmark
   */
  let removeLandmark = () => {
    $.each($("div[class*=js-removeLandmark]"), function() {
      this.removeAttribute("aria-label");
      this.removeAttribute("role");
    });
  };

  /**
   * Widgets that are "toggled" to active or not active depending on the state of the page.
   */
  var toggleWidgets = (function () {

    var RIGHT_CONTROL_BUTTON = "#t_Button_rightControlButton",
        A_CONTROLS           = "aria-controls",
        A_EXPANDED           = "aria-expanded",
        A_HIDDEN             = "aria-hidden",
        TREE_NAV_WIDGET_KEY  = "nav",
        RIGHT_WIDGET_KEY     = "right",
        C_TREE_NAV           = "#t_TreeNav";

    var isCollapsedByDefault = $(C_TREE_NAV).hasClass("js-defaultCollapsed"), // comes from APEX template options
        pushModal,
        toggleWidgets = {};

    /**
     * Checks if the toggleWidget specified by key has been built, if it has then call its collapse event.
     * @param key
     */
    var collapseWidget = function (pKey, pSaveUserPreference) {
      if (pKey in toggleWidgets) {
        toggleWidgets[pKey].collapse(pSaveUserPreference);
      }
    };

    /**
     * Checks if the toggleWidget specified by key has been built, if it has then call its expand event.
     * @param key
     */
    var expandWidget = function (pKey, pSaveUserPreference) {
      if (pKey in toggleWidgets) {
        toggleWidgets[pKey].expand(pSaveUserPreference);
      }
    };

    /**
     * To recognize that a toggle widget exists and to initialize so that it works in the context of the current page
     * i.e. "build" it, pass in an object literal to buildToggleWidgets with the following key/values.
     *      "key",                  allows this widget to be expanded or collapsed during run time
     *                              from any other function using collapseWidget(YOUR_KEY) or expandWidget(YOUR_KEY)
     *      "checkForElement",      the element id, class (or arbitrary jquery selector)
     *                              which must exist for this toggleWidget to be initialized.
     *
     *                              All other attributes are used for ToggleCore.
     *
     * NOTE: Right now buildToggleWidget assumes that none of these key/values will be null or undefined!
     *
     * @param options
     * @returns {boolean} true if the element to check for exists on the page and the toggle widget has been built, false if otherwise.
     */
    var buildToggleWidget = function (options) {

      var checkForElement = options.checkForElement,
          key             = options.key,
          button$         = $(options.buttonId),
          widget,
          expandOriginal   = options.onExpand,
          collapseOriginal = options.onCollapse;

      var element$ = $(checkForElement);

      if (!element$ || element$.length <= 0) {
        return false;
      }

      options.controllingElement = button$;
      button$.attr(A_CONTROLS, element$.attr("id"));

      options.content = pageBody$;
      options.contentClassExpanded = "js-" + key + "Expanded";
      options.contentClassCollapsed = "js-" + key + "Collapsed";
      options.onExpand = function () {
        expandOriginal();
        button$.addClass("is-active").attr(A_EXPANDED, "true");
        pushModal.notify();
      };
      options.onCollapse = function () {
        collapseOriginal();
        button$.removeClass("is-active").attr(A_EXPANDED, "false");
        pushModal.notify();
      };

      widget = ToggleCore(options);
      toggleWidgets[key] = widget;
      return true;
    };

    /**
     * ToggleWidgets Initialization function. Creates template toggle widgets if their regions exist.
     */
    var initialize = function () {

      if (
        pageBody$.length <= 0 &&
        mainBody$.length <= 0 &&
        header$.length <= 0 &&
        bodyContent$.length <= 0
      ) {
        return;
      }

      var pushModal$ = $(
        `<div id="pushModal" style="width: 100%; display:none; height: 100%;" class="u-DisplayNone u-Overlay--glass"></div>`
      );

      $("body").append(pushModal$);


      win$.bind(EVENTS.apexResized, function () {
        for (var key in toggleWidgets) {
          if (Object.prototype.hasOwnProperty.call(toggleWidgets, key)) {
            toggleWidgets[key].resize();
          }
        }
        pushModal.notify();
      });

      pushModal = {
        el$: pushModal$,
        collapse: function () {},
        expand: function () {},
        shouldShow: ut.screenIsSmall,
        notify: function () {},
      };

      var NAV_CONTROL_BUTTON = "#t_Button_treeNavControl";

      if ($("#t_Button_navControl").length > 0) {
        if ($(".t-Header-nav-list.a-MenuBar").length <= 0) {
          NAV_CONTROL_BUTTON = "#t_Button_navControl";
        }
      }

      let treeShouldBeHidden = () => mediaQuery("(max-width: " + (mq_xs - 1) + "px)");

      let treeIsHidden = () => treeNav$.css("visibility") === "hidden";

      let showTree = () => treeNav$.css("visibility", "inherit").attr(A_HIDDEN, "false");

      let collapseTree = () => collapseWidget(TREE_NAV_WIDGET_KEY);

      var treeIsHiding = false;

      var handleTreeVisibility = function () {
        var screenIsTooSmallForTheTree = treeShouldBeHidden();

        if (screenIsTooSmallForTheTree && !treeIsHidden() && !treeIsHiding) {
          treeIsHiding = true;
          setTimeout(function () {
            treeIsHiding = false;
            if (!toggleWidgets[TREE_NAV_WIDGET_KEY].isExpanded()) {
              treeNav$.css("visibility", "hidden").attr(A_HIDDEN, "true");
            }
          }, 400);
          $(".t-Body-main").off("click", collapseTree);
        } else if (!screenIsTooSmallForTheTree) {
          showTree();
        }
      };

      /**
       * Create TreeNav Toggle Widget
       */
      var hasTree = buildToggleWidget({
          key: TREE_NAV_WIDGET_KEY,
          checkForElement: C_TREE_NAV,
          buttonId: NAV_CONTROL_BUTTON,
          defaultExpandedPreference: !isCollapsedByDefault,
          isPreferenceGlobal: true,

          onClick: function () {
            if (
              mediaQuery("(max-width: " + (mq_lg - 1) + "px)") &&
              RIGHT_WIDGET_KEY in toggleWidgets &&
              toggleWidgets[RIGHT_WIDGET_KEY].isExpanded()
            ) {
              toggleWidgets[RIGHT_WIDGET_KEY].toggle();
            }
          },

          onExpand: function () {
            if (mediaQuery("(max-width: " + (mq_lg - 1) + "px)")) {
              collapseWidget(RIGHT_WIDGET_KEY);
            }
            treeNav$.treeView("expand", treeNav$.treeView("getSelection"));
            showTree();
            delayResize();
            treeNav$.trigger(EVENTS.layoutChange, { action: "expand" });

            if (!mediaQuery("(min-width: " + mq_sm + "px)")) {
              $(".t-Body-main").on("click", collapseTree);
            }
            treeNav$.attr(A_HIDDEN, "false");
          },

          onCollapse: function () {
            treeNav$.treeView("collapseAll");
            delayResize();
            handleTreeVisibility();
            treeNav$.trigger(EVENTS.layoutChange, { action: "collapse" });
            $(".t-Body-main").off("click", collapseTree);
            treeNav$.attr(A_HIDDEN, "true");
          },

          onResize: function () {
            var usingTreeNav = pageBody$.hasClass("t-PageBody--leftNav");
            if (usingTreeNav) {
              if (mediaQuery("(max-width: " + (mq_lg - 1) + "px)")) {
                this.collapse();
              } else {
                if (this.doesUserPreferExpanded()) {
                  this.expand();
                }
              }
            }
            handleTreeVisibility();
            resetHeaderOffset();
          },

          onInitialize: function () {
            var preferExpanded = this.doesUserPreferExpanded();
            if (mediaQuery("(min-width: " + mq_lg + "px)")) {
              if (preferExpanded) {
                this.expand();
              } else {
                this.forceCollapse();
              }
            } else {

              this.forceCollapse();
            }
          },
        });

      /**
       * If the tree widget does not exist, the page MUST be using a MENU_NAV_WIDGET_KEY.
       * - initializes peeking header for small screens
       * - configures and initializes toggle core behavior
       */
      if (!hasTree) {
        var headerCore = null;

        var peekHeaderInit = function () {
            if (
              mediaQuery("(min-width: " + mq_sm + "px)") &&
              headerCore === null
            ) {
              var lastScrollTop = 0,
                handlerId = null;

              var recal = function () {
                $(".js-stickyWidget-toggle").stickyWidget("reStick");
              };

              headerCore = ToggleCore({
                content: pageBody$,
                contentClassExpanded: "js-HeaderExpanded",
                contentClassCollapsed: "js-HeaderContracted",
                useSessionStorage: false,
                defaultExpandedPreference: true,
                onCollapse: recal,
                onExpand: recal,
              });

              headerCore.initialize();

              var peekingHeader = function () {
                handlerId = null;
                var scrollTop = win$.scrollTop();
                if (lastScrollTop > scrollTop || scrollTop < 100) {
                  headerCore.expand();
                } else {
                  headerCore.collapse();
                }
                lastScrollTop = scrollTop;
              };

              win$.scroll(function () {
                if (!handlerId) {
                  handlerId = apex.util.invokeAfterPaint(peekingHeader);
                }
              });
            }
        };

        win$.on(EVENTS.apexResized, peekHeaderInit);

        peekHeaderInit();

        if (!body$.hasClass("t-PageBody--noNav")) {
          body$.addClass("t-PageBody--topNav");
        }

        win$.on(EVENTS.apexResized, resetHeaderOffset);
      } else {

        treeNav$.on(
          "treeviewexpansionstatechange",
          function (jqueryEvent, treeViewEvent) {
            if (treeViewEvent.expanded) {
              toggleWidgets[TREE_NAV_WIDGET_KEY].expand();
            }
          }
        );
      }

      var rightShouldBeOpenOnStart = mediaQuery("(min-width: " + mq_lg + "px)"),
        actionsContent$ = $(".t-Body-actionsContent");

      /**
       * Build the right actions column toggle widget
       */
      buildToggleWidget({
        key: RIGHT_WIDGET_KEY,
        checkForElement: ".t-Body-actionsContent",
        buttonId: RIGHT_CONTROL_BUTTON,
        defaultExpandedPreference: rightShouldBeOpenOnStart,
        onClick: function () {
          if (
            mediaQuery("(max-width: " + (mq_lg - 1) + "px)") &&
            TREE_NAV_WIDGET_KEY in toggleWidgets &&
            toggleWidgets[TREE_NAV_WIDGET_KEY].isExpanded()
          ) {
            toggleWidgets[TREE_NAV_WIDGET_KEY].toggle();
          }
        },
        onExpand: function () {
          if (mediaQuery("(max-width: " + (mq_lg - 1) + "px)")) {
            if (pageBody$.hasClass("js-navExpanded")) {
              collapseWidget(TREE_NAV_WIDGET_KEY);
            }
          }
          actionsContent$
            .css({ visibility: "inherit", overflow: "inherit" })
            .attr(A_HIDDEN, "false");
          delayResize();
          apex.widget.util.visibilityChange( actionsContent$, true );
        },
        onCollapse: function () {
          delayResize();
          actionsContent$.attr(A_HIDDEN, "true");
          if (!toggleWidgets[RIGHT_WIDGET_KEY].isExpanded()) {
            actionsContent$.css({ visibility: "hidden", overflow: "hidden" });
          }
          apex.widget.util.visibilityChange( actionsContent$, false );
        },
        onResize: function () {
          /**
           * Window resize should have nothing to do with right action column
           * Typing in text field may trigger resize in some mobile browser,
           * therefore collapsing the column, which is unexpected behavior.
           * See Bug 27911046
           */
        },
        onInitialize: function () {
          if (
            TREE_NAV_WIDGET_KEY in toggleWidgets &&
            toggleWidgets[TREE_NAV_WIDGET_KEY].isExpanded() &&
            mediaQuery("(max-width: " + (mq_lg - 1) + "px)")
          ) {
            this.forceCollapse();
          } else {
            if (this.doesUserPreferExpanded()) {
              this.forceExpand();
            } else {
              this.forceCollapse();
            }
          }
        },
      });
      for (var key in toggleWidgets) {
        if (Object.prototype.hasOwnProperty.call(toggleWidgets, key)) {
          toggleWidgets[key].initialize();
        }
      }
    };

    return {
      initialize: initialize,
      expandWidget: expandWidget,
      collapseWidget: collapseWidget,
      setPreference: function (key, value) {
        if (key in toggleWidgets) {
          toggleWidgets[key].setUserPreference(value);
        }
      },
      isExpanded: function (key) {
        if (key in toggleWidgets) {
          return toggleWidgets[key].isExpanded();
        }
      },
    };
  })();

  (function () {
    /**
     * A list of all the possible page templates. If you create a new template, you must call
     * apex.theme42.pages.<your template name here>() prior to the jQuery onReady event
     */
    var pages = {
        masterDetail: {},
        leftSideCol:  {},
        rightSideCol: {},
        noSideCol:    {},
        appLogin:     {},
        wizardPage:   {},
        wizardModal:  {},
        bothSideCols: {},
        popUp:        {},
        modalDialog:  {},
    };

    var initAutoSize = function () {
      theme.modalAutoSize({
        observeClass: ".t-Dialog-body",
        sections: [".t-Dialog-body", ".t-Dialog-header", ".t-Dialog-footer"],
      });
    };

    /**
     * Function sets initAutoSize to onThem42Ready Prop of the modalDialog
     */
    pages.modalDialog = {
      onTheme42Ready: initAutoSize,
    };

    /**
     * Function sets initAutoSize to onReady Prop of the wizardModal
     */
    pages.wizardModal = {
      onReady: initAutoSize,
    };

    /**
     * Sets onTheme42Ready prop function for masterDetail
     *  - creates event listener for tabschange event
     *  - initializes sticky content for table headers and status list header
     */
    pages.masterDetail = {
      onTheme42Ready: function () {

        var rds$ = $(".t-Body-info .apex-rds");

        rds$.on("tabschange", function (activeTab, mode) {
          if (mode !== "jump") {
            $(".t-StatusList-blockHeader,.js-stickyTableHeader").trigger(
              EVENTS.forceResize
            );
          }
        });

        sticky(".t-Body-contentInner .t-StatusList .t-StatusList-blockHeader");

        $(".t-Body-contentInner .t-Report-tableWrap").setTableHeadersAsFixed();

        sticky(".js-stickyTableHeader");

        rds$.aTabs("option", "showAllScrollOffset", function () {
          var rdsOffset = mediaQuery("(min-width: " + mq_sm + "px)")
              ? rds$.outerHeight()
              : 0,
            tHeight = $("#t_Body_info").outerHeight() - rdsOffset;

          if ($(window).scrollTop() > tHeight) {
            return tHeight;
          }
          return false;
        });

        /**
         * initialize sticky RDS
         */
        if (marqueeRDS$.length > 0) {
          marqueeRDS$.stickyWidget({
            toggleWidth: true,
            top: function () {
              return getFixedHeight() - marqueeRDS$.outerHeight();
            },
          });
        }
      },
    };

    /**
     * Prepares all the different page modules for DOM load.
     */
    ut.initializePage = (function () {

      var wrapFunc = function (key) {
        return function () {
          var onReady = pages[key].onReady,
            onTheme42Ready = pages[key].onTheme42Ready;
          if (onReady !== undefined) {
            onReady();
          }
          if (onTheme42Ready !== undefined) {
            win$.on(EVENTS.utReady, function () {
              onTheme42Ready();
            });
          }
        };
      };
      var returnPages = {};

      for (var key in pages) {
        if (Object.prototype.hasOwnProperty.call(pages, key)) {
          returnPages[key] = wrapFunc(key);
        }
      }

      return returnPages;
    })();
  })();

  /**
   * Function that runs on Doc Ready
   * @function ut_doc_ready_init
   */
  var ut_doc_ready_init = {
    /**
     * Function prepares the UI by adding and removing classes as needed
     * and sets the functionality for the skip to content button
     * also handles tag swap based on data-apex-heading
     */
    prepUI: function () {


      $("html").removeClass("no-js");

      // Top offset spacer
      $("#t_Body_content").prepend(
        `<div id="t_Body_content_offset"></div>`
      );

      if (body$.hasClass("t-PageBody--noNav")) {
        body$.removeClass("apex-side-nav");
      }

      actionsCol$.show();

      // Skip to Link
      $("#t_Body_skipToContent").click(function (e) {
        e.preventDefault();

        pageTitle$
          .attr("tabindex", "-1")
          .focus(function () {
            pageTitle$.on("blur focusout", function () {
              pageTitle$.removeAttr("tabindex");
            });
          })
          .focus();
      });

      // Change Heading Level
      $.each($('div[class*=js-headingLevel]'), function(index, value) {
        let headingElem = $(value).find('[data-apex-heading]')[0];
        let headingTag = getHeadingLevel($(value));
        replaceTag(headingTag, headingElem);
      });

      // Remove Landmark
      if (document.getElementsByClassName("js-removeLandmark").length > 0) {
        removeLandmark();
      }

      resetHeaderOffset();
    },

    /**
     * Function sets top menu classes and creates label badges
     */
    topMenu: function () {

      if (hasTreeNav() && $.menu) {
        return;
      }

      var render = function () {
        renderBadges($(".t-Header-nav .a-MenuBar-label"), "t-Menu-badge");
      };

      var menubar$ = $(".t-Header-nav-list", "#t_Header");

      if (!menubar$.is(":data('ui-menu')")) {
        win$.on("menucreate apexwindowresized", menubar$, function () {
          render();
        });
      } else {
        render();
      }
    },

    /**
     * Function sets hide/show functionality on hide show regions
     */
    hideShow: function () {

      var hideShow$ = $(".t-Region--hideShow");
      var hideShowToggle$ = $("span.t-Button--hideShow");

      hideShow$.each(function () {
        var collapsible$    = $(this),
            useLocalStorage = collapsible$.hasClass("js-useLocalStorage");
        if (
          !collapsible$.hasClass("is-expanded") &&
          !collapsible$.hasClass("is-collapsed")
        ) {
          collapsible$.addClass("is-expanded");
        }
        collapsible$.collapsible({
          content: $(this).find(".t-Region-body").first(),
          collapsed: collapsible$.hasClass("is-collapsed"),
          rememberState: useLocalStorage,
          renderIcon: false
        });
      });

      // Inject icon class into faux toggle button
      hideShowToggle$.find(".a-Icon").addClass("a-Collapsible-icon");

      // Triggering accessible collapsible button with faux button
      hideShowToggle$.click(function () {
        $(this).closest('.t-Region-header').find('.t-Region-titleButton').click();
      });
    },

    /**
     * Function adds and removes class for success message animation
     * (consider alterntatives to to an animate-hide class)
     */
    successMessage: function () {

      var successMessage$ = $("#APEX_SUCCESS_MESSAGE");

      apex.message.setThemeHooks({
        beforeHide: function (pMsgType) {
          if (pMsgType === apex.message.TYPE.SUCCESS) {
            successMessage$.addClass("animate-hide");
          }
        },
        beforeShow: function (pMsgType) {
          if (pMsgType === apex.message.TYPE.SUCCESS) {
            var opt;

            if (ut.page.APEXMsgConfig) {
              opt = ut.page.APEXMsgConfig;
              delete opt.clicked;
            }

            successMessage$.removeClass("animate-hide");

            if (opt) {
              configAPEXMsgs(opt);
            }
          }
        },
      });
    },

    items: function () {

      const DATA_DISPLAY = "data-display-as",
      CL_PICKER_WRAPPER = "apex-item-wrapper--color-picker",
      CL_COLOR_ONLY_POSTFIX = "-color-only",
      CL_NATIVE_POSTFIX = "-native",
      CL_INLINE_POSTFIX = "-inline",
      CL_PICKER_COLOR_ONLY = "input[" + DATA_DISPLAY + "='COLOR_ONLY']",
      CL_PICKER_NATIVE = "input[" + DATA_DISPLAY + "='NATIVE']",
      CL_PICKER_INLINE = "input[" + DATA_DISPLAY + "='INLINE']";

      var quickPicks$ = $("span.apex-quick-picks");

      // Quick Picks to be moved below input
      quickPicks$.each(function() {
        var that$ = $(this);
        that$.insertAfter(that$.parent());
      });

      // Color Picker inline, color only and native
      $(CL_PICKER_COLOR_ONLY)
          .closest("." + CL_PICKER_WRAPPER)
          .addClass(CL_PICKER_WRAPPER + CL_COLOR_ONLY_POSTFIX);

      $(CL_PICKER_NATIVE)
          .closest("." + CL_PICKER_WRAPPER)
          .addClass(CL_PICKER_WRAPPER + CL_NATIVE_POSTFIX);

      $(CL_PICKER_INLINE)
          .closest("." + CL_PICKER_WRAPPER)
          .addClass(CL_PICKER_WRAPPER + CL_INLINE_POSTFIX);
    },

    /**
     * Function used to manage actions required on scroll to top
     */
    handleScrollTop: function () {

      if (
        $(".t-BreadcrumbRegion--compactTitle").length > 0 ||
        $(".t-BreadcrumbRegion").length < 0 ||
        pageTitle$.length < 0 ||
        !$.trim(pageTitle$.html())
      ) {
        return;
      }

      // Reset Page elements position that may depend on the changed title height
      var resetPageElements = function () {
        win$.trigger(EVENTS.apexResized);
      };

      var shrinkCore = ToggleCore({
        content: pageTitle$,
        contentClassExpanded: "",
        contentClassCollapsed: "t-Body-title-shrink",
        useSessionStorage: false,
        defaultExpandedPreference: true,
        onExpand: resetPageElements,
        onCollapse: resetPageElements,
      });

      shrinkCore.initialize();

      var shrinkThreshold = function () {
        if (shrinkCore.isExpanded()) {
          var tBodyInfoHeight = $(".t-Body-info").outerHeight() - 100;
          if (tBodyInfoHeight > 100) {
            return tBodyInfoHeight;
          }
          return 400;
        } else {
          return 0;
        }
      };

      var handlerId = null;

      var addTop = function () {
        var scrollTop = win$.scrollTop();
            handlerId = null;

        /**
         * only shrink the breadcrumbs when on a large display and when title is sticky
         * otherwise they are always displayed in compact styles
         */
        if (
          !scrollTitle ||
          !scrollAll ||
          mediaQuery("(min-width: " + mq_sm + "px)")
        ) {
          var top = shrinkThreshold();
          if (scrollTop <= top) {
            shrinkCore.expand();
          } else if (scrollTop > top) {
            shrinkCore.collapse();
          }
        } else {
          shrinkCore.expand();
        }
      };

      win$.scroll(function () {
        if (!handlerId) {
          handlerId = apex.util.invokeAfterPaint(addTop);
        }
      });

      addTop();
    },

    /**
     * Function manages tree navigation
     */
    treeNav$: function () {

      if ( hasTreeNav() ) {
        var navCollapseModeClass = "js-navCollapsed--hidden";
        if ( treeNav$.hasClass( navCollapseModeClass ) ) {
          treeNav$.removeClass( navCollapseModeClass );
        } else {
          navCollapseModeClass = "js-navCollapsed--icons";
        }
        body$.addClass( navCollapseModeClass );

        if ( treeNav$.hasClass("js-addActions") ) {
          apex.actions.addFromMarkup( treeNav$ );
        }

        treeNav$.treeView({
          showRoot: false,
          iconType: "fa",
          useLinks: true,
          navigation: true,
          autoCollapse: true
        });

        treeNav$
          .treeView("getSelection")
          .parents()
          .children(".a-TreeView-content")
          .addClass("is-current");

        treeNav$
          .treeView("getSelection")
          .parents(".a-TreeView-node--topLevel")
          .children(".a-TreeView-content, .a-TreeView-row")
          .removeClass("is-current")
          .addClass("is-current--top");

        $(".t-TreeNav .a-TreeView-node--topLevel > .a-TreeView-content").each(
          function () {
            if ($(this).find(".fa").length <= 0) {
              $(this).prepend(`<span class="fa fa-file-o"></span>`);
            }
          }
        );

        renderBadges($(".a-TreeView-label"), "a-TreeView-badge");

        /**
         * Badges are loaded on expansion since the tree is lazily loaded
         */
        treeNav$.on(
          "treeviewexpansionstatechange",
          function (jqueryEvent, treeViewEvent) {
            if (treeViewEvent.expanded) {
              renderBadges(
                treeViewEvent.nodeContent$.parent().find(".a-TreeView-label"),
                "a-TreeView-badge"
              );
            }
          }
        );
      }

      toggleWidgets.initialize();
    },

    /**
     * Function triggers theme.dialogAutoHeight
     */
    inlineDialogAutoHeight: function () {

      theme.dialogAutoHeight(".js-dialog-autoheight");
    },

    /**
     * Function controls the Mazimize button action
     */
    maximize: function () {


      var maximizeKey = 0;
      var current;
      var maximizableRegions$ = $(".js-showMaximizeButton");
      var applyJqueryUiFocusableFix = function () {
        var focusable = function (element, isTabIndexNotNaN) {
          var nodeName = element.nodeName.toLowerCase();
          return (
            (/^(input|select|textarea|button|object)$/.test(nodeName)
              ? !element.disabled
              : "a" === nodeName
              ? element.href || isTabIndexNotNaN
              : isTabIndexNotNaN) && $.expr.filters.visible(element)
          );
        };
        $.extend($.expr[":"], {
          focusable: focusable,
          tabbable: function (element) {
            var tabIndex = $.attr(element, "tabindex"),
              isTabIndexNaN = isNaN(tabIndex);
            return (
              (isTabIndexNaN || tabIndex >= 0) &&
              focusable(element, !isTabIndexNaN)
            );
          },
        });
      };
      var hideAllExceptChildren = function (content$) {
        maximizableRegions$.css("visibility", "hidden");
        content$
          .css("visibility", "visible")
          .find(".js-showMaximizeButton")
          .css("visibility", "visible");
      };
      var makeCurrent = function (core, content$, top) {
        var buildCurrent = function () {
          var tabbable$ = content$.find(":tabbable");
          return {
            core: core,
            content$: content$,
            top: top,
            first: tabbable$.first()[0],
            last: tabbable$.last()[0],
          };
        };
        if (!current) {
          current = buildCurrent();
          pageBody$.addClass("js-regionIsMaximized");
        } else {
          var old = current;
          current.next = buildCurrent();
          current = current.next;
          current.previous = old;
        }
        theme.defaultStickyTop = top;
        hideAllExceptChildren(current.content$);
      };
      if (maximizableRegions$.length > 0) {
        applyJqueryUiFocusableFix();
      }
      // Adds maximize button to all maximizable regions
      maximizableRegions$.each(function () {
        var content$ = $(this);
        var isIRR = content$.hasClass("t-IRR-region");
        var fthOnResize;
        var injectButtonSelector = ".js-maximizeButtonContainer";
        if (isIRR) {
          injectButtonSelector = ".a-IRR-buttons";
          if (content$.find(injectButtonSelector).length <= 0) {
            content$
              .find(".a-IRR-toolbar")
              .append(`<div class="a-IRR-buttons"></div>`);
          }
        }
        var maximize$ = content$.find(injectButtonSelector).first();
        var regionId = content$.attr("id");
        var maximizeButton$ = $(
          `<button
            class="t-Button t-Button--noLabel t-Button--icon t-Button--iconOnly t-Button--noUI"
            aria-expanded="false"
            aria-controls="${regionId}"
            type="button">
            <span class="t-Icon a-Icon" aria-hidden="true"></span>
          </button>`
        );
        maximize$.append(maximizeButton$);
        var switchToPrevious = function () {
          if (current) {
            if (current.previous) {
              current.previous.next = null;
              content$
                .find(".js-stickyWidget-toggle")
                .stickyWidget(
                  "forceScrollParent",
                  content$.parents(".t-Region-bodyWrap").first()
                );
              hideAllExceptChildren(current.previous.content$);
              theme.defaultStickyTop = current.previous.top;
            } else {
              theme.defaultStickyTop = getFixedHeight;
              $(".js-stickyWidget-toggle").stickyWidget(
                "forceScrollParent",
                null
              );
              pageBody$.removeClass("js-regionIsMaximized");
              maximizableRegions$.css("visibility", "visible");
            }
            win$.trigger(EVENTS.apexResized);
            current = current.previous;
          }
        };
        var getCollapsible = function () {
          return content$
            .find(".a-IRR-controlsContainer.a-Collapsible")
            .first();
        };
        var resetIRRHeight = function (fthBody$) {
          content$.css("overflow", "auto");
          fthBody$.css("height", "auto");
        };
        var fthOnResizeDebouncer;
        var forceIRRHeight = function () {
          fthOnResize = function () {
            clearTimeout(fthOnResizeDebouncer); // Need to debounce this b
            var safeHeight = function (element$) {
              return element$.length > 0 ? element$.outerHeight() : 0;
            };
            setTimeout(function () {
              var fthBody$ = content$.find(".t-fht-tbody"); // Only used when fixed table headers is active on an IRR!!!
              if (fthBody$.length > 0) {
                content$.css("overflow", "hidden");
                var head = safeHeight(content$.find(".t-fht-thead"));
                var pagWrap = safeHeight(
                  content$.find(".a-IRR-paginationWrap")
                );
                var irrToolBar = safeHeight(content$.find(".a-IRR-toolbar"));
                var controlsContainer = safeHeight(
                  content$.find(".a-IRR-controlsContainer")
                );
                if (mediaQuery("(min-width: " + mq_md + "px)")) {
                  var height = $(window).height();
                  fthBody$.css(
                    "height",
                    height - irrToolBar - controlsContainer - pagWrap - head - 2
                  );
                } else {
                  resetIRRHeight(fthBody$);
                }
              }
            }, 200);
          };
          getCollapsible()
            .on("collapsibleexpand", fthOnResize)
            .on("collapsiblecollapse", fthOnResize);
          win$.on(EVENTS.apexResized, fthOnResize);
        };
        var disableForcedIrrHeight = function () {
          if (current && isIRR && content$) {
            resetIRRHeight(content$.find(".t-fht-tbody"));
            win$.off(EVENTS.apexResized, fthOnResize);
            getCollapsible()
              .off("collapsibleexpand", fthOnResize)
              .off("collapsiblecollapse", fthOnResize);
          }
        };
        var forceResize = function () {
          win$.trigger(EVENTS.apexResized).trigger(EVENTS.resize); // For plugins that are not hooked into the apexwindowresized debouncer.
        };
        let header$ = content$.find(".t-Region-header");
        let maximizeCore = ToggleCore({
          key: "maximize_" + (maximizeKey += 1),
          content: content$,
          contentClassExpanded: "is-maximized",
          useSessionStorage: false,
          defaultExpandedPreference: false,
          controllingElement: maximizeButton$,
          onExpand: function () {
            apex.navigation.beginFreezeScroll();
            maximizeButton$
              .attr("title", apex.lang.getMessage("RESTORE"))
              .attr("aria-label", apex.lang.getMessage("RESTORE"))
              .attr("aria-expanded", true)
              .find(".t-Icon")
              .removeClass("icon-maximize")
              .addClass("icon-restore");
            let top = function () {
              let height = header$.outerHeight();
              if (!height) {
                return 0;
              }
              return height;
            };
            let scrollParent$;
            let isIG = content$.find('.a-IG').length > 0;
            if (isIRR) {
              scrollParent$ = content$;
              forceIRRHeight();
              content$.find(".container").first().hide();
            } else if (isIG) {
              scrollParent$ = content$.find(".t-Region-bodyWrap").first().find('.t-Region-body');
              content$.find(".a-IG-gridView.a-GV").grid( "option", "scrollParentOverride", scrollParent$ );
            } else {
              scrollParent$ = content$.find(".t-Region-bodyWrap").first();
            }
            content$
              .find(".js-stickyWidget-toggle")
              .stickyWidget("forceScrollParent", scrollParent$);
            forceResize();
            makeCurrent(maximizeCore, content$, top);
          },
          onCollapse: function () {
            // This presumes that any collapse is always the active one!
            // We can get away with this because the maximized regions are structured to overlay on top of each other
            // completely.
            apex.navigation.endFreezeScroll();
            maximizeButton$
              .attr("title", apex.lang.getMessage("MAXIMIZE"))
              .attr("aria-label", apex.lang.getMessage("MAXIMIZE"))
              .attr("aria-expanded", false)
              .find(".t-Icon")
              .addClass("icon-maximize")
              .removeClass("icon-restore");
            disableForcedIrrHeight();
            if (isIRR) {
              content$.find(".container").first().show();
            }
            forceResize();
            switchToPrevious();
          },
        });
        maximizeCore.initialize();
      });

      // Handles keyboard actions for mazimized region
      doc$.on("keydown", function (event) {
        if (current) {
          // If Excape key
          if (event.which === $.ui.keyCode.ESCAPE) {
            current.core.collapse();
            event.preventDefault();
            return false;
          // If Tab key
          } else if (event.which === $.ui.keyCode.TAB) {
            if (event.shiftKey && event.target === current.first) {
              event.preventDefault();
              current.first.focus();
            } else if (!event.shiftKey) {
              if (current.last === event.target) {
                event.preventDefault();
                current.last.focus();
              }
            }
          }
        }
      });
    },

    /**
     * Function ides pagination links when there is no pagination available
     */
    hidePagination: function () {
      var hidePagination = function( regionId ){
        var pagination$ = $( "#" + regionId ).find( ".t-Report-pagination" );
        if ( pagination$.find( "td" ).length > 0 && !(pagination$.find( "td.pagination > a" ).length > 0 || pagination$.find( "td.pagination > select" ).length > 0) ) {
          pagination$.addClass( "u-hidden" );
        }
      };

      // Handle pagination for each report which has the template option set
      $( ".t-Report--hideNoPagination" ).each(function(){
        var regionId = $( this ).data( "region-id" );
        hidePagination( regionId );
        $( "#" + regionId ).on( "apexafterrefresh" , function(){
          hidePagination( regionId );
        });
      });
    },

    /**
     * Function handles adding mobile specific classes and template functionality
     */
    mobile: function () {
      var navTabs$ = $(".t-NavTabs"),
        stickyButtonContainer$ = $(".t-ButtonRegion--stickToBottom");

      var getNavTabsHeight = function (padding) {
        var navHeight = 0,
          navPadding = padding || 0;

        if (mediaQuery("(max-width: " + (mq_md - 1) + "px)")) {
          navHeight = navTabs$.outerHeight() || 0;
        }
        if (navHeight > 0) {
          navHeight += navPadding;
        }
        return navHeight;
      };

      // Template Option: Sticky Mobile Header Makes the body title sticky on small screens
      if (body$.hasClass("js-pageStickyMobileHeader")) {
        var stickyMobileHeader = function () {
          var stickyMobileTitle = function () {
            var isSticky = pageTitle$.data("apexStickyWidget") ? true : false;

            if (!mediaQuery("(max-width: " + (mq_sm - 1) + "px)")) {
              if (isSticky) {
                setTimeout(resetHeaderOffset, 50);
              }
            }

          };

          stickyMobileTitle();

          win$.on("theme42layoutchanged apexwindowresized", stickyMobileTitle);
        };

        stickyMobileHeader();
      }

      // Template Option: Stick to Bottom for button container region
      if (stickyButtonContainer$[0]) {
        var stickyMobileFooter = function () {
          var footerBottomOffset = getNavTabsHeight();

          footer$.css("padding-bottom", footerBottomOffset || "");

          if (mediaQuery("(max-width: " + (mq_md - 1) + "px)")) {
            stickyButtonContainer$
              .addClass("is-anchored")
              .css("bottom", footerBottomOffset);
            footer$.css(
              "padding-bottom",
              footerBottomOffset + stickyButtonContainer$.outerHeight() + 16
            );
          } else {
            stickyButtonContainer$.removeClass("is-anchored").css("bottom", "");
            footer$.css("padding-bottom", "");
          }
        };

        stickyMobileFooter();
        win$.on(EVENTS.apexResized, stickyMobileFooter);
      }

      // When using the Nav Tabs footer, add sufficient padding to footer on small screens
      // but only if we don't already handle this with sticky mobile footer
      if (navTabs$[0] && !stickyButtonContainer$[0]) {
        footer$.css("margin-bottom", getNavTabsHeight() || "");
        win$.on(EVENTS.apexResized, function () {
          footer$.css("margin-bottom", getNavTabsHeight() || "");
        });
      }
    },

    /**
     * Function initializes the Step Wizard and
     * creates the steps
     */
    initWizard: function () {
      var wizardLinks$ = $(".js-wizardProgressLinks");

      theme.initWizardProgressBar();

      // Template Option: Make Wizard Steps Clickable
      if (wizardLinks$.length > 0) {
        wizardLinks$.each(function () {
          var thisWizard$ = $(this);

          thisWizard$.find(".t-WizardSteps-wrap").each(function () {
            var thisStep$ = $(this),
              link = thisStep$.data("link"),
              parent$,
              existingMarkup$;

            if (link) {
              parent$ = thisStep$.parent();
              existingMarkup$ = thisStep$.children();

              $(`<a class="t-WizardSteps-wrap" href="${link}"></a>`)
                .appendTo(parent$)
                .append(existingMarkup$);

              thisStep$.remove();
            }
          });
        });
      }
    },

    /**
     * Function initializes the megeMenu
     */
    megaMenu: function () {

      var menuNav$   = $("#t_MenuNav", apex.gPageContext$),
          isMegaMenu = menuNav$.hasClass("t-MegaMenu"),
          hasCallout = menuNav$.hasClass("js-menu-callout");

      if (menuNav$.length > 0 && isMegaMenu) {
        $("#t_Button_navControl")
          .attr("data-menu", "t_MenuNav")
          .addClass("js-menuButton t-Button--megaMenuToggle")
          .show();

        if (menuNav$.hasClass("js-addActions")) {
          apex.actions.addFromMarkup(menuNav$);
        }
        if (hasCallout) {
          menuNav$.prepend(`<div class="u-callout"></div>`);
        }

        menuNav$.menu({
          customContent: true,
          tabBehavior: "NEXT",
          callout: hasCallout,
        });
      }
    },
  };

  /**
   * Function that runs after apexreadyend
   * @function ut_apex_ready_init
   */
  var ut_apex_ready_init = {

    /**
     * Function for initializing carousel regions
     */
    carousel: function () {

      var carousel$ = $(".t-Region--carousel");

      if ($.fn.carousel && carousel$.length > 0) {
        carousel$.carousel({
          containerBodySelect: ".t-Region-carouselRegions",
          html: true,
        });
      }
    },

    /**
     * Function to initialize tab regions and switching between tabs
     */
    tabsRegion: function () {
      (function () {

        var TABS_REGION_REGEX = /t-TabsRegion-mod--([^\s]*)/;
        $.fn.utTabs = function() {
          var that$ = $(this);
          that$.each(function () {
            var tabClasses = [];
            var classes = this.className.split(/\s+/);
            classes.forEach(function (clazz) {
              var match = clazz.match(TABS_REGION_REGEX);
              if (match !== null && match.length > 0) {
                tabClasses.push("t-Tabs--" + match[1]);
              }
            });
            var ul$ = $( `<ul class="t-Tabs ${tabClasses.join(" ")}" role="tablist">` );
            var tabs$ = $(this);
            var items$ = tabs$.find(".t-TabsRegion-items").first();
            items$.prepend(ul$);
            items$
              .children()
              .filter("div")
              .each(function () {
                var tab$ = $(this);
                var tabId = tab$.attr("id");
                var tabLabel = tab$.attr("data-label");
                ul$.append(
                  `<li class="t-Tabs-item" aria-controls="${tabId}" role="tab">
                    <a href="#${tabId}" class="t-Tabs-link" tabindex="-1">
                      <span>${tabLabel}</span>
                    </a>
                  </li>`
                );
              });
            ul$.aTabs({
              tabsContainer$: items$,
              optionalSelectedClass: "is-active",
              showAllScrollOffset: false,
              onRegionChange: function (mode, activeTab) {
                if (!activeTab) {
                  return;
                }
                activeTab.el$
                  .find(".js-stickyWidget-toggle")
                  .trigger("forceresize");
              },
              useSessionStorage: that$.hasClass("js-useLocalStorage"),
            });
          });
        };
      })();

      /**
       *
       */
      var tabsRegion$ = $(".t-TabsRegion");

      if ($.apex.aTabs && tabsRegion$.length > 0) {
        tabsRegion$.utTabs();
      }
    },

    /**
     * Function controls floating labels and the controls for the labels
     */
    floatingLabels: function () {

      var CL_ACTIVE     = "is-active",
          CL_DISABLED   = "is-disabled",
          CL_REQUIRED   = "is-required",
          CL_SHOW_LABEL = "js-show-label",
          CL_FLOAT      = ".t-Form-fieldContainer--floatingLabel",
          CL_CONTAINER  = ".t-Form-fieldContainer",
          CL_PRE        = " .t-Form-itemText--pre";

      var floatContainers$ = $(CL_FLOAT);

      if (floatContainers$.length === 0) {
        return false;
      }

      function getContainer(pElem) {
        return pElem.closest(CL_CONTAINER);
      }

      // Move pre text before the label
      $(CL_FLOAT + CL_PRE).each(function () {
        var preText$ = $(this),
          field$ = getContainer(preText$);

        preText$.detach().prependTo(field$);
      });

      // Float labels for the readonly items
      floatContainers$
        .not(".apex-item-wrapper--display-only")
        .has("span.apex-item-display-only")
        .addClass("apex-item-wrapper--display-only");

      var blurDelayTimer, lastItem, popupSelector;

      function clearBlurTimer() {
        clearTimeout(blurDelayTimer);
        blurDelayTimer = null;
      }

      // Items that are using the floating label logic
      var tags    = CL_FLOAT + ' .apex-item-text'
                  + ', ' + CL_FLOAT + ' .apex-item-select'
                  + ', ' + CL_FLOAT + ' .apex-item-textarea'
                  + ', ' + CL_FLOAT + ' .apex-item-popup-lov'
                  + ', ' + CL_FLOAT + ' .apex-item-datepicker'
                  + ', ' + CL_FLOAT + ' .apex-item-datepicker-jet'
                  + ', ' + CL_FLOAT + ' .apex-item-color-picker'
                  + ', ' + CL_FLOAT + ' .has-floating-label'; // Generic class for plug-ins

      var needLabel = function (item$) {
        return apex.item(item$.attr("id")).hasDisplayValue();
      };

      var initFloatLabel = function (item$) {
        var container$ = getContainer(item$);

        // Set the initial label state
        if (needLabel(item$)) {
          container$.addClass(CL_SHOW_LABEL);
        } else {
          container$.removeClass(CL_SHOW_LABEL);
        }

        // Disabled items
        if (item$.is(":disabled")) {
          container$.addClass(CL_DISABLED);
        } else {
          container$.removeClass(CL_DISABLED);
        }

        // Required items
        if (item$.attr("required")) {
          container$.addClass(CL_REQUIRED);
        }
      };

      var popupElementBlur = function () {
        triggerBlur(lastItem);
      };

      var popupElementFocused = function (event) {
        if ($(event.target).closest(popupSelector).length) {
          clearBlurTimer();
          $(popupSelector).on("focusout", popupElementBlur);
        }
      };

      var triggerBlur = function (pThis) {
        var item$ = $(pThis),
          container$ = getContainer(item$);

        lastItem = pThis;

        // make sure this is done just once
        if (!blurDelayTimer) {
          blurDelayTimer = setTimeout(function () {

            lastItem = null;
            blurDelayTimer = null;

            if (popupSelector) {
              $(document.body).off("focusin", popupElementFocused);
              $(popupSelector).off("focusout", popupElementBlur);
              return;
              // end early to avoid the following checks.
              // The display value of the null value in Popup LOV item cannot be detected in shadow-root.
            }

            if (needLabel(item$)) {
              container$.addClass(CL_SHOW_LABEL);
            } else {
              container$.removeClass(CL_SHOW_LABEL);
            }

            container$.removeClass(CL_ACTIVE);

          }, 100);
        }
      };

      $(tags)
        .each(function () {
          initFloatLabel($(this));
        })
        .on("change", function () {
          var item$ = $(this),
            container$ = getContainer(item$);

          if (needLabel(item$)) {
            container$.addClass(CL_SHOW_LABEL);
          } else {
            container$.removeClass(CL_SHOW_LABEL);
          }
        })
        .on("focus", function () {
          var item$ = $(this),
            container$ = getContainer(item$);

          container$.addClass(CL_ACTIVE);

          if (blurDelayTimer && lastItem === this) {
            clearBlurTimer();
          }

          popupSelector = apex.item(this).getPopupSelector();

          if (popupSelector) {
            $(document.body).on("focusin", popupElementFocused);
          }
        })
        .on("blur", function () {
          triggerBlur(this);
        });

      $(document.activeElement).focus();
    },

    /**
     * Misc JS Functionality to run on the page
     * Includes actions like removing the no-anim class on the body tag, setting up the
     * navigation bar call out, setting the backToTop element that's used globally in,
     * Sets the scrollTo function to the scrollToAnchor variable, initializes responsive
     * dialogs, and enables the debug toolbar when necessary
     */
    misc: function () {

      body$.removeClass( 'no-anim' );

      var navigationBarCallout = $( ".t-NavigationBar" ).hasClass( "js-menu-callout" );

      $( ".t-NavigationBar-menu", pageCtx$ ).menu( { callout: navigationBarCallout } );

      $(".t-Alert .t-Button--closeAlert").click(function () {
        delayResize();
      });

      var backToTop$ = $("#t_Footer_topButton");

      $(".a-MenuBar").menu("resize");

      backToTop$
        .attr("title", apex.lang.getMessage("APEX.UI.BACK_TO_TOP"))
        .click(function () {
          $("html, body").animate({ scrollTop: 0 }, 500);
          $("a.t-Header-logo-link").focus();
          return false;
        });

      // Handle anchor links scroll when there's # in URL, considering sticky tops.
      var scrollToAnchor = function () {
        scrollTo(window.location.hash);
      };
      scrollToAnchor();
      win$.on("hashchange", function (e) {
        e.preventDefault();
        scrollToAnchor();
      });

      theme.initResponsiveDialogs();



      resetHeaderOffset();

      var DEBUGON = "grid-debug-on";
      if ($("#apexDevToolbar").length > 0) {
        doc$
          .on("apex-devbar-grid-debug-on", function () {
            body$.addClass(DEBUGON);
          })
          .on("apex-devbar-grid-debug-off", function () {
            body$.removeClass(DEBUGON);
          });
      }
    },
  };

  let Page = function () {
    this.init();
  };

  /**
   * Function to initialize page and trigger loading sequence events
   */
  Page.prototype = {
    init: function () {

      var initComponents = function (pComponents) {
        var key;
        for (key in pComponents) {
          if (Object.prototype.hasOwnProperty.call(pComponents, key)) {
            pComponents[key]();
          }
        }
      };

      win$.trigger(EVENTS.preload);

      initComponents(ut_doc_ready_init, 'ut_doc_ready_init');

      $(pageCtx$).on(EVENTS.readyEnd, function () {
        initComponents(ut_apex_ready_init, 'ut_apex_ready_init');
        win$.trigger(EVENTS.utReady);
      });
    }
  };

  $(function () {
    ut.page = new Page();
  });
})(apex.jQuery, apex.theme42, apex.theme, apex.debug);
