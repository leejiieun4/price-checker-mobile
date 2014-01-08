(function () {
/**
 * almond 0.2.7 Copyright (c) 2011-2012, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        hasOwn = Object.prototype.hasOwnProperty,
        aps = [].slice;

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that "directory" and not name of the baseName's
                //module. For instance, baseName of "one/two/three", maps to
                //"one/two/three.js", but we want the directory, "one/two" for
                //this normalization.
                baseParts = baseParts.slice(0, baseParts.length - 1);

                name = baseParts.concat(name.split("/"));

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            } else if (name.indexOf('./') === 0) {
                // No baseName, so this is ID is resolved relative
                // to baseUrl, pull off the leading dot.
                name = name.substring(2);
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            return req.apply(undef, aps.call(arguments, 0).concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (hasProp(waiting, name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!hasProp(defined, name) && !hasProp(defining, name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            callbackType = typeof callback,
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (callbackType === 'undefined' || callbackType === 'function') {
            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (hasProp(defined, depName) ||
                           hasProp(waiting, depName) ||
                           hasProp(defining, depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback ? callback.apply(defined[name], args) : undefined;

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            //Using a non-zero value because of concern for what old browsers
            //do, and latest browsers "upgrade" to 4 if lower value is used:
            //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
            //If want a value immediately, use require('id') instead -- something
            //that works in almond on the global level, but not guaranteed and
            //unlikely to work in other AMD implementations.
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 4);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        config = cfg;
        if (config.deps) {
            req(config.deps, config.callback);
        }
        return req;
    };

    /**
     * Expose module registry for debugging and tooling
     */
    requirejs._defined = defined;

    define = function (name, deps, callback) {

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        if (!hasProp(defined, name) && !hasProp(waiting, name)) {
            waiting[name] = [name, deps, callback];
        }
    };

    define.amd = {
        jQuery: true
    };
}());

define("bower_components/almond/almond.js", function(){});

/*
    pO\
   6  /\
     /OO\
    /OOOO\
  /OOOOOOOO\
 ((OOOOOOOO))
  \:~=++=~:/

ChocolateChip-UI
ChocolateChip.js
Copyright 2013 Sourcebits www.sourcebits.com
License: BSD
Version: 3.0.7
*/

