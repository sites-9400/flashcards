/// <reference types="vitest/config" />
import { defineConfig, configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// tests/rules.test.ts only runs against the Firestore emulator, via `npm run
// test:rules`. The emulator sets FIRESTORE_EMULATOR_HOST on the child process;
// that presence gates whether the rules test is part of the collected file
// set, since vitest's include/exclude glob filtering happens before CLI file
// arguments are applied (a positional arg cannot un-exclude a file). Without
// this, a plain `npm test` would try to run tests/rules.test.ts against a
// non-existent emulator and fail.
const runningUnderEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    exclude: runningUnderEmulator
      ? configDefaults.exclude
      : [...configDefaults.exclude, 'tests/**'],
  },
});
