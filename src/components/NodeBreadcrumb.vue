<template>
  <div v-if="currentNode" class="node_breadcrumb_root">
    <nav class="breadcrumb_trail" aria-label="层级路径">
      <template v-for="anc in ancestors" :key="anc.code">
        <button
          type="button"
          class="breadcrumb_btn"
          :title="anc.title"
          @click="emit('jump', anc.code)"
        >
          {{ anc.code }}<template v-if="anc.chName"> <HighlightText :text="anc.chName" :query="query" /></template>
        </button>
        <span class="breadcrumb_sep" aria-hidden="true">›</span>
      </template>
      <span class="breadcrumb_current" aria-current="page">
        {{ code }}<template v-if="currentNode.ch_name"> <HighlightText :text="currentNode.ch_name" :query="query" /></template>
      </span>
    </nav>

    <div class="breadcrumb_steps">
      <button
        v-for="btn in stepButtons"
        :key="btn.key"
        type="button"
        class="step_btn"
        :disabled="!btn.target"
        :title="btn.title"
        @click="btn.target && emit('jump', btn.target)"
      >
        {{ btn.label }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { IsmNodeEntry } from '../types/research'
import {
  getAdjacentSiblingCodes,
  getAncestorCodes,
  getParentCode
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

const currentNode = computed<IsmNodeEntry | null>(() => {
  return props.code ? props.getNode(props.code) : null
})

const hasNode = (c: string): boolean => Boolean(props.getNode(c))

const getFirstFeatureTitle = (node: IsmNodeEntry | null): string | undefined => {
  if (!node) return undefined
  const firstNonEmpty = node.feature_list.find((item) => item.trim() !== '')
  if (!firstNonEmpty) return undefined
  const stripped = firstNonEmpty.trim().replace(/^[\u2460-\u2473]\s*/, '').trim()
  return stripped || undefined
}

const ancestors = computed(() => {
  return getAncestorCodes(props.code).map((ancCode) => {
    const node = props.getNode(ancCode)
    return {
      code: ancCode,
      chName: node?.ch_name ?? '',
      title: getFirstFeatureTitle(node)
    }
  })
})

const parentTargetCode = computed<string | null>(() => {
  const parent = getParentCode(props.code)
  return parent && hasNode(parent) ? parent : null
})

const adjacentSiblings = computed(() => {
  return getAdjacentSiblingCodes(props.code, hasNode)
})

const formatStepTitle = (
  prefix: string,
  targetCode: string | null,
  shortcut: string
): string | undefined => {
  if (!targetCode) return undefined
  const node = props.getNode(targetCode)
  const namePart = node?.ch_name ? ` ${node.ch_name}` : ''
  return `${prefix}：${targetCode}${namePart}（快捷键 ${shortcut}）`
}

const stepButtons = computed(() => [
  {
    key: 'parent',
    label: '↑ 上一层',
    target: parentTargetCode.value,
    title: formatStepTitle('上一层', parentTargetCode.value, 'U')
  },
  {
    key: 'prev',
    label: '‹ 同层上一个',
    target: adjacentSiblings.value.prev,
    title: formatStepTitle('同层上一个', adjacentSiblings.value.prev, '[')
  },
  {
    key: 'next',
    label: '同层下一个 ›',
    target: adjacentSiblings.value.next,
    title: formatStepTitle('同层下一个', adjacentSiblings.value.next, ']')
  }
])
</script>

<style scoped>
.node_breadcrumb_root {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.5rem;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  color: var(--ink-primary);
}

.node_breadcrumb_root button:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.breadcrumb_trail {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-start;
  gap: 0.3rem 0.35rem;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  font-size: 0.86rem;
}

.breadcrumb_btn {
  font: inherit;
  max-width: 100%;
  min-width: 0;
  padding: 0.22rem 0.58rem;
  background-color: var(--surface-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  color: var(--ink-secondary);
  cursor: pointer;
  text-align: left;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
  box-sizing: border-box;
  transition: background-color 0.14s ease, border-color 0.14s ease, color 0.14s ease;
}

.breadcrumb_btn:hover {
  background-color: var(--accent-soft);
  border-color: var(--accent-border);
  color: var(--accent-text);
}

.breadcrumb_sep {
  color: var(--ink-muted);
  user-select: none;
}

.breadcrumb_current {
  font-weight: 600;
  color: var(--ink-primary);
  padding: 0.15rem 0.45rem;
  border-radius: var(--radius-pill);
  background: var(--accent-soft);
  max-width: 100%;
  min-width: 0;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.breadcrumb_steps {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-start;
  gap: 0.4rem;
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

.step_btn {
  font: inherit;
  font-size: 0.82rem;
  font-weight: 500;
  max-width: 100%;
  min-width: 0;
  padding: 0.28rem 0.65rem;
  background-color: var(--surface-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-pill);
  color: var(--ink-primary);
  cursor: pointer;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
  box-sizing: border-box;
  transition: background-color 0.14s ease, border-color 0.14s ease, color 0.14s ease;
}

.step_btn:hover:not(:disabled) {
  background-color: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent-text);
}

.step_btn:disabled {
  background-color: var(--surface-subtle);
  border-color: var(--border-subtle);
  color: var(--ink-muted);
  opacity: 0.65;
  cursor: not-allowed;
}
</style>
