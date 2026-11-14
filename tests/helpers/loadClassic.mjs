import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Runs a classic (non-module) browser script in a fresh context and returns its `window`.
export function loadClassic(path) {
  const window = {};
  const context = vm.createContext({ window });
  vm.runInContext(readFileSync(path, 'utf8'), context, { filename: path });
  return window;
}
