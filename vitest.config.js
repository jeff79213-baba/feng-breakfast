import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // tests/rules.test.js 需要 Firestore emulator；本機無 Java 不納入，改用 `npm run test:rules`。
    include: ['tests/core.test.js', 'tests/cal.test.js', 'tests/menu.test.js'],
    environment: 'node',
    testTimeout: 20000,
  },
});
