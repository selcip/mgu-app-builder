'use strict';
// The part of Node's `events` the vendored engine uses (cluster_render_client.js extends EventEmitter and calls on/emit),
// so the same file runs in the browser bundle and in Node's tests.
class EventEmitter {
    constructor() { this._ev = {}; }
    on(name, fn) { (this._ev[name] = this._ev[name] || []).push(fn); return this; }
    addListener(name, fn) { return this.on(name, fn); }
    once(name, fn) {
        const w = (...a) => { this.off(name, w); fn.apply(this, a); };
        w.listener = fn;
        return this.on(name, w);
    }
    off(name, fn) {
        const l = this._ev[name];
        if (l) this._ev[name] = l.filter((f) => f !== fn && f.listener !== fn);
        return this;
    }
    removeListener(name, fn) { return this.off(name, fn); }
    removeAllListeners(name) { if (name === undefined) this._ev = {}; else delete this._ev[name]; return this; }
    listenerCount(name) { return (this._ev[name] || []).length; }
    emit(name, ...args) {
        const l = this._ev[name];
        if (!l || !l.length) return false;
        l.slice().forEach((f) => f.apply(this, args));
        return true;
    }
}
module.exports = EventEmitter;
module.exports.EventEmitter = EventEmitter;
