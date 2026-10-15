import prod from '../config/prod.config.json' assert { type: 'json' }
import dev from '../config/dev.config.json' assert { type: 'json' }
import local from '../config/local.config.json' assert { type: 'json' }
// Define the shape of your config
interface Config {
    API_URL: string
}

export function resolveConfig(hostName: string, origin: string): Config {
    if (hostName.includes('sc2cr-dev') || hostName.includes('project')) {
        // This is to standardize dev environment hostnames
        hostName = 'sc2cr-dev'
    }

    switch (hostName) {
        case 'sc2cr.vercel.app':
        case 'sc2cr-latest.onrender.com':
            return prod
        case 'sc2cr-dev':
            return dev
        case 'localhost':
        case '127.0.0.1':
            // Vite dev server on :5173 talks to the API on :3000
            return local
        default:
            // Any other host (QA on KevServer via Tailscale, a LAN IP) is the
            // Express server itself, which serves both the client and the API
            return { API_URL: `${origin}/` }
    }
}

export default resolveConfig(window.location.hostname, window.location.origin)
