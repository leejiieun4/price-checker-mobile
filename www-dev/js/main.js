require.config({
    paths: {
        rsvp: 'bower_components/rsvp/rsvp.amd',
        "$$": 'app/$$',
        logger: 'app/logger',
        chocolatechip: 'bower_components/chocolatechip-ui/chui/chocolatechip-3.0.4',
        chui: 'bower_components/chocolatechip-ui/chui/chui-3.0.4',
        text: 'bower_components/requirejs-text/text'
    },
    shim: {
        'chocolatechip' : {
            exports: '$chocolatechip'
        },
        'chui': {
            deps: ['chocolatechip'],
            exports: '$'
        }
    }
});

require([
    'chui',
    'js/priceCheckerApp.js'
]);

if (!window.cordova) {
    setTimeout(onDeviceReady, 1000);
}