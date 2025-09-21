import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default [
    // Global ignores and language options
    {
        ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'scripts/**', 'postcss.config.cjs'],
    },
    {
        languageOptions: {
            ecmaVersion: 2020,
            sourceType: 'module',
            globals: { ...globals.browser },
        },
    },
    // Base JS recommended rules
    js.configs.recommended,
    // TypeScript recommended rules (flat config array)
    ...tseslint.configs.recommended,
    // React-specific rules for TS/TSX files
    {
        files: ['**/*.{ts,tsx}'],
        plugins: {
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            'react-refresh/only-export-components': [
                'warn',
                { allowConstantExport: true },
            ],
        },
    },
    // CommonJS scripts (CJS) with Node globals
    {
        files: ['**/*.cjs'],
        languageOptions: {
            globals: { ...globals.node },
            sourceType: 'commonjs',
        },
        rules: {
            'no-undef': 'off',
            '@typescript-eslint/no-require-imports': 'off',
        },
    },
]
