<template>
  <div v-if="open" class="guide_modal_backdrop" @click.self="emit('close')">
    <div
      ref="panelRef"
      class="guide_modal_panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="code_guide_title"
      tabindex="-1"
    >
      <div class="guide_header">
        <h2 id="code_guide_title" class="guide_title">怎么读主义主义编号</h2>
        <button
          ref="closeBtnRef"
          type="button"
          class="guide_close_btn"
          @click="emit('close')"
        >
          关闭
        </button>
      </div>

      <div class="guide_body">
        <p class="guide_paragraph">
          四位编号按顺序表示 场域论—本体论—认识论—目的论。短编号只写到相应层级：1 是第一层，1-1 细分到第二层，1-1-4-4 才具体到第四层。讲者把四格解释为相互贯穿的结构，以背景与前景的关系嵌套，不是四个互不相干的标签。
        </p>

        <section class="guide_section">
          <h3 class="section_heading">每一格可以追问什么</h3>
          <div class="table_scroll">
            <table class="guide_table">
              <thead>
                <tr>
                  <th>位置</th>
                  <th>初读时可以追问</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="pos_cell" style="color: red">第一位：场域论</td>
                  <td>这个立场预设怎样的整体背景、秩序或关系？</td>
                </tr>
                <tr>
                  <td class="pos_cell" style="color: green">第二位：本体论</td>
                  <td>在这个背景中，什么被认作存在，存在怎样组织、显现？</td>
                </tr>
                <tr>
                  <td class="pos_cell" style="color: blue">第三位：认识论</td>
                  <td>现象、感知和认识依靠什么前提或中介？</td>
                </tr>
                <tr>
                  <td class="pos_cell" style="color: darkorange">第四位：目的论</td>
                  <td>整个体系朝什么方向运作，这如何表现为行动准则与伦理姿态？</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="table_note">
            这些问题是便于阅读的转述。原文把前两格近似称为实体侧、后两格称为主体侧，随即否认把二者僵硬切开。
          </p>
        </section>

        <section class="guide_section">
          <h3 class="section_heading">四个取值：记结构，别背万能译码</h3>
          <div class="table_scroll">
            <table class="guide_table">
              <thead>
                <tr>
                  <th>取值</th>
                  <th>阅读提示</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="val_cell">1</td>
                  <td>单一、融贯的秩序。</td>
                </tr>
                <tr>
                  <td class="val_cell">2</td>
                  <td>二重化、分裂或对立；不等于两个物理宇宙，不同分支呈现不同二分。</td>
                </tr>
                <tr>
                  <td class="val_cell">3</td>
                  <td>由某个中介组织两端，或形成中心；不能据此认定所有 3 都只是个人自我。</td>
                </tr>
                <tr>
                  <td class="val_cell">4</td>
                  <td>可能表现为不再有固定中心、预定方向或既有划分；不同分支的 4 内容差别很大，不能仅凭“4=开放”补定义。</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <div class="guide_warning_box">
          同一个数字在不同位置、不同分支中要重新落实。数字不是能力分数；讲者也批评把一个编号认领为身份、停止思考的做法——适合练习的是解释一段论证，不是给自己或别人盖章。
        </div>

        <section class="guide_section">
          <h3 class="section_heading">在本站怎么用</h3>
          <ul class="usage_list">
            <li>点魔方格子打开一个立场；悬停可预览。</li>
            <li>“概览与四轴”里看每一格定于哪一层，并与同层立场对比差在哪一格。</li>
            <li>快捷键：[ 和 ] 切换同层立场，U 回到上一层。</li>
            <li>“校勘与典籍”看逐项核查与原典；概览里的 ◔ △ ✕ ✎ 标记可展开查看。</li>
            <li>“我的笔记”按编号 / 论点 / 出处 / 问题记录，可导出。</li>
            <li>左侧“阅读路线”给出一条从拆格到原典对照的入门顺序。</li>
          </ul>
        </section>

        <p class="guide_footer_muted">
          依据项目阅读入口 START-HERE 与社区整理分讲稿的局部核读，未核原音；表格是阅读提示，不当作讲者完整、最终的定义。
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps<{
  open: boolean
  fallbackFocusSelector?: string
}>()

const emit = defineEmits<{
  close: []
}>()

const panelRef = ref<HTMLElement | null>(null)
const closeBtnRef = ref<HTMLButtonElement | null>(null)
let previouslyFocusedElement: HTMLElement | null = null

const restoreFocus = () => {
  if (previouslyFocusedElement && previouslyFocusedElement.isConnected) {
    previouslyFocusedElement.focus()
  } else if (props.fallbackFocusSelector) {
    const fallback = document.querySelector<HTMLElement>(props.fallbackFocusSelector)
    fallback?.focus()
  }
  previouslyFocusedElement = null
}

