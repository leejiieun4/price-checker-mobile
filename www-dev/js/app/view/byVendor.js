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
            $('#byvendor > section:first-child').removeClass('next').addClass('current');
        }

        bus.subscribe('priceResultRepoChange', updateDomForAllVendors);

        $.UIPaging();
    }
);