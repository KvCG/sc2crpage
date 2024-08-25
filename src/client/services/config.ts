import prod from '../config/prod.config.json' assert { type: "json" }
import dev from '../config/dev.config.json' assert { type: "json" }


// Define the shape of your config
interface Config {
	API_URL: string;
}
  
let config = {}

switch (window.location.hostname) {
	case 'sc2cr-latest.onrender.com':
    case 'sc2cr.free.nf':
        config = prod
        break
    case 'localhost':
        config = dev
        break
    default:
        config = dev
}

const typedConfig = config as Config;

export default typedConfig
