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

export const logger = pino({
    level: LOG_LEVEL,
    redact: { paths: REDACT_PATHS, remove: true },
    transport: isDev
        ? {
              target: 'pino-pretty',
              options: { colorize: true, translateTime: 'SYS:standard' },
          }
        : undefined,
})

export default logger
