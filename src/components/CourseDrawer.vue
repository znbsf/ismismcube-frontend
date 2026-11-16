<template>
  <div v-if="open" class="course_drawer_backdrop" @click.self="emit('close')">
    <div
      ref="panelRef"
      class="course_drawer_panel"
      :class="mobilePane === 'detail' ? 'mobile_pane_detail' : 'mobile_pane_list'"
      role="dialog"
      aria-modal="true"
      aria-labelledby="course_drawer_title"
      tabindex="-1"
    >
      <div class="drawer_header">
        <div class="drawer_title_group">
          <h2 id="course_drawer_title" class="drawer_title">补充课程与 $ 系列精读库</h2>
          <span class="drawer_subtitle">共 {{ courses.length }} 条课程元数据 · {{ withBodyCount }} 篇已摘录正文（均未核原音）</span>
        </div>
        <button ref="closeBtnRef" type="button" class="drawer_close_btn" @click="emit('close')">关闭 [ESC]</button>
      </div>

      <div
        v-if="coursesStatus !== 'loading' && coursesStatus !== 'error'"
        class="mobile_pane_switcher"
        role="tablist"
        aria-label="课程面板视图切换"
      >
        <button
          ref="mobileListBtnRef"
          type="button"
          class="mobile_pane_btn"
          :class="{ active: mobilePane === 'list' }"
          :aria-selected="mobilePane === 'list'"
          @click="switchMobilePane('list')"
        >
          课程列表 ({{ filteredCourses.length }})
        </button>
        <button
          ref="mobileDetailBtnRef"
          type="button"
          class="mobile_pane_btn"
          :class="{ active: mobilePane === 'detail' }"
          :aria-selected="mobilePane === 'detail'"
          :disabled="!selectedCourse && !unresolvedCourseId"
          @click="switchMobilePane('detail')"
        >
          {{ unresolvedCourseId ? '目标课程缺失' : '课程详情' }}
        </button>
      </div>

      <div class="drawer_toolbar">
        <div class="drawer_tabs">
          <button
            v-for="tab in categoryTabs"
            :key="tab.key"
            type="button"
            class="drawer_tab_btn"
            :class="{ active: activeCategory === tab.key }"
            @click="selectCategory(tab.key)"
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
            @input="onFilterChanged"
          >
          <button
            v-if="drawerQuery"
            type="button"
            class="drawer_clear_btn"
            @click="clearDrawerQuery"
          >
            清空
          </button>
          <label class="drawer_checkbox">
            <input v-model="onlyWithBody" type="checkbox" @change="onFilterChanged">
            仅显示含正文摘要 ({{ withBodyCount }})
          </label>
        </div>
      </div>

      <div v-if="coursesStatus === 'loading'" class="drawer_status_box">正在加载课程目录...</div>
      <div v-else-if="coursesStatus === 'error'" class="drawer_status_box error_box">
        <div>{{ coursesError || '补充课程目录加载失败。' }}</div>
        <button type="button" class="retry_btn" @click="retryLoad($event, 'courses')">重试加载</button>
      </div>
      <div v-else class="drawer_body">
        <div ref="listRef" class="drawer_list">
          <div v-if="filteredCourses.length === 0" class="drawer_empty">
            没有符合当前筛选条件的课程。
          </div>
          <button
            v-for="course in filteredCourses"
            :key="course.id"
            :data-course-id="course.id"
            type="button"
            class="course_list_item"
            :class="{ selected: selectedCourse?.id === course.id }"
            @click="selectCourse(course.id)"
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

        <div ref="detailRef" class="drawer_detail" tabindex="-1">
          <div v-if="unresolvedCourseId" class="drawer_empty error_box" role="status">
            <div>未找到目标课程「{{ unresolvedCourseId }}」，该课程可能尚未收录或编号无效。</div>
            <div class="missing_course_hint">请从课程列表选择其他课程，或调整筛选条件继续浏览。</div>
          </div>
          <div v-else-if="!selectedCourse" class="drawer_empty">
            {{ filteredCourses.length === 0 ? '没有符合当前筛选条件的课程。' : '请从左侧列表选择一节课程查看详情。' }}
          </div>
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

              <h3 ref="detailTitleRef" class="detail_title" tabindex="-1">
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
              <button type="button" class="retry_btn" @click="retryLoad($event, 'bodies')">重试加载摘要</button>
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
  fallbackFocusSelector?: string
}>()

