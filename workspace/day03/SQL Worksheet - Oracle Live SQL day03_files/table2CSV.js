function table2CSV($table){
    var output = '';

    var escapeCSV = function( txt ){

        if ( txt.indexOf( '"' ) > -1 ) {
            txt = txt.replace( /"/g,  '""' );
        } 

        if ( txt.indexOf( ',' ) > -1 ) {
            txt = '"' + txt + '"';
        }

        return txt;
    };

    $table.find('tr').each(function(i, e){
        var s = (i == 0) ? 'th' : 'td';

        var placeholder = [];
        $(this).find( s ).each(function(ci, ce){
            var val = escapeCSV( $(this).html() );
            placeholder.push( val );
        });

        output += placeholder.join(',');
        output += '\n';
    });

    return output;
}

function download(filename, text) {
  var element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);

  element.style.display = 'none';
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}

function generateAndDownloadCSV($table){
    var csv = table2CSV( $table );
    var filename = 'table.csv';

    download( filename, csv );
}

function listenLinks(){
    $('.download-table2CSV').on('click', function(){
        console.log($(this).prev());

        // Look above table sibling
        var $table = $(this).prev();

        // Generate & download CSV
        generateAndDownloadCSV( $table );
    });
}

function createLink(){
    var linkLabel = 'Download CSV';
    var $link = $('<a>');

    $link.attr( 'href', '#' );
    $link.addClass( 'download-table2CSV' )
    $link.html( linkLabel );

    return $link[0];
}

function createCSVDownloadLink(selector){
    var $tables = $(selector);

    // Find all tables
    $tables.each(function(i, e){
        // Add link after it with action generate & download CSV
        $link = createLink();

        $(this).after( $link );
    });

    // Listen click event on links
    listenLinks();
}