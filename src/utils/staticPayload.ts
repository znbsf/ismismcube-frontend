// These checks cover structures consumed by the current UI, not research
// correctness, schema versions, dataset size, or unknown metadata fields.
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string')
const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value)
const optionalText = (value: Record<string, unknown>, keys: string[]) =>
  keys.every(key => value[key] == null || typeof value[key] === 'string')
const optionalNumber = (value: Record<string, unknown>, keys: string[]) =>
  keys.every(key => value[key] == null || finite(value[key]))

export function validateCoursesPayload(value: unknown): boolean {
  return record(value) && Array.isArray(value.courses) && value.courses.every(course => {
    if (!record(course) || !['id', 'title', 'url', 'kind'].every(key => typeof course[key] === 'string') ||
      !strings(course.related_codes) || !optionalText(course, [
        'catalogue_code', 'archival_published_date', 'body_ref', 'body_status', 'evidence_level',
      ])) return false
    if (course.video_check != null) {
      if (!record(course.video_check) || !optionalText(course.video_check, ['status']) ||
        !optionalNumber(course.video_check, ['duration_seconds'])) return false
    }
    return true
  })
}

const reviewSummary = (value: unknown): boolean => {
  if (value == null) return true
  if (!record(value) || !Array.isArray(value.highlights) || !optionalNumber(value, ['total_checks', 'resolved_in_catalogue_count'])) return false
  if (value.by_resolution_state != null && (!record(value.by_resolution_state) ||
    !Object.values(value.by_resolution_state).every(finite))) return false
  return value.highlights.every(highlight => record(highlight) &&
    Array.isArray(highlight.field_path) && highlight.field_path.every(part => typeof part === 'string' || finite(part)) &&
    typeof highlight.canonical_status === 'string' && typeof highlight.resolution_state === 'string' &&
    optionalText(highlight, ['locator', 'finding']) &&
    (highlight.resolved_by_batches == null || strings(highlight.resolved_by_batches)))
}

export function validateEnrichmentsPayload(value: unknown): boolean {
  if (!record(value) || !record(value.nodes)) return false
  return Object.values(value.nodes).every(node => {
    if (!record(node) || !strings(node.editorial_notes) || !strings(node.substantive_open_questions) ||
      !Array.isArray(node.transcripts) || !Array.isArray(node.readings) || !Array.isArray(node.axis_evidence) ||
      !optionalText(node, ['summary_origin']) || !optionalNumber(node, ['boilerplate_open_questions_count']) ||
      (node.related_course_ids != null && !strings(node.related_course_ids)) || !reviewSummary(node.review_summary)) return false
    if (node.summary_evidence != null && (!record(node.summary_evidence) ||
      !optionalText(node.summary_evidence, ['level', 'coverage', 'batch_file']))) return false
    if (!node.transcripts.every(item => record(item) && typeof item.title === 'string' &&
      optionalText(item, ['url', 'source_path', 'kind']) && optionalNumber(item, ['row']))) return false
    if (!node.readings.every(item => record(item) && ['title', 'source_id', 'url', 'relation'].every(key => typeof item[key] === 'string') &&
      optionalText(item, ['locator', 'reason', 'verification_scope', 'kind']))) return false
    return node.axis_evidence.every(item => record(item) && finite(item.axis_index) && optionalText(item, ['locator', 'status']))
  })
}
export function validateIsmPayload(value: unknown): boolean {
  if (!record(value) || !strings(value.introduction)) return false
  return Object.entries(value).every(([key, node]) => {
    if (!/^[1-4](?:-[1-4]){0,3}$/.test(key)) return true
    return record(node) && typeof node.ch_name === 'string' && typeof node.en_name === 'string' &&
      strings(node.axis_list) && strings(node.feature_list) && strings(node.related_list) && optionalText(node, ['summary_status'])
  })
}

export function validateCourseBodiesPayload(value: unknown): boolean {
  if (!record(value)) return false
  return Object.values(value).every(body => {
    if (!record(body) || typeof body.id !== 'string' || typeof body.title !== 'string' ||
      !optionalText(body, ['series_code', 'evidence_level', 'body_status', 'review_scope']) ||
      !Array.isArray(body.course_summary)) return false
    if (!body.course_summary.every(item => record(item) && typeof item.text === 'string' &&
      optionalText(item, ['locator']) && (item.source_ids == null || strings(item.source_ids)))) return false
    if (body.editorial_notes != null && (!Array.isArray(body.editorial_notes) ||
      !body.editorial_notes.every(note => typeof note === 'string' || (record(note) && typeof note.text === 'string')))) return false
    return body.reading_links == null || (Array.isArray(body.reading_links) && body.reading_links.every(link =>
      record(link) && typeof link.source_id === 'string' && typeof link.relation === 'string' &&
      optionalText(link, ['locator', 'reason', 'verification_scope'])))
  })
}
