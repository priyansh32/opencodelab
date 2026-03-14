import express from 'express'
import helmet from 'helmet'
import path from 'path'

import './database'
import logger from '@/utils/logger'
import errorHandler from '@/middlewares/errorHandler'
import routeHandler from '@/routes'
import RabbitMQClient from '@/services/rabbitmq/client'

const PORT = (process.env.PORT != null) ? process.env.PORT : 3000
const helmetDirectives = helmet.contentSecurityPolicy.getDefaultDirectives()
helmetDirectives['script-src'] = ["'self'", "'unsafe-inline'"]

declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: string
    }
    apiVersion: string
  }
}

const app = express()

app.use(helmet({
  contentSecurityPolicy: {
    directives: helmetDirectives
  }
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use('/status-ui', express.static(path.join(process.cwd(), 'public'), { index: 'status-ui.html' }))
app.use('/client', express.static(path.join(process.cwd(), 'public'), { index: 'client.html' }))

app.use('/', routeHandler)
app.use(errorHandler)

app.listen(PORT, () => {
  logger.info(`Listening on PORT ${PORT}`)
  void RabbitMQClient.initialize().catch((error: Error) => {
    logger.error('RabbitMQ startup initialization failed', error)
  })
})
