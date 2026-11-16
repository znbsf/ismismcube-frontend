import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source = await readFile(new URL('../src/utils/aiStreamStatus.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
const { createAiStreamStatus, STREAM_LENGTH_NOTICE } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
let time = 0
const status = createAiStreamStatus(() => time)
status.record('A')
assert.deepEqual(status.snapshot(), { fragments: 1, fragmentsPerSecond: 0, ended: false })
time = 1000; status.record('B')
assert.deepEqual(status.snapshot(), { fragments: 2, fragmentsPerSecond: 2, ended: false })
time = 2000; status.record('多字的第三块')
assert.deepEqual(status.snapshot(), { fragments: 3, fragmentsPerSecond: 1.5, ended: false })
status.record(''); status.record(null); status.record(42)
assert.equal(status.snapshot().fragments, 3)
assert.equal(status.finish('stop'), '', 'normal completion is not a length limit')
assert.equal(status.finish('length'), '', 'late reasons never change an already finished stream')
status.record('ignored'); assert.equal(status.snapshot().fragments, 3)
status.reset()
assert.deepEqual(status.snapshot(), { fragments: 0, fragmentsPerSecond: 0, ended: false })

for (const reason of [undefined, null, 'stop', 'content_filter', 'unknown', 0]) {
  const stream = createAiStreamStatus(() => 0)
  for (let i = 0; i < 100; i++) stream.record('chunk')
  assert.equal(stream.finish(reason), '', 'fragment count never infers a token limit')
}
{
  const stream = createAiStreamStatus(() => 0)
  let content = ''
  const delta = 'last output'
  content += delta; stream.record(delta)
  content += stream.finish('length')
  content += stream.finish('length')
  assert.equal(content, `last output${STREAM_LENGTH_NOTICE}`, 'consume final text, then append one notice')
  assert.equal(stream.snapshot().fragments, 1)
  assert.equal(stream.snapshot().ended, true)
}
{
  const stream = createAiStreamStatus(() => 0)
  stream.record('A'); assert.equal(stream.finish(), '', 'DONE alone does not imply length')
  stream.reset(); stream.record('B')
  assert.equal(stream.finish('length'), STREAM_LENGTH_NOTICE, 'new task can report its own limit')
}
console.log('AI stream status checks passed (fragment counts/rates, reset, finish reasons; no network)')
