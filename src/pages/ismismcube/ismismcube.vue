<template>
  <div id="ismismcube-container">
    <div id="left_part" :class="{ collapsed: isLeftPartClosed }">
      <div id="page_view" title="此网页的总访量">
        <img src="@/assets/page_view_icon.svg" alt="page_view">
        <b>{{ pageView == -1 ? '-' : pageView }}</b>
      </div>
      <div id="online_count" title="当前在线数">
        <p>在线:</p>
        <b>{{ onlineCount == -1 ? '-' : onlineCount }}</b>
      </div>
      <div id="ai_button" @click="goToAI">AI 对话</div>
      <div id="return_button" @click="openMoreContent">更多内容</div>
      <div id="download_button" @click="downloadIsmJson">下载文件</div>
      <input
        id="search_input"
        type="text"
        placeholder="键入检索词"
        v-model="searchInputText"
      >
      <div id="courses_button" @click="openCourseDrawer()">
        补充课程 / ${{ coursesList.length ? ` (${coursesList.length})` : '' }}
      </div>
      <div id="search_status_line">
        <template v-if="searchInputText !== ''">
          <span v-if="searchInputText !== searchText">检索中...</span>
          <span v-else>命中 {{ searchedCount }} 节点</span>
          <button type="button" class="clear_search_link" @click="clearSearch">清空</button>
        </template>
        <template v-else-if="enrichmentsData">
          <span>{{ Object.keys(enrichmentsData.nodes).length }} 节点已建索引</span>
        </template>
        <template v-else-if="enrichStatus === 'error'">
          <button type="button" class="clear_search_link" @click="loadEnrichments">索引重试</button>
        </template>
      </div>
      <div id="ismism_main_cube">
        <div id="show_cube">
          <template v-for="x in 4" :key="`show-${x}`">
            <div
              v-for="y in 4"
              :key="`${5-x}-${y}`"
              class="show_xy ism"
              :style="{ '--x': 5-x, '--y': y, '--a': x == 1 ? 1 : 0.5, '--b': y == 4 ? 1 : 0.5 }"
              :ism_tag="`${5-x}-${y}`"
              :class="getIsmClass(`${5-x}-${y}`)"
              @mouseenter="selectISM(`${5-x}-${y}`)"
              @mouseleave="unselectISM()"
              @click="pinISM(`${5-x}-${y}`)"
            ></div>
          </template>
        </div>
        <div id="show_cube_name">
          <template v-for="x in 4" :key="`show-name-${x}`">
            <div
              v-for="y in 4"
              :key="`show-name-${x}-${y}`"
              class="show_xy_name"
            >
              <p
                class="ism_name"
                :class="{ no_data: ismData && ismData[`${5-x}-${y}`] && !ismData[`${5-x}-${y}`].summary_status }"
                :style="{ fontSize: getIsmNameFontSize(getIsmName(`${5-x}-${y}`)) }">{{ getIsmName(`${5-x}-${y}`) }}
              </p>
            </div>
          </template>
        </div>
        <div
          v-for="x in 4"
          :key="`line-x-${x}`"
          class="line_x"
          :style="{ '--x': x }"
        >
          <p>{{ x }}</p>
        </div>
        <div
          v-for="y in 4"
          :key="`line-y-${y}`"
          class="line_y"
          :style="{ '--y': y }"
        >
          <p>{{ y }}</p>
        </div>
        <div id="show_cube_x">
          <div
            v-for="i in 4"
            :key="`${i}`"
            class="show_x ism"
            :ism_tag="`${5-i}`"
            :class="getIsmClass(`${5-i}`)"
            @mouseenter="selectISM(`${5-i}`)"
            @mouseleave="unselectISM()"
            @click="pinISM(`${5-i}`)"
          >
            <p
              class="ism_name"
              :class="{ no_data: ismData && ismData[`${5-i}`] && !ismData[`${5-i}`].summary_status }"
              :style="{ fontSize: getIsmNameFontSize(getIsmName(`${5-i}`)) }">{{ getIsmName(`${5-i}`) }}
            </p>
          </div>
        </div>
        <div id="axis_x"></div>
        <div id="axis_y"></div>
        <div id="axis_z"></div>
      </div>
      <div id="axis_label">
        <p id="axis_label_x">场域论</p>
        <p id="axis_label_y">本体论</p>
        <p id="axis_label_z">认识论</p>
        <p id="axis_label_i">目的论</p>
      </div>
      <div id="ism_info_wrapper">
        <div id="ism_info" :style="{ fontSize: `${ismInfoFontSize}rem` }">
          <div id="increase_fontsize_button" title="放大字体" @click="increaseFontSize"></div>
          <div id="decrease_fontsize_button" title="缩小字体" @click="decreaseFontSize"></div>
          <div id="ism_info_content">
            <div v-if="ismLoadError" class="info_error_box">{{ ismLoadError }}</div>
            <div v-else-if="!activeIsmTag || !activeIsmData" class="info_intro_box" v-html="introductionHtml"></div>
            <template v-else>
              <div class="node_header">
                <div class="node_coord_row">
                  <template v-for="(digit, idx) in activeTagDigits" :key="idx">
                    <span v-if="idx > 0" class="coord_dash">-</span>
                    <span class="coord_box" :style="{ color: axisColor[idx] }"><b>{{ digit }}</b></span>
                  </template>
                </div>

                <div class="node_status_banner">
                  <span class="status_pill" :class="summaryOriginClass">
                    {{ summaryOriginLabel }}
                  </span>
                  <span class="status_pill" :class="evidenceBannerClass">
                    {{ evidenceBannerText }}
                  </span>
                  <span class="status_pill pill_unverified">未核原音</span>
                </div>

                <div v-if="activeEnrichment?.summary_evidence" class="summary_evidence_line">
                  总论依据：{{ activeEnrichment.summary_evidence.level || 'transcript_secondary' }}
                  <span v-if="activeEnrichment.summary_evidence.coverage"> · 覆盖：{{ activeEnrichment.summary_evidence.coverage }}</span>
                  <span v-if="activeEnrichment.summary_evidence.batch_file"> · 批次：{{ activeEnrichment.summary_evidence.batch_file }}</span>
                </div>

                <div class="node_titles">
                  <div class="node_ch_name">
                    <HighlightText :text="activeIsmData.ch_name" :query="searchText" />
                  </div>
                  <div class="node_en_name">
                    <HighlightText :text="activeIsmData.en_name" :query="searchText" />
                  </div>
                </div>
              </div>

              <div class="info_tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  class="info_tab_btn"
                  :class="{ active: activeInfoTab === 'overview', has_hit: overviewHasSearchHit }"
                  @click="activeInfoTab = 'overview'"
                >
                  概览与四轴<span v-if="overviewHasSearchHit" class="hit_dot" title="当前搜索词命中此页">•</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  class="info_tab_btn"
                  :class="{ active: activeInfoTab === 'courses', has_hit: coursesHasSearchHit }"
                  @click="activeInfoTab = 'courses'"
                >
                  课程与讲稿 ({{ courseTabCount }})<span v-if="coursesHasSearchHit" class="hit_dot" title="当前搜索词命中此页">•</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  class="info_tab_btn"
                  :class="{ active: activeInfoTab === 'editorial', has_hit: editorialHasSearchHit }"
                  @click="activeInfoTab = 'editorial'"
                >
                  校勘与典籍 ({{ editorialTabCount }})<span v-if="editorialHasSearchHit" class="hit_dot" title="当前搜索词命中此页">•</span>
                </button>
              </div>

              <div v-show="activeInfoTab === 'overview'" class="tab_panel">
                <div class="axis_section">
                  <div v-for="(axisItem, idx) in parsedAxisList" :key="idx" class="axis_row">
                    <template v-if="!axisItem.fallback">
                      <b :style="{ color: axisItem.color }">{{ axisItem.axisLabel }}</b>
                      <span class="axis_digit_box"><b>{{ axisItem.digit }}</b></span>
                      <HighlightText :text="axisItem.rest" :query="searchText" />
                    </template>
                    <template v-else>
                      <HighlightText :text="axisItem.rest" :query="searchText" />
                    </template>
                    <div v-if="getAxisEvidence(idx)" class="axis_evidence_chip">
                      讲稿定位：{{ getAxisEvidence(idx)?.locator }}
                    </div>
                  </div>
                </div>

                <div v-if="nonEmptyFeatures.length > 0" class="feature_section">
                  <div v-for="(feat, idx) in nonEmptyFeatures" :key="idx" class="feature_row">
                    <b>{{ feat.slice(0, 1) }}</b><HighlightText :text="feat.slice(1)" :query="searchText" />
                  </div>
                </div>

                <div v-if="coreRelatedList.length > 0" class="core_related_section">
                  <div v-for="(rel, idx) in coreRelatedList" :key="idx" class="related_row">
                    <b v-if="rel.label">{{ rel.label }}：</b>
                    <a v-if="rel.url" :href="rel.url" target="_blank" rel="noopener noreferrer">
                      <HighlightText :text="rel.url" :query="searchText" />
                    </a>
                    <template v-else>
                      <HighlightText :text="rel.value" :query="searchText" />
                    </template>
                  </div>
                </div>
              </div>

              <div v-show="activeInfoTab === 'courses'" class="tab_panel">
                <div class="section_block">
                  <div class="section_title">关联视频课程（{{ activeLinkedCourses.length }}）</div>
                  <div v-if="coursesStatus === 'error' && activeLinkedCourses.length === 0" class="empty_hint error_hint">
                    <span>{{ coursesError || '补充课程目录加载失败。' }}</span>
                    <button type="button" class="retry_btn_inline" @click="loadCourses">重试</button>
                  </div>
                  <div v-else-if="coursesStatus === 'loading' && activeLinkedCourses.length === 0" class="empty_hint">
                    正在加载补充课程目录...
                  </div>
                  <div v-else-if="activeLinkedCourses.length === 0" class="empty_hint">
                    当前节点暂无额外课程目录条目，可点击下方按钮浏览全库与 $ 系列课程。
                  </div>
                  <div v-for="course in activeLinkedCourses" :key="course.id" class="info_card">
                    <div class="card_badges">
                      <span class="mini_badge kind">{{ getCourseKindLabel(course.kind) }}</span>
                      <span v-if="courseBodiesMap[course.body_ref || course.id]?.series_code" class="mini_badge series">
                        {{ courseBodiesMap[course.body_ref || course.id].series_code }}
                      </span>
                      <span class="mini_badge body_status">{{ getBodyStatusLabel(course.body_status) }}</span>
                      <span v-if="course.video_check?.duration_seconds" class="mini_badge">
                        {{ formatDuration(course.video_check.duration_seconds) }}
                      </span>
                      <span v-if="course.archival_published_date" class="mini_badge">
                        {{ course.archival_published_date }}
                      </span>
                    </div>
                    <div class="card_main_link">
                      <a :href="course.url" target="_blank" rel="noopener noreferrer">
                        <HighlightText :text="course.title" :query="searchText" />
                      </a>
                    </div>
                    <div class="card_actions">
                      <span class="bv_code"><HighlightText :text="course.id" :query="searchText" /></span>
                      <button
                        v-if="Boolean(course.body_ref || courseBodiesMap[course.body_ref || course.id])"
                        type="button"
                        class="mini_action_btn"
                        @click="openCourseDrawer(course.id)"
                      >
                        打开课程摘要
                      </button>
                    </div>
                  </div>
                </div>

                <div v-if="docLinksFromRelated.length > 0" class="section_block">
                  <div class="section_title">课程文档与板书文案</div>
                  <div v-for="(doc, idx) in docLinksFromRelated" :key="idx" class="info_card">
                    <b>{{ doc.label }}：</b>
                    <a v-if="doc.url" :href="doc.url" target="_blank" rel="noopener noreferrer">
                      <HighlightText :text="doc.url" :query="searchText" />
                    </a>
                    <span v-else><HighlightText :text="doc.value" :query="searchText" /></span>
                  </div>
                </div>

                <div class="section_block">
                  <div class="section_title">二手汇编讲稿入口（{{ activeEnrichment?.transcripts.length ?? 0 }}）</div>
                  <div v-if="!enrichmentsData && enrichStatus === 'error'" class="empty_hint error_hint">
                    <span>{{ enrichError || '讲稿索引加载失败。' }}</span>
                    <button type="button" class="retry_btn_inline" @click="loadEnrichments">重试</button>
                  </div>
                  <div v-else-if="!enrichmentsData" class="empty_hint">
                    正在加载讲稿索引...
                  </div>
                  <div v-else-if="!activeEnrichment || activeEnrichment.transcripts.length === 0" class="empty_hint">
                    暂无直接对应的二手汇编讲稿条目。
                  </div>
                  <div v-for="tr in activeEnrichment?.transcripts ?? []" :key="`${tr.row}-${tr.source_path}`" class="info_card">
                    <div class="card_badges">
                      <span class="mini_badge">序号 {{ tr.row }}</span>
                      <span v-if="tr.kind" class="mini_badge">{{ tr.kind === 'lecture' ? '正课讲稿' : tr.kind }}</span>
                      <span class="mini_badge warn_soft">第三方整理 · 未核原音</span>
                    </div>
                    <div class="card_main_link">
                      <a v-if="tr.url" :href="tr.url" target="_blank" rel="noopener noreferrer">
                        <HighlightText :text="tr.title" :query="searchText" />
                      </a>
                      <span v-else><HighlightText :text="tr.title" :query="searchText" /></span>
                    </div>
                    <div v-if="tr.source_path" class="muted_meta">{{ tr.source_path }}</div>
                  </div>
                </div>

                <div class="drawer_cta_wrap">
                  <button type="button" class="mini_action_btn" @click="openCourseDrawer(undefined, 'dollar_series')">
                    浏览完整补充课程与 $ 系列库 →
                  </button>
                </div>
              </div>

              <div v-show="activeInfoTab === 'editorial'" class="tab_panel">
                <div class="section_block">
                  <div class="section_title">
                    典籍与延展阅读（{{ activeEnrichment?.readings.length ?? fallbackReadingEntries.length }}）
                  </div>
                  <template v-if="activeEnrichment">
                    <div v-if="activeEnrichment.readings.length === 0" class="empty_hint">
                      当前节点暂未关联外部典籍条目。
                    </div>
                    <div v-for="(rd, idx) in activeEnrichment.readings" :key="`${rd.source_id}-${rd.relation}-${idx}`" class="info_card">
                      <div class="card_badges">
                        <span
                          class="mini_badge"
                          :class="rd.relation === 'lecture_explicit_reference' ? 'rel_explicit' : 'rel_editorial'"
                        >
                          {{ rd.relation === 'lecture_explicit_reference' ? '讲稿显式提及' : '编者延展对读' }}
                        </span>
                        <span v-if="rd.kind" class="mini_badge">{{ rd.kind }}</span>
                      </div>
                      <div class="card_main_link">
                        <a :href="rd.url" target="_blank" rel="noopener noreferrer">
                          <HighlightText :text="rd.title" :query="searchText" />
                        </a>
                      </div>
                      <div v-if="rd.locator" class="card_meta_line">
                        <b>定位：</b><HighlightText :text="rd.locator" :query="searchText" />
                      </div>
                      <div v-if="rd.reason" class="card_meta_line">
                        <b>说明：</b><HighlightText :text="rd.reason" :query="searchText" />
                      </div>
                      <div v-if="rd.verification_scope" class="muted_meta">
                        核对边界：{{ rd.verification_scope }}
                      </div>
                    </div>
                  </template>
                  <template v-else>
                    <div v-for="(rd, idx) in fallbackReadingEntries" :key="idx" class="info_card">
                      <b>{{ rd.label }}：</b>
                      <a v-if="rd.url" :href="rd.url" target="_blank" rel="noopener noreferrer">
                        <HighlightText :text="rd.url" :query="searchText" />
                      </a>
                      <span v-else><HighlightText :text="rd.value" :query="searchText" /></span>
                    </div>
                  </template>
                </div>

                <div class="section_block">
                  <div class="section_title">逐项校勘与修订记录</div>
                  <template v-if="activeEnrichment?.review_summary">
                    <div class="review_stats_bar">
                      <span>总核查 {{ activeEnrichment.review_summary.total_checks }} 项</span>
                      <span>按原文确认 {{ activeEnrichment.review_summary.by_resolution_state?.confirmed_as_written ?? 0 }}</span>
                      <span>已入库修订 {{ activeEnrichment.review_summary.resolved_in_catalogue_count }}</span>
                      <span>已记限定边界 {{ activeEnrichment.review_summary.by_resolution_state?.qualified_in_research_record ?? 0 }}</span>
                    </div>
                    <div v-if="activeEnrichment.review_summary.highlights.length === 0" class="empty_hint">
                      本节点各字段均按讲稿原文确认，暂无需要额外提醒的限定或修订。
                    </div>
                    <div
                      v-for="(hl, idx) in activeEnrichment.review_summary.highlights"
                      :key="idx"
                      class="info_card"
                    >
                      <div class="card_badges">
                        <span class="mini_badge field_badge">{{ formatFieldPath(hl.field_path) }}</span>
                        <span class="mini_badge canonical_badge">
                          {{ CANONICAL_STATUS_LABELS[hl.canonical_status] || hl.canonical_status }}
                        </span>
                        <span
                          class="mini_badge"
                          :class="hl.resolution_state === 'resolved_in_catalogue' ? 'res_resolved' : 'res_qualified'"
                        >
                          {{ RESOLUTION_STATE_LABELS[hl.resolution_state] || hl.resolution_state }}
                        </span>
                        <span v-for="b in hl.resolved_by_batches ?? []" :key="b" class="mini_badge">{{ b }}</span>
                      </div>
                      <div v-if="hl.locator" class="card_meta_line">
                        <b>位置：</b><HighlightText :text="hl.locator" :query="searchText" />
                      </div>
                      <div v-if="hl.finding" class="card_meta_line">
                        <b>校勘结论：</b><HighlightText :text="hl.finding" :query="searchText" />
                      </div>
                    </div>
                  </template>
                  <div v-else-if="!enrichmentsData && enrichStatus === 'error'" class="empty_hint error_hint">
                    <span>{{ enrichError || '校勘记录加载失败。' }}</span>
                    <button type="button" class="retry_btn_inline" @click="loadEnrichments">重试</button>
                  </div>
                  <div v-else-if="!enrichmentsData" class="empty_hint">
                    正在加载校勘记录...
                  </div>
                  <div v-else class="empty_hint">
                    该节点属于未逐字单条拆分复核分批（如 4 字头或总览节点），可结合上方总论依据与下方校勘注阅读。
                  </div>
                </div>

                <div
                  v-if="(activeEnrichment?.editorial_notes.length ?? fallbackEditorialEntries.length) > 0"
                  class="section_block"
                >
                  <div class="section_title">编者校勘注与边界提示</div>
                  <ul class="editorial_list">
                    <template v-if="activeEnrichment">
                      <li v-for="(note, idx) in activeEnrichment.editorial_notes" :key="idx">
                        <HighlightText :text="note" :query="searchText" />
                      </li>
                    </template>
                    <template v-else>
                      <li v-for="(ed, idx) in fallbackEditorialEntries" :key="idx">
                        <b>{{ ed.label }}：</b><HighlightText :text="ed.value" :query="searchText" />
                      </li>
                    </template>
                  </ul>
                </div>

                <div v-if="activeEnrichment" class="section_block">
                  <div class="section_title">
                    实质待核问题（{{ activeEnrichment.substantive_open_questions.length }}）
                  </div>
                  <ul v-if="activeEnrichment.substantive_open_questions.length > 0" class="editorial_list">
                    <li v-for="(oq, idx) in activeEnrichment.substantive_open_questions" :key="idx">
                      <HighlightText :text="oq" :query="searchText" />
                    </li>
                  </ul>
                  <div v-else class="empty_hint">
                    当前无额外实质未定位问题。
                  </div>
                  <div v-if="activeEnrichment.boilerplate_open_questions_count > 0" class="muted_meta">
                    说明：已自动归并“原音未人工听校 / 缺视频时间码”等模板化通用声明 {{ activeEnrichment.boilerplate_open_questions_count }} 条。
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
        <div id="ism_info_overlay"></div>
      </div>
      <div id="size_adjuster">
        <div
          id="size_indicator"
          @mousedown="setIndicatorActive"
          :style="{ top: sizeIndicatorRatio * 100 + '%' }"
        >
        </div>
      </div>
    </div>

    <div id="right_part" :class="{ widened: isLeftPartClosed }">
      <div id="right_part_scroll">
        <div id="ismism_cube_box" :style="{ transform: `scale(${1 + sizeIndicatorRatio * 1.5})` }">
          <div
            v-for="x in 4"
            :key="`${x}`"
            class="ism_x"
            :style="{ '--x': 4-x }"
          >
            <div
              v-for="y in 4"
              :key="`${x}-${y}`"
              class="ism_xy"
            >
              <div id="i"></div>
              <div id="z"></div>
              <div
                v-for="z in 4"
                :key="`${x}-${y}-${z}`"
                class="ism_xyz ism"
                :style="{ '--z': z }"
                :ism_tag="`${x}-${y}-${5-z}`"
                :class="getIsmClass(`${x}-${y}-${5-z}`)"
                @mouseover="selectISM(`${x}-${y}-${5-z}`)"
                @mouseout="unselectISM()"
                @click="pinISM(`${x}-${y}-${5-z}`)"
              >
                <p
                  class="ism_name"
                  :class="{ no_data: ismData && ismData[`${x}-${y}-${5-z}`] && !ismData[`${x}-${y}-${5-z}`].summary_status }"
                  :style="{ fontSize: getIsmNameFontSize(getIsmName(`${x}-${y}-${5-z}`)) }">{{ getIsmName(`${x}-${y}-${5-z}`) }}
                </p>
                <div id="ism_xyz_label_column">{{ 5-z }}</div>
                <div
                  v-for="i in 4"
                  :key="`${x}-${y}-${5-z}-${i}`"
                  class="ism_xyzi ism"
                  :style="{ '--i': i }"
                  :ism_tag="`${x}-${y}-${5-z}-${5-i}`"
                  :class="getIsmClass(`${x}-${y}-${5-z}-${5-i}`)"
                  @mouseover.stop="selectISM(`${x}-${y}-${5-z}-${5-i}`)"
                  @mouseout.stop="unselectISM()"
                  @click.stop="pinISM(`${x}-${y}-${5-z}-${5-i}`)"
                >
                  <p
                    class="ism_name"
                    :class="{ no_data: ismData && ismData[`${x}-${y}-${5-z}-${5-i}`] && !ismData[`${x}-${y}-${5-z}-${5-i}`].summary_status }"
                    :style="{ fontSize: getIsmNameFontSize(getIsmName(`${x}-${y}-${5-z}-${5-i}`)) }">{{ getIsmName(`${x}-${y}-${5-z}-${5-i}`) }}
                  </p>
                  <div id="ism_xyz_label_row">{{ 5-i }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div id="danmu_overlay" ref="danmuOverlayRef">
          <div
            v-for="danmu in activeDanmus"
            :key="danmu.id"
            class="danmu_fly"
            :class="{ disabled: !danmuEnabled }"
            :style="{
              top: danmu.top + 'px',
              animationDuration: danmu.duration + 's'
            }"
            @animationend="removeDanmu(danmu.id)"
          >
            {{ danmu.text }}
          </div>
        </div>
      </div>
      <div id="danmu_button_container" :class="{ disabled: !danmuEnabled }">
        <div id="danmu_toggle_button"
          @click="toggleDanmu"
        >
          {{ danmuEnabled ? '关闭弹幕' : '开启弹幕' }}
        </div>
        <input id="danmu_input"
          type="text"
          placeholder="发送弹幕"
          v-model="danmuText"
          :disabled="!danmuEnabled"
          :class="{ disabled: !danmuEnabled }"
          @keydown.enter="sendDanmu"
        >
      </div>
    </div>

    <CourseDrawer
      :open="courseDrawerOpen"
      :courses="coursesList"
      :course-bodies="courseBodiesMap"
      :courses-status="coursesStatus"
      :courses-error="coursesError"
      :bodies-status="bodiesStatus"
      :bodies-error="bodiesError"
      :can-jump="canJumpToNode"
      :initial-course-id="drawerInitialCourseId"
      :initial-category="drawerInitialCategory"
      @close="closeCourseDrawer"
      @jump-to-node="jumpToNode"
      @retry-courses="loadCourses"
      @retry-bodies="loadCourseBodies"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { buildStaticUrl } from '../../config/static.ts'
