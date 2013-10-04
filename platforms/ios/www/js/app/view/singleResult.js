define(['chui', "app/eventBus", "text!app/view/tmpl/singleResult.tmpl"], function($, bus, tmpl) {

    tmpl = $.template(tmpl);

    function showResult(key, result) {
        $('#results').html(tmpl(result));
        $.UIGoToArticle('#results');
    }

    bus.subscribe('barcodeResult', showResult);

});