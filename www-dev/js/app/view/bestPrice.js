define(
    ["chui", "app/eventBus", "app/priceResultManager",
        "text!app/view/tmpl/bestPriceForAllVendors.tmpl"],

    function($, bus, priceManager, tmpl) {

        tmpl = $.template(tmpl);

        var skipUpdate = false;

        function handleItemDelete(item) {
            var item = $(item).parent('li');
            var barcode = item.dataset('barcode');
            analytics.trackEvent('bestPrice', 'Delete', barcode);
            priceManager.deleteItem(barcode);

            var newBestPrice = priceManager.getTotalBestPrice();
            var sectionHeader = $('#bestprice section > h3');
            var oldBestPrice = sectionHeader.text().split('£')[1];
            sectionHeader.html(sectionHeader.html().replace(oldBestPrice, newBestPrice.toFixed(2)));
            skipUpdate = true;
            bus.publish("priceResultRepoChange", priceManager);
            skipUpdate = false;
        }

        function updateDomForAllVendors() {
            if (!skipUpdate) {
                var result = {
                    results: priceManager.getAllResults(),
                    totalPrice: priceManager.getTotalBestPrice()
                };
                $('#bestprice').html(tmpl(result));

                $.UIDeletable({
                    list: '#bestprice ul',
                    callback: handleItemDelete
                });
            }
        }

        function handleSingleTap(event) {
            if ($(arguments[0].target).hasClass('deletion-indicator').length === 0 &&
                $(arguments[0].target).hasClass('delete').length === 0
                ) {
                var tappedLi = $(arguments[0].target).ancestor('li');
                var barcode = tappedLi.dataset('barcode');

                if (barcode) {
                    analytics.trackEvent('bestPrice', 'Show', barcode);
                    var data = priceManager.getAllResults()[barcode];
                    bus.publish('barcodeResult', data);
                }
            }
        }

        $('#bestprice').on('singletap', handleSingleTap);

        bus.subscribe('priceResultRepoChange', updateDomForAllVendors);

        updateDomForAllVendors();

    }
);