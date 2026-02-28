/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './src/setupTests.ts',
    },
    server: {
        port: 3000,
        proxy: {
            '/api': 'http://localhost:3808',
            '/ws': {
                target: 'ws://localhost:3808',
                ws: true
            },
            '/screenshots': 'http://localhost:3808'
        }
    }
})
