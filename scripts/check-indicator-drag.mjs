import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source = await readFile(new URL('../src/utils/indicatorDrag.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText
const { createIndicatorDrag } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
class Target {
  listeners = new Map()
  addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn) }
  removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn) }
  emit(type, event = {}) { for (const fn of [...this.listeners.get(type) ?? []]) fn(event) }
  get count() { return [...this.listeners.values()].reduce((sum, set) => sum + set.size, 0) }
}
function fixture() {
  const win = new Target(), doc = new Target()
  doc.body = { style: { userSelect: 'text', pointerEvents: 'auto' } }
  doc.documentElement = { style: { cursor: 'crosshair' } }
  doc.visibilityState = 'visible'
  const handle = { isConnected: true, style: { pointerEvents: 'inherit', backgroundColor: 'red' } }
  const adjuster = { isConnected: true, offsetHeight: 100 }
  let ratio = 0.5, toggles = 0, missing = false
  const drag = createIndicatorDrag({ window: win, document: doc,
    getIndicator: () => missing ? null : handle, getAdjuster: () => missing ? null : adjuster,
    getRatio: () => ratio, setRatio: value => { ratio = value }, toggleOverview: () => { toggles++ },
  })
  return { win, doc, handle, adjuster, drag, get ratio() { return ratio }, get toggles() { return toggles },
    missing() { missing = true },
    assertClean() {
      assert.equal(win.count + doc.count, 0)
      assert.deepEqual(doc.body.style, { userSelect: 'text', pointerEvents: 'auto' })
      assert.equal(doc.documentElement.style.cursor, 'crosshair')
      assert.deepEqual(handle.style, { pointerEvents: 'inherit', backgroundColor: 'red' })
    },
  }
}
{
  const f = fixture()
  f.drag.start({ button: 2 }); f.assertClean()
  f.drag.start({ button: 0 }); f.drag.start({ button: 0 })
  f.win.emit('mousemove', { movementY: 0, movementX: 0 })
  f.win.emit('mousemove', { movementY: 0 })
  f.doc.emit('visibilitychange')
  f.win.emit('mouseup', { button: 2 })
  f.win.emit('mouseup'); f.win.emit('mouseup')
  assert.equal(f.toggles, 1); f.assertClean()
  f.drag.start({ button: 0 })
  f.win.emit('mousemove', { movementY: 20, movementX: 0 }); assert.equal(f.ratio, 0.7)
  f.win.emit('mousemove', { movementY: 200, movementX: 0 }); assert.equal(f.ratio, 1)
  f.win.emit('mousemove', { movementY: -300, movementX: 0 }); assert.equal(f.ratio, 0)
  f.win.emit('mouseup'); assert.equal(f.toggles, 1); f.assertClean()
}
for (const reason of ['blur', 'pagehide', 'pointercancel', 'hidden', 'dispose', 'missing', 'zero', 'detached']) {
  const f = fixture(); f.drag.start({ button: 0 })
  if (reason === 'hidden') { f.doc.visibilityState = 'hidden'; f.doc.emit('visibilitychange') }
  else if (reason === 'dispose') f.drag.dispose()
  else if (reason === 'missing') { f.missing(); f.win.emit('mousemove', { movementY: 1 }) }
  else if (reason === 'zero') { f.adjuster.offsetHeight = 0; f.win.emit('mousemove', { movementY: 1 }) }
  else if (reason === 'detached') { f.handle.isConnected = false; f.win.emit('mouseup') }
  else f.win.emit(reason)
  f.win.emit('mouseup'); f.drag.cancel(); f.drag.cancel()
  assert.equal(f.toggles, 0, reason); f.assertClean()
  if (reason === 'dispose') { f.drag.start({ button: 0 }); f.assertClean() }
}
{
  const f = fixture(); f.missing(); f.drag.start({ button: 0 }); f.assertClean()
}
{
  const f = fixture(); f.adjuster.offsetHeight = 0; f.drag.start({ button: 0 }); f.assertClean()
}
{
  const f = fixture(); f.doc.body = null; f.drag.start({ button: 0 }); assert.equal(f.win.count + f.doc.count, 0)
}
{
  const f = fixture(); f.doc.documentElement = null; f.drag.start({ button: 0 }); assert.equal(f.win.count + f.doc.count, 0)
}
console.log('Indicator drag checks passed (fake DOM/events; no renderer or network)')
