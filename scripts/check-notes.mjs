import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { compileScript, parse } from 'vue/compiler-sfc'
import { createRenderer, h, markRaw, nextTick } from 'vue'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

function createStorageMock(initial = {}) {
  const map = new Map(Object.entries(initial))
  let failGet = false
  let failSet = false
  let failRemove = false
  return {
    getItem(key) {
      if (failGet) throw new Error('storage get failed')
      return map.has(key) ? map.get(key) : null
    },
    setItem(key, value) {
      if (failSet) throw new Error('QuotaExceededError')
      map.set(key, String(value))
    },
    removeItem(key) {
      if (failRemove) throw new Error('storage remove failed')
      map.delete(key)
    },
    clear() {
      map.clear()
    },
    setFailGet(v) {
      failGet = v
    },
    setFailRemove(v) { failRemove = v },
    setFailSet(v) {
      failSet = v
    },
    snapshot() {
      return Object.fromEntries(map.entries())
    }
  }
}

function createWindowDocumentMocks(storage) {
  const windowListeners = new Map()
  const documentListeners = new Map()
  const downloads = []
  let confirmResult = true

  const windowMock = {
    setTimeout,
    clearTimeout,
    confirm: () => confirmResult,
    addEventListener(type, fn) {
      if (!windowListeners.has(type)) windowListeners.set(type, new Set())
      windowListeners.get(type).add(fn)
    },
    removeEventListener(type, fn) {
      windowListeners.get(type)?.delete(fn)
    },
    dispatchEvent(type, event = {}) {
      for (const fn of [...(windowListeners.get(type) ?? [])]) {
        fn(event)
      }
    },
    listenerCount(type) {
      return windowListeners.get(type)?.size ?? 0
    }
  }

  const documentMock = {
    visibilityState: 'visible',
    body: {
      appendChild() {},
      removeChild() {}
    },
    createElement(tag) {
      return {
        tagName: tag,
        href: '',
        download: '',
        click() {
          downloads.push({ href: this.href, download: this.download })
        }
      }
    },
    addEventListener(type, fn) {
      if (!documentListeners.has(type)) documentListeners.set(type, new Set())
      documentListeners.get(type).add(fn)
    },
    removeEventListener(type, fn) {
      documentListeners.get(type)?.delete(fn)
    },
    dispatchVisibility(state) {
      documentMock.visibilityState = state
      for (const fn of [...(documentListeners.get('visibilitychange') ?? [])]) {
        fn({})
      }
    },
    listenerCount(type) {
      return documentListeners.get(type)?.size ?? 0
    }
  }

  const blobContents = []
  const originalBlob = globalThis.Blob
  const originalURL = globalThis.URL

  globalThis.localStorage = storage
  globalThis.window = windowMock
  globalThis.document = documentMock
  globalThis.Blob = class MockBlob {
    constructor(parts, opts) {
      this.parts = parts
      this.type = opts?.type ?? ''
      blobContents.push({ content: parts.join(''), type: this.type })
    }
  }
  globalThis.URL = {
    createObjectURL: () => 'blob:mock',
    revokeObjectURL: () => {}
  }

  return {
    windowMock,
    documentMock,
    downloads,
    blobContents,
    setConfirmResult(v) {
      confirmResult = v
    },
    restore() {
      globalThis.Blob = originalBlob
      globalThis.URL = originalURL
    }
  }
}

