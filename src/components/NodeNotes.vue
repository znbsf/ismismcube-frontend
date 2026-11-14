<template>
  <div class="node_notes_root">
    <div class="notes_intro">
      按“编号 / 论点 / 出处 / 待解决问题”记下这一讲。笔记只保存在本浏览器，可导出备份。
    </div>

    <div class="notes_status_row">
      <div v-if="storageError" class="notes_status_error_box">
        <span class="notes_status_error">
          {{
            unsavedInMemory
              ? '保存失败：未能写入浏览器存储（当前改动仅暂存在本页内存，请重试保存或导出备份）'
              : '存储异常：浏览器本地笔记读取或写入失败，请重试或导出备份'
          }}
        </span>
        <div class="notes_error_actions">
          <button type="button" class="notes_action_btn" @click="retryPersist">
            {{ unsavedInMemory || isDirty ? '重试保存' : '重试读取' }}
          </button>
          <button type="button" class="notes_action_btn" @click="exportJson">
            导出 JSON
          </button>
          <button type="button" class="notes_action_btn" @click="exportMarkdown">
            导出 Markdown
          </button>
        </div>
        <div v-if="retryMessage" class="notes_retry_message">
          {{ retryMessage }}
        </div>
      </div>
      <span v-else-if="lastSavedTime" class="notes_status_ok">
        已保存 {{ lastSavedTime }}
      </span>
      <span v-else class="notes_status_idle">
        输入后自动保存
      </span>
    </div>

    <label class="notes_field">
      <span class="notes_field_label">论点（用自己的话）</span>
      <textarea
        v-model="draftClaim"
        class="notes_textarea"
        rows="3"
        @input="scheduleSave"
      />
    </label>

    <label class="notes_field">
      <span class="notes_field_label">支持它的局部出处（讲次、页码或行号）</span>
      <textarea
        v-model="draftSource"
        class="notes_textarea"
        rows="3"
        @input="scheduleSave"
      />
    </label>

    <label class="notes_field">
      <span class="notes_field_label">尚未解决的问题</span>
      <textarea
        v-model="draftQuestion"
        class="notes_textarea"
        rows="3"
        @input="scheduleSave"
      />
    </label>

    <div v-if="readings.length > 0" class="notes_section">
      <div class="notes_section_title">原典对照</div>
      <div
        v-for="(rd, idx) in readings"
        :key="`${rd.source_id}-${rd.relation}-${idx}`"
        class="notes_reading_card"
      >
        <div class="notes_reading_header">
          <a
            :href="rd.url"
            target="_blank"
            rel="noopener noreferrer"
            class="notes_reading_link"
          >
            {{ rd.title }}
          </a>
          <span
            class="notes_reading_badge"
            :class="rd.relation === 'lecture_explicit_reference' ? 'rel_explicit' : 'rel_editorial'"
          >
            {{ rd.relation === 'lecture_explicit_reference' ? '讲稿显式提及' : '编者延展对读' }}
          </span>
        </div>
        <div v-if="rd.locator" class="notes_reading_locator">
          定位：{{ rd.locator }}
        </div>
        <label class="notes_field">
          <span class="notes_field_label">原文论证（原典本身说了什么）</span>
          <textarea
            :value="getReadingOriginal(rd.source_id)"
            class="notes_textarea"
            rows="3"
            @input="setReadingOriginal(rd.source_id, ($event.target as HTMLTextAreaElement).value)"
          />
        </label>
        <label class="notes_field">
          <span class="notes_field_label">课程解释（课程如何使用它）</span>
          <textarea
            :value="getReadingInterpretation(rd.source_id)"
            class="notes_textarea"
            rows="3"
            @input="setReadingInterpretation(rd.source_id, ($event.target as HTMLTextAreaElement).value)"
          />
        </label>
      </div>
      <div class="notes_muted_hint">
        编者延展对读不等于原课明确推荐。
      </div>
    </div>

    <div class="notes_actions_row">
      <button type="button" class="notes_action_btn" @click="exportMarkdown">
        导出 Markdown
      </button>
      <button type="button" class="notes_action_btn" @click="exportJson">
        导出 JSON
      </button>
      <button type="button" class="notes_action_btn" @click="triggerImport">
        导入 JSON
      </button>
      <input
        ref="importInputRef"
        type="file"
        accept=".json,application/json"
        class="notes_file_input"
        @change="handleImportFile"
      >
      <button type="button" class="notes_action_btn danger" @click="clearCurrentNote">
        清空本节点笔记
      </button>
    </div>
    <div v-if="importResultMessage" class="notes_import_result" :class="{ is_error: importResultIsError }">
      {{ importResultMessage }}
    </div>

    <div class="notes_section">
      <div class="notes_section_title">全部笔记（{{ allNotesList.length }}）</div>
      <div v-if="allNotesList.length === 0" class="notes_empty_hint">
        当前还没有已保存的笔记。
      </div>
      <div v-else class="notes_all_list">
        <button
          v-for="item in allNotesList"
          :key="item.code"
          type="button"
          class="notes_jump_btn"
          :class="{ is_current: item.code === code }"
          @click="emit('jump', item.code)"
        >
          {{ item.title ? `${item.code} ${item.title}` : item.code }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { NodeReadingLink } from '../types/research'
import {
  cloneNotesState,
  isNoteEmpty,
  isValidNodeCode,
  loadNotes,
  mergeNotesState,
  notesStorageError,
  notesToMarkdown,
  notesUnsavedInMemory,
  parseNotesImport,
  saveNotes,
  type NodeNote,
  type NotesState,
  type ReadingNote
} from '../utils/notesStore'

const props = defineProps<{
  code: string
  title: string
  readings: NodeReadingLink[]
  getTitle: (code: string) => string
  getReadingTitle?: (sourceId: string) => string
}>()

const emit = defineEmits<{
  (e: 'jump', code: string): void
  (e: 'updated', state: NotesState): void
}>()

const notesState = ref<NotesState>({ version: 1, nodes: {} })
const draftClaim = ref('')
const draftSource = ref('')
const draftQuestion = ref('')
const draftReadings = ref<Record<string, ReadingNote>>({})
const lastSavedTime = ref('')
const importResultMessage = ref('')
const importResultIsError = ref(false)
const retryMessage = ref('')
const importInputRef = ref<HTMLInputElement | null>(null)
const isDirty = ref(false)

const storageError = computed(() => notesStorageError.value)
const unsavedInMemory = computed(() => notesUnsavedInMemory.value)

let saveTimer: number | null = null

const formatTimeHHMM = (value: Date | string): string => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

const loadDraftForCode = (code: string) => {
  const existing = code ? notesState.value.nodes[code] : undefined
  if (existing) {
    draftClaim.value = existing.claim
    draftSource.value = existing.source
    draftQuestion.value = existing.question
    const nextReadings: Record<string, ReadingNote> = {}
    for (const [sid, entry] of Object.entries(existing.readings)) {
      nextReadings[sid] = {
        original: entry.original,
        interpretation: entry.interpretation
      }
    }
    draftReadings.value = nextReadings
    lastSavedTime.value = notesStorageError.value ? '' : formatTimeHHMM(existing.updatedAt)
  } else {
    draftClaim.value = ''
    draftSource.value = ''
    draftQuestion.value = ''
    draftReadings.value = {}
    lastSavedTime.value = ''
  }
  isDirty.value = false
}

const commitSaveForCode = (targetCode: string) => {
  if (!targetCode || !isValidNodeCode(targetCode)) {
    isDirty.value = false
    return
  }

  const nowIso = new Date().toISOString()
  const cleanedReadings: Record<string, ReadingNote> = {}
  for (const [sid, entry] of Object.entries(draftReadings.value)) {
    if (entry.original.trim() !== '' || entry.interpretation.trim() !== '') {
      cleanedReadings[sid] = {
        original: entry.original,
        interpretation: entry.interpretation
      }
    }
  }

  const note: NodeNote = {
    claim: draftClaim.value,
    source: draftSource.value,
    question: draftQuestion.value,
    readings: cleanedReadings,
    updatedAt: nowIso
  }

  const nextNodes = { ...notesState.value.nodes }
  if (isNoteEmpty(note)) {
    delete nextNodes[targetCode]
  } else {
    nextNodes[targetCode] = note
  }

  const nextState: NotesState = {
    version: 1,
    nodes: nextNodes
  }

  const ok = saveNotes(nextState)
  notesState.value = cloneNotesState(nextState)
  isDirty.value = false
  if (ok) {
    lastSavedTime.value = isNoteEmpty(note) ? '' : formatTimeHHMM(nowIso)
    retryMessage.value = ''
  } else {
    lastSavedTime.value = ''
  }
  emit('updated', cloneNotesState(notesState.value))
}

const flushPendingSave = (targetCode: string) => {
  if (saveTimer !== null) {
    window.clearTimeout(saveTimer)
    saveTimer = null
  }
  if (isDirty.value && targetCode) {
    commitSaveForCode(targetCode)
  }
}

const scheduleSave = () => {
  isDirty.value = true
  retryMessage.value = ''
  if (saveTimer !== null) {
    window.clearTimeout(saveTimer)
    saveTimer = null
  }
  saveTimer = window.setTimeout(() => {
    saveTimer = null
    commitSaveForCode(props.code)
  }, 400)
}

const retryPersist = () => {
  retryMessage.value = ''
  if (isDirty.value) {
    flushPendingSave(props.code)
    if (notesStorageError.value) {
      retryMessage.value = '重试保存仍失败：浏览器存储不可用，请先导出备份'
    }
    return
  }
  if (notesUnsavedInMemory.value) {
    const ok = saveNotes(notesState.value)
    if (ok) {
      const current = notesState.value.nodes[props.code]
      lastSavedTime.value = current && !isNoteEmpty(current) ? formatTimeHHMM(current.updatedAt) : ''
      emit('updated', cloneNotesState(notesState.value))
    } else {
      retryMessage.value = '重试保存仍失败：浏览器存储不可用，请先导出备份'
    }
    return
  }
  notesState.value = loadNotes()
  loadDraftForCode(props.code)
  emit('updated', cloneNotesState(notesState.value))
  if (notesStorageError.value) {
    retryMessage.value = '重试读取仍失败：浏览器存储不可用或数据格式损坏'
  }
}

const getReadingOriginal = (sourceId: string): string => {
  return draftReadings.value[sourceId]?.original ?? ''
}

const setReadingOriginal = (sourceId: string, val: string) => {
  const prev = draftReadings.value[sourceId] ?? { original: '', interpretation: '' }
  draftReadings.value = {
    ...draftReadings.value,
    [sourceId]: { ...prev, original: val }
  }
  scheduleSave()
}

const getReadingInterpretation = (sourceId: string): string => {
  return draftReadings.value[sourceId]?.interpretation ?? ''
}

const setReadingInterpretation = (sourceId: string, val: string) => {
  const prev = draftReadings.value[sourceId] ?? { original: '', interpretation: '' }
  draftReadings.value = {
    ...draftReadings.value,
    [sourceId]: { ...prev, interpretation: val }
  }
  scheduleSave()
}

const allNotesList = computed(() => {
  return Object.entries(notesState.value.nodes)
    .filter(([, note]) => !isNoteEmpty(note))
    .sort((a, b) => Date.parse(b[1].updatedAt) - Date.parse(a[1].updatedAt))
    .map(([code]) => ({
      code,
      title: props.getTitle(code)
    }))
})

const downloadTextFile = (filename: string, content: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const exportMarkdown = () => {
  flushPendingSave(props.code)
  const md = notesToMarkdown(notesState.value, props.getTitle, props.getReadingTitle)
  downloadTextFile('ismism-notes.md', md, 'text/markdown;charset=utf-8')
}

const exportJson = () => {
  flushPendingSave(props.code)
  const json = JSON.stringify(cloneNotesState(notesState.value), null, 2)
  downloadTextFile('ismism-notes.json', json, 'application/json;charset=utf-8')
}

const triggerImport = () => {
  importInputRef.value?.click()
}

const handleImportFile = async (event: Event) => {
  const input = event.target as HTMLInputElement | null
  const file = input?.files?.[0]
  if (!file) return

  importResultIsError.value = false
  retryMessage.value = ''

  try {
    const text = await file.text()
    const parsed = parseNotesImport(text)
    if (!parsed) {
      importResultIsError.value = true
      importResultMessage.value = '导入失败：JSON 格式、字段结构或节点编号无效（仅接受 1-4 级且每段为 1-4 的编号）'
      return
    }

    flushPendingSave(props.code)

    const merged = mergeNotesState(notesState.value, parsed)
    const ok = saveNotes(merged.state)
    notesState.value = cloneNotesState(merged.state)
    loadDraftForCode(props.code)
    emit('updated', cloneNotesState(notesState.value))

    if (!ok) {
      importResultIsError.value = true
      importResultMessage.value = `写入浏览器存储失败：仅在当前页面内存合并 ${merged.importedCount} 条、跳过 ${merged.skippedCount} 条，请重试保存或导出备份`
      return
    }

    if (merged.skippedNewerLocalCount > 0) {
      importResultMessage.value = `已导入 ${merged.importedCount} 条，跳过 ${merged.skippedCount} 条（其中 ${merged.skippedNewerLocalCount} 条保留了较新的本地笔记）`
    } else {
      importResultMessage.value = `已导入 ${merged.importedCount} 条，跳过 ${merged.skippedCount} 条`
    }
  } catch {
    importResultIsError.value = true
    importResultMessage.value = '导入失败：读取文件出错'
  } finally {
    if (input) {
      input.value = ''
    }
  }
}

const clearCurrentNote = () => {
  if (!props.code) return
  if (!window.confirm(`清空 ${props.code} 的笔记？`)) return

  if (saveTimer !== null) {
    window.clearTimeout(saveTimer)
    saveTimer = null
  }
  draftClaim.value = ''
  draftSource.value = ''
  draftQuestion.value = ''
  draftReadings.value = {}
  isDirty.value = false
  retryMessage.value = ''

  const nextNodes = { ...notesState.value.nodes }
  delete nextNodes[props.code]

  const nextState: NotesState = {
    version: 1,
    nodes: nextNodes
  }

  const ok = saveNotes(nextState)
  notesState.value = cloneNotesState(nextState)
  lastSavedTime.value = ''
  emit('updated', cloneNotesState(notesState.value))
  if (!ok) {
    retryMessage.value = '清空未写入浏览器存储，请重试保存或导出备份'
  }
}

const handlePageLeave = () => {
  flushPendingSave(props.code)
}

const handleVisibilityChange = () => {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    flushPendingSave(props.code)
  }
}

watch(
  () => props.code,
  (newCode, oldCode) => {
    flushPendingSave(oldCode)
    importResultMessage.value = ''
    importResultIsError.value = false
    retryMessage.value = ''
    loadDraftForCode(newCode)
  }
)

onMounted(() => {
  notesState.value = loadNotes()
  loadDraftForCode(props.code)
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', handlePageLeave)
    window.addEventListener('beforeunload', handlePageLeave)
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange)
  }
})

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('pagehide', handlePageLeave)
    window.removeEventListener('beforeunload', handlePageLeave)
  }
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
  flushPendingSave(props.code)
})
</script>

