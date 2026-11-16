<template>
  <div ref="notesRootRef" class="node_notes_root" tabindex="-1" role="region" aria-label="当前节点笔记">
    <div class="notes_intro">
      按“编号 / 论点 / 出处 / 待解决问题”记下这一讲。笔记只保存在本浏览器，可导出备份。
    </div>

    <div class="notes_status_row">
      <div v-if="storageError" class="notes_status_error_box">
        <span v-if="notesConflictCodes.length" class="notes_status_error">
          其它标签页已修改节点 {{ notesConflictCodes.join('、') }}，本页草稿尚未写入。可直接逐节点对比并选择保留版本；建议另行导出备份。
        </span>
        <span v-if="notesReadBlocked" class="notes_status_error">
          原存储尚未成功读取，已阻止覆盖。请备份后恢复读取；本页编辑仅保留在内存。
        </span>
        <span class="notes_status_error">
          {{
            unsavedInMemory
              ? '保存失败：未能写入浏览器存储（当前改动仅暂存在本页内存，请重试保存或导出备份）'
              : '存储异常：浏览器本地笔记读取或写入失败，请重试或导出备份'
          }}
        </span>
        <div class="notes_error_actions">
          <button v-if="notesConflictCodes.length && !notesReadBlocked" type="button" class="notes_action_btn" @click="openConflictReview">
            逐节点对比冲突
          </button>
          <button v-if="notesConflictCodes.length || notesReadBlocked" type="button" class="notes_action_btn" @click="readExternalVersion">
            读取外部版本（丢弃本页草稿）
          </button>
          <button v-if="notesReadBlocked && notesRawBackup !== null" type="button" class="notes_action_btn" @click="exportRawBackup">
            下载原始存储备份
          </button>
          <button v-if="notesReadBlocked && downloadedRawBackup !== null && downloadedRawBackup === notesRawBackup" type="button" class="notes_action_btn danger" @click="initializeEmptyStorage">
            已备份，建立空笔记存储
          </button>
          <button type="button" class="notes_action_btn" @click="retryPersist">
            {{ notesReadBlocked && (unsavedInMemory || isDirty) ? '重试读取并保存草稿' : unsavedInMemory || isDirty ? '重试保存' : '重试读取' }}
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
        <section v-if="conflictReviewOpen" class="notes_conflict_review" aria-label="逐节点解决笔记冲突">
          <p>逐节点选择要保留的完整版本。未冲突的草稿会保留；全部选择后统一保存。</p>
          <p v-if="conflictReviewMessage" role="status">{{ conflictReviewMessage }}</p>
          <button type="button" class="notes_action_btn" @click="openConflictReview">刷新对比（清除选择）</button>
          <fieldset v-for="item in conflictReview?.conflicts ?? []" :key="item.code" class="notes_conflict_card">
            <legend>{{ item.code }} {{ getTitle(item.code) }}</legend>
            <div class="notes_conflict_versions">
              <div class="notes_conflict_version">
                <label><input type="radio" :name="`conflict-${conflictReview?.id}-${item.code}`" value="local"
                  :checked="conflictChoices[item.code] === 'local'" @change="conflictChoices[item.code] = 'local'"> 保留本页版本</label>
                <pre>{{ conflictNoteText(item.local) }}</pre>
              </div>
              <div class="notes_conflict_version">
                <label><input type="radio" :name="`conflict-${conflictReview?.id}-${item.code}`" value="external"
                  :checked="conflictChoices[item.code] === 'external'" @change="conflictChoices[item.code] = 'external'"> 采用外部版本</label>
                <pre>{{ conflictNoteText(item.external) }}</pre>
              </div>
            </div>
          </fieldset>
          <button type="button" class="notes_action_btn notes_conflict_apply" :disabled="!canApplyConflictChoices" @click="applyConflictChoices">
            应用逐节点选择并保存
          </button>
        </section>
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { registerNotesLeaveFlusher } from '../utils/notesLeaveGuard'
import type { NodeReadingLink } from '../types/research'
import {
  cloneNotesState,
  getCurrentNotes,
  initializeAfterCorruption,
  invalidateNotesConflictPreview,
  isNoteEmpty,
  isValidNodeCode,
  loadNotes,
  mergeNotesState,
  notesStorageError,
  notesConflictCodes,
  notesConflictRevision,
  notesReadBlocked,
  notesRawBackup,
  reloadExternalNotes,
  retryNotesAfterReadFailure,
  notesToMarkdown,
  notesUnsavedInMemory,
  parseNotesImport,
  previewNotesConflicts,
  resolveNotesConflicts,
  saveNotes,
  type NodeNote,
  type NotesState,
  type ReadingNote,
  type NotesConflictPreview,
  type ConflictChoice
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
const downloadedRawBackup = ref<string | null>(null)
const conflictReviewOpen = ref(false)
const conflictReview = ref<NotesConflictPreview | null>(null)
const conflictChoices = ref<Record<string, ConflictChoice>>({})
const conflictReviewMessage = ref('')
let lastPreviewRevision = -1
const canApplyConflictChoices = computed(() => Boolean(conflictReview.value?.conflicts.length) &&
  conflictReview.value!.conflicts.every(item => conflictChoices.value[item.code] === 'local' || conflictChoices.value[item.code] === 'external'))

const storageError = computed(() => notesStorageError.value)
const unsavedInMemory = computed(() => notesUnsavedInMemory.value)

let saveTimer: number | null = null
let importGeneration = 0
let isUnmounted = false

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
  notesState.value = ok ? getCurrentNotes() : cloneNotesState(nextState)
  isDirty.value = false
  if (ok) {
    closeConflictReview()
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
  invalidateNotesConflictPreview()
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

const notesRootRef = ref<HTMLElement | null>(null)
const handoffRecoveryFocus = (event?: MouseEvent) => {
  if (isUnmounted || !event || event.currentTarget !== document.activeElement) return
  const target = notesRootRef.value
  if (target?.isConnected && target.getClientRects().length > 0) target.focus({ preventScroll: true })
}

const retryPersist = (event?: MouseEvent) => {
  handoffRecoveryFocus(event)
  retryMessage.value = ''
  if (notesReadBlocked.value) importGeneration++
  if (isDirty.value) {
    flushPendingSave(props.code)
    if (notesReadBlocked.value && notesUnsavedInMemory.value) {
      const ok = retryNotesAfterReadFailure(notesState.value)
      if (ok) {
        notesState.value = getCurrentNotes()
        loadDraftForCode(props.code)
        closeConflictReview()
        emit('updated', cloneNotesState(notesState.value))
      }
    }
    if (notesStorageError.value) {
      retryMessage.value = '重试未完成：请查看上方冲突或存储提示，草稿仍保留，可先导出备份'
    }
    return
  }
  if (notesUnsavedInMemory.value) {
    const ok = notesReadBlocked.value
      ? retryNotesAfterReadFailure(notesState.value)
      : saveNotes(notesState.value)
    if (ok) {
      notesState.value = getCurrentNotes()
      loadDraftForCode(props.code)
      closeConflictReview()
      emit('updated', cloneNotesState(notesState.value))
    } else {
      retryMessage.value = '重试未完成：请查看上方冲突或存储提示，草稿仍保留，可先导出备份'
    }
    return
  }
  notesState.value = loadNotes()
  loadDraftForCode(props.code)
  if (!notesStorageError.value) closeConflictReview()
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

const exportRawBackup = () => {
  if (notesRawBackup.value !== null) {
    downloadTextFile('ismism-notes-original.txt', notesRawBackup.value, 'text/plain;charset=utf-8')
    downloadedRawBackup.value = notesRawBackup.value
  }
}

const conflictNoteText = (note: NodeNote | null): string => {
  if (!note) return '此版本已清空本节点笔记（选择它将保留删除状态）'
  const lines = [`更新时间：${note.updatedAt}`, `论点：\n${note.claim}`, `出处：\n${note.source}`, `问题：\n${note.question}`]
  for (const [id, reading] of Object.entries(note.readings)) {
    lines.push(`原典 ${id}\n原文论证：\n${reading.original}\n课程解释：\n${reading.interpretation}`)
  }
  return lines.join('\n\n')
}

const closeConflictReview = () => {
  conflictReviewOpen.value = false
  conflictReview.value = null
  conflictChoices.value = {}
  invalidateNotesConflictPreview()
}

const refreshConflictReview = () => {
  conflictChoices.value = {}
  conflictReview.value = previewNotesConflicts(notesState.value)
  lastPreviewRevision = notesConflictRevision.value
  conflictReviewMessage.value = conflictReview.value?.conflicts.length
    ? '请重新逐节点选择。保存前会再次核对本页及外部版本。'
    : '当前没有可解决的冲突；如有存储读取异常，请先恢复读取。'
}

const openConflictReview = () => {
  flushPendingSave(props.code)
  conflictReviewOpen.value = true
  refreshConflictReview()
}

const applyConflictChoices = (event?: MouseEvent) => {
  handoffRecoveryFocus(event)
  const preview = conflictReview.value
  if (!preview || !canApplyConflictChoices.value) return
  importGeneration++
  flushPendingSave(props.code)
  const result = resolveNotesConflicts(notesState.value, preview.id, { ...conflictChoices.value })
  if (result.status === 'saved') {
    notesState.value = result.state
    loadDraftForCode(props.code)
    closeConflictReview()
    emit('updated', cloneNotesState(result.state))
  } else if (result.status === 'stale') {
    conflictReview.value = result.preview ?? null
    lastPreviewRevision = notesConflictRevision.value
    conflictChoices.value = {}
    conflictReviewMessage.value = '本页或外部笔记已变化，对比已刷新，请重新逐节点选择；尚未写入。'
  } else if (result.status === 'storage-error') {
    conflictReviewMessage.value = '保存未完成，本页草稿和选择仍保留。请恢复存储后重试；版本变化时需要重新选择。'
  }
}

watch([notesConflictRevision, isDirty], async ([revision, dirty]) => {
  if (conflictReviewOpen.value && !storageError.value) {
    closeConflictReview()
    return
  }
  if (!conflictReviewOpen.value || (lastPreviewRevision === revision && !dirty)) return
  conflictReview.value = null
  conflictChoices.value = {}
  conflictReviewMessage.value = '草稿或存储状态已变化，正在刷新对比；此前选择已清除。'
  await nextTick()
  if (conflictReviewOpen.value && !isDirty.value && !isUnmounted) refreshConflictReview()
})

const initializeEmptyStorage = (event?: MouseEvent) => {
  const raw = downloadedRawBackup.value
  if (raw === null || raw !== notesRawBackup.value) return
  if (!window.confirm('请确认原始存储备份已下载保存。此操作会替换损坏的存储并丢弃本页全部未保存草稿，建立空笔记库。之后可导入合法 JSON 备份。继续？')) return
  handoffRecoveryFocus(event)
  closeConflictReview()
  importGeneration++
  const empty = initializeAfterCorruption(raw)
  if (!empty) {
    retryMessage.value = '恢复未执行：原存储已变化或无法写入。请重新读取外部版本，或重新下载当前原始备份。'
    return
  }
  if (saveTimer !== null) window.clearTimeout(saveTimer)
  saveTimer = null
  downloadedRawBackup.value = null
  notesState.value = empty
  loadDraftForCode(props.code)
  retryMessage.value = ''
  emit('updated', cloneNotesState(empty))
}

const readExternalVersion = (event?: MouseEvent) => {
  if ((isDirty.value || notesUnsavedInMemory.value) && !window.confirm('读取外部版本将丢弃本页全部未保存草稿（包括清空、导入操作）。请先导出备份。继续？')) return
  handoffRecoveryFocus(event)
  closeConflictReview()
  importGeneration++
  const external = reloadExternalNotes()
  if (!external) return
  if (saveTimer !== null) window.clearTimeout(saveTimer)
  saveTimer = null
  notesState.value = external
  loadDraftForCode(props.code)
  retryMessage.value = ''
  emit('updated', cloneNotesState(external))
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
  closeConflictReview()
  const generation = ++importGeneration
  const isCurrentImport = () => !isUnmounted && generation === importGeneration

  importResultIsError.value = false
  retryMessage.value = ''

  try {
    const text = await file.text()
    if (!isCurrentImport()) return
    const parsed = parseNotesImport(text)
    if (!parsed) {
      importResultIsError.value = true
      importResultMessage.value = '导入失败：JSON 格式、字段结构或节点编号无效（仅接受 1-4 级且每段为 1-4 的编号）'
      return
    }

    flushPendingSave(props.code)

    const merged = mergeNotesState(notesState.value, parsed)
    const ok = saveNotes(merged.state)
    notesState.value = ok ? getCurrentNotes() : cloneNotesState(merged.state)
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
    if (!isCurrentImport()) return
    importResultIsError.value = true
    importResultMessage.value = '导入失败：读取文件出错'
  } finally {
    if (input && isCurrentImport()) {
      input.value = ''
    }
  }
}

const clearCurrentNote = () => {
  if (!props.code) return
  if (!window.confirm(`清空 ${props.code} 的笔记？`)) return
  closeConflictReview()
  importGeneration++

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
  notesState.value = ok ? getCurrentNotes() : cloneNotesState(nextState)
  lastSavedTime.value = ''
  emit('updated', cloneNotesState(notesState.value))
  if (!ok) {
    retryMessage.value = '清空未写入浏览器存储，请重试保存或导出备份'
  }
}

let unregisterLeaveFlusher: (() => void) | null = null
const handlePageLeave = () => {
  flushPendingSave(props.code)
}

const handleBeforeUnload = (event: BeforeUnloadEvent) => {
  flushPendingSave(props.code)
  if (!notesUnsavedInMemory.value) return
  event.preventDefault()
  event.returnValue = ''
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
  unregisterLeaveFlusher = registerNotesLeaveFlusher(handlePageLeave)
  notesState.value = loadNotes()
  loadDraftForCode(props.code)
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', handlePageLeave)
    window.addEventListener('beforeunload', handleBeforeUnload)
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange)
  }
})

