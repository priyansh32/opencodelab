import express from 'express'
import helmet from 'helmet'

import './database'
import logger from '@/utils/logger'
import errorHandler from '@/middlewares/errorHandler'
import routeHandler from '@/routes'
import RabbitMQClient from '@/services/rabbitmq/client'

const PORT = (process.env.PORT != null) ? process.env.PORT : 3000

declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: string
    }
    apiVersion: string
  }
}

const app = express()

app.use(helmet())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use('/', routeHandler)
app.use(errorHandler)

app.listen(PORT, () => {
  logger.info(`Listening on PORT ${PORT}`)
  void RabbitMQClient.initialize()
})
