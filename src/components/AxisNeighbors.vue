<template>
  <div
    v-if="currentNode && (siblingItems.length >= 2 || (depth < 4 && childItems.length > 0))"
    class="axis_neighbors_root"
  >
    <!-- C. 同层对比 -->
    <div v-if="siblingItems.length >= 2" class="anatomy_section">
      <div class="anatomy_section_title">同一上层格下的立场（{{ siblingItems.length }}）</div>
      <div class="anatomy_section_hint">选一个与当前立场对比，看差在哪一格</div>

      <div class="sibling_chips_wrap">
        <button
          v-for="sib in siblingItems"
          :key="sib.code"
          type="button"
          class="sibling_chip"
          :class="{
            is_current: sib.code === code,
            is_selected: sib.code === activeTargetCode
          }"
          :disabled="sib.code === code"
          :aria-pressed="sib.code === activeTargetCode"
          @click="toggleCompareTarget(sib.code)"
        >
          <span class="sibling_code">{{ sib.code }}</span>
          <span class="sibling_name"><HighlightText :text="sib.chName" :query="query" /></span>
        </button>
      </div>

      <div v-if="activeTargetCode && activeTargetNode" class="compare_panel">
        <div class="compare_header">
          <div class="compare_title">
            <span>{{ code }}</span>
            <span class="compare_vs">vs</span>
            <span>{{ activeTargetCode }} <HighlightText :text="activeTargetNode.ch_name" :query="query" /></span>
          </div>
          <button
            type="button"
            class="jump_target_btn"
            @click="emit('jump', activeTargetCode)"
          >
            前往 {{ activeTargetCode }}
          </button>
        </div>

        <!-- 差异所在 -->
        <div v-if="diffDigitRows.length > 0" class="compare_group">
          <div class="compare_group_label">差异所在</div>
          <div
            v-for="row in diffDigitRows"
            :key="`diff-digit-${row.index}`"
            class="compare_row is_diff_digit"
            :style="{
              backgroundColor: getAxisTintBg(row.index),
              borderLeftColor: getAxisColor(row.index)
            }"
          >
            <div class="compare_row_head">
              <b :style="{ color: getAxisColor(row.index) }">{{ row.axisLabel }}</b>
            </div>
            <div class="compare_sides">
              <div class="compare_side">
                <div class="compare_side_label">当前 ({{ code }})</div>
                <div class="compare_side_content">
                  <span class="axis_digit_box" :style="{ color: getAxisColor(row.index) }"><b>{{ row.digitA }}</b></span>
                  <HighlightText :text="row.textA" :query="query" />
                </div>
              </div>
              <div class="compare_side">
                <div class="compare_side_label">对比 ({{ activeTargetCode }})</div>
                <div class="compare_side_content">
                  <span class="axis_digit_box" :style="{ color: getAxisColor(row.index) }"><b>{{ row.digitB }}</b></span>
                  <HighlightText :text="row.textB" :query="query" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 同格不同表述 -->
        <div v-if="diffTextRows.length > 0" class="compare_group">
          <div class="compare_group_label">同格不同表述</div>
          <div
            v-for="row in diffTextRows"
            :key="`diff-text-${row.index}`"
            class="compare_row"
          >
            <div class="compare_row_head">
              <b :style="{ color: getAxisColor(row.index) }">{{ row.axisLabel }}</b>
              <span v-if="row.digitA" class="axis_digit_box"><b>{{ row.digitA }}</b></span>
            </div>
            <div class="compare_sides">
              <div class="compare_side">
                <div class="compare_side_label">当前 ({{ code }})</div>
                <div class="compare_side_content">
                  <HighlightText :text="row.textA" :query="query" />
                </div>
              </div>
              <div class="compare_side">
                <div class="compare_side_label">对比 ({{ activeTargetCode }})</div>
                <div class="compare_side_content">
                  <HighlightText :text="row.textB" :query="query" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 缺失格位 -->
        <div v-if="missingRows.length > 0" class="compare_group">
          <div class="compare_group_label">格位缺失</div>
          <div
            v-for="row in missingRows"
            :key="`missing-${row.index}`"
            class="compare_row"
          >
            <div class="compare_row_head">
              <b :style="{ color: getAxisColor(row.index) }">{{ row.axisLabel }}</b>
            </div>
            <div class="compare_sides">
              <div class="compare_side">
                <div class="compare_side_label">当前 ({{ code }})</div>
                <div class="compare_side_content">
                  <template v-if="row.textA || row.digitA">
                    <span v-if="row.digitA" class="axis_digit_box"><b>{{ row.digitA }}</b></span>
                    <HighlightText :text="row.textA" :query="query" />
                  </template>
                  <span v-else class="missing_side_hint">当前（{{ code }}）无此格位</span>
                </div>
              </div>
              <div class="compare_side">
                <div class="compare_side_label">对比 ({{ activeTargetCode }})</div>
                <div class="compare_side_content">
                  <template v-if="row.textB || row.digitB">
                    <span v-if="row.digitB" class="axis_digit_box"><b>{{ row.digitB }}</b></span>
                    <HighlightText :text="row.textB" :query="query" />
                  </template>
                  <span v-else class="missing_side_hint">对比（{{ activeTargetCode }}）无此格位</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 共同前提 -->
        <details v-if="identicalRows.length > 0" class="identical_details">
          <summary class="identical_summary">
            共同前提：{{ identicalSummaryText }}
          </summary>
          <div class="identical_list">
            <div
              v-for="row in identicalRows"
              :key="`identical-${row.index}`"
              class="identical_item"
            >
              <b :style="{ color: getAxisColor(row.index) }">{{ row.axisLabel }}</b>
              <span v-if="row.digitA" class="axis_digit_box"><b>{{ row.digitA }}</b></span>
              <HighlightText :text="row.textA" :query="query" />
            </div>
          </div>
        </details>
      </div>
    </div>

    <!-- D. 下一层如何分化 -->
    <div v-if="depth < 4 && childItems.length > 0" class="anatomy_section">
      <div class="anatomy_section_title">
        下一层在「{{ nextAxisLabel }}」上分化（{{ childItems.length }}）
      </div>
      <div class="children_list">
        <button
          v-for="child in childItems"
          :key="child.code"
          type="button"
          class="child_row_btn"
          :title="child.fullTitle"
          @click="emit('jump', child.code)"
        >
          <div class="child_row_head">
            <span class="child_code">{{ child.code }}</span>
            <span class="child_name"><HighlightText :text="child.chName" :query="query" /></span>
          </div>
          <div v-if="child.hasAxisEntry" class="child_axis_line">
            <span
              v-if="child.digit"
              class="axis_digit_box child_digit_box"
              :style="{ color: child.color }"
            ><b>{{ child.digit }}</b></span>
            <span class="child_main_clamp">
              <HighlightText :text="child.mainText" :query="query" />
            </span>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { IsmNodeEntry } from '../types/research'
