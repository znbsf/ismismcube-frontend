<template>
  <div v-if="open" class="course_drawer_backdrop" @click.self="emit('close')">
    <div
      ref="panelRef"
      class="course_drawer_panel"
      role="dialog"
      aria-modal="true"
      aria-label="补充课程与 $ 系列资料库"
    >
      <div class="drawer_header">
        <div class="drawer_title_group">
          <span class="drawer_title">补充课程与 $ 系列精读库</span>
          <span class="drawer_subtitle">共 {{ courses.length }} 条课程元数据 · {{ withBodyCount }} 篇已摘录正文（均未核原音）</span>
        </div>
        <button type="button" class="drawer_close_btn" @click="emit('close')">关闭 [ESC]</button>
      </div>

      <div class="drawer_toolbar">
        <div class="drawer_tabs">
          <button
            v-for="tab in categoryTabs"
            :key="tab.key"
            type="button"
            class="drawer_tab_btn"
            :class="{ active: activeCategory === tab.key }"
            @click="activeCategory = tab.key"
          >
            {{ tab.label }} ({{ tab.count }})
          </button>
        </div>
        <div class="drawer_search_row">
          <input
            ref="searchInputRef"
            v-model="drawerQuery"
            type="text"
            class="drawer_search_input"
            placeholder="筛选课程标题 / BV号 / $编号 / 节点编码 / 摘要内容..."
          >
          <button
            v-if="drawerQuery"
            type="button"
            class="drawer_clear_btn"
            @click="drawerQuery = ''"
          >
            清空
          </button>
          <label class="drawer_checkbox">
            <input v-model="onlyWithBody" type="checkbox">
            仅显示含正文摘要 ({{ withBodyCount }})
          </label>
        </div>
      </div>

      <div v-if="coursesStatus === 'loading'" class="drawer_status_box">正在加载课程目录...</div>
      <div v-else-if="coursesStatus === 'error'" class="drawer_status_box error_box">
        <div>{{ coursesError || '补充课程目录加载失败。' }}</div>
        <button type="button" class="retry_btn" @click="emit('retryCourses')">重试加载</button>
      </div>
      <div v-else class="drawer_body">
        <div class="drawer_list">
          <div v-if="filteredCourses.length === 0" class="drawer_empty">
            没有符合当前筛选条件的课程。
          </div>
          <button
            v-for="course in filteredCourses"
            :key="course.id"
            type="button"
            class="course_list_item"
            :class="{ selected: selectedCourse?.id === course.id }"
            @click="selectedCourseId = course.id"
          >
            <div class="course_item_top">
              <span class="course_badge kind_badge">{{ getCourseKindLabel(course.kind) }}</span>
              <span v-if="getBodyForCourse(course)?.series_code" class="course_badge series_badge">
                {{ getBodyForCourse(course)?.series_code }}
              </span>
              <span v-else-if="course.catalogue_code" class="course_badge node_badge">
                节点 {{ course.catalogue_code }}
              </span>
              <span v-if="hasBodyForCourse(course)" class="course_badge body_badge">有摘要正文</span>
            </div>
            <div class="course_item_title">
              <HighlightText :text="course.title" :query="drawerQuery" />
            </div>
            <div class="course_item_meta">
              <span>{{ course.id }}</span>
              <span v-if="course.archival_published_date">{{ course.archival_published_date }}</span>
              <span v-if="course.video_check?.duration_seconds">{{ formatDuration(course.video_check.duration_seconds) }}</span>
            </div>
          </button>
        </div>

        <div class="drawer_detail">
          <div v-if="!selectedCourse" class="drawer_empty">请从左侧列表选择一节课程查看详情。</div>
          <template v-else>
            <div class="detail_header">
              <div class="detail_badges">
                <span class="course_badge kind_badge">{{ getCourseKindLabel(selectedCourse.kind) }}</span>
                <span v-if="selectedBody?.series_code" class="course_badge series_badge">
                  编号：{{ selectedBody.series_code }}
                </span>
                <span class="course_badge status_badge">
                  {{ getBodyStatusLabel(selectedCourse.body_status || selectedBody?.body_status) }}
                </span>
                <span v-if="selectedCourse.video_check?.status" class="course_badge video_badge">
                  视频元数据：{{ selectedCourse.video_check.status === 'metadata_verified' ? '公开接口已核标题/时长' : selectedCourse.video_check.status }}
                </span>
              </div>

              <h3 class="detail_title">
                <HighlightText :text="selectedCourse.title" :query="drawerQuery" />
              </h3>

              <div class="detail_links_row">
                <a :href="selectedCourse.url" target="_blank" rel="noopener noreferrer">
                  B站视频：{{ selectedCourse.id }}
                </a>
                <span v-if="selectedCourse.archival_published_date">
                  归档日期：{{ selectedCourse.archival_published_date }}
                </span>
                <span v-if="selectedCourse.video_check?.duration_seconds">
                  时长：{{ formatDuration(selectedCourse.video_check.duration_seconds) }}
                </span>
              </div>

              <div v-if="linkedCodesForSelected.length > 0" class="detail_codes_row">
                <span class="codes_label">关联魔方节点：</span>
                <template v-for="code in linkedCodesForSelected" :key="code">
                  <button
                    v-if="canJumpToNode(code)"
                    type="button"
                    class="node_jump_btn"
                    @click="jumpToNode(code)"
                  >
                    {{ code }}
                  </button>
                  <span v-else class="node_code_tag" title="该编号属于补充系列，不在主魔方数字树内">
                    {{ code }}
                  </span>
                </template>
              </div>
            </div>

            <div v-if="bodiesStatus === 'error' && hasBodyForCourse(selectedCourse)" class="drawer_status_box error_box">
              <div>{{ bodiesError || '课程摘要正文加载失败。' }}</div>
              <button type="button" class="retry_btn" @click="emit('retryBodies')">重试加载摘要</button>
            </div>
            <div v-else-if="bodiesStatus === 'loading' && hasBodyForCourse(selectedCourse)" class="drawer_status_box">
              正在加载课程摘要正文...
            </div>
            <div v-else-if="selectedBody" class="detail_sections">
              <div class="info_notice_banner">
                <strong>核校口径：</strong>{{ selectedBody.review_scope || '文本摘要核读，原音未逐句人工听校。' }}
                <span v-if="selectedBody.identity_verification">（身份核对：{{ selectedBody.identity_verification }}）</span>
              </div>

              <div class="detail_section">
                <h4>课程内容摘要（共 {{ selectedBody.course_summary.length }} 段）</h4>
                <ol class="summary_list">
                  <li v-for="(item, idx) in selectedBody.course_summary" :key="idx" class="summary_item">
                    <div class="summary_text">
                      <HighlightText :text="item.text" :query="drawerQuery" />
                    </div>
                    <div v-if="item.locator || item.source_ids?.length" class="summary_meta">
                      <span v-if="item.locator">定位：{{ item.locator }}</span>
                      <span v-if="item.source_ids?.length">来源ID：{{ item.source_ids.join(', ') }}</span>
                    </div>
                  </li>
                </ol>
              </div>

              <div v-if="selectedBody.editorial_notes?.length" class="detail_section">
                <h4>编者校勘注</h4>
                <ul class="notes_list">
                  <li v-for="(note, idx) in selectedBody.editorial_notes" :key="idx">
                    <HighlightText :text="getNoteText(note)" :query="drawerQuery" />
                  </li>
                </ul>
              </div>

              <div v-if="selectedBody.reading_links?.length" class="detail_section">
                <h4>典籍对读与延伸条目</h4>
                <ul class="readings_list">
                  <li v-for="(link, idx) in selectedBody.reading_links" :key="idx" class="reading_card">
                    <div class="reading_top">
                      <span class="course_badge reading_badge">
                        {{ link.relation === 'lecture_explicit_reference' ? '课程显式提及' : '编者延伸对读' }}
                      </span>
                      <span class="reading_source">{{ link.source_id }}</span>
                      <span v-if="link.locator" class="reading_locator">{{ link.locator }}</span>
                    </div>
                    <div v-if="link.reason" class="reading_reason">
                      <HighlightText :text="link.reason" :query="drawerQuery" />
                    </div>
                    <div v-if="link.verification_scope" class="reading_scope">
                      核对边界：{{ link.verification_scope }}
                    </div>
                  </li>
                </ul>
              </div>
            </div>

            <div v-else class="detail_no_body">
              本课程当前仅完成目录身份与 B 站公开元数据校验（证据层级：{{ selectedCourse.evidence_level }}），尚未录入手工 ASR 摘要正文。可通过上方 B 站链接查看原视频。
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import HighlightText from './HighlightText.vue'
import type { CourseBodiesMap, CourseBodyRecord, CourseRecord } from '../types/research'
import {
  BODY_STATUS_LABELS,
  COURSE_KIND_LABELS,
  formatDuration,
  getNoteText,
  includesQuery
} from '../utils/ismFormat'

