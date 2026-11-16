<template>
  <div v-if="open" class="route_drawer_backdrop" @click.self="emit('close')">
    <div
      ref="panelRef"
      class="route_drawer_panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reading_route_title"
      tabindex="-1"
    >
      <div class="drawer_header">
        <h2 id="reading_route_title" class="drawer_title">阅读路线</h2>
        <button
          ref="closeBtnRef"
          type="button"
          class="drawer_close_btn"
          @click="emit('close')"
        >
          关闭 [ESC]
        </button>
      </div>

      <div class="drawer_meta">
        <p class="route_intro">{{ ROUTE_INTRO }}</p>
        <div class="progress_block">
          <div class="progress_row">
            <span class="progress_text">已完成 {{ doneCount }} / {{ TOTAL_ROUTE_STEPS }} 步</span>
            <button
              type="button"
              class="reset_btn"
              :disabled="doneCount === 0 && !storageError"
              @click="handleReset"
            >
              重置进度
            </button>
          </div>
          <div
            class="progress_track"
            role="progressbar"
            aria-label="阅读路线完成进度"
            :aria-valuenow="doneCount"
            aria-valuemin="0"
            :aria-valuemax="TOTAL_ROUTE_STEPS"
          >
            <div class="progress_fill" :style="{ width: `${progressPercent}%` }"></div>
          </div>
        </div>

        <div v-if="nextIncompleteStep" class="continue_card">
          <div class="continue_info">
            <span class="continue_label">下一未完成</span>
            <span class="step_code">{{ nextIncompleteStep.step.code }}</span>
            <span v-if="nextStepName" class="step_name">{{ nextStepName }}</span>
          </div>
          <button
            type="button"
            class="continue_btn"
            :disabled="!canContinueJump"
            @click="handleContinueLearning"
          >
            继续学习
          </button>
        </div>

        <div v-else-if="allStepsDone" class="continue_card continue_card_done">
          <div class="continue_info">
            <span class="done_badge">全部已完成</span>
            <span class="continue_done_hint">可点击下方任意步骤重读</span>
          </div>
        </div>

        <div v-if="storageError" class="storage_error_notice" role="status">
          <span class="storage_error_text">{{ storageErrorMessage }}</span>
          <button
            type="button"
            class="storage_retry_btn"
            @click="handleRetryStorage"
          >
            {{ retryButtonLabel }}
          </button>
        </div>
      </div>

      <div class="drawer_body">
        <section v-for="stage in ROUTE_STAGES" :key="stage.id" class="route_stage">
          <h3 class="stage_title">{{ stage.title }}</h3>
          <p class="stage_goal">{{ stage.goal }}</p>
          <ul class="stage_steps">
            <li
              v-for="step in stage.steps"
              :key="step.code"
              class="step_row"
              :class="{
                current: step.code === currentCode,
                done: isRouteStepDone(stage.id, step.code)
              }"
            >
              <label class="step_check_wrap">
                <input
                  type="checkbox"
                  class="step_checkbox"
                  :checked="isRouteStepDone(stage.id, step.code)"
                  :aria-label="`标记完成：${step.code}`"
                  @change="toggleRouteStepDone(stage.id, step.code)"
                >
              </label>
              <div class="step_content">
                <div class="step_head">
                  <span class="step_code">{{ step.code }}</span>
                  <span v-if="getNodeName(step.code)" class="step_name">{{ getNodeName(step.code) }}</span>
                  <span v-if="step.code === currentCode" class="current_badge">当前</span>
                </div>
                <p class="step_task">{{ step.task }}</p>
              </div>
              <button
                type="button"
                class="jump_btn"
                :disabled="!getNode(step.code)"
                @click="requestJump(step.code)"
              >
                前往
              </button>
            </li>
          </ul>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { ROUTE_INTRO, ROUTE_STAGES } from '../config/readingRoute'
import type { IsmNodeEntry } from '../types/research'
import {
  TOTAL_ROUTE_STEPS,
  findFirstIncompleteRouteStep,
  isRouteStepDone,
  loadRouteProgress,
  resetRouteProgress,
  routeDoneIds,
  routeProgressErrorKind,
  routeProgressHasPending,
  routeProgressStorageError,
  saveRouteProgress,
  toggleRouteStepDone
} from '../utils/routeProgress'

const props = defineProps<{
  open: boolean
  currentCode: string
  getNode: (code: string) => IsmNodeEntry | null
  fallbackFocusSelector?: string
}>()

const emit = defineEmits<{
  close: []
  jump: [code: string]
}>()

const panelRef = ref<HTMLElement | null>(null)
const closeBtnRef = ref<HTMLButtonElement | null>(null)
let previouslyFocusedElement: HTMLElement | null = null
let openFocusToken = 0
let disposed = false
let suppressRestoreOnJump = false