import { buildApiUrl } from '../../config/api.ts'
import HighlightText from '../../components/HighlightText.vue'
import CourseDrawer from '../../components/CourseDrawer.vue'
import type {
  CourseBodiesMap,
  CourseRecord,
  CoursesPayload,
  CubeEnrichmentsPayload,
  IsmNodeEntry,
  NodeAxisEvidence,
  NodeEnrichment
} from '../../types/research'
import {
  BODY_STATUS_LABELS,
  CANONICAL_STATUS_LABELS,
  COURSE_KIND_LABELS,
  RESOLUTION_STATE_LABELS,
  SUMMARY_ORIGIN_LABELS,
  formatDuration,
  formatFieldPath,
  matchesCoursesContent,
  matchesEditorialContent,
  matchesOverviewContent,
  nodeMatchesQuery,
  parseAxisEntry,
  parseRelatedEntry,
  type ParsedRelatedEntry
} from '../../utils/ismFormat'

type InfoTabKey = 'overview' | 'courses' | 'editorial'
type DrawerCategoryKey = 'dollar_series' | 'study' | 'special' | 'all'
type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

const buildIsmismcubeStaticUrl = (path: string): string => {
  return buildStaticUrl(`/ismismcube${path.startsWith('/') ? '' : '/'}${path}`)
}

