(function() {
    var deps = ["rsvp", "logger"];
    if (!/MacIntel/.test(navigator.platform)) {
        deps.push("cordova");
    } else {
        document.documentElement.classList.remove('loading');
    }
    define(deps, function(rsvp, logger, cordova) {

        // create sheet which will show before the scanner becomes visible
        $.UISheet();
        $('.sheet').find('section').append("<h2>Launching Scanner</h2>");
        logger.debug("Scanner sheet inserted into the DOM");
        return function() {
            logger.debug("Scanner sheet showing");
            $.UIShowSheet();
            return new rsvp.Promise(function(resolve, reject){
                logger.debug("Launching barcode scanner");
                cordova.plugins.barcodeScanner.scan(
                    function(result) {
                        $.UIHideSheet();
                        resolve(result.text);
                    },
                    function(error) {
                        $.UIHideSheet();
                        reject(error);
                    }
                );
            });
        };
    });

})();