type CategoryKey = 'dollar_series' | 'study' | 'special' | 'all'
type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

const props = defineProps<{
  open: boolean
  courses: CourseRecord[]
  courseBodies: CourseBodiesMap
  coursesStatus: LoadStatus
  coursesError: string
  bodiesStatus: LoadStatus
  bodiesError: string
  canJump?: (code: string) => boolean
  initialCourseId?: string
  initialCategory?: CategoryKey
}>()

const emit = defineEmits<{
  close: []
  jumpToNode: [code: string]
  retryCourses: []
  retryBodies: []
}>()

const panelRef = ref<HTMLElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)
let previouslyFocusedElement: HTMLElement | null = null

const activeCategory = ref<CategoryKey>('dollar_series')
const onlyWithBody = ref(false)
const drawerQuery = ref('')
const selectedCourseId = ref('')

const getBodyForCourse = (course: CourseRecord): CourseBodyRecord | undefined => {
  if (course.body_ref && props.courseBodies[course.body_ref]) {
    return props.courseBodies[course.body_ref]
  }
  return props.courseBodies[course.id]
}

const hasBodyForCourse = (course: CourseRecord): boolean => {
  return Boolean(course.body_ref || getBodyForCourse(course))
}

const isDollarCourse = (course: CourseRecord): boolean => {
  const body = getBodyForCourse(course)
  return (
    course.kind === 'dollar_series' ||
    Boolean(body?.series_code?.startsWith('$')) ||
    course.title.includes('（$-') ||
    course.title.includes('（$）')
  )
}

