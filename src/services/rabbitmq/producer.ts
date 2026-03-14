import APIError from '@/utils/APIError'
import { type ConsumeMessage, type Channel } from 'amqplib'
import { randomUUID } from 'crypto'
import type EventEmitter from 'events'

const TIMEOUT = 30000

// temporary
const queueMap: Record<string, string> = {
  javascript: 'node18_16',
  python: 'python310'
}
export const SUPPORTED_LANGUAGES = Object.keys(queueMap)

export interface Code {
  language: string
  code: string
}

export default class Producer {
  constructor (
    private readonly channel: Channel,
    private readonly replyQueueName: string,
    private readonly eventEmitter: EventEmitter
  ) { }

  // unused function - can be removed but let it be
  private async _waitForResponse (correlationId: string): Promise<any> {
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.eventEmitter.removeListener(correlationId, listener)
        reject(new Error('timeout'))
      }, TIMEOUT)

      const listener = (message: ConsumeMessage): void => {
        if (message.properties.correlationId === correlationId) {
          clearTimeout(timer)
          this.eventEmitter.removeListener(correlationId, listener)
          resolve(message.content.toString())
        }
      }

      this.eventEmitter.once(correlationId, listener)
    })
  }

  async produceMessage (data: Code): Promise<any> {
    const correlationId = randomUUID()

    const queueName = queueMap[data.language]
    if (queueName == null || queueName === undefined) {
      throw new APIError(400, 'Invalid or unsupported language')
    }

    this.channel.sendToQueue(
      queueMap[data.language],
      Buffer.from(JSON.stringify(data)),
      {
        replyTo: this.replyQueueName,
        correlationId,
        expiration: TIMEOUT
      })

    return correlationId
  }
}
