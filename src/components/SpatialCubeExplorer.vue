<template>
  <section class="spatial_explorer" aria-label="四轴谱系空间浏览器">
    <div class="explorer_topbar">
      <div class="explorer_coord_group">
        <button
          v-if="currentCodeList.length > 0"
          type="button"
          class="explorer_up_btn"
          @click="emitSelect(parentCode)"
        >
          ← {{ parentCode ? `返回 ${parentCode}` : '回到四场域入口' }}
        </button>
        <div class="explorer_coord_pill">
          <span class="coord_depth">{{ depthLabel }}</span>
          <span v-if="activeCode" class="coord_code">{{ activeCode }}</span>
          <span v-if="activeNode?.ch_name" class="coord_name">{{ activeNode.ch_name }}</span>
          <span v-else class="coord_name">340 个坐标节点 · 4×4×4×4 四轴架构</span>
        </div>
      </div>

      <div class="explorer_controls">
        <div class="view_switch" role="group" aria-label="空间视图切换">
          <button
            type="button"
            class="view_switch_btn"
            :class="{ active: currentMode === 'matrix' }"
            :aria-pressed="currentMode === 'matrix' ? 'true' : 'false'"
            @click="setMode('matrix')"
          >
            矩阵切片
          </button>
          <button
            type="button"
            class="view_switch_btn"
            :class="{ active: currentMode === 'cube' }"
            :aria-pressed="currentMode === 'cube' ? 'true' : 'false'"
            @click="setMode('cube')"
          >
            立体魔方
          </button>
        </div>

        <template v-if="currentMode === 'cube'">
          <div class="angle_controls" aria-label="三维视角调节">
            <button type="button" class="angle_preset_btn" @click="resetCubeAngle">重置视角</button>
          </div>
        </template>
      </div>
    </div>

    <!-- 同步缩放包装器：保持 #ismism_cube_box 与缩放滑杆及回归测试的 transform 绑定 -->
    <div class="explorer_stage_viewport">
      <div
        id="ismism_cube_box"
        class="explorer_zoom_stage"
        :class="[currentMode === 'cube' ? 'mode_cube' : 'mode_matrix']"
        :style="{ transform: cubeScaleTransform }"
      >
        <!-- 模式一：默认高可读 4 轴矩阵切片视图 -->
        <div v-if="currentMode === 'matrix'" class="matrix_workspace">
          <!-- 第 0 层：四场域总入口 -->
          <template v-if="!activeCode">
            <div class="layer_section_header">
              <h2 class="layer_section_title">四场域原初坐标（第 1 轴：场域论）</h2>
              <p class="layer_section_desc">点击任意场域卡片进入纵深，或直接点选下方一级坐标。</p>
            </div>
            <div class="root_pillars_grid">
              <article
                v-for="root in rootCards"
                :key="root.code"
                class="pillar_card"
                :class="[axisClass(root.code), { is_hit: hasHit(root.code), is_noted: hasNote(root.code) }]"
              >
                <button type="button" class="pillar_main_btn" @click="emitSelect(root.code)">
                  <div class="card_top_row">
                    <span class="code_tag">{{ root.code }}</span>
                    <span class="axis_chip">{{ AXIS_TITLES[0] }}</span>
                    <span v-if="hasHit(root.code)" class="badge_hit">命中</span>
                    <span v-if="hasNote(root.code)" class="badge_note" title="已记笔记">笔记</span>
                  </div>
                  <div class="card_title">{{ root.ch_name }}</div>
                  <div v-if="root.en_name" class="card_en">{{ root.en_name }}</div>
                  <p v-if="root.summaryLine" class="card_excerpt">{{ root.summaryLine }}</p>
                </button>
                <div v-if="root.children.length > 0" class="pillar_children_row" aria-label="下属一级支类">
                  <button
                    v-for="child in root.children"
                    :key="child.code"
                    type="button"
                    class="mini_child_chip"
                    :class="{ is_hit: hasHit(child.code), is_noted: hasNote(child.code) }"
                    @click="emitSelect(child.code)"
                  >
                    <span class="mini_code">{{ child.code }}</span>
                    <span class="mini_name">{{ child.ch_name }}</span>
                  </button>
                </div>
              </article>
            </div>
          </template>

          <!-- 第 1-4 层：同级切换条 + 下一级 4 维切面卡片（叶节点时展示同父级 4 叶对比） -->
          <template v-else>
            <div class="slice_siblings_bar" role="region" aria-label="当前层级横向坐标">
              <div class="slice_bar_label">
                <span>同层坐标（第 {{ activeDepth }} 轴：{{ AXIS_TITLES[activeDepth - 1] }}）</span>
              </div>
              <div class="slice_chips_grid">
                <button
                  v-for="sib in siblingCards"
                  :key="sib.code"
                  type="button"
                  class="slice_chip_btn"
                  :class="[axisClass(sib.code), { is_active: sib.code === activeCode, is_hit: hasHit(sib.code), is_noted: hasNote(sib.code) }]"
                  :aria-current="sib.code === activeCode ? 'true' : undefined"
                  @click="emitSelect(sib.code)"
                >
                  <span class="code_tag">{{ sib.code }}</span>
                  <span class="slice_chip_name">{{ sib.ch_name }}</span>
                  <span v-if="hasHit(sib.code)" class="badge_dot_hit" aria-label="检索命中"></span>
                  <span v-if="hasNote(sib.code)" class="badge_dot_note" aria-label="已记笔记"></span>
                </button>
              </div>
            </div>

            <!-- 下一层级分化（深度 < 4）或四轴切片详情（深度 = 4） -->
            <div v-if="childCards.length > 0" class="children_stage">
              <div class="layer_section_header">
                <h2 class="layer_section_title">
                  下一级分化（第 {{ activeDepth + 1 }} 轴：{{ AXIS_TITLES[activeDepth] }}）
                </h2>
                <p class="layer_section_desc">点击下方卡片继续向下层钻取并同步更新左侧阅读区</p>
              </div>
              <div class="children_cards_grid">
                <button
                  v-for="child in childCards"
                  :key="child.code"
                  type="button"
                  class="node_slice_card"
                  :class="[axisClass(child.code), { is_hit: hasHit(child.code), is_noted: hasNote(child.code) }]"
                  @click="emitSelect(child.code)"
                >
                  <div class="card_top_row">
                    <span class="code_tag">{{ child.code }}</span>
                    <span class="axis_chip">坐标第 {{ activeDepth + 1 }} 位 = {{ child.lastDigit }}</span>
                    <span v-if="hasHit(child.code)" class="badge_hit">命中</span>
                    <span v-if="hasNote(child.code)" class="badge_note">笔记</span>
                  </div>
                  <div class="card_title">{{ child.ch_name }}</div>
                  <div v-if="child.en_name" class="card_en">{{ child.en_name }}</div>
                  <p v-if="child.summaryLine" class="card_excerpt">{{ child.summaryLine }}</p>
                </button>
              </div>
            </div>

            <div v-else class="leaf_summary_stage">
              <div class="layer_section_header">
                <h2 class="layer_section_title">末端坐标 · 四轴总观（{{ activeCode }}）</h2>
                <p class="layer_section_desc">该节点已达第 4 轴（目的论）最深层级；可在左侧查看完整四轴解剖与课程对照，或切换上方同层兄弟叶节点。</p>
              </div>
              <div class="leaf_axes_grid">
                <div
                  v-for="idx in 4"
                  :key="idx"
                  class="leaf_axis_tile"
                  :class="axisClassByIndex(idx - 1)"
                >
                  <div class="leaf_axis_head">
                    <span class="leaf_axis_digit">{{ activeDigits[idx - 1] ?? '-' }}</span>
                    <span class="leaf_axis_name">{{ AXIS_TITLES[idx - 1] }}</span>
                  </div>
                  <p class="leaf_axis_text">{{ activeAxisLines[idx - 1] || '暂无条目摘要' }}</p>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- 模式二：现代 CSS 3D 交互层魔方视图 -->
        <div
          v-else
          class="cube3d_workspace"
          @pointerdown="startCubeDrag"
        >
          <p class="cube3d_hint">拖拽旋转立体切片 · 点击任意魔方层节点切换坐标</p>
          <div class="cube3d_scene">
            <div class="cube3d_pivot" :style="cubePivotStyle">
              <div
                v-for="(layer, lIdx) in cubeLayers"
                :key="layer.depth"
                class="cube3d_plane"
                :class="{ is_current_layer: layer.isCurrent }"
                :style="{ transform: getPlaneTransform(lIdx, cubeLayers.length) }"
              >
                <div class="cube3d_plane_label">
                  第 {{ layer.depth }} 轴 · {{ AXIS_TITLES[layer.depth - 1] }}
                </div>
                <div class="cube3d_plane_grid">
                  <button
                    v-for="cell in layer.items"
                    :key="cell.code"
                    type="button"
                    class="cube3d_cell"
                    :class="[
                      axisClass(cell.code),
                      {
                        is_selected: cell.code === activeCode,
                        is_ancestor: ancestorSet.has(cell.code),
                        is_hit: hasHit(cell.code),
                        is_noted: hasNote(cell.code)
                      }
                    ]"
                    @click.stop="emitSelect(cell.code)"
                    @mouseenter="emitHover(cell.code)"
                  >
                    <span class="cube3d_cell_code">{{ cell.code }}</span>
                    <span class="cube3d_cell_name">{{ cell.ch_name }}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import type { IsmNodeEntry } from '../types/research'
