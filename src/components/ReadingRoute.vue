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
              :disabled="doneCount === 0"
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

        <p v-if="storageError" class="storage_error_notice" role="status">
          进度保存失败：浏览器存储不可用，当前仅在本次会话有效
        </p>
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
                @click="emit('jump', step.code)"
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
  resetRouteProgress,
  routeDoneIds,
  routeProgressStorageError,
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

const handleContinueLearning = () => {
  const target = nextIncompleteStep.value
  if (!target || !props.getNode(target.step.code)) return
  emit('jump', target.step.code)
}

const handleReset = () => {
  if (doneCount.value === 0) return
  if (window.confirm('重置阅读路线进度？')) {
    resetRouteProgress()
    void nextTick(() => {
      if (props.open) {
        closeBtnRef.value?.focus()
      }
    })
  }
}

const restoreFocus = () => {
  if (previouslyFocusedElement && previouslyFocusedElement.isConnected) {
    previouslyFocusedElement.focus()
  } else if (props.fallbackFocusSelector) {
    const fallback = document.querySelector<HTMLElement>(props.fallbackFocusSelector)
    fallback?.focus()
  }
  previouslyFocusedElement = null
}

watch(
  () => props.open,
  async (isOpen, wasOpen) => {
    if (isOpen && !wasOpen) {
      previouslyFocusedElement =
        document.activeElement instanceof HTMLElement ? document.activeElement : null
      document.documentElement.style.overflow = 'hidden'
      await nextTick()
      if (props.open) {
        closeBtnRef.value?.focus()
      }
    } else if (!isOpen && wasOpen) {
      document.documentElement.style.overflow = ''
      await nextTick()
      restoreFocus()
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
  document.documentElement.style.overflow = ''
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.route_drawer_backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
  background-color: rgba(0, 0, 0, 0.45);
  display: flex;
  justify-content: flex-end;
}

.route_drawer_panel {
  width: min(max(32rem, 340px), 100vw);
  max-width: 100%;
  height: 100%;
  background-color: rgb(230, 230, 230);
  border-left: 2px solid black;
  box-shadow: -0.4rem 0 1.5rem rgba(0, 0, 0, 0.55);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: black;
  font-size: max(0.85rem, 13px);
  box-sizing: border-box;
}

.drawer_header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.65rem 1rem;
  background-color: rgb(200, 200, 200);
  border-bottom: 1px solid black;
  flex-shrink: 0;
  min-width: 0;
}

.drawer_title {
  margin: 0;
  font-size: 1.18em;
  font-weight: bold;
  min-width: 0;
}

.drawer_close_btn {
  padding: 0.2rem 0.6rem;
  background-color: rgb(220, 220, 220);
  border: 1px solid black;
  cursor: pointer;
  font-size: 0.92em;
  color: black;
  flex-shrink: 0;
  white-space: nowrap;
}

.drawer_close_btn:hover {
  background-color: gray;
  color: white;
}

.drawer_meta {
  padding: 0.65rem 1rem;
  background-color: rgb(218, 218, 218);
  border-bottom: 1px solid black;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  flex-shrink: 0;
}

.route_intro {
  margin: 0;
  font-size: 0.92em;
  line-height: 1.45;
  color: rgb(65, 65, 65);
}

.progress_block {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
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
  font-size: 0.94em;
  font-weight: bold;
}

.reset_btn {
  padding: 0.14rem 0.5rem;
  background-color: rgb(232, 232, 232);
  border: 1px solid rgb(90, 90, 90);
  cursor: pointer;
  font-size: 0.87em;
  color: black;
}

.reset_btn:hover:not(:disabled) {
  background-color: rgb(195, 195, 195);
}

.reset_btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.progress_track {
  width: 100%;
  height: 0.35rem;
  background-color: rgb(185, 185, 185);
  border: 1px solid rgb(120, 120, 120);
  box-sizing: border-box;
  overflow: hidden;
}

.progress_fill {
  height: 100%;
  background-color: darkcyan;
  transition: width 0.2s ease;
}

.continue_card {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem 0.6rem;
  padding: 0.42rem 0.55rem;
  background-color: rgb(206, 232, 232);
  border: 1px solid darkcyan;
  box-sizing: border-box;
  min-width: 0;
  max-width: 100%;
}

.continue_card_done {
  background-color: rgb(214, 228, 220);
  border-color: rgb(95, 130, 105);
}

.continue_info {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  flex: 1 1 10rem;
  min-width: 0;
}

.continue_label {
  font-size: 0.88em;
  font-weight: bold;
  color: rgb(20, 65, 65);
}

.done_badge {
  font-size: 0.86em;
  font-weight: bold;
  padding: 0.04rem 0.35rem;
  background-color: rgb(70, 115, 85);
  color: white;
}

.continue_done_hint {
  font-size: 0.88em;
  color: rgb(35, 60, 42);
  overflow-wrap: anywhere;
}

.continue_btn {
  flex-shrink: 0;
  padding: 0.2rem 0.6rem;
  background-color: darkcyan;
  border: 1px solid black;
  cursor: pointer;
  font-size: 0.89em;
  font-weight: bold;
  color: white;
  white-space: nowrap;
}

.continue_btn:hover:not(:disabled) {
  background-color: rgb(0, 105, 105);
}

.continue_btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.storage_error_notice {
  margin: 0;
  padding: 0.3rem 0.45rem;
  background-color: rgb(248, 226, 226);
  border: 1px solid #a00000;
  color: #a00000;
  font-size: 0.86em;
  font-weight: bold;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.drawer_body {
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 0.8rem 1rem 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.route_stage {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-width: 0;
  max-width: 100%;
}

.stage_title {
  margin: 0;
  font-size: 1.08em;
  font-weight: bold;
  padding-bottom: 0.2rem;
  border-bottom: 1px solid rgb(135, 135, 135);
}

.stage_goal {
  margin: 0;
  font-size: 0.92em;
  line-height: 1.4;
  color: rgb(55, 55, 55);
}

.stage_steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  min-width: 0;
  max-width: 100%;
}

.step_row {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  padding: 0.5rem 0.6rem;
  background-color: rgb(222, 222, 222);
  border: 1px solid rgb(135, 135, 135);
  box-sizing: border-box;
  min-width: 0;
  max-width: 100%;
}

.step_row.done {
  background-color: rgb(214, 228, 220);
  border-color: rgb(95, 130, 105);
}

.step_row.current {
  background-color: rgb(196, 228, 228);
  border: 2px solid darkcyan;
}

.step_check_wrap {
  display: flex;
  align-items: center;
  padding-top: 0.15rem;
  flex-shrink: 0;
}

.step_checkbox {
  width: 1rem;
  height: 1rem;
  cursor: pointer;
}

.step_content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.22rem;
}

.step_head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
}

