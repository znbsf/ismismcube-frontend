<template>
  <div v-if="currentNode" class="axis_anatomy_root">
    <!-- A. 格位条 -->
    <div class="position_strip" role="group" aria-label="四轴格位">
      <div
        v-for="cell in stripCells"
        :key="cell.index"
        class="strip_cell"
        :class="{ is_empty: !cell.digit }"
        :title="cell.digit ? `${cell.fullLabel}${cell.digit}` : '尚未细分'"
      >
        <span class="strip_label" :style="{ color: cell.color }">
          <b>{{ cell.shortLabel }}</b>
        </span>
        <span
          class="strip_digit_box"
          :class="{ is_empty: !cell.digit }"
          :style="cell.digit ? { color: cell.color } : undefined"
        >
          <b>{{ cell.digit ?? '·' }}</b>
        </span>
      </div>
    </div>

    <!-- B. 四格详述 -->
    <div v-if="selfTest && axisDetailRows.length > 0" class="self_test_bar">
      <button
        type="button"
        class="self_test_reveal_all_btn"
        :disabled="allRowsRevealed"
        @click="revealAllRows"
      >
        全部揭晓
      </button>
    </div>

    <div class="axis_details_list">
      <div
        v-for="row in axisDetailRows"
        :key="row.index"
        :ref="(el) => setRowCardRef(row.index, el)"
        class="axis_detail_card"
        role="region"
        :aria-label="`${code} ${AXIS_LABELS[row.index] ?? `第${row.index + 1}轴`}说明`"
        tabindex="-1"
        :style="{ borderLeftColor: row.color }"
      >
        <template v-if="row.fallback">
          <div v-if="isRowHidden(row.index)" class="self_test_prompt_box">
            <span class="self_test_prompt_text">先想一想：在这个分支里，这一格具体指什么？</span>
            <button
              type="button"
              class="self_test_reveal_btn"
              @click="revealRow(row.index, $event)"
            >
              揭晓
            </button>
          </div>
          <div v-else class="axis_main_text">
            <EvidenceMarker v-if="row.fieldEvidence" :evidence="row.fieldEvidence" :query="query">
              <HighlightText :text="row.rawRest" :query="query" />
            </EvidenceMarker>
            <HighlightText v-else :text="row.rawRest" :query="query" />
          </div>
        </template>
        <template v-else>
          <div class="axis_header_line">
            <b :style="{ color: row.color }">{{ row.axisLabel }}</b>
            <span class="axis_digit_box"><b>{{ row.digit }}</b></span>
          </div>
          <div v-if="isRowHidden(row.index)" class="self_test_prompt_box">
            <span class="self_test_prompt_text">先想一想：在这个分支里，{{ row.axisLabel }}{{ row.digit }} 具体指什么？</span>
            <button
              type="button"
              class="self_test_reveal_btn"
              @click="revealRow(row.index, $event)"
            >
              揭晓
            </button>
          </div>
          <template v-else>
            <EvidenceMarker v-if="row.fieldEvidence" :evidence="row.fieldEvidence" :query="query">
              <div class="axis_main_text">
                <HighlightText :text="row.main" :query="query" />
              </div>
              <div v-if="row.note" class="axis_note_text">
                <HighlightText :text="row.note" :query="query" />
              </div>
            </EvidenceMarker>
            <template v-else>
              <div class="axis_main_text">
                <HighlightText :text="row.main" :query="query" />
              </div>
              <div v-if="row.note" class="axis_note_text">
                <HighlightText :text="row.note" :query="query" />
              </div>
            </template>
          </template>
          <div class="axis_origin_line">
            <span v-if="row.isCurrentOrigin" class="origin_new_badge">本层新增</span>
            <template v-else-if="row.originNode">
              <span>定于 </span>
              <button
                type="button"
                class="origin_link_btn"
                @click="emit('jump', row.originCode)"
              >
                {{ row.originCode }} <HighlightText :text="row.originNode.ch_name" :query="query" />
              </button>
            </template>
            <span v-else>定于 {{ row.originCode }}</span>
          </div>
          <details v-if="!isRowHidden(row.index) && row.originDiffText !== null" class="origin_diff_details">
            <summary class="origin_diff_summary">上层原述</summary>
            <div class="origin_diff_body">
              <HighlightText :text="row.originDiffText" :query="query" />
            </div>
          </details>
        </template>

        <div v-if="row.evidenceLocator" class="axis_evidence_chip">
          讲稿定位：{{ row.evidenceLocator }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { IsmNodeEntry, NodeReviewHighlight } from '../types/research'
import { getFieldEvidence } from '../utils/evidence'
import { parseAxisEntry } from '../utils/ismFormat'
import {
  AXIS_COLORS,
  AXIS_LABELS,
  AXIS_SHORT_LABELS,
  compareAxisLists,
  getAxisOriginCode,
  splitAxisDescription
} from '../utils/axisStructure'
import EvidenceMarker from './EvidenceMarker.vue'
import HighlightText from './HighlightText.vue'

const props = defineProps<{
  code: string
  getNode: (code: string) => IsmNodeEntry | null
  query: string
  axisEvidence: (index: number) => { locator?: string } | null | undefined
  reviewHighlights?: NodeReviewHighlight[]
  selfTest: boolean
}>()

const emit = defineEmits<{
  (e: 'jump', code: string): void
}>()

const revealedRows = ref<Record<number, boolean>>({})
const rowCardRefs = new Map<number, HTMLElement>()
let revealFocusToken = 0
let disposed = false
const setRowCardRef = (index: number, el: unknown) => {
  if (el && typeof el === 'object' && 'focus' in el) rowCardRefs.set(index, el as HTMLElement)
  else rowCardRefs.delete(index)
}

watch(
  () => props.code,
  () => {
    revealFocusToken++
    revealedRows.value = {}
  },
  { flush: 'sync' }
)

watch(
  () => props.selfTest,
  (enabled) => {
    revealFocusToken++
    if (!enabled) {
      revealedRows.value = {}
    }
  },
  { flush: 'sync' }
)

const isRowHidden = (index: number): boolean => {
  return props.selfTest && !revealedRows.value[index]
}

const revealRow = async (index: number, event: MouseEvent) => {
  if (!props.selfTest || disposed) return
  const token = ++revealFocusToken
  const code = props.code
  const source = event?.currentTarget
  revealedRows.value = { ...revealedRows.value, [index]: true }
  if (!(source instanceof HTMLElement)) return
  await nextTick()
  if (disposed || token !== revealFocusToken || code !== props.code || !props.selfTest || !revealedRows.value[index]) return
  const target = rowCardRefs.get(index)
  if (!target?.isConnected || target.getClientRects().length === 0 || getComputedStyle(target).visibility === 'hidden') return
  if (document.querySelector?.('[aria-modal="true"]')) return
  if (document.activeElement !== source && document.activeElement !== document.body) return
  target.focus()
}

const revealAllRows = () => {
  revealFocusToken++
  const next: Record<number, boolean> = {}
  for (const row of axisDetailRows.value) {
    next[row.index] = true
  }
  revealedRows.value = next
}

onBeforeUnmount(() => {
  disposed = true
  revealFocusToken++
  rowCardRefs.clear()
})

const allRowsRevealed = computed(() => {
  return axisDetailRows.value.length > 0 && axisDetailRows.value.every((row) => Boolean(revealedRows.value[row.index]))
})

const currentNode = computed<IsmNodeEntry | null>(() => {
  return props.code ? props.getNode(props.code) : null
})

const digits = computed<string[]>(() => {
  return props.code ? props.code.split('-').filter(Boolean) : []
})

const stripCells = computed(() => {
  return [0, 1, 2, 3].map((index) => ({
    index,
    shortLabel: AXIS_SHORT_LABELS[index],
    fullLabel: AXIS_LABELS[index],
    color: AXIS_COLORS[index],
    digit: digits.value[index] ?? null
  }))
})

const axisDetailRows = computed(() => {
  const node = currentNode.value
  if (!node) return []

  return node.axis_list.map((entry, index) => {
    const parsed = parseAxisEntry(entry, index)
    const evidenceLocator = props.axisEvidence(index)?.locator
    const fieldEvidence = getFieldEvidence(props.reviewHighlights, 'axis_list', index)

    if (parsed.fallback) {
      return {
        index,
        fallback: true,
        color: parsed.color,
        rawRest: parsed.rest,
        axisLabel: '',
        digit: '',
        main: '',
        note: '',
        originCode: '',
        originNode: null as IsmNodeEntry | null,
        isCurrentOrigin: false,
        originDiffText: null as string | null,
        evidenceLocator,
        fieldEvidence
      }
    }

    const { main, note } = splitAxisDescription(parsed.rest)
    const originCode = getAxisOriginCode(props.code, index)
    const isCurrentOrigin = originCode === props.code
    const originNode = !isCurrentOrigin && originCode ? props.getNode(originCode) : null

    let originDiffText: string | null = null
    if (originNode && !isCurrentOrigin) {
      const originEntry = originNode.axis_list[index]
      if (originEntry) {
        const cmp = compareAxisLists([originEntry], [entry])[0]
        if (cmp && (cmp.kind === 'different_digit' || cmp.kind === 'same_digit_different_text')) {
          originDiffText = cmp.textA
        }
      }
    }

    return {
      index,
      fallback: false,
      color: parsed.color,
      rawRest: parsed.rest,
      axisLabel: parsed.axisLabel,
      digit: parsed.digit,
      main,
      note,
      originCode,
      originNode,
      isCurrentOrigin,
      originDiffText,
      evidenceLocator,
      fieldEvidence
    }
  })
})
</script>

<style scoped>
.axis_anatomy_root {
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  gap: 0.8em;
  width: 100%;
  box-sizing: border-box;
  color: var(--ink-primary);
}

.axis_anatomy_root button:focus-visible,
.axis_anatomy_root summary:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.axis_detail_card:focus {
  outline: none;
  box-shadow: var(--focus-ring);
}

/* A. 格位条 */
.position_strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.45em;
  width: 100%;
  box-sizing: border-box;
}

