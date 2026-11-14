import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { compileScript, parse } from 'vue/compiler-sfc'
import { createRenderer, h, markRaw, nextTick, reactive } from 'vue'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const require = createRequire(import.meta.url)

function loadTsModule(relPath, mocks = {}) {
  const fullPath = path.join(repoRoot, relPath)
  const source = fs.readFileSync(fullPath, 'utf8')
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true
    }
  })
  const mod = { exports: {} }
  const customRequire = (id) => {
    if (Object.prototype.hasOwnProperty.call(mocks, id)) {
      return mocks[id]
    }
    if (id.startsWith('.')) {
      const resolvedBase = path.resolve(path.dirname(fullPath), id)
      const tsCandidate = resolvedBase.endsWith('.ts') ? resolvedBase : `${resolvedBase}.ts`
      if (fs.existsSync(tsCandidate)) {
        return loadTsModule(path.relative(repoRoot, tsCandidate), mocks)
      }
    }
    return require(id)
  }
  const fn = new Function('require', 'module', 'exports', transpiled.outputText)
  fn(customRequire, mod, mod.exports)
  return mod.exports
}

function createDomMocks() {
  const windowListeners = new Map()
  let activeElement = null
  const documentMock = {
    documentElement: {
      style: {
        overflow: ''
      }
    },
    get activeElement() {
      return activeElement
    },
    set activeElement(el) {
      activeElement = el
    },
    querySelector: () => null
  }
  const windowMock = {
    addEventListener(type, fn) {
      if (!windowListeners.has(type)) windowListeners.set(type, new Set())
      windowListeners.get(type).add(fn)
    },
    removeEventListener(type, fn) {
      windowListeners.get(type)?.delete(fn)
    },
    dispatchEvent(type, eventObj = {}) {
      for (const fn of [...(windowListeners.get(type) ?? [])]) {
        fn(eventObj)
      }
    },
    listenerCount(type) {
      return windowListeners.get(type)?.size ?? 0
    }
  }
  globalThis.window = windowMock
  globalThis.document = documentMock
  globalThis.HTMLElement = class MockHTMLElement {}
  globalThis.HTMLButtonElement = class MockHTMLButtonElement extends globalThis.HTMLElement {}
  globalThis.getComputedStyle = () => ({ visibility: 'visible' })
  return {
    windowMock,
    documentMock,
    setActiveElement(el) {
      activeElement = el
    }
  }
}

function setConnectedRecursive(node, connected) {
  node.isConnected = connected
  for (const child of node.children ?? []) {
    setConnectedRecursive(child, connected)
  }
}

