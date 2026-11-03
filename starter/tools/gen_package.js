'use strict';
/**
 * Writes the starter app's OAP package tree (app/) around the files the author keeps there (screens.json, images/):
 * package.json and npm-shrinkwrap.json from mgu-app.json (id, version), permissions.json, manifest.json (the SOME/IP
 * proxies an iDrive 7 OnlineApp with a page, the display language and FrontCCU uses), config/base.json, and the RHMI
 * description: rhmiData/application.json (the tile: tile.json's title, tile.png; uuids made from the app id), the
 * page states of lib/mgu_oap.js (PAGE: one state per depth on the page template LT_State_A4A_WelcomeApp, each the
 * parent of the next, with a title and hidden focusable proxy buttons) in uiDescriptions/ID7/{application.xml,
 * uiDescription.json}, and the tile's text in variantGroups/Common/texts/en_GB.json.
 *
 *   node tools/gen_package.js            (tools/build.js runs it)
 *
 * files(appDir) returns every generated file (path under the tree -> Buffer) without writing anything.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const HERE = path.join(__dirname, '..');

/* Where the tile goes in the HMI's menu, as the Store's (apps/robertn_store's application.json). */
const INSERTION = { insertionStateId: 20974, insertionFocusId: 2, insertionMode: 'INSERT_BELOW', insertionOrder: 0,
    insertionPriority: 0 };

const MANIFEST = {
    proxies: {
        'de.bmw.infotainment.telematic.oapcontroller.OAPController': '*',
        'de.bmw.infotainment.hmi.remote.RemoteHmi': '*',
        'de.bmw.infotainment.hmi.remote.RemoteHmiApplication': '*',
        'de.bmw.infotainment.hmi.entrypoint.EntryPoint': '*',
        'de.bmw.infotainment.hmi.entrypoint.EntryPointManager': '*',
        'de.bmw.infotainment.hmi.resourcemanagement.ResourceManager': '*',
        'de.bmw.infotainment.hmi.resourcemanagement.ResourceBundle': '*',
        'de.bmw.infotainment.hmi.resourcemanagement.StringBundle': '*',
        'de.bmw.infotainment.telematic.oap.PrivateEntryPoint': { instances: ['${userId}'],
            methods: ['registerEntryPoint', 'unregisterEntryPoint', 'setSelected', 'setAvailability'] },
        'de.bmw.infotainment.telematic.oap.AppBookmarks': { instances: ['${userId}'], methods: ['registerBookmark'] },
        'de.bmw.infotainment.telematic.oap.WakeUpOnDemand': { instances: ['${userId}'],
            methods: ['registerParticipant', 'unregisterParticipant'] },
        'de.bmw.infotainment.telematic.oap.WodControl': { instances: '${userId}', methods: ['offerService', 'stopOfferingService'] },
        'de.bmw.infotainment.telematic.provisioning.Provisioning': { instances: '1', broadcasts: ['provisioningDataJSON'],
            methods: ['getValueJSON', 'setFilterForProvisioningData'] },
        'de.bmw.infotainment.vehicle.Vehicle': '*',
        'de.bmw.infrastructure.EnvironmentalInformation': '*',
        'de.bmw.infotainment.certification.Certification': '*',
        'de.bmw.infotainment.hmi.usecasemanagement.UseCaseInstance': '*',
        'de.bmw.infotainment.hmi.usecasemanagement.UseCaseProvider': '*',
        'de.bmw.infotainment.hmi.usecasemanagement.UseCaseRegistry': '*',
        'de.bmw.infotainment.controlelements.FrontCCU': { instances: ['1'], attributes: { statusRotaryEncoderState: 'rs' } },
        'de.bmw.infotainment.hmi.hmicontext.HMIContext': { instances: ['HMI_CID'], attributes: { currentDisplayLanguage: 'rs' } },
    },
    services: { 'de.bmw.infotainment.telematic.oap.AppStatus': { instances: ['${userId}'] } },
};

function access(domain, iface) {
    return { _typeName: 'joynr.infrastructure.DacTypes.MasterAccessControlEntry', uid: '${APPNAME}', domain,
        interfaceName: iface, defaultRequiredTrustLevel: 'HIGH', possibleRequiredTrustLevels: [],
        defaultRequiredControlEntryChangeTrustLevel: 'HIGH', possibleRequiredControlEntryChangeTrustLevels: [],
        operation: '*', defaultConsumerPermission: 'YES', possibleConsumerPermissions: [] };
}

