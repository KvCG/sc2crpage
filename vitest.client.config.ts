/// <reference types="vitest" />
import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
        include: ['src/client/**/*.{test,spec}.{ts,tsx}'],
        exclude: [...configDefaults.exclude, 'e2e/**'],
        passWithNoTests: true,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['src/client/**'],
            exclude: [
                'node_modules/',
                'src/test/',
                '**/*.d.ts',
                'coverage/**',
                'dist/**',
            ],
        },
    },
})