import { splitAxisDescription } from '../utils/axisStructure'
import { parseAxisEntry } from '../utils/ismFormat'

const props = withDefaults(defineProps<{
  nodes: Record<string, unknown> | null
  activeCode: string
  pinnedCode?: string
  hitCodes?: ReadonlySet<string> | null
  noteCodes?: ReadonlySet<string> | null
  cubeScaleTransform?: string
  viewMode?: 'matrix' | 'cube'
}>(), {
  pinnedCode: '',
  hitCodes: null,
  noteCodes: null,
  cubeScaleTransform: 'scale(1)',
  viewMode: 'matrix'
})

const emit = defineEmits<{
  select: [code: string]
  hover: [code: string]
  'update:viewMode': [mode: 'matrix' | 'cube']
}>()

const AXIS_TITLES = ['场域论', '本体论', '认识论', '目的论'] as const
const ROOT_CODES = ['1', '2', '3', '4'] as const

const currentMode = computed(() => props.viewMode)
const setMode = (mode: 'matrix' | 'cube') => emit('update:viewMode', mode)

const getEntry = (code: string): IsmNodeEntry | null => {
  const raw = props.nodes?.[code]
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  if (!('ch_name' in raw)) return null
  return raw as IsmNodeEntry
}

const currentCodeList = computed(() => (props.activeCode ? props.activeCode.split('-').filter(Boolean) : []))
const activeDepth = computed(() => currentCodeList.value.length)
const activeDigits = computed(() => currentCodeList.value)
const activeNode = computed(() => (props.activeCode ? getEntry(props.activeCode) : null))
const parentCode = computed(() =>
  currentCodeList.value.length > 1 ? currentCodeList.value.slice(0, -1).join('-') : ''
)

