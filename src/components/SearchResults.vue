<template>
  <div v-if="open" class="search_drawer_backdrop" @click.self="emit('close')">
    <div
      ref="panelRef"
      class="search_drawer_panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="search_results_title"
      tabindex="-1"
      @keydown="handlePanelArrowNavigation"
    >
      <div class="drawer_header">
        <h2 id="search_results_title" class="drawer_title">搜索结果</h2>
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
        <div class="search_meta_row">
          <template v-if="normalizedQuery">
            <span class="meta_label">检索词：</span>
            <span class="query_chip">{{ normalizedQuery }}</span>
          </template>
          <span v-else class="meta_label">未输入有效检索词</span>
        </div>

        <div class="search_count_row">
          <template v-if="!ismLoaded && ismLoadError">
            <span class="count_text count_error">基础节点数据加载失败</span>
          </template>
          <template v-else-if="!ismLoaded">
            <span class="count_text">正在加载节点基础数据...</span>
          </template>
          <template v-else-if="!normalizedQuery">
            <span class="count_text">共 {{ totalNodes }} 节点可检索</span>
          </template>
          <template v-else-if="isIndexIncomplete">
            <span class="count_text count_warn">
              已加载数据命中 {{ results.length }} / {{ totalNodes }} 节点（索引未完整就绪）
            </span>
          </template>
          <template v-else>
            <span class="count_text">共命中 {{ results.length }} / {{ totalNodes }} 节点</span>
          </template>
        </div>

        <div v-if="ismLoaded && hasIndexError" class="status_banner status_error" role="status">
          <div class="status_banner_text">
            部分检索索引加载失败，当前结果不完整（缺失字段未能纳入检索）：
          </div>
          <div v-if="enrichStatus === 'error'" class="status_retry_row">
            <span>{{ enrichError || '讲稿与校勘索引加载失败' }}</span>
            <button type="button" class="retry_btn" @click="emit('retryEnrichments')">
              重试讲稿与校勘索引
            </button>
          </div>
          <div v-if="coursesStatus === 'error'" class="status_retry_row">
            <span>{{ coursesError || '补充课程目录加载失败' }}</span>
            <button type="button" class="retry_btn" @click="emit('retryCourses')">
              重试课程目录
            </button>
          </div>
        </div>

        <div v-if="ismLoaded && hasIndexLoading" class="status_banner status_loading" role="status">
          <span class="status_banner_text">
            {{ loadingIndexLabel }}加载中，当前仅为已就绪数据的部分结果，加载完成后将自动更新。
          </span>
        </div>

        <div class="keyboard_hint">
          键盘操作：↑/↓ 切换结果 · Enter 跳转 · Tab 循环 · Esc 返回入口
        </div>
      </div>

      <div ref="bodyRef" class="drawer_body">
        <div v-if="!ismLoaded && ismLoadError" class="empty_state_box error_state_box">
          {{ ismLoadError }}
        </div>
        <div v-else-if="!ismLoaded" class="empty_state_box">
          正在加载节点基础数据，请稍候...
        </div>
        <div v-else-if="!normalizedQuery" class="empty_state_box">
          请在搜索框中输入关键词或节点编号（如 1-1、笛卡尔），空白输入不触发检索。
        </div>
        <div v-else-if="results.length === 0" class="empty_state_box">
          <p class="empty_title">未找到与“{{ normalizedQuery }}”匹配的节点</p>
          <p v-if="hasIndexError" class="empty_sub">
            部分检索索引加载失败，以上仅代表已加载字段；请先点击上方重试按钮后再确认结果。
          </p>
          <p v-else-if="hasIndexLoading" class="empty_sub">
            {{ loadingIndexLabel }}仍在异步加载中，结果尚不完整，请稍候查看自动更新。
          </p>
          <p v-else class="empty_sub">
            可尝试缩短关键词、改用英文名或直接检索节点编号（如 1-1、2-3-2）。
          </p>
        </div>
        <ul v-else class="results_list" role="list">
          <li v-for="(item, idx) in results" :key="item.code" class="result_list_li">
            <button
              :ref="(el) => setItemRef(idx, el)"
              type="button"
              class="result_item_btn"
              :class="{ current: item.code === currentCode }"
              :disabled="!canJumpTo(item.code)"
              @click="emit('jump', item.code, item.targetTab)"
            >
              <div class="result_item_top">
                <span class="result_code_badge">
                  <HighlightText :text="item.code" :query="normalizedQuery" />
                </span>
                <span v-if="item.code === currentCode" class="current_badge">当前</span>
                <span class="result_target_hint">→ {{ SEARCH_TARGET_TAB_LABELS[item.targetTab] }}</span>
              </div>
              <div class="result_ch_name">
                <HighlightText :text="item.node.ch_name" :query="normalizedQuery" />
              </div>
              <div v-if="item.node.en_name" class="result_en_name">
                <HighlightText :text="item.node.en_name" :query="normalizedQuery" />
              </div>
              <div class="result_locations_row">
                <span class="locations_label">匹配位置：</span>
                <span
                  v-for="loc in item.locations"
                  :key="loc"
                  class="location_badge"
                  :class="`loc_${loc}`"
                >
                  {{ SEARCH_LOCATION_LABELS[loc] }}
                </span>
              </div>
            </button>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import HighlightText from './HighlightText.vue'
