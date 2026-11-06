# The cluster preview runs the apps repo's engine in the browser

The canvas for a cluster layout draws with the apps repo's own engine (`shared/hud.js`, `layouts.js`, `shaders.js`, `visible.js`, the fonts and the rest), vendored here as a pinned, unmodified copy with a `SOURCE.json`, like `kit/`. It runs in the browser: `net` is replaced by an in-memory pipe into a stand-in for cluster-render, which draws the layers (image layers as pixels, effect layers with the real GLSL in WebGL), and `fs` and the kit's `ctx` are shimmed. The stand-in is the bench's protocol handling, limits and WebGL stage. Today these are tangled into `bench/server.js` and `page.html`; they are first split into transport-free modules in the apps repo, which the bench then uses too, and this repo vendors those.

## Considered Options

- **Reimplement the drawing in the Designer**: rejected. It would drift from what the car draws, and the layer budget and visibility warnings would be guesses.
- **Run the bench server and stream to the page**: rejected. The Designer is a static site (Netlify) and the bench needs Node, Python and a socket.
- **Copy the bench code here**: rejected. It would drift, as a reimplementation does.

## Consequences

- A change to the engine or the stand-in is made in the apps repo and synced in; nothing under the vendored folder is edited here.
- A golden test (as for the screen preview) requires the Designer's frames to equal the bench's recording of the same layout.
- The engine's Node-isms (`fs`, `net`, `kit/car`) are shimmed here; if that gets heavy, the apps repo is asked to make them injectable.