const isStudyCourse = (course: CourseRecord): boolean => {
  return course.kind === 'review' || course.kind === 'preview' || course.kind === 'exercise'
}

const isSpecialCourse = (course: CourseRecord): boolean => {
  if (isDollarCourse(course) || isStudyCourse(course)) return false
  return course.kind === 'extra' || course.kind === 'overview' || hasBodyForCourse(course)
}

const withBodyCount = computed(() => {
  return props.courses.filter((c) => hasBodyForCourse(c)).length
})

const categoryTabs = computed(() => {
  const all = props.courses
  return [
    { key: 'dollar_series' as CategoryKey, label: '$ 系列', count: all.filter(isDollarCourse).length },
    { key: 'study' as CategoryKey, label: '复习/预习/导学', count: all.filter(isStudyCourse).length },
    { key: 'special' as CategoryKey, label: '番外/总纲/新总论', count: all.filter(isSpecialCourse).length },
    { key: 'all' as CategoryKey, label: '全部课程', count: all.length }
  ]
})

const matchesCategory = (course: CourseRecord, cat: CategoryKey): boolean => {
  if (cat === 'all') return true
  if (cat === 'dollar_series') return isDollarCourse(course)
  if (cat === 'study') return isStudyCourse(course)
  if (cat === 'special') return isSpecialCourse(course)
  return true
}

