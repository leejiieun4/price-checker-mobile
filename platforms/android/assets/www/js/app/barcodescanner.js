define(["rsvp"], function(rsvp) {
    return function() {
        return new rsvp.Promise(function(resolve, reject){
            plugins.barcodeScanner.scan(
                function(result) {
                    resolve(result.text);
                },
                function(error) {
                    reject(error);
                }
            );
        });
    };
});