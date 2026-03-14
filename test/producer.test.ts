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