<style scoped>
.node_notes_root {
  display: flex;
  flex-direction: column;
  gap: 0.55em;
  width: 100%;
  box-sizing: border-box;
  color: black;
}

.node_notes_root button:focus-visible,
.node_notes_root textarea:focus-visible {
  outline: 2px solid darkcyan;
  outline-offset: 1px;
}

.notes_intro {
  font-size: 0.86em;
  color: rgb(52, 52, 52);
  padding: 0.35em 0.5em;
  background-color: rgb(216, 216, 216);
  border: 1px solid rgb(145, 145, 145);
}

.notes_status_row {
  font-size: 0.8em;
  min-height: 1.2em;
}

.notes_status_ok {
  color: rgb(28, 92, 28);
}

.notes_status_error_box {
  display: flex;
  flex-direction: column;
  gap: 0.35em;
  padding: 0.4em 0.5em;
  background-color: rgb(252, 236, 236);
  border: 1px solid rgb(165, 55, 55);
}

.notes_status_error {
  color: #a00000;
  font-weight: bold;
}

.notes_error_actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35em;
}

.notes_retry_message {
  color: #a00000;
  font-size: 0.95em;
}

.notes_status_idle {
  color: rgb(85, 85, 85);
}

.notes_field {
  display: flex;
  flex-direction: column;
  gap: 0.2em;
  width: 100%;
}

