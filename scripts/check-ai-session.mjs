import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
import { parse, compileScript, compileStyle } from 'vue/compiler-sfc'

const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
const source = fs.readFileSync(new URL('../src/pages/ai/ai.vue', import.meta.url), 'utf8')
compileScript(parse(source).descriptor, { id: 'ai-session-check', inlineTemplate: true })
const business = compile(source.slice(source.indexOf('const connectBroadcastSocket ='), source.indexOf('onMounted(() => {')))
const editing = compile(source.slice(source.indexOf('let editFocusToken ='), source.indexOf('let scrollToBottomToken =')))
const editMounted = compile(source.slice(source.indexOf('const selectAndFocus ='), source.indexOf('let editFocusToken =')))
const startEditSource = compile(source.slice(source.indexOf('const startEdit ='), source.indexOf('const selectAndFocus =')))
const scrollBusiness = compile(source.slice(source.indexOf('let scrollToBottomToken ='), source.indexOf('const checkContentOverflow =')))
const overflowBusiness = compile(source.slice(source.indexOf('const checkContentOverflow ='), source.indexOf('const createMessage =')))
const settingsSlice = compile(source.slice(source.indexOf('let settingsFocusToken ='), source.indexOf('const startEdit =')))
const requestSource = compile(fs.readFileSync(new URL('../src/utils/jsonRequest.ts', import.meta.url), 'utf8'))
const submitConfig = compile(source.match(/^const AI_SUBMIT_TIMEOUT_MS = .+$/m)[0])
const ownerSource = compile(fs.readFileSync(new URL('../src/utils/aiTaskSession.ts', import.meta.url), 'utf8'))
const settingsSource = compile(fs.readFileSync(new URL('../src/utils/aiChatSettings.ts', import.meta.url), 'utf8'))
const streamSource = compile(fs.readFileSync(new URL('../src/utils/aiStreamStatus.ts', import.meta.url), 'utf8'))
const scrollSource = compile(fs.readFileSync(new URL('../src/utils/scrollAnimation.ts', import.meta.url), 'utf8'))
const streamBusiness = compile(source.slice(source.indexOf('const updateFragmentSpeed ='), source.indexOf('const connectBroadcastSocket =')))
const panelBusiness = compile(source.slice(source.indexOf('let panelFocusToken ='), source.indexOf('let settingsFocusToken =')))
const selectModelSource = compile(source.slice(source.indexOf('const selectModel ='), source.indexOf('let panelFocusToken =')))
const createMessageSource = compile(source.slice(source.indexOf('const createMessage ='), source.indexOf('const saveChat =')))
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const response = id => ({ ok: true, json: async () => ({ websocket_id: id }) })
const tick = async () => { for (let i = 0; i < 6; i++) await Promise.resolve() }
function fixture(motionOptions = null) {
  const timers = new Map(), frames = new Map(), requests = [], sockets = []
  let clock = 100000, frameTime = 0, frameId = 0
  class TestDate extends Date { static now() { return clock } }
  let timerId = 0, failSocket = false
  const deadlines = new Map()
  const setTimeout = (fn, delay = 0) => { const id = ++timerId; timers.set(id, fn); deadlines.set(id, clock + delay); return id }
  const clearTimeout = id => { timers.delete(id); deadlines.delete(id) }
  const requestFrame = callback => { const next = frameId++; frames.set(next, callback); return next }
  const cancelFrame = id => frames.delete(id)
  const now = () => frameTime
  const mod = { exports: {} }
  new Function('exports', 'setTimeout', 'clearTimeout', ownerSource)(mod.exports, setTimeout, clearTimeout)
  const settingsMod = { exports: {} }
  new Function('exports', settingsSource)(settingsMod.exports)
  const streamMod = { exports: {} }
  new Function('exports', streamSource)(streamMod.exports)
  const scrollMod = { exports: {} }
  new Function('exports', scrollSource)(scrollMod.exports)
  class Socket {
    constructor(url) { if (failSocket) { failSocket = false; throw Error('synthetic socket constructor failure') }; this.url = url; this.closed = false; sockets.push(this) }
    close() { this.closed = true; this.onclose?.({ code: 1000 }) }
    emit(type, event) { this[`on${type}`]?.(event) }
  }
  const fetch = (_url, init) => { const request = deferred(); requests.push({ ...request, init }); return request.promise }
  const requestMod = { exports: {} }
  new Function('exports', 'fetch', 'setTimeout', 'clearTimeout', requestSource)(requestMod.exports, fetch, setTimeout, clearTimeout)
  const makeEl = name => {
    const el = { name, focusCount: 0, focus() { this.focusCount++; document.activeElement = el } }
    return el
  }
  const document = { body: { name: 'body' }, activeElement: null, querySelector: () => null }
  document.activeElement = document.body
  const triggerEl = makeEl('settings-button')
  const firstModalEl = makeEl('close-settings')
  const lastModalEl = makeEl('save-settings')
  const externalEl = makeEl('external-input')
  const modalEl = {
    name: 'settings-modal',
    focusCount: 0,
    focus() { this.focusCount++; document.activeElement = modalEl },
    contains(el) { return el === modalEl || el === firstModalEl || el === lastModalEl },
    querySelectorAll() { return [firstModalEl, lastModalEl] }
  }
  const motionListeners = new Set(), removedMotionListeners = []
  const media = motionOptions ? { matches: Boolean(motionOptions.reduced) } : null
  if (media) {
    const add = callback => motionListeners.add(callback)
    const remove = callback => { motionListeners.delete(callback); removedMotionListeners.push(callback) }
    if (motionOptions.legacy) { media.addListener = add; media.removeListener = remove }
    else { media.addEventListener = (_event, callback) => add(callback); media.removeEventListener = (_event, callback) => remove(callback) }
  }
  const matchMedia = media ? () => { if (motionOptions.throw) throw Error('unavailable media API'); return media } : undefined
  const api = new Function('fetchJsonWithTimeout', 'JsonRequestTimeoutError', 'createAiTaskOwner', 'createAiChatSettings', 'createAiStreamStatus', 'createScrollAnimationOwner', 'requestFrame', 'cancelFrame', 'now', 'fetch', 'WebSocket', 'setTimeout', 'clearTimeout', 'document', 'triggerEl', 'modalEl', 'Date', 'matchMedia', `
    ${submitConfig}
    const ref=value=>({value}),reactive=value=>value;let pageDisposed=false,panelScrollTimer=null;
    const taskOwner=createAiTaskOwner(),broadcastOwner=createAiTaskOwner(),scrollOwner=createScrollAnimationOwner({requestFrame,cancelFrame,now,isActive:()=>!pageDisposed}),pageController=new AbortController();
    let broadcastSocket=null,taskSocket=null,taskReconnectStartTime=null;const TASK_RECONNECT_TIMEOUT=10000;
    const window={location:{protocol:'http:',host:'mock.invalid'},matchMedia};const buildAiApiUrl=p=>p;
    const taskStatus=ref('none'),taskError=ref(''),taskNotice=ref(''),queuePosition=ref(-1),waitingCount=ref(1),executingCount=ref(0),lastBroadcastFlag=ref(-1),isWebSocketConnected=ref(true),executedTaskCount=ref(0);
    const chatSettings=createAiChatSettings();
    const pickEditableSettings=s=>({prompt:s.prompt,temperature:s.temperature,top_p:s.top_p,frequency_penalty:s.frequency_penalty,presence_penalty:s.presence_penalty,repeat_penalty:s.repeat_penalty});
    const selectedModel=ref('mock'),history=ref([{role:'user',content:'synthetic'}]),inputText=ref(''),editingIndex=ref(-1),editingContent=ref(''),userChatConfig=ref(chatSettings.effective),serverChatConfig=ref(chatSettings.serviceDefaults),tempChatConfig=ref(pickEditableSettings(chatSettings.effective)),showSettingsModal=ref(false),serverConfig=ref({available_models:[],max_concurrent_tasks:0});
    const controlPanelRef=ref(null),messageAreaRef=ref(null),settingsButtonRef=ref(triggerEl),settingsModalRef=ref(modalEl);
    const nextTick=callback=>callback ? Promise.resolve().then(callback) : Promise.resolve();
    const streamStatus=createAiStreamStatus(),fragmentCount=ref(0),fragmentSpeed=ref(0);
    const isContentOverflowing=ref(false),alert=()=>{};
    ${selectModelSource}
    ${createMessageSource}
    ${settingsSlice}
    ${startEditSource}
    ${editMounted}
    ${editing}
    ${scrollBusiness}
    ${overflowBusiness}
    ${streamBusiness}
    ${business}
    return {callAI,sendMessage,stopTask,handleSendOrStop,startEdit,confirmEditing,selectAndFocus,handleSendEnter,handleEditEscape,exitEditing,scrollToBottom,interruptMessageScroll,handleMessageScrollKey,checkContentOverflow,isContentOverflowing,interruptPanelDemo,handlePanelScrollKey,schedulePanelDemo,scrollControlPanel,scrollOwner,controlPanelRef,messageAreaRef,setupReducedMotion,cleanupReducedMotion,prefersReducedMotion,connectBroadcastSocket,fetchExecutedTaskCount,openSettingsModal,resetSettings,closeSettingsModal,saveSettings,handleSettingsModalKeydown,selectModel,selectedModel,serverConfig,history,taskStatus,taskError,taskNotice,isWebSocketConnected,executedTaskCount,inputText,editingIndex,editingContent,serverChatConfig,userChatConfig,tempChatConfig,showSettingsModal,settingsModalRef,chatSettings,fragmentCount,fragmentSpeed,waitingCount,executingCount,lastBroadcastFlag,
      ageReconnect(){taskReconnectStartTime=Date.now()-10001},
      dispose(){pageDisposed=true;cleanupReducedMotion();settingsFocusToken++;scrollToBottomToken++;if(panelScrollTimer!==null){clearTimeout(panelScrollTimer);panelScrollTimer=null}scrollOwner.dispose();taskOwner.dispose();broadcastOwner.dispose();pageController.abort();disconnectBroadcastSocket();disconnectTaskSocket()}}
  `)(requestMod.exports.fetchJsonWithTimeout, requestMod.exports.JsonRequestTimeoutError, mod.exports.createAiTaskOwner, settingsMod.exports.createAiChatSettings, streamMod.exports.createAiStreamStatus, scrollMod.exports.createScrollAnimationOwner, requestFrame, cancelFrame, now, fetch, Socket, setTimeout, clearTimeout, document, triggerEl, modalEl, TestDate, matchMedia)
  return { api, requests, sockets, timers, frames, document, triggerEl, firstModalEl, lastModalEl, externalEl, modalEl,
    failNextSocket() { failSocket = true },
    motionListeners, removedMotionListeners,
    changeMotion(matches) { media.matches = matches; for (const callback of [...motionListeners]) callback({ matches }) },
    advance(ms) { clock += ms },
    stepFrame(nextTime) {
      frameTime = nextTime
      const pending = [...frames.entries()]
      for (const [key, callback] of pending) { frames.delete(key); callback(frameTime) }
    },
    runTimer() { const [id, callback] = timers.entries().next().value; timers.delete(id); clock = Math.max(clock, deadlines.get(id) ?? clock); deadlines.delete(id); callback() },
    elapse(ms) {
      const end = clock + ms
      while (true) {
        const due = [...deadlines.entries()].filter(([id, at]) => timers.has(id) && at <= end).sort((a, b) => a[1] - b[1])[0]
        if (!due) break
        const [id, at] = due, callback = timers.get(id)
        timers.delete(id); deadlines.delete(id); clock = at; callback()
      }
      clock = end
    },
  }
}
// Auto-repeat must neither submit nor let native Enter mutate the draft.
{
  const f = fixture(); f.api.inputText.value = 'unchanged input draft'
  const before = JSON.stringify(f.api.history.value)
  let prevented = 0
  f.api.handleSendEnter({ repeat: true, preventDefault() { prevented++ } })
  await tick()
  assert.equal(prevented, 1)
  assert.equal(f.requests.length, 0)
  assert.equal(f.api.inputText.value, 'unchanged input draft')
  assert.equal(JSON.stringify(f.api.history.value), before)
  f.api.handleSendEnter({ repeat: false, preventDefault() {} }); await tick()
  assert.equal(f.requests.length, 1, 'ordinary Enter still submits')
  f.api.dispose()
}
{
  const f = fixture(); f.api.editingIndex.value = 0; f.api.editingContent.value = 'unchanged edited draft'
  const before = JSON.stringify(f.api.history.value)
  let prevented = 0
  await f.api.confirmEditing({ repeat: true, preventDefault() { prevented++ } }); await tick()
  assert.equal(prevented, 1)
  assert.equal(f.requests.length, 0)
  assert.equal(f.api.editingIndex.value, 0)
  assert.equal(f.api.editingContent.value, 'unchanged edited draft')
  assert.equal(JSON.stringify(f.api.history.value), before)
  await f.api.confirmEditing({ type: 'click', preventDefault() {} }); await tick()
  assert.equal(f.requests.length, 1, 'confirm button still submits')
  f.api.dispose()
}
{
  const f = fixture(); f.api.inputText.value = 'shift composition draft'
  for (const flags of [{ repeat: true, shiftKey: true }, { repeat: true, isComposing: true }, { repeat: true, keyCode: 229 }]) {
    f.api.handleSendEnter({ ...flags, preventDefault() { throw Error('IME/Shift must retain precedence') } })
    await f.api.confirmEditing({ ...flags, preventDefault() { throw Error('edit IME/Shift must retain precedence') } })
  }
  assert.equal(f.requests.length, 0)
  f.api.dispose()
}

