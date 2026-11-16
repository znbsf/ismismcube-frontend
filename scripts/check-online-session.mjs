import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const page = fs.readFileSync(new URL('../src/pages/ismismcube/ismismcube.vue', import.meta.url), 'utf8')
const stateStart = page.indexOf('// WebSocket连接')
const businessStart = page.indexOf('// WebSocket连接管理')
assert.ok(stateStart >= 0 && businessStart > stateStart)
const source = page.slice(stateStart, page.indexOf('// 路由', stateStart)) +
  page.slice(businessStart, page.indexOf('// 计算属性', businessStart))
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText

function fixture() {
  const sockets = [], timers = new Map(), logs = []
  let nextTimer = 0, failNext = false, attempts = 0
  class Socket {
    constructor(url) {
      attempts++
      if (failNext) { failNext = false; throw Error('synthetic constructor failure') }
      this.url = url
      this.listeners = new Map()
      this.closed = false
      sockets.push(this)
    }
    addEventListener(type, callback) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set())
      this.listeners.get(type).add(callback)
    }
    removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback) }
    emit(type, event = {}) { for (const callback of [...(this.listeners.get(type) ?? [])]) callback(event) }
    close() { this.closed = true; this.emit('close', { code: 1000, reason: 'synthetic normal close' }) }
    callback(type) { return [...(this.listeners.get(type) ?? [])][0] }
    count() { return [...this.listeners.values()].reduce((count, set) => count + set.size, 0) }
  }
  const window = {
    location: { protocol: 'https:', host: 'mock.invalid' },
    setTimeout(callback) { const id = nextTimer++; timers.set(id, callback); return id },
    clearTimeout(id) { timers.delete(id) }
  }
  const console = { log: (...args) => logs.push(['log', ...args]), error: (...args) => logs.push(['error', ...args]) }
  const api = new Function('WebSocket', 'window', 'console', `
    let isComponentUnmounted = false;
    const onlineCount = { value: 0 }, danmus = [];
    const spawnDanmu = text => danmus.push(text);
    const buildIsmismcubeApiUrl = path => '/api/ismismcube' + path;
    ${compiled}
    return {connectWebSocket, disconnectWebSocket, onlineCount, danmus,
      unmount() { isComponentUnmounted = true; disconnectWebSocket() },
      mount() { isComponentUnmounted = false }
    };
  `)(Socket, window, console)
  return { api, sockets, timers, logs, fail() { failNext = true }, attempts: () => attempts }
}
const message = (socket, data) => socket.emit('message', { data })

