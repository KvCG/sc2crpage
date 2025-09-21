import prod from '../config/prod.config.json' assert { type: 'json' }
import dev from '../config/dev.config.json' assert { type: 'json' }
import local from '../config/local.config.json' assert { type: 'json' }
// Define the shape of your config
interface Config {
    API_URL: string
}

let config = {}
let hostName = window.location.hostname
if (hostName.includes('sc2cr-dev') || hostName.includes('project')) {
    // This is to standardize dev environment hostnames 
    hostName = 'sc2cr-dev'
}

switch (hostName) {
    case 'vercel.app':
    case 'sc2cr-latest.onrender.com':
    case 'sc2cr.free.nf':
        config = prod
        break
    case 'sc2cr-dev':
        config = dev
        break
    case 'localhost':
        config = local
        break
    default:
        config = local
}

const typedConfig = config as Config

export default typedConfig