import { parseAxisEntry } from '../utils/ismFormat'
import {
  AXIS_COLORS,
  AXIS_LABELS,
  AXIS_SHORT_LABELS,
  compareAxisLists,
  getChildCodes,
  getSiblingCodes,
  splitAxisDescription,
  type AxisComparisonRow
} from '../utils/axisStructure'
import HighlightText from './HighlightText.vue'

const props = defineProps<{
  code: string
  getNode: (code: string) => IsmNodeEntry | null
  query: string
}>()

const emit = defineEmits<{
  (e: 'jump', code: string): void
}>()

const AXIS_TINT_BG = [
  'rgba(255, 0, 0, 0.08)',
  'rgba(0, 128, 0, 0.08)',
  'rgba(0, 0, 255, 0.08)',
  'rgba(255, 140, 0, 0.10)'
] as const

const getAxisColor = (index: number): string => {
  return AXIS_COLORS[index] ?? 'black'
}

const getAxisTintBg = (index: number): string => {
  return AXIS_TINT_BG[index] ?? 'rgba(0, 0, 0, 0.05)'
}

const currentNode = computed<IsmNodeEntry | null>(() => {
  return props.code ? props.getNode(props.code) : null
})

const digits = computed<string[]>(() => {
  return props.code ? props.code.split('-').filter(Boolean) : []
})

const depth = computed<number>(() => digits.value.length)

const hasNode = (c: string): boolean => Boolean(props.getNode(c))

const siblingCodes = computed<string[]>(() => {
  return getSiblingCodes(props.code, hasNode)
})

const siblingItems = computed(() => {
  return siblingCodes.value.map((sibCode) => ({
    code: sibCode,
    chName: props.getNode(sibCode)?.ch_name ?? ''
  }))
})

// Keep comparison selection anchored to its base node so cube hover previews don't wipe it.
const comparisonSelection = ref<{ base: string; target: string } | null>(null)

