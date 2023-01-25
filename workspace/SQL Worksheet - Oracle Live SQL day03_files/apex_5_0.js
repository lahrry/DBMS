/*!
 Copyright (c) 2003, 2021, Oracle and/or its affiliates. All rights reserved.
*/
/*jshint browser: true, eqeqeq: false, indent: false */
/*
Oracle Database APEX, Release 5.0
B32468-02
The Programs (which include both the software and documentation) contain proprietary information; they are provided under a license agreement containing restrictions on use and disclosure and are also protected by copyright, patent, and other intellectual and industrial property laws. Reverse engineering, disassembly, or decompilation of the Programs, except to the extent required to obtain interoperability with other independently created software or as specified by law, is prohibited.
The information contained in this document is subject to change without notice. If you find any problems in the documentation, please report them to us in writing. This document is not warranted to be error-free. Except as may be expressly permitted in your license agreement for these Programs, no part of these Programs may be reproduced or transmitted in any form or by any means, electronic or mechanical, for any purpose.
If the Programs are delivered to the United States Government or anyone licensing or using the Programs on behalf of the United States Government, the following notice is applicable:
U.S. GOVERNMENT RIGHTS Programs, software, databases, and related documentation and technical data delivered to U.S. Government customers are "commercial computer software" or "commercial technical data" pursuant to the applicable Federal Acquisition Regulation and agency-specific supplemental regulations. As such, use, duplication, disclosure, modification, and adaptation of the Programs, including documentation and technical data, shall be subject to the licensing restrictions set forth in the applicable Oracle license agreement, and, to the extent applicable, the additional rights set forth in FAR 52.227-19, Commercial Computer Software--Restricted Rights (June 1987). Oracle USA, Inc., 500 Oracle Parkway, Redwood City, CA 94065.
The Programs are not intended for use in any nuclear, aviation, mass transit, medical, or other inherently dangerous applications. It shall be the licensee's responsibility to take all appropriate fail-safe, backup, redundancy and other measures to ensure the safe use of such applications if the Programs are used for such purposes, and we disclaim liability for any damages caused by such use of the Programs.
Oracle, JD Edwards, PeopleSoft, and Siebel are registered trademarks of Oracle Corporation and/or its affiliates. Other names may be trademarks of their respective owners.
The Programs may provide links to Web sites and access to content, products, and services from third parties. Oracle is not responsible for the availability of, or any content provided on, third-party Web sites. You bear all risks associated with the use of such content. If you choose to purchase any products or services from a third party, the relationship is directly between you and the third party. Oracle is not responsible for: (a) the quality of third-party products or services; or (b) fulfilling any of the terms of the agreement with the third party, including delivery of products or services and warranty obligations related to purchased products or services. Oracle is not responsible for any loss or damage of any sort that you may incur from dealing with any third party.
*/

/**
 * Hides child nodes of a DOM node (pThis) where the child node's content matches any instance of regexp (pString). To narrow the child nodes searched by specifying a tag name (pTag) or a class name (pClass). Note that the child node will be set to a block level element when set to visible.
 * @ignore
 * @param {Element | String} pThis
 * @param {String} pString
 * @param {String} pTags
 * @param {String} pClass
 */
// doesn't work as documented/intended should move to legacy file but still used by widget.interactiveReport
function $d_Find(pThis,pString,pTags,pClass){
    if(!pTags){pTags = 'DIV';}
    pThis = $x(pThis);
    if(pThis){
        var d=pThis.getElementsByTagName(pTags);
        pThis.style.display="none";
        if(!gRegex){gRegex =new RegExp("test");}
        gRegex.compile(pString,"i");
        for (var i=0,len=d.length; i<len; i++) {
            if (gRegex.test(d[i].innerHTML)) {
                d[i].style.display="block";
            }
            else{d[i].style.display="none";}
        }
        pThis.style.display="block";
    }
}

/**
 * Given a DOM node, string ID or array of DOM nodes, will call the relevant item based function,
 * as defined by the value for pMode
 * @ignore
 * @param {Element | string | Element[]} pNd
 * @param {string} pMode (Possible values 'hide', 'show',..)
 * @return {Element | Array}
 */
function doMultiple(pNd, pMode) {
    pNd = $u_Carray(pNd);
    for (var i=0; i<pNd.length; i++) {
        var node = $x(pNd[i]);
        apex.item(node)[pMode]();
    }
    return $u_Narray(pNd);
} // end doMultiple

/*
  str should be in the form of a valid f?p= syntax
*/

/*
 * Simple XML Control
 */
function $xml_Control(pThis){
    var tmp;
        this.xsl_string = '<?xml version="1.0"?><xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"><xsl:output method="html"/><xsl:param name="xpath" /><xsl:template match="/"><xsl:copy-of select="//*[@id=$xpath]"/></xsl:template></xsl:stylesheet>';
        if(document.all){
            this.xsl_object = new ActiveXObject("Msxml2.FreeThreadedDOMDocument.3.0");
            this.xsl_object.async=false;
            this.xsl_object.loadXML(this.xsl_string);
            tmp = new ActiveXObject("Msxml2.XSLTemplate.3.0");
            tmp.stylesheet = this.xsl_object;
            this.xsl_processor = tmp.createProcessor();
        }else{
          this.xsl_object = (new DOMParser()).parseFromString(this.xsl_string, "text/xml");
            this.xsl_processor = (new XSLTProcessor());
            this.xsl_processor.importStylesheet(this.xsl_object);
            this.ownerDocument = document.implementation.createDocument("", "test", null);
        }
        this.xml = pThis;
        this.CloneAndPlace = _CloneAndPlace;

        function _CloneAndPlace(pThis,pThat,pText){
           var lThat = $x(pThat);
             if(document.all){
                this.xsl_processor.addParameter("xpath", pThis);
                this.xsl_processor.input = this.xml;
                this.xsl_processor.transform;
                var newFragment = this.xsl_processor.output;
             }else{
                this.xsl_processor.setParameter(null, "xpath", pThis);
                var newFragment = this.xsl_processor.transformToFragment(this.xml,this.ownerDocument);
             }
             if(lThat){
                if(ie){
                 $s(lThat,newFragment);
                }else{
                 $s(lThat,'');
                lThat.appendChild(newFragment);
                }
             /*
             in IE newFragment will be a string
             in FF newFragment will be a dome Node (more useful)
             */
             return newFragment;
             }
        }
}

