import pino from 'pino'

const NODE_ENV = String(process.env.NODE_ENV || '')
const LOG_LEVEL = String(process.env.LOG_LEVEL || 'info').toLowerCase()
const isDev = NODE_ENV === 'development' || NODE_ENV === 'local' || NODE_ENV.startsWith('dev')

const REDACT_PATHS = [
    'req.headers.authorization',
    'request.headers.authorization',
    'password',
    'headers.cookie',
]

let stream: any | undefined
if (isDev) {
    // Use pretty stream in dev to avoid worker-thread transport files
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pretty = require('pino-pretty')
    stream = pretty({ colorize: true, translateTime: 'SYS:standard' })
}

export const logger = pino(
    {
        level: LOG_LEVEL,
        redact: { paths: REDACT_PATHS, remove: true },
    },
    stream
)

export default logger