.strip_cell {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.3em;
  padding: 0.4em 0.3em;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background-color: var(--surface-elevated);
  box-shadow: var(--shadow-xs);
  font-size: 0.85em;
  font-weight: 500;
  box-sizing: border-box;
}

.strip_cell.is_empty {
  border-style: dashed;
  border-color: var(--border-default);
  background-color: var(--surface-subtle);
  opacity: 0.72;
}

.strip_label {
  white-space: nowrap;
  color: var(--ink-secondary);
}

.strip_digit_box {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.4em;
  height: 1.4em;
  line-height: 1;
  font-family: var(--font-mono);
  font-weight: 700;
  border-radius: var(--radius-xs);
  border: 1.5px solid var(--border-strong);
  background-color: var(--surface-subtle);
  flex-shrink: 0;
}

.strip_digit_box.is_empty {
  border-style: dashed;
  border-color: var(--border-default);
  color: var(--ink-muted);
  background-color: transparent;
}

/* B. 四格详述 */
.axis_details_list {
  display: flex;
  flex-direction: column;
  gap: 0.6em;
}

.axis_detail_card {
  padding: 0.65em 0.85em;
  background-color: var(--surface-elevated);
  border: 1px solid var(--border-subtle);
  border-left-width: 4px;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-xs);
  display: flex;
  flex-direction: column;
  gap: 0.35em;
  min-width: 0;
  box-sizing: border-box;
}