(function() {
   
   
   // Method to validate the results of an operation before returning it:
   var returnResult = function ( result ) {
      if (typeof result === 'string') return [];
      if (result && result.length && result[0] === undefined) return [];
      if (result && result.length) return result;
      else return [];
   };
   var $ = function ( selector, context ) {
      var idRE = /^#([\w-]*)$/;
      var classRE = /^\.([\w-]+)$/;
      var tagRE = /^[\w-]+$/;
      var getId = function(selector) {
         var el =  document.getElementById(selector.split('#')[1]);
         return el ? [el] : [];
      };
      var getTag = function(selector, context) {
         if (context) {
            return [].slice.apply(context.getElementsByTagName(selector)); 
         } else {
            return [].slice.apply(document.getElementsByTagName(selector));
         }
      };
      var getClass = function(selector, context) {
         if (context) {
            return [].slice.apply(context.getElementsByClassName(selector.split('.')[1]));
         } else {
            return [].slice.apply(document.getElementsByClassName(selector.split('.')[1]));
         }
      };
      var getNode = function ( selector, context ) {
         if (typeof selector === 'string') selector = selector.trim();
         if (typeof selector === 'string' && idRE.test(selector)) {
            return getId(selector);
         }
         if (selector && (selector instanceof Array) && selector.length) return selector;
         if (!context && typeof selector === 'string') {
            if (tagRE.test(selector)) {
               return getTag(selector);
            } else if (classRE.test(selector)) {
               return getClass(selector);
            } else {
               return [].slice.apply(document.querySelectorAll(selector));
            }
         } else {
            if (context) {
               return [].slice.apply(context.querySelectorAll(selector));
            } else {
               return [].slice.apply(document.querySelectorAll(selector));
            }
         }
      };
      if (typeof selector === 'undefined' || selector === document) {
         return [document];
      }
      if (selector === null) {
         return [];
      }
      if (!!context) {
         if (typeof context === 'string') {
            return [].slice.apply(document.querySelectorAll(context + ' ' + selector));
         } else if (context.nodeType === 1) {
            return getNode(selector, context);
         }
      } else if (typeof selector === 'function') {
         $.ready(function() {
            return selector.call(selector);
         });
      } else if (selector && selector.nodeType === 1) {
         return [selector];
      } else if (typeof selector === 'string') {
         if (selector === '') return [];
         if (/<\/?[^>]+>/.test(selector)) {
            return $.make(selector);
         } else {
            try {
               return getNode(selector) ? getNode(selector) : [];
            } catch(err) {
               return [];
            }
         }
      } else if (selector instanceof Array) {
         return selector;
      } else if (/NodeListConstructor/i.test(selector.constructor.toString())) {
         return [].slice.apply(selector);
      } else if (selector === window) {
         return [];
      }
      
      return this;
   };
   $.extend = function(obj, prop, enumerable) {
      enumerable = enumerable || false;
      if (!prop) {
         prop = obj;
         obj = $;
      }
      Object.keys(prop).forEach(function(p) {
         if (prop.hasOwnProperty(p)) {
            Object.defineProperty(obj, p, {
               value: prop[p],
               writable: true,
               enumerable: enumerable,
               configurable: true
            });
         }
      });
      return this;
   };
   $.extend({
 
      version : '3.0.5',
      
      libraryName : 'ChocolateChip',
      
      slice : Array.prototype.slice,
      
      make : function ( HTMLString ) {
         var ret = [];
         var temp = document.createElement('div');
         temp.innerHTML = HTMLString;
         temp = $.slice.apply(temp.childNodes);
         temp.forEach(function(ctx) {
            if (ctx.nodeType === 1) {
               ret.push(ctx);
            } else if (ctx.nodeType === 3 && ctx.nodeValue.trim().length !== 0) {
               ret.push(ctx);
            }
         });
         return ret;
      },
      
      html : function ( HTMLString ) {
         return this.make(HTMLString);
      },
       
      replace : function ( newElem, oldElem ) {
         if (!newElem || !oldElem) return;
          newElem = newElem.length ? newElem[0] : newElem;
          oldElem = oldElem.length ? oldElem[0] : oldElem;
          oldElem.parentNode.replaceChild(newElem, oldElem);
          return;
      },
      
      require : function( src, callback ) {
         callback = callback || $.noop;
         var script = document.createElement('script');
         script.setAttribute('type', 'text/javascript');
         script.setAttribute('src', src);
         script.onload = script.onreadystatechange = function() {
            if (!script.readyState || script.readyState === 'complete') {
               callback.apply(callback, arguments);
            }
         };
         $('head').insert(script, 'last');
      },
       
      processJSON : function ( data, name ) {
         if (name !== null || name !== undefined) {
            name = 'var ' + name + ' = ';
         } else {
            name = 'var data = ';
         }
         var script = document.createElement('script');
         script.setAttribute('type', 'text/javascript');
         var scriptID = "_" + $.uuidNum();
         script.setAttribute('id', scriptID);
         script.html(name + data);
         $('head').append(script);
         $.defer(function() {
            var id = '#' + scriptID;
            $(id).remove();
         });
      },
             
      delay : function ( fnc, time ) {
         fnc = fnc || $.noop;
         setTimeout(function() { 
            fnc.call(fnc); 
         }, time);
      },
       
      defer : function ( fnc ) {
         fnc = fnc || $.noop;
         return $.delay.apply($, [fnc, 1].concat($.slice.call(arguments, 1)));
      },
      
      noop : function ( ) { },
      
      concat : function ( args ) {
         if (args instanceof Array) {
            return args.join('');
         } else if (args instanceof Object) {
            return;
         } else {
            args = $.slice.apply(arguments);
            return String.prototype.concat.apply(args.join(''));
         }
      },
      
      w : function ( str ) {
         return str.split(' ');
      },
      
      isString : function ( str ) {
         return typeof str === 'string';
      },
      
      isArray : function ( array ) {
         return Array.isArray( array );
      },
      
      isFunction : function ( fn ) {
         return Object.prototype.toString.call(fn) === '[object Function]';
      },
      
      isObject : function ( obj ) {
         return Object.prototype.toString.call(obj) === '[object Object]';
      },
      
      isNumber : function ( number ) {
         return typeof number === 'number';
      },
      
      isInteger : function ( number ) {
         return (typeof number === 'number' && number % 1 === 0);
      },
      
      isFloat : function ( number ) {
         return (typeof number === 'number' && number % 1 !== 0);
      },
      
      uuidNum : function ( ) {
         return Math.floor(((1 + Math.random()) * 0x100000000));
      },
      
      makeUuid : function ( ) {
         return $.concat("chch_", $.uuid);
      },
      
      uuid : 0,
      
      chch_cache : {},
      
      fn : {}
      
   });
   $.fn.extend = function ( object ) {
      return $.extend(Array.prototype, object);
   };
   $.uuid = $.uuidNum();
   
   $.chch_cache.data = {};
   
   $.chch_cache.events = {};
   
   $.extend($.chch_cache.events, {
   
      keys : [],
      
      values : [],
      
      set : function ( element, event, callback, capturePhase ) {
         var key;
         var length = this.values.length > 0 ? this.values.length - 1 : 0;
         var values;
         if (!!element.id) {
            key = element.id;
         } else {
            ++$.uuid;
            key = $.makeUuid();
            element.setAttribute("id", key);
         }
         if (this.keys.indexOf(key) >= 0) {
            this.values[length].push([]);
            values = this.values[length];
            values.push(event);
            values.push(callback);
            values.push(capturePhase);
            element.addEventListener(event,callback,capturePhase);
         } else {
            this.keys.push(key);
            this.values.push([]);
            length = this.values.length-1;
            this.values[length].push([]);
            values = this.values[length];
            values[0].push(event);
            values[0].push(callback);
            values[0].push(capturePhase);
            element.addEventListener(event,callback,capturePhase);
         }
      },
      
      
      hasKey : function ( key ) {
         if (this.keys.indexOf(key) >= 0) { 
            return true; 
         } else { 
            return false; 
         }
      },
      
      _delete : function ( element, event, callback  ) {
         var $this = this;
         var idx = this.keys.indexOf(element);
         var cache = this.values;
         if (!element) {
            return;
         }
         if (typeof event === 'undefined') {
            cache[idx].each(function(item) {
               document.getElementById(element).removeEventListener(item[0], item[1], item[2]);
               $.chch_cache.events.keys.splice(idx, 1);
               cache[idx].splice(idx, 1);
            });
            cache.splice(idx, 1);
         }
         if (event && callback) {
            cache[idx].each(function(item) {
               if (item[0] === event) {
                  document.getElementById(element).removeEventListener(item[0], item[1], item[2]);
                  $.chch_cache.events.values.splice(idx, 1);
                  $.chch_cache.events.keys.splice(idx, 1);
               }
            });
         }
         if (event && typeof callback === 'undefined') {
            $this.values[idx].each(function(item) {
               if (item[0] === event) {
                  document.getElementById(element).removeEventListener(item[0], item[1], item[2]);
                  $.chch_cache.events.values.splice(idx, 1);
                  $.chch_cache.events.keys.splice(idx, 1);
               }
            });
         }
      }
   }); 
   $.fn.extend({
     each : function ( fn, ctx ) {
         if (!this.length) return [];
         if (typeof fn !== "function") { return; }
         var i; 
         var l = this.length;
         ctx = arguments[1];
         for (i = 0; i < l; i++) {
            if (i in this) {
               if (this.hasOwnProperty(i)) {
                  fn.call(ctx, this[i], i, this);
               }
            }
         }
         return this;
      },
      
      unique : function() {
         var ret = [];
         var sort = this.sort();
         sort.forEach(function(ctx, idx) {
            if (ret.indexOf(ctx) === -1) {
               ret.push(ctx);
            }
         });
         return ret.length ? ret : [];
      },
      
      eq : function ( index ) {
         if (!this.length) return [];
         index = parseInt(index, 10);
         if (this.length < index + 1) {
            return [];
         }
         if (index < 0) {
            if (this[this.length + index]) {
               return [this[this.length + index]];
            } else {
               return [];
            }
         }
         if (index === 0 || !!index) {
            return [this[index]];
         } else {
            return [];
         }
      },
      
      index : function ( element ) {
         if (!this.length) return [];
         var $this;
         if (!element) {
            $this = $(this[0]);
            return $this.parent().children().indexOf($this[0]);
         } else {
            if (element instanceof Array) {
               return this.indexOf(element[0]);
            } else if (element.nodeType === 1) {
               return this.indexOf(element);
            } else {
               return this.indexOf(element);  
            }
         }
      },
      
      is : function ( arg ) {
         if (!this.length || !arg) return [];
         if (!this.length) return [];
         var items = [];
         var $this;
         var __is = function ( node, arg ) {
            $this = this;
            if (typeof arg === 'string') {
               if ([].slice.apply(node.parentNode.querySelectorAll(arg)).indexOf(node) >= 0) {
                  return node;
               }
            } else if (typeof arg === 'function') {
               if (arg.call($this)) {
                  return node;
               }
            } else if (arg && arg.length) {
               if ($.slice.apply(arg).indexOf(node) !== -1) {
                  return node;
               }
            } else if (arg.nodeType === 1) {
               if (node === arg) {
                  return node;
               }
            } else {
               return [];
            }
         }; 
         this.each(function(item) {
            if (__is(item, arg)) {
               items.push(item);
            }
         });
         if (items.length) {
            return items;
         } else {
            return [];
         }
      },
      
      isnt : function ( arg ) {
      if (!this.length) return [];
         var items = [];
         var $this;
         var __isnt = function ( node, arg ) {
            $this = this;
            if (typeof arg === 'string') {
               if ([].slice.apply(node.parentNode.querySelectorAll(arg)).indexOf(node) === -1) {
                  return node;
               }
            } else if (typeof arg === 'function') {
               if (arg.call($this)) {
                  return node;
               }
            } else if (arg.length) {
               if ($.slice.apply(arg).indexOf(node) === -1) {
                  return node;
               }
            } else if (arg.nodeType === 1) {
               if (node !== arg) {
                  return node;
               }
            } else {
               return [];
            }
         }; 
         this.each(function(item) {
            if (__isnt(item, arg)) {
               items.push(item);
            }
         });
         if (items.length) {
            return items;
         } else {
            return [];
         }
      },
      
      has : function ( arg ) {
         if (!this.length) return [];
         var items = [];
         var __has = function ( node, arg ) {
            if (typeof arg === 'string') {
               if (node.querySelector(arg)) {
                  return node;
               }
            } else if (arg.nodeType === 1) {
               if ($.slice.apply(this.children).indexOf(arg)) {
                  return node;
               }
            } else {
               return false;
            }
         };
         this.each(function(item) {
            if (__has(item, arg)) {
               items.push(item);
            }
         });
         if (items.length) {
            return items;
         } else {
            return [];
         }
      },
      
      hasnt : function ( arg ) {
         if (!this.length) return [];
         var items = [];
         this.each(function(item) {
            if (typeof arg === 'string') {
               if (!item.querySelector(arg)) {
                  items.push(item);
               }
            } else if (arg.nodeType === 1) {
               if (!$.slice.apply(item.children).indexOf(arg)) {
                  items.push(item);
               }
            }
         });
         if (items.length) {
            return items;
         } else {
            return [];
         }
      }, 
      
      find : function ( selector, context ) {
         var ret = [];
         if (!this.length) return ret;
         if (context) {
            context.each(function() {
               $.slice.apply(context.querySelectorAll(selector)).each(function(node) {
                  ret.push(node);
               });
            });
         } else {
            this.each(function(ctx) {
               $.slice.apply(ctx.querySelectorAll(selector)).each(function(node) {
                  ret.push(node);
               });
            });
         }
         return ret;
      },
      
      css : function ( property, value ) {
         if (!this.length) return [];
         var ret = [];
         if (!property) return [];
         if (!value && property instanceof Object) {
            if (!this.length) return;
            this.each(function(node) {
               for (var key in property) {
                  if (property.hasOwnProperty(key)) {
                     node.style[$.camelize(key)] = property[key];
                  }
               }
               ret.push(node);
            });
         } else if (!value && typeof property === 'string') {
            if (!this.length) return;
            return document.defaultView.getComputedStyle(this[0], null).getPropertyValue(property.toLowerCase());
         } else if (!!value) {
            if (!this.length) return [];
            this.each(function(node) {
               node.style[$.camelize(property)] = value;
               ret.push(node);
            });
         }
         return ret.length ? ret : [];
      },
      
      width : function ( ) {
         if (!this.length) return;
         return this.eq(0)[0].clientWidth;
      },
      
      height : function ( ) {
         if (!this.length) return;
         return this.eq(0)[0].clientHeight;
      },
      
      // Gets the absolute coordinates of the first element in a collection.
      // var offset = $('li').eq(0).offset();
      // offset.top, offset.right, offset.bottom, offset.left
      // For width and height, use $(selector).width(), etc.
      offset : function ( ) {
         if (!this.length) return;
         var offset = this.eq(0)[0].getBoundingClientRect();
         return {
            top: Math.round(offset.top),
            left: Math.round(offset.left),
            bottom: Math.round(offset.bottom),
            right: Math.round(offset.right)
          };
      },
      
      prependTo : function ( selector ) {
         if (!this.length) return [];
         this.reverse();
         this.each(function(item) {
            $(selector)[0].insertBefore(item, $(selector)[0].firstChild);
         });
         return this;
      },
      
      appendTo : function ( selector ) {
         if (!this.length) return [];
         this.each(function(item) {
            $(selector).append(item);
         });
         return this;
      },
      
      before: function ( content ) {
         if (!this.length) return [];
         var __before = function ( node, content ) {
            if (typeof content === 'string') {
               content = $.make(content);
            }
            if (content && content.constructor === Array) {
               var len = content.length;
               var i = 0; 
               while (i < len) {
                  node.insertAdjacentElement('beforeBegin', content[i]);
                  i++;
               }
            } else if (content && content.nodeType === 1) {
               node.insertAdjacentElement('beforeBegin',content);
            }
            return node;
         };         
         
         this.each(function(node) {
            __before(node, content);
         });
         return this;
      },
      
      after : function ( args ) {
         if (!this.length) return [];
         var __after = function ( node, content ) {
            var parent = node.parentNode;
            if (typeof content === 'string') {
               content = $.make(content);
            }
            if (content && content.constructor === Array) {
               var i = 0, len = content.length;
               while (i < len) {
                  if (node === parent.lastChild) {
                     parent.appendChild(content[i]);
                  } else {
                     parent.insertBefore(content[i], node.nextSibling);
                  }
                  i++;
               }
            } else if (content && content.nodeType === 1) {
               parent.appendChild(content);
            }
            return this;
         };     
      
         this.each(function(node) {
            __after(node, args);
         });
         return this;
      },
      
      text : function ( string ) {
         if (!this.length) return [];
         var ret = '';
         
         var __text = function ( node, value ) {
            if (!!value || value === 0) {
               node.innerText = value;
               return node;
            } else {
               return node.innerText;
            }
         };
                  
         this.each(function(node) {
            if (string) {
               __text(node, string);
            } else {
               ret += __text(node);
            }
         });
         if (!string) {
            return ret;
         }
         return this;
      },
      
      insert : function ( content, position ) {
         if (!this.length) return [];
         var __insert = function (node, content, position) {
            if (node instanceof Array) {
               node = node[0];
            }
            var c = [];
            if (typeof content === 'string') {
               c = $.make(content);
            } else if (content && content.nodeType === 1) {
               c.push(content);
            } else if (content instanceof Array) {
               c = content;
            }
            var i = 0;
            var len = c.length;
            if (!position || position > (node.children.length + 1) || position === 'last') {
               while (i < len) {
                  node.appendChild(c[i]);
                  i++;
               }
            } else if (position === 1 || position === 'first') {
               if (node.children) {
                  if (node.firstElementChild) {
                     while (i < len) {
                        node.insertBefore(c[i], node.firstChild);
                        i++;
                     }
                  } else {
                     while (i < len) {
                        node.insertBefore(c[i], node.firstChild);
                        i++;
                     }
                  }
               }
            } else {
               while (i < len) {
                  node.insertBefore(c[i], node.childNodes[position]);
                     i++;
               }
            }
            return node;
         };
         var cnt = content;
         if (typeof cnt === 'string') {
            this.each(function(node) {
               __insert(node, content, position);
            });
         } else if (cnt instanceof Array) {
            this.each(function(node, idx) {
               if (position === 1 || position === 'first') {
                  cnt = cnt.reverse();
               }
               cnt.each(function(n, i) {
                  __insert(node, n, position);
               });
            });
         } else if (cnt.nodeType === 1) {
            this.each(function(node) {
               __insert(node, cnt, position);
            });
         }
         return this;
      },
      
      html : function ( content ) {
         if (!this.length) return [];
         var ret = [];
         var __html = function ( node, content ) {
            if (content === '') {
               node.innerHTML = '';
               ret.push(node);
            } else if (content) {
               node.innerHTML = content;
               ret.push(node);
            } else if (!content) {
               ret = node.innerHTML;
            }
         };
         this.each(function(node) {
            __html(node, content);
         });
         return ret.length ? ret : [];
      },
      
      prepend : function ( content ) {
         if (!this.length) return [];
         this.insert(content,'first');
         return this;
      },
      
      append : function ( content ) {
         if (!this.length) return [];
         this.insert(content, 'last');
         return this;
      },
      
      attr : function ( property, value ) {
         if (!this.length) return [];
         var ret = [];
         var __attr = function ( node, property, value ) {
             if (!value) {
                return node.getAttribute(property);
             } else {
                return node.setAttribute(property, value);
             }
         };
         if (!value) {
            if (this[0].hasAttribute(property)) {
               return this[0].getAttribute(property);
            }
         } else {
            this.each(function(node) {
               __attr(node, property, value);
               ret.push(node);
            });
         }
         if (ret.length) {
            return ret;
         }
      },
      
      prop : function( property, value ) {
         if (!this.length) return [];
         return this.attr(property, value);
      },
      
      hasAttr : function ( property ) {
         if (!this.length) return [];
         var ret = [];
         this.each(function(node) {
            if (node.hasAttribute(property)) {
               ret.push(node);
            }
         });
         return returnResult(ret);
      },
      
      removeAttr : function ( attribute ) {
         if (!this.length) return [];
         var ret = [];
         this.each(function(node) {
            if (!!node.hasAttribute(attribute)) {
               node.removeAttribute(attribute);
               ret.push(node);
            }
         });
         return returnResult(ret);
      },
      
      hasClass : function ( className ) {
         if (!this.length) return [];
         var ret = [];
         var tokens = [];
         if (/\s/.test(className)) {
            tokens = className.split(' ');
         }
         this.each(function(node) {
            if (tokens.length) {
               tokens.forEach(function(name) {
                 if (node && node.classList && node.classList.contains(name)) {
                     ret.push(node);
                  }           
               });
               ret = ret.unique();
            } else if (node && node.classList && node.classList.contains(className)) {
               ret.push(node);
            }
         });
         return returnResult(ret);
      },
      
      addClass : function ( className ) {
         if (!this.length) return [];
         var ret = [];
         var classes;
         this.each(function(node) {
            if (/\s/.test(className)) {
               classes = className.split(' ');
               classes.each(function(name) {
                  node.classList.add(name);
               });
            } else {
               node.classList.add(className);
            }
            ret.push(node);
         });
         return returnResult(ret);
      },
      
      removeClass : function ( className ) {
         if (!this.length) return [];
         var ret = [];
         var classes;
         this.each(function(node) {
            if (!node) return;
            if (/\s/.test(className)) {
               classes = className.split(' ');
               classes.each(function(name) {
                  node.classList.remove(name);
               });
            } else {
               node.classList.remove(className);
            }
            if (node.getAttribute('class')==='') {
               node.removeAttribute('class');
            }
            ret.push(node);
         });
         return returnResult(ret);
      },

      toggleClass : function ( className ) {
         if (!this.length) return [];
         var ret = [];
         this.each(function(node) {
            node.classList.toggle(className);
            ret.push(node);
         });
         return returnResult(ret);
      },
      
      dataset : function ( key, value ) {
         if (!this.length) return [];
         var ret = [];
         if (typeof value === 'string' && value.length >= 0) {
            this.each(function(node) {
               node.dataset[key] = value;
               ret.push(node);
            });
         } else {
            return this[0].dataset[$.camelize(key)];
         }
         return returnResult(ret);
      },
      
      val : function ( value ) {
         if (!this.length) return [];
         if (typeof value === 'string') {
            this[0].value = value;
            return this;
         } else {
            if (this[0] && this[0].value) {
               return this[0].value;
            } else {
               return;
            }
         }
      },
      
      disable : function ( ) {
         if (!this.length) return [];
         var ret = [];
         this.each(function(node) {
            node.classList.add('disabled');
            node.setAttribute('disabled', true);
            node.style.cursor = 'default';
         });
         return returnResult(ret);
      },
      
      enable : function ( ) {
         if (!this.length) return [];
         var ret = [];
         this.each(function(node) {
            node.classList.remove('disabled');
            node.removeAttribute('disabled');
            node.style.cursor = 'auto';
         });
         return returnResult(ret);
      },
      
      hide : function ( speed, callback ) {
         if (!this.length) return [];
         var cbk = callback || $.noop;
         if (!this.length) return [];
         var ret = [];
         var css = '';
         var storedDimensions = {};
         var cssAnim = {
            opacity: 0,
            height: 0,
            padding: 0
         };
         var transition = $.isWebkit ? '-webkit-transition' : 'transition';
         this.each(function(ctx) {
            storedDimensions.padding = $(ctx).css('padding');
            storedDimensions.height = $(ctx).css('height');
            storedDimensions.opacity = $(ctx).css('opacity');
            storedDimensions.display = $(ctx).css('display');
            $(ctx).data('ui-dimensions', storedDimensions); 
            if (typeof speed === 'string') {
               if (speed === 'slow') {
                  $(ctx).css({transition: 'all 1s ease-out'});
                  $(ctx).css(cssAnim);
                  setTimeout(function() {
                     $(ctx).css({visibility: 'hidden', display: 'none'});
                     cbk.apply(ctx, arguments);
                  }, 1000);
               } else if (speed === 'fast') {
                  $(ctx).css({transition: 'all .35s ease-in-out'});
                  $(ctx).css(cssAnim);
                  setTimeout(function() {
                     $(ctx).css({visibility: 'hidden', display: 'none'});
                     cbk.apply(ctx, arguments);
                  }, 350);
               }
            } else if (typeof speed === 'number') {
               css = 'all ' + speed + 'ms ease-in-out';
               $(ctx).css({transition: css});
               $(ctx).css(cssAnim);
               setTimeout(function() {
                  $(ctx).css({visibility: 'hidden', display: 'none'});
                  cbk.apply(ctx, arguments);
               }, speed);
            }
            if (!callback && typeof speed === 'function') {
               $(ctx).css({display: 'none', visibility: 'hidden'});
               speed.apply(ctx, arguments);
            }
            if (!speed) {
               $(ctx).data('','');
               $(ctx).css({
                  display: 'none',
                  visibility: 'hidden'
               });
            }
            ret.push(ctx);
         });
         return returnResult(ret);
      },
      
      show : function ( speed, callback ) {
         if (!this.length) return [];
         var cbk = callback || $.noop;
         var createCSSAnim = function(opacity, height, padding) {
            return {
               opacity: opacity,
               height: height,
               padding: padding
            };
         };
         var transition = $.isWebkit ? '-webkit-transition' : 'transition';
         this.each(function(ctx) {
            var storedDimensions = $(ctx).data('ui-dimensions');
            var height = storedDimensions && storedDimensions.height || 'auto';
            var padding = storedDimensions && storedDimensions.padding || 'auto';
            var opacity = storedDimensions && storedDimensions.opacity || 1;
            var display = storedDimensions && storedDimensions.display || 'block';
            if (typeof speed === 'string') {
               if (speed === 'slow') {
                  $(ctx).css({visibility: 'visible', display: display});
                  setTimeout(function() {
                     $(ctx).css({transition: 'all 1s ease-out'});
                     $(ctx).css(createCSSAnim(opacity, height, padding));
                     setTimeout(function() {
                        cbk.apply(ctx, arguments);
                     }, 1000);
                  });
               } else if (speed === 'fast') {
                  $(ctx).css({visibility: 'visible', display: display});
                  setTimeout(function() {
                     $(ctx).css({transition: 'all .250s ease-out'});
                     $(ctx).css(createCSSAnim(opacity, height, padding));
                     setTimeout(function() {
                        cbk.apply(ctx, arguments);
                     }, 250);
                  });
               }
            } else if (typeof speed === 'number') {
               $(ctx).css({visibility: 'visible', display: display});
               setTimeout(function() {
                  $(ctx).css({transition: 'all ' + speed + 'ms ease-out'});
                  $(ctx).css(createCSSAnim(opacity, height, padding));
                  setTimeout(function() {
                     cbk.apply(ctx, arguments);
                  }, speed);
               });
            }
            if (!speed) {
               $(ctx).css({
                  display: display,
                  visibility: 'visible',
                  opacity: opacity
               });
            }
         });
      },
      
      prev : function ( ) {
         if (!this.length) return [];
         var ret = [];
         this.each(function(node) {
            if (node.previousElementSibling) {
               ret.push(node.previousElementSibling);
            }
         });
         return ret;
      },
      
      next : function ( ) {
         if (!this.length) return [];
         var ret = [];
         this.each(function(node) {
            if (node.nextElementSibling) {
               ret.push(node.nextElementSibling);
            }
         });
         return ret;
      },
       
      first : function ( ) {
         if (!this.length) return [];
         var ret = [];
         this.each(function(node) {
            if (node.firstElementChild) {
               ret.push(node.firstElementChild);
            }
         });
         return ret;
      },
       
      last : function ( ) {
         if (!this.length) return [];
         var ret = [];
         this.each(function(node) {
            if (node.lastElementChild) {
               ret.push(node.lastElementChild);
            }
         });
         return ret;
      },
      
      children : function ( selector ) {
         if (!this.length) return [];
         var ret = [];
         if (!selector) {
            this.each(function(node) {
               [].slice.apply(node.children).forEach(function(ctx) {
                  ret.push(ctx);
               });
            });
         } else {
            this.forEach(function(node) {
               [].slice.apply(node.children).forEach(function(ctx) {
               if ([ctx].is(selector)[0]) {
                  ret.push(ctx);
               }
               });
            });
         }
         return ret;
      },
      
      parent: function() {
         if (!this.length) return [];
         var ret = [];
         this.each(function(ctx) {
            ret.push(ctx.parentNode);
         });
         ret = ret.unique();
         return returnResult(ret);
      },
      
      ancestor : function( selector ) {
         if (!this.length) return [];
         var ret = [];
         this.each(function(ctx) {
            if (typeof selector === 'undefined') {
               return [];
            }
            var position = null;
            var newSelector = null;
            var p = ctx.parentNode;
            if (!p) {
               return [];
            }
            if (typeof selector === 'string') {
               selector.trim();
            }
            if (typeof selector === 'number') {
               position = selector || 1;
                for (var i = 1; i < position; i++) {
                   if (p.nodeName === 'HTML') {
                      return p;
                   } else {
                      if (p !== null) {
                         p = p.parentNode;
                      }
                   }
                } 
                ret.push(p);
            } else if (typeof selector === 'string' && selector.substr(0,1) === '.' ) {
               newSelector = selector.split('.')[1];
               if (p.nodeName === 'BODY') {
                  ret.push(p);
               }
               if (p.classList.contains(newSelector)) {
                  ret.push(p);
               } else {
                  ret.push($(p).ancestor(selector)[0]);
               }
            } else if (typeof selector === 'string' && selector.substr(0,1) === '#' ) {
               newSelector = selector.split('#')[1];
               if (p.getAttribute('id') === newSelector) {
                  ret.push(p);
               } else {
                  ret.push($(p).ancestor(selector)[0]);
               }
            } else { 
               if (p.tagName && (p.tagName.toLowerCase() === selector)) {
                  ret.push(p);
               } else {
                  ret.push($(p).ancestor(selector)[0]);
               } 
            }
         });
         ret = ret.unique();
         if (ret[0] === undefined) return [];
         return returnResult(ret);
      }, 
      
      closest : function( selector ) {
         if (!this.length) return [];
         var ret = [];
         this.each(function(ctx) {
            ret.push($(ctx).ancestor(selector)[0]);
         });
         return ret.length ? ret : this;
      },
      
      siblings : function( selector ) {
         if (!this.length) return [];
         var _siblings;
         var ret = [];
         if (selector && (typeof selector === 'string')) {
            selector = selector;
         } else {
            selector = false;
         }
         this.each(function(ctx) {
            _siblings = $(ctx).parent().children();
            _siblings.splice(_siblings.indexOf(ctx),1);
            if (selector) {
               _siblings.each(function(node) {
                  if (node.nodeName === selector.toUpperCase()) {
                     ret.push(node);
                  }
               });
            } else {
               _siblings.each(function(node) {
                  ret.push(node);
               });
            }
         });
         return ret.length ? ret.unique() : this;
      },
      
      bind : function( event, callback, capturePhase ) {
         if (!this.length) return [];
         capturePhase = capturePhase || false;
         this.each(function(ctx) {
            $.chch_cache.events.set(ctx, event, callback, capturePhase);
         });
         return this;
      },
         
      unbind : function( event, callback, capturePhase ) {
         if (!this.length) return [];
         var id;
         this.each(function(ctx) {
            if (!ctx.id || !$.chch_cache.events.hasKey(ctx.id)) {
               return this;
            }
            capturePhase = capturePhase || false;
            id = ctx.getAttribute('id');
            $.chch_cache.events._delete(id, event, callback, capturePhase);
         });
         return this;
      },
       
      trigger : function ( event ) {
         if (!this.length) return [];
         this.each(function(ctx) {
            if( document.createEvent ) {
              var evtObj = document.createEvent('Events');
              evtObj.initEvent(event, true, false);
              ctx.dispatchEvent(evtObj);
            }
         });
      },
       
      delegate : function ( selector, event, callback, capturePhase ) {
         if (!this.length) return [];
         capturePhase = capturePhase || false;
         this.each(function(ctx) {
            ctx.addEventListener(event, function(e) {
               var target = e.target;
               if (e.target.nodeType === 3) {
                  target = e.target.parentNode;
               }
               $(selector, ctx).each(function(element) {
                  if (element === target) {
                     callback.call(element, e);
                  } else {
                     try {
                        var ancestor = $(target).ancestor(selector);
                        if (element === ancestor[0]) {
                           callback.call(element, e);
                        }
                     } catch(err) {}
                  }
               });
            }, capturePhase);
         });
      },
      
      undelegate : function ( selector, event, callback, capturePhase ) {
         if (!this.length) return [];
         this.each(function(ctx) {
            $(ctx).unbind(event, callback, capturePhase);
         });
      },
      
      on : function ( event, selector, callback, capturePhase ) {
         if (!this.length) return [];
         // If and object literal of events:functions are passed,
         // map them to event listeners on the element:
         if (! selector && /Object/img.test(event.constructor.toString())) {
            this.each(function(ctx) {
               for (var key  in event) {
                  if (event.hasOwnProperty(key)) {
                     $(ctx).on(key, event[key]);
                  }
               }
            });
         }
         var ret = [];
         // Check to see if event is a spaced separated list:
         var events;
         if (typeof event === 'string') {
            event = event.trim();
            if (/\s/.test(event)) {
               events = event.split(' ');
               if (events.length) {
                  this.each(function(ctx) {
                     events.each(function(evt) {
                        if (typeof selector === 'function') {
                           $(ctx).bind(evt, selector, callback);
                           ret.push(ctx);
                        } else {
                           $(ctx).delegate(selector, evt, callback, capturePhase);
                           ret.push(ctx);
                        }                       
                     });
                  });
               }
            }
         }
         this.each(function(ctx) {
            if (typeof selector === 'function') {
               $(ctx).bind(event, selector, callback);
               ret.push(ctx);
            } else {
               $(ctx).delegate(selector, event, callback, capturePhase);
               ret.push(ctx);
            }
         });
         return ret.length ? ret : this;
      },
      
      off : function( event, selector, callback, capturePhase ) {
         if (!this.length) return [];
         var ret = [];
         this.each(function(ctx) {
            if (typeof selector === 'function' || !selector) {
               $(ctx).unbind(event, selector, callback);
               ret.push(ctx);
            } else {
               $(ctx).undelegate(selector, event, callback, capturePhase);
               ret.push(ctx);
            }
         });
         return ret.length ? ret : this;
      },
      
      animate : function ( options ) {
         if (!this.length) return [];   
         var onEnd = null;
         var duration = duration || '.5s';
         var easing = easing || 'linear';
         var css = {};
         var transition;
         var transitionEnd;
         if ('ontransitionend' in window) {
            transition = 'transition';
            transitionEnd = 'transitionend';
         } else {
            transition = '-webkit-transition';
            transitionEnd = 'webkitTransitionEnd';
         }
         css[transition] = 'all ' + duration + ' ' + easing;
         this.forEach(function(ctx) {
            for (var prop in options) {
               if (prop === 'onEnd') {
                  onEnd = options[prop];
                  $(ctx).bind(transitionEnd, onEnd());
               } else {
                  css[prop] = options[prop];
               }
            }
            $(ctx).css(css);
         });
         return this;
      },
           
      // This only operates on the first element in the collection.
      data : function( key, value ) {
         if (!this.length) return [];
         var id;
         var ret;
         var ctx = this[0];
         id = ctx.id;
         if (key === 'undefined' || key === null) {
            return;
         }
         if (value) {
            if (!ctx.id) {
               ++$.uuid;
               id = $.makeUuid();
               ctx.setAttribute("id", id);
               $.chch_cache.data[id] = {};
               $.chch_cache.data[id][key] = value;
            } else {
               id = ctx.id;
               if (!$.chch_cache.data[id]) {
                  $.chch_cache.data[id] = {};
                  $.chch_cache.data[id][key] = value;
               } else {
                  $.chch_cache.data[id][key] = value;
               }
            }
         } else {
            if (key && id) {
               if (!$.chch_cache.data[id]) return;
               if (!$.chch_cache.data[id][key]) return;
               return $.chch_cache.data[id][key];
            }
         }
       return this;
      },
      
      removeData : function ( key ) {
         if (!this.length) return [];
         this.each(function(ctx) {
            var id = ctx.getAttribute('id');
            if (!id) {
               return;
            }
            if (!$.chch_cache.data[ctx.id]) {
               return this;
            }
            if (!key) {
               delete $.chch_cache.data[id];
               return this;
            }
            if (Object.keys($.chch_cache.data[id]).length === 0) {
               delete $.chch_cache.data[id];
            } else {
               delete $.chch_cache.data[id][key];
            }
            return this;
         });
      },
      
      clone : function ( value ) {
         if (!this.length) return [];
         var ret = [];
         this.each(function(ctx) {
            if (value === true || !value) {
               ret.push(ctx.cloneNode(true));
            } else {
               ret.push(ctx.cloneNode(false));
            }
         });
         return ret.length ? ret[0] : this;
      },
            
      wrap : function ( string ) {
         if (!this.length) return [];
         this.each(function(ctx) {
            var tempNode = $.make(string);
            tempNode = tempNode[0];
            var whichClone = $(ctx).clone(true);
            tempNode.appendChild(whichClone);
            ctx.parentNode.insertBefore(tempNode, ctx.nextSibling);
            $(ctx).remove(ctx);
         });
         return this;
      },
      
      unwrap : function ( ) {
         if (!this.length) return [];
         var parentNode = null;
         this.each(function(node) {
            if (node.parentNode === parentNode) {
               return;
            }
            parentNode = node.parentNode;
            if (node.parentNode.nodeName === 'BODY') {
               return false;
            }
            $.replace(node, node.parentNode);
         });
         return this;
      },
      
      remove : function ( ) {
         if (!this.length) return [];
         this.each(function(ctx) {
            $(ctx).unbind();
            $(ctx).removeData();
            ctx.parentNode.removeChild(ctx);
         });
      },
      
      empty : function ( ) {
         if (!this.length) return [];
         var ret = [];
         this.each(function(ctx) {
            $(ctx).unbind();
            ctx.textContent = '';
            ret.push(ctx);
         });
         return returnResult(ret);
      },
      
      ready : function ( callback ) {
         if (!this.length) return [];
         $.ready(function() {
            return callback.call(callback);
         });
      }
   });
   $.extend($, {
      DOMReadyList : [],
      
      executeWhenDOMReady : function ( ) {
         var listLen = $.DOMReadyList.length;
         var i = 0;
         while (i < listLen) {
            $.DOMReadyList[i]();
            i++;
         }
         $.DOMReadyList = [];
         document.removeEventListener('DOMContentLoaded', $.executeWhenDOMReady, false);
      },
      
      ready : function ( callback ) {
          if (document.getElementsByTagName('body')[0]) {
             callback();
          } else {
          if ($.DOMReadyList.length === 0) {
            document.addEventListener('DOMContentLoaded', $.executeWhenDOMReady, false);
          }
      
          $.DOMReadyList.push(callback);
         }
      }
   });
   $.extend($, {
      camelize : function ( string ) {
         if (typeof string !== 'string') return;
         return string.replace(/\-(.)/g, function(match, letter){return letter.toUpperCase();});
      },
      
      deCamelize : function ( string ) {
         if (typeof string !== 'string') return;
         return string.replace(/([A-Z])/g, '-$1').toLowerCase();
      },
      
      capitalize : function ( string, all ) {
         if (!string) {
            return;
         }
         if (typeof string !== 'string') return;
         if (all) {
            var str = string.split(' ');
            var newstr = [];
            str.each(function(item) {
               newstr.push($.capitalize(item));
            });
            return newstr.join(' ');
         } else {
            return string.charAt(0).toUpperCase() + string.substring(1).toLowerCase();
         }
      }
   });
   $.extend($, {   
      // Convert form values into JSON object:
      form2JSON : function(rootNode, delimiter) {
         rootNode = typeof rootNode === 'string' ? $(rootNode)[0] : rootNode;
         delimiter = delimiter || '.';
         var formValues = getFormValues(rootNode);
         var result = {};
         var arrays = {};
         
         function getFormValues(rootNode) {
            var result = [];
            var currentNode = rootNode.firstChild;
            while (currentNode) {
               if (currentNode.nodeName.match(/INPUT|SELECT|TEXTAREA/i)) {
                  result.push({ name: currentNode.name, value: getFieldValue(currentNode)});
               } else {
                  var subresult = getFormValues(currentNode);
                  result = result.concat(subresult);
               }
               currentNode = currentNode.nextSibling;
            }
            return result;
         }
         function getFieldValue(fieldNode) {
            if (fieldNode.nodeName === 'INPUT') {
               if (fieldNode.type.toLowerCase() === 'radio' || fieldNode.type.toLowerCase() === 'checkbox') {
                  if (fieldNode.checked) {
                     return fieldNode.value;
                  }
               } else {
                  if (!fieldNode.type.toLowerCase().match(/button|reset|submit|image/i)) {
                     return fieldNode.value;
                  }
               }
            } else {
               if (fieldNode.nodeName === 'TEXTAREA') {
                  return fieldNode.value;
               } else {
                  if (fieldNode.nodeName === 'SELECT') {
                     return getSelectedOptionValue(fieldNode);
                  }
               }
            }
            return '';
         }
         function getSelectedOptionValue(selectNode) {
            var multiple = selectNode.multiple;
            if (!multiple) {
               return selectNode.value;
            }
            if (selectNode.selectedIndex > -1) {
               var result = [];
               $('option', selectNode).each(function(item) {
                  if (item.selected) {
                     result.push(item.value);
                  }
               });
               return result;
            }
         }    
         formValues.each(function(item) {
            var value = item.value;
            if (value !== '') {
               var name = item.name;
               var nameParts = name.split(delimiter);
               var currResult = result;
               for (var j = 0; j < nameParts.length; j++) {
                  var namePart = nameParts[j];
                  var arrName;
                  if (namePart.indexOf('[]') > -1 && j === nameParts.length - 1) {
                     arrName = namePart.substr(0, namePart.indexOf('['));
                     if (!currResult[arrName]) {
                        currResult[arrName] = [];
                     }
                     currResult[arrName].push(value);
                  } else {
                     if (namePart.indexOf('[') > -1) {
                        arrName = namePart.substr(0, namePart.indexOf('['));
                        var arrIdx = namePart.replace(/^[a-z]+\[|\]$/gi, '');
                        if (!arrays[arrName]) {
                           arrays[arrName] = {};
                        }
                        if (!currResult[arrName]) {
                           currResult[arrName] = [];
                        }
                        if (j === nameParts.length - 1) {
                           currResult[arrName].push(value);
                        } else {
                           if (!arrays[arrName][arrIdx]) {
                              currResult[arrName].push({});
                              arrays[arrName][arrIdx] = 
                              currResult[arrName][currResult[arrName].length - 1];
                           }
                        }
                        currResult = arrays[arrName][arrIdx];
                     } else {
                        if (j < nameParts.length - 1) { 
                           if (!currResult[namePart]) {
                              currResult[namePart] = {};
                           }
                           currResult = currResult[namePart];
                        } else {
                           currResult[namePart] = value;
                        }
                     }
                  }
               }
            }
         });
         return result;
      }
   });
   $.extend($, {
      /*
         options = {
            url : 'the/path/here',
            type : ('GET', 'POST', PUT, 'DELETE'),
            data : myData,
            async : 'synch' || 'asynch',
            user : username (string),
            password : password (string),
            dataType : ('html', 'json', 'text', 'script', 'xml'),
            headers : {},
            success : callbackForSuccess,
            error : callbackForError
         }
      */
      ajax : function ( options ) {
         var dataTypes = {
            script: 'text/javascript, application/javascript',
            json:   'application/json',
            xml:    'application/xml, text/xml',
            html:   'text/html',
            text:   'text/plain'
         };
         var o = options ? options : {};
         var success = null;
         var error = options.error || $.noop;
         if (!!options) {
            if (!!o.success) {
               success = o.success;
            }
         }
         var request = new XMLHttpRequest();
         var type = o.type || 'get';
         var async  = o.async || false;      
         var params = o.data || null;
         request.queryString = params;
         request.open(type, o.url, async);
         if (!!o.headers) {  
            for (var prop in o.headers) { 
               if(o.headers.hasOwnProperty(prop)) { 
                  request.setRequestHeader(prop, o.headers[prop]);
               }
            }
         }
         if (o.dataType) {
            request.setRequestHeader('Content-Type', dataTypes[o.dataType]);
         }
         request.handleResp = (success !== null) ? success : $.noop; 
         
         var handleResponse = function() {
            if(request.status === 0 && request.readyState === 4 || request.status >= 200 && request.status < 300 && request.readyState === 4 || request.status === 304 && request.readyState === 4 ) {
               if (o.dataType) {
                  if (o.dataType === 'json') {
                     request.handleResp(JSON.parse(request.responseText));
                  } else {
                     request.handleResp(request.responseText);
                  }
               } else {
                  request.handleResp(request.responseText);
               }
            } else if(request.status >= 400) {
               if (!!error) {
                  error(request);
               }
            }
         };
         if (async) {
            request.onreadystatechange = handleResponse;
         }
         request.send(params);
         if (!async) {
            handleResponse();
         }
         return this;
      },
      
      // Parameters: url, data, success, dataType.
      get : function ( url, data, success, dataType ) {
         if (!url) {
            return;
         }
         if (!data) {
            return;
         }
         if (typeof data === 'function' && !dataType) {
            if (typeof success === 'string') {
               dataType = success;
            }
            $.ajax({url : url, type: 'GET', success : data, dataType : dataType});
         } else if (typeof data === 'object' && typeof success === 'function') {
            $.ajax({url : url, type: 'GET', data : data, dataType : dataType});
         }
      },
      
      // Parameters: url, data, success.
      getJSON : function ( url, data, success ) {
         if (!url) {
             return;
         }
         if (!data) {
            return;
         }
         if (typeof data === 'function' && !success) {
            $.ajax({url : url, type: 'GET', success : data, dataType : 'json'});
         } else if (typeof data === 'object' && typeof success === 'function') {
            $.ajax({url : url, type: 'GET', data : data, dataType : 'json'});
         }
      },

      // Parameters: url, callback.
      JSONP : function ( url, callback ) {
         var fn = 'fn_' + $.uuidNum(),
         script = document.createElement('script'),
         head = $('head')[0];
         window[fn] = function(data) {
            head.removeChild(script);
            callback && callback(data);
            delete window[fn];
         };
         script.src = url.replace('callback=?', 'callback=' + fn);
         head.appendChild(script);
      },
      
      // Parameters: url, data, success, dataType.
      post : function ( url, data, success, dataType ) {
         if (!url) {
            return;
         }
         if (!data) {
            return;
         }
         if (typeof data === 'function' && !dataType) {
            if (typeof success === 'string') {
               dataType = success;
            }
            $.ajax({url : url, type: 'POST', success : data, dataType : dataType});
         } else if (typeof data === 'object' && typeof success === 'function') {
            $.ajax({url : url, type: 'POST', data : data, dataType : dataType});
         }
      }
   });

   $.extend($, {
      isiPhone : /iphone/img.test(navigator.userAgent),
      isiPad : /ipad/img.test(navigator.userAgent),
      isiPod : /ipod/img.test(navigator.userAgent),
      isiOS : /ip(hone|od|ad)/img.test(navigator.userAgent),
      isAndroid : (/android/img.test(navigator.userAgent) && !/trident/img.test(navigator.userAgent)),
      isWebOS : /webos/img.test(navigator.userAgent),
      isBlackberry : /blackberry/img.test(navigator.userAgent),
      isTouchEnabled : ('createTouch' in document),
      isOnline :  navigator.onLine,
      isStandalone : navigator.standalone,
      isiOS6 : navigator.userAgent.match(/OS 6/i),
      isiOS7 : navigator.userAgent.match(/OS 7/i),
      isWin : /trident/img.test(navigator.userAgent),
      isWinPhone : (/trident/img.test(navigator.userAgent) && /mobile/img.test(navigator.userAgent)),
      isIE10 : navigator.userAgent.match(/msie 10/i),
      isIE11 : navigator.userAgent.match(/msie 11/i),
      isWebkit : navigator.userAgent.match(/webkit/),
      isMobile : /mobile/img.test(navigator.userAgent),
      isDesktop : !(/mobile/img.test(navigator.userAgent)),
      isSafari : (!/Chrome/img.test(navigator.userAgent) && /Safari/img.test(navigator.userAgent) && !/android/img.test(navigator.userAgent)),
      isChrome : /Chrome/img.test(navigator.userAgent),
      isNativeAndroid : (/android/i.test(navigator.userAgent) && /webkit/i.test(navigator.userAgent) && !/chrome/i.test(navigator.userAgent))
   });
   $.extend($, {
      
      templates : {},
       
      template : function ( tmpl, variable ) {
         var regex, delimiterOpen, delimiterClosed;
         variable = variable ? variable : 'data';
         regex = /\[\[=([\s\S]+?)\]\]/g;
         delimiterOpen = '[[';
         delimiterClosed = ']]'; 
         var template =  new Function(variable, 
            "var p=[];" + "p.push('" + tmpl
            .replace(/[\r\t\n]/g, " ")
            .split("'").join("\\'")
            .replace(regex,"',$1,'")
            .split(delimiterOpen).join("');")
            .split(delimiterClosed).join("p.push('") + "');" +
            "return p.join('');");
         return template;
      }
   });

   $.extend($, {
      subscriptions : {},
      
      // Topic: string defining topic: /some/topic
      // Data: a string, number, array or object.
      subscribe : function (topic, callback) {
         var token = ($.uuidNum());
         if (!$.subscriptions[topic]) {
            $.subscriptions[topic] = [];
         }
         $.subscriptions[topic].push({
            token: token,
            callback: callback
         });
         return token;
      },
      
      unsubscribe : function ( token ) {
         setTimeout(function() {
            for (var m in $.subscriptions) {
               if ($.subscriptions[m]) {
                   for (var i = 0, len = $.subscriptions[m].length; i < len; i++) {
                       if ($.subscriptions[m][i].token === token) {
                           $.subscriptions[m].splice(i, 1);
                           return token;
                       }
                   }
               }
            }
            return false;
         });            
      },
      
      publish : function ( topic, args ) {
         if (!$.subscriptions[topic]) {
            return false;
         }
         setTimeout(function () {
            var len = $.subscriptions[topic] ? $.subscriptions[topic].length : 0;
            while (len--) {
                $.subscriptions[topic][len].callback(topic, args);
            }
            return true;
         });
      }
      
   });
   $.extend({
      Deferred : function (callback) {
         var status = 'pending';
         var doneCallback = [];
         var failCallback = [];
         var progressCallback = [];
         var resultArgs = null;

         var promise = {
            done: function() {
               for (var i = 0; i < arguments.length; i++) {
                  // Skip any falsy arguments:
                  if (!arguments[i]) {
                     continue;
                  }
                  if (Array.isArray(arguments[i])) {
                     var arr = arguments[i];
                     for (var j = 0; j < arr.length; j++) {
                        // Execute callback if deferred has been resolved:
                        if (status === 'resolved') {
                           arr[j].apply(this, resultArgs);
                        }
                        doneCallback.push(arr[j]);
                     }
                  } else {
                     // Execute callback if deferred has been resolved:
                     if (status === 'resolved') {
                        arguments[i].apply(this, resultArgs);
                     }
                     doneCallback.push(arguments[i]);
                  }
               }
               return this;
            },

            fail: function() {
               for (var i = 0; i < arguments.length; i++) {
                  // Skip falsy arguments:
                  if (!arguments[i]) {
                     continue;
                  }
                  if (Array.isArray(arguments[i])) {
                     var arr = arguments[i];
                     for (var j = 0; j < arr.length; j++) {
                        // Execute callback if deferred has been resolved:
                        if (status === 'rejected') {
                           arr[j].apply(this, resultArgs);
                        }
                        failCallback.push(arr[j]);
                     }
                  } else {
                     // Execute callback if deferred has been resolved:
                     if (status === 'rejected') {
                        arguments[i].apply(this, resultArgs);
                     }
                     failCallback.push(arguments[i]);
                  }
               }
               return this;
            },

            always: function() {
               return this.done.apply(this, arguments).fail.apply(this, arguments);
            },

            progress: function() {
               for (var i = 0; i < arguments.length; i++) {
                  // Skip falsy arguments:
                  if (!arguments[i]) {
                     continue;
                  }
                  if (Array.isArray(arguments[i])) {
                     var arr = arguments[i];
                     for (var j = 0; j < arr.length; j++) {
                        // Execute callback if deferred has been resolved:
                        if (status === 'pending') {
                           progressCallback.push(arr[j]);
                        }
                     }
                  } else {
                     // Execute callback if deferred has been resolved:
                     if (status === 'pending') {
                        progressCallback.push(arguments[i]);
                     }
                  }
               }
               return this;
            },

            then: function() {
               // Fail callback:
               if (arguments.length > 1 && arguments[1]) {
                  this.fail(arguments[1]);
               }
               // Done callback:
               if (arguments.length > 0 && arguments[0]) {
                  this.done(arguments[0]);
               }
               // Progress callback:
               if (arguments.length > 2 && arguments[2]) {
                  this.progress(arguments[2]);
               }
            },

            promise: function(obj) {
               if (obj === null || obj === undefined) {
                  return promise;
               } else {
                  for (var i in promise) {
                     obj[i] = promise[i];
                  }
                  return obj;
               }
            },

            state: function() {
               return status;
            },

            debug: function() {
               console.log('[debug]', doneCallback, failCallback, status);
            },

            isRejected: function() {
               return status === 'rejected';
            },

            isResolved: function() {
               return status === 'resolved';
            },

            pipe: function(done, fail) {
               // Private method to execute handlers in pipe:
               var executeHandler = function(array, handler) {
                  if ($.isArray(array)) {
                     for (var i = 0; i < array.length; i++) {
                        handler(array[i]);
                     }
                  } else {
                     handler(array);
                  }
               };
               return $.Deferred(function(def) {
                  executeHandler(done, function(func) {
                     // Filter function:
                     if (typeof func === 'function') {
                        deferred.done(function() {
                           var returnVal = func.apply(this, arguments);
                           // If a new deferred/promise is returned, 
                           // its state is passed to the current deferred/promise:
                           if (returnVal && typeof returnVal === 'function') {
                              returnVal.promise().then(def.resolve, def.reject, def.notify);
                           } else { 
                              // If new return val is passed, 
                              // it is passed to the piped done:
                              def.resolve(returnVal);
                           }
                        });
                     } else {
                        deferred.done(def.resolve);
                     }
                  });
                  executeHandler(fail, function(func) {
                     if (typeof func === 'function') {
                        deferred.fail(function() {
                           var returnVal = func.apply(this, arguments);
                           if (returnVal && typeof returnVal === 'function') {
                              returnVal.promise().then(def.resolve, def.reject, def.notify);
                           } else {
                              def.reject(returnVal);
                           }
                        });
                     } else {
                        deferred.fail(def.reject);
                     }
                  });
               }).promise();
            }
         };

         var deferred = {
            resolveWith: function(context) {
               if (status === 'pending') {
                  status = 'resolved';
                  resultArgs = (arguments.length > 1) ? arguments[1] : [];
                  for (var i = 0; i < doneCallback.length; i++) {
                     doneCallback[i].apply(context, resultArgs);
                  }
               }
               return this;
            },

            rejectWith: function(context) {
               if (status === 'pending') {
                  status = 'rejected';
                  resultArgs = (arguments.length > 1) ? arguments[1] : [];
                  for (var i = 0; i < failCallback.length; i++) {
                     failCallback[i].apply(context, resultArgs);
                  }
               }
               return this;
            },

            notifyWith: function(context) {
               if (status === 'pending') {
                  resultArgs = 2 <= arguments.length ? $.slice.call(arguments, 1) : [];
                  for (var i = 0; i < progressCallback.length; i++) {
                     progressCallback[i].apply(context, resultArgs);
                  }
               }
               return this;
            },

            resolve: function() {
               return this.resolveWith(this, arguments);
            },

            reject: function() {
               return this.rejectWith(this, arguments);
            },

            notify: function() {
               return this.notifyWith(this, arguments);
            }
         };

         var obj = promise.promise(deferred);

         if (callback) {
            callback.apply(obj, [obj]);
         }

         return obj;
      }
   });

   $.extend({
      when : function() {
         if (arguments.length < 2) {
            var obj = arguments.length ? arguments[0] : undefined;
            if (obj && (typeof obj.isResolved === 'function' && typeof obj.isRejected === 'function')) {
               return obj.promise();         
            } else {
               return $.Deferred().resolve(obj).promise();
            }
         } else {
            return (function(args) {
               var D = $.Deferred();
               var size = args.length;
               var done = 0;  
               var params = [];
               params.length = size;
                  // Resolve params: params of each resolve, 
                  // we need to track them down to be able to pass them in 
                  // the correct order if the master needs to be resolved:
               for (var i = 0; i < args.length; i++) {
                  (function(j) {
                     args[j].done(function() { params[j] = (arguments.length < 2) ? arguments[0] : arguments; if (++done === size) { D.resolve.apply(D, params); }})
                     .fail(function() { D.reject(arguments); });
                  })(i);
               }
               return D.promise();
            })(arguments);
         }
      }
   });
   window.$chocolatechip = $;
   if (typeof window.$ === 'undefined') {
      window.$ = $;
   }
})();
define("chocolatechip", (function (global) {
    return function () {
        var ret, fn;
        return ret || global.$chocolatechip;
    };
}(this)));

