define([], function() {

    var key = 'pastResults',
        json = JSON,
        listeners = [],
        currentVersion = 1;

    function validateDataInStore() {
        var version = json.parse(localStorage.getItem('version'));
        if (version !== currentVersion) {
            localStorage.clear();
        }
        localStorage.setItem('version', json.stringify(currentVersion));
    }

    function cleanse(results) {
        if (results.undefined) {
            delete results.undefined;
        }
        for (var result in results) {
            if (results.hasOwnProperty(result)) {
                if (results[result].bestVendors.length === 0) {
                    delete results[result];
                }
            }
        }
        return results;
    }

    function getPastResults(key) {
        var pastResults = localStorage.getItem(key);
        if (!pastResults) {
            pastResults = "{}";
        }
        try {
            if (key === 'pastResults') {
                return cleanse(json.parse(pastResults));
            } else {
                return json.parse(pastResults);
            }
        } catch (e) {
            return {};
        }
    }

    function getPastResult(barcode) {
        var pastResults = getPastResults();
        return pastResults[barcode];
    }

    function doUpdate(barcode, result) {
        var pastResults = getPastResults(key);
        pastResults[barcode] = addBestPricedVendor(result);
        localStorage.setItem(key, json.stringify(pastResults));
        updateVendors(result);
        for (var i = 0, len = listeners.length; i < len; i++) {
            listeners[i](barcode, result);
        }
    }

    function addBestPricedVendor(result) {
        var best = 0,
            bestVendors = [];
        for (var vendor in result.prices) {
            var vendorPrice = result.prices[vendor].price;
            if (best < vendorPrice) {
                best = vendorPrice;
                bestVendors = [vendor];
            } else if (best === vendorPrice) {
                bestVendors.push(vendor);
            }
        }
        result.bestVendors = bestVendors
        return result;
    }

    function updateVendors(result) {
        var vendors = getVendors(),
            pastResults = getPastResults(key);
        for (var vendor in result.prices) {
            vendors[vendor] = result.prices[vendor].details;
            var total = 0;
            for (var oldResult in pastResults){
                total += pastResults[oldResult].prices[vendor].price;
            }
            vendors[vendor].totalPrice = total;
        }
        localStorage.setItem('vendors', json.stringify(vendors));
    }

    function getVendors() {
        return getPastResults('vendors');
    }

    validateDataInStore();

    return {
        saveResultToDisk: function(result) {
            doUpdate(result.barcode, result);
        },

        deletePastResult: function(barcode) {
            doUpdate(barcode, undefined);
        },

        getPastResult: getPastResult,

        getPastResults: function() {
            return getPastResults(key);
        },

        getVendors: getVendors,

        addUpdateListener: function(listener) {
            listeners.push(listener);
        }

    };
});