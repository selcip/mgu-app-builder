# Starter app

A minimal iDrive 7 app that shows the screens of a screen file made in the Designer inside the HMI's page, drawn by
mgu-render, and reacts to them. Copy this folder to start an app.

| File | What it is |
|---|---|
| `main.js` | the example entry: starts the app, handles actions, loads a screen's data as it opens, sets values |
| `app/screens.json`, `app/images/` | the screen file and its pictures: replace them with a Designer download |
| `mgu-app.json` | the app's id and version, its modules (the entry first) and the oap-sdk names it uses |
| `tile.json`, `tile.png` | the tile's title and icon in the HMI's menu |
| `lib/` | the runtime (`mgu_*.js`) and the kit, copies of this repository's `runtime/` and `kit/` |
| `vendor/` | mgu-store's render client, packer and linker (`oap_pack.js`, `oap_link.js`), pinned in `vendor/SOURCE.json` |
| `tools/build.js` | builds the source package and, with a donor, the OAP package |
| `tools/gen_package.js` | writes the rest of `app/`: `package.json`, the SOME/IP manifest, permissions, the RHMI description |
| `app/` | the package tree; everything in it but `screens.json` and `images/` is written by `tools/gen_package.js` |

No BMW SDK or firmware-derived file is here: the oap-sdk is linked in from a **donor bundle** when the app is built,
on the head unit (a source package) or on your computer (`--sdk`).

## Your design in the app

1. In the Designer, **Download** the design: a zip with `screens.json` and `images/`.
2. Put it in `app/`, replacing the starter's:

   ```sh
   rm -rf app/screens.json app/images
   unzip design.zip -d app/
   ```

3. Change the handlers in `main.js` to your screens, elements and actions: `rt.on('action', ...)` gets
   `{ screen, element, action, value? }` (an element's action is its name unless the Designer gave it another; a field
   reports the typed text as `value`), `rt.on('screen', ...)` gets `{ screen, from, by }` whenever a link, BACK or your
   code changes the screen, and `rt.set(screen, element, value)` sets what an element shows (text, on/off, a number,
   list rows, a picture). Links, BACK, the controller, touch, the keyboard screen and the car's display language are
   the runtime's.
4. Give the app its own id and title: `id` (and `version`) in `mgu-app.json`, `title` in `tile.json`, your icon as
   `tile.png` (96 x 96 PNG). The RHMI ids are made from the app id, so a copy under another id is another app.
5. Build it (Node 18 or newer on your computer; the app itself runs on the head unit's Node 8):

   ```sh
   node tools/build.js                       # <id>@<version>.src.tgz, the source package
   node tools/build.js --sdk <donor>         # also <id>@<version>.tgz, the OAP package (or MGU_SDK_DONOR=<donor>)
   ```

   The source package is what you install or publish: the head unit's deploy tool (mgu-store `deploy/`) builds it
   with the stock donor it finds on the unit. A donor for `--sdk` is a stock app's bundle or package from a head unit
   or the emulator (mgu-store `tools/oap_link.js` describes donors); keep it out of the repository.

Each screen's title is shown in the HMI's title bar, in the car's language when the screen file has it (a language
the screen file lacks falls back to its first). Fonts cover ASCII, `° · × – — … →` and, for Chinese, the Chinese
font: other letters (`ä`, `é`, Cyrillic...) draw as `?`.

The runtime on the head unit, in short (`lib/mgu_oap.js`, `lib/mgu_headunit.js`): the app's RHMI description has four
page states on the page template the renderer draws into; the tile opens the first, each screen the driver goes deeper
opens the next (and the keyboard screen one of its own), so the HMI's BACK closes one and the runtime goes back with
it. The controller reaches the app through the renderer's controller gate when installed, otherwise through the
HMI's focus on hidden proxy buttons of the state, or FrontCCU. Deeper than four, the fourth state stands for the rest.

Licences: the kit's `kit_*.js`, the render client and the fonts carry MIT and OFL notices (`lib/LICENSE-*`,
`vendor/LICENSE.mgu-renderd`); the other files from mgu-store (`am_*.js`, `store_elements.js`, `qr.js`, `i18n.js`,
`locales.js`, the packer and linker) come from a GPL-3.0-or-later repository.

## Walkthrough in the iDrive 7 emulator

Not yet done for this starter: run it before calling a Designer-made app ready (mgu-store `AGENTS.md`). You need an
mgu-emulator checkout, an mgu-store checkout and this repository.

1. Make a design in the Designer (`npm run designer` at this repository's root) with at least two screens linked by a
   button (a `nav` link), a field, a toggle row and a picture; Download it. Or keep the starter's own `app/screens.json`,
   which has all of these.
2. Drop it into the app and build the source package (from this repository's `starter/`):

   ```sh
   rm -rf app/screens.json app/images && unzip ~/Downloads/design.zip -d app/
   node tools/build.js
   ```

3. Start your own emulator VM with mgu-render on it (from the mgu-emulator checkout). `--preset store` starts from
   the published release, which brings the Store and mgu-render:

   ```sh
   EMU_LIMA=mgu-emu-starter ./emu.py up --systemd --preset store
   ```

   `up` prints the SSH port, key and the `deploy/hu` options to use.
4. Install the source package with mgu-store's deploy tool (from the mgu-store checkout; the unit builds it with its
   stock donor), the options in an array as `up` printed them:

   ```sh
   H=(--host 127.0.0.1 --port <ssh> --identity <key> --ssh-opt StrictHostKeyChecking=no
      --ssh-opt UserKnownHostsFile=/dev/null --ssh-opt LogLevel=ERROR --ssh-opt IdentitiesOnly=yes)
   deploy/hu install --artifact <this repo>/starter/starter_app@0.1.0.src.tgz "${H[@]}"
   ```

5. In the emulator's HMI, open the app's tile (**Starter** in the menu where the Store's tile is) and check:
   - [ ] the first screen is drawn **inside** the HMI's page, under the HMI's title bar showing the screen's title, and
         stays there for more than 10 s without input (the keepalive);
   - [ ] **controller focus**: turning the controller moves the white ring through the elements in focus order and
         pushing selects (Refresh counts up and shows the time);
   - [ ] **touch**: tapping an element selects it (Refresh, the toggle row, the slider);
   - [ ] **navigation**: Settings opens the second screen and the title bar says Settings; Done returns to the first;
   - [ ] **BACK**: on Settings, the HMI's BACK returns to the first screen with the ring where it was; on the first
         screen, BACK leaves the app to the HMI's menu; opening the tile again shows the first screen;
   - [ ] **keyboard screen**: selecting the Driver name field opens the keyboard; typing and OK returns with the text,
         and the HMI's BACK on the keyboard cancels without leaving Settings;
   - [ ] **language**: with the HMI's language set to German, the texts and title are German;
   - [ ] the picture (`images/logo.png`) is drawn.

   The app logs to the unit's journal through the oap-sdk's logger (`action <screen>/<element>: <action>`, `screen
   <name> (<by>)`, `mgu-oap: ...` warnings): a missing RHMI state, a refused screen file or an unavailable SOME/IP
   interface is named there. Things to look at first if a check fails: whether the page's title can be written at
   runtime (`ST_OnlineApps_MguPage<n>_Title`), whether the HMI routes focus and presses to the proxy buttons
   (`mguPage<n>P<i>`) or the app has to read FrontCCU, and whether BACK from the app's own first screen
   (`page.leave()`, closing the page states) leaves the page.
