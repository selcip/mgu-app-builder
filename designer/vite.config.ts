import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const KIT = path.join(ROOT, 'kit');
const RUNTIME = path.join(ROOT, 'runtime');
const SHIMS = path.join(HERE, 'src', 'shims');

const ID = 'virtual:mgu-runtime';

/**
 * `virtual:mgu-runtime`: the runtime (runtime/mgu_runtime.js) and the vendored kit (kit/), unchanged, bundled for
 * the browser. They are Node 8 CommonJS that require each other by basename, as the OAP linker lays them out flat
 * on the head unit; esbuild resolves './x.js' the same way (runtime first, then kit), points `zlib` at a shim on
 * fflate and injects the `buffer` package as the global `Buffer` (the kit needs both at load time).
 * Same bundle in the dev server and the static build.
 */
function mguRuntime(): Plugin {
    const flat = {
        name: 'flat-app-layout',
        setup(b: import('esbuild').PluginBuild) {
            b.onResolve({ filter: /^zlib$/ }, () => ({ path: path.join(SHIMS, 'zlib.js') }));
            b.onResolve({ filter: /^\.\/[^/]+\.js$/ }, (args) => {
                if (args.importer.startsWith(SHIMS)) return undefined;
                for (const dir of [RUNTIME, KIT]) {
                    const p = path.join(dir, args.path);
                    if (fs.existsSync(p)) return { path: p };
                }
                return { errors: [{ text: `${args.path} is in neither runtime/ nor kit/` }] };
            });
        },
    };
    let files: string[] = [];
    return {
        name: 'mgu-runtime',
        resolveId(id) { return id === ID ? '\0' + ID : null; },
        async load(id) {
            if (id !== '\0' + ID) return null;
            const out = await build({
                stdin: {
                    contents: `module.exports = {
                        createRuntime: require('./mgu_runtime.js').createRuntime,
                        kit: require('./am_gpu.js'),
                        play: require('./kit_record.js').play,
                        Canvas: require('./kit_canvas.js').Canvas,
                        text: require('./mgu_text.js'),
                        vicon: require('./kit_vicons.js').vicon,
                    };`,
                    resolveDir: RUNTIME,
                    sourcefile: 'mgu-runtime-entry.js',
                    loader: 'js',
                },
                bundle: true,
                format: 'esm',
                platform: 'browser',
                target: 'es2020',
                inject: [path.join(SHIMS, 'node-globals.js')],
                nodePaths: [path.join(HERE, 'node_modules'), path.join(ROOT, 'node_modules')],
                plugins: [flat],
                write: false,
                metafile: true,
                logLevel: 'silent',
            });
            files = Object.keys(out.metafile!.inputs).filter((f) => !f.startsWith('<')).map((f) => path.resolve(f));
            for (const f of files) this.addWatchFile(f);
            return out.outputFiles[0].text;
        },
        handleHotUpdate(ctx) {
            if (files.includes(ctx.file)) {
                const m = ctx.server.moduleGraph.getModuleById('\0' + ID);
                if (m) ctx.server.moduleGraph.invalidateModule(m);
                ctx.server.ws.send({ type: 'full-reload' });
                return [];
            }
            return undefined;
        },
    };
}

export default defineConfig({
    base: './',
    plugins: [react(), mguRuntime()],
    server: { fs: { allow: [ROOT] } },
    build: { chunkSizeWarningLimit: 4000 },
});