const emit = defineEmits<{
  close: []
  jumpToNode: [code: string]
  retryCourses: []
  retryBodies: []
}>()

const panelRef = ref<HTMLElement | null>(null)
const closeBtnRef = ref<HTMLButtonElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)
const mobileListBtnRef = ref<HTMLButtonElement | null>(null)
const mobileDetailBtnRef = ref<HTMLButtonElement | null>(null)
const listRef = ref<HTMLElement | null>(null)
const detailRef = ref<HTMLElement | null>(null)
const detailTitleRef = ref<HTMLElement | null>(null)
let previouslyFocusedElement: HTMLElement | null = null
let openFocusToken = 0
let paneFocusToken = 0
let suppressRestoreOnJump = false

const activeCategory = ref<CategoryKey>('dollar_series')
const onlyWithBody = ref(false)
const drawerQuery = ref('')
const selectedCourseId = ref('')
const unresolvedCourseId = ref('')
const mobilePane = ref<'list' | 'detail'>('list')

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
  if (unresolvedCourseId.value) return null
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
  const token = openFocusToken
  suppressRestoreOnJump = true
  emit('jumpToNode', code)
  void nextTick().then(() => {
    if (props.open && token === openFocusToken) {
      suppressRestoreOnJump = false
    }
  })
}

const hasCourseById = (id: string): boolean => {
  return Boolean(id) && props.courses.some((c) => c.id === id)
}

const isElementVisible = (el: HTMLElement | null): el is HTMLElement => {
  if (!el || !el.isConnected) return false
  return el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden'
}

const isFocusableCandidate = (el: HTMLElement | null): el is HTMLElement => {
  if (!isElementVisible(el)) return false
  return !(el as HTMLButtonElement).disabled
}

const isMobileDetailActive = (): boolean => {
  return (
    mobilePane.value === 'detail' &&
    isElementVisible(mobileListBtnRef.value) &&
    !isElementVisible(listRef.value)
  )
}

const focusDetailTarget = () => {
  if (isElementVisible(detailTitleRef.value)) {
    detailTitleRef.value.focus()
  } else if (isElementVisible(detailRef.value)) {
    detailRef.value.focus()
  }
}

// Handoff before loading removes the initiating button; no late focus callback.
const retryLoad = (event: MouseEvent, resource: 'courses' | 'bodies') => {
  if (!props.open) return
  if (event.currentTarget === document.activeElement) {
    if (resource === 'bodies') focusDetailTarget()
    else if (isElementVisible(panelRef.value)) panelRef.value.focus()
  }
  if (resource === 'courses') emit('retryCourses')
  else emit('retryBodies')
}

const findCourseButton = (courseId: string): HTMLButtonElement | null => {
  if (!listRef.value || !courseId) return null
  const buttons = listRef.value.querySelectorAll<HTMLButtonElement>('.course_list_item')
  for (const btn of buttons) {
    if (btn.dataset.courseId === courseId) return btn
  }
  return null
}

const selectCourse = async (id: string) => {
  const token = ++paneFocusToken
  unresolvedCourseId.value = ''
  selectedCourseId.value = id
  mobilePane.value = 'detail'
  await nextTick()
  if (
    token !== paneFocusToken ||
    !props.open ||
    unresolvedCourseId.value ||
    selectedCourse.value?.id !== id ||
    !isMobileDetailActive()
  ) {
    return
  }
  focusDetailTarget()
}

const ensureSelectionInFiltered = () => {
  if (
    filteredCourses.value.length > 0 &&
    !filteredCourses.value.some((c) => c.id === selectedCourseId.value)
  ) {
    selectedCourseId.value = filteredCourses.value[0].id
  }
}

const selectCategory = (cat: CategoryKey) => {
  paneFocusToken++
  unresolvedCourseId.value = ''
  activeCategory.value = cat
  ensureSelectionInFiltered()
}