function createVNodeCollectorRenderer() {
  function createNode(type, text = '') {
    const listeners = new Map()
    return markRaw({
      type,
      props: {},
      children: [],
      parent: null,
      text,
      value: '',
      composing: false,
      get isConnected() { return Boolean(this.isRoot || this.parent?.isConnected) },
      getClientRects() { return this.isConnected ? [{}] : [] },
      focus(options) { this.lastFocusOptions = options; document.activeElement = this },
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
    })
  }
  const { createApp } = createRenderer({
    patchProp(el, key, _prev, next) {
      if (next === null || next === undefined) {
        delete el.props[key]
      } else {
        el.props[key] = next
        if (key === 'value') {
          el.value = String(next)
        }
      }
    },
    insert(child, parent, anchor) {
      child.parent = parent
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
  return { createApp, createRoot: () => { const root = createNode('root'); root.isRoot = true; return root } }
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
  const require = createRequire(import.meta.url)
  const mod = { exports: {} }
  const customRequire = (id) => {
    if (id.startsWith('.')) {
      const resolvedBase = path.resolve(path.dirname(fullPath), id)
      const tsCandidate = resolvedBase.endsWith('.ts') ? resolvedBase : `${resolvedBase}.ts`
      if (fs.existsSync(tsCandidate)) {
        return loadTsModule(path.relative(repoRoot, tsCandidate))
      }
    }
    return require(id)
  }
  const fn = new Function('require', 'module', 'exports', transpiled.outputText)
  fn(customRequire, mod, mod.exports)
  return mod.exports
}

let routeProgressModule
let notesLeaveGuardModule
function compileNodeNotesComponent(notesStoreMod, relativePath = 'src/components/NodeNotes.vue') {
  const sfcPath = path.join(repoRoot, relativePath)
  const source = fs.readFileSync(sfcPath, 'utf8')
  const { descriptor } = parse(source, { filename: sfcPath })
  const compiled = compileScript(descriptor, {
    id: 'node-notes-test',
    inlineTemplate: true
  })

  const transpiled = ts.transpileModule(compiled.content, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true
    }
  })

  const require = createRequire(import.meta.url)
  const vueMod = require('vue')
  const mod = { exports: {} }
  const customRequire = (id) => {
    if (id === 'vue') return vueMod
    if (id === './utils/routeProgress') return routeProgressModule ??= loadTsModule('src/utils/routeProgress.ts')
    if (id === '../utils/notesLeaveGuard' || id === './utils/notesLeaveGuard') return notesLeaveGuardModule ??= loadTsModule('src/utils/notesLeaveGuard.ts')
    if (id === '../utils/notesStore' || id === './utils/notesStore') return notesStoreMod
    return require(id)
  }
  const fn = new Function('require', 'module', 'exports', transpiled.outputText)
  fn(customRequire, mod, mod.exports)
  return mod.exports.default
}

async function run() {
  const storage = createStorageMock()
  const env = createWindowDocumentMocks(storage)
  const notesStore = loadTsModule('src/utils/notesStore.ts')
  const NodeNotes = compileNodeNotesComponent(notesStore)
  const { createApp, createRoot } = createVNodeCollectorRenderer()

  const mountNotes = (initialCode = '1') => {
    const root = createRoot()
    const currentCode = { value: initialCode }
    const emittedUpdated = []
    const emittedJump = []
    let app = createApp({
      data() {
        return { code: initialCode }
      },
      render() {
        return h(NodeNotes, {
          code: this.code,
          title: `节点 ${this.code}`,
          readings: [],
          getTitle: (c) => `标题-${c}`,
          onUpdated: (s) => emittedUpdated.push(s),
          onJump: (c) => emittedJump.push(c)
        })
      }
    })
    app.config.errorHandler = (err) => {
      throw err
    }
    const vm = app.mount(root)
    return {
      root,
      emittedUpdated,
      emittedJump,
      async setCode(nextCode) {
        currentCode.value = nextCode
        vm.code = nextCode
        await nextTick()
      },
      unmount() {
        app.unmount()
      }
    }
  }

  // 1. 400ms 防抖前页面隐藏 / 离开同步 flush + 无 beforeunload 确认框 + 监听器清理
  {
    const m = mountNotes('1')
    await nextTick()
    assert.equal(env.windowMock.listenerCount('pagehide'), 1)
    assert.equal(env.windowMock.listenerCount('beforeunload'), 1)
    assert.equal(env.documentMock.listenerCount('visibilitychange'), 1)

    const textareas = findNodes(m.root, (n) => n.type === 'textarea')
    assert.ok(textareas.length >= 3)
    textareas[0].props['onUpdate:modelValue']('刷新前输入的内容')
    textareas[0].props.onInput({})

    // 防抖尚未触发时本地存储仍为空
    assert.equal(storage.getItem(notesStore.NOTES_STORAGE_KEY), null)

    // 模拟 beforeunload（不能调用 preventDefault / 设置 returnValue）
    let prevented = false
    const beforeUnloadEvent = {
      preventDefault() {
        prevented = true
      }
    }
    env.windowMock.dispatchEvent('beforeunload', beforeUnloadEvent)
    assert.equal(prevented, false)
    assert.equal('returnValue' in beforeUnloadEvent, false)

    const savedAfterBeforeUnload = JSON.parse(storage.getItem(notesStore.NOTES_STORAGE_KEY))
    assert.equal(savedAfterBeforeUnload.nodes['1']?.claim, '刷新前输入的内容')

    // 再次编辑后通过 visibilitychange=hidden 立即落盘
    textareas[1].props['onUpdate:modelValue']('第1讲第3页')
    textareas[1].props.onInput({})
    env.documentMock.dispatchVisibility('hidden')
    const savedAfterHidden = JSON.parse(storage.getItem(notesStore.NOTES_STORAGE_KEY))
    assert.equal(savedAfterHidden.nodes['1']?.source, '第1讲第3页')

    // 再次编辑后通过 pagehide 立即落盘
    textareas[2].props['onUpdate:modelValue']('待核问题')
    textareas[2].props.onInput({})
    env.windowMock.dispatchEvent('pagehide', {})
    const savedAfterPageHide = JSON.parse(storage.getItem(notesStore.NOTES_STORAGE_KEY))
    assert.equal(savedAfterPageHide.nodes['1']?.question, '待核问题')

    // 切节点 flush
    textareas[0].props['onUpdate:modelValue']('切节点前修改')
    textareas[0].props.onInput({})
    await m.setCode('1-2')
    const savedAfterSwitch = JSON.parse(storage.getItem(notesStore.NOTES_STORAGE_KEY))
    assert.equal(savedAfterSwitch.nodes['1']?.claim, '切节点前修改')

    // 卸载时 flush 且清理所有监听器
    const textareasNode2 = findNodes(m.root, (n) => n.type === 'textarea')
    textareasNode2[0].props['onUpdate:modelValue']('卸载前修改')
    textareasNode2[0].props.onInput({})
    m.unmount()

    assert.equal(env.windowMock.listenerCount('pagehide'), 0)
    assert.equal(env.windowMock.listenerCount('beforeunload'), 0)
    assert.equal(env.documentMock.listenerCount('visibilitychange'), 0)
    const savedAfterUnmount = JSON.parse(storage.getItem(notesStore.NOTES_STORAGE_KEY))
    assert.equal(savedAfterUnmount.nodes['1-2']?.claim, '卸载前修改')

    // 保留 400ms 防抖自动保存
    const mDebounce = mountNotes('2')
    await nextTick()
    const debounceTextareas = findNodes(mDebounce.root, (n) => n.type === 'textarea')
    debounceTextareas[0].props['onUpdate:modelValue']('防抖自动保存内容')
    debounceTextareas[0].props.onInput({})
    assert.equal(JSON.parse(storage.getItem(notesStore.NOTES_STORAGE_KEY)).nodes['2'], undefined)
    await new Promise((r) => setTimeout(r, 460))
    assert.equal(JSON.parse(storage.getItem(notesStore.NOTES_STORAGE_KEY)).nodes['2']?.claim, '防抖自动保存内容')
    mDebounce.unmount()
  }

  // 2. 保存失败后切页签重挂载：loadNotes 不能覆盖内存未保存笔记，且提示明确并支持重试/导出
  {
    const diskState = {
      version: 1,
      nodes: {
        '1': {
          claim: '磁盘上的旧版本',
          source: '',
          question: '',
          readings: {},
          updatedAt: '2026-11-14T10:00:00.000Z'
        }
      }
    }
    storage.clear()
    storage.setFailSet(false)
    storage.setItem(notesStore.NOTES_STORAGE_KEY, JSON.stringify(diskState))
    notesStore.reloadExternalNotes()
    notesStore.saveNotes(diskState)

    let m = mountNotes('1')
    await nextTick()
    const textareas = findNodes(m.root, (n) => n.type === 'textarea')
    assert.equal(textareas[0].value, '磁盘上的旧版本')

    // 写入失败（如配额满）
    storage.setFailSet(true)
    textareas[0].props['onUpdate:modelValue']('未写入磁盘的内存新版本')
    textareas[0].props.onInput({})
    // 通过卸载模拟切到其他页签（触发 flushPendingSave，写入失败）
    m.unmount()

    assert.equal(notesStore.getNotesStorageError(), true)
    assert.equal(notesStore.getNotesUnsavedInMemory(), true)
    assert.equal(JSON.parse(storage.getItem(notesStore.NOTES_STORAGE_KEY)).nodes['1'].claim, '磁盘上的旧版本')

    // 切回“我的笔记”页签重挂载，调用 loadNotes()
    m = mountNotes('1')
    await nextTick()
    const remountedTextareas = findNodes(m.root, (n) => n.type === 'textarea')
    assert.equal(remountedTextareas[0].value, '未写入磁盘的内存新版本')
    const rootText = getText(m.root)
    assert.ok(rootText.includes('保存失败') && rootText.includes('内存'))

    // 失败状态下仍可导出未保存内容
    const exportJsonBtn = findNodes(m.root, (n) => n.type === 'button' && getText(n).includes('导出 JSON'))[0]
    assert.ok(exportJsonBtn)
    exportJsonBtn.props.onClick()
    const lastExported = env.blobContents[env.blobContents.length - 1]
    assert.ok(lastExported.content.includes('未写入磁盘的内存新版本'))

    // 恢复存储后点击重试保存，应成功落盘并清除错误
    storage.setFailSet(false)
    const retryBtn = findNodes(m.root, (n) => n.type === 'button' && getText(n).includes('重试保存'))[0]
    assert.ok(retryBtn)
    retryBtn.props.onClick()
    await nextTick()

    assert.equal(notesStore.getNotesStorageError(), false)
    assert.equal(notesStore.getNotesUnsavedInMemory(), false)
    assert.equal(JSON.parse(storage.getItem(notesStore.NOTES_STORAGE_KEY)).nodes['1'].claim, '未写入磁盘的内存新版本')
    m.unmount()
  }

  // 3. 导入校验（仅规范 1-4 级编号）、不覆盖较新本地笔记、存储失败不显示无条件成功、version 1 兼容
  {
    assert.equal(notesStore.isValidNodeCode('1'), true)
    assert.equal(notesStore.isValidNodeCode('1-4'), true)
    assert.equal(notesStore.isValidNodeCode('2-3-1'), true)
    assert.equal(notesStore.isValidNodeCode('4-4-4-4'), true)
    for (const bad of ['', '0', '5', '1-5', '1-0', '1-2-3-4-1', '$-1', '1-', '-1', ' 1', 'abc', '__proto__']) {
      assert.equal(notesStore.isValidNodeCode(bad), false, `expected invalid: ${bad}`)
      const payload = JSON.stringify({
        version: 1,
        nodes: {
          [bad]: {
            claim: 'bad',
            source: '',
            question: '',
            readings: {},
            updatedAt: '2026-11-14T12:00:00.000Z'
          }
        }
      })
      assert.equal(notesStore.parseNotesImport(payload), null, `expected parseNotesImport reject: ${bad}`)
    }

    // 既有 version 1 格式兼容
    const v1CompatPayload = JSON.stringify({
      version: 1,
      nodes: {
        '1-2-3-4': {
          claim: 'v1 兼容笔记',
          source: '出处',
          question: '问题',
          readings: {
            'src-1': { original: '原文', interpretation: '解释' }
          },
          updatedAt: '2026-11-14T12:00:00.000Z'
        }
      }
    })
    const parsedV1 = notesStore.parseNotesImport(v1CompatPayload)
    assert.ok(parsedV1)
    assert.equal(parsedV1.nodes['1-2-3-4'].claim, 'v1 兼容笔记')

    // 准备本地较新笔记（1）与较旧笔记（2）
    storage.clear()
    const localInit = {
      version: 1,
      nodes: {
        '1': {
          claim: '本地较新笔记',
          source: '',
          question: '',
          readings: {},
          updatedAt: '2026-11-14T12:00:00.000Z'
        },
        '2': {
          claim: '本地较旧笔记',
          source: '',
          question: '',
          readings: {},
          updatedAt: '2026-11-14T08:00:00.000Z'
        }
      }
    }
    notesStore.reloadExternalNotes()
    notesStore.saveNotes(localInit)

    const m = mountNotes('1')
    await nextTick()
    const fileInputs = findNodes(m.root, (n) => n.type === 'input' && n.props.type === 'file')
    assert.equal(fileInputs.length, 1)

    const importPayload = JSON.stringify({
      version: 1,
      nodes: {
        '1': {
          claim: '导入的旧版本',
          source: '',
          question: '',
          readings: {},
          updatedAt: '2026-11-14T10:00:00.000Z'
        },
        '2': {
          claim: '导入的新版本',
          source: '',
          question: '',
          readings: {},
          updatedAt: '2026-11-14T11:00:00.000Z'
        },
        '3-1': {
          claim: '新增节点笔记',
          source: '',
          question: '',
          readings: {},
          updatedAt: '2026-11-14T09:00:00.000Z'
        }
      }
    })

    // 3a. 正常存储下导入：1 不被覆盖，2 与 3-1 导入
    await fileInputs[0].props.onChange({
      target: {
        files: [{ text: async () => importPayload }],
        value: 'notes.json'
      }
    })
    await nextTick()

    const afterImport = JSON.parse(storage.getItem(notesStore.NOTES_STORAGE_KEY))
    assert.equal(afterImport.nodes['1'].claim, '本地较新笔记')
    assert.equal(afterImport.nodes['2'].claim, '导入的新版本')
    assert.equal(afterImport.nodes['3-1'].claim, '新增节点笔记')
    const msgOk = getText(findNodes(m.root, (n) => n.props.class && String(n.props.class).includes('notes_import_result'))[0])
    assert.ok(msgOk.includes('已导入 2 条') && msgOk.includes('跳过 1 条'))

    // 3b. 存储失败时导入：绝不能显示无条件成功，必须提示存储失败
    storage.setFailSet(true)
    const newerPayload = JSON.stringify({
      version: 1,
      nodes: {
        '4': {
          claim: '存储失败时导入的笔记',
          source: '',
          question: '',
          readings: {},
          updatedAt: '2026-11-14T13:00:00.000Z'
        }
      }
    })
    await fileInputs[0].props.onChange({
      target: {
        files: [{ text: async () => newerPayload }],
        value: 'notes2.json'
      }
    })
    await nextTick()

    const importMsgNode = findNodes(m.root, (n) => n.props.class && String(n.props.class).includes('notes_import_result'))[0]
    const msgFail = getText(importMsgNode)
    assert.ok(msgFail.includes('写入浏览器存储失败'))
    assert.equal(notesStore.getNotesStorageError(), true)
    assert.equal(notesStore.getNotesUnsavedInMemory(), true)

    // 3c. 非法编号文件在组件导入时被拒绝
    storage.setFailSet(false)
    await fileInputs[0].props.onChange({
      target: {
        files: [
          {
            text: async () =>
              JSON.stringify({
                version: 1,
                nodes: {
                  '9-9': {
                    claim: '非法',
                    source: '',
                    question: '',
                    readings: {},
                    updatedAt: '2026-11-14T13:00:00.000Z'
                  }
                }
              })
          }
        ],
        value: 'bad.json'
      }
    })
    await nextTick()
    const badMsg = getText(findNodes(m.root, (n) => n.props.class && String(n.props.class).includes('notes_import_result'))[0])
    assert.ok(badMsg.includes('导入失败'))
    m.unmount()
  }

  // 4. 清空失败时切页签重挂载不复活旧磁盘笔记；损坏存储点击重试读取可恢复
  {
    const diskState = {
      version: 1,
      nodes: {
        '1': {
          claim: '磁盘旧笔记',
          source: '',
          question: '',
          readings: {},
          updatedAt: '2026-11-14T10:00:00.000Z'
        }
      }
    }
    storage.clear()
    storage.setFailSet(false)
    storage.setItem(notesStore.NOTES_STORAGE_KEY, JSON.stringify(diskState))
    notesStore.reloadExternalNotes()
    notesStore.saveNotes(diskState)

    let m = mountNotes('1')
    await nextTick()
    storage.setFailSet(true)
    const clearBtn = findNodes(m.root, (n) => n.type === 'button' && getText(n).includes('清空本节点笔记'))[0]
    clearBtn.props.onClick()
    await nextTick()
    assert.equal(notesStore.getNotesUnsavedInMemory(), true)
    m.unmount()

    m = mountNotes('1')
    await nextTick()
    const remountedTextareas = findNodes(m.root, (n) => n.type === 'textarea')
    assert.equal(remountedTextareas[0].value, '')
    assert.equal(notesStore.getNotesStorageError(), true)
    storage.setFailSet(false)
    const retrySaveBtn = findNodes(m.root, (n) => n.type === 'button' && getText(n).includes('重试保存'))[0]
    retrySaveBtn.props.onClick()
    await nextTick()
    assert.equal(notesStore.getNotesStorageError(), false)
    assert.equal(JSON.parse(storage.getItem(notesStore.NOTES_STORAGE_KEY)).nodes['1'], undefined)
    m.unmount()

    // 损坏数据读取失败 -> 恢复存储后点击重试读取
    storage.setItem(notesStore.NOTES_STORAGE_KEY, '{corrupted')
    m = mountNotes('1')
    await nextTick()
    assert.equal(notesStore.getNotesStorageError(), true)
    assert.equal(notesStore.getNotesUnsavedInMemory(), false)
    storage.setItem(notesStore.NOTES_STORAGE_KEY, JSON.stringify(diskState))
    const retryLoadBtn = findNodes(m.root, (n) => n.type === 'button' && getText(n).includes('重试读取'))[0]
    assert.ok(retryLoadBtn)
    retryLoadBtn.props.onClick()
    await nextTick()
    assert.equal(notesStore.getNotesStorageError(), false)
    const recoveredTextareas = findNodes(m.root, (n) => n.type === 'textarea')
    assert.equal(recoveredTextareas[0].value, '磁盘旧笔记')
    m.unmount()
  }

  // Independent module instances model separate tabs, sharing only browser storage.
  {
    storage.clear()
    const a = loadTsModule('src/utils/notesStore.ts')
    const b = loadTsModule('src/utils/notesStore.ts')
    const note = (claim) => ({ claim, source: '', question: '', readings: {}, updatedAt: '2026-11-15T10:00:00Z' })
    const sa = a.loadNotes()
    const sb = b.loadNotes()
    sa.nodes['1'] = note('A')
    assert.equal(a.saveNotes(sa), true)
    sb.nodes['2'] = note('B')
    assert.equal(b.saveNotes(sb), true)
    assert.deepEqual(Object.keys(b.getCurrentNotes().nodes).sort(), ['1', '2'])
    // Adopting the merged state must keep the other tab's node on later saves.
    const nextB = b.getCurrentNotes()
    nextB.nodes['2'].claim = 'B2'
    assert.equal(b.saveNotes(nextB), true)
    assert.equal(JSON.parse(storage.getItem(a.NOTES_STORAGE_KEY)).nodes['1'].claim, 'A')

    const localA = a.loadNotes()
    const localB = b.loadNotes()
    localA.nodes['1'].claim = 'external edit'
    assert.equal(a.saveNotes(localA), true)
    localB.nodes['1'].claim = 'local draft'
    const diskBeforeConflict = storage.getItem(a.NOTES_STORAGE_KEY)
    assert.equal(b.saveNotes(localB), false)
    assert.deepEqual(b.notesConflictCodes.value, ['1'])
    assert.equal(storage.getItem(a.NOTES_STORAGE_KEY), diskBeforeConflict)
    assert.equal(b.loadNotes().nodes['1'].claim, 'local draft')
    assert.equal(b.reloadExternalNotes().nodes['1'].claim, 'external edit')

    // Explicit deletion is merged with unrelated external edits, but conflicts
    // when the deleted node was itself edited in another tab.
    const deleteA = a.loadNotes()
    const editB = b.loadNotes()
    delete deleteA.nodes['1']
    editB.nodes['2'].claim = 'unrelated edit'
    assert.equal(b.saveNotes(editB), true)
    assert.equal(a.saveNotes(deleteA), true)
    assert.equal(a.getCurrentNotes().nodes['1'], undefined)
    assert.equal(a.getCurrentNotes().nodes['2'].claim, 'unrelated edit')
    const deleteB = b.loadNotes()
    const editA = a.loadNotes()
    delete deleteB.nodes['2']
    editA.nodes['2'].claim = 'changed before delete'
    assert.equal(a.saveNotes(editA), true)
    assert.equal(b.saveNotes(deleteB), false)
    assert.equal(JSON.parse(storage.getItem(a.NOTES_STORAGE_KEY)).nodes['2'].claim, 'changed before delete')

    // Parse/read failure must never turn an empty fallback into a writable base.
    storage.setItem(a.NOTES_STORAGE_KEY, '{broken-original')
    const broken = loadTsModule('src/utils/notesStore.ts')
    const draft = broken.loadNotes()
    draft.nodes['3'] = note('recovery draft')
    assert.equal(broken.saveNotes(draft), false)
    assert.equal(storage.getItem(a.NOTES_STORAGE_KEY), '{broken-original')
    assert.equal(broken.notesRawBackup.value, '{broken-original')
    storage.setItem(a.NOTES_STORAGE_KEY, JSON.stringify({ version: 1, nodes: { '1': note('restored') } }))
    assert.equal(broken.saveNotes(draft), false, 'restored disk still requires explicit recovery')
    assert.equal(broken.getCurrentNotes().nodes['3'].claim, 'recovery draft')
    assert.equal(broken.retryNotesAfterReadFailure(draft), true)
    assert.equal(broken.getCurrentNotes().nodes['1'].claim, 'restored')
    assert.equal(broken.getCurrentNotes().nodes['3'].claim, 'recovery draft')
    storage.setFailGet(true)
    const unread = loadTsModule('src/utils/notesStore.ts')
    const unreadDraft = unread.loadNotes()
    storage.setFailGet(false)
    unreadDraft.nodes['4'] = note('new draft')
    assert.equal(unread.saveNotes(unreadDraft), false)
    assert.equal(JSON.parse(storage.getItem(a.NOTES_STORAGE_KEY)).nodes['1'].claim, 'restored')
    assert.equal(unread.retryNotesAfterReadFailure(unreadDraft), true)
    assert.equal(unread.getCurrentNotes().nodes['4'].claim, 'new draft')
    assert.equal(unread.getCurrentNotes().nodes['1'].claim, 'restored')

    // Initial unread data may not be treated as a base for replacing a node.
    storage.setFailGet(true)
    const unknown = loadTsModule('src/utils/notesStore.ts')
    const unknownDraft = unknown.loadNotes()
    unknownDraft.nodes['1'] = note('unread local draft')
    assert.equal(unknown.saveNotes(unknownDraft), false)
    storage.setFailGet(false)
    const original = storage.getItem(a.NOTES_STORAGE_KEY)
    assert.equal(unknown.retryNotesAfterReadFailure(unknownDraft), false)
    assert.deepEqual(unknown.notesConflictCodes.value, ['1'])
    assert.equal(storage.getItem(a.NOTES_STORAGE_KEY), original)
    assert.equal(unknown.getCurrentNotes().nodes['1'].claim, 'unread local draft')

    // A transient read failure after a known baseline retains that baseline.
    const known = loadTsModule('src/utils/notesStore.ts')
    const knownDraft = known.loadNotes()
    knownDraft.nodes['1'].claim = 'changed against known baseline'
    storage.setFailGet(true)
    assert.equal(known.saveNotes(knownDraft), false)
    storage.setFailGet(false)
    assert.equal(known.retryNotesAfterReadFailure(knownDraft), true)
    assert.equal(known.getCurrentNotes().nodes['1'].claim, 'changed against known baseline')
    storage.setFailGet(true)
    const emptyRecovery = loadTsModule('src/utils/notesStore.ts')
    const emptyDraft = emptyRecovery.loadNotes()
    emptyDraft.nodes['3'] = note('survives empty recovery')
    assert.equal(emptyRecovery.saveNotes(emptyDraft), false)
    storage.setFailGet(false)
    storage.removeItem(a.NOTES_STORAGE_KEY)
    assert.equal(emptyRecovery.retryNotesAfterReadFailure(emptyDraft), true)
    assert.equal(emptyRecovery.getCurrentNotes().nodes['3'].claim, 'survives empty recovery')
  }

  {
    const note = (claim) => ({ claim, source: '', question: '', readings: {}, updatedAt: '2026-11-15T10:00:00Z' })
    const disk = { version: 1, nodes: { '1': note('known UI base') } }
    storage.setItem(notesStore.NOTES_STORAGE_KEY, JSON.stringify(disk))
    notesStore.reloadExternalNotes()
    const m = mountNotes('1')
    await nextTick()
    const textarea = findNodes(m.root, (n) => n.type === 'textarea')[0]
    textarea.props['onUpdate:modelValue']('UI recovery draft')
    textarea.props.onInput({})
    storage.setFailGet(true)
    env.windowMock.dispatchEvent('pagehide', {})
    await nextTick()
    assert.equal(notesStore.notesReadBlocked.value, true)
    storage.setFailGet(false)
    disk.nodes['2'] = note('external unrelated addition')
    storage.setItem(notesStore.NOTES_STORAGE_KEY, JSON.stringify(disk))
    const retry = findNodes(m.root, (n) => n.type === 'button' && getText(n).includes('重试读取并保存草稿'))[0]
    assert.ok(retry)
    retry.props.onClick()
    await nextTick()
    assert.equal(notesStore.notesReadBlocked.value, false)
    assert.equal(notesStore.getCurrentNotes().nodes['1'].claim, 'UI recovery draft')
    assert.equal(notesStore.getCurrentNotes().nodes['2'].claim, 'external unrelated addition')
    assert.equal(findNodes(m.root, (n) => n.type === 'textarea')[0].value, 'UI recovery draft')
    m.unmount()
  }

  // Recovery UI preserves drafts when confirmation is cancelled and exports
  // damaged raw bytes separately from the editable JSON draft.
  {
    const note = (claim) => ({ claim, source: '', question: '', readings: {}, updatedAt: '2026-11-15T10:00:00Z' })
    storage.setItem(notesStore.NOTES_STORAGE_KEY, JSON.stringify({ version: 1, nodes: { '1': note('baseline') } }))
    notesStore.reloadExternalNotes()
    const m = mountNotes('1')
    await nextTick()
    const textarea = findNodes(m.root, (n) => n.type === 'textarea')[0]
    textarea.props['onUpdate:modelValue']('local conflict draft')
    textarea.props.onInput({})
    storage.setItem(notesStore.NOTES_STORAGE_KEY, JSON.stringify({ version: 1, nodes: { '1': note('external version') } }))
    env.windowMock.dispatchEvent('pagehide', {})
    await nextTick()
    assert.ok(getText(m.root).includes('其它标签页已修改节点'))
    let recover = findNodes(m.root, (n) => n.type === 'button' && getText(n).includes('读取外部版本'))[0]
    env.setConfirmResult(false)
    recover.focus(); recover.props.onClick({ currentTarget: recover })
    assert.ok(document.activeElement === recover, 'cancel external recovery retains initiating button')
    assert.equal(notesStore.getCurrentNotes().nodes['1'].claim, 'local conflict draft')
    const exportBtn = findNodes(m.root, (n) => n.type === 'button' && getText(n).includes('导出 JSON'))[0]
    exportBtn.props.onClick()
    assert.ok(env.blobContents.at(-1).content.includes('local conflict draft'))
    env.setConfirmResult(true)
    recover.props.onClick({ currentTarget: recover })
    assert.ok(document.activeElement === findNodes(m.root, n => n.props.class === 'node_notes_root')[0], 'external recovery transfers focus before removing error actions')
    await nextTick()
    assert.equal(findNodes(m.root, (n) => n.type === 'textarea')[0].value, 'external version')
    m.unmount()

    storage.setItem(notesStore.NOTES_STORAGE_KEY, '{original damaged bytes')
    const damaged = mountNotes('1')
    await nextTick()
    const rawExport = findNodes(damaged.root, (n) => n.type === 'button' && getText(n).includes('下载原始存储备份'))[0]
    assert.ok(rawExport)
    rawExport.props.onClick()
    assert.equal(env.blobContents.at(-1).content, '{original damaged bytes')
    await nextTick()
    const initialize = findNodes(damaged.root, (n) => n.type === 'button' && getText(n).includes('建立空笔记存储'))[0]
    assert.ok(initialize)
    env.setConfirmResult(false)
    initialize.focus(); initialize.props.onClick({ currentTarget: initialize })
    assert.ok(document.activeElement === initialize, 'cancel initialization retains initiating button')
    assert.equal(storage.getItem(notesStore.NOTES_STORAGE_KEY), '{original damaged bytes')
    env.setConfirmResult(true)
    // A repaired external value cannot be replaced by this recovery action.
    const repaired = JSON.stringify({ version: 1, nodes: { '2': note('repaired elsewhere') } })
    storage.setItem(notesStore.NOTES_STORAGE_KEY, repaired)
    initialize.props.onClick()
    assert.equal(storage.getItem(notesStore.NOTES_STORAGE_KEY), repaired)
    assert.equal(notesStore.notesRawBackup.value, null)
    // A different damaged value refreshes backup state without dropping drafts.
    storage.setItem(notesStore.NOTES_STORAGE_KEY, '{new damaged bytes')
    notesStore.loadNotes()
    await nextTick()
    rawExport.props.onClick()
    assert.equal(env.blobContents.at(-1).content, '{new damaged bytes')
    await nextTick()
    const freshInitialize = findNodes(damaged.root, (n) => n.type === 'button' && getText(n).includes('建立空笔记存储'))[0]
    storage.setItem(notesStore.NOTES_STORAGE_KEY, '{third damaged bytes')
    freshInitialize.props.onClick()
    await nextTick()
    assert.equal(notesStore.notesRawBackup.value, '{third damaged bytes')
    assert.equal(findNodes(damaged.root, (n) => n.type === 'button' && getText(n).includes('建立空笔记存储')).length, 0)
    rawExport.props.onClick()
    assert.equal(env.blobContents.at(-1).content, '{third damaged bytes')
    await nextTick()
    const focusedInitialize = findNodes(damaged.root, (n) => n.type === 'button' && getText(n).includes('建立空笔记存储'))[0]
    focusedInitialize.focus(); focusedInitialize.props.onClick({ currentTarget: focusedInitialize })
    assert.ok(document.activeElement === findNodes(damaged.root, n => n.props.class === 'node_notes_root')[0], 'initialization hands focus to persistent region')
    await nextTick()
    assert.deepEqual(JSON.parse(storage.getItem(notesStore.NOTES_STORAGE_KEY)), { version: 1, nodes: {} })
    assert.equal(notesStore.notesReadBlocked.value, false)
    // The UI can now import a valid backup without editing browser internals.
    const fileInput = findNodes(damaged.root, (n) => n.type === 'input' && n.props.type === 'file')[0]
    await fileInput.props.onChange({ target: { files: [{ text: async () => repaired }], value: 'backup.json' } })
    assert.equal(JSON.parse(storage.getItem(notesStore.NOTES_STORAGE_KEY)).nodes['2'].claim, 'repaired elsewhere')
    damaged.unmount()
    assert.equal(env.windowMock.listenerCount('pagehide'), 0)
    assert.equal(env.windowMock.listenerCount('beforeunload'), 0)
    assert.equal(env.documentMock.listenerCount('visibilitychange'), 0)
  }

  // Import completions belong to the live component and newest user action.
  // In particular, a disposed component must not save against the new
  // component's shared store baseline.
  {
    const note = (claim) => ({ claim, source: '', question: '', readings: {}, updatedAt: '2026-11-15T10:00:00Z' })
    const payload = (code, claim) => JSON.stringify({ version: 1, nodes: { [code]: note(claim) } })
    const seed = () => {
      storage.setItem(notesStore.NOTES_STORAGE_KEY, payload('1', 'original'))
      notesStore.reloadExternalNotes()
    }
    const beginImport = (m) => {
      let resolve, reject
      const text = new Promise((yes, no) => { resolve = yes; reject = no })
      const target = { files: [{ text: () => text }], value: 'pending.json' }
      const input = findNodes(m.root, (n) => n.type === 'input' && n.props.type === 'file')[0]
      return { resolve, reject, target, pending: input.props.onChange({ target }) }
    }
    const edit = (m, claim) => {
      const field = findNodes(m.root, (n) => n.type === 'textarea')[0]
      field.props['onUpdate:modelValue'](claim)
      field.props.onInput({})
    }

    seed()
    let old = mountNotes('1')
    await nextTick()
    let pending = beginImport(old)
    old.unmount()
    let m = mountNotes('1')
    await nextTick()
    edit(m, 'new after remount')
    env.windowMock.dispatchEvent('pagehide', {})
    pending.resolve(payload('2', 'disposed import'))
    await pending.pending
    let disk = JSON.parse(storage.getItem(notesStore.NOTES_STORAGE_KEY))
    assert.equal(disk.nodes['1'].claim, 'new after remount')
    assert.equal(disk.nodes['2'], undefined)
    assert.equal(old.emittedUpdated.length, 0, 'disposed import must not emit an update')
    m.unmount()

    seed()
    m = mountNotes('1')
    await nextTick()
    const first = beginImport(m)
    const second = beginImport(m)
    second.resolve(payload('3', 'newest chosen file'))
    await second.pending
    const afterNewest = storage.getItem(notesStore.NOTES_STORAGE_KEY)
    first.resolve(payload('2', 'older chosen file'))
    await first.pending
    assert.equal(storage.getItem(notesStore.NOTES_STORAGE_KEY), afterNewest)
    assert.equal(JSON.parse(afterNewest).nodes['3'].claim, 'newest chosen file')
    assert.equal(JSON.parse(afterNewest).nodes['2'], undefined)
    m.unmount()

    // Reusing the component for another node is allowed: import is global,
    // and completion merges the current state plus any unsaved current draft.
    seed()
    m = mountNotes('1')
    await nextTick()
    pending = beginImport(m)
    await m.setCode('2')
    edit(m, 'edited while import was reading')
    pending.resolve(payload('3', 'global imported note'))
    await pending.pending
    disk = JSON.parse(storage.getItem(notesStore.NOTES_STORAGE_KEY))
    assert.equal(disk.nodes['1'].claim, 'original')
    assert.equal(disk.nodes['2'].claim, 'edited while import was reading')
    assert.equal(disk.nodes['3'].claim, 'global imported note')
    assert.equal(findNodes(m.root, (n) => n.type === 'textarea')[0].value, 'edited while import was reading')
    m.unmount()

    seed()
    m = mountNotes('1')
    await nextTick()
    pending = beginImport(m)
    edit(m, 'draft before external recovery')
    storage.setItem(notesStore.NOTES_STORAGE_KEY, payload('1', 'external recovery'))
    env.windowMock.dispatchEvent('pagehide', {})
    await nextTick()
    env.setConfirmResult(true)
    findNodes(m.root, (n) => n.type === 'button' && getText(n).includes('读取外部版本'))[0].props.onClick()
    const recovered = storage.getItem(notesStore.NOTES_STORAGE_KEY)
    pending.resolve(payload('2', 'invalidated by recovery'))
    await pending.pending
    assert.equal(storage.getItem(notesStore.NOTES_STORAGE_KEY), recovered)
    assert.equal(notesStore.getCurrentNotes().nodes['1'].claim, 'external recovery')
    m.unmount()

    storage.setItem(notesStore.NOTES_STORAGE_KEY, '{bad-before-initialize')
    m = mountNotes('1')
    await nextTick()
    pending = beginImport(m)
    findNodes(m.root, (n) => n.type === 'button' && getText(n).includes('下载原始存储备份'))[0].props.onClick()
    await nextTick()
    findNodes(m.root, (n) => n.type === 'button' && getText(n).includes('建立空笔记存储'))[0].props.onClick()
    pending.resolve(payload('2', 'invalidated by initialization'))
    await pending.pending
    assert.deepEqual(JSON.parse(storage.getItem(notesStore.NOTES_STORAGE_KEY)), { version: 1, nodes: {} })
    m.unmount()

    seed()
    m = mountNotes('1')
    await nextTick()
    pending = beginImport(m)
    findNodes(m.root, (n) => n.type === 'button' && getText(n).includes('清空本节点笔记'))[0].props.onClick()
    const afterClear = storage.getItem(notesStore.NOTES_STORAGE_KEY)
    pending.resolve(payload('1', 'must not resurrect cleared note'))
    await pending.pending
    assert.equal(storage.getItem(notesStore.NOTES_STORAGE_KEY), afterClear)
    m.unmount()

    storage.setItem(notesStore.NOTES_STORAGE_KEY, '{bad-before-read-retry')
    m = mountNotes('1')
    await nextTick()
    pending = beginImport(m)
    storage.setItem(notesStore.NOTES_STORAGE_KEY, payload('1', 'restored before read retry'))
    findNodes(m.root, (n) => n.type === 'button' && getText(n).includes('重试读取'))[0].props.onClick()
    const afterReadRetry = storage.getItem(notesStore.NOTES_STORAGE_KEY)
    pending.reject(new Error('stale failed file read'))
    await pending.pending
    assert.equal(storage.getItem(notesStore.NOTES_STORAGE_KEY), afterReadRetry)
    assert.equal(getText(m.root).includes('导入失败：读取文件出错'), false)
    m.unmount()
  }

  // Explicit conflict resolutions are tied to private snapshots. Public preview
  // objects cannot mutate the external version used by the merge.
  {
    const note = claim => ({ claim, source: '', question: '', readings: {}, updatedAt: '2026-11-15T10:00:00Z' })
    const fixture = () => {
      const store = loadTsModule('src/utils/notesStore.ts')
      const base = { version: 1, nodes: { '1': note('base 1'), '2': note('base 2'), '3': note('base 3') } }
      storage.setItem(store.NOTES_STORAGE_KEY, JSON.stringify(base))
      const local = store.loadNotes()
      local.nodes['1'].claim = 'local 1'
      local.nodes['2'].claim = 'local 2'
      local.nodes['3'].claim = 'unconflicted local 3'
      const external = structuredClone(base)
      external.nodes['1'].claim = 'external 1'
      external.nodes['2'].claim = 'external 2'
      external.nodes['4'] = note('external only 4')
      storage.setItem(store.NOTES_STORAGE_KEY, JSON.stringify(external))
      assert.equal(store.saveNotes(local), false)
      return { store, local, external, preview: store.previewNotesConflicts(local) }
    }
    let f = fixture()
    assert.deepEqual(f.preview.conflicts.map(item => item.code), ['1', '2'])
    f.preview.conflicts[1].external.claim = 'UI mutation must not reach private snapshot'
    let result = f.store.resolveNotesConflicts(f.local, f.preview.id, { '1': 'local', '2': 'external' })
    assert.equal(result.status, 'saved')
    assert.equal(result.state.nodes['1'].claim, 'local 1')
    assert.equal(result.state.nodes['2'].claim, 'external 2')
    assert.equal(result.state.nodes['3'].claim, 'unconflicted local 3')
    assert.equal(result.state.nodes['4'].claim, 'external only 4')
    assert.equal(f.store.getCurrentNotes().nodes['2'].claim, 'external 2')

    f = fixture()
    let before = storage.getItem(f.store.NOTES_STORAGE_KEY)
    result = f.store.resolveNotesConflicts(f.local, f.preview.id, { '1': 'local' })
    assert.equal(result.status, 'conflict', 'all conflicts need an explicit choice')
    assert.equal(storage.getItem(f.store.NOTES_STORAGE_KEY), before)
    f.external.nodes['2'].claim = 'external 2 changed after preview'
    f.external.nodes['3'].claim = 'new third conflict'
    storage.setItem(f.store.NOTES_STORAGE_KEY, JSON.stringify(f.external))
    before = storage.getItem(f.store.NOTES_STORAGE_KEY)
    result = f.store.resolveNotesConflicts(f.local, f.preview.id, { '1': 'local', '2': 'external' })
    assert.equal(result.status, 'stale')
    assert.deepEqual(result.preview.conflicts.map(item => item.code), ['1', '2', '3'])
    assert.equal(storage.getItem(f.store.NOTES_STORAGE_KEY), before)
    assert.equal(f.store.getCurrentNotes().nodes['2'].claim, 'local 2', 'refresh preserves local draft')

    f = fixture()
    f.local.nodes['1'].claim = 'local changed after preview'
    result = f.store.resolveNotesConflicts(f.local, f.preview.id, { '1': 'external', '2': 'external' })
    assert.equal(result.status, 'stale')
    assert.equal(result.preview.conflicts[0].local.claim, 'local changed after preview')

    f = fixture()
    delete f.local.nodes['1']
    delete f.external.nodes['2']
    storage.setItem(f.store.NOTES_STORAGE_KEY, JSON.stringify(f.external))
    assert.equal(f.store.saveNotes(f.local), false)
    let preview = f.store.previewNotesConflicts(f.local)
    assert.equal(preview.conflicts.find(item => item.code === '1').local, null)
    assert.equal(preview.conflicts.find(item => item.code === '2').external, null)
    result = f.store.resolveNotesConflicts(f.local, preview.id, { '1': 'local', '2': 'external' })
    assert.equal(result.status, 'saved')
    assert.equal(result.state.nodes['1'], undefined)
    assert.equal(result.state.nodes['2'], undefined)
    assert.equal(result.state.nodes['3'].claim, 'unconflicted local 3')

    f = fixture()
    storage.setFailSet(true)
    result = f.store.resolveNotesConflicts(f.local, f.preview.id, { '1': 'external', '2': 'local' })
    assert.equal(result.status, 'storage-error')
    assert.equal(f.store.getCurrentNotes().nodes['1'].claim, 'local 1', 'failed write cannot discard local choice')
    storage.setFailSet(false)
    result = f.store.resolveNotesConflicts(f.local, f.preview.id, { '1': 'external', '2': 'local' })
    assert.equal(result.status, 'saved')
    assert.equal(result.state.nodes['1'].claim, 'external 1')

    f = fixture()
    f.store.loadNotes() // even a memory-preserving remount invalidates prior choices
    result = f.store.resolveNotesConflicts(f.local, f.preview.id, { '1': 'local', '2': 'local' })
    assert.equal(result.status, 'stale')
    preview = result.preview
    f.store.reloadExternalNotes()
    assert.equal(f.store.resolveNotesConflicts(f.local, preview.id, { '1': 'local', '2': 'local' }).status, 'stale')
  }

  // Mounted review: no default choice, full text comparison, stale choices
  // cleared, mixed per-node choices preserve unrelated local/external notes.
  {
    const note = claim => ({ claim, source: '', question: '', readings: {}, updatedAt: '2026-11-15T10:00:00Z' })
    const base = { version: 1, nodes: { '1': note('base 1'), '2': note('base 2'), '3': note('base 3') } }
    storage.setItem(notesStore.NOTES_STORAGE_KEY, JSON.stringify(base))
    notesStore.reloadExternalNotes()
    const local = notesStore.loadNotes()
    local.nodes['1'].claim = '<img src=x onerror=alert(1)> local full text'
    local.nodes['2'].claim = 'local 2'
    local.nodes['3'].claim = 'unconflicted draft 3'
    const external = structuredClone(base)
    external.nodes['1'].claim = 'external 1'
    external.nodes['2'].claim = 'external 2'
    external.nodes['4'] = note('external only 4')
    storage.setItem(notesStore.NOTES_STORAGE_KEY, JSON.stringify(external))
    assert.equal(notesStore.saveNotes(local), false)
    const m = mountNotes('1')
    await nextTick()
    const open = () => findNodes(m.root, n => n.type === 'button' && getText(n).includes('逐节点对比冲突'))[0].props.onClick()
    const apply = () => findNodes(m.root, n => n.type === 'button' && String(n.props.class).includes('notes_conflict_apply'))[0]
    const radios = () => findNodes(m.root, n => n.type === 'input' && n.props.type === 'radio')
    const choose = (code, value) => radios().find(n => n.props.name.endsWith(`-${code}`) && n.props.value === value).props.onChange()
    open(); await nextTick(); await nextTick()
    assert.equal(radios().length, 4)
    assert.equal(Boolean(apply().props.disabled), true)
    assert.equal(radios().some(n => n.props.checked), false)
    assert.ok(getText(m.root).includes('<img src=x onerror=alert(1)> local full text'))
    assert.equal(findNodes(m.root, n => n.type === 'img').length, 0, 'comparison renders text, not HTML')
    choose('1', 'local'); await nextTick()
    assert.equal(Boolean(apply().props.disabled), true)
    choose('2', 'external'); await nextTick()
    external.nodes['2'].claim = 'newer external 2'
    storage.setItem(notesStore.NOTES_STORAGE_KEY, JSON.stringify(external))
    const before = storage.getItem(notesStore.NOTES_STORAGE_KEY)
    const conflictOutside = { label: 'external during conflict' }; document.activeElement = conflictOutside
    const staleApply = apply(); staleApply.props.onClick({ currentTarget: staleApply }); await nextTick(); await nextTick()
    assert.ok(document.activeElement === conflictOutside, 'stale conflict application does not steal external focus')
    assert.equal(storage.getItem(notesStore.NOTES_STORAGE_KEY), before)
    assert.equal(radios().some(n => n.props.checked), false)
    assert.ok(getText(m.root).includes('对比已刷新'))
    assert.ok(getText(m.root).includes('newer external 2'))
    choose('1', 'local'); choose('2', 'external'); await nextTick()
    // Write failure keeps both selections and the full original local draft.
    storage.setFailSet(true)
    let focusApply = apply(); focusApply.focus(); focusApply.props.onClick({ currentTarget: focusApply }); await nextTick()
    const focusRoot = findNodes(m.root, n => n.props.class === 'node_notes_root')[0]
    assert.ok(document.activeElement === focusRoot, 'failed conflict save retains stable region focus')
    assert.equal(radios().filter(n => n.props.checked).length, 2)
    assert.equal(notesStore.getCurrentNotes().nodes['2'].claim, 'local 2')
    storage.setFailSet(false)
    focusApply = apply(); focusApply.focus(); focusApply.props.onClick({ currentTarget: focusApply }); await nextTick()
    assert.ok(document.activeElement === focusRoot, 'successful conflict application retains region focus')
    const disk = JSON.parse(storage.getItem(notesStore.NOTES_STORAGE_KEY))
    assert.equal(disk.nodes['1'].claim, local.nodes['1'].claim)
    assert.equal(disk.nodes['2'].claim, 'newer external 2')
    assert.equal(disk.nodes['3'].claim, 'unconflicted draft 3')
    assert.equal(disk.nodes['4'].claim, 'external only 4')
    assert.equal(radios().length, 0)
    // Editing while reviewing invalidates previous choices before another save.
    const field = findNodes(m.root, n => n.type === 'textarea')[0]
    field.props['onUpdate:modelValue']('second local conflict')
    field.props.onInput({})
    disk.nodes['1'].claim = 'second external conflict'
    storage.setItem(notesStore.NOTES_STORAGE_KEY, JSON.stringify(disk))
    env.windowMock.dispatchEvent('pagehide', {})
    await nextTick()
    open(); await nextTick(); await nextTick()
    choose('1', 'local'); await nextTick()
    field.props['onUpdate:modelValue']('edited while comparison was open')
    field.props.onInput({})
    env.windowMock.dispatchEvent('pagehide', {})
    await nextTick(); await nextTick(); await nextTick()
    assert.equal(radios().some(n => n.props.checked), false)
    assert.ok(getText(m.root).includes('edited while comparison was open'))
    // A read failure must not create a reactive preview-refresh loop.
    choose('1', 'local'); await nextTick()
    storage.setFailGet(true)
    apply().props.onClick(); await nextTick(); await nextTick(); await nextTick()
    assert.equal(radios().length, 0)
    assert.equal(notesStore.notesReadBlocked.value, true)
    storage.setFailGet(false)
    findNodes(m.root, n => n.type === 'button' && getText(n).includes('重试读取并保存草稿'))[0].props.onClick()
    await nextTick(); await nextTick(); await nextTick()
    assert.equal(notesStore.notesReadBlocked.value, false)
    assert.equal(radios().some(n => n.props.checked), false)
    m.unmount()
  }

  // Successful ordinary save must retire a review, not merely hide it until
  // a later unrelated storage error makes an empty old review visible again.
  {
    const note = claim => ({ claim, source: '', question: '', readings: {}, updatedAt: '2026-11-15T10:00:00Z' })
    storage.setItem(notesStore.NOTES_STORAGE_KEY, JSON.stringify({ version: 1, nodes: { '1': note('base') } }))
    notesStore.reloadExternalNotes()
    const local = notesStore.loadNotes()
    local.nodes['1'].claim = 'local conflict'
    storage.setItem(notesStore.NOTES_STORAGE_KEY, JSON.stringify({ version: 1, nodes: { '1': note('external conflict') } }))
    assert.equal(notesStore.saveNotes(local), false)
    const m = mountNotes('1')
    await nextTick()
    findNodes(m.root, n => n.type === 'button' && getText(n).includes('逐节点对比冲突'))[0].props.onClick()
    await nextTick(); await nextTick()
    assert.equal(findNodes(m.root, n => n.props.class === 'notes_conflict_review').length, 1)
    const field = findNodes(m.root, n => n.type === 'textarea')[0]
    field.props['onUpdate:modelValue']('external conflict')
    field.props.onInput({})
    env.windowMock.dispatchEvent('pagehide', {})
    await nextTick(); await nextTick(); await nextTick()
    assert.equal(notesStore.notesStorageError.value, false)
    storage.setFailSet(true)
    field.props['onUpdate:modelValue']('later unrelated draft')
    field.props.onInput({})
    env.windowMock.dispatchEvent('pagehide', {})
    await nextTick(); await nextTick(); await nextTick()
    assert.equal(notesStore.notesStorageError.value, true)
    assert.equal(notesStore.notesConflictCodes.value.length, 0)
    assert.equal(findNodes(m.root, n => n.props.class === 'notes_conflict_review').length, 0)
    storage.setFailSet(false)
    findNodes(m.root, n => n.type === 'button' && getText(n).includes('重试保存'))[0].props.onClick()
    m.unmount()
  }

  // Retry after a failed save on another node must refresh the current form
  // from the full merged state before the next edit can be committed.
  {
    const note = claim => ({ claim, source: '', question: '', readings: {}, updatedAt: '2026-11-15T10:00:00Z' })
    const base = { version: 1, nodes: { '1': note('old node 1'), '2': note('old node 2') } }
    storage.setItem(notesStore.NOTES_STORAGE_KEY, JSON.stringify(base))
    notesStore.reloadExternalNotes()
    const m = mountNotes('2')
    await nextTick()
    let fields = findNodes(m.root, n => n.type === 'textarea')
    storage.setFailSet(true)
    fields[0].props['onUpdate:modelValue']('unsaved node 2')
    fields[0].props.onInput({})
    env.windowMock.dispatchEvent('pagehide', {})
    await m.setCode('1')
    fields = findNodes(m.root, n => n.type === 'textarea')
    assert.equal(fields[0].value, 'old node 1')
    storage.setFailSet(false)
    base.nodes['1'].claim = 'new external node 1'
    storage.setItem(notesStore.NOTES_STORAGE_KEY, JSON.stringify(base))
    findNodes(m.root, n => n.type === 'button' && getText(n).includes('重试保存'))[0].props.onClick()
    await nextTick()
    fields = findNodes(m.root, n => n.type === 'textarea')
    assert.equal(fields[0].value, 'new external node 1')
    fields[2].props['onUpdate:modelValue']('new local question')
    fields[2].props.onInput({})
    env.windowMock.dispatchEvent('pagehide', {})
    let disk = JSON.parse(storage.getItem(notesStore.NOTES_STORAGE_KEY))
    assert.equal(disk.nodes['1'].claim, 'new external node 1')
    assert.equal(disk.nodes['1'].question, 'new local question')
    assert.equal(disk.nodes['2'].claim, 'unsaved node 2')

    // An actual unflushed edit still takes the dirty path and is not replaced
    // by external data while retrying an earlier failed write.
    storage.setFailSet(true)
    fields[2].props['onUpdate:modelValue']('failed write question')
    fields[2].props.onInput({})
    env.windowMock.dispatchEvent('pagehide', {})
    storage.setFailSet(false)
    disk.nodes['1'].claim = 'even newer external node 1'
    storage.setItem(notesStore.NOTES_STORAGE_KEY, JSON.stringify(disk))
    fields[0].props['onUpdate:modelValue']('unflushed local claim')
    fields[0].props.onInput({})
    await nextTick()
    findNodes(m.root, n => n.type === 'button' && getText(n).includes('重试保存'))[0].props.onClick()
    await nextTick()
    assert.equal(findNodes(m.root, n => n.type === 'textarea')[0].value, 'unflushed local claim')
    assert.equal(JSON.parse(storage.getItem(notesStore.NOTES_STORAGE_KEY)).nodes['1'].claim, 'even newer external node 1')
    assert.deepEqual([...notesStore.notesConflictCodes.value], ['1'])
    m.unmount()
  }

  // Recovery focus is owned by the initiating button, never by completion.
  for (const external of [false, true]) {
    storage.setItem(notesStore.NOTES_STORAGE_KEY, JSON.stringify({ version: 1, nodes: {} }))
    notesStore.reloadExternalNotes()
    storage.setFailGet(true)
    const m = mountNotes('1'); await nextTick()
    const region = findNodes(m.root, n => n.props.class === 'node_notes_root')[0]
    const retry = () => findNodes(m.root, n => n.type === 'button' && /^重试/.test(getText(n).trim()))[0]
    let button = retry(); button.focus(); button.props.onClick({ currentTarget: button }); await nextTick()
    assert.ok(document.activeElement === region, 'failed retry has stable region focus')
    assert.equal(region.lastFocusOptions?.preventScroll, true)
    storage.setFailGet(false)
    const outside = { label: 'external focus' }
    button = retry(); if (external) document.activeElement = outside; else button.focus()
    button.props.onClick({ currentTarget: button }); await nextTick(); await nextTick()
    assert.equal(notesStore.notesStorageError.value, false)
    assert.ok(document.activeElement === (external ? outside : region), 'successful retry respects current focus owner')
    document.activeElement = outside; m.unmount(); await nextTick(); await nextTick()
    assert.ok(document.activeElement === outside, 'unmount schedules no late recovery focus')
  }

  // App protection survives editor unmount; editor flush also covers App-first listener order.
  {
    storage.setItem(notesStore.NOTES_STORAGE_KEY, JSON.stringify({ version: 1, nodes: {} }))
    notesStore.reloadExternalNotes()
    const progress = routeProgressModule ??= loadTsModule('src/utils/routeProgress.ts')
    progress.loadRouteProgress()
    const App = compileNodeNotesComponent(notesStore, 'src/App.vue')
    const app = createApp(App)
    app.component('router-view', { render: () => null })
    app.mount(createRoot())
    assert.equal(env.windowMock.listenerCount('beforeunload'), 1)
    const leave = () => {
      let prevented = false
      const event = { preventDefault() { prevented = true } }
      env.windowMock.dispatchEvent('beforeunload', event)
      return { prevented, legacy: 'returnValue' in event }
    }
    assert.deepEqual(leave(), { prevented: false, legacy: false })
    storage.setFailGet(true)
    notesStore.loadNotes()
    assert.equal(notesStore.notesReadBlocked.value, true)
    assert.deepEqual(leave(), { prevented: false, legacy: false }, 'read failure without edits never prompts')
    progress.loadRouteProgress()
    assert.equal(progress.routeProgressStorageError.value, true)
    assert.equal(progress.routeProgressHasPending.value, false)
    assert.deepEqual(leave(), { prevented: false, legacy: false }, 'progress read error without action never prompts')
    storage.setFailGet(false); notesStore.reloadExternalNotes()
    let m = mountNotes('1'); await nextTick()
    assert.equal(env.windowMock.listenerCount('beforeunload'), 2)
    const edit = text => {
      const field = findNodes(m.root, n => n.type === 'textarea')[0]
      field.props['onUpdate:modelValue'](text); field.props.onInput({})
    }
    edit('successful unload save')
    assert.deepEqual(leave(), { prevented: false, legacy: false }, 'successful synchronous flush never prompts')
    assert.equal(JSON.parse(storage.getItem(notesStore.NOTES_STORAGE_KEY)).nodes['1'].claim, 'successful unload save')
    storage.setFailSet(true); edit('unsaved unload draft')
    assert.equal(notesStore.notesUnsavedInMemory.value, false, 'App listener runs before child creates pending state')
    assert.deepEqual(leave(), { prevented: true, legacy: true }, 'child flush failure still requests native confirmation')
    assert.equal(notesStore.getCurrentNotes().nodes['1'].claim, 'unsaved unload draft')
    storage.setFailSet(false); edit('recovered new dirty draft')
    assert.equal(notesStore.notesUnsavedInMemory.value, true)
    assert.deepEqual(leave(), { prevented: false, legacy: false }, 'App flushes new dirty edit before checking old pending state')
    assert.equal(JSON.parse(storage.getItem(notesStore.NOTES_STORAGE_KEY)).nodes['1'].claim, 'recovered new dirty draft')
    storage.setFailSet(true); edit('pending across editor unmount')
    assert.deepEqual(leave(), { prevented: true, legacy: true })
    m.unmount()
    assert.equal(env.windowMock.listenerCount('beforeunload'), 1, 'App survives SPA editor unmount')
    assert.doesNotThrow(() => notesLeaveGuardModule.flushNotesBeforeLeave(), 'unmounted editor unregisters its flusher')
    assert.deepEqual(leave(), { prevented: true, legacy: true }, 'pending memory after SPA still requests confirmation')
    storage.setFailSet(false)
    assert.equal(notesStore.saveNotes(notesStore.getCurrentNotes()), true)
    assert.deepEqual(leave(), { prevented: false, legacy: false }, 'recovered persistence removes leave warning')
    const step = progress.ROUTE_STEPS_FLAT[0]
    storage.setFailSet(true)
    progress.toggleRouteStepDone(step.stage.id, step.step.code)
    assert.equal(progress.routeProgressHasPending.value, true)
    assert.equal(notesStore.notesUnsavedInMemory.value, false)
    assert.deepEqual(leave(), { prevented: true, legacy: true }, 'progress-only toggle failure requests leave confirmation')
    const pendingNotes = notesStore.getCurrentNotes()
    pendingNotes.nodes['1'].claim = 'both stores pending'
    assert.equal(notesStore.saveNotes(pendingNotes), false)
    assert.deepEqual(leave(), { prevented: true, legacy: true }, 'both pending stores request confirmation')
    storage.setFailSet(false)
    assert.equal(progress.saveRouteProgress([...progress.routeDoneIds.value]), true)
    assert.equal(progress.routeProgressHasPending.value, false)
    assert.equal(notesStore.notesUnsavedInMemory.value, true)
    assert.deepEqual(leave(), { prevented: true, legacy: true }, 'saving progress cannot release unsaved notes guard')
    assert.equal(notesStore.saveNotes(notesStore.getCurrentNotes()), true)
    assert.deepEqual(leave(), { prevented: false, legacy: false }, 'both stores saved remove confirmation')
    storage.setFailRemove(true)
    assert.equal(progress.resetRouteProgress(), false)
    assert.equal(progress.routeProgressHasPending.value, true)
    assert.deepEqual(leave(), { prevented: true, legacy: true }, 'failed reset keeps explicit pending intent protected')
    storage.setFailRemove(false)
    assert.equal(progress.saveRouteProgress([...progress.routeDoneIds.value]), true)
    assert.equal(progress.routeProgressHasPending.value, false)
    assert.deepEqual(leave(), { prevented: false, legacy: false }, 'reset retry success removes confirmation')

    app.unmount()
    assert.equal(env.windowMock.listenerCount('beforeunload'), 0, 'App teardown removes global listener')
  }

  env.restore()
  console.log('ALL NOTES REGRESSION CHECKS PASSED')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
