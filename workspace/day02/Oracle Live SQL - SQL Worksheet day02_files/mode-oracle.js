ace.define('ace/mode/sql_highlight_rules', ['require', 'exports', 'module' , 'ace/lib/oop', 'ace/mode/text_highlight_rules', 'ace/mode/oracle/parser'], function(require, exports, module) {

    var oop = require("../lib/oop");
    var TextHighlightRules = require("ace/mode/text_highlight_rules").TextHighlightRules;
    var ParsingRules = oracle.sql.grammar();

    var kwmap = {};
    for ( var i = 0; i < ParsingRules.length; i++) {
        var rule = ParsingRules[i];
        for ( var j = 0; j < rule.rhs.length; j++) {
            var symbol = rule.rhs[j];
            if( symbol.charAt(0)!='\'' )
                continue;
            symbol = symbol.substring(1,symbol.length-1);
            if( kwmap[symbol] == undefined )
                kwmap[symbol] = true;
        }
    }

    var SqlHighlightRules = function() {

        /*var constants = (
            "select|insert|update|delete|from|where|and|or|group|by|order|limit|offset|having|as|case|" +
            "when|else|end|type|left|right|join|on|outer|desc|asc"
        );*/
        constants = "";
        for( var symbol in kwmap ) {
            if( constants.length == 0 )
                constants = symbol;
            else 
                constants += ("|"+symbol); 
        }           

        var builtinConstants = (
            "true|false|null"
        );

        var builtinFunctions = (
            "count|min|max|avg|sum|rank|now|coalesce"
        );

        var keywordMapper = this.createKeywordMapper({
            //"support.function": builtinFunctions,
            "keyword": constants,
            //"constant.language": builtinConstants
        }, "identifier", true);

        this.$rules = {
            "start" : [ {
                token : "comment",
                regex : "--.*$"
            },  {
                token : "comment",
                start : "/\\*",
                end : "\\*/"
            }, /*{
                token : "string",           // " string
                regex : '".*?"'
            },*/ {
                token : "string",           // ' string
                regex : "'.*?'"
            }, {
                token : "constant.numeric", // float
                regex : "[+-]?\\d+(?:(?:\\.\\d*)?(?:[eE][+-]?\\d+)?)?\\b"
            }, {
                token : keywordMapper,
                regex : "[a-zA-Z_$][a-zA-Z0-9_$]*\\b"
            }, {
                token : "keyword.operator",
                regex : "\\+|\\-|\\/|\\/\\/|%|<@>|@>|<@|&|\\^|~|<|>|<=|=>|==|!=|<>|=|:"
            }, {
                token : "paren.lparen",
                regex : "[\\(]"
            }, {
                token : "paren.rparen",
                regex : "[\\)]"
            }, {
                token : "text",
                regex : "\\s+"
            } ]
        };
        this.normalizeRules();
    };

    oop.inherits(SqlHighlightRules, TextHighlightRules);

    exports.SqlHighlightRules = SqlHighlightRules;
});

