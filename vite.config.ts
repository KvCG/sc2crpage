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
    },
	server: {
		proxy: {
			// // string shorthand: /foo -> http://localhost:4567/foo
			// '/foo': 'http://localhost:5173',
			// with options
			'/api': {
			  target: 'http://localhost:3000',
			  changeOrigin: true,
			  rewrite: path => path.replace(/^\/api/, '')
			}
		  }
	}
	
})
