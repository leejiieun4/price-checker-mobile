define(["app/dataStore", "app/eventBus"], function(dataStore, eventBus) {

    function publishRepoChange() {
        eventBus.publish("priceResultRepoChange", priceManager);
    }

    function addResult(key, result) {
        try {
            result.name = result.WeBuyDVDs.title;
        } catch (e) {}
        dataStore.saveResultToDisk(result).then(publishRepoChange);
    }

    function getTotalBestPrice() {
        var pastResults = dataStore.getPastResults();
        var total = 0;
        try {
            for ( var item in pastResults ) {
                if (pastResults.hasOwnProperty(item)) {
                    var best = 0,
                        currentItem = pastResults[item];
                    total += currentItem.prices[currentItem.bestVendors[0]].price;
                }
            }
        } catch (e) {}
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
        getVendors: getVendors,
        deleteItem: function(barcode) {
            dataStore.deletePastResult(barcode);
        }
    };

    dataStore.init().then(publishRepoChange);

    return priceManager;

});