define(['chui', 'app/eventBus'], function($, eventBus) {
    var opts = {
         tabs : 3,
         icons: ['search', 'best-price', 'by-vendor'],
         labels : ["Search", "Best Price", "By Vendor"],
         selected: 1
    };
    $.UITabbar(opts);

    function updateBestPriceTab(key, priceManager) {
        $(".tabbar .best-price label").text("Best Price £" + priceManager.getTotalBestPrice().toFixed(2));
    }

    eventBus.subscribe("priceResultRepoChange", updateBestPriceTab);
})