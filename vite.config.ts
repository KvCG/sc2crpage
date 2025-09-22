import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import clientBuildInfo from './plugins/clientBuildInfo'

export default defineConfig({
    plugins: [react(), clientBuildInfo()],
    root: 'src/',
    publicDir: '../public/',
    build: {
        outDir: '../dist/',
        emptyOutDir: true,
        sourcemap: true,
    },
    server: {
        proxy: {
            '/api': {
                target: 'http://localhost:3000/api',
                changeOrigin: true,
                rewrite: path => path.replace(/^\/api/, ''),
            },
        },
    },
})