/*
    pO\
   6  /\
     /OO\
    /OOOO\
  /OOOOOOOO\
 ((OOOOOOOO))
  \:~=++=~:/

ChocolateChip-UI
ChUI.js
Copyright 2013 Sourcebits www.sourcebits.com
License: BSD
Version: 3.0.7
*/
(function($) {
   
   $.extend($, {
      eventStart : null,
      eventEnd : null,
      eventMove : null,
      eventCancel : null,
      // Define min-length for gesture detection:
      gestureLength : 30
   });
   if (window && window.jQuery && $ === window.jQuery) {
      $.extend($, {
         uuidNum : function ( ) {
            return Math.floor(((1 + Math.random()) * 0x100000000));
         },
         make : function ( string ) {
            return $(string);
         },

         concat : function ( args ) {
            if (args instanceof Array) {
               return args.join('');
            } else {
               args = Array.prototype.slice.apply(arguments);
               return String.prototype.concat.apply(args.join(''));
            }
         },

         subscriptions : {},

         // Topic: string defining topic: /some/topic
         // Data: a string, number, array or object.
         subscribe : function (topic, callback) {
            if (!$.subscriptions[topic]) {
               $.subscriptions[topic] = [];
            }
            var token = ($.uuidNum());
            $.subscriptions[topic].push({
               token: token,
               callback: callback
            });
            return token;
         },

         unsubscribe : function ( token ) {
            setTimeout(function() {
               for (var m in $.subscriptions) {
                  if ($.subscriptions[m]) {
                      for (var i = 0, len = $.subscriptions[m].length; i < len; i++) {
                          if ($.subscriptions[m][i].token === token) {
                              $.subscriptions[m].splice(i, 1);
                              return token;
                          }
                      }
                  }
               }
               return false;
            });
         },

         publish : function ( topic, args ) {
            if (!$.subscriptions[topic]) {
               return false;
            }
            setTimeout(function () {
               var len = $.subscriptions[topic] ? $.subscriptions[topic].length : 0;
               while (len--) {
                   $.subscriptions[topic][len].callback(topic, args);
               }
               return true;
            });
         },

         templates : {},

         template : function ( tmpl, variable ) {
            var regex, delimiterOpen, delimiterClosed;
            variable = variable ? variable : 'data';
            regex = /\[\[=([\s\S]+?)\]\]/g;
            delimiterOpen = '[[';
            delimiterClosed = ']]';
            var template =  new Function(variable,
               "var p=[];" + "p.push('" + tmpl
               .replace(/[\r\t\n]/g, " ")
               .split("'").join("\\'")
               .replace(regex,"',$1,'")
               .split(delimiterOpen).join("');")
               .split(delimiterClosed).join("p.push('") + "');" +
               "return p.join('');");
            return template;
         },
         isiPhone : /iphone/img.test(navigator.userAgent),
         isiPad : /ipad/img.test(navigator.userAgent),
         isiPod : /ipod/img.test(navigator.userAgent),
         isiOS : /ip(hone|od|ad)/img.test(navigator.userAgent),
         isAndroid : (/android/img.test(navigator.userAgent) && !/trident/img.test(navigator.userAgent)),
         isWebOS : /webos/img.test(navigator.userAgent),
         isBlackberry : /blackberry/img.test(navigator.userAgent),
         isTouchEnabled : ('createTouch' in document),
         isOnline :  navigator.onLine,
         isStandalone : navigator.standalone,
         isiOS6 : navigator.userAgent.match(/OS 6/i),
         isiOS7 : navigator.userAgent.match(/OS 7/i),
         isWin : /trident/img.test(navigator.userAgent),
         isWinPhone : (/trident/img.test(navigator.userAgent) && /mobile/img.test(navigator.userAgent)),
         isIE10 : navigator.userAgent.match(/msie 10/i),
         isIE11 : navigator.userAgent.match(/msie 11/i),
         isWebkit : navigator.userAgent.match(/webkit/),
         isMobile : /mobile/img.test(navigator.userAgent),
         isDesktop : !(/mobile/img.test(navigator.userAgent)),
         isSafari : (!/Chrome/img.test(navigator.userAgent) && /Safari/img.test(navigator.userAgent) && !/android/img.test(navigator.userAgent)),
         isChrome : /Chrome/img.test(navigator.userAgent),
         isNativeAndroid : (/android/i.test(navigator.userAgent) && /webkit/i.test(navigator.userAgent) && !/chrome/i.test(navigator.userAgent))
      });
   }
   $.extend($, {

      UuidSeed : 0,

      Uuid : function() {
         var date;
         $.UuidSeed++;
         date = Date.now() + $.UuidSeed;
         return date.toString(36);
      },

      array : Array.prototype,

      ////////////////////////////////////////////////
      // Manage location.hash for client side routing:
      ////////////////////////////////////////////////
      UITrackHashNavigation : function ( url, delimeter ) {
         url = url || true;
         $.UISetHashOnUrl($.UINavigationHistory[$.UINavigationHistory.length-1], delimeter);
      },

      /////////////////////////////////////////////////////
      // Set the hash according to where the user is going:
      /////////////////////////////////////////////////////
      UISetHashOnUrl : function ( url, delimiter ) {
         delimiter = delimiter || '#/';
         var hash;
         if (/^#/.test(url)) {
            hash = delimiter + (url.split('#')[1]);
         } else {
            hash = delimiter + url;
         }
         if ($.isAndroid) {
            if (/#/.test(url)) {
               url = url.split('#')[1];
            }
            if (/\//.test(url)) {
               url = url.split('/')[1];
            }
            window.location.hash = '#/' + url;
         } else {
            window.history.replaceState('Object', 'Title', hash);
         }
      },

      //////////////////////////////////////
      // Navigate Back to Non-linear Article
      //////////////////////////////////////
      UIGoBackToArticle : function ( articleID ) {
         var historyIndex = $.UINavigationHistory.indexOf(articleID);
         var currentArticle = $('article.current');
         var destination = $(articleID);
         var currentToolbar;
         var destinationToolbar;
         var prevArticles = $.UINavigationHistory.splice(historyIndex+1);
         $.publish('chui/navigateBack/leave', currentArticle[0].id);
         $.publish('chui/navigateBack/enter', destination[0].id);
         currentArticle[0].scrollTop = 0;
         destination[0].scrollTop = 0;
         if (prevArticles.length) {
            prevArticles.forEach(function(ctx) {
               $('#' + ctx).removeClass('previous').addClass('next');
               $('#' + ctx).prev().removeClass('previous').addClass('next');
            });
         }
         if (window && window.jQuery && $ === window.jQuery) {
            if (currentArticle.next().hasClass('toolbar')) {
               currentToolbar = currentArticle.next('toolbar');
            } else {
               currentToolbar = $();
            }
            if (destination.next().hasClass('toolbar')) {
               destinationToolbar = destination.next('toolbar');
            } else {
               destinationToolbar = $();
            }
         } else {
            currentToolbar = currentArticle.next().hasClass('toolbar');
            destinationToolbar = destination.next().hasClass('toolbar');
         }
         destination.removeClass('previous').addClass('current');
         destination.prev().removeClass('previous').addClass('current');
         destinationToolbar.removeClass('previous').addClass('current');
         currentArticle.removeClass('current').addClass('next');
         currentArticle.prev().removeClass('current').addClass('next');
         currentToolbar.removeClass('current').addClass('next');
         $('.toolbar.previous').removeClass('previous').addClass('next');
         $.UISetHashOnUrl($.UINavigationHistory[$.UINavigationHistory.length-1]);
      },

      ////////////////////////////////////
      // Navigate Back to Previous Article
      ////////////////////////////////////
      UIGoBack : function () {
         var histLen = $.UINavigationHistory.length;
         var currentArticle = $('article.current');
         var destination = $($.UINavigationHistory[histLen-2]);
         var currentToolbar;
         var destinationToolbar;
         $.publish('chui/navigateBack/leave', currentArticle[0].id);
         $.publish('chui/navigateBack/enter', destination[0].id);
         currentArticle[0].scrollTop = 0;
         destination[0].scrollTop = 0;
         if (window && window.jQuery && $ === window.jQuery) {
            if (currentArticle.next().hasClass('toolbar')) {
               currentToolbar = currentArticle.next('.toolbar');

            } else {
               currentToolbar = $();
            }
            if (destination.next().hasClass('toolbar')) {
               destinationToolbar = destination.next('.toolbar');
            } else {
               destinationToolbar = $();
            }
         } else {
            currentToolbar = currentArticle.next().hasClass('toolbar');
            destinationToolbar = destination.next().hasClass('toolbar');
         }

         destination.removeClass('previous').addClass('current');
         destination.prev().removeClass('previous').addClass('current');
         destinationToolbar.removeClass('previous').addClass('current');
         currentArticle.removeClass('current').addClass('next');
         currentArticle.prev().removeClass('current').addClass('next');
         currentToolbar.removeClass('current').addClass('next');
         $.UISetHashOnUrl($.UINavigationHistory[histLen-2]);
         if ($.UINavigationHistory[histLen-1] !== $.firstArticle[0].id) {
            $.UINavigationHistory.pop();
         }
      },

      isNavigating : false,

      ///////////////////////////////
      // Navigate to Specific Article
      ///////////////////////////////
      UIGoToArticle : function ( destination ) {
         if ($.isNavigating) return;
         $.isNavigating = true;
         var current = $('article.current');
         var currentNav = current.prev();
         destination = $(destination);
         var destinationID = '#' + destination[0].id;
         var destinationNav = destination.prev();
         var currentToolbar;
         var destinationToolbar;
         $.publish('chui/navigate/leave', current[0].id);
         $.UINavigationHistory.push(destinationID);
         $.publish('chui/navigate/enter', destination[0].id);
         current[0].scrollTop = 0;
         destination[0].scrollTop = 0;
         if (window && window.jQuery && $ === window.jQuery) {
            if (current.next().hasClass('toolbar')) {
               currentToolbar = current.next('.toolbar');
            } else {
               currentToolbar = $();
            }
            if (destination.next().hasClass('toolbar')) {
               destinationToolbar = destination.next('.toolbar');
            } else {
               destinationToolbar = $();
            }
         } else {
            currentToolbar = current.next().hasClass('toolbar');
            destinationToolbar = destination.next().hasClass('toolbar');
         }
         current.removeClass('current').addClass('previous');
         currentNav.removeClass('current').addClass('previous');
         currentToolbar.removeClass('current').addClass('previous');
         destination.removeClass('next').addClass('current');
         destinationNav.removeClass('next').addClass('current');
         destinationToolbar.removeClass('next').addClass('current');

         $.UISetHashOnUrl(destination[0].id);
         setTimeout(function() {
            $.isNavigating = false;
         }, 500);
      },

      ////////////////////////////
      // Initialize Deletable List
      ////////////////////////////
      UIDeletable : function ( options ) {
         /*
            options = {
               list: selector,
               editLabel : labelName || Edit,
               doneLabel : labelName || Done,
               deleteLabel : labelName || Delete,
               placement: left || right,
               callback : callback
            }
         */
         if (!options || !options.list || !options instanceof Array) {
            return;
         }
         var list = $(options.list);
         var editLabel = options.editLabel || 'Edit';
         var doneLabel = options.doneLabel || 'Done';
         var deleteLabel = options.deleteLabel || 'Delete';
         var placement = options.placement || 'right';
         var callback = options.callback || $.noop;
         var deleteButton;
         var editButton;
         var deletionIndicator;
         var button;
         // Windows uses an icon for the delete button:
         if ($.isWin) deleteLabel = '';
         if (list[0].classList.contains('deletable')) return;
         var height = $('li').eq(1)[0].clientHeight;
         deleteButton = $.concat('<a href="javascript:void(null)" class="button delete">', deleteLabel, '</a>');
         editButton = $.concat('<a href="javascript:void(null)" class="button edit">', editLabel, '</a>');
         deletionIndicator = '<span class="deletion-indicator"></span>';
         if (placement === 'left') {
            list.closest('article').prev().prepend(editButton);
         } else {
            list.closest('article').prev().append(editButton);
            list.closest('article').prev().find('h1').addClass('buttonOnRight');
            list.closest('article').prev().find('.edit').addClass('align-flush');
            button = list.closest('article').prev().find('.edit');
         }
         list.find('li').prepend(deletionIndicator);
         list.find('li').append(deleteButton);
         $('li').find('.delete').each(function(ctx, idx) {
            if (window && window.jQuery && $ === window.jQuery) ctx = idx;
            if ($.isiOS || $.isSafari) $(ctx).css({height: height + 'px'});
         });
         var setupDeletability = function(callback, list, button) {
            var deleteSlide;
            console.dir(button);
            if ($.isiOS) {
               deleteSlide = '100px';
            } else if ($.isAndroid) {
               deleteSlide = '140px';
            }
            $(function() {
               button.on('singletap', function() {
                  var $this = this;
                  if (this.classList.contains('edit')) {
                     list.addClass('deletable');
                     setTimeout(function() {
                        $this.classList.remove('edit');
                        $this.classList.add('done');
                        $($this).text(doneLabel);
                        $(list).addClass('showIndicators');
                     });
                  } else if (this.classList.contains('done')) {
                     list.removeClass('deletable');
                     setTimeout(function() {
                        $this.classList.remove('done');
                        $this.classList.add('edit');
                        $($this).text(editLabel);
                        $(list).removeClass('showIndicators');
                        $(list).find('li').removeClass('selected');
                     });
                  }
               });
               $(list).on('singletap', '.deletion-indicator', function() {
                  if ($(this).closest('li')[0].classList.contains('selected')) {
                     $(this).closest('li').removeClass('selected');
                     return;
                  } else {
                     $(this).closest('li').addClass('selected');
                  }
               });

               if ($.isiOS || $.isSafari) {
                  $(list).on('swiperight', 'li', function() {
                     $(this).removeClass('selected');
                  });
               }
               $(list).on('singletap', '.delete', function() {
                  var $this = this;
                  $(this).siblings().css({'-webkit-transform': 'translate3d(-1000%,0,0)', '-webkit-transition': 'all 1s ease-out'});
                  setTimeout(function() {
                     callback.call(callback, $this);
                     $($this).parent().remove();
                  }, 500);
               });
            });
         };
         return setupDeletability(callback, list, button);
         //return list;
      },

      ///////////////////////
      // Setup Paging Control
      ///////////////////////
      UIPaging : function ( ) {
         var currentArticle = $('.segmented.paging').closest('nav').next();
         if (window && window.jQuery && $ === window.jQuery) {
            if ($('.segmented.paging').hasClass('horizontal')) {
               currentArticle.addClass('horizontal');
            } else if ($('.segmented.paging').hasClass('vertical')) {
               currentArticle.addClass('vertical');
            }
         } else {
            if ($('.segmented.paging').hasClass('horizontal')[0]) {
               currentArticle.addClass('horizontal');
            } else if ($('.segmented.paging').hasClass('vertical')[0]) {
               currentArticle.addClass('vertical');
            }
         }
         currentArticle.children().eq(0).addClass('current');
         currentArticle.children().eq(0).siblings().addClass('next');
         var sections = function() {
             return currentArticle.children().length;
         }

         $('.segmented.paging').on($.eventStart, '.button:first-of-type', function() {
            if (sections() === 1) return
            var me = $(this);
            me.next().removeClass('selected');
            me.addClass('selected');
            var currentSection;
            currentSection = $('section.current');
            if (currentSection.index() === 0)  {
                currentSection.removeClass('current');
                currentArticle.children().eq(sections() - 1).addClass('current').removeClass('next');
                currentArticle.children().eq(sections() - 1).siblings().removeClass('next').addClass('previous');
            } else {
                currentSection.removeClass('current').addClass('next');
                currentSection.prev().removeClass('previous').addClass('current');
            }

            setTimeout(function() {
                me.removeClass('selected');
            }, 250);
         });
         $('.segmented.paging').on($.eventStart, '.button:last-of-type', function() {
            if (sections() === 1) return
            var me = $(this);
            me.prev().removeClass('selected');
            me.addClass('selected');
            var currentSection;
            if (this.classList.contains('disabled')) return;
            currentSection = $('section.current');
            if (currentSection.index() === sections() - 1) {
                // start again!
                currentSection.removeClass('current');
                currentArticle.children().eq(0).addClass('current').removeClass('previous');
                currentArticle.children().eq(0).siblings().removeClass('previous').addClass('next');
            } else {
                currentSection.removeClass('current').addClass('previous');
                currentSection.next().removeClass('next').addClass('current');
            }
            setTimeout(function() {
                me.removeClass('selected');
            }, 250);
         });
      },

      ////////////////////////////////////////////////
      // Create Slideout with toggle button.
      // Use $.UISlideout.populate to polate slideout.
      // See widget-factor.js for details.
      ////////////////////////////////////////////////
      UISlideout : function ( position ) {
         var slideoutButton = $.make("<a class='button slide-out-button' href='javascript:void(null)'></a>");
         var slideOut = '<div class="slide-out"><section></section></div>';
         $('article').removeClass('next');
         $('article').removeClass('current');
         $('article').prev().removeClass('next');
         $('article').prev().removeClass('current');
         position = position || 'left';
         $.body.append(slideOut);
         $.body.addClass('slide-out-app');
         $('article:first-of-type').addClass('show');
         $('article:first-of-type').prev().addClass('show');
         $('#global-nav').append(slideoutButton);
         $('.slide-out-button').on($.eventStart, function() {
            $('.slide-out').toggleClass('open');
         });
         $('.slide-out').on('singletap', 'li', function() {
            var whichArticle = '#' + $(this).attr('data-show-article');
            $.UINavigationHistory[0] = whichArticle;
            $.UISetHashOnUrl(whichArticle);
            $.publish('chui/navigate/leave', $('article.show')[0].id);
            $.publish('chui/navigate/enter', whichArticle);
            $('.slide-out').removeClass('open');
            $('article').removeClass('show');
            $('article').prev().removeClass('show');
            $(whichArticle).addClass('show');
            $(whichArticle).prev().addClass('show');
         });
      },

      ///////////////////////////////////////////
      // Pass the id of the stepper to reset.
      // It's value will be reset to the default.
      ///////////////////////////////////////////
      // Pass it the id of the stepper:
      UIResetStepper : function ( stepper ) {
         var defaultValue = $(stepper).data('ui-value').defaultValue;
         $(stepper).find('label').html(defaultValue);
         $(stepper).find('input')[0].value = defaultValue;
      }
   });
   $.fn.extend({

      ////////////////////////////
      // Initialize Switch Control
      ////////////////////////////
      UISwitch : function ( ) {
         var hasThumb = false;
         this.each(function(ctx, idx) {
            if (window && window.jQuery && $ === window.jQuery) ctx = idx;
            ctx.setAttribute('role','checkbox');
            if ($(ctx).data('ui-setup') === true) return;
            if (!ctx.querySelector('input')) {
               ctx.insertAdjacentHTML('afterBegin', '<input type="checkbox">');
            }
            if (ctx.classList.contains('on')) {
               ctx.querySelector('input').setAttribute('checked', 'checked');
            }
            if (ctx.querySelector('em')) hasThumb = true;
            if (!hasThumb) {
               ctx.insertAdjacentHTML('afterBegin', '<em></em>');
            }
            $(ctx).on('singletap', function() {
               var checkbox = ctx.querySelector('input');
               if (ctx.classList.contains('on')) {
                  ctx.classList.remove('on');
                  ctx.removeAttribute('aria-checked');
                  checkbox.removeAttribute('checked');
               } else {
                  ctx.classList.add('on');
                  checkbox.setAttribute('checked', 'checked');
                  ctx.setAttribute('aria-checked', true);
               }
            });
            $(ctx).on('swipeleft', function() {
               var checkbox = ctx.querySelector('input');
               if (ctx.classList.contains('on')) {
                  ctx.classList.remove('on');
                  ctx.removeAttribute('aria-checked');
                  checkbox.removeAttribute('checked');
               }
            });
            $(ctx).on('swiperight', function() {
               var checkbox = ctx.querySelector('input');
               if (!ctx.classList.contains('on')) {
                  ctx.classList.add('on');
                  checkbox.setAttribute('checked', 'checked');
                  ctx.setAttribute('aria-checked', true);
               }
            });
            $(ctx).data('ui-setup', true);
         });
      },

      ///////////////////////////////
      // Initialize Segmented Control
      ///////////////////////////////
      UISegmented : function ( options ) {
         if (window && window.jQuery && $ === window.jQuery) {
             if (this.hasClass('paging')) return;
         } else {
            if (this.hasClass('paging')[0]) return;
         }
         var callback = (options && options.callback) ? options.callback : $.noop;
         var selected;
         if (options && options.selected) selected = options.selected;
         if (options && options.callback) {
            callback = options.callback;
         }
         this.find('a').each(function(ctx, idx) {
            if (window && window.jQuery && $ === window.jQuery) ctx = idx;
            $(ctx).find('a').attr('role','radio');
            if (selected === 0 && idx === 0) {
               ctx.setAttribute('aria-checked', 'true');
               ctx.classList.add('selected');
            }
            if (idx === selected) {
               ctx.setAttribute('aria-checked', 'true');
               ctx.classList.add('selected');
            }
         });
         if (!selected) {
            if (!this.find('.selected')[0]) {
               this.children().eq(0).addClass('selected');
            }
         }
         this.on('singletap', '.button', function(e) {
            var $this = $(this);
            if (this.parentNode.classList.contains('paging')) return;
            $this.siblings('a').removeClass('selected');
            $this.siblings('a').removeAttr('aria-checked');
            $this.addClass('selected');
            $this.attr('aria-checked', true);
            callback.call(this, e);
         });
      },

      ////////////////////////////////////////////
      // Allow Segmented Control to toggle panels
      ////////////////////////////////////////////
      UIPanelToggle : function ( panel, callback ) {
         var panels;
         var selected = 0;
         if (window && window.jQuery && $ === window.jQuery) {
            if ($(this).children().hasClass('selected')) {
               this.children().each(function(idx, ctx) {
                  if ($(ctx).hasClass('selected')) {
                     selected = idx;
                  }
               });
            }
         } else {
            if (this.children().hasClass('selected')[0]) {
               selected = this.children().hasClass('selected').index();
            }
         }

         if (panel instanceof Array) {
            panels = panel.children('div');
         } else if (typeof panel === 'string') {
            panels = $(panel).children('div');
         }
         panels.eq(selected).siblings().css({display: 'none'});
         if (callback) callback.apply(this, arguments);
         this.on($.eventEnd, 'a', function() {
            panels.eq($(this).index()).css({display:'block'})
               .siblings().css('display','none');
         });

         this.on('singletap', '.button', function() {
            var $this = $(this);
            if (this.parentNode.classList.contains('paging')) return;
            $this.siblings('a').removeClass('selected');
            $this.siblings('a').removeAttr('aria-checked');
            $this.addClass('selected');
            $this.attr('aria-checked', true);
         });
      },

      /////////////////////////
      // Initialize Select List
      /////////////////////////
      /*
      // For default selection use zero-based integer:
      options = {
         name : name // used on radio buttons as group name, defaults to uuid.
         selected : integer,
         callback : callback
         // callback example:
         function () {
            // this is the selected list item:
            console.log($(this).text());
         }
      }
      */
      UISelectList : function (options) {
         var name = (options && options.name) ? options.name : $.Uuid();
         var list = this[0];
         if (window && window.jQuery && $ === window.jQuery) {
            if (list && !$(list).hasClass('select')) {
               this.addClass('select');
            }
         } else {
            if (list && !$(list).hasClass('select')[0]) {
               this.addClass('select');
            }
         }
         if (!list) return [];
         list.classList.add('select');
         $(list).find('li').each(function(ctx, idx) {
            var temp;
            if (window && window.jQuery && $ === window.jQuery) {
               temp = ctx;
               ctx = idx;
               idx = temp;
            }
            ctx.setAttribute('role', 'radio');
            if (options && options.selected === idx) {
               ctx.setAttribute('aria-checked', 'true');
               ctx.classList.add('selected');
               if (!$(ctx).find('input')[0]) {
                  $(ctx).append('<input type="radio" checked="checked" name="' + name + '">');
               } else {
                  $(ctx).find('input').attr('checked','checked');
               }
            } else {
               if (!$(ctx).find('input')[0]) {
                  $(ctx).append('<input type="radio" name="' + name + '">');
               }
            }
         });
         $(list).on('singletap', 'li', function() {
            var item = this;
            $(item).siblings('li').removeClass('selected');
            $(item).siblings('li').removeAttr('aria-checked');
            $(item).siblings('li').find('input').removeAttr('checked');
            $(item).addClass('selected');
            item.setAttribute('aria-checked', true);
            $(item).find('input').attr('checked','checked');
            if (options && options.callback) {
               options.callback.apply(this, arguments);
            }
         });
      },

      /////////////////
      // Create stepper
      /////////////////
      /*
         var options = {
            start: 0,
            end: 10,
            defaultValue: 3
         }
      */
      UIStepper : function (options) {
         if (!options) return [];
         if (!options.start) return [];
         if (!options.end) return [];
         var stepper = this[0];
         var start = options.start;
         var end = options.end;
         var defaultValue = options.defaultValue ? options.defaultValue : options.start;
         var increaseSymbol = '+';
         var decreaseSymbol = '-';
         if ($.isWin) {
             increaseSymbol = '';
             decreaseSymbol = '';
         }
         var decreaseButton = '<a href="javascript:void(null)" class="button decrease">' + decreaseSymbol + '</a>';
         var label = '<label>' + defaultValue + '</label><input type="text" value="' + defaultValue + '">';
         var increaseButton = '<a href="javascript:void(null)" class="button increase">' + increaseSymbol + '</a>';
         $(stepper).append(decreaseButton + label + increaseButton);
         $(stepper).data('ui-value', {start: start, end: end, defaultValue: defaultValue});

         var decreaseStepperValue = function() {
            var currentValue = $(stepper).find('input').val();
            var value = $(stepper).data('ui-value');
            var start = value.start;
            var newValue;
            if (currentValue <= start) {
               $(this).addClass('disabled');
            } else {
               newValue = Number(currentValue) - 1;
               $(stepper).find('.button:last-of-type').removeClass('disabled');
               $(stepper).find('label').text(newValue);
               $(stepper).find('input')[0].value = newValue;
               if (currentValue === start) {
                  $(this).addClass('disabled');
               }
            }
         };

         var increaseStepperValue = function() {
            var currentValue = $(stepper).find('input').val();
            var value = $(stepper).data('ui-value');
            var end = value.end;
            var newValue;
            if (currentValue >= end) {
               $(this).addClass('disabled');
            } else {
               newValue = Number(currentValue) + 1;
               $(stepper).find('.button:first-of-type').removeClass('disabled');
               $(stepper).find('label').text(newValue);
               $(stepper).find('input')[0].value = newValue;
               if (currentValue === end) {
                  $(this).addClass('disabled');
               }
            }
         };
         var $stepper = (window && window.jQuery && $ === jQuery) ? $(stepper) : [stepper];
         $stepper.find('.button:first-of-type').on('singletap', function() {
            decreaseStepperValue.call(this, stepper);
         });
         $stepper.find('.button:last-of-type').on('singletap', function() {
            increaseStepperValue.call(this, stepper);
         });
      },

      ////////////////////////
      // Create Busy indicator
      ////////////////////////
      /*
         var options = {
            color: 'red',
            size: '80px',
            position: 'right'
         }
      */
      UIBusy : function ( options ) {
         options = options || {};
         var $this = this;
         var color = options.color || '#000';
         var size = options.size || '80px';
         var position = (options && options.position === 'right') ? 'align-flush' : null;
         var duration = options.duration || '2s';
         var spinner;
         // For iOS:
         var iOSBusy = function() {
            var webkitAnim = {'-webkit-animation-duration': duration};
            spinner = $.make('<span class="busy"></span>');
            $(spinner).css({'background-color': color, 'height': size, 'width': size});
            $(spinner).css(webkitAnim);
            $(spinner).attr('role','progressbar');
            if (position) $(spinner).addClass(position);
            $this.append(spinner);
            return this;
         };
         // For Android:
         var androidBusy = function() {
            var webkitAnim = {'-webkit-animation-duration': duration};
            spinner = $.make('<div class="busy"><div></div><div></div></div>');
            $(spinner).css({'height': size, 'width': size, "background-image":  'url(' + '"data:image/svg+xml;utf8,<svg xmlns:svg=' + "'http://www.w3.org/2000/svg' xmlns='http://www.w3.org/2000/svg' version='1.1' x='0px' y='0px' width='400px' height='400px' viewBox='0 0 400 400' enable-background='new 0 0 400 400' xml:space='preserve'><circle fill='none' stroke='" + color + "' stroke-width='20' stroke-miterlimit='10' cx='199' cy='199' r='174'/>" + '</svg>"' + ')'});
            $(spinner).css(webkitAnim);
            $(spinner).attr('role','progressbar');
            $(spinner).innerHTML = "<div></div><div></div>";
            if (position) $(spinner).addClass('align-' + position);
            $this.append(spinner);
            return this;
         };
         // For Windows 8/WP8:
         var winBusy = function() {
            spinner = $.make('<progress class="busy"></progress>');
            $(spinner).css({ 'color': color });
            $(spinner).attr('role','progressbar');
            $(spinner).addClass('win-ring');
            if (position) $(spinner).addClass('align-' + position);
            $this.append(spinner);
            return this;
         };
         // Create Busy control for appropriate OS:
         if ($.isWin) {
            winBusy(options);
         } else if ($.isAndroid || $.isChrome) {
            androidBusy(options);
         } else if ($.isiOS || $.isSafari) {
            iOSBusy(options);
         }
      },

      //////////////////////////////
      // Center an Element on Screen
      //////////////////////////////
      UICenter : function ( ) {
         if (!this[0]) return;
         var $this = $(this);
         var parent = $this.parent();
         var position;
         if ($this.css('position') !== 'absolute') position = 'relative';
         else position = 'absolute';

         var height, width, parentHeight, parentWidth;
         if (position === 'absolute') {
            height = $this[0].clientHeight;
            width = $this[0].clientWidth;
            parentHeight = parent[0].clientHeight;
            parentWidth = parent[0].clientWidth;
         } else {
            height = parseInt($this.css('height'),10);
            width = parseInt($this.css('width'),10);
            parentHeight = parseInt(parent.css('height'),10);
            parentWidth = parseInt(parent.css('width'),10);
         }
         var tmpTop, tmpLeft;
         if (parent[0].nodeName === 'body') {
            tmpTop = ((window.innerHeight /2) + window.pageYOffset) - height /2 + 'px';
            tmpLeft = ((window.innerWidth / 2) - (width / 2) + 'px');
         } else {
            tmpTop = (parentHeight /2) - (height /2) + 'px';
            tmpLeft = (parentWidth / 2) - (width / 2) + 'px';
         }
         if (position !== 'absolute') tmpLeft = 0;
        // if (parseInt(tmpLeft,10) <= 0) tmpLeft = '10px';
         $this.css({left: tmpLeft, top: tmpTop});
      },

      /////////////////////////
      // Block Screen with Mask
      /////////////////////////
      UIBlock : function ( opacity ) {
         opacity = opacity ? " style='opacity:" + opacity + "'" : " style='opacity: .5;'";
         $(this).before("<div class='mask'" + opacity + "></div>");
         $('article.current').attr('aria-hidden',true);
         return this;
      },

      //////////////////////////
      // Remove Mask from Screen
      //////////////////////////
      UIUnblock : function ( ) {
         $('.mask').remove();
         $('article.current').removeAttr('aria-hidden');
         return this;
      },

      //////////////
      // Close Popup
      //////////////
      UIPopupClose : function ( ) {
         if (!this[0].classList.contains('popup')) return;
         $(this).UIUnblock();
         $(this).remove();
      },

      /////////////////
      // Create Popover
      /////////////////
      /*
         id: myUniqueID,
         title: 'Great',
         callback: myCallback
      */
      UIPopover : function ( options ) {
         if (!options) return [];
         var triggerEl = $(this);
         var triggerID;
         if (this[0].id) {
            triggerID = this[0].id;
         } else {
            triggerID = $.Uuid();
            triggerEl.attr('id', triggerID);
         }
         var id = options.id ? options.id : $.Uuid();
         var header = options.title ? ('<header><h1>' + options.title + '</h1></header>') : '';
         var callback = options.callback ? options.callback : $.noop;
         var popover = '<div class="popover" id="' + id + '">' + header + '<section></section></div>';

         // Calculate position of popover relative to the button that opened it:
         var _calcPopPos = function (element) {
            var offset = $(element).offset();
            var left = offset.left;
            var calcLeft;
            var calcTop;
            var popover = $('.popover');
            var popoverOffset = popover.offset();
            calcLeft = popoverOffset.left;
            calcTop = offset.top + $(element)[0].clientHeight;
            if ((popover.width() + offset.left) > window.innerWidth) {
               popover.css({
                  'left': ((window.innerWidth - popover.width())-20) + 'px',
                  'top': (calcTop + 20) + 'px'
               });
            } else {
               popover.css({'left': left + 'px', 'top': (calcTop + 20) + 'px'});
            }
         };

         $(this).on($.eventStart, function() {
            var $this = this;
            $(this).addClass('selected');
            setTimeout(function() {
               $($this).removeClass('selected');
            }, 1000);
            $.body.append(popover);
            $('.popover').UIBlock('.5');
            var event = 'singletap';
            if ($.isWin && $.isDesktop) {
               event = $.eventStart + ' singletap ' + $.eventEnd;
            }
            $('.mask').on(event, function(e) {
               e.preventDefault();
               e.stopPropagation();
            });
            $('.popover').data('triggerEl', triggerID);
            if ($.isWin) {
               _calcPopPos($this);
               $('.popover').addClass('open');
            } else {
               $('.popover').addClass('open');
               setTimeout(function () {
                   _calcPopPos($this);
               });
            }
            callback.call(callback, $this);
         });
      }

   });
   $.extend($, {
      ////////////////////////
      // Create Switch Control
      ////////////////////////
      UICreateSwitch : function ( options ) {
         /* options = {
               id : '#myId',
               name: 'fruit.mango'
               state : 'on' || 'off' //(off is default),
               value : 'Mango' || '',
               callback : callback
            }
         */
         var id = options ? options.id : $.Uuid();
         var name = options && options.name ? (' name="' + options.name + '"') : '';
         var value= options && options.value ? (' value="' + options.value + '"') : '';
         var state = (options && options.state === 'on') ? (' ' + options.state) : '';
         var checked = (options && options.state === 'on') ? ' checked="checked"' : '';
         var _switch = $.concat('<span class="switch', state,
            '" id="', id, '"><em></em>','<input type="checkbox"',
            name, checked, value, '></span>');
         return $.make(_switch);
      },

      ///////////////////////////
      // Create Segmented Control
      ///////////////////////////
      UICreateSegmented : function ( options ) {
         /*
            options = {
               id : '#myId',
               className : 'special' || '',
               labels : ['first','second','third'],
               selected : 0 based number of selected button
            }
         */
         var className = (options && options.className) ? options.className : '';
         var labels = (options && options.labels) ? options.labels : [];
         var selected = (options && options.selected) ? options.selected : 0;
         var _segmented = ['<div class="segmented'];
         if (className) _segmented.push(' ' + className);
         _segmented.push('">');
         labels.forEach(function(ctx, idx) {
            _segmented.push('<a role="radio" class="button');
            if (selected === idx) {
               _segmented.push(' selected" aria-checked="true"');
            } else {
               _segmented.push('"');
            }
            _segmented.push('>');
            _segmented.push(ctx);
            _segmented.push('</a>');
         });
         _segmented.push('</div>');
         return _segmented.join('');
      },

      ///////////////
      // Create Popup
      ///////////////
      UIPopup : function( options ) {
         /*
         options {
            id: 'alertID',
            title: 'Alert',
            message: 'This is a message from me to you.',
            cancelButton: 'Cancel',
            continueButton: 'Go Ahead',
            callback: function() { // do nothing }
         }
         */
         if (!options) return;
         var id = options.id || $.Uuid();
         var title = options.title ? '<header><h1>' + options.title + '</h1></header>' : '';
         var message = options.message ? '<p role="note">' + options.message + '</p>' : '';
         var cancelButton = options.cancelButton ? '<a href="javascript:void(null)" class="button cancel" role="button">' + options.cancelButton + '</a>' : '';
         var continueButton = options.continueButton  ? '<a href="javascript:void(null)" class="button continue" role="button">' + options.continueButton + '</a>' : '';
         var callback = options.callback || $.noop;
         var padding = options.empty ? ' style="padding: 40px 0;" ' : '';
         var panelOpen, panelClose;
         if (options.empty) {
            panelOpen = '';
            panelClose = '';
         } else {
            panelOpen = '<div class="panel">';
            panelClose = '</div>';
         }
         var popup = '<div class="popup closed" role="alertdialog" id="' + id + '"' + padding + '>' + panelOpen + title + message + '<footer>' + cancelButton + continueButton + '</footer>' + panelClose + '</div>';

         $.body.append(popup);
         if (callback && continueButton) {
            $('.popup').find('.continue').on($.eventStart, function() {
               $('.popup').UIPopupClose();
               callback.call(callback);
            });
         }

         $.UICenterPopup();
         setTimeout(function() {
            $.body.find('.popup').removeClass('closed');
         }, 200);
         $.body.find('.popup').UIBlock('0.5');
         var events = $.eventStart + ' singletap ' + $.eventEnd;
         $('.mask').on(events, function(e) {
            e.stopPropagation();
         });
      },

      //////////////////////////////////////////
      // Center Popups When Orientation Changes:
      //////////////////////////////////////////
      UICenterPopup : function ( ) {
         var popup = $('.popup');
         if (!popup[0]) return;
         var tmpTop = ((window.innerHeight /2) + window.pageYOffset) - (popup[0].clientHeight /2) + 'px';
         var tmpLeft;
         if (window.innerWidth === 320) {
            tmpLeft = '10px';
         } else {
            tmpLeft = Math.floor((window.innerWidth - 318) /2) + 'px';
         }
         if ($.isWin) {
            popup.css({top: tmpTop});
         } else {
              popup.css({left: tmpLeft, top: tmpTop});
           }
      },

      ///////////////////////////////////////
      // Align the Popover Before Showing it:
      ///////////////////////////////////////
      UIAlignPopover : function () {
         var popover = $('.popover');
         if (!popover.length) return;
         var triggerID = popover.data('triggerEl');
         var offset = $('#'+triggerID).offset();
         var left = offset.left;
         if (($(popover).width() + offset.left) > window.innerWidth) {
            popover.css({
               'left': ((window.innerWidth - $(popover).width())-20) + 'px'
            });
         } else {
            popover.css({'left': left + 'px'});
         }
      },

      UIPopoverClose : function ( ) {
         $.body.UIUnblock();
         $('.popover').css('visibility','hidden');
         setTimeout(function() {
            $('.popover').remove();
         },10);
      },

      ///////////////////////////////////////////
      // Creates a Tab Bar for Toggling Articles:
      ///////////////////////////////////////////
      UITabbar : function ( options ) {
         /*
         var options = {
            id: 'mySpecialTabbar',
            tabs: 4,
            labels: ["Refresh", "Add", "Info", "Downloads", "Favorite"],
            icons: ["refresh", "add", "info", "downloads", "favorite"],
            selected: 2
         }
         */
         if (!options) return;
         $.body.addClass('hasTabBar');
         if ($.isiOS6) $.body.addClass('isiOS6');
         var id = options.id || $.Uuid();
         var selected = options.selected || '';
         var tabbar = '<div class="tabbar" id="' + id + '">';
         var icon = ($.isiOS || $.isSafari) ? '<span class="icon"></span>' : '';
         for (var i = 0; i < options.tabs; i++) {
            tabbar += '<a class="button ' + options.icons[i];
            if (selected === i+1) {
               tabbar += ' selected';
            }
            tabbar += '">' + icon + '<label>' + options.labels[i] + '</label></a>';
         }
         tabbar += '</div>';
         $.body.append(tabbar);
         $('nav').removeClass('current').addClass('next');
         $('nav').eq(selected).removeClass('next').addClass('current');
         $('article').removeClass('current').addClass('next');
         $('article').eq(selected-1).removeClass('next').addClass('current');
         $.body.find('.tabbar').on('singletap', '.button', function() {
            var $this = this;
            var index;
            var id;
            $.publish('chui/navigate/leave', $('article.current')[0].id);
            $this.classList.add('selected');
            $(this).siblings('a').removeClass('selected');
            index = $(this).index();
            $('.previous').removeClass('previous').addClass('next');
            $('.current').removeClass('current').addClass('next');
            id = $('article').eq(index)[0].id;
            $.publish('chui/navigate/enter', id);
            if (window && window.jQuery) {
               $('article').each(function(idx, ctx) {
                  $(ctx).scrollTop(0);
               });
            } else {
               $('article').eq(index).siblings('article').forEach(function(ctx) {
                  ctx.scrollTop = 0;
               });
            }

            $.UISetHashOnUrl('#'+id);
            if ($.UINavigationHistory[0] === ('#' + id)) {
               $.UINavigationHistory = [$.UINavigationHistory[0]];
            } else if ($.UINavigationHistory.length === 1) {
               if ($.UINavigationHistory[0] !== ('#' + id)) {
                  $.UINavigationHistory.push('#'+id);
               }
            } else if($.UINavigationHistory.length === 3) {
               $.UINavigationHistory.pop();
            } else {
               $.UINavigationHistory[1] = '#'+id;
            }
            $('article').eq(index).removeClass('next').addClass('current');
            $('nav').eq(index+1).removeClass('next').addClass('current');
         });
      },

      ///////////////////////////////////////////////
      // UISheet: Create an Overlay for Buttons, etc.
      ///////////////////////////////////////////////
      /*
         var options {
            id : 'starTrek',
            listClass :'enterprise',
            background: 'transparent',
         }
      */
      UISheet : function ( options ) {
         var id = $.Uuid();
         var listClass = '';
         var background = '';
         if (options) {
            id = options.id ? options.id : id;
            listClass = options.listClass ? ' ' + options.listClass : '';
            background = ' style="background-color:' + options.background + ';" ' || '';
         }
         var sheet = '<div id="' + id + '" class="sheet' + listClass + '"><div class="handle"></div><section class="scroller-vertical"></section></div>';
         $.body.append(sheet);
         $('.sheet .handle').on($.eventStart, function() {
            $.UIHideSheet();
         });
      },

      UIShowSheet : function ( ) {
         $('article.current').addClass('blurred');
         if ($.isAndroid || $.isChrome) {
            $('.sheet').css('display','block');
           setTimeout(function() {
               $('.sheet').addClass('opened');
            }, 20);
         } else {
            $('.sheet').addClass('opened');
         }
      },

      UIHideSheet : function ( ) {
         $('.sheet').removeClass('opened');
         $('article.current').addClass('removeBlurSlow');
         setTimeout(function() {
            $('article').removeClass('blurred');
            $('article').removeClass('removeBlurSlow');
         },500);
      },

      UIDesktopCompat : function ( ) {
         if ($.isDesktop && $.isSafari) {
            $.body.addClass('isiOS').addClass('isDesktopSafari');
         } else if ($.isDesktop && $.isChrome) {
            $.body.addClass('isAndroid').addClass('isDesktopChrome');
         }
      }

   });

   /////////////////////////////////////////////////////////////////
   // Method to populate a slideout with actionable items.
   // The argument is an array of objects consisting of a key/value.
   // The key will be the id of the article to be shown.
   // The value is the title for the list item.
   // [{music:'Music'},{docs:'Documents'},{recipes:'Recipes'}]
   /////////////////////////////////////////////////////////////////
   $.extend($.UISlideout, {
      populate: function( args ) {
         var slideout = $('.slide-out');
         if (!slideout[0]) return;
         if (!$.isArray(args)) {
            return;
         } else {
            slideout.find('section').append('<ul class="list"></ul>');
            var list = slideout.find('ul');
            args.forEach(function(ctx) {
               for (var key in ctx) {
                  if (key === 'header') {
                     list.append('<li class="slideout-header"><h2>'+ctx[key]+'</h2></li>');
                  } else {
                     list.append('<li data-show-article="' + key + '"><h3>' + ctx[key] + '</h3></li>');
                  }
               }
            });
         }
      }
   });
   //////////////////////////
   // Setup Event Variables:
   //////////////////////////
   $(function() {
      // Pointer events for IE10 and WP8:
      if (window.navigator.msPointerEnabled) {
         $.eventStart = 'MSPointerDown';
         $.eventEnd = 'MSPointerUp';
         $.eventMove = 'MSPointerMove';
         $.eventCancel = 'MSPointerCancel';
      // Pointer events for IE11 and WP8:
      } else if (window.navigator.pointerEnabled) {
         $.eventStart = 'pointerdown';
         $.eventEnd = 'pointerup';
         $.eventMove = 'pointermove';
         $.eventCancel = 'pointercancel';
      // Touch events for iOS & Android:
      } else if ('ontouchstart' in window) {
         $.eventStart = 'touchstart';
         $.eventEnd = 'touchend';
         $.eventMove = 'touchmove';
         $.eventCancel = 'touchcancel';
      // Mouse events for desktop:
      } else {
         $.eventStart = 'mousedown';
         $.eventEnd = 'click';
         $.eventMove = 'mousemove';
         $.eventCancel = 'mouseout';
      }

      $.body = $('body');

      $.firstArticle = $('article').eq(0);

      if ((/android/img.test(navigator.userAgent)) && (/webkit/img.test(navigator.userAgent) ) && (!/Chrome/img.test(navigator.userAgent))) {
         document.body.classList.add('isNativeAndroidBrowser');
      }

      /////////////////////////////////////////////////////////
      // Stop rubber banding when dragging down on nav:
      /////////////////////////////////////////////////////////
      $('nav').on($.eventStart, function(e) {
         e.preventDefault();
      });

      //////////////////////////////////////////
      // Set first value for navigation history:
      //////////////////////////////////////////
      $.extend($, {
         UINavigationHistory : ["#" + $('article').eq(0).attr('id')]
      });

      ///////////////////////////////////////////////////////////
      // Make sure that navs and articles have navigation states:
      ///////////////////////////////////////////////////////////
      $('nav').each(function(ctx, idx) {
         var temp;
         if (window && window.jQuery && $ === window.jQuery) {
            temp = ctx;
            ctx = idx;
            idx = temp;
         }
         // Prevent if splitlayout for tablets:
         if ($.body[0].classList.contains('splitlayout')) return;
         if (idx === 0) {
            ctx.classList.add('current');
         } else {
            ctx.classList.add('next');
         }
      });
      $('article').each(function(ctx, idx) {
         var temp;
         if (window && window.jQuery && $ === window.jQuery) {
            temp = ctx;
            ctx = idx;
            idx = temp;
         }
         // Prevent if splitlayout for tablets:
         if ($.body[0].classList.contains('splitlayout')) return;
         if ($.body[0].classList.contains('slide-out-app')) return;
         if (idx === 0) {
            ctx.classList.add('current');
         } else {
            ctx.classList.add('next');
         }
      });

      //////////////////////
      // Add the global nav:
      //////////////////////

      if (!$.body[0].classList.contains('splitlayout')) {
         $.body.prepend("<nav id='global-nav'></nav>");
      }

      ///////////////////////////
      // Initialize Back Buttons:
      ///////////////////////////
      $.body.on('singletap', 'a.back', function() {
         if (this.classList.contains('back')) {
            $.UIGoBack();
         }
      });
      $.body.on('singletap', '.button', function() {
         var $this = $(this);
         if ($this.parent()[0].classList.contains('tabbar')) return;
         $this.addClass('selected');
         setTimeout(function() {
            $this.removeClass('selected');
         }, 500);
         if (this.classList.contains('show-popover')) {
            $this.addClass('selected');
            setTimeout(function() {
               $this.removeClass('selected');
            },500);
         }
      });

      ////////////////////////////////
      // Handle navigation list items:
      ////////////////////////////////
      $.body.on('singletap doubletap', 'li', function() {
         if ($.isNavigating) return;
         if (!this.hasAttribute('data-goto')) return;
         if (!this.getAttribute('data-goto')) return;
         if (!document.getElementById(this.getAttribute('data-goto'))) return;
         if ($(this).parent()[0].classList.contains('deletable')) return;
         var destinationHref = '#' + this.getAttribute('data-goto');
         $(destinationHref).addClass('navigable');
         var destination = $(destinationHref);
         $.UIGoToArticle(destination);
      });
      $('li[data-goto]').each(function(ctx, idx) {
         if (window && window.jQuery && $ === window.jQuery) ctx = idx;
         $(ctx).closest('article').addClass('navigable');
         var navigable =  '#' + ctx.getAttribute('data-goto');
         $(navigable).addClass('navigable');
      });

      /////////////////////////////////////
      // Init navigation url hash tracking:
      /////////////////////////////////////
      // If there's more than one article:
      if ($('article').eq(1)[0]) {
         $.UISetHashOnUrl($('article').eq(0)[0].id);
      }

      /////////////////////////////////////
      // Handle Existing Segmented Buttons:
      /////////////////////////////////////
      $('.segmented').UISegmented();

      //////////////////////////
      // Handle Existing Switches:
      //////////////////////////
      $('.switch').UISwitch();

      //////////////////////////
      // Handle Closing Popups:
      //////////////////////////
      $.body.on($.eventStart, '.cancel', function() {
         if ($(this).closest('.popup')[0]) {
            $(this).closest('.popup').UIPopupClose();
         }
      });

      /////////////////////////////////////////////////
      // Reposition popups & popovers on window resize:
      /////////////////////////////////////////////////
      window.onresize = function() {
         $.UICenterPopup();
         $.UIAlignPopover();
      };
      var events = $.eventStart + ' singletap ' + $.eventEnd;
      $.body.on(events, '.mask', function(e) {
         if (!$('.popover')[0]) {
            if (e && e.nodeType === 1) return;
            e.stopPropogation();
         } else {
            $.UIPopoverClose();
         }
      });

      /////////////////////////////////////////////////
      // Fix Split Layout to display properly on phone:
      /////////////////////////////////////////////////
      if ($.body[0].classList.contains('splitlayout')) {
         if (window.innerWidth < 768) {
            $('meta[name=viewport]').attr('content','width=device-width, initial-scale=0.45, maximum-scale=2, user-scalable=yes');
         }
      }

      /////////////////////////////////////////////////////////
      // Add class to nav when button on right.
      // This allows us to adjust the nav h1 for small screens.
      /////////////////////////////////////////////////////////
      $('h1').each(function(ctx, idx) {
         if (window && window.jQuery && $ === window.jQuery) ctx = idx;
         if (ctx.nextElementSibling && ctx.nextElementSibling.nodeName === 'A') {
            ctx.classList.add('buttonOnRight');
         }
      });

      //////////////////////////////////////////
      // Get any toolbars and adjust the bottom
      // of their corresponding articles:
      //////////////////////////////////////////
      $('.toolbar').prev().addClass('has-toolbar');

      ////////////////////////////////
      // Added classes for client side
      // os-specific styles:
      ////////////////////////////////
      $.extend({
         browserVersion : function ( ) {
            var n = navigator.appName;
            var ua = navigator.userAgent;
            var temp;
            var m = ua.match(/(opera|chrome|safari|firefox|msie)\/?\s*(\.?\d+(\.\d+)*)/i);
            if (m && (temp = ua.match(/version\/([\.\d]+)/i))!== null) m[2]= temp[1];
            m = m ? [m[1], m[2]]: [n, navigator.appVersion, '-?'];
            return m[1];
         }
       });

      if ($.isWin) {
         $.body.addClass('isWindows');
      } else if ($.isiOS) {
         $.body.addClass('isiOS');
      } else if ($.isAndroid) {
         $.body.addClass('isAndroid');
      }
      if ($.isSafari && parseInt($.browserVersion(), 10) === 6) {
         $.body.addClass('isSafari6');
      }
      $.UIDesktopCompat();
   });
})(this.$);
//////////////////////////////////////////////////////
// Swipe Gestures for ChocolateChip.
// Includes mouse gestures for desktop compatibility.
//////////////////////////////////////////////////////

