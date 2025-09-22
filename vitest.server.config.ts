/// <reference types="vitest" />
import { defineConfig, configDefaults } from 'vitest/config'

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: [
            'src/server/**/*.{test,spec}.{ts,tsx}',
            'src/server/**/__tests__/**/*.{test,spec}.{ts,tsx}',
        ],
        exclude: [...configDefaults.exclude, 'e2e/**'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['src/server/**'],
            exclude: [
                'node_modules/',
                'src/test/',
                'src/server/**/__tests__/**',
                'src/server/**/*.{test,spec}.{js,jsx,ts,tsx}',
                'src/server/**/*.stories.{js,jsx,ts,tsx}',
                'src/server/**/mocks/**',
                '**/*.d.ts',
                'coverage/**',
                'dist/**',
            ],
            // thresholds: {
            //     lines: 85,
            //     statements: 85,
            //     functions: 85,
            //     branches: 85,
            // },
        },
    },
})