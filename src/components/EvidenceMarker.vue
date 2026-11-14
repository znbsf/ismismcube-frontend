<template>
  <slot />
  <button
    type="button"
    class="evidence_marker_btn"
    :class="toneMeta.className"
    :aria-expanded="expanded"
    @click="expanded = !expanded"
  >
    <span class="evidence_marker_icon" aria-hidden="true">{{ toneMeta.icon }}</span>
    <span>{{ evidence.label }}</span>
  </button>
  <div v-if="expanded" class="evidence_detail_box" :class="toneMeta.className">
    <div
      v-for="(hl, idx) in evidence.highlights"
      :key="idx"
      class="evidence_detail_item"
    >
      <div class="evidence_detail_badges">
        <span class="evidence_badge" :class="getHighlightToneMeta(hl.canonical_status).className">
          <span aria-hidden="true">{{ getHighlightToneMeta(hl.canonical_status).icon }}</span>
          <span>{{ CANONICAL_STATUS_LABELS[hl.canonical_status] || hl.canonical_status }}</span>
        </span>
        <span
          class="evidence_badge"
          :class="hl.resolution_state === 'resolved_in_catalogue' ? 'res_resolved' : 'res_qualified'"
        >
          {{ RESOLUTION_STATE_LABELS[hl.resolution_state] || hl.resolution_state }}
        </span>
      </div>
      <div v-if="hl.locator" class="evidence_detail_line">
        <b>位置：</b><HighlightText :text="hl.locator" :query="query" />
      </div>
      <div v-if="hl.finding" class="evidence_detail_line">
        <b>校勘结论：</b><HighlightText :text="hl.finding" :query="query" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CANONICAL_TONE, TONE_META, type FieldEvidence } from '../utils/evidence'
import { CANONICAL_STATUS_LABELS, RESOLUTION_STATE_LABELS } from '../utils/ismFormat'
import HighlightText from './HighlightText.vue'

const props = defineProps<{
  evidence: FieldEvidence
  query: string
}>()

const expanded = ref(false)

watch(
  () => props.evidence,
  () => {
    expanded.value = false
  }
)

const toneMeta = computed(() => TONE_META[props.evidence.tone])

const getHighlightToneMeta = (canonicalStatus: string) => {
  return TONE_META[CANONICAL_TONE[canonicalStatus] ?? 'scoped']
}
</script>

<style scoped>
.evidence_marker_btn {
  font: inherit;
  font-size: 0.85em;
  line-height: 1.25;
  display: inline-flex;
  align-items: center;
  gap: 0.2em;
  margin-left: 0.35em;
  padding: 0.04em 0.36em;
  border: 1px solid transparent;
  cursor: pointer;
  vertical-align: baseline;
  white-space: nowrap;
}

.evidence_marker_btn:hover {
  filter: brightness(0.96);
}

.evidence_marker_btn:focus-visible {
  outline: 2px solid darkcyan;
  outline-offset: 1px;
}

.evidence_marker_icon {
  line-height: 1;
}

.evidence_marker_btn.evidence_tone_scoped,
.evidence_badge.evidence_tone_scoped {
  color: rgb(75, 75, 75);
  background-color: rgba(255, 255, 255, 0.55);
  border: 1px dotted rgb(115, 115, 115);
}

.evidence_marker_btn.evidence_tone_caution,
.evidence_badge.evidence_tone_caution {
  color: #8a5a00;
  background-color: #fff4d6;
  border-color: #c99a3b;
}

.evidence_marker_btn.evidence_tone_problem,
.evidence_badge.evidence_tone_problem {
  color: #a00000;
  background-color: #ffe5e5;
  border-color: #cf6b6b;
}

.evidence_marker_btn.evidence_tone_revised,
.evidence_badge.evidence_tone_revised {
  color: #1f4f8f;
  background-color: #e6effa;
  border-color: #6b93c9;
}

.evidence_detail_box {
  margin-top: 0.3em;
  padding: 0.38em 0.5em;
  background-color: rgb(234, 234, 234);
  border: 1px solid rgb(145, 145, 145);
  border-left-width: 3px;
  font-size: 0.85em;
  line-height: 1.4;
  color: black;
  display: flex;
  flex-direction: column;
  gap: 0.35em;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.evidence_detail_box.evidence_tone_scoped {
  border-left-color: rgb(115, 115, 115);
}

.evidence_detail_box.evidence_tone_caution {
  border-left-color: #8a5a00;
}

.evidence_detail_box.evidence_tone_problem {
  border-left-color: #a00000;
}

.evidence_detail_box.evidence_tone_revised {
  border-left-color: #1f4f8f;
}

.evidence_detail_item {
  display: flex;
  flex-direction: column;
  gap: 0.18em;
}

.evidence_detail_item + .evidence_detail_item {
  padding-top: 0.3em;
  border-top: 1px dashed rgb(165, 165, 165);
}

.evidence_detail_badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25em;
}

.evidence_badge {
  display: inline-flex;
  align-items: center;
  gap: 0.2em;
  padding: 0.04em 0.32em;
  font-size: 0.86em;
  border: 1px solid rgb(95, 95, 95);
  background-color: rgb(238, 238, 238);
}

.evidence_badge.res_resolved {
  background-color: rgb(215, 242, 242);
  border-color: darkcyan;
}

.evidence_badge.res_qualified {
  background-color: rgb(248, 238, 205);
  border-color: rgb(155, 115, 25);
}

.evidence_detail_line {
  overflow-wrap: anywhere;
  word-break: break-word;
}
</style>
