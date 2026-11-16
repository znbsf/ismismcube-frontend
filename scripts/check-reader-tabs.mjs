import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { compileScript, parse } from 'vue/compiler-sfc'
import { createRenderer, defineComponent, h, markRaw, nextTick, reactive } from 'vue'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const require = createRequire(import.meta.url)

const tsModuleCache = new Map()
function loadTsModule(relPath) {
  const fullPath = path.resolve(repoRoot, relPath)
  if (tsModuleCache.has(fullPath)) return tsModuleCache.get(fullPath)
  const source = fs.readFileSync(fullPath, 'utf8')
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true
    }
  })
  const mod = { exports: {} }
  tsModuleCache.set(fullPath, mod.exports)
  const customRequire = (id) => {
    if (id.startsWith('.')) {
      const candidate = path.resolve(path.dirname(fullPath), id)
      const tsPath = candidate.endsWith('.ts') ? candidate : `${candidate}.ts`
      if (fs.existsSync(tsPath)) return loadTsModule(path.relative(repoRoot, tsPath))
    }
    return require(id)
  }
  new Function('require', 'module', 'exports', transpiled.outputText)(customRequire, mod, mod.exports)
  return mod.exports
}

function compileSfc(relPath, mocks = {}) {
  const sfcPath = path.join(repoRoot, relPath)
  const source = fs.readFileSync(sfcPath, 'utf8')
  const { descriptor } = parse(source, { filename: sfcPath })
  const compiled = compileScript(descriptor, {
    id: path.basename(relPath, '.vue'),
    inlineTemplate: true
  })
  const transpiled = ts.transpileModule(compiled.content, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true
    }
  })
  const mod = { exports: {} }
  const customRequire = (id) => (Object.prototype.hasOwnProperty.call(mocks, id) ? mocks[id] : require(id))
  new Function('require', 'module', 'exports', transpiled.outputText)(customRequire, mod, mod.exports)
  return mod.exports.default
}

function createStorageMock(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)) },
    removeItem: (key) => { map.delete(key) },
    clear: () => { map.clear() },
    snapshot: () => Object.fromEntries(map.entries())
  }
}

function createEnvMocks(storage) {
  const winListeners = new Map()
  const docListeners = new Map()
  let activeElement = null
  const body = markRaw({ nodeName: 'BODY', style: {}, isConnected: true })
  const documentElement = markRaw({ nodeName: 'HTML', style: { overflow: '', fontSize: '' }, isConnected: true })
  activeElement = body

  let rootRef = null
  const documentMock = {
    body,
    documentElement,
    visibilityState: 'visible',
    get activeElement() {
      return activeElement
    },
    set activeElement(el) {
      activeElement = el
    },
    querySelector(selector) {
      if (!rootRef) return null
      if (selector === '[aria-modal="true"]') {
        return findNodes(rootRef, (n) => n.props['aria-modal'] === 'true')[0] ?? null
      }
      if (selector.startsWith('#')) {
        const id = selector.slice(1)
        return findNodes(rootRef, (n) => n.props.id === id)[0] ?? null
      }
      return null
    },
    querySelectorAll() {
      return []
    },
    addEventListener(type, fn) {
      if (!docListeners.has(type)) docListeners.set(type, new Set())
      docListeners.get(type).add(fn)
    },
    removeEventListener(type, fn) {
      docListeners.get(type)?.delete(fn)
    }
  }

  const windowMock = {
    innerWidth: 1280,
    innerHeight: 800,
    setTimeout,
    clearTimeout,
    confirm: () => true,
    addEventListener(type, fn) {
      if (!winListeners.has(type)) winListeners.set(type, new Set())
      winListeners.get(type).add(fn)
    },
    removeEventListener(type, fn) {
      winListeners.get(type)?.delete(fn)
    },
    dispatchEvent(type, evt = {}) {
      for (const fn of [...(winListeners.get(type) ?? [])]) fn(evt)
    },
    listenerCount(type) {
      return winListeners.get(type)?.size ?? 0
    }
  }

  globalThis.window = windowMock
  globalThis.document = documentMock
  globalThis.localStorage = storage
  globalThis.screen = { width: 1280, height: 800 }
  globalThis.HTMLElement = class MockHTMLElement {}
  globalThis.HTMLButtonElement = class MockHTMLButtonElement extends globalThis.HTMLElement {}
  globalThis.Element = globalThis.HTMLElement
  globalThis.Node = globalThis.HTMLElement
  globalThis.getComputedStyle = (el) => ({ visibility: el?.visibilityForTest ?? 'visible' })

  return {
    windowMock,
    documentMock,
    setRoot: (root) => { rootRef = root },
    setActiveElement: (el) => { activeElement = el }
  }
}

function setConnected(node, connected) {
  node.isConnected = connected
  for (const child of node.children) setConnected(child, connected)
}

