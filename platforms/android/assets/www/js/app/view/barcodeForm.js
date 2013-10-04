require(["chui", "app/barcodescanner", "app/getBestPrice", "app/eventBus"],
    function($, showScanner, getBestPrice, bus) {

        function getCurrentBarcode() {
            return $('#barcode').val();
        };

        function setBarcode(barcode) {
            $('#barcode').val(barcode);
        }

        $('#launch-scanner').on('singletap', function(event) {
            showScanner().then(function(barcode) {
                setBarcode(barcode);
            }, function(error) {
                alert('An error occured whilst using the barcode scanner' + error)
            });
        });
        $('#find-the-best-price').on('singletap', function(event) {
            getBestPrice(getCurrentBarcode()).then(function(result) {
                bus.publish("barcodeResult", result);
                setBarcode("");
            }, function(error) {
                alert('Could not find a match for the barcode')
            });
        });
    }
);