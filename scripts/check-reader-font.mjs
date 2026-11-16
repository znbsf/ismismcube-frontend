import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source = await readFile(new URL('../src/utils/readerFont.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
const { READER_FONT_KEY, parseReaderScale, readReaderScale, stepReaderScale, readerFontPixels, readerFontCss } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

for (const raw of [null, '', ' ', 'not a number', 'NaN', 'Infinity', '-1', '0.69', '1.81']) {
  assert.equal(parseReaderScale(raw), 1)
}
for (const value of [0.7, 0.75, 1, 1.3, 1.8]) {
  let writes = 0
  const storage = {
    getItem(key) { assert.equal(key, READER_FONT_KEY); return String(value) },
    setItem() { writes++ },
  }
  assert.equal(readReaderScale(storage), value, 'preserve existing preference exactly')
  assert.equal(writes, 0, 'reading never migrates or overwrites preferences')
}
assert.equal(readReaderScale({ getItem() { throw new Error('blocked') } }), 1)

for (const root of [5.9167, 16, 18.571429, 23, 32]) {
  let previous = 0
  for (let tick = 7; tick <= 18; tick++) {
    const scale = tick / 10
    const pixels = readerFontPixels(scale, root)
    assert.ok(pixels >= 13 - 1e-10)
    assert.ok(pixels > previous, `each step grows on root ${root}`)
    if (root >= 13 / 0.7) assert.ok(Math.abs(pixels - root * scale) < 1e-10, 'preserve desktop rem mapping')
    // Evaluate generated CSS lengths independently to verify the actual style mapping.
    const cssExpression = readerFontCss(scale).slice(5, -1)
      .replace(/max\(13px, 0\.7rem\)/g, String(Math.max(13, root * 0.7)))
      .replace(/max\(26px, 1\.8rem\)/g, String(Math.max(26, root * 1.8)))
    assert.ok(/^[\d.eE+* ()-]+$/.test(cssExpression))
    const cssPixels = Function(`return (${cssExpression})`)()
    assert.ok(Math.abs(cssPixels - pixels) < 1e-10)
    previous = pixels
  }
}
assert.equal(readerFontPixels(0.7, 5.9167), 13)
assert.equal(readerFontPixels(1.8, 5.9167), 26)
assert.ok(readerFontPixels(1, 5.9167) < 17, 'small-screen default stays moderate')
assert.equal(readerFontPixels(1, NaN), readerFontPixels(1, 16))
let scale = 1
for (let i = 0; i < 20; i++) scale = stepReaderScale(scale, 1)
assert.equal(scale, 1.8)
for (let i = 0; i < 20; i++) scale = stepReaderScale(scale, -1)
assert.equal(scale, 0.7)
assert.equal(stepReaderScale(1, 1), 1.1)
assert.equal(stepReaderScale(1, -1), 0.9)
console.log('Reader font checks passed (preferences, scale bounds, monotonic pixel/CSS mapping; no network)')