function createTestRenderer(documentMock) {
  function detach(child) {
    for (let active = documentMock.activeElement; active; active = active.parent) {
      if (active === child) {
        documentMock.activeElement = documentMock.body
        break
      }
    }
    if (child.parent) {
      const idx = child.parent.children.indexOf(child)
      if (idx >= 0) child.parent.children.splice(idx, 1)
    }
    child.parent = null
    setConnected(child, false)
  }

  function createNode(type, text = '', isRoot = false) {
    const listeners = new Map()
    const node = {
      type,
      props: {},
      children: [],
      parent: null,
      text,
      value: '',
      composing: false,
      style: { display: '' },
      isConnected: isRoot,
      disabled: false,
      hiddenForTest: false,
      visibilityForTest: 'visible',
      classList: { add() {}, remove() {} },
      getAttribute: (k) => (Object.prototype.hasOwnProperty.call(node.props, k) ? node.props[k] : null),
      get dataset() {
        return { courseId: node.props['data-course-id'] }
      },
      focus(options) {
        node.lastFocusOptions = options
        documentMock.activeElement = node
      },
      getClientRects() {
        let cur = node
        while (cur) {
          if (!cur.isConnected || cur.hiddenForTest || cur.style?.display === 'none') return []
          cur = cur.parent
        }
        return [{ width: 100, height: 24 }]
      },
      contains(target) {
        if (!target) return false
        return target === node || node.children.some((c) => c.contains?.(target))
      },
      querySelectorAll(selector) {
        if (!selector) return []
        const out = []
        const walk = (n) => {
          if (selector === '.course_list_item'
            ? String(n.props.class ?? '').includes('course_list_item')
            : (n.type === 'button' || n.type === 'input' || n.type === 'a' || n.type === 'textarea') && !n.props.disabled) {
            out.push(n)
          }
          for (const c of n.children) walk(c)
        }
        walk(node)
        return out
      },
      addEventListener: (e, fn) => {
        if (!listeners.has(e)) listeners.set(e, new Set())
        listeners.get(e).add(fn)
      },
      removeEventListener: (e, fn) => listeners.get(e)?.delete(fn),
      dispatch: (e, evt = {}) => {
        for (const fn of [...(listeners.get(e) ?? [])]) fn(evt)
      }
    }
    if (type === 'button') Object.setPrototypeOf(node, globalThis.HTMLButtonElement.prototype)
    else if (type !== '#text' && type !== '#comment') Object.setPrototypeOf(node, globalThis.HTMLElement.prototype)
    return markRaw(node)
  }

  const { createApp } = createRenderer({
    patchProp(el, key, prev, next) {
      if (key === 'style' && next && typeof next === 'object') {
        Object.assign(el.style, next)
      } else if (/^on[A-Z]/.test(key)) {
        const evt = key.slice(2).toLowerCase()
        if (typeof prev === 'function') el.removeEventListener(evt, prev)
        if (typeof next === 'function') el.addEventListener(evt, next)
      }
      if (next === null || next === undefined) {
        delete el.props[key]
        if (key === 'disabled') el.disabled = false
      } else {
        el.props[key] = next
        if (key === 'disabled') el.disabled = Boolean(next)
        if (key === 'value') el.value = String(next)
      }
    },
    insert(child, parent, anchor) {
      if (child.parent) detach(child)
      child.parent = parent
      const idx = anchor ? parent.children.indexOf(anchor) : -1
      if (idx >= 0) parent.children.splice(idx, 0, child)
      else parent.children.push(child)
      setConnected(child, Boolean(parent.isConnected))
    },
    remove: detach,
    createElement: (t) => createNode(t),
    createText: (t) => createNode('#text', t),
    createComment: (t) => createNode('#comment', t),
    setText: (n, t) => { n.text = t },
    setElementText: (n, t) => {
      for (const oldChild of [...n.children]) detach(oldChild)
      const child = createNode('#text', t)
      child.parent = n
      setConnected(child, n.isConnected)
      n.children = [child]
    },
    parentNode: (n) => n.parent ?? null,
    nextSibling: (n) => {
      if (!n.parent) return null
      const idx = n.parent.children.indexOf(n)
      return idx >= 0 ? (n.parent.children[idx + 1] ?? null) : null
    },
    insertStaticContent(content, parent, anchor) {
      const node = createNode('#static', content)
      if (anchor) {
        const idx = parent.children.indexOf(anchor)
        if (idx >= 0) parent.children.splice(idx, 0, node)
        else parent.children.push(node)
      } else {
        parent.children.push(node)
      }
      node.parent = parent
      setConnected(node, Boolean(parent.isConnected))
      return [node, node]
    }
  })
  return { createApp, createRoot: () => createNode('root', '', true), createNode }
}

const findNodes = (root, pred, acc = []) => {
  if (!root) return acc
  if (pred(root)) acc.push(root)
  for (const c of root.children) findNodes(c, pred, acc)
  return acc
}

const getText = (n) => (n.type === '#text' ? n.text : n.children.map(getText).join(''))
const flush = async () => {
  await nextTick()
  await nextTick()
  await nextTick()
}

const SAMPLE_ISM = {
  introduction: ['<p>导读</p>'],
  '1': {
    ch_name: '一元论',
    en_name: 'Monism',
    summary_status: 'manual',
    axis_list: ['场域一', '', '', ''],
    feature_list: ['整体单一秩序', '', '', ''],
    related_list: []
  },
  '2': {
    ch_name: '二元论',
    en_name: 'Dualism',
    summary_status: 'ai',
    axis_list: ['场域二', '', '', ''],
    feature_list: ['二重分裂结构', '', '', ''],
    related_list: []
  }
}

const SAMPLE_ENRICHMENTS = {
  nodes: {
    '1': {
      summary_origin: 'upstream_manual',
      axis_evidence: [],
      transcripts: [{ row: 1, title: '第一讲讲稿', kind: 'lecture', url: 'https://example.invalid/tr1', source_path: 'tr1.md' }],
      readings: [{ source_id: 'r1', relation: 'lecture_explicit_reference', title: '原典一', url: 'https://example.invalid/r1', locator: 'p.1' }],
      editorial_notes: ['校勘注一'],
      substantive_open_questions: [],
      boilerplate_open_questions_count: 0,
      related_course_ids: ['BV1JT4y1K7dp'],
      review_summary: { total_checks: 1, resolved_in_catalogue_count: 0, by_resolution_state: {}, highlights: [] }
    },
    '2': {
      summary_origin: 'upstream_ai',
      axis_evidence: [],
      transcripts: [],
      readings: [],
      editorial_notes: ['校勘注二'],
      substantive_open_questions: [],
      boilerplate_open_questions_count: 0,
      related_course_ids: [],
      review_summary: null
    }
  }
}

const SAMPLE_COURSES = {
  courses: [
    {
      id: 'BV1JT4y1K7dp',
      title: '第一场域导论课程',
      url: 'https://www.bilibili.com/video/BV1JT4y1K7dp',
      source_ids: ['s1'],
      evidence_level: 'metadata',
      related_codes: ['1'],
      kind: 'review',
      catalogue_code: '1',
      body_ref: 'BV1JT4y1K7dp',
      body_status: 'asr_text_reviewed_not_audio_verified'
    }
  ]
}

const SAMPLE_BODIES = {
  BV1JT4y1K7dp: {
    id: 'BV1JT4y1K7dp',
    series_code: '1',
    title: '第一场域导论课程',
    course_summary: [{ text: '课程摘要正文。' }]
  }
}

const StubPassThrough = defineComponent({
  name: 'StubPassThrough',
  setup(_, { slots }) {
    return () => h('div', {}, slots.default ? slots.default() : [])
  }
})

const StubSearchResults = defineComponent({
  name: 'SearchResults',
  props: { open: Boolean },
  emits: ['close', 'jump', 'retryEnrichments', 'retryCourses'],
  setup(props, { emit }) {
    return () => props.open
      ? h('div', { role: 'dialog', 'aria-modal': 'true', class: 'stub_search_results' }, [
          h('button', {
            type: 'button',
            class: 'stub_search_jump_editorial',
            onClick: () => emit('jump', '2', 'editorial')
          }, '跳到2校勘')
        ])
      : null
  }
})

const StubReadingRoute = defineComponent({
  name: 'ReadingRoute',
  props: { open: Boolean },
  emits: ['close', 'jump'],
  setup(props, { emit }) {
    return () => props.open
      ? h('div', { role: 'dialog', 'aria-modal': 'true', class: 'stub_reading_route' }, [
          h('button', {
            type: 'button',
            class: 'stub_route_jump_one',
            onClick: () => emit('jump', '1')
          }, '跳到1')
        ])
      : null
  }
})

