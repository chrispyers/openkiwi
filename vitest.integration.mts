import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        setupFiles: ['./src/tests/setup.ts'],
        include: ['**/*.integration.test.ts'],
        testTimeout: 30_000,
        coverage: {
            reporter: ['text', 'json', 'html'],
        },
    },
});
