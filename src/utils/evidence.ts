import type { NodeReviewHighlight } from '../types/research'

export type EvidenceTone = 'scoped' | 'caution' | 'problem' | 'revised'

export interface FieldEvidence {
  tone: EvidenceTone
  label: string
  highlights: NodeReviewHighlight[]
}

export const TONE_META: Record<
  EvidenceTone,
  { icon: string; className: string; description: string }
> = {
  scoped: {
    icon: '◔',
    className: 'evidence_tone_scoped',
    description: '讲稿有对应，但带归属或范围限定'
  },
  caution: {
    icon: '△',
    className: 'evidence_tone_caution',
    description: '仅部分对应，或需附加提醒'
  },
  problem: {
    icon: '✕',
    className: 'evidence_tone_problem',
    description: '讲稿中未定位到，或与讲稿抵牾（未修订）'
  },
  revised: {
    icon: '✎',
    className: 'evidence_tone_revised',
    description: '核查后此处文字已修订'
  }
}

export const CANONICAL_TONE: Record<string, EvidenceTone> = {
  supported: 'scoped',
  supported_attributed_or_scoped: 'scoped',
  supported_with_caveat: 'caution',
  partially_supported: 'caution',
  unlocated_or_unsupported: 'problem',
  contradicted_or_misstated: 'problem'
}

const SEVERITY_ORDER: readonly string[] = [
  'contradicted_or_misstated',
  'unlocated_or_unsupported',
  'partially_supported',
  'supported_with_caveat',
  'supported_attributed_or_scoped',
  'supported'
]

const STATUS_MARKER_LABEL: Record<string, string> = {
  contradicted_or_misstated: '存在抵牾',
  unlocated_or_unsupported: '未能定位',
  partially_supported: '部分支撑',
  supported_with_caveat: '附提醒',
  supported_attributed_or_scoped: '有限定',
  supported: '有限定'
}

function getSeverityRank(status: string): number {
  const idx = SEVERITY_ORDER.indexOf(status)
  return idx === -1 ? SEVERITY_ORDER.length : idx
}

export function getFieldEvidence(
  highlights: NodeReviewHighlight[] | undefined,
  field: 'axis_list' | 'feature_list',
  index: number
): FieldEvidence | null {
  if (!highlights || highlights.length === 0) return null

  const matching = highlights.filter(
    (hl) => hl.field_path?.[0] === field && hl.field_path?.[1] === index
  )
  if (matching.length === 0) return null

  const unresolved = matching.filter(
    (hl) => hl.resolution_state !== 'resolved_in_catalogue'
  )
  if (unresolved.length === 0) {
    return {
      tone: 'revised',
      label: '已据核查修订',
      highlights: matching
    }
  }

  let mostSevere = unresolved[0]
  let bestRank = getSeverityRank(mostSevere.canonical_status)
  for (let i = 1; i < unresolved.length; i++) {
    const rank = getSeverityRank(unresolved[i].canonical_status)
    if (rank < bestRank) {
      mostSevere = unresolved[i]
      bestRank = rank
    }
  }

  const status = mostSevere.canonical_status
  return {
    tone: CANONICAL_TONE[status] ?? 'scoped',
    label: STATUS_MARKER_LABEL[status] ?? '有限定',
    highlights: matching
  }
}