/**
 * <p>Split a string pString into an array of strings the size of pLength.</p>
 * <p>Use the similar and more efficient {@link apex.server.chunk} function.</p>
 * @ignore
 * @param {String} pString
 * @param {Number} pLength
 * @return Array
 */
// doesn't work as documented/intended
function $s_Split(pString,pLength){
    var lArray = [];
    if (pString.length<=pLength) {
        lArray[lArray.length]=pString;
    } else {
        while (pString.length>4000) {
            lArray[lArray.length]=pString.substr(0,4000);
            pString = pString.substr(4000,pString.length-4000);
        }
        lArray[lArray.length]=pString.substr(0,4000);
    }
    return lArray;
}

/* End Post and Retrieve Large Strings */

/*namespaced javascript*/

var gDebug = true; // todo remove this global
var gkeyPressTime; // todo remove this global
var gLastTab=false;
var gRegex=false;
// todo remove this old ie check which is probably for browsers we no longer support
var ie=(document.all)?true:false;
if(ie){document.expando=true;}
var gDebugWindow = false;  // todo remove this global

/**
 * Given a DOM node or string ID (pNd), this function returns a DOM node if the element is on the page, or returns false if it is not.
 * @param {Element | string} pNd
 * @return {Element | false}
 */
function $x(pNd){return apex.item(pNd).node;}

/**
 * Given a DOM node or string ID (pNd), this function returns the value of an APEX item in the same format as it would be posted.
 * See {@link item#getValue} for more details.
 * @param {Element | string} pNd
 */
function $v(pNd){
  var lValue = apex.item(pNd).getValue();
  if (apex.jQuery.isArray(lValue)) {
    return lValue.join(':');
  } else {
    return lValue;
  }
}

/**
 * Given a DOM node or string ID (pNd), this function returns the value of an APEX item as a string or an array if the item type
 * can contain multiple values. For example checkbox or multi select list.
 * See {@link item#getValue} for more details.
 * @param {Element | string} pNd
 */
function $v2(pNd){
  return apex.item(pNd).getValue();
}

/**
 * Given a DOM node or string ID (pNd), this function sets the APEX item value taking into account the item type.
 * This is a shortcut for {@link item#setValue}. See setValue documentation for details.
 *
 * @param {Element | string} pNd The DOM node or string id of the item to set the value on.
 * @param {string|string[]} pValue The value to set. For items that support multiple values (for example a
 * 'Shuttle'), an array of string values can be passed to set multiple values at once.
 * @param {string} [pDisplayValue] The display value only if different from pValue and can't be determined by the item itself.
 *   For example for the item type Popup LOV, with the attribute Input Field =
 *   'Not Enterable, Show Display Value and Store Return Value', this value sets the Input Field display value.
 *   The value of pValue is used to set the item's hidden return field.
 * @param {boolean=} pSuppressChangeEvent Pass true to prevent the change event from being triggered
 *   for the item being set. The default is false.
 */
function $s(pNd,pValue,pDisplayValue,pSuppressChangeEvent){
    return apex.item(pNd).setValue(pValue, pDisplayValue, pSuppressChangeEvent);
}

/**
 * Given a DOM node or string ID or an array (pNd), this function returns an array. Used for creating DOM based
 * functionality that can accept a single or multiple DOM nodes.
 * @param {Element | string | Array} pNd
 * @return {Array}
 */
function $u_Carray(pNd){
    return ($x(pNd))?[pNd]:pNd;
}

/**
 * Given a DOM node or string ID or an array (pNd), this function returns a single value, if an pNd is an array but
 * only has one element the value of that element is returned otherwise the array is returned. Used for creating
 * DOM based functionality that can accept a single or multiple DOM nodes.
 * @param {Element | string | Array} pNd
 * @return {Array} Array or first value
 */
function $u_Narray(pNd){
    return (pNd.length == 1)?pNd[0]:pNd;
}

/**
 * If pTest is empty or false return pDefault otherwise return pTest.
 * @param {*} pTest
 * @param {*} pDefault
 * @return {*}
 */
// xxx todo this does not work as documented and should be fixed
// first empty (as in empty string) is != null
// 2nd I don't think pTest being false should be considered
// 3rd I see no reason to default pDefault to ""
// I think it should be
//   return (pTest != null && pTest !== "")
function $nvl(pTest,pDefault){
    return (pTest!=null)?pTest:((!!pDefault)?pDefault:'');
}


/**
 * Check to see if this a compound object and if so return it's fieldset instead this helps get and items whole html structure instead of just the form element itself
 * @ignore
 * @param {Element | string} pNd
 */

function $x_Check_For_Compound(pNd){
    var lNode = $x(pNd);
    if(lNode && $x(lNode.id + '_fieldset')){
     return $x(lNode.id + '_fieldset');
    }else{
     return lNode;
    }
}

/**
 * Sets a specific style property (pStyle) to given value (pString) of a DOM node or DOM node Array (pNd).
 * @param {Element | string | Element[]} pNd
 * @param {String} pStyle
 * @param {String} pString
 * @return {Element | Element[]}
 */
function $x_Style(pNd,pStyle,pString){
    pNd = $u_Carray(pNd);
    for(var i=0;i<pNd.length;i++){
        var node = $x(pNd[i]);
        (!!node)?node.style[pStyle]=pString:null;
    }
    return $u_Narray(pNd);
}


/**
* Hides a DOM node or array of DOM nodes (pNd). This also takes into consideration which type of APEX item is being hidden.
* @param {Element | string | Element[]} pNd
* @return {Element | Array}
*/
function $x_Hide(pNd){
    return doMultiple(pNd, 'hide');
}

/**
 * Shows a DOM node or array of DOM nodes (pNd). This also takes into consideration which type of APEX item is being shown.
 * @param {Element | string | Element[]} pNd
 * @return {Element | Array}
 */
function $x_Show(pNd){
    return doMultiple(pNd, 'show');
}