onBeforeUnmount(() => {
  unregisterLeaveFlusher?.()
  unregisterLeaveFlusher = null
  isUnmounted = true
  closeConflictReview()
  importGeneration++
  if (typeof window !== 'undefined') {
    window.removeEventListener('pagehide', handlePageLeave)
    window.removeEventListener('beforeunload', handleBeforeUnload)
  }
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
  flushPendingSave(props.code)
})
</script>

<style scoped>
.notes_conflict_review { max-width: 100%; min-width: 0; font-size: max(13px, 1em); }
.notes_conflict_card {
  min-width: 0;
  margin: 0.75em 0;
  padding: 0.75em;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  background: var(--surface-elevated);
}
.notes_conflict_versions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75em; }
.notes_conflict_version { display: flex; flex-direction: column; min-width: 0; gap: 0.4em; }
.notes_conflict_version pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font: inherit;
  margin: 0;
  max-height: 22rem;
  overflow-y: auto;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: var(--surface-subtle);
  padding: 0.6em;
}
@media (max-width: 600px) { .notes_conflict_versions { grid-template-columns: minmax(0, 1fr); } }
.node_notes_root {
  display: flex;
  flex-direction: column;
  gap: 0.7em;
  width: 100%;
  box-sizing: border-box;
  color: var(--ink-primary);
}

