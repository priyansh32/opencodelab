import { createLogger, format, transports } from 'winston'
import { mkdirSync } from 'fs'
import path from 'path'
const { combine, timestamp, label, json } = format
const LOG_DIR = path.join(process.cwd(), 'logs')

try {
  mkdirSync(LOG_DIR, { recursive: true })
} catch (error) {
  console.error('Failed to create logs directory. Exiting.', error)
  process.exit(1)
}

const prodLogger = createLogger({
  level: 'info',
  format: combine(
    label({ label: 'prod' }),
    timestamp(),
    json()
  ),
  transports: [
    new transports.File({ filename: path.join(LOG_DIR, 'error.log'), level: 'error' }),
    new transports.File({ filename: path.join(LOG_DIR, 'combined.log') })
  ]
})

const devLogger = createLogger({
  level: 'debug',
  transports: [
    new transports.File({ filename: path.join(LOG_DIR, 'dev.log') }),
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    })
  ]
})

const logger = process.env.NODE_ENV === 'production' ? prodLogger : devLogger

export default logger
