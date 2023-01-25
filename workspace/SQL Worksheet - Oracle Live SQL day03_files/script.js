/**
 * Global name space
 */
const livesql = {
    // to be called on page 1 on page load
    parserDirectory: apex.env.APP_FILES + "/oracle-sql",
    initWorksheetEditor: () => {
        /**
         * Transforms the received range object from the API format (starting on 0)
         * into Monaco compliant one (starting on 1)
         * @param {AbstractCodeEditor.Range} range - Range object starting on 0 indexes (API compliant)
         * @return {Monaco.Range} Range object starting on 1 indexes (Monaco compliant)
         */
        function _getMonacoRangeFrom(range) {
            const startLineNumber = range?.start?.line || 0;
            const startColumn = range?.start?.column || 0;
            const endLineNumber = range?.end?.line || 0;
            const endColumn = range?.end?.column || 0;

            // Monaco columns and line numbers start on 1; unlike other libraries
            return new monaco.Range(
                startLineNumber + 1,
                startColumn + 1,
                endLineNumber + 1,
                endColumn + 1
            );
        }

        /**
         * Renders the inline error and the minimap sign
         * @param {Monaco.editor} editorModel - Monaco editor model
         * @param {AbstractCodeEditor.Error} errors - List of errors
         */
        function _renderInlineError(editorModel, errors) {
            const modelMarkers = [];
            for (const error of errors) {
                const errorPosition = _getMonacoRangeFrom(error.range);

                modelMarkers.push({
                    startLineNumber: errorPosition.startLineNumber,
                    startColumn: errorPosition.startColumn,
                    endLineNumber: errorPosition.endLineNumber,
                    endColumn: errorPosition.endColumn,
                    message: error.options.message,
                    severity: monaco.MarkerSeverity.Error
                });
            }
            monaco.editor.setModelMarkers(editorModel, "errors", modelMarkers);
        }

        (async () => {

            const editor$ = await (new Promise(resolve => {
                const editor$ =
                    $("#editor")
                        .css("height", "100%")
                        .codeEditor({
                            language: "sql",
                            value: apex.items.P1_SQL.value,
                            toolbar: false,
                            whitespace: false,
                            theme: "automatic",
                            tabsInsertSpaces: true,
                            indentSize: "4",
                            tabSize: "4",
                            ruler: false,
                            bracketPairColorization: true,

                            onInitialized: () => {
                                resolve(editor$);
                            }
                        });
            }));

            const editor = editor$.codeEditor("getEditor");
            const model = editor.getModel();

            /**
             * Code Font Size Logic
             */

            const FONT_SIZE_DEFAULT = 12;
            const FONT_SIZE_MEDIUM = 16;
            const FONT_SIZE_LARGE = 18;

            const fontSizeOptionId = monaco.editor.EditorOptions.fontSize.id;

            const getFontSize = () => {
                return Math.floor(editor.getOption(fontSizeOptionId));
            };

            const setEditorFontSize = fontSize => {
                editor.trigger("keyboard", "editor.action.fontZoomReset", {});
                editor.updateOptions({ fontSize: fontSize });
            };

            // overriding the default reset zoom action
            // so that it also resets the default font size
            // and not just what's been changed since page load
            const resetZoomAction = editor.getAction("editor.action.fontZoomReset");
            editor.addAction({
                id: resetZoomAction.id,
                label: resetZoomAction.label,
                alias: resetZoomAction.alias,
                run: () => {
                    editor.updateOptions({ fontSize: FONT_SIZE_DEFAULT });
                    resetZoomAction.run();
                }
            });

            const getCustomLabel = () => {
                const fontSize = getFontSize();
                return "Custom..." + (
                    ![FONT_SIZE_DEFAULT, FONT_SIZE_MEDIUM, FONT_SIZE_LARGE].includes(fontSize)
                        ? ` (${fontSize}px)`
                        : "");
            };

            const menu$ = $("#actions_menu");

            const menuItems = menu$.menu("option", "items");

            menuItems.push({
                href: "",
                icon: "fa-font-size",
                iconType: "fa",
                label: "Worksheet Font Size",
                type: "subMenu",
                action: "font-size-action",
                menu: {
                    items: [{
                        type: "toggle",
                        label: `Default (${FONT_SIZE_DEFAULT}px)`,
                        set: () => {
                            setEditorFontSize(FONT_SIZE_DEFAULT);
                            $(":root").css("--worksheet-font-size", "" + FONT_SIZE_DEFAULT + "px");
                        },
                        get: () => getFontSize() === FONT_SIZE_DEFAULT
                    }, {
                        type: "toggle",
                        label: `Medium (${FONT_SIZE_MEDIUM}px)`,
                        set: () => {
                            setEditorFontSize(FONT_SIZE_MEDIUM);
                            $(":root").css("--worksheet-font-size", "" + FONT_SIZE_MEDIUM + "px");
                        },
                        get: () => getFontSize() === FONT_SIZE_MEDIUM
                    }, {
                        type: "toggle",
                        label: `Large (${FONT_SIZE_LARGE}px)`,
                        set: () => {
                            setEditorFontSize(FONT_SIZE_LARGE);
                            $(":root").css("--worksheet-font-size", "" + FONT_SIZE_LARGE + "px");
                        },
                        get: () => getFontSize() === FONT_SIZE_LARGE
                    }, {
                        type: "toggle",
                        label: getCustomLabel(),
                        set: () => {
                            const fontSizeRaw = prompt("Enter the font size in pixels");
                            if( fontSizeRaw === null ) {
                                // cancel clicked
                                return;
                            }
                            const fontSize = parseInt( fontSizeRaw );
                            if (isNaN(fontSize) || fontSize < 1 || fontSize > 100) {
                                alert("The font size must be a valid number between 1 and 100px");
                            } else {
                                setEditorFontSize(fontSize);
                                $(":root").css("--worksheet-font-size", "" + fontSize + "px");
                            }
                        },
                        get: () => ![FONT_SIZE_DEFAULT, FONT_SIZE_MEDIUM, FONT_SIZE_LARGE].includes(getFontSize())
                    }]
                }
            });

            menu$.on("menubeforeopen", () => {
                menuItems[menuItems.length - 1].menu.items[3].label = getCustomLabel();
            });

            const fontSizeChangedCallback = apex.util.debounce(() => {
                apex.server.process("set_code_font_size_preference", {
                    x01: getFontSize()
                });
            }, 500);

            editor.onDidChangeConfiguration(function (evt) {
                if (evt.hasChanged(fontSizeOptionId)) {
                    fontSizeChangedCallback();
                }
            });

            // set initial editor font size
            setEditorFontSize( $(":root").css("--worksheet-font-size") || FONT_SIZE_DEFAULT );

            /**
             * syntax parser logic
             */
            const getParsingErrors = await (new Promise(resolve => {
                require([ livesql.parserDirectory + "/main.js"], function (main) {
                    resolve(main.getParsingErrors);
                });
            }));

            const checkForErrors = apex.util.debounce(_ => {
                getParsingErrors(model.getValue()).then(errors => {
                    _renderInlineError(model, errors);
                });
            }, 500);

            model.onDidChangeContent(checkForErrors);

            if( /(Mac|iPhone|iPod|iPad)/i.test(navigator.platform) ){
                // special control key on Mac
                // this won't override Insert Line Below as they are mapped to different keys
                editor.addCommand(monaco.KeyMod.WinCtrl | monaco.KeyCode.Enter, apex.livesql.run);
            } else {
                // regular control key for all other OSes
                // this will override Insert Line Below, which is ok
                editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, apex.livesql.run);
            }

        })();
    }
};

/**
 * Code Editor theme logic
 * In order for the "automatic" theme to work, we must imeplement some things widget.codeEditor.js expects
 * theme "automatic" is used on the Worksheet page, and by the 2 editors in QuickSQL
 */
apex.builder = {
    isBuilderDarkMode: () => {
        return $("body").hasClass("is-darkmode");
    }
};

$("body").on("theme-change", () => {
    $("body").trigger("apex-builder-theme-changed");
});

/**
 * Accessibility Enhancements, run on page load
 */

// when expanding the nav menu via button click or kayboard, focus the first item in the menu
$("#t_TreeNav").on("theme42layoutchanged", function (event, obj) {
    if (obj.action === "expand" && $("#t_Button_navControl").is(":focus")) {
        setTimeout(() => {
            $("#t_TreeNav").treeView("setSelection", $("#t_TreeNav .a-TreeView-node").first(), true);
        }, 100);
    }
});

// within the nav menu, on Escape, collapse and focus the menu button
$("#t_TreeNav").on("keyup", function (e) {
    if (e.which == 27) {
        $("#t_Button_navControl").click();
    }
});