const activeTargetCode = computed<string | null>(() => {
  const sel = comparisonSelection.value
  if (!sel) return null
  if (sel.base !== props.code) return null
  if (!siblingCodes.value.includes(sel.target) || sel.target === props.code) return null
  return sel.target
})

const activeTargetNode = computed<IsmNodeEntry | null>(() => {
  return activeTargetCode.value ? props.getNode(activeTargetCode.value) : null
})

const toggleCompareTarget = (targetCode: string) => {
  if (targetCode === props.code) return
  if (activeTargetCode.value === targetCode) {
    comparisonSelection.value = null
  } else {
    comparisonSelection.value = { base: props.code, target: targetCode }
  }
}

const comparisonRows = computed<AxisComparisonRow[]>(() => {
  if (!currentNode.value || !activeTargetNode.value) return []
  return compareAxisLists(currentNode.value.axis_list, activeTargetNode.value.axis_list)
})

const diffDigitRows = computed(() =>
  comparisonRows.value.filter((row) => row.kind === 'different_digit')
)

const diffTextRows = computed(() =>
  comparisonRows.value.filter((row) => row.kind === 'same_digit_different_text')
)

const identicalRows = computed(() =>
  comparisonRows.value.filter((row) => row.kind === 'identical')
)

const missingRows = computed(() =>
  comparisonRows.value.filter((row) => row.kind === 'missing')
)

const identicalSummaryText = computed(() => {
  return identicalRows.value
    .map((row) => {
      const shortLabel = AXIS_SHORT_LABELS[row.index] ?? row.axisLabel
      return `${shortLabel}${row.digitA}`
    })
    .join('、')
})

const nextAxisLabel = computed(() => {
  return AXIS_LABELS[depth.value] ?? ''
})

const childItems = computed(() => {
  const childIdx = depth.value
  if (childIdx >= 4) return []
  return getChildCodes(props.code, hasNode).map((childCode) => {
    const childNode = props.getNode(childCode)
    const entry = childNode?.axis_list[childIdx] ?? ''
    if (!entry) {
      return {
        code: childCode,
        chName: childNode?.ch_name ?? '',
        hasAxisEntry: false,
        digit: '',
        color: getAxisColor(childIdx),
        mainText: '',
        fullTitle: childCode
      }
    }
    const parsed = parseAxisEntry(entry, childIdx)
    if (parsed.fallback) {
      return {
        code: childCode,
        chName: childNode?.ch_name ?? '',
        hasAxisEntry: true,
        digit: '',
        color: parsed.color,
        mainText: parsed.rest,
        fullTitle: parsed.rest
      }
    }
    const { main } = splitAxisDescription(parsed.rest)
    const fullText = parsed.rest.trimStart().replace(/^[：:]\s*/, '').trim()
    return {
      code: childCode,
      chName: childNode?.ch_name ?? '',
      hasAxisEntry: true,
      digit: parsed.digit,
      color: parsed.color,
      mainText: main,
      fullTitle: fullText
    }
  })
})
</script>

<style scoped>
.axis_neighbors_root {
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  gap: 0.65em;
  width: 100%;
  box-sizing: border-box;
  color: black;
}

.axis_neighbors_root button:focus-visible,
.axis_neighbors_root summary:focus-visible {
  outline: 2px solid darkcyan;
  outline-offset: 1px;
}

.axis_digit_box {
  display: inline-block;
  text-align: center;
  width: 1.15em;
  height: 1.15em;
  line-height: 1.15em;
  margin: 0 0.15em;
  border: solid black 0.1em;
  flex-shrink: 0;
}

/* C. 同层对比 & D. 下一层分化 */
.anatomy_section {
  display: flex;
  flex-direction: column;
  gap: 0.35em;
  padding-top: 0.25em;
  border-top: 1px dashed rgb(140, 140, 140);
}

.anatomy_section_title {
  font-weight: bold;
  font-size: 1em;
}

.anatomy_section_hint {
  font-size: 0.85em;
  color: rgb(72, 72, 72);
}

.sibling_chips_wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3em;
}

.sibling_chip {
  font: inherit;
  font-size: 0.9em;
  display: inline-flex;
  align-items: center;
  gap: 0.28em;
  max-width: 100%;
  padding: 0.2em 0.45em;
  background-color: rgb(224, 224, 224);
  border: 1px solid rgb(80, 80, 80);
  color: black;
  cursor: pointer;
  text-align: left;
}

.sibling_chip:hover:not(:disabled) {
  background-color: rgb(206, 230, 230);
}

