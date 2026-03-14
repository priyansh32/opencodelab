import { type Request, type Response, Router } from 'express'
import APIError from '@/utils/APIError'
import catchAsync from '@/utils/catchAsync'
import { fr } from '@/utils/formatResponse'

const v2Router = Router()
const ENABLE_V2_FAULT_TEST = process.env.ENABLE_V2_FAULT_TEST === 'true'

v2Router.get('/', catchAsync(async (req: Request, res: Response): Promise<void> => {
  if (ENABLE_V2_FAULT_TEST) {
    throw new APIError(400, 'v2 fault test enabled')
  }

  res.status(200).send(fr({ message: 'Hello, world 2!', apiVersion: req.apiVersion }))
}))

export default v2Router
