import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText
const module = { exports: {} }
new Function('exports', compile(fs.readFileSync(new URL('../src/utils/staticPayload.ts', import.meta.url), 'utf8')))(module.exports)
const { validateCoursesPayload, validateEnrichmentsPayload, validateIsmPayload, validateCourseBodiesPayload } = module.exports
const course = { id: 'synthetic', title: '课程', url: '/synthetic', kind: 'review', related_codes: [] }
const node = { transcripts: [], readings: [], axis_evidence: [], editorial_notes: [], substantive_open_questions: [] }
assert.ok(validateCoursesPayload({ courses: [], extra: true }))
assert.ok(validateCoursesPayload({ courses: [{ ...course, catalogue_code: null, archival_published_date: null, body_ref: null }], unknown_metadata: {} }))
assert.ok(validateEnrichmentsPayload({ nodes: {} }))
assert.ok(validateEnrichmentsPayload({ nodes: { '1': { ...node, unknown_metadata: {}, summary_evidence: null, review_summary: null } } }))
for (const value of [null, [], {}, { courses: null }, { courses: {} }, { courses: [null] },
  { courses: [{ ...course, title: 1 }] }, { courses: [{ ...course, related_codes: [null] }] },
  { courses: [{ ...course, archival_published_date: {} }] }, { courses: [{ ...course, catalogue_code: 1 }] },
  { courses: [{ ...course, body_ref: {} }] }, { courses: [{ ...course, video_check: { duration_seconds: '10' } }] }]) assert.equal(validateCoursesPayload(value), false)
for (const value of [null, [], {}, { nodes: null }, { nodes: [] }, { nodes: { '1': null } }, { nodes: { '1': {} } },
  ...['transcripts', 'readings', 'axis_evidence'].map(key => ({ nodes: { '1': { ...node, [key]: [null] } } })),
  { nodes: { '1': { ...node, editorial_notes: [1] } } },
  { nodes: { '1': { ...node, review_summary: { highlights: [null] } } } },
  { nodes: { '1': { ...node, review_summary: { highlights: [{ field_path: {}, canonical_status: 'supported', resolution_state: 'open' }] } } } }]) assert.equal(validateEnrichmentsPayload(value), false)
for (const [name, validate] of [['courses.json', validateCoursesPayload], ['cube-enrichments.json', validateEnrichmentsPayload], ['ism.json', validateIsmPayload], ['course-bodies.json', validateCourseBodiesPayload]]) {
  const publicPayload = JSON.parse(fs.readFileSync(new URL(`../public/${name}`, import.meta.url), 'utf8'))
  assert.ok(validate(publicPayload), `current ${name} UI structure remains compatible`)
}

// Reuse the existing renderer and real mounted main-loader harness, not a
// second renderer or a copied implementation of the loader under test.
const harnessUrl = new URL('./check-reader-tabs.mjs', import.meta.url)
let harnessSource = fs.readFileSync(harnessUrl, 'utf8')
harnessSource = harnessSource.slice(0, harnessSource.indexOf('async function runTests()'))
  .replace(/^const require = createRequire.+$/m, '')
  .replaceAll('import.meta.url', JSON.stringify(harnessUrl.href))
  .replace("if (url.endsWith('/courses.json')) return structuredClone(SAMPLE_COURSES)",
    "if (url.endsWith('/courses.json')) return structuredClone(shapePayloads.courses)")
  .replace("if (url.endsWith('/cube-enrichments.json')) return structuredClone(SAMPLE_ENRICHMENTS)",
    "if (url.endsWith('/cube-enrichments.json')) return structuredClone(shapePayloads.enrichments)")
harnessSource = harnessSource.replace('return structuredClone({ ...SAMPLE_ISM, ...inlineNodes })', 'return structuredClone(shapePayloads.ism)')
  .replace('return structuredClone(SAMPLE_BODIES)', 'return structuredClone(shapePayloads.bodies)')
const createHarness = new Function('require', 'module', 'exports', 'shapePayloads', compile(harnessSource) +
  ';return {buildHarness,createStorageMock,flush,findNodes,getText,SAMPLE_COURSES,SAMPLE_ENRICHMENTS,SAMPLE_ISM,SAMPLE_BODIES}')
