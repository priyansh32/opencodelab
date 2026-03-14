import { createLogger, format, transports } from 'winston'
import { mkdirSync } from 'fs'
import path from 'path'
const { combine, timestamp, label, json } = format
const LOG_DIR = path.join(process.cwd(), 'logs')
let fileLoggingEnabled = true

try {
  mkdirSync(LOG_DIR, { recursive: true })
} catch (error) {
  fileLoggingEnabled = false
  console.error('Failed to create logs directory. Falling back to non-file logging.', error)
}

const prodTransports: transports.StreamTransportInstance[] = []
if (fileLoggingEnabled) {
  prodTransports.push(new transports.File({ filename: path.join(LOG_DIR, 'error.log'), level: 'error' }))
  prodTransports.push(new transports.File({ filename: path.join(LOG_DIR, 'combined.log') }))
} else {
  prodTransports.push(new transports.Console())
}

const devTransports: transports.StreamTransportInstance[] = [
  new transports.Console({
    format: format.combine(
      format.colorize(),
      format.simple()
    )
  })
]

if (fileLoggingEnabled) {
  devTransports.unshift(new transports.File({ filename: path.join(LOG_DIR, 'dev.log') }))
}

const prodLogger = createLogger({
  level: 'info',
  format: combine(
    label({ label: 'prod' }),
    timestamp(),
    json()
  ),
  transports: prodTransports
})

const devLogger = createLogger({
  level: 'debug',
  transports: devTransports
})

const logger = process.env.NODE_ENV === 'production' ? prodLogger : devLogger

export default logger