const PERMISSIONS = {
    masterAccessTable: [
        access('de.bmw.infotainment.telematic.oap.oapcontroller', 'de/bmw/infotainment/telematic/oapcontroller/OAPController'),
        access('de.bmw.infotainment.telematic.oap.appStatus_${APPNAME}', 'de/bmw/infotainment/telematic/oap/appstatus/AppStatus'),
        access('de.bmw.infotainment.telematic.oap.appstart', 'de/bmw/infotainment/telematic/oap/appstart/AppStart'),
        access('de.bmw.infotainment.telematic.oap.privateEntryPoint_${APPNAME}',
            'de/bmw/infotainment/telematic/oap/privateentrypoint/PrivateEntryPoint'),
    ],
    mediatorAccessTable: [],
    ownerAccessTable: [],
    masterRegistrationTable: [{ _typeName: 'joynr.infrastructure.DacTypes.MasterRegistrationControlEntry', uid: '${APPNAME}',
        domain: 'de.bmw.infotainment.telematic.oap.heartbeat_${APPNAME}',
        interfaceName: 'de/bmw/infotainment/telematic/oap/heartbeat/HeartbeatMonitor', defaultRequiredTrustLevel: 'HIGH',
        possibleRequiredTrustLevels: [], defaultRequiredControlEntryChangeTrustLevel: 'HIGH',
        possibleRequiredControlEntryChangeTrustLevels: [], defaultProviderPermission: 'YES', possibleProviderPermissions: [] }],
    mediatorRegistrationTable: [],
    ownerRegistrationTable: [],
    domainRoleTable: [],
};

