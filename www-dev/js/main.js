require.config({
    paths: {
        rsvp: 'bower_components/rsvp/rsvp.amd',
        "$$": 'app/$$',
        logger: 'app/logger',
        chocolatechip: 'bower_components/chocolatechip-ui/chui/chocolatechip-3.0.7',
        chui: 'bower_components/chocolatechip-ui/chui/chui-3.0.7',
        text: 'bower_components/requirejs-text/text',
        fastclick: 'bower_components/fastclick/lib/fastclick'
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