const isFocusableCandidate = (element: HTMLElement | null | undefined): element is HTMLElement => {
  return Boolean(element?.isConnected && !(element as HTMLButtonElement).disabled &&
    element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden')
}

const doneCount = computed(() => routeDoneIds.value.length)
const progressPercent = computed(() => {
  if (TOTAL_ROUTE_STEPS === 0) return 0
  return Math.round((doneCount.value / TOTAL_ROUTE_STEPS) * 100)
})

const getNodeName = (code: string): string => {
  return props.getNode(code)?.ch_name ?? ''
}

const nextIncompleteStep = computed(() => findFirstIncompleteRouteStep(routeDoneIds.value))
const allStepsDone = computed(() => TOTAL_ROUTE_STEPS > 0 && nextIncompleteStep.value === null)
const nextStepName = computed(() =>
  nextIncompleteStep.value ? getNodeName(nextIncompleteStep.value.step.code) : ''
)
const canContinueJump = computed(() =>
  Boolean(nextIncompleteStep.value && props.getNode(nextIncompleteStep.value.step.code))
)
const storageError = computed(() => routeProgressStorageError.value)
const errorKind = computed(() => routeProgressErrorKind.value)
const hasPendingChanges = computed(() => routeProgressHasPending.value)

const storageErrorMessage = computed(() => {
  if (errorKind.value === 'read') {
    return hasPendingChanges.value
      ? '进度读取失败：原存储不可读取或数据已损坏，已阻止覆盖原数据；当前改动仅暂存在本次会话'
      : '进度读取失败：浏览器存储不可读取或数据已损坏，已保留原数据'
  }
  return '进度保存失败：无法写入浏览器存储，当前改动仅暂存在本次会话'
})

const retryButtonLabel = computed(() => {
  if (errorKind.value === 'read') {
    return hasPendingChanges.value ? '重试读取并保存' : '重试读取'
  }
  return '重试保存'
})

const handleContinueLearning = () => {
  const target = nextIncompleteStep.value
  if (!target || !props.getNode(target.step.code)) return
  requestJump(target.step.code)
}

const handleRetryStorage = () => {
  const token = openFocusToken
  const source = document.activeElement
  if (errorKind.value === 'read' && !hasPendingChanges.value) {
    loadRouteProgress()
  } else {
    saveRouteProgress(routeDoneIds.value)
  }
  void nextTick(() => {
    if (!disposed && token === openFocusToken && props.open && !storageError.value &&
      (document.activeElement === source || document.activeElement === document.body)) {
      closeBtnRef.value?.focus()
    }
  })
}

const handleReset = () => {
  if (doneCount.value === 0 && !storageError.value) return
  const confirmText =
    storageError.value && errorKind.value === 'read'
      ? '当前阅读路线存储读取异常，确认清空并重置阅读路线进度？'
      : '重置阅读路线进度？'
  if (window.confirm(confirmText)) {
    const token = openFocusToken
    const source = document.activeElement
    resetRouteProgress()
    void nextTick(() => {
      if (!disposed && token === openFocusToken && props.open &&
        (document.activeElement === source || document.activeElement === document.body)) {
        closeBtnRef.value?.focus()
      }
    })
  }
}

const hasOtherVisibleModal = () => Array.from(document.querySelectorAll?.('[aria-modal="true"]') ?? [])
  .some(element => element !== panelRef.value && isFocusableCandidate(element as HTMLElement))

const requestJump = (code: string) => {
  if (!props.getNode(code)) return
  const token = openFocusToken
  suppressRestoreOnJump = true
  emit('jump', code)
  void nextTick(() => { if (!disposed && props.open && token === openFocusToken) suppressRestoreOnJump = false })
}

const restoreFocus = () => {
  const active = document.activeElement
  const external = active && active !== document.body && active !== document.documentElement &&
    active.isConnected && !panelRef.value?.contains(active)
  const previous = previouslyFocusedElement
  previouslyFocusedElement = null
  if (external) return
  if (hasOtherVisibleModal()) return
  if (isFocusableCandidate(previous)) {
    previous.focus()
  } else if (props.fallbackFocusSelector) {
    const fallback = document.querySelector<HTMLElement>(props.fallbackFocusSelector)
    if (isFocusableCandidate(fallback)) fallback.focus()
  }
}

watch(
  () => props.open,
  async (isOpen, wasOpen) => {
    const token = ++openFocusToken
    if (isOpen && !wasOpen) {
      suppressRestoreOnJump = false
      const source = document.activeElement
      previouslyFocusedElement = source instanceof HTMLElement &&
        source !== document.body && source !== document.documentElement ? source : null
      document.documentElement.style.overflow = 'hidden'
      await nextTick()
      if (disposed || !props.open || token !== openFocusToken) return
      const active = document.activeElement
      if (active && active !== source && active !== document.body && active !== document.documentElement &&
        active.isConnected && !panelRef.value?.contains(active)) return
      if (isFocusableCandidate(closeBtnRef.value)) closeBtnRef.value.focus()
    } else if (!isOpen && wasOpen) {
      const skipRestore = suppressRestoreOnJump
      suppressRestoreOnJump = false
      document.documentElement.style.overflow = ''
      await nextTick()
      if (!disposed && !props.open && token === openFocusToken) {
        if (hasOtherVisibleModal()) document.documentElement.style.overflow = 'hidden'
        if (skipRestore) previouslyFocusedElement = null
        else restoreFocus()
      }
    }
  },
  { immediate: true }
)

const getFocusableElements = (): HTMLElement[] => {
  if (!panelRef.value) return []
  const selector =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  return Array.from(panelRef.value.querySelectorAll<HTMLElement>(selector)).filter(
    (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden'
  )
}

const handleKeydown = (event: KeyboardEvent) => {
  if (!props.open) return
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
    return
  }
  if (event.key === 'Tab') {
    const focusables = getFocusableElements()
    if (focusables.length === 0) {
      event.preventDefault()
      panelRef.value?.focus()
      return
    }
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    const active = document.activeElement
    if (event.shiftKey) {
      if (active === first || !panelRef.value?.contains(active)) {
        event.preventDefault()
        last.focus()
      }
    } else if (active === last || !panelRef.value?.contains(active)) {
      event.preventDefault()
      first.focus()
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  disposed = true
  suppressRestoreOnJump = false
  openFocusToken++
  previouslyFocusedElement = null
  document.documentElement.style.overflow = ''
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.route_drawer_backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
  background-color: var(--surface-backdrop);
  backdrop-filter: blur(6px);
  display: flex;
  justify-content: flex-end;
}

.route_drawer_panel {
  width: min(max(34rem, 340px), 100vw);
  max-width: 100%;
  height: 100%;
  background-color: var(--surface-canvas);
  border-left: 1px solid var(--border-subtle);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--ink-primary);
  font-size: max(0.88rem, 14px);
  box-sizing: border-box;
}

.drawer_header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.85rem 1.2rem;
  background-color: var(--surface-elevated);
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
  min-width: 0;
}

.drawer_title {
  margin: 0;
  font-size: 1.15em;
  font-weight: 700;
  min-width: 0;
}

.drawer_close_btn {
  padding: 0.35rem 0.85rem;
  background-color: var(--surface-subtle);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-pill);
  cursor: pointer;
  font-size: 0.88em;
  font-weight: 500;
  color: var(--ink-primary);
  flex-shrink: 0;
  white-space: nowrap;
  transition: background-color 0.14s ease, border-color 0.14s ease;
}

