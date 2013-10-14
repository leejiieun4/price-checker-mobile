define(["chui", "rsvp", "logger"], function($, rsvp, logger) {

    // create sheet which will show before the scanner becomes visible
    return function() {
        $('article.current').addClass('blurred');
        return new rsvp.Promise(function(resolve, reject){
            logger.debug("Launching barcode scanner");
            cordova.plugins.barcodeScanner.scan(
                function(result) {
                    $('article.current').removeClass('blurred');
                    resolve(result.text);
                },
                function(error) {
                    $('article.current').removeClass('blurred');
                    reject(error);
                }
            );
        });
    };
});