.sibling_chip.is_selected {
  background-color: darkcyan;
  border-color: black;
  color: white;
  font-weight: bold;
}

.sibling_chip.is_current,
.sibling_chip:disabled {
  background-color: rgb(192, 192, 192);
  border-style: dashed;
  border-color: rgb(95, 95, 95);
  color: rgb(65, 65, 65);
  cursor: default;
}

.sibling_code {
  font-weight: bold;
  flex-shrink: 0;
}

.sibling_name {
  overflow-wrap: anywhere;
  word-break: break-word;
}

.compare_panel {
  display: flex;
  flex-direction: column;
  gap: 0.45em;
  padding: 0.45em 0.55em;
  background-color: rgb(228, 228, 228);
  border: 1px solid rgb(100, 100, 100);
  box-sizing: border-box;
}

.compare_header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.35em;
  padding-bottom: 0.25em;
  border-bottom: 1px solid rgb(150, 150, 150);
}

.compare_title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.28em;
  font-size: 0.95em;
  font-weight: bold;
}

.compare_vs {
  font-weight: normal;
  color: rgb(85, 85, 85);
}

.jump_target_btn {
  font: inherit;
  font-size: 0.85em;
  padding: 0.14em 0.5em;
  background-color: rgb(206, 232, 232);
  border: 1px solid black;
  color: black;
  cursor: pointer;
}

.jump_target_btn:hover {
  background-color: darkcyan;
  color: white;
}

.compare_group {
  display: flex;
  flex-direction: column;
  gap: 0.28em;
}

.compare_group_label {
  font-size: 0.9em;
  font-weight: bold;
  color: rgb(55, 55, 55);
}

.compare_row {
  padding: 0.35em 0.45em;
  background-color: rgb(236, 236, 236);
  border: 1px solid rgb(155, 155, 155);
  display: flex;
  flex-direction: column;
  gap: 0.25em;
  min-width: 0;
}

.compare_row.is_diff_digit {
  border-left-width: 0.25em;
}

.compare_row_head {
  display: flex;
  align-items: center;
  gap: 0.2em;
  font-size: 0.9em;
}

.compare_sides {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.38em;
}

@container (min-width: 420px) {
  .compare_sides {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.compare_side {
  min-width: 0;
  padding: 0.25em 0.35em;
  background-color: rgba(255, 255, 255, 0.48);
  border: 1px solid rgb(185, 185, 185);
  box-sizing: border-box;
}

.compare_side_label {
  font-size: 0.85em;
  color: rgb(75, 75, 75);
  margin-bottom: 0.12em;
}

.compare_side_content {
  font-size: 0.9em;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.missing_side_hint {
  color: rgb(110, 110, 110);
  font-style: italic;
}

.identical_details {
  font-size: 0.85em;
  color: rgb(55, 55, 55);
}

.identical_summary {
  cursor: pointer;
  user-select: none;
}

.identical_list {
  margin-top: 0.25em;
  display: flex;
  flex-direction: column;
  gap: 0.22em;
  padding: 0.3em 0.42em;
  background-color: rgb(236, 236, 236);
  border: 1px solid rgb(165, 165, 165);
}

.identical_item {
  overflow-wrap: anywhere;
  word-break: break-word;
}

/* D. 下一层如何分化 */
.children_list {
  display: flex;
  flex-direction: column;
  gap: 0.3em;
}

.child_row_btn {
  font: inherit;
  display: flex;
  flex-direction: column;
  gap: 0.18em;
  width: 100%;
  padding: 0.38em 0.5em;
  background-color: rgb(222, 222, 222);
  border: 1px solid rgb(115, 115, 115);
  color: black;
  text-align: left;
  cursor: pointer;
  box-sizing: border-box;
}

.child_row_btn:hover {
  background-color: rgb(208, 228, 228);
  border-color: black;
}

.child_row_head {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.35em;
  font-size: 1em;
  font-weight: bold;
}

.child_code {
  flex-shrink: 0;
}

.child_name {
  overflow-wrap: anywhere;
  word-break: break-word;
}

.child_axis_line {
  display: flex;
  align-items: flex-start;
  gap: 0.22em;
  font-size: 0.95em;
  color: rgb(42, 42, 42);
  min-width: 0;
}

.child_digit_box {
  margin: 0.1em 0.1em 0 0;
}

.child_main_clamp {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
  word-break: break-word;
  min-width: 0;
}
</style>
