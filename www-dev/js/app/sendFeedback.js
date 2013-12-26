define(["rsvp", "logger"], function(rsvp, logger) {
    return function() {
        var composer = window.cordova.require('de.appplant.cordova.plugin.email-composer.EmailComposer');
        return new rsvp.Promise(function(resolve, reject){
            composer.open({
                to: ['makemecashapp@gmail.com'],
                subject: 'Make Me Cash App Feedback',
                onSuccess: function (winParam) {
                    resolve(winParam);
                },
                onError: function (error) {
                    reject(error);
                }
            });
        });
    };
});