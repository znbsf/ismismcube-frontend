import type { CourseRecord, IsmNodeEntry, NodeEnrichment } from '../types/research'

export interface HighlightSegment {
  text: string
  match: boolean
}

export interface ParsedAxisEntry {
  axisLabel: string
  digit: string
  rest: string
  color: string
  fallback: boolean
}

export interface ParsedRelatedEntry {
  label: string
  value: string
  url: string | null
  category: 'core' | 'transcript' | 'reading' | 'editorial'
}

const AXIS_COLOR_MAP: Record<string, string> = {
  '场域论': 'red',
  '本体论': 'green',
  '认识论': 'blue',
  '目的论': 'darkorange'
}

const FALLBACK_COLORS = ['red', 'green', 'blue', 'darkorange']

export const escapeRegExp = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export const splitHighlightSegments = (text: string | null | undefined, query: string): HighlightSegment[] => {
  if (typeof text !== 'string' || !text) return []
  const needle = query
  if (!needle) {
    return [{ text, match: false }]
  }
  const escaped = escapeRegExp(needle)
  if (!escaped) {
    return [{ text, match: false }]
  }
  const regex = new RegExp(`(${escaped})`, 'gi')
  const parts = text.split(regex)
  const needleLower = needle.toLowerCase()
  const segments: HighlightSegment[] = []
  for (const part of parts) {
    if (!part) continue
    segments.push({
      text: part,
      match: part.toLowerCase() === needleLower
    })
  }
  return segments.length > 0 ? segments : [{ text, match: false }]
}

export const getNoteText = (entry: string | { text?: unknown } | null | undefined): string => {
  if (typeof entry === 'string') return entry
  if (entry && typeof entry === 'object' && typeof entry.text === 'string') return entry.text
  return ''
}

export const normalizeSearchQuery = (query: string): string => {
  return query.trim()
}

export const includesQuery = (text: unknown, query: string): boolean => {
  if (typeof text !== 'string' || !text || !query) return false
  return text.toLowerCase().includes(query.toLowerCase())
}

export const parseAxisEntry = (entry: string, index: number): ParsedAxisEntry => {
  const match = entry.match(/^(场域论|本体论|认识论|目的论)([1-4])(.*)$/)
  if (match) {
    const [, axisLabel, digit, rest] = match
    return {
      axisLabel,
      digit,
      rest,
      color: AXIS_COLOR_MAP[axisLabel] ?? FALLBACK_COLORS[index] ?? 'black',
      fallback: false
    }
  }
  return {
    axisLabel: '',
    digit: '',
    rest: entry,
    color: FALLBACK_COLORS[index] ?? 'black',
    fallback: true
  }
}

export const parseRelatedEntry = (entry: string): ParsedRelatedEntry => {
  const colonIdx = entry.indexOf('：')
  const label = colonIdx !== -1 ? entry.slice(0, colonIdx) : ''
  const rawValue = colonIdx !== -1 ? entry.slice(colonIdx + 1).trim() : entry.trim()
  const isUrl = /^https?:\/\//i.test(rawValue)

  let category: ParsedRelatedEntry['category'] = 'core'
  if (label.startsWith('二手讲稿来源')) {
    category = 'transcript'
  } else if (label.startsWith('课程提及典籍') || label.startsWith('延伸阅读')) {
    category = 'reading'
  } else if (label === '校勘依据' || label === '编者校勘注') {
    category = 'editorial'
  }

  return {
    label,
    value: rawValue,
    url: isUrl ? rawValue : null,
    category
  }
}

export const matchesOverviewContent = (
  node: IsmNodeEntry | null,
  enrich: NodeEnrichment | null,
  query: string
): boolean => {
  const q = normalizeSearchQuery(query)
  if (!node || !q) return false
  if (node.axis_list.some((item) => includesQuery(item, q))) return true
  if (node.feature_list.some((item) => includesQuery(item, q))) return true
  const related = node.related_list.filter((item) => item !== '').map(parseRelatedEntry)
  const core = enrich ? related.filter((item) => item.category === 'core') : related
  return core.some((rel) => includesQuery(rel.label, q) || includesQuery(rel.value, q))
}

export const matchesCoursesContent = (
  node: IsmNodeEntry | null,
  linkedCourses: CourseRecord[],
  enrich: NodeEnrichment | null,
  query: string
): boolean => {
  const q = normalizeSearchQuery(query)
  if (!q) return false
  if (linkedCourses.some((c) => includesQuery(c.title, q) || includesQuery(c.id, q))) return true
  if (enrich?.transcripts.some((t) => includesQuery(t.title, q))) return true
  if (node) {
    const docs = node.related_list
      .filter((item) => item !== '')
      .map(parseRelatedEntry)
      .filter((item) => item.label.includes('文案'))
    if (docs.some((d) => includesQuery(d.label, q) || includesQuery(d.value, q))) return true
  }
  return false
}

