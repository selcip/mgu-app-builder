'use strict';
/*
 * mgu_oap.js - an OAP app around the runtime: the oap-sdk's OnlineApp, the HMI's page (its RHMI states on the page
 * template, see mgu_headunit.js) and the render client, in one call. Node 8, CommonJS, flat module names. The app's
 * entry passes the oap-sdk modules in, so only the entry requires them (the OAP linker links them from a donor):
 *
 *   const app = startApp({
 *       OnlineApp: require('oap-sdk/src/core/OnlineApp.js'),
 *       someipBuilders: require('oap-sdk/src/someip/someipBuilders'),
 *       log: require('oap-sdk/src/logging/logging').getSDKLogger(),
 *       RenderClient: require('./mgu_render_client.js').RenderClient,
 *       appId: 'my_app', title: 'My app', dir: path.join(__dirname, '..'),     // the folder of screens.json and images/
 *   });
 *   app.runtime.on('action', (a) => ...);    // the runtime (mgu_runtime.js); null if screens.json was refused
 *
 * The app's RHMI description (written by the starter's tools/gen_package.js from PAGE below) has PAGE.depths states
 * on LT_State_A4A_WelcomeApp, ST_OnlineApps_MguPage1..n, each the parent of the next, each with a title and
 * PAGE.proxies hidden focusable buttons (mguPage<depth>P<i>). State 1 is the entry state: the app's tile opens it.
 * The HMI's display language comes from HMIContext (iDrive 7: HMIContext, instance HMI_CID), the controller without
 * the renderer's gate from FrontCCU (instance 1), both through someipBuilders, when the HMI offers them.
 */
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const { runOnHeadUnit } = require('./mgu_headunit.js');

const PAGE = {
    depths: 4,
    proxies: 48,        // the keyboard screen has 47 keys
    state: (d) => 'ST_OnlineApps_MguPage' + d,
    title: (d) => 'ST_OnlineApps_MguPage' + d + '_Title',
    proxy: (d, i) => 'mguPage' + d + 'P' + i,
};
const HMI_CONTEXT = ['de.bmw.infotainment.hmi.hmicontext.HMIContext', 'HMI_CID'];
const FRONT_CCU = ['de.bmw.infotainment.controlelements.FrontCCU', '1'];
const PRESS_DEDUPE_MS = 400;    // a press arrives both as the component's action and as the raw userEvent
const VALUE_KEY = 0;            // a raw FOCUS userEvent's value, as the Store reads it
const FOREGROUND_REASONS = ['ENTRY_POINT', 'LUM', 'BOOKMARK', 'START_WIDGET', 'TRIGGER_HMI', 'SPEECH_COMMAND'];

function isTrue(raw) {
    return raw === true || raw === 'true' || raw === 1 || raw === '1';
}

/**
 * The HMI's page (the interface mgu_headunit.js drives) over an RHMI application, once bound. `title` is drawn in
 * the title bar of a screen without a title of its own.
 */
