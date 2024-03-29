define(['rsvp', 'logger'], function(rsvp, logger) {

    var countPrices = function(result) {
        var i = 0;
        for (var res in result.prices) {
            if (result.prices.hasOwnProperty(res)) {
                i++;
            }
        }
        return i;
    }

    return function(barcode) {
        return new rsvp.Promise(function(resolve, reject){
            if (barcode && barcode.trim().length > 0) {
                var xhr = new XMLHttpRequest();
                xhr.onreadystatechange = function() {
                    if (xhr.readyState==4) {
                        xhr.onreadystatechange = function () {};
                        // Verify status code
                        if(xhr.status!=200 && (xhr.status !== 0 && !/MacIntel/.test(navigator.platform))){
            //                we can assume we're on a Mac and not device so lets mock out the response
                            if (xhr.status === 0 && /MacIntel/.test(navigator.platform)) {
                                setTimeout(function() {
                                    resolve({
                                      "barcode": "8717418136771",
                                      "prices": {
                                        "WeBuyDVDs": {
                                          "price": 0.25,
                                          "details": {
                                            "name": "WeBuyDVDs",
                                            "url": "http://www.webuydvds.co.uk/"
                                          },
                                          "title": ""
                                        }
                                      },
                                      "name": "New DVD",
                                      "success": true
                                    });
                                }, 1000);
                            } else {
                                reject(xhr.status+" ("+xhr.statusText+")");
                            }
                        } else {
                            var response = JSON.parse(xhr.responseText);
                            if (JSON.stringify(response.prices) === "{}" || xhr.responseText == "") {
                                reject("No matching items found for barcode " + response.barcode);
                                analytics.trackEvent('getBestPrice', 'No Results', barcode);

                            } else {
                                resolve(response);
                                analytics.trackEvent('getBestPrice', 'Results', barcode + ":" + countPrices(response) + ":" + response.name);
                            }
                            analytics.trackEvent('getBestPrice', 'ResponseTime', (Date.now() - startTime) + "");
                        }
                    }
                }
                var startTime = Date.now();
                xhr.open("GET", "http://price-app-checker-eu.herokuapp.com/?barcode=" + barcode, true);
                xhr.send();
            } else {
                reject('Invalid barcode');
            }
        })
    }
});