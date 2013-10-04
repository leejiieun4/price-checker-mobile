define(["app/dataStore", "app/eventBus"], function(dataStore, eventBus) {

    function addResult(key, result) {
        try {
            result.name = result.WeBuyDVDs.title;
        } catch (e) {}
        dataStore.saveResultToDisk(result);
        eventBus.publish("priceResultRepoChange", priceManager);
    }

    function getTotalBestPrice() {
        var pastResults = dataStore.getPastResults();
        var total = 0;
        for ( var item in pastResults ) {
            var best = 0,
                currentItem = pastResults[item];
            total += currentItem.prices[currentItem.bestVendors[0]].price;
        }
        return total;
    }

    function getVendors() {
        return dataStore.getVendors();
    }

    eventBus.subscribe("barcodeResult", addResult);

    var priceManager = {
        getTotalBestPrice: getTotalBestPrice,
        getAllResults: function() {
            return dataStore.getPastResults();
        },
        getVendors: getVendors
    };

    return priceManager;

});