function createPage(log, title) {
    const page = new EventEmitter();
    page.depths = PAGE.depths;
    page.proxyCount = PAGE.proxies;
    let rhmi = null;
    const comps = {};
    const written = {};
    const pressedAt = {};

    function warn(what) {
        return (err) => log.warn('mgu-oap: ' + what + ': ' + (err && err.message || err));
    }
    function write(name, key, value, fn) {
        const c = comps[name];
        if (!c || written[name + '.' + key] === value) return;
        written[name + '.' + key] = value;
        Promise.resolve().then(() => fn(c)).catch(warn(name + ' ' + key));
    }
    function press(d, i) {
        const now = Date.now();
        const key = d + '.' + i;
        if (now - (pressedAt[key] || 0) < PRESS_DEDUPE_MS) return;
        pressedAt[key] = now;
        page.emit('proxyPress', d, i);
    }

    page.open = (d) => { if (rhmi) Promise.resolve(rhmi.openState(PAGE.state(d))).catch(warn('open ' + PAGE.state(d))); };
    page.close = (d) => { if (rhmi) Promise.resolve(rhmi.closeState(PAGE.state(d))).catch(warn('close ' + PAGE.state(d))); };
    page.leave = () => {
        for (let d = PAGE.depths; d >= 1; d--) page.close(d);
    };
    page.title = (d, text) => write(PAGE.title(d), 'Text', text || title || '', (c) => c.setValue(0, 'Text', text || title || '', 'Text'));
    page.proxies = (d, labels) => {
        for (let i = 0; i < PAGE.proxies; i++) {
            const name = PAGE.proxy(d, i);
            if (i < labels.length) write(name, 'Text', labels[i], (c) => c.setValue(0, 'Text', labels[i], 'Text'));
            write(name, 'Visible', i < labels.length, (c) => c.setProperty('Visible', i < labels.length ? 1 : 0, 'UInt'));
        }
    };

    /** Binds the page to the app's RHMI application; resolves once the states' resources are up. */
    page.bind = (app) => {
        const r = app.rhmiApplication;
        const byId = {};
        for (let d = 1; d <= PAGE.depths; d++) {
            const names = [PAGE.state(d), PAGE.title(d)];
            for (let i = 0; i < PAGE.proxies; i++) names.push(PAGE.proxy(d, i));
            for (let k = 0; k < names.length; k++) {
                comps[names[k]] = r.getByName(names[k]);
                if (!comps[names[k]]) return Promise.reject(new Error('the RHMI description has no ' + names[k]));
            }
        }
        for (let d = 1; d <= PAGE.depths; d++) {
            const depth = d;
            const st = comps[PAGE.state(d)];
            st.on('visible', (ev) => page.emit('visible', depth, isTrue(ev && ev.visible)));
            st.on('focus', (ev) => page.emit('focus', depth, isTrue(ev && ev.focus)));
            for (let i = 0; i < PAGE.proxies; i++) {
                const n = i;
                const c = comps[PAGE.proxy(d, i)];
                const onFocus = (on) => { if (on) page.emit('proxyFocus', depth, n); };
                let id = null;
                try { id = c.getId(); } catch (e) { id = null; }
                if (id !== null && id !== undefined) byId[Number(id)] = { press: () => press(depth, n), focus: onFocus };
                c.on('action', () => press(depth, n));
                c.on('focus', (ev) => onFocus(isTrue(ev && ev.value)));
            }
        }
        r.on('userEvent', (ev) => {
            const p = ev && byId[Number(ev.sourceId)];
            if (!p) return;
            if (ev.eventType === 'ACTION') p.press();
            else if (ev.eventType === 'FOCUS') p.focus(isTrue((ev.parameterMap || {})[VALUE_KEY]));
        });
        r.on('restoreHmi', () => {      // the HMI lost what the app wrote: write it again
            Object.keys(written).forEach((k) => { delete written[k]; });
            page.emit('restore');
        });
        rhmi = r;
        const states = [];
        for (let d = 1; d <= PAGE.depths; d++) states.push(comps[PAGE.state(d)]);
        return Promise.all(states.map((s) => s.updateResources && s.updateResources()));
    };
    page.entryState = () => comps[PAGE.state(1)];
    return page;
}

/** Subscribes `attribute` of a SOME/IP interface [name, instance] through someipBuilders; fn gets every value. */
function subscribe(someipBuilders, iface, attribute, fn, log, read) {
    let proxy;
    return Promise.resolve()
        .then(() => someipBuilders.buildTypedProxy(iface[0], iface[1]))
        .then((p) => { proxy = p; return proxy.init(); })
        .then(() => proxy.waitUntilAvailable())
        .then(() => proxy[attribute].subscribe(fn))
        .then(() => (read ? proxy[attribute].getValue() : undefined))
        .then((v) => { if (read && v !== undefined) fn(v); })
        .catch((err) => log.warn('mgu-oap: ' + iface[0] + ' ' + attribute + ' unavailable: ' + (err && err.message || err)));
}

/**
 * Starts the app: see the header. opts: { OnlineApp, someipBuilders, RenderClient, log, appId, title, dir (screens.json
 * and images/), kit (kit_record.js, optional), exit (process.exit by default) }. Returns { runtime, app, page, client }.
 */