/**
 * Shows a DOM node or array of DOM nodes (pShow) and hides a DOM node or array of DOM nodes (pHide)
 * @ignore
 * @param {Element | string | Element[]} pShow
 * @param {Element | string | Element[]} pHide
 */
function $x_Show_Hide(pShow,pHide){
    $x_Hide(pHide);
    $x_Show(pShow);
}

/**
 * Toggles (shows or hides) a DOM node or array of DOM nodes (pNd).
 * @param {Element | string | Element[]} pNd
 * @return {Element | Array}
 */
function $x_Toggle(pNd){
    var id, node, testNode;
    pNd = $u_Carray(pNd);
    for (var i=0; i<pNd.length; i++) {
        node = $x(pNd[i]);
        if (typeof pNd[i] === 'string') {
            id = pNd[i];
        } else if (pNd[i].id) {
            id = pNd[i].id;
        }
        if (id) {
            // This code must stay in sync with the code in item.show and item.hide
            // for it is imperitive that toggle checks the visibility on the node
            // that is actually hidden.
            testNode = apex.jQuery( '#' + id + '_CONTAINER').get(0);
            if (!testNode) {
                testNode = apex.jQuery( '#' + id + '_DISPLAY').get(0);
            }
        }
        if (!testNode) {
            testNode = node;
        }
        if (node) {
            if (apex.jQuery(testNode).filter(':visible').length === 0) {
                $x_Show(node);
            } else {
                $x_Hide(node);
            }
        }
    }
    return $u_Narray(pNd);
}

/**
 * Removes a DOM node or array of DOM nodes.
 * @param {Element | string | Element[]} pNd
 * @return {Element | Array}
 */
function $x_Remove(pNd){
    pNd = $u_Carray(pNd);
    for(var i=0,len=pNd.length;i<len;i++){
        var node = $x(pNd[i]);
        var lParent = node.parentNode;
        if (node && lParent){
            lParent.removeChild(node);
            lParent.normalize();
        }
    }
    return $u_Narray(pNd);
}

/**
 * Sets the value (pValue) of a DOM node or array of DOM nodes (pNd).
 * @param {Element | string | Element[]} pNd
 * @param { String } pValue
 */
function $x_Value(pNd,pValue){
    pNd = $u_Carray(pNd);
    for(var j=0,len=pNd.length;j<len;j++){
        var lTemp = apex.item(pNd[j]);
        lTemp.setValue(pValue);
    }
}

/**
 * Starting from a DOM node (pNd), this function cascades up the DOM tree until the tag of node name (pToTag) is found.
 * If the optional pToClass is present, the ancestor node must have a node name that equals pToTag and the class must equal pToClass.
 * @param {Element | string} pNd
 * @param {String} pToTag
 * @param {String} [pToClass]
 * @return {Element | false} The matching DOM node found and false otherwise.
 */
function $x_UpTill(pNd, pToTag, pToClass) {
  var node = $x(pNd);
  if (node) {
    var tPar = node.parentNode;
    if(pToClass) {
        while (tPar && !(tPar.nodeName == pToTag && apex.jQuery(tPar).hasClass(pToClass))) {
            tPar = tPar.parentNode;
        }
    } else {
        while (tPar && tPar.nodeName != pToTag) {
            tPar = tPar.parentNode;
        }
    }
    return tPar || false;
  }else{
    return false;
  }
}

/**
 * Given DOM node or array of DOM nodes, this function (shows, hides, or toggles) the entire row that contains
 * the DOM node or array of DOM nodes. This is most useful when using Page Items. This function only works in
 * table layouts since it explicitly looks for a containing tr element.
 * @param {Element | string | Element[]} pNd
 * @param {String} pFunc One of 'TOGGLE', 'SHOW', 'HIDE'
 */
function $x_ItemRow(pNd,pFunc) {
    var node, lTr;
    pNd = $u_Carray(pNd);
    for (var i=0;i<pNd.length;i++) {
        node = $x_Check_For_Compound(pNd[i]);
        lTr = $x_UpTill(node,'TR');
        if (lTr) {
            switch(pFunc) {
                case 'TOGGLE':$x_Toggle(lTr);break;
                case 'SHOW':$x_Show(lTr);break;
                case 'HIDE':$x_Hide(lTr);break;
                default:break;
            }
        }
    }
}

/**
 * Given a page item name, this function hides the entire row that holds the item.
 * In most cases, this is the item and its label. This function only works in table
 * layouts since it explicitly looks for a containing tr element.
 * @param {Element | string | Element[]} pNd
 */
function $x_HideItemRow(pNd){
    $x_ItemRow(pNd,'HIDE');
}

/**
 * Given a page item name, this function shows the entire row that holds the item.
 * In most cases, this is the item and its label. This function only works in table
 * layouts since it explicitly looks for a containing tr element.
 * @param {Element | string | Element[]} pNd
 */
function $x_ShowItemRow(pNd){
    $x_ItemRow(pNd,'SHOW');
}

/**
 * Given a page item name (pNd), this function toggles (shows or hides) the entire row that holds the item.
 * In most cases, this is the item and its label. This function only works in table
 * layouts since it explicitly looks for a containing tr element.
 * @param {Element | string | Element[]} pNd
 */
function $x_ToggleItemRow(pNd){
    $x_ItemRow(pNd,'TOGGLE');
}

/**
 * Hides all DOM nodes referenced in pNdArray and then shows the DOM node referenced by pNd. This is most useful when pNd is also a node in pNdArray.
 * @param {Element | string | Element[]} pNd
 * @param {Element | String | Array} pNdArray
 * @return {Element | Element[]}
 */
function $x_HideAllExcept(pNd,pNdArray){
    var l_Node = $x(pNd);
    if(l_Node){
        $x_Hide(pNdArray);
        $x_Show(l_Node);
    }
    return l_Node;
}

/**
 * Hides all sibling nodes of given DOM node (pNd).
 * @param {Element | string} pNd
 * @return {Element[]}
 */
function $x_HideSiblings(pNd){
    var lNode = apex.jQuery($x(pNd));
    return lNode.show().siblings().hide().get();
}

/**
 * Shows all sibling DOM nodes of given DOM nodes (pNd).
 * @param {Element | string} pNd
 * @return {Element[]}
 */
