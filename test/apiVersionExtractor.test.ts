import test from 'node:test'
import assert from 'node:assert/strict'
import type { NextFunction, Request, Response } from 'express'
import apiVersionExtractor from '@/middlewares/apiVersionExtractor'

const runMiddleware = (headerValue?: string | string[]): string => {
  const req = {
    headers: headerValue !== undefined ? { 'accept-version': headerValue } : {},
    apiVersion: ''
  } as unknown as Request

  let nextCalled = false
  const next: NextFunction = () => {
    nextCalled = true
  }

  apiVersionExtractor(req, {} as Response, next)

  assert.equal(nextCalled, true)
  return req.apiVersion
}

test('sets the requested supported version', () => {
  const apiVersion = runMiddleware('2')
  assert.equal(apiVersion, '2')
})

test('defaults to version 1 when header is missing', () => {
  const apiVersion = runMiddleware(undefined)
  assert.equal(apiVersion, '1')
})

test('defaults to version 1 when header is unsupported', () => {
  const apiVersion = runMiddleware('9')
  assert.equal(apiVersion, '1')
})

test('defaults to version 1 when header is empty string', () => {
  const apiVersion = runMiddleware('')
  assert.equal(apiVersion, '1')
})

test('uses first value when header is an array', () => {
  const apiVersion = runMiddleware(['2', '1'])
  assert.equal(apiVersion, '2')
})