.notes_field_label {
  font-size: 0.86em;
  font-weight: bold;
  color: rgb(35, 35, 35);
}

.notes_textarea {
  font: inherit;
  width: 100%;
  min-height: 4.5em;
  padding: 0.35em 0.45em;
  box-sizing: border-box;
  border: 1px solid rgb(110, 110, 110);
  background-color: rgb(246, 246, 246);
  color: black;
  resize: vertical;
  line-height: 1.4;
}

.notes_section {
  display: flex;
  flex-direction: column;
  gap: 0.38em;
  padding-top: 0.25em;
  border-top: 1px dashed rgb(140, 140, 140);
}

.notes_section_title {
  font-weight: bold;
  font-size: 0.9em;
  padding-bottom: 0.15em;
  border-bottom: 1px solid rgb(140, 140, 140);
}

.notes_reading_card {
  display: flex;
  flex-direction: column;
  gap: 0.3em;
  padding: 0.42em 0.55em;
  background-color: rgb(222, 222, 222);
  border: 1px solid rgb(135, 135, 135);
}

.notes_reading_header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.3em;
}

.notes_reading_link {
  font-weight: bold;
  color: rgb(16, 86, 136);
  word-break: break-word;
}

.notes_reading_badge {
  display: inline-block;
  padding: 0.04em 0.32em;
  font-size: 0.76em;
  border: 1px solid rgb(95, 95, 95);
}