.drawer_close_btn:hover {
  background-color: var(--surface-hover);
  border-color: var(--border-strong);
}

.drawer_meta {
  padding: 0.85rem 1.2rem;
  background-color: var(--surface-subtle);
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  flex-shrink: 0;
}

.route_intro {
  margin: 0;
  font-size: 0.9em;
  line-height: 1.5;
  color: var(--ink-secondary);
}

.progress_block {
  display: flex;
  flex-direction: column;
  gap: 0.38rem;
}

.progress_row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  min-width: 0;
}

.progress_text {
  font-size: 0.92em;
  font-weight: 600;
}

.reset_btn {
  padding: 0.22rem 0.65rem;
  background-color: var(--surface-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-pill);
  cursor: pointer;
  font-size: 0.84em;
  color: var(--ink-secondary);
}

.reset_btn:hover:not(:disabled) {
  background-color: var(--surface-hover);
  color: var(--ink-primary);
}

.reset_btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.progress_track {
  width: 100%;
  height: 0.45rem;
  background-color: var(--surface-sunken);
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-subtle);
  box-sizing: border-box;
  overflow: hidden;
}

.progress_fill {
  height: 100%;
  background-color: var(--accent);
  border-radius: var(--radius-pill);
  transition: width 0.25s var(--ease-out-expo);
}

.continue_card {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 0.7rem;
  padding: 0.6rem 0.8rem;
  background-color: var(--accent-soft);
  border: 1px solid var(--accent-border);
  border-radius: var(--radius-md);
  box-sizing: border-box;
  min-width: 0;
  max-width: 100%;
}

.continue_card_done {
  background-color: var(--status-verified-soft);
  border-color: var(--status-verified);
}

.continue_info {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  flex: 1 1 10rem;
  min-width: 0;
}

.continue_label {
  font-size: 0.88em;
  font-weight: 600;
  color: var(--accent-text);
}