function $x_ShowSiblings(pNd){
    var lNode = apex.jQuery($x(pNd));
    return lNode.show().siblings().show().get();
}

/**
 * Sets the className of a DOM node or array of DOM nodes to class (pClass).
 * @param {Element | string | Element[]} pNd
 * @param {String} pClass The class name to set. Any other class names will be overwritten.
 * @return {Element | Element[]}
 */
function $x_Class(pNd,pClass){
    if($x(pNd)){pNd = [pNd];}
    var l=pNd.length;
    for(var i=0;i<l;i++){if($x(pNd[i])){$x(pNd[i]).className=pClass;}}
    return $u_Narray(pNd);
}

/**
 * Sets the class (pClass) of all DOM node siblings of a node (pNd). If pNdClass is not null the class of pNd is set to pNdClass.
 * @param {Element | string} pNd
 * @param {String} pClass
 * @param {String} [pNdClass]
 * @return {Element[]}
 */
function $x_SetSiblingsClass(pNd,pClass,pNdClass){
    var l_Node = apex.jQuery($x(pNd));
    l_Node.siblings().removeClass('').addClass(pClass);
    if(pNdClass){l_Node.removeClass('').addClass(pNdClass);}
    return l_Node.get();
}

/**
 * Returns an array of DOM nodes by a given class name (pClass). If the pNd parameter is provided, then the returned elements will be all be children of that DOM node. Including the pTag parameter further narrows the list to just return nodes of that tag type.
 * @param {String} pClass
 * @param {Element | string} [pNd]
 * @param {String} [pTag]
 * @return { Array }
 */
function $x_ByClass(pClass,pNd,pTag){
    var lClass = (pTag)?pTag+'.'+pClass:'.'+pClass;
    return apex.jQuery(lClass,$x(pNd)).get();
    /*
    if (!pTag){pTag = '*';}
    var els = pNd.getElementsByTagName(pTag);
    var elsLen = els.length;
    var pattern = new RegExp("(^|\\s)"+pClass+"(\\s|$)");
    for (var i=0,j=0;i<elsLen;i++){
        if (pattern.test(els[i].className)){
            classElements[j] = els[i];
            j++;
        }
    }
    return classElements;
    */
}

/**
 * Show all the DOM node children of a DOM node (pNd) that have a specific class (pClass) and tag (pTag).
 * @param {Element | string} pNd
 * @param {String} pClass
 * @param {String} [pTag]
 */
function $x_ShowAllByClass(pNd,pClass,pTag) {
    var lClass = (pTag)?pTag+'.'+pClass:'.'+pClass;
    apex.jQuery(lClass,$x(pNd)).show();
}


/**
 * Show all all DOM node children of a DOM node (pNd).
 * @param {Element | string} pNd
 */
function $x_ShowChildren(pNd) {
    apex.jQuery($x(pNd)).children().show();
}

/**
 * Hide all all DOM node children of a DOM node (pNd).
 * @param {Element | string} pNd
 */
function $x_HideChildren(pNd) {
    apex.jQuery($x(pNd)).children().hide();
}

/**
 * Disables or enables an item or array of items based on (pTest).
 * @param {Element | string | Element[]} pNd
 * @param {boolean} pTest
 */
function $x_disableItem(pNd,pTest){
    var lMode = (pTest) ? 'disable' : 'enable';
    return doMultiple(pNd, lMode);
}

/**
 * Checks an item or an array of items to see if any are empty, set the class of all items that are empty to pClassFail, set the the class of all items that are not empty to pClass.
 * @param {Element | string | Element[]} pNd
 * @param {String} [pClassFail]
 * @param {String} [pClass]
 * @return {false | Array} Array of all items that are empty
 */
function $f_get_emptys(pNd,pClassFail,pClass){
    var l_temp = [],l_temp2 = [];
    if($x(pNd)){pNd = [pNd];}
    for(var i=0,len=pNd.length;i<len;i++){
        var node = $x(pNd[i]);
        if(node){
            if( apex.item(node).isEmpty() ){l_temp[l_temp.length] = node;}
            else{l_temp2[l_temp2.length] = node;}
        }
    }
    if(pClassFail){$x_Class(l_temp,pClassFail);}
    if(pClass){$x_Class(l_temp2,pClass);}
    if(l_temp.length===0){l_temp=false;}else{l_temp[0].focus();}
    return l_temp;
}


/**
 * Returns an item value as an array. Useful for multiselects and checkboxs.
 * @param {Element | string} pNd
 * @return {Array}
 */
function $v_Array(pNd){
    return apex.jQuery.makeArray(apex.item(pNd).getValue());
}

/**
 * Returns an item value as an array. Useful for radio items and checkboxes.
 * @param {Element | string} pNd
 * @return {Array}
 */
function $f_ReturnChecked(pNd){
    return ($x(pNd))?$v_Array(pNd):false;
}

/**
 * Clears the content of a DOM node or array of DOM nodes and hides them.
 * @param {Element | string | Element[]} pNd The node(s) to clear and hide.
 */
function $d_ClearAndHide(pNd){
     if($x(pNd)){pNd=[pNd];}
     for(var i=0,len=pNd.length;i<len;i++){
         var lNode = $x(pNd[i]);
         if(lNode){$x_Hide(lNode).innerHTML = '';}
     }
}

/**
 * Returns the DOM nodes of the selected options of a select item (pNd).
 * @param {Element | string} pNd
 * @return {Element[]|Element|false} The selected option elements or false if none selected.
 */
function $f_SelectedOptions(pNd){
    var lSelect = $x(pNd);
    var lValue=[];
    if(lSelect.nodeName == 'SELECT'){
        var lOpts = lSelect.options;
        for(var i=0,len=lOpts.length;i<len;i++){if(lOpts[i].selected){lValue[lValue.length] = lOpts[i];}}
        return $u_Narray(lValue);
    }
    return false;
}

/**
 * Returns the values of the selected options of a select item (pNd).
 * @param {Element | string} pNd
 * @return {Array | String}
 */
function $f_SelectValue(pNd){
     var lValue=$v_Array(pNd);
     return $u_Narray(lValue);
}