.axis_header_line {
  display: flex;
  align-items: center;
  gap: 0.3em;
  font-weight: 600;
}

.axis_digit_box {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  width: 1.35em;
  height: 1.35em;
  line-height: 1;
  font-family: var(--font-mono);
  font-weight: 700;
  margin: 0 0.2em 0 0;
  border-radius: var(--radius-xs);
  border: 1.5px solid var(--border-strong);
  background: var(--surface-subtle);
  flex-shrink: 0;
}

.axis_main_text {
  overflow-wrap: anywhere;
  word-break: break-word;
  line-height: 1.65;
}

.axis_note_text {
  font-size: 0.88em;
  color: var(--ink-secondary);
  overflow-wrap: anywhere;
  word-break: break-word;
}

.axis_origin_line {
  font-size: 0.88em;
  color: var(--ink-muted);
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35em;
}

.origin_new_badge {
  display: inline-block;
  padding: 0.08em 0.5em;
  border-radius: var(--radius-pill);
  border: 1px solid var(--status-verified);
  background-color: var(--status-verified-soft);
  color: var(--status-verified-text);
  font-weight: 500;
}

.origin_link_btn {
  font: inherit;
  padding: 0;
  border: none;
  background: none;
  color: var(--accent-text);
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
  text-align: left;
  word-break: break-word;
}

.origin_link_btn:hover {
  color: var(--accent-hover);
}

.origin_diff_details {
  font-size: 0.86em;
  color: var(--ink-secondary);
}

.origin_diff_summary {
  cursor: pointer;
  user-select: none;
  display: inline-block;
}

.origin_diff_body {
  margin-top: 0.3em;
  padding: 0.45em 0.65em;
  background-color: var(--surface-subtle);
  border-left: 3px solid var(--border-default);
  border-radius: var(--radius-xs);
  overflow-wrap: anywhere;
  word-break: break-word;
}

.axis_evidence_chip {
  margin-top: 0.15em;
  padding-left: 0.6em;
  border-left: 2px solid var(--border-default);
  font-size: 0.86em;
  color: var(--ink-secondary);
  overflow-wrap: anywhere;
  word-break: break-word;
}

.self_test_bar {
  display: flex;
  justify-content: flex-end;
}

.self_test_reveal_all_btn,
.self_test_reveal_btn {
  font: inherit;
  font-size: 0.86em;
  font-weight: 500;
  padding: 0.3em 0.8em;
  border-radius: var(--radius-pill);
  background-color: var(--accent-soft);
  border: 1px solid var(--accent-border);
  color: var(--accent-text);
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.self_test_reveal_all_btn:hover:not(:disabled),
.self_test_reveal_btn:hover {
  background-color: var(--accent);
  border-color: var(--accent);
  color: var(--ink-inverse);
}

.self_test_reveal_all_btn:disabled {
  opacity: 0.55;
  cursor: default;
}

.self_test_prompt_box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6em;
  padding: 0.55em 0.7em;
  background-color: var(--surface-subtle);
  border: 1px dashed var(--border-default);
  border-radius: var(--radius-sm);
  flex-wrap: wrap;
}

.self_test_prompt_text {
  font-size: 0.9em;
  color: var(--ink-secondary);
  flex: 1;
  min-width: 10em;
}
</style>
