import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    root: 'src/',
    publicDir: '../public/',
    build: {
        outDir: '../dist/',
        emptyOutDir: true,
        sourcemap: true,
		assetsDir: 'client/assets'
    },
    server: {
        proxy: {
            '/api': 'http://localhost:3000',
        },
    },
})
