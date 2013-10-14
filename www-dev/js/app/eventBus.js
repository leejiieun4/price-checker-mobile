define(["logger"], function(logger) {
    var busEvents = {};

    function getHandlersFor(event) {
        if (busEvents[event]) {
            return busEvents[event];
        }
        return [];
    }

    return {
        subscribe: function(event, handler) {
            if (!busEvents[event]) {
                busEvents[event] = [];
            }
            getHandlersFor(event).push(handler);
        },

        unsubscribe: function(event, handler) {
            var handlers = getHandlersFor(event);
            for (var i = 0, len = handlers.length; i < len; i++) {
                if (handlers[i] === handler) {
                    handlers.splice(i, 1);
                    return;
                }
            }
        },

        publish: function(event, data) {
            var handlers = getHandlersFor(event);
            for (var i = 0, len = handlers.length; i < len; i++) {
                try {
                    handlers[i](event, data);
                } catch (e) {
                    logger(e);
                }
            }
        }

    }
});