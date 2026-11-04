'use strict';
// Builds the Designer for a browser test into a folder of its own. `npm test` runs test files at the same time, and
// builds sharing designer/dist would rewrite it under each other's pages.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const DESIGNER = path.join(__dirname, '..', 'designer');

/** Type-checks and builds the Designer into a new temporary folder and returns it (removed when the process exits). */
function buildDesigner() {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'mgu-designer-dist-'));
    execFileSync('npm', ['run', 'build', '--', '--outDir', out, '--emptyOutDir'],
        { cwd: DESIGNER, stdio: 'pipe', shell: process.platform === 'win32' });     // npm is npm.cmd on Windows
    process.on('exit', () => { try { fs.rmSync(out, { recursive: true, force: true }); } catch { /* left for the OS */ } });
    return out;
}

module.exports = { DESIGNER, buildDesigner };
