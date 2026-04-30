import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        setupFiles: ['./src/tests/setup.ts'],
        include: ['src/tests/**/*.test.ts', 'tools/tests/**/*.test.ts'],
        exclude: ['**/node_modules/**', '**/*.integration.test.ts'],
        coverage: {
            reporter: ['text', 'json', 'html'],
        },
    },
});
