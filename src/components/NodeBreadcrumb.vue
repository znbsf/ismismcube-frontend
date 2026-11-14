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
  align-items: center;
  gap: 0.3em;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  color: black;
}

.node_breadcrumb_root button:focus-visible {
  outline: 2px solid darkcyan;
  outline-offset: 1px;
}

.breadcrumb_trail {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.2em 0.25em;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  font-size: 0.9em;
}

.breadcrumb_btn {
  font: inherit;
  max-width: 100%;
  min-width: 0;
  padding: 0.12em 0.38em;
  background-color: rgb(224, 224, 224);
  border: 1px solid rgb(120, 120, 120);
  color: black;
  cursor: pointer;
  text-align: left;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
  box-sizing: border-box;
}

.breadcrumb_btn:hover {
  background-color: rgb(206, 230, 230);
  border-color: black;
}

.breadcrumb_sep {
  color: rgb(85, 85, 85);
  user-select: none;
}

.breadcrumb_current {
  font-weight: bold;
  max-width: 100%;
  min-width: 0;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.breadcrumb_steps {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.28em;
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

.step_btn {
  font: inherit;
  font-size: 0.85em;
  max-width: 100%;
  min-width: 0;
  padding: 0.14em 0.45em;
  background-color: rgb(224, 224, 224);
  border: 1px solid rgb(110, 110, 110);
  color: black;
  cursor: pointer;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
  box-sizing: border-box;
}

.step_btn:hover:not(:disabled) {
  background-color: rgb(206, 230, 230);
  border-color: black;
}

.step_btn:disabled {
  background-color: rgb(192, 192, 192);
  border-color: rgb(145, 145, 145);
  color: rgb(110, 110, 110);
  cursor: default;
}
</style>