const depthLabel = computed(() => {
  if (!props.activeCode) return '总览根层'
  return `第 ${activeDepth.value} 轴 · ${AXIS_TITLES[activeDepth.value - 1] ?? ''}`
})

const hasHit = (code: string) => Boolean(props.hitCodes?.has(code))
const hasNote = (code: string) => Boolean(props.noteCodes?.has(code))

const axisClassByIndex = (idx: number): string => {
  return ['axis_field', 'axis_ontology', 'axis_epistemology', 'axis_teleology'][idx] ?? 'axis_field'
}

const axisClass = (code: string): string => {
  const firstDigit = Number.parseInt(code.split('-')[0] || '1', 10)
  return axisClassByIndex((Number.isFinite(firstDigit) ? firstDigit : 1) - 1)
}

const summarizeAxis = (entry: IsmNodeEntry | null, idx: number): string => {
  const raw = entry?.axis_list?.[idx] ?? ''
  if (!raw) return ''
  const parsed = parseAxisEntry(raw, idx)
  const { main } = splitAxisDescription(parsed.rest)
  return main || raw
}

const toCardItem = (code: string, axisIdx: number) => {
  const entry = getEntry(code)
  const parts = code.split('-')
  return {
    code,
    lastDigit: parts[parts.length - 1] || code,
    ch_name: entry?.ch_name ?? `节点 ${code}`,
    en_name: entry?.en_name ?? '',
    summaryLine: summarizeAxis(entry, axisIdx)
  }
}

const rootCards = computed(() => {
  return ROOT_CODES.map((code) => {
    const base = toCardItem(code, 0)
    const children = ROOT_CODES.map((d) => `${code}-${d}`)
      .filter((c) => Boolean(getEntry(c)))
      .map((c) => {
        const entry = getEntry(c)
        return { code: c, ch_name: entry?.ch_name ?? c }
      })
    return { ...base, children }
  })
})

