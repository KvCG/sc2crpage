const esbuild = require('esbuild')
const path = require('path')

esbuild
    .build({
        entryPoints: [path.resolve(__dirname, '../src/server/server.ts')],
        bundle: true,
        platform: 'node',
        outfile: path.resolve(__dirname, '../dist/webserver/server.cjs'),
        target: 'node20',
        format: 'cjs',
        sourcemap: true
    })
    .catch(() => {
        process.exit(1)
    })
    .then(() =>
        console.log(
            '\n**server esbuild sucessful**\n'
		)
    )
