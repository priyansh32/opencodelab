import { fr } from '@/utils/formatResponse'
import { type Request, type Response, Router } from 'express'
import RabbitMQClient from '@/services/rabbitmq/client'
import catchAsync from '@/utils/catchAsync'
import Joi from 'joi'
import APIError from '@/utils/APIError'
import { SUPPORTED_LANGUAGES, type Code } from '@/services/rabbitmq/producer'

const v1Router = Router()
const parsedMaxCodeLength = Number(process.env.MAX_CODE_LENGTH)
const MAX_CODE_LENGTH = Number.isFinite(parsedMaxCodeLength) && parsedMaxCodeLength > 0 ? parsedMaxCodeLength : 10000

const producerPayloadSchema = Joi.object<Code>({
  language: Joi.string().valid(...SUPPORTED_LANGUAGES).required(),
  code: Joi.string().min(1).max(MAX_CODE_LENGTH).required()
}).required()

v1Router.get('/', (req: Request, res: Response) => {
  res.status(200).send(fr({ message: 'Hello, world 1!', apiVersion: req.apiVersion }))
}
)

v1Router.post('/producer', catchAsync(async (req: Request, res: Response) => {
  const { error, value } = producerPayloadSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true
  })

  if (error != null) {
    throw new APIError(400, `Invalid payload: ${error.message}`)
  }

  const executionID = await RabbitMQClient.produce(value)
  res.status(202).send(fr({
    message: 'Request accepted for processing',
    executionID,
    statusEndpoint: `/consumer?correlationID=${executionID}`,
    streamEndpoint: `/consumer/stream?correlationID=${executionID}`,
    testClientEndpoint: `/test-client?executionID=${executionID}`
  }))
})
)

export default v1Router
