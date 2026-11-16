<template>
  <nav ref="navRef" class="cube_navigation" aria-label="魔方节点导航" @keydown="handleKeydown">
    <button
      ref="toggleRef"
      type="button"
      class="cube_nav_toggle"
      :aria-expanded="expanded ? 'true' : 'false'"
      :aria-controls="panelId"
      @click="toggleExpanded"
    >
      <span class="cube_nav_toggle_text">{{ toggleText }}</span>
      <span class="cube_nav_toggle_state" aria-hidden="true">{{ expanded ? '收起' : '展开' }}</span>
    </button>
    <div v-if="expanded" :id="panelId" class="cube_nav_body">
      <div class="cube_nav_label">场域入口</div>
      <div class="cube_nav_row">
        <button
          v-for="code in roots"
          :key="code"
          type="button"
          :disabled="!hasNode(code)"
          :aria-current="currentCode === code ? 'true' : undefined"
          @click="activate(code, $event)"
        >
          {{ label(code) }}
        </button>
      </div>
      <p ref="currentRef" class="cube_nav_current" tabindex="-1">
        {{ currentText }}
      </p>
      <div v-if="parentCode || children.length" class="cube_nav_row">
        <button v-if="parentCode" type="button" @click="activate(parentCode, $event)">
          上一级：{{ label(parentCode) }}
        </button>
        <button v-for="code in children" :key="code" type="button" @click="activate(code, $event)">
          下一级：{{ label(code) }}
        </button>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onUnmounted, ref, watch } from 'vue'

const props = defineProps<{ currentCode: string; nodes: Record<string, unknown> | null }>()
const emit = defineEmits<{ select: [code: string] }>()
const roots = ['1', '2', '3', '4']
const panelId = `cube_nav_panel_${getCurrentInstance()?.uid ?? 0}`
const navRef = ref<HTMLElement | null>(null)
const toggleRef = ref<HTMLElement | null>(null)
const currentRef = ref<HTMLElement | null>(null)
const expanded = ref(false)
let pendingSource: HTMLElement | null = null
let focusToken = 0

const hasNode = (code: string): boolean => {
  if (!/^[1-4](?:-[1-4]){0,3}$/.test(code)) return false
  const entry = props.nodes?.[code]
  return Boolean(entry && typeof entry === 'object' && 'ch_name' in entry && typeof entry.ch_name === 'string')
}
const label = (code: string): string => {
  const entry = props.nodes?.[code] as { ch_name?: string } | undefined
  return `${code} ${entry?.ch_name ?? ''}`.trim()
}
const validCurrent = computed(() => hasNode(props.currentCode))
const currentText = computed(() =>
  props.nodes === null ? '节点数据加载中' : validCurrent.value ? `当前：${label(props.currentCode)}` : '请选择场域入口'
)
const toggleText = computed(() =>
  props.nodes === null ? '节点导航：节点数据加载中' : validCurrent.value ? `节点导航：${label(props.currentCode)}` : '节点导航：请选择场域入口'
)
const parentCode = computed(() => {
  if (!validCurrent.value) return ''
  const code = props.currentCode.split('-').slice(0, -1).join('-')
  return hasNode(code) ? code : ''
})
const children = computed(() => {
  if (!validCurrent.value || props.currentCode.split('-').length >= 4) return []
  return roots.map(part => `${props.currentCode}-${part}`).filter(hasNode)
})
const collapse = () => {
  if (!expanded.value) return
  expanded.value = false
  pendingSource = null
  focusToken++
  toggleRef.value?.focus()
}
const toggleExpanded = () => {
  if (expanded.value) {
    collapse()
    return
  }
  expanded.value = true
  toggleRef.value?.focus()
}
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Escape' || !expanded.value) return
  event.preventDefault?.()
  event.stopPropagation?.()
  collapse()
}
const activate = (code: string, event: MouseEvent) => {
  if (!hasNode(code)) return
  pendingSource = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  focusToken++
  emit('select', code)
}

watch(() => props.currentCode, async () => {
  const source = pendingSource
  const token = focusToken
  pendingSource = null
  if (!source) return
  await nextTick()
  if (token !== focusToken || !navRef.value?.isConnected || source.isConnected) return
  // A user or another panel that already took focus always wins.
  if (document.querySelector?.('[aria-modal="true"]')) return
  if (document.activeElement !== source && document.activeElement !== document.body) return
  if (expanded.value && currentRef.value?.isConnected) {
    currentRef.value.focus()
  } else {
    toggleRef.value?.focus()
  }
}, { flush: 'post' })

onUnmounted(() => {
  focusToken++
  pendingSource = null
})
</script>

<style scoped>
.cube_navigation {
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--surface-elevated);
  box-shadow: var(--shadow-xs);
  padding: 6px 8px;
  font-size: max(0.84rem, 13px);
  line-height: 1.45;
  color: var(--ink-primary);
}
.cube_nav_toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-height: 32px;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  background: var(--surface-subtle);
  font-weight: 500;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}
.cube_nav_toggle:hover {
  background: var(--surface-hover);
  border-color: var(--border-default);
}
.cube_nav_toggle_text { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; text-align: left; }
.cube_nav_toggle_state {
  flex: 0 0 auto;
  white-space: nowrap;
  font-size: 0.88em;
  color: var(--accent-text);
  background: var(--accent-soft);
  padding: 1px 8px;
  border-radius: var(--radius-pill);
}
.cube_nav_body {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  margin-top: 8px;
  padding: 8px 4px 4px;
  border-top: 1px solid var(--border-subtle);
  max-height: min(42vh, 240px);
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
}
.cube_nav_label {
  font-weight: 600;
  font-size: 0.85em;
  color: var(--ink-muted);
  overflow-wrap: anywhere;
}
.cube_nav_row { display: flex; flex-wrap: wrap; gap: 6px; min-width: 0; max-width: 100%; }
.cube_navigation button {
  box-sizing: border-box;
  min-width: 0;
  max-width: 100%;
  padding: 5px 10px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: var(--surface-elevated);
  color: var(--ink-primary);
  font: inherit;
  text-align: left;
  overflow-wrap: anywhere;
  cursor: pointer;
  transition: background-color 0.14s ease, border-color 0.14s ease;
}
.cube_navigation button:hover:not(:disabled) {
  background: var(--surface-hover);
  border-color: var(--border-default);
}
.cube_navigation button[aria-current="true"] {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent-text);
  font-weight: 600;
}
.cube_navigation button:disabled {
  color: var(--ink-muted);
  opacity: 0.65;
  cursor: not-allowed;
}
.cube_nav_current {
  margin: 0;
  font-size: 0.9em;
  color: var(--ink-secondary);
  font-weight: 500;
  overflow-wrap: anywhere;
}
.cube_navigation button:focus-visible, .cube_nav_current:focus {
  outline: none;
  box-shadow: var(--focus-ring);
}
</style>
