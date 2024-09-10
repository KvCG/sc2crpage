import prod from '../config/prod.config.json' assert { type: 'json' }
import dev from '../config/dev.config.json' assert { type: 'json' }

// Define the shape of your config
interface Config {
    API_URL: string
}

let config = {}
let hostName = window.location.hostname
if (hostName.includes('vercel.app')) { // This is to standardize the hostname for Vercel created instances
    hostName = 'vercel.app'
}

switch (hostName) {
    case 'sc2cr-latest.onrender.com':
    case 'sc2cr.free.nf':
        config = prod
        break
	case 'vercel.app':
    case 'localhost':
        config = dev
        break
    default:
        config = dev
}

const typedConfig = config as Config

export default typedConfig
