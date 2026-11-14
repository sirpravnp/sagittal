import { defineConfig } from '@playwright/test';

export const PORT = 4173;
export const GL_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.mjs',
  timeout: 30000,
  workers: 2,
  use: {
    baseURL: `http://127.0.0.1:${PORT}/`,
    channel: 'chrome',
    launchOptions: { args: GL_ARGS },
  },
  webServer: {
    command: `python3 -m http.server ${PORT} --bind 127.0.0.1 --directory site`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: false,
    timeout: 15000,
  },
});
