import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const compile = path => ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const config = { exports: {} }
new Function('exports', compile('../src/config/readingRoute.ts'))(config.exports)
const source = compile('../src/utils/routeProgress.ts')
function fixture() {
  const disk = new Map([['other.route', '{"done":["keep"]}']])
  let blocked = false
  let readBlocked = false
  const storage = {
    getItem(key) { if (readBlocked) throw Error('read blocked'); return disk.get(key) ?? null },
    setItem(key, value) { if (blocked) throw Error('write blocked'); disk.set(key, value) },
    removeItem(key) { if (blocked) throw Error('write blocked'); disk.delete(key) },
  }
  function tab() {
    const mod = { exports: {} }
    new Function('require', 'exports', 'localStorage', source)(id => id === 'vue' ? require('vue') : config.exports, mod.exports, storage)
    mod.exports.loadRouteProgress()
    return mod.exports
  }
  const a = tab(), b = tab()
  const steps = a.ROUTE_STEPS_FLAT
  const click = (client, index) => client.toggleRouteStepDone(steps[index].stage.id, steps[index].step.code)
  const ids = () => JSON.parse(disk.get(a.ROUTE_PROGRESS_STORAGE_KEY) ?? '{"done":[]}').done
  return { a, b, tab, steps, disk, click, ids, block: value => { blocked = value }, blockRead: value => { readBlocked = value } }
}
const same = (actual, expected) => assert.deepEqual([...actual].sort(), [...expected].sort())

{
  const f = fixture()
  f.click(f.a, 0); f.click(f.b, 1)
  same(f.ids(), [f.steps[0].stepId, f.steps[1].stepId])
  assert.equal(f.disk.get('other.route'), '{"done":["keep"]}')
  // Stale B checking the same step expresses done=true, never toggles disk off.
  const stale = f.tab()
  f.click(f.a, 2); f.click(stale, 2)
  assert.ok(f.ids().includes(f.steps[2].stepId))
  // Two tabs that both saw done=true express the same done=false intent.
  const c = f.tab(), d = f.tab()
  f.click(c, 2); f.click(d, 2)
  assert.ok(!f.ids().includes(f.steps[2].stepId))
}
{
  const f = fixture()
  f.click(f.a, 0); f.click(f.a, 1)
  const stale = f.tab()
  const staleUncheck = f.tab()
  f.a.resetRouteProgress()
  f.click(stale, 2)
  same(f.ids(), [f.steps[2].stepId])
  f.click(staleUncheck, 0) // It was checked in stale UI: intent is unchecked.
  same(f.ids(), [f.steps[2].stepId])
}
{
  const f = fixture()
  f.block(true); f.click(f.a, 0)
  assert.equal(f.a.getRouteProgressStorageError(), true)
  assert.ok(f.a.routeDoneIds.value.includes(f.steps[0].stepId))
  f.block(false); f.click(f.b, 1)
  f.a.loadRouteProgress() // Loading preserves the failed local action.
  assert.equal(f.a.getRouteProgressStorageError(), true)
  assert.ok(f.a.routeDoneIds.value.includes(f.steps[0].stepId))
  assert.equal(f.a.saveRouteProgress([...f.a.routeDoneIds.value]), true)
  same(f.ids(), [f.steps[0].stepId, f.steps[1].stepId])
  assert.equal(f.a.getRouteProgressStorageError(), false)
}
{
  const f = fixture()
  f.click(f.a, 0); f.block(true)
  assert.equal(f.a.resetRouteProgress(), false)
  f.block(false); f.click(f.a, 1)
  same(f.ids(), [f.steps[1].stepId])
}
{
  const f = fixture()
  const key = f.a.ROUTE_PROGRESS_STORAGE_KEY
  f.disk.set(key, '{broken')
  f.click(f.a, 0)
  assert.equal(f.disk.get(key), '{broken', 'bad source remains untouched')
  assert.equal(f.a.getRouteProgressStorageError(), true)
  assert.equal(f.a.routeProgressErrorKind.value, 'read')
  assert.equal(f.a.routeProgressHasPending.value, true)
  for (const invalid of ['{"done":[123]}', '{"done":["unknown:1"]}', '{"done":null}']) {
    f.disk.set(key, invalid)
    f.a.saveRouteProgress([...f.a.routeDoneIds.value])
    assert.equal(f.disk.get(key), invalid, 'invalid entries remain untouched')
    assert.equal(f.a.getRouteProgressStorageError(), true)
    assert.equal(f.a.routeProgressErrorKind.value, 'read')
  }
  assert.equal(f.a.resetRouteProgress(), true, 'explicit reset clears corrupted storage')
  assert.equal(f.disk.has(key), false)
  assert.equal(f.a.getRouteProgressStorageError(), false)
  assert.equal(f.a.routeProgressErrorKind.value, null)
  assert.equal(f.a.routeProgressHasPending.value, false)

  f.disk.set(key, JSON.stringify({ done: [f.steps[1].stepId] }))
  f.click(f.a, 2)
  same(f.ids(), [f.steps[1].stepId, f.steps[2].stepId])
  f.blockRead(true); f.click(f.a, 3)
  assert.equal(f.a.getRouteProgressStorageError(), true)
  assert.equal(f.a.routeProgressErrorKind.value, 'read')
  f.blockRead(false)
  assert.equal(f.a.saveRouteProgress([...f.a.routeDoneIds.value]), true)
  assert.ok(f.ids().includes(f.steps[3].stepId))
  assert.equal(f.a.routeProgressErrorKind.value, null)
}
{
  // Unchecking the last done step on write failure leaves done=0 with pending intent intact.
  const f = fixture()
  f.click(f.a, 0)
  f.block(true)
  f.click(f.a, 0)
  assert.equal(f.a.routeDoneIds.value.length, 0)
  assert.equal(f.a.getRouteProgressStorageError(), true)
  assert.equal(f.a.routeProgressErrorKind.value, 'write')
  assert.equal(f.a.routeProgressHasPending.value, true)
  f.block(false)
  f.click(f.b, 1)
  assert.equal(f.a.saveRouteProgress([...f.a.routeDoneIds.value]), true)
  same(f.ids(), [f.steps[1].stepId])
  assert.equal(f.a.getRouteProgressStorageError(), false)
  assert.equal(f.a.routeProgressHasPending.value, false)
}
{
  const f = fixture()
  const anotherStage = f.steps.findIndex(step => step.stage.id !== f.steps[0].stage.id)
  assert.ok(anotherStage > 0)
  f.click(f.a, 0); f.click(f.b, anotherStage)
  same(f.ids(), [f.steps[0].stepId, f.steps[anotherStage].stepId])
  assert.equal(f.a.toggleRouteStepDone('unknown', '1'), false)
}
console.log('Progress checks passed (independent tab modules; synthetic in-memory storage; no network)')