import { normalizeSearchQuery } from '../utils/ismFormat'
import {
  SEARCH_LOCATION_LABELS,
  SEARCH_TARGET_TAB_LABELS,
  type NodeSearchResult,
  type SearchMatchTabKey
} from '../utils/searchNodes'

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

const props = defineProps<{
  open: boolean
  query: string
  results: NodeSearchResult[]
  totalNodes: number
  currentCode: string
  ismLoaded: boolean
  ismLoadError: string
  enrichStatus: LoadStatus
  enrichError: string
  coursesStatus: LoadStatus
  coursesError: string
  canJump?: (code: string) => boolean
  fallbackFocusSelector?: string
}>()

const emit = defineEmits<{
  close: []
  jump: [code: string, tab: SearchMatchTabKey]
  retryEnrichments: []
  retryCourses: []
}>()

const panelRef = ref<HTMLElement | null>(null)
const closeBtnRef = ref<HTMLButtonElement | null>(null)
const bodyRef = ref<HTMLElement | null>(null)
let itemRefs: (HTMLButtonElement | null)[] = []
let previouslyFocusedElement: HTMLElement | null = null

const normalizedQuery = computed(() => normalizeSearchQuery(props.query))
const hasIndexError = computed(
  () => props.enrichStatus === 'error' || props.coursesStatus === 'error'
)
const hasIndexLoading = computed(() => {
  if (!props.ismLoaded) return false
  const enrichPending = props.enrichStatus === 'loading' || props.enrichStatus === 'idle'
  const coursesPending = props.coursesStatus === 'loading' || props.coursesStatus === 'idle'
  return enrichPending || coursesPending
})
const isIndexIncomplete = computed(
  () => !props.ismLoaded || Boolean(props.ismLoadError) || hasIndexError.value || hasIndexLoading.value
)
const loadingIndexLabel = computed(() => {
  const parts: string[] = []
  if (props.enrichStatus === 'loading' || props.enrichStatus === 'idle') {
    parts.push('讲稿与校勘索引')
  }
  if (props.coursesStatus === 'loading' || props.coursesStatus === 'idle') {
    parts.push('补充课程目录')
  }
  return parts.join('、') || '补充索引'
})

const canJumpTo = (code: string): boolean => {
  return props.canJump ? props.canJump(code) : Boolean(code)
}

const setItemRef = (idx: number, el: unknown) => {
  itemRefs[idx] = el instanceof HTMLButtonElement ? el : null
}

watch(
  () => props.results.length,
  (len) => {
    itemRefs.length = len
    if (bodyRef.value) {
      bodyRef.value.scrollTop = 0
    }
  }
)

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

const focusResultAt = (targetIdx: number) => {
  const buttons = itemRefs
  if (buttons.length === 0) return
  const clamped = Math.max(0, Math.min(targetIdx, buttons.length - 1))
  const btn = buttons[clamped]
  if (btn && !btn.disabled) {
    btn.focus()
    btn.scrollIntoView?.({ block: 'nearest' })
  }
}

const handlePanelArrowNavigation = (event: KeyboardEvent) => {
  if (!props.open || props.results.length === 0) return
  const active = document.activeElement
  const currentIdx = itemRefs.findIndex((btn) => btn === active)

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    if (currentIdx < 0) {
      focusResultAt(0)
    } else if (currentIdx < itemRefs.length - 1) {
      focusResultAt(currentIdx + 1)
    }
  } else if (event.key === 'ArrowUp') {
    if (currentIdx > 0) {
      event.preventDefault()
      focusResultAt(currentIdx - 1)
    } else if (currentIdx === 0) {
      event.preventDefault()
      closeBtnRef.value?.focus()
    }
  } else if (event.key === 'Home' && currentIdx >= 0) {
    event.preventDefault()
    focusResultAt(0)
  } else if (event.key === 'End' && currentIdx >= 0) {
    event.preventDefault()
    focusResultAt(itemRefs.length - 1)
  }
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
.search_drawer_backdrop {
  position: fixed;
  inset: 0;
  z-index: 205;
  background-color: rgba(0, 0, 0, 0.45);
  display: flex;
  justify-content: flex-end;
}

.search_drawer_panel {
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

.search_drawer_panel button:focus-visible {
  outline: 2px solid darkcyan;
  outline-offset: 1px;
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
  gap: 0.42rem;
  flex-shrink: 0;
  min-width: 0;
}

.search_meta_row,
.search_count_row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
  max-width: 100%;
}

.meta_label {
  font-weight: bold;
  color: rgb(45, 45, 45);
}

