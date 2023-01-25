var msftDOM = false;
var domImplementation   = "Msxml2.FreeThreadedDOMDocument.6.0";  

var nodeTypeElement   =  1;
var nodeTypeAttribute =  2;
var nodeTypeText      =  3;
var nodeTypeCData     =  4;
var nodeTypeEntityRef =  5;
var nodeTypeEntity    =  6;
var nodeTypePI        =  7;
var nodeTypeComment   =  8;
var nodeTypeDocument  =  9;
var nodeTypeDTD       = 10;
var nodeTypeDocFrag   = 11;
var nodeTypeNotation  = 12;

function prettyPrintXML(xml, target) {
   
   xmlPP.print(xml, document.getElementById("xmlDocument"));
 
}

function prettyPrintJSON(json) {
   
   jPP.printJson(document.getElementById("jsonDocument"),null,json);
 
}

function renderXML(evt) {
	
	var xmlFile = evt.target.files[0]; 
	var fileReader = new FileReader();
  fileReader.onload = function(e) { 
	                      var xmlContent = e.target.result;
	                      var xmlDocument = null;
	                      if (msftDOM) {
	                      	xmlDocument = new ActiveXObject(domImplementation); 
                          xmlDocument.async = false;
                          xmlDocument.loadXML(xmlContent);
	                      }
	                      else {
									        var parser = new DOMParser();
        									xmlDocument = parser.parseFromString(xmlContent,"text/xml");
	                      }
  	                    prettyPrintXML(xmlDocument);
                      }
  fileReader.readAsText(xmlFile);
}

function renderJSON(evt) {
	
	var jsonFile = evt.target.files[0]; 
	var fileReader = new FileReader();
  fileReader.onload = function(e) { 
	                      var jsonObject = JSON.parse(e.target.result);
  	                    prettyPrintJSON(jsonObject);
                      }
  fileReader.readAsText(jsonFile);
}

function init() {
	
	// Determine if we are using MSFT DOM..
	
	try {
		var processor = new XSLTProcessor();
		msftDOM = false
  }
  catch (e) {
  	msftDOM = true;
  }
	
	document.getElementById('xmlFile').addEventListener('change', renderXML, false);
	document.getElementById('jsonFile').addEventListener('change', renderJSON, false);

}