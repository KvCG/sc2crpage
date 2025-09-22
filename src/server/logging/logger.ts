import pino from 'pino'

const level = (process.env.LOG_LEVEL || 'info').toLowerCase()
const isDev = (process.env.NODE_ENV || '').startsWith('dev') || process.env.NODE_ENV === 'development'

const redactPaths = [
  'req.headers.authorization',
  'request.headers.authorization',
  'password',
  'headers.cookie',
]

export const logger = pino({
  level,
  redact: { paths: redactPaths, remove: true },
  transport: isDev ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } } : undefined,
})

export default logger