const sortCourses = (list: CourseRecord[]): CourseRecord[] => {
  return [...list].sort((a, b) => {
    const ba = getBodyForCourse(a)
    const bb = getBodyForCourse(b)
    const sa = ba?.series_code ?? a.catalogue_code ?? ''
    const sb = bb?.series_code ?? b.catalogue_code ?? ''
    if (sa === '$' && sb !== '$') return -1
    if (sb === '$' && sa !== '$') return 1
    if (sa && sb && sa !== sb) return sa.localeCompare(sb, 'zh-CN')
    const hasA = hasBodyForCourse(a)
    const hasB = hasBodyForCourse(b)
    if (hasA && !hasB) return -1
    if (!hasA && hasB) return 1
    return (a.archival_published_date ?? '').localeCompare(b.archival_published_date ?? '')
  })
}

const filteredCourses = computed(() => {
  const q = drawerQuery.value.trim()
  const matched = props.courses.filter((course) => {
    if (!matchesCategory(course, activeCategory.value)) return false
    const body = getBodyForCourse(course)
    if (onlyWithBody.value && !hasBodyForCourse(course)) return false
    if (!q) return true
    if (
      includesQuery(course.id, q) ||
      includesQuery(course.title, q) ||
      includesQuery(course.catalogue_code, q) ||
      course.related_codes.some((code) => includesQuery(code, q))
    ) {
      return true
    }
    if (body) {
      if (includesQuery(body.series_code, q) || includesQuery(body.title, q)) return true
      if (body.course_summary.some((item) => includesQuery(item.text, q))) return true
      if (body.editorial_notes?.some((note) => includesQuery(getNoteText(note), q))) return true
    }
    return false
  })
  return sortCourses(matched)
})

const selectedCourse = computed(() => {
  const byId = filteredCourses.value.find((c) => c.id === selectedCourseId.value)
  return byId ?? filteredCourses.value[0] ?? null
})

const selectedBody = computed(() => {
  if (!selectedCourse.value) return undefined
  return getBodyForCourse(selectedCourse.value)
})

const linkedCodesForSelected = computed(() => {
  if (!selectedCourse.value) return []
  const codes = new Set<string>()
  if (selectedCourse.value.catalogue_code) codes.add(selectedCourse.value.catalogue_code)
  for (const c of selectedCourse.value.related_codes) {
    if (c) codes.add(c)
  }
  return Array.from(codes)
})

const canJumpToNode = (code: string): boolean => {
  return props.canJump ? props.canJump(code) : false
}

const getCourseKindLabel = (kind: string): string => {
  return COURSE_KIND_LABELS[kind] ?? kind
}

const getBodyStatusLabel = (status?: string): string => {
  if (!status) return '仅目录信息'
  return BODY_STATUS_LABELS[status] ?? status
}

const jumpToNode = (code: string) => {
  if (!canJumpToNode(code)) return
  emit('jumpToNode', code)
}

watch(
  () => props.open,
  async (isOpen, wasOpen) => {
    if (isOpen && !wasOpen) {
      previouslyFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null
      document.documentElement.style.overflow = 'hidden'
      await nextTick()
      searchInputRef.value?.focus()
    } else if (!isOpen && wasOpen) {
      document.documentElement.style.overflow = ''
      previouslyFocusedElement?.focus()
      previouslyFocusedElement = null
    }
  }
)

watch(
  () => [props.open, props.initialCourseId, props.initialCategory] as const,
  ([isOpen, initId, initCat]) => {
    if (!isOpen) return
    if (initId) {
      drawerQuery.value = ''
      activeCategory.value = 'all'
      onlyWithBody.value = false
      selectedCourseId.value = initId
    } else if (initCat) {
      activeCategory.value = initCat
    }
  }
)