const onFilterChanged = () => {
  if (!unresolvedCourseId.value) return
  unresolvedCourseId.value = ''
  ensureSelectionInFiltered()
}

const clearDrawerQuery = () => {
  drawerQuery.value = ''
  onFilterChanged()
}

const switchMobilePane = async (pane: 'list' | 'detail') => {
  const prevPane = mobilePane.value
  const token = ++paneFocusToken
  mobilePane.value = pane
  if (pane !== 'list' || prevPane !== 'detail') return
  const targetCourseId = selectedCourse.value?.id ?? ''
  if (!targetCourseId) return
  await nextTick()
  if (
    token !== paneFocusToken ||
    !props.open ||
    mobilePane.value !== 'list' ||
    selectedCourse.value?.id !== targetCourseId
  ) {
    return
  }
  const targetBtn = findCourseButton(targetCourseId)
  if (isElementVisible(targetBtn)) {
    targetBtn.focus()
  }
}

const restoreFocus = () => {
  const active = document.activeElement
  const hasExternalFocus = Boolean(
    active &&
    active !== document.body &&
    active !== document.documentElement &&
    (active as { isConnected?: boolean }).isConnected &&
    !panelRef.value?.contains(active as Node)
  )
  const prev = previouslyFocusedElement
  previouslyFocusedElement = null
  if (hasExternalFocus) return
  if (isFocusableCandidate(prev)) {
    prev.focus()
    return
  }
  if (props.fallbackFocusSelector) {
    const fallback = document.querySelector<HTMLElement>(props.fallbackFocusSelector)
    if (isFocusableCandidate(fallback)) {
      fallback.focus()
    }
  }
}

watch(
  () => props.open,
  async (isOpen, wasOpen) => {
    const token = ++openFocusToken
    paneFocusToken++
    if (isOpen && !wasOpen) {
      suppressRestoreOnJump = false
      const active = document.activeElement
      previouslyFocusedElement =
        active instanceof HTMLElement && active !== document.body ? active : null
      document.documentElement.style.overflow = 'hidden'
      await nextTick()
      if (!props.open || token !== openFocusToken) return
      if (isElementVisible(searchInputRef.value)) {
        searchInputRef.value.focus()
      } else if (isElementVisible(closeBtnRef.value)) {
        closeBtnRef.value.focus()
      } else {
        panelRef.value?.focus()
      }
    } else if (!isOpen && wasOpen) {
      const skipRestore = suppressRestoreOnJump
      suppressRestoreOnJump = false
      document.documentElement.style.overflow = ''
      if (skipRestore) {
        previouslyFocusedElement = null
        return
      }
      await nextTick()
      if (!props.open && token === openFocusToken) {
        restoreFocus()
      }
    }
  },
  { immediate: true }
)

watch(
  () => [props.open, props.initialCourseId, props.initialCategory] as const,
  ([isOpen, initId, initCat]) => {
    if (!isOpen) return
    paneFocusToken++
    if (initId) {
      drawerQuery.value = ''
      activeCategory.value = 'all'
      onlyWithBody.value = false
      selectedCourseId.value = initId
      unresolvedCourseId.value = hasCourseById(initId) ? '' : initId
      mobilePane.value = 'detail'
    } else {
      unresolvedCourseId.value = ''
      if (initCat) {
        activeCategory.value = initCat
      }
      mobilePane.value = 'list'
      ensureSelectionInFiltered()
    }
  },
  { immediate: true }
)

const detailTargetKey = computed(() => {
  if (!props.open) return ''
  if (unresolvedCourseId.value) return `unresolved:${unresolvedCourseId.value}`
  return selectedCourse.value?.id ? `course:${selectedCourse.value.id}` : ''
})

watch(
  detailTargetKey,
  (nextKey, prevKey) => {
    if (!nextKey || nextKey === prevKey) return
    if (detailRef.value) {
      detailRef.value.scrollTop = 0
    }
  },
  { flush: 'post' }
)

watch(
  () => props.courses,
  (list) => {
    if (!unresolvedCourseId.value) return
    if (list.some((c) => c.id === unresolvedCourseId.value)) {
      selectedCourseId.value = unresolvedCourseId.value
      unresolvedCourseId.value = ''
    }
  }
)

