define(['chui', "app/eventBus", "app/priceResultManager",
        "text!app/view/tmpl/byVendor.tmpl"],

    function($, bus, priceManager, tmpl) {

        tmpl = $.template(tmpl);

        function updateDomForAllVendors() {
            var result = {
                results: priceManager.getAllResults(),
                vendors: priceManager.getVendors()
            };
            $('#byvendor').html(tmpl(result));
            //$('#byvendor section').addClass('current');
            $.UIPaging();

        }

        bus.subscribe('priceResultRepoChange', updateDomForAllVendors);
        updateDomForAllVendors();
    }
);