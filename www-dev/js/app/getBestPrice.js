define(['rsvp'], function(rsvp) {
    return function(barcode) {
        return new rsvp.Promise(function(resolve, reject){
            if (barcode && barcode.trim().length > 0) {
                //resolve({"barcode":"87174181367723","prices":{"Music Magpie":{"price":1.21,"details":{"name":"Music Magpie","url":"http://www.musicmagpie.co.uk"},"title":"HighSchool Musical - Remix Edition [DVD"},"WeBuyDVDs":{"price":1.36,"details":{"name":"WeBuyDVDs","url":"http://www.webuydvds.co.uk/"},"title":"HighSchool Musical - Remix Edition [DVD]"},"Zumu":{"price":0.55,"details":{"name":"Zumu","url":"http://www.zumu.co.uk/"},"title":"High School Musical (Remix)"}},"name":"HighSchool Musical - Remix Edition [DVD","success":true});
                var xhr = new XMLHttpRequest();
                xhr.onreadystatechange = function() {
                    if (xhr.readyState==4) {
                        // Verify status code
                        if(xhr.status!=200){
                            // we can assume we're on a Mac and not device so lets mock out the response
                            // if (xhr.status === 0 && /MacIntel/.test(navigator.platform)) {
                            //     setTimeout(function() {
                            //         resolve({
                            //           "barcode": "8717418136771",
                            //           "prices": {
                            //             "WeBuyDVDs": {
                            //               "price": 0.25,
                            //               "details": {
                            //                 "name": "WeBuyDVDs",
                            //                 "url": "http://www.webuydvds.co.uk/"
                            //               },
                            //               "title": ""
                            //             }
                            //           },
                            //           "name": "New DVD",
                            //           "success": true
                            //         });
                            //     }, 1000);
                            // } else {
                                reject(xhr.status+" ("+xhr.statusText+")");
                            // }
                        } else {
                            var response = JSON.parse(xhr.responseText);
                            if (JSON.stringify(response.prices) === "{}") {
                                reject("No matching items found for barcode " + response.barcode);
                            } else {
                                resolve(response);
                            }
                        }
                    }
                }
                xhr.open("GET", "http://price-app-checker-eu.herokuapp.com/?barcode=" + barcode, true);
                xhr.send();
            } else {
                reject('Invalid barcode');
            }
        })
    }
});