for (const blocked of ['offline', 'running', 'empty', 'ime', 'ime229', 'shift']) {
  const f = fixture()
  f.api.history.value = [{ role: 'user', content: 'original' }, { role: 'mock', content: 'keep following answer' }]
  f.api.editingIndex.value = 0
  f.api.editingContent.value = blocked === 'empty' ? '  ' : 'draft replacement'
  if (blocked === 'offline') f.api.isWebSocketConnected.value = false
  if (blocked === 'running') f.api.taskStatus.value = 'running'
  const before = JSON.stringify(f.api.history.value)
  let prevented = false
  await f.api.confirmEditing({ shiftKey: blocked === 'shift', isComposing: blocked === 'ime', keyCode: blocked === 'ime229' ? 229 : 13, preventDefault() { prevented = true } })
  assert.equal(JSON.stringify(f.api.history.value), before, `${blocked} preserves entire history`)
  assert.equal(f.api.editingIndex.value, 0)
  assert.equal(f.requests.length, 0, `${blocked} does not submit`)
  if (blocked.startsWith('ime') || blocked === 'shift') assert.equal(prevented, false, 'IME and Shift+Enter keep textarea default behavior')
}
{
  const f = fixture()
  f.api.history.value = [{ role: 'user', content: 'original' }, { role: 'mock', content: 'old answer' }]
  f.api.editingIndex.value = 0; f.api.editingContent.value = ' replacement '
  await f.api.confirmEditing({ preventDefault() {} })
  assert.deepEqual(f.api.history.value, [{ role: 'user', content: 'replacement' }])
  assert.equal(f.requests.length, 1)
  f.requests[0].resolve(response('edited')); await tick()
  f.api.stopTask()
}
{
  const f = fixture(); f.api.inputText.value = 'IME draft'
  f.api.handleSendEnter({ isComposing: true, preventDefault() { throw Error('must not prevent IME') } })
  f.api.handleSendEnter({ shiftKey: true, preventDefault() { throw Error('must not prevent Shift+Enter newline') } })
  assert.equal(f.requests.length, 0)
}
{
  const f = fixture(); f.api.editingIndex.value = 0; f.api.editingContent.value = 'draft'
  f.api.handleEditEscape({ isComposing: true, preventDefault() { throw Error('must not cancel IME Escape') } })
  assert.equal(f.api.editingContent.value, 'draft')
  assert.equal(f.api.editingIndex.value, 0)
  f.api.handleEditEscape({ preventDefault() {} }); await tick()
  assert.equal(f.api.editingIndex.value, -1)
  assert.equal(f.api.history.value[0].content, 'synthetic')
}
{
  const f = fixture(), pending = f.api.callAI(); await tick()
  f.api.isWebSocketConnected.value = false
  f.api.handleSendOrStop(); assert.equal(f.requests[0].init.signal.aborted, true)
  assert.equal(f.api.taskStatus.value, 'none', 'UI stop entry works while broadcast disconnected')
  f.requests[0].resolve(response('stopped')); await pending
  assert.equal(f.sockets.length, 0)
}
{
  const f = fixture(), pending = f.api.callAI(); await tick()
  f.requests[0].resolve(response('running')); await pending
  f.sockets[0].emit('message', { data: 'data {"choices":[{"delta":{"content":"first"}}]}' })
  assert.equal(f.api.taskStatus.value, 'running')
  f.api.isWebSocketConnected.value = false
  f.api.editingIndex.value = 0
  f.api.handleSendOrStop()
  assert.equal(f.api.taskStatus.value, 'none', 'stop remains available during running, disconnected, and editing')
  assert.equal(f.sockets[0].closed, true)
  f.api.inputText.value = 'do not send offline'
  f.api.handleSendOrStop()
  assert.equal(f.requests.length, 1, 'only sending requires connection and no editing')
}
{
  const f = fixture(), body = deferred(), pending = f.api.callAI(); await tick()
  f.requests[0].resolve({ ok: true, json: () => body.promise }); await tick()
  f.api.stopTask(); body.resolve({ websocket_id: 'old-body' }); await pending
  assert.equal(f.sockets.length, 0)
}
for (const lateError of [false, true]) {
  const f = fixture(), a = f.api.callAI(); await tick(); f.api.stopTask(); const b = f.api.callAI(); await tick()
  f.requests[1].resolve(response('new')); await b
  if (lateError) f.requests[0].reject(Error('old failure')); else f.requests[0].resolve(response('old'))
  await a
  assert.equal(f.sockets.length, 1); assert.ok(f.sockets[0].url.includes('id=new'))
  assert.equal(f.api.history.value.length, 1); assert.equal(f.api.taskStatus.value, 'queue')
  assert.equal(f.api.taskError.value, '', 'stale HTTP errors never appear on the new task')
  const oldMessage = f.sockets[0].onmessage, oldClose = f.sockets[0].onclose
  f.api.stopTask()
  oldMessage({ data: 'data {"choices":[{"delta":{"content":"late"}}]}' }); oldClose({ code: 1006 })
  assert.equal(f.api.history.value.length, 1); assert.equal(f.timers.size, 0)
  assert.equal(f.sockets[0].onmessage, null)
}
{
  const f = fixture(), pending = f.api.callAI(); await tick(); f.requests[0].resolve(response('done')); await pending
  f.sockets[0].emit('message', { data: 'data [DONE]\ndata {"choices":[{"delta":{"content":"must not append"}}]}' })
  assert.equal(f.api.taskStatus.value, 'none')
  assert.ok(!f.api.history.value.some(message => message.content.includes('must not append')))
}
{
  const f = fixture(), pending = f.api.callAI(); await tick(); f.requests[0].resolve(response('finish-content')); await pending
  f.sockets[0].emit('message', { data: 'data {"choices":[{"delta":{"content":"final text"},"finish_reason":"stop"}]}\ndata {"choices":[{"delta":{"content":"must not append"}}]}' })
  assert.equal(f.api.history.value.at(-1).content, 'final text', 'consume final delta before finishing')
  assert.equal(f.api.taskStatus.value, 'none')
  assert.equal(f.sockets[0].closed, true)
}
{
  const f = fixture(), pending = f.api.callAI(); await tick(); f.requests[0].resolve(response('reconnect')); await pending
  f.sockets[0].emit('close', { code: 1006 })
  const lateTimer = [...f.timers.values()][0]; assert.equal(typeof lateTimer, 'function')
  f.api.stopTask(); lateTimer()
  assert.equal(f.sockets.length, 1); assert.equal(f.timers.size, 0)
}
{
  const f = fixture(); f.api.connectBroadcastSocket()
  const old = f.sockets[0], oldClose = old.onclose, oldMessage = old.onmessage
  f.api.connectBroadcastSocket()
  oldMessage({ data: 'broadcast {"waiting_count":999}' }); oldClose({ code: 1006 })
  assert.equal(f.timers.size, 0); assert.equal(old.onmessage, null)
  const currentClose = f.sockets[1].onclose
  const pending = f.api.callAI(); await tick(); const count = f.api.fetchExecutedTaskCount(); await tick()
  f.api.dispose(); currentClose({ code: 1006 })
  f.requests[0].resolve(response('unmounted'))
  f.requests[1].resolve({ ok: true, json: async () => ({ executed_task: 99 }) })
  await pending; await count
  assert.equal(f.api.executedTaskCount.value, 0); assert.equal(f.timers.size, 0)
  assert.equal(f.sockets.length, 2); assert.ok(f.sockets.every(socket => socket.closed))
}
// Settings transaction integration: unreceived defaults, reset/cancel isolation, broadcast preservation, requestSettings, focus/keyboard guards
{
  const f = fixture()
  const p0 = f.api.callAI(); await tick()
  const initialBody = JSON.parse(f.requests[0].init.body)
  assert.equal(initialBody.messages.some(m => m.role === 'system'), false, 'unreceived empty prompt must not emit system message')
  for (const key of ['temperature', 'top_p', 'frequency_penalty', 'presence_penalty', 'repeat_penalty']) {
    assert.equal(Object.hasOwn(initialBody, key), false, `unreceived placeholder ${key} must not be sent`)
  }
  f.api.stopTask(); f.requests[0].resolve(response('s0')); await p0

  f.api.connectBroadcastSocket()
  f.sockets[0].emit('message', {
    data: 'chat-config {"prompt":"   ","content_size":4096,"max_tokens":512,"temperature":0.6}'
  })
  assert.equal(f.api.serverChatConfig.value.content_size, 4096)
  assert.equal(f.api.serverChatConfig.value.max_tokens, 512)
  assert.equal(f.api.userChatConfig.value.temperature, 0.6)

  const p1 = f.api.callAI(); await tick()
  const broadcastBody = JSON.parse(f.requests[1].init.body)
  assert.equal(broadcastBody.messages.some(m => m.role === 'system'), false, 'whitespace-only system prompt must not be sent')
  assert.equal(broadcastBody.temperature, 0.6)
  assert.equal(Object.hasOwn(broadcastBody, 'top_p'), false)
  assert.equal(Object.hasOwn(broadcastBody, 'max_tokens'), false)
  assert.equal(Object.hasOwn(broadcastBody, 'content_size'), false)
  f.api.stopTask(); f.requests[1].resolve(response('s1')); await p1

  await f.api.openSettingsModal()
  assert.equal(f.api.showSettingsModal.value, true)
  assert.equal(f.document.activeElement, f.firstModalEl, 'opening settings focuses first modal control')
  f.api.tempChatConfig.value.prompt = 'custom system prompt'
  f.api.tempChatConfig.value.temperature = 0.85
  f.api.saveSettings()
  await tick()
  assert.equal(f.api.showSettingsModal.value, false)
  assert.equal(f.api.userChatConfig.value.prompt, 'custom system prompt')
  assert.equal(f.api.userChatConfig.value.temperature, 0.85)
  assert.equal(f.document.activeElement, f.triggerEl, 'saving returns focus to settings trigger')

  // Reset then Cancel must not mutate saved user customization
  await f.api.openSettingsModal()
  f.api.resetSettings()
  assert.equal(f.api.tempChatConfig.value.prompt, '   ')
  assert.equal(f.api.tempChatConfig.value.temperature, 0.6)
  assert.equal(f.api.userChatConfig.value.prompt, 'custom system prompt')
  assert.equal(f.api.userChatConfig.value.temperature, 0.85)

  // Broadcast while modal is open must update server/user refs but never overwrite open temp draft
  f.api.tempChatConfig.value.prompt = 'in-progress draft'
  f.sockets[0].emit('message', {
    data: 'chat-config {"prompt":"new server default","content_size":8192,"max_tokens":1024,"temperature":0.4,"top_p":0.9}'
  })
  assert.equal(f.api.serverChatConfig.value.content_size, 8192)
  assert.equal(f.api.serverChatConfig.value.max_tokens, 1024)
  assert.equal(f.api.userChatConfig.value.top_p, 0.9)
  assert.equal(f.api.userChatConfig.value.prompt, 'custom system prompt')
  assert.equal(f.api.tempChatConfig.value.prompt, 'in-progress draft')

  // Tab wrapping and Escape cancellation (respecting IME)
  f.document.activeElement = f.lastModalEl
  let tabPrevented = false
  f.api.handleSettingsModalKeydown({ key: 'Tab', shiftKey: false, preventDefault() { tabPrevented = true } })
  assert.equal(tabPrevented, true)
  assert.equal(f.document.activeElement, f.firstModalEl, 'Tab at last control wraps to first')
  let shiftTabPrevented = false
  f.api.handleSettingsModalKeydown({ key: 'Tab', shiftKey: true, preventDefault() { shiftTabPrevented = true } })
  assert.equal(shiftTabPrevented, true)
  assert.equal(f.document.activeElement, f.lastModalEl, 'Shift+Tab at first control wraps to last')

  f.api.handleSettingsModalKeydown({ key: 'Escape', isComposing: true, preventDefault() { throw Error('must not cancel IME Escape') } })
  assert.equal(f.api.showSettingsModal.value, true)
  let escPrevented = false, escStopped = false
  f.api.handleSettingsModalKeydown({ key: 'Escape', isComposing: false, preventDefault() { escPrevented = true }, stopPropagation() { escStopped = true } })
  await tick()
  assert.equal(escPrevented, true); assert.equal(escStopped, true)
  assert.equal(f.api.showSettingsModal.value, false)
  assert.equal(f.api.userChatConfig.value.prompt, 'custom system prompt')
  assert.equal(f.api.userChatConfig.value.temperature, 0.85)
  assert.equal(f.document.activeElement, f.triggerEl)

  const p2 = f.api.callAI(); await tick()
  const customBody = JSON.parse(f.requests[2].init.body)
  assert.deepEqual(customBody.messages[0], { role: 'system', content: 'custom system prompt' })
  assert.equal(customBody.temperature, 0.85)
  assert.equal(customBody.top_p, 0.9)
  f.api.stopTask(); f.requests[2].resolve(response('s2')); await p2

  // External focus and unmount lifecycle guards on close
  await f.api.openSettingsModal()
  f.document.activeElement = f.externalEl
  f.api.closeSettingsModal(); await tick()
  assert.equal(f.document.activeElement, f.externalEl, 'external focus must not be stolen on close')

  await f.api.openSettingsModal()
  f.api.closeSettingsModal()
  f.api.dispose()
  await tick()
  assert.equal(f.triggerEl.focusCount, 2, 'disposed page must not restore focus after unmount')
}
for (const cap of [0, 1, 100]) {
  for (const reason of ['stop', 'length']) {
    const f = fixture(), pending = f.api.callAI(); await tick()
    f.api.serverChatConfig.value.max_tokens = cap
    f.requests[0].resolve(response('stream')); await pending
    f.sockets[0].emit('message', { data: 'data {"choices":[{"delta":{"content":"first "}}]}' })
    f.sockets[0].emit('message', { data: `data ${JSON.stringify({ choices: [{ delta: { content: 'last' }, finish_reason: reason }] })}\ndata {"choices":[{"delta":{"content":"late"}}]}` })
    const result = f.api.history.value.at(-1).content
    assert.ok(result.startsWith('first last'))
    assert.equal((f.api.taskNotice.value.match(/输出因长度限制结束/g) ?? []).length, reason === 'length' ? 1 : 0)
    assert.equal(result, 'first last', 'client notices never enter model history')
    assert.ok(!result.includes('最大生成token') && !result.includes('late'))
    assert.equal(f.api.fragmentCount.value, 2)
    assert.equal(f.api.taskStatus.value, 'none')
    const next = f.api.callAI(); await tick()
    assert.equal(f.api.taskNotice.value, '', 'new task clears prior client notice')
    assert.equal(JSON.parse(f.requests[1].init.body).messages.at(-1).content, 'first last')
    f.requests[1].resolve(response('next')); await next
    f.api.stopTask()
    assert.equal(f.api.fragmentCount.value, 0)
    assert.equal(f.api.fragmentSpeed.value, 0)
  }
}
for (const frame of ['data {broken JSON', 'error {"message":"raw-protocol-secret"}', 'data {"error":{"message":"raw-protocol-secret"}}']) {
  const f = fixture(), pending = f.api.callAI(); await tick()
  f.requests[0].resolve(response('partial')); await pending
  f.sockets[0].emit('message', { data: 'data {"choices":[{"delta":{"content":"PRESERVE THIS ANSWER"}}]}' })
  const oldMessage = f.sockets[0].onmessage
  f.sockets[0].emit('message', { data: frame })
  assert.equal(f.api.history.value.at(-1).content, 'PRESERVE THIS ANSWER')
  assert.equal(f.api.history.value.length, 2)
  assert.ok(f.api.taskError.value.length > 0 && !f.api.taskError.value.includes('raw-protocol-secret'))
  assert.equal(f.api.taskStatus.value, 'none')
  const next = f.api.callAI(); await tick()
  assert.equal(f.api.taskError.value, '')
  const sent = JSON.parse(f.requests[1].init.body).messages
  assert.deepEqual(sent, [{ role: 'user', content: 'synthetic' }, { role: 'assistant', content: 'PRESERVE THIS ANSWER' }])
  oldMessage({ data: frame })
  assert.equal(f.api.taskError.value, '', 'late old stream errors cannot poison new task')
  f.requests[1].resolve(response('next')); await next; f.api.stopTask()
}
for (const failure of ['http', 'body']) {
  const f = fixture()
  f.api.history.value.push({ role: 'mock', content: 'previous model answer' })
  const before = JSON.stringify(f.api.history.value), pending = f.api.callAI(); await tick()
  f.requests[0].resolve(failure === 'http'
    ? { ok: false, status: 503, statusText: 'Unavailable' }
    : { ok: true, json: async () => { throw Error('invalid response JSON') } })
  await pending
  assert.equal(JSON.stringify(f.api.history.value), before, 'request errors never become assistant content')
  assert.ok(f.api.taskError.value)
}
{
  const f = fixture(), pending = f.api.callAI(); await tick()
  f.requests[0].resolve(response('timeout')); await pending
  f.sockets[0].emit('message', { data: 'data {"choices":[{"delta":{"content":"partial before timeout"}}]}' })
  f.sockets[0].emit('close', { code: 1006 })
  f.api.ageReconnect()
  const timer = [...f.timers.values()][0]
  timer()
  assert.equal(f.api.history.value.at(-1).content, 'partial before timeout')
  assert.equal(f.api.taskStatus.value, 'none')
  assert.ok(f.api.taskError.value.includes('超时'))
}
{
  const document = { body: {}, activeElement: null }
  const toggle = { focus() { document.activeElement = toggle } }
  const selected = { focus() { document.activeElement = selected } }
  const outside = {}
  const panel = { isConnected: true, contains: el => el === selected, querySelector: () => selected }
  const controlPanelRef = { value: panel }, controlPanelToggleRef = { value: toggle }, isControlPanelClosed = { value: false }
  const api = new Function('document', 'controlPanelRef', 'controlPanelToggleRef', 'isControlPanelClosed', `
    let pageDisposed=false,interrupts=0; const interruptPanelDemo=()=>{interrupts++}; const nextTick=()=>Promise.resolve(); ${panelBusiness}
    return {toggleControlPanel,get interrupts(){return interrupts},dispose(){pageDisposed=true}}
  `)(document, controlPanelRef, controlPanelToggleRef, isControlPanelClosed)
  document.activeElement = selected
  await api.toggleControlPanel()
  assert.equal(api.interrupts, 1, 'explicit panel toggle cancels the initial demo')
  assert.equal(isControlPanelClosed.value, true)
  assert.ok(document.activeElement === toggle, 'collapse moves panel focus out before inert')
  await api.toggleControlPanel()
  assert.ok(document.activeElement === selected, 'expand focuses selected model')
  await api.toggleControlPanel()
  const expand = api.toggleControlPanel(); document.activeElement = outside; await expand
  assert.ok(document.activeElement === outside, 'late expansion cannot steal external focus')
  await api.toggleControlPanel()
  const rapid = api.toggleControlPanel(); await api.toggleControlPanel(); await rapid
  assert.equal(isControlPanelClosed.value, true)
  assert.ok(document.activeElement === outside, 'rapid close cancels pending expansion focus')
  const pending = api.toggleControlPanel(); api.dispose(); await pending
  assert.ok(document.activeElement === outside, 'unmount cancels pending panel focus')
}
for (const malformed of [new Uint8Array([1, 2]), 'data {"choices":"bad"}', 'data {"choices":[123]}', 'data {"choices":[{"delta":{"content":42}}]}']) {
  const f = fixture(), pending = f.api.callAI(); await tick()
  f.requests[0].resolve(response('invalid')); await pending
  f.sockets[0].emit('message', { data: 'data {"choices":[{"delta":{"content":"keep partial"}}]}' })
  f.sockets[0].emit('message', { data: malformed })
  assert.equal(f.api.history.value.at(-1).content, 'keep partial')
  assert.equal(f.api.taskStatus.value, 'none')
  assert.ok(f.api.taskError.value.includes('格式异常'))
  assert.equal(f.sockets[0].closed, true)
}
{
  const f = fixture(), pending = f.api.callAI(); await tick()
  f.requests[0].resolve(response('valid-empty')); await pending
  for (const payload of [{ choices: [], usage: { completion_tokens: 3 } }, { choices: [{ delta: { role: 'assistant' } }] }, { choices: [{ delta: { content: '' } }] }, { choices: [{ delta: { content: null } }] }]) {
    f.sockets[0].emit('message', { data: `data ${JSON.stringify(payload)}` })
    assert.equal(f.api.taskError.value, '')
    assert.equal(f.sockets[0].closed, false)
  }
  f.sockets[0].emit('message', { data: 'data {"choices":[{"delta":{"content":"keep on early close"}}]}' })
  f.sockets[0].emit('close', { code: 1000 })
  assert.equal(f.api.history.value.at(-1).content, 'keep on early close')
  assert.ok(f.api.taskError.value.includes('提前结束'))
  assert.equal(f.api.taskStatus.value, 'none')
}
{
  const f = fixture(), pending = f.api.callAI(); await tick()
  f.requests[0].resolve(response('handshake-loop')); await pending
  for (let i = 0; i < 3; i++) {
    const socket = f.sockets.at(-1)
    socket.emit('open', {})
    socket.emit('message', { data: 'broadcast {"queue_position":0}\ndata {"choices":[{"delta":{"role":"assistant"}}]}' })
    socket.emit('close', { code: 1006 })
    f.advance(4000); f.runTimer()
  }
  assert.equal(f.sockets.length, 3, 'open/close handshakes cannot reset the interruption deadline')
  assert.equal(f.api.taskStatus.value, 'none')
  assert.ok(f.api.taskError.value.includes('超时'))
  assert.equal(f.timers.size, 0)
}
{
  const f = fixture(), pending = f.api.callAI(); await tick()
  f.requests[0].resolve(response('long-progress')); await pending
  f.sockets[0].emit('open', {}); f.advance(60000)
  f.sockets[0].emit('message', { data: 'data {"choices":[{"delta":{"content":"long healthy answer"}}]}' })
  f.sockets[0].emit('close', { code: 1006 })
  f.advance(9000); f.runTimer()
  assert.equal(f.sockets.length, 2, 'long normal generation does not consume a future recovery budget')
  f.sockets[1].emit('open', {})
  f.sockets[1].emit('message', { data: 'data {"choices":[{"delta":{"content":" progress"}}]}' })
  f.advance(9000); f.sockets[1].emit('close', { code: 1006 })
  f.advance(9000); f.runTimer()
  assert.equal(f.sockets.length, 3, 'real text progress starts a fresh recovery window')
  assert.equal(f.api.taskError.value, '')
  assert.equal(f.api.history.value.at(-1).content, 'long healthy answer progress')
  f.api.stopTask()
}
// Scroll owner integration: scrollToBottom async/dynamic/token guards, panel two-stage demo, dispose & accessibility
{
  const f = fixture()
  const source = { isConnected: true }
  let focusedWith
  const el = { scrollTop: 600, scrollHeight: 2000, clientHeight: 500, isConnected: true,
    focus(options) { focusedWith = options; f.document.activeElement = el },
  }
  f.api.messageAreaRef.value = el
  f.document.activeElement = source
  await f.api.scrollToBottom({ currentTarget: source })
  assert.ok(f.document.activeElement === el, 'focused more-content button transfers to stable message region')
  assert.deepEqual(focusedWith, { preventScroll: true })
  source.isConnected = false // The overflow indicator can now disappear without losing focus.
  f.stepFrame(1000)
  assert.ok(f.document.activeElement === el)
  assert.equal(el.scrollTop, 1500)
}
for (const reason of ['automatic', 'external-focus', 'dispose']) {
  const f = fixture(), source = { isConnected: true }
  const outside = {}
  const el = { scrollTop: 0, scrollHeight: 1000, clientHeight: 500, isConnected: true,
    focus() { throw Error(`${reason} must not move focus`) },
  }
  f.api.messageAreaRef.value = el
  f.document.activeElement = reason === 'automatic' ? outside : source
  const pending = reason === 'automatic' ? f.api.scrollToBottom() : f.api.scrollToBottom({ currentTarget: source })
  if (reason === 'external-focus') f.document.activeElement = outside
  if (reason === 'dispose') f.api.dispose()
  await pending
  assert.ok(f.document.activeElement === (reason === 'dispose' ? source : outside))
}
{
  const f = fixture()
  const el = { scrollTop: 600, scrollHeight: 2000, clientHeight: 500, isConnected: true }
  f.api.messageAreaRef.value = el
  const pending = f.api.scrollToBottom({ currentTarget: null })
  assert.equal(f.frames.size, 0, 'scrollToBottom waits for nextTick before scheduling animation')
  await pending
  assert.equal(f.frames.size, 1)
  f.stepFrame(16)
  assert.ok(el.scrollTop > 600 && el.scrollTop < 602, 'scrollToBottom animates from current scrollTop without jumping to zero')
  el.scrollHeight = 2600
  f.stepFrame(1000)
  assert.equal(el.scrollTop, 2100, 'scrollToBottom tracks dynamic scrollHeight - clientHeight')
  assert.equal(f.frames.size, 0)
}
{
  // Competing pending scrollToBottom calls: latest wins; ref swap, disconnect, and dispose cancel pending calls
  const f = fixture()
  const el1 = { scrollTop: 600, scrollHeight: 2000, clientHeight: 500, isConnected: true }
  const el2 = { scrollTop: 100, scrollHeight: 1500, clientHeight: 500, isConnected: true }
  f.api.messageAreaRef.value = el1
  const p1 = f.api.scrollToBottom({ currentTarget: null })
  f.api.messageAreaRef.value = el2
  const p2 = f.api.scrollToBottom({ currentTarget: null })
  await Promise.all([p1, p2])
  assert.equal(f.frames.size, 1)
  f.stepFrame(1000)
  assert.equal(el1.scrollTop, 600, 'superseded pending scrollToBottom never animates old element')
  assert.equal(el2.scrollTop, 1000)

  const p3 = f.api.scrollToBottom({ currentTarget: null })
  f.api.messageAreaRef.value = null
  await p3
  assert.equal(f.frames.size, 0, 'ref cleared before nextTick aborts scrollToBottom')

  el2.scrollTop = 100
  f.api.messageAreaRef.value = el2
  const p4 = f.api.scrollToBottom({ currentTarget: null })
  el2.isConnected = false
  await p4
  assert.equal(f.frames.size, 0, 'disconnected element before nextTick aborts scrollToBottom')

  el2.isConnected = true
  const p5 = f.api.scrollToBottom({ currentTarget: null })
  f.api.dispose()
  await p5
  assert.equal(f.frames.size, 0, 'disposed page before nextTick aborts scrollToBottom')
}
{
  // Near-bottom stream finish follows output; unmount blocks stale RAF writes
  const f = fixture()
  const el = { scrollTop: 1480, scrollHeight: 2000, clientHeight: 500, isConnected: true }
  f.api.messageAreaRef.value = el
  const pending = f.api.callAI(); await tick()
  f.requests[0].resolve(response('scroll-on-finish')); await pending
  f.sockets[0].emit('message', { data: 'data {"choices":[{"delta":{"content":"done"},"finish_reason":"stop"}]}' })
  await tick()
  assert.equal(f.frames.size, 1)
  const stale = [...f.frames.values()][0]
  f.stepFrame(500)
  const mid = el.scrollTop
  assert.ok(mid > 1480 && mid < 1500)
  f.api.dispose()
  stale(1000)
  f.stepFrame(1000)
  assert.equal(el.scrollTop, mid, 'stale RAF callback after unmount cannot mutate scrollTop')
  assert.equal(f.frames.size, 0)
}
{
  // Panel demo: down then up through same owner; cancel/disconnect/unmount blocks stage 2
  const f = fixture()
  const panel = { scrollTop: 0, scrollHeight: 1400, clientHeight: 400, isConnected: true }
  f.api.controlPanelRef.value = panel
  f.api.scrollControlPanel()
  assert.equal(f.frames.size, 1)
  f.stepFrame(500)
  assert.equal(panel.scrollTop, 500)
  f.stepFrame(1000)
  assert.equal(panel.scrollTop, 1000)
  assert.equal(f.frames.size, 1, 'stage 1 completion schedules stage 2 up animation')
  f.stepFrame(1500)
  assert.equal(panel.scrollTop, 500)
  f.stepFrame(2000)
  assert.equal(panel.scrollTop, 0)
  assert.equal(f.frames.size, 0)

  for (const reason of ['cancel', 'disconnect', 'dispose']) {
    const f2 = fixture()
    const p = { scrollTop: 0, scrollHeight: 1400, clientHeight: 400, isConnected: true }
    f2.api.controlPanelRef.value = p
    f2.api.scrollControlPanel()
    f2.stepFrame(500)
    const mid = p.scrollTop
    const stale = [...f2.frames.values()][0]
    if (reason === 'cancel') f2.api.scrollOwner.cancel(p)
    if (reason === 'disconnect') p.isConnected = false
    if (reason === 'dispose') f2.api.dispose()
    stale(1000)
    f2.stepFrame(1000)
    f2.stepFrame(2000)
    assert.equal(p.scrollTop, mid, `${reason} stops stage 1 and prevents stage 2`)
    assert.equal(f2.frames.size, 0)
  }
}
{
  const indicatorBlock = source.slice(source.indexOf('id="generating-indicator"'), source.indexOf('<div id="message-area"'))
  assert.ok(indicatorBlock.includes('<button') && indicatorBlock.includes('type="button"') && indicatorBlock.includes('aria-label='), 'more-content indicator uses native accessible button')
  assert.ok(!indicatorBlock.includes('<span @click'), 'mouse-only span removed from generating-indicator')
  assert.ok(!source.includes('const scrollElement ='), 'raw scrollElement RAF helper removed')
}
// Editing an old turn is provisional until the first nonblank answer arrives.
const originalEditHistory = [
  { role: 'user', content: 'original question' },
  { role: 'model-A', content: 'valuable original answer' },
  { role: 'user', content: 'later question' }
]
const beginEdit = async f => {
  f.api.history.value = originalEditHistory.map(message => ({ ...message }))
  f.api.editingIndex.value = 0
  f.api.editingContent.value = ' edited replacement '
  await f.api.confirmEditing({ preventDefault() {} })
}
const assertEditRestored = f => {
  assert.deepEqual(f.api.history.value, originalEditHistory, 'all original turns survive a failed edit resend')
  assert.equal(f.api.editingIndex.value, 0)
  assert.equal(f.api.editingContent.value, ' edited replacement ', 'raw edit draft remains available for retry')
  assert.equal(f.api.taskStatus.value, 'none')
  assert.ok(f.api.taskError.value.includes('已恢复原完整对话'))
}
for (const failure of ['http-reject', 'http-status', 'json-reject', 'missing-id', 'stop-http', 'stop-body']) {
  const f = fixture()
  await beginEdit(f)
  if (failure === 'http-reject') f.requests[0].reject(Error('synthetic edited request rejection'))
  if (failure === 'http-status') f.requests[0].resolve({ ok: false, status: 503, statusText: 'Unavailable' })
  if (failure === 'json-reject') f.requests[0].resolve({ ok: true, json: async () => { throw Error('synthetic body rejection') } })
  if (failure === 'missing-id') f.requests[0].resolve({ ok: true, json: async () => ({}) })
  if (failure === 'stop-http') {
    f.api.stopTask()
    f.requests[0].resolve(response('stopped-edit'))
  }
  if (failure === 'stop-body') {
    const body = deferred()
    f.requests[0].resolve({ ok: true, json: () => body.promise })
    await tick()
    f.api.stopTask()
    body.resolve({ websocket_id: 'late-body' })
  }
  await tick(); await tick()
  assertEditRestored(f)
  assert.equal(f.sockets.length, 0)
  f.api.dispose()
}
for (const failure of ['error-event', 'close-normal', 'close-abnormal', 'error-frame', 'json-error', 'bad-json', 'empty-done', 'empty-finish', 'whitespace-done', 'stop-socket', 'constructor']) {
  const f = fixture()
  await beginEdit(f)
  if (failure === 'constructor') f.failNextSocket()
  f.requests[0].resolve(response('edited-socket'))
  await tick()
  const socket = f.sockets[0]
  if (failure === 'error-event') socket.emit('error', { type: 'synthetic error' })
  if (failure.startsWith('close-')) socket.emit('close', { code: failure === 'close-normal' ? 1000 : 1006 })
  if (failure === 'error-frame') socket.emit('message', { data: 'error server failed' })
  if (failure === 'json-error') socket.emit('message', { data: 'data {"error":"synthetic"}' })
  if (failure === 'bad-json') socket.emit('message', { data: 'data {broken' })
  if (failure === 'empty-done') socket.emit('message', { data: 'data [DONE]' })
  if (failure === 'empty-finish') socket.emit('message', { data: 'data {"choices":[{"delta":{},"finish_reason":"length"}]}' })
  if (failure === 'whitespace-done') socket.emit('message', { data: 'data {"choices":[{"delta":{"content":"  "}}]}\ndata [DONE]' })
  if (failure === 'stop-socket') f.api.stopTask()
  await tick()
  assertEditRestored(f)
  assert.equal(f.timers.size, 0, 'failed provisional edit cannot reconnect after rollback')
  if (socket) assert.equal(socket.closed, true)
  f.api.dispose()
}
for (const ending of ['stop', 'error', 'finish']) {
  const f = fixture()
  await beginEdit(f)
  f.requests[0].resolve(response('committed-edit')); await tick()
  const socket = f.sockets[0]
  socket.emit('message', { data: 'data {"choices":[{"delta":{"content":"new branch body"}}]}' })
  if (ending === 'stop') f.api.stopTask()
  if (ending === 'error') socket.emit('message', { data: 'data {broken' })
  if (ending === 'finish') socket.emit('message', { data: 'data {"choices":[{"delta":{"content":" final"},"finish_reason":"stop"}]}' })
  await tick()
  assert.equal(f.api.history.value[0].content, 'edited replacement')
  assert.ok(f.api.history.value.at(-1).content.startsWith('new branch body'))
  assert.equal(f.api.history.value.some(message => message.content === 'valuable original answer'), false)
  assert.equal(f.api.editingIndex.value, -1, 'first real body commits the edited branch')
  f.api.dispose()
}
{
  const f = fixture()
  await beginEdit(f)
  const body = deferred()
  f.requests[0].resolve({ ok: true, json: () => body.promise }); await tick()
  f.api.stopTask()
  assertEditRestored(f)
  f.api.editingContent.value = 'new retry draft'
  await f.api.confirmEditing({ preventDefault() {} })
  f.requests[1].resolve(response('new-retry')); await tick()
  body.resolve({ websocket_id: 'old-edited-body' }); await tick()
  assert.equal(f.sockets.length, 1)
  assert.ok(f.sockets[0].url.includes('new-retry'))
  f.sockets[0].emit('message', { data: 'data {"choices":[{"delta":{"content":"retry body"}}]}' })
  assert.equal(f.api.history.value[0].content, 'new retry draft')
  assert.equal(f.api.history.value.at(-1).content, 'retry body')
  f.api.dispose()
}
{
  const f = fixture()
  f.api.history.value = originalEditHistory.map(message => ({ ...message }))
  f.api.editingIndex.value = 0; f.api.editingContent.value = ' edited replacement '
  const stop = { focusCount: 0, focus() { this.focusCount++; f.document.activeElement = this } }
  f.document.querySelector = selector => selector === '#send-stop-button' ? stop : null
  const confirming = f.api.confirmEditing({ preventDefault() {} })
  f.api.stopTask() // rollback occurs before confirmEditing's own nextTick
  await confirming
  assertEditRestored(f)
  assert.equal(stop.focusCount, 0, 'rolled-back confirm callback cannot refocus send-stop')
  assert.equal(f.requests.length, 0, 'stop before the helper fetch microtask prevents dispatch entirely')
  await tick()
  assert.equal(f.sockets.length, 0)
  f.api.dispose()
}
for (const reason of ['external-before', 'external-after', 'modal', 'dispose']) {
  const f = fixture()
  await beginEdit(f)
  if (reason === 'external-before') f.externalEl.focus()
  f.api.stopTask()
  if (reason === 'external-after') f.externalEl.focus()
  if (reason === 'modal') f.api.showSettingsModal.value = true
  if (reason === 'dispose') f.api.dispose()
  let mountedFocus = 0
  f.api.selectAndFocus({ el: { focus() { mountedFocus++ }, select() {} } })
  assert.equal(mountedFocus, 0, `${reason} prevents restored editor mounted hook stealing focus`)
  f.requests[0].resolve(response('late-focus-case')); await tick()
  f.api.dispose()
}
{
  const f = fixture()
  await beginEdit(f)
  const before = JSON.stringify(f.api.history.value)
  f.api.dispose()
  f.requests[0].reject(Error('late unmounted edit failure')); await tick()
  assert.equal(JSON.stringify(f.api.history.value), before, 'unmounted edit failure cannot restore state or revive an editor')
  assert.equal(f.api.editingIndex.value, -1)
}
// Model refresh selection sync and per-task model capture (using actual createMessage source)
{
  const f = fixture()
  f.api.selectedModel.value = ''
  f.api.connectBroadcastSocket()
  const broadcast = f.sockets[0]
  // Initial list with leading empty entry selects first nonempty model
  broadcast.emit('message', { data: 'server-config {"available_models":["","  ","synthetic-one","synthetic-two"],"max_concurrent_tasks":2}' })
  assert.deepEqual(f.api.serverConfig.value.available_models, ['synthetic-one', 'synthetic-two'])
  assert.equal(f.api.selectedModel.value, 'synthetic-one')
  assert.equal(f.api.serverConfig.value.max_concurrent_tasks, 2)

  // Preserve selected model when still present after refresh
  f.api.selectModel('synthetic-two')
  broadcast.emit('message', { data: 'server-config {"available_models":["synthetic-three","synthetic-two"],"max_concurrent_tasks":3}' })
  assert.equal(f.api.selectedModel.value, 'synthetic-two')

  // Invalid model-list updates are ignored without corrupting list, selection, or render state
  for (const invalid of [null, 'synthetic-one', 123, {}, [123], ['synthetic-one', null], [{}]]) {
    broadcast.emit('message', { data: `server-config ${JSON.stringify({ available_models: invalid })}` })
    assert.deepEqual(f.api.serverConfig.value.available_models, ['synthetic-three', 'synthetic-two'])
    assert.equal(f.api.selectedModel.value, 'synthetic-two')
  }

  // Refresh removing current model falls back to first nonempty model
  broadcast.emit('message', { data: 'server-config {"available_models":["synthetic-one"]}' })
  assert.deepEqual(f.api.serverConfig.value.available_models, ['synthetic-one'])
  assert.equal(f.api.selectedModel.value, 'synthetic-one')

  // Empty valid list clears obsolete selection and omits model on send_chat
  broadcast.emit('message', { data: 'server-config {"available_models":[]}' })
  assert.deepEqual(f.api.serverConfig.value.available_models, [])
  assert.equal(f.api.selectedModel.value, '')
  f.api.inputText.value = 'no model question'
  f.api.sendMessage(); await tick()
  const emptyModelBody = JSON.parse(f.requests[0].init.body)
  assert.equal(Object.hasOwn(emptyModelBody, 'model'), false, 'empty valid list omits model on send_chat')
  f.requests[0].resolve(response('empty-model-task')); await tick()
  // Refreshing available_models while task is queued must not relabel the running answer
  broadcast.emit('message', { data: 'server-config {"available_models":["synthetic-one","synthetic-two"]}' })
  assert.equal(f.api.selectedModel.value, 'synthetic-one')
  f.sockets[1].emit('message', { data: 'data {"choices":[{"delta":{"content":"default answer"},"finish_reason":"stop"}]}' })
  assert.equal(f.api.history.value.at(-1).role, 'assistant', 'queued task with no model keeps assistant label across refresh')
  assert.equal(f.api.history.value.at(-1).content, 'default answer')

  // Queued task retains dispatched model label across refresh; next send uses new selection
  f.api.selectModel('synthetic-two')
  f.api.inputText.value = 'queued model question'
  f.api.sendMessage(); await tick()
  const queuedBody = JSON.parse(f.requests[1].init.body)
  assert.equal(queuedBody.model, 'synthetic-two')
  f.requests[1].resolve(response('queued-task')); await tick()
  broadcast.emit('message', { data: 'server-config {"available_models":["synthetic-one"]}' })
  assert.equal(f.api.selectedModel.value, 'synthetic-one')
  f.sockets[2].emit('message', { data: 'data {"choices":[{"delta":{"content":"model two answer"},"finish_reason":"stop"}]}' })
  assert.equal(f.api.history.value.at(-1).role, 'synthetic-two', 'queued task retains original dispatched model label')
  assert.equal(f.api.history.value.at(-1).content, 'model two answer')

  f.api.inputText.value = 'follow-up question'
  f.api.sendMessage(); await tick()
  const nextBody = JSON.parse(f.requests[2].init.body)
  assert.equal(nextBody.model, 'synthetic-one', 'future send uses refreshed model selection')
  f.requests[2].resolve(response('next-task')); await tick()
  // Refresh to empty during queue still retains synthetic-one label for running answer
  broadcast.emit('message', { data: 'server-config {"available_models":[]}' })
  assert.equal(f.api.selectedModel.value, '')
  f.sockets[3].emit('message', { data: 'data {"choices":[{"delta":{"content":"model one answer"},"finish_reason":"stop"}]}' })
  assert.equal(f.api.history.value.at(-1).role, 'synthetic-one')
  f.api.dispose()
}
// Establishment deadline covers headers and the JSON body, never the WS queue.
for (const stage of ['headers', 'body']) {
  for (const late of ['resolve', 'reject']) {
    const f = fixture(), body = deferred(), pending = f.api.callAI(); await tick()
    if (stage === 'body') { f.requests[0].resolve({ ok: true, json: () => body.promise }); await tick() }
    assert.equal(f.timers.size, 1)
    f.elapse(14999); await tick()
    assert.equal(f.api.taskStatus.value, 'queue')
    assert.equal(f.requests[0].init.signal.aborted, false)
    f.elapse(1); await pending
    assert.equal(f.api.taskStatus.value, 'none')
    assert.ok(f.api.taskError.value.includes('提交响应超时') && f.api.taskError.value.includes('服务器可能已接收'))
    assert.equal(f.requests.length, 1, 'timeout never retries the POST')
    assert.equal(f.requests[0].init.signal.aborted, true)
    assert.equal(f.timers.size, 0)
    const target = stage === 'body' ? body : f.requests[0]
    if (late === 'reject') target.reject(Error('late establishment failure'))
    else target.resolve(stage === 'body' ? { websocket_id: 'late' } : response('late'))
    await tick()
    assert.equal(f.sockets.length, 0, 'late establishment results cannot create a task socket')
  }
}
{
  const f = fixture(); await beginEdit(f)
  const body = deferred(); f.requests[0].resolve({ ok: true, json: () => body.promise }); await tick()
  f.elapse(15000); await tick()
  assertEditRestored(f)
  assert.ok(f.api.taskError.value.includes('提交响应超时'))
  f.api.editingContent.value = 'retry after establishment timeout'
  await f.api.confirmEditing({ preventDefault() {} }); await tick()
  f.requests[1].resolve(response('new-after-timeout')); await tick()
  const oldError = f.api.taskError.value
  body.resolve({ websocket_id: 'old-timed-out' }); await tick()
  assert.equal(f.sockets.length, 1)
  assert.ok(f.sockets[0].url.includes('new-after-timeout'))
  assert.equal(f.api.taskError.value, oldError)
  f.sockets[0].emit('message', { data: 'data {"choices":[{"delta":{"content":"new response"},"finish_reason":"stop"}]}' })
  assert.equal(f.api.history.value[0].content, 'retry after establishment timeout')
}
for (const action of ['stop', 'unmount']) {
  for (const stage of ['headers', 'body']) {
    const f = fixture(), body = deferred(), pending = f.api.callAI(); await tick()
    if (stage === 'body') { f.requests[0].resolve({ ok: true, json: () => body.promise }); await tick() }
    if (action === 'stop') f.api.stopTask(); else f.api.dispose()
    await pending
    assert.equal(f.timers.size, 0, `${action} clears ${stage} deadline`)
    assert.equal(f.requests[0].init.signal.aborted, true)
    f.elapse(60000); await tick()
    assert.equal(f.api.taskError.value, '', 'explicit cancellation does not become a timeout error')
    assert.equal(f.sockets.length, 0)
  }
}
{
  const f = fixture(), pending = f.api.callAI(); await tick()
  f.requests[0].resolve(response('long-legitimate-queue')); await pending
  assert.equal(f.timers.size, 0, 'valid task ID removes establishment deadline')
  f.elapse(60000); await tick()
  assert.equal(f.api.taskStatus.value, 'queue', 'legitimate WS queue has no submission deadline')
  assert.equal(f.requests.length, 1)
  assert.equal(f.sockets.length, 1)
  assert.equal(f.api.taskError.value, '')
  f.api.stopTask()
}
for (const ending of ['finish', 'error']) {
  const f = fixture()
  const el = { scrollTop: 100, scrollHeight: 1603, clientHeight: 456, isConnected: true,
    focus(options) { assert.deepEqual(options, { preventScroll: true }); f.document.activeElement = el },
  }
  f.api.messageAreaRef.value = el
  const pending = f.api.callAI(); await tick()
  f.requests[0].resolve(response('reading-position')); await pending
  f.sockets[0].emit('message', { data: 'data {"choices":[{"delta":{"content":"long model answer"}}]}' })
  await tick()
  assert.equal(f.api.isContentOverflowing.value, true)
  f.sockets[0].emit('message', { data: ending === 'finish' ? 'data {"choices":[{"delta":{},"finish_reason":"stop"}]}' : 'data {broken' })
  await tick(); f.stepFrame(1000)
  assert.equal(el.scrollTop, 100, 'automatic completion/error preserves the earlier reading position')
  assert.equal(f.frames.size, 0)
  assert.equal(f.api.taskStatus.value, 'none')
  assert.equal(f.api.isContentOverflowing.value, true, 'finished answers retain a latest-content entry')
  const button = { isConnected: true }; f.document.activeElement = button
  await f.api.scrollToBottom({ currentTarget: button })
  f.stepFrame(2000); await tick()
  assert.equal(el.scrollTop, 1147, 'explicit latest-content activation always reaches bottom')
  assert.ok(f.document.activeElement === el)
  assert.equal(f.api.isContentOverflowing.value, false)
}
assert.match(source, /@pointerdown="interruptMessageScroll"/, 'actual message-area template binds pointer interaction cancellation')
for (const input of ['wheel', 'touch', 'pointer', 'key', 'pending', 'pointer-pending']) {
  const f = fixture()
  const el = { scrollTop: 1480, scrollHeight: 2000, clientHeight: 500, isConnected: true }
  f.api.messageAreaRef.value = el
  const pending = f.api.scrollToBottom()
  if (!input.endsWith('pending')) { await pending; f.stepFrame(200) }
  const stale = [...f.frames.values()][0]
  if (input === 'key') f.api.handleMessageScrollKey({ key: 'PageUp', target: { closest: () => null } })
  else f.api.interruptMessageScroll()
  el.scrollTop = 100
  await pending; await tick()
  stale?.(1000); f.stepFrame(1000)
  assert.equal(el.scrollTop, 100, `${input} invalidates queued and active automatic scrolling`)
  assert.equal(f.frames.size, 0)
}
{
  const f = fixture()
  const el = { scrollTop: 1480, scrollHeight: 2000, clientHeight: 500, isConnected: true }
  f.api.messageAreaRef.value = el
  await f.api.scrollToBottom()
  f.api.handleMessageScrollKey({ key: 'ArrowUp', target: { closest: () => ({}) } })
  assert.equal(f.frames.size, 1, 'editing/control key events do not cancel message scrolling')
  f.api.history.value = []; f.api.checkContentOverflow(); await tick()
  assert.equal(f.api.isContentOverflowing.value, false, 'empty welcome does not create a useless latest-content entry')
  f.api.dispose()
}
for (const input of ['wheel', 'touchstart', 'pointerdown', 'focusin', 'key']) {
  const f = fixture()
  const panel = { scrollTop: 0, scrollHeight: 1400, clientHeight: 400, isConnected: true }
  f.api.controlPanelRef.value = panel
  f.api.schedulePanelDemo()
  const oldTimer = [...f.timers.values()][0]
  if (input === 'key') f.api.handlePanelScrollKey({ key: 'PageDown', target: { closest: () => null } })
  else f.api.interruptPanelDemo()
  panel.scrollTop = 333
  oldTimer(); f.elapse(1000); f.stepFrame(2000)
  assert.equal(panel.scrollTop, 333, `${input} before startup permanently cancels even a saved old timer callback`)
  assert.equal(f.frames.size, 0)
  assert.equal(f.timers.size, 0)
  f.api.schedulePanelDemo(); f.api.scrollControlPanel()
  assert.equal(f.frames.size + f.timers.size, 0)
}
for (const phase of ['down', 'up']) {
  const f = fixture()
  const panel = { scrollTop: 0, scrollHeight: 1400, clientHeight: 400, isConnected: true }
  const message = { scrollTop: 1480, scrollHeight: 2000, clientHeight: 500, isConnected: true }
  f.api.controlPanelRef.value = panel; f.api.messageAreaRef.value = message
  f.api.schedulePanelDemo(); f.elapse(500)
  if (phase === 'up') f.stepFrame(1000)
  f.stepFrame(phase === 'up' ? 1250 : 250)
  const oldPanelFrame = [...f.frames.values()][0]
  await f.api.scrollToBottom()
  assert.equal(f.frames.size, 2, 'panel and message animations coexist before cancellation')
  f.api.interruptPanelDemo(); panel.scrollTop = 333
  oldPanelFrame(2000); f.stepFrame(2500)
  assert.equal(panel.scrollTop, 333, `${phase} cancellation blocks stale RAF and next-stage writes`)
  assert.equal(message.scrollTop, 1500, 'panel interaction does not cancel independent message animation')
  assert.equal(f.frames.size, 0)
}
{
  const f = fixture(), panel = { scrollTop: 0, scrollHeight: 1400, clientHeight: 400, isConnected: true }
  f.api.controlPanelRef.value = panel
  f.api.schedulePanelDemo(); f.elapse(499)
  assert.equal(f.frames.size, 0)
  f.elapse(1); assert.equal(f.frames.size, 1)
  f.stepFrame(1000); assert.equal(panel.scrollTop, 1000)
  f.stepFrame(2000); assert.equal(panel.scrollTop, 0, 'untouched initial demo retains its down/up behavior')
  assert.equal(f.frames.size, 0)
}
{
  const f = fixture(), panel = { scrollTop: 0, scrollHeight: 1400, clientHeight: 400, isConnected: true }
  f.api.controlPanelRef.value = panel
  f.api.schedulePanelDemo(); const oldTimer = [...f.timers.values()][0]
  f.api.dispose(); oldTimer()
  assert.equal(f.timers.size + f.frames.size, 0, 'unmount invalidates pending startup callback')
}
const panelTemplate = source.slice(source.indexOf('<div id="control-panel"'), source.indexOf('<div id="button-area"'))
for (const event of ['wheel.passive', 'touchstart.passive', 'pointerdown', 'focusin']) {
  assert.ok(panelTemplate.includes(`@${event}="interruptPanelDemo"`), `${event} binds real panel cancellation`)
}
assert.ok(panelTemplate.includes('@keydown="handlePanelScrollKey"'))
assert.ok(!panelTemplate.includes('@scroll='), 'programmatic scrolling never cancels its own demo')
for (const legacy of [false, true]) {
  const f = fixture({ reduced: true, legacy })
  const panel = { scrollTop: 0, scrollHeight: 1400, clientHeight: 400, isConnected: true }
  const button = { isConnected: true }
  const message = { scrollTop: 100, scrollHeight: 1603, clientHeight: 456, isConnected: true,
    focus(options) { assert.deepEqual(options, { preventScroll: true }); f.document.activeElement = message },
  }
  f.api.controlPanelRef.value = panel; f.api.messageAreaRef.value = message
  f.api.setupReducedMotion(); f.api.schedulePanelDemo()
  assert.equal(f.api.prefersReducedMotion.value, true)
  assert.equal(f.timers.size + f.frames.size, 0, 'initial reduce does not schedule decorative panel demo')
  await f.api.scrollToBottom()
  assert.equal(f.frames.size, 0, 'reduce keeps automatic away-from-bottom reading protection')
  f.document.activeElement = button
  await f.api.scrollToBottom({ currentTarget: button })
  f.stepFrame(0)
  assert.equal(message.scrollTop, 1147, 'reduced-motion explicit scroll reaches bottom in one frame')
  assert.ok(f.document.activeElement === message)
  assert.equal(f.frames.size, 0)
  f.changeMotion(false); f.api.schedulePanelDemo()
  assert.equal(f.timers.size, 0, 'returning to normal does not restart initial demo')
  const late = [...f.motionListeners][0]
  f.api.dispose()
  assert.equal(f.motionListeners.size, 0, 'modern and legacy listeners are removed with matching API')
  assert.equal(f.removedMotionListeners.length, 1)
  late({ matches: true })
  assert.equal(f.api.prefersReducedMotion.value, false, 'saved media callback is inert after unmount')
}
for (const phase of ['pending', 'active']) {
  const f = fixture({ reduced: false })
  const panel = { scrollTop: 0, scrollHeight: 1400, clientHeight: 400, isConnected: true }
  const message = { scrollTop: 1480, scrollHeight: 2000, clientHeight: 500, isConnected: true }
  f.api.controlPanelRef.value = panel; f.api.messageAreaRef.value = message
  f.api.setupReducedMotion(); f.api.schedulePanelDemo()
  const timer = [...f.timers.values()][0]
  if (phase === 'active') { f.elapse(500); f.stepFrame(250) }
  await f.api.scrollToBottom(); f.stepFrame(400)
  const staleFrames = [...f.frames.values()]
  const before = [panel.scrollTop, message.scrollTop]
  f.changeMotion(true)
  timer(); staleFrames.forEach(frame => frame(2000)); f.stepFrame(2000)
  assert.deepEqual([panel.scrollTop, message.scrollTop], before, 'changing to reduce cancels both current RAF owners and startup timer')
  assert.equal(f.timers.size + f.frames.size, 0)
  await f.api.scrollToBottom({ currentTarget: null }); f.stepFrame(2000)
  assert.equal(message.scrollTop, 1500, 'preference cancellation does not permanently dispose explicit scrolling')
  f.api.dispose()
}
for (const options of [null, { reduced: false, throw: true }]) {
  const f = fixture(options)
  f.api.controlPanelRef.value = { scrollTop: 0, scrollHeight: 1400, clientHeight: 400, isConnected: true }
  f.api.setupReducedMotion(); f.api.schedulePanelDemo()
  assert.equal(f.api.prefersReducedMotion.value, false)
  assert.equal(f.timers.size, 1, 'missing or unavailable matchMedia safely preserves normal mode')
  f.elapse(500); f.stepFrame(500)
  assert.equal(f.api.controlPanelRef.value.scrollTop, 500)
  f.stepFrame(1000); f.stepFrame(2000)
  assert.equal(f.api.controlPanelRef.value.scrollTop, 0)
  f.api.dispose()
}
const styleCheck = compileStyle({ source: parse(source).descriptor.styles[0].content, filename: 'ai.vue', id: 'ai-motion-check', scoped: true })
assert.equal(styleCheck.errors.length, 0)
assert.ok(styleCheck.code.includes('@media (prefers-reduced-motion: reduce)'))
for (const count of [0, 1234, -1, -2, 1.5, null, undefined, {}, [], '123', NaN, Infinity]) {
  const f = fixture(), pending = f.api.fetchExecutedTaskCount(); await tick()
  assert.equal(f.requests.length, 1)
  assert.equal(f.requests[0].init.method, 'GET')
  f.requests[0].resolve({ ok: true, json: async () => ({ executed_task: count }) }); await pending
  const valid = typeof count === 'number' && Number.isFinite(count) && Number.isInteger(count) && count >= 0
  assert.equal(f.api.executedTaskCount.value, valid ? count : -1)
  assert.equal(f.timers.size, 0)
  f.api.dispose()
}
for (const stage of ['headers', 'body']) {
  for (const ending of ['timeout', 'unmount']) {
    const f = fixture(), body = deferred(), pending = f.api.fetchExecutedTaskCount(); await tick()
    if (stage === 'body') { f.requests[0].resolve({ ok: true, json: () => body.promise }); await tick() }
    if (ending === 'timeout') { f.elapse(14999); await tick(); assert.equal(f.requests[0].init.signal.aborted, false); f.elapse(1) }
    else f.api.dispose()
    await pending
    assert.equal(f.requests[0].init.signal.aborted, true)
    assert.equal(f.timers.size, 0)
    const before = f.api.executedTaskCount.value
    if (stage === 'body') body.resolve({ executed_task: 999 }); else f.requests[0].resolve({ ok: true, json: async () => ({ executed_task: 999 }) })
    await tick()
    assert.equal(f.api.executedTaskCount.value, before, 'late statistics cannot update after timeout/unmount')
    if (ending === 'timeout') assert.equal(before, -1)
    assert.equal(f.requests.length, 1)
    f.api.dispose()
  }
}
{
  const f = fixture()
  f.api.history.value = originalEditHistory.map(message => ({ ...message }))
  f.api.startEdit(0)
  assert.equal(f.api.editingIndex.value, 0, 'ordinary entry opens editing when no edit is active')
  assert.equal(f.api.editingContent.value, 'original question')
  f.api.editingContent.value = 'UNSAVED'
  for (const target of [2, 0]) {
    f.api.startEdit(target)
    assert.equal(f.api.editingIndex.value, 0, 'other and same-index business calls cannot replace an active editor')
    assert.equal(f.api.editingContent.value, 'UNSAVED')
    assert.deepEqual(f.api.history.value, originalEditHistory)
  }
  await f.api.exitEditing()
  f.api.startEdit(2)
  assert.equal(f.api.editingIndex.value, 2, 'cancel releases the edit lock for another message')
  assert.equal(f.api.editingContent.value, 'later question')
  assert.equal(f.requests.length, 0)
}
{
  const f = fixture(); await beginEdit(f)
  f.requests[0].resolve({ ok: false, status: 503, statusText: 'Unavailable' }); await tick()
  assertEditRestored(f)
  for (const target of [2, 0]) {
    f.api.startEdit(target)
    assertEditRestored(f)
  }
  f.api.dispose()
}
{
  const f = fixture()
  f.api.connectBroadcastSocket()
  const broadcast = f.sockets[0]
  const pending = f.api.callAI(); await tick(); f.requests[0].resolve(response('valid-active')); await pending
  f.sockets[1].emit('message', { data: 'data {"choices":[{"delta":{"content":"preserve running answer"}}]}' })
  broadcast.emit('message', { data: 'broadcast {"broadcast_flag":9,"waiting_count":4,"executing_count":2}' })
  for (const invalid of ['9', '10', null, -1, {}, []]) {
    broadcast.emit('message', { data: `broadcast ${JSON.stringify({ broadcast_flag: invalid, waiting_count: 999, executing_count: 999 })}` })
    assert.equal(f.api.lastBroadcastFlag.value, 9)
    assert.equal(f.api.waitingCount.value, 4)
    assert.equal(f.api.executingCount.value, 2)
  }
  for (const invalid of [new Uint8Array([1, 2]), 'broadcast null', 'broadcast []', 'broadcast {"broadcast_flag":1e999,"waiting_count":999}']) {
    assert.doesNotThrow(() => broadcast.emit('message', { data: invalid }))
    assert.equal(f.api.waitingCount.value, 4)
    assert.equal(f.api.lastBroadcastFlag.value, 9)
  }
  for (const flag of [9.5, 10, 10.25]) {
    broadcast.emit('message', { data: `broadcast ${JSON.stringify({ broadcast_flag: flag, waiting_count: 5 })}` })
    assert.equal(f.api.lastBroadcastFlag.value, flag, 'numeric flags, including fractional timestamps, remain ordered numerically')
  }
  broadcast.emit('message', { data: 'broadcast {"broadcast_flag":9,"waiting_count":999}' })
  assert.equal(f.api.waitingCount.value, 5, 'older valid flags remain ignored')
  broadcast.emit('message', { data: 'broadcast {"broadcast_flag":11,"waiting_count":{},"executing_count":0}' })
  assert.equal(f.api.waitingCount.value, 5)
  assert.equal(f.api.executingCount.value, 0)
  broadcast.emit('message', { data: 'broadcast {"waiting_count":0,"executing_count":-2}' })
  assert.equal(f.api.waitingCount.value, 0, 'unflagged valid counts and zero remain compatible')
  assert.equal(f.api.executingCount.value, 0)
  for (const invalid of [null, '3', -1, 1.5, {}, []]) {
    broadcast.emit('message', { data: `broadcast ${JSON.stringify({ waiting_count: invalid, executing_count: invalid })}` })
    assert.equal(f.api.waitingCount.value, 0)
    assert.equal(f.api.executingCount.value, 0)
  }
  broadcast.emit('message', { data: 'server-config {"max_concurrent_tasks":3}' })
  for (const invalid of [null, '4', -1, 1.5, {}, []]) {
    broadcast.emit('message', { data: `server-config ${JSON.stringify({ max_concurrent_tasks: invalid })}` })
    assert.equal(f.api.serverConfig.value.max_concurrent_tasks, 3)
  }
  broadcast.emit('message', { data: 'server-config {"max_concurrent_tasks":0}' })
  assert.equal(f.api.serverConfig.value.max_concurrent_tasks, 0)
  assert.equal(f.api.taskStatus.value, 'running', 'invalid control frames do not terminate an active task')
  assert.equal(f.sockets[1].closed, false)
  assert.equal(f.api.history.value.at(-1).content, 'preserve running answer')
  f.api.dispose()
}
{
  const id = 'task+part&extra=1?x#片 段/%'
  const f = fixture(), pending = f.api.callAI(); await tick()
  f.requests[0].resolve(response(id)); await pending
  f.sockets[0].emit('close', { code: 1006 }); f.runTimer()
  assert.equal(f.sockets.length, 2)
  for (const socket of f.sockets) {
    const url = new URL(socket.url)
    assert.equal(url.searchParams.get('id'), id, 'opaque task ID survives initial and reconnect URL decoding')
    assert.deepEqual([...url.searchParams.keys()], ['id'], 'task ID cannot inject extra query parameters')
    assert.equal(url.hash, '')
  }
  assert.equal(f.requests.length, 1, 'task socket reconnect does not resubmit POST')
  f.api.dispose()
}
console.log('AI session checks passed (actual business functions; all HTTP/WebSocket/timers mocked)')
