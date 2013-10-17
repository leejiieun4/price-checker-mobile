define(['chui', 'app/eventBus', "app/priceResultManager"], function($, eventBus, priceManager) {
    var opts = {
         tabs : 3,
         icons: ['search', 'best-price', 'by-vendor'],
         labels : ["Search", "Best Price", "By Vendor"],
         selected: 1
    };
    $.UITabbar(opts);

    function updateBestPriceTab(key, priceManager) {
        $(".tabbar .best-price label").html("Best Price<br/>£" + priceManager.getTotalBestPrice().toFixed(2));
    }

    eventBus.subscribe("priceResultRepoChange", updateBestPriceTab);

    updateBestPriceTab('priceResultRepoChange', priceManager);
})