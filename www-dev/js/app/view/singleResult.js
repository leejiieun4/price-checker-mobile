define(['chui', "app/eventBus", "text!app/view/tmpl/singleResult.tmpl", "text!app/view/tmpl/searching.tmpl"],
    function($, bus, singleResultTmpl, searchingTmpl) {

    singleResultTmpl = $.template(singleResultTmpl);

    function showResult(key, result) {
        $('#results').html(singleResultTmpl(result));
        $.UIGoToArticle('#results');
        $.UINavigationHistory.push('#results');
        analytics.trackEvent('singleResult', 'Show', result.barcode);
    }

    bus.subscribe('barcodeResult', showResult);

    searchingTmpl = $.template(searchingTmpl);

    function showSearchScreen(key, result) {
        $('#searching').html(searchingTmpl(result));
        $.UIGoToArticle('#searching');
        $.UINavigationHistory.push('#searching');
    }

    bus.subscribe('searchingForBarcode', showSearchScreen)

});