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
  font-size: 0.82em;
  font-weight: 500;
  line-height: 1.3;
  display: inline-flex;
  align-items: center;
  gap: 0.28em;
  margin-left: 0.4em;
  padding: 0.14em 0.5em;
  border-radius: var(--radius-pill);
  border: 1px solid transparent;
  cursor: pointer;
  vertical-align: baseline;
  white-space: nowrap;
  transition: transform 0.12s var(--ease-out-expo), background-color 0.15s ease, border-color 0.15s ease;
}

.evidence_marker_btn:hover {
  filter: brightness(0.95);
}

.evidence_marker_btn:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.evidence_marker_icon {
  line-height: 1;
}

.evidence_marker_btn.evidence_tone_scoped,
.evidence_badge.evidence_tone_scoped {
  color: var(--ink-secondary);
  background-color: var(--surface-subtle);
  border-color: var(--border-default);
}

.evidence_marker_btn.evidence_tone_caution,
.evidence_badge.evidence_tone_caution {
  color: var(--status-draft-text);
  background-color: var(--status-draft-soft);
  border-color: var(--status-draft);
}

.evidence_marker_btn.evidence_tone_problem,
.evidence_badge.evidence_tone_problem {
  color: var(--status-danger-text);
  background-color: var(--status-danger-soft);
  border-color: var(--status-danger);
}

.evidence_marker_btn.evidence_tone_revised,
.evidence_badge.evidence_tone_revised {
  color: var(--status-info-text);
  background-color: var(--status-info-soft);
  border-color: var(--accent-border);
}

.evidence_detail_box {
  margin-top: 0.5em;
  padding: 0.65em 0.8em;
  background-color: var(--surface-subtle);
  border: 1px solid var(--border-subtle);
  border-left-width: 3px;
  border-radius: var(--radius-sm);
  font-size: 0.86em;
  line-height: 1.5;
  color: var(--ink-primary);
  display: flex;
  flex-direction: column;
  gap: 0.45em;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.evidence_detail_box.evidence_tone_scoped {
  border-left-color: var(--border-strong);
}

.evidence_detail_box.evidence_tone_caution {
  border-left-color: var(--status-draft);
}

.evidence_detail_box.evidence_tone_problem {
  border-left-color: var(--status-danger);
}

.evidence_detail_box.evidence_tone_revised {
  border-left-color: var(--accent);
}

.evidence_detail_item {
  display: flex;
  flex-direction: column;
  gap: 0.25em;
}

.evidence_detail_item + .evidence_detail_item {
  padding-top: 0.45em;
  border-top: 1px dashed var(--border-default);
}

.evidence_detail_badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35em;
}

.evidence_badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25em;
  padding: 0.1em 0.48em;
  font-size: 0.84em;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-default);
  background-color: var(--surface-elevated);
}

.evidence_badge.res_resolved {
  color: var(--status-verified-text);
  background-color: var(--status-verified-soft);
  border-color: var(--status-verified);
}

.evidence_badge.res_qualified {
  color: var(--status-draft-text);
  background-color: var(--status-draft-soft);
  border-color: var(--status-draft);
}

.evidence_detail_line {
  overflow-wrap: anywhere;
  word-break: break-word;
}
</style>
