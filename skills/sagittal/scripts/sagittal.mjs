#!/usr/bin/env node
// Runs sagittal's figure tools from wherever this skill is installed.
//
//   node <skill>/scripts/sagittal.mjs figure <spec.json> [--out f.html] [--open]
//   node <skill>/scripts/sagittal.mjs look <figure.html> [--rot x,y] [--zoom z]
//   node <skill>/scripts/sagittal.mjs home          # prints the sagittal repo it uses
//
// The repo is $SAGITTAL_HOME if set, else the clone this skill folder lives in: the skill is
// installed as a symlink (~/.claude/skills/sagittal -> <clone>/skills/sagittal), and Node runs this
// script from its real path, so the clone is two folders up from the real skill folder.
// Paths are relative to the current directory; figures go to ./sagittal-figures/ by default.
import { existsSync, realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(realpathSync(fileURLToPath(import.meta.url)));
const home = path.resolve(process.env.SAGITTAL_HOME || path.join(here, '..', '..', '..'));
const TOOLS = { figure: 'player/make-figure.mjs', look: 'player/look-figure.mjs' };

function die(msg) { process.stderr.write('sagittal: ' + msg + '\n'); process.exit(2); }

const [cmd, ...args] = process.argv.slice(2);
if (!existsSync(path.join(home, TOOLS.figure))) {
  die(`no sagittal repo at ${home}. Install the skill as a symlink from a clone `
    + '(ln -s "$PWD/skills/sagittal" ~/.claude/skills/sagittal, run in the clone), or set SAGITTAL_HOME to the clone.');
}
if (cmd === 'home') { process.stdout.write(home + '\n'); process.exit(0); }
if (!TOOLS[cmd]) die('usage: sagittal.mjs figure <spec.json> [--out f.html] [--open] | look <figure.html> [--rot x,y] [--zoom z] | home');
if (cmd === 'look' && !existsSync(path.join(home, 'node_modules', '@playwright', 'test'))) {
  die(`looking at figures needs the repo's dev dependencies: run  npm install  in ${home} `
    + '(and, without Google Chrome installed,  npx playwright install chromium).');
}
const r = spawnSync(process.execPath, [path.join(home, TOOLS[cmd]), ...args], { stdio: 'inherit', cwd: process.cwd() });
process.exit(r.status == null ? 1 : r.status);
