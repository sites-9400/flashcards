/// <reference types="vitest/config" />
import { defineConfig, configDefaults } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    exclude: [...configDefaults.exclude, 'lib/**'],
    // gradingDay() is local-time by design; tests assert Manila-local rollover
    env: { TZ: 'Asia/Manila' },
  },
});
