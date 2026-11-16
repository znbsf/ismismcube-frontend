import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const source = fs.readFileSync(new URL('../src/utils/aiChatSettings.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 }
}).outputText
const { createAiChatSettings } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const service = {
  prompt: 'service default', content_size: 4096, max_tokens: 512,
  temperature: 0.5, top_p: 0.9, frequency_penalty: 0,
  presence_penalty: 0, repeat_penalty: 1
}
const fixture = () => {
  const settings = createAiChatSettings()
  assert.equal(settings.updateServiceDefaults(service).ok, true)
  return settings
}

// Unreceived values are safe for formatting but must not become fake API defaults.
{
  const s = createAiChatSettings()
  assert.deepEqual(s.requestSettings, {})
  assert.equal(s.effective.temperature.toFixed(2), '0.00')
  assert.equal(s.saveDraft().ok, false)
  assert.equal(s.resetDraft(), null)
}

// Restore and Cancel do not modify committed custom settings.
{
  const s = fixture()
  s.openDraft()
  assert.equal(s.saveDraft({ prompt: 'saved custom', temperature: 0.8 }).ok, true)
  s.openDraft()
  assert.equal(s.resetDraft().prompt, 'service default')
  assert.equal(s.effective.prompt, 'saved custom')
  s.cancelDraft()
  assert.equal(s.effective.prompt, 'saved custom')
  assert.equal(s.effective.temperature, 0.8)
  assert.equal(s.isOpen, false)
  assert.equal(s.openDraft().prompt, 'saved custom')
}

// Later broadcasts update defaults/constraints and untouched values, never saved overrides.
{
  const s = fixture()
  s.openDraft()
  s.saveDraft({ prompt: 'saved custom', temperature: 0.8 })
  s.updateServiceDefaults({ prompt: 'new default', temperature: 0.2, top_p: 0.6, max_tokens: 1024 })
  assert.equal(s.effective.prompt, 'saved custom')
  assert.equal(s.effective.temperature, 0.8)
  assert.equal(s.effective.top_p, 0.6)
  assert.equal(s.effective.max_tokens, 1024)
  assert.deepEqual(Object.keys(s.savedOverrides).sort(), ['prompt', 'temperature'])
  assert.equal(Object.hasOwn(s.requestSettings, 'max_tokens'), false)
  const draft = s.openDraft()
  s.updateServiceDefaults({ top_p: 0.4, prompt: 'late default', content_size: 8192 })
  assert.deepEqual(s.draft, draft, 'late configuration must not change an open draft')
  s.saveDraft({ frequency_penalty: 0.3 })
  assert.equal(s.effective.top_p, 0.4, 'unmodified draft fields follow current defaults after save')
  assert.equal(s.effective.prompt, 'saved custom')
  assert.equal(s.effective.content_size, 8192)
  assert.equal(s.effective.frequency_penalty, 0.3)
}

// Saving a restored draft clears prior overrides; post-restore edits remain explicit.
{
  const s = fixture()
  s.openDraft(); s.saveDraft({ prompt: 'custom', temperature: 0.8 })
  s.openDraft(); s.resetDraft()
  s.updateDraft({ prompt: 'edit after restore' })
  s.updateServiceDefaults({ temperature: 0.3 })
  assert.equal(s.draft.temperature, 0.5)
  s.saveDraft()
  assert.deepEqual(s.savedOverrides, { prompt: 'edit after restore' })
  assert.equal(s.effective.temperature, 0.3)
}

// Bad service data cannot change values consumed by toFixed or read-only constraints.
{
  const s = fixture()
  const bad = s.updateServiceDefaults({
    prompt: null, temperature: '0.5', top_p: NaN, frequency_penalty: Infinity,
    presence_penalty: {}, repeat_penalty: -1, max_tokens: 0, content_size: 2.5,
    unknown: true
  })
  assert.equal(bad.ok, false)
  assert.equal(bad.rejected.length, 9)
  assert.deepEqual(s.serviceDefaults, service)
  for (const key of ['temperature', 'top_p', 'frequency_penalty', 'presence_penalty', 'repeat_penalty']) {
    assert.equal(typeof s.effective[key].toFixed(2), 'string')
  }
  assert.equal(s.updateServiceDefaults(null).ok, false)
  assert.equal(s.updateServiceDefaults([]).ok, false)
  // Valid fields in a partial broadcast can still update independently.
  assert.equal(s.updateServiceDefaults({ prompt: 'valid update', top_p: 'bad' }).ok, false)
  assert.equal(s.effective.prompt, 'valid update')
  assert.equal(s.effective.top_p, 0.9)
}

// Draft validation is transactional; snapshots cannot mutate internal state.
{
  const s = fixture()
  const opened = s.openDraft()
  opened.prompt = 'outside mutation'
  assert.equal(s.draft.prompt, 'service default')
  assert.equal(s.updateDraft({ prompt: 'valid part', temperature: Infinity }).ok, false)
  assert.equal(s.draft.prompt, 'service default')
  assert.equal(s.saveDraft({ prompt: 'valid part', top_p: 'bad' }).ok, false)
  assert.deepEqual(s.savedOverrides, {})
  assert.equal(s.isOpen, true)
  assert.equal(s.saveDraft({ max_tokens: 1024 }).ok, false)
  const defaults = s.serviceDefaults
  defaults.temperature = 'invalid mutation'
  assert.equal(s.effective.temperature, 0.5)
  s.cancelDraft()
  assert.equal(s.updateDraft({ prompt: 'closed' }).ok, false)
}
console.log('AI settings checks passed (service defaults / overrides / modal transactions; no network)')
