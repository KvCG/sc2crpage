const esbuild = require('esbuild')
const path = require('path')

/**
 * Development build script with debugging support
 * Follows SC2CR service layer patterns for maintainability
 */

const createDevBuildConfig = () => ({
    entryPoints: [path.resolve(__dirname, '../src/server/server.ts')],
    bundle: true,
    platform: 'node',
    outfile: path.resolve(__dirname, '../dist/webserver/server.cjs'),
    target: 'node20',
    format: 'cjs',
    sourcemap: true,
    minify: false,
    keepNames: true,
    sourcesContent: true,
    define: {
        'process.env.NODE_ENV': '"development"'
    }
})

const buildForDevelopment = async () => {
    try {
        await esbuild.build(createDevBuildConfig())
        console.log('✅ Development server build complete with full debugging support')
    } catch (error) {
        console.error('❌ Development build failed:', error)
        process.exit(1)
    }
}

// Run if called directly
if (require.main === module) {
    buildForDevelopment()
}

module.exports = { buildForDevelopment, createDevBuildConfig }