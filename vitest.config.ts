import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@nanosession/core': resolve(__dirname, './packages/core/src'),
      '@nanosession/client': resolve(__dirname, './packages/client/src'),
      '@nanosession/server': resolve(__dirname, './packages/server/src'),
      '@nanosession/rpc': resolve(__dirname, './packages/rpc/src'),
      '@nanosession/faremeter': resolve(__dirname, './packages/faremeter-plugin/src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    alias: {
      '@nanosession/core': resolve(__dirname, './packages/core/src'),
      '@nanosession/client': resolve(__dirname, './packages/client/src'),
      '@nanosession/server': resolve(__dirname, './packages/server/src'),
      '@nanosession/rpc': resolve(__dirname, './packages/rpc/src'),
      '@nanosession/faremeter': resolve(__dirname, './packages/faremeter-plugin/src'),
    },
    include: ['packages/*/src/**/*.test.ts', 'examples/*/src/**/*.test.ts', 'test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.d.ts', 'examples/**']
    }
  }
});
