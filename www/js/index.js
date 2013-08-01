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
var app = {
    // Application Constructor
    initialize: function() {
        this.bindEvents();
    },
    // Bind Event Listeners
    //
    // Bind any events that are required on startup. Common events are:
    // 'load', 'deviceready', 'offline', and 'online'.
    bindEvents: function() {
        document.addEventListener('deviceready', this.onDeviceReady, false);
        Hammer(document.getElementById('launch-scanner'))
            .on('tap', function(event) {
                priceCheckerScanner.launchScanner();
             });
        Hammer(document.getElementById('find-the-best-price'))
            .on('tap', function(event) {
                priceChecker.getBestPrice();
             });
    },
    // deviceready Event Handler
    //
    // The scope of 'this' is the event. In order to call the 'receivedEvent'
    // function, we must explicity call 'app.receivedEvent(...);'
    onDeviceReady: function() {
        app.receivedEvent();
    },
    // Update DOM on a Received Event
    receivedEvent: function() {
        console.log('Received Event');
    }
};
var priceCheckerScanner = {
    launchScanner: function() {
        plugins.barcodeScanner.scan(
            function (result) {
                alert("We got a barcode\n" +
                    "Result: " + result.text + "\n" +
                    "Format: " + result.format + "\n" +
                    "Cancelled: " + result.cancelled);
                document.getElementById('#barcode').value = result.text;
            },
            function (error) {
                alert("Scanning failed: " + error);
            }
        );
    }
};

var priceChecker = {
    getBestPrice: function() {
        var barcode = document.getElementById('barcode').value;
        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function() {
            if (xhr.readyState==4) {
                // Verify status code
                if(xhr.status!=200){
                    //throw xhr.status+" ("+xhr.statusText+")";
                    resultViewer.showResults({
                        "barcode":"0045496464189",
                        "prices":{
                            "musicmagpie.co.uk.js":{
                                price: "8.75",
                                details: {
                                    name: "music magpie"
                                }
                            }
                        },
                        "name":"Phoenix Wright: Ace Attorney - Justice For All (Nintendo DS)"
                    });
                } else {
                    resultViewer.showResults(JSON.parse(xhr.responseText));
                }
            }
        }
        xhr.open("GET", "http://price-app-checker.herokuapp.com/?barcode=" + barcode, true);
        xhr.send();
    }
};

var resultViewer = {
    showResults: function(result) {
        var tmpl = this.getTmpl();
        var resultsDom = document.getElementById('results');
        resultsDom.innerHTML = tmpl(result);
        document.getElementById("main-container").className += "results";
    },
    getTmpl: function() {
        if (!this.tmpl_CACHED) {
            this.tmpl_CACHED = tmpl("item_tmpl");
        }
        return this.tmpl_CACHED;
    }
};
