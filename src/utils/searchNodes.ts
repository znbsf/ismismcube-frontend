import type { CourseRecord, IsmNodeEntry, NodeEnrichment } from '../types/research'
import {
  includesQuery,
  matchesCoursesContent,
  matchesEditorialContent,
  matchesOverviewContent,
  normalizeSearchQuery
} from './ismFormat'

export type SearchMatchTabKey = 'overview' | 'courses' | 'editorial'
export type SearchMatchLocationKey = 'code_name' | 'overview' | 'courses' | 'editorial'

export const SEARCH_LOCATION_LABELS: Record<SearchMatchLocationKey, string> = {
  code_name: '名称/编号',
  overview: '概览',
  courses: '课程',
  editorial: '校勘'
}

export const SEARCH_TARGET_TAB_LABELS: Record<SearchMatchTabKey, string> = {
  overview: '概览与四轴',
  courses: '课程与讲稿',
  editorial: '校勘与典籍'
}

export interface NodeSearchResult {
  code: string
  node: IsmNodeEntry
  locations: SearchMatchLocationKey[]
  codeOrNameMatch: boolean
  overviewMatch: boolean
  coursesMatch: boolean
  editorialMatch: boolean
  exactCode: boolean
  exactName: boolean
  rankTier: number
  targetTab: SearchMatchTabKey
}

/**
 * Compare two node codes in hierarchical numerical order (e.g. 1 < 1-1 < 1-3-1 < 2 < 2-3).
 */
export const compareNodeCodes = (a: string, b: string): number => {
  const partsA = a.split('-')
  const partsB = b.split('-')
  const minLen = Math.min(partsA.length, partsB.length)
  for (let i = 0; i < minLen; i++) {
    const segA = partsA[i]
    const segB = partsB[i]
    if (segA === segB) continue
    const numA = Number(segA)
    const numB = Number(segB)
    if (Number.isFinite(numA) && Number.isFinite(numB) && numA !== numB) {
      return numA - numB
    }
    return segA.localeCompare(segB)
  }
  if (partsA.length !== partsB.length) {
    return partsA.length - partsB.length
  }
  return a.localeCompare(b)
}

/**
 * Pick the most relevant detail tab that actually contains a match for the node.
 */
export const resolveSearchTargetTab = (flags: {
  codeOrNameMatch: boolean
  overviewMatch: boolean
  coursesMatch: boolean
  editorialMatch: boolean
}): SearchMatchTabKey => {
  if (flags.codeOrNameMatch || flags.overviewMatch) return 'overview'
  if (flags.coursesMatch) return 'courses'
  if (flags.editorialMatch) return 'editorial'
  return 'overview'
}

/**
 * Evaluate a single node against the normalized search query using the shared tab matchers.
 */
export const evaluateNodeSearchMatch = (
  code: string,
  node: IsmNodeEntry | null,
  enrich: NodeEnrichment | null,
  linkedCourses: CourseRecord[],
  query: string
): NodeSearchResult | null => {
  const q = normalizeSearchQuery(query)
  if (!code || !node || !q) return null

  const codeMatch = includesQuery(code, q)
  const nameMatch = includesQuery(node.ch_name, q) || includesQuery(node.en_name, q)
  const codeOrNameMatch = codeMatch || nameMatch
  const overviewMatch = matchesOverviewContent(node, enrich, q)
  const coursesMatch = matchesCoursesContent(node, linkedCourses, enrich, q)
  const editorialMatch = matchesEditorialContent(node, enrich, q)

  if (!codeOrNameMatch && !overviewMatch && !coursesMatch && !editorialMatch) {
    return null
  }

  const locations: SearchMatchLocationKey[] = []
  if (codeOrNameMatch) locations.push('code_name')
  if (overviewMatch) locations.push('overview')
  if (coursesMatch) locations.push('courses')
  if (editorialMatch) locations.push('editorial')

  const qLower = q.toLowerCase()
  const exactCode = code.trim().toLowerCase() === qLower
  const exactName =
    node.ch_name.trim().toLowerCase() === qLower ||
    node.en_name.trim().toLowerCase() === qLower

  let rankTier = 4
  if (exactCode) rankTier = 0
  else if (exactName) rankTier = 1
  else if (codeMatch) rankTier = 2
  else if (nameMatch) rankTier = 3

  return {
    code,
    node,
    locations,
    codeOrNameMatch,
    overviewMatch,
    coursesMatch,
    editorialMatch,
    exactCode,
    exactName,
    rankTier,
    targetTab: resolveSearchTargetTab({
      codeOrNameMatch,
      overviewMatch,
      coursesMatch,
      editorialMatch
    })
  }
}

export interface BuildSearchResultsParams {
  ismData: Record<string, unknown> | null
  getNode: (code: string) => IsmNodeEntry | null
  enrichNodes?: Record<string, NodeEnrichment>
  getLinkedCourses: (code: string) => CourseRecord[]
  query: string
}

/**
 * Compute all matching nodes in a single pass, ranked with exact code/name first, then stable code order.
 */
export const buildSearchResults = (params: BuildSearchResultsParams): NodeSearchResult[] => {
  const q = normalizeSearchQuery(params.query)
  if (!q || !params.ismData) return []

  const enrichNodes = params.enrichNodes ?? {}
  const matches: NodeSearchResult[] = []

  for (const key of Object.keys(params.ismData)) {
    if (key === 'introduction') continue
    const node = params.getNode(key)
    if (!node) continue
    const enrich = enrichNodes[key] ?? null
    const linked = params.getLinkedCourses(key)
    const item = evaluateNodeSearchMatch(key, node, enrich, linked, q)
    if (item) {
      matches.push(item)
    }
  }

  matches.sort((a, b) => {
    if (a.rankTier !== b.rankTier) {
      return a.rankTier - b.rankTier
    }
    return compareNodeCodes(a.code, b.code)
  })

  return matches
}