ace.define('ace/mode/oracle', ['require', 'exports', 'module' , 'ace/lib/oop',  'ace/mode/sql_highlight_rules', "ace/worker/worker_client"], function(require, exports, module) {
  var oop = require("../lib/oop");
  // defines the parent mode
  var TextMode = require("./text").Mode;
  var Tokenizer = require("../tokenizer").Tokenizer;
  var WorkerClient = require("../worker/worker_client").WorkerClient;
  //var MatchingBraceOutdent = require("./matching_brace_outdent").MatchingBraceOutdent;

  // defines the language specific highlighters and folding rules
  //var MyNewHighlightRules = require("./mynew_highlight_rules").MyNewHighlightRules;
  var SqlHighlightRules = require("ace/mode/sql_highlight_rules").SqlHighlightRules;
  var OracleFoldMode = require("./folding/oracle").FoldMode;

  var Mode = function() {
      // set everything up
      this.HighlightRules = SqlHighlightRules;
      //this.$outdent = new MatchingBraceOutdent();
      this.foldingRules = new OracleFoldMode();
  };
  oop.inherits(Mode, TextMode);

  (function() {
      // configure comment start/end characters
      this.lineCommentStart = "--";
      this.blockComment = {start: "/*", end: "*/"};
      
      // special logic for indent/outdent. 
      // By default ace keeps indentation of previous line
      /*this.getNextLineIndent = function(state, line, tab) {
          var indent = this.$getIndent(line);
          return indent;
      };

      this.checkOutdent = function(state, line, input) {
          return this.$outdent.checkOutdent(line, input);
      };

      this.autoOutdent = function(state, doc, row) {
          this.$outdent.autoOutdent(doc, row);
      };*/
      
      // create worker for live syntax checking
      /*this.createWorker = function(session) {
          var worker = new WorkerClient(["ace"], "ace/mode/mynew_worker", "NewWorker");
          worker.attachToDocument(session.getDocument());
          worker.on("errors", function(e) {
              session.setAnnotations(e.data);
          });
          return worker;
      };*/
      
      this.getCompletions = function(state, session, pos, prefix) {
        var index;
        for( var i = src.length-1; 0 < i ; i-- ) {
          token = src[i];
          if( token.line == pos.row && token.col <= pos.column && pos.column <= token.col + token.value.length ) {
            index = i;
            break;
          }
        }
        
        var ret = [];
        var meta;
        
        if( isExpected(matrix,index,["table_reference"]) ) {
            var tables = dbAppl.getTables(/*"'"+*/prefix);
            //var tables1 = dbAppl.getTables("");
            for( var i = 0; i < tables.length; i++ ) // Java to Js
              ret[i] = tables[i];
            //for( var i = 0; i < tables1.length; i++ ) // Java to Js
              //ret[i] = tables1[i];
            meta = "table";
        } else {
          var tabRefLocations =recognizedWithin(matrix,["table_reference"]); 
            if( 0 < tabRefLocations.length && isExpected(matrix,index,["column"/*,"identifier"*/]) ) {
              for( var i = 0; i < tabRefLocations.length; i++ ) {
                var x = tabRefLocations[i].x;
                var y = tabRefLocations[i].y;
                var qtabRef =recognizedWithin(matrix,["query_table_expression"],x,y);
                var xx = qtabRef[0].x;
                var yy = qtabRef[0].y;
                var pref = "";
                if( yy != y ) // aliased
                  pref = src[y-1].value+".";
                if( xx+1 == yy ) {
                  var cols = dbAppl.getColumns(src[xx].value);
                    for( var j = 0; j < cols.length; j++ ) {
                      var col = pref+cols[j];
                      if( 0==col.toUpperCase().indexOf(prefix.toUpperCase()) )
                        ret.push(col);
                    }
                }
              }
              meta = "column";
          } else {        
            ret = expected(matrix,index,"'"+prefix.toUpperCase());
            meta = "keyword";
          }
        }
          return ret.map(function(word) {
            var v = word;
            if( meta == "keyword" )
              v = word.substring(1,word.length-1);
              return {
                  name: word,
                  value: v, 
                  score: 0,
                  meta: meta
              };
          });
      };


      this.createWorker = function(session) {
          var worker = new WorkerClient(["ace"], "ace/mode/oracle_worker", "OracleWorker");
          worker.attachToDocument(session.getDocument());

      worker.on("oraparser", function(results) {
        session.setAnnotations(results.data);
      });

          worker.on("terminate", function() {
              session.clearAnnotations();
          });

          return worker;
      };
  }).call(Mode.prototype);

  exports.Mode = Mode;
});


///////////////////////////////////////////////////////////////////

ace.define('ace/mode/folding/oracle', ['require', 'exports', 'module' , 'ace/lib/oop', 'ace/range', 'ace/mode/folding/fold_mode'], function(require, exports, module) {


  var oop = require("../../lib/oop");
  var Range = require("../../range").Range;
  var BaseFoldMode = require("./fold_mode").FoldMode;

  var FoldMode = exports.FoldMode = function(commentRegex) {
      if (commentRegex) {
          this.foldingStartMarker = new RegExp(
              this.foldingStartMarker.source.replace(/\|[^|]*?$/, "|" + commentRegex.start)
          );
          this.foldingStopMarker = new RegExp(
              this.foldingStopMarker.source.replace(/\|[^|]*?$/, "|" + commentRegex.end)
          );
      }
  };
  oop.inherits(FoldMode, BaseFoldMode);

  (function() {

      this.getFoldWidget = function(session, foldStyle, row) {
        var foldRanges = session.foldRanges;
        if( foldRanges == null )
          return "";
        for( var i = 0; i < foldRanges.length; i++) {
        var range = foldRanges[i];
        if( range.start.row == row )
          return "start";
      }
        return "";
      };
      
      this.getFoldWidgetRange = function(session, foldStyle, row, forceMultiline) {
        var foldRanges = session.foldRanges;
        if( foldRanges == null )
          return;
        for( var i = 0; i < foldRanges.length; i++) {
        var range = foldRanges[i];
        if( range.start.row == row )
          return range;
      }
        return;
      };
      
      /*this.getSectionRange = function(session, row) {
          var line = session.getLine(row);
          var startIndent = line.search(/\S/);
          var startRow = row;
          var startColumn = line.length;
          row = row + 1;
          var endRow = row;
          var maxRow = session.getLength();
          while (++row < maxRow) {
              line = session.getLine(row);
              var indent = line.search(/\S/);
              if (indent === -1)
                  continue;
              if  (startIndent > indent)
                  break;
              var subRange = this.getFoldWidgetRange(session, "all", row);
              
              if (subRange) {
                  if (subRange.start.row <= startRow) {
                      break;
                  } else if (subRange.isMultiLine()) {
                      row = subRange.end.row;
                  } else if (startIndent == indent) {
                      break;
                  }
              }
              endRow = row;
          }
          
          return new Range(startRow, startColumn, endRow, session.getLine(endRow).length);
      };*/

  }).call(FoldMode.prototype);

});