/**
 * Checks an page item’s (pThis) value against a set of values (pValue). This function returns true if any value matches.
 * @param {Element | string} pThis
 * @param {Number | String | Array} pValue
 * @return {boolean}
 */
function $v_CheckValueAgainst(pThis,pValue){
    var lTest = false,lArray = [],lValue;
    if(pValue.constructor == Array){lArray = pValue;}
    else{lArray[0] = pValue;}
    lValue = $v(pThis);
    for(var i=0,len=lArray.length;i<len;i++){
        lTest = lValue == lArray[i];
        if(lTest){break;}
    }
    return lTest;
}

/**
 * Checks page item’s (pThis) value against a value (pValue). If it matches, a DOM node (pThat) is set to hidden. If it does not match, then the DOM node (pThat) is set to visible.
 * @param {Element | string} pThis
 * @param {Element | string | Element[]} pThat
 * @param {Number | String | Array} pValue
 * @return {boolean}
 */
function $f_Hide_On_Value_Item(pThis,pThat,pValue){
    var lTest = $v_CheckValueAgainst(pThis,pValue);
    if(lTest){$x_Hide(pThat);}else{$x_Show(pThat);}
    return lTest;
}

/**
 * Checks an page item’s (pThis) value against a value (pValue). If it matches, a DOM node (pThat) is set to visible. If it does not match, then the DOM node (pThat) is set to hidden.
 * @param {Element | string} pThis
 * @param {Element | string | Element[]} pThat
 * @param {Number | String | Array} pValue
 * @return {boolean}
 */
function $f_Show_On_Value_Item(pThis,pThat,pValue){
    var lTest = $v_CheckValueAgainst(pThis,pValue);
    if(lTest){$x_Show(pThat);}else{$x_Hide(pThat);}
    return lTest;
}

/**
 * Checks the value (pValue) of an item (pThis). If it matches, this function hides the table row that holds (pThat). If it does not match, then the table row is shown.
 * @param {Element | string} pThis
 * @param {Element | string | Element[]} pThat
 * @param {Number | String | Array} pValue
 * @return {boolean}
 */
function $f_Hide_On_Value_Item_Row(pThis,pThat,pValue){
    var lTest = $v_CheckValueAgainst(pThis,pValue);
    if(lTest){$x_HideItemRow(pThat);}else{$x_ShowItemRow(pThat);}
    return lTest;
}

/**
 * Checks the value (pValue) of an item (pThis). If it matches, the function shows the table row that holds pThat. If it does not match then the table row is hidden.
 * @param {Element | string} pThis
 * @param {Element | string | Element[]} pThat
 * @param {Number | String | Array} pValue
 * @return {boolean}
 */
function $f_Show_On_Value_Item_Row(pThis,pThat,pValue){
    var lTest = $v_CheckValueAgainst(pThis,pValue);
    if(lTest){$x_ShowItemRow(pThat);}else{$x_HideItemRow(pThat);}
    return lTest;
}

/**
 * Checks the value (pValue) of an item (pThis). If it matches, this function disables the item or array of items (pThat). If it does not match, then the item is enabled.
 * @param {Element | string} pThis
 * @param {String} pValue
 * @param {Element | string | Element[]} pThat
 * @return {boolean}
 */
function $f_DisableOnValue(pThis,pValue,pThat){
    var lTest = $v_CheckValueAgainst(pThis,pValue);
    var lNd = [];
    if(pThat){
        if(pThat instanceof Array){
            lNd = pThat;
        }else{
            for (var i=2;i<arguments.length;i++){if(arguments[i]){lNd[lNd.length]=arguments[i];}}
        }
        $x_disableItem(lNd,lTest);
    }
    return lTest;
}

/**
 * Sets the className of an array of nodes that are selected by (pNd), (pClass) and (pTag) to class (pClass2).
 * See {@link $x_ByClass} and {@link $x_Class}.
 * @param {Element | string} pNd
 * @param {String} pClass
 * @param {String} [pTag]
 * @param {String} [pClass2]
 * @return {Element | Element[]}
 */
function $x_ClassByClass(pNd,pClass,pTag,pClass2){
    var l_Els = $x_ByClass(pClass,pNd,pTag);
    $x_Class(l_Els,pClass2);
    return l_Els;
}


/**
 * Collects the values of form items contained within DOM node (pThis) of class attribute (pClass) and nodeName (pTag) and returns an array.
 * @param {Element | string} pThis
 * @param {String} pClass
 * @param {String} pTag
 * @return {String[]} The collected values.
 */
function $f_ValuesToArray(pThis,pClass,pTag){
    var lTemp = $x_ByClass(pClass,pThis,pTag);
    var lArray = [];
    for(var i=0,len=lTemp.length;i<len;i++){lArray[i] = lTemp[i].value;}
    return lArray;
}

/**
 * @ignore
 * @param {Element | String | Array} pNd
 */
function $dom_JoinNodeLists(pThis,pThat){
    var lArray = [],i,len;
    for(i=0,len=pThis.length;i<len;i++){lArray[i] = pThis[i];}
    for(i=0,len=pThat.length;i<len;i++){lArray[lArray.length] = pThat[i];}
    return lArray;
}

/**
 * Returns all form input items contained in a DOM node (pNd) of the given type (pType).
 * @param {Element | string} pNd
 * @param {String} pType
 * @return {Element[]}
 */
function $x_FormItems(pNd,pType){
    var l_Selects, l_Textarea, l_Fieldset;
    var lType = (pType)?pType.toUpperCase():'ALL';
    var l_Inputs = [],l_Array = [];
    var l_This = $x(pNd);
    if(l_This){
        if(l_This.nodeName=='SELECT'||l_This.nodeName=='INPUT'||l_This.nodeName=='TEXTAREA'){
            return [l_This];
        }
        l_Selects = l_This.getElementsByTagName('SELECT');
        l_Inputs = l_This.getElementsByTagName('INPUT');
        l_Textarea = l_This.getElementsByTagName('TEXTAREA');
        l_Fieldset = l_This.getElementsByTagName('FIELDSET');
        if(lType == 'SELECT'){
            l_Inputs = l_Selects;
        }else if(lType == 'TEXTAREA'){
            l_Inputs = l_Textarea;
        }else if (lType == 'ALL'){
            l_Inputs = $dom_JoinNodeLists(l_Inputs,l_Fieldset);
            l_Inputs = $dom_JoinNodeLists(l_Inputs,l_Selects);
            l_Inputs = $dom_JoinNodeLists(l_Inputs,l_Textarea);
        }else{}
        if(lType == 'SELECT'||lType == 'TEXTAREA'||lType == 'ALL'){
            l_Array = l_Inputs;
        }else{
            for (var i=0;i<l_Inputs.length;i++){
                if(l_Inputs[i].type.toUpperCase()==pType.toUpperCase()){l_Array[l_Array.length] = l_Inputs[i];}
            }
        }
        return l_Array;
    }
}

