define(["chui", "rsvp"], function($, rsvp) {
    return function(msg) {
        return new rsvp.Promise(function(resolve, reject){
            analytics.trackView('Alert');
            $.UIPopup({
                title: 'An Error Occured',
                message: msg,
                cancelButton: 'OK',
                callback: function() {
                    resolve();
                }
            });
        });
   };
});