# 13: Starter app and emulator walkthrough

**Spec:** `.scratch/designer-v1/spec.md`

**What to build:** An app author copies the starter app: a minimal app with a screen file, `images/`, the runtime, the kit and an example entry that handles actions, follows screen changes and sets values. It packs with the existing `oap_pack.js` and links the oap-sdk from a donor bundle (no BMW SDK or firmware-derived files committed). Instructions explain replacing its screen file with a Designer download. A Designer-made design is installed and walked through in the iDrive 7 head-unit emulator.

**Blocked by:** 07, 08

**Status:** resolved

- [x] The starter app packs with `oap_pack.js` and links the oap-sdk from a donor bundle; nothing BMW-derived is committed
- [x] Its example handles actions, reacts to screen changes and sets values
- [x] Instructions cover dropping a Designer download into the app and packing it
- [ ] A Designer-made screen file runs in the iDrive 7 emulator: drawn inside the HMI page, controller focus, touch, navigation and BACK all work

Resolved for everything but the emulator walkthrough, which needs the owner's emulator and a stock donor (neither is
available to the agent) and stays unchecked: `starter/README.md` "Walkthrough in the iDrive 7 emulator" has the steps
and checklist to run with mgu-emulator. Verified here at the seams with stand-ins: the head-unit adapter with a fake
render client and page (`test/headunit-page.test.js`), the example entry in a fake OnlineApp/RHMI built from the
starter's generated uiDescription (`test/starter-app.test.js`), packing and linking against a made-up donor, and the
linked bundle starting under Node 8 (`test/starter-pack.test.js`).