function buildHarness(storage, inlineNodes = null, realNavigationDrawers = false, staticRequest = null) {
  const env = createEnvMocks(storage)
  const route = reactive({ params: { ismTag: '1' } })
  let routerPushBehavior = async (to) => {
    route.params.ismTag = to === '/' ? '' : String(to).replace(/^\//, '')
  }
  const router = {
    push: (to) => routerPushBehavior(to)
  }

  const readerFont = loadTsModule('src/utils/readerFont.ts')
  const axisStructure = loadTsModule('src/utils/axisStructure.ts')
  const evidence = loadTsModule('src/utils/evidence.ts')
  const notesStore = loadTsModule('src/utils/notesStore.ts')
  const routeProgress = loadTsModule('src/utils/routeProgress.ts')
  const ismFormat = loadTsModule('src/utils/ismFormat.ts')
  const searchNodes = loadTsModule('src/utils/searchNodes.ts')

  const HighlightText = compileSfc('src/components/HighlightText.vue', {
    '../utils/ismFormat': ismFormat
  })
  const CourseDrawer = compileSfc('src/components/CourseDrawer.vue', {
    './HighlightText.vue': HighlightText,
    '../utils/ismFormat': ismFormat
  })
  const NodeNotes = compileSfc('src/components/NodeNotes.vue', {
    '../utils/notesStore': notesStore,
    '../utils/notesLeaveGuard': loadTsModule('src/utils/notesLeaveGuard.ts')
  })
  const inlineMocks = {
    '../utils/axisStructure': axisStructure,
    '../utils/ismFormat': ismFormat,
    './HighlightText.vue': HighlightText,
  }
  const NodeBreadcrumb = inlineNodes ? compileSfc('src/components/NodeBreadcrumb.vue', inlineMocks) : StubPassThrough
  const AxisNeighbors = inlineNodes ? compileSfc('src/components/AxisNeighbors.vue', inlineMocks) : StubPassThrough
  const ReadingRoute = realNavigationDrawers ? compileSfc('src/components/ReadingRoute.vue', {
    '../utils/routeProgress': routeProgress,
    '../config/readingRoute': loadTsModule('src/config/readingRoute.ts'),
  }) : StubReadingRoute
  const SearchResults = realNavigationDrawers ? compileSfc('src/components/SearchResults.vue', {
    './HighlightText.vue': HighlightText,
    '../utils/ismFormat': ismFormat,
    '../utils/searchNodes': searchNodes,
  }) : StubSearchResults
  const SpatialCubeExplorer = compileSfc('src/components/SpatialCubeExplorer.vue', inlineMocks)
  const CommandPalette = compileSfc('src/components/CommandPalette.vue', {})

  const IsmismcubePage = compileSfc('src/pages/ismismcube/ismismcube.vue', {
    'vue-router': { useRoute: () => route, useRouter: () => router },
    '@/assets/page_view_icon.svg': '/mock/page_view_icon.svg',
    '../../utils/readerFont': readerFont,
    '../../utils/staticPayload': loadTsModule('src/utils/staticPayload.ts'),
    '../../config/static.ts': { buildStaticUrl: (p) => p },
    '../../config/api.ts': { buildApiUrl: (p) => p },
    '../../components/HighlightText.vue': HighlightText,
    '../../components/CourseDrawer.vue': CourseDrawer,
    '../../components/AxisAnatomy.vue': StubPassThrough,
    '../../components/AxisNeighbors.vue': AxisNeighbors,
    '../../components/EvidenceMarker.vue': StubPassThrough,
    '../../components/NodeBreadcrumb.vue': NodeBreadcrumb,
    '../../components/NodeNotes.vue': NodeNotes,
    '../../components/ReadingRoute.vue': ReadingRoute,
    '../../components/CodeGuide.vue': StubPassThrough,
    '../../components/SearchResults.vue': SearchResults,
    '../../components/CubeNavigation.vue': StubPassThrough,
    '../../components/SpatialCubeExplorer.vue': SpatialCubeExplorer,
    '../../components/CommandPalette.vue': CommandPalette,
    '../../utils/themeMode': loadTsModule('src/utils/themeMode.ts'),
    '../../utils/viewTransition': loadTsModule('src/utils/viewTransition.ts'),
    '../../utils/tabSync': loadTsModule('src/utils/tabSync.ts'),
    '../../utils/axisStructure': axisStructure,
    '../../utils/evidence': evidence,
    '../../utils/notesStore': notesStore,
    '../../utils/danmuRequest': loadTsModule('src/utils/danmuRequest.ts'),
    '../../utils/jsonRequest': {
      JsonRequestAbortedError: class JsonRequestAbortedError extends Error {},
      JsonRequestTimeoutError: class JsonRequestTimeoutError extends Error {},
      fetchJsonWithTimeout: async (url) => {
        if (staticRequest) return staticRequest(url)
        if (url.endsWith('/ism.json')) return structuredClone({ ...SAMPLE_ISM, ...inlineNodes })
        if (url.endsWith('/cube-enrichments.json')) return structuredClone(SAMPLE_ENRICHMENTS)
        if (url.endsWith('/courses.json')) return structuredClone(SAMPLE_COURSES)
        if (url.endsWith('/course-bodies.json')) return structuredClone(SAMPLE_BODIES)
        throw new Error(`Unexpected static url: ${url}`)
      }
    },
    '../../utils/pageViewSession': {
      createPageViewSession: () => ({ start: async () => {}, cancel() {} })
    },
    '../../utils/indicatorDrag': loadTsModule('src/utils/indicatorDrag.ts'),
    '../../utils/routeProgress': routeProgress,
    '../../utils/ismFormat': ismFormat,
    '../../utils/searchNodes': searchNodes
  })

  const { createApp, createRoot, createNode } = createTestRenderer(env.documentMock)
  const root = createRoot()
  env.setRoot(root)
  const app = createApp({ render: () => h(IsmismcubePage) })
  app.mount(root)

  return {
    ...env,
    route,
    root,
    app,
    notesStore,
    createNode,
    setRouterPush: (fn) => { routerPushBehavior = fn }
  }
}

async function runTests() {
  const deadline = setTimeout(() => {
    console.error('check-reader-tabs internal timeout')
    process.exit(2)
  }, 5000)
  deadline.unref()

  // 1. Tablist ARIA contract, one tabstop, ArrowRight/Left wrap, Home/End, count/hit indicators, notes lifecycle flush, outside navigation
  {
    const storage = createStorageMock()
    const ctx = buildHarness(storage)
    await flush()

    const tablist = findNodes(ctx.root, (n) => n.props.role === 'tablist' && String(n.props.class ?? '').includes('info_tabs'))[0]
    assert.ok(Boolean(tablist), 'info_tabs tablist exists')
    assert.ok(typeof tablist.props['aria-label'] === 'string' && tablist.props['aria-label'].trim().length > 0, 'tablist must have non-empty aria-label')

    const tabs = findNodes(tablist, (n) => n.props.role === 'tab')
    assert.equal(tabs.length, 4, 'four core reading tabs exist')
    const panels = findNodes(ctx.root, (n) => n.props.role === 'tabpanel')
    assert.equal(panels.length, 4, 'four tabpanels exist')

    // Stable IDs, aria-selected, aria-controls, aria-labelledby, single tabstop
    const expectedIds = ['info_tab_overview', 'info_tab_courses', 'info_tab_editorial', 'info_tab_notes']
    for (let i = 0; i < 4; i++) {
      assert.equal(tabs[i].props.id, expectedIds[i])
      assert.equal(tabs[i].props['aria-selected'], i === 0 ? 'true' : 'false')
      assert.equal(tabs[i].props.tabindex, i === 0 ? 0 : -1)
      assert.equal(tabs[i].props['aria-controls'], panels[i].props.id)
      assert.equal(panels[i].props['aria-labelledby'], tabs[i].props.id)
      assert.equal(panels[i].style.display, i === 0 ? '' : 'none')
    }

    // Count indicators in courses/editorial tabs (1 linked course + 1 transcript = 2; 1 reading = 1)
    assert.match(getText(tabs[1]), /课程与讲稿 \(2\)/)
    assert.match(getText(tabs[2]), /校勘与典籍 \(1\)/)

    // Search hit dot appears on matching tabs
    const searchInput = findNodes(ctx.root, (n) => n.props.id === 'search_input')[0]
    searchInput.props['onUpdate:modelValue']('校勘注一')
    await new Promise((r) => setTimeout(r, 150))
    await flush()
    assert.equal(findNodes(tabs[2], (n) => String(n.props.class ?? '').includes('hit_dot')).length, 1, 'editorial hit dot renders')

    // ArrowRight moves focus and selects next tab (overview -> courses -> editorial -> notes -> wrap to overview)
    const dispatchTabKey = (tabNode, key, extra = {}) => {
      let prevented = false
      tabNode.dispatch('keydown', { key, preventDefault() { prevented = true }, ...extra })
      return prevented
    }

    tabs[0].focus()
    assert.equal(dispatchTabKey(tabs[0], 'ArrowRight'), true)
    await flush()
    assert.ok(ctx.documentMock.activeElement === tabs[1], 'ArrowRight focuses courses tab')
    assert.equal(tabs[1].props['aria-selected'], 'true')
    assert.equal(tabs[1].props.tabindex, 0)
    assert.equal(tabs[0].props['aria-selected'], 'false')
    assert.equal(tabs[0].props.tabindex, -1)
    assert.equal(panels[1].style.display, '')
    assert.equal(panels[0].style.display, 'none')

    // Modified / composing keys must NOT move tab
    assert.equal(dispatchTabKey(tabs[1], 'ArrowRight', { ctrlKey: true }), false)
    assert.equal(dispatchTabKey(tabs[1], 'End', { shiftKey: true }), false)
    assert.equal(dispatchTabKey(tabs[1], 'ArrowLeft', { isComposing: true }), false)
    await flush()
    assert.ok(ctx.documentMock.activeElement === tabs[1], 'modified/IME keys leave active tab unchanged')

    // End jumps to notes tab; ArrowRight wraps from notes to overview; ArrowLeft wraps from overview to notes
    assert.equal(dispatchTabKey(tabs[1], 'End'), true)
    await flush()
    assert.ok(ctx.documentMock.activeElement === tabs[3], 'End focuses notes tab')
    assert.equal(tabs[3].props['aria-selected'], 'true')
    assert.equal(panels[3].style.display, '')

    // Notes lifecycle: typing into textarea before 400ms debounce, then switching away via ArrowRight flushes synchronously
    const noteTextareas = findNodes(panels[3], (n) => n.type === 'textarea')
    assert.ok(noteTextareas.length >= 1, 'NodeNotes mounted when notes tab selected')
    // A real input updates the DOM value before v-model's input listener runs.
    // Calling the model assignment alone leaves the mock DOM empty, so the
    // subsequent dispatched input would overwrite that assignment with ''.
    noteTextareas[0].value = '未防抖即切页的笔记'
    noteTextareas[0].dispatch('input', { target: noteTextareas[0] })
    assert.equal(storage.getItem(ctx.notesStore.NOTES_STORAGE_KEY), null, 'debounce has not written yet')

    assert.equal(dispatchTabKey(tabs[3], 'ArrowRight'), true)
    await flush()
    assert.ok(ctx.documentMock.activeElement === tabs[0], 'ArrowRight wraps from notes to overview')
    const flushedState = JSON.parse(storage.getItem(ctx.notesStore.NOTES_STORAGE_KEY))
    assert.ok(Boolean(flushedState?.nodes['1']), 'leaving notes must persist a nonempty node 1 draft')
    assert.equal(flushedState.nodes['1'].claim, '未防抖即切页的笔记', 'leaving notes tab flushes pending save')
    assert.equal(findNodes(tabs[3], (n) => String(n.props.class ?? '').includes('note_dot')).length, 1, 'note_dot updates after flush')

    // ArrowLeft wraps back to notes and remounts NodeNotes with persisted value; Home returns to overview
    assert.equal(dispatchTabKey(tabs[0], 'ArrowLeft'), true)
    await flush()
    assert.ok(ctx.documentMock.activeElement === tabs[3], 'ArrowLeft wraps from overview to notes')
    assert.equal(findNodes(panels[3], (n) => n.type === 'textarea')[0].value, '未防抖即切页的笔记', 'notes remount restores saved claim')

    assert.equal(dispatchTabKey(tabs[3], 'Home'), true)
    await flush()
    assert.ok(ctx.documentMock.activeElement === tabs[0], 'Home focuses overview tab')

    // Outside navigation (SearchResults jump to '2' + 'editorial', then ReadingRoute jump to '1' + 'overview') reflects tab ARIA state
    findNodes(ctx.root, (n) => n.props.id === 'open_search_results_btn')[0].dispatch('click')
    await flush()
    findNodes(ctx.root, (n) => String(n.props.class ?? '').includes('stub_search_jump_editorial'))[0].dispatch('click')
    await flush()
    assert.equal(ctx.route.params.ismTag, '2')
    assert.equal(tabs[2].props['aria-selected'], 'true')
    assert.equal(tabs[2].props.tabindex, 0)
    assert.equal(panels[2].style.display, '')
    assert.equal(panels[0].style.display, 'none')

    // Note: NodeNotes jump keeps 'notes' tab selected
    tabs[3].dispatch('click')
    await flush()
    assert.equal(tabs[3].props['aria-selected'], 'true')
    const jumpNoteBtn = findNodes(panels[3], (n) => String(n.props.class ?? '').includes('notes_jump_btn'))[0]
    jumpNoteBtn.dispatch('click')
    await flush()
    assert.equal(ctx.route.params.ismTag, '1')
    assert.equal(tabs[3].props['aria-selected'], 'true', 'notes jump preserves notes tab selected state')

    // ReadingRoute jump selects overview
    findNodes(ctx.root, (n) => n.props.id === 'route_button')[0].dispatch('click')
    await flush()
    findNodes(ctx.root, (n) => String(n.props.class ?? '').includes('stub_route_jump_one'))[0].dispatch('click')
    await flush()
    assert.equal(tabs[0].props['aria-selected'], 'true')
    assert.equal(tabs[0].props.tabindex, 0)

    ctx.app.unmount()
  }

  // 2. Course-to-node focus handoff (same-node /1 baseline + ordinary close + heading fallback + guards)
  {
    const storage = createStorageMock()
    const ctx = buildHarness(storage)
    await flush()

    const tabs = findNodes(ctx.root, (n) => n.props.role === 'tablist' && String(n.props.class ?? '').includes('info_tabs'))[0].children.filter((n) => n.props.role === 'tab')
    const panels = findNodes(ctx.root, (n) => n.props.role === 'tabpanel')

    // Switch to courses tab on /1 and click "打开课程摘要" for BV1JT4y1K7dp
    tabs[1].dispatch('click')
    await flush()
    const openSummaryBtn = findNodes(panels[1], (n) => n.type === 'button' && getText(n).includes('打开课程摘要'))[0]
    assert.ok(Boolean(openSummaryBtn), 'open summary button exists in courses tab')
    openSummaryBtn.focus()
    openSummaryBtn.dispatch('click')
    await flush()

    const drawerDialog = findNodes(ctx.root, (n) => n.props.role === 'dialog')[0]
    assert.ok(Boolean(drawerDialog), 'CourseDrawer opened')

    // Ordinary Escape close from courses tab restores visible openSummaryBtn
    ctx.windowMock.dispatchEvent('keydown', { key: 'Escape', preventDefault() {} })
    await flush()
    assert.equal(findNodes(ctx.root, (n) => n.props.role === 'dialog').length, 0, 'CourseDrawer closed')
    assert.ok(ctx.documentMock.activeElement === openSummaryBtn, 'ordinary close restores visible opener in courses tab')

    // Reopen from courses tab -> jump to linked node '1' (same route, opener becomes v-show hidden yet connected!)
    openSummaryBtn.focus()
    openSummaryBtn.dispatch('click')
    await flush()
    const jumpNodeBtn = findNodes(ctx.root, (n) => String(n.props.class ?? '').includes('node_jump_btn'))[0]
    assert.ok(Boolean(jumpNodeBtn), 'linked node 1 jump button renders')
    jumpNodeBtn.focus()
    jumpNodeBtn.dispatch('click')
    await flush()
    await flush()

    assert.equal(findNodes(ctx.root, (n) => n.props.role === 'dialog').length, 0, 'CourseDrawer closed on jump')
    assert.equal(tabs[0].props['aria-selected'], 'true', 'overview tab selected after course jump')
    assert.equal(panels[1].style.display, 'none', 'courses panel is v-show hidden')
    assert.equal(openSummaryBtn.isConnected, true, 'original opener stays connected while v-show hidden')
    assert.ok(ctx.documentMock.activeElement === tabs[0], 'focus hands off to target overview tab, NOT BODY or hidden opener')

    // Fallback to stable current node heading when target tab is hidden
    tabs[1].dispatch('click')
    await flush()
    openSummaryBtn.focus()
    openSummaryBtn.dispatch('click')
    await flush()
    tabs[0].hiddenForTest = true
    findNodes(ctx.root, (n) => String(n.props.class ?? '').includes('node_jump_btn'))[0].dispatch('click')
    await flush()
    const headingNode = findNodes(ctx.root, (n) => String(n.props.class ?? '').includes('node_ch_name'))[0]
    assert.ok(ctx.documentMock.activeElement === headingNode, 'falls back to node heading when target tab is not visible')
    tabs[0].hiddenForTest = false

    // Guard: user external focus during async router settle is preserved
    let resolveNav = null
    ctx.setRouterPush(() => new Promise((r) => { resolveNav = r }))
    tabs[1].dispatch('click')
    await flush()
    openSummaryBtn.focus()
    openSummaryBtn.dispatch('click')
    await flush()
    findNodes(ctx.root, (n) => String(n.props.class ?? '').includes('node_jump_btn'))[0].dispatch('click')
    await nextTick()
    const searchInput = findNodes(ctx.root, (n) => n.props.id === 'search_input')[0]
    searchInput.focus()
    resolveNav()
    await flush()
    assert.ok(ctx.documentMock.activeElement === searchInput, 'external user focus during async router settle is not stolen')

    // Guard: route target mismatch (router redirected elsewhere) aborts focus handoff
    ctx.setRouterPush(async () => {
      ctx.route.params.ismTag = '2'
    })
    tabs[1].dispatch('click')
    await flush()
    openSummaryBtn.focus()
    openSummaryBtn.dispatch('click')
    await flush()
    findNodes(ctx.root, (n) => String(n.props.class ?? '').includes('node_jump_btn'))[0].dispatch('click')
    await flush()
    assert.ok(ctx.documentMock.activeElement === ctx.documentMock.body, 'route mismatch aborts target focus handoff')

    // Guard: navigation token invalidation (another drawer opened before router settles) aborts focus handoff
    ctx.setRouterPush(() => new Promise((r) => { resolveNav = r }))
    ctx.route.params.ismTag = '1'
    await flush()
    tabs[1].dispatch('click')
    await flush()
    openSummaryBtn.focus()
    openSummaryBtn.dispatch('click')
    await flush()
    findNodes(ctx.root, (n) => String(n.props.class ?? '').includes('node_jump_btn'))[0].dispatch('click')
    await nextTick()
    findNodes(ctx.root, (n) => n.props.id === 'route_button')[0].dispatch('click')
    await flush()
    ctx.route.params.ismTag = '1'
    resolveNav()
    await flush()
    assert.ok(ctx.documentMock.activeElement !== tabs[0], 'invalidated token when another modal opens must not steal focus')

    // Guard: unmount invalidates pending async course jump focus
    findNodes(ctx.root, (n) => n.props.id === 'courses_button')[0].dispatch('click')
    await flush()
    // The global entry opens the $ category, but this fixture is a review
    // course. Select all courses as a user would before following its link.
    const allCoursesTab = findNodes(ctx.root, (n) => n.type === 'button' &&
      String(n.props.class ?? '').includes('drawer_tab_btn') && getText(n).includes('全部课程'))[0]
    assert.ok(Boolean(allCoursesTab), 'global course entry offers all-courses category')
    allCoursesTab.dispatch('click')
    await flush()
    const pendingUnmountJump = findNodes(ctx.root, (n) => String(n.props.class ?? '').includes('node_jump_btn'))[0]
    assert.ok(Boolean(pendingUnmountJump), 'review course jump exists after selecting all courses')
    pendingUnmountJump.dispatch('click')
    ctx.app.unmount()
    resolveNav()
    await flush()
    assert.ok(ctx.documentMock.activeElement === ctx.documentMock.body, 'unmount invalidates pending focus handoff')
  }

  {
    const nodes = Object.fromEntries(['1-1', '1-1-1', '1-2'].map(code => [code, {
      ...SAMPLE_ISM['1'], ch_name: `节点${code}`,
    }]))
    const ctx = buildHarness(createStorageMock(), nodes)
    await flush()
    const byClass = name => findNodes(ctx.root, n => String(n.props.class ?? '').split(' ').includes(name))
    const heading = () => byClass('node_ch_name')[0]
    const ancestorJump = async () => {
      ctx.route.params.ismTag = '1-1-1'; await flush()
      const source = byClass('breadcrumb_btn')[0]
      source.focus(); source.dispatch('click')
      return source
    }
    const ancestor = await ancestorJump(); await flush()
    assert.equal(ctx.route.params.ismTag, '1')
    assert.equal(ancestor.isConnected, false)
    assert.ok(ctx.documentMock.activeElement === heading(), 'removed ancestor button hands focus to destination heading')

    ctx.route.params.ismTag = '1-1-1'; await flush()
    const parentStep = byClass('step_btn').find(n => getText(n).includes('上一层'))
    parentStep.focus(); parentStep.dispatch('click'); await flush()
    assert.equal(ctx.route.params.ismTag, '1-1')
    assert.ok(parentStep.isConnected && !parentStep.disabled)
    assert.ok(ctx.documentMock.activeElement === parentStep, 'surviving enabled navigation button keeps focus')
    parentStep.dispatch('click'); await flush()
    assert.equal(ctx.route.params.ismTag, '1')
    assert.ok(parentStep.isConnected && parentStep.disabled)
    assert.ok(ctx.documentMock.activeElement === heading(), 'parent navigation becoming disabled hands focus to heading')

    const sibling = byClass('sibling_chip').find(n => getText(n).includes('二元论'))
    sibling.dispatch('click'); await flush()
    const compareJump = byClass('jump_target_btn')[0]
    compareJump.focus(); compareJump.dispatch('click'); await flush()
    assert.equal(ctx.route.params.ismTag, '2')
    assert.equal(compareJump.isConnected, false)
    assert.ok(ctx.documentMock.activeElement === heading(), 'removed compare panel hands focus to destination heading')

    ctx.route.params.ismTag = '1'; await flush()
    const child = byClass('child_row_btn')[0]
    child.focus(); child.dispatch('click'); await flush()
    assert.equal(child.isConnected, false)
    assert.ok(ctx.documentMock.activeElement === heading(), 'replaced child row hands focus to heading')

    let settle
    ctx.setRouterPush(() => new Promise(resolve => { settle = resolve }))
    await ancestorJump()
    const search = findNodes(ctx.root, n => n.props.id === 'search_input')[0]
    search.focus(); ctx.route.params.ismTag = '1'; settle(); await flush()
    assert.ok(ctx.documentMock.activeElement === search, 'pending inline navigation preserves external focus')

    await ancestorJump()
    ctx.route.params.ismTag = '2'; await flush()
    settle(); await flush()
    assert.ok(ctx.documentMock.activeElement === ctx.documentMock.body, 'redirected inline destination does not focus stale heading')

    await ancestorJump()
    ctx.app.unmount(); settle(); await flush()
    assert.ok(ctx.documentMock.activeElement === ctx.documentMock.body, 'unmount cancels pending inline focus')
  }

  // 4. Main feature_section self-test reveal focus & guards
  {
    const ctx = buildHarness(createStorageMock({ 'ismismcube.selfTest': 'true' }))
    await flush()

    const byClass = (name) => findNodes(ctx.root, (n) => String(n.props.class ?? '').split(' ').includes(name))
    const featureSection = () => byClass('feature_section')[0]
    const revealBtn = () => byClass('self_test_reveal_btn')[0]
    const featureRows = () => byClass('feature_row')
    const tabs = findNodes(ctx.root, (n) => n.props.role === 'tab')
    const panels = findNodes(ctx.root, (n) => n.props.role === 'tabpanel')
    const searchInput = findNodes(ctx.root, (n) => n.props.id === 'search_input')[0]
    const selfTestLabel = findNodes(ctx.root, (n) => n.type === 'label' && getText(n).includes('自测模式'))[0]
    const selfTestCheckbox = findNodes(selfTestLabel, (n) => n.type === 'input')[0]

    const section = featureSection()
    assert.ok(Boolean(section), 'feature_section exists')
    assert.equal(section.props.role, 'region')
    assert.ok(typeof section.props['aria-label'] === 'string' && section.props['aria-label'].trim().length > 0, 'feature_section has accessible label')
    assert.equal(section.props.tabindex, '-1')

    // Keyboard-focused reveal button disappears on click/Enter and focuses stable feature_section without scroll
    const firstBtn = revealBtn()
    assert.ok(Boolean(firstBtn), 'self-test reveal button renders on /1')
    assert.equal(featureRows().length, 0)
    firstBtn.focus()
    firstBtn.dispatch('click')
    await flush()
    assert.equal(firstBtn.isConnected, false, 'reveal button removed after reveal')
    assert.equal(featureRows().length, 1)
    assert.match(getText(featureRows()[0]), /整体单一秩序/)
    assert.ok(ctx.documentMock.activeElement === featureSection(), 'reveal focuses stable feature_section')
    assert.equal(featureSection().lastFocusOptions?.preventScroll, true, 'reveal focus prevents forced scroll')

    // Automatic node reset does NOT steal focus
    searchInput.focus()
    ctx.route.params.ismTag = '2'
    await flush()
    assert.ok(Boolean(revealBtn()), 'node switch resets reveal state')
    assert.equal(featureRows().length, 0)
    assert.ok(ctx.documentMock.activeElement === searchInput, 'automatic node reset does not focus feature_section')

    // Click reveal when activeElement is body also focuses feature_section
    ctx.documentMock.activeElement = ctx.documentMock.body
    revealBtn().dispatch('click')
    await flush()
    assert.match(getText(featureRows()[0]), /二重分裂结构/)
    assert.ok(ctx.documentMock.activeElement === featureSection(), 'click reveal focuses feature_section')

    // Automatic mode toggles off/on do NOT steal focus
    ctx.route.params.ismTag = '1'
    await flush()
    tabs[0].focus()
    selfTestCheckbox.checked = false
    selfTestCheckbox.dispatch('change')
    await flush()
    assert.equal(featureRows().length, 1, 'disabling self-test reveals features')
    assert.ok(ctx.documentMock.activeElement === tabs[0], 'disabling self-test does not steal focus')
    selfTestCheckbox.checked = true
    selfTestCheckbox.dispatch('change')
    await flush()
    assert.ok(Boolean(revealBtn()), 're-enabling self-test hides features')
    assert.ok(ctx.documentMock.activeElement === tabs[0], 'enabling self-test does not steal focus')

    // Guard: external focus moved while reveal is pending is preserved
    const guardExternalBtn = revealBtn()
    guardExternalBtn.focus()
    guardExternalBtn.dispatch('click')
    searchInput.focus()
    await flush()
    assert.ok(ctx.documentMock.activeElement === searchInput, 'pending reveal preserves external focus')

    // Guard: node switch while reveal is pending aborts focus
    ctx.route.params.ismTag = '2'
    await flush()
    const guardNavBtn = revealBtn()
    guardNavBtn.focus()
    guardNavBtn.dispatch('click')
    ctx.route.params.ismTag = '1'
    await flush()
    assert.ok(Boolean(revealBtn()), 'navigated node stays unrevealed')
    assert.ok(ctx.documentMock.activeElement !== featureSection(), 'pending reveal aborts on node change')

    // Guard: self-test disabled mid-tick aborts focus
    const guardModeBtn = revealBtn()
    guardModeBtn.focus()
    guardModeBtn.dispatch('click')
    selfTestCheckbox.checked = false
    selfTestCheckbox.dispatch('change')
    await flush()
    assert.ok(ctx.documentMock.activeElement === ctx.documentMock.body, 'pending reveal aborts when self-test disabled')

    // Guard: tab switch hiding overview panel aborts focus
    selfTestCheckbox.checked = true
    selfTestCheckbox.dispatch('change')
    await flush()
    const guardTabBtn = revealBtn()
    guardTabBtn.focus()
    guardTabBtn.dispatch('click')
    tabs[1].dispatch('click')
    await flush()
    assert.equal(panels[0].style.display, 'none')
    assert.ok(ctx.documentMock.activeElement !== featureSection(), 'pending reveal aborts when overview tab hidden')

    // Guard: modal opening mid-tick aborts focus
    tabs[0].dispatch('click')
    await flush()
    ctx.route.params.ismTag = '2'
    await flush()
    const guardModalBtn = revealBtn()
    guardModalBtn.focus()
    guardModalBtn.dispatch('click')
    findNodes(ctx.root, (n) => n.props.id === 'route_button')[0].dispatch('click')
    await flush()
    assert.ok(ctx.documentMock.activeElement !== featureSection(), 'pending reveal aborts when modal opens')

    // Guard: unmount invalidates pending reveal focus
    findNodes(ctx.root, (n) => String(n.props.class ?? '').includes('stub_route_jump_one'))[0].dispatch('click')
    await flush()
    const guardUnmountBtn = revealBtn()
    guardUnmountBtn.focus()
    guardUnmountBtn.dispatch('click')
    ctx.app.unmount()
    await flush()
    assert.ok(ctx.documentMock.activeElement === ctx.documentMock.body, 'unmount cancels pending reveal focus')
  }
  {
    const ctx = buildHarness(createStorageMock(), null, true)
    await flush()
    const tabs = findNodes(ctx.root, n => n.props.role === 'tab' && String(n.props.class ?? '').includes('info_tab_btn'))
    const byClass = name => findNodes(ctx.root, n => String(n.props.class ?? '').split(' ').includes(name))
    const byId = id => findNodes(ctx.root, n => n.props.id === id)[0]
    ctx.route.params.ismTag = '2'; await flush()
    const opener = byId('route_button'); opener.focus(); opener.dispatch('click'); await flush()
    const continueButton = byClass('continue_btn')[0]
    continueButton.focus(); continueButton.dispatch('click'); await flush()
    assert.equal(ctx.route.params.ismTag, '1')
    assert.ok(ctx.documentMock.activeElement === tabs[0], 'actual route jump suppresses opener restore and focuses overview')
    opener.focus(); opener.dispatch('click'); await flush()
    byClass('drawer_close_btn')[0].dispatch('click'); await flush()
    assert.ok(ctx.documentMock.activeElement === opener, 'ordinary route close still restores opener')

    const search = byId('search_input')
    for (const [query, code, index] of [['校勘注二', '2', 2], ['一元论', '1', 0]]) {
      search.focus(); search.props['onUpdate:modelValue'](query); await flush()
      byId('open_search_results_btn').dispatch('click'); await flush()
      const result = byClass('result_item_btn')[0]
      result.focus(); result.dispatch('click'); await flush()
      assert.equal(ctx.route.params.ismTag, code)
      assert.equal(tabs[index].props['aria-selected'], 'true')
      assert.ok(ctx.documentMock.activeElement === tabs[index], 'actual search jump preserves result tab and focuses it')
    }
    search.focus(); byId('open_search_results_btn').dispatch('click'); await flush()
    byClass('drawer_close_btn')[0].dispatch('click'); await flush()
    assert.ok(ctx.documentMock.activeElement === search, 'ordinary search close still restores opener')

    let settle
    ctx.setRouterPush(() => new Promise(resolve => { settle = resolve }))
    opener.focus(); opener.dispatch('click'); await flush()
    const delayedJump = byClass('continue_btn')[0]
    delayedJump.focus(); delayedJump.dispatch('click'); search.focus()
    ctx.route.params.ismTag = '1'; settle(); await flush()
    assert.ok(ctx.documentMock.activeElement === search, 'modal jump never steals external focus while route settles')
    ctx.app.unmount()
  }
  // User retries hand focus to a persistent owner before the loader removes buttons.
  for (const entry of ['base', 'courses', 'enrichments', 'index']) {
    const resource = entry === 'base' ? 'ism' : entry === 'courses' ? 'courses' : 'cube-enrichments'
    const samples = { ism: SAMPLE_ISM, courses: SAMPLE_COURSES, 'cube-enrichments': SAMPLE_ENRICHMENTS, 'course-bodies': SAMPLE_BODIES }
    let fail = true, complete = null
    const ctx = buildHarness(createStorageMock(), null, false, async url => {
      const name = url.split('/').pop().replace('.json', '')
      if (name === resource) {
        if (fail) throw new Error('synthetic unavailable')
        return await new Promise(resolve => { complete = resolve })
      }
      return structuredClone(samples[name])
    })
    await flush(); await flush()
    const findRetry = () => findNodes(ctx.root, n => n.type === 'button' && (entry === 'base'
      ? String(n.props.class ?? '').includes('info_error_retry_btn')
      : entry === 'index' ? getText(n).trim() === '索引重试'
      : String(n.props.class ?? '').includes('retry_btn_inline') && getText(n).trim() === '重试'))[0]
    if (entry === 'courses' || entry === 'enrichments') {
      findNodes(ctx.root, n => n.props.id === (entry === 'courses' ? 'info_tab_courses' : 'info_tab_editorial'))[0].dispatch('click')
      await flush()
    }
    const target = findNodes(ctx.root, n => n.props.id === (entry === 'index' ? 'search_input' : 'ism_info_content'))[0]
    let button = findRetry(); assert.ok(Boolean(button), entry + ' retry exists')
    fail = false; button.focus(); button.dispatch('click', { currentTarget: button })
    assert.ok(ctx.documentMock.activeElement === target, entry + ' synchronously focuses stable owner')
    await flush(); assert.ok(ctx.documentMock.activeElement === target, entry + ' pending keeps focus')
    complete(structuredClone(samples[resource])); await flush(); await flush()
    assert.ok(ctx.documentMock.activeElement === target, entry + ' success keeps focus')
    ctx.app.unmount()

    // A new fixture exercises repeated failure and external movement while pending.
    let release, calls = 0
    const next = buildHarness(createStorageMock(), null, false, async url => {
      const name = url.split('/').pop().replace('.json', '')
      if (name === resource) { calls++; if (calls === 1) throw new Error('synthetic unavailable'); return await new Promise((resolve, reject) => { release = reject }) }
      return structuredClone(samples[name])
    })
    await flush(); await flush()
    if (entry === 'courses' || entry === 'enrichments') {
      findNodes(next.root, n => n.props.id === (entry === 'courses' ? 'info_tab_courses' : 'info_tab_editorial'))[0].dispatch('click'); await flush()
    }
    const nextRetry = () => findNodes(next.root, n => n.type === 'button' && (entry === 'base'
      ? String(n.props.class ?? '').includes('info_error_retry_btn') : entry === 'index' ? getText(n).trim() === '索引重试'
      : String(n.props.class ?? '').includes('retry_btn_inline') && getText(n).trim() === '重试'))[0]
    const outside = next.createNode('button', '', true); outside.isConnected = true; outside.focus()
    button = nextRetry(); button.dispatch('click', { currentTarget: button }); await flush()
    assert.ok(next.documentMock.activeElement === outside, 'external programmatic retry does not steal focus')
    release(new Error('synthetic retry failure')); await flush(); await flush()
    assert.ok(Boolean(nextRetry()), 'reerror restores retry')
    assert.ok(next.documentMock.activeElement === outside, 'reerror preserves external focus')
    button = nextRetry(); button.focus(); button.dispatch('click', { currentTarget: button }); await flush()
    outside.focus(); next.app.unmount(); release(new Error('synthetic late failure')); await flush()
    assert.ok(next.documentMock.activeElement === outside, 'unmount late result does not move focus')
  }
  {
    const ctx = buildHarness(createStorageMock()); await flush()
    const byId = id => findNodes(ctx.root, n => n.props.id === id)[0]
    const handle = byId('size_indicator'), left = byId('left_part'), adjuster = byId('size_adjuster')
    assert.equal(handle.type, 'button'); assert.equal(handle.props.type, 'button')
    assert.equal(handle.props['aria-controls'], 'left_part')
    assert.ok(!left.contains(handle), 'handle remains outside inert content')
    assert.ok(ctx.root.children[0].children.indexOf(adjuster) < ctx.root.children[0].children.indexOf(left), 'handle precedes reader in tab order')
    handle.focus(); handle.dispatch('click', { detail: 0 }); await flush()
    assert.equal(left.props.inert, true); assert.equal(handle.props['aria-expanded'], false)
    assert.ok(ctx.documentMock.activeElement === handle, 'keyboard collapse retains handle focus')
    handle.dispatch('click', { detail: 0 }); await flush()
    assert.equal(left.props.inert, false); assert.equal(handle.props['aria-expanded'], true)
    byId('ai_button').focus(); handle.dispatch('click', { detail: 0 }); await flush()
    assert.ok(ctx.documentMock.activeElement === handle, 'collapse hands internal focus to handle')
    assert.equal(handle.lastFocusOptions?.preventScroll, true, 'internal handoff never scrolls the page')
    handle.dispatch('click', { detail: 0 }); await flush()
    const outside = ctx.createNode('button', '', true); outside.isConnected = true; outside.focus()
    handle.dispatch('click', { detail: 0 }); await flush()
    assert.ok(ctx.documentMock.activeElement === outside, 'external focus is preserved')
    handle.dispatch('click', { detail: 0 }); await flush()
    adjuster.offsetHeight = 400
    handle.dispatch('mousedown', { button: 0 })
    ctx.windowMock.dispatchEvent('mouseup', { button: 0 }); await flush()
    assert.equal(left.props.inert, true, 'mouse click toggles through real drag owner')
    handle.dispatch('click', { detail: 1 }); await flush()
    assert.equal(left.props.inert, true, 'native mouse click does not toggle twice')
    handle.dispatch('mousedown', { button: 0 })
    ctx.windowMock.dispatchEvent('mousemove', { movementX: 0, movementY: 40 })
    ctx.windowMock.dispatchEvent('mouseup', { button: 0 }); handle.dispatch('click', { detail: 1 }); await flush()
    assert.equal(left.props.inert, true, 'drag preserves collapsed state')
    ctx.app.unmount(); assert.equal(ctx.windowMock.listenerCount('mousemove'), 0)
  }
  {
    const ctx = buildHarness(createStorageMock()); await flush()
    const byId = id => findNodes(ctx.root, n => n.props.id === id)[0]
    const range = byId('cube_zoom_range'), handle = byId('size_indicator'), adjuster = byId('size_adjuster')
    assert.equal(range.type, 'input'); assert.equal(range.props.type, 'range')
    assert.equal(range.props.min, '100'); assert.equal(range.props.max, '250'); assert.equal(range.props.step, '1')
    assert.equal(range.props['aria-valuetext'], '100%')
    const input = async value => { range.value = value; range.dispatch('input', { currentTarget: range }); await flush() }
    await input('175')
    assert.equal(byId('ismism_cube_box').style.transform, 'scale(1.75)')
    assert.equal(handle.style.top, '50%')
    assert.equal(range.props['aria-valuetext'], '175%')
    assert.ok(getText(byId('cube_zoom_controls')).includes('175%'))
    await input('NaN'); assert.equal(byId('ismism_cube_box').style.transform, 'scale(1.75)')
    await input('Infinity'); assert.equal(handle.style.top, '50%')
    await input('400'); assert.equal(byId('ismism_cube_box').style.transform, 'scale(2.5)')
    await input('-2'); assert.equal(handle.style.top, '0%')
    adjuster.offsetHeight = 400
    handle.dispatch('mousedown', { button: 0 })
    ctx.windowMock.dispatchEvent('mousemove', { movementX: 0, movementY: 101 })
    ctx.windowMock.dispatchEvent('mouseup', { button: 0 }); await flush()
    assert.equal(range.props.value, 138, 'drag keeps continuous ratio while range displays rounded percent')
    assert.equal(range.props['aria-valuetext'], '138%')
    assert.equal(handle.style.top, '25.25%')
    assert.equal(byId('ismism_cube_box').style.transform, 'scale(1.3787500000000001)')
    handle.dispatch('click', { detail: 0 }); await flush()
    assert.equal(byId('left_part').props.inert, true)
    await input('200'); assert.equal(byId('left_part').props.inert, true, 'range does not toggle reader')
    assert.equal(byId('ismism_cube_box').style.transform, 'scale(2)')
    handle.dispatch('click', { detail: 0 }); await flush()
    assert.equal(range.props['aria-valuetext'], '200%', 'reopening retains selected zoom')
    ctx.app.unmount()
  }
  console.log('check-reader-tabs: ALL PASSED')
}

runTests().catch((err) => {
  console.error(String(err?.stack ?? err).slice(0, 4000))
  process.exitCode = 1
})
