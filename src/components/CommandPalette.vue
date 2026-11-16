<template>
  <div
    v-if="open"
    ref="backdropRef"
    class="cmd_backdrop"
    role="dialog"
    aria-modal="true"
    aria-label="全局检索与快捷命令面板"
    @click.self="close"
    @keydown="handleKeydown"
  >
    <div class="cmd_panel">
      <div class="cmd_input_row">
        <span class="cmd_icon" aria-hidden="true">⌘</span>
        <input
          ref="inputRef"
          v-model="queryText"
          type="text"
          class="cmd_input"
          placeholder="搜索 340 个主义坐标、课程标题或执行工作台操作..."
          aria-label="命令或节点检索关键词"
        />
        <button type="button" class="cmd_close_btn" @click="close">Esc 关闭</button>
      </div>

      <div class="cmd_list" role="listbox" aria-label="匹配结果与快捷命令">
        <div v-if="items.length === 0" class="cmd_empty">
          没有直接匹配的坐标或操作；按 <kbd>Enter</kbd> 打开完整全文检索抽屉。
        </div>
        <button
          v-for="(item, idx) in items"
          :key="item.id"
          type="button"
          role="option"
          :aria-selected="idx === selectedIndex ? 'true' : 'false'"
          class="cmd_item"
          :class="{ is_active: idx === selectedIndex }"
          @mouseenter="selectedIndex = idx"
          @click="executeItem(item)"
        >
          <span class="cmd_item_kind">{{ item.kindLabel }}</span>
          <span class="cmd_item_title">{{ item.title }}</span>
          <span v-if="item.subtitle" class="cmd_item_sub">{{ item.subtitle }}</span>
        </button>
      </div>

      <div class="cmd_footer">
        <span><kbd>↑</kbd><kbd>↓</kbd> 选择</span>
        <span><kbd>Enter</kbd> 打开</span>
        <span><kbd>Esc</kbd> 关闭</span>
        <button
          v-if="queryText.trim()"
          type="button"
          class="cmd_full_search_btn"
          @click="triggerFullSearch"
        >
          在全文检索中查看 "{{ queryText.trim() }}" →
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import type { CourseRecord, IsmNodeEntry } from '../types/research'

interface PaletteItem {
  id: string
  kind: 'action' | 'node' | 'course' | 'search'
  kindLabel: string
  title: string
  subtitle?: string
  code?: string
  courseId?: string
  actionId?: 'route' | 'courses' | 'guide' | 'theme' | 'ai' | 'view-toggle'
}

const props = defineProps<{
  open: boolean
  nodes: Record<string, unknown> | null
  courses: CourseRecord[]
  themeLabel?: string
  viewModeLabel?: string
  fallbackFocusSelector?: string
}>()

const emit = defineEmits<{
  close: []
  jumpNode: [code: string]
  openCourse: [courseId: string]
  openFullSearch: [query: string]
  runAction: [actionId: 'route' | 'courses' | 'guide' | 'theme' | 'ai' | 'view-toggle']
}>()

const backdropRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)
const queryText = ref('')
const selectedIndex = ref(0)
let openerEl: HTMLElement | null = null
let focusToken = 0

const quickActions = computed<PaletteItem[]>(() => [
  { id: 'act-route', kind: 'action', kindLabel: '操作', title: '打开推荐阅读路线', subtitle: '4 阶段学习路线与进度跟踪', actionId: 'route' },
  { id: 'act-courses', kind: 'action', kindLabel: '操作', title: '打开课程目录抽屉', subtitle: '浏览全部课程、系列课与讲稿摘要', actionId: 'courses' },
  { id: 'act-guide', kind: 'action', kindLabel: '操作', title: '四轴编码规则与数据边界说明', subtitle: '查看四位编号结构与核验口径', actionId: 'guide' },
  { id: 'act-theme', kind: 'action', kindLabel: '外观', title: `切换浅色 / 深色主题（当前：${props.themeLabel || '跟随系统'}）`, actionId: 'theme' },
  { id: 'act-view', kind: 'action', kindLabel: '视图', title: `切换矩阵 / 3D 魔方视图（当前：${props.viewModeLabel || '矩阵切片'}）`, actionId: 'view-toggle' },
  { id: 'act-ai', kind: 'action', kindLabel: 'AI', title: '前往 AI 学术对话助手', subtitle: '/ai 独立问答工作台', actionId: 'ai' }
])

const items = computed<PaletteItem[]>(() => {
  const q = queryText.value.trim().toLowerCase()
  const out: PaletteItem[] = []

  if (q && props.nodes) {
    let nodeCount = 0
    for (const [code, val] of Object.entries(props.nodes)) {
      if (!/^[1-4](?:-[1-4]){0,3}$/.test(code)) continue
      if (!val || typeof val !== 'object' || Array.isArray(val) || !('ch_name' in val)) continue
      const entry = val as IsmNodeEntry
      const hay = `${code} ${entry.ch_name} ${entry.en_name}`.toLowerCase()
      if (hay.includes(q)) {
        out.push({
          id: `node-${code}`,
          kind: 'node',
          kindLabel: '坐标节点',
          title: `${code} · ${entry.ch_name}`,
          subtitle: entry.en_name,
          code
        })
        nodeCount++
        if (nodeCount >= 12) break
      }
    }

    let courseCount = 0
    for (const c of props.courses) {
      const hay = `${c.id} ${c.title} ${c.catalogue_code || ''} ${(c.related_codes || []).join(' ')}`.toLowerCase()
      if (hay.includes(q)) {
        out.push({
          id: `course-${c.id}`,
          kind: 'course',
          kindLabel: '课程',
          title: c.title,
          subtitle: c.catalogue_code ? `对应节点 ${c.catalogue_code}` : `${c.id} · ${c.kind}`,
          courseId: c.id
        })
        courseCount++
        if (courseCount >= 6) break
      }
    }

    out.push({
      id: 'full-search',
      kind: 'search',
      kindLabel: '全文检索',
      title: `在所有 340 节点 + 校勘与讲稿中检索 "${queryText.value.trim()}"`,
      subtitle: '打开详细检索抽屉并高亮上下文'
    })
  }

  for (const act of quickActions.value) {
    if (!q || `${act.title} ${act.subtitle || ''}`.toLowerCase().includes(q)) {
      out.push(act)
    }
  }

  return out
})