const siblingCards = computed(() => {
  if (!props.activeCode) return []
  const prefix = parentCode.value
  return ROOT_CODES.map((d) => (prefix ? `${prefix}-${d}` : d))
    .filter((c) => Boolean(getEntry(c)))
    .map((c) => toCardItem(c, Math.max(0, activeDepth.value - 1)))
})

const childCards = computed(() => {
  if (!props.activeCode || activeDepth.value >= 4) return []
  return ROOT_CODES.map((d) => `${props.activeCode}-${d}`)
    .filter((c) => Boolean(getEntry(c)))
    .map((c) => toCardItem(c, activeDepth.value))
})

const activeAxisLines = computed(() => {
  const entry = activeNode.value
  return [0, 1, 2, 3].map((idx) => summarizeAxis(entry, idx))
})

const ancestorSet = computed(() => {
  const set = new Set<string>()
  for (let i = 1; i < currentCodeList.value.length; i++) {
    set.add(currentCodeList.value.slice(0, i).join('-'))
  }
  return set
})

const cubeLayers = computed(() => {
  const layers: Array<{ depth: number; isCurrent: boolean; items: Array<{ code: string; ch_name: string }> }> = []
  // 第 1 轴：始终显示 1..4 根入口
  layers.push({
    depth: 1,
    isCurrent: activeDepth.value <= 1,
    items: ROOT_CODES.map((code) => ({ code, ch_name: getEntry(code)?.ch_name ?? code }))
  })
  // 第 2..4 轴：按当前选中前缀逐级展现切片
  const prefixes = currentCodeList.value.slice(0, 3)
  prefixes.forEach((_, idx) => {
    const prefix = prefixes.slice(0, idx + 1).join('-')
    const items = ROOT_CODES.map((d) => `${prefix}-${d}`)
      .filter((c) => Boolean(getEntry(c)))
      .map((c) => ({ code: c, ch_name: getEntry(c)?.ch_name ?? c }))
    if (items.length > 0) {
      layers.push({
        depth: idx + 2,
        isCurrent: activeDepth.value === idx + 2,
        items
      })
    }
  })
  return layers
})

// 3D 立体魔方交互视角状态
const rotX = ref(-14)
const rotY = ref(20)
let dragActive = false
let lastX = 0
let lastY = 0

const cubePivotStyle = computed(() => ({
  transform: `rotateX(${rotX.value}deg) rotateY(${rotY.value}deg)`
}))

const resetCubeAngle = () => {
  rotX.value = -14
  rotY.value = 20
}

const getPlaneTransform = (index: number, total: number): string => {
  const center = (total - 1) / 2
  const delta = index - center
  return `translate3d(${delta * 26}px, ${delta * -18}px, ${delta * 64}px)`
}

const onPointerMove = (e: PointerEvent) => {
  if (!dragActive) return
  const dx = e.clientX - lastX
  const dy = e.clientY - lastY
  lastX = e.clientX
  lastY = e.clientY
  rotY.value = Math.max(-65, Math.min(65, rotY.value + dx * 0.45))
  rotX.value = Math.max(-55, Math.min(35, rotX.value - dy * 0.45))
}

const stopCubeDrag = () => {
  if (!dragActive) return
  dragActive = false
  if (typeof window !== 'undefined') {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', stopCubeDrag)
    window.removeEventListener('pointercancel', stopCubeDrag)
  }
}

const startCubeDrag = (e: PointerEvent) => {
  if (e.button !== 0 || typeof window === 'undefined') return
  dragActive = true
  lastX = e.clientX
  lastY = e.clientY
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', stopCubeDrag)
  window.addEventListener('pointercancel', stopCubeDrag)
}

onUnmounted(() => {
  stopCubeDrag()
})

const emitSelect = (code: string) => emit('select', code)
const emitHover = (code: string) => emit('hover', code)
</script>

<style scoped>
.spatial_explorer {
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  background-color: var(--surface-canvas);
  color: var(--ink-primary);
}

.explorer_topbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
  padding: 0.75rem 1.2rem;
  border-bottom: 1px solid var(--border-subtle);
  background-color: var(--surface-glass);
  backdrop-filter: blur(8px);
  z-index: 2;
}

