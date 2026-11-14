export interface IsmNodeEntry {
  ch_name: string
  en_name: string
  axis_list: string[]
  feature_list: string[]
  related_list: string[]
  summary_status: 'manual' | 'ai' | string
}

export type IsmDataMap = {
  introduction: string[]
} & Record<string, IsmNodeEntry | string[]>

export interface NodeSummaryEvidence {
  level?: string
  coverage?: string
  audio_verified?: boolean
  batch_file?: string
}

export interface NodeAxisEvidence {
  axis_index: number
  locator?: string
  status?: string
}

export interface NodeReviewHighlight {
  field_path: (string | number)[]
  canonical_status: string
  resolution_state: string
  locator?: string
  finding?: string
  resolved_by_batches?: string[]
}

export interface NodeReviewSummary {
  total_checks: number
  by_canonical_status: Record<string, number>
  by_resolution_state: Record<string, number>
  open_attention_count: number
  resolved_in_catalogue_count: number
  highlights: NodeReviewHighlight[]
}

export interface NodeTranscript {
  row: number
  title: string
  kind?: string
  url?: string
  source_path?: string
}

export interface NodeReadingLink {
  source_id: string
  title: string
  url: string
  kind?: string
  relation: 'lecture_explicit_reference' | 'editorial_reading' | string
  locator?: string
  reason?: string
  verification_scope?: string
}

export type SummaryOrigin = 'upstream_manual' | 'upstream_ai' | 'branch_filled'

export interface NodeEnrichment {
  code: string
  title: string
  summary_origin: SummaryOrigin | string
  audio_verified: boolean
  summary_evidence: NodeSummaryEvidence | null
  axis_evidence: NodeAxisEvidence[]
  review_summary: NodeReviewSummary | null
  transcripts: NodeTranscript[]
  readings: NodeReadingLink[]
  editorial_notes: string[]
  substantive_open_questions: string[]
  boilerplate_open_questions_count: number
  related_course_ids: string[]
}

export interface CubeEnrichmentsPayload {
  schema_version: number
  checked_on: string
  scope: string
  counts: {
    nodes: number
    summary_origins: Record<string, number>
    nodes_with_review_summary: number
    nodes_with_readings: number
    total_readings: number
    nodes_with_transcripts: number
    nodes_with_related_courses: number
    substantive_open_questions: number
    boilerplate_open_questions_suppressed: number
  }
  nodes: Record<string, NodeEnrichment>
}

export interface CourseVideoCheck {
  status?: string
  title?: string
  uploader?: string
  uploader_mid?: number
  duration_seconds?: number
  cid?: number
  checked_on?: string
  scope?: string
  error?: string
}

export interface CourseRecord {
  id: string
  title: string
  url: string
  source_ids: string[]
  evidence_level: string
  archival_title?: string
  archival_published_date?: string
  related_codes: string[]
  kind: string
  catalogue_code: string | null
  body_status?: string
  video_check?: CourseVideoCheck
  body_ref?: string
  metadata_correction?: Record<string, unknown>
}

export interface CoursesPayload {
  schema_version: number
  scope: string
  sources: {
    id: string
    title: string
    url: string
    kind: string
    verification_scope: string
  }[]
  courses: CourseRecord[]
}

export interface CourseBodySummaryItem {
  text: string
  source_ids?: string[]
  locator?: string
}

export interface CourseBodyReadingLink {
  source_id: string
  relation: string
  locator?: string
  reason?: string
  verification_scope?: string
}

export interface CourseBodyRecord {
  id: string
  series_code?: string
  title: string
  evidence_level?: string
  body_status?: string
  review_scope?: string
  identity_verification?: string
  course_summary: CourseBodySummaryItem[]
  editorial_notes?: (string | { text: string })[]
  reading_links?: CourseBodyReadingLink[]
  audio_verified?: boolean
  batch_file?: string
}

export type CourseBodiesMap = Record<string, CourseBodyRecord>