/** A stable uuid for one of the app's RHMI ids: an app copied under another id gets its own. */
function uuid(id, what) {
    const h = crypto.createHash('sha1').update(`mgu-ui-builder:${id}:${what}`).digest('hex');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${(8 | (parseInt(h[16], 16) & 3)).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/* The page states, as lib/mgu_oap.js names them. Ids: state d is container d, its layout groups 100 + 2d and
 * 101 + 2d, its title component 10 + d, its proxies 1000 + 100 (d - 1) + i. */
function states(PAGE) {
    const out = [];
    for (let d = 1; d <= PAGE.depths; d++) {
        const proxies = [];
        for (let i = 0; i < PAGE.proxies; i++) proxies.push({ id: 1000 + 100 * (d - 1) + i, name: PAGE.proxy(d, i) });
        out.push({ id: d, name: PAGE.state(d), title: { id: 10 + d, name: PAGE.title(d) }, parent: d > 1 ? d - 1 : null, proxies });
    }
    return out;
}

function xml(PAGE) {
    const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<application>'];
    states(PAGE).forEach((s) => {
        lines.push(`    <container id="${s.id}" type="state" widget="LT_State_A4A_WelcomeApp">`);
        if (s.parent) lines.push(`        <property id="9" value="${s.parent}"/>`);
        lines.push(`        <layoutGroup id="${100 + 2 * s.id}" name="Titlebar">`,
            `            <component id="${s.title.id}" type="title">`,
            '                <property id="2" value="1"/>',
            '            </component>',
            '        </layoutGroup>',
            `        <layoutGroup id="${101 + 2 * s.id}" name="List">`,
            '            <property id="3" value="1"/>');
        s.proxies.forEach((p) => lines.push(`            <component id="${p.id}" type="button" widget="LT_Button_1Row">`,
            '                <property id="2" value="1"/>',
            '                <property id="3" value="3"/>',
            '            </component>'));
        lines.push('        </layoutGroup>', '    </container>');
    });
    lines.push('</application>', '');
    return lines.join('\n');
}

function uiDescription(PAGE) {
    const containers = {};
    states(PAGE).forEach((s) => {
        const components = {};
        components[s.title.id] = { type: 'title', name: s.title.name, properties: { Visible: { value: 1, type: 'UInt' } },
            rows: [{ Text: { value: 'SID_APP_TITLE', type: 'StringId' } }] };
        s.proxies.forEach((p) => {
            components[p.id] = { type: 'button', name: p.name,
                properties: { Visible: { value: 1, type: 'UInt' }, Focusable: { value: 3, type: 'UInt' } },
                rows: [{ Text: { value: '', type: 'Text' } }] };
        });
        containers[s.id] = Object.assign({ type: 'state', name: s.name },
            s.parent ? { properties: { ParentState: { value: s.parent, type: 'UInt' } } } : {}, { components });
    });
    return { schemaVersion: '1.3.0', containers };
}

const json = (v) => Buffer.from(JSON.stringify(v, null, 2) + '\n');

/** Every generated file of the tree: path under app/ -> Buffer. */
function files(dir) {
    dir = dir || HERE;
    const m = JSON.parse(fs.readFileSync(path.join(dir, 'mgu-app.json'), 'utf8'));
    const tile = JSON.parse(fs.readFileSync(path.join(dir, 'tile.json'), 'utf8'));
    const PAGE = require(path.join(dir, 'lib', 'mgu_oap.js')).PAGE;
    const tree = path.join(dir, m.tree);
    const hasImages = fs.existsSync(path.join(tree, 'images'));
    const out = {};
    out['package.json'] = json({
        name: m.id,
        version: m.version,
        description: tile.title,
        private: false,
        main: 'javascript/runner.js',
        oapAppSettings: { maxDiskUsage: 26214400, cpuLimit: 30, memoryThresholdKB: 131072, priority: 'PRIO_MEDIUM',
            visibility: 'FOREGROUND', latencyClass: 'FOREGROUND',
            loggingId: (m.id.replace(/[^A-Za-z0-9]/g, '').toUpperCase() + 'APPX').slice(0, 4),
            userLoginRequired: false, backgroundPriority: 150, someipManifest: 'manifest.json' },
        files: ['config', 'rhmiData', 'package.json', 'npm-shrinkwrap.json', 'permissions.json', 'javascript', 'manifest.json',
            'screens.json'].concat(hasImages ? ['images'] : []),
        dependencies: { 'oap-sdk': '24.10.2' },
        engines: { node: '>=8.7.0' },
        mguLocalOnly: true,
        mguHmi: ['ID7'],
    });
    out['npm-shrinkwrap.json'] = json({ name: m.id, version: m.version, lockfileVersion: 1, requires: true, dependencies: {} });
    out['permissions.json'] = json(PERMISSIONS);
    out['manifest.json'] = json(MANIFEST);
    out['config/base.json'] = json({});
    out['rhmiData/application.json'] = json({
        schemaVersion: '1.3.0',
        application: {
            uuid: uuid(m.id, 'application'), type: 'OnlineApp', name: m.id, vendor: tile.vendor || 'owner', version: m.version,
            defaultLanguage: 'en_GB',
            uiDescriptions: [{ applicationFilePath: './uiDescriptions/ID7/application.xml',
                uiDescriptionFilePath: './uiDescriptions/ID7/uiDescription.json', hmi: ['ID7'] }],
            stringBundleUuid: uuid(m.id, 'strings'), resourceBundleUuid: uuid(m.id, 'resources'),
            variantGroups: [{ stringsPath: './variantGroups/Common/texts', resourcesPath: './variantGroups/Common/images',
                hmi: ['ID7'], brands: ['BMW'] }],
            entryPoints: [Object.assign({ name: m.id, uuid: uuid(m.id, 'entry'), textId: 'SID_APP_TITLE', icon: 'tile.png' },
                INSERTION, { previewType: 'NONE', bookmarkable: true, private: null, appearance: 'DEFAULT', isGroupHeader: false,
                    insertionGroup: 0 })],
        },
    });
    out['rhmiData/uiDescriptions/ID7/application.xml'] = Buffer.from(xml(PAGE));
    out['rhmiData/uiDescriptions/ID7/uiDescription.json'] = json(uiDescription(PAGE));
    out['rhmiData/variantGroups/Common/texts/en_GB.json'] = json({ SID_TEMP_EMPTY: '', SID_APP_TITLE: tile.title });
    out['rhmiData/variantGroups/Common/images/tile.png'] = fs.readFileSync(path.join(dir, 'tile.png'));
    return out;
}

/** Writes the generated files into the tree; returns their paths. */
function write(dir) {
    dir = dir || HERE;
    const m = JSON.parse(fs.readFileSync(path.join(dir, 'mgu-app.json'), 'utf8'));
    const f = files(dir);
    Object.keys(f).forEach((rel) => {
        const to = path.join(dir, m.tree, rel);
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.writeFileSync(to, f[rel]);
    });
    return Object.keys(f);
}

if (require.main === module) {
    console.log(`wrote ${write().length} files of the package tree`);
}

module.exports = { files, write, uuid };
