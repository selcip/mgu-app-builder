// Screen files for stories and tests: each made by the document model's own operations, so each is a document the
// Designer could have made. Every one shows the panels a case they must handle.
import { apply, newDocument, type Doc, type Op } from '../model/index.ts';

const build = (ops: Op[], doc: Doc = newDocument()): Doc => ops.reduce((d, op) => apply(d, op), doc);

/** A 1 × 1 transparent PNG. */
const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));

/** One empty screen: what a new design starts as. */
export const empty: Doc = newDocument();

/** A small app: a home screen linking to settings and about, a custom focus order, a picture in use. */
export const typical: Doc = build([
    { type: 'renameScreen', screen: 'main', name: 'home' },
    { type: 'setText', screen: 'home', value: 'Home' },
    { type: 'addScreen', name: 'settings', title: 'Settings' },
    { type: 'addScreen', name: 'about', title: 'About' },
    { type: 'addElement', screen: 'home', widget: 'text', name: 'heading', x: 40, y: 30 },
    { type: 'addElement', screen: 'home', widget: 'button', name: 'toSettings', x: 40, y: 150 },
    { type: 'addElement', screen: 'home', widget: 'button', name: 'toAbout', x: 440, y: 150 },
    { type: 'addElement', screen: 'home', widget: 'image', name: 'logo', x: 1580, y: 30 },
    { type: 'setOption', screen: 'home', element: 'toSettings', key: 'text', value: 'Settings' },
    { type: 'setOption', screen: 'home', element: 'toAbout', key: 'text', value: 'About' },
    { type: 'setLink', screen: 'home', action: 'toSettings', to: 'settings' },
    { type: 'setLink', screen: 'home', action: 'toAbout', to: 'about' },
    { type: 'moveInFocus', screen: 'home', element: 'toAbout', to: 0 },
    { type: 'uploadPicture', screen: 'home', element: 'logo', key: 'src', path: 'images/logo.png', bytes: PNG },
    { type: 'addElement', screen: 'settings', widget: 'row', name: 'fog', x: 48, y: 150 },
    { type: 'addElement', screen: 'settings', widget: 'button', name: 'back', x: 48, y: 500 },
    { type: 'setLink', screen: 'settings', action: 'back', to: 'home' },
]);

/** Links to screens that no longer exist: about was deleted after home and settings linked to it. */
export const deadLinks: Doc = build([
    { type: 'setLink', screen: 'settings', action: 'back', to: 'about' },
    { type: 'deleteScreen', screen: 'about' },
], typical);

/** Pictures named by elements but not in the design, beside one that is and one unused. */
export const missingImages: Doc = build([
    { type: 'addElement', screen: 'home', widget: 'image', name: 'banner', x: 40, y: 300 },
    { type: 'setOption', screen: 'home', element: 'banner', key: 'src', value: 'images/banner.png' },
    { type: 'addElement', screen: 'about', widget: 'image', name: 'photo', x: 40, y: 150 },
    { type: 'setOption', screen: 'about', element: 'photo', key: 'src', value: 'images/team.png' },
    { type: 'addImage', path: 'images/unused.png', bytes: PNG },
], typical);

/** Texts in English and German: German translations missing, and characters the kit's fonts can't draw. */
export const textIssues: Doc = build([
    { type: 'addLanguage', code: 'en' },
    { type: 'addLanguage', code: 'de' },
    { type: 'setText', screen: 'home', element: 'toSettings', key: 'text', language: 'de', value: 'Einstellungen' },
    { type: 'setText', screen: 'home', element: 'heading', key: 'text', value: 'Welcome 🚗' },
    { type: 'setText', screen: 'settings', element: 'fog', key: 'label', language: 'de', value: 'Nebelscheinwerfer ✓' },
], typical);

export const SCREEN_FILES = { empty, typical, deadLinks, missingImages, textIssues } as const;
