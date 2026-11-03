'use strict';
/**
 * A made-up donor for the starter app's packing tests, after mgu-store's tools/test/synthetic_donor.js: a browserify
 * bundle (browserify's own prelude, MIT) whose modules stand in for the oap-sdk under the require names the starter's
 * mgu-app.json lists. No SDK code. Its OnlineApp starts without an RHMI application (as for a background start),
 * says "initialized" on stdout and exits shortly after, so a linked app can be run once under Node 8.
 *
 *   donor.bundle()                  the bundle text
 */
const PRELUDE = '(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;' +
    'if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module \'"+i+"\'");throw a.code="MODULE_NOT_FOUND",a}' +
    'var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}' +
    'return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()';

const MODULES = [
    [1, 'require("oap-sdk/src/core/OnlineApp.js");require("oap-sdk/src/logging/logging");require("oap-sdk/src/someip/someipBuilders");',
        '{"oap-sdk/src/core/OnlineApp.js":2,"oap-sdk/src/logging/logging":3,"oap-sdk/src/someip/someipBuilders":4}'],
    [2, '"use strict";var EventEmitter=require("events");' +
        'class OnlineApp extends EventEmitter{start(){var s=this;setImmediate(function(){s.emit("initialized")});return Promise.resolve()}' +
        'initialized(){process.stdout.write("initialized\\n");setTimeout(function(){process.exit(0)},300);return Promise.resolve()}}' +
        'module.exports=OnlineApp;',
        '{"events":undefined}'],
    [3, '"use strict";var l={info:function(m){process.stdout.write("info "+m+"\\n")},warn:function(m){process.stdout.write("warn "+m+"\\n")},' +
        'error:function(m){process.stdout.write("error "+m+"\\n")}};exports.getSDKLogger=function(){return l};', '{}'],
    [4, '"use strict";exports.buildTypedProxy=function(){return Promise.reject(new Error("no SOME/IP here"))};', '{}'],
];

function bundle() {
    return `${PRELUDE}({${MODULES.map((m) => `${m[0]}:[function(require,module,exports){\n${m[1]}\n},${m[2]}]`).join(',')}},{},[1]);\n`;
}

module.exports = { bundle };