watch(filteredCourses, (list) => {
  if (unresolvedCourseId.value) return
  if (list.length > 0 && !list.some((c) => c.id === selectedCourseId.value)) {
    selectedCourseId.value = list[0].id
  }
})

const getFocusableElements = (): HTMLElement[] => {
  if (!panelRef.value) return []
  const selector =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  return Array.from(panelRef.value.querySelectorAll<HTMLElement>(selector)).filter(
    (el) => isElementVisible(el)
  )
}

const handleKeydown = (event: KeyboardEvent) => {
  if (!props.open) return
  if (event.key === 'Escape') {
    if (event.isComposing) return
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
  openFocusToken++
  paneFocusToken++
  suppressRestoreOnJump = false
  document.documentElement.style.overflow = ''
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.course_drawer_backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
  background-color: var(--surface-backdrop);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(0.6rem, 2vw, 1.5rem);
  box-sizing: border-box;
}

.course_drawer_panel {
  width: min(72rem, 96vw);
  max-width: 100%;
  height: min(48rem, 90vh);
  height: min(48rem, 90dvh);
  background-color: var(--surface-canvas);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--ink-primary);
  font-size: max(0.88rem, 14px);
  box-sizing: border-box;
}

.course_drawer_panel .drawer_detail:focus,
.course_drawer_panel .detail_title:focus {
  outline: none;
}

.course_drawer_panel button:focus-visible,
.course_drawer_panel input:focus-visible,
.course_drawer_panel a:focus-visible,
.course_drawer_panel .drawer_detail:focus-visible,
.course_drawer_panel .detail_title:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.drawer_header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.85rem 1.2rem;
  background-color: var(--surface-elevated);
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
  min-width: 0;
}

.drawer_title_group {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.6rem;
  min-width: 0;
  flex: 1;
}

.drawer_title {
  margin: 0;
  font-size: 1.15em;
  font-weight: 700;
  min-width: 0;
}

.drawer_subtitle {
  font-size: 0.9em;
  color: var(--ink-muted);
}

.drawer_close_btn {
  padding: 0.35em 0.85em;
  background-color: var(--surface-subtle);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-pill);
  cursor: pointer;
  font-size: 0.88em;
  font-weight: 500;
  color: var(--ink-primary);
  flex-shrink: 0;
  white-space: nowrap;
}

.drawer_close_btn:hover {
  background-color: var(--surface-hover);
  border-color: var(--border-strong);
}

.mobile_pane_switcher {
  display: none;
}

