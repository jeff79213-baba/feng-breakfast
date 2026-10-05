import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/rules.test.js'],
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});