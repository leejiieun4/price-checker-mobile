require(["chui", "app/barcodescanner", "app/getBestPrice", "app/eventBus", "logger"],
    function($, showScanner, getBestPrice, bus, logger) {

        function getCurrentBarcode() {
            return $('#barcode').val();
        };

        function setBarcode(barcode) {
            $('#barcode').val(barcode);
        }

        logger.debug("Register handlers on barcode form");

        var launchScanner = $('#launch-scanner');
        launchScanner.on('singletap', function(event) {
            logger.debug("launch scanner tapped");
            showScanner().then(function(barcode) {
                setBarcode(barcode);
            }, function(error) {
                alert('An error occured whilst using the barcode scanner' + error)
            });
        });

        var findBestPriceBtn = $('#find-the-best-price');
        findBestPriceBtn.on('singletap', function(event) {
            logger.debug("find best price tapped");
            var barcode = getCurrentBarcode();
            bus.publish("searchingForBarcode", {barcode: barcode});
            getBestPrice(barcode).then(function(result) {
                bus.publish("barcodeResult", result);
                setBarcode("");
            }, function(error) {
                alert('Could not find a match for the barcode')
            });
        });

        logger.debug("Registered handlers on barcode form");
    }
);