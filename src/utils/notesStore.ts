import { ref } from 'vue'

export const NOTES_STORAGE_KEY = 'ismismcube.notes.v1'

export interface ReadingNote {
  original: string
  interpretation: string
}

export interface NodeNote {
  claim: string
  source: string
  question: string
  readings: Record<string, ReadingNote>
  updatedAt: string
}

export interface NotesState {
  version: 1
  nodes: Record<string, NodeNote>
}

export interface MergeNotesResult {
  state: NotesState
  importedCount: number
  skippedCount: number
  skippedEmptyCount: number
  skippedNewerLocalCount: number
}

export const notesStorageError = ref(false)
export const notesUnsavedInMemory = ref(false)

let inMemoryState: NotesState = {
  version: 1,
  nodes: {}
}

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
const CANONICAL_NODE_CODE_RE = /^[1-4](?:-[1-4]){0,3}$/

export function isValidNodeCode(code: string): boolean {
  return typeof code === 'string' && CANONICAL_NODE_CODE_RE.test(code)
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const cloneNodeNote = (note: NodeNote): NodeNote => {
  const readings: Record<string, ReadingNote> = {}
  for (const [sourceId, entry] of Object.entries(note.readings)) {
    if (FORBIDDEN_KEYS.has(sourceId)) continue
    readings[sourceId] = {
      original: entry.original,
      interpretation: entry.interpretation
    }
  }
  return {
    claim: note.claim,
    source: note.source,
    question: note.question,
    readings,
    updatedAt: note.updatedAt
  }
}

export const cloneNotesState = (state: NotesState): NotesState => {
  const nodes: Record<string, NodeNote> = {}
  for (const [code, note] of Object.entries(state.nodes)) {
    if (FORBIDDEN_KEYS.has(code) || !isValidNodeCode(code)) continue
    if (isNoteEmpty(note)) continue
    nodes[code] = cloneNodeNote(note)
  }
  return {
    version: 1,
    nodes
  }
}

export function isNoteEmpty(note: NodeNote | null | undefined): boolean {
  if (!note) return true
  if (note.claim.trim() !== '') return false
  if (note.source.trim() !== '') return false
  if (note.question.trim() !== '') return false
  for (const entry of Object.values(note.readings ?? {})) {
    if (!entry) continue
    if (entry.original.trim() !== '' || entry.interpretation.trim() !== '') {
      return false
    }
  }
  return true
}

export function parseNotesImport(text: string): NotesState | null {
  if (typeof text !== 'string') return null
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }

  if (!isPlainObject(parsed)) return null
  const topKeys = Object.keys(parsed)
  if (topKeys.some((k) => k !== 'version' && k !== 'nodes')) return null
  if (parsed.version !== 1) return null
  if (!isPlainObject(parsed.nodes)) return null

  const nodes: Record<string, NodeNote> = {}
  const allowedNoteKeys = new Set(['claim', 'source', 'question', 'readings', 'updatedAt'])
  const allowedReadingKeys = new Set(['original', 'interpretation'])

  for (const [code, rawNote] of Object.entries(parsed.nodes)) {
    if (FORBIDDEN_KEYS.has(code) || !isValidNodeCode(code)) return null
    if (!isPlainObject(rawNote)) return null

    const noteKeys = Object.keys(rawNote)
    if (noteKeys.length !== allowedNoteKeys.size || noteKeys.some((k) => !allowedNoteKeys.has(k))) {
      return null
    }

    if (
      typeof rawNote.claim !== 'string' ||
      typeof rawNote.source !== 'string' ||
      typeof rawNote.question !== 'string' ||
      typeof rawNote.updatedAt !== 'string'
    ) {
      return null
    }
    if (rawNote.updatedAt.trim() === '' || !Number.isFinite(Date.parse(rawNote.updatedAt))) {
      return null
    }
    if (!isPlainObject(rawNote.readings)) return null

    const readings: Record<string, ReadingNote> = {}
    for (const [sourceId, rawReading] of Object.entries(rawNote.readings)) {
      if (FORBIDDEN_KEYS.has(sourceId) || sourceId.trim() === '') return null
      if (!isPlainObject(rawReading)) return null
      const readingKeys = Object.keys(rawReading)
      if (
        readingKeys.length !== allowedReadingKeys.size ||
        readingKeys.some((k) => !allowedReadingKeys.has(k))
      ) {
        return null
      }
      if (typeof rawReading.original !== 'string' || typeof rawReading.interpretation !== 'string') {
        return null
      }
      readings[sourceId] = {
        original: rawReading.original,
        interpretation: rawReading.interpretation
      }
    }

    nodes[code] = {
      claim: rawNote.claim,
      source: rawNote.source,
      question: rawNote.question,
      readings,
      updatedAt: rawNote.updatedAt
    }
  }

  return {
    version: 1,
    nodes
  }
}