.step_code {
  font-weight: bold;
  font-size: 0.96em;
  padding: 0.02rem 0.35rem;
  background-color: rgb(238, 238, 238);
  border: 1px solid rgb(95, 95, 95);
  max-width: 100%;
  overflow-wrap: anywhere;
}

.step_name {
  font-weight: bold;
  font-size: 0.96em;
  max-width: 100%;
  overflow-wrap: anywhere;
}

.current_badge {
  font-size: 0.82em;
  padding: 0.02rem 0.3rem;
  background-color: darkcyan;
  color: white;
}

.step_task {
  margin: 0;
  font-size: 0.92em;
  line-height: 1.45;
  color: rgb(35, 35, 35);
  overflow-wrap: anywhere;
}

.jump_btn {
  flex-shrink: 0;
  padding: 0.2rem 0.5rem;
  background-color: rgb(206, 232, 232);
  border: 1px solid black;
  cursor: pointer;
  font-size: 0.89em;
  color: black;
  align-self: center;
  white-space: nowrap;
}

.jump_btn:hover:not(:disabled) {
  background-color: darkcyan;
  color: white;
}

.jump_btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 420px) {
  .drawer_header,
  .drawer_meta,
  .drawer_body {
    padding-left: 0.75rem;
    padding-right: 0.75rem;
  }

  .step_row {
    gap: 0.45rem;
    padding: 0.45rem;
  }
}
</style>