export const matchesEditorialContent = (
  node: IsmNodeEntry | null,
  enrich: NodeEnrichment | null,
  query: string
): boolean => {
  const q = normalizeSearchQuery(query)
  if (!q) return false
  if (enrich) {
    if (
      enrich.readings.some(
        (r) => includesQuery(r.title, q) || includesQuery(r.reason, q) || includesQuery(r.locator, q)
      )
    ) {
      return true
    }
    if (
      enrich.review_summary?.highlights.some(
        (h) => includesQuery(h.finding, q) || includesQuery(h.locator, q)
      )
    ) {
      return true
    }
    if (enrich.editorial_notes.some((n) => includesQuery(n, q))) return true
    if (enrich.substantive_open_questions.some((oq) => includesQuery(oq, q))) return true
    return false
  }
  if (!node) return false
  const parsed = node.related_list.filter((item) => item !== '').map(parseRelatedEntry)
  return parsed
    .filter((item) => item.category === 'reading' || item.category === 'editorial')
    .some((item) => includesQuery(item.label, q) || includesQuery(item.value, q))
}

export const nodeMatchesQuery = (
  node: IsmNodeEntry | null,
  enrich: NodeEnrichment | null,
  linkedCourses: CourseRecord[],
  query: string,
  code = ''
): boolean => {
  const q = normalizeSearchQuery(query)
  if (!node || !q) return false
  if (includesQuery(code, q) || includesQuery(node.ch_name, q) || includesQuery(node.en_name, q)) return true
  return (
    matchesOverviewContent(node, enrich, q) ||
    matchesCoursesContent(node, linkedCourses, enrich, q) ||
    matchesEditorialContent(node, enrich, q)
  )
}

export const CANONICAL_STATUS_LABELS: Record<string, string> = {
  supported: '有正文支撑',
  supported_attributed_or_scoped: '有限定/归因支撑',
  supported_with_caveat: '附提醒支撑',
  partially_supported: '部分支撑',
  unlocated_or_unsupported: '未定位或无直接支撑',
  contradicted_or_misstated: '存在误归或抵牾'
}

export const RESOLUTION_STATE_LABELS: Record<string, string> = {
  confirmed_as_written: '按原文确认',
  resolved_in_catalogue: '所在字段已入库修订',
  qualified_in_research_record: '已记入限定边界',
  open_needs_attention: '仍待处理'
}

export const COURSE_KIND_LABELS: Record<string, string> = {
  dollar_series: '$ 系列精读',
  lecture: '正课',
  review: '复习课',
  preview: '预习课',
  exercise: '习题/导学',
  extra: '番外/补充',
  overview: '总纲'
}

export const BODY_STATUS_LABELS: Record<string, string> = {
  not_reviewed: '仅目录元数据（未核正文）',
  asr_text_reviewed_not_audio_verified: '公开ASR已核读（未核原音）',
  compiled_text_reviewed_not_audio_verified: '二手汇编稿已核读（未核原音）',
  reused_reviewed_node_summary_not_audio_verified: '复用已复核节点摘要（未核原音）',
  local_asr_text_reviewed_not_audio_verified: '本地ASR已核读（未核原音）',
  partial_board_summary_no_audio: '无声版板书/局部文本',
  reused_compiled_text_not_audio_verified: '复用二手汇编稿摘要（未核原音）',
  compiled_text_reviewed_identity_sample_matched_not_audio_verified: '二手汇编稿已核读并样本核对身份（未核原音）'
}

export const SUMMARY_ORIGIN_LABELS: Record<string, string> = {
  upstream_manual: '原站手工条目',
  upstream_ai: '原站 AI 初始汇总',
  branch_filled: '本分支据二手讲稿补写（AI）'
}

export const formatFieldPath = (fieldPath: (string | number)[]): string => {
  if (!fieldPath || fieldPath.length === 0) return '条目'
  const [root, index] = fieldPath
  const idxNum = typeof index === 'number' ? index + 1 : index
  if (root === 'axis_list') return `轴线 ${idxNum ?? ''}`.trim()
  if (root === 'feature_list') return `特征 ${idxNum ?? ''}`.trim()
  if (root === 'related_list') return `关联 ${idxNum ?? ''}`.trim()
  if (root === 'ch_name') return '中文名称'
  if (root === 'en_name') return '英文名称'
  return fieldPath.join('.')
}

export const formatDuration = (seconds?: number): string => {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return ''
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  return `${mins}:${String(secs).padStart(2, '0')}`
}
