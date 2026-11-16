import { ref } from 'vue'
import { ROUTE_STAGES, type RouteStage, type RouteStep } from '../config/readingRoute'

export const ROUTE_PROGRESS_STORAGE_KEY = 'ismismcube.route.v1'

export interface FlattenedRouteStep {
  stage: RouteStage
  step: RouteStep
  stepId: string
  index: number
}

export const getRouteStepId = (stageId: string, code: string): string => {
  return `${stageId}:${code}`
}

export const ROUTE_STEPS_FLAT: FlattenedRouteStep[] = (() => {
  const list: FlattenedRouteStep[] = []
  for (const stage of ROUTE_STAGES) {
    for (const step of stage.steps) {
      list.push({
        stage,
        step,
        stepId: getRouteStepId(stage.id, step.code),
        index: list.length
      })
    }
  }
  return list
})()

export const TOTAL_ROUTE_STEPS = ROUTE_STEPS_FLAT.length

const VALID_STEP_IDS = new Set(ROUTE_STEPS_FLAT.map((item) => item.stepId))

export type RouteProgressErrorKind = 'read' | 'write' | null

export const routeDoneIds = ref<string[]>([])
export const routeProgressStorageError = ref(false)
export const routeProgressErrorKind = ref<RouteProgressErrorKind>(null)
export const routeProgressHasPending = ref(false)

export const findFirstIncompleteRouteStep = (
  doneIds: readonly string[] = routeDoneIds.value
): FlattenedRouteStep | null => {
  const doneSet = new Set(doneIds)
  return ROUTE_STEPS_FLAT.find((item) => !doneSet.has(item.stepId)) ?? null
}

export const findRouteStepByCode = (
  code: string
): { current: FlattenedRouteStep; next: FlattenedRouteStep | null } | null => {
  if (!code) return null
  const idx = ROUTE_STEPS_FLAT.findIndex((item) => item.step.code === code)
  if (idx === -1) return null
  const current = ROUTE_STEPS_FLAT[idx]
  const next = idx + 1 < ROUTE_STEPS_FLAT.length ? ROUTE_STEPS_FLAT[idx + 1] : null
  return { current, next }
}

const normalizeDoneIds = (ids: unknown): string[] => {
  if (!Array.isArray(ids)) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of ids) {
    if (typeof item !== 'string') continue
    if (!VALID_STEP_IDS.has(item) || seen.has(item)) continue
    seen.add(item)
    result.push(item)
  }
  return result
}

// Pending actions encode the user's intended final value, not a toggle of disk.
// localStorage read/modify/write is not atomic across simultaneous tabs.
const pending = new Map<string, boolean>()
let pendingReset = false

const syncPendingFlag = () => {
  routeProgressHasPending.value = pendingReset || pending.size > 0
}

const setStorageError = (kind: RouteProgressErrorKind) => {
  routeProgressStorageError.value = kind !== null
  routeProgressErrorKind.value = kind
}

const readDisk = (): string[] | null => {
  try {
    const raw = localStorage.getItem(ROUTE_PROGRESS_STORAGE_KEY)
    if (raw === null) return []
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed) ||
      !Array.isArray((parsed as { done?: unknown }).done)) throw new Error('Invalid route progress')
    const done = (parsed as { done: unknown[] }).done
    if (done.some(id => typeof id !== 'string' || !VALID_STEP_IDS.has(id))) {
      throw new Error('Unrecognized route progress entries')
    }
    return normalizeDoneIds(done)
  } catch {
    // Preserve unreadable raw data; subsequent explicit actions may retry reading.
    setStorageError('read')
    return null
  }
}

const applyPending = (disk: string[]): string[] => {
  const next = new Set(pendingReset ? [] : disk)
  for (const [id, done] of pending) {
    if (done) next.add(id)
    else next.delete(id)
  }
  return [...next]
}

const broadcastRouteSync = () => {
  if (typeof BroadcastChannel === 'undefined') return
  try {
    const channel = new BroadcastChannel('ismismcube.tab-sync.v1')
    channel.postMessage({ type: 'route-updated', timestamp: Date.now() })
    channel.close()
  } catch {
    // Ignore channel errors in restricted/mock environments.
  }
}

const flushPending = (): boolean => {
  const disk = pendingReset ? [] : readDisk()
  if (disk === null) return false
  const next = applyPending(disk)
  routeDoneIds.value = next
  try {
    if (pendingReset && next.length === 0) localStorage.removeItem(ROUTE_PROGRESS_STORAGE_KEY)
    else localStorage.setItem(ROUTE_PROGRESS_STORAGE_KEY, JSON.stringify({ done: next }))
    pending.clear()
    pendingReset = false
    syncPendingFlag()
    setStorageError(null)
    broadcastRouteSync()
    return true
  } catch {
    syncPendingFlag()
    setStorageError('write')
    return false
  }
}

export const loadRouteProgress = (): string[] => {
  const disk = readDisk()
  if (disk === null) return routeDoneIds.value
  routeDoneIds.value = applyPending(disk)
  const hasPending = pendingReset || pending.size > 0
  syncPendingFlag()
  setStorageError(hasPending ? 'write' : null)
  return routeDoneIds.value
}

export const saveRouteProgress = (doneList: string[]): boolean => {
  const desired = normalizeDoneIds(doneList)
  const before = new Set(routeDoneIds.value)
  const after = new Set(desired)
  for (const id of new Set([...before, ...after])) {
    if (before.has(id) !== after.has(id)) pending.set(id, after.has(id))
  }
  syncPendingFlag()
  routeDoneIds.value = desired
  return flushPending()
}

export const isRouteStepDone = (stageId: string, code: string): boolean => {
  return routeDoneIds.value.includes(getRouteStepId(stageId, code))
}

export const toggleRouteStepDone = (stageId: string, code: string): boolean => {
  const id = getRouteStepId(stageId, code)
  if (!VALID_STEP_IDS.has(id)) return false
  const done = !routeDoneIds.value.includes(id)
  pending.set(id, done)
  syncPendingFlag()
  routeDoneIds.value = applyPending(routeDoneIds.value)
  flushPending()
  return done
}

export const resetRouteProgress = (): boolean => {
  pending.clear()
  pendingReset = true
  syncPendingFlag()
  routeDoneIds.value = []
  return flushPending()
}

export const getRouteProgressStorageError = (): boolean => routeProgressStorageError.value