function createVNodeCollectorRenderer(documentMock) {
  function createNode(type, text = '', isRoot = false) {
    const listeners = new Map()
    const node = {
      type,
      props: {},
      children: [],
      parent: null,
      text,
      scrollTop: 0,
      isConnected: isRoot,
      disabled: false,
      focusedCount: 0,
      scrollIntoViewCount: 0,
      focus() {
        node.focusedCount += 1
        documentMock.activeElement = node
      },
      scrollIntoView() {
        node.scrollIntoViewCount += 1
      },
      getClientRects() {
        return [{ width: 100, height: 24 }]
      },
      contains(target) {
        if (!target) return false
        if (target === node) return true
        return node.children.some((c) => c.contains?.(target))
      },
      querySelectorAll(selector) {
        if (!selector) return []
        const matches = []
        const walk = (n) => {
          if (n.type === 'button' && !n.props.disabled) {
            matches.push(n)
          }
          for (const child of n.children ?? []) {
            walk(child)
          }
        }
        walk(node)
        return matches
      },
      addEventListener(evt, fn) {
        if (!listeners.has(evt)) listeners.set(evt, new Set())
        listeners.get(evt).add(fn)
      },
      removeEventListener(evt, fn) {
        listeners.get(evt)?.delete(fn)
      },
      dispatch(evt, eventObj = {}) {
        for (const fn of [...(listeners.get(evt) ?? [])]) {
          fn(eventObj)
        }
      }
    }
    if (type === 'button') {
      Object.setPrototypeOf(node, globalThis.HTMLButtonElement.prototype)
    } else if (type !== '#text' && type !== '#comment') {
      Object.setPrototypeOf(node, globalThis.HTMLElement.prototype)
    }
    return markRaw(node)
  }

  const { createApp } = createRenderer({
    patchProp(el, key, _prev, next) {
      if (/^on[A-Z]/.test(key)) {
        const evtName = key.slice(2).toLowerCase()
        if (typeof _prev === 'function') el.removeEventListener(evtName, _prev)
        if (typeof next === 'function') el.addEventListener(evtName, next)
      }
      if (next === null || next === undefined) {
        delete el.props[key]
        if (key === 'disabled') el.disabled = false
      } else {
        el.props[key] = next
        if (key === 'disabled') el.disabled = Boolean(next)
      }
    },
    insert(child, parent, anchor) {
      if (child.parent) {
        const oldIdx = child.parent.children.indexOf(child)
        if (oldIdx >= 0) child.parent.children.splice(oldIdx, 1)
      }
      child.parent = parent
      setConnectedRecursive(child, Boolean(parent.isConnected))
      const idx = anchor ? parent.children.indexOf(anchor) : -1
      if (idx >= 0) parent.children.splice(idx, 0, child)
      else parent.children.push(child)
    },
    remove(child) {
      if (child.parent) {
        const idx = child.parent.children.indexOf(child)
        if (idx >= 0) child.parent.children.splice(idx, 1)
        child.parent = null
      }
      setConnectedRecursive(child, false)
    },
    createElement: (type) => createNode(type),
    createText: (text) => createNode('#text', text),
    createComment: (text) => createNode('#comment', text),
    setText(node, text) {
      node.text = text
    },
    setElementText(node, text) {
      node.children = [createNode('#text', text)]
    },
    parentNode: (node) => node.parent ?? null,
    nextSibling: (node) => {
      if (!node.parent) return null
      const idx = node.parent.children.indexOf(node)
      return idx >= 0 ? (node.parent.children[idx + 1] ?? null) : null
    }
  })
  return { createApp, createRoot: () => createNode('root', '', true) }
}

function compileSfc(relPath, mocks = {}) {
  const sfcPath = path.join(repoRoot, relPath)
  const source = fs.readFileSync(sfcPath, 'utf8')
  const { descriptor } = parse(source, { filename: sfcPath })
  const compiled = compileScript(descriptor, {
    id: path.basename(relPath),
    inlineTemplate: true
  })
  const transpiled = ts.transpileModule(compiled.content, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true
    }
  })
  const vueMod = require('vue')
  const mod = { exports: {} }
  const customRequire = (id) => {
    if (id === 'vue') return vueMod
    if (Object.prototype.hasOwnProperty.call(mocks, id)) return mocks[id]
    return require(id)
  }
  const fn = new Function('require', 'module', 'exports', transpiled.outputText)
  fn(customRequire, mod, mod.exports)
  return { component: mod.exports.default }
}

function findNodes(root, predicate, acc = []) {
  if (!root) return acc
  if (predicate(root)) acc.push(root)
  for (const child of root.children ?? []) {
    findNodes(child, predicate, acc)
  }
  return acc
}

function getText(node) {
  if (!node) return ''
  if (node.type === '#text') return node.text
  return (node.children ?? []).map(getText).join('')
}

function assertSameNode(actual, expected, label) {
  assert.ok(
    actual === expected,
    `${label}: expected ${expected?.type ?? null}(${expected?.props?.class ?? ''}), got ${actual?.type ?? null}(${actual?.props?.class ?? ''})`
  )
}