{
  const f = fixture()
  f.api.connectWebSocket()
  const socket = f.sockets[0]
  assert.equal(socket.url, 'wss://mock.invalid/api/ismismcube/online')
  socket.emit('open')
  message(socket, 'broadcast {"online":42}')
  message(socket, 'danmu {"content":"valid synthetic"}')
  assert.equal(f.api.onlineCount.value, 42)
  assert.deepEqual(f.api.danmus, ['valid synthetic'])
  const callbacks = Object.fromEntries(['open', 'message', 'error', 'close'].map(type => [type, socket.callback(type)]))
  f.api.disconnectWebSocket()
  assert.equal(socket.count(), 0, 'disconnect removes the exact addEventListener callbacks')
  assert.equal(socket.closed, true)
  const logCount = f.logs.length
  callbacks.open({})
  callbacks.message({ data: 'broadcast {"online":999}' })
  callbacks.message({ data: 'danmu {"content":"must not spawn"}' })
  callbacks.error({})
  callbacks.close({ code: 1006 })
  assert.equal(f.api.onlineCount.value, 42)
  assert.deepEqual(f.api.danmus, ['valid synthetic'])
  assert.equal(f.timers.size, 0)
  assert.equal(f.logs.length, logCount, 'queued stale callbacks have no side effects')
}
{
  const f = fixture()
  f.api.connectWebSocket()
  const old = f.sockets[0], lateMessage = old.callback('message'), lateClose = old.callback('close')
  f.api.connectWebSocket()
  assert.equal(old.closed, true)
  assert.equal(old.count(), 0)
  message(f.sockets[1], 'broadcast {"online":7}')
  lateMessage({ data: 'broadcast {"online":999}' })
  lateClose({ code: 1006 })
  assert.equal(f.api.onlineCount.value, 7)
  assert.equal(f.timers.size, 0, 'superseded connection cannot schedule reconnect')
  const current = f.sockets[1], repeatedClose = current.callback('close')
  current.emit('close', { code: 1006 })
  repeatedClose({ code: 1006 })
  assert.equal(f.timers.size, 1, 'only one reconnect timer per connection')
  assert.equal(current.count(), 0, 'closed connection detaches all listeners')
  const queued = [...f.timers.values()][0]
  f.api.connectWebSocket()
  assert.equal(f.timers.size, 0, 'manual replacement cancels pending reconnect including timer id zero')
  queued()
  assert.equal(f.sockets.length, 3, 'cancelled timer callback cannot create another connection')
  f.api.unmount()
}
{
  const f = fixture()
  f.api.connectWebSocket()
  f.sockets[0].emit('close', { code: 1006 })
  const [id, reconnect] = [...f.timers.entries()][0]
  f.timers.delete(id)
  reconnect()
  assert.equal(f.sockets.length, 2, 'current abnormal close reconnects once')
  f.sockets[1].emit('close', { code: 1000 })
  assert.equal(f.timers.size, 0, 'normal close does not reconnect')
}
{
  const f = fixture()
  f.fail()
  f.api.connectWebSocket()
  assert.equal(f.attempts(), 1)
  assert.equal(f.timers.size, 1)
  const lateTimer = [...f.timers.values()][0]
  f.api.unmount()
  assert.equal(f.timers.size, 0)
  lateTimer()
  f.api.connectWebSocket()
  assert.equal(f.attempts(), 1, 'unmounted page cannot reconnect after constructor failure')
}
{
  const f = fixture()
  f.api.connectWebSocket()
  const old = f.sockets[0], lateMessage = old.callback('message'), lateClose = old.callback('close')
  f.api.unmount()
  assert.equal(old.closed, true)
  assert.equal(old.count(), 0)
  f.api.mount()
  f.api.connectWebSocket()
  lateMessage({ data: 'broadcast {"online":999}' })
  lateMessage({ data: 'danmu {"content":"old page"}' })
  lateClose({ code: 1006 })
  assert.equal(f.api.onlineCount.value, 0)
  assert.equal(f.api.danmus.length, 0)
  assert.equal(f.timers.size, 0, 'old callbacks stay invalid even after a new mount')
  f.api.unmount()
  assert.ok(f.sockets.every(socket => socket.closed))
}
{
  const f = fixture(); f.api.connectWebSocket(); const socket = f.sockets[0]
  message(socket, 'broadcast {"online":17}')
  for (const value of [null, {}, [], '18', -1, -2.5, 1.5]) {
    message(socket, `broadcast ${JSON.stringify({ online: value })}`)
    assert.equal(f.api.onlineCount.value, 17, 'invalid online count preserves last valid value')
  }
  message(socket, 'broadcast {"online":1e999}'); assert.equal(f.api.onlineCount.value, 17)
  message(socket, 'broadcast {"unrelated":"compatible"}'); assert.equal(f.api.onlineCount.value, 17)
  message(socket, 'broadcast {"online":0}'); assert.equal(f.api.onlineCount.value, 0)
  for (const value of [null, {}, [], 123, true]) message(socket, `danmu ${JSON.stringify({ content: value })}`)
  assert.equal(f.api.danmus.length, 0, 'non-text danmu is never coerced')
  message(socket, 'danmu {"content":"literal <safe text>"}')
  assert.deepEqual(f.api.danmus, ['literal <safe text>'])
  f.api.unmount()
}
console.log('Online session checks passed (actual main lifecycle functions; no network or sends)')