export function mergeNotesState(current: NotesState, imported: NotesState): MergeNotesResult {
  let importedCount = 0
  let skippedEmptyCount = 0
  let skippedNewerLocalCount = 0
  const nextNodes: Record<string, NodeNote> = cloneNotesState(current).nodes

  for (const [nodeCode, importedNote] of Object.entries(imported.nodes)) {
    if (FORBIDDEN_KEYS.has(nodeCode) || !isValidNodeCode(nodeCode)) continue
    if (isNoteEmpty(importedNote)) {
      skippedEmptyCount++
      continue
    }
    const existing = nextNodes[nodeCode]
    if (!existing || isNoteEmpty(existing)) {
      nextNodes[nodeCode] = cloneNodeNote(importedNote)
      importedCount++
    } else {
      const importedTs = Date.parse(importedNote.updatedAt)
      const existingTs = Date.parse(existing.updatedAt)
      if (Number.isFinite(importedTs) && (!Number.isFinite(existingTs) || importedTs > existingTs)) {
        nextNodes[nodeCode] = cloneNodeNote(importedNote)
        importedCount++
      } else {
        skippedNewerLocalCount++
      }
    }
  }

  return {
    state: cloneNotesState({ version: 1, nodes: nextNodes }),
    importedCount,
    skippedCount: skippedEmptyCount + skippedNewerLocalCount,
    skippedEmptyCount,
    skippedNewerLocalCount
  }
}

export function loadNotes(): NotesState {
  // 存在未写入磁盘的内存变更时，重挂载/切换页签不能用旧磁盘数据覆盖内存状态
  if (notesUnsavedInMemory.value) {
    return cloneNotesState(inMemoryState)
  }
  try {
    const raw = localStorage.getItem(NOTES_STORAGE_KEY)
    if (raw === null) {
      notesStorageError.value = false
      inMemoryState = { version: 1, nodes: {} }
      return cloneNotesState(inMemoryState)
    }
    const parsed = parseNotesImport(raw)
    if (!parsed) {
      notesStorageError.value = true
      return cloneNotesState(inMemoryState)
    }
    inMemoryState = cloneNotesState(parsed)
    notesStorageError.value = false
    return cloneNotesState(inMemoryState)
  } catch {
    notesStorageError.value = true
    return cloneNotesState(inMemoryState)
  }
}

export function saveNotes(state: NotesState): boolean {
  const normalized = cloneNotesState(state)
  inMemoryState = normalized
  try {
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(normalized))
    notesStorageError.value = false
    notesUnsavedInMemory.value = false
    return true
  } catch {
    notesStorageError.value = true
    notesUnsavedInMemory.value = true
    return false
  }
}

export function getNotesStorageError(): boolean {
  return notesStorageError.value
}

export function getNotesUnsavedInMemory(): boolean {
  return notesUnsavedInMemory.value
}

export function notesToMarkdown(
  state: NotesState,
  getTitle: (code: string) => string,
  getReadingTitle: (sourceId: string) => string = () => ''
): string {
  const entries = Object.entries(state.nodes)
    .filter(([, note]) => !isNoteEmpty(note))
    .sort((a, b) => Date.parse(b[1].updatedAt) - Date.parse(a[1].updatedAt))

  const lines: string[] = ['# 主义主义魔方学习笔记', '']
  if (entries.length === 0) {
    lines.push('暂无笔记。')
    return lines.join('\n')
  }

  for (const [code, note] of entries) {
    const title = getTitle(code).trim()
    lines.push(title ? `## ${code} ${title}` : `## ${code}`)
    lines.push('')
    lines.push(`更新时间：${note.updatedAt}`)
    lines.push('')

    if (note.claim.trim() !== '') {
      lines.push('### 论点（用自己的话）')
      lines.push(note.claim.trim())
      lines.push('')
    }
    if (note.source.trim() !== '') {
      lines.push('### 支持它的局部出处（讲次、页码或行号）')
      lines.push(note.source.trim())
      lines.push('')
    }
    if (note.question.trim() !== '') {
      lines.push('### 尚未解决的问题')
      lines.push(note.question.trim())
      lines.push('')
    }

    const readingEntries = Object.entries(note.readings).filter(
      ([, r]) => r.original.trim() !== '' || r.interpretation.trim() !== ''
    )
    if (readingEntries.length > 0) {
      lines.push('### 原典对照')
      lines.push('')
      for (const [sourceId, r] of readingEntries) {
        const readingTitle = getReadingTitle(sourceId).trim()
        lines.push(readingTitle ? `#### ${readingTitle}（${sourceId}）` : `#### ${sourceId}`)
        if (r.original.trim() !== '') {
          lines.push(`- 原文论证（原典本身说了什么）：${r.original.trim()}`)
        }
        if (r.interpretation.trim() !== '') {
          lines.push(`- 课程解释（课程如何使用它）：${r.interpretation.trim()}`)
        }
        lines.push('')
      }
    }
  }

  return lines.join('\n').trimEnd() + '\n'
}
