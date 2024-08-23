const js = require('@eslint/js')
const globals = require('globals')
const reactHooks = require('eslint-plugin-react-hooks')
const reactRefresh = require('eslint-plugin-react-refresh')
const tseslint = require('typescript-eslint')

module.exports = {
    overrides: [
        {
            files: ['**/*.{js,mjs,cjs}'],
            languageOptions: {
                ecmaVersion: 2020,
                globals: globals.browser,
                sourceType: 'module',
            },
            extends: [js.configs.recommended],
        },
        {
            files: ['**/*.{ts,tsx}'],
            languageOptions: {
                ecmaVersion: 2020,
                globals: globals.browser,
            },
            extends: [js.configs.recommended, ...tseslint.configs.recommended],
            plugins: {
                'react-hooks': reactHooks,
                'react-refresh': reactRefresh,
            },
            rules: {
                ...reactHooks.configs.recommended.rules,
                'react-refresh/only-export-components': [
                    'warn',
                    { allowConstantExport: true },
                ],
            },
        },
    ],
}