(function($){
   

   var touch = {};
   var touchTimeout;
   var swipeTimeout;
   var tapTimeout;
   var longTapDelay = 750;
   var singleTapDelay = 150;
   var longTapTimeout;

   function parentIfText(node) {
      return 'tagName' in node ? node : node.parentNode;
   }

   function swipeDirection(x1, x2, y1, y2) {
      return Math.abs(x1 - x2) >=
      Math.abs(y1 - y2) ? (x1 - x2 > 0 ? 'left' : 'right') : (y1 - y2 > 0 ? 'up' : 'down');
   }

   function longTap() {
      longTapTimeout = null;
      if (touch.last) {
         try {
            if (touch && touch.el) {
               touch.el.trigger('longtap');
               touch = {};
            }
         } catch(err) { }
      }
   }

   function cancelLongTap() {
      if (longTapTimeout) clearTimeout(longTapTimeout);
      longTapTimeout = null;
   }

   function cancelAll() {
      if (touchTimeout) clearTimeout(touchTimeout);
      if (tapTimeout) clearTimeout(tapTimeout);
      if (swipeTimeout) clearTimeout(swipeTimeout);
      if (longTapTimeout) clearTimeout(longTapTimeout);
      touchTimeout = tapTimeout = swipeTimeout = longTapTimeout = null;
      touch = {};
   }

   $(function(){
      var now;
      var delta;
      var body = $(document.body);
      var twoTouches = false;
      body.on($.eventStart, function(e) {
         now = Date.now();
         delta = now - (touch.last || now);
         if (e.originalEvent) e = e.originalEvent;

         // Handle MSPointer Events:
         if (window.navigator.msPointerEnabled  || window.navigator.pointerEnabled) {
            if (window && window.jQuery && $ === window.jQuery) {
               if (e.originalEvent && !e.originalEvent.isPrimary) return;
            } else {
               if (!e.isPrimary) return;
            }
            e = e.originalEvent ? e.originalEvent : e;
            body.on('MSHoldVisual', function (e) {
               e.preventDefault();
            });
            touch.el = $(parentIfText(e.target));
            touchTimeout && clearTimeout(touchTimeout);
            touch.x1 = e.pageX;
            touch.y1 = e.pageY;
            twoTouches = false;
         } else {
            if ($.eventStart === 'mousedown') {
               touch.el = $(parentIfText(e.target));
               touchTimeout && clearTimeout(touchTimeout);
               touch.x1 = e.pageX;
               touch.y1 = e.pageY;
               twoTouches = false;
            } else {
               // User to detect two or more finger gestures:
               if (e.touches.length === 1) {
                  touch.el = $(parentIfText(e.touches[0].target));
                  touchTimeout && clearTimeout(touchTimeout);
                  touch.x1 = e.touches[0].pageX;
                  touch.y1 = e.touches[0].pageY;
                  if (e.targetTouches.length === 2) {
                     twoTouches = true;
                  } else {
                     twoTouches = false;
                  }
               }
            }
         }
         if (delta > 0 && delta <= 250) {
            touch.isDoubleTap = true;
         }
         touch.last = now;
         longTapTimeout = setTimeout(longTap, longTapDelay);
      });
      body.on($.eventMove, function(e) {
         if (e.originalEvent) e = e.originalEvent;
         if (window.navigator.msPointerEnabled) {
            if (window && window.jQuery && $ === window.jQuery) {
               if (e.originalEvent && !e.originalEvent.isPrimary) return;
            } else {
               if (!e.isPrimary) return;
            }
            e = e.originalEvent ? e.originalEvent : e;
            cancelLongTap();
            touch.x2 = e.pageX;
            touch.y2 = e.pageY;
         } else {
            cancelLongTap();
            if ($.eventMove === 'mousemove') {
               touch.x2 = e.pageX;
               touch.y2 = e.pageY;
            } else {
               // One finger gesture:
               if (e.touches.length === 1) {
                  touch.x2 = e.touches[0].pageX;
                  touch.y2 = e.touches[0].pageY;
               }
            }
         }
      });
      body.on($.eventEnd, function(e) {
         if (window.navigator.msPointerEnabled) {
            if (window && window.jQuery && $ === window.jQuery) {
               if (e.originalEvent && !e.originalEvent.isPrimary) return;
            } else {
               if (!e.isPrimary) return;
            }
         }
         cancelLongTap();
         if (!!touch.el) {
            // Swipe detection:
            if ((touch.x2 && Math.abs(touch.x1 - touch.x2) > $.gestureLength) ||
            (touch.y2 && Math.abs(touch.y1 - touch.y2) > $.gestureLength))  {
               swipeTimeout = setTimeout(function() {
                  if (touch && touch.el) {
                     touch.el.trigger('swipe');
                     touch.el.trigger('swipe' + (swipeDirection(touch.x1, touch.x2, touch.y1, touch.y2)));
                     touch = {};
                  }
               }, 0);

            // Normal tap:
            } else if ('last' in touch) {

               // Delay by one tick so we can cancel the 'tap' event if 'scroll' fires:
               tapTimeout = setTimeout(function() {

                  // Trigger universal 'tap' with the option to cancelTouch():
                  if (touch && touch.el) {
                     touch.el.trigger('tap');
                  }

                  // Trigger double tap immediately:
                  if (touch && touch.isDoubleTap) {
                     if (touch && touch.el) {
                        touch.el.trigger('doubletap');
                        touch = {};
                     }
                  } else {
                     // Trigger single tap after singleTapDelay:
                     touchTimeout = setTimeout(function(){
                        touchTimeout = null;
                        if (touch && touch.el) {
                           touch.el.trigger('singletap');
                           touch = {};
                           return false;
                        }
                     }, singleTapDelay);
                  }

               }, 0);
            }
         } else { return; }
      });
      body.on('touchcancel', cancelAll);

      // Define navigationend event for Navigation lists:
      $('body').on('webkitTransitionEnd transitionend', 'article', function(e) {
         if (e.target.nodeName === 'ARTICLE' && e.target.classList.contains('current')) {
            $(e.target).trigger("navigationend");
         }
      });
   });

   ['swipe', 'swipeleft', 'swiperight', 'swipeup', 'swipedown', 'doubletap', 'tap', 'singletap', 'longtap'].forEach(function(method){
      // Add gesture events to ChocolateChipJS:
      $.fn.extend({
         method : function(callback){
            return this.on(method, callback);
         }
      });
   });
})(this.$);
define("chui", ["chocolatechip"], (function (global) {
    return function () {
        var ret, fn;
        return ret || global.$;
    };
}(this)));