watch(
  () => props.open,
  async (isOpen, wasOpen) => {
    if (isOpen && !wasOpen) {
      previouslyFocusedElement =
        document.activeElement instanceof HTMLElement ? document.activeElement : null
      document.documentElement.style.overflow = 'hidden'
      await nextTick()
      if (props.open) {
        closeBtnRef.value?.focus()
      }
    } else if (!isOpen && wasOpen) {
      document.documentElement.style.overflow = ''
      await nextTick()
      restoreFocus()
    }
  },
  { immediate: true }
)

const getFocusableElements = (): HTMLElement[] => {
  if (!panelRef.value) return []
  const selector =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  return Array.from(panelRef.value.querySelectorAll<HTMLElement>(selector)).filter(
    (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden'
  )
}

const handleKeydown = (event: KeyboardEvent) => {
  if (!props.open) return
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
    return
  }
  if (event.key === 'Tab') {
    const focusables = getFocusableElements()
    if (focusables.length === 0) {
      event.preventDefault()
      panelRef.value?.focus()
      return
    }
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    const active = document.activeElement
    if (event.shiftKey) {
      if (active === first || !panelRef.value?.contains(active)) {
        event.preventDefault()
        last.focus()
      }
    } else if (active === last || !panelRef.value?.contains(active)) {
      event.preventDefault()
      first.focus()
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.documentElement.style.overflow = ''
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.guide_modal_backdrop {
  position: fixed;
  inset: 0;
  z-index: 210;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(0.5rem, 2vw, 1rem);
  box-sizing: border-box;
}

.guide_modal_panel {
  width: min(46rem, 100%);
  max-width: 100%;
  max-height: 90vh;
  max-height: 90dvh;
  background-color: rgb(230, 230, 230);
  border: 2px solid black;
  box-shadow: 0 0 1.5rem rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: black;
  font-size: max(0.85rem, 13px);
  box-sizing: border-box;
}

.guide_header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.65rem 1rem;
  background-color: rgb(200, 200, 200);
  border-bottom: 1px solid black;
  flex-shrink: 0;
  min-width: 0;
}

.guide_title {
  margin: 0;
  font-size: 1.18em;
  font-weight: bold;
  min-width: 0;
  overflow-wrap: anywhere;
}

.guide_close_btn {
  padding: 0.2rem 0.7rem;
  background-color: rgb(220, 220, 220);
  border: 1px solid black;
  cursor: pointer;
  font-size: 0.92em;
  color: black;
  flex-shrink: 0;
  white-space: nowrap;
}

.guide_close_btn:hover {
  background-color: gray;
  color: white;
}

.guide_body {
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 0.9rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  line-height: 1.5;
}

.guide_paragraph {
  margin: 0;
}

.guide_section {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  min-width: 0;
  max-width: 100%;
}

.section_heading {
  margin: 0;
  font-size: 1.08em;
  font-weight: bold;
  padding-bottom: 0.2rem;
  border-bottom: 1px solid rgb(135, 135, 135);
}

.table_scroll {
  max-width: 100%;
  overflow-x: auto;
}

.guide_table {
  width: 100%;
  border-collapse: collapse;
  background-color: rgb(238, 238, 238);
  font-size: 0.96em;
}

.guide_table th,
.guide_table td {
  border: 1px solid rgb(120, 120, 120);
  padding: 0.42rem 0.6rem;
  text-align: left;
  vertical-align: top;
}

.guide_table th {
  background-color: rgb(212, 212, 212);
  font-weight: bold;
}

.pos_cell {
  font-weight: bold;
  white-space: nowrap;
}

.val_cell {
  font-weight: bold;
  text-align: center;
  white-space: nowrap;
  width: 3.5rem;
}

.table_note {
  margin: 0;
  font-size: 0.92em;
  color: rgb(60, 60, 60);
}

.guide_warning_box {
  padding: 0.55rem 0.75rem;
  background-color: rgb(248, 235, 205);
  border: 1px solid rgb(160, 115, 30);
  font-size: 0.96em;
  line-height: 1.5;
}

.usage_list {
  margin: 0;
  padding-left: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.28rem;
}

.guide_footer_muted {
  margin: 0;
  padding-top: 0.45rem;
  border-top: 1px dashed rgb(140, 140, 140);
  font-size: 0.89em;
  color: rgb(75, 75, 75);
}

@media (max-width: 480px) {
  .guide_header,
  .guide_body {
    padding-left: 0.75rem;
    padding-right: 0.75rem;
  }

  .guide_table th,
  .guide_table td {
    padding: 0.35rem 0.45rem;
  }

  .pos_cell {
    white-space: normal;
    min-width: 4.5em;
  }
}
</style>
