/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
 (function(global){

 })(window);

var app = {
    initialize: function() {
        this.bindEvents();
    },
    bindEvents: function() {
        document.addEventListener('deviceready', this.onDeviceReady, false);
        document.addEventListener("backbutton", this.onBackButton, false);
        $('#launch-scanner').onTap(function(event) {
            priceCheckerScanner.launchScanner();
        });
        $('#find-the-best-price').onTap(function(event) {
            priceChecker.getBestPrice($('#barcode').value(), function() {
                $("#barcode").value("");
            });
        });
        $('#back-home').onTap(this.onBackButton);
        $('#past-results').onTap(function(event) {
            pastResultsView.handlePastResultTap(event);
        });
        $('#past-results').onSidewaysSwipe(function(event) {
            pastResultsView.handlePastResultSidewaysSwipe(event);
        });
        pastResultsView.showPastResults();
        $('#barcode').dom.focus();
    },
    onDeviceReady: function() {
        app.receivedEvent();
    },
    onBackButton: function() {
        $("#main-container").class("");
        setTimeout(function() {
            $("#results").class("displayNone");
        }, 600);
    }
};

var priceCheckerScanner = {
    launchScanner: function() {
        plugins.barcodeScanner.scan(
            function (result) {
                $('#barcode').value(result.text);
                setTimeout(function() {
                    priceChecker.getBestPrice(result.text, function() {
                        $("#barcode").value("");
                    });
                }, 250);
            },
            function (error) {
                alert("Scanning failed: " + error);
            }
        );
    }
};

var dataStore = {
    saveResultToDisk: function(result) {
        this.doUpdate(result.barcode, result);
    },

    deletePastResult: function(barcode) {
        this.doUpdate(barcode, undefined);
    },

    doUpdate: function(barcode, result) {
        var pastResults = this.getPastResults();
        pastResults[barcode] = result;
        localStorage.setItem('pastResults', JSON.stringify(pastResults));
        pastResultsView.showPastResults();
    },

    getPastResult: function(barcode) {
        var pastResults = this.getPastResults();
        return pastResults[barcode];
    },

    getPastResults: function() {
        var pastResults = localStorage.getItem('pastResults');
        if (!pastResults) {
            pastResults = "{}";
        }
        try {
            return JSON.parse(pastResults);
        } catch (e) {
            return {};
        }
    }
};

var pastResultsView = {
    showPastResults: function() {
        var pastResults = dataStore.getPastResults();
        if (pastResults !== {}) {
            var tmpl = templateManager.getTmpl('past_results_tmpl');
            $('#past-results').html(tmpl({
                pastResults: pastResults,
                totalBestPrice: this.getBestTotalPrice(pastResults).toFixed(2)
            }));
        }
    },

    getBestTotalPrice: function(pastResults) {
        var total = 0;
        for ( var item in pastResults ) {
            total += pastResults[item].prices[0].price;
        }
        return total;
    },

    handlePastResultTap: function(event) {
        var targetElement = $(event.target).up('tr[data-barcode]');
        if (targetElement) {
            var barcode = targetElement.data().barcode;
            var result = dataStore.getPastResult(barcode);
            resultView.showResults(result);
        }
    },

    handlePastResultSidewaysSwipe: function(event) {
        var targetElement = $(event.target).up('tr[data-barcode]');
        if (targetElement) {
            var barcode = targetElement.data().barcode;
            targetElement.class("should-delete");
            targetElement.down('.btn').onTap(function(event){
                dataStore.deletePastResult(barcode);
                pastResultsView.showPastResults();
                event.stopPropagation();
            });
        }
    }
}

var priceChecker = {
    getBestPrice: function(barcode, successCallback) {
        successCallback = successCallback || function(){};
        if (barcode && barcode.trim().length > 0) {
            $('#main-container').class('searching');
            setTimeout(function() {
            var xhr = new XMLHttpRequest();
            xhr.onreadystatechange = function() {
                if (xhr.readyState==4) {
                    $('#main-container').class('');
                    // Verify status code
                    if(xhr.status!=200){
                        // we can assume we're on a Mac and not device so lets mock out the response
                        if (xhr.status === 0 && /MacIntel/.test(navigator.platform)) {
                            successCallback();
                            resultView.showResults({"barcode":"8717418136772","prices":{"Music Magpie":{"price":0.21,"details":{"name":"Music Magpie","url":"http://www.musicmagpie.co.uk"},"title":"HighSchool Musical - Remix Edition [DVD"},"WeBuyDVDs":{"price":0.36,"details":{"name":"WeBuyDVDs","url":"http://www.webuydvds.co.uk/"},"title":"HighSchool Musical - Remix Edition [DVD]"},"Zumu":{"price":0.55,"details":{"name":"Zumu","url":"http://www.zumu.co.uk/"},"title":"High School Musical (Remix)"}},"name":"HighSchool Musical - Remix Edition [DVD","success":true});
                        } else {
                            throw xhr.status+" ("+xhr.statusText+")";
                        }
                    } else {
                        successCallback();
                        resultView.showResults(JSON.parse(xhr.responseText));
                    }
                }
            }
            xhr.open("GET", "http://price-app-checker.herokuapp.com/?barcode=" + barcode, true);
            xhr.send();
        }, 3000);
        } else {
            alert("You must enter a valid barcode");
        }
    }
};

var resultView = {
    showResults: function(result) {
        if (result.barcode) {
            var tmpl = templateManager.getTmpl("scan_tmpl");
            result = this.sortResults(result);
            try {
                $('#results-container').html(tmpl(result));
            } catch (e) {
                // clear local storage on error
                localStorage.clear();
            }
            setTimeout(function() {
                $("#main-container").class("results");
                dataStore.saveResultToDisk(result);
            }, 50);
            $("#results").class("");
        } else {
            alert("No matching item or prices found");
        }
    },
    sortResults: function(result) {
        var arrayOfPrices = [];
        for (var site in result.prices) {
            if (result.prices.hasOwnProperty(site)) {
                result.prices[site].key = site;
                result.prices[site].price = Number(result.prices[site].price);
                arrayOfPrices.push(result.prices[site]);
            }
        }
        arrayOfPrices.sort(function(siteA, siteB) {
            return (siteA.price > siteB.price ?  -1 : (siteA.price < siteB.price ? 1 : 0));
        });
        result.prices = arrayOfPrices;
        return result;
    }
};

var templateManager = {
    tmpls:{},
    getTmpl: function(id) {
        if (!this.tmpls[id]) {
            this.tmpls[id] = tmpl(id);
        }
        return this.tmpls[id];
    }
}
