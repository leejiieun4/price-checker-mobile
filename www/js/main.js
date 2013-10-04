require.config({
    paths: {
        rsvp: 'bower_components/rsvp/rsvp.amd',
        cordova: '../cordova',
        "$$": 'app/$$',
        Hammer: 'bower_components/hammerjs/dist/hammer',
        logger: 'app/logger',
        chocolatechip: 'bower_components/chocolatechip-ui/chui/chocolatechip-3.0.4',
        chui: 'bower_components/chocolatechip-ui/chui/chui-3.0.4',
        text: 'bower_components/requirejs-text/text'
    },
    shim: {
        'Hammer': {
            exports: 'Hammer'
        },
        'chocolatechip' : {
            exports: '$chocolatechip'
        },
        'chui': {
            deps: ['chocolatechip'],
            exports: '$'
        },
        'cordova' : {
            exports: 'cordova'
        }
    }
});

require([
    'chui',
    'js/priceCheckerApp.js'
]);

function onDeviceReady() {
    if (parseFloat(window.device.version) === 7.0) {
        try {
            document.body.classList.add("isIOS7")
        } catch (e) {}
    }
    document.documentElement.classList.remove('loading');
}

document.addEventListener('deviceready', onDeviceReady, false);