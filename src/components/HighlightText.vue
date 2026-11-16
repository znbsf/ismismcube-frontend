<template>
  <template v-for="(seg, idx) in segments" :key="idx">
    <span v-if="seg.match" class="search_highlight">{{ seg.text }}</span>
    <template v-else>{{ seg.text }}</template>
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { splitHighlightSegments } from '../utils/ismFormat'

const props = defineProps<{
  text: string
  query?: string
}>()

const segments = computed(() => splitHighlightSegments(props.text, props.query ?? ''))
</script>

<style scoped>
.search_highlight {
  background-color: var(--status-draft-soft);
  color: var(--status-draft-text);
  padding: 0 0.18em;
  border-radius: 3px;
  font-weight: 600;
}
</style>