define('app/UIPagingPatch',['chui'], function($) {

    $.UIPaging = function ( ) {
       var currentArticle = $('.segmented.paging').closest('nav').next();
       if (window && window.jQuery && $ === window.jQuery) {
          if ($('.segmented.paging').hasClass('horizontal')) {
             currentArticle.addClass('horizontal');
          } else if ($('.segmented.paging').hasClass('vertical')) {
             currentArticle.addClass('vertical');
          }
       } else {
          if ($('.segmented.paging').hasClass('horizontal')[0]) {
             currentArticle.addClass('horizontal');
          } else if ($('.segmented.paging').hasClass('vertical')[0]) {
             currentArticle.addClass('vertical');
          }
       }
       currentArticle.children().eq(0).addClass('current');
       currentArticle.children().eq(0).siblings().addClass('next');
       var sections = function() {
           return currentArticle.children().length;
       }

       $('.segmented.paging').on($.eventStart, '.button:first-of-type', function() {
          if (sections() === 1) return
          var me = $(this);
          me.next().removeClass('selected');
          me.addClass('selected');
          var currentSection;
          currentSection = $('section.current');
          if (currentSection.index() === 0)  {
              currentSection.removeClass('current');
              currentArticle.children().eq(sections() - 1).addClass('current').removeClass('next');
              currentArticle.children().eq(sections() - 1).siblings().removeClass('next').addClass('previous');
          } else {
              currentSection.removeClass('current').addClass('next');
              currentSection.prev().removeClass('previous').addClass('current');
          }

          setTimeout(function() {
              me.removeClass('selected');
          }, 250);
       });
       $('.segmented.paging').on($.eventStart, '.button:last-of-type', function() {
          if (sections() === 1) return
          var me = $(this);
          me.prev().removeClass('selected');
          me.addClass('selected');
          var currentSection;
          if (this.classList.contains('disabled')) return;
          currentSection = $('section.current');
          if (currentSection.index() === sections() - 1) {
              // start again!
              currentSection.removeClass('current');
              currentArticle.children().eq(0).addClass('current').removeClass('previous');
              currentArticle.children().eq(0).siblings().removeClass('previous').addClass('next');
          } else {
              currentSection.removeClass('current').addClass('previous');
              currentSection.next().removeClass('next').addClass('current');
          }
          setTimeout(function() {
              me.removeClass('selected');
          }, 250);
       });
    }


    $.UIDeletable = function ( options ) {
       /*
          options = {
             list: selector,
             editLabel : labelName || Edit,
             doneLabel : labelName || Done,
             deleteLabel : labelName || Delete,
             placement: left || right,
             callback : callback
          }
       */
       if (!options || !options.list || !options instanceof Array) {
          return;
       }
       var list = options.list;
       var editLabel = options.editLabel || 'Edit';
       var doneLabel = options.doneLabel || 'Done';
       var deleteLabel = options.deleteLabel || 'Delete';
       var placement = options.placement || 'right';
       var callback = options.callback || $.noop;
       var deleteButton;
       var editButton;
       var deletionIndicator;
       // Windows uses an icon for the delete button:
       if ($.isWin) deleteLabel = '';
       if (!$.doneCallbacks) {
          $.doneCallbacks = {};
       }
       var setupDeletability = function(callback) {
          var deleteSlide;
          if ($.isiOS) {
             deleteSlide = '100px';
          } else if ($.isAndroid) {
             deleteSlide = '140px';
          }

          $(function() {
              if (!$.doneCallbacks[callback]) {
                  $.doneCallbacks[callback] = true;
                  $.body.on('singletap', '.edit', function() {
                    var $this = this;
                    setTimeout(function() {
                       $this.classList.remove('edit');
                       $this.classList.add('done');
                       $($this).text(doneLabel);
                       $(list).addClass('showIndicators');
                    });
                  });
                  $.body.on('singletap', '.done', function() {
                    var $this = this;
                    setTimeout(function() {
                       $this.classList.remove('done');
                       $this.classList.add('edit');
                       $($this).text(editLabel);
                       $(list).removeClass('showIndicators');
                       $(list).find('li').removeClass('selected');
                    });
                  });
                  $.body.on('singletap', '.deletion-indicator', function() {
                    if ($(this).closest('li')[0].classList.contains('selected')) {
                       $(this).closest('li').removeClass('selected');
                       return;
                    } else {
                       $(this).closest('li').addClass('selected');
                    }
                  });
              }

             if ($.isiOS || $.isSafari) {
                $(list).on('swiperight singletap', 'li', function() {
                   $(this).removeClass('selected');
                });
             }
             $(list).on('singletap', '.delete', function() {
                var $this = this;
                $(this).siblings().css({'-webkit-transform': 'translate3d(-1000%,0,0)', '-webkit-transition': 'all 1s ease-out'});
                setTimeout(function() {
                   callback.call(callback, $this);
                   $($this).parent().remove();
                   if ($(list).children().length === 0) {
                      $this = $(list).closest('article').prev().find('.done');
                      $this.removeClass('done').addClass('edit');
                      $($this).text(editLabel);
                      $(list).removeClass('showIndicators');
                      $(list).find('li').removeClass('selected');
                   }
                }, 500);
             });
          });
       };
       var cachedList = $(list);
       if (cachedList[0].classList.contains('deletable')) {
          return;
       }
       deleteButton = $.concat('<a href="javascript:void(null)" class="button delete">', deleteLabel, '</a>');
       editButton = $.concat('<a href="javascript:void(null)" class="button edit">', editLabel, '</a>');
       deletionIndicator = '<span class="deletion-indicator"></span>';
       var old = cachedList.closest('article').prev();
       if (old && old.find) {
          old.find('.edit').remove();
          old.find('.done').remove();
       }
       if (placement === 'left') {
          cachedList.closest('article').prev().prepend(editButton);
       } else {
          cachedList.closest('article').prev().append(editButton);
          cachedList.closest('article').prev().find('h1').addClass('buttonOnRight');
          cachedList.closest('article').prev().find('.edit').addClass('align-flush');
       }
       cachedList.find('li').prepend(deletionIndicator);
       cachedList.find('li').append(deleteButton);
       $('li').find('.delete').each(function(ctx, idx) {
          if (window && window.jQuery && $ === window.jQuery) ctx = idx;
          if ($.isiOS || $.isSafari) $(ctx).css({height: '100%'});
       });
       setupDeletability(callback);

       cachedList.addClass('deletable');
       return cachedList;
    }

    $.UIGoBack_ = function () {
       var histLen = $.UINavigationHistory.length;
       if (histLen > 1) {
           var currentArticle = $('article.current');
           var destination = $($.UINavigationHistory[histLen-2]);
           var currentToolbar;
           var destinationToolbar;
           if (window && window.jQuery && $ === window.jQuery) {
              if (currentArticle.next().hasClass('toolbar')) {
                 currentToolbar = currentArticle.next('toolbar');
              }
              if (destination.next().hasClass('toolbar')) {
                 destinationToolbar = destination.next('toolbar');
              }
           } else {
              currentToolbar = currentArticle.next().hasClass('toolbar');
              destinationToolbar = destination.next().hasClass('toolbar');
           }
           currentToolbar.removeClass('current').addClass('next');
           destinationToolbar.removeClass('previous').addClass('current');

           destination.removeClass('previous').removeClass('next').addClass('current');
           destination.prev().removeClass('previous').removeClass('next').addClass('current');
           currentArticle.removeClass('current').addClass('next');
           currentArticle.prev().removeClass('current').addClass('next');
           $.UISetHashOnUrl($.UINavigationHistory[histLen-2]);
           if ($.UINavigationHistory[histLen-1] !== $.firstArticle[0].id) {
              $.UINavigationHistory.pop();
           }
        }
    };

    $.UITabbar = function ( options ) {
         /*
         var options = {
            id: 'mySpecialTabbar',
            tabs: 4,
            labels: ["Refresh", "Add", "Info", "Downloads", "Favorite"],
            icons: ["refresh", "add", "info", "downloads", "favorite"],
            selected: 2
         }
         */
         if (!options) return;
         $.body.addClass('hasTabBar');
         if ($.isiOS6) $.body.addClass('isiOS6');
         var id = options.id || $.Uuid();
         var selected = options.selected || '';
         var tabbar = '<div class="tabbar" id="' + id + '">';
         var icon = ($.isiOS || $.isSafari) ? '<span class="icon"></span>' : '';
         for (var i = 0; i < options.tabs; i++) {
            tabbar += '<a class="button ' + options.icons[i];
            if (selected === i+1) {
               tabbar += ' selected';
            }
            tabbar += '">' + icon + '<label>' + options.labels[i] + '</label></a>';
         }
         tabbar += '</div>';
         $.body.append(tabbar);
         $('nav').removeClass('current').addClass('next');
         $('nav').eq(selected).removeClass('next').addClass('current');
         $('article').removeClass('current').addClass('next');
         $('article').eq(selected-1).removeClass('next').addClass('current');
         $.body.find('.tabbar').on('singletap', '.button', function() {
            var $this = this;
            var index;
            var id;
            $.publish('chui/navigate/leave', $('article.current')[0].id);
            $this.classList.add('selected');
            $(this).siblings('a').removeClass('selected');
            index = $(this).index();
            $('article.previous').removeClass('previous').addClass('next');
            $('nav.previous').removeClass('previous').addClass('next');
            $('article.current').removeClass('current').addClass('next');
            $('nav.current').removeClass('current').addClass('next');
            id = $('article').eq(index)[0].id;
            $.publish('chui/navigate/enter', id);
            if (window && window.jQuery) {
               $('article').each(function(idx, ctx) {
                  $(ctx).scrollTop(0);
               });
            } else {
               $('article').eq(index).siblings('article').forEach(function(ctx) {
                  ctx.scrollTop = 0;
               });
            }

            $.UISetHashOnUrl('#'+id);
            if ($.UINavigationHistory[0] === ('#' + id)) {
               $.UINavigationHistory = [$.UINavigationHistory[0]];
            } else if ($.UINavigationHistory.length === 1) {
               if ($.UINavigationHistory[0] !== ('#' + id)) {
                  $.UINavigationHistory.push('#'+id);
               }
            } else if($.UINavigationHistory.length === 3) {
               $.UINavigationHistory.pop();
            } else {
               $.UINavigationHistory[1] = '#'+id;
            }
            $('article').eq(index).removeClass('next').addClass('current');
            $('nav').eq(index+1).removeClass('next').addClass('current');
         });
      }

    UIGoToArticle = function ( destination ) {
       if ($.isNavigating) return;
       $.isNavigating = true;
       var current = $('article.current');
       var currentNav = current.prev();
       destination = $(destination);
       var destinationID = '#' + destination[0].id;
       var destinationNav = destination.prev();
       var currentToolbar;
       var destinationToolbar;
       $.publish('chui/navigate/leave', current[0].id);
       $.UINavigationHistory.push(destinationID);
       $.publish('chui/navigate/enter', destination[0].id);
       current[0].scrollTop = 0;
       destination[0].scrollTop = 0;
       if (window && window.jQuery && $ === window.jQuery) {
          if (current.next().hasClass('toolbar')) {
             currentToolbar = current.next('.toolbar');
          } else {
             currentToolbar = $();
          }
          if (destination.next().hasClass('toolbar')) {
             destinationToolbar = destination.next('.toolbar');
          } else {
             destinationToolbar = $();
          }
       } else {
          currentToolbar = current.next().hasClass('toolbar');
          destinationToolbar = destination.next().hasClass('toolbar');
       }
       current.removeClass('current').addClass('previous');
       currentNav.removeClass('current').addClass('previous');
       currentToolbar.removeClass('current').addClass('previous');
       destination.removeClass('next').addClass('current');
       destinationNav.removeClass('next').addClass('current');
       destinationToolbar.removeClass('next').addClass('current');

       $.UISetHashOnUrl(destination[0].id);
       setTimeout(function() {
          $.isNavigating = false;
       }, 1);
    }
});
define("rsvp/all", 
  ["./promise","exports"],
  function(__dependency1__, __exports__) {
    
    var Promise = __dependency1__["default"];

    __exports__["default"] = function all(array, label) {
      return Promise.all(array, label);
    };
  });
define("rsvp/asap", 
  ["exports"],
  function(__exports__) {
    
    __exports__["default"] = function asap(callback, arg) {
      var length = queue.push([callback, arg]);
      if (length === 1) {
        // If length is 1, that means that we need to schedule an async flush.
        // If additional callbacks are queued before the queue is flushed, they
        // will be processed by this flush that we are scheduling.
        scheduleFlush();
      }
    };

    var browserGlobal = (typeof window !== 'undefined') ? window : {};
    var BrowserMutationObserver = browserGlobal.MutationObserver || browserGlobal.WebKitMutationObserver;

    // node
    function useNextTick() {
      return function() {
        process.nextTick(flush);
      };
    }

    function useMutationObserver() {
      var iterations = 0;
      var observer = new BrowserMutationObserver(flush);
      var node = document.createTextNode('');
      observer.observe(node, { characterData: true });

      return function() {
        node.data = (iterations = ++iterations % 2);
      };
    }

    function useSetTimeout() {
      return function() {
        setTimeout(flush, 1);
      };
    }

    var queue = [];
    function flush() {
      for (var i = 0; i < queue.length; i++) {
        var tuple = queue[i];
        var callback = tuple[0], arg = tuple[1];
        callback(arg);
      }
      queue = [];
    }

    var scheduleFlush;

    // Decide what async method to use to triggering processing of queued callbacks:
    if (typeof process !== 'undefined' && {}.toString.call(process) === '[object process]') {
      scheduleFlush = useNextTick();
    } else if (BrowserMutationObserver) {
      scheduleFlush = useMutationObserver();
    } else {
      scheduleFlush = useSetTimeout();
    }
  });
define("rsvp/config", 
  ["./events","exports"],
  function(__dependency1__, __exports__) {
    
    var EventTarget = __dependency1__["default"];

    var config = {
      instrument: false
    };

    EventTarget.mixin(config);

    function configure(name, value) {
      if (name === 'onerror') {
        // handle for legacy users that expect the actual
        // error to be passed to their function added via
        // `RSVP.configure('onerror', someFunctionHere);`
        config.on('error', value);
        return;
      }

      if (arguments.length === 2) {
        config[name] = value;
      } else {
        return config[name];
      }
    }

    __exports__.config = config;
    __exports__.configure = configure;
  });
define("rsvp/defer", 
  ["./promise","exports"],
  function(__dependency1__, __exports__) {
    
    var Promise = __dependency1__["default"];

    /**
      `RSVP.defer` returns an object similar to jQuery's `$.Deferred` objects.
      `RSVP.defer` should be used when porting over code reliant on `$.Deferred`'s
      interface. New code should use the `RSVP.Promise` constructor instead.

      The object returned from `RSVP.defer` is a plain object with three properties:

      * promise - an `RSVP.Promise`.
      * reject - a function that causes the `promise` property on this object to
        become rejected
      * resolve - a function that causes the `promise` property on this object to
        become fulfilled.

      Example:

       ```javascript
       var deferred = RSVP.defer();

       deferred.resolve("Success!");

       defered.promise.then(function(value){
         // value here is "Success!"
       });
       ```

      @method defer
      @for RSVP
      @param {String} -
      @return {Object}
     */

    __exports__["default"] = function defer(label) {
      var deferred = { };

      deferred.promise = new Promise(function(resolve, reject) {
        deferred.resolve = resolve;
        deferred.reject = reject;
      }, label);

      return deferred;
    };
  });
define("rsvp/events", 
  ["exports"],
  function(__exports__) {
    
    var indexOf = function(callbacks, callback) {
      for (var i=0, l=callbacks.length; i<l; i++) {
        if (callbacks[i] === callback) { return i; }
      }

      return -1;
    };

    var callbacksFor = function(object) {
      var callbacks = object._promiseCallbacks;

      if (!callbacks) {
        callbacks = object._promiseCallbacks = {};
      }

      return callbacks;
    };

    /**
      //@module RSVP
      //@class EventTarget
    */
    __exports__["default"] = {

      /**
        @private
        `RSVP.EventTarget.mixin` extends an object with EventTarget methods. For
        Example:

        ```javascript
        var object = {};

        RSVP.EventTarget.mixin(object);

        object.on("finished", function(event) {
          // handle event
        });

        object.trigger("finished", { detail: value });
        ```

        `EventTarget.mixin` also works with prototypes:

        ```javascript
        var Person = function() {};
        RSVP.EventTarget.mixin(Person.prototype);

        var yehuda = new Person();
        var tom = new Person();

        yehuda.on("poke", function(event) {
          console.log("Yehuda says OW");
        });

        tom.on("poke", function(event) {
          console.log("Tom says OW");
        });

        yehuda.trigger("poke");
        tom.trigger("poke");
        ```

        @method mixin
        @param {Object} object object to extend with EventTarget methods
      */
      mixin: function(object) {
        object.on = this.on;
        object.off = this.off;
        object.trigger = this.trigger;
        object._promiseCallbacks = undefined;
        return object;
      },

      /**
        @private

        Registers a callback to be executed when `eventName` is triggered

        ```javascript
        object.on('event', function(eventInfo){
          // handle the event
        });

        object.trigger('event');
        ```

        @method on
        @param {String} eventName name of the event to listen for
        @param {Function} callback function to be called when the event is triggered.
      */
      on: function(eventName, callback) {
        var allCallbacks = callbacksFor(this), callbacks;

        callbacks = allCallbacks[eventName];

        if (!callbacks) {
          callbacks = allCallbacks[eventName] = [];
        }

        if (indexOf(callbacks, callback) === -1) {
          callbacks.push(callback);
        }
      },

      /**
        @private

        You can use `off` to stop firing a particular callback for an event:

        ```javascript
        function doStuff() { // do stuff! }
        object.on('stuff', doStuff);

        object.trigger('stuff'); // doStuff will be called

        // Unregister ONLY the doStuff callback
        object.off('stuff', doStuff);
        object.trigger('stuff'); // doStuff will NOT be called
        ```

        If you don't pass a `callback` argument to `off`, ALL callbacks for the
        event will not be executed when the event fires. For example:

        ```javascript
        var callback1 = function(){};
        var callback2 = function(){};

        object.on('stuff', callback1);
        object.on('stuff', callback2);

        object.trigger('stuff'); // callback1 and callback2 will be executed.

        object.off('stuff');
        object.trigger('stuff'); // callback1 and callback2 will not be executed!
        ```

        @method off
        @param {String} eventName event to stop listening to
        @param {Function} callback optional argument. If given, only the function
        given will be removed from the event's callback queue. If no `callback`
        argument is given, all callbacks will be removed from the event's callback
        queue.
      */
      off: function(eventName, callback) {
        var allCallbacks = callbacksFor(this), callbacks, index;

        if (!callback) {
          allCallbacks[eventName] = [];
          return;
        }

        callbacks = allCallbacks[eventName];

        index = indexOf(callbacks, callback);

        if (index !== -1) { callbacks.splice(index, 1); }
      },

      /**
        @private

        Use `trigger` to fire custom events. For example:

        ```javascript
        object.on('foo', function(){
          console.log('foo event happened!');
        });
        object.trigger('foo');
        // 'foo event happened!' logged to the console
        ```

        You can also pass a value as a second argument to `trigger` that will be
        passed as an argument to all event listeners for the event:

        ```javascript
        object.on('foo', function(value){
          console.log(value.name);
        });

        object.trigger('foo', { name: 'bar' });
        // 'bar' logged to the console
        ```

        @method trigger
        @param {String} eventName name of the event to be triggered
        @param {Any} options optional value to be passed to any event handlers for
        the given `eventName`
      */
      trigger: function(eventName, options) {
        var allCallbacks = callbacksFor(this),
            callbacks, callbackTuple, callback, binding;

        if (callbacks = allCallbacks[eventName]) {
          // Don't cache the callbacks.length since it may grow
          for (var i=0; i<callbacks.length; i++) {
            callback = callbacks[i];

            callback(options);
          }
        }
      }
    };
  });
define("rsvp/filter", 
  ["./all","./map","./utils","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __exports__) {
    
    var all = __dependency1__["default"];
    var map = __dependency2__["default"];
    var isFunction = __dependency3__.isFunction;
    var isArray = __dependency3__.isArray;

    /**
     `RSVP.filter` is similar to JavaScript's native `filter` method, except that it
      waits for all promises to become fulfilled before running the `filterFn` on
      each item in given to `promises`. `RSVP.filterFn` returns a promise that will
      become fulfilled with the result of running `filterFn` on the values the
      promises become fulfilled with.

      For example:

      ```javascript

      var promise1 = RSVP.resolve(1);
      var promise2 = RSVP.resolve(2);
      var promise3 = RSVP.resolve(3);

      var filterFn = function(item){
        return item > 1;
      };

      RSVP.filter(promises, filterFn).then(function(result){
        // result is [ 2, 3 ]
      });
      ```

      If any of the `promises` given to `RSVP.filter` are rejected, the first promise
      that is rejected will be given as an argument to the returned promises's
      rejection handler. For example:

      ```javascript
      var promise1 = RSVP.resolve(1);
      var promise2 = RSVP.reject(new Error("2"));
      var promise3 = RSVP.reject(new Error("3"));
      var promises = [ promise1, promise2, promise3 ];

      var filterFn = function(item){
        return item > 1;
      };

      RSVP.filter(promises, filterFn).then(function(array){
        // Code here never runs because there are rejected promises!
      }, function(reason) {
        // reason.message === "2"
      });
      ```

      `RSVP.filter` will also wait for any promises returned from `filterFn`.
      For instance, you may want to fetch a list of users then return a subset
      of those users based on some asynchronous operation:

      ```javascript

      var alice = { name: 'alice' };
      var bob   = { name: 'bob' };
      var users = [ alice, bob ];

      var promises = users.map(function(user){
        return RSVP.resolve(user);
      });

      var filterFn = function(user){
        // Here, Alice has permissions to create a blog post, but Bob does not.
        return getPrivilegesForUser(user).then(function(privs){
          return privs.can_create_blog_post === true;
        });
      };
      RSVP.filter(promises, filterFn).then(function(users){
        // true, because the server told us only Alice can create a blog post.
        users.length === 1;
        // false, because Alice is the only user present in `users`
        users[0] === bob;
      });
      ```

      @method filter
      @for RSVP
      @param {Array} promises
      @param {Function} filterFn - function to be called on each resolved value to
      filter the final results.
      @param {String} label optional string describing the promise. Useful for
      tooling.
      @return {Promise}
    */
    function filter(promises, filterFn, label) {
      if (!isArray(promises)) {
        throw new TypeError('You must pass an array to filter.');
      }
      
      if (!isFunction(filterFn)){
        throw new TypeError("You must pass a function to filter's second argument.");
      }

      return all(promises, label).then(function(values){
        return map(promises, filterFn, label).then(function(filterResults){
           var i,
               valuesLen = values.length,
               filtered = [];

           for (i = 0; i < valuesLen; i++){
             if(filterResults[i]) filtered.push(values[i]);
           }
           return filtered;
        });
      });
    }

    __exports__["default"] = filter;
  });