.explorer_coord_group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.explorer_up_btn {
  padding: 0.32rem 0.75rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-default);
  background: var(--surface-elevated);
  font-size: 0.84rem;
  font-weight: 500;
  color: var(--ink-primary);
  transition: background-color 0.14s ease, border-color 0.14s ease;
}

.explorer_up_btn:hover {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent-text);
}

.explorer_coord_pill {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.88rem;
  min-width: 0;
}

.coord_depth {
  padding: 0.14rem 0.55rem;
  border-radius: var(--radius-pill);
  background: var(--surface-subtle);
  color: var(--ink-secondary);
  font-size: 0.82rem;
  font-weight: 600;
}

.coord_code {
  font-family: var(--font-mono);
  font-weight: 700;
  color: var(--accent-text);
}

.coord_name {
  font-weight: 600;
  color: var(--ink-primary);
}

.explorer_controls {
  display: flex;
  align-items: center;
  gap: 0.55rem;
}

.view_switch {
  display: inline-flex;
  padding: 3px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-subtle);
  background: var(--surface-subtle);
}

.view_switch_btn {
  padding: 0.28rem 0.82rem;
  border-radius: var(--radius-pill);
  border: none;
  background: transparent;
  color: var(--ink-secondary);
  font-size: 0.84rem;
  font-weight: 500;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.view_switch_btn.active {
  background: var(--surface-elevated);
  color: var(--accent-text);
  font-weight: 600;
  box-shadow: var(--shadow-xs);
}

.angle_preset_btn {
  padding: 0.28rem 0.72rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-subtle);
  background: var(--surface-elevated);
  font-size: 0.82rem;
  color: var(--ink-secondary);
}

.angle_preset_btn:hover {
  background: var(--surface-hover);
  color: var(--ink-primary);
}

.explorer_stage_viewport {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: clamp(0.85rem, 2.5vw, 1.5rem);
}

.explorer_zoom_stage {
  transform-origin: top left;
  transition: transform 0.12s var(--ease-out-expo);
  min-height: 100%;
}

.matrix_workspace {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  max-width: 72rem;
  margin: 0 auto;
}

.layer_section_header {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.layer_section_title {
  margin: 0;
  font-size: 1.08rem;
  font-weight: 700;
  color: var(--ink-primary);
}

.layer_section_desc {
  margin: 0;
  font-size: 0.88rem;
  color: var(--ink-muted);
}

.root_pillars_grid,
.children_cards_grid,
.leaf_axes_grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
  gap: 0.9rem;
}

@container (min-width: 780px) {
  .root_pillars_grid,
  .children_cards_grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.pillar_card,
.node_slice_card,
.leaf_axis_tile {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.95rem 1.05rem;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-subtle);
  border-top: 3px solid var(--axis-accent, var(--accent));
  background: var(--surface-elevated);
  box-shadow: var(--shadow-xs);
  transition: transform 0.16s var(--ease-out-expo), box-shadow 0.16s ease, border-color 0.16s ease;
}

.node_slice_card {
  text-align: left;
  cursor: pointer;
}

.pillar_main_btn {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 0;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
  color: inherit;
}

.pillar_card:hover,
.node_slice_card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: var(--axis-accent, var(--accent));
}

.axis_field { --axis-accent: var(--axis-field); --axis-soft: var(--axis-field-soft); --axis-ink: var(--axis-field-text); }
.axis_ontology { --axis-accent: var(--axis-ontology); --axis-soft: var(--axis-ontology-soft); --axis-ink: var(--axis-ontology-text); }
.axis_epistemology { --axis-accent: var(--axis-epistemology); --axis-soft: var(--axis-epistemology-soft); --axis-ink: var(--axis-epistemology-text); }
.axis_teleology { --axis-accent: var(--axis-teleology); --axis-soft: var(--axis-teleology-soft); --axis-ink: var(--axis-teleology-text); }

.card_top_row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
}

.code_tag {
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: 0.82rem;
  padding: 0.1rem 0.5rem;
  border-radius: var(--radius-xs);
  background: var(--axis-soft, var(--accent-soft));
  color: var(--axis-ink, var(--accent-text));
}

.axis_chip {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--ink-muted);
}

.badge_hit {
  margin-left: auto;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.08rem 0.48rem;
  border-radius: var(--radius-pill);
  background: var(--status-draft-soft);
  color: var(--status-draft-text);
  border: 1px solid var(--status-draft);
}

