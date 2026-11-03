'use strict';
/*
 * The starter app: shows the screens of screens.json (made in the Designer) inside the HMI page and reacts to them.
 * Replace screens.json and images/ (in app/) with a Designer download, then change the handlers below to match its
 * screens, elements and actions. Node 8: no ?. or ??, CommonJS; the runtime and the kit are required by file name
 * (the OAP linker links every module of mgu-app.json flat, by its file name: a quoted require names a module).
 *
 * The runtime (lib/mgu_runtime.js) reports:
 *   action  { screen, element, action, value? }   the driver selected an element (a field: with the typed text)
 *   screen  { screen, from, by }                   a link, BACK or this code changed the screen
 * and takes: rt.set(screen, element, value), rt.open(screen), rt.screen(), rt.setLanguage(code).
 * Links (a screen's nav), BACK, the controller, touch, the keyboard screen and the car's language are handled for you.
 */
const fs = require('fs');
const path = require('path');
const OnlineApp = require('oap-sdk/src/core/OnlineApp.js');
const logging = require('oap-sdk/src/logging/logging');
const someipBuilders = require('oap-sdk/src/someip/someipBuilders');
const { RenderClient } = require('./mgu_render_client.js');
const { startApp } = require('./mgu_oap.js');

const log = logging.getSDKLogger();
// The package's folder: the bundle runs from its javascript/ folder, screens.json and images/ are beside that.
const DIR = path.join(__dirname, '..');
const APP_ID = JSON.parse(fs.readFileSync(path.join(DIR, 'package.json'), 'utf8')).name;

const app = startApp({ OnlineApp, someipBuilders, RenderClient, log, appId: APP_ID, dir: DIR });
const rt = app.runtime;

// What the app knows; the screens show it.
const data = { refreshes: 0, night: false, brightness: 60, driver: '' };

function clock() {
    const d = new Date();
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
}

if (rt) {
    rt.on('action', (a) => {
        log.info('action ' + a.screen + '/' + a.element + ': ' + a.action);
        switch (a.action) {
            case 'refresh':
                data.refreshes++;
                rt.set('home', 'refreshes', data.refreshes);
                rt.set('home', 'status', 'Refreshed at ' + clock());
                break;
            case 'night':                       // a toggle shows what the app sets
                data.night = !data.night;
                rt.set('settings', 'night', data.night);
                break;
            case 'brightness':                  // each press: 20 % more, round to 0
                data.brightness = data.brightness >= 100 ? 0 : data.brightness + 20;
                rt.set('settings', 'brightness', data.brightness);
                break;
            case 'driver':                      // the field's typed text (the field shows it already)
                data.driver = a.value;
                break;
            default:                            // 'settings' and 'done' are links: the runtime opens their screens
                break;
        }
    });

    rt.on('screen', (s) => {
        log.info('screen ' + s.screen + ' (' + s.by + ')');
        if (s.screen === 'home' && data.driver) rt.set('home', 'status', 'Hello, ' + data.driver);
        if (s.screen === 'settings') {          // load the screen's data as it opens
            rt.set('settings', 'night', data.night);
            rt.set('settings', 'brightness', data.brightness);
        }
    });
}
