import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
import { ref, watch, reactive } from 'vue'
import { parse, compileScript, compileStyle } from 'vue/compiler-sfc'

const source = fs.readFileSync(new URL('../src/pages/ismismcube/ismismcube.vue', import.meta.url), 'utf8')
const descriptor = parse(source).descriptor
compileScript(descriptor, { id: 'danmu-check', inlineTemplate: true })
assert.equal(compileStyle({ source: descriptor.styles[0].content, filename: 'main.vue', id: 'danmu-check', scoped: true }).errors.length, 0)
const compile = text => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
const helperSource = compile(fs.readFileSync(new URL('../src/utils/danmuRequest.ts', import.meta.url), 'utf8'))
const business = compile(source.slice(source.indexOf('const danmuPending ='), source.indexOf('let searchDebounceTimer')))
const visualBusiness = compile(source.slice(source.indexOf('const MAX_ACTIVE_DANMUS ='), source.indexOf('const danmuPending =')))
const routeBusiness = compile(source.slice(source.indexOf('watch(() => route.params.ismTag'), source.indexOf('watch(activeIsmTag')))
const tick = async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
const ok = { ok: true, status: 204, json() { throw Error('must not read successful JSON body') }, text() { throw Error('must not read successful body') } }
function fixture() {
  let now = 0, timerId = 0
  const timers = new Map(), requests = []
  const setTimeout = (callback, delay) => { const id = ++timerId; timers.set(id, { callback, due: now + delay }); return id }
  const clearTimeout = id => timers.delete(id)
  const fetch = (url, init) => { const pending = deferred(); requests.push({ ...pending, url, init }); return pending.promise }
  const mod = { exports: {} }
  new Function('exports', 'fetch', 'setTimeout', 'clearTimeout', helperSource)(mod.exports, fetch, setTimeout, clearTimeout)
  const text = ref('原始弹幕'), enabled = ref(true)
  const api = new Function('ref', 'watch', 'reactive', 'danmuText', 'danmuEnabled', 'postDanmu', 'DanmuTimeoutError', `
    let isComponentUnmounted=false; const buildIsmismcubeApiUrl=path=>'/api/ismismcube'+path;
    const activeDanmus=ref([]),danmuOverlayRef=ref({clientHeight:400});
    const route=reactive({params:{ismTag:'1'}});let featureRevealFocusToken=0,pendingCourseJumpTarget=null,courseJumpFocusToken=0;const handleRoute=()=>{};
    ${visualBusiness}
    ${business}
    ${routeBusiness}
    return {sendDanmu,toggleDanmu,spawnDanmu,removeDanmu,activeDanmus,danmuPending,danmuStatus,route,dispose(){isComponentUnmounted=true;activeDanmus.value=[];cancelDanmuRequest()}}
  `)(ref, watch, reactive, text, enabled, mod.exports.postDanmu, mod.exports.DanmuTimeoutError)
  return { api, text, enabled, requests, timers, helper: mod.exports,
    elapse(ms) { now += ms; for (const [id, timer] of [...timers]) if (timer.due <= now) { timers.delete(id); timer.callback() } },
  }
}
for (const flags of [{ isComposing: true }, { keyCode: 229 }, { repeat: true }, { ctrlKey: true }, { altKey: true }, { metaKey: true }, { shiftKey: true }]) {
  const f = fixture(); await f.api.sendDanmu(flags); await tick()
  assert.equal(f.requests.length, 0, 'IME/repeat/modified Enter never dispatches')
  assert.equal(f.text.value, '原始弹幕')
}
{
  const f = fixture(), first = f.api.sendDanmu(), duplicate = f.api.sendDanmu(); await tick()
  assert.equal(f.requests.length, 1, 'single-flight blocks a second Enter')
  assert.equal(f.requests[0].init.method, 'POST')
  assert.equal(f.requests[0].url, '/api/ismismcube/send_danmu')
  assert.deepEqual(JSON.parse(f.requests[0].init.body), { content: '原始弹幕' })
  assert.equal(f.api.danmuPending.value, true)
  f.requests[0].resolve(ok); await first; await duplicate
  assert.equal(f.text.value, '')
  assert.equal(f.api.danmuPending.value, false)
  assert.equal(f.timers.size, 0)
}
for (const editBack of [false, true]) {
  const f = fixture(), pending = f.api.sendDanmu(); await tick()
  f.text.value = '新草稿'
  if (editBack) f.text.value = '原始弹幕'
  f.requests[0].resolve(ok); await pending
  assert.equal(f.text.value, editBack ? '原始弹幕' : '新草稿', 'revision preserves a newer draft even when edited back to identical text')
  assert.ok(f.api.danmuStatus.value.includes('新草稿已保留'))
}
{
  const f = fixture(), pending = f.api.sendDanmu(); await tick()
  f.requests[0].resolve({ ok: false, status: 503, text() { throw Error('failure body must never be awaited') } })
  await pending
  assert.equal(f.text.value, '原始弹幕')
  assert.ok(f.api.danmuStatus.value.includes('发送失败'))
  assert.equal(f.api.danmuPending.value, false)
  assert.equal(f.timers.size, 0)
}
for (const late of ['resolve', 'reject']) {
  const f = fixture(), pending = f.api.sendDanmu(); await tick()
  f.elapse(14999); await tick(); assert.equal(f.api.danmuPending.value, true)
  f.elapse(1); await pending
  assert.equal(f.requests[0].init.signal.aborted, true)
  assert.equal(f.requests.length, 1)
  assert.equal(f.api.danmuPending.value, false)
  assert.ok(f.api.danmuStatus.value.includes('服务器可能已收到'))
  assert.equal(f.timers.size, 0)
  const newer = f.api.sendDanmu(); await tick()
  if (late === 'resolve') f.requests[0].resolve(ok); else f.requests[0].reject(Error('late ignored failure'))
  await tick()
  assert.equal(f.api.danmuPending.value, true, 'old completion cannot clear a newer pending request')
  assert.equal(f.api.danmuStatus.value, '正在发送…')
  f.requests[1].resolve(ok); await newer
  assert.equal(f.text.value, '')
}
for (const late of ['resolve', 'reject']) {
  const f = fixture(), pending = f.api.sendDanmu(); await tick()
  const before = [f.api.danmuPending.value, f.api.danmuStatus.value, f.text.value]
  f.api.dispose(); await pending
  assert.equal(f.requests[0].init.signal.aborted, true)
  assert.equal(f.timers.size, 0)
  if (late === 'resolve') f.requests[0].resolve(ok); else f.requests[0].reject(Error('late unmounted failure'))
  await tick(); f.elapse(20000)
  assert.deepEqual([f.api.danmuPending.value, f.api.danmuStatus.value, f.text.value], before, 'unmount prevents all late UI writes')
}
{
  const f = fixture(), pending = f.api.sendDanmu(); await tick()
  f.api.toggleDanmu(); f.api.route.params.ismTag = '2'; await tick()
  assert.equal(f.enabled.value, false)
  assert.equal(f.requests[0].init.signal.aborted, false, 'hiding danmu or changing node does not withdraw an already sent POST')
  f.api.toggleDanmu(); await f.api.sendDanmu(); await tick()
  assert.equal(f.requests.length, 1, 'reopening and same-page navigation retain the existing single flight')
  assert.equal(f.api.danmuPending.value, true)
  f.requests[0].resolve(ok); await pending
  assert.equal(f.api.danmuPending.value, false)
}
{
  const f = fixture(); f.text.value = '  '
  await f.api.sendDanmu(); assert.equal(f.requests.length, 0)
  assert.ok(f.api.danmuStatus.value.includes('请输入'))
  f.api.toggleDanmu(); assert.equal(f.enabled.value, false)
  f.text.value = 'blocked'; await f.api.sendDanmu(); assert.equal(f.requests.length, 0)
  const controller = new AbortController(); controller.abort()
  await assert.rejects(f.helper.postDanmu('/mock', 'body', { signal: controller.signal }), { name: 'AbortError' })
  assert.equal(f.requests.length, 0); assert.equal(f.timers.size, 0)
}
assert.ok(source.includes('<button id="danmu_toggle_button" type="button" :aria-pressed="danmuEnabled"'))
assert.ok(source.includes('id="danmu_status" role="status"'))
assert.match(source, /onUnmounted\(\(\) => \{\s*isComponentUnmounted = true\s*activeDanmus.value = \[\]\s*cancelDanmuRequest\(\)/)
{
  const f = fixture(); f.api.toggleDanmu()
  for (let i = 0; i < 120; i++) f.api.spawnDanmu(`closed-${i}`)
  assert.equal(f.api.activeDanmus.value.length, 0, 'disabled danmu never creates hidden visual items')
  f.api.toggleDanmu()
  for (const invalid of [null, {}, [], 123, '', '  ']) f.api.spawnDanmu(invalid)
  assert.equal(f.api.activeDanmus.value.length, 0)
  for (let i = 0; i < 120; i++) f.api.spawnDanmu(`open-${i}`)
  assert.equal(f.api.activeDanmus.value.length, 40, '40 is a local simultaneous visual-effect budget')
  assert.deepEqual(f.api.activeDanmus.value.map(item => item.text), Array.from({ length: 40 }, (_, i) => `open-${80 + i}`))
  const ids = f.api.activeDanmus.value.map(item => item.id)
  assert.equal(new Set(ids).size, 40)
  assert.ok(ids.every((id, i) => i === 0 || id > ids[i - 1]), 'local monotonic IDs cannot collide within a millisecond')
  f.api.removeDanmu(ids[7])
  assert.deepEqual(f.api.activeDanmus.value.map(item => item.id), ids.filter(id => id !== ids[7]), 'animationend removes exactly one ID')
  f.api.removeDanmu(-1); assert.equal(f.api.activeDanmus.value.length, 39)
  f.api.toggleDanmu(); assert.equal(f.api.activeDanmus.value.length, 0)
  f.api.toggleDanmu(); assert.equal(f.api.activeDanmus.value.length, 0, 'reopening does not replay hidden history')
  f.api.spawnDanmu('new only'); assert.ok(f.api.activeDanmus.value[0].id > ids.at(-1))
  f.api.dispose(); f.api.spawnDanmu('late unmounted')
  assert.equal(f.api.activeDanmus.value.length, 0)
}
console.log('Danmu checks passed (actual business + bounded headers helper; all requests mocked)')
