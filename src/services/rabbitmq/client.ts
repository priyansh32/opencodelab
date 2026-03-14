import { type Channel, type Connection, connect } from 'amqplib'
import Producer, { type Code } from './producer'
import Consumer from './consumer'
import { EventEmitter } from 'events'
import APIError from '@/utils/APIError'
import logger from '@/utils/logger'

const BASE_RABBITMQ_URL = (process.env.RABBITMQ_URL != null) ? process.env.RABBITMQ_URL : 'amqp://localhost'
const FRAME_MAX_MIN = '8192'

const normalizeRabbitMQURL = (url: string): string => {
  const parsedURL = new URL(url)
  if (parsedURL.searchParams.get('frameMax') == null) {
    // RabbitMQ 4.x requires frame_max >= 8192.
    parsedURL.searchParams.set('frameMax', FRAME_MAX_MIN)
  }
  return parsedURL.toString()
}

const RABBITMQ_URL = normalizeRabbitMQURL(BASE_RABBITMQ_URL)

class RabbitMQClient {
  private constructor () { }

  private static instance: RabbitMQClient
  private isInitialized = false

  private producer!: Producer
  private consumer!: Consumer
  private connection!: Connection
  private producerChannel!: Channel
  private consumerChannel!: Channel

  private eventEmitter: EventEmitter | undefined
  private initializationPromise: Promise<void> | undefined

  public static getInstance (): RabbitMQClient {
    if (this.instance == null) {
      this.instance = new RabbitMQClient()
    }
    return this.instance
  }

  async initialize (): Promise<void> {
    if (this.isInitialized) return
    if (this.initializationPromise === undefined) {
      const initializationWork = (async () => {
        try {
          await this.connect()
        } catch (error) {
          this.isInitialized = false
          logger.error('Failed to initialize RabbitMQ client', error)
          throw new APIError(503, 'Queue service is currently unavailable')
        }
      })()

      this.initializationPromise = initializationWork

      try {
        await initializationWork
      } finally {
        if (this.initializationPromise === initializationWork) {
          this.initializationPromise = undefined
        }
      }
    }
    await this.initializationPromise
  }

  async produce (data: Code): Promise<any> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    return await this.producer.produceMessage(data)
  }

  private async connect (): Promise<void> {
    this.connection = await connect(RABBITMQ_URL)

    this.producerChannel = await this.connection.createChannel()
    this.consumerChannel = await this.connection.createChannel()

    const { queue: replyQueueName } = await this.consumerChannel.assertQueue('', { exclusive: true })

    this.eventEmitter = new EventEmitter()
    this.producer = new Producer(this.producerChannel, replyQueueName, this.eventEmitter)
    this.consumer = new Consumer(this.consumerChannel, replyQueueName, this.eventEmitter)

    await this.consumer.consumeMessages()
    this.isInitialized = true
  }
}

export default RabbitMQClient.getInstance()
