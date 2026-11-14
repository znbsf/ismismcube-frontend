import { parseAxisEntry } from './ismFormat'

export const AXIS_LABELS = ['场域论', '本体论', '认识论', '目的论'] as const
export const AXIS_SHORT_LABELS = ['场域', '本体', '认识', '目的'] as const
export const AXIS_COLORS = ['red', 'green', 'blue', 'darkorange'] as const

export type AxisComparisonKind =
  | 'different_digit'
  | 'same_digit_different_text'
  | 'identical'
  | 'missing'

export interface AxisDescriptionParts {
  main: string
  note: string
}

export interface AxisComparisonRow {
  index: number
  axisLabel: string
  digitA: string
  digitB: string
  textA: string
  textB: string
  kind: AxisComparisonKind
}

const stripLeadingColonAndWhitespace = (rest: string): string => {
  return rest.trimStart().replace(/^[：:]\s*/, '').trim()
}

export const getParentCode = (code: string): string | null => {
  if (!code) return null
  const parts = code.split('-').filter(Boolean)
  if (parts.length <= 1) return null
  return parts.slice(0, -1).join('-')
}

export const getAncestorCodes = (code: string): string[] => {
  if (!code) return []
  const parts = code.split('-').filter(Boolean)
  const ancestors: string[] = []
  for (let i = 1; i < parts.length; i++) {
    ancestors.push(parts.slice(0, i).join('-'))
  }
  return ancestors
}

export const getAxisOriginCode = (code: string, axisIndex: number): string => {
  if (!code || axisIndex < 0) return ''
  const parts = code.split('-').filter(Boolean)
  return parts.slice(0, axisIndex + 1).join('-')
}

export const getSiblingCodes = (code: string, hasNode: (c: string) => boolean): string[] => {
  if (!code) return []
  const parts = code.split('-').filter(Boolean)
  if (parts.length === 0 || parts.length > 4) return []
  const parent = getParentCode(code)
  const siblings: string[] = []
  for (let digit = 1; digit <= 4; digit++) {
    const candidate = parent ? `${parent}-${digit}` : `${digit}`
    if (hasNode(candidate)) {
      siblings.push(candidate)
    }
  }
  return siblings
}

export const getChildCodes = (code: string, hasNode: (c: string) => boolean): string[] => {
  if (!code) return []
  const parts = code.split('-').filter(Boolean)
  if (parts.length === 0 || parts.length >= 4) return []
  const children: string[] = []
  for (let digit = 1; digit <= 4; digit++) {
    const candidate = `${code}-${digit}`
    if (hasNode(candidate)) {
      children.push(candidate)
    }
  }
  return children
}

export const splitAxisDescription = (rest: string): AxisDescriptionParts => {
  const cleaned = stripLeadingColonAndWhitespace(rest)
  if (!cleaned) {
    return { main: '', note: '' }
  }
  if (!cleaned.endsWith(')') && !cleaned.endsWith('）')) {
    return { main: cleaned, note: '' }
  }

  let depth = 0
  let matchIdx = -1
  for (let i = cleaned.length - 1; i >= 0; i--) {
    const ch = cleaned[i]
    if (ch === ')' || ch === '）') {
      depth++
    } else if (ch === '(' || ch === '（') {
      depth--
      if (depth === 0) {
        matchIdx = i
        break
      }
    }
  }

  if (matchIdx <= 0) {
    return { main: cleaned, note: '' }
  }

  return {
    main: cleaned.slice(0, matchIdx).trim(),
    note: cleaned.slice(matchIdx + 1, -1).trim()
  }
}

const normalizedComparableText = (parts: AxisDescriptionParts): string => {
  const main = parts.main.trim()
  const note = parts.note.trim()
  return note ? `${main}\n${note}`.trim() : main
}

export const compareAxisLists = (a: string[], b: string[]): AxisComparisonRow[] => {
  const maxLen = Math.max(a.length, b.length)
  const rows: AxisComparisonRow[] = []

  for (let index = 0; index < maxLen; index++) {
    const rawA = a[index]
    const rawB = b[index]
    const hasA = typeof rawA === 'string' && rawA !== ''
    const hasB = typeof rawB === 'string' && rawB !== ''

    const parsedA = hasA ? parseAxisEntry(rawA, index) : null
    const parsedB = hasB ? parseAxisEntry(rawB, index) : null

    const axisLabel =
      parsedA?.axisLabel || parsedB?.axisLabel || AXIS_LABELS[index] || ''
    const digitA = parsedA?.digit ?? ''
    const digitB = parsedB?.digit ?? ''
    const textA = parsedA ? stripLeadingColonAndWhitespace(parsedA.rest) : ''
    const textB = parsedB ? stripLeadingColonAndWhitespace(parsedB.rest) : ''

    let kind: AxisComparisonKind
    if (!hasA || !hasB) {
      kind = 'missing'
    } else if (digitA !== digitB) {
      kind = 'different_digit'
    } else {
      const normA = normalizedComparableText(splitAxisDescription(parsedA!.rest))
      const normB = normalizedComparableText(splitAxisDescription(parsedB!.rest))
      kind = normA === normB ? 'identical' : 'same_digit_different_text'
    }

    rows.push({
      index,
      axisLabel,
      digitA,
      digitB,
      textA,
      textB,
      kind
    })
  }

  return rows
}
