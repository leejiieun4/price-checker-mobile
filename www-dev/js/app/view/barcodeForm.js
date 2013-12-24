require(["chui", "app/barcodescanner", "app/getBestPrice", "app/eventBus", "logger", "app/view/alertDialog", "app/sendFeedback", 'fastclick'],
    function($, showScanner, getBestPrice, bus, logger, alert, feedback, fastclick) {

        function getCurrentBarcode() {
            return $('#barcode').val();
        };

        function setBarcode(barcode) {
            $('#barcode').val(barcode);
        }

        function hideKeyboard() {
            document.activeElement.blur();
        }
        var launchScanner = $('#launch-scanner');
        var findBestPriceBtn = $('#find-the-best-price');
        var feedbackBtn = $('#feedback');

        function registerHandlers() {

            logger.debug("Register handlers on barcode form");

            launchScanner.on('click', function(event) {
                logger.debug("launch scanner tapped");
                showScanner().then(function(barcode) {
                    setBarcode(barcode);
                }, function(error) {
                    alert('An error occured whilst using the barcode scanner' + error)
                });
            });

            findBestPriceBtn.on('click', function(event) {
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

            feedbackBtn.on('click', function(event) {
                hideKeyboard();
                logger.debug("Give feedback");
                feedback().then(function() {

                }, function() {

                });
            });
            logger.debug("Registered handlers on barcode form");

        }

        function onDeviceReady() {
            fastclick.attach(document.body);
            registerHandlers();
            if (parseFloat(window.device.version) >= 7) {
                $('body').addClass("isiOSseven");
            }
            setTimeout(function() {
                window.navigator.splashscreen.hide();
            }, 1);
        }

        document.addEventListener('deviceready', onDeviceReady, false);

        if (!window.cordova) {
            setTimeout(onDeviceReady, 1000);
        }

    }
);