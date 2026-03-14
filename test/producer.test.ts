import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'events'
import type { Channel } from 'amqplib'
import Producer from '@/services/rabbitmq/producer'
import APIError from '@/utils/APIError'

test('rejects unsupported language payloads before enqueue', async () => {
  const fakeChannel = {
    sendToQueue: () => true
  } as unknown as Channel

  const producer = new Producer(fakeChannel, 'reply-queue', new EventEmitter())

  await assert.rejects(
    async () => {
      await producer.produceMessage({ language: 'ruby', code: 'puts 123' })
    },
    (error: unknown) => {
      return error instanceof APIError && error.statusCode === 400
    }
  )
})

test('sends message to correct queue for supported language', async () => {
  const sendToQueueCalls: any[] = []
  const fakeChannel = {
    sendToQueue: (...args: any[]) => {
      sendToQueueCalls.push(args)
      return true
    }
  } as unknown as Channel

  const producer = new Producer(fakeChannel, 'reply-queue', new EventEmitter())
  const payload = { language: 'javascript', code: 'console.log(1)' }

  const correlationID = await producer.produceMessage(payload)

  assert.ok(correlationID)
  assert.equal(sendToQueueCalls.length, 1)

  const [queue, message, options] = sendToQueueCalls[0]
  assert.equal(queue, 'node24')
  assert.deepEqual(JSON.parse(message.toString()), payload)
  assert.equal(options.replyTo, 'reply-queue')
  assert.equal(options.correlationId, correlationID)
})
