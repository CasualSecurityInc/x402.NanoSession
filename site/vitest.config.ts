import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['demo-server/__tests__/**/*.test.ts'],
        environment: 'node',
        clearMocks: true,
    },
});
