define(['rsvp'], function(rsvp) {

    var key = 'pastResults',
        json = JSON,
        listeners = [],
        currentVersion = 1;

    function validateDataInStore() {
        return new rsvp.Promise(function(resolve, reject) {
            var version = json.parse(localStorage.getItem('version'));
            if (version !== currentVersion) {
                localStorage.clear();
            }
            localStorage.setItem('version', json.stringify(currentVersion));
            updateVendors().then(function(data) {
                resolve(data)
            }, function(err) {
                reject(err);
            });
        });
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
        return new rsvp.Promise(function(resolve, reject) {
            var pastResults = getPastResults(key);
            pastResults[barcode] = addBestPricedVendor(result);
            localStorage.setItem(key, json.stringify(pastResults));
            var promise = updateVendors(result);
            for (var i = 0, len = listeners.length; i < len; i++) {
                listeners[i](barcode, result);
            }
            promise.then(function() {
                resolve(result);
            })
        });
    }

    function addBestPricedVendor(result) {
        var best = 0,
            bestVendors = [];
        if (result) {
            for (var vendor in result.prices) {
                var vendorPrice = result.prices[vendor].price;
                if (best < vendorPrice) {
                    best = vendorPrice;
                    bestVendors = [vendor];
                } else if (best === vendorPrice) {
                    bestVendors.push(vendor);
                }
            }
            result.bestVendors = bestVendors;
        }
        return result;
    }

    function updateVendors() {
        return new rsvp.Promise(function(resolve, reject) {
            var vendors = {},
                pastResults = getPastResults(key);
            for (var oldResult in pastResults){
                for (var vendor in pastResults[oldResult].prices) {
                    if (!vendors[vendor]) {
                        vendors[vendor] = {
                            name: pastResults[oldResult].prices[vendor].details.name,
                            url: pastResults[oldResult].prices[vendor].details.url,
                            totalPrice: 0
                        };
                    }
                    vendors[vendor].totalPrice += pastResults[oldResult].prices[vendor].price;
                }
            }
            localStorage.setItem('vendors', json.stringify(vendors));
            resolve(vendors);
        });
    }

    function getVendors() {
        return getPastResults('vendors');
    }

    return {
        saveResultToDisk: function(result) {
            return doUpdate(result.barcode, result);
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
        },

        init: validateDataInStore

    };
});