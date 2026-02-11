import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/*/src/**/*.test.ts', 'examples/*/src/**/*.test.ts', 'test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.d.ts', 'examples/**']
    }
  },
  resolve: {
    alias: {
      '@nanosession/core': './packages/core/src',
      '@nanosession/client': './packages/client/src',
      '@nanosession/server': './packages/server/src',
      '@nanosession/rpc': './packages/rpc/src'
    }
  }
});