.node_notes_root button:focus-visible,
.node_notes_root textarea:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.notes_intro {
  font-size: 0.88em;
  color: var(--ink-secondary);
  padding: 0.55em 0.75em;
  background-color: var(--surface-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  line-height: 1.5;
}

.notes_status_row {
  font-size: 0.84em;
  min-height: 1.2em;
}

.notes_status_ok {
  color: var(--status-verified-text);
  font-weight: 500;
}

.notes_status_error_box {
  display: flex;
  flex-direction: column;
  gap: 0.45em;
  padding: 0.6em 0.75em;
  background-color: var(--status-danger-soft);
  border: 1px solid var(--status-danger);
  border-radius: var(--radius-md);
}

.notes_status_error {
  color: var(--status-danger-text);
  font-weight: 600;
}

.notes_error_actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45em;
}

.notes_retry_message {
  color: var(--status-danger-text);
  font-size: 0.94em;
}

.notes_status_idle {
  color: var(--ink-muted);
}

.notes_field {
  display: flex;
  flex-direction: column;
  gap: 0.3em;
  width: 100%;
}

.notes_field_label {
  font-size: 0.88em;
  font-weight: 600;
  color: var(--ink-secondary);
}

.notes_textarea {
  font: inherit;
  width: 100%;
  min-height: 4.5em;
  padding: 0.5em 0.65em;
  box-sizing: border-box;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  background-color: var(--surface-elevated);
  color: var(--ink-primary);
  resize: vertical;
  line-height: 1.55;
  transition: border-color 0.14s ease;
}