define("rsvp/hash", 
  ["./promise","./utils","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    
    var Promise = __dependency1__["default"];
    var isNonThenable = __dependency2__.isNonThenable;
    var keysOf = __dependency2__.keysOf;

    /**
      `RSVP.hash` is similar to `RSVP.all`, but takes an object instead of an array
      for its `promises` argument.

      Returns a promise that is fulfilled when all the given promises have been
      fulfilled, or rejected if any of them become rejected. The returned promise
      is fulfilled with a hash that has the same key names as the `promises` object
      argument. If any of the values in the object are not promises, they will
      simply be copied over to the fulfilled object.

      Example:

      ```javascript
      var promises = {
        myPromise: RSVP.resolve(1),
        yourPromise: RSVP.resolve(2),
        theirPromise: RSVP.resolve(3),
        notAPromise: 4
      };

      RSVP.hash(promises).then(function(hash){
        // hash here is an object that looks like:
        // {
        //   myPromise: 1,
        //   yourPromise: 2,
        //   theirPromise: 3,
        //   notAPromise: 4
        // }
      });
      ````

      If any of the `promises` given to `RSVP.hash` are rejected, the first promise
      that is rejected will be given as as the first argument, or as the reason to
      the rejection handler. For example:

      ```javascript
      var promises = {
        myPromise: RSVP.resolve(1),
        rejectedPromise: RSVP.reject(new Error("rejectedPromise")),
        anotherRejectedPromise: RSVP.reject(new Error("anotherRejectedPromise")),
      };

      RSVP.hash(promises).then(function(hash){
        // Code here never runs because there are rejected promises!
      }, function(reason) {
        // reason.message === "rejectedPromise"
      });
      ```

      An important note: `RSVP.hash` is intended for plain JavaScript objects that
      are just a set of keys and values. `RSVP.hash` will NOT preserve prototype
      chains.

      Example:

      ```javascript
      function MyConstructor(){
        this.example = RSVP.resolve("Example");
      }

      MyConstructor.prototype = {
        protoProperty: RSVP.resolve("Proto Property")
      };

      var myObject = new MyConstructor();

      RSVP.hash(myObject).then(function(hash){
        // protoProperty will not be present, instead you will just have an
        // object that looks like:
        // {
        //   example: "Example"
        // }
        //
        // hash.hasOwnProperty('protoProperty'); // false
        // 'undefined' === typeof hash.protoProperty
      });
      ```

      @method hash
      @for RSVP
      @param {Object} promises
      @param {String} label - optional string that describes the promise.
      Useful for tooling.
      @return {Promise} promise that is fulfilled when all properties of `promises`
      have been fulfilled, or rejected if any of them become rejected.
    */
    __exports__["default"] = function hash(object, label) {
      return new Promise(function(resolve, reject){
        var results = {};
        var keys = keysOf(object);
        var remaining = keys.length;
        var entry, property;

        if (remaining === 0) {
          resolve(results);
          return;
        }

       function fulfilledTo(property) {
          return function(value) {
            results[property] = value;
            if (--remaining === 0) {
              resolve(results);
            }
          };
        }

        function onRejection(reason) {
          remaining = 0;
          reject(reason);
        }

        for (var i = 0; i < keys.length; i++) {
          property = keys[i];
          entry = object[property];

          if (isNonThenable(entry)) {
            results[property] = entry;
            if (--remaining === 0) {
              resolve(results);
            }
          } else {
            Promise.cast(entry).then(fulfilledTo(property), onRejection);
          }
        }
      });
    };
  });
define("rsvp/instrument", 
  ["./config","./utils","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    
    var config = __dependency1__.config;
    var now = __dependency2__.now;

    __exports__["default"] = function instrument(eventName, promise, child) {
      // instrumentation should not disrupt normal usage.
      try {
        config.trigger(eventName, {
          guid: promise._guidKey + promise._id,
          eventName: eventName,
          detail: promise._detail,
          childGuid: child && promise._guidKey + child._id,
          label: promise._label,
          timeStamp: now(),
          stack: new Error(promise._label).stack
        });
      } catch(error) {
        setTimeout(function(){
          throw error;
        }, 0);
      }
    };
  });
define("rsvp/map", 
  ["./promise","./all","./utils","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __exports__) {
    
    var Promise = __dependency1__["default"];
    var all = __dependency2__["default"];
    var isArray = __dependency3__.isArray;
    var isFunction = __dependency3__.isFunction;

    /**

     `RSVP.map` is similar to JavaScript's native `map` method, except that it
      waits for all promises to become fulfilled before running the `mapFn` on
      each item in given to `promises`. `RSVP.map` returns a promise that will
      become fulfilled with the result of running `mapFn` on the values the promises
      become fulfilled with.

      For example:

      ```javascript

      var promise1 = RSVP.resolve(1);
      var promise2 = RSVP.resolve(2);
      var promise3 = RSVP.resolve(3);
      var promises = [ promise1, promise2, promise3 ];

      var mapFn = function(item){
        return item + 1;
      };

      RSVP.map(promises, mapFn).then(function(result){
        // result is [ 2, 3, 4 ]
      });
      ```

      If any of the `promises` given to `RSVP.map` are rejected, the first promise
      that is rejected will be given as an argument to the returned promises's
      rejection handler. For example:

      ```javascript
      var promise1 = RSVP.resolve(1);
      var promise2 = RSVP.reject(new Error("2"));
      var promise3 = RSVP.reject(new Error("3"));
      var promises = [ promise1, promise2, promise3 ];

      var mapFn = function(item){
        return item + 1;
      };

      RSVP.map(promises, mapFn).then(function(array){
        // Code here never runs because there are rejected promises!
      }, function(reason) {
        // reason.message === "2"
      });
      ```

      `RSVP.map` will also wait if a promise is returned from `mapFn`. For example,
      say you want to get all comments from a set of blog posts, but you need
      the blog posts first becuase they contain a url to those comments.

      ```javscript

      var mapFn = function(blogPost){
        // getComments does some ajax and returns an RSVP.Promise that is fulfilled
        // with some comments data
        return getComments(blogPost.comments_url);
      };

      // getBlogPosts does some ajax and returns an RSVP.Promise that is fulfilled
      // with some blog post data
      RSVP.map(getBlogPosts(), mapFn).then(function(comments){
        // comments is the result of asking the server for the comments
        // of all blog posts returned from getBlogPosts()
      });
      ```

      @method map
      @for RSVP
      @param {Array} promises
      @param {Function} mapFn function to be called on each fulfilled promise.
      @param {String} label optional string for labelling the promise.
      Useful for tooling.
      @return {Promise} promise that is fulfilled with the result of calling
      `mapFn` on each fulfilled promise or value when they become fulfilled.
       The promise will be rejected if any of the given `promises` become rejected.
    */
    __exports__["default"] = function map(promises, mapFn, label) {

      if (!isArray(promises)) {
        throw new TypeError('You must pass an array to map.');
      }

      if (!isFunction(mapFn)){
        throw new TypeError("You must pass a function to map's second argument.");
      }

      return all(promises, label).then(function(results){
        var resultLen = results.length,
            mappedResults = [],
            i;

        for (i = 0; i < resultLen; i++){
          mappedResults.push(mapFn(results[i]));
        }

        return all(mappedResults, label);
      });
    };
  });
define("rsvp/node", 
  ["./promise","exports"],
  function(__dependency1__, __exports__) {
    
    var Promise = __dependency1__["default"];

    var slice = Array.prototype.slice;

    function makeNodeCallbackFor(resolve, reject) {
      return function (error, value) {
        if (error) {
          reject(error);
        } else if (arguments.length > 2) {
          resolve(slice.call(arguments, 1));
        } else {
          resolve(value);
        }
      };
    }

    /**
      `RSVP.denodeify` takes a "node-style" function and returns a function that
      will return an `RSVP.Promise`. You can use `denodeify` in Node.js or the
      browser when you'd prefer to use promises over using callbacks. For example,
      `denodeify` transforms the following:

      ```javascript
      var fs = require('fs');

      fs.readFile('myfile.txt', function(err, data){
        if (err) return handleError(err);
        handleData(data);
      });
      ```

      into:

      ```javascript
      var fs = require('fs');

      var readFile = RSVP.denodeify(fs.readFile);

      readFile('myfile.txt').then(handleData, handleError);
      ```

      Using `denodeify` makes it easier to compose asynchronous operations instead
      of using callbacks. For example, instead of:

      ```javascript
      var fs = require('fs');
      var log = require('some-async-logger');

      fs.readFile('myfile.txt', function(err, data){
        if (err) return handleError(err);
        fs.writeFile('myfile2.txt', data, function(err){
          if (err) throw err;
          log('success', function(err) {
            if (err) throw err;
          });
        });
      });
      ```

      You can chain the operations together using `then` from the returned promise:

      ```javascript
      var fs = require('fs');
      var denodeify = RSVP.denodeify;
      var readFile = denodeify(fs.readFile);
      var writeFile = denodeify(fs.writeFile);
      var log = denodeify(require('some-async-logger'));

      readFile('myfile.txt').then(function(data){
        return writeFile('myfile2.txt', data);
      }).then(function(){
        return log('SUCCESS');
      }).then(function(){
        // success handler
      }, function(reason){
        // rejection handler
      });
      ```

      @method denodeify
      @for RSVP
      @param {Function} nodeFunc a "node-style" function that takes a callback as
      its last argument. The callback expects an error to be passed as its first
      argument (if an error occurred, otherwise null), and the value from the
      operation as its second argument ("function(err, value){ }").
      @param {Any} binding optional argument for binding the "this" value when
      calling the `nodeFunc` function.
      @return {Function} a function that wraps `nodeFunc` to return an
      `RSVP.Promise`
    */
    __exports__["default"] = function denodeify(nodeFunc, binding) {
      return function()  {
        var nodeArgs = slice.call(arguments), resolve, reject;
        var thisArg = this || binding;

        return new Promise(function(resolve, reject) {
          Promise.all(nodeArgs).then(function(nodeArgs) {
            try {
              nodeArgs.push(makeNodeCallbackFor(resolve, reject));
              nodeFunc.apply(thisArg, nodeArgs);
            } catch(e) {
              reject(e);
            }
          });
        });
      };
    };
  });
define("rsvp/promise", 
  ["./config","./events","./instrument","./utils","./promise/cast","./promise/all","./promise/race","./promise/resolve","./promise/reject","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __dependency4__, __dependency5__, __dependency6__, __dependency7__, __dependency8__, __dependency9__, __exports__) {
    
    var config = __dependency1__.config;
    var EventTarget = __dependency2__["default"];
    var instrument = __dependency3__["default"];
    var objectOrFunction = __dependency4__.objectOrFunction;
    var isFunction = __dependency4__.isFunction;
    var now = __dependency4__.now;
    var cast = __dependency5__["default"];
    var all = __dependency6__["default"];
    var race = __dependency7__["default"];
    var Resolve = __dependency8__["default"];
    var Reject = __dependency9__["default"];

    var guidKey = 'rsvp_' + now() + '-';
    var counter = 0;

    function noop() {}

    __exports__["default"] = Promise;
    function Promise(resolver, label) {
      if (!isFunction(resolver)) {
        throw new TypeError('You must pass a resolver function as the first argument to the promise constructor');
      }

      if (!(this instanceof Promise)) {
        throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.");
      }

      this._id = counter++;
      this._label = label;
      this._subscribers = [];

      if (config.instrument) {
        instrument('created', this);
      }

      if (noop !== resolver) {
        invokeResolver(resolver, this);
      }
    }

    function invokeResolver(resolver, promise) {
      function resolvePromise(value) {
        resolve(promise, value);
      }

      function rejectPromise(reason) {
        reject(promise, reason);
      }

      try {
        resolver(resolvePromise, rejectPromise);
      } catch(e) {
        rejectPromise(e);
      }
    }

    Promise.cast = cast;
    Promise.all = all;
    Promise.race = race;
    Promise.resolve = Resolve;
    Promise.reject = Reject;

    var PENDING   = void 0;
    var SEALED    = 0;
    var FULFILLED = 1;
    var REJECTED  = 2;

    function subscribe(parent, child, onFulfillment, onRejection) {
      var subscribers = parent._subscribers;
      var length = subscribers.length;

      subscribers[length] = child;
      subscribers[length + FULFILLED] = onFulfillment;
      subscribers[length + REJECTED]  = onRejection;
    }

    function publish(promise, settled) {
      var child, callback, subscribers = promise._subscribers, detail = promise._detail;

      if (config.instrument) {
        instrument(settled === FULFILLED ? 'fulfilled' : 'rejected', promise);
      }

      for (var i = 0; i < subscribers.length; i += 3) {
        child = subscribers[i];
        callback = subscribers[i + settled];

        invokeCallback(settled, child, callback, detail);
      }

      promise._subscribers = null;
    }

    Promise.prototype = {
      constructor: Promise,

      _id: undefined,
      _guidKey: guidKey,
      _label: undefined,

      _state: undefined,
      _detail: undefined,
      _subscribers: undefined,

      _onerror: function (reason) {
        config.trigger('error', reason);
      },

      then: function(onFulfillment, onRejection, label) {
        var promise = this;
        this._onerror = null;

        var thenPromise = new this.constructor(noop, label);

        if (this._state) {
          var callbacks = arguments;
          config.async(function invokePromiseCallback() {
            invokeCallback(promise._state, thenPromise, callbacks[promise._state - 1], promise._detail);
          });
        } else {
          subscribe(this, thenPromise, onFulfillment, onRejection);
        }

        if (config.instrument) {
          instrument('chained', promise, thenPromise);
        }

        return thenPromise;
      },

      'catch': function(onRejection, label) {
        return this.then(null, onRejection, label);
      },

      'finally': function(callback, label) {
        var constructor = this.constructor;

        return this.then(function(value) {
          return constructor.cast(callback()).then(function(){
            return value;
          });
        }, function(reason) {
          return constructor.cast(callback()).then(function(){
            throw reason;
          });
        }, label);
      }
    };

    function invokeCallback(settled, promise, callback, detail) {
      var hasCallback = isFunction(callback),
          value, error, succeeded, failed;

      if (hasCallback) {
        try {
          value = callback(detail);
          succeeded = true;
        } catch(e) {
          failed = true;
          error = e;
        }
      } else {
        value = detail;
        succeeded = true;
      }

      if (handleThenable(promise, value)) {
        return;
      } else if (hasCallback && succeeded) {
        resolve(promise, value);
      } else if (failed) {
        reject(promise, error);
      } else if (settled === FULFILLED) {
        resolve(promise, value);
      } else if (settled === REJECTED) {
        reject(promise, value);
      }
    }

    function handleThenable(promise, value) {
      var then = null,
      resolved;

      try {
        if (promise === value) {
          throw new TypeError("A promises callback cannot return that same promise.");
        }

        if (objectOrFunction(value)) {
          then = value.then;

          if (isFunction(then)) {
            then.call(value, function(val) {
              if (resolved) { return true; }
              resolved = true;

              if (value !== val) {
                resolve(promise, val);
              } else {
                fulfill(promise, val);
              }
            }, function(val) {
              if (resolved) { return true; }
              resolved = true;

              reject(promise, val);
            }, 'derived from: ' + (promise._label || ' unknown promise'));

            return true;
          }
        }
      } catch (error) {
        if (resolved) { return true; }
        reject(promise, error);
        return true;
      }

      return false;
    }

    function resolve(promise, value) {
      if (promise === value) {
        fulfill(promise, value);
      } else if (!handleThenable(promise, value)) {
        fulfill(promise, value);
      }
    }

    function fulfill(promise, value) {
      if (promise._state !== PENDING) { return; }
      promise._state = SEALED;
      promise._detail = value;

      config.async(publishFulfillment, promise);
    }

    function reject(promise, reason) {
      if (promise._state !== PENDING) { return; }
      promise._state = SEALED;
      promise._detail = reason;

      config.async(publishRejection, promise);
    }

    function publishFulfillment(promise) {
      publish(promise, promise._state = FULFILLED);
    }

    function publishRejection(promise) {
      if (promise._onerror) {
        promise._onerror(promise._detail);
      }

      publish(promise, promise._state = REJECTED);
    }
  });
define("rsvp/promise/all", 
  ["../utils","exports"],
  function(__dependency1__, __exports__) {
    
    var isArray = __dependency1__.isArray;
    var isNonThenable = __dependency1__.isNonThenable;

    /**
      Returns a promise that is fulfilled when all the given promises have been
      fulfilled, or rejected if any of them become rejected. The return promise
      is fulfilled with an array that gives all the values in the order they were
      passed in the `promises` array argument.

      Example:

      ```javascript
      var promise1 = RSVP.resolve(1);
      var promise2 = RSVP.resolve(2);
      var promise3 = RSVP.resolve(3);
      var promises = [ promise1, promise2, promise3 ];

      RSVP.Promise.all(promises).then(function(array){
        // The array here would be [ 1, 2, 3 ];
      });
      ```

      If any of the `promises` given to `RSVP.all` are rejected, the first promise
      that is rejected will be given as an argument to the returned promises's
      rejection handler. For example:

      Example:

      ```javascript
      var promise1 = RSVP.resolve(1);
      var promise2 = RSVP.reject(new Error("2"));
      var promise3 = RSVP.reject(new Error("3"));
      var promises = [ promise1, promise2, promise3 ];

      RSVP.Promise.all(promises).then(function(array){
        // Code here never runs because there are rejected promises!
      }, function(error) {
        // error.message === "2"
      });
      ```

      @method all
      @for RSVP.Promise
      @param {Array} promises
      @param {String} label
      @return {Promise} promise that is fulfilled when all `promises` have been
      fulfilled, or rejected if any of them become rejected.
    */
    __exports__["default"] = function all(entries, label) {
      if (!isArray(entries)) {
        throw new TypeError('You must pass an array to all.');
      }

      /*jshint validthis:true */
      var Constructor = this;

      return new Constructor(function(resolve, reject) {
        var remaining = entries.length;
        var results = new Array(remaining);
        var entry, pending = true;

        if (remaining === 0) {
          resolve(results);
          return;
        }

        function fulfillmentAt(index) {
          return function(value) {
            results[index] = value;
            if (--remaining === 0) {
              resolve(results);
            }
          };
        }

        function onRejection(reason) {
          remaining = 0;
          reject(reason);
        }

        for (var index = 0; index < entries.length; index++) {
          entry = entries[index];
          if (isNonThenable(entry)) {
            results[index] = entry;
            if (--remaining === 0) {
              resolve(results);
            }
          } else {
            Constructor.cast(entry).then(fulfillmentAt(index), onRejection);
          }
        }
      }, label);
    };
  });
define("rsvp/promise/cast", 
  ["exports"],
  function(__exports__) {
    
    /**
      `RSVP.Promise.cast` returns the same promise if that promise shares a constructor
      with the promise being casted.

      Example:

      ```javascript
      var promise = RSVP.resolve(1);
      var casted = RSVP.Promise.cast(promise);

      console.log(promise === casted); // true
      ```

      In the case of a promise whose constructor does not match, it is assimilated.
      The resulting promise will fulfill or reject based on the outcome of the
      promise being casted.

      In the case of a non-promise, a promise which will fulfill with that value is
      returned.

      Example:

      ```javascript
      var value = 1; // could be a number, boolean, string, undefined...
      var casted = RSVP.Promise.cast(value);

      console.log(value === casted); // false
      console.log(casted instanceof RSVP.Promise) // true

      casted.then(function(val) {
        val === value // => true
      });
      ```

      `RSVP.Promise.cast` is similar to `RSVP.resolve`, but `RSVP.Promise.cast` differs in the
      following ways:
      * `RSVP.Promise.cast` serves as a memory-efficient way of getting a promise, when you
      have something that could either be a promise or a value. RSVP.resolve
      will have the same effect but will create a new promise wrapper if the
      argument is a promise.
      * `RSVP.Promise.cast` is a way of casting incoming thenables or promise subclasses to
      promises of the exact class specified, so that the resulting object's `then` is
      ensured to have the behavior of the constructor you are calling cast on (i.e., RSVP.Promise).

      @method cast
      @for RSVP.Promise
      @param {Object} object to be casted
      @return {Promise} promise that is fulfilled when all properties of `promises`
      have been fulfilled, or rejected if any of them become rejected.
    */

    __exports__["default"] = function cast(object) {
      /*jshint validthis:true */
      var Constructor = this;

      if (object && typeof object === 'object' && object.constructor === Constructor) {
        return object;
      }

      return new Constructor(function(resolve) {
        resolve(object);
      });
    };
  });
define("rsvp/promise/race", 
  ["../utils","exports"],
  function(__dependency1__, __exports__) {
    
    /* global toString */

    var isArray = __dependency1__.isArray;
    var isFunction = __dependency1__.isFunction;
    var isNonThenable = __dependency1__.isNonThenable;

    /**
      `RSVP.Promise.race` allows you to watch a series of promises and act as soon as the
      first promise given to the `promises` argument fulfills or rejects.

      Example:

      ```javascript
      var promise1 = new RSVP.Promise(function(resolve, reject){
        setTimeout(function(){
          resolve("promise 1");
        }, 200);
      });

      var promise2 = new RSVP.Promise(function(resolve, reject){
        setTimeout(function(){
          resolve("promise 2");
        }, 100);
      });

      RSVP.Promise.race([promise1, promise2]).then(function(result){
        // result === "promise 2" because it was resolved before promise1
        // was resolved.
      });
      ```

      `RSVP.race` is deterministic in that only the state of the first completed
      promise matters. For example, even if other promises given to the `promises`
      array argument are resolved, but the first completed promise has become
      rejected before the other promises became fulfilled, the returned promise
      will become rejected:

      ```javascript
      var promise1 = new RSVP.Promise(function(resolve, reject){
        setTimeout(function(){
          resolve("promise 1");
        }, 200);
      });

      var promise2 = new RSVP.Promise(function(resolve, reject){
        setTimeout(function(){
          reject(new Error("promise 2"));
        }, 100);
      });

      RSVP.Promise.race([promise1, promise2]).then(function(result){
        // Code here never runs because there are rejected promises!
      }, function(reason){
        // reason.message === "promise2" because promise 2 became rejected before
        // promise 1 became fulfilled
      });
      ```

      @method race
      @for RSVP.Promise
      @param {Array} promises array of promises to observe
      @param {String} label optional string for describing the promise returned.
      Useful for tooling.
      @return {Promise} a promise that becomes fulfilled with the value the first
      completed promises is resolved with if the first completed promise was
      fulfilled, or rejected with the reason that the first completed promise
      was rejected with.
    */
    __exports__["default"] = function race(entries, label) {
      if (!isArray(entries)) {
        throw new TypeError('You must pass an array to race.');
      }

      /*jshint validthis:true */
      var Constructor = this, entry;

      return new Constructor(function(resolve, reject) {
        var pending = true;

        function onFulfillment(value) { if (pending) { pending = false; resolve(value); } }
        function onRejection(reason)  { if (pending) { pending = false; reject(reason); } }

        for (var i = 0; i < entries.length; i++) {
          entry = entries[i];
          if (isNonThenable(entry)) {
            pending = false;
            resolve(entry);
            return;
          } else {
            Constructor.cast(entry).then(onFulfillment, onRejection);
          }
        }
      }, label);
    };
  });
define("rsvp/promise/reject", 
  ["exports"],
  function(__exports__) {
    
    /**
      `RSVP.reject` returns a promise that will become rejected with the passed
      `reason`. `RSVP.reject` is essentially shorthand for the following:

      ```javascript
      var promise = new RSVP.Promise(function(resolve, reject){
        reject(new Error('WHOOPS'));
      });

      promise.then(function(value){
        // Code here doesn't run because the promise is rejected!
      }, function(reason){
        // reason.message === 'WHOOPS'
      });
      ```

      Instead of writing the above, your code now simply becomes the following:

      ```javascript
      var promise = RSVP.reject(new Error('WHOOPS'));

      promise.then(function(value){
        // Code here doesn't run because the promise is rejected!
      }, function(reason){
        // reason.message === 'WHOOPS'
      });
      ```

      @method reject
      @for RSVP.Promise
      @param {Any} reason value that the returned promise will be rejected with.
      @param {String} label optional string for identifying the returned promise.
      Useful for tooling.
      @return {Promise} a promise that will become rejected with the given
      `reason`.
    */
    __exports__["default"] = function reject(reason, label) {
      /*jshint validthis:true */
      var Constructor = this;

      return new Constructor(function (resolve, reject) {
        reject(reason);
      }, label);
    };
  });
define("rsvp/promise/resolve", 
  ["exports"],
  function(__exports__) {
    
    /**
      `RSVP.resolve` returns a promise that will become fulfilled with the passed
      `value`. `RSVP.resolve` is essentially shorthand for the following:

      ```javascript
      var promise = new RSVP.Promise(function(resolve, reject){
        resolve(1);
      });

      promise.then(function(value){
        // value === 1
      });
      ```

      Instead of writing the above, your code now simply becomes the following:

      ```javascript
      var promise = RSVP.resolve(1);

      promise.then(function(value){
        // value === 1
      });
      ```

      @method resolve
      @for RSVP.Promise
      @param {Any} value value that the returned promise will be resolved with
      @param {String} label optional string for identifying the returned promise.
      Useful for tooling.
      @return {Promise} a promise that will become fulfilled with the given
      `value`
    */
    __exports__["default"] = function resolve(value, label) {
      /*jshint validthis:true */
      var Constructor = this;

      return new Constructor(function(resolve, reject) {
        resolve(value);
      }, label);
    };
  });
define("rsvp/race", 
  ["./promise","exports"],
  function(__dependency1__, __exports__) {
    
    var Promise = __dependency1__["default"];

    __exports__["default"] = function race(array, label) {
      return Promise.race(array, label);
    };
  });
define("rsvp/reject", 
  ["./promise","exports"],
  function(__dependency1__, __exports__) {
    
    var Promise = __dependency1__["default"];

    __exports__["default"] = function reject(reason, label) {
      return Promise.reject(reason, label);
    };
  });
define("rsvp/resolve", 
  ["./promise","exports"],
  function(__dependency1__, __exports__) {
    
    var Promise = __dependency1__["default"];

    __exports__["default"] = function resolve(value, label) {
      return Promise.resolve(value, label);
    };
  });
