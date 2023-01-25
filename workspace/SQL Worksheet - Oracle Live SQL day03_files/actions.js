/*!
 Copyright (c) 2014, 2022, Oracle and/or its affiliates.
*/
/*
 Actions - encapsulate action identity and state for use in keyboard shortcuts, buttons, and menus
*/
/**
 * @namespace apex.actions
 * @since 5.1
 * @desc
 * <p>The apex.actions namespace contains global functions related to the Oracle APEX actions facility.
 * The methods and properties of the global actions context are also available in the apex.actions namespace but
 * are documented with the {@link actions} interface.
 * </p>
 */

/*
 * todo:
 * - menubar support for action menu items in menu bar
 * - consider a method to get the UI elements associated with an action
 *
 * Depends on these strings being defined in the apex.lang message facility
 *     APEX.ACTIONS.TOGGLE
 *
 * Depends:
 *      debug.js
 *      lang.js
 *      util.js
 *      navigation.js
 */

(function ( apex, debug, lang, util, navigation, $ ) {
    "use strict";

    const objectEntries = Object.entries,
        isArray = Array.isArray,
        extend = $.extend;

    const SEL_ACTION_BUTTON = "button[data-action]",
        SEL_ACTION_RADIO_GROUP = ".js-actionRadioGroup",
        SEL_ACTION_SELECT = "select[data-action]",
        SEL_ACTION_CHECKBOX = ".js-actionCheckbox",
        SEL_ACTION_LINK = 'a[href^="#action$"]',
        ACTION_HREF_PREFIX = "#action$",
        A_LABEL = "aria-label",
        A_TITLE = "title",
        A_ACTION = "data-action",
        ACTION_SHORTCUT_SEPARATOR = ">",
        AT_TOGGLE = "toggle",
        AT_RADIO = "radio",
        C_ACTIVE = "is-active",
        T_BUTTON = "button",
        T_CHECKBOX = "checkbox",
        T_RADIO = "radio",
        T_SELECT = "select",
        T_LINK = "link", // anchor element
        N_INPUT = "INPUT",
        OP_REMOVE = "remove",
        P_DISABLED = "disabled";

    const mapCodeToName = (function() {
        const map = {
            "Help": 1, // 1 indicates that the value is essentially the same as the key with simple replacements as needed
            "Backspace": 1,
            "Enter": 1,
            "Escape": 1,
            "Space": 1,
            "PageUp": "Page Up",
            "PageDown": "Page Down",
            "End": 1,
            "Home": 1,
            "ArrowLeft": 1, // Arrow dropped
            "ArrowUp": 1,
            "ArrowRight": 1,
            "ArrowDown": 1,
            "Insert": 1,
            "Delete": 1,
            "Digit0": 1, // Digit dropped
            "Digit1": 1,
            "Digit2": 1,
            "Digit3": 1,
            "Digit4": 1,
            "Digit5": 1,
            "Digit6": 1,
            "Digit7": 1,
            "Digit8": 1,
            "Digit9": 1,
            "KeyA": 1, // Key dropped
            "KeyB": 1,
            "KeyC": 1,
            "KeyD": 1,
            "KeyE": 1,
            "KeyF": 1,
            "KeyG": 1,
            "KeyH": 1,
            "KeyI": 1,
            "KeyJ": 1,
            "KeyK": 1,
            "KeyL": 1,
            "KeyM": 1,
            "KeyN": 1,
            "KeyO": 1,
            "KeyP": 1,
            "KeyQ": 1,
            "KeyR": 1,
            "KeyS": 1,
            "KeyT": 1,
            "KeyU": 1,
            "KeyV": 1,
            "KeyW": 1,
            "KeyX": 1,
            "KeyY": 1,
            "KeyZ": 1,
            // Numpad may be a better name but we are stuck with Keypad for backward compatibility
            "Numpad0": "Keypad 0",
            "Numpad1": "Keypad 1",
            "Numpad2": "Keypad 2",
            "Numpad3": "Keypad 3",
            "Numpad4": "Keypad 4",
            "Numpad5": "Keypad 5",
            "Numpad6": "Keypad 6",
            "Numpad7": "Keypad 7",
            "Numpad8": "Keypad 8",
            "Numpad9": "Keypad 9",
            "NumpadMultiply": "Keypad *",
            "NumpadAdd": "Keypad +",
            "NumpadSubtract": "Keypad -",
            "NumpadDecimal": "Keypad .",
            "NumpadDivide": "Keypad /",
            "NumpadClear": "Keypad Clear",
            "NumpadEqual": "Keypad =",
            // missing Numpad: Hash, Backspace, ClearEntry, Comma, Enter, Memory*, Star, Paren*
            "F1": 1,
            "F2": 1,
            "F3": 1,
            "F4": 1,
            "F5": 1,
            "F6": 1,
            "F7": 1,
            "F8": 1,
            "F9": 1,
            "F10": 1,
            "F11": 1,
            "F12": 1,
            "F13": 1,
            "F14": 1,
            "F15": 1,
            "Semicolon": 1,
            "Equal": "=",
            "Comma": 1,
            "Minus": 1,
            "Period": 1,
            "Slash": "/",
            "Backquote": "Backtick", // this key has many names Backquote may be better but for backward compatibility need to stick with Backtick
            "BracketLeft": "[",
            "Backslash": "\\",
            "BracketRight": "]",
            "Quote": 1
            // Not useful for shortcuts Tab, Shift[Right/Left], Control[Right/Left], Alt[Right/Left], Meta[Right/Left],
            //  CapsLock, ContextMenu, NumLock, PrintScreen, ScrollLock, Pause, FnLock, (all media keys)
            // the Launch application keys are not useful

            // missing: "IntlBackslash", "IntlRo", "IntlYen"
        };
        for ( let [k,v] of objectEntries( map ) ) {
            map[k] = v === 1 ? k.replace( /Arrow|Digit|Key/, "" ) : v;
        }
        return map;
    })();

    // legacy support for IE11 and Edge
    const mapKeyToName = {
        6: "Help",
        8: "Backspace",
        // 9: Tab, no use all modifiers are taken
        13: "Enter",
        // 16: Shift, 17: Control, 18: Alt, 20: Caps lock all of no use
        27: "Escape",
        32: "Space",
        33: "Page Up",
        34: "Page Down",
        35: "End",
        36: "Home",
        37: "Left",
        38: "Up",
        39: "Right",
        40: "Down",
        45: "Insert",
        46: "Delete",
        48: "0",
        49: "1",
        50: "2",
        51: "3",
        52: "4",
        53: "5",
        54: "6",
        55: "7",
        56: "8",
        57: "9",
        65: "A",
        66: "B",
        67: "C",
        68: "D",
        69: "E",
        70: "F",
        71: "G",
        72: "H",
        73: "I",
        74: "J",
        75: "K",
        76: "L",
        77: "M",
        78: "N",
        79: "O",
        80: "P",
        81: "Q",
        82: "R",
        83: "S",
        84: "T",
        85: "U",
        86: "V",
        87: "W",
        88: "X",
        89: "Y",
        90: "Z",
        // 91: meta is of no use
        // 93: context menu not useful
        // There is a difference between how 'which' and 'code' handles keypad:
        //   'which' takes num lock into consideration,
        //   'code' numpad is always numpad
        96: "Keypad 0",
        97: "Keypad 1",
        98: "Keypad 2",
        99: "Keypad 3",
        100: "Keypad 4",
        101: "Keypad 5",
        102: "Keypad 6",
        103: "Keypad 7",
        104: "Keypad 8",
        105: "Keypad 9",
        106: "Keypad *",
        107: "Keypad +",
        109: "Keypad -",
        110: "Keypad .",
        111: "Keypad /",
        112: "F1",
        113: "F2",
        114: "F3",
        115: "F4",
        116: "F5",
        117: "F6",
        118: "F7",
        119: "F8",
        120: "F9",
        121: "F10",
        122: "F11",
        123: "F12",
        // 144: Num Lock not useful
        186: "Semicolon",
        187: "=",
        188: "Comma",
        189: "Minus",
        190: "Period",
        191: "/",
        192: "Backtick",
        219: "[",
        220: "\\",
        221: "]",
        222: "Quote"
        // missing: "IntlBackslash", "IntlRo", "IntlYen"
        // the Launch application keys are not useful
    };

    /*
     * About modifier keys:
     * Shift and Control are labeled as such
     * AltGr is simulated correctly by browsers as Ctrl+Alt
     * On Mac
     * meta is the Command key generally has a symbol like a colver leaf
     * alt is the Option key sometimes labeled both alt and Option and has a symbol like a slash with a dash above it
     * On Windows
     * alt is alt
     * meta is the "Windows" key but it is not very useful for web apps because it generally does system things
     * Actions does not distinguish between left and right modifier keys
     */

    const gIsMac = navigator.appVersion.indexOf("Mac") >= 0;

    let gAllowShortcuts = true,
        gAllowShortcutSequence = true,
        gKeyCaps = {};

    const INPUT_EXCEPTIONS = {
            T_RADIO:1,
            T_CHECKBOX:1,
            "submit":1,
            "image":1,
            "reset":1,
            T_BUTTON:1
        },
        EDITING_KEYS = {
            "Ctrl+C":1,
            "Ctrl+X":1,
            "Ctrl+V":1,
            "Ctrl+A":1,
            "Ctrl+Z":1,
            "Ctrl+Shift+Z":1,
            "Ctrl+Y":1
        },
        EDITING_KEYS_MAC = {
            "Meta+C":1,
            "Meta+X":1,
            "Meta+V":1,
            "Meta+A":1,
            "Meta+Z":1,
            "Meta+Shift+Z":1
        },
        TYPE_TO_SELECT_ROLES = {
            "option":1,
            "treeitem":1
        },
        ACTION_LABELS = ["label", "onLabel", "offLabel", "title", "contextLabel"],
        CHOICE_LABELS = ["label", "group", "title"];

    const BINDING_RE = /^(\[.+])?([^?[\]]+)(\?.+)?$/;

    // Binding to an action looks like this
    // [[context]]action-name[?arg=value[&arg=value]+]
    function parseActionBinding( actionBinding, testForFragment ) {
        let result = null;

        if ( actionBinding.startsWith( ACTION_HREF_PREFIX ) ) {
            actionBinding = actionBinding.substring( 8 );
        } else if ( testForFragment ) {
            return result;
        }
        let m = BINDING_RE.exec( actionBinding );

        if ( m ) {
            let contextId = null,
                args = null;

            if ( m[3] ) {
                let params = new URLSearchParams( m[3] );

                args = {};
                for ( const [n, v] of params ) {
                    args[n] = v;
                }
            }

            if ( m[1] ) {
                contextId = m[1].substring( 1, m[1].length - 1 );
            }
            result = {
                contextId: contextId,
                actionName: m[2],
                args: args
            };
        }
        if ( !result ) {
            debug.error( "Invalid action binding '" + actionBinding + "'" );
        }
        return result;
    }

    function makeKeyName( event, ignoreTarget ) {
        let nodeName, k, isAlpha,
            printable, // means the key could be a printable character
            keyName = null;
        const altKey = event.altKey,
            ctrlKey = event.ctrlKey,
            metaKey = event.metaKey,
            keyNum = event.which,  // jquery normalizes which
                                   // Should use the standard property code except not supported by IE
            keyCode = event.code;

        if ( keyCode ) {
            k = mapCodeToName[keyCode];
        } else {
            k = mapKeyToName[keyNum];
        }
        /*
          If a key combination could make a printable character then don't act on it. Ex: Alt+3 on a mac makes #,
          Ctrl + Alt (AltGr) + C makes ć on a Polish keyboard.
          Context matters
          If focus is not in a control that accepts characters then should be no problem.
          If focus is in a control that accepts characters then must ignore the combination. What accepts characters:
            input type=text, textarea obviously take characters but so does select,
            What about controls like iconList, treeView that support type to select? They also accept characters.
            Use role=option for iconList, role=treeitem for treeView assume any such widget supports type to select
            What about readonly inputs?
            Note: rich text editor (CKEditor) is not an issue because we don't get any keydown events when it has focus.
          So when target is a control (input (except radio, checkbox, submit, image, reset, button), textarea, select)
          then don't consider a printable character or characters used in editing.
          How to tell if key events result in a printable character:
            On Chrome, IE11, Edge there is no keypress event (chrome, IE11 has an exception for Ctrl+Shift+2 US keyboard but charCode is 0, similar for Edge but no charCode)
            On Firefox no way to tell because there is a keypress event and nothing in it indicates if a character will be typed
            Even if Firefox worked as expected it is tricky to wait until the right key up to make sure there was no keypress
            For example if focus leaves the window because of the key you will never get a corresponding key up.
            Also the beforeinput and input events are not yet widely supported.
          So could instead ask what has the *potential* to generate a character
            [Shift] (no alt, meta, ctrl) + any typing character : these are normal letters like AaBb...
            Ctrl+Alt (shift don't care, no meta) + any typing key : these are potential AltGr characters
            On Mac Alt (no ctrl, no meta, no shift?) + any typing key : these are potential Mac Option characters
          This distinction in context should make it acceptable to use printing characters as shortcuts and even sequences of them like in gmail.
         */

        if ( k ) {
            keyName = "";
            if ( ctrlKey ) {
                keyName += "Ctrl+";
            }
            if ( altKey ) {
                keyName += "Alt+";
            }
            if ( metaKey ) {
                keyName += "Meta+";
            }
            // ignore shift modifier on letters A-Z if there are no other modifiers in other words be case independent
            isAlpha = keyCode ? /Key./.test( keyCode ) : ( keyNum > 59 && keyNum < 91 );
            if ( event.shiftKey && !( isAlpha && !ctrlKey && !altKey && !metaKey) ) {
                keyName += "Shift+";
            }
            keyName += k;

            // given that k is a key name these are the printable ones
            // adjust this if mapKeyToName ever changes
            if ( keyCode ) {
                printable = /Digit\d|Key.|Space|Semicolon|Equal|Comma|Minus|Period|Slash|Backquote|Bracket.+|Backslash|Quote/.test( keyCode );
            } else {
                printable = !( ( keyNum >= 112 && keyNum <= 123 ) || ( keyNum >= 33 && keyNum <= 46 ) || keyNum < 32 );
            }

            // if the focus takes character input
            nodeName = event.target && event.target.nodeName;
            if ( !ignoreTarget && ( nodeName === "TEXTAREA" || nodeName === "SELECT" ||
                ( nodeName === N_INPUT && !INPUT_EXCEPTIONS[event.target.type.toLowerCase()] ) ||
                ( TYPE_TO_SELECT_ROLES[$(event.target).attr("role")] ) )
            ) {

                if ( ( printable && ( // ignore any key combination that may result in a printable character
                        ( !altKey && !ctrlKey && !metaKey ) || // there is no modifier except maybe shift
                        ( ctrlKey && altKey && !metaKey ) || // possible AltGr character
                        ( gIsMac && altKey && !ctrlKey && !metaKey ) ) // possible Mac Option key character
                     ) ||
                    // ignore any keys that could be used in editing (even with any modifier)
                     ( ( gIsMac ? EDITING_KEYS_MAC : EDITING_KEYS )[keyName] || keyNum <= 46  ) // note still using deprecated which here
                    ) {
                    keyName = null;
                }
            } else if ( printable && !( ctrlKey || altKey || metaKey ) && !gAllowShortcutSequence  ) {
                // keys that produce a character require at least one modifier other than shift unless gAllowShortcutSequence
                keyName = null;
            }
        }
        return keyName;
    }

    function getActionLabel( action ) {
        let label = action.contextLabel || action.label;
        if ( !label && action.onLabel && action.offLabel ) {
            label = action.onLabel + "/" + action.offLabel;
        } else if ( action.set && action.get && !action.choices ) {
            label = lang.formatMessage( "APEX.ACTIONS.TOGGLE", label );
        }
        return label;
    }

    function getLabelFor( input ) {
        let label$;

        if ( input.id ) {
            label$ = $( "[for=" + input.id + "]" );
        } else {
            label$ = $( input ).closest( "label" );
        }
        return label$;
    }

    function translateMessages( obj, keys ) {
        let i, key, msgKey;
        for ( i = 0; i < keys.length; i++ ) {
            key = keys[i];
            msgKey = key + "Key";
            if ( obj[msgKey] ) {
                obj[key] = lang.getMessage( obj[msgKey] );
                delete obj[msgKey];
            }
        }
    }

    function errorNoSuchAction( actionName, altReason ) {
        debug.error( "No such action '" + actionName + "'" + altReason );
    }

    function makeActionContext( typeName, context ) {
        const actionMap = new Map(), // Map actionName -> action
            actionShortcut = new Map(), // Map actionName -> shortcut, or actionName + sep + choiceValue -> shortcut
            shortcutMap = new Map(); // Map shortcut -> actionName, or shortcut -> { actionName: actionName,  value: choiceValue }
                              // for sequences shortcut-sequence[0] -> [ { shortcut: string, seqLen: integer, actionName: string [, value: choiceValue] } ]
        let observers = [],
            shortcutsDisabled = false,
            disableDepth = 0;

        function notifyObservers( action, operation, args ) {
            let i, callback;

            for ( i = 0; i < observers.length; i++ ) {
                callback = observers[i];
                callback( action, operation, args );
            }
        }

        function notifyObserversUpdate( action, args ) {
            notifyObservers( action, "update", args );
        }

        function modifyProp( actionName, prop, value, args ) {
            const a = actionMap.get( actionName );

            if ( a ) {
                if ( args && a.idArg && args[a.idArg] ) {
                    // if modifying a specific instance don't change the property, just update the UI
                    // but the UI is updated based on the property so set it temporarily
                    let temp = a[prop];

                    a[prop] = value;
                    notifyObserversUpdate( a, args );
                    a[prop] = temp;
                } else if ( a[prop] != value ) { // eslint-disable-line eqeqeq
                    // if the value has changed update the property and notify to update the UI
                    a[prop] = value;
                    // the shortcut didn't change so no need to call update
                    notifyObserversUpdate( a, args );
                }
            }
        }

        function addShortcut( shortcut, actionName, choiceValue ) {
            let possibilities, first,
                seqParts = shortcut.split( "," );

            if ( seqParts.length > 1 ) {
                first = seqParts[0];
                possibilities = shortcutMap.get( first );
                if ( !possibilities ) {
                    possibilities = [];
                    shortcutMap.set( first, possibilities );
                }
                possibilities.push( { shortcut: shortcut, seqLen: seqParts.length, actionName: actionName, value: choiceValue } );
            } else {
                shortcutMap.set( shortcut, choiceValue ? { actionName: actionName, value: choiceValue } : actionName );
            }
        }

        function removeShortcut( shortcut ) {
            let possibilities, first, seqParts;

            if ( shortcut ) {
                seqParts = shortcut.split( "," );
                if ( seqParts && seqParts.length > 1 ) {
                    first = seqParts[0];
                    possibilities = shortcutMap.get( first );
                    for ( let i = 0; i < possibilities.length; i++ ) {
                        if ( possibilities[i].shortcut === shortcut ) {
                            possibilities.splice( i, 1 );
                            break;
                        }
                    }
                    if ( possibilities.length === 0 ) {
                        shortcutMap.delete( first );
                    }
                } else {
                    shortcutMap.delete( shortcut );
                }
            }
        }

        function lookupShortcut( shortcut, partial ) {
            let possibilities, first, cur, found, len,
                seqParts = shortcut.split( "," );

            if ( seqParts.length > 1 ) {
                first = seqParts[0];
                found = [];
                possibilities = shortcutMap.get( first );
                if ( !isArray( possibilities ) ) {
                    return; // undefined
                }
                len = shortcut.length;
                for ( let i = 0; i < possibilities.length; i++ ) {
                    cur = possibilities[i];
                    if ( cur.shortcut === shortcut ) {
                        if ( cur.value !== undefined ) {
                            return { actionName: cur.actionName, value: cur.value };
                        } else {
                            return cur.actionName;
                        }
                    } // else
                    if ( cur.seqLen > seqParts.length && cur.shortcut.substr( 0, len ) === shortcut ) {
                        // this shortcut is a partial match and could match once another key is typed
                        found.push( cur );
                    }
                }
                if ( found.length && partial ) {
                    return found;
                }
            } else {
                return shortcutMap.get( shortcut );
            }
        }

        function checkAndAddShortcut( actions, action, choice ) {
            let status = true,
                actionOrChoice = choice || action,
                shortcut = actionOrChoice.shortcut,
                name = action.name;

            if ( !actions.isValidShortcut( shortcut )) {
                debug.warn( "Invalid shortcut '" + shortcut + "' for action '" + name + "' ignored.");
                status = false;
            } else if ( !choice && actionOrChoice.choices ) {
                debug.warn( "Shortcut '" + shortcut + "' for radio group action '" + name + "' ignored.");
                status = false;
            } else if ( !lookupShortcut( shortcut ) ) {
                actionShortcut.set( choice ? (name + ACTION_SHORTCUT_SEPARATOR + choice.value) : name, shortcut );
                addShortcut(shortcut, name, choice && choice.value );
            } else {
                debug.warn( "Duplicate shortcut '" + actionOrChoice.shortcut + "' for action '" + name + "' ignored.");
                status = false;
            }
            if ( !status ) {
                actionOrChoice.shortcut = null;
            }
            return status;
        }

        /**
         * @interface actions
         * @since 5.0
         * @classdesc
         * <p>The actions interface manages a collection of {@link actions.action} objects. An action encapsulates
         * the identity, state and behavior of a named operation or procedure that the user initiates via a user
         * interface element. Actions are most useful when an operation can be initiated in multiple ways such as with a button
         * or toolbar button, menu, or keyboard shortcut. The operation should be labeled consistently and if it can be
         * enabled and disabled that state must be kept consistent. By using an action and then associating a button and/or
         * menu item with that action all aspects of the action are centralized and kept in sync. This avoids duplicating
         * labels, icons etc.</p>
         *
         * <div class="hw">
         *     <h3 class="name" id="contexts-section">Actions Contexts</h3>
         *     <a class="bookmarkable-link" title="Bookmarkable Link" aria-label="Bookmark Actions Contexts" href="#contexts-section"></a>
         * </div>
         * <p>The apex.actions singleton (which is also the {@link apex.actions} namespace) manages
         * all the global (page level) actions. For components that can have multiple
         * instances on a page the global actions will not work because it is not clear which instance of the component the
         * action applies to. To support components the {@link apex.actions.createContext} function is used to create an actions
         * interface that is scoped to a specific component instance (the context). Typically the component (e.g. widget) would
         * call {@link apex.actions.createContext} when it is created and {@link apex.actions.removeContext}
         * when it is destroyed.</p>
         *
         * <p>For global actions and any other created actions contexts the methods on the actions object are used to add,
         * remove, lookup, and invoke actions. There are also methods to manage keyboard shortcuts. Additional state can be
         * stored in the action if desired. If any of the action properties change then {@link actions#update} must be called.</p>
         *
         * <p>Actions are associated with UI controls that invoke the action. It is also possible to invoke
         * the action explicitly with the {@link actions#invoke} method. To toggle actions the {@link actions#toggle}
         * method is used and for radio group actions the {@link actions#set} method is used to change the value.
         * The following sections describes how to associate actions with various controls.</p>
         *
         * <p>Binding a UI element to an action uses the custom attribute <code class="prettyprint">data-action</code>
         * or for links (&lt;a&gt; elements) the <code class="prettyprint">href</code> attribute.
         * The value of this attribute specifies the binding. In the simple case it is just the name of an action.
         * The full syntax of the binding value is:</p>
         *
         * <pre><code class="prettyprint">[<em>context-id</em>]<em>action-name</em>?<em>arguments</em>
         * </code></pre>
         * <ul>
         *     <li><em>context-id</em> is the static id of a region that has defined an actions context or the element
         *       id of the element specified in a call to {@link apex.actions.createContext}. To explicitly reference
         *       the global context use <code class="prettyprint">[global]</code>.
         *       This part of the binding including the square brackets is optional.
         *       The square brackets must be included in the syntax when there is a context-id.</li>
         *     <li><em>action-name</em> is the name of an action in the global context or if
         *       <em>context-id</em> is given, in that context.</li>
         *     <li><em>arguments</em> is a list of <em>arg-name</em>=<em>arg-value</em> pairs separated by &.
         *     This part of the binding including the leading ? is optional.
         * </ul>
         *
         * <h4>Handling Multiple Instances</h4>
         * <p>A single action can handle multiple instances by passing an argument to the action that identifies the
         * specific instance. Consider a tabular report (or a list report) containing tasks.
         * Each row could have a "Complete" button that when pressed marks the task as complete.
         * The action binding might look like this: <code class="prettyprint">complete-task?taskId=&TASK_ID!ATTR.</code>
         * The argument <code class="prettyprint">taskId</code> lets the action know which task it is operating on.
         * In this example the argument value comes from an APEX symbol substitution.
         * When an action handles multiple instances the functionality that keeps the action state in sync with
         * UI elements is more complicated. The label, icon, and enabled states, for example, could be different for
         * the button in each row. The {@link actions.action} property <code class="prettyprint">idArg</code> lets you
         * specify the argument that uniquely identifies the instance. This argument can be passed to the
         * {@link actions#enable}, {@link actions#disable}, {@link actions#show}, {@link actions#hide}, and
         * {@link actions#update} methods to update a specific UI element. Note that when this is done the
         * action state is no longer in sync with all UI elements bound to the action. Only the hidden and disabled
         * states can be updated for a specific instance when the action has the <code class="prettyprint">idArg</code>
         * property defined. In order for keyboard shortcuts to apply to the correct instance the
         * {@link actions.action} property <code class="prettyprint">instanceSelector</code> must be set and the
         * button (or other UI control) bound to the action must be within an element identified by the selector.
         * </p>
         *
         * <div class="hw">
         *     <h3 class="name" id="buttons-section">Buttons</h3>
         *     <a class="bookmarkable-link" title="Bookmarkable Link" aria-label="Bookmark Buttons" href="#buttons-section"></a>
         * </div>
         * <p>To associate a button element with an action give it a <code class="prettyprint">data-action</code>
         * attribute with the name of the action as its value. The button icon, label text, title, aria-label, hide/show,
         * and disabled state are all updated automatically.</p>
         * <p>For this automatic updating to work buttons should use the following classes:</p>
         * <ul>
         * <li>t-Button-label if a button has a text label this class should be on an element that wraps the text.
         *       This is useful when the button also has an icon or other non-text label content. This class does not
         *       go on the button element. If this class is not used then the content of the button element will be the
         *       label text.</li>
         * <li>t-Button--icon if a button has an icon this class should be on the button element. If the action has an
         *       icon and the button has this class then any elements with the icon type class will be updated with
         *       the icon. Any classes on the icon element that are not the icon, the icon type or start with "t-"
         *       will get removed.</li>
         * <li>t-Button--noLabel if a button has no visible label this class should be on the button element. A button with
         *       no visible label text will have the button's aria-label attribute set to the button label. Also if there
         *       is no title the label will be used as the title.</li>
         * </ul>
         * <p>If the action label or title are null they will be initialized with the text and title attribute value respectively
         * from the first button (in document order) associated with the action. This is useful if the server has
         * already rendered a localized button for the action. The title comes from the button title attribute. The label comes
         * from the first found of; aria-label attribute, title attribute if button has class t-Button--noLabel,
         * content of the descendant element with class t-Button-label, and finally the button element content. If disabled
         * is null it will be taken from the button disabled property. If you don't want the label, title, or icon to be updated
         * add attribute data-no-update="true".</p>
         *
         * <p>Example:</p>
         * <pre><code class="prettyprint">    &lt;button class="..." type="button" data-action="undo">Undo&lt;/button>
         * </code></pre>
         *
         * <div class="hw">
         *     <h3 class="name" id="checkboxes-section">Checkboxes</h3>
         *     <a class="bookmarkable-link" title="Bookmarkable Link" aria-label="Bookmark Checkboxes" href="#checkboxes-section"></a>
         * </div>
         * <p>A checkbox can be associated with a toggle action by giving the input element (or a wrapping parent element)
         * a class of <code class="prettyprint">js-actionCheckbox</code> and a
         * <code class="prettyprint">data-action</code> attribute with the name of the action as its value. The checkbox
         * should have a label element. The icon, label text, title, hide/show, disabled state, and checked state are all
         * updated automatically. For hide to work correctly use a wrapping element.</p>
         *
         * <p>If the label has the class t-Button then it should be marked up like a button and the same classes described for
         * a button are used to update the label and icon (except a visually hidden child element is used for the label
         * in place of aria-label). Otherwise the label element content will be updated with the label and the icon is not used.
         * If the action label or title are null they will be initialized from the markup. If the checkbox label is marked up
         * like a button then the label comes from the text of a child element with class t-Button-label or if the label
         * has class t-Button--noLabel then from a child element with class u-VisuallyHidden. If you don't want the label,
         * title, or icon to be updated add attribute data-no-update="true".</p>
         *
         * <p>Example:</p>
         * <pre class="prettyprint"><code>    &lt;input id="abc" type="checkbox" class="js-actionCheckbox" data-action="option-a">
         *         &lt;label for="abc">Option A&lt;/label>
         *    or
         *     &lt;div class="js-actionCheckbox" data-action="option-a">
         *         &lt;input id="abc" type="checkbox">&lt;label for="abc">Option A&lt;/label>
         *     &lt;/div>
         * </code></pre>
         *
         * <div class="hw">
         *     <h3 class="name" id="radiogroups-section">Radio Groups</h3>
         *     <a class="bookmarkable-link" title="Bookmarkable Link" aria-label="Bookmark Radio Groups" href="#radiogroups-section"></a>
         * </div>
         * <p>A radio group is a set of input elements of type radio and sharing the same name value. A radio group can be
         * associated with a radio group action by giving the element that wraps the radio group a class of
         * <code class="prettyprint">js-actionRadioGroup</code> and a <code class="prettyprint">data-action</code>
         * attribute with the name of the action as its value. The wrapper element
         * aria label is kept in sync with the action label. The radio group as a whole does not have a disabled state,
         * icon or title. When the radio action value changes (or when update is called) the checked state (and disabled state)
         * of each radio input is updated.</p>
         * <p>The element with class js-actionRadioGroup can also have attributes: data-item-start, data-item, data-item-end,
         * data-item-wrap to override action properties labelStartClasses, labelClasses, labelEndClasses, and itemWrapClasses
         * respectively.</p>
         * <p>If the action label is null it will be initialized from the wrapper element aria-label. If the wrapping element
         * has no children when the action is added or when updateChoices is called (after the choices have been changed) then
         * the choices are rendered as radio input, label pair elements. The action labelStartClasses, labelClasses,
         * labelEndClasses values are used for the classes of the label elements. If there is an icon it will be used
         * as the label. The label will be included as a hidden but accessible label. The label element will have a title
         * if there is a title property or if the choice has an icon. The title comes from the label property if the title
         * property isn't given.</p>
         *
         * <p>Example:</p>
         * <pre class="prettyprint"><code>    &lt;div class="js-actionRadioGroup" data-action="item-size">
         *       &lt;input id="lc1" type="radio" name="RG1" value="s">&lt;label for="lc1">Small&lt;/label>
         *       &lt;input id="lc2" type="radio" name="RG1" value="m">&lt;label for="lc2">Medium&lt;/label>
         *       &lt;input id="lc3" type="radio" name="RG1" value="l">&lt;label for="lc3">Large&lt;/label>
         *     &lt;/div>
         * </code></pre>
         *
         * <div class="hw">
         *     <h3 class="name" id="selectlists-section">Select List</h3>
         *     <a class="bookmarkable-link" title="Bookmarkable Link" aria-label="Bookmark Select List" href="#selectlists-section"></a>
         * </div>
         * <p>To associate a select element with a radio group action give it a <code class="prettyprint">data-action</code>
         * attribute with the name of the action as its value. Select lists used with actions are assumed to not have an
         * associated label element. The select element aria label, title, value, and disabled state are kept in sync with the
         * action. When the radio action value changes (or when update is called) the select element value is updated and
         * also the disabled state of each option element.</p>
         * <p>If the action label or title are null they will be initialized from the select element aria-label and
         * title attributes. If the select element has no children when the action is added or when updateChoices is called
         * (after the choices have been changed) then the choices are rendered as option elements. The choice group property
         * is used to put options in optgroup elements. The group property value is used as the optgroup label. The choices
         * need to be sorted first by group value.</p>
         *
         * <p>Example:</p>
         * <pre><code class="prettyprint">    &lt;select class="..." data-action="item-size">...&lt;/select>
         * </code></pre>
         *
         * <div class="hw">
         *     <h3 class="name" id="links-section">Links (anchor elements)</h3>
         *     <a class="bookmarkable-link" title="Bookmarkable Link" aria-label="Bookmark Buttons" href="#links-section"></a>
         * </div>
         * <p>To associate an anchor (&lt;a&gt;) element with an action the href must be a fragment with prefix "action$" and
         * then the action name. Unlike buttons, links do not synchronize the label, title, or icon action state with
         * the anchor element. The action hide property will hide or show the link. The action disabled property will
         * disable or enable the link by adding (or removing) the <code class="prettyprint">is-disabled</code>
         * and <code class="prettyprint">apex_disabled</code> classes.</p>
         * <p>If the action label is null it will be initialized from the link label from the first link
         * (in document order) associated with the action.</p>
         *
         * <p>Example:</p>
         * <pre><code class="prettyprint">    &lt;a class="..." href="#action$my-action">...&lt;/a>
         * </code></pre>
         *
         * <div class="hw">
         *     <h3 class="name" id="menuitems-section">Menu Items</h3>
         *     <a class="bookmarkable-link" title="Bookmarkable Link" aria-label="Bookmark Menu Items" href="#menuitems-section"></a>
         * </div>
         * <p>For {@link menu} widget menu items of type action, toggle, or radioGroup simply specify the
         * action name as the value of the action property. Values for
         * label, icon, iconType, disabled, hide, and accelerator are taken from the action (accelerator is taken from
         * the action shortcut property). It is possible to override action values such as label and icon by specifying them
         * in the menu item.</p>
         *
         * <p>Examples:</p>
         * <pre class="prettyprint"><code>    { type: "action", action: "undo" },
         *     { type: "toggle", action: "my-toggle-action" },
         *     { type: "radioGroup", action: "my-radio-action" }
         * </code></pre>
         *
         * <div class="hw">
         *     <h3 class="name" id="shortcuts-section">Shortcuts</h3>
         *     <a class="bookmarkable-link" title="Bookmarkable Link" aria-label="Bookmark Shortcuts" href="#shortcuts-section"></a>
         * </div>
         * <p>Shortcuts are not an actual widget or a DOM Element. The keyboard event handler for invoking actions in
         * response to shortcut keys is in this module and is registered on the context element
         * (body for the global context).</p>
         *
         * <div class="hw">
         *     <h3 class="name" id="customcontrols-section">Associating actions with custom UI controls</h3>
         *     <a class="bookmarkable-link" title="Bookmarkable Link" aria-label="Bookmark Associating actions with custom UI controls" href="#customcontrols-section"></a>
         * </div>
         * <p>To integrate actions with other UI controls:</p>
         * <ul>
         * <li>Devise a way to specify the action name. For example using a class such as
         * js-actionRadioGroup and an attribute such as <code class="prettyprint">data-action</code> attribute (recommended)
         * on an appropriate element. For widgets the action name could be passed as an option to the initialization function.</li>
         * <li>Register an observer call back using {@link actions#observe} to get notified when the action is added,
         * removed, or updated. Use this callback to update the state of the UI control such as enabling or
         * disabling it or changing the label or icon.</li>
         * <li>Call the {@link actions#invoke} method when it is time to invoke the action.</li>
         * </ul>
         */

        /**
         * @typedef actions.action
         * @type object
         * @desc
         * <p>This is an object that defines the state and behavior of an action. There are 3 kinds of actions:</p>
         * <ul>
         * <li>action: This is typically associated with a button, link, or action menu item. The action must have an
         *     action function or an href URL.</li>
         * <li>toggle: This is typically associated with a checkbox input, button, or toggle menu item. The action must have
         *     get and set functions and not have a choices property. Toggle actions update an external Boolean state variable
         *     by means of the get and set functions. It is also possible to keep the state in the action by using 'this'
         *     in the get and set functions.</li>
         * <li>radio group: This is typically associated with radio inputs, select list, or a radioGroup menu item. The action
         *     must have get and set functions and a choices property. Radio group actions update an external state variable
         *     with the currently selected value of the group by means of the get and set functions. It is also possible to
         *     keep the state in the action by using 'this' in the get and set functions.</li>
         * </ul>
         *
         * <p>Note: When an action is hidden or disabled the {@link actions#invoke}, {@link actions#toggle},
         * and {@link actions#set} methods have no effect.</p>
         *
         * <p>Note: The disabled and hide properties cannot be functions. Menu widget can use actions and non-action based menu
         * items allow hide and disabled to be functions. But when a menu uses an action that action still must not use
         * functions for disabled and hide.</p>
         *
         * <p>As an alternative to label (or onLabel, offLabel) you can specify labelKey (or onLabelKey, offLabelKey) and
         * the apex.lang.getMessage function will be used to lookup the label text. The localized label text is then stored in
         * the normal label/onLabel/offLabel property. This happens when the action is added. The same applies to titleKey
         * groupKey, and labelKey of each object in the choices array.</p>
         *
         * @prop {string} name A unique name for the action. By convention the style of names uses a dash to separate
         *   words as in "clear-log". Name must not contain spaces, ">", ":", quote, or double quote, or non-printing characters.
         * @prop {string} [idArg] Only applies when an action handles multiple instances such as when an action is used
         *   in a report row or list item. This is the name of the argument
         *   that uniquely identifies the bound UI element (button or input element for example) in the row or item.
         * @prop {string} [instanceSelector] Only applies when an action handles multiple instances. This is the selector
         *   of an ancestor element of the UI element bound to this action. This allows keyboard shortcuts to find
         *   the correct instance of the action.
         * @prop {string} label Translatable label for action used in buttons, menus etc. Note: if this is a
         *   radio group action (action has choices property) the label is optional. It is used in results of the list
         *   and listShortcuts methods. Depending on what kind of UI control the action is bound to it may be used as a label
         *   for the whole group. For example using aria-label.
         * @prop {string} [onLabel] Only for dynamic antonyms toggle actions. This is the label when the value is true.
         * @prop {string} [offLabel] Only for dynamic antonyms toggle actions. This is the label when the value is false.
         * @prop {string} [contextLabel] A more descriptive label used in place of label for use in listing actions and shortcuts.
         * @prop {string} [icon] The icon CSS class(es) for action may be used in buttons and menus
         * @prop {string} [onIcon] Only for dynamic antonyms toggle actions. This is the icon CSS class(es) to use when the value is true.
         * @prop {string} [offIcon] Only for dynamic antonyms toggle actions. This is the icon CSS class(es) to use when the value is false.
         * @prop {string} [iconType] The icon type CSS class. Defaults to a-Icon. Updates to the iconType
         *   may not be supported by all control types that can be associated with actions.
         * @prop {boolean} [disabled] Disabled state of action; true if the action is disabled and false if it is enabled. The default is enabled
         * @prop {boolean} [hide] Hidden state of action; true if UI controls connected to this action should be hidden and false otherwise.
         *   The default is false (show).
         * @prop {string} [title] The title to use as the title attribute when appropriate.
         * @prop {actions.shortcutName} [shortcut] The keyboard shortcut to invoke action (not allowed for radio group actions).
         * @prop {string} [href] For actions that navigate set href to the URL to navigate to and don't set an action function.
         *   An action of type action must have an href or action property set.
         * @prop {string} [target] For actions that navigate this is the window to open the href URL in. Only applies
         *   when href is specified. Typical value is "_blank" to open in a new tab or window. Omit to open in the
         *   current window.
         * @prop {function} [action] <em>function(event, focusElement, args):boolean</em> The function that is called when the
         *   action is invoked with {@link actions#invoke}. The action must return true if it sets focus. An action of
         *   type action must have an href or action property set. The args parameter is an optional object argument that
         *   can pass in additional data.
         * @prop {function} [get] <em>function(args):*</em>
         *   For toggle actions this function should return true or false. For radio group actions this
         *   should return the current value. The args parameter is an optional object argument that
         *   can pass in additional data.
         * @prop {function} [set] <em>function(value, args)</em>
         *   For toggle actions this receives a boolean value. For radio group actions this function receives
         *   the new value. The args parameter is an optional object argument that can pass in additional data.
         * @prop {Array} [choices] This is only for radio group actions. Array of objects. Each object has properties:
         *                   label, value, icon, iconType, shortcut, disabled, group (for select lists only)
         * @prop {string} [labelClasses] This is only for radio group actions. Classes to add to all radio labels. This and the next two label
         *   properties are only used when rendering radio group choices.
         * @prop {string} [labelStartClasses] Only for radio group actions. Classes to add to last radio label
         * @prop {string} [labelEndClasses] Only for radio group actions. Classes to add to last radio label
         * @prop {string} [itemWrapClasses] Only for radio group actions. Classes to add to a span wrapper element. Or to change the
         *   span use one of these prefixes: p:, li:, div:, span:<br>
         *   For example "li:myRadio"
         */

        /**
         * @typedef actions.shortcutName
         * @type {string}
         * @desc
         * <p>This is the string name of a keyboard shortcut. It represents the key(s) to be typed by the user and can
         * be a single key combination or a sequence of keys. The shortcut name must be given in the following format:<p>
         * <pre><code class="prettyprint">
         *   [Ctrl+][Alt+][Meta+][Shift+]key
         * </code></pre>
         *
         * <p>Where strings in square brackets ([]) are optional and represent a modifier key. The string <code class="prettyprint">key</code> is
         * the name of the key and may be one of: "0"-"9", "A"-"Z" or "Help", "Backspace", "Enter", "Escape",
         *   "Space", "Page Up", "Page Down", "End", "Home", "Left", "Up", "Right", "Down", "Insert", "Delete",
         *   "Keypad 0"-"Keypad 9", "Keypad *", "Keypad +", "Keypad -", "Keypad .", "Keypad /", "Keypad =",
         *   "Keypad Clear", "F1"-"F15",
         *   "Comma", "Period", "Semicolon", "Minus", "Quote", "Backtick", "=", "/", "[", "\", "]".
         * </p>
         * <p>Order and case is important. Key names and modifiers are not localized. The key names are based on
         * the standard US keyboard layout and may not correspond with what is actually printed on the key caps or
         * what character is printed (in the case of a printing key).
         * </p>
         * <p>The shortcut name can be a sequence of key combinations separated by commas. The user types the shortcut by
         * typing the first key combination followed by the second and so on. It is possible to have a sequence of length one,
         * which allows defining shortcuts as single letters without any modifier key. Letters can be in upper or lower case.
         * </p>
         * <p>The primary shortcut for an action is specified in the shortcut property of the {@link actions.action} object.
         * This is so that it can be shown in associated menu items.
         * Additional shortcuts can be added with {@link actions#addShortcut}.</p>
         *
         * <p>One limitation of shortcuts in the browser environment is that it is difficult to find keyboard combinations
         * that are not already used for something else and are consistent across all browsers, operating systems and with
         * all keyboard layouts. Key combinations used by the operating system or browser may not be passed on to the
         * actions keydown handler or even if they are the browser or operating system function has also already happened.
         * Many keyboard layouts use the Right side Alt key (known as AltGr) to enter additional characters. The AltGr key
         * can be simulated by pressing Ctrl+Alt. This makes some Ctrl+Alt combinations unavailable. On Mac OS the
         * Option/Alt key plus a letter or number is used to produce additional characters.
         * </p>
         * <p>See {@link apex.actions.shortcutSupport} for information about what kinds of shortcuts if any the user
         * can type. If shortcut support is "off" then no shortcuts are recognized. Shortcut sequences are only recognized
         * if shortcut support is "sequence". Shortcuts can always be defined.
         * <p>
         * <p>When focus is in a control that allows character input then shortcuts that would produce printable
         * characters or are used for editing are ignored by actions. This includes controls such as text fields and
         * text areas but also controls such as select lists that support type to select.</p>
         *
         * @example <caption>Example key combinations. Press the modifier keys in combination with the specified
         * key: W, F7, Page Down.</caption>
         *   Ctrl+W
         *   Ctrl+Shift+F7
         *   Alt+Page Down
         * @example <caption>Example key sequence. Press the first key combination Ctrl+F2 and release then press the G key
         * and then the H key. For the second example press the C key then the S key. In the third example press
         * C then 6 (not Shift+6). In the last example simply press W.
         * Although the letters must be in upper case in the shortcut name they can be typed with our without the Shift
         * modifier. All but the first example will be ignored when focus is in a control that takes character input.
         * </caption>
         *   Ctrl+F2,G,H
         *   C,S
         *   C,6
         *   W
         */

        /**
         * @lends actions.prototype
         */
        const actionsPrototype = {
            /**
             * <p>This is type name of the actions context as given in the {@link apex.actions.createContext} call.
             * The typeName of the global context apex.actions is "global".</p>
             *
             * @type {string}
             */
            typeName: typeName,

            /**
             * <p>This is the Element context that actions are scoped within as given in
             * the {@link apex.actions.createContext} call.</p>
             *
             * @type {Element}
             */
            context: context,
            /**
             * <p>Add an {@link actions.action} object or an array of {@link actions.action} objects to this actions context.
             * The action name must be unique within the context and the shortcut if any must be unique
             * within the context and valid. Debug warnings are logged if any of these conditions are not met.
             * See also {@link actions#remove}.</p>
             * <p>Note: The global actions context (apex.actions) does not exist until after the DOM is ready.
             * Actions should be added after the DOM is ready. For code in JavaScript files or in APEX page attribute
             * "Function and Global Variable Declaration" you can wrap the call to <code class="prettyprint">add</code>
             * in the jQuery ready handler if needed. For example:</p>
             * <pre class="prettyprint"><code>$( function() {
             *     apex.actions.add(...);
             * } );
             * </code></pre>
             *
             * @param {actions.action|actions.action[]} pActions The action or an array of actions to add.
             * @return {boolean} true if all the actions and shortcuts are added without errors or warnings,
             *   false otherwise.
             * @example <caption>This example adds one action to the global actions context.</caption>
             * apex.actions.add({
             *     name: "send-email",
             *     label: "Send Email",
             *     action: function(event, focusElement) {...}
             * });
             * @example <caption>This example adds an array of actions to the context
             * <code class="prettyprint">log1</code> returned by {@link apex.actions.createContext}.</caption>
             * log1.add([{
             *         name: "clear-log",
             *         label: "Clear",
             *         action: function(event, focusElement) {...}
             *     },
             *     {
             *         name: "verbose",
             *         label: "Verbose",
             *         get: function() {...},
             *         set: function(value) {...}
             *     },
             *     ...
             * ]);
             */
            add: function( pActions ) {
                let status = true;

                if ( !isArray( pActions ) ) {
                    pActions = [pActions];
                }
                for ( let i = 0; i < pActions.length; i++ ) {
                    let c, choice,
                        a = pActions[i];

                    if ( a.name ) {
                        if ( !actionMap.has( a.name ) ) {
                            actionMap.set( a.name, a );
                            if ( a.shortcut ) {
                                if ( !checkAndAddShortcut( this, a ) ) {
                                    status = false;
                                }
                            }
                            translateMessages( a, ACTION_LABELS );

                            if ( a.choices ) {
                                for ( c = 0; c < a.choices.length; c++ ) {
                                    choice = a.choices[c];

                                    if ( choice.shortcut ) {
                                        if ( !checkAndAddShortcut( this, a, choice ) ) {
                                            status = false;
                                        }
                                    }
                                    translateMessages( choice, CHOICE_LABELS );
                                }
                            }
                            notifyObservers( a, "add" );
                        } else {
                            debug.warn( "Duplicate action '" + a.name + "' ignored.");
                            status = false;
                        }
                    }
                }
                return status;
            },

            /**
             * <p>Add one or more {@link actions.action} objects from simple list markup. This is useful in cases where it is easier
             * to render list markup than an array of action objects. This does not support adding actions
             * with functions but action functions can be added either before or after.</p>
             * <p>The markup expected by this method overlaps with what the {@link menu} widget expects.</p>
             *
             * <p>Expected markup:</br>
             * An element with a <code class="prettyprint">&lt;ul&gt;</code> child. The
             * <code class="prettyprint">&lt;ul&gt;</code> has one or more <code class="prettyprint">&lt;li&gt;</code>
             * elements each one representing an action.
             * The <code class="prettyprint">&lt;li&gt;</code> element can contain either an
             * <code class="prettyprint">&lt;a&gt;</code> or <code class="prettyprint">&lt;span&gt;</code> element.</p>
             * <table>
             *   <caption>Action property markup source, for actions based on list markup</caption>
             *   <thead>
             *     <tr>
             *       <th scope="col">Action property</th>
             *       <th scope="col">Comes from</th>
             *     </tr>
             *   </thead>
             *   <tbody>
             *     <tr>
             *       <th scope="row">name</th>
             *       <td>li[data-id]</td>
             *     </tr>
             *     <tr>
             *       <th scope="row">label</th>
             *       <td>a or span content</td>
             *     </tr>
             *     <tr>
             *       <th scope="row">title</th>
             *       <td>a[title] or span[title]</td>
             *     </tr>
             *     <tr>
             *       <th scope="row">href</th>
             *       <td>a[href]</td>
             *     </tr>
             *     <tr>
             *       <th scope="row">target</th>
             *       <td>a[target]</td>
             *     </tr>
             *     <tr>
             *       <th scope="row">disabled</th>
             *       <td>true if li[data-disabled=true] false otherwise</td>
             *     </tr>
             *     <tr>
             *       <th scope="row">hide</th>
             *       <td>true if li[data-hide=true] false otherwise</td>
             *     </tr>
             *     <tr>
             *       <th scope="row">shortcut</th>
             *       <td>li[data-shortcut]</td>
             *     </tr>
             *     <tr>
             *       <th scope="row">icon</th>
             *       <td>li[data-icon] If the value has a space the icon is the word after the space
             *         otherwise it is the whole value</td>
             *     </tr>
             *     <tr>
             *       <th scope="row">iconType</th>
             *       <td>li[data-icon] If the value has a space the type is the word before the space</td>
             *     </tr>
             *   </tbody>
             * </table>
             *
             * <p>If there is no name or label or the value of <code class="prettyprint">&lt;href&gt;</code> equals
             * "separator" then no action is created for that <code class="prettyprint">&lt;li&gt;</code>.
             * If the <code class="prettyprint">&lt;li&gt;</code> has a <code class="prettyprint">&lt;ul&gt;</code>
             * child the <code class="prettyprint">&lt;ul&gt;</code> is processed recursively.</p>
             *
             * @param {jQuery} pList$ The jQuery object representing the parent of the actions list markup.
             * @example <caption>This example shows markup for two actions.</caption>
             * <div id="myActionList">
             *     <ul>
             *         <li data-id="goto-page-1">
             *             <a href="...">Page One</a>
             *         </li>
             *         <li data-id="goto-page-2">
             *             <a href="...">Page Two</a>
             *         </li>
             *     </ul>
             * </div>
             * @example <caption>This example shows how to turn the above markup into actions in the global context.</caption>
             * apex.actions.addFromMarkup($("#myActionList"));
             */
            addFromMarkup: function( pList$ ) {
                let self = this;

                // Keep this code in sync with menu widget.
                pList$.find( "ul" ).eq(0).children( "li" ).each(function() {
                    let icon, index, existingAction, target,
                        title = null,
                        $item = $( this ),
                        a$ = $item.find( "a" ).eq( 0 ), // dig a little deeper for custom content menus
                        span$ = $item.find( "span.a-Menu-label" ).eq( 0 ), // todo consider how to customize the a-Menu-label?
                        action = {};

                    if ( !span$.length ) {
                        span$ = $item.find( "span" ).eq( 0 );
                    }

                    if ( a$.length > 0 ) {
                        let href = a$.attr("href");

                        action.label = a$.text();
                        if ( !href.startsWith( ACTION_HREF_PREFIX ) ) {
                            action.href = href;
                            target = a$.attr( "target" );
                            if ( target ) {
                                action.target = target;
                            }
                            title = a$.attr( A_TITLE );
                        } // else it is a reference to an action and not the href that defines the action
                    } else if ( span$.length > 0 ) {
                        action.label = span$.text();
                        title = span$.attr(A_TITLE);
                    }
                    if ( title ) {
                        action.title = title;
                    }
                    action.name = $item.attr( "data-id" );
                    if ( $item.attr( "data-hide" ) === "true" ) {
                        action.hide = true;
                    }
                    if ( $item.attr("data-disabled") === "true" ) {
                        action.disabled = true;
                    }
                    action.shortcut = $item.attr("data-shortcut") || null;

                    icon = $item.attr("data-icon");
                    if ( icon ) {
                        index = icon.indexOf( " " );
                        if ( index >= 0 ) {
                            action.iconType = icon.substring( 0, index );
                            action.icon = icon.substring( index + 1 );
                        } else {
                            action.icon = icon;
                        }
                    }
                    // without a name or a label there is no action also separators are not actions
                    if ( action.name && action.label && action.href !== "separator" ) {
                        // first check for an existing action with same name
                        existingAction = self.lookup( action.name );
                        if ( existingAction ) {
                            // merge without overwriting
                            $.each( ["label", "href", "target", "hide", "disabled", "shortcut", "icon", "iconType"], function( _, prop ) {
                                if ( !existingAction[prop] && action[prop] ) {
                                    existingAction[prop] = action[prop];
                                }
                            } );
                        } else {
                            self.add( action );
                        }
                    }
                    if ( $item.children( "ul" ).length > 0 ) {
                        self.addFromMarkup( $item );
                    }
                });
            },

            /**
             * <p>Remove one or more {@link actions.action} objects from this actions context.
             * See also {@link actions#add}.</p>
             *
             * @param pActions {actions.action | string | actions.action[] | string[] } The action or action name or an array of actions
             *     or an array of action names to remove.
             * @example <caption>This example removes one action from the global action context.</caption>
             * apex.actions.remove( "send-email" );
             * @example <caption>This example removes an array of actions from the context
             * <code class="prettyprint">log1</code> returned by {@link apex.actions.createContext}.</caption>
             * log1.remove( ["clear-log", "verbose"] );
             */
            remove: function( pActions ) {
                if ( !isArray( pActions ) ) {
                    pActions = [pActions];
                }
                for ( let i = 0; i < pActions.length; i++ ) {
                    let c, choice, shortcut,
                        a = pActions[i],
                        name = typeof a === "string" ? a : a.name;

                    if ( name && actionMap.has( name ) ) {
                        a = actionMap.get( name );
                        shortcut = a.shortcut;
                        if ( shortcut ) {
                            removeShortcut(shortcut);
                        }
                        if ( a.choices ) {
                            // go through choices to clear out any shortcuts
                            for ( c = 0; c < a.choices.length; c++ ) {
                                choice = a.choices[c];
                                shortcut = choice.shortcut;
                                if ( shortcut ) {
                                    removeShortcut( shortcut );
                                    actionShortcut.delete( name + ACTION_SHORTCUT_SEPARATOR + choice.value );
                                }
                            }
                        }
                        actionMap.delete( name );
                        actionShortcut.delete( name );
                        notifyObservers( a, OP_REMOVE );
                    }
                }
            },

            /**
             * <p>Remove all actions from this actions context.</p>
             *
             * @example <caption>This example removes all the actions from the global context.</caption>
             * apex.actions.clear();
             */
            clear: function() {
                for ( const a of actionMap.values() ) {
                    notifyObservers( a, OP_REMOVE );
                }
                actionMap.clear();
                actionShortcut.clear();
                shortcutMap.clear();
            },

            /**
             * <p>Lookup and return an action by name. If you modify the properties of the action
             * you may need to call {@link actions#update} to update any associated UI elements or shortcuts.
             * If you modify the choices of the action then call {@Link actions#updateChoices}.</p>
             *
             * @param {string} pActionName The name of the action to return.
             * @return {actions.action} action or undefined if action doesn't exist.
             * @example <caption>This example updates the label and title of an action.</caption>
             * var action = apex.actions.lookup( "my-action" );
             * action.title = "New Title";
             * action.label = "New Label";
             * apex.actions.update( "my-action" );
             */
            lookup: function( pActionName ) {
                return actionMap.get( pActionName );
            },

            /**
             * <p>Return an array of actionName, label pairs for all actions in the context. For actions with
             * choices there is an array item for each choice.</p>
             *
             * @return {Array} An array of objects with name, label and optional choice properties.
             * @example <caption>This example writes to the console a list of all the actions in the global context.</caption>
             * apex.actions.list().forEach(function(a) {
             *     console.log( "Action Label: " + a.label +
             *         ", Name: " + a.name +
             *         (a.choice !== undefined ? ", Choice: " + a.choice : "" ) );
             * });
             */
            list: function() {
                let actionsList = [];

                for ( const [actionName, action] of actionMap ) {
                    let choice, label,
                        actionLabel = getActionLabel( action );

                    if ( action.choices ) {
                        for ( let i = 0; i < action.choices.length; i++ ) {
                            choice = action.choices[i];
                            if ( actionLabel ) {
                                label = actionLabel + ": " + choice.label;
                            } else {
                                label = choice.label;
                            }
                            actionsList.push({
                                name: actionName,
                                choice: choice.value,
                                label: label
                            });
                        }
                    } else {
                        actionsList.push({
                            name: actionName,
                            label: actionLabel
                        });
                    }
                }
                return actionsList;
            },

            /**
             * <p>Update any UI elements associated with the action after it changes. Calling update will
             * notify any observers that the action has changed. Debug warnings will be logged and
             * the return value is false if the action has a problem with the shortcut.</p>
             *
             * @param {string} pActionName The name of the action to update.
             * @param {object} [pArgs] An object containing arguments for the action. If the action is bound
             *   to many row or item instances in a report the <code class="prettyprint">pArgs</code> property
             *   with the same name as the {@link actions.action} <code class="prettyprint">idArg</code> property
             *   value is used to determine which UI element to update.
             * @return {boolean} false if the shortcut is invalid or a duplicate and true otherwise.
             * @example <caption>See example for {@link actions#lookup}</caption>
             */
            update: function( pActionName, pArgs ) {
                const a = actionMap.get( pActionName );
                let oldShortcut = actionShortcut.get( pActionName ),
                    status = true;

                if ( a.shortcut !== oldShortcut ) {
                    removeShortcut( oldShortcut );
                    if ( !a.shortcut ) {
                        // remove shortcut
                        actionShortcut.delete( pActionName );
                    } else {
                        if ( !checkAndAddShortcut( this, a ) ) {
                            status = false;
                        }
                    }
                }
                translateMessages( a, ACTION_LABELS );

                // go through choices to handle updates to choice shortcuts
                if ( a.choices ) {
                    for ( let i = 0; i < a.choices.length; i++ ) {
                        let choice = a.choices[i],
                            shortcutKey = pActionName + ACTION_SHORTCUT_SEPARATOR + choice.value;

                        oldShortcut = actionShortcut.get( shortcutKey );
                        if ( choice.shortcut !== oldShortcut ) {
                            removeShortcut( oldShortcut );
                            if ( !choice.shortcut ) {
                                // remove shortcut
                                actionShortcut.delete( shortcutKey );
                            } else {
                                if ( !checkAndAddShortcut( this, a, choice ) ) {
                                    status = false;
                                }
                            }
                        }
                        translateMessages( choice, CHOICE_LABELS );
                    }
                }

                notifyObserversUpdate( a, pArgs );
                return status;
            },

            /**
             * <p>Call this only if the set of choices for an action has changed. This will
             * notify any observers that the set of action choices has changed.</p>
             *
             * @param {string} pActionName The name of the action that has had its choices updated.
             * @return {boolean} false if the action has no choices and true otherwise
             * @example <caption>This example adds a new choice to the action "choose-fruit".</caption>
             * var action = apex.actions.lookup( "choose-fruit" );
             * action.choices.push( {
             *     label: "Apple",
             *     value: "APPLE"
             * } );
             * apex.actions.updateChoices( "choose-fruit" );
             */
            updateChoices: function( pActionName ) {
                const a = actionMap.get( pActionName );
                let status = false;

                if ( a.choices ) {
                    notifyObservers( a, "updateChoices" );
                    status = true;
                }
                return status;
            },

            /**
             * <p>Enable UI elements associated with the action by setting <code class="prettyprint">disabled</code> property to false.
             * This is a convenience method to enable without having to call {@link actions#lookup} and
             * {@link actions#update}.</p>
             *
             * @param {string} pActionName The name of the action to enable.
             * @param {object} [pArgs] An object containing arguments for the action. If the action is bound
             *   to many row or item instances in a report the <code class="prettyprint">pArgs</code> property
             *   with the same name as the {@link actions.action} <code class="prettyprint">idArg</code> property
             *   value is used to determine which UI element to enable.
             * @example <caption>This example enables the "send-email" action.</caption>
             * apex.actions.enable( "send-email" );
             */
            enable: function( pActionName, pArgs = null ) {
                modifyProp( pActionName, P_DISABLED, false, pArgs );
            },

            /**
             * <p>Disable UI elements associated with the action by setting <code class="prettyprint">disabled</code> property to true.
             * This is a convenience method to disable without having to call {@link actions#lookup} and
             * {@link actions#update}.</p>
             *
             * @param {string} pActionName The name of the action to disable.
             * @param {object} [pArgs] An object containing arguments for the action. If the action is bound
             *   to many row or item instances in a report the <code class="prettyprint">pArgs</code> property
             *   with the same name as the {@link actions.action} <code class="prettyprint">idArg</code> property
             *   value is used to determine which UI element to disable.
             * @example <caption>This example disables the "send-email" action.</caption>
             * apex.actions.disable( "send-email" );
             */
            disable: function( pActionName, pArgs = null ) {
                modifyProp( pActionName, P_DISABLED, true, pArgs );
            },

            /**
             * <p>Hide UI elements associated with the action by setting the <code class="prettyprint">hide</code> property to true.
             * This is a convenience method to hide without having to call {@link actions#lookup} and
             * {@link actions#update}.</p>
             *
             * @param {string} pActionName The name of the action to hide.
             * @param {object} [pArgs] An object containing arguments for the action. If the action is bound
             *   to many row or item instances in a report the <code class="prettyprint">pArgs</code> property
             *   with the same name as the {@link actions.action} <code class="prettyprint">idArg</code> property
             *   value is used to determine which UI element to hide.
             * @example <caption>This example hides the "send-email" action.</caption>
             * apex.actions.hide( "send-email" );
             */
            hide: function( pActionName, pArgs = null ) {
                modifyProp( pActionName, "hide", true, pArgs );
            },

            /**
             * <p>Show UI elements associated with the action by setting the <code class="prettyprint">hide</code> property to false.
             * This is a convenience method to show without having to call {@link actions#lookup} and
             * {@link actions#update}.</p>
             *
             * @param {string} pActionName The name of the action to show.
             * @param {object} [pArgs] An object containing arguments for the action. If the action is bound
             *   to many row or item instances in a report the <code class="prettyprint">pArgs</code> property
             *   with the same name as the {@link actions.action} <code class="prettyprint">idArg</code> property
             *   value is used to determine which UI element to show.
             * @example <caption>This example shows the "send-email" action.</caption>
             * apex.actions.show( "send-email" );
             */
            show: function( pActionName, pArgs = null ) {
                modifyProp( pActionName, "hide", false, pArgs );
            },

            /**
             * <p>Invoke the named action. Even though pEvent and pFocusElement are optional it is recommended to
             * always include them.</p>
             * <p>This has no effect if the action is hidden or disabled.</p>
             *
             * @param {string} pActionName Name of the action to invoke.
             * @param {Event} [pEvent] Browser event that caused the action to be invoked.
             * @param {Element} [pFocusElement] The element that will receive focus when the action is complete unless
             *   the action returns true. This is likely also the element that had focus when the action was invoked.
             * @param {object} [pArgs] An object containing arguments for the action. The object properties are the
             *   argument names and the property values are the argument values. This is passed to the action function
             *   as the third argument. This is not used if the action has only an href.
             * @return {boolean|undefined} false if there is no such action or action has no action method, true if action set the focus,
             *   all other cases should return undefined.
             * @example <caption>This example invokes the "send-email" action when something is clicked.</caption>
             * $( "#something" ).click( function( event ) {
             *     apex.actions.invoke( "send-email", event, event.target );
             * } );
             */
            invoke: function( pActionName, pEvent, pFocusElement, pArgs = null ) {
                const a = actionMap.get( pActionName );

                if ( a && ( a.action || a.href ) ) {
                    if ( !a.disabled && !a.hide ) {
                        if ( a.action ) {
                            return a.action( pEvent, pFocusElement, pArgs );
                        } else {
                            // it must be href
                            if ( a.target ) {
                                navigation.openInNewWindow( a.href, a.target, {favorTabbedBrowsing: true} );
                            } else {
                                navigation.redirect( a.href );
                            }
                            return true;
                        }
                    }
                } else {
                    errorNoSuchAction( pActionName, " or action can't be invoked." );
                    return false;
                }
                // intentionally "return" undefined here
            },

            /**
             * <p>Toggle the named action. This should only be used for toggle actions.
             * Toggle actions have get and set methods and don't have a choices property.</p>
             * <p>This has no effect if the action is hidden or disabled.</p>
             *
             * @param {string} pActionName Name of the action to toggle.
             * @param {object} [pArgs] An object containing arguments for the toggle action. The object properties are the
             *   argument names and the property values are the argument values. This is passed to the action's
             *   get and set functions as the last argument.
             * @return {boolean|undefined} false if there is no such action or action doesn't have get/set methods
             * all other cases should return undefined
             * @example <caption>This example toggles the "verbose" action of the context
             * <code class="prettyprint">log1</code> returned by {@link apex.actions.createContext}.</caption>
             * log1.toggle( "verbose" );
             */
            toggle: function( pActionName, pArgs = null ) {
                const a = actionMap.get( pActionName );

                if ( a && a.get && a.set && !a.choices ) {
                    if ( !a.disabled && !a.hide ) {
                        let value = !a.get( pArgs );
                        a.set( value, pArgs );
                        this.update( pActionName, pArgs );
                    }
                } else {
                    errorNoSuchAction( pActionName, " or action cannot be toggled." );
                    return false;
                }
                // intentionally "return" undefined here
            },

            /**
             * <p>Return the current value of a radio group or toggle action.</p>
             *
             * @param {string} pActionName The name of the action.
             * @param {object} [pArgs] An object containing arguments for the get function. The object properties are the
             *   argument names and the property values are the argument values. This is passed to the action's
             *   get function.
             * @return {?string} The current value or null if the action doesn't exist.
             * @example <caption>This example returns the current choice of radio group action "change-view"
             * of the interactive grid region with static id "emp". The Interactive Grid method getActions
             * returns the actions context for the region.</caption>
             * apex.region( "emp" ).call( "getActions" ).get( "change-view" );
             */
            get: function( pActionName, pArgs = null ) {
                const a = actionMap.get( pActionName );

                if ( a && a.get ) {
                    return a.get( pArgs );
                } else {
                    errorNoSuchAction( pActionName, " or cannot get action value." );
                    return null;
                }
            },

            /**
             * <p>Set the value of a radio group action or toggle action.</p>
             * <p>This has no effect if the action is hidden or disabled.</p>
             *
             * @param {string} pActionName The name of the action.
             * @param {string|boolean} pValue The value to set.
             * @param {object} [pArgs] An object containing arguments for the set function. The object properties are the
             *   argument names and the property values are the argument values. This is passed as the last argument
             *   to the action's set function.
             * @example <caption>This example sets the current choice of radio group action "change-view"
             * of the interactive grid region with static id "emp" to "detail". The Interactive Grid method getActions
             * returns the actions context for the region.</caption>
             * apex.region( "emp" ).call( "getActions" ).set( "change-view", "detail" );
             */
            set: function( pActionName, pValue, pArgs = null ) {
                const a = actionMap.get( pActionName );

                if ( a && a.get && a.set ) {
                    if ( !a.disabled && !a.hide ) {
                        // if setting a toggle action force the value to be boolean
                        if ( !a.choices ) {
                            pValue = !!pValue;
                        }
                        // otherwise allow setting any value even though it probably doesn't make much sense to
                        // set a value that isn't the value of one of the choices.
                        a.set( pValue, pArgs );
                        this.update( pActionName, pArgs );
                    }
                } else {
                    errorNoSuchAction( pActionName, " or cannot set action value." );
                }
            },

            /**
             * For internal use and testing.
             *
             * @ignore
             * @param {actions.shortcutName} pShortcutName The keyboard shortcut to lookup the action.
             * @return {string|Object} The action name that the shortcut invokes or an object for selecting
             *   a radio group action or undefined if there is no such shortcut name or if shortcuts are disabled.
             */
            _lookupShortcutAction: function( pShortcutName, _partial, _ignoreDisabled )  {
                if ( !shortcutsDisabled || _ignoreDisabled ) {
                    return lookupShortcut( pShortcutName, _partial );
                }
            },

            /**
             * <p>Add a keyboard shortcut synonym for an action. Debug warnings are logged if there are problems.
             * See also {@link actions#removeShortcut}.</p>
             * <p>This allows an action to have more than one shortcut key to invoke it.
             * The <code class="prettyprint">shortcut</code> property of the action is not affected.</p>
             *
             * @param {actions.shortcutName} pShortcutName The keyboard shortcut synonym to add.
             * @param {string} pActionName The name of the action to add a shortcut for.
             * @param {string} [pChoiceValue] Choice value only if the action is a radio group. The shortcut
             *   will select the given choice.
             * @return {boolean} true if successful and false if there is no such action or there is a duplicate shortcut.
             * @example <caption>This example adds a shortcut synonym for action "send-email".</caption>
             * apex.actions.addShortcut("Ctrl+Shift+E", "send-email");
             */
            addShortcut: function( pShortcutName, pActionName, pChoiceValue ) {
                const action = actionMap.get( pActionName );
                let found, lookupResult;

                if ( !action ) {
                    debug.warn( "No such action '" + pActionName + "'.");
                    return false;
                }
                if ( !this.isValidShortcut( pShortcutName )) {
                    debug.warn( "Invalid shortcut '" + pShortcutName + "' ignored." );
                    return false;
                }

                lookupResult = lookupShortcut( pShortcutName, true );
                if ( !lookupResult && !isArray( lookupResult ) ) {
                    if ( action.choices ) {
                        if ( !pChoiceValue ) {
                            debug.warn( "Shortcut '" + pShortcutName + "' for radio group action '" + pActionName + "' ignored.");
                            return false;
                        }
                        // make sure choice is valid
                        found = false;
                        for ( let i = 0; i < action.choices.length; i++ ) {
                            if ( action.choices[i].value === pChoiceValue ) {
                                found = true;
                                break;
                            }
                        }
                        if ( !found ) {
                            debug.warn( "No such choice '" + pChoiceValue + " for action '" + pActionName + "'.");
                            return false;
                        }
                    }
                    addShortcut( pShortcutName, pActionName, pChoiceValue );
                } else {
                    // could also be a prefix sequence of an existing sequence; if a,b,c is defined then a,b is not allowed
                    debug.warn( "Duplicate shortcut '" + pShortcutName + "' for action '" + pActionName + "' ignored.");
                    return false;
                }
                return true;
            },

            /**
             * <p>Remove a keyboard shortcut synonym for an action.
             * See also {@link actions#addShortcut}</p>
             *
             * @param {actions.shortcutName} pShortcutName The keyboard shortcut synonym to remove.
             * @return {boolean} true if successful false if the shortcut is the primary shortcut for an action.
             * @example <caption>This example removes a shortcut synonym.</caption>
             * apex.actions.addShortcut( "Ctrl+Shift+E" );
             */
            removeShortcut: function( pShortcutName ) {
                let actionName = lookupShortcut( pShortcutName, true );
                if ( isArray( actionName ) ) {
                    return false; // shortcut name must not be a partial sequence
                }
                if ( actionName && typeof actionName !== "string" ) {
                    actionName = actionName.actionName + ACTION_SHORTCUT_SEPARATOR + actionName.value;
                }
                if ( actionShortcut.get( actionName ) === pShortcutName ) {
                    debug.warn( "Can't delete primary for action.");
                    return false;
                }
                removeShortcut( pShortcutName );
                return true;
            },

            /**
             * <p>Return a list of all shortcuts in the context.</p>
             *
             * @param {boolean} pWithMarkup Optional default is false. If true wrap the display name in HTML markup.
             * @return {actions.shortcutListItem[]} An array of objects with information about the shortcut.
             * @example <caption>This example writes to the console all the shortcuts in the global context.</caption>
             * var i,
             *     shortcuts = apex.actions.listShortcuts();
             * for ( i = 0; i < shortcuts.length; i++ ) { // for each shortcut
             *      console.log("Press shortcut " + shortcuts[i].shortcutDisplay + " to " + shortcuts[i].actionLabel );
             * }
             */
            listShortcuts: function( pWithMarkup ) {
                const shortcutsReturn = [];

                for ( let [shortcutName, shortcutList] of shortcutMap ) {
                    let scItem, action, choiceValue, item, label;

                    // shortcutName may be the first part of a sequence
                    if ( !isArray( shortcutList ) ) {
                        // this is not a sequence make it look like one for simpler processing below
                        // shortcutList is an actionName or an object
                        scItem = {
                            shortcut: shortcutName
                        };
                        if ( typeof shortcutList !== "string" ) {
                            scItem.actionName = shortcutList.actionName;
                            scItem.value = shortcutList.value;
                        } else {
                            scItem.actionName = shortcutList;
                        }
                        shortcutList = [scItem];
                    }

                    for ( let s = 0; s < shortcutList.length; s++ ) {
                        scItem = shortcutList[s];
                        action = actionMap.get( scItem.actionName );

                        /**
                         * <p>Information about a shortcut.</p>
                         *
                         * @typedef {Object} actions.shortcutListItem
                         * @prop {string} shortcut The shortcut name.
                         * @prop {string} shortcutDisplay The shortcut display string.
                         * @prop {string} actionName The name of the action that the shortcut invokes.
                         * @prop {string} actionLabel The label of the action. For choice actions this includes the choice label.
                         */
                        item = {
                            shortcut: scItem.shortcut,
                            shortcutDisplay: this.shortcutDisplay( scItem.shortcut, pWithMarkup ),
                            actionName: scItem.actionName
                        };
                        choiceValue = scItem.value;

                        if ( choiceValue && action.choices ) {
                            item.choice = choiceValue;

                            for ( let i = 0; i < action.choices.length; i++ ) {
                                if ( action.choices[i].value === choiceValue ) {
                                    label = getActionLabel( action );
                                    if ( label ) {
                                        label += ":" + action.choices[i].label;
                                    } else {
                                        label = action.choices[i].label;
                                    }
                                    item.actionLabel = label;
                                    break;
                                }
                            }
                        } else {
                            item.actionLabel = getActionLabel( action );
                        }
                        shortcutsReturn.push( item );
                    }
                }
                return shortcutsReturn;
            },

            /**
             * <p>Return the friendly display string for a keyboard shortcut name.</p>
             *
             * @param {actions.shortcutName} pShortcutName Keyboard shortcut to get the display string for.
             * @param {boolean} [pWithMarkup] Optional default is false. If true wrap the display name in HTML markup.
             * @return {string} A friendly version of the shortcut.
             *   The display string is sensitive to the operating system. See {@link apex.actions.setKeyCaps}.
             */
            shortcutDisplay: function( pShortcutName, pWithMarkup = false ) {
                let kb, ke, pb, pe,
                    display = "",
                    seqParts = pShortcutName.split( "," );

                function diaplayKeyCombination( keyName ) {
                    let parts = keyName.split( "+" );

                    for ( let i = 0; i < parts.length; i++ ) {
                        if ( i > 0 ) {
                            display += pb + "+" + pe;
                        }
                        display += kb + ( gKeyCaps[parts[i]] || parts[i] ) + ke;
                    }
                }

                kb = ke = pb = pe = "";
                if ( pWithMarkup ) {
                    kb = "<b>";
                    ke = "</b>";
                    pb = "<i>";
                    pe = "</i>";
                    display = "<span class='apex-kb-shortcut'>";
                }
                for ( let i = 0; i < seqParts.length; i++ ) {
                    if ( i > 0 ) {
                        display += ", ";
                    }
                    diaplayKeyCombination( seqParts[i] );
                }
                if ( pWithMarkup ) {
                    display += "</span>";
                }

                return display;
            },

            /**
             * <p>This is used to disable all shortcuts temporarily. Call at the start of a user interaction
             * that should have shortcuts disabled for example a custom popup. Call {@link actions#enableShortcuts} when
             * finished. It is called automatically when APEX modal dialogs or menus open.
             * Calls can be nested. For each call to disableShortcuts there should be a corresponding
             * call to {@link actions#enableShortcuts}.</p>
             */
            disableShortcuts: function() {
                disableDepth += 1;
                if ( disableDepth > 0 ) {
                    shortcutsDisabled = true;
                }
            },

            /**
             * <p>This is used to enable all shortcuts after they were disabled with {@link actions#disableShortcuts}.
             * It is called automatically when APEX modal dialogs or menus close.
             * Calls can be nested. For each call to {@link actions#disableShortcuts} there should be a corresponding
             * call to enableShortcuts.</p>
             */
            enableShortcuts: function() {
                disableDepth -= 1;
                if ( disableDepth <= 0 ) {
                    shortcutsDisabled = false;
                    disableDepth = 0;
                }
            },

            /**
             * <p>Register a callback function to be notified when an action changes.
             * This is used to update UI elements associated with an action when that action state changes.
             * The most common elements including buttons, checkbox and radio group inputs, select lists,
             * and menus are already handled.</p>
             *
             * @param {function} pCallback function notifyObservers( action, operation, args )
             * <ul>
             * <li><em>action</em> is the {@Link actions.action} object that has had a change in state or value.</li>
             * <li><em>operation</em> is one of "add", "remove", "update", or "updateChoices".</li>
             * <li><em>args</em> is an optional object containing any arguments that were passed to the function that
             * updated the action. See the <code class="prettyprint">pArgs</code> parameter to the {@link actions#invoke},
             * {@link actions#update} functions and others for more information about this parameter.</li>
             * </ul>
             */
            // todo add an example for this function such as update a link label
            observe: function( pCallback ) {
                observers.push( pCallback );
            },

            /**
             * <p>Remove callback.</p>
             *
             * @param {function} pCallback The function that was added with {@link actions#observe}.
             */
            unobserve: function( pCallback ) {
                for ( let i = 0; i < observers.length; i++ ) {
                    if ( observers[i] === pCallback ) {
                        observers.splice(i, 1);
                        break;
                    }
                }
            },

            /**
             * @ignore
             * @param {actions.shortcutName} pShortcutName
             * @param {boolean} [pCheckIfUsed]
             * @return {boolean}
             */
            isValidShortcut: function( pShortcutName, pCheckIfUsed ) {
                let seqParts = pShortcutName.split( "," );

                function validKeyCombination(keyName) {
                    let i, part, nextPos, key,
                        pos = 0,
                        valid = true,
                        parts = keyName.split( "+" );

                    // check all the modifiers
                    for ( i = 0; i < parts.length - 1; i++ ) {
                        part = parts[i];
                        if ( part === "Ctrl" ) {
                            nextPos = 1;
                        } else if ( part === "Alt" ) {
                            nextPos = 2;
                        } else if ( part === "Meta" ) {
                            nextPos = 3;
                        } else if ( part === "Shift" ) {
                            nextPos = 4;
                        } else {
                            valid = false;
                            break;
                        }
                        if ( nextPos <= pos ) {
                            valid = false;
                            break;
                        }
                        pos = nextPos;
                    }
                    if ( valid ) {
                        part = parts[i]; // the key name
                        // now assume not valid
                        valid = false;
                        // find keyname in map
                        for ( key in mapKeyToName ) {
                            if ( mapKeyToName[key] === part ) {
                                valid = true;
                                break;
                            }
                        }
                    }
                    return valid;
                }

                for ( let i = 0; i < seqParts.length; i++ ) {
                    if ( !validKeyCombination(seqParts[i]) ) {
                        return false;
                    }
                }
                return !( pCheckIfUsed && lookupShortcut( pShortcutName, true ) );
            }
        };
        return actionsPrototype;
    }

    // todo allow customizing these selectors? Something a theme may want to do
    let buttonSelector = ".a-Button, .t-Button", // indicates that something is styled like a button and hopefully follows
                                                 // same rules for labels and icons below.
        buttonLabelSelector = ".a-Button-label, .t-Button-label", // how to find where to update the label text
        buttonHasIconSelector = ".a-Button--withIcon, .t-Button--icon", // how to tell if a button has an icon
        buttonNoLabelSelector = ".a-Button--noLabel, .t-Button--noLabel", // how to tell if a button has no label text
        linkLabelSelector = ".t-MegaMenu-label, .t-NavTabs-label, .t-BadgeList-label, .t-Card-title, .t-LinksList-label, .a-CardView-buttonLabel, .t-Button-label";

    const gActionContextTypes = new Map();

    /**
     * <p>Create a new {@link actions} interface object that is scoped to the given DOM element context.
     * Any action buttons or other UI elements must be within the given pContext. Focus must be within pContext for
     * keyboard shortcuts defined in this context to be recognized. A global context at
     * <code class="prettyprint">document.body</code> is created automatically and is accessed from apex.actions.
     * The global context type name is "global".</p>
     *
     * <p>Plug-ins that define actions should use {@link apex.actions.createContext} and add actions to the created
     * context after calling {@link apex.region.create}.</p>
     *
     * @function createContext
     * @memberof apex.actions
     * @param {string} pTypeName Type name of the actions context.
     * @param {Element} pContext DOM element context that actions are scoped within.
     * @return {actions} The actions interface object that was created.
     * @example <caption>This example creates a context within the element with id
     * <code class="prettyprint">myLogger</code> with type name "logger". Actions can then be added to the
     * actions interface <code class="prettyprint">log1</code>.</caption>
     * var log1 = apex.actions.createContext( "logger", $("#myLogger")[0] );
     */
    // pRegionID for internal use. Allows a region (like IG) to create the context before creating the region
    function createContext( pTypeName, pContext, pRegionId ) {
        let typeList,
            curSequence = null;
        const context$ = $( pContext ),
            actions = makeActionContext( pTypeName, pContext );

        // remove it first just in case
        removeContext( pTypeName, pContext );

        typeList = gActionContextTypes.get( pTypeName );
        if ( !typeList ) {
            typeList = [];
            gActionContextTypes.set( pTypeName, typeList );
        }
        typeList.push( actions );

        // todo consider how a custom UI control can set up its observer at this time currently they are at a disadvantage compared to the built in UI controls
        actions.observe( function( action, op, args ) {
            let actionElements$,
                scope$ = context$,
                name = action.name,
                instanceId = ( action.idArg && args ) ? args[action.idArg] : null;

            function updateIcons( el$, iconType, newIcon ) {
                // icons don't typically have classes besides the one for icon type and icon but if they do
                // assume they all start with "t-".
                // todo consider if the prefix or set of classes to keep should be customizable
                // todo this doesn't handle the case where a button has more than one icon
                el$.find( "." + iconType ).each( function() {
                    let icon$ = $( this ),
                        newClasses = [],
                        classes = icon$.attr( "class" );

                    $.each( classes.split( " " ), function( i, c ) {
                        if ( /^t-/.test( c ) ) {
                            newClasses.push( c );
                        }
                    } );
                    newClasses.push( iconType );
                    newClasses.push( newIcon );
                    icon$.attr( "class", newClasses.join( " " ) );
                });
            }

            // if there is an instanceId it is probably more likely unique than the action name so look for it first
            if ( instanceId ) {
                // todo maybe there should be other ways to supply instance context arguments. Think about needs of context menus
                // The assumption is that any instance action element will have at least one wrapping element
                // representing the instance or inside of it, therefore get the parent for use in the next step
                scope$ = $( `[data-action*="=${util.escapeCSS( instanceId )}"],[href*="=${util.escapeCSS( instanceId )}"]`, context$ ).parent();
            }
            // if this is not the global context look for UI elements outside this context that are explicitly bound to actions in this context
            if ( context$[0] !== document.body ) {
                if ( !pRegionId ) {
                    pRegionId = context$.closest( ".js-apex-region" ).prop( "id" );
                }
                let contextId = pRegionId ? pRegionId : context$.prop( "id" );

                if ( contextId ) {
                    scope$ = scope$.add( $( `[data-action*="[${util.escapeCSS( contextId )}]"], [href*="[${util.escapeCSS( contextId )}]"]` ).parent() );
                }
            }
            actionElements$ = $( `[data-action*="${util.escapeCSS( name )}"],[href*="${util.escapeCSS( name )}"]`, scope$ );

            if ( op !== OP_REMOVE) {
                // update elements associated with the action
                actionElements$.each( function() {
                    let lastGroup, id, cls, iconType, value, input$, label$, textLabel$,
                        idPrefix, rbStartClasses, rbClasses, rbEndClasses, rbWrapElement, rbWrapClasses, shortcutText,
                        elementType, choices$, binding,
                        isButtonLike = false,
                        actionType = "action",
                        el$ = $( this );

                    // make sure this element is really associated with the action
                    if ( this.nodeName === "A" ) {
                        binding = el$.attr( "href" );
                    } else {
                        binding = el$.attr( A_ACTION );
                    }
                    binding = parseActionBinding( binding );
                    if ( !binding || binding.actionName !== name ) {
                        return; // this is some other element not bound to this action
                    }
                    if ( action.idArg && args && binding.args[action.idArg] !== instanceId ) {
                        return; // this is not the right instance
                    }

                    // if instanceId is set it means the update is for this specific instance of the action and we only
                    // update the hidden and disabled states
                    // todo this could be reconsidered in the future but it would mean keeping the per-instance state
                    //    in the action or the action getting the state from the DOM element (but which one)
                    if ( action.hide ) {
                        el$.hide();
                        return;
                    } // else
                    el$.show();

                    // determine if the action is radio group or toggle and save value for later
                    if ( action.get ) {
                        if ( action.choices ) {
                            actionType = AT_RADIO;
                        } else {
                            actionType = AT_TOGGLE;
                        }
                        value = action.get( op === "add" ? binding.args : args );
                    }
                    // determine the type of element (ui control)
                    // some combinations of actionType and elementType don't make sense but we don't check for that
                    // it is up the the caller to match up actions to appropriate markup
                    if ( el$.is( SEL_ACTION_SELECT ) ) {
                        elementType = T_SELECT;
                    } else if ( el$.is( SEL_ACTION_RADIO_GROUP ) ) {
                        elementType = T_RADIO;
                    } else if ( el$.is( SEL_ACTION_CHECKBOX ) ) {
                        elementType = T_CHECKBOX;
                        input$ = el$;
                        if ( input$[0].nodeName !== N_INPUT ) {
                            input$ = el$.find( "input" );
                         }
                        label$ = getLabelFor( input$[0] );
                        if ( label$.is( buttonSelector ) ) {
                            isButtonLike = true;
                            textLabel$ = el$.find( buttonLabelSelector ).first();
                            if ( !textLabel$.length ) {
                                textLabel$ = label$;
                            }
                        } else {
                            textLabel$ = label$;
                        }
                    } else if ( el$.is( SEL_ACTION_BUTTON ) ) {
                        elementType = T_BUTTON;
                        // if the label is in a .t/.a-Button-label span use that otherwise its the whole text content of the button
                        textLabel$ = el$.find( buttonLabelSelector ).first();
                        if ( !textLabel$.length ) {
                            textLabel$ = el$;
                        }
                    } else if ( el$.is( SEL_ACTION_LINK ) ) {
                        elementType = T_LINK;
                        // if the label is in a specific span use that otherwise its the whole text content of the anchor
                        textLabel$ = el$.find( linkLabelSelector ).first();
                        if ( !textLabel$.length ) {
                            textLabel$ = el$;
                        }
                        // Links can only be bound to actions. Currently only the disabled and hide states are updated
                        // todo consider if/how label and icon state can be bound to links
                    }
                    if ( !elementType ) {
                        return; // this is not an element we know how to update so skip it
                    }

                    if ( op === "updateChoices" ||
                            ( op === "add" && actionType === AT_RADIO && el$.children().length === 0 ) ) {
                        let out = util.htmlBuilder();

                        // generate select options or radio group radio inputs based on choices
                        if ( elementType === T_SELECT ) {
                            lastGroup = null;
                            for ( let i = 0; i < action.choices.length; i++ ) {
                                let choice = action.choices[i];

                                if ( choice.hide ) {
                                    continue;
                                }
                                if ( choice.group !== undefined && choice.group !== lastGroup ) {
                                    if ( lastGroup !== null ) {
                                        out.markup("</optgroup>");
                                    }
                                    if ( choice.group !== null ) {
                                        out.markup("<optgroup")
                                            .attr("label", choice.group)
                                            .markup(">");
                                    }
                                    lastGroup = choice.group;
                                }
                                out.markup( "<option" )
                                    .attr( "value", choice.value )
                                    .markup( ">" )
                                    .content( choice.label )
                                    .markup( "</option>" );
                            }
                        } else if ( elementType === T_RADIO ) {
                            idPrefix = el$.closest( "[id]" )[0].id + "_" + action.name;
                            rbStartClasses = el$.attr( "data-item-start" ) || action.labelStartClasses;
                            rbClasses = el$.attr( "data-item" ) || action.labelClasses;
                            rbEndClasses = el$.attr( "data-item-end" ) || action.labelClasses;
                            rbWrapClasses = el$.attr( "data-item-wrap" ) || action.itemWrapClasses || false;
                            rbWrapElement = false;
                            if (rbWrapClasses ) {
                                rbWrapElement = rbWrapClasses ? "span" : false;
                                if ( rbWrapClasses && rbWrapClasses.indexOf( ":" ) > 0 ) {
                                    rbWrapClasses = rbWrapClasses.split( ":" );
                                    rbWrapElement = rbWrapClasses[0];
                                    rbWrapClasses = rbWrapClasses[1];
                                }
                                // the wrapping element, if there is one, must be one of p, li, span, div
                                if ( rbWrapElement && {"p":1,"li":1,"span":1,"div":1}[rbWrapElement] !== 1 ) {
                                    rbWrapElement = "span";
                                }
                            }
                            for ( let i = 0; i < action.choices.length; i++ ) {
                                let choice = action.choices[i];

                                if ( choice.hide ) {
                                    continue;
                                }
                                id = idPrefix + "_" + i;
                                if ( i === 0 && rbStartClasses ) {
                                    cls = rbStartClasses;
                                } else if ( i === action.choices.length - 1 && rbEndClasses ) {
                                    cls = rbEndClasses;
                                } else {
                                    cls = rbClasses || "";
                                }
                                if ( rbWrapElement ) {
                                    out.markup( "<" + rbWrapElement )
                                        .attr( "class", rbWrapClasses )
                                        .markup( ">" );
                                }
                                out.markup( "<input type='radio'" )
                                    .attr( "name", idPrefix )
                                    .attr( "id", id )
                                    .attr( "value", choice.value )
                                    .markup( "><label" )
                                    .attr( "for", id)
                                    .attr( "class", cls )
                                    .attr( A_TITLE, choice.title || choice.icon ? choice.title || choice.label : null )
                                    .markup( ">" );
                                if ( choice.icon ) {
                                    // assume if there is an icon then it should be an icon only radio button
                                    out.markup( "<span class='u-VisuallyHidden'>" )
                                        .content( choice.label )
                                        .markup( "</span><span aria-hidden='true'" )
                                        .attr( "class", (choice.iconType || "a-Icon") + " " +  choice.icon )
                                        .markup( "></span>" );
                                } else {
                                    out.content( choice.label );
                                }
                                out.markup( "</label>" );
                                if ( rbWrapElement ) {
                                    out.markup( "</" + rbWrapElement + ">" );
                                }
                            }
                        }
                        el$.html( out.toString() );

                    } else if ( op === "add" ) {
                        // initialize action from markup when first added
                        if ( action.label === null ) {
                            // initialize action text from button
                            // the label of a toggle button action can't come from the markup
                            if ( elementType === T_BUTTON && actionType === "action" ) {
                                if ( el$.attr( A_LABEL ) ) {
                                    // if there is a label for AT use that as the label
                                    action.label = el$.attr( A_LABEL );
                                } else if ( el$.is( buttonNoLabelSelector ) ) {
                                    // if there is no button label text use the title
                                    action.label = el$.attr( A_TITLE );
                                } else {
                                    action.label = textLabel$.text();
                                }
                            } else if ( elementType === T_CHECKBOX && actionType === AT_TOGGLE ) {
                                if ( isButtonLike && label$.is( buttonNoLabelSelector ) ) {
                                    // if there is no checkbox button label text look for hidden but accessible child
                                    action.label = label$.find( ".u-VisuallyHidden" ).first().text();
                                    if ( !action.label ) {
                                        // fall back to title
                                        action.label = label$.attr( A_TITLE );
                                    }
                                } else {
                                    action.label = textLabel$.text();
                                }
                            } else if ( elementType === T_LINK ) {
                                if ( el$.attr( A_LABEL ) ) {
                                    // if there is a label for AT use that as the label
                                    action.label = el$.attr( A_LABEL );
                                } else {
                                    action.label = textLabel$.text();
                                }
                            } else {
                                if ( el$.attr( A_LABEL ) ) {
                                    // if there is a label for AT use that as the label
                                    action.label = el$.attr( A_LABEL );
                                }
                            }
                        }
                        if ( action.title === null && elementType !== T_RADIO ) {
                            action.title = el$.attr( A_TITLE );
                            // if that didn't work see if there is a title on the label
                            if ( ! action.title && label$ ) {
                                action.title = label$.attr( A_TITLE );
                            }
                            // The above code should handle most cases of finding the label but just in case fall back to the title
                            if ( !action.label && action.title ) {
                                action.label = action.title;
                            }
                        }
                        // there is no reliable way to get the icon from the markup

                        if ( action.disabled === null ) {
                            action.disabled = !!( el$.prop( P_DISABLED ) || ( input$ && input$.prop( P_DISABLED ) ) );
                        }
                    }

                    // update markup with action properties
                    // note radio group labels/icons etc. are not updated - use updateChoices
                    let label = action.label,
                        title = action.title,
                        icon = action.icon;

                    if ( actionType === AT_TOGGLE ) {
                        if ( !label ) {
                            label = value ? action.onLabel : action.offLabel;
                        }
                        if ( !icon && action.onIcon ) {
                            icon = value ? action.onIcon : action.offIcon;
                        }
                    }
                    shortcutText = "";
                    if ( action.shortcut && gAllowShortcuts ) {
                        // shortcut hint to add to title/label
                        shortcutText = " (" + actions.shortcutDisplay( action.shortcut ) + ")";
                    }

                    // update label, title, icon
                    //  unless element has data-no-update attribute or this is for a specific instance
                    if ( el$.attr( "data-no-update" ) === undefined && !instanceId && elementType !== T_LINK ) {
                        if ( elementType === T_BUTTON && el$.is( buttonNoLabelSelector ) ) {
                            el$.attr( A_LABEL, label + shortcutText );
                            // on a button with no label and no title force the title to be the label
                            if ( !title ) {
                                title = label;
                            }
                        } else if ( elementType === T_CHECKBOX && actionType === AT_TOGGLE && isButtonLike && label$.is( buttonNoLabelSelector ) ) {
                            label$.find( ".u-VisuallyHidden" ).first().text( label );
                            // on a button with no label and no title force the title to be the label
                            if ( !title ) {
                                title = label;
                            }
                        } else if ( actionType === AT_RADIO ) {
                            if ( label ) {
                                el$.attr( A_LABEL, label );
                            } else {
                                el$.removeAttr( A_LABEL );
                            }
                            // for select lists that generally have no label use the label as the title if there isn't one
                            if ( elementType === T_SELECT && !title ) {
                                title = label;
                            }
                        } else if ( textLabel$ ) {
                            textLabel$.text( label );
                            if ( shortcutText ) {
                                // In case label is undefined, default it to the current textLabel
                                el$.attr( A_LABEL, ( label || textLabel$.text() ) + shortcutText );
                            } else {
                                el$.removeAttr( A_LABEL );
                            }
                        }

                        // radio groups don't have a title because it would get in the way of titles on each radio button
                        if ( elementType && elementType !== T_RADIO ) {
                            if ( shortcutText ) {
                                // force a title to show the shortcut
                                if ( !title ) {
                                    title = "";
                                }
                                title += shortcutText;
                            }
                            if ( title ) {
                                el$.attr( A_TITLE, title );
                            } else {
                                el$.removeAttr( A_TITLE );
                            }
                        }

                        if ( elementType === T_BUTTON && icon && ( el$.is( buttonHasIconSelector ) ) ) {
                            iconType = action.iconType || "a-Icon";
                            updateIcons( el$, iconType, icon );
                        } else if ( isButtonLike && icon && ( label$.is( buttonHasIconSelector ) ) ) {
                            iconType = action.iconType || "a-Icon";
                            updateIcons( label$, iconType, icon );
                        }
                    }

                    // set the value/active state
                    if ( actionType !== "action" ) {
                        if ( elementType === T_SELECT ) {
                            el$.val( value );
                        } else if ( elementType === T_RADIO ) {
                            el$.find( "." + C_ACTIVE ).removeClass( C_ACTIVE );
                            input$ = el$.find( "[value=" + util.escapeCSS( value ) + "]" );
                            input$.prop( "checked", true );
                            if ( input$.length ) {
                                label$ = getLabelFor( input$[0] );
                                label$.addClass( C_ACTIVE );
                            }
                        } else if ( elementType === T_CHECKBOX ) {
                            input$.prop( "checked", !!value );
                            label$.toggleClass( C_ACTIVE, value );
                        } else if ( el$.is( SEL_ACTION_BUTTON ) ) {
                            if ( actionType === AT_TOGGLE && !action.onLabel ) {
                                el$.toggleClass( C_ACTIVE, value );
                            }
                        }
                    }

                    // update the disabled state
                    let disabled = !!action.disabled;

                    if ( elementType === T_CHECKBOX ) {
                        input$.prop( P_DISABLED, disabled );
                    } else if ( elementType === T_RADIO || elementType === T_SELECT ) {
                        choices$ = el$.find("option,input"); // should work for radio buttons or select lists
                        for ( let i = 0; i < action.choices.length; i++ ) {
                            let choice = action.choices[i];
                            choices$.eq( i ).prop( P_DISABLED, !!choice.disabled );
                        }
                        // select based radio group is special in that the whole select list can be disabled
                        if ( elementType === T_SELECT ) {
                            el$.prop( P_DISABLED, disabled );
                        }
                    } else if ( elementType === T_LINK ) {
                        el$.toggleClass( "is-disabled apex_disabled", disabled );
                    } else if ( elementType ) {
                        el$.prop( P_DISABLED, disabled );
                    }
                } );
            } else {
                actionElements$.hide();
            }
        });

        // invoke, set, or toggle the action
        // return true if the action is found or if an explicit context is given.
        function doAction( actionBinding, event, logPrefix, value ) {
            let action, result, boolValue,
                theActionsContext = actions,
                contextId = actionBinding.contextId,
                actionName = actionBinding.actionName;

            try {
                if ( contextId ) {
                    theActionsContext = apex.actions.findContextById( contextId );
                    if ( !theActionsContext ) {
                        debug.error( "No such context '" + contextId + "'" );
                        return true; // return true because no point looking for an action in a parent context
                    }
                }
                action = theActionsContext.lookup( actionName );
                if ( !action ) {
                    if ( theActionsContext.typeName === "global" || contextId ) {
                        errorNoSuchAction( actionName, "." );
                        return true; // no point in looking for more actions by this name
                    } // else
                    return false; // because just an action name was given (not a context) and the context is not the global one keep trying to find an action
                }

                if ( action.disabled || action.hide ) {
                    return true;
                }

                if ( action.action || action.href ) {
                    debug.info( logPrefix + " invoke action '" + actionName + "'");
                    result = theActionsContext.invoke( actionName, event, event.target, actionBinding.args );
                    if ( result === false ) {
                        return true;
                    }
                } else if ( action.get && action.set ) {
                    if ( value !== undefined ) {
                        action.set( value, actionBinding.args );
                        debug.info( logPrefix + " set action '" + actionName + "'. Value now " + value);
                    } else {
                        boolValue = !action.get( actionBinding.args );
                        action.set( boolValue, actionBinding.args );
                        debug.info( logPrefix + " toggle action '" + actionName + "'. Value now " + boolValue);
                    }
                    theActionsContext.update( actionName, actionBinding.args );
                } else {
                    debug.error("Error action '" + actionName + "' has no href or action, get, or set methods." );
                }
            } catch ( ex ) {
                // ignore error so focus can be set
                debug.error("Error in action for '" + actionName + "'.", ex );
            }

            if ( result !== true ) {
                event.target.focus();
            }
            return true;
        }

        /*
         * Handle actions buttons and keyboard shortcuts
         */
        context$.on( "click.actions", SEL_ACTION_BUTTON, function( event ) {
            let actionBinding = parseActionBinding( $( this ).attr( A_ACTION ) );

            if ( doAction( actionBinding, event, "Button click" ) ) {
                event.stopPropagation(); // if the action was found we are done, otherwise perhaps there is a parent context to handle it
            }
        } ).on( "click.actions", SEL_ACTION_LINK, function( event ) {
            let actionBinding = parseActionBinding( $( this ).attr( "href" ) );

            event.preventDefault();
            if ( doAction( actionBinding, event, "Link click" ) ) {
                event.stopPropagation();
            }
        } ).on( "click.actions", SEL_ACTION_CHECKBOX, function( event ) {
            let input,
                actionBinding = parseActionBinding( $( this ).attr( A_ACTION ) );

            if ( event.target.nodeName !== N_INPUT ) {
                return;
            }
            input = event.target;
            if ( doAction( actionBinding, event, "Checkbox click", input.checked ) ) {
                event.stopPropagation();
            }
        } ).on( "change.actions", SEL_ACTION_RADIO_GROUP, function( event ) {
            let actionBinding = parseActionBinding( $( this ).attr( A_ACTION ) ),
                input$ = $( this ).find( ":checked" ),
                value = "";

            if ( input$.length ) {
                value = input$.val();
            }
            if ( doAction( actionBinding, event, "Radio group change", value ) ) {
                event.stopPropagation();
            }
        } ).on( "change.actions", SEL_ACTION_SELECT, function( event ) {
            let actionBinding = parseActionBinding( $( this ).attr( A_ACTION ) ),
                select$ = $( this ),
                value = select$.val();

            if ( doAction( actionBinding, event, "Select change", value ) ) {
                event.stopPropagation();
            }
        } ).on( "keydown.actions", function( event ) {
            let actionName, value, keyName, e, key, prevSeq,
                partialShortcutInput = apex.actions.partialShortcutInput;

            if ( !gAllowShortcuts || event.isDefaultPrevented() ) {
                return;
            } // else

            e = event.originalEvent || event;
            prevSeq = curSequence;
            keyName = makeKeyName( e, !!curSequence );
            if ( keyName ) {
                if ( curSequence ) {
                    curSequence += "," + keyName;
                    keyName = curSequence;
                }
                actionName = actions._lookupShortcutAction( keyName, true );
                if ( isArray( actionName ) ) {
                    if ( !curSequence ) {
                        // the key combo is the start of a sequence
                        curSequence = keyName;
                    }
                    // this is a partial sequence so we are consuming this key
                    event.stopPropagation();
                    event.preventDefault();
                    actionName = null;
                } else if ( !actionName ) {
                    curSequence = null;
                }
                if ( actionName ) {
                    if ( curSequence && partialShortcutInput ) {
                        partialShortcutInput( actions.shortcutDisplay( curSequence ) );
                    }
                    curSequence = null;
                    if ( typeof actionName !== "string" ) {
                        value = actionName.value;
                        actionName = actionName.actionName;
                    }
                    // else value is undefined

                    let actionBinding = {
                            actionName: actionName
                        },
                        action = actions.lookup( actionName );

                    // attempt to get args if this action supports instances
                    if ( action && action.instanceSelector ) {
                        let inst$ = $( e.target ).closest( action.instanceSelector );

                        if ( inst$[0] ) {
                            let b,
                                el$ = inst$.find(
                                    $( `[data-action*="${util.escapeCSS( actionName )}"],[href*="${util.escapeCSS( actionName )}"]` ) );

                            // for instance actions can't use action state to tell if the action can be invoked
                            if ( el$[0] ) {
                                if ( !el$[0].disabled && !el$.hasClass( "is-disabled" ) && el$.is( ":visible" ) ) {
                                    b = parseActionBinding( el$.attr( A_ACTION ) || el$.attr( "href" ) || "" );

                                    if ( b && b.actionName === actionName && !b.contextId ) {
                                        actionBinding = b;
                                    }
                                } else {
                                    actionBinding = null;
                                }
                            }
                        }
                    }
                    if ( actionBinding ) {
                        doAction( actionBinding, event, "Shortcut key", value );
                    }
                    actionName = null;
                    event.stopPropagation();
                    event.preventDefault();
                }
            } else {
                // any other key should clear the current sequence but want to ignore modifier keys by themselves
                key = e.which;
                if ( key !== 16 && key !== 17 && key !== 18 && key !== 91 ) {
                    curSequence = null;
                }
            }
            if ( ( curSequence || prevSeq ) && partialShortcutInput ) {
                partialShortcutInput( curSequence ? actions.shortcutDisplay( curSequence ) : null );
            }
        } ).on( "menubeforeopen.actions", function() {
            actions.disableShortcuts();
        } ).on( "menuafterclose.actions", function() {
            actions.enableShortcuts();
        } ).on( "dialogopen.actions", function( event ) {
            if ( event.target !== actions.context && $( event.target ).dialog( "option", "modal" ) ) {
                actions.disableShortcuts();
            }
        } ).on( "dialogclose.actions", function( event ) {
            if ( event.target !== actions.context && $( event.target ).dialog( "option", "modal" ) ) {
                actions.enableShortcuts();
            }
        } );

        return actions;
    }

    /**
     * <p>Remove an actions context that was created with {@link apex.actions.createContext}.</p>
     *
     * @function removeContext
     * @memberof apex.actions
     * @param {string} pTypeName Type name of the actions context to remove.
     * @param {Element} pContext DOM element context that actions are scoped within.
     * @example <caption>This example removes the context for the element with id
     * <code class="prettyprint">myLogger</code> with type name "logger".</caption>
     * apex.actions.removeContext( "logger", $("#myLogger")[0] );
     */
    function removeContext( pTypeName, pContext ) {
        const typeList = gActionContextTypes.get( pTypeName );
        if ( typeList ) {
            for ( let i = 0; i < typeList.length; i++ ) {
                if ( typeList[i].context === pContext ) {
                    // found something to remove
                    let context$ = $( typeList[i].context );
                    context$.off(".actions");
                    typeList.splice( i, 1 );
                    if ( typeList.length === 0 ) {
                        gActionContextTypes.delete( pTypeName );
                    }
                    return;
                }
            }
        }
    }

    apex.actions = {};

    apex.actions.createContext = createContext;
    apex.actions.removeContext = removeContext;
    // this is for internal use only
    apex.actions.parseActionBinding = parseActionBinding;

    $( function() {
        // once the dom is ready mix in the global context
        // apex.actions is both the namespace and the global actions context
        extend( apex.actions, createContext( "global", document.body ) );
        gActionContextTypes.get( "global" )[0] = apex.actions; // make sure findContext and getContextsForType agree that the global context and namespace are the same
    } );

    /**
     * <p>Return an array of all the actions context type names.</p>
     *
     * @function getContextTypes
     * @memberof apex.actions
     * @return {string[]} An array of context type names.
     * @example <caption>This example will log to the console the number of actions in each of the action contexts
     * of all types on the page.</caption>
     * var i, j, types, type, contexts;
     * types = apex.actions.getContextTypes();
     * for ( i = 0; i < types.length; i++ ) { // for each context type
     *     type = types[i];
     *     contexts = apex.actions.getContextsForType( type );
     *     for ( j = 0; j < contexts.length; j++ ) { // for each context instance
     *         console.log("Action context type: " + type + " [" + j + "]. Actions: " + contexts[j].list().length );
     *     }
     * }
     */
    apex.actions.getContextTypes = function() {
        let types = [];
        for ( const t of gActionContextTypes.keys() ) {
            types.push( t );
        }
        return types;
    };

    /**
     * <p>Return an array of all the actions context instances for a given type.</p>
     *
     * @function getContextsForType
     * @memberof apex.actions
     * @param pTypeName {string} The type name of the actions contexts to return.
     * @return {actions[]} An array of action instances.
     * @example <caption>This example returns the contexts for type name "logger".</caption>
     * var loggers = apex.actions.getContextsForType( "logger" );
     */
    apex.actions.getContextsForType = function( pTypeName ) {
        return gActionContextTypes.get( pTypeName ) || [];
    };

    /**
     * <p>Return the actions interface for a given context. The pTypeName is optional but if given must
     * match the type name used when the context was created. This is not often needed because the actions object
     * returned from createContext should be saved by any widget/component that created the context.</p>
     *
     * @function findContext
     * @memberof apex.actions
     * @param {string} [pTypeName] The type name of the actions context.
     * @param {Element} pContext DOM element context that actions are scoped within.
     * @return {actions} The actions interface or undefined if there is no actions defined for pContext.
     * @example <caption>This example returns the context for the element with id
     * <code class="prettyprint">myLogger</code> and with type name "logger".</caption>
     * var log1 = apex.actions.findContext( "logger", $("#myLogger")[0] );
     * @example <caption>This example is the same as the previous one except it does not provide the type name.</caption>
     * var log1 = apex.actions.findContext( $("#myLogger")[0] );
     */
    apex.actions.findContext = function( pTypeName, pContext ) {
        let list, actions,
            matchContext = ( t ) => {
                return t.context === pContext;
            };

        // pTypeName is optional
        if ( !pContext ) {
            pContext = pTypeName;
            pTypeName = null;
        }
        if ( pTypeName ) {
            list = gActionContextTypes.get( pTypeName );
            if ( list ) {
                actions = list.find( matchContext );
            }
        } else {
            for ( const tn of gActionContextTypes.keys() ) {
                actions = gActionContextTypes.get( tn ).find( matchContext );
                if ( actions ) {
                    break;
                }
            }
        }
        return actions;
    };

    /**
     * <p>Return the actions interface for a context given by the element id of the context or the {@link apex.region}
     * that contains the context.</p>
     *
     * @param {string} pContextId Element id of the context element or the id of the APEX region that contains the context
     *   element as its widget element. If this parameter is "global" the global context is returned.
     * @returns {actions} The actions interface or undefined if there is no actions defined for pContextId.
     * @example <caption>This example returns the context for an Interactive Grid region with static id
     * <code class="prettyprint">contactsIG</code>.</caption>
     * var igActions = apex.actions.findContextById( "contactsIG" );
     * igActions === apex.region( "contactsIG" ).call( "getActions" ) // true;
     */
    apex.actions.findContextById = function( pContextId ) {
        if ( pContextId === "global" ) {
            return apex.actions;
        } // else
        let el = $( "#" + pContextId )[0],
            theActionsContext = apex.actions.findContext( null, el );

        if ( !theActionsContext ) {
            // see if there is a region with a widget that defines the context
            let region = apex.region( pContextId );

            if ( region && region.widget() ) {
                theActionsContext = apex.actions.findContext( null, region.widget()[0] );
            }
        }
        return theActionsContext;
    };

    /**
     * <p>This is used by UI that allows entering a shortcut name by typing that key combination.</p>
     * todo consider moving to a new actions config mixin module
     * @ignore
     * @function getShortcutFromEvent
     * @memberof apex.actions
     * @param {Event} pEvent
     * @return {?Object}
     */
    apex.actions.getShortcutFromEvent = function( pEvent ) {
        const keyName = makeKeyName( pEvent.originalEvent || pEvent, true );
        if ( keyName ) {
            return {
                shortcut: keyName,
                shortcutDisplay: this.shortcutDisplay( keyName )
            };
        }
        return null;
    };

    /**
     * <p>Get or set the type of shortcut key support. The default is "sequence".
     * </p>
     * <p>Note: The shortcut key support setting does not affect what shortcuts can be defined for actions
     * but only how what the user types is recognized.</p>
     *
     * @function shortcutSupport
     * @memberof apex.actions
     * @param {string} [pShortcutType] One of "off", "single", "sequence". If not specified the current value is returned.
     * @return {string|undefined} When no arguments are given returns the current setting otherwise returns nothing.
     * @example <caption>Get the current setting.</caption>
     * apex.actions.shortcutSupport();
     * @example <caption>Turn off the ability to use shortcuts on the page for all action contexts.</caption>
     * apex.actions.shortcutSupport( "off" );
     * @example <caption>Disable shortcut sequences such as C,B.</caption>
     * apex.actions.shortcutSupport( "single" );
     */
    apex.actions.shortcutSupport = function( pShortcutType ) {
        if ( pShortcutType === undefined ) {
            if ( gAllowShortcuts ) {
                return gAllowShortcutSequence ? "sequence" : "single";
            } // else
            return "off";
        } // else
        gAllowShortcuts = true;
        if ( pShortcutType === "single" ) {
            gAllowShortcutSequence = false;
        } else if ( pShortcutType === "sequence" ) {
            gAllowShortcutSequence = true;
        } else {
            gAllowShortcuts = false;
        }
    };

    /**
     * <p>Different types of keyboards for different types of operating systems or different languages can have
     * different symbols printed on the keys. The shortcuts must be defined according to {@link actions.shortcutName}.
     * This static method lets you set keyboard layout specific names or symbols to display for key names.
     * </p>
     * <p>Note: This affects how shortcuts are displayed not how they are defined.</p>
     *
     * @function setKeyCaps
     * @memberof apex.actions
     * @param {Object|null} pKeyCaps An object that maps the shortcutName key name such as "Ctrl" or "A" to the desired
     * word or character.  Pass in null to clear all the key cap mappings.
     * @example <caption>Set some key caps for a Spanish keyboard.</caption>
     * apex.actions.setKeyCaps( {
     *    "/": "Minus",
     *    "Quote": "{",
     *    "Minus": "?"
     * } );
     */
    apex.actions.setKeyCaps = function( pKeyCaps ) {
        // Keyboard layouts such as Dvorak or Cyrillic affect display. There is no JavaScript API to determine what the
        // keyboard type is. All we have is the "code" property (legacy IE/Edge use "which").
        if ( pKeyCaps === null ) {
            gKeyCaps = {};
        } else {
            gKeyCaps = extend( gKeyCaps, pKeyCaps );
            for ( let [k, v] of objectEntries( gKeyCaps ) ) {
                gKeyCaps[k] = util.stripHTML( v );
            }
        }
    };

    /**
     * <p>Returns the current key caps. See {@link apex.actions.setKeyCaps}.
     * </p>
     * @function getKeyCaps
     * @memberof apex.actions
     * @returns {Object}
     */
    apex.actions.getKeyCaps = function() {
        return extend( {}, gKeyCaps );
    };

    if ( gIsMac ) {
        apex.actions.setKeyCaps( {
            "Alt": "Option",
            "Meta": "\u2318",
            "Ctrl": "Control",
            "Backspace": "Delete"
        } );
    }

    /**
     * <p>Set keyboard shortcuts for all action contexts on the page.</p>
     *
     * Each key binding object contains these properties
     *       type: <string>,
     *       name: <string>,
     *       choice: <string>, // optional
     *       shortcut: <string> // can be null
     *       shortcuts: [<string>] // can be null or empty
     * Can have other properties that are ignored.
     *
     * todo consider moving to a new actions config mixin module
     * @ignore
     * @function setShortcutKeyBindings
     * @memberof apex.actions
     * @param {Array} bindings An array of objects with shortcut key binding data.
     */
    apex.actions.setShortcutKeyBindings = function( bindings ) {
        let binding, contexts, context, curAction, curChoice, actionName, actionShortcut, extraShortcuts, sKey,
            choiceValue, types, type, shortcuts,
            shortcutsIndex = {};

        // return true if shortcut needs to be added
        function checkShortcutAndClear( context, shortcut, actionName, choiceValue, primary ) {
            let foundChoiceValue, action, choice,
                isPrimary = false,
                foundActionName = context._lookupShortcutAction( shortcut, true, true );

            if ( isArray( foundActionName ) ) {
                return false; // shouldn't get a partial shortcut but ignore it if we do
            }

            if ( !foundActionName ) {
                // shortcut not in use so OK to add it
                return true;
            }

            if ( typeof foundActionName !== "string" ) {
                foundChoiceValue = foundActionName.value;
                foundActionName = foundActionName.actionName;
            }

            // is it primary
            action = context.lookup( foundActionName );
            if ( foundChoiceValue ) {
                for ( let i = 0; i < action.choices.length; i++ ) {
                    choice = action.choices[i];
                    if ( choice.value === foundChoiceValue ) {
                        isPrimary = choice.shortcut === shortcut;
                        break;
                    }
                }
            }  else {
                isPrimary = action.shortcut === shortcut;
            }
            if ( actionName === foundActionName && choiceValue === foundChoiceValue && isPrimary === primary ) {
                return false; // shortcut already defined no need to add
            }
            // shortcut used somewhere else (different action, different choice, or primary mismatch) so remove it
            if ( isPrimary ) {
                if ( foundChoiceValue ) {
                    choice.shortcut = null;
                }  else {
                    action.shortcut = null;
                }
                context.update( foundActionName );
            } else {
                context.removeShortcut( shortcut );
            }

            return true; // shortcut can now be added
        }

        // index all the shortcuts
        for ( let i = 0; i < bindings.length; i++ ) {
            binding = bindings[i];
            if ( binding.shortcut ) {
                sKey = binding.type + ":" + binding.shortcut;
                shortcutsIndex[sKey] = 1;
            }
            if ( binding.shortcuts ) {
                for ( let j = 0; j < binding.shortcuts.length; j++ ) {
                    sKey = binding.type + ":" + binding.shortcuts[j];
                    shortcutsIndex[sKey] = 1;
                }
            }
        }

        // remove any shortcuts that are not used in the bindings
        types = apex.actions.getContextTypes();
        for ( let i = 0; i < types.length; i++ ) { // for each context type
            type = types[i];
            contexts = apex.actions.getContextsForType( type );
            for ( let j = 0; j < contexts.length; j++ ) { // for each context instance
                context = contexts[j];
                shortcuts = context.listShortcuts();
                for ( let k = 0; k < shortcuts.length; k++ ) { // for each shortcut
                    sKey = type + ":" + shortcuts[k].shortcut;
                    if ( !shortcutsIndex[sKey] ) {
                        checkShortcutAndClear( context, shortcuts[k].shortcut );
                    }
                }
            }
        }

        for ( let i = 0; i < bindings.length; i++ ) { // for each binding
            binding = bindings[i];
            actionName = binding.name;
            choiceValue = binding.choice;
            actionShortcut = binding.shortcut;
            extraShortcuts = binding.shortcuts || [];
            if ( !actionShortcut && !extraShortcuts.length ) {
                continue; // there is no binding here
            }
            contexts = apex.actions.getContextsForType( binding.type );
            if ( contexts ) {
                for ( let j = 0; j < contexts.length; j++ ) {
                    context = contexts[j];
                    curAction = context.lookup( actionName );
                    if ( curAction ) {
                        if ( actionShortcut ) {
                            if ( checkShortcutAndClear( context, actionShortcut, actionName, choiceValue, true ) ) {
                                if ( choiceValue ) {
                                    for ( let k = 0; k < curAction.choices.length; k++ ) {
                                        curChoice = curAction.choices[k];
                                        if ( curChoice.value === choiceValue ) {
                                            curChoice.shortcut = actionShortcut;
                                            break;
                                        }
                                    }
                                } else {
                                    curAction.shortcut = actionShortcut;
                                }
                                context.update( actionName );
                            }
                        }
                        if ( extraShortcuts.length > 0 ) {
                            for ( let k = 0; k < extraShortcuts.length; k++ ) {
                                if ( checkShortcutAndClear( context, extraShortcuts[k], actionName, choiceValue, false ) ) {
                                    context.addShortcut( extraShortcuts[k], actionName, choiceValue );
                                }
                            }
                        }
                    }
                }
            }
        }
    };

    /**
     * A callback that a page can implement.
     *
     * @ignore
     * @function partialShortcutInput
     * @memberof apex.actions
     * @param {string} keySequence
     */

})( apex, apex.debug, apex.lang, apex.util, apex.navigation, apex.jQuery );