const buildIsmismcubeApiUrl = (path: string): string => {
  return buildApiUrl(`/ismismcube${path.startsWith('/') ? '' : '/'}${path}`)
}

// 响应式数据
const ismData = ref<Record<string, any> | null>(null)
const ismLoadError = ref('')
const enrichmentsData = ref<CubeEnrichmentsPayload | null>(null)
const enrichStatus = ref<LoadStatus>('idle')
const enrichError = ref('')
const coursesList = ref<CourseRecord[]>([])
const coursesStatus = ref<LoadStatus>('idle')
const coursesError = ref('')
const courseBodiesMap = ref<CourseBodiesMap>({})
const bodiesStatus = ref<LoadStatus>('idle')
const bodiesError = ref('')

const axisColor = ["red", "green", "blue", "darkorange"]
const ismInfoFontSize = ref(1.0)
const pageView = ref(-1)
const onlineCount = ref(-1)
const searchInputText = ref('')
const searchText = ref('')
const sizeIndicatorRatio = ref(0)
const isLeftPartClosed = ref(false)
const hoveredIsmTag = ref<string | null>(null)
const activeInfoTab = ref<InfoTabKey>('overview')

const courseDrawerOpen = ref(false)
const drawerInitialCourseId = ref<string | undefined>(undefined)
const drawerInitialCategory = ref<DrawerCategoryKey>('dollar_series')

const danmuText = ref('')
const danmuEnabled = ref<boolean>(false)
const danmuOverlayRef = ref<HTMLElement | null>(null)
type DanmuItem = {
  id: number
  text: string
  top: number
  duration: number
}
const activeDanmus = ref<DanmuItem[]>([])

// WebSocket连接
let socket: WebSocket | null = null
let reconnectTimer: number | null = null

// 路由
const route = useRoute()
const router = useRouter()

const courseByIdMap = computed<Record<string, CourseRecord>>(() => {
  const map: Record<string, CourseRecord> = {}
  for (const c of coursesList.value) {
    map[c.id] = c
  }
  return map
})

const getIsmNode = (tag: string): IsmNodeEntry | null => {
  if (!tag || tag === 'introduction' || !ismData.value) return null
  const entry = ismData.value[tag]
  if (!entry || Array.isArray(entry)) return null
  return entry as IsmNodeEntry
}

const activeIsmTag = computed<string>(() => {
  if (hoveredIsmTag.value) return hoveredIsmTag.value
  const param = route.params.ismTag
  return typeof param === 'string' ? param : ''
})

