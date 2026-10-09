import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/core.test.js', 'tests/cal.test.js', 'tests/menu.test.js', 'tests/line.test.js'],
    environment: 'node',
    testTimeout: 20000,
  },
});
