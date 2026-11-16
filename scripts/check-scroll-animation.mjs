import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const source = fs.readFileSync(new URL('../src/utils/scrollAnimation.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 }
}).outputText
const { createScrollAnimationOwner } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
function fixture() {
  let time = 0, id = 0, active = true
  const frames = new Map(), cancelled = []
  const owner = createScrollAnimationOwner({
    requestFrame(callback) { const next = id++; frames.set(next, callback); return next },
    cancelFrame(id) { cancelled.push(id); frames.delete(id) },
    now: () => time,
    isActive: () => active
  })
  const element = (scrollTop = 600) => ({ scrollTop, scrollHeight: 2000, clientHeight: 500, isConnected: true })
  return {
    owner, frames, cancelled, element,
    deactivate() { active = false },
    step(nextTime) {
      time = nextTime
      const pending = [...frames.entries()]
      for (const [key, callback] of pending) { frames.delete(key); callback(time) }
    }
  }
}

// SSR construction must not require a window or schedule callbacks.
{
  const owner = createScrollAnimationOwner()
  let completed = false
  assert.equal(owner.animate({ scrollTop: 0, scrollHeight: 100, clientHeight: 10, isConnected: true }, 90, 1, () => { completed = true }), false)
  assert.equal(completed, false)
  owner.dispose()
}
{
  const f = fixture(), el = f.element()
  let completed = 0
  assert.equal(f.owner.animate(el, 2000, 1000, () => completed++), true)
  f.step(16)
  assert.ok(el.scrollTop > 600 && el.scrollTop < 602, 'first frame starts at the current position, never zero')
  f.step(500)
  assert.equal(el.scrollTop, 1050, 'target is clamped to the actual maximum scrollTop')
  f.step(1000)
  assert.equal(el.scrollTop, 1500)
  assert.equal(completed, 1)
  assert.equal(f.frames.size, 0)
}
{
  const f = fixture(), el = f.element()
  let oldCompleted = false, newCompleted = false
  f.owner.animate(el, 1500, 1000, () => { oldCompleted = true })
  const late = [...f.frames.values()][0]
  f.step(250)
  const middle = el.scrollTop
  f.owner.animate(el, 0, 1000, () => { newCompleted = true })
  assert.equal(f.frames.size, 1, 'a replacement owns the only scheduled frame for this element')
  late(250)
  assert.equal(el.scrollTop, middle, 'late cancelled callback cannot write')
  f.step(750)
  assert.equal(el.scrollTop, middle / 2)
  f.step(1250)
  assert.equal(el.scrollTop, 0)
  assert.equal(oldCompleted, false)
  assert.equal(newCompleted, true)
}
{
  const f = fixture(), el = f.element(0)
  f.owner.animate(el, () => el.scrollHeight - el.clientHeight)
  f.step(500)
  assert.equal(el.scrollTop, 750)
  el.scrollHeight = 3000
  f.step(1000)
  assert.equal(el.scrollTop, 2500, 'getter follows content added during animation')
}
{
  const f = fixture(), el = f.element()
  let completed = 0
  f.owner.animate(el, 1500, 1000, () => {
    completed++
    f.owner.animate(el, 0, 1000, () => completed++)
  })
  f.step(1000)
  assert.equal(f.frames.size, 1, 'completion starts a second phase without losing its ownership')
  f.step(1500)
  assert.equal(el.scrollTop, 750)
  f.step(2000)
  assert.equal(el.scrollTop, 0)
  assert.equal(completed, 2)
}
for (const reason of ['dispose', 'disconnect', 'inactive', 'cancel']) {
  const f = fixture(), el = f.element(), other = f.element(100)
  let completed = false
  f.owner.animate(el, 1500, 1000, () => { completed = true; f.owner.animate(el, 0) })
  f.owner.animate(other, 0)
  const late = [...f.frames.values()][0]
  if (reason === 'dispose') f.owner.dispose()
  if (reason === 'disconnect') el.isConnected = false
  if (reason === 'inactive') f.deactivate()
  if (reason === 'cancel') f.owner.cancel(el)
  f.step(1000)
  late(1000)
  assert.equal(el.scrollTop, 600)
  assert.equal(completed, false, `${reason} cannot run the next animation phase`)
  if (reason === 'dispose' || reason === 'inactive') assert.equal(other.scrollTop, 100)
  if (reason === 'dispose') assert.equal(f.owner.animate(el, 0), false)
  f.owner.dispose()
  assert.equal(f.frames.size, 0)
}
{
  const f = fixture(), el = f.element()
  f.owner.animate(el, 0)
  assert.equal(f.frames.has(0), true)
  f.owner.cancel(el)
  assert.equal(f.cancelled.includes(0), true, 'RAF id zero is still cancellable')
  let completed = false
  f.owner.animate(el, -100, 0, () => { completed = true })
  f.step(0)
  assert.equal(el.scrollTop, 0)
  assert.equal(completed, true)
  assert.equal(f.owner.animate(el, 0, -1), false)
  f.owner.animate(el, () => { throw Error('synthetic target failure') })
  f.step(1)
  assert.equal(f.frames.size, 0)
  f.owner.animate(el, NaN)
  f.step(2)
  assert.equal(f.frames.size, 0)
}
console.log('Scroll animation checks passed (current position, replacement, dynamic target, teardown; no DOM/network)')
