const esbuild = require('esbuild')
const path = require('path')

// Centralized build configuration following project patterns
const createBuildConfig = () => {
    const isDevelopment = process.env.NODE_ENV === 'development'
    const forceSourcemaps = process.env.BUILD_SOURCEMAPS === '1'
    const enableSourcemaps = isDevelopment || forceSourcemaps

    return {
        entryPoints: [path.resolve(__dirname, '../src/server/server.ts')],
        bundle: true,
        platform: 'node',
        outfile: path.resolve(__dirname, '../dist/webserver/server.cjs'),
        target: 'node20',
        format: 'cjs',
        sourcemap: enableSourcemaps,
        minify: !enableSourcemaps, // Don't minify when debugging
        keepNames: enableSourcemaps, // Preserve function names for debugging
        sourcesContent: enableSourcemaps, // Include source content in sourcemap
    }
}

esbuild
    .build(createBuildConfig())
    .catch(() => {
        process.exit(1)
    })
    .then(() => {
        console.log('\n**server esbuild sucessful**\n')
    })
