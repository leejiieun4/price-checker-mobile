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

        if ($.isAndroid) {
            feedbackBtn.removeClass('icon').html("Feedback");
        }

        function registerHandlers() {

            launchScanner.on('click', function(event) {
                analytics.trackEvent('Scanner', 'Launched');
                showScanner().then(function(barcode) {
                    analytics.trackEvent('Scanner', 'Closed', barcode);
                    setBarcode(barcode);
                }, function(error) {
                    alert('An error occured whilst using the barcode scanner' + error)
                });
            });

            findBestPriceBtn.on('click', function(event) {
                hideKeyboard();
                var barcode = getCurrentBarcode();
                bus.publish("searchingForBarcode", {barcode: barcode});
                analytics.trackEvent('getBestPrice', 'Launched', barcode);
                getBestPrice(barcode).then(function(result) {
                    analytics.trackEvent('getBestPrice', 'Result', barcode);
                    $.UINavigationHistory.pop();
                    setBarcode("&nbsp;");
                    bus.publish("barcodeResult", result);
                }, function(error) {
                    analytics.trackEvent('getBestPrice', 'NoResult', barcode);
                    var result = alert('Could not find a match for the barcode');
                    $.UIGoBack();
                });
            });

            var handler = function(event) {
                hideKeyboard();
                analytics.trackEvent('feedback', 'Launch');
                feedback().then(function() {
                    analytics.trackEvent('feedback', 'Sent');
                }, function() {
                    analytics.trackEvent('feedback', 'Cancelled');
                });
            }

            $('#feedback').on('click', handler);
            $('#feedback').on('singletap', handler);
        }

        function handleBackKey() {
            $.UIGoBack();
        }

        function onDeviceReady() {
            fastclick.attach(document.body);
            registerHandlers();
            document.addEventListener("backbutton", handleBackKey, false);
            if (window.analytics) {
                analytics.startTrackerWithId('UA-43287931-3');
                analytics.trackView('App Launch');
            } else {
                var emptyFn = function(){};
                window.analytics = {trackView: emptyFn, trackEvent: emptyFn};
            }
            if (window.device && parseFloat(window.device.version) >= 7) {
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