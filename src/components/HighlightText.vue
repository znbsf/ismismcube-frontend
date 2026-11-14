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
  background-color: rgb(225, 172, 39);
  color: black;
}
</style>