define("rsvp/rethrow", 
  ["exports"],
  function(__exports__) {
    
    /**
      `RSVP.rethrow` will rethrow an error on the next turn of the JavaScript event
      loop in order to aid debugging.

      Promises A+ specifies that any exceptions that occur with a promise must be
      caught by the promises implementation and bubbled to the last handler. For
      this reason, it is recommended that you always specify a second rejection
      handler function to `then`. However, `RSVP.rethrow` will throw the exception
      outside of the promise, so it bubbles up to your console if in the browser,
      or domain/cause uncaught exception in Node. `rethrow` will throw the error
      again so the error can be handled by the promise.

      ```javascript
      function throws(){
        throw new Error('Whoops!');
      }

      var promise = new RSVP.Promise(function(resolve, reject){
        throws();
      });

      promise.fail(RSVP.rethrow).then(function(){
        // Code here doesn't run because the promise became rejected due to an
        // error!
      }, function (err){
        // handle the error here
      });
      ```

      The 'Whoops' error will be thrown on the next turn of the event loop
      and you can watch for it in your console. You can also handle it using a
      rejection handler given to `.then` or `.fail` on the returned promise.

      @method rethrow
      @for RSVP
      @param {Error} reason reason the promise became rejected.
      @throws Error
    */
    __exports__["default"] = function rethrow(reason) {
      setTimeout(function() {
        throw reason;
      });
      throw reason;
    };
  });
define("rsvp/utils", 
  ["exports"],
  function(__exports__) {
    
    function objectOrFunction(x) {
      return typeof x === "function" || (typeof x === "object" && x !== null);
    }

    __exports__.objectOrFunction = objectOrFunction;function isFunction(x) {
      return typeof x === "function";
    }

    __exports__.isFunction = isFunction;function isNonThenable(x) {
      return !objectOrFunction(x);
    }

    __exports__.isNonThenable = isNonThenable;function isArray(x) {
      return Object.prototype.toString.call(x) === "[object Array]";
    }

    __exports__.isArray = isArray;// Date.now is not available in browsers < IE9
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/now#Compatibility
    var now = Date.now || function() { return new Date().getTime(); };
    __exports__.now = now;
    var keysOf = Object.keys || function(object) {
      var result = [];

      for (var prop in object) {
        result.push(prop);
      }

      return result;
    };
    __exports__.keysOf = keysOf;
  });
define("rsvp", 
  ["./rsvp/promise","./rsvp/events","./rsvp/node","./rsvp/all","./rsvp/race","./rsvp/hash","./rsvp/rethrow","./rsvp/defer","./rsvp/config","./rsvp/map","./rsvp/resolve","./rsvp/reject","./rsvp/asap","./rsvp/filter","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __dependency4__, __dependency5__, __dependency6__, __dependency7__, __dependency8__, __dependency9__, __dependency10__, __dependency11__, __dependency12__, __dependency13__, __dependency14__, __exports__) {
    
    var Promise = __dependency1__["default"];
    var EventTarget = __dependency2__["default"];
    var denodeify = __dependency3__["default"];
    var all = __dependency4__["default"];
    var race = __dependency5__["default"];
    var hash = __dependency6__["default"];
    var rethrow = __dependency7__["default"];
    var defer = __dependency8__["default"];
    var config = __dependency9__.config;
    var configure = __dependency9__.configure;
    var map = __dependency10__["default"];
    var resolve = __dependency11__["default"];
    var reject = __dependency12__["default"];
    var asap = __dependency13__["default"];
    var filter = __dependency14__["default"];

    config.async = asap; // default async is asap;

    function async(callback, arg) {
      config.async(callback, arg);
    }

    function on() {
      config.on.apply(config, arguments);
    }

    function off() {
      config.off.apply(config, arguments);
    }

    // Set up instrumentation through `window.__PROMISE_INTRUMENTATION__`
    if (typeof window !== 'undefined' && typeof window.__PROMISE_INSTRUMENTATION__ === 'object') {
      var callbacks = window.__PROMISE_INSTRUMENTATION__;
      configure('instrument', true);
      for (var eventName in callbacks) {
        if (callbacks.hasOwnProperty(eventName)) {
          on(eventName, callbacks[eventName]);
        }
      }
    }

    __exports__.Promise = Promise;
    __exports__.EventTarget = EventTarget;
    __exports__.all = all;
    __exports__.race = race;
    __exports__.hash = hash;
    __exports__.rethrow = rethrow;
    __exports__.defer = defer;
    __exports__.denodeify = denodeify;
    __exports__.configure = configure;
    __exports__.on = on;
    __exports__.off = off;
    __exports__.resolve = resolve;
    __exports__.reject = reject;
    __exports__.async = async;
    __exports__.map = map;
    __exports__.filter = filter;
  });