assert.ok(validateIsmPayload({ introduction: [], extra: true }))
assert.ok(validateCourseBodiesPayload({}))
for (const value of [null, {}, { introduction: [null] }, { introduction: [], '1': null }]) assert.equal(validateIsmPayload(value), false)
for (const value of [null, [], { test: null }, { test: { id: 'test', title: 'test', course_summary: [null] } }]) assert.equal(validateCourseBodiesPayload(value), false)
const shapes = [
  ['ism', null], ['ism', {}], ['ism', { introduction: [], '1': null }],
  ['bodies', null], ['bodies', { BV1JT4y1K7dp: { id: 'BV1JT4y1K7dp', title: 'test', course_summary: [null] } }],
  ['courses', {}], ['courses', { courses: [null] }], ['courses', { courses: [{ ...course, related_codes: {} }] }],
  ['enrichments', {}], ['enrichments', { nodes: null }], ['enrichments', { nodes: { '1': {} } }],
  ['enrichments', { nodes: { '1': { ...node, review_summary: { highlights: [null] } } } }],
]
for (const [resource, bad] of shapes) {
  const payloads = {}
  const harness = createHarness(require, { exports: {} }, {}, payloads)
  payloads.ism = harness.SAMPLE_ISM
  payloads.bodies = harness.SAMPLE_BODIES
  payloads.courses = harness.SAMPLE_COURSES
  payloads.enrichments = harness.SAMPLE_ENRICHMENTS
  payloads[resource] = bad
  const ctx = harness.buildHarness(harness.createStorageMock()), renderErrors = []
  ctx.app.config.errorHandler = error => renderErrors.push(error)
  ctx.app.config.warnHandler = () => {}
  await harness.flush(); await harness.flush()
  assert.equal(renderErrors.length, 0, `${resource} malformed data must not reach render`)
  const byText = label => harness.findNodes(ctx.root, el => el.type === 'button' && harness.getText(el).trim() === label)[0]
  if (resource === 'ism') {
    assert.ok(harness.getText(ctx.root).includes('数据加载失败'))
    payloads.ism = harness.SAMPLE_ISM
    byText('重试加载').dispatch('click')
    await harness.flush(); await harness.flush()
    assert.ok(!harness.getText(ctx.root).includes('数据加载失败'))
    assert.ok(harness.getText(ctx.root).includes('一元论'))
  } else if (resource === 'bodies') {
    harness.findNodes(ctx.root, el => el.props.id === 'courses_button')[0].dispatch('click')
    await harness.flush(); await harness.flush()
    harness.findNodes(ctx.root, el => el.type === 'button' && /^全部课程/.test(harness.getText(el)))[0].dispatch('click')
    await harness.flush()
    harness.findNodes(ctx.root, el => el.props['data-course-id'] === 'BV1JT4y1K7dp')[0].dispatch('click')
    await harness.flush(); await harness.flush()
    assert.ok(harness.getText(ctx.root).includes('课程摘要正文加载失败'))
    payloads.bodies = harness.SAMPLE_BODIES
    byText('重试加载摘要').dispatch('click')
    await harness.flush(); await harness.flush()
    assert.ok(harness.getText(ctx.root).includes('课程摘要正文。'))
  } else if (resource === 'courses') {
    harness.findNodes(ctx.root, el => el.props.id === 'courses_button')[0].dispatch('click')
    await harness.flush(); await harness.flush()
    assert.ok(harness.getText(ctx.root).includes('补充课程目录加载失败'))
    assert.equal(harness.findNodes(ctx.root, el => el.props.class === 'drawer_subtitle').length, 1)
    payloads.courses = harness.SAMPLE_COURSES
    byText('重试加载').dispatch('click')
    await harness.flush(); await harness.flush()
    assert.ok(!harness.getText(ctx.root).includes('补充课程目录加载失败'))
    assert.ok(harness.getText(ctx.root).includes('共 1 条课程元数据'))
  } else {
    assert.ok(harness.getText(ctx.root).includes('索引加载失败'))
    payloads.enrichments = harness.SAMPLE_ENRICHMENTS
    byText('索引重试').dispatch('click')
    await harness.flush(); await harness.flush()
    assert.ok(!harness.getText(ctx.root).includes('索引加载失败'))
    assert.ok(harness.getText(ctx.root).includes('节点已建索引'))
  }
  assert.equal(renderErrors.length, 0)
  ctx.app.unmount()
}
console.log('Static payload checks passed (UI structure, public compatibility, actual mounted loader failures/retry; no network)')
