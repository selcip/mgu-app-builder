'use strict';
// `net` for the vendored cluster_render_client.js: connect(path) is an in-memory pipe into a renderer
// (bench/render_protocol.js createRenderer), no socket. The host listens on a made-up path; the client's bytes go into
// the renderer's connection, the renderer's events come back as 'data'. Delivery is asynchronous, as on a socket.
const EventEmitter = require('./events.js');

const listeners = new Map();   // path -> renderer

class Pipe extends EventEmitter {
    constructor() { super(); this.dead = false; }
    write(buf) {
        if (!this.dead && this.conn) this.conn.feed(Buffer.from(buf));
        return true;
    }
    destroy() { this._end(); }
    _end() {
        if (this.dead) return;
        this.dead = true;
        if (this.conn) this.conn.close();
        Promise.resolve().then(() => this.emit('close'));
    }
}

module.exports = {
    connect(path) {
        const sock = new Pipe();
        const renderer = listeners.get(path);
        Promise.resolve().then(() => {
            if (sock.dead) return;
            if (!renderer) { sock.emit('error', new Error('connect ENOENT ' + path)); sock._end(); return; }
            sock.conn = renderer.connect(
                (buf) => { if (!sock.dead) Promise.resolve().then(() => { if (!sock.dead) sock.emit('data', buf); }); },
                () => sock._end());
            sock.emit('connect');
        });
        return sock;
    },
    /** The host's side: `renderer` answers on `path`. */
    host: {
        listen(path, renderer) { listeners.set(path, renderer); },
        close(path) { listeners.delete(path); },
    },
};
