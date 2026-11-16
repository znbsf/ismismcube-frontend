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

function loadTsModule(relPath) {
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

function createMocks() {
  const winListeners = new Map()
  let activeElement = null
  const documentMock = {
    body: markRaw({ nodeName: 'BODY' }),
    documentElement: { style: { overflow: '' } },
    get activeElement() {
      return activeElement
    },
    set activeElement(el) {
      activeElement = el
    },
    querySelector: () => null
  }
  const windowMock = {
    addEventListener: (t, fn) => {
      if (!winListeners.has(t)) winListeners.set(t, new Set())
      winListeners.get(t).add(fn)
    },
    removeEventListener: (t, fn) => winListeners.get(t)?.delete(fn),
    dispatchEvent: (t, evt = {}) => {
      for (const fn of [...(winListeners.get(t) ?? [])]) fn(evt)
    },
    listenerCount: (t) => winListeners.get(t)?.size ?? 0
  }
  globalThis.window = windowMock
  globalThis.document = documentMock
  globalThis.HTMLElement = class MockHTMLElement {}
  globalThis.HTMLButtonElement = class MockHTMLButtonElement extends globalThis.HTMLElement {}
  globalThis.getComputedStyle = () => ({ visibility: 'visible' })
  return { windowMock, documentMock, setActiveElement: (el) => { activeElement = el } }
}

function setConnected(node, connected) {
  node.isConnected = connected
  for (const child of node.children) setConnected(child, connected)
}

function createTestRenderer(documentMock) {
  function createNode(type, text = '', isRoot = false) {
    const listeners = new Map()
    const node = {
      type,
      props: {},
      children: [],
      parent: null,
      text,
      isConnected: isRoot,
      disabled: false,
      hiddenForTest: false,
      focusedCount: 0,
      get dataset() {
        return { courseId: node.props['data-course-id'] }
      },
      focus() {
        node.focusedCount += 1
        documentMock.activeElement = node
      },
      getClientRects() {
        if (!node.isConnected || node.hiddenForTest) return []
        if (globalThis.window.mobileForTest) {
          let ancestor = node
          while (ancestor) {
            const classes = String(ancestor.props.class ?? '')
            const panel = findParentPanel(ancestor)
            const pane = String(panel?.props.class ?? '')
            if (classes === 'drawer_list' && pane.includes('mobile_pane_detail')) return []
            if (classes === 'drawer_detail' && pane.includes('mobile_pane_list')) return []
            ancestor = ancestor.parent
          }
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
            : (n.type === 'button' || n.type === 'input' || n.type === 'a') && !n.props.disabled) {
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
      if (/^on[A-Z]/.test(key)) {
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
      }
    },
    insert(child, parent, anchor) {
      if (child.parent) {
        const oldIdx = child.parent.children.indexOf(child)
        if (oldIdx >= 0) child.parent.children.splice(oldIdx, 1)
      }
      child.parent = parent
      setConnected(child, Boolean(parent.isConnected))
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
      setConnected(child, false)
    },
    createElement: (t) => createNode(t),
    createText: (t) => createNode('#text', t),
    createComment: (t) => createNode('#comment', t),
    setText: (n, t) => { n.text = t },
    setElementText: (n, t) => {
      for (const oldChild of n.children) {
        oldChild.parent = null
        setConnected(oldChild, false)
      }
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
    }
  })
  return { createApp, createRoot: () => createNode('root', '', true), createNode }
}

function findParentPanel(node) {
  while (node) {
    if (node.props.role === 'dialog') return node
    node = node.parent
  }
  return null
}

function compileSfc(relPath, mocks = {}) {
  const sfcPath = path.join(repoRoot, relPath)
  const source = fs.readFileSync(sfcPath, 'utf8')
  const { descriptor } = parse(source, { filename: sfcPath })
  const compiled = compileScript(descriptor, { id: path.basename(relPath), inlineTemplate: true })
  const transpiled = ts.transpileModule(compiled.content, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  })
  const mod = { exports: {} }
  const customRequire = (id) => (Object.prototype.hasOwnProperty.call(mocks, id) ? mocks[id] : require(id))
  new Function('require', 'module', 'exports', transpiled.outputText)(customRequire, mod, mod.exports)
  return mod.exports.default
}

const findNodes = (root, pred, acc = []) => {
  if (!root) return acc
  if (pred(root)) acc.push(root)
  for (const c of root.children) findNodes(c, pred, acc)
  return acc
}

const getText = (n) => (n.type === '#text' ? n.text : n.children.map(getText).join(''))

const SAMPLE_COURSES = [
  {
    id: 'BV_DOLLAR_1',
    title: '$-1 导论课程',
    url: 'https://www.bilibili.com/video/BV_DOLLAR_1',
    source_ids: ['s1'],
    evidence_level: 'metadata',
    related_codes: ['1-1'],
    kind: 'dollar_series',
    catalogue_code: null,
    body_ref: 'BV_DOLLAR_1'
  },
  {
    id: 'BV_STUDY_1',
    title: '第一场域复习课',
    url: 'https://www.bilibili.com/video/BV_STUDY_1',
    source_ids: ['s2'],
    evidence_level: 'metadata',
    related_codes: ['1-2'],
    kind: 'review',
    catalogue_code: '1-2'
  }
]

const SAMPLE_BODIES = {
  BV_DOLLAR_1: {
    id: 'BV_DOLLAR_1',
    series_code: '$-1',
    title: '$-1 导论课程',
    course_summary: [{ text: '这是导论摘要正文。' }]
  }
}

async function runTests() {
  const timer = setTimeout(() => {
    console.error('check-courses internal timeout')
    process.exit(2)
  }, 5000)
  timer.unref()
  console.log('step 1: init')
  const { windowMock, documentMock, setActiveElement } = createMocks()
  const ismFormat = loadTsModule('src/utils/ismFormat.ts')
  const HighlightText = compileSfc('src/components/HighlightText.vue', { '../utils/ismFormat': ismFormat })
  const CourseDrawer = compileSfc('src/components/CourseDrawer.vue', {
    './HighlightText.vue': HighlightText,
    '../utils/ismFormat': ismFormat
  })
  const { createApp, createRoot, createNode } = createTestRenderer(documentMock)
  console.log('step 2: contract')

  // 1. Contract check on ismismcube.vue courses_button & CourseDrawer fallback-focus-selector
  const pageSrc = fs.readFileSync(path.join(repoRoot, 'src', 'pages', 'ismismcube', 'ismismcube.vue'), 'utf8')
  assert.ok(pageSrc.includes('<button id="courses_button" type="button" @click="openCourseDrawer()">'))
  assert.ok(!pageSrc.includes('<div id="courses_button"'))
  assert.ok(pageSrc.includes('fallback-focus-selector="#courses_button"'))
  assert.match(pageSrc, /#courses_button\s*\{[^}]*box-sizing:\s*content-box;/)
  console.log('step 3: test 2')

  // 2. initialCourseId when courses arrive asynchronously AFTER open (exists + missing)
  {
    const triggerBtn = createNode('button', '', true)
    triggerBtn.isConnected = true
    documentMock.querySelector = (sel) => (sel === '#courses_button' ? triggerBtn : null)
    setActiveElement(triggerBtn)

    const root = createRoot()
    let closeCount = 0
    const state = reactive({
      open: false,
      courses: [],
      courseBodies: {},
      coursesStatus: 'loading',
      coursesError: '',
      bodiesStatus: 'ready',
      bodiesError: '',
      initialCourseId: 'BV_STUDY_1',
      initialCategory: 'dollar_series',
      fallbackFocusSelector: '#courses_button'
    })
    const app = createApp({
      render: () => h(CourseDrawer, { ...state, onClose: () => { closeCount += 1; state.open = false } })
    })
    app.mount(root)

    // Open while loading with initialCourseId = BV_STUDY_1
    state.open = true
    await nextTick()
    await nextTick()
    assert.equal(documentMock.documentElement.style.overflow, 'hidden')
    const panel = findNodes(root, (n) => n.props.role === 'dialog')[0]
    assert.ok(panel.props.class.includes('mobile_pane_detail'))

    // Courses arrive asynchronously -> must select BV_STUDY_1, not BV_DOLLAR_1
    state.courses = [...SAMPLE_COURSES]
    state.courseBodies = { ...SAMPLE_BODIES }
    state.coursesStatus = 'ready'
    await nextTick()
    await nextTick()
    const detailTitle = findNodes(root, (n) => n.props.class === 'detail_title')[0]
    assert.match(getText(detailTitle), /第一场域复习课/)

    // Preserves filter switching when user clicks dollar_series tab
    const tabBtns = findNodes(root, (n) => String(n.props.class ?? '').includes('drawer_tab_btn'))
    tabBtns[0].dispatch('click')
    await nextTick()
    assert.match(getText(findNodes(root, (n) => n.props.class === 'detail_title')[0]), /导论课程/)

    // Close returns focus to triggerBtn
    windowMock.dispatchEvent('keydown', { key: 'Escape', preventDefault() {} })
    assert.equal(closeCount, 1)
    await nextTick()
    // Close watcher itself awaits the DOM flush before restoring focus.
    await nextTick()
    assert.ok(documentMock.activeElement === triggerBtn, 'focus must return to the trigger')

    // Reopen with missing initialCourseId after courses already loaded -> must NOT show BV_DOLLAR_1
    state.initialCourseId = 'BV_NONEXISTENT'
    state.open = true
    await nextTick()
    await nextTick()
    assert.equal(findNodes(root, (n) => n.props.class === 'detail_title').length, 0)
    const detailEl = findNodes(root, (n) => n.props.class === 'drawer_detail')[0]
    assert.match(getText(detailEl), /未找到目标课程「BV_NONEXISTENT」/)

    // Courses update asynchronously while still missing BV_NONEXISTENT -> still must NOT replace with first course
    state.courses = [...SAMPLE_COURSES]
    await nextTick()
    assert.equal(findNodes(root, (n) => n.props.class === 'detail_title').length, 0)
    assert.match(getText(findNodes(root, (n) => n.props.class === 'drawer_detail')[0]), /未找到目标课程「BV_NONEXISTENT」/)

    // The unresolved target becoming available changes detail identity and resets scroll.
    const pendingDetail = findNodes(root, (n) => n.props.class === 'drawer_detail')[0]
    pendingDetail.scrollTop = 240
    state.courses = [...SAMPLE_COURSES, { ...SAMPLE_COURSES[1], id: 'BV_NONEXISTENT', title: '晚到目标课程' }]
    await nextTick()
    await nextTick()
    assert.equal(pendingDetail.scrollTop, 0, 'async target resolution resets detail scroll')
    assert.match(getText(findNodes(root, (n) => n.props.class === 'detail_title')[0]), /晚到目标课程/)

    // Clicking a course item clears missing notice and enters detail view
    windowMock.mobileForTest = true
    const listItems = findNodes(root, (n) => String(n.props.class ?? '').includes('course_list_item'))
    listItems[0].dispatch('click')
    await nextTick()
    await nextTick()
    assert.match(getText(findNodes(root, (n) => n.props.class === 'detail_title')[0]), /导论课程/)
    assert.ok(documentMock.activeElement === findNodes(root, (n) => n.props.class === 'detail_title')[0], 'mobile selection focuses visible detail title')

    // Mobile list/detail toggle back to list
    const mobileListBtn = findNodes(root, (n) => String(n.props.class ?? '').includes('mobile_pane_btn'))[0]
    mobileListBtn.dispatch('click')
    await nextTick()
    await nextTick()
    assert.ok(findNodes(root, (n) => n.props.role === 'dialog')[0].props.class.includes('mobile_pane_list'))
    assert.ok(documentMock.activeElement === listItems[0], 'return to mobile list focuses selected course')

    // Closing before the selection continuation must restore the trigger, never detached detail.
    listItems[0].dispatch('click')
    state.open = false
    await nextTick()
    await nextTick()
    assert.ok(documentMock.activeElement === triggerBtn, 'late selection callback cannot steal focus after close')
    state.initialCourseId = undefined
    state.open = true
    await nextTick()
    await nextTick()
    findNodes(root, (n) => String(n.props.class ?? '').includes('course_list_item'))[0].dispatch('click')
    await nextTick()
    await nextTick()
    findNodes(root, (n) => String(n.props.class ?? '').includes('mobile_pane_btn'))[0].dispatch('click')
    state.open = false
    await nextTick()
    await nextTick()
    assert.ok(documentMock.activeElement === triggerBtn, 'late return-to-list callback cannot steal focus after close')
    windowMock.mobileForTest = false

    app.unmount()
  }

  // 3. Initial open=true, IME Esc guard, Tab trap, and rapid toggle focus non-stealing
  {
    const triggerBtn = createNode('button', '', true)
    triggerBtn.isConnected = true
    documentMock.querySelector = (sel) => (sel === '#courses_button' ? triggerBtn : null)
    setActiveElement(documentMock.body)

    const root = createRoot()
    let closeCount = 0
    const state = reactive({
      open: true,
      courses: [...SAMPLE_COURSES],
      courseBodies: { ...SAMPLE_BODIES },
      coursesStatus: 'ready',
      coursesError: '',
      bodiesStatus: 'ready',
      bodiesError: '',
      initialCourseId: undefined,
      initialCategory: 'dollar_series',
      fallbackFocusSelector: '#courses_button'
    })
    const app = createApp({
      render: () => h(CourseDrawer, { ...state, onClose: () => { closeCount += 1; state.open = false } })
    })
    app.mount(root)
    await nextTick()

    assert.equal(documentMock.documentElement.style.overflow, 'hidden')
    const panel = findNodes(root, (n) => n.props.role === 'dialog')[0]
    const searchInput = findNodes(root, (n) => n.props.class === 'drawer_search_input')[0]
    assert.ok(documentMock.activeElement === searchInput, 'search input must receive initial focus')

    // IME composing Escape must not close
    windowMock.dispatchEvent('keydown', { key: 'Escape', isComposing: true, preventDefault() {} })
    assert.equal(closeCount, 0)

    // Tab wrap from last focusable back to first focusable (close button)
    const focusables = panel.querySelectorAll('button,input,a')
    setActiveElement(focusables[focusables.length - 1])
    windowMock.dispatchEvent('keydown', { key: 'Tab', shiftKey: false, preventDefault() {} })
    assert.ok(documentMock.activeElement === focusables[0], 'Tab must wrap to first focusable')

    // Shift+Tab wrap from first focusable to last focusable
    windowMock.dispatchEvent('keydown', { key: 'Tab', shiftKey: true, preventDefault() {} })
    assert.ok(documentMock.activeElement === focusables[focusables.length - 1], 'Shift+Tab must wrap to last focusable')

    // Close from initial open (no prior button focused) -> falls back to #courses_button
    state.open = false
    await nextTick()
    // Close watcher itself awaits the DOM flush before restoring focus.
    await nextTick()
    assert.ok(documentMock.activeElement === triggerBtn, 'focus must return to the trigger')

    // Rapid open -> close -> open within same tick must NOT steal focus back to triggerBtn
    state.open = true
    state.open = false
    state.open = true
    await nextTick()
    await nextTick()
    assert.ok(findNodes(root, (n) => n.props.role === 'dialog')[0].contains(documentMock.activeElement))

    // Rapid open -> close within same tick must NOT focus inside closed drawer
    state.open = false
    await nextTick()
    state.open = true
    state.open = false
    await nextTick()
    // Close watcher itself awaits the DOM flush before restoring focus.
    await nextTick()
    assert.ok(documentMock.activeElement === triggerBtn, 'focus must return to the trigger')

    app.unmount()
    assert.equal(windowMock.listenerCount('keydown'), 0)
  }

  // 4. Jump-close suppresses late focus restore; ordinary close restores visible opener and falls back when opener is invisible
  {
    const fallbackBtn = createNode('button', '', true)
    fallbackBtn.isConnected = true
    const hiddenOpener = createNode('button', '', true)
    hiddenOpener.isConnected = true
    const targetReadingTab = createNode('button', '', true)
    targetReadingTab.isConnected = true
    documentMock.querySelector = (sel) => (sel === '#courses_button' ? fallbackBtn : null)

    const root = createRoot()
    let jumpedCodes = []
    let closeDrawerOnJump = true
    const state = reactive({
      open: false,
      courses: [...SAMPLE_COURSES],
      courseBodies: { ...SAMPLE_BODIES },
      coursesStatus: 'ready',
      coursesError: '',
      bodiesStatus: 'ready',
      bodiesError: '',
      canJump: (code) => code === '1-1',
      initialCourseId: 'BV_DOLLAR_1',
      initialCategory: 'dollar_series',
      fallbackFocusSelector: '#courses_button'
    })
    const app = createApp({
      render: () => h(CourseDrawer, {
        ...state,
        onClose: () => { state.open = false },
        onJumpToNode: (code) => {
          jumpedCodes.push(code)
          if (closeDrawerOnJump) state.open = false
        }
      })
    })
    app.mount(root)

    // Jump-close: even when opener stays connected & visible, jump-close must NOT restore opener on late ticks
    setActiveElement(hiddenOpener)
    state.open = true
    await nextTick()
    await nextTick()
    const jumpBtn = findNodes(root, (n) => String(n.props.class ?? '').includes('node_jump_btn'))[0]
    assert.ok(Boolean(jumpBtn), 'linked node jump button renders')
    jumpBtn.dispatch('click')
    assert.deepEqual(jumpedCodes, ['1-1'])
    targetReadingTab.focus()
    await nextTick()
    await nextTick()
    await nextTick()
    assert.equal(documentMock.documentElement.style.overflow, '')
    assert.ok(documentMock.activeElement === targetReadingTab, 'jump-close must not steal focus back to opener')

    // Jump without closing drawer does not poison a subsequent ordinary Escape close
    closeDrawerOnJump = false
    setActiveElement(hiddenOpener)
    state.open = true
    await nextTick()
    await nextTick()
    findNodes(root, (n) => String(n.props.class ?? '').includes('node_jump_btn'))[0].dispatch('click')
    await nextTick()
    windowMock.dispatchEvent('keydown', { key: 'Escape', preventDefault() {} })
    await nextTick()
    await nextTick()
    assert.ok(documentMock.activeElement === hiddenOpener, 'ordinary close after non-closing jump still restores visible opener')

    // Ordinary close when opener is v-show hidden (connected, getClientRects() empty) falls back to visible #courses_button
    closeDrawerOnJump = true
    hiddenOpener.hiddenForTest = false
    setActiveElement(hiddenOpener)
    state.open = true
    await nextTick()
    await nextTick()
    hiddenOpener.hiddenForTest = true
    windowMock.dispatchEvent('keydown', { key: 'Escape', preventDefault() {} })
    await nextTick()
    await nextTick()
    assert.ok(documentMock.activeElement === fallbackBtn, 'invisible opener falls back to visible #courses_button')

    // Ordinary close when BOTH opener and fallback are invisible must not focus either hidden node
    fallbackBtn.hiddenForTest = true
    hiddenOpener.hiddenForTest = false
    setActiveElement(hiddenOpener)
    state.open = true
    await nextTick()
    await nextTick()
    hiddenOpener.hiddenForTest = true
    setActiveElement(documentMock.body)
    windowMock.dispatchEvent('keydown', { key: 'Escape', preventDefault() {} })
    await nextTick()
    await nextTick()
    assert.ok(documentMock.activeElement !== hiddenOpener && documentMock.activeElement !== fallbackBtn, 'never focuses invisible fallback')

    app.unmount()
    assert.equal(windowMock.listenerCount('keydown'), 0)
  }

  // Retry handlers move only the initiating focus before loading removes it.
  for (const resource of ['courses', 'bodies']) {
    const root = createRoot(), outside = createNode('button', '', true)
    outside.isConnected = true
    const state = reactive({ open: false, courses: [...SAMPLE_COURSES], courseBodies: { ...SAMPLE_BODIES }, coursesError: '', bodiesError: '',
      coursesStatus: resource === 'courses' ? 'error' : 'ready', bodiesStatus: resource === 'bodies' ? 'error' : 'ready',
      initialCourseId: 'BV_DOLLAR_1', initialCategory: 'dollar_series' })
    let requests = 0
    const statusKey = resource === 'courses' ? 'coursesStatus' : 'bodiesStatus'
    const app = createApp({ render: () => h(CourseDrawer, { ...state,
      onRetryCourses: () => { requests++; state.coursesStatus = 'loading' },
      onRetryBodies: () => { requests++; state.bodiesStatus = 'loading' } }) })
    app.mount(root); state.open = true; await nextTick(); await nextTick()
    const retry = () => findNodes(root, n => n.type === 'button' && getText(n).trim() === (resource === 'courses' ? '重试加载' : '重试加载摘要'))[0]
    let button = retry()
    assert.ok(Boolean(button), resource + ' retry renders')
    button.focus(); button.dispatch('click', { currentTarget: button })
    const target = documentMock.activeElement
    assert.ok(target !== button && (target.props.role === 'dialog' || String(target.props.class).includes('detail_title')))
    await nextTick(); assert.ok(documentMock.activeElement === target, 'loading retains stable focus')
    state[statusKey] = 'ready'; await nextTick(); await nextTick()
    assert.ok(documentMock.activeElement === target, 'success retains stable target')
    state[statusKey] = 'loading'; await nextTick()
    outside.focus(); state[statusKey] = 'ready'; await nextTick(); await nextTick()
    assert.ok(documentMock.activeElement === outside, 'success does not reclaim external focus')
    state[statusKey] = 'error'; await nextTick()
    button = retry(); button.dispatch('click', { currentTarget: button })
    assert.ok(documentMock.activeElement === outside, 'programmatic retry does not steal focus')
    await nextTick(); state[statusKey] = 'error'; await nextTick()
    button = retry(); button.focus(); button.dispatch('click', { currentTarget: button }); await nextTick()
    state[statusKey] = 'error'; await nextTick(); await nextTick()
    assert.ok(documentMock.activeElement !== button, 'repeated failure retains stable focus')
    outside.focus(); state.open = false; await nextTick(); app.unmount(); await nextTick()
    assert.ok(documentMock.activeElement === outside, 'close/unmount has no retry callback focus')
    assert.equal(requests, 3)
  }

  console.log('check-courses: ALL PASSED')
}

runTests().catch((err) => {
  console.error(String(err?.stack ?? err).slice(0, 4000))
  process.exitCode = 1
})