watch(filteredCourses, (list) => {
  if (list.length > 0 && !list.some((c) => c.id === selectedCourseId.value)) {
    selectedCourseId.value = list[0].id
  }
})

const getFocusableElements = (): HTMLElement[] => {
  if (!panelRef.value) return []
  const selector = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
  return Array.from(panelRef.value.querySelectorAll<HTMLElement>(selector)).filter(
    (el) => el.offsetParent !== null
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
    if (focusables.length === 0) return
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
.course_drawer_backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
  background-color: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  box-sizing: border-box;
}

.course_drawer_panel {
  width: min(68rem, 96vw);
  height: min(46rem, 90vh);
  background-color: rgb(230, 230, 230);
  border: 2px solid black;
  box-shadow: 0 0 1.5rem rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: black;
  font-size: 0.85rem;
}

.drawer_header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.6rem 1rem;
  background-color: rgb(200, 200, 200);
  border-bottom: 1px solid black;
}

.drawer_title_group {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.6rem;
}

.drawer_title {
  font-size: 1rem;
  font-weight: bold;
}

.drawer_subtitle {
  font-size: 0.78rem;
  color: rgb(60, 60, 60);
}

.drawer_close_btn {
  padding: 0.2rem 0.6rem;
  background-color: rgb(220, 220, 220);
  border: 1px solid black;
  cursor: pointer;
  font-size: 0.78rem;
}

.drawer_close_btn:hover {
  background-color: gray;
  color: white;
}

.drawer_toolbar {
  padding: 0.55rem 1rem;
  background-color: rgb(218, 218, 218);
  border-bottom: 1px solid black;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.drawer_tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.drawer_tab_btn {
  padding: 0.2rem 0.6rem;
  background-color: rgb(200, 200, 200);
  border: 1px solid black;
  cursor: pointer;
  font-size: 0.78rem;
}

.drawer_tab_btn:hover {
  background-color: rgb(175, 175, 175);
}

.drawer_tab_btn.active {
  background-color: darkcyan;
  color: white;
  font-weight: bold;
}

.drawer_search_row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.drawer_search_input {
  flex: 1;
  min-width: 14rem;
  height: 1.65rem;
  padding: 0 0.5rem;
  border: 1px solid black;
  background-color: white;
  font-size: 0.8rem;
  box-sizing: border-box;
}

.drawer_clear_btn {
  height: 1.65rem;
  padding: 0 0.55rem;
  background-color: rgb(200, 200, 200);
  border: 1px solid black;
  cursor: pointer;
  font-size: 0.78rem;
}

.drawer_checkbox {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.78rem;
  cursor: pointer;
}

.drawer_status_box {
  padding: 2rem;
  text-align: center;
}

.error_box {
  color: darkred;
}

.drawer_body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 20rem 1fr;
}

.drawer_list {
  overflow-y: auto;
  border-right: 1px solid black;
  background-color: rgb(212, 212, 212);
}

.course_list_item {
  width: 100%;
  text-align: left;
  padding: 0.55rem 0.75rem;
  border: none;
  border-bottom: 1px solid rgb(165, 165, 165);
  background-color: transparent;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.28rem;
}

.course_list_item:hover {
  background-color: rgb(195, 195, 195);
}

.course_list_item.selected {
  background-color: rgb(176, 214, 214);
  border-left: 4px solid darkcyan;
}