.done_badge {
  font-size: 0.84em;
  font-weight: 600;
  padding: 0.08rem 0.5rem;
  border-radius: var(--radius-pill);
  background-color: var(--status-verified);
  color: var(--ink-inverse);
}

.continue_done_hint {
  font-size: 0.88em;
  color: var(--status-verified-text);
  overflow-wrap: anywhere;
}

.continue_btn {
  flex-shrink: 0;
  padding: 0.32rem 0.85rem;
  background-color: var(--accent);
  border: 1px solid var(--accent);
  border-radius: var(--radius-pill);
  cursor: pointer;
  font-size: 0.88em;
  font-weight: 600;
  color: var(--ink-inverse);
  white-space: nowrap;
}

.continue_btn:hover:not(:disabled) {
  background-color: var(--accent-hover);
}

.continue_btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.storage_error_notice {
  margin: 0;
  padding: 0.5rem 0.7rem;
  background-color: var(--status-danger-soft);
  border: 1px solid var(--status-danger);
  border-radius: var(--radius-md);
  color: var(--status-danger-text);
  font-size: 0.86em;
  font-weight: 600;
  line-height: 1.4;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem 0.6rem;
}

.storage_error_text {
  flex: 1 1 12rem;
  min-width: 0;
  overflow-wrap: anywhere;
}

.storage_retry_btn {
  flex-shrink: 0;
  padding: 0.22rem 0.65rem;
  background-color: var(--surface-elevated);
  border: 1px solid var(--status-danger);
  border-radius: var(--radius-pill);
  cursor: pointer;
  font-size: 0.9em;
  font-weight: 600;
  color: var(--status-danger-text);
  white-space: nowrap;
}

.storage_retry_btn:hover {
  background-color: var(--status-danger);
  color: var(--ink-inverse);
}

.drawer_body {
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 1rem 1.2rem 1.4rem;
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
}

.route_stage {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
  max-width: 100%;
}

.stage_title {
  margin: 0;
  font-size: 1.06em;
  font-weight: 700;
  padding-bottom: 0.28rem;
  border-bottom: 1px solid var(--border-subtle);
}

.stage_goal {
  margin: 0;
  font-size: 0.9em;
  line-height: 1.5;
  color: var(--ink-secondary);
}

.stage_steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
  max-width: 100%;
}

.step_row {
  content-visibility: auto;
  contain-intrinsic-size: auto 76px;
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  padding: 0.65rem 0.75rem;
  background-color: var(--surface-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-xs);
  box-sizing: border-box;
  min-width: 0;
  max-width: 100%;
}

.step_row.done {
  background-color: var(--status-verified-soft);
  border-color: var(--status-verified);
}

.step_row.current {
  background-color: var(--accent-soft);
  border: 2px solid var(--accent);
}

.step_check_wrap {
  display: flex;
  align-items: center;
  padding-top: 0.15rem;
  flex-shrink: 0;
}

.step_checkbox {
  width: 1.05rem;
  height: 1.05rem;
  accent-color: var(--accent);
  cursor: pointer;
}

.step_content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.step_head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
}

.step_code {
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: 0.92em;
  padding: 0.08rem 0.45rem;
  border-radius: var(--radius-xs);
  background-color: var(--surface-subtle);
  border: 1px solid var(--border-default);
  max-width: 100%;
  overflow-wrap: anywhere;
}

.step_name {
  font-weight: 600;
  font-size: 0.96em;
  max-width: 100%;
  overflow-wrap: anywhere;
}

.current_badge {
  font-size: 0.78em;
  font-weight: 600;
  padding: 0.08rem 0.45rem;
  border-radius: var(--radius-pill);
  background-color: var(--accent);
  color: var(--ink-inverse);
}

.step_task {
  margin: 0;
  font-size: 0.9em;
  line-height: 1.5;
  color: var(--ink-secondary);
  overflow-wrap: anywhere;
}

.jump_btn {
  flex-shrink: 0;
  padding: 0.28rem 0.72rem;
  background-color: var(--accent-soft);
  border: 1px solid var(--accent-border);
  border-radius: var(--radius-pill);
  cursor: pointer;
  font-size: 0.86em;
  font-weight: 500;
  color: var(--accent-text);
  align-self: center;
  white-space: nowrap;
}

.jump_btn:hover:not(:disabled) {
  background-color: var(--accent);
  border-color: var(--accent);
  color: var(--ink-inverse);
}

.jump_btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 420px) {
  .drawer_header,
  .drawer_meta,
  .drawer_body {
    padding-left: 0.85rem;
    padding-right: 0.85rem;
  }

  .step_row {
    gap: 0.5rem;
    padding: 0.55rem;
  }
}
</style>
