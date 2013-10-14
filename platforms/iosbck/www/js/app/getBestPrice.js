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
                            if (xhr.status === 0 && /MacIntel/.test(navigator.platform)) {
                                resolve({"barcode":"8717418136772","prices":{"Music Magpie":{"price":0.21,"details":{"name":"Music Magpie","url":"http://www.musicmagpie.co.uk"},"title":"HighSchool Musical - Remix Edition [DVD"},"WeBuyDVDs":{"price":0.36,"details":{"name":"WeBuyDVDs","url":"http://www.webuydvds.co.uk/"},"title":"HighSchool Musical - Remix Edition [DVD]"},"Zumu":{"price":0.55,"details":{"name":"Zumu","url":"http://www.zumu.co.uk/"},"title":"High School Musical (Remix)"}},"name":"HighSchool Musical - Remix Edition [DVD","success":true});
                            } else {
                                reject(xhr.status+" ("+xhr.statusText+")");
                            }
                        } else {
                            resolve(JSON.parse(xhr.responseText));
                        }
                    }
                }
                xhr.open("GET", "http://price-app-checker.herokuapp.com/?barcode=" + barcode, true);
                xhr.send();
            } else {
                reject('Invalid barcode');
            }
        })
    }
});