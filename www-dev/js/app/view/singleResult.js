define(['chui', "app/eventBus", "text!app/view/tmpl/singleResult.tmpl", "text!app/view/tmpl/searching.tmpl"],
    function($, bus, singleResultTmpl, searchingTmpl) {

    singleResultTmpl = $.template(singleResultTmpl);

    function showResult(key, result) {
        $('#results').html(singleResultTmpl(result));
        $.UIGoToArticle('#results');
        $.UINavigationHistory.push('#results');
    }

    bus.subscribe('barcodeResult', showResult);

    searchingTmpl = $.template(searchingTmpl);

    function showSearchScreen(key, result) {
        $('#searching').html(searchingTmpl(result));
        $.UIGoToArticle('#searching');
    }

    bus.subscribe('searchingForBarcode', showSearchScreen)

});