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

export const routeDoneIds = ref<string[]>([])
export const routeProgressStorageError = ref(false)

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

export const loadRouteProgress = (): string[] => {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(ROUTE_PROGRESS_STORAGE_KEY)
  } catch {
    routeProgressStorageError.value = true
    return routeDoneIds.value
  }
  if (raw === null) {
    routeProgressStorageError.value = false
    routeDoneIds.value = []
    return []
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed) ||
      !Array.isArray((parsed as { done?: unknown }).done)
    ) {
      routeDoneIds.value = []
      routeProgressStorageError.value = true
      return []
    }
    const done = normalizeDoneIds((parsed as { done: unknown[] }).done)
    routeDoneIds.value = done
    routeProgressStorageError.value = false
    return done
  } catch {
    routeDoneIds.value = []
    routeProgressStorageError.value = true
    return []
  }
}

export const saveRouteProgress = (doneList: string[]): boolean => {
  const normalized = normalizeDoneIds(doneList)
  routeDoneIds.value = normalized
  try {
    localStorage.setItem(ROUTE_PROGRESS_STORAGE_KEY, JSON.stringify({ done: normalized }))
    routeProgressStorageError.value = false
    return true
  } catch {
    routeProgressStorageError.value = true
    return false
  }
}

export const isRouteStepDone = (stageId: string, code: string): boolean => {
  const stepId = getRouteStepId(stageId, code)
  return routeDoneIds.value.includes(stepId)
}

export const toggleRouteStepDone = (stageId: string, code: string): boolean => {
  const stepId = getRouteStepId(stageId, code)
  const exists = routeDoneIds.value.includes(stepId)
  const next = exists
    ? routeDoneIds.value.filter((id) => id !== stepId)
    : [...routeDoneIds.value, stepId]
  saveRouteProgress(next)
  return !exists
}

export const resetRouteProgress = (): boolean => {
  routeDoneIds.value = []
  try {
    localStorage.removeItem(ROUTE_PROGRESS_STORAGE_KEY)
    routeProgressStorageError.value = false
    return true
  } catch {
    routeProgressStorageError.value = true
    return false
  }
}

export const getRouteProgressStorageError = (): boolean => {
  return routeProgressStorageError.value
}