const activeIsmData = computed<IsmNodeEntry | null>(() => {
  return activeIsmTag.value ? getIsmNode(activeIsmTag.value) : null
})

const activeEnrichment = computed<NodeEnrichment | null>(() => {
  if (!activeIsmTag.value || !enrichmentsData.value) return null
  return enrichmentsData.value.nodes[activeIsmTag.value] ?? null
})

const activeTagDigits = computed<string[]>(() => {
  return activeIsmTag.value ? activeIsmTag.value.split('-') : []
})

const parsedAxisList = computed(() => {
  const list = activeIsmData.value?.axis_list ?? []
  return list.map((entry, idx) => parseAxisEntry(entry, idx))
})

const nonEmptyFeatures = computed(() => {
  return (activeIsmData.value?.feature_list ?? []).filter((item) => item !== '')
})

const allParsedRelatedList = computed<ParsedRelatedEntry[]>(() => {
  return (activeIsmData.value?.related_list ?? [])
    .filter((item) => item !== '')
    .map(parseRelatedEntry)
})

const coreRelatedList = computed<ParsedRelatedEntry[]>(() => {
  if (!activeEnrichment.value) {
    return allParsedRelatedList.value
  }
  return allParsedRelatedList.value.filter((item) => item.category === 'core')
})

const docLinksFromRelated = computed<ParsedRelatedEntry[]>(() => {
  return allParsedRelatedList.value.filter((item) => item.label.includes('文案'))
})

const fallbackReadingEntries = computed<ParsedRelatedEntry[]>(() => {
  return allParsedRelatedList.value.filter((item) => item.category === 'reading')
})

const fallbackEditorialEntries = computed<ParsedRelatedEntry[]>(() => {
  return allParsedRelatedList.value.filter((item) => item.category === 'editorial')
})

const coursesByCodeMap = computed<Record<string, CourseRecord[]>>(() => {
  const map: Record<string, CourseRecord[]> = {}
  const append = (code: string | null | undefined, course: CourseRecord) => {
    if (!code) return
    if (!map[code]) {
      map[code] = []
    }
    if (!map[code].some((item) => item.id === course.id)) {
      map[code].push(course)
    }
  }
  for (const c of coursesList.value) {
    append(c.catalogue_code, c)
    for (const relCode of c.related_codes) {
      append(relCode, c)
    }
  }
  return map
})

const getLinkedCoursesForTag = (tag: string): CourseRecord[] => {
  if (!tag) return []
  const seen = new Set<string>()
  const result: CourseRecord[] = []
  const addCourse = (c: CourseRecord | undefined) => {
    if (!c || seen.has(c.id)) return
    seen.add(c.id)
    result.push(c)
  }
  const enrich = enrichmentsData.value?.nodes[tag]
  for (const cid of enrich?.related_course_ids ?? []) {
    addCourse(courseByIdMap.value[cid])
  }
  for (const c of coursesByCodeMap.value[tag] ?? []) {
    addCourse(c)
  }
  return result
}

const activeLinkedCourses = computed<CourseRecord[]>(() => {
  return getLinkedCoursesForTag(activeIsmTag.value)
})

const courseTabCount = computed(() => {
  return activeLinkedCourses.value.length + (activeEnrichment.value?.transcripts.length ?? 0)
})

const editorialTabCount = computed(() => {
  if (!activeEnrichment.value) {
    return fallbackReadingEntries.value.length + fallbackEditorialEntries.value.length
  }
  return (
    activeEnrichment.value.readings.length +
    (activeEnrichment.value.review_summary?.highlights.length ?? 0) +
    activeEnrichment.value.substantive_open_questions.length
  )
})

const summaryOriginKey = computed(() => {
  if (activeEnrichment.value?.summary_origin) {
    return activeEnrichment.value.summary_origin
  }
  return activeIsmData.value?.summary_status === 'manual' ? 'upstream_manual' : 'upstream_ai'
})

const summaryOriginLabel = computed(() => {
  if (!activeEnrichment.value) {
    return activeIsmData.value?.summary_status === 'manual' ? '原站手工条目' : 'AI 汇总条目'
  }
  return SUMMARY_ORIGIN_LABELS[summaryOriginKey.value] ?? summaryOriginKey.value
})

const summaryOriginClass = computed(() => {
  if (summaryOriginKey.value === 'upstream_manual') return 'pill_manual'
  if (summaryOriginKey.value === 'upstream_ai') return 'pill_ai_warn'
  return 'pill_ai'
})

const evidenceBannerText = computed(() => {
  if (!activeEnrichment.value) {
    if (enrichStatus.value === 'error') {
      return '讲稿与校勘索引加载失败'
    }
    return activeIsmData.value?.summary_status === 'ai'
      ? '待载入讲稿核校明细（未核原音）'
      : '讲稿核校明细加载中'
  }
  const rs = activeEnrichment.value.review_summary
  if (rs) {
    const resolved = rs.resolved_in_catalogue_count
    const qualified = rs.by_resolution_state?.qualified_in_research_record ?? 0
    if (resolved === 0 && qualified === 0) {
      return `二手讲稿已逐项比对（${rs.total_checks} 项按讲稿确认）`
    }
    const parts: string[] = ['二手讲稿已逐项比对']
    if (resolved > 0) parts.push(`已入库修订 ${resolved}`)
    if (qualified > 0) parts.push(`已记限定边界 ${qualified}`)
    return parts.join(' · ')
  }
  if (activeEnrichment.value.summary_evidence) {
    return '已采录二手讲稿总论（未做逐项拆条复核）'
  }
  return 'AI初始汇总（尚待逐项讲稿复核）'
})

const evidenceBannerClass = computed(() => {
  if (!activeEnrichment.value) {
    return enrichStatus.value === 'error' ? 'pill_pending' : 'pill_neutral'
  }
  if (activeEnrichment.value.review_summary) return 'pill_reviewed'
  if (activeEnrichment.value.summary_evidence) return 'pill_partial'
  return 'pill_pending'
})

const getAxisEvidence = (axisIndex: number): NodeAxisEvidence | undefined => {
  return activeEnrichment.value?.axis_evidence.find((ev) => ev.axis_index === axisIndex)
}

const getCourseKindLabel = (kind: string): string => {
  return COURSE_KIND_LABELS[kind] ?? kind
}

const getBodyStatusLabel = (status?: string): string => {
  if (!status) return '仅目录元数据（未核正文）'
  return BODY_STATUS_LABELS[status] ?? status
}

const introductionHtml = computed(() => {
  if (!ismData.value || !Array.isArray(ismData.value.introduction)) return ''
  let html = `<div style='line-height: 1.4;'>`
  for (const seg of ismData.value.introduction) {
    html += seg
  }
  html += `\n<HR><p style='text-align:center'><a href='https://beian.miit.gov.cn/' target='_blank' style='font-style:normal;text-decoration:none'>京ICP备2024067574号-1</a>\n<a href='https://beian.mps.gov.cn/#/query/webSearch?code=11010802044945' target='_blank' style='font-style:normal;text-decoration:none'>京公网安备11010802044945</a><p>`
  html += `</div>`
  return html
})

// 搜索匹配预计算（防抖后统一遍历 1 次，复用与详情页签完全一致的匹配函数）
const searchedTags = computed<Set<string>>(() => {
  const q = searchText.value
  const matched = new Set<string>()
  if (!q || !ismData.value) return matched
  const enrichNodes = enrichmentsData.value?.nodes ?? {}
  for (const key of Object.keys(ismData.value)) {
    if (key === 'introduction') continue
    const node = getIsmNode(key)
    if (!node) continue
    const enrich = enrichNodes[key] ?? null
    const linked = getLinkedCoursesForTag(key)
    if (nodeMatchesQuery(node, enrich, linked, q)) {
      matched.add(key)
    }
  }
  return matched
})

const searchedCount = computed(() => {
  return searchedTags.value.size
})

const overviewHasSearchHit = computed(() => {
  return matchesOverviewContent(activeIsmData.value, activeEnrichment.value, searchText.value)
})

const coursesHasSearchHit = computed(() => {
  return matchesCoursesContent(
    activeIsmData.value,
    activeLinkedCourses.value,
    activeEnrichment.value,
    searchText.value
  )
})

const editorialHasSearchHit = computed(() => {
  return matchesEditorialContent(activeIsmData.value, activeEnrichment.value, searchText.value)
})

