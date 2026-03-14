import { fr } from '@/utils/formatResponse'
import { type Request, type Response, Router } from 'express'
import RabbitMQClient from '@/services/rabbitmq/client'
import catchAsync from '@/utils/catchAsync'
import path from 'path'

const v1Router = Router()
const statusUIPath = path.join(process.cwd(), 'public', 'status-ui.html')

v1Router.get('/', (req: Request, res: Response) => {
  res.status(200).send(fr({ message: 'Hello, world 1!', apiVersion: req.apiVersion }))
}
)

v1Router.get('/status-ui', (_req: Request, res: Response) => {
  res.sendFile(statusUIPath)
})

v1Router.post('/producer', catchAsync(async (req: Request, res: Response) => {
  const executionID = await RabbitMQClient.produce(req.body)
  res.status(200).send(fr({
    message: 'Pushed to queue',
    executionID,
    statusEndpoint: `/consumer?correlationID=${executionID}`,
    streamEndpoint: `/consumer/stream?correlationID=${executionID}`,
    statusUI: `/status-ui?executionID=${executionID}`
  }))
})
)

export default v1Router