.mobile_pane_btn {
  flex: 1;
  min-width: 0;
  padding: 0.4em 0.7em;
  background-color: var(--surface-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  cursor: pointer;
  font-size: 0.9em;
  font-weight: 500;
  color: var(--ink-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile_pane_btn.active {
  background-color: var(--accent);
  border-color: var(--accent);
  color: var(--ink-inverse);
  font-weight: 600;
}

.mobile_pane_btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.drawer_toolbar {
  padding: 0.7rem 1.2rem;
  background-color: var(--surface-subtle);
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  flex-shrink: 0;
  min-width: 0;
}

.drawer_tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.drawer_tab_btn {
  padding: 0.3em 0.75em;
  background-color: var(--surface-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  cursor: pointer;
  font-size: 0.88em;
  font-weight: 500;
  color: var(--ink-secondary);
  transition: background-color 0.14s ease, border-color 0.14s ease, color 0.14s ease;
}

.drawer_tab_btn:hover {
  background-color: var(--surface-hover);
  color: var(--ink-primary);
}

.drawer_tab_btn.active {
  background-color: var(--accent);
  border-color: var(--accent);
  color: var(--ink-inverse);
  font-weight: 600;
}

.drawer_search_row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.55rem;
  min-width: 0;
}

.drawer_search_input {
  flex: 1 1 12em;
  min-width: 0;
  max-width: 100%;
  height: 2.2em;
  padding: 0 0.75em;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-pill);
  background-color: var(--surface-elevated);
  color: var(--ink-primary);
  font-size: 0.92em;
  box-sizing: border-box;
}

.drawer_clear_btn {
  height: 2.2em;
  padding: 0 0.8em;
  background-color: var(--surface-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-pill);
  cursor: pointer;
  font-size: 0.88em;
  color: var(--ink-secondary);
  flex-shrink: 0;
}

.drawer_checkbox {
  display: inline-flex;
  align-items: center;
  gap: 0.38em;
  font-size: 0.88em;
  color: var(--ink-secondary);
  cursor: pointer;
}

.drawer_checkbox input {
  accent-color: var(--accent);
}

.drawer_status_box {
  padding: 2rem 1rem;
  text-align: center;
  color: var(--ink-secondary);
}

.error_box {
  color: var(--status-danger-text);
}

.missing_course_hint {
  margin-top: 0.5em;
  font-size: 0.92em;
  color: var(--ink-muted);
}

.drawer_body {
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  display: grid;
  grid-template-columns: 21rem 1fr;
}

.drawer_list {
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  border-right: 1px solid var(--border-subtle);
  background-color: var(--surface-subtle);
}

.course_list_item {
  content-visibility: auto;
  contain-intrinsic-size: auto 92px;
  width: 100%;
  box-sizing: border-box;
  min-width: 0;
  text-align: left;
  padding: 0.75rem 0.9rem;
  border: none;
  border-bottom: 1px solid var(--border-subtle);
  border-left: 3px solid transparent;
  background-color: transparent;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  transition: background-color 0.14s ease;
}

.course_list_item:hover {
  background-color: var(--surface-hover);
}

.course_list_item.selected {
  background-color: var(--accent-soft);
  border-left-color: var(--accent);
}

.course_item_top {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.course_badge {
  display: inline-block;
  padding: 0.08em 0.48em;
  font-size: 0.8em;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-subtle);
  background-color: var(--surface-elevated);
  color: var(--ink-secondary);
  max-width: 100%;
  overflow-wrap: anywhere;
}

.series_badge {
  background-color: var(--status-draft-soft);
  border-color: var(--status-draft);
  color: var(--status-draft-text);
  font-weight: 700;
}

.node_badge {
  background-color: var(--accent-soft);
  border-color: var(--accent-border);
  color: var(--accent-text);
}

.body_badge {
  background-color: var(--status-verified-soft);
  border-color: var(--status-verified);
  color: var(--status-verified-text);
}

.status_badge {
  background-color: var(--surface-subtle);
}

.video_badge {
  background-color: var(--status-info-soft);
  border-color: var(--accent-border);
  color: var(--status-info-text);
}

.reading_badge {
  background-color: var(--axis-teleology-soft);
  border-color: var(--axis-teleology);
  color: var(--axis-teleology-text);
}

.course_item_title {
  font-size: 0.94em;
  font-weight: 600;
  line-height: 1.4;
  color: var(--ink-primary);
  overflow-wrap: anywhere;
}

.course_item_meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  font-size: 0.82em;
  color: var(--ink-muted);
  overflow-wrap: anywhere;
}

.drawer_detail {
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 1.1rem 1.3rem;
  background-color: var(--surface-canvas);
  display: flex;
  flex-direction: column;
  gap: 0.95rem;
}

.drawer_empty {
  padding: 2rem 1rem;
  text-align: center;
  color: var(--ink-muted);
  overflow-wrap: anywhere;
}

.drawer_empty.error_box {
  color: var(--status-danger-text);
}

.detail_header {
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  min-width: 0;
}

.detail_badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.detail_title {
  margin: 0;
  font-size: 1.15em;
  font-weight: 700;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.detail_links_row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem 0.9rem;
  font-size: 0.9em;
  color: var(--accent-text);
  overflow-wrap: anywhere;
}

.detail_links_row a {
  text-decoration: underline;
  text-underline-offset: 2px;
}

.detail_codes_row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
}

.codes_label {
  font-size: 0.9em;
  font-weight: 600;
  color: var(--ink-secondary);
}

.node_jump_btn {
  padding: 0.2em 0.65em;
  border-radius: var(--radius-pill);
  background-color: var(--accent-soft);
  border: 1px solid var(--accent-border);
  cursor: pointer;
  font-size: 0.86em;
  font-weight: 500;
  color: var(--accent-text);
}