// WebSocket连接管理
const connectWebSocket = () => {
  try {
    // 根据当前页面协议自动选择 WebSocket 协议
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}${buildIsmismcubeApiUrl('/online')}`
    socket = new WebSocket(wsUrl)
    socket.addEventListener("open", () => {
      console.log("WebSocket连接成功")
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
    })
    socket.addEventListener("message", (event) => {
      const message = event.data as string
      if (message.startsWith('broadcast')) {
        try {
          const data = JSON.parse(message.substring(message.indexOf('{')))
          if (data.online !== undefined) {
            onlineCount.value = data.online
          }
        } catch (error) {
          console.error("WebSocket JSON解析失败:", message, error)
        }
      }
      else if (message.startsWith("danmu")) {
        try {
          const data = JSON.parse(message.substring(message.indexOf('{')))
          if (data.content !== undefined) {
            spawnDanmu(String(data.content))
          }
        } catch (error) {
          console.error("弹幕消息解析失败:", message, error)
        }
      } else {
        console.error("WebSocket消息解析失败:", message)
      }
    })
    socket.addEventListener("error", (error) => {
      console.error("WebSocket连接错误:", error)
    })
    socket.addEventListener("close", (event) => {
      console.log("WebSocket连接关闭:", event.code, event.reason)
      if (event.code !== 1000) {
        reconnectTimer = window.setTimeout(() => {
          connectWebSocket()
        }, 3000)
      }
    })
  } catch (error) {
    console.error("WebSocket连接失败:", error)
    reconnectTimer = window.setTimeout(() => {
      connectWebSocket()
    }, 3000)
  }
}

const disconnectWebSocket = () => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  if (socket) {
    console.log('关闭WebSocket连接')
    // 移除所有事件监听器，防止触发重连
    socket.onopen = null
    socket.onmessage = null
    socket.onerror = null
    socket.onclose = null
    socket.close(1000, "页面卸载")
    socket = null
  }
}

// 计算属性
const getIsmClass = (ismTag: string) => {
  const classes = []
  const currentIsmTag = route.params.ismTag as string
  if (currentIsmTag && ismTag.startsWith(currentIsmTag)) {
    classes.push('pinned')
  }
  if (searchedTags.value.has(ismTag)) {
    classes.push('searched')
  }
  return classes
}

const getIsmName = (ismTag: string) => {
  if (!ismData.value || !ismData.value[ismTag]) return ''
  const name = ismData.value[ismTag].ch_name.split('/')[0].replace(/[“”"]/g, '')
  return name
}

const getIsmNameFontSize = (text: string) => {
  return text.length > 4 ? '0.75rem' : '1rem'
}

const loadEnrichments = async () => {
  if (enrichStatus.value === 'loading') return
  enrichStatus.value = 'loading'
  enrichError.value = ''
  try {
    const res = await fetch(buildIsmismcubeStaticUrl('/cube-enrichments.json'))
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    enrichmentsData.value = await res.json() as CubeEnrichmentsPayload
    enrichStatus.value = 'ready'
  } catch (error) {
    console.error('Failed to load cube-enrichments.json:', error)
    enrichStatus.value = 'error'
    enrichError.value = '讲稿与校勘索引加载失败，请重试。'
  }
}

const loadCourses = async () => {
  if (coursesStatus.value === 'loading') return
  coursesStatus.value = 'loading'
  coursesError.value = ''
  try {
    const res = await fetch(buildIsmismcubeStaticUrl('/courses.json'))
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    const payload = await res.json() as CoursesPayload
    coursesList.value = payload.courses ?? []
    coursesStatus.value = 'ready'
  } catch (error) {
    console.error('Failed to load courses.json:', error)
    coursesStatus.value = 'error'
    coursesError.value = '补充课程目录加载失败，请稍后重试。'
  }
}

const loadCourseBodies = async () => {
  if (bodiesStatus.value === 'loading' || bodiesStatus.value === 'ready') return
  bodiesStatus.value = 'loading'
  bodiesError.value = ''
  try {
    const res = await fetch(buildIsmismcubeStaticUrl('/course-bodies.json'))
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    courseBodiesMap.value = await res.json() as CourseBodiesMap
    bodiesStatus.value = 'ready'
  } catch (error) {
    console.error('Failed to load course-bodies.json:', error)
    bodiesStatus.value = 'error'
    bodiesError.value = '课程摘要正文加载失败，请重试。'
  }
}

// 总初始化
const initial = async () => {
  try {
    const response = await fetch(buildIsmismcubeStaticUrl('/ism.json'))
    if (response.ok) {
      ismData.value = await response.json()
      handleRoute()
      void Promise.allSettled([loadEnrichments(), loadCourses()])
    } else {
      ismLoadError.value = "数据加载失败\n\n请检测网络后重试\n或\n强制重新加载此页面(windows快捷键 Ctrl + F5)"
    }
  } catch (error) {
    console.error('Failed to load ism.json:', error)
    ismLoadError.value = "数据加载失败\n\n请检测网络后重试\n或\n强制重新加载此页面(windows快捷键 Ctrl + F5)"
  }

  let shouldConnectWs = true
  try {
    // POST 记录本次访问，并返回包含本次访问后的总数（保持原先每次加载计一次访问的行为）
    const response = await fetch(buildIsmismcubeApiUrl('/page_view'), { method: 'POST' })
    if (response.ok) {
      const data = await response.json()
      if (typeof data.page_view === 'number') {
        pageView.value = data.page_view
      }
      if (data.offline === true) {
        shouldConnectWs = false
      }
    }
  } catch (error) {
    console.error('Failed to load page view:', error)
  }

  if (shouldConnectWs) {
    connectWebSocket()
  }
}

const handleRoute = () => {
  const ismTag = route.params.ismTag as string
  if (!ismTag || ismTag === '') {
    document.title = "主义主义魔方"
  } else if (ismData.value && ismData.value[ismTag]) {
    document.title = "主义主义魔方-" + ismData.value[ismTag].ch_name
  }
}

const selectISM = (ismTag: string) => {
  hoveredIsmTag.value = ismTag
  const ismNodes = document.querySelectorAll('.ism')
  for (const ismNode of ismNodes) {
    const nodeIsmTag = ismNode.getAttribute('ism_tag')
    if (nodeIsmTag && nodeIsmTag.startsWith(ismTag)) {
      ismNode.classList.add('selected')
    }
  }
}

const unselectISM = () => {
  hoveredIsmTag.value = null
  const ismNodes = document.querySelectorAll('.ism')
  for (const ismNode of ismNodes) {
    ismNode.classList.remove('selected')
  }
  handleRoute()
}

const pinISM = (ismTag: string) => {
  const currentIsmTag = route.params.ismTag as string
  if (currentIsmTag === ismTag) {
    router.push('/')
  } else {
    router.push('/' + ismTag)
  }
}

const openCourseDrawer = (courseId?: string, category: DrawerCategoryKey = 'dollar_series') => {
  drawerInitialCourseId.value = courseId
  drawerInitialCategory.value = category
  courseDrawerOpen.value = true
  if (coursesStatus.value === 'idle' || coursesStatus.value === 'error') {
    void loadCourses()
  }
  if (bodiesStatus.value === 'idle' || bodiesStatus.value === 'error') {
    void loadCourseBodies()
  }
}

const closeCourseDrawer = () => {
  courseDrawerOpen.value = false
  drawerInitialCourseId.value = undefined
}

const canJumpToNode = (code: string): boolean => {
  return Boolean(getIsmNode(code))
}

const jumpToNode = (code: string) => {
  if (!getIsmNode(code)) return
  hoveredIsmTag.value = null
  activeInfoTab.value = 'overview'
  closeCourseDrawer()
  router.push('/' + code)
}

const increaseFontSize = () => {
  ismInfoFontSize.value = Math.min(1.8, Math.round((ismInfoFontSize.value + 0.1) * 10) / 10)
}

const decreaseFontSize = () => {
  ismInfoFontSize.value = Math.max(0.7, Math.round((ismInfoFontSize.value - 0.1) * 10) / 10)
}

const openMoreContent = () => {
  window.open("https://www.maybered.com", "_blank")
}

const downloadIsmJson = () => {
  try {
    if (!ismData.value) {
      alert("数据加载失败，请检查网络后重试")
      return
    }
    const jsonString = JSON.stringify(ismData.value, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'ism.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Error downloading ism.json:', error)
    alert("下载失败，请重试")
  }
}

const goToAI = () => {
  router.push('/ai')
}

const setIndicatorActive = () => {
  document.body.style.userSelect = "none"
  document.body.style.pointerEvents = "none"
  document.documentElement.style.cursor = "pointer"
  document.getElementById('size_indicator')!.style.pointerEvents = "auto"
  document.getElementById('size_indicator')!.style.backgroundColor = "gray"
  window.addEventListener("mouseup", setOverview)
  window.addEventListener("mousemove", changeSize)
  window.addEventListener("mouseup", closeIndicator)
}

const setOverview = () => {
  document.body.style.userSelect = ""
  document.body.style.pointerEvents = ""
  document.documentElement.style.cursor = ""
  document.getElementById('size_indicator')!.style.backgroundColor = ""
  window.removeEventListener("mouseup", setOverview)
  window.removeEventListener("mousemove", changeSize)
  window.removeEventListener("mouseup", closeIndicator)
  isLeftPartClosed.value = !isLeftPartClosed.value
}

const changeSize = (event: MouseEvent) => {
  window.removeEventListener("mouseup", setOverview)
  const max = document.getElementById('size_adjuster')!.offsetHeight
  sizeIndicatorRatio.value += event.movementY / max
  if (sizeIndicatorRatio.value < 0) sizeIndicatorRatio.value = 0
  else if (sizeIndicatorRatio.value > 1) sizeIndicatorRatio.value = 1
}

const closeIndicator = () => {
  document.body.style.userSelect = ""
  document.body.style.pointerEvents = ""
  document.documentElement.style.cursor = ""
  document.getElementById('size_indicator')!.style.backgroundColor = ""
  window.removeEventListener("mouseup", setOverview)
  window.removeEventListener("mousemove", changeSize)
  window.removeEventListener("mouseup", closeIndicator)
}

const removeDanmu = (id: number) => {
  activeDanmus.value = activeDanmus.value.filter(danmu => danmu.id !== id)
}

const spawnDanmu = (text: string) => {
  const trimmed = text.trim()
  if (trimmed === '') return
  if (!danmuOverlayRef.value) return
  const containerHeight = danmuOverlayRef.value.clientHeight
  const danmuHeight = 40
  const deadZoneHeight = 20
  const maxTop = Math.max(containerHeight - danmuHeight - deadZoneHeight, 0) || 1
  const top = deadZoneHeight + Math.random() * maxTop
  const duration = 6 + Math.random() * 2
  const id = Date.now() + Math.random()
  const danmuItem: DanmuItem = {
    id,
    text: trimmed,
    top,
    duration
  }
  activeDanmus.value = [...activeDanmus.value, danmuItem]
}

const toggleDanmu = () => {
  danmuEnabled.value = !danmuEnabled.value
}

const sendDanmu = async () => {
  if (!danmuEnabled.value) return
  const contentText = danmuText.value.trim()
  if (contentText === '') {
    alert('请输入弹幕内容')
    return
  }
  try {
    const response = await fetch(buildIsmismcubeApiUrl('/send_danmu'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content: contentText })
    })

    if (response.ok) {
      console.log('弹幕发送成功')
      danmuText.value = ''
    } else {
      const errorText = await response.text()
      console.error('Failed to send test danmu:', errorText)
      alert('发送失败，请重试')
    }
  } catch (error) {
    console.error('Error sending test danmu:', error)
    alert('发送失败，请检查网络')
  }
}

let searchDebounceTimer: number | null = null

const clearSearch = () => {
  if (searchDebounceTimer !== null) {
    window.clearTimeout(searchDebounceTimer)
    searchDebounceTimer = null
  }
  searchInputText.value = ''
  searchText.value = ''
}

watch(searchInputText, (val) => {
  if (searchDebounceTimer !== null) {
    window.clearTimeout(searchDebounceTimer)
    searchDebounceTimer = null
  }
  if (!val) {
    searchText.value = ''
    return
  }
  searchDebounceTimer = window.setTimeout(() => {
    searchText.value = val
    searchDebounceTimer = null
  }, 120)
})

// 监听路由变化
watch(() => route.params.ismTag, () => {
  handleRoute()
})

// 生命周期
onMounted(() => {
  document.documentElement.style.fontSize = Math.max(screen.width, screen.height) / 96 + "px"
  initial()
})

onUnmounted(() => {
  if (searchDebounceTimer !== null) {
    window.clearTimeout(searchDebounceTimer)
    searchDebounceTimer = null
  }
  document.documentElement.style.fontSize = ""
  disconnectWebSocket()
})
</script>

<style scoped>
@font-face {
  font-family: "en_font";
  src: local("Times New Roman");
  unicode-range: U+0041-005A, U+0061-007A;
}

@font-face {
  font-family: "other_font";
  src: local("Microsoft YaHei");
  font-style: normal;
}

* {
  font-family: "en_font", "other_font", sans-serif;
}

#ismismcube-container {
  position: fixed;
  width: 100%;
  height: 100%;
  overflow: auto;
}

.ism {
  cursor: pointer;
}

/* 基础色 */
.show_x,
.show_xy,
.ism_xyz::before {
  background-color: rgb(170, 170, 170);
}

.show_xy::before,
.ism_xyz {
  background-color: gray;
}

.show_xy::after,
.ism_xyz::after,
.ism_xyzi {
  background-color: rgb(200, 200, 200);
}

/* searched状态颜色优先级最低 */
.show_x.searched,
.show_xy.searched,
.ism_xyz.searched::before {
  background-color: rgb(201, 149, 15);
}

.show_xy.searched::before,
.ism_xyz.searched {
  background-color: darkgoldenrod;
}

.show_xy.searched::after,
.ism_xyz.searched::after,
.ism_xyzi.searched {
  background-color: rgb(225, 172, 39);
}

.show_x.pinned,
.show_xy.pinned,
.ism_xyz.pinned::before {
  background-color: rgb(11, 167, 167);
}

.show_xy.pinned::before,
.ism_xyz.pinned {
  background-color: darkcyan;
}

.show_xy.pinned::after,
.ism_xyz.pinned::after,
.ism_xyzi.pinned {
    background-color: rgb(17, 188, 188);
}

.show_x.selected,
.show_xy.selected,
.ism_xyz.selected::before {
    background-color: rgb(182, 53, 53);
}

.show_xy.selected::before,
.ism_xyz.selected {
    background-color: brown;
}

.show_xy.selected::after,
.ism_xyz.selected::after,
.ism_xyzi.selected {
  background-color: rgb(218, 73, 73);
}

/* 名称 */
.ism_name {
  width: 2.5rem;
  max-height: 3rem;
  font-size: 0.75em;
  line-height: 1.3;
  text-align: center;
  word-break: normal;
  overflow: hidden;
  text-wrap: balance;
  color: black;
}

.show_x .ism_name.no_data,
.show_xy_name .ism_name.no_data {
  color: rgb(100, 100, 100);
}

.ism_xyz .ism_name.no_data {
  color: rgb(68,68,68);
}

.ism_xyzi .ism_name.no_data {
  color: rgb(130, 130, 130);
}

#left_part {
  z-index: 1;
  position: absolute;
  left: 0;
  top: 0;
  width: 40rem;
  height: 100%;
  min-height: 40rem;
  background-color: rgb(230, 230, 230);
  box-shadow: -1rem 0 1rem 1rem black;
  transition: all 1s ease-in-out;
}

#left_part.collapsed {
  left: -40rem;
}

#page_view {
  position: absolute;
  left: 1rem;
  top: 0;
  width: 4rem;
  height: 1.5rem;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  cursor: default;
}

#page_view img {
  width: 1rem;
  height: 1rem;
}

#online_count {
  position: absolute;
  right: 31.5rem;
  top: 0;
  width: 3.5rem;
  height: 1.5rem;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  justify-content: right;
  cursor: default;
}

#online_count b {
  color: green;
}

#ai_button {
  position: absolute;
  left: 1rem;
  top: 1.5rem;
  width: 7.5rem;
  height: 1.5rem;
  font-size: 0.8rem;
  line-height: 1.5rem;
  text-align: center;
  white-space: nowrap;
  background-color: rgb(200, 200, 200);
  border: solid black 1px;
  overflow: hidden;
  cursor: pointer;
}

#return_button {
  position: absolute;
  left: 1rem;
  top: 3.5rem;
  width: 3.5rem;
  height: 1.5rem;
  font-size: 0.8rem;
  line-height: 1.5rem;
  text-align: center;
  white-space: nowrap;
  background-color: rgb(200, 200, 200);
  border: solid black 1px;
  overflow: hidden;
  cursor: pointer;
}

#download_button {
  position: absolute;
  left: 5rem;
  top: 3.5rem;
  width: 3.5rem;
  height: 1.5rem;
  font-size: 0.8rem;
  line-height: 1.5rem;
  text-align: center;
  white-space: nowrap;
  background-color: rgb(200, 200, 200);
  border: solid black 1px;
  overflow: hidden;
  cursor: pointer;
}

#ai_button:hover,
#return_button:hover,
#download_button:hover {
  background-color: gray;
}

#search_input {
  position: absolute;
  left: 1rem;
  top: 5.5rem;
  width: 7.5rem;
  height: 1.5rem;
  font-size: 0.8rem;
  line-height: 1.5rem;
  text-align: center;
  border: solid black 1px;
}

#ismism_main_cube {
  position: absolute;
  left: 10rem;
  top: 3.8rem;
  transform: skewY(-15deg);
}

#show_cube {
  z-index: -1;
  position: absolute;
  display: grid;
  grid-template-columns: repeat(4, 2.5rem);
  grid-template-rows: repeat(4, 3rem);
  gap: 0;
  width: 20rem;
  height: 17.8rem;
  contain: strict;
  overflow: hidden;
  transform: skewY(30deg);
  clip-path: polygon(0% 100%, calc(50% - 1px) 100%, 100% 68%, 100% 0%, calc(50% - 1px) 0%, 0% 32%);
}

.show_xy {
  z-index: var(--x);
  position: relative;
  top: 5.8rem;
  width: 2.5rem;
  height: 3rem;
  transform-origin: right;
  box-sizing: border-box;
  border: solid black 1px;
  display: flex;
}

.show_xy.selected,
.show_xy.pinned,
.show_xy.searched {
  z-index: calc(100 + var(--x));
}

.show_xy::before {
  z-index: -1;
  content: "";
  position: absolute;
  left: calc(2.5rem - 1px);
  top: -1px;
  width: 10rem;
  height: 3rem;
  box-sizing: border-box;
  border: solid black 1px;
  display: flex;
  transform-origin: left;
  transform: skewY(-30deg);
  opacity: var(--b);
  pointer-events: none;
}

.show_xy[style*="--y: 4"]::before {
  pointer-events: auto;
}

.show_xy::after {
  z-index: 1;
  content: "";
  position: absolute;
  left: -2px;
  top: calc(-5.9rem + 1px);
  width: 2.5rem;
  height: calc(5.9rem - 1px);
  box-sizing: border-box;
  border: solid black 1px;
  transform-origin: bottom;
  transform: skewX(-60deg);
  opacity: var(--a);
  pointer-events: none;
}

.show_xy[style*="--x: 4"]::after {
  pointer-events: auto;
}

#show_cube_name {
  z-index: 1;
  position: absolute;
  top: 2.9rem;
  display: grid;
  grid-template-columns: repeat(4, 2.5rem);
  grid-template-rows: repeat(4, 3rem);
  gap: 0;
  transform: skewY(30deg);
  pointer-events: none;
}

.show_xy_name {
  position: relative;
  width: 2.5rem;
  height: 3rem;
  display: flex;
  align-items: center;
}

.line_x {
  position: absolute;
  left: 10rem;
  top: calc(12rem - calc(var(--x)*3rem));
  width: 10rem;
  height: 0;
  border-bottom: 1px dashed black;
  transform-origin: left;
  transform: skewY(30deg);
  pointer-events: none;
}

.line_x[style*="--x: 4"] {
  border-bottom: none;
}

.line_x p {
  position: relative;
  left:12.5rem;
  height: 3rem;
  display: flex;
  align-items: center;
  color: red;
}

.line_y {
  position: absolute;
  left: calc(10rem + calc(var(--y)*2.5rem) - 1px);
  top: calc(calc(var(--y)*calc(1.5rem - 1px)) + 1px);
  width: 0;
  height: calc(12rem - 1px);
  border-right: 1px dashed black;
  transform: skewY(30deg);
  pointer-events: none;
}

.line_y[style*="--y: 4"] {
  border-bottom: none;
}

.line_y p {
  position: relative;
  left:-2.5rem;
  top: -1.3rem;
  width: 2.5rem;
  height: 1.5rem;
  color: green;
  text-align: center;
}

#show_cube_x {
  position: absolute;
  left: calc(20rem - 1px);
  top: 6.5rem;
  transform: skewY(30deg);
}

.show_x {
  position: relative;
  list-style: none;
  width: 2.5rem;
  height: 3rem;
  box-sizing: border-box;
  border:solid black 1px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.show_x p {
  position: absolute;
  width: 2.5rem;
  max-height: 3rem;
  text-align: center;
  word-break: normal;
  overflow: hidden;
  text-wrap: balance;
  pointer-events: none;
}

#axis_x {
  z-index: 10;
  position: absolute;
  left: calc(10rem - 1px);
  top: calc(1rem - 1px);
  height: 11rem;
  border-right: 3px dashed red;
  transform-origin: left;
  transform: skewY(30deg);
  pointer-events: none;
}

#axis_x::before {
  content: "";
  position: absolute;
  left: -3px;
  top: -2rem;
  border-style: solid;
  border-width: 1rem 4px 1rem 4px;
  border-color: transparent transparent red transparent;
}

#axis_y {
  z-index: 9;
  position: absolute;
  left:10rem;
  top: calc(12rem - 1px);
  width: 9rem;
  border-bottom: 3px dashed green;
  transform-origin: left;
  transform: skewY(30deg);
  pointer-events: none;
}

#axis_y::before {
  content: "";
  position: absolute;
  left: 9rem;
  top: -3px;
  border-style: solid;
  border-width: 4px 1rem 4px 1rem;
  border-color: transparent transparent transparent green;
}

#axis_z {
  z-index: 8;
  position: absolute;
  left: 1rem;
  top: calc(12rem - 1px);
  width: 9rem;
  border-bottom: 3px dashed blue;
  transform-origin: top;
  pointer-events: none;
}

#axis_z::before {
  content: "";
  position: absolute;
  left: -2rem;
  top: -3px;
  border-style: solid;
  border-width: 4px 1rem 4px 1rem;
  border-color: transparent blue transparent transparent;
}

#axis_label {
  position: absolute;
  right: 0;
  top: 0.5rem;
  width: 4.5rem;
  height: 8rem;
}

#axis_label p {
  position: relative;
  line-height: 1.5rem;
  text-align: left;
}

#axis_label p::before {
  content: "";
  position: absolute;
  left: -1rem;
  bottom: 0.3rem;
  width: 0.75rem;
  height:0.75rem;
  border:solid black 0.05rem;
}

#axis_label_x::before {
  background-color: red;
}

#axis_label_y::before {
  background-color: green;
}

#axis_label_z::before {
  background-color: blue;
}

#axis_label_i::before {
  background-color: darkorange;
}

#ism_info_wrapper {
  position: absolute;
  left: 0.5rem;
  right: 0.5rem;
  top: 19.5rem;
  overflow: hidden;
  height: calc(100% - 20rem);
}

#ism_info {
  z-index: 1;
  position: absolute;
  width: 100%;
  height: 100%;
  background-color: rgb(200, 200, 200);
  overflow: auto;
}

#increase_fontsize_button {
  z-index: 1;
  position: absolute;
  left: 1rem;
  top: 0.5rem;
  width: 1rem;
  height: 1rem;
  border-radius: 0.5rem;
  background-color: rgb(200,200,200);
  border:solid rgb(170, 170, 170) 0.2rem;
}

#increase_fontsize_button:hover {
  background-color: rgb(170, 170, 170);
}

#increase_fontsize_button::before {
  content: "";
  position: absolute;
  left: 0.1rem;
  top: 0.4rem;
  width: 0.8rem;
  height: 0.2rem;
  background-color: black;
}

#increase_fontsize_button::after {
  content: "";
  position: absolute;
  left: 0.4rem;
  top: 0.1rem;
  width: 0.2rem;
  height: 0.8rem;
  background-color: black;
}

#decrease_fontsize_button {
  z-index: 1;
  position: absolute;
  left: 3rem;
  top: 0.5rem;
  width: 1rem;
  height: 1rem;
  border-radius: 0.5rem;
  background-color: rgb(200,200,200);
  border:solid rgb(170, 170, 170) 0.2rem;
}

#decrease_fontsize_button:hover {
  background-color: rgb(170, 170, 170);
}

#decrease_fontsize_button::before {
  content: "";
  position: absolute;
  left: 0.1rem;
  top: 0.4rem;
  width: 0.8rem;
  height: 0.2rem;
  background-color: black;
}

#ism_info_content {
  position: relative;
  padding: 0.5rem 1rem;
  white-space: pre-wrap;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

#ism_info_overlay {
  z-index: 2;
  position: absolute;
  width: 100%;
  height: 100%;
  box-shadow: inset 0 0 3px 3px gray;
  pointer-events: none;
}

#size_adjuster {
  position: absolute;
  left: 40rem;
  height: calc(100% - 4rem);
}

#size_indicator {
  position: absolute;
  width: 1rem;
  height: 4rem;
  background: rgb(200,200,200) url('@/assets/size_indicator.svg') center/contain no-repeat;
  box-sizing: border-box;
  border: 1px solid black;
  display: flex;
  justify-content: center;
  align-items: center;
}

#size_indicator:hover {
  background-color: gray;
  cursor: pointer;
}

#right_part {
  z-index: 0;
  position: absolute;
  left: 40rem;
  width: calc(100% - 40rem);
  min-width: 40rem;
  min-height: 40rem;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: all 1s ease-in-out;
}

#right_part.widened {
  left: 0;
  width: 100%;
}

#right_part_scroll {
  position: relative;
  flex: 1;
  overflow: auto;
}

#ismism_cube_box {
  position: absolute;
  left: 2rem;
  right: 0;
  max-width: 60rem;
  display: flex;
  transform-origin: left;
  overflow: visible;
}

.ism_x {
  position: absolute;
  left: 0;
  right: 0;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  top: calc(0.5rem + var(--x) * 18rem);
}

.ism_xy {
  position: relative;
  width: 12.5rem;
  height: 18rem;
  contain: strict;
  overflow: hidden;
  transform: skewY(-15deg);
}

.ism_xy p {
  width: 2.5rem;
  max-height: 3rem;
  font-size: 0.75em;
  line-height: 1.3;
  text-align: center;
  pointer-events: none;
}

.ism_xy #i {
  z-index: 1;
  position: absolute;
  left: calc(10rem + 1px);
  top: 2.5rem;
  height: 11rem;
  border-right: 3px dashed darkorange;
  pointer-events: none;
}

.ism_xy #i::before {
  content: "";
  position: absolute;
  left: -3px;
  top: -2rem;
  border-style: solid;
  border-width: 1rem 4px 1rem 4px;
  border-color: transparent transparent darkorange transparent;
}

.ism_xy #z {
  z-index: 1;
  position: absolute;
  left: 1rem;
  top: calc(13.5rem + 1px);
  width: 9rem;
  border-bottom: 3px dashed blue;
  pointer-events: none;
}

.ism_xy #z::before {
  content: "";
  position: absolute;
  left: -2rem;
  top: -3px;
  border-style: solid;
  border-width: 4px 1rem 4px 1rem;
  border-color: transparent blue transparent transparent;
}

.ism_xyz {
  position: absolute;
  left: calc(var(--z) * 2.5rem);
  top: 15rem;
  width: 2.5rem;
  height: 3rem;
  box-sizing: border-box;
  border: solid black 1px;
  display: flex;
  align-items: center;
}

.ism_xyz::before {
  z-index: -2;
  content: "";
  position: absolute;
  left: -2.5rem;
  top: -1px;
  width: 2.5rem;
  height: 3rem;
  box-sizing: border-box;
  border: solid black 1px;
  transform-origin: right;
  transform: skewY(31deg);
}

.ism_xyz::after {
  z-index: -1;
  content: "";
  position: absolute;
  left: 0;
  top: -1.5rem;
  width: 2.5rem;
  height: 1.5rem;
  box-sizing: border-box;
  border: solid black 1px;
  transform-origin: bottom;
  transform: skewX(59deg);
}

#ism_xyz_label_column {
  position: absolute;
  left: -2.5rem;
  top: -14.7rem;
  width: 2.5rem;
  height: 1.5rem;
  color: blue;
  text-align: center;
  pointer-events: none;
}

#ism_xyz_label_row {
  position: absolute;
  left: 2.7rem;
  height: 3rem;
  color: darkorange;
  display: flex;
  align-items: center;
  pointer-events: none;
 }

.ism_xyzi {
  position: absolute;
  left: -2.5rem;
  top: calc(-16.5rem + var(--i) * 3rem);
  width: 2.5rem;
  height: 3rem;
  box-sizing: border-box;
  border: solid black 1px;
  display: flex;
  align-items: center;
}

#danmu_overlay {
  position: sticky;
  left: 0;
  right: 0;
  top: 0;
  height: 100%;
  pointer-events: none;
  overflow: hidden;
  z-index: 2;
}

.danmu_fly {
  position: absolute;
  padding: 0.2rem 0.75rem;
  font-size: 0.9rem;
  vertical-align: middle;
  white-space: nowrap;
  border-radius: 0.5rem;
  background-color: black;
  opacity: 0.6;
  color: white;
  animation-name: danmu-slide;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
  will-change: transform;
  pointer-events: auto;
}

.danmu_fly.disabled {
  visibility: hidden;
  pointer-events: none;
}

.danmu_fly:hover {
  animation-play-state: paused;
  opacity: 0.9;
}

@keyframes danmu-slide {
  from {
    left: 100%;
    transform: translateX(0%);
  }
  to {
    left: 0%;
    transform: translateX(-100%);
  }
}

#danmu_button_container {
  position: relative;
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: 0.5rem 2rem;
  background-color: rgb(230, 230, 230);
  box-shadow: 0 0.5rem 0.5rem 0.5rem black;
}

#danmu_toggle_button {
  width: 4rem;
  height: 1.5rem;
  line-height: 1.5rem;
  text-align: center;
  font-size: 0.8rem;
  background-color: rgb(200, 200, 200);
  border: 1px solid black;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s ease;
}

#danmu_toggle_button:hover {
  background-color: gray;
}

#danmu_input {
  flex: 1;
  height: 1.5rem;
  border: 1px solid black;
  padding: 0 0.5rem;
  font-size: 0.8rem;
  background-color: white;
  box-sizing: border-box;
}

#danmu_input.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

#courses_button {
  position: absolute;
  left: 1rem;
  top: 7.5rem;
  width: 7.5rem;
  height: 1.5rem;
  font-size: 0.78rem;
  line-height: 1.5rem;
  text-align: center;
  white-space: nowrap;
  background-color: rgb(200, 200, 200);
  border: solid black 1px;
  overflow: hidden;
  cursor: pointer;
}

#courses_button:hover {
  background-color: gray;
}

#search_status_line {
  position: absolute;
  left: 1rem;
  top: 9.25rem;
  width: 7.5rem;
  font-size: 0.7rem;
  line-height: 1.2;
  color: rgb(55, 55, 55);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.2rem;
}

.clear_search_link {
  background-color: rgb(210, 210, 210);
  border: 1px solid black;
  padding: 0 0.25rem;
  font-size: 0.68rem;
  cursor: pointer;
}

.clear_search_link:hover {
  background-color: rgb(180, 180, 180);
}

#increase_fontsize_button,
#decrease_fontsize_button {
  z-index: 2;
  cursor: pointer;
}

#ism_info_content {
  white-space: normal;
  align-items: stretch;
  box-sizing: border-box;
  width: 100%;
}

.info_intro_box,
.info_error_box {
  white-space: pre-wrap;
  line-height: 1.45;
  font-size: 1em;
}

.info_error_box {
  text-align: center;
  padding: 1rem;
}

.node_header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35em;
  width: 100%;
  box-sizing: border-box;
}

.node_coord_row {
  padding: 0 4.5rem;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.2em;
  flex-wrap: wrap;
}

.coord_box {
  display: inline-block;
  width: 1.2em;
  height: 1.2em;
  line-height: 1.2em;
  text-align: center;
  border: solid black 0.1em;
  background-color: rgb(224, 224, 224);
}

.coord_dash {
  font-weight: bold;
}

.node_status_banner {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.28em;
}

.status_pill {
  display: inline-block;
  padding: 0.08em 0.42em;
  font-size: 0.74em;
  border: 1px solid rgb(70, 70, 70);
  background-color: rgb(232, 232, 232);
}

.pill_manual {
  background-color: rgb(216, 236, 216);
  border-color: rgb(42, 102, 42);
}

.pill_ai {
  background-color: rgb(226, 234, 246);
  border-color: rgb(55, 86, 140);
}

.pill_ai_warn {
  background-color: rgb(248, 228, 200);
  border-color: rgb(162, 92, 24);
  color: rgb(92, 46, 8);
}

.pill_reviewed {
  background-color: rgb(214, 239, 239);
  border-color: darkcyan;
}

.pill_partial {
  background-color: rgb(247, 238, 200);
  border-color: rgb(146, 114, 30);
}

.pill_pending {
  background-color: rgb(246, 224, 224);
  border-color: rgb(150, 50, 50);
}

.pill_unverified {
  background-color: rgb(236, 236, 236);
  color: rgb(65, 65, 65);
}

.summary_evidence_line {
  font-size: 0.74em;
  color: rgb(55, 55, 55);
  text-align: center;
}

.node_titles {
  text-align: center;
  line-height: 1.35;
}

.node_ch_name {
  font-weight: bold;
  font-size: 1.05em;
}

.node_en_name {
  font-size: 0.92em;
  font-weight: bold;
  color: rgb(50, 50, 50);
}

.info_tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.3em;
  width: 100%;
  margin: 0.25em 0;
}

.info_tab_btn {
  position: relative;
  padding: 0.28em 0.35em;
  font-size: 0.78em;
  background-color: rgb(218, 218, 218);
  border: 1px solid black;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.info_tab_btn:hover {
  background-color: rgb(185, 185, 185);
}

.info_tab_btn.active {
  background-color: darkcyan;
  color: white;
  font-weight: bold;
}

.hit_dot {
  margin-left: 0.2em;
  color: rgb(225, 172, 39);
  font-weight: bold;
}

.tab_panel {
  display: flex;
  flex-direction: column;
  gap: 0.6em;
  width: 100%;
  box-sizing: border-box;
  line-height: 1.45;
  font-size: 0.94em;
}

.axis_section,
.feature_section,
.core_related_section {
  display: flex;
  flex-direction: column;
  gap: 0.35em;
}

.axis_digit_box {
  display: inline-block;
  text-align: center;
  width: 1.15em;
  height: 1.15em;
  line-height: 1.15em;
  margin: 0 0.15em;
  border: solid black 0.1em;
}

.axis_evidence_chip {
  margin-top: 0.12em;
  padding-left: 0.5em;
  border-left: 2px solid rgb(120, 120, 120);
  font-size: 0.78em;
  color: rgb(55, 55, 55);
}

.core_related_section {
  text-align: center;
  padding-top: 0.25em;
  border-top: 1px dashed rgb(140, 140, 140);
}

.related_row {
  word-break: break-word;
}

.section_block {
  display: flex;
  flex-direction: column;
  gap: 0.35em;
}

.section_title {
  font-weight: bold;
  font-size: 0.9em;
  padding-bottom: 0.15em;
  border-bottom: 1px solid rgb(140, 140, 140);
}

.info_card {
  padding: 0.42em 0.55em;
  background-color: rgb(222, 222, 222);
  border: 1px solid rgb(135, 135, 135);
  display: flex;
  flex-direction: column;
  gap: 0.22em;
}

.card_badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25em;
}

.mini_badge {
  display: inline-block;
  padding: 0.04em 0.32em;
  font-size: 0.74em;
  background-color: rgb(238, 238, 238);
  border: 1px solid rgb(95, 95, 95);
}

.mini_badge.series {
  background-color: rgb(252, 232, 180);
  border-color: rgb(150, 100, 0);
  font-weight: bold;
}

.mini_badge.rel_explicit {
  background-color: rgb(215, 240, 215);
  border-color: rgb(42, 106, 42);
  font-weight: bold;
}

.mini_badge.rel_editorial {
  background-color: rgb(226, 228, 248);
  border-color: rgb(65, 75, 145);
}

.mini_badge.res_resolved {
  background-color: rgb(215, 242, 242);
  border-color: darkcyan;
}

.mini_badge.res_qualified {
  background-color: rgb(248, 238, 205);
  border-color: rgb(155, 115, 25);
}

.mini_badge.warn_soft {
  background-color: rgb(246, 232, 224);
  border-color: rgb(155, 78, 55);
}

.card_main_link {
  word-break: break-word;
}

.card_actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4em;
}

.bv_code {
  font-size: 0.76em;
  color: rgb(70, 70, 70);
}

.mini_action_btn {
  padding: 0.14em 0.5em;
  font-size: 0.78em;
  background-color: rgb(206, 232, 232);
  border: 1px solid black;
  cursor: pointer;
}

.mini_action_btn:hover {
  background-color: darkcyan;
  color: white;
}

.drawer_cta_wrap {
  display: flex;
  justify-content: center;
  padding-top: 0.2em;
}

.review_stats_bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55em;
  padding: 0.3em 0.5em;
  background-color: rgb(216, 216, 216);
  border: 1px solid rgb(140, 140, 140);
  font-size: 0.8em;
}

.card_meta_line {
  font-size: 0.84em;
}

.muted_meta {
  font-size: 0.76em;
  color: rgb(70, 70, 70);
  word-break: break-all;
}

.empty_hint {
  font-size: 0.82em;
  color: rgb(75, 75, 75);
}

.error_hint {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.45em;
  color: rgb(140, 36, 36);
}

.retry_btn_inline {
  padding: 0.12em 0.5em;
  font-size: 0.88em;
  background-color: rgb(232, 232, 232);
  border: 1px solid black;
  cursor: pointer;
}

.retry_btn_inline:hover {
  background-color: darkcyan;
  color: white;
}

.editorial_list {
  margin: 0;
  padding-left: 1.25em;
  display: flex;
  flex-direction: column;
  gap: 0.25em;
  font-size: 0.85em;
}

</style>
