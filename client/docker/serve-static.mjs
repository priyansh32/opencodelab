import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { URL } from 'node:url'

const distDir = path.resolve(process.cwd(), 'dist')
const port = Number(process.env.PORT ?? 4173)

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
}

const safeResolve = (pathname) => {
  const decoded = decodeURIComponent(pathname)
  const normalized = path.normalize(decoded).replace(/^([.][.][/\\])+/, '')
  const stripped = normalized.replace(/^[/\\]+/, '')
  const resolved = path.resolve(distDir, stripped)

  if (!resolved.startsWith(distDir)) {
    return null
  }

  return resolved
}

const applyHeaders = (response, absolutePath) => {
  const extension = path.extname(absolutePath).toLowerCase()
  const contentType = contentTypes[extension] ?? 'application/octet-stream'
  response.setHeader('Content-Type', contentType)
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('X-Frame-Options', 'DENY')
  response.setHeader('Referrer-Policy', 'no-referrer')

  if (absolutePath.includes(`${path.sep}assets${path.sep}`)) {
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  } else {
    response.setHeader('Cache-Control', 'public, max-age=300')
  }
}

const serveFile = async (absolutePath, response, method) => {
  const stats = await stat(absolutePath)
  if (!stats.isFile()) {
    throw new Error('not-file')
  }

  applyHeaders(response, absolutePath)
  response.statusCode = 200

  if (method === 'HEAD') {
    response.end()
    return
  }

  const stream = createReadStream(absolutePath)
  stream.on('error', () => {
    response.statusCode = 500
    response.end('Failed to read file')
  })

  stream.pipe(response)
}

const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.statusCode = 405
    response.setHeader('Allow', 'GET, HEAD')
    response.end('Method not allowed')
    return
  }

  const requestURL = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)
  let targetPath = safeResolve(requestURL.pathname)

  if (targetPath == null) {
    response.statusCode = 400
    response.end('Bad request')
    return
  }

  if (requestURL.pathname === '/') {
    targetPath = path.join(distDir, 'index.html')
  }

  try {
    await serveFile(targetPath, response, request.method)
    return
  } catch {
    const fallbackPath = path.join(distDir, 'index.html')

    try {
      await serveFile(fallbackPath, response, request.method)
      return
    } catch {
      response.statusCode = 404
      response.end('Not found')
    }
  }
})

server.listen(port, '0.0.0.0', () => {
  console.log(`Client server listening on ${port}`)
})
