define(['Hammer'], function(Hammer) {
    function DomWrapper(dom) {
        this.dom = dom;
    };
    DomWrapper.prototype.onTap = function(handler) {
        Hammer(this.dom).on('tap', handler);
        return this;
    };
    DomWrapper.prototype.onSidewaysSwipe = function(handler) {
        Hammer(this.dom).on('swipeleft', handler);
        Hammer(this.dom).on('swiperight', handler);
        return this;
    };
    var makeDomSetGetFn = function(key) {
        return function(value) {
            if (value !== undefined) {
                this.dom[key] = value;
                return this;
            } else {
                return this.dom[key];
            }
        }
    }
    DomWrapper.prototype.class = makeDomSetGetFn('className');
    DomWrapper.prototype.value = makeDomSetGetFn('value');
    DomWrapper.prototype.data = makeDomSetGetFn('dataset');
    DomWrapper.prototype.html = makeDomSetGetFn('innerHTML');
    DomWrapper.prototype.up = function(selector, depthToCheckArg) {
        var depthToCheck = depthToCheckArg || 5,
            currentDepth = 0,
            currentNode = this.dom;
        while (currentDepth++ < depthToCheck && currentNode != null) {
            if (currentNode.webkitMatchesSelector(selector)) {
                return $(currentNode);
            } else {
                currentNode = currentNode.parentElement;
            }
        }
        return null;
    }
    DomWrapper.prototype.down = function(selector) {
        if (this.dom.webkitMatchesSelector(selector)) {
            return this;
        } else {
            var match = this.dom.querySelector(selector);
            if (match) {
                return $(match);
            }
        }
        return null;
    }
    function getCachedNode(selector) {
        if (selector !== document.body) {
            var cached = $.cache[selector];
            if (cached && cached.up('body')) {
                return cached;
            }
        }
        return null;
    }
    function $(selector) {
        var cached = getCachedNode(selector);
        if (!cached) {
            var wrapper;
            if (selector instanceof DomWrapper) {
                wrapper = selector;
            } else if (selector instanceof Element) {
                wrapper = new DomWrapper(selector);
            } else {
                wrapper = new DomWrapper(document.querySelector(selector));
            }
            $.cache[selector] = cached = wrapper;
        }
        return cached;
    };
    $.cache = {};

    return $;

});