.notes_textarea:focus {
  border-color: var(--accent);
}

.notes_section {
  display: flex;
  flex-direction: column;
  gap: 0.5em;
  padding-top: 0.55em;
  border-top: 1px dashed var(--border-subtle);
}

.notes_section_title {
  font-weight: 600;
  font-size: 0.94em;
  padding-bottom: 0.25em;
  border-bottom: 1px solid var(--border-subtle);
  color: var(--ink-primary);
}

.notes_reading_card {
  display: flex;
  flex-direction: column;
  gap: 0.42em;
  padding: 0.65em 0.75em;
  background-color: var(--surface-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-xs);
}

.notes_reading_header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.35em;
}

.notes_reading_link {
  font-weight: 600;
  color: var(--accent-text);
  word-break: break-word;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.notes_reading_badge {
  display: inline-block;
  padding: 0.1em 0.48em;
  font-size: 0.78em;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-default);
}

.notes_reading_badge.rel_explicit {
  background-color: var(--status-verified-soft);
  border-color: var(--status-verified);
  color: var(--status-verified-text);
  font-weight: 600;
}

.notes_reading_badge.rel_editorial {
  background-color: var(--status-info-soft);
  border-style: dashed;
  border-color: var(--accent-border);
  color: var(--status-info-text);
}