.node_jump_btn:hover {
  background-color: var(--accent);
  border-color: var(--accent);
  color: var(--ink-inverse);
}

.node_code_tag {
  display: inline-block;
  padding: 0.2em 0.6em;
  border-radius: var(--radius-pill);
  background-color: var(--surface-subtle);
  border: 1px solid var(--border-subtle);
  font-size: 0.86em;
  color: var(--ink-secondary);
}

.retry_btn {
  margin-top: 0.6rem;
  padding: 0.35em 0.9em;
  border-radius: var(--radius-pill);
  background-color: var(--accent-soft);
  border: 1px solid var(--accent-border);
  cursor: pointer;
  font-size: 0.92em;
  font-weight: 500;
  color: var(--accent-text);
}

.retry_btn:hover {
  background-color: var(--accent);
  border-color: var(--accent);
  color: var(--ink-inverse);
}

.info_notice_banner {
  padding: 0.65em 0.85em;
  border-radius: var(--radius-md);
  background-color: var(--status-draft-soft);
  border: 1px solid var(--status-draft);
  color: var(--status-draft-text);
  font-size: 0.9em;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.detail_sections {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
}

.detail_section h4 {
  font-size: 1em;
  font-weight: 700;
  margin-bottom: 0.45rem;
  padding-bottom: 0.22rem;
  border-bottom: 1px dashed var(--border-subtle);
}

.summary_list,
.notes_list,
.readings_list {
  margin: 0;
  padding-left: 1.25em;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  overflow-wrap: anywhere;
}

.readings_list {
  list-style: none;
  padding-left: 0;
}

.summary_item {
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.summary_meta {
  margin-top: 0.25em;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 0.7rem;
  font-size: 0.84em;
  color: var(--ink-muted);
  overflow-wrap: anywhere;
}

.reading_card {
  padding: 0.65em 0.8em;
  border-radius: var(--radius-md);
  background-color: var(--surface-elevated);
  border: 1px solid var(--border-subtle);
  box-shadow: var(--shadow-xs);
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 0;
}

.reading_top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
}

.reading_source {
  font-weight: 600;
  font-size: 0.92em;
  overflow-wrap: anywhere;
}

.reading_locator,
.reading_scope {
  font-size: 0.86em;
  color: var(--ink-secondary);
  overflow-wrap: anywhere;
}

.reading_reason {
  line-height: 1.5;
  overflow-wrap: anywhere;
  color: var(--ink-secondary);
}

.detail_no_body {
  padding: 1rem;
  border-radius: var(--radius-md);
  background-color: var(--surface-elevated);
  border: 1px solid var(--border-subtle);
  color: var(--ink-secondary);
  line-height: 1.55;
  overflow-wrap: anywhere;
}

@media (max-width: 820px) {
  .course_drawer_backdrop {
    padding: 0;
  }

  .course_drawer_panel {
    width: 100%;
    height: 100%;
    max-height: 100vh;
    max-height: 100dvh;
    border-radius: 0;
    border: none;
  }

  .drawer_header {
    padding: 10px 12px;
    gap: 8px;
  }

  .drawer_subtitle {
    display: none;
  }

  .mobile_pane_switcher {
    display: flex;
    gap: 8px;
    padding: 8px 12px;
    background-color: var(--surface-subtle);
    border-bottom: 1px solid var(--border-subtle);
    flex-shrink: 0;
  }

  .drawer_toolbar {
    padding: 8px 12px;
    gap: 8px;
  }

  .drawer_search_input {
    flex-basis: 100%;
  }

  .drawer_body {
    display: flex;
    flex-direction: column;
  }

  .course_drawer_panel.mobile_pane_list .drawer_detail {
    display: none;
  }

  .course_drawer_panel.mobile_pane_list .drawer_list {
    flex: 1;
    min-height: 0;
    border-right: none;
  }

  .course_drawer_panel.mobile_pane_detail .drawer_toolbar,
  .course_drawer_panel.mobile_pane_detail .drawer_list {
    display: none;
  }

  .course_drawer_panel.mobile_pane_detail .drawer_detail {
    flex: 1;
    min-height: 0;
    padding: 12px;
  }
}
</style>