define('logger',[], function() {
    return console;
});
define('app/barcodescanner',["chui", "rsvp", "logger"], function($, rsvp, logger) {

    // create sheet which will show before the scanner becomes visible
    return function() {
        $('article.current').addClass('blurred');
        return new rsvp.Promise(function(resolve, reject){
            logger.debug("Launching barcode scanner");
            cordova.plugins.barcodeScanner.scan(
                function(result) {
                    $('article.current').removeClass('blurred');
                    resolve(result.text);
                },
                function(error) {
                    $('article.current').removeClass('blurred');
                    reject(error);
                }
            );
        });
    };
});
define('app/getBestPrice',['rsvp', 'logger'], function(rsvp, logger) {

    var countPrices = function(result) {
        var i = 0;
        for (var res in result.prices) {
            if (result.prices.hasOwnProperty(res)) {
                i++;
            }
        }
        return i;
    }

    return function(barcode) {
        return new rsvp.Promise(function(resolve, reject){
            if (barcode && barcode.trim().length > 0) {
                var xhr = new XMLHttpRequest();
                xhr.onreadystatechange = function() {
                    if (xhr.readyState==4) {
                        xhr.onreadystatechange = function () {};
                        // Verify status code
                        if(xhr.status!=200 && (xhr.status !== 0 && !/MacIntel/.test(navigator.platform))){
            //                we can assume we're on a Mac and not device so lets mock out the response
                            if (xhr.status === 0 && /MacIntel/.test(navigator.platform)) {
                                setTimeout(function() {
                                    resolve({
                                      "barcode": "8717418136771",
                                      "prices": {
                                        "WeBuyDVDs": {
                                          "price": 0.25,
                                          "details": {
                                            "name": "WeBuyDVDs",
                                            "url": "http://www.webuydvds.co.uk/"
                                          },
                                          "title": ""
                                        }
                                      },
                                      "name": "New DVD",
                                      "success": true
                                    });
                                }, 1000);
                            } else {
                                reject(xhr.status+" ("+xhr.statusText+")");
                            }
                        } else {
                            var response = JSON.parse(xhr.responseText);
                            if (JSON.stringify(response.prices) === "{}" || xhr.responseText == "") {
                                reject("No matching items found for barcode " + response.barcode);
                                analytics.trackEvent('getBestPrice', 'No Results', barcode);

                            } else {
                                resolve(response);
                                analytics.trackEvent('getBestPrice', 'Results', barcode + ":" + countPrices(response) + ":" + response.name);
                            }
                            analytics.trackEvent('getBestPrice', 'ResponseTime', (Date.now() - startTime) + "");
                        }
                    }
                }
                var startTime = Date.now();
                xhr.open("GET", "http://price-app-checker-eu.herokuapp.com/?barcode=" + barcode, true);
                xhr.send();
            } else {
                reject('Invalid barcode');
            }
        })
    }
});
define('app/eventBus',["logger"], function(logger) {
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
                    logger.log(e);
                    if (e.stack) {
                        logger.log(e.stack);
                    }
                    analytics.trackEvent('Error', e, (e.stack ? e.stack : "no stack"));
                }
            }
        }

    }
});
define('app/view/alertDialog',["chui", "rsvp"], function($, rsvp) {
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
define('app/sendFeedback',["rsvp", "logger"], function(rsvp, logger) {
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
/**
 * @preserve FastClick: polyfill to remove click delays on browsers with touch UIs.
 *
 * @version 0.6.9
 * @codingstandard ftlabs-jsv2
 * @copyright The Financial Times Limited [All Rights Reserved]
 * @license MIT License (see LICENSE.txt)
 */

/*jslint browser:true, node:true*/
/*global define, Event, Node*/


/**
 * Instantiate fast-clicking listeners on the specificed layer.
 *
 * @constructor
 * @param {Element} layer The layer to listen on
 */
function FastClick(layer) {
	
	var oldOnClick, self = this;


	/**
	 * Whether a click is currently being tracked.
	 *
	 * @type boolean
	 */
	this.trackingClick = false;


	/**
	 * Timestamp for when when click tracking started.
	 *
	 * @type number
	 */
	this.trackingClickStart = 0;


	/**
	 * The element being tracked for a click.
	 *
	 * @type EventTarget
	 */
	this.targetElement = null;


	/**
	 * X-coordinate of touch start event.
	 *
	 * @type number
	 */
	this.touchStartX = 0;


	/**
	 * Y-coordinate of touch start event.
	 *
	 * @type number
	 */
	this.touchStartY = 0;


	/**
	 * ID of the last touch, retrieved from Touch.identifier.
	 *
	 * @type number
	 */
	this.lastTouchIdentifier = 0;


	/**
	 * Touchmove boundary, beyond which a click will be cancelled.
	 *
	 * @type number
	 */
	this.touchBoundary = 10;


	/**
	 * The FastClick layer.
	 *
	 * @type Element
	 */
	this.layer = layer;

	if (!layer || !layer.nodeType) {
		throw new TypeError('Layer must be a document node');
	}

	/** @type function() */
	this.onClick = function() { return FastClick.prototype.onClick.apply(self, arguments); };

	/** @type function() */
	this.onMouse = function() { return FastClick.prototype.onMouse.apply(self, arguments); };

	/** @type function() */
	this.onTouchStart = function() { return FastClick.prototype.onTouchStart.apply(self, arguments); };

	/** @type function() */
	this.onTouchMove = function() { return FastClick.prototype.onTouchMove.apply(self, arguments); };

	/** @type function() */
	this.onTouchEnd = function() { return FastClick.prototype.onTouchEnd.apply(self, arguments); };

	/** @type function() */
	this.onTouchCancel = function() { return FastClick.prototype.onTouchCancel.apply(self, arguments); };

	if (FastClick.notNeeded(layer)) {
		return;
	}

	// Set up event handlers as required
	if (this.deviceIsAndroid) {
		layer.addEventListener('mouseover', this.onMouse, true);
		layer.addEventListener('mousedown', this.onMouse, true);
		layer.addEventListener('mouseup', this.onMouse, true);
	}

	layer.addEventListener('click', this.onClick, true);
	layer.addEventListener('touchstart', this.onTouchStart, false);
	layer.addEventListener('touchmove', this.onTouchMove, false);
	layer.addEventListener('touchend', this.onTouchEnd, false);
	layer.addEventListener('touchcancel', this.onTouchCancel, false);

	// Hack is required for browsers that don't support Event#stopImmediatePropagation (e.g. Android 2)
	// which is how FastClick normally stops click events bubbling to callbacks registered on the FastClick
	// layer when they are cancelled.
	if (!Event.prototype.stopImmediatePropagation) {
		layer.removeEventListener = function(type, callback, capture) {
			var rmv = Node.prototype.removeEventListener;
			if (type === 'click') {
				rmv.call(layer, type, callback.hijacked || callback, capture);
			} else {
				rmv.call(layer, type, callback, capture);
			}
		};

		layer.addEventListener = function(type, callback, capture) {
			var adv = Node.prototype.addEventListener;
			if (type === 'click') {
				adv.call(layer, type, callback.hijacked || (callback.hijacked = function(event) {
					if (!event.propagationStopped) {
						callback(event);
					}
				}), capture);
			} else {
				adv.call(layer, type, callback, capture);
			}
		};
	}

	// If a handler is already declared in the element's onclick attribute, it will be fired before
	// FastClick's onClick handler. Fix this by pulling out the user-defined handler function and
	// adding it as listener.
	if (typeof layer.onclick === 'function') {

		// Android browser on at least 3.2 requires a new reference to the function in layer.onclick
		// - the old one won't work if passed to addEventListener directly.
		oldOnClick = layer.onclick;
		layer.addEventListener('click', function(event) {
			oldOnClick(event);
		}, false);
		layer.onclick = null;
	}
}


/**
 * Android requires exceptions.
 *
 * @type boolean
 */
FastClick.prototype.deviceIsAndroid = navigator.userAgent.indexOf('Android') > 0;


/**
 * iOS requires exceptions.
 *
 * @type boolean
 */
FastClick.prototype.deviceIsIOS = /iP(ad|hone|od)/.test(navigator.userAgent);


/**
 * iOS 4 requires an exception for select elements.
 *
 * @type boolean
 */
FastClick.prototype.deviceIsIOS4 = FastClick.prototype.deviceIsIOS && (/OS 4_\d(_\d)?/).test(navigator.userAgent);


/**
 * iOS 6.0(+?) requires the target element to be manually derived
 *
 * @type boolean
 */
FastClick.prototype.deviceIsIOSWithBadTarget = FastClick.prototype.deviceIsIOS && (/OS ([6-9]|\d{2})_\d/).test(navigator.userAgent);


/**
 * Determine whether a given element requires a native click.
 *
 * @param {EventTarget|Element} target Target DOM element
 * @returns {boolean} Returns true if the element needs a native click
 */
FastClick.prototype.needsClick = function(target) {
	
	switch (target.nodeName.toLowerCase()) {

	// Don't send a synthetic click to disabled inputs (issue #62)
	case 'button':
	case 'select':
	case 'textarea':
		if (target.disabled) {
			return true;
		}

		break;
	case 'input':

		// File inputs need real clicks on iOS 6 due to a browser bug (issue #68)
		if ((this.deviceIsIOS && target.type === 'file') || target.disabled) {
			return true;
		}

		break;
	case 'label':
	case 'video':
		return true;
	}

	return (/\bneedsclick\b/).test(target.className);
};


/**
 * Determine whether a given element requires a call to focus to simulate click into element.
 *
 * @param {EventTarget|Element} target Target DOM element
 * @returns {boolean} Returns true if the element requires a call to focus to simulate native click.
 */
FastClick.prototype.needsFocus = function(target) {
	
	switch (target.nodeName.toLowerCase()) {
	case 'textarea':
	case 'select':
		return true;
	case 'input':
		switch (target.type) {
		case 'button':
		case 'checkbox':
		case 'file':
		case 'image':
		case 'radio':
		case 'submit':
			return false;
		}

		// No point in attempting to focus disabled inputs
		return !target.disabled && !target.readOnly;
	default:
		return (/\bneedsfocus\b/).test(target.className);
	}
};


/**
 * Send a click event to the specified element.
 *
 * @param {EventTarget|Element} targetElement
 * @param {Event} event
 */
FastClick.prototype.sendClick = function(targetElement, event) {
	
	var clickEvent, touch;

	// On some Android devices activeElement needs to be blurred otherwise the synthetic click will have no effect (#24)
	if (document.activeElement && document.activeElement !== targetElement) {
		document.activeElement.blur();
	}

	touch = event.changedTouches[0];

	// Synthesise a click event, with an extra attribute so it can be tracked
	clickEvent = document.createEvent('MouseEvents');
	clickEvent.initMouseEvent('click', true, true, window, 1, touch.screenX, touch.screenY, touch.clientX, touch.clientY, false, false, false, false, 0, null);
	clickEvent.forwardedTouchEvent = true;
	targetElement.dispatchEvent(clickEvent);
};


/**
 * @param {EventTarget|Element} targetElement
 */
FastClick.prototype.focus = function(targetElement) {
	
	var length;

	if (this.deviceIsIOS && targetElement.setSelectionRange) {
		length = targetElement.value.length;
		targetElement.setSelectionRange(length, length);
	} else {
		targetElement.focus();
	}
};


/**
 * Check whether the given target element is a child of a scrollable layer and if so, set a flag on it.
 *
 * @param {EventTarget|Element} targetElement
 */
FastClick.prototype.updateScrollParent = function(targetElement) {
	
	var scrollParent, parentElement;

	scrollParent = targetElement.fastClickScrollParent;

	// Attempt to discover whether the target element is contained within a scrollable layer. Re-check if the
	// target element was moved to another parent.
	if (!scrollParent || !scrollParent.contains(targetElement)) {
		parentElement = targetElement;
		do {
			if (parentElement.scrollHeight > parentElement.offsetHeight) {
				scrollParent = parentElement;
				targetElement.fastClickScrollParent = parentElement;
				break;
			}

			parentElement = parentElement.parentElement;
		} while (parentElement);
	}

	// Always update the scroll top tracker if possible.
	if (scrollParent) {
		scrollParent.fastClickLastScrollTop = scrollParent.scrollTop;
	}
};


/**
 * @param {EventTarget} targetElement
 * @returns {Element|EventTarget}
 */
FastClick.prototype.getTargetElementFromEventTarget = function(eventTarget) {
	

	// On some older browsers (notably Safari on iOS 4.1 - see issue #56) the event target may be a text node.
	if (eventTarget.nodeType === Node.TEXT_NODE) {
		return eventTarget.parentNode;
	}

	return eventTarget;
};


/**
 * On touch start, record the position and scroll offset.
 *
 * @param {Event} event
 * @returns {boolean}
 */
FastClick.prototype.onTouchStart = function(event) {
	
	var targetElement, touch, selection;

	// Ignore multiple touches, otherwise pinch-to-zoom is prevented if both fingers are on the FastClick element (issue #111).
	if (event.targetTouches.length > 1) {
		return true;
	}

	targetElement = this.getTargetElementFromEventTarget(event.target);
	touch = event.targetTouches[0];

	if (this.deviceIsIOS) {

		// Only trusted events will deselect text on iOS (issue #49)
		selection = window.getSelection();
		if (selection.rangeCount && !selection.isCollapsed) {
			return true;
		}

		if (!this.deviceIsIOS4) {

			// Weird things happen on iOS when an alert or confirm dialog is opened from a click event callback (issue #23):
			// when the user next taps anywhere else on the page, new touchstart and touchend events are dispatched
			// with the same identifier as the touch event that previously triggered the click that triggered the alert.
			// Sadly, there is an issue on iOS 4 that causes some normal touch events to have the same identifier as an
			// immediately preceeding touch event (issue #52), so this fix is unavailable on that platform.
			if (touch.identifier === this.lastTouchIdentifier) {
				event.preventDefault();
				return false;
			}

			this.lastTouchIdentifier = touch.identifier;

			// If the target element is a child of a scrollable layer (using -webkit-overflow-scrolling: touch) and:
			// 1) the user does a fling scroll on the scrollable layer
			// 2) the user stops the fling scroll with another tap
			// then the event.target of the last 'touchend' event will be the element that was under the user's finger
			// when the fling scroll was started, causing FastClick to send a click event to that layer - unless a check
			// is made to ensure that a parent layer was not scrolled before sending a synthetic click (issue #42).
			this.updateScrollParent(targetElement);
		}
	}

	this.trackingClick = true;
	this.trackingClickStart = event.timeStamp;
	this.targetElement = targetElement;

	this.touchStartX = touch.pageX;
	this.touchStartY = touch.pageY;

	// Prevent phantom clicks on fast double-tap (issue #36)
	if ((event.timeStamp - this.lastClickTime) < 200) {
		event.preventDefault();
	}

	return true;
};


/**
 * Based on a touchmove event object, check whether the touch has moved past a boundary since it started.
 *
 * @param {Event} event
 * @returns {boolean}
 */
FastClick.prototype.touchHasMoved = function(event) {
	
	var touch = event.changedTouches[0], boundary = this.touchBoundary;

	if (Math.abs(touch.pageX - this.touchStartX) > boundary || Math.abs(touch.pageY - this.touchStartY) > boundary) {
		return true;
	}

	return false;
};


/**
 * Update the last position.
 *
 * @param {Event} event
 * @returns {boolean}
 */
FastClick.prototype.onTouchMove = function(event) {
	
	if (!this.trackingClick) {
		return true;
	}

	// If the touch has moved, cancel the click tracking
	if (this.targetElement !== this.getTargetElementFromEventTarget(event.target) || this.touchHasMoved(event)) {
		this.trackingClick = false;
		this.targetElement = null;
	}

	return true;
};


/**
 * Attempt to find the labelled control for the given label element.
 *
 * @param {EventTarget|HTMLLabelElement} labelElement
 * @returns {Element|null}
 */
FastClick.prototype.findControl = function(labelElement) {
	

	// Fast path for newer browsers supporting the HTML5 control attribute
	if (labelElement.control !== undefined) {
		return labelElement.control;
	}

	// All browsers under test that support touch events also support the HTML5 htmlFor attribute
	if (labelElement.htmlFor) {
		return document.getElementById(labelElement.htmlFor);
	}

	// If no for attribute exists, attempt to retrieve the first labellable descendant element
	// the list of which is defined here: http://www.w3.org/TR/html5/forms.html#category-label
	return labelElement.querySelector('button, input:not([type=hidden]), keygen, meter, output, progress, select, textarea');
};


/**
 * On touch end, determine whether to send a click event at once.
 *
 * @param {Event} event
 * @returns {boolean}
 */
FastClick.prototype.onTouchEnd = function(event) {
	
	var forElement, trackingClickStart, targetTagName, scrollParent, touch, targetElement = this.targetElement;

	if (!this.trackingClick) {
		return true;
	}

	// Prevent phantom clicks on fast double-tap (issue #36)
	if ((event.timeStamp - this.lastClickTime) < 200) {
		this.cancelNextClick = true;
		return true;
	}

	this.lastClickTime = event.timeStamp;

	trackingClickStart = this.trackingClickStart;
	this.trackingClick = false;
	this.trackingClickStart = 0;

	// On some iOS devices, the targetElement supplied with the event is invalid if the layer
	// is performing a transition or scroll, and has to be re-detected manually. Note that
	// for this to function correctly, it must be called *after* the event target is checked!
	// See issue #57; also filed as rdar://13048589 .
	if (this.deviceIsIOSWithBadTarget) {
		touch = event.changedTouches[0];

		// In certain cases arguments of elementFromPoint can be negative, so prevent setting targetElement to null
		targetElement = document.elementFromPoint(touch.pageX - window.pageXOffset, touch.pageY - window.pageYOffset) || targetElement;
		targetElement.fastClickScrollParent = this.targetElement.fastClickScrollParent;
	}

	targetTagName = targetElement.tagName.toLowerCase();
	if (targetTagName === 'label') {
		forElement = this.findControl(targetElement);
		if (forElement) {
			this.focus(targetElement);
			if (this.deviceIsAndroid) {
				return false;
			}

			targetElement = forElement;
		}
	} else if (this.needsFocus(targetElement)) {

		// Case 1: If the touch started a while ago (best guess is 100ms based on tests for issue #36) then focus will be triggered anyway. Return early and unset the target element reference so that the subsequent click will be allowed through.
		// Case 2: Without this exception for input elements tapped when the document is contained in an iframe, then any inputted text won't be visible even though the value attribute is updated as the user types (issue #37).
		if ((event.timeStamp - trackingClickStart) > 100 || (this.deviceIsIOS && window.top !== window && targetTagName === 'input')) {
			this.targetElement = null;
			return false;
		}

		this.focus(targetElement);

		// Select elements need the event to go through on iOS 4, otherwise the selector menu won't open.
		if (!this.deviceIsIOS4 || targetTagName !== 'select') {
			this.targetElement = null;
			event.preventDefault();
		}

		return false;
	}

	if (this.deviceIsIOS && !this.deviceIsIOS4) {

		// Don't send a synthetic click event if the target element is contained within a parent layer that was scrolled
		// and this tap is being used to stop the scrolling (usually initiated by a fling - issue #42).
		scrollParent = targetElement.fastClickScrollParent;
		if (scrollParent && scrollParent.fastClickLastScrollTop !== scrollParent.scrollTop) {
			return true;
		}
	}

	// Prevent the actual click from going though - unless the target node is marked as requiring
	// real clicks or if it is in the whitelist in which case only non-programmatic clicks are permitted.
	if (!this.needsClick(targetElement)) {
		event.preventDefault();
		this.sendClick(targetElement, event);
	}

	return false;
};


/**
 * On touch cancel, stop tracking the click.
 *
 * @returns {void}
 */
FastClick.prototype.onTouchCancel = function() {
	
	this.trackingClick = false;
	this.targetElement = null;
};


/**
 * Determine mouse events which should be permitted.
 *
 * @param {Event} event
 * @returns {boolean}
 */
FastClick.prototype.onMouse = function(event) {
	

	// If a target element was never set (because a touch event was never fired) allow the event
	if (!this.targetElement) {
		return true;
	}

	if (event.forwardedTouchEvent) {
		return true;
	}

	// Programmatically generated events targeting a specific element should be permitted
	if (!event.cancelable) {
		return true;
	}

	// Derive and check the target element to see whether the mouse event needs to be permitted;
	// unless explicitly enabled, prevent non-touch click events from triggering actions,
	// to prevent ghost/doubleclicks.
	if (!this.needsClick(this.targetElement) || this.cancelNextClick) {

		// Prevent any user-added listeners declared on FastClick element from being fired.
		if (event.stopImmediatePropagation) {
			event.stopImmediatePropagation();
		} else {

			// Part of the hack for browsers that don't support Event#stopImmediatePropagation (e.g. Android 2)
			event.propagationStopped = true;
		}

		// Cancel the event
		event.stopPropagation();
		event.preventDefault();

		return false;
	}

	// If the mouse event is permitted, return true for the action to go through.
	return true;
};


/**
 * On actual clicks, determine whether this is a touch-generated click, a click action occurring
 * naturally after a delay after a touch (which needs to be cancelled to avoid duplication), or
 * an actual click which should be permitted.
 *
 * @param {Event} event
 * @returns {boolean}
 */
FastClick.prototype.onClick = function(event) {
	
	var permitted;

	// It's possible for another FastClick-like library delivered with third-party code to fire a click event before FastClick does (issue #44). In that case, set the click-tracking flag back to false and return early. This will cause onTouchEnd to return early.
	if (this.trackingClick) {
		this.targetElement = null;
		this.trackingClick = false;
		return true;
	}

	// Very odd behaviour on iOS (issue #18): if a submit element is present inside a form and the user hits enter in the iOS simulator or clicks the Go button on the pop-up OS keyboard the a kind of 'fake' click event will be triggered with the submit-type input element as the target.
	if (event.target.type === 'submit' && event.detail === 0) {
		return true;
	}

	permitted = this.onMouse(event);

	// Only unset targetElement if the click is not permitted. This will ensure that the check for !targetElement in onMouse fails and the browser's click doesn't go through.
	if (!permitted) {
		this.targetElement = null;
	}

	// If clicks are permitted, return true for the action to go through.
	return permitted;
};


/**
 * Remove all FastClick's event listeners.
 *
 * @returns {void}
 */
FastClick.prototype.destroy = function() {
	
	var layer = this.layer;

	if (this.deviceIsAndroid) {
		layer.removeEventListener('mouseover', this.onMouse, true);
		layer.removeEventListener('mousedown', this.onMouse, true);
		layer.removeEventListener('mouseup', this.onMouse, true);
	}

	layer.removeEventListener('click', this.onClick, true);
	layer.removeEventListener('touchstart', this.onTouchStart, false);
	layer.removeEventListener('touchmove', this.onTouchMove, false);
	layer.removeEventListener('touchend', this.onTouchEnd, false);
	layer.removeEventListener('touchcancel', this.onTouchCancel, false);
};


/**
 * Check whether FastClick is needed.
 *
 * @param {Element} layer The layer to listen on
 */
FastClick.notNeeded = function(layer) {
	
	var metaViewport;

	// Devices that don't support touch don't need FastClick
	if (typeof window.ontouchstart === 'undefined') {
		return true;
	}

	if ((/Chrome\/[0-9]+/).test(navigator.userAgent)) {

		// Chrome on Android with user-scalable="no" doesn't need FastClick (issue #89)
		if (FastClick.prototype.deviceIsAndroid) {
			metaViewport = document.querySelector('meta[name=viewport]');
			if (metaViewport && metaViewport.content.indexOf('user-scalable=no') !== -1) {
				return true;
			}

		// Chrome desktop doesn't need FastClick (issue #15)
		} else {
			return true;
		}
	}

	// IE10 with -ms-touch-action: none, which disables double-tap-to-zoom (issue #97)
	if (layer.style.msTouchAction === 'none') {
		return true;
	}

	return false;
};


/**
 * Factory method for creating a FastClick object
 *
 * @param {Element} layer The layer to listen on
 */
FastClick.attach = function(layer) {
	
	return new FastClick(layer);
};


if (typeof define !== 'undefined' && define.amd) {

	// AMD. Register as an anonymous module.
	define('fastclick',[],function() {
		
		return FastClick;
	});
} else if (typeof module !== 'undefined' && module.exports) {
	module.exports = FastClick.attach;
	module.exports.FastClick = FastClick;
} else {
	window.FastClick = FastClick;
}
;
require(["chui", "app/barcodescanner", "app/getBestPrice", "app/eventBus", "logger", "app/view/alertDialog", "app/sendFeedback", 'fastclick'],
    function($, showScanner, getBestPrice, bus, logger, alert, feedback, fastclick) {

        function getCurrentBarcode() {
            return $('#barcode').val();
        };

        function setBarcode(barcode) {
            $('#barcode').val(barcode);
        }

        function hideKeyboard() {
            document.activeElement.blur();
        }
        var launchScanner = $('#launch-scanner');
        var findBestPriceBtn = $('#find-the-best-price');
        var feedbackBtn = $('#feedback');
        var icons = $('#search a');

        if ($.isAndroid) {
            feedbackBtn.removeClass('icon').html("Feedback");
        }

        function registerHandlers() {

            launchScanner.on('click', function(event) {
                analytics.trackEvent('Scanner', 'Launched');
                showScanner().then(function(barcode) {
                    analytics.trackEvent('Scanner', 'Closed', barcode);
                    setBarcode(barcode);
                }, function(error) {
                    alert('An error occured whilst using the barcode scanner: ' + error)
                });
            });

            findBestPriceBtn.on('click', function(event) {
                hideKeyboard();
                var barcode = getCurrentBarcode();
                bus.publish("searchingForBarcode", {barcode: barcode});
                analytics.trackEvent('getBestPrice', 'Launched', barcode);
                getBestPrice(barcode).then(function(result) {
                    analytics.trackEvent('getBestPrice', 'Result', barcode);
                    $.UINavigationHistory.pop();
                    setBarcode("&nbsp;");
                    bus.publish("barcodeResult", result);
                }, function(error) {
                    analytics.trackEvent('getBestPrice', 'NoResult', barcode);
                    var result = alert('Could not find a match for the barcode');
                    $.UIGoBack();
                });
            });

            var handler = function(event) {
                hideKeyboard();
                analytics.trackEvent('feedback', 'Launch');
                feedback().then(function() {
                    analytics.trackEvent('feedback', 'Sent');
                }, function() {
                    analytics.trackEvent('feedback', 'Cancelled');
                });
            }

            icons.on('singletap', function() {
                window.open($(this).attr('href'), '_blank', 'location=yes');
                return false;
            });

            $('#feedback').on('click', handler);
            $('#feedback').on('singletap', handler);
        }

        function handleBackKey() {
            $.UIGoBack();
        }

        function onDeviceReady() {
            document.body.style.minHeight=window.innerHeight + 'px';
            fastclick.attach(document.body);
            registerHandlers();
            document.addEventListener("backbutton", handleBackKey, false);
            if (window.analytics) {
                analytics.startTrackerWithId('UA-43287931-3');
                analytics.trackView('App Launch');
            } else {
                var emptyFn = function(){};
                window.analytics = {trackView: emptyFn, trackEvent: emptyFn};
            }
            if (window.device && parseFloat(window.device.version) >= 7) {
                $('body').addClass("isiOSseven");
            }
            setTimeout(function() {
                window.navigator.splashscreen.hide();
            }, 1);
        }

        document.addEventListener('deviceready', onDeviceReady, false);

        if (!window.cordova) {
            setTimeout(onDeviceReady, 1000);
        }

    }
);
define("app/view/barcodeForm", function(){});

define('app/dataStore',['rsvp'], function(rsvp) {

    var key = 'pastResults',
        json = JSON,
        listeners = [],
        currentVersion = 1;

    function validateDataInStore() {
        return new rsvp.Promise(function(resolve, reject) {
            var version = json.parse(localStorage.getItem('version'));
            if (version !== currentVersion) {
                localStorage.clear();
            }
            localStorage.setItem('version', json.stringify(currentVersion));
            updateVendors().then(function(data) {
                resolve(data)
            }, function(err) {
                reject(err);
            });
        });
    }

    function cleanse(results) {
        if (results.undefined) {
            delete results.undefined;
        }
        for (var result in results) {
            if (results.hasOwnProperty(result)) {
                if (results[result].bestVendors.length === 0) {
                    delete results[result];
                }
            }
        }
        return results;
    }

    function getPastResults(key) {
        var pastResults = localStorage.getItem(key);
        if (!pastResults) {
            pastResults = "{}";
        }
        try {
            if (key === 'pastResults') {
                return cleanse(json.parse(pastResults));
            } else {
                return json.parse(pastResults);
            }
        } catch (e) {
            return {};
        }
    }

    function getPastResult(barcode) {
        var pastResults = getPastResults();
        return pastResults[barcode];
    }

    function doUpdate(barcode, result) {
        return new rsvp.Promise(function(resolve, reject) {
            var pastResults = getPastResults(key);
            pastResults[barcode] = addBestPricedVendor(result);
            localStorage.setItem(key, json.stringify(pastResults));
            var promise = updateVendors(result);
            for (var i = 0, len = listeners.length; i < len; i++) {
                listeners[i](barcode, result);
            }
            promise.then(function() {
                resolve(result);
            })
        });
    }

    function addBestPricedVendor(result) {
        var best = 0,
            bestVendors = [];
        if (result) {
            for (var vendor in result.prices) {
                var vendorPrice = result.prices[vendor].price;
                if (best < vendorPrice) {
                    best = vendorPrice;
                    bestVendors = [vendor];
                } else if (best === vendorPrice) {
                    bestVendors.push(vendor);
                }
            }
            result.bestVendors = bestVendors;
        }
        return result;
    }

    function updateVendors() {
        return new rsvp.Promise(function(resolve, reject) {
            var vendors = {},
                pastResults = getPastResults(key);
            for (var oldResult in pastResults){
                for (var vendor in pastResults[oldResult].prices) {
                    if (!vendors[vendor]) {
                        vendors[vendor] = {
                            name: pastResults[oldResult].prices[vendor].details.name,
                            url: pastResults[oldResult].prices[vendor].details.url,
                            totalPrice: 0
                        };
                    }
                    vendors[vendor].totalPrice += pastResults[oldResult].prices[vendor].price;
                }
            }
            localStorage.setItem('vendors', json.stringify(vendors));
            resolve(vendors);
        });
    }

    function getVendors() {
        return getPastResults('vendors');
    }

    return {
        saveResultToDisk: function(result) {
            return doUpdate(result.barcode, result);
        },

        deletePastResult: function(barcode) {
            doUpdate(barcode, undefined);
        },

        getPastResult: getPastResult,

        getPastResults: function() {
            return getPastResults(key);
        },

        getVendors: getVendors,

        addUpdateListener: function(listener) {
            listeners.push(listener);
        },

        init: validateDataInStore

    };
});
define('app/priceResultManager',["app/dataStore", "app/eventBus"], function(dataStore, eventBus) {

    function publishRepoChange() {
        eventBus.publish("priceResultRepoChange", priceManager);
    }

    function addResult(key, result) {
        try {
            result.name = result.WeBuyDVDs.title;
        } catch (e) {}
        dataStore.saveResultToDisk(result).then(publishRepoChange);
    }

    function getTotalBestPrice() {
        var pastResults = dataStore.getPastResults();
        var total = 0;
        try {
            for ( var item in pastResults ) {
                if (pastResults.hasOwnProperty(item)) {
                    var best = 0,
                        currentItem = pastResults[item];
                    total += currentItem.prices[currentItem.bestVendors[0]].price;
                }
            }
        } catch (e) {}
        return total;
    }

    function getVendors() {
        return dataStore.getVendors();
    }

    eventBus.subscribe("barcodeResult", addResult);

    var priceManager = {
        getTotalBestPrice: getTotalBestPrice,
        getAllResults: function() {
            return dataStore.getPastResults();
        },
        getVendors: getVendors,
        deleteItem: function(barcode) {
            dataStore.deletePastResult(barcode);
        }
    };

    dataStore.init().then(publishRepoChange);

    return priceManager;

});
define('app/view/tabbar',['chui', 'app/eventBus', "app/priceResultManager"], function($, eventBus, priceManager) {
    var opts = {
         tabs : 3,
         icons: ['search', 'best-price', 'by-vendor'],
         labels : ["Search", "Best Price", "By Vendor"],
         selected: 1
    };
    $.UITabbar(opts);
    var spacingChar = ($.isAndroid ? "&nbsp;" : "<br/>");

    function updateBestPriceTab(key, priceManager) {
        $(".tabbar .best-price label").html("Best Price" + spacingChar + "£" + priceManager.getTotalBestPrice().toFixed(2));
    }

    eventBus.subscribe("priceResultRepoChange", updateBestPriceTab);

    updateBestPriceTab('priceResultRepoChange', priceManager);
});
/**
 * @license RequireJS text 2.0.10 Copyright (c) 2010-2012, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/requirejs/text for details
 */
/*jslint regexp: true */
/*global require, XMLHttpRequest, ActiveXObject,
  define, window, process, Packages,
  java, location, Components, FileUtils */

define('text',['module'], function (module) {
    

    var text, fs, Cc, Ci, xpcIsWindows,
        progIds = ['Msxml2.XMLHTTP', 'Microsoft.XMLHTTP', 'Msxml2.XMLHTTP.4.0'],
        xmlRegExp = /^\s*<\?xml(\s)+version=[\'\"](\d)*.(\d)*[\'\"](\s)*\?>/im,
        bodyRegExp = /<body[^>]*>\s*([\s\S]+)\s*<\/body>/im,
        hasLocation = typeof location !== 'undefined' && location.href,
        defaultProtocol = hasLocation && location.protocol && location.protocol.replace(/\:/, ''),
        defaultHostName = hasLocation && location.hostname,
        defaultPort = hasLocation && (location.port || undefined),
        buildMap = {},
        masterConfig = (module.config && module.config()) || {};

    text = {
        version: '2.0.10',

        strip: function (content) {
            //Strips <?xml ...?> declarations so that external SVG and XML
            //documents can be added to a document without worry. Also, if the string
            //is an HTML document, only the part inside the body tag is returned.
            if (content) {
                content = content.replace(xmlRegExp, "");
                var matches = content.match(bodyRegExp);
                if (matches) {
                    content = matches[1];
                }
            } else {
                content = "";
            }
            return content;
        },

        jsEscape: function (content) {
            return content.replace(/(['\\])/g, '\\$1')
                .replace(/[\f]/g, "\\f")
                .replace(/[\b]/g, "\\b")
                .replace(/[\n]/g, "\\n")
                .replace(/[\t]/g, "\\t")
                .replace(/[\r]/g, "\\r")
                .replace(/[\u2028]/g, "\\u2028")
                .replace(/[\u2029]/g, "\\u2029");
        },

        createXhr: masterConfig.createXhr || function () {
            //Would love to dump the ActiveX crap in here. Need IE 6 to die first.
            var xhr, i, progId;
            if (typeof XMLHttpRequest !== "undefined") {
                return new XMLHttpRequest();
            } else if (typeof ActiveXObject !== "undefined") {
                for (i = 0; i < 3; i += 1) {
                    progId = progIds[i];
                    try {
                        xhr = new ActiveXObject(progId);
                    } catch (e) {}

                    if (xhr) {
                        progIds = [progId];  // so faster next time
                        break;
                    }
                }
            }

            return xhr;
        },

        /**
         * Parses a resource name into its component parts. Resource names
         * look like: module/name.ext!strip, where the !strip part is
         * optional.
         * @param {String} name the resource name
         * @returns {Object} with properties "moduleName", "ext" and "strip"
         * where strip is a boolean.
         */
        parseName: function (name) {
            var modName, ext, temp,
                strip = false,
                index = name.indexOf("."),
                isRelative = name.indexOf('./') === 0 ||
                             name.indexOf('../') === 0;

            if (index !== -1 && (!isRelative || index > 1)) {
                modName = name.substring(0, index);
                ext = name.substring(index + 1, name.length);
            } else {
                modName = name;
            }

            temp = ext || modName;
            index = temp.indexOf("!");
            if (index !== -1) {
                //Pull off the strip arg.
                strip = temp.substring(index + 1) === "strip";
                temp = temp.substring(0, index);
                if (ext) {
                    ext = temp;
                } else {
                    modName = temp;
                }
            }

            return {
                moduleName: modName,
                ext: ext,
                strip: strip
            };
        },

        xdRegExp: /^((\w+)\:)?\/\/([^\/\\]+)/,

        /**
         * Is an URL on another domain. Only works for browser use, returns
         * false in non-browser environments. Only used to know if an
         * optimized .js version of a text resource should be loaded
         * instead.
         * @param {String} url
         * @returns Boolean
         */
        useXhr: function (url, protocol, hostname, port) {
            var uProtocol, uHostName, uPort,
                match = text.xdRegExp.exec(url);
            if (!match) {
                return true;
            }
            uProtocol = match[2];
            uHostName = match[3];

            uHostName = uHostName.split(':');
            uPort = uHostName[1];
            uHostName = uHostName[0];

            return (!uProtocol || uProtocol === protocol) &&
                   (!uHostName || uHostName.toLowerCase() === hostname.toLowerCase()) &&
                   ((!uPort && !uHostName) || uPort === port);
        },

        finishLoad: function (name, strip, content, onLoad) {
            content = strip ? text.strip(content) : content;
            if (masterConfig.isBuild) {
                buildMap[name] = content;
            }
            onLoad(content);
        },

        load: function (name, req, onLoad, config) {
            //Name has format: some.module.filext!strip
            //The strip part is optional.
            //if strip is present, then that means only get the string contents
            //inside a body tag in an HTML string. For XML/SVG content it means
            //removing the <?xml ...?> declarations so the content can be inserted
            //into the current doc without problems.

            // Do not bother with the work if a build and text will
            // not be inlined.
            if (config.isBuild && !config.inlineText) {
                onLoad();
                return;
            }

            masterConfig.isBuild = config.isBuild;

            var parsed = text.parseName(name),
                nonStripName = parsed.moduleName +
                    (parsed.ext ? '.' + parsed.ext : ''),
                url = req.toUrl(nonStripName),
                useXhr = (masterConfig.useXhr) ||
                         text.useXhr;

            // Do not load if it is an empty: url
            if (url.indexOf('empty:') === 0) {
                onLoad();
                return;
            }

            //Load the text. Use XHR if possible and in a browser.
            if (!hasLocation || useXhr(url, defaultProtocol, defaultHostName, defaultPort)) {
                text.get(url, function (content) {
                    text.finishLoad(name, parsed.strip, content, onLoad);
                }, function (err) {
                    if (onLoad.error) {
                        onLoad.error(err);
                    }
                });
            } else {
                //Need to fetch the resource across domains. Assume
                //the resource has been optimized into a JS module. Fetch
                //by the module name + extension, but do not include the
                //!strip part to avoid file system issues.
                req([nonStripName], function (content) {
                    text.finishLoad(parsed.moduleName + '.' + parsed.ext,
                                    parsed.strip, content, onLoad);
                });
            }
        },

        write: function (pluginName, moduleName, write, config) {
            if (buildMap.hasOwnProperty(moduleName)) {
                var content = text.jsEscape(buildMap[moduleName]);
                write.asModule(pluginName + "!" + moduleName,
                               "define(function () { return '" +
                                   content +
                               "';});\n");
            }
        },

        writeFile: function (pluginName, moduleName, req, write, config) {
            var parsed = text.parseName(moduleName),
                extPart = parsed.ext ? '.' + parsed.ext : '',
                nonStripName = parsed.moduleName + extPart,
                //Use a '.js' file name so that it indicates it is a
                //script that can be loaded across domains.
                fileName = req.toUrl(parsed.moduleName + extPart) + '.js';

            //Leverage own load() method to load plugin value, but only
            //write out values that do not have the strip argument,
            //to avoid any potential issues with ! in file names.
            text.load(nonStripName, req, function (value) {
                //Use own write() method to construct full module value.
                //But need to create shell that translates writeFile's
                //write() to the right interface.
                var textWrite = function (contents) {
                    return write(fileName, contents);
                };
                textWrite.asModule = function (moduleName, contents) {
                    return write.asModule(moduleName, fileName, contents);
                };

                text.write(pluginName, nonStripName, textWrite, config);
            }, config);
        }
    };

    if (masterConfig.env === 'node' || (!masterConfig.env &&
            typeof process !== "undefined" &&
            process.versions &&
            !!process.versions.node &&
            !process.versions['node-webkit'])) {
        //Using special require.nodeRequire, something added by r.js.
        fs = require.nodeRequire('fs');

        text.get = function (url, callback, errback) {
            try {
                var file = fs.readFileSync(url, 'utf8');
                //Remove BOM (Byte Mark Order) from utf8 files if it is there.
                if (file.indexOf('\uFEFF') === 0) {
                    file = file.substring(1);
                }
                callback(file);
            } catch (e) {
                errback(e);
            }
        };
    } else if (masterConfig.env === 'xhr' || (!masterConfig.env &&
            text.createXhr())) {
        text.get = function (url, callback, errback, headers) {
            var xhr = text.createXhr(), header;
            xhr.open('GET', url, true);

            //Allow plugins direct access to xhr headers
            if (headers) {
                for (header in headers) {
                    if (headers.hasOwnProperty(header)) {
                        xhr.setRequestHeader(header.toLowerCase(), headers[header]);
                    }
                }
            }

            //Allow overrides specified in config
            if (masterConfig.onXhr) {
                masterConfig.onXhr(xhr, url);
            }

            xhr.onreadystatechange = function (evt) {
                var status, err;
                //Do not explicitly handle errors, those should be
                //visible via console output in the browser.
                if (xhr.readyState === 4) {
                    status = xhr.status;
                    if (status > 399 && status < 600) {
                        //An http 4xx or 5xx error. Signal an error.
                        err = new Error(url + ' HTTP status: ' + status);
                        err.xhr = xhr;
                        errback(err);
                    } else {
                        callback(xhr.responseText);
                    }

                    if (masterConfig.onXhrComplete) {
                        masterConfig.onXhrComplete(xhr, url);
                    }
                }
            };
            xhr.send(null);
        };
    } else if (masterConfig.env === 'rhino' || (!masterConfig.env &&
            typeof Packages !== 'undefined' && typeof java !== 'undefined')) {
        //Why Java, why is this so awkward?
        text.get = function (url, callback) {
            var stringBuffer, line,
                encoding = "utf-8",
                file = new java.io.File(url),
                lineSeparator = java.lang.System.getProperty("line.separator"),
                input = new java.io.BufferedReader(new java.io.InputStreamReader(new java.io.FileInputStream(file), encoding)),
                content = '';
            try {
                stringBuffer = new java.lang.StringBuffer();
                line = input.readLine();

                // Byte Order Mark (BOM) - The Unicode Standard, version 3.0, page 324
                // http://www.unicode.org/faq/utf_bom.html

                // Note that when we use utf-8, the BOM should appear as "EF BB BF", but it doesn't due to this bug in the JDK:
                // http://bugs.sun.com/bugdatabase/view_bug.do?bug_id=4508058
                if (line && line.length() && line.charAt(0) === 0xfeff) {
                    // Eat the BOM, since we've already found the encoding on this file,
                    // and we plan to concatenating this buffer with others; the BOM should
                    // only appear at the top of a file.
                    line = line.substring(1);
                }

                if (line !== null) {
                    stringBuffer.append(line);
                }

                while ((line = input.readLine()) !== null) {
                    stringBuffer.append(lineSeparator);
                    stringBuffer.append(line);
                }
                //Make sure we return a JavaScript string and not a Java string.
                content = String(stringBuffer.toString()); //String
            } finally {
                input.close();
            }
            callback(content);
        };
    } else if (masterConfig.env === 'xpconnect' || (!masterConfig.env &&
            typeof Components !== 'undefined' && Components.classes &&
            Components.interfaces)) {
        //Avert your gaze!
        Cc = Components.classes,
        Ci = Components.interfaces;
        Components.utils['import']('resource://gre/modules/FileUtils.jsm');
        xpcIsWindows = ('@mozilla.org/windows-registry-key;1' in Cc);

        text.get = function (url, callback) {
            var inStream, convertStream, fileObj,
                readData = {};

            if (xpcIsWindows) {
                url = url.replace(/\//g, '\\');
            }

            fileObj = new FileUtils.File(url);

            //XPCOM, you so crazy
            try {
                inStream = Cc['@mozilla.org/network/file-input-stream;1']
                           .createInstance(Ci.nsIFileInputStream);
                inStream.init(fileObj, 1, 0, false);

                convertStream = Cc['@mozilla.org/intl/converter-input-stream;1']
                                .createInstance(Ci.nsIConverterInputStream);
                convertStream.init(inStream, "utf-8", inStream.available(),
                Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);

                convertStream.readString(inStream.available(), readData);
                convertStream.close();
                inStream.close();
                callback(readData.value);
            } catch (e) {
                throw new Error((fileObj && fileObj.path || '') + ': ' + e);
            }
        };
    }
    return text;
});

define('text!app/view/tmpl/singleResult.tmpl',[],function () { return '<section>\n    <h3>[[= data.name]]</h3>\n    <ul class=\'list\' >\n        [[ for (var res in data.prices) { ]]\n        <li>\n            <h3>[[= res]]</h3>\n            <h3>£[[= data.prices[res].price.toFixed(2)]]</h3>\n        </li>\n        [[ } ]]\n    </ul>\n    <p>These prices may change by the vendors on subsequent scans</p>\n</section>';});

define('text!app/view/tmpl/searching.tmpl',[],function () { return '<section>\n    <h3>[[= data.barcode]]</h3>\n    <div class="carousel">\n        <div class="cell"><img src="img/logos/musicmagpie_no_bird.png"/></div>\n        <div class="cell"><img src="img/logos/zapper.png"/></div>\n        <div class="cell"><img src="img/logos/zumu.png"/></div>\n        <div class="cell"><img src="img/logos/cex.png"/></div>\n        <div class="mag-glass"><span class="glyphicon glyphicon-search"></span></div>\n    </div>\n</section>';});

define('app/view/singleResult',['chui', "app/eventBus", "text!app/view/tmpl/singleResult.tmpl", "text!app/view/tmpl/searching.tmpl"],
    function($, bus, singleResultTmpl, searchingTmpl) {

    singleResultTmpl = $.template(singleResultTmpl);

    function showResult(key, result) {
        $('#results').html(singleResultTmpl(result));
        $.UIGoToArticle('#results');
        //$.UINavigationHistory.push('#results');
        analytics.trackEvent('singleResult', 'Show', result.barcode);
    }

    bus.subscribe('barcodeResult', showResult);

    searchingTmpl = $.template(searchingTmpl);

    function showSearchScreen(key, result) {
        $('#searching').html(searchingTmpl(result));
        $.UIGoToArticle('#searching');
        //$.UINavigationHistory.push('#searching');
    }

    bus.subscribe('searchingForBarcode', showSearchScreen)

});
define('text!app/view/tmpl/bestPriceForAllVendors.tmpl',[],function () { return '<section>\n    <h3><span>You could make</span>£[[= data.totalPrice.toFixed(2)]]</h3>\n    <ul class=\'list\' >\n        [[ for (var item in data.results) {\n                if (data.results.hasOwnProperty(item) && data.results[item].bestVendors.length >= 1) {\n                    var bestVendor = data.results[item].bestVendors[0]; ]]\n        <li class="comp" data-barcode="[[= item]]">\n            <div>\n                <h3>[[= data.results[item].prices[bestVendor].title || data.results[item].name]]</h3>\n                <h4>[[= bestVendor]]</h4>\n            </div>\n            <aside>\n                <h4>£[[= data.results[item].prices[bestVendor].price.toFixed(2)]]</h4>\n                <span class="nav"></span>\n            </aside>\n        </li>\n        [[\n                }\n            } ]]\n    </ul>\n    <p>These prices may change by the vendors on subsequent scans</p>\n</section>';});

define(
    'app/view/bestPrice',["chui", "app/eventBus", "app/priceResultManager",
        "text!app/view/tmpl/bestPriceForAllVendors.tmpl"],

    function($, bus, priceManager, tmpl) {

        tmpl = $.template(tmpl);

        var skipUpdate = false;

        function handleItemDelete(item) {
            var item = $(item).parent('li');
            var barcode = item.dataset('barcode');
            analytics.trackEvent('bestPrice', 'Delete', barcode);
            priceManager.deleteItem(barcode);

            var newBestPrice = priceManager.getTotalBestPrice();
            var sectionHeader = $('#bestprice section > h3');
            var oldBestPrice = sectionHeader.text().split('£')[1];
            sectionHeader.html(sectionHeader.html().replace(oldBestPrice, newBestPrice.toFixed(2)));
            skipUpdate = true;
            bus.publish("priceResultRepoChange", priceManager);
            skipUpdate = false;
        }

        function updateDomForAllVendors() {
            if (!skipUpdate) {
                var result = {
                    results: priceManager.getAllResults(),
                    totalPrice: priceManager.getTotalBestPrice()
                };
                $('#bestprice').html(tmpl(result));

                $.UIDeletable({
                    list: '#bestprice ul',
                    callback: handleItemDelete
                });
            }
        }

        function handleSingleTap(event) {
            if ($(arguments[0].target).hasClass('deletion-indicator').length === 0 &&
                $(arguments[0].target).hasClass('delete').length === 0
                ) {
                var tappedLi = $(arguments[0].target).ancestor('li');
                var barcode = tappedLi.dataset('barcode');

                if (barcode) {
                    analytics.trackEvent('bestPrice', 'Show', barcode);
                    var data = priceManager.getAllResults()[barcode];
                    bus.publish('barcodeResult', data);
                }
            }
        }

        $('#bestprice').on('singletap', handleSingleTap);

        bus.subscribe('priceResultRepoChange', updateDomForAllVendors);

        updateDomForAllVendors();

    }
);
define('text!app/view/tmpl/byVendor.tmpl',[],function () { return '[[ for (var vendor in data.vendors) {\n        if (data.vendors.hasOwnProperty(vendor)) {\n        ]]\n    <section class="next">\n        <h3>[[= vendor]]: <span>£[[= data.vendors[vendor].totalPrice.toFixed(2)]]</span></h3>\n        <ul class=\'list\' >\n            [[ for (var item in data.results) {\n                if (data.results.hasOwnProperty(item) && data.results[item].prices[vendor]) {\n                    ]]\n            <li class="comp">\n                <div>\n                    <h3>[[= data.results[item].prices[vendor].title || data.results[item].name]]</h3>\n                </div>\n                <aside>\n                    <h4>£[[= data.results[item].prices[vendor].price.toFixed(2)]]</h4>\n                </aside>\n            </li>\n            [[\n                    }\n                } ]]\n        </ul>\n        <p>These prices may change by the vendors on subsequent scans</p>\n    </section>\n[[      }\n    } ]]';});

define('app/view/byVendor',['chui', "app/eventBus", "app/priceResultManager",
        "text!app/view/tmpl/byVendor.tmpl"],

    function($, bus, priceManager, tmpl) {

        tmpl = $.template(tmpl);

        function updateDomForAllVendors() {
            var result = {
                results: priceManager.getAllResults(),
                vendors: priceManager.getVendors()
            };
            $('#byvendor').html(tmpl(result));
            $('#byvendor > section:first-child').removeClass('next').addClass('current');
        }

        bus.subscribe('priceResultRepoChange', updateDomForAllVendors);

        $.UIPaging();
    }
);
require([
    'app/UIPagingPatch',
    'app/view/barcodeForm', 'app/view/tabbar',
    'app/view/singleResult', 'app/priceResultManager',
    'app/view/bestPrice', 'app/view/byVendor'
]);
define("priceCheckerApp.js", function(){});
}());