async function runTests() {
  const ismFormat = loadTsModule('src/utils/ismFormat.ts')
  const searchNodes = loadTsModule('src/utils/searchNodes.ts')

  const ismData = JSON.parse(fs.readFileSync(path.join(repoRoot, 'public/ism.json'), 'utf8'))
  const enrichPayload = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'public/cube-enrichments.json'), 'utf8')
  )
  const coursesPayload = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'public/courses.json'), 'utf8')
  )

  const enrichNodes = enrichPayload.nodes ?? {}
  const courses = coursesPayload.courses ?? []
  const courseById = Object.fromEntries(courses.map((c) => [c.id, c]))
  const coursesByCode = {}
  for (const c of courses) {
    for (const code of [c.catalogue_code, ...(c.related_codes ?? [])]) {
      if (!code) continue
      ;(coursesByCode[code] ??= []).push(c)
    }
  }

  const getNode = (code) => {
    if (!code || code === 'introduction') return null
    const entry = ismData[code]
    return entry && !Array.isArray(entry) ? entry : null
  }
  const getLinkedCourses = (code) => {
    const seen = new Set()
    const list = []
    const add = (c) => {
      if (!c || seen.has(c.id)) return
      seen.add(c.id)
      list.push(c)
    }
    for (const cid of enrichNodes[code]?.related_course_ids ?? []) add(courseById[cid])
    for (const c of coursesByCode[code] ?? []) add(c)
    return list
  }

  // 1. Single source of truth: buildSearchResults matches nodeMatchesQuery across queries
  for (const query of ['笛卡尔', '1-1', '经验主义', 'Metaphysics', '1', '主义', '   ', '不存在的检索词xyz']) {
    const results = searchNodes.buildSearchResults({
      ismData,
      getNode,
      enrichNodes,
      getLinkedCourses,
      query
    })
    const expectedCodes = new Set()
    for (const key of Object.keys(ismData)) {
      if (key === 'introduction') continue
      const node = getNode(key)
      if (!node) continue
      if (ismFormat.nodeMatchesQuery(node, enrichNodes[key] ?? null, getLinkedCourses(key), query, key)) {
        expectedCodes.add(key)
      }
    }
    assert.equal(
      results.length,
      expectedCodes.size,
      `Result count mismatch for query "${query}": got ${results.length}, expected ${expectedCodes.size}`
    )
    for (const item of results) {
      assert.ok(expectedCodes.has(item.code), `Unexpected code ${item.code} for "${query}"`)
    }
  }

  // 2. Descartes ("笛卡尔") exact 16 hits + targetTab rules + stable code ordering
  const descartes = searchNodes.buildSearchResults({
    ismData,
    getNode,
    enrichNodes,
    getLinkedCourses,
    query: '笛卡尔'
  })
  assert.equal(descartes.length, 16)
  const descartesMap = Object.fromEntries(descartes.map((r) => [r.code, r]))
  assert.equal(descartesMap['2'].targetTab, 'courses')
  assert.equal(descartesMap['3'].targetTab, 'courses')
  assert.equal(descartesMap['2-3-1-3'].targetTab, 'editorial')
  assert.equal(descartesMap['2-3-2-1'].targetTab, 'editorial')
  assert.equal(descartesMap['2-4-1'].targetTab, 'editorial')
  assert.equal(descartesMap['1-3-1'].targetTab, 'overview')
  assert.equal(descartesMap['2-3'].targetTab, 'overview')
  for (let i = 1; i < descartes.length; i++) {
    assert.ok(
      searchNodes.compareNodeCodes(descartes[i - 1].code, descartes[i].code) < 0,
      `Descartes results not sorted by code: ${descartes[i - 1].code} vs ${descartes[i].code}`
    )
  }

  // 3. Explicit node code search & exact code/name priority
  const codeHits = searchNodes.buildSearchResults({
    ismData,
    getNode,
    enrichNodes,
    getLinkedCourses,
    query: '1-1'
  })
  assert.ok(codeHits.length > 1)
  assert.equal(codeHits[0].code, '1-1')
  assert.equal(codeHits[0].targetTab, 'overview')
  assert.ok(codeHits[0].locations.includes('code_name'))

  const exactNameHits = searchNodes.buildSearchResults({
    ismData,
    getNode,
    enrichNodes,
    getLinkedCourses,
    query: '经验主义'
  })
  assert.ok(exactNameHits.length > 1)
  assert.equal(exactNameHits[0].code, '2-4-1')
  assert.equal(exactNameHits[0].node.ch_name, '经验主义')
  assert.equal(exactNameHits[0].targetTab, 'overview')

  // 4. Whitespace-only query returns empty
  assert.deepEqual(
    searchNodes.buildSearchResults({
      ismData,
      getNode,
      enrichNodes,
      getLinkedCourses,
      query: '  \t\n  '
    }),
    []
  )

  // 5. All 340 nodes can be returned without silent truncation
  const syntheticAll340 = Object.keys(ismData)
    .filter((k) => k !== 'introduction' && getNode(k))
    .map((k) => ({
      code: k,
      node: getNode(k),
      locations: ['code_name'],
      codeOrNameMatch: true,
      overviewMatch: false,
      coursesMatch: false,
      editorialMatch: false,
      exactCode: false,
      exactName: false,
      rankTier: 2,
      targetTab: 'overview'
    }))
  assert.equal(syntheticAll340.length, 340)

  // 6. SearchResults.vue component tests
  const { windowMock, documentMock, setActiveElement } = createDomMocks()
  const { component: HighlightText } = compileSfc('src/components/HighlightText.vue', {
    '../utils/ismFormat': ismFormat
  })
  const { component: SearchResults } = compileSfc('src/components/SearchResults.vue', {
    './HighlightText.vue': HighlightText,
    '../utils/ismFormat': ismFormat,
    '../utils/searchNodes': searchNodes
  })

  const { createApp, createRoot } = createVNodeCollectorRenderer(documentMock)
  const entryButton = markRaw(
    Object.assign(Object.create(globalThis.HTMLElement.prototype), {
      type: 'entry-button',
      props: { class: 'entry' },
      isConnected: true,
      focusedCount: 0,
      focus() {
        this.focusedCount += 1
        documentMock.activeElement = this
      }
    })
  )
  setActiveElement(entryButton)

  const state = reactive({
    open: true,
    query: '笛卡尔',
    results: descartes,
    totalNodes: 340,
    currentCode: '2-3',
    ismLoaded: true,
    ismLoadError: '',
    enrichStatus: 'ready',
    enrichError: '',
    coursesStatus: 'ready',
    coursesError: ''
  })
  const emitted = { close: 0, jump: [], retryEnrichments: 0, retryCourses: 0 }

  const root = createRoot()
  const app = createApp({
    setup() {
      return () =>
        h(SearchResults, {
          open: state.open,
          query: state.query,
          results: state.results,
          totalNodes: state.totalNodes,
          currentCode: state.currentCode,
          ismLoaded: state.ismLoaded,
          ismLoadError: state.ismLoadError,
          enrichStatus: state.enrichStatus,
          enrichError: state.enrichError,
          coursesStatus: state.coursesStatus,
          coursesError: state.coursesError,
          canJump: (code) => Boolean(getNode(code)),
          onClose: () => {
            emitted.close += 1
            state.open = false
          },
          onJump: (code, tab) => emitted.jump.push({ code, tab }),
          onRetryEnrichments: () => {
            emitted.retryEnrichments += 1
          },
          onRetryCourses: () => {
            emitted.retryCourses += 1
          }
        })
    }
  })
  app.mount(root)
  await nextTick()

  // Verify all 16 items rendered & focus moved to close button
  let itemButtons = findNodes(root, (n) => n.type === 'button' && n.props.class?.includes('result_item_btn'))
  assert.equal(itemButtons.length, 16)
  const closeBtn = findNodes(root, (n) => n.type === 'button' && n.props.class?.includes('drawer_close_btn'))[0]
  assertSameNode(documentMock.activeElement, closeBtn, 'Focus after open')

  // Verify item text includes code, ch_name, en_name, location badges
  const firstText = getText(itemButtons[0])
  assert.ok(firstText.includes('1-3-1'))
  assert.ok(firstText.includes('伪唯心主义'))
  assert.ok(firstText.includes('Pseudo-Idealism'))
  const secondText = getText(itemButtons[1])
  assert.ok(secondText.includes('2'))
  assert.ok(secondText.includes('形而上学'))
  assert.ok(secondText.includes('Metaphysics'))
  assert.ok(secondText.includes('课程'))

  // Click item "2" -> emits ('2', 'courses'), and item "2-3-1-3" -> emits ('2-3-1-3', 'editorial')
  itemButtons[1].dispatch('click', {})
  assert.deepEqual(emitted.jump[0], { code: '2', tab: 'courses' })
  const idxEditorialOnly = descartes.findIndex((item) => item.code === '2-3-1-3')
  assert.ok(idxEditorialOnly >= 0)
  itemButtons[idxEditorialOnly].dispatch('click', {})
  assert.deepEqual(emitted.jump[1], { code: '2-3-1-3', tab: 'editorial' })

  // Keyboard Tab wrap & Shift+Tab wrap
  itemButtons[itemButtons.length - 1].focus()
  let tabPrevented = false
  windowMock.dispatchEvent('keydown', {
    key: 'Tab',
    shiftKey: false,
    preventDefault() {
      tabPrevented = true
    }
  })
  assert.equal(tabPrevented, true)
  assertSameNode(documentMock.activeElement, closeBtn, 'Tab wrap to close button')

  let shiftTabPrevented = false
  windowMock.dispatchEvent('keydown', {
    key: 'Tab',
    shiftKey: true,
    preventDefault() {
      shiftTabPrevented = true
    }
  })
  assert.equal(shiftTabPrevented, true)
  assertSameNode(documentMock.activeElement, itemButtons[itemButtons.length - 1], 'Shift+Tab wrap to last item')

  // ArrowDown / ArrowUp / Home / End navigation on panel
  const panel = findNodes(root, (n) => n.props.class === 'search_drawer_panel')[0]
  closeBtn.focus()
  panel.dispatch('keydown', { key: 'ArrowDown', preventDefault() {} })
  assertSameNode(documentMock.activeElement, itemButtons[0], 'ArrowDown from close to first item')
  panel.dispatch('keydown', { key: 'ArrowDown', preventDefault() {} })
  assertSameNode(documentMock.activeElement, itemButtons[1], 'ArrowDown to second item')
  panel.dispatch('keydown', { key: 'End', preventDefault() {} })
  assertSameNode(documentMock.activeElement, itemButtons[itemButtons.length - 1], 'End to last item')
  panel.dispatch('keydown', { key: 'Home', preventDefault() {} })
  assertSameNode(documentMock.activeElement, itemButtons[0], 'Home to first item')
  panel.dispatch('keydown', { key: 'ArrowUp', preventDefault() {} })
  assertSameNode(documentMock.activeElement, closeBtn, 'ArrowUp from first item back to close')

  // Escape closes and restores focus to entry button
  windowMock.dispatchEvent('keydown', { key: 'Escape', preventDefault() {} })
  await nextTick()
  await nextTick()
  assert.equal(emitted.close, 1)
  assertSameNode(documentMock.activeElement, entryButton, 'Escape restores focus to entry button')

  // Re-open with all 340 items -> no silent truncation
  state.open = true
  state.query = '主义'
  state.results = syntheticAll340
  await nextTick()
  await nextTick()
  itemButtons = findNodes(root, (n) => n.type === 'button' && n.props.class?.includes('result_item_btn'))
  assert.equal(itemButtons.length, 340, 'All 340 items must render without silent truncation')

  // Switch to zero-result query -> no stale items remain
  state.query = '不存在的词xyz'
  state.results = []
  await nextTick()
  itemButtons = findNodes(root, (n) => n.type === 'button' && n.props.class?.includes('result_item_btn'))
  assert.equal(itemButtons.length, 0)
  assert.ok(getText(root).includes('未找到与“不存在的词xyz”匹配的节点'))

  // Switch to whitespace-only query -> treated as empty
  state.query = '   '
  await nextTick()
  assert.ok(getText(root).includes('未输入有效检索词'))

  // Index loading / error states never claim complete results + trigger retries
  state.query = '不存在的词xyz'
  state.enrichStatus = 'error'
  state.enrichError = '讲稿索引错误'
  state.coursesStatus = 'loading'
  await nextTick()
  const rootTextError = getText(root)
  assert.ok(rootTextError.includes('索引未完整就绪'))
  assert.ok(rootTextError.includes('部分检索索引加载失败'))
  assert.ok(rootTextError.includes('补充课程目录加载中'))
  const retryBtns = findNodes(root, (n) => n.type === 'button' && n.props.class?.includes('retry_btn'))
  assert.equal(retryBtns.length, 1)
  retryBtns[0].dispatch('click', {})
  assert.equal(emitted.retryEnrichments, 1)

  // XSS check: query containing HTML renders safely as text, not <img>
  state.enrichStatus = 'ready'
  state.coursesStatus = 'ready'
  state.query = '<img src=x onerror=alert(1)>'
  await nextTick()
  assert.equal(findNodes(root, (n) => n.type === 'img').length, 0)
  assert.ok(getText(root).includes('<img src=x onerror=alert(1)>'))

  // Clean unmount removes keydown listener & restores overflow
  app.unmount()
  assert.equal(windowMock.listenerCount('keydown'), 0)
  assert.equal(documentMock.documentElement.style.overflow, '')

  console.log('check-search: all assertions passed')
}

runTests().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