/**
 * Check or uncheck (pCheck) all check boxes contained within a DOM node (pThis). If an array of checkboxes DOM nodes (pArray) is provided, use that array for affected check boxes.
 * @param {Element | string} pThis The DOM node or string id of the DOM node that contains the checkboxes.
 * @param {boolean} pCheck true to check and false to uncheck.
 * @param {Element[]} pArray Checkbox elements.
 */
function $f_CheckAll(pThis,pCheck,pArray){
    var l_Inputs;
    if(pArray){l_Inputs = pArray;}
    else{l_Inputs = $x_FormItems(pThis,'CHECKBOX');}
    for (var i=0,l=l_Inputs.length;i<l;i++){l_Inputs[i].checked = pCheck;}
}

/**
 * This function sets all checkboxes located in the first column of a table based on the checked state of the calling checkbox (pNd), useful for tabular forms.
 * @param {Element | String} pNd
 * @return {Element[]}
 */
function $f_CheckFirstColumn(pNd){
    var lTable = $x_UpTill(pNd,"TABLE");
    var lArray = [];
    for(var i=0,len=lTable.rows.length;i<len;i++){
      var l_Temp = $x_FormItems(lTable.rows[i],'CHECKBOX')[0];
      if(l_Temp){lArray[lArray.length]=l_Temp;}
    }
    $f_CheckAll(false,pNd.checked,lArray);
    return lArray;
}


/** @ignore */
var gToggleWithImageA = 'pseudoButtonActive';

/** @ignore */
var gToggleWithImageI = 'pseudoButtonInactive';

/**
 * Given an image element (pThis) and a DOM node (pNd), this function toggles the display of the DOM node (pNd).
 * The src attribute of the image element (pThis) is rewritten. The image src has any plus substrings replaced
 * with minus substrings or minus substrings are replaced with plus substrings.
 * @param {Element | string} pThis
 * @param {Element | string | Element[]} pNd
 * @return {Element}
 */
function $x_ToggleWithImage(pThis,pNd){
    pThis = $x(pThis);
    if($x_CheckImageSrc(pThis,'plus')){
        $x_Class(pThis,gToggleWithImageI);
        pThis.src = html_StringReplace(pThis.src,'plus','minus');
    }else{
        $x_Class(pThis,gToggleWithImageA);
        pThis.src = html_StringReplace(pThis.src,'minus','plus');
    }
    var node = $x_Toggle(pNd);
    return node;
}

/**
 * Checks an image (pId) src attribute for a substring (pSearch). If a substring is found, this function replaces the image entire src attribute with (pReplace).
 * @param {Element | string} pNd
 * @param {String} pSearch
 * @param {String} pReplace
 * @return {Element | false}
 */
function $x_SwitchImageSrc(pNd,pSearch,pReplace){
  var lEl = $x(pNd);
  if(lEl && lEl.nodeName=="IMG"){if(lEl.src.indexOf(pSearch)!=-1){lEl.src=pReplace;}}
  return lEl;
}

/**
 * Checks an image (pNd) source attribute for a substring (pSearch). The function returns true if a substring (pSearch) is found. It returns false if a substring (pSearch) is not found.
 * @param {Element | string} pNd
 * @param {String} pSearch
 * @return {boolean}
 */
function $x_CheckImageSrc(pNd,pSearch){
    var lEL=$x(pNd) , lReturn=false;
    if(lEL && lEL.nodeName=="IMG"){lReturn = $u_SubString(lEL.src,pSearch);}
    return lReturn;
}

/**
 * <p>Returns a true or false if a string (pText) contains a substring (pMatch).</p>
 * <p>Better to ensure values are strings and use indexOf. Or use a regular expression.</p>
 * @ignore
 * @param {String} pText
 * @param {String} pMatch
 * @return {boolean}
 */
function $u_SubString(pText,pMatch){return (pText.toString().indexOf(pMatch.toString()) != -1);}


/**
 * Use DOM methods to remove all DOM children of DOM node (pND).
 * @param {Element | string} pNd
 */
function html_RemoveAllChildren(pNd) {
    var lEl = $x(pNd);
    if (lEl && lEl.hasChildNodes && lEl.removeChild){while(lEl.hasChildNodes()){lEl.removeChild(lEl.firstChild);}}
}

/**
 * Sets the value (pValue) of a select item (pId). If the value is not found, this functions selects the first option (usually the NULL selection).
 * @param {Element | String} pId
 * @param {String} pValue
 */
function html_SetSelectValue(pId,pValue){
    var lSelect = $x(pId);
    if(lSelect.nodeName == 'SELECT'){
        lSelect.selectedIndex = 0;
        for(var i=0,l=lSelect.options.length;i<l;i++){if(lSelect.options[i].value == pValue){lSelect.options[i].selected=true;}}
    }
}

/**
 * Swaps the form values of two form elements (pThis,pThat).
 * @param {Element | String} pThis Element or string id for first form element.
 * @param {Element | String} pThat Element or string id for second form element.
 */
function $f_Swap(pThis,pThat){
    var lThis = $x(pThis),
        lThat = $x(pThat);
    if(pThis && pThat){
        $x_Value(pThis,lThat.value);
        $x_Value(pThat,lThis.value);
    }
}

/**
 * Sets array of form items (pArray) values to sequential number in multiples of (pMultiple).
 * @param {Element[]} pArray
 * @param {String | Number} pMultiple
 */