.notes_reading_badge.rel_explicit {
  background-color: rgb(215, 240, 215);
  border: 1px solid rgb(24, 58, 24);
  font-weight: bold;
}

.notes_reading_badge.rel_editorial {
  background-color: rgb(226, 228, 248);
  border: 1px dashed rgb(110, 110, 110);
}

.notes_reading_locator {
  font-size: 0.82em;
  color: rgb(65, 65, 65);
}

.notes_muted_hint,
.notes_empty_hint {
  font-size: 0.8em;
  color: rgb(75, 75, 75);
}

.notes_actions_row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35em;
  padding-top: 0.2em;
}

.notes_action_btn {
  font: inherit;
  font-size: 0.82em;
  padding: 0.2em 0.55em;
  background-color: rgb(206, 232, 232);
  border: 1px solid black;
  color: black;
  cursor: pointer;
}

.notes_action_btn:hover {
  background-color: darkcyan;
  color: white;
}

.notes_action_btn.danger {
  background-color: rgb(244, 224, 224);
  border-color: rgb(135, 50, 50);
}

.notes_action_btn.danger:hover {
  background-color: rgb(165, 45, 45);
  color: white;
}

.notes_file_input {
  display: none;
}

.notes_import_result {
  font-size: 0.82em;
  color: rgb(35, 75, 75);
}

.notes_import_result.is_error {
  color: #a00000;
  font-weight: bold;
}

.notes_all_list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3em;
}

.notes_jump_btn {
  font: inherit;
  font-size: 0.82em;
  padding: 0.18em 0.45em;
  background-color: rgb(226, 226, 226);
  border: 1px solid rgb(100, 100, 100);
  color: black;
  cursor: pointer;
  text-align: left;
  word-break: break-word;
}

.notes_jump_btn:hover {
  background-color: rgb(206, 232, 232);
  border-color: black;
}

.notes_jump_btn.is_current {
  background-color: darkcyan;
  color: white;
  border-color: black;
}
</style>
