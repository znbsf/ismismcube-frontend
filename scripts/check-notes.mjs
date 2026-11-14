import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { compileScript, parse } from 'vue/compiler-sfc'
import { createRenderer, h, nextTick } from 'vue'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

function createStorageMock(initial = {}) {
  const map = new Map(Object.entries(initial))
  let failGet = false
  let failSet = false
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
      map.delete(key)
    },
    clear() {
      map.clear()
    },
    setFailGet(v) {
      failGet = v
    },
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
    return {
      type,
      props: {},
      children: [],
      parent: null,
      text,
      value: '',
      composing: false,
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
  return { createApp, createRoot: () => createNode('root') }
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

function compileNodeNotesComponent(notesStoreMod) {
  const sfcPath = path.join(repoRoot, 'src', 'components', 'NodeNotes.vue')
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
    if (id === '../utils/notesStore') return notesStoreMod
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

  env.restore()
  console.log('ALL NOTES REGRESSION CHECKS PASSED')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