function $f_SetValueSequence(pArray,pMultiple){
    var lLength = pArray.length;
    for (var i=0;i<lLength;i++){$x_Value(pArray[i],(i+1)*pMultiple);}
}

/**
 * Inserts the html element (pTag) as a child node of a DOM node (pThis) with the innerHTML set to (pText).
 * @param {Element | string} pThis The DOM node to append the new element to.
 * @param {String} [pTag] The new element tag.
 * @param {String} [pText] The new element content.
 * @return {Element} The DOM node inserted.
 */
function $dom_AddTag(pThis,pTag,pText){
    var lThis = document.createElement(pTag);
    var lThat = $x(pThis);
    if(lThat){lThat.appendChild(lThis);}
    if(pText!=null){lThis.innerHTML = pText;}
    return lThis;
}

/**
 * Appends a table cell &lt;td> to a table row (pThis). And sets the content to (pText).
 * @param {Element | string} pThis
 * @param {String} pText
 * @return {Element}
 */
function $tr_AddTD(pThis,pText){
    return $dom_AddTag($x(pThis),'TD',pText);
}

/**
 * Appends a table header cell &lt;th> to a table row (pThis). And sets the content to (pText).
 * @param {Element | string} pThis
 * @param {String} pText
 * @return {Element}
 */
function $tr_AddTH(pThis,pText){return $dom_AddTag($x(pThis),'TH',pText);}

/**
 * Inserts the html form input element (pType) as a child node of a DOM node (pThis) with an id (pId) and name (pName) value set to (pValue).
 * @param {Element | string} pThis
 * @param {String} [pType] The input type. The default is "text".
 * @param {String} [pId] The input element id.
 * @param {String} [pName] The input element name.
 * @param {String} [pValue] The input element value.
 * @return {Element} The element inserted.
 */
function $dom_AddInput(pThis,pType,pId,pName,pValue){
    var lThis = $dom_AddTag(false,'INPUT');
    lThis.type = (pType)?pType:'text';
    lThis.id = (pId)?pId:'';
    lThis.name = (pName)?pName:'';
    lThis.value = (pValue)?pValue:'';
    if(pThis){$x(pThis).appendChild(lThis);}
    return lThis;
}

/**
 * Takes a DOM node (p_Node) and makes it a child of DOM node (p_Parent) and then returns the DOM node (pNode).
 * @param {Element | string} pThis DOM node or string ID
 * @param {Element | string} pParent DOM node or string ID
 * @return {Element}
 */
function $dom_MakeParent(pThis,pParent){
  var l_Node = $x(pThis);
  var l_Parent = $x(pParent);
  if(l_Node && l_Parent && l_Node.parentNode != l_Parent){l_Parent.appendChild(l_Node);}
  return l_Node;
}

/** @ignore */
var gCurrentRow = false;

/**
 * Give an table row DOM node (pThis), this function sets the background of all table cells to a color (pColor). A global variable gCurrentRow is set to the current table row (pThis).
 * @param {Element | String} pThis
 * @param {String} pColor
 */
function $x_RowHighlight(pThis,pColor){
    var lThis = $x(pThis);
    if(lThis){$x_Style(lThis.getElementsByTagName('TD'),'backgroundColor',pColor);}
    gCurrentRow = lThis;
}

/**
 * Give an table row DOM node (pThis), this function clears the background of all table cells.
 * @param {Element | String} pThis
 */
function $x_RowHighlightOff(pThis){
    var lThis = $x(pThis);
    if(lThis){$x_Style(lThis.getElementsByTagName('TD'),'backgroundColor','');}
}


/**
 * Sets the value of a form element (pNd) to uppercase. Note this does not go through the item setValue method so this
 * will not work with all item types or trigger a change event.
 * @param {Element | String} pNd
 */
function $v_Upper(pId){
   var obj = $x(pId);
   if(obj){obj.value = obj.value.toUpperCase();}
}


/**
 * @ignore
 */
function html_StringReplace(string,text,by) {
    if(!by){by = '';}
    var strLength = string.length, txtLength = text.length;
    if ((strLength === 0) || (txtLength === 0)) {return string;}
    var i = string.indexOf(text);
    if ((!i) && (text != string.substring(0,txtLength))) {return string;}
    if (i == -1) {return string;}
    var newstr = string.substring(0,i) + by;
    if (i+txtLength < strLength){newstr += html_StringReplace(string.substring(i+txtLength,strLength),text,by);}
    return newstr;
}

/**
 * @ignore
 */
function setSelectionRange(input, selectionStart, selectionEnd) {
    var lInputLength;
    if (input.setSelectionRange){
        lInputLength = input.value.length;
        // Check if selection start and end are greater than the entire length of the text.
        // If either are, set them to the text length (fixes issue in webkit based browsers).
        if (selectionStart > lInputLength) {
            selectionStart = lInputLength;
        }
        if (selectionEnd > lInputLength) {
            selectionEnd = lInputLength;
        }
        input.focus();
        input.setSelectionRange(selectionStart, selectionEnd);
    }else if(input.createTextRange){
        var range = input.createTextRange();
        range.collapse(true);
        range.moveEnd('character', selectionEnd);
        range.moveStart('character', selectionStart);
        range.select();
    }
}

/**
 * @ignore
 */
function setCaretToPos(input,pos){
  setSelectionRange(input, pos, pos);
}

/**
 * @ignore
 */
function html_ReturnToTextSelection(pText,pThis,pNoSpace){
    var start, end,
        cmd = $x(pThis);
    var lSpace = (apex.item(cmd).isEmpty()||!!pNoSpace)?'':' ';
    if (document.selection){//IE support for inserting HTML into textarea
        cmd.focus();
        var sel = document.selection;
        var rng = sel.createRange();
        rng.text = rng.text + lSpace + pText;
    }else{ // Mozilla/Netscape support for selecting textarea
        start = cmd.selectionStart;
        end = cmd.selectionEnd;
        cmd.value = cmd.value.slice(0,start) + lSpace + pText + cmd.value.slice(end,cmd.value.length);
        cmd.focus();
        setCaretToPos (cmd, end +(pText.length + 2));
    }
}

