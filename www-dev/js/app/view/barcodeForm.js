require(["chui", "app/barcodescanner", "app/getBestPrice", "app/eventBus", "logger", "app/view/alertDialog"],
    function($, showScanner, getBestPrice, bus, logger, alert) {

        function getCurrentBarcode() {
            return $('#barcode').val();
        };

        function setBarcode(barcode) {
            $('#barcode').val(barcode);
        }

        function hideKeyboard() {
            document.activeElement.blur();
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
            hideKeyboard();
            logger.debug("find best price tapped");
            var barcode = getCurrentBarcode();
            bus.publish("searchingForBarcode", {barcode: barcode});
            getBestPrice(barcode).then(function(result) {
                $.UINavigationHistory.pop();
                setBarcode("&nbsp;");
                bus.publish("barcodeResult", result);
            }, function(error) {
                var result = alert('Could not find a match for the barcode');
                $.UIGoBack();
            });
        });

        document.addEventListener('deviceready', function() {
            if (parseFloat(window.device.version) >= 7) {
                $('body').addClass("isiOSseven");
            }
            setTimeout(function() {
                window.navigator.splashscreen.hide();
            }, 1);
        }, false);

        logger.debug("Registered handlers on barcode form");
    }
);