function startApp(opts) {
    const log = opts.log || console;
    const dir = opts.dir;
    const page = createPage(log, opts.title);
    const kitRecord = opts.kit || require('./kit_record.js');
    const client = new opts.RenderClient(opts.appId, log, { kit: kitRecord, mode: 'embed' });
    let screens = null;
    try { screens = fs.readFileSync(path.join(dir, 'screens.json'), 'utf8'); } catch (e) { log.error('mgu-oap: ' + e.message); }
    const runtime = screens === null ? null : runOnHeadUnit({ client, page, screens, dir, log });
    const exit = opts.exit || ((code) => process.exit(code));

    class App extends opts.OnlineApp {
        constructor() {
            super();
            this._visible = 0;
            this._shutdown = null;
            this.on('initialized', () => this._init().catch((err) => log.error('mgu-oap: start failed: ' + (err && err.message || err))));
            this.on('shutdown', (reason) => this._stop(reason));
            this.on('error', (err) => log.warn('mgu-oap: OnlineApp error: ' + (err && err.message || err)));
            this.on('entryPointExecute', (uuid) => this._enter(uuid));
        }

        _init() {
            if (!this.rhmiApplication) {
                log.info('mgu-oap: no RHMI for this start reason; starting without a page');
                return Promise.resolve(this.initialized());
            }
            const data = this.getVisibilityData && this.getVisibilityData();
            const foreground = FOREGROUND_REASONS.indexOf((data && data.reason) || this.startReason) >= 0;
            const shown = {};
            page.on('visible', (d, on) => {
                shown[d] = on;
                this._report(Object.keys(shown).some((k) => shown[k]));
            });
            return page.bind(this)
                .then(() => {
                    subscribe(opts.someipBuilders, HMI_CONTEXT, 'currentDisplayLanguage', (v) => page.emit('language', v), log, true);
                    subscribe(opts.someipBuilders, FRONT_CCU, 'statusRotaryEncoderState', (s) => page.emit('frontCcu', s), log, false);
                })
                .then(() => this._entryPoint())
                .then(() => { if (foreground && this.registerActive) this.registerActive(); })
                .then(() => this.initialized())
                .then(() => {
                    const uuid = this.getLastExecutedEntryPointUuid && this.getLastExecutedEntryPointUuid();
                    return uuid ? this._enter(uuid) : undefined;
                });
        }

        /** Maps the app's tile (application.json's entry point, handed over by the manager) to the entry state. */
        _entryPoint() {
            const described = (this.appDescription && this.appDescription.application.entryPoints) || [];
            const ours = (this.getEntryPoints ? this.getEntryPoints() : []).filter((ep) =>
                described.some((d) => d.uuid === ep.getDescription().uuid))[0];
            if (!ours) {
                log.warn('mgu-oap: no entry point handed over by the manager');
                return Promise.resolve();
            }
            const d = ours.getDescription();
            return Promise.resolve(ours.init())
                .then(() => this.rhmiApplication.mapEntryState(d.uuid, page.entryState()))
                .then(() => Promise.resolve()
                    .then(() => ours.entryPoint.setText(d.textId))
                    .then(() => (d.icon ? ours.entryPoint.setIcon(d.icon) : undefined))
                    .catch((err) => log.warn('mgu-oap: entry point text/icon: ' + (err && err.message || err))))
                .then(() => ours.setAvailability('ENABLED'));
        }

        _enter(uuid) {
            if (this._shutdown || !this.rhmiApplication || !uuid) return Promise.resolve();
            return Promise.resolve(this.rhmiApplication.openEntryState(uuid))
                .catch((err) => log.warn('mgu-oap: openEntryState failed: ' + (err && err.message || err)));
        }

        /** The app status the manager keeps: active and HMI-visible while a page state shows. */
        _report(visible) {
            if (visible === !!this._visible || this._shutdown) return;
            this._visible = visible;
            const calls = visible ? ['registerActive', 'registerHmiVisible'] : ['unregisterHmiVisible', 'registerInactive'];
            calls.forEach((m) => {
                if (typeof this[m] !== 'function') return;
                Promise.resolve().then(() => this[m]()).catch((err) => log.warn('mgu-oap: ' + m + ': ' + (err && err.message || err)));
            });
        }

        _stop(reason) {
            if (this._shutdown) return this._shutdown;
            log.info('mgu-oap: shutting down (' + reason + ')');
            client.close();
            this._shutdown = Promise.resolve()
                .then(() => (this.destroyBundles ? this.destroyBundles() : undefined))
                .catch((err) => log.info('mgu-oap: destroyBundles: ' + (err && err.message || err)))
                .then(() => exit(0));
            return this._shutdown;
        }
    }

    const app = new App();
    Promise.resolve().then(() => app.start()).catch((err) => log.error('mgu-oap: failed to start: ' + (err && err.message || err)));
    return { runtime, app, page, client };
}

module.exports = { startApp, createPage, PAGE };
