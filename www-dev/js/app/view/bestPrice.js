define(
    ["chui", "app/eventBus", "app/priceResultManager",
        "text!app/view/tmpl/bestPriceForAllVendors.tmpl"],

    function($, bus, priceManager, tmpl) {

        tmpl = $.template(tmpl);

        function updateDomForAllVendors() {
            var result = {
                results: priceManager.getAllResults(),
                totalPrice: priceManager.getTotalBestPrice()
            };
            $('#bestprice').html(tmpl(result));
        }

        bus.subscribe('priceResultRepoChange', updateDomForAllVendors);

        updateDomForAllVendors();

    }
);