.badge_note {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.08rem 0.48rem;
  border-radius: var(--radius-pill);
  background: var(--status-verified-soft);
  color: var(--status-verified-text);
  border: 1px solid var(--status-verified);
}

.card_title {
  font-size: 1.08rem;
  font-weight: 700;
  line-height: 1.35;
  color: var(--ink-primary);
}

.card_en {
  font-size: 0.85rem;
  color: var(--ink-muted);
  font-family: var(--font-serif);
}

.card_excerpt {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.55;
  color: var(--ink-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.pillar_children_row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.38rem;
  padding-top: 0.55rem;
  border-top: 1px dashed var(--border-subtle);
}

.mini_child_chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.22rem 0.55rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-subtle);
  background: var(--surface-subtle);
  font-size: 0.8rem;
  color: var(--ink-secondary);
  transition: background-color 0.14s ease, border-color 0.14s ease;
}

.mini_child_chip:hover {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent-text);
}

.mini_code {
  font-family: var(--font-mono);
  font-weight: 700;
}

/* 同级四位切换条 */
.slice_siblings_bar {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 0.75rem 0.9rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  background: var(--surface-subtle);
}

.slice_bar_label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--ink-muted);
}

.slice_chips_grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 10rem), 1fr));
  gap: 0.45rem;
}

.slice_chip_btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.65rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
  background: var(--surface-elevated);
  color: var(--ink-primary);
  text-align: left;
  font-size: 0.88rem;
  transition: background-color 0.14s ease, border-color 0.14s ease;
}

.slice_chip_btn:hover {
  border-color: var(--accent-border);
  background: var(--accent-soft);
}

.slice_chip_btn.is_active {
  border-color: var(--accent);
  background: var(--accent-soft);
  box-shadow: inset 0 0 0 1px var(--accent);
  font-weight: 600;
}

.slice_chip_name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.badge_dot_hit,
.badge_dot_note {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.badge_dot_hit { background: var(--status-draft); margin-left: auto; }
.badge_dot_note { background: var(--status-verified); }

.leaf_axis_head {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.leaf_axis_digit {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: var(--radius-xs);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--axis-soft);
  color: var(--axis-ink);
  font-family: var(--font-mono);
  font-weight: 700;
}

.leaf_axis_name {
  font-weight: 700;
  font-size: 0.94rem;
}

.leaf_axis_text {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.6;
  color: var(--ink-secondary);
}

/* 模式二：3D 立体切片魔方 */
.cube3d_workspace {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  min-height: 0;
  gap: 0.65rem;
  user-select: none;
  cursor: grab;
}

.cube3d_workspace:active {
  cursor: grabbing;
}

.cube3d_hint {
  margin: 0;
  font-size: 0.84rem;
  color: var(--ink-muted);
}

.cube3d_scene {
  width: 100%;
  min-height: clamp(17rem, 50vh, 25rem);
  display: grid;
  place-items: center;
  perspective: 1100px;
}

.cube3d_pivot {
  position: relative;
  width: min(23rem, 78vw);
  height: 14.5rem;
  transform-style: preserve-3d;
  transition: transform 0.08s linear;
}

.cube3d_plane {
  position: absolute;
  inset: 0;
  padding: 0.75rem;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
  background: var(--surface-glass);
  backdrop-filter: blur(8px);
  box-shadow: var(--shadow-md);
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  transform-style: preserve-3d;
}

.cube3d_plane.is_current_layer {
  border-color: var(--accent);
  box-shadow: var(--shadow-lg);
}

.cube3d_plane_label {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--ink-secondary);
}

.cube3d_plane_grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.45rem;
}

.cube3d_cell {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.18rem;
  padding: 0.45rem 0.55rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
  background: var(--surface-elevated);
  color: var(--ink-primary);
  text-align: left;
  transition: background-color 0.14s ease, border-color 0.14s ease, transform 0.14s ease;
}

.cube3d_cell:hover {
  border-color: var(--axis-accent);
  background: var(--axis-soft);
}

.cube3d_cell.is_selected {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--ink-inverse);
}

.cube3d_cell.is_ancestor {
  border-color: var(--axis-accent);
  background: var(--axis-soft);
}

.cube3d_cell_code {
  font-family: var(--font-mono);
  font-size: 0.78rem;
  font-weight: 700;
  opacity: 0.9;
}

.cube3d_cell_name {
  font-size: 0.88rem;
  font-weight: 600;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