watch(items, (list) => {
  if (selectedIndex.value >= list.length) selectedIndex.value = 0
})

watch(
  () => props.open,
  async (isOpen) => {
    const token = ++focusToken
    if (isOpen) {
      openerEl = typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
      queryText.value = ''
      selectedIndex.value = 0
      await nextTick()
      if (token === focusToken && props.open) {
        inputRef.value?.focus()
      }
    } else {
      await nextTick()
      if (token !== focusToken || props.open) return
      const fallback = props.fallbackFocusSelector && typeof document !== 'undefined'
        ? document.querySelector<HTMLElement>(props.fallbackFocusSelector)
        : null
      const target = openerEl?.isConnected ? openerEl : fallback
      openerEl = null
      target?.focus()
    }
  }
)

const close = () => emit('close')

const triggerFullSearch = () => {
  const q = queryText.value.trim()
  emit('close')
  emit('openFullSearch', q)
}

const executeItem = (item: PaletteItem) => {
  emit('close')
  if (item.kind === 'node' && item.code) {
    emit('jumpNode', item.code)
  } else if (item.kind === 'course' && item.courseId) {
    emit('openCourse', item.courseId)
  } else if (item.kind === 'action' && item.actionId) {
    emit('runAction', item.actionId)
  } else if (item.kind === 'search') {
    emit('openFullSearch', queryText.value.trim())
  }
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.isComposing || e.keyCode === 229) return
  if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    close()
    return
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (items.value.length > 0) {
      selectedIndex.value = (selectedIndex.value + 1) % items.value.length
    }
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (items.value.length > 0) {
      selectedIndex.value = (selectedIndex.value - 1 + items.value.length) % items.value.length
    }
    return
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    const item = items.value[selectedIndex.value]
    if (item) executeItem(item)
    else if (queryText.value.trim()) triggerFullSearch()
  }
}

onUnmounted(() => {
  focusToken++
  openerEl = null
})
</script>

<style scoped>
.cmd_backdrop {
  position: fixed;
  inset: 0;
  z-index: 240;
  background: var(--surface-backdrop);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: clamp(2rem, 10vh, 6rem) 1rem 1rem;
  box-sizing: border-box;
}

.cmd_panel {
  width: min(40rem, 100%);
  max-height: min(34rem, 80dvh);
  background: var(--surface-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--ink-primary);
}

.cmd_input_row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--border-subtle);
}

.cmd_icon {
  font-family: var(--font-mono);
  color: var(--accent-text);
  font-weight: 700;
}

.cmd_input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  color: var(--ink-primary);
  font-size: 1rem;
  outline: none;
}

.cmd_close_btn {
  padding: 0.25rem 0.65rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-subtle);
  background: var(--surface-subtle);
  font-size: 0.78rem;
  color: var(--ink-secondary);
}

.cmd_list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.cmd_empty {
  padding: 1.5rem 1rem;
  text-align: center;
  color: var(--ink-muted);
  font-size: 0.9rem;
}

.cmd_item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.55rem;
  width: 100%;
  text-align: left;
  padding: 0.62rem 0.78rem;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  background: transparent;
  color: var(--ink-primary);
  transition: background-color 0.12s ease, border-color 0.12s ease;
}

.cmd_item.is_active,
.cmd_item:hover {
  background: var(--accent-soft);
  border-color: var(--accent-border);
}

.cmd_item_kind {
  font-size: 0.74rem;
  font-weight: 600;
  padding: 0.1rem 0.45rem;
  border-radius: var(--radius-pill);
  background: var(--surface-subtle);
  color: var(--ink-secondary);
  flex-shrink: 0;
}

.cmd_item_title {
  font-weight: 600;
  font-size: 0.94rem;
}

.cmd_item_sub {
  margin-left: auto;
  font-size: 0.8rem;
  color: var(--ink-muted);
}

.cmd_footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 1rem;
  border-top: 1px solid var(--border-subtle);
  background: var(--surface-subtle);
  font-size: 0.78rem;
  color: var(--ink-muted);
}

.cmd_footer kbd {
  display: inline-block;
  padding: 0.05rem 0.35rem;
  margin: 0 0.15rem;
  border-radius: 4px;
  border: 1px solid var(--border-default);
  background: var(--surface-elevated);
  font-family: var(--font-mono);
  font-size: 0.75rem;
}

.cmd_full_search_btn {
  margin-left: auto;
  padding: 0.25rem 0.7rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--accent-border);
  background: var(--accent-soft);
  color: var(--accent-text);
  font-size: 0.8rem;
  font-weight: 600;
}
</style>