.notes_reading_locator {
  font-size: 0.84em;
  color: var(--ink-secondary);
}

.notes_muted_hint,
.notes_empty_hint {
  font-size: 0.84em;
  color: var(--ink-muted);
}

.notes_actions_row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45em;
  padding-top: 0.25em;
}

.notes_action_btn {
  font: inherit;
  font-size: 0.84em;
  font-weight: 500;
  padding: 0.35em 0.8em;
  border-radius: var(--radius-pill);
  background-color: var(--accent-soft);
  border: 1px solid var(--accent-border);
  color: var(--accent-text);
  cursor: pointer;
  transition: background-color 0.14s ease, color 0.14s ease;
}

.notes_action_btn:hover {
  background-color: var(--accent);
  border-color: var(--accent);
  color: var(--ink-inverse);
}

.notes_action_btn.danger {
  background-color: var(--status-danger-soft);
  border-color: var(--status-danger);
  color: var(--status-danger-text);
}

.notes_action_btn.danger:hover {
  background-color: var(--status-danger);
  border-color: var(--status-danger);
  color: var(--ink-inverse);
}

.notes_file_input {
  display: none;
}

.notes_import_result {
  font-size: 0.85em;
  color: var(--status-verified-text);
}

.notes_import_result.is_error {
  color: var(--status-danger-text);
  font-weight: 600;
}

.notes_all_list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4em;
}

.notes_jump_btn {
  font: inherit;
  font-size: 0.84em;
  padding: 0.28em 0.65em;
  border-radius: var(--radius-pill);
  background-color: var(--surface-elevated);
  border: 1px solid var(--border-subtle);
  color: var(--ink-primary);
  cursor: pointer;
  text-align: left;
  word-break: break-word;
  transition: background-color 0.14s ease, border-color 0.14s ease;
}

.notes_jump_btn:hover {
  background-color: var(--accent-soft);
  border-color: var(--accent-border);
}

.notes_jump_btn.is_current {
  background-color: var(--accent);
  color: var(--ink-inverse);
  border-color: var(--accent);
}
</style>