.course_item_top {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.course_badge {
  display: inline-block;
  padding: 0.05rem 0.35rem;
  font-size: 0.72rem;
  border: 1px solid rgb(80, 80, 80);
  background-color: rgb(240, 240, 240);
}

.series_badge {
  background-color: rgb(252, 232, 180);
  border-color: rgb(160, 110, 0);
  font-weight: bold;
}

.node_badge {
  background-color: rgb(215, 242, 242);
  border-color: darkcyan;
}

.body_badge {
  background-color: rgb(220, 240, 218);
  border-color: rgb(46, 112, 46);
}

.status_badge {
  background-color: rgb(238, 238, 238);
}

.video_badge {
  background-color: rgb(226, 235, 248);
}

.reading_badge {
  background-color: rgb(235, 226, 246);
}

.course_item_title {
  font-size: 0.8rem;
  line-height: 1.35;
  color: black;
}

.course_item_meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  font-size: 0.72rem;
  color: rgb(75, 75, 75);
}

.drawer_detail {
  overflow-y: auto;
  padding: 0.9rem 1.1rem;
  background-color: rgb(225, 225, 225);
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.drawer_empty {
  padding: 1.5rem;
  text-align: center;
  color: rgb(80, 80, 80);
}

.detail_header {
  padding-bottom: 0.65rem;
  border-bottom: 1px solid rgb(150, 150, 150);
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.detail_badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.detail_title {
  font-size: 1rem;
  line-height: 1.4;
}

.detail_links_row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.9rem;
  font-size: 0.78rem;
}

.detail_codes_row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
}

.codes_label {
  font-size: 0.78rem;
  font-weight: bold;
}

.node_jump_btn {
  padding: 0.1rem 0.45rem;
  background-color: rgb(200, 230, 230);
  border: 1px solid darkcyan;
  cursor: pointer;
  font-size: 0.76rem;
}

.node_jump_btn:hover {
  background-color: darkcyan;
  color: white;
}

.node_code_tag {
  display: inline-block;
  padding: 0.1rem 0.45rem;
  background-color: rgb(235, 235, 235);
  border: 1px solid rgb(135, 135, 135);
  font-size: 0.76rem;
  color: rgb(65, 65, 65);
}

.retry_btn {
  margin-top: 0.6rem;
  padding: 0.25rem 0.75rem;
  background-color: rgb(215, 215, 215);
  border: 1px solid black;
  cursor: pointer;
  font-size: 0.8rem;
}

.retry_btn:hover {
  background-color: darkcyan;
  color: white;
}

.info_notice_banner {
  padding: 0.45rem 0.65rem;
  background-color: rgb(246, 240, 215);
  border: 1px solid rgb(150, 120, 40);
  font-size: 0.78rem;
  line-height: 1.45;
}

.detail_sections {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.detail_section h4 {
  font-size: 0.86rem;
  margin-bottom: 0.35rem;
  padding-bottom: 0.15rem;
  border-bottom: 1px dashed rgb(130, 130, 130);
}

.summary_list,
.notes_list,
.readings_list {
  margin: 0;
  padding-left: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.readings_list {
  list-style: none;
  padding-left: 0;
}

.summary_item {
  line-height: 1.5;
}

.summary_meta {
  margin-top: 0.18rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.7rem;
  font-size: 0.73rem;
  color: rgb(70, 70, 70);
}

.reading_card {
  padding: 0.45rem 0.6rem;
  background-color: rgb(236, 236, 236);
  border: 1px solid rgb(155, 155, 155);
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.reading_top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
}

.reading_source {
  font-weight: bold;
  font-size: 0.78rem;
}

.reading_locator,
.reading_scope {
  font-size: 0.74rem;
  color: rgb(70, 70, 70);
}

.reading_reason {
  line-height: 1.45;
}

.detail_no_body {
  padding: 0.9rem;
  background-color: rgb(236, 236, 236);
  border: 1px solid rgb(160, 160, 160);
  line-height: 1.5;
}

@media (max-width: 820px) {
  .drawer_body {
    grid-template-columns: 1fr;
    grid-template-rows: 13rem 1fr;
  }

  .drawer_list {
    border-right: none;
    border-bottom: 1px solid black;
  }
}
</style>