.query_chip {
  display: inline-block;
  padding: 0.05rem 0.4rem;
  background-color: rgb(252, 232, 180);
  border: 1px solid rgb(150, 100, 0);
  font-weight: bold;
  max-width: 100%;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.count_text {
  font-size: 0.94em;
  font-weight: bold;
  color: rgb(30, 30, 30);
  overflow-wrap: anywhere;
}

.count_warn {
  color: #8a5a00;
}

.count_error {
  color: #a00000;
}

.status_banner {
  padding: 0.42rem 0.55rem;
  font-size: 0.88em;
  line-height: 1.4;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}

.status_loading {
  background-color: rgb(246, 240, 215);
  border: 1px solid rgb(150, 120, 40);
  color: rgb(72, 54, 12);
}

.status_error {
  background-color: rgb(248, 226, 226);
  border: 1px solid #a00000;
  color: #7d0000;
}

.status_banner_text {
  font-weight: bold;
  overflow-wrap: anywhere;
}

.status_retry_row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.35rem 0.5rem;
  min-width: 0;
}

.retry_btn {
  padding: 0.14rem 0.5rem;
  background-color: rgb(235, 235, 235);
  border: 1px solid black;
  color: black;
  cursor: pointer;
  font-size: 0.92em;
  flex-shrink: 0;
  white-space: nowrap;
}

.retry_btn:hover {
  background-color: darkcyan;
  color: white;
}

.keyboard_hint {
  font-size: 0.84em;
  color: rgb(75, 75, 75);
  overflow-wrap: anywhere;
}

.drawer_body {
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 0.75rem 1rem 1.2rem;
  box-sizing: border-box;
}

.empty_state_box {
  padding: 0.9rem;
  background-color: rgb(222, 222, 222);
  border: 1px solid rgb(135, 135, 135);
  line-height: 1.5;
  color: rgb(45, 45, 45);
  overflow-wrap: anywhere;
  word-break: break-word;
}

.error_state_box {
  background-color: rgb(248, 226, 226);
  border-color: #a00000;
  color: #7d0000;
  white-space: pre-wrap;
}

.empty_title {
  margin: 0 0 0.35rem;
  font-weight: bold;
  color: black;
}

.empty_sub {
  margin: 0;
  font-size: 0.92em;
  color: rgb(65, 65, 65);
}

.results_list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  min-width: 0;
  max-width: 100%;
}

.result_list_li {
  min-width: 0;
  max-width: 100%;
}

.result_item_btn {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  text-align: left;
  padding: 0.55rem 0.65rem;
  background-color: rgb(222, 222, 222);
  border: 1px solid rgb(135, 135, 135);
  color: black;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font: inherit;
}

.result_item_btn:hover:not(:disabled) {
  background-color: rgb(206, 232, 232);
  border-color: black;
}

.result_item_btn.current {
  background-color: rgb(196, 228, 228);
  border: 2px solid darkcyan;
}

.result_item_btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.result_item_top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem 0.45rem;
  min-width: 0;
  max-width: 100%;
}

.result_code_badge {
  display: inline-block;
  padding: 0.04rem 0.38rem;
  background-color: rgb(238, 238, 238);
  border: 1px solid rgb(95, 95, 95);
  font-weight: bold;
  font-size: 0.94em;
  max-width: 100%;
  overflow-wrap: anywhere;
}

.current_badge {
  font-size: 0.82em;
  padding: 0.02rem 0.32rem;
  background-color: darkcyan;
  color: white;
}

.result_target_hint {
  margin-left: auto;
  font-size: 0.84em;
  color: rgb(45, 78, 78);
  overflow-wrap: anywhere;
}

.result_ch_name {
  font-weight: bold;
  font-size: 1.02em;
  line-height: 1.35;
  color: black;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.result_en_name {
  font-size: 0.9em;
  color: rgb(55, 55, 55);
  line-height: 1.3;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.result_locations_row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem;
  margin-top: 0.08rem;
  min-width: 0;
  max-width: 100%;
}

.locations_label {
  font-size: 0.82em;
  color: rgb(70, 70, 70);
}

.location_badge {
  display: inline-block;
  padding: 0.02rem 0.34rem;
  font-size: 0.8em;
  border: 1px solid rgb(95, 95, 95);
  background-color: rgb(238, 238, 238);
}

.location_badge.loc_code_name {
  background-color: rgb(252, 232, 180);
  border-color: rgb(150, 100, 0);
}

.location_badge.loc_overview {
  background-color: rgb(216, 236, 216);
  border-color: rgb(42, 102, 42);
}

.location_badge.loc_courses {
  background-color: rgb(226, 234, 246);
  border-color: rgb(55, 86, 140);
}

.location_badge.loc_editorial {
  background-color: rgb(235, 226, 246);
  border-color: rgb(108, 74, 148);
}

@media (max-width: 420px) {
  .drawer_header,
  .drawer_meta,
  .drawer_body {
    padding-left: 0.75rem;
    padding-right: 0.75rem;
  }

  .result_item_btn {
    padding: 0.45rem 0.5rem;
  }
}
</style>