function $p_DatePicker(p_element_index,p_form_index,p_date_format,p_bgcolor,p_dd,p_hh,p_mi,p_pm,p_yyyy,p_lang,p_application_format,p_application_id,p_security_group_id,p_mm,p_height){
    var w = window.open("wwv_flow_utilities.show_as_popup_calendar" +
            "?p_element_index=" + encodeURIComponent(p_element_index) +
            "&p_form_index=" + encodeURIComponent (p_form_index) +
            "&p_date_format=" + encodeURIComponent (p_date_format) +
            "&p_bgcolor=" + encodeURIComponent (p_bgcolor) +
            "&p_dd=" + encodeURIComponent (p_dd) +
            "&p_hh=" + encodeURIComponent (p_hh) +
            "&p_mi=" + encodeURIComponent (p_mi) +
            "&p_pm=" + encodeURIComponent (p_pm) +
            "&p_yyyy=" + encodeURIComponent (p_yyyy) +
            "&p_lang=" + encodeURIComponent (p_lang) +
            "&p_application_format=" + encodeURIComponent (p_application_format) +
            "&p_application_id=" + encodeURIComponent (p_application_id) +
            "&p_security_group_id=" + encodeURIComponent (p_security_group_id) +
            "&p_mm=" + encodeURIComponent (p_mm),
            "winLov","Scrollbars=no,resizable=yes,width=258,height="+p_height);
    if (w.opener == null){w.opener = self;}
    w.focus();
    return w
}

/**
 * puts an invisible and temporary div in the page to capture html coming in from an ajax call
 * @ignore
 */

function $u_js_temp_drop(){
    var lTemp = apex.jQuery('#apex_js_temp_drop');
    if (lTemp.length > 0) {
        lTemp.empty();
    } else {
        lTemp = apex.jQuery('<div id="apex_js_temp_drop"></div>').prependTo(document.body).hide();
    }
    return lTemp[0]; // return DOM object
/*
    var lThis = $x('apex_js_temp_drop');
    if(!lThis){
        lThis = $dom_AddTag(document.body,'DIV');
        lThis.id = 'apex_js_temp_drop';
        $x_Hide(lThis);
    }
    lThis.innerHTML = '';
    return lThis;
*/
}

function $u_js_temp_clear(){
    var lThis = $x('apex_js_temp_drop');
    if(lThis){lThis.innerHTML = '';}
    return lThis;
}

/* Begin Smart Table Code */

/* inits the Add Row Table */

/**
 * create javascript object to run shuttle item
 * @ignore
 * @constructor
 * @param {Element | String} pThis
 * @param {Element | String} pThat
 */
function dhtml_ShuttleObject(pThis,pThat){
 this.Select1 = $x(pThis);
 this.Select2 = $x(pThat);
 this.Select1ArrayInit = this.Select1.cloneNode(true);
 this.Select2ArrayInit = this.Select2.cloneNode(true);
 this.Op1Init = [];
 this.Op2Init = [];
 this.Op1Init = this.Select1ArrayInit.options;
 this.Op2Init = this.Select2ArrayInit.options;
    /**
     * @extends dhtml_ShuttleObject
     */
    this.move = function (){
        var l_A = $f_SelectedOptions(this.Select1);
        if($x(l_A)){l_A = [l_A];}
        var l_AL = l_A.length;
        for (var i=0;i<l_AL;i++){this.Select2.appendChild(l_A[i]);}
    };
    /**
     * @extends dhtml_ShuttleObject
     */
    this.remove = function (){
        var l_A = $f_SelectedOptions(this.Select2);
        if($x(l_A)){l_A = [l_A];}
        var l_AL = l_A.length;
        for (var i=0;i<l_AL;i++){this.Select1.appendChild(l_A[i]);}
    };
    /**
     * @extends dhtml_ShuttleObject
     */

    this.reset =  function (){
        this.Select1.options.length = 0;
        this.Select2.options.length = 0;
        var L_Count1 = this.Op1Init.length;
        for(var i=0;i<L_Count1;i++){this.Select1.options[i]= new Option(this.Op1Init[i].text,this.Op1Init[i].value);}
        var L_Count2 = this.Op2Init.length;
        for(var i2=0;i2<L_Count2;i2++){this.Select2.options[i2]= new Option(this.Op2Init[i2].text,this.Op2Init[i2].value);}
    };
    /**
     * @extends dhtml_ShuttleObject
     */

    this.move_all = function (){
        for (var i=0,len=this.Select1.options.length;i<len;i++){this.Select1.options[i].selected=true;}
        this.move();
    };
    /**
     * @extends dhtml_ShuttleObject
     */

    this.remove_all =  function (){
        for (var i=0,len=this.Select2.options.length;i<len;i++){this.Select2.options[i].selected=true;}
        this.remove();
    };
    /**
     * @extends dhtml_ShuttleObject
     */

    this.sort = function (pShuttle,pDir){
        var i;
        var lLength = pShuttle.options.length;
        if(pDir == 'U'){
            for (i=0;i<lLength;i++){
                if(!!pShuttle.options[i].selected){if(pDir == 'U'){if(!!i){pShuttle.insertBefore(pShuttle.options[i], pShuttle.options[i-1]);}}}
            }
        }else if(pDir == 'D'){
            for (i=lLength-1;i>=0;i--){
                if(!!pShuttle.options[i].selected){if(pDir == 'D'){if(i!=lLength-1){pShuttle.insertBefore(pShuttle.options[i], pShuttle.options[i+2]);}}}
            }
        }else{
            var l_Opt = [];
            for (i=0;i<lLength;i++){if(!!pShuttle.options[i].selected){l_Opt[l_Opt.length] = pShuttle.options[i];}}
            if(pDir == 'B'){
                for (i=0;i<l_Opt.length;i++){pShuttle.appendChild(l_Opt[i]);}
            }else if(pDir == 'T'){
                for (i=l_Opt.length-1;i>=0;i--){pShuttle.insertBefore(l_Opt[i],pShuttle.firstChild);}
            }
        }
    };
    /**
     * @extends dhtml_ShuttleObject
     */
    this.sort1 = function (pDir){this.sort(this.Select1,pDir);};
    /**
     * @extends dhtml_ShuttleObject
     */
    this.sort2 = function (pDir){this.sort(this.Select2,pDir);};
}
