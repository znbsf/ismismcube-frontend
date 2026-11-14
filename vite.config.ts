import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { vitePrerenderPlugin } from 'vite-prerender-plugin'
import { createReadStream, existsSync, statSync } from 'fs'
import type { IncomingMessage, ServerResponse } from 'http'
import type { Socket } from 'net'
import { extname, isAbsolute, relative, resolve, sep } from 'path'

const STATIC_PREFIX = '/static/ismismcube'
const MIME_TYPES: Record<string, string> = {
  '.json': 'application/json; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8'
}

function sendFile(filePath: string, method: string | undefined, res: ServerResponse): boolean {
  if (!existsSync(filePath)) return false
  const stat = statSync(filePath)
  if (!stat.isFile()) return false
  const contentType = MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
  res.statusCode = 200
  res.setHeader('Content-Type', contentType)
  res.setHeader('Content-Length', stat.size)
  if (method === 'HEAD') {
    res.end()
    return true
  }
  const stream = createReadStream(filePath)
  stream.on('error', () => {
    if (!res.headersSent) {
      res.statusCode = 500
    }
    res.destroy()
  })
  stream.pipe(res)
  return true
}

function resolveInside(baseDir: string, relPath: string): string | null {
  if (!relPath || relPath.includes('\0')) return null
  const trimmed = relPath.replace(/^[/\\]+/, '')
  if (!trimmed) return null
  const candidate = resolve(baseDir, '.' + sep + trimmed)
  const rel = relative(baseDir, candidate)
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) {
    return null
  }
  return candidate
}

function isServerResponse(res: ServerResponse | Socket): res is ServerResponse {
  return 'writeHead' in res && 'end' in res
}

function localStaticAndPreviewPlugin(): Plugin {
  const publicDir = resolve(__dirname, 'public')
  const buildDir = resolve(__dirname, 'build')

  return {
    name: 'ismism-local-static-and-preview',
    configureServer(server) {
      if (process.env.VITE_PROXY_STATIC === '1') return
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        if ((req.method !== 'GET' && req.method !== 'HEAD') || !req.url) {
          next()
          return
        }
        const rawPath = req.url.split('?')[0]
        if (!rawPath.startsWith(`${STATIC_PREFIX}/`) && rawPath !== STATIC_PREFIX) {
          next()
          return
        }
        let decodedRel = ''
        try {
          decodedRel = decodeURIComponent(rawPath.slice(STATIC_PREFIX.length))
        } catch {
          next()
          return
        }
        const candidate = resolveInside(publicDir, decodedRel)
        if (candidate && sendFile(candidate, req.method, res)) {
          return
        }
        next()
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        if (!req.url) {
          next()
          return
        }
        const rawPath = req.url.split('?')[0]
        if (rawPath === '/api/ismismcube/page_view') {
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ page_view: -1, offline: true }))
          return
        }
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          next()
          return
        }
        if (rawPath.startsWith(`${STATIC_PREFIX}/`)) {
          let decodedRel = ''
          try {
            decodedRel = decodeURIComponent(rawPath.slice(STATIC_PREFIX.length))
          } catch {
            next()
            return
          }
          const inBuild = resolveInside(buildDir, decodedRel)
          if (inBuild && sendFile(inBuild, req.method, res)) {
            return
          }
          const inPublic = resolveInside(publicDir, decodedRel)
          if (inPublic && sendFile(inPublic, req.method, res)) {
            return
          }
        }
        const isStaticAssetPath = rawPath.startsWith('/static/') || rawPath.startsWith('/api/')
        const hasExt = extname(rawPath) !== ''
        if (!isStaticAssetPath && !hasExt) {
          const cleanSub = rawPath.replace(/^\/+|\/+$/g, '')
          if (cleanSub) {
            const prerendered = resolveInside(buildDir, `${cleanSub}/index.html`)
            if (prerendered && sendFile(prerendered, req.method, res)) {
              return
            }
          }
          const indexFile = resolve(buildDir, 'index.html')
          if (sendFile(indexFile, req.method, res)) {
            return
          }
        }
        next()
      })
    }
  }
}

export default defineConfig(({ command }) => {
  const proxyConfig: Record<string, {
    target: string
    ws?: boolean
    changeOrigin: boolean
    secure: boolean
    rewrite: (path: string) => string
    configure?: (proxy: { on: (event: 'error', cb: (err: Error, req: IncomingMessage, res: ServerResponse | Socket) => void) => void }) => void
  }> = {
    '/api': {
      target: 'http://127.0.0.1:1998',
      ws: true,
      changeOrigin: true,
      secure: false,
      rewrite: (path) => path.replace(/^\/api/, ''),
      configure: (proxy) => {
        proxy.on('error', (err, req, res) => {
          if (req.url?.includes('/ismismcube/page_view') && isServerResponse(res) && !res.headersSent) {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify({ page_view: -1, offline: true }))
            return
          }
          console.log('API proxy error:', err.message)
        })
      }
    }
  }

  if (process.env.VITE_PROXY_STATIC === '1') {
    proxyConfig[STATIC_PREFIX] = {
      target: 'http://127.0.0.1:1999',
      rewrite: (path) => path.replace(/^\/static/, ''),
      changeOrigin: true,
      secure: false,
      configure: (proxy) => {
        proxy.on('error', (err) => {
          console.log('Static proxy error:', err.message)
        })
      }
    }
  }

  return {
    plugins: [
      localStaticAndPreviewPlugin(),
      vue(),
      vitePrerenderPlugin({
        prerenderScript: resolve(__dirname, 'src/prerender.ts'),
        renderTarget: '#app',
        // 这两个页面也需要预渲染
        additionalPrerenderRoutes: ['/ai', '/notice']
      })
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    },
    server: {
      host: 'localhost',
      port: 2000,
      proxy: proxyConfig
    },
    build: {
      outDir: 'build',
      assetsDir: '',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['vue', 'vue-router']
          }
        }
      }
    },
    base: command === 'build' ? '/static/ismismcube/' : '/'
  }
})
