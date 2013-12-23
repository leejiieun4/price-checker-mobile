define(["rsvp"], function(rsvp) {
    return function() {
        var composer = window.cordova.require('emailcomposer.EmailComposer');
        return new rsvp.Promise(function(resolve, reject){
            composer.show({
                to: 'makemecashapp@gmail.com',
                subject: 'Make Me Cash App Feedback',
                body: '',
                isHtml: true,
                attachments: [],
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