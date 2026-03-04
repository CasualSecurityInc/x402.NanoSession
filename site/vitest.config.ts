import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['protected-resource-demo-server/__tests__/**/*.test.ts'],
        environment: 'node',
        clearMocks: true,
    },
});
