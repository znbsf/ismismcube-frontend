<template>
  <div
    id="ismismcube-container"
    :class="{
      is_collapsed: isLeftPartClosed,
      'mobile-pane-reader': mobilePane === 'reader',
      'mobile-pane-cube': mobilePane === 'cube'
    }"
  >
    <header id="app_topbar" aria-label="主工作台工具栏">
      <div class="topbar_brand">
        <button
          type="button"
          class="brand_home_btn"
          title="返回总览"
          @click="handleSpatialSelect('')"
        >
          <span class="brand_mark" aria-hidden="true">4⁴</span>
          <span class="brand_copy">
            <span class="brand_title">主义主义魔方</span>
            <span class="brand_subtitle">340 立场哲学谱系工作台</span>
          </span>
        </button>
      </div>

      <nav class="topbar_nav" aria-label="核心专题工具">
        <button id="route_button" type="button" @click="openReadingRoute">阅读路线</button>
        <button id="courses_button" type="button" @click="openCourseDrawer()">
          补充课程 / ${{ coursesList.length ? ` (${coursesList.length})` : '' }}
        </button>
        <button id="guide_button" type="button" @click="openCodeGuide">怎么读编号</button>
      </nav>

      <div class="mobile_pane_tabs" role="group" aria-label="移动端视图切换">
        <button
          type="button"
          class="mobile_pane_btn"
          :class="{ active: mobilePane === 'reader' }"
          :aria-pressed="mobilePane === 'reader' ? 'true' : 'false'"
          @click="selectMobilePane('reader')"
        >
          内容阅读
        </button>
        <button
          type="button"
          class="mobile_pane_btn"
          :class="{ active: mobilePane === 'cube' }"
          :aria-pressed="mobilePane === 'cube' ? 'true' : 'false'"
          @click="selectMobilePane('cube')"
        >
          魔方空间
        </button>
      </div>

      <div class="topbar_tools">
        <button
          id="cmd_palette_trigger"
          type="button"
          class="topbar_cmd_btn"
          aria-keyshortcuts="Control+k Meta+k"
          @click="openCommandPalette"
        >
          <span>快速跳转</span>
          <kbd>⌘K</kbd>
        </button>

        <button
          id="provenance_popover_btn"
          type="button"
          class="topbar_chip_btn provenance_chip"
          popovertarget="provenance_popover"
        >
          未核原音 · 边界说明
        </button>
        <div id="provenance_popover" popover="auto" class="provenance_popover_card">
          <div class="popover_head">
            <strong>学术来源与核校声明</strong>
          </div>
          <p class="popover_body">
            本站全部节点条目、二手讲稿索引与校勘提示均基于公开讲稿汇编与 AI 辅助梳理整理，<strong>全站内容均未核对原始视频音频</strong>；标注「未核原音」与细粒度依据标记用于提示事实与边界。
          </p>
          <div class="popover_stats">
            <span>累计访问：{{ pageView == -1 ? '-' : pageView }}</span>
            <span>当前在线：{{ onlineCount == -1 ? '-' : onlineCount }}</span>
          </div>
        </div>

        <button
          id="theme_cycle_button"
          type="button"
          class="topbar_chip_btn theme_btn"
          :title="`当前外观：${themeLabel}（点击切换亮色 / 暗色 / 跟随系统）`"
          @click="cycleThemeMode"
        >
          {{ themeLabel }}
        </button>
      </div>
    </header>

    <div id="size_adjuster" ref="sizeAdjusterRef" :class="{ collapsed: isLeftPartClosed }">
      <button
        id="size_indicator"
        type="button"
        aria-controls="left_part"
        :aria-expanded="!isLeftPartClosed"
        :aria-label="isLeftPartClosed ? '展开阅读区' : '折叠阅读区'"
        @click="handleIndicatorClick"
        ref="sizeIndicatorRef"
        @mousedown="setIndicatorActive"
        :style="{ top: sizeIndicatorRatio * 100 + '%' }"
      >
        <span class="indicator_grip" aria-hidden="true">{{ isLeftPartClosed ? '›' : '‹' }}</span>
      </button>
    </div>

    <div id="left_part" ref="leftPartRef" :inert="isLeftPartClosed" :class="{ collapsed: isLeftPartClosed }">
      <div class="left_workbench_bar">
        <div class="search_box_row">
          <input
            id="search_input"
            ref="searchInputRef"
            type="text"
            aria-label="检索节点编号、名称和内容"
            placeholder="检索编号、名称、关键词或课程..."
            v-model="searchInputText"
            @keydown.enter="handleSearchInputEnter"
          >
          <div id="search_status_line">
            <template v-if="trimmedSearchInput !== ''">
              <div class="search_status_summary">
                <span v-if="trimmedSearchInput !== searchText">检索中...</span>
                <span v-else-if="isSearchIndexIncomplete">命中 {{ searchedCount }}（未完）</span>
                <span v-else>命中 {{ searchedCount }} 节点</span>
              </div>
              <div class="search_status_actions">
                <button
                  id="open_search_results_btn"
                  type="button"
                  class="clear_search_link"
                  @click="openSearchResults"
                >
                  查看结果
                </button>
                <button type="button" class="clear_search_link" @click="clearSearch">清空</button>
              </div>
            </template>
            <template v-else-if="enrichmentsData && coursesStatus === 'ready'">
              <span>{{ Object.keys(enrichmentsData.nodes).length }} 节点已建索引</span>
            </template>
            <template v-else-if="enrichStatus === 'error' || coursesStatus === 'error'">
              <div class="search_status_summary">
                <span>索引加载失败</span>
                <button type="button" class="clear_search_link" @click="retryFailedSearchIndexes">索引重试</button>
              </div>
            </template>
            <template v-else-if="enrichmentsData">
              <span>{{ Object.keys(enrichmentsData.nodes).length }} 节点已建索引</span>
            </template>
            <template v-else-if="ismData">
              <span>索引加载中...</span>
            </template>
          </div>
        </div>

        <CubeNavigation
          class="cube_nav_panel"
          :current-code="routeIsmTag"
          :nodes="ismData"
          @select="handleCubeNavigationSelect"
        />

        <div class="left_utility_row">
          <div class="left_action_group">
            <button id="ai_button" type="button" aria-label="打开 AI 对话" @click="goToAI">AI 顾问</button>
            <button id="download_button" type="button" aria-label="下载主义主义节点 JSON 文件"
              :disabled="!ismData" @click="downloadIsmJson">导出 JSON</button>
            <button id="return_button" type="button" aria-label="在新窗口打开更多内容" @click="openMoreContent">原站延伸</button>
          </div>

          <div class="reader_metrics">
            <div id="page_view" title="此网页的总访量">
              <img src="@/assets/page_view_icon.svg" alt="page_view">
              <b>{{ pageView == -1 ? '-' : pageView }}</b>
            </div>
            <div id="online_count" title="当前在线数">
              <span>在线</span>
              <b>{{ onlineCount == -1 ? '-' : onlineCount }}</b>
            </div>
          </div>
        </div>
      </div>

      <div id="ism_info_wrapper">
        <div id="ism_info" :style="{ fontSize: readerFontCss(ismInfoFontSize) }">
          <div class="reader_font_toolbar" role="group" aria-label="正文字号">
            <button id="increase_fontsize_button" type="button" aria-label="放大正文字体" title="放大字体"
              :disabled="ismInfoFontSize >= MAX_READER_SCALE" @click="increaseFontSize">A+</button>
            <button id="decrease_fontsize_button" type="button" aria-label="缩小正文字体" title="缩小字体"
              :disabled="ismInfoFontSize <= MIN_READER_SCALE" @click="decreaseFontSize">A−</button>
          </div>
          <div id="ism_info_content" ref="readerContentRef" tabindex="-1" role="region" aria-label="节点阅读内容">
            <div v-if="ismLoadError" class="info_error_box">
              <div>{{ ismLoadError }}</div>
              <button
                type="button"
                class="retry_btn_inline info_error_retry_btn"
                :disabled="ismStatus === 'loading'"
                @click="retryReaderResource($event, loadIsm)"
              >
                重试加载
              </button>
            </div>
            <div v-else-if="ismStatus === 'loading' && !ismData" class="info_error_box">
              正在加载基础数据...
            </div>
            <div v-else-if="!activeIsmTag || !activeIsmData" class="info_intro_box">
              <div v-if="!guideSeen" class="first_visit_guide_banner" role="region" aria-label="首次阅读提示">
                <p class="first_visit_guide_text">
                  首次导读：四位编号按「场域论—本体论—认识论—目的论」嵌套展开。可直接点击魔方节点探索，或先看编号导读与阅读路线。
                </p>
                <div class="first_visit_guide_actions">
                  <button type="button" class="intro_guide_btn" @click="openCodeGuide">
                    怎么读编号
                  </button>
                  <button type="button" class="intro_guide_dismiss_btn" @click="markGuideSeen">
                    知道了
                  </button>
                </div>
              </div>
              <div v-html="introductionHtml"></div>
              <div class="intro_guide_row">
                <button type="button" class="intro_guide_btn" @click="openCodeGuide">第一次来？先看“怎么读编号”</button>
              </div>
            </div>
            <template v-else>
              <div class="node_header">
                <div class="node_coord_row">
                  <template v-for="(digit, idx) in activeTagDigits" :key="idx">
                    <span v-if="idx > 0" class="coord_dash">-</span>
                    <span class="coord_box" :style="{ color: axisColor[idx] }"><b>{{ digit }}</b></span>
                  </template>
                </div>

                <NodeBreadcrumb
                  :code="activeIsmTag"
                  :get-node="getIsmNode"
                  :query="searchText"
                  @jump="handleInlineJump"
                />

                <div
                  v-if="showRouteBanner && routeStepMatch"
                  :key="routeStepMatch.current.stepId"
                  class="route_node_banner"
                >
                  <span class="route_banner_text">
                    阅读路线 · {{ routeStepMatch.current.stage.title }} · {{ routeStepMatch.current.step.task }}
                  </span>
                  <div class="route_banner_actions">
                    <label class="route_banner_toggle">
                      <input
                        type="checkbox"
                        :checked="isRouteStepDone(routeStepMatch.current.stage.id, routeStepMatch.current.step.code)"
                        @change="toggleRouteStepDone(routeStepMatch.current.stage.id, routeStepMatch.current.step.code)"
                      >
                      <span>标记完成</span>
                    </label>
                    <button
                      v-if="routeStepMatch.next"
                      type="button"
                      class="route_banner_next_btn"
                      @click="jumpToNode(routeStepMatch.next.step.code)"
                    >
                      下一步 →
                    </button>
                  </div>
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
                  <div ref="nodeHeadingRef" class="node_ch_name" tabindex="-1">
                    <HighlightText :text="activeIsmData.ch_name" :query="searchText" />
                  </div>
                  <div class="node_en_name">
                    <HighlightText :text="activeIsmData.en_name" :query="searchText" />
                  </div>
                </div>
              </div>

              <div class="info_tabs" role="tablist" aria-label="节点阅读视图">
                <button
                  v-for="(tab, idx) in infoTabs"
                  :id="getInfoTabId(tab.key)"
                  :key="tab.key"
                  :ref="(el) => setInfoTabRef(tab.key, el)"
                  type="button"
                  role="tab"
                  class="info_tab_btn"
                  :class="{ active: activeInfoTab === tab.key, has_hit: tab.dotClass === 'hit_dot' && tab.hasHit }"
                  :aria-selected="activeInfoTab === tab.key ? 'true' : 'false'"
                  :aria-controls="getInfoPanelId(tab.key)"
                  :tabindex="activeInfoTab === tab.key ? 0 : -1"
                  @click="selectInfoTab(tab.key)"
                  @keydown="handleInfoTabKeydown($event, idx)"
                >
                  {{ tab.label }}<span v-if="tab.hasHit" :class="tab.dotClass" :title="tab.dotTitle">•</span>
                </button>
              </div>

              <div
                v-show="activeInfoTab === 'overview'"
                :id="getInfoPanelId('overview')"
                role="tabpanel"
                :aria-labelledby="getInfoTabId('overview')"
                class="tab_panel"
              >
                <div class="evidence_toolbar">
                  <label class="evidence_toggle_label">
                    <input
                      v-model="showEvidenceMarkers"
                      type="checkbox"
                      @change="saveEvidenceMarkersPreference"
                    >
                    <span>显示核查标记</span>
                  </label>
                  <label class="evidence_toggle_label">
                    <input
                      v-model="selfTestMode"
                      type="checkbox"
                      @change="saveSelfTestPreference"
                    >
                    <span>自测模式</span>
                  </label>
                  <details class="evidence_legend_details">
                    <summary class="evidence_legend_summary">标记说明</summary>
                    <div class="evidence_legend_body">
                      <div v-for="item in evidenceLegendItems" :key="item.tone" class="evidence_legend_row">
                        <span class="legend_tone_chip" :class="TONE_META[item.tone].className">
                          <span aria-hidden="true">{{ TONE_META[item.tone].icon }}</span>
                          <span>{{ item.examples }}</span>
                        </span>
                        <span class="evidence_legend_desc">{{ TONE_META[item.tone].description }}</span>
                      </div>
                      <div class="evidence_legend_footnote">
                        无标记不代表已核原音：全站内容均未核原音；没有逐项核查记录的节点不显示标记。
                      </div>
                    </div>
                  </details>
                </div>

                <AxisAnatomy
                  :code="activeIsmTag"
                  :get-node="getIsmNode"
                  :query="searchText"
                  :axis-evidence="getAxisEvidence"
                  :review-highlights="showEvidenceMarkers ? activeEnrichment?.review_summary?.highlights : undefined"
                  :self-test="selfTestMode"
                  @jump="handleInlineJump"
                />

                <div
                  v-if="nonEmptyFeatures.length > 0"
                  ref="featureSectionRef"
                  class="feature_section"
                  role="region"
                  aria-label="立场主要特征"
                  tabindex="-1"
                >
                  <div v-if="selfTestMode && !featuresRevealed" class="self_test_prompt_box">
                    <span class="self_test_prompt_text">先用自己的话说出这个立场的主要特征，再揭晓。</span>
                    <button
                      type="button"
                      class="self_test_reveal_btn"
                      @click="revealFeatures"
                    >
                      揭晓特征
                    </button>
                  </div>
                  <template v-else>
                    <div v-for="feat in nonEmptyFeatures" :key="feat.originalIndex" class="feature_row">
                      <EvidenceMarker
                        v-if="showEvidenceMarkers && feat.evidence"
                        :evidence="feat.evidence"
                        :query="searchText"
                      >
                        <b>{{ feat.text.slice(0, 1) }}</b><HighlightText :text="feat.text.slice(1)" :query="searchText" />
                      </EvidenceMarker>
                      <template v-else>
                        <b>{{ feat.text.slice(0, 1) }}</b><HighlightText :text="feat.text.slice(1)" :query="searchText" />
                      </template>
                    </div>
                  </template>
                </div>

                <AxisNeighbors
                  :code="activeIsmTag"
                  :get-node="getIsmNode"
                  :query="searchText"
                  @jump="handleInlineJump"
                />

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

              <div
                v-show="activeInfoTab === 'courses'"
                :id="getInfoPanelId('courses')"
                role="tabpanel"
                :aria-labelledby="getInfoTabId('courses')"
                class="tab_panel"
              >
                <div class="section_block">
                  <div class="section_title">关联视频课程（{{ activeLinkedCourses.length }}）</div>
                  <div v-if="coursesStatus === 'error' && activeLinkedCourses.length === 0" class="empty_hint error_hint">
                    <span>{{ coursesError || '补充课程目录加载失败。' }}</span>
                    <button type="button" class="retry_btn_inline" @click="retryReaderResource($event, loadCourses)">重试</button>
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
                    <button type="button" class="retry_btn_inline" @click="retryReaderResource($event, loadEnrichments)">重试</button>
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

              <div
                v-show="activeInfoTab === 'editorial'"
                :id="getInfoPanelId('editorial')"
                role="tabpanel"
                :aria-labelledby="getInfoTabId('editorial')"
                class="tab_panel"
              >
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
                        <span
                          class="mini_badge canonical_badge"
                          :class="getCanonicalToneMeta(hl.canonical_status).className"
                        >
                          <span aria-hidden="true">{{ getCanonicalToneMeta(hl.canonical_status).icon }}</span>
                          <span>{{ CANONICAL_STATUS_LABELS[hl.canonical_status] || hl.canonical_status }}</span>
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
                    <button type="button" class="retry_btn_inline" @click="retryReaderResource($event, loadEnrichments)">重试</button>
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

              <div
                v-show="activeInfoTab === 'notes'"
                :id="getInfoPanelId('notes')"
                role="tabpanel"
                :aria-labelledby="getInfoTabId('notes')"
                class="tab_panel"
              >
                <NodeNotes
                  v-if="activeInfoTab === 'notes'"
                  :code="activeIsmTag"
                  :title="activeIsmData.ch_name"
                  :readings="activeEnrichment?.readings ?? []"
                  :get-title="getNodeTitle"
                  :get-reading-title="getReadingTitle"
                  @jump="jumpToNoteNode"
                  @updated="handleNotesUpdated"
                />
              </div>
            </template>
          </div>
        </div>
        <div id="ism_info_overlay"></div>
      </div>
    </div>

    <div id="right_part" :class="{ widened: isLeftPartClosed }">
      <div class="right_part_toolbar">
        <div id="cube_zoom_controls">
          <label for="cube_zoom_range">魔方缩放</label>
          <input id="cube_zoom_range" type="range" min="100" max="250" step="1"
            :value="cubeZoomPercent" :aria-valuetext="`${cubeZoomPercent}%`" @input="handleCubeZoomInput">
          <output for="cube_zoom_range">{{ cubeZoomPercent }}%</output>
        </div>

        <div id="danmu_button_container" :class="{ disabled: !danmuEnabled }">
          <button id="danmu_toggle_button" type="button" :aria-pressed="danmuEnabled"
            @click="toggleDanmu"
          >
            {{ danmuEnabled ? '关闭弹幕' : '开启弹幕' }}
          </button>
          <input id="danmu_input"
            type="text"
            placeholder="发送弹幕" aria-label="弹幕内容" :aria-busy="danmuPending"
            v-model="danmuText"
            :disabled="!danmuEnabled"
            :class="{ disabled: !danmuEnabled }"
            @keydown.enter="sendDanmu"
          >
        </div>
      </div>

      <div id="right_part_scroll">
        <SpatialCubeExplorer
          :nodes="ismData"
          :active-code="routeIsmTag"
          :pinned-code="routeIsmTag"
          :hit-codes="searchedTags"
          :note-codes="noteCodesSet"
          :cube-scale-transform="cubeScaleTransform"
          v-model:view-mode="spatialViewMode"
          @select="handleSpatialSelect"
          @hover="handleSpatialHover"
        />

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
    </div>

    <span v-if="danmuStatus" id="danmu_status" role="status" aria-atomic="true">{{ danmuStatus }}</span>

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
      fallback-focus-selector="#courses_button"
      @close="closeCourseDrawer"
      @jump-to-node="handleCourseJump"
      @retry-courses="loadCourses"
      @retry-bodies="loadCourseBodies"
    />

    <ReadingRoute
      :open="readingRouteOpen"
      :current-code="routeIsmTag"
      :get-node="getIsmNode"
      fallback-focus-selector="#route_button"
      @close="closeReadingRoute"
      @jump="handleRouteJump"
    />

    <CodeGuide
      :open="codeGuideOpen"
      fallback-focus-selector="#guide_button"
      @close="closeCodeGuide"
    />

    <SearchResults
      :open="searchResultsOpen"
      :query="searchText"
      :results="searchResults"
      :total-nodes="totalNodeCount"
      :current-code="routeIsmTag"
      :ism-loaded="Boolean(ismData)"
      :ism-load-error="ismLoadError"
      :enrich-status="enrichStatus"
      :enrich-error="enrichError"
      :courses-status="coursesStatus"
      :courses-error="coursesError"
      :can-jump="canJumpToNode"
      fallback-focus-selector="#search_input"
      @close="closeSearchResults"
      @jump="handleSearchResultJump"
      @retry-enrichments="loadEnrichments"
      @retry-courses="loadCourses"
    />

    <CommandPalette
      :open="commandPaletteOpen"
      :nodes="ismData"
      :courses="coursesList"
      :theme-label="themeLabel"
      :view-mode-label="spatialViewMode === 'cube' ? '矩阵切片' : '立体魔方'"
      fallback-focus-selector="#cmd_palette_trigger"
      @close="closeCommandPalette"
      @jump-node="handleCommandJumpNode"
      @open-course="handleCommandOpenCourse"
      @open-full-search="handleCommandFullSearch"
      @run-action="handleCommandAction"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onBeforeUnmount, onUnmounted, watch } from 'vue'
import { postDanmu, DanmuTimeoutError } from '../../utils/danmuRequest'
import { validateCoursesPayload, validateEnrichmentsPayload, validateIsmPayload, validateCourseBodiesPayload } from '../../utils/staticPayload'
import { useRoute, useRouter } from 'vue-router'
import { MAX_READER_SCALE, MIN_READER_SCALE, READER_FONT_KEY, readReaderScale, readerFontCss, stepReaderScale } from '../../utils/readerFont'
import { buildStaticUrl } from '../../config/static.ts'
import { buildApiUrl } from '../../config/api.ts'
import HighlightText from '../../components/HighlightText.vue'
import CourseDrawer from '../../components/CourseDrawer.vue'
import AxisAnatomy from '../../components/AxisAnatomy.vue'
import AxisNeighbors from '../../components/AxisNeighbors.vue'
import EvidenceMarker from '../../components/EvidenceMarker.vue'
import NodeBreadcrumb from '../../components/NodeBreadcrumb.vue'
import NodeNotes from '../../components/NodeNotes.vue'
import ReadingRoute from '../../components/ReadingRoute.vue'
import CodeGuide from '../../components/CodeGuide.vue'
import SearchResults from '../../components/SearchResults.vue'
import CubeNavigation from '../../components/CubeNavigation.vue'
import SpatialCubeExplorer from '../../components/SpatialCubeExplorer.vue'
import CommandPalette from '../../components/CommandPalette.vue'
import { getAdjacentSiblingCodes, getParentCode } from '../../utils/axisStructure'
import { useThemeMode } from '../../utils/themeMode'
import { runViewTransition } from '../../utils/viewTransition'
import { subscribeTabSync } from '../../utils/tabSync'
import { CANONICAL_TONE, TONE_META, getFieldEvidence, type EvidenceTone } from '../../utils/evidence'
import { isNoteEmpty, loadNotes, type NotesState } from '../../utils/notesStore'
import {
  JsonRequestAbortedError,
  JsonRequestTimeoutError,
  fetchJsonWithTimeout
} from '../../utils/jsonRequest'
import {
  createPageViewSession,
  type PageViewSession
} from '../../utils/pageViewSession'
import {
  createIndicatorDrag,
  type IndicatorDragController
} from '../../utils/indicatorDrag'
import {
  findRouteStepByCode,
  isRouteStepDone,
  loadRouteProgress,
  toggleRouteStepDone
} from '../../utils/routeProgress'
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
  normalizeSearchQuery,
  parseRelatedEntry,
  type ParsedRelatedEntry
} from '../../utils/ismFormat'
import {
  buildSearchResults,
  type NodeSearchResult,
  type SearchMatchTabKey
} from '../../utils/searchNodes'

type InfoTabKey = 'overview' | 'courses' | 'editorial' | 'notes'
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
const ismStatus = ref<LoadStatus>('idle')
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

const INFO_FONT_SCALE_STORAGE_KEY = READER_FONT_KEY
const SHOW_EVIDENCE_MARKERS_STORAGE_KEY = 'ismismcube.showEvidenceMarkers'
const SELF_TEST_STORAGE_KEY = 'ismismcube.selfTest'
const GUIDE_SEEN_STORAGE_KEY = 'ismismcube.guideSeen'
const SPATIAL_VIEW_MODE_STORAGE_KEY = 'ismismcube.spatialViewMode'
const axisColor = [
  'var(--axis-field-text)',
  'var(--axis-ontology-text)',
  'var(--axis-epistemology-text)',
  'var(--axis-teleology-text)'
]
const { themeLabel, cycleThemeMode } = useThemeMode()
const mobilePane = ref<'reader' | 'cube'>('reader')
const spatialViewMode = ref<'matrix' | 'cube'>('matrix')
const commandPaletteOpen = ref(false)
const ismInfoFontSize = ref(1.0)
const showEvidenceMarkers = ref(true)
const selfTestMode = ref(false)
const featuresRevealed = ref(false)
const notesState = ref<NotesState>({ version: 1, nodes: {} })
const evidenceLegendItems: { tone: EvidenceTone; examples: string }[] = [
  { tone: 'scoped', examples: '有限定' },
  { tone: 'caution', examples: '部分支撑 / 附提醒' },
  { tone: 'problem', examples: '存在抵牾 / 未能定位' },
  { tone: 'revised', examples: '已据核查修订' }
]
const pageView = ref(-1)
const onlineCount = ref(-1)
const readerContentRef = ref<HTMLElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)
const searchInputText = ref('')
const searchText = ref('')
const leftPartRef = ref<HTMLElement | null>(null)
const sizeAdjusterRef = ref<HTMLElement | null>(null)
const sizeIndicatorRef = ref<HTMLElement | null>(null)
const sizeIndicatorRatio = ref(0)
const cubeZoomPercent = computed(() => Math.round(100 + sizeIndicatorRatio.value * 150))
const cubeScaleTransform = computed(() => `scale(${1 + sizeIndicatorRatio.value * 1.5})`)
const handleCubeZoomInput = (event: Event) => {
  const value = Number((event.currentTarget as HTMLInputElement | null)?.value)
  if (!Number.isFinite(value)) return
  sizeIndicatorRatio.value = (Math.min(250, Math.max(100, value)) - 100) / 150
}

const isLeftPartClosed = ref(false)
const hoveredIsmTag = ref<string | null>(null)
const activeInfoTab = ref<InfoTabKey>('overview')
const nodeHeadingRef = ref<HTMLElement | null>(null)
const featureSectionRef = ref<HTMLElement | null>(null)
const infoTabRefs = new Map<InfoTabKey, HTMLButtonElement>()
const INFO_TAB_ORDER: InfoTabKey[] = ['overview', 'courses', 'editorial', 'notes']
const getInfoTabId = (key: InfoTabKey): string => `info_tab_${key}`
const getInfoPanelId = (key: InfoTabKey): string => `info_panel_${key}`
const setInfoTabRef = (key: InfoTabKey, el: unknown) => {
  if (el && typeof el === 'object' && 'focus' in el) {
    infoTabRefs.set(key, el as HTMLButtonElement)
  } else {
    infoTabRefs.delete(key)
  }
}
let courseJumpFocusToken = 0
let featureRevealFocusToken = 0
let pendingCourseJumpTarget: string | null = null

const courseDrawerOpen = ref(false)
const drawerInitialCourseId = ref<string | undefined>(undefined)
const drawerInitialCategory = ref<DrawerCategoryKey>('dollar_series')
const readingRouteOpen = ref(false)
const codeGuideOpen = ref(false)
const searchResultsOpen = ref(false)
const guideSeen = ref(true)

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
let socketGeneration = 0
let detachSocketListeners: (() => void) | null = null

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

const getNodeTitle = (code: string): string => {
  return getIsmNode(code)?.ch_name ?? ''
}

const readingTitleById = computed<Map<string, string>>(() => {
  const map = new Map<string, string>()
  for (const node of Object.values(enrichmentsData.value?.nodes ?? {})) {
    for (const rd of node.readings) {
      if (rd.source_id && rd.title && !map.has(rd.source_id)) map.set(rd.source_id, rd.title)
    }
  }
  return map
})

const getReadingTitle = (sourceId: string): string => {
  return readingTitleById.value.get(sourceId) ?? ''
}

const routeIsmTag = computed<string>(() => {
  const param = route.params.ismTag
  return typeof param === 'string' ? param : ''
})

const routeStepMatch = computed(() => {
  return routeIsmTag.value ? findRouteStepByCode(routeIsmTag.value) : null
})

const showRouteBanner = computed<boolean>(() => {
  if (!routeStepMatch.value) return false
  return activeIsmTag.value === routeIsmTag.value
})

const activeIsmTag = computed<string>(() => {
  // 笔记页打开时不随魔方悬停切换节点，避免把笔记写到预览中的其他节点
  if (hoveredIsmTag.value && activeInfoTab.value !== 'notes') return hoveredIsmTag.value
  return routeIsmTag.value
})

const currentHasNote = computed<boolean>(() => {
  if (!activeIsmTag.value) return false
  const note = notesState.value.nodes[activeIsmTag.value]
  return Boolean(note && !isNoteEmpty(note))
})

const noteCodesSet = computed<Set<string>>(() => {
  const result = new Set<string>()
  for (const [code, entry] of Object.entries(notesState.value.nodes)) {
    if (entry && !isNoteEmpty(entry)) {
      result.add(code)
    }
  }
  return result
})

const handleNotesUpdated = (nextState: NotesState) => {
  notesState.value = nextState
}

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

const nonEmptyFeatures = computed(() => {
  const highlights = activeEnrichment.value?.review_summary?.highlights
  return (activeIsmData.value?.feature_list ?? [])
    .map((text, originalIndex) => ({
      text,
      originalIndex,
      evidence: getFieldEvidence(highlights, 'feature_list', originalIndex)
    }))
    .filter((item) => item.text !== '')
})

const getCanonicalToneMeta = (canonicalStatus: string) => {
  return TONE_META[CANONICAL_TONE[canonicalStatus] ?? 'scoped']
}

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

// 搜索匹配预计算（防抖后统一遍历 1 次，魔方着色与搜索结果抽屉共用同一套匹配与排序结果）
const trimmedSearchInput = computed(() => normalizeSearchQuery(searchInputText.value))

const isSearchIndexIncomplete = computed(() => {
  return (
    !ismData.value ||
    Boolean(ismLoadError.value) ||
    enrichStatus.value !== 'ready' ||
    coursesStatus.value !== 'ready'
  )
})

const totalNodeCount = computed(() => {
  if (!ismData.value) return 0
  let count = 0
  for (const key of Object.keys(ismData.value)) {
    if (key !== 'introduction' && getIsmNode(key)) count++
  }
  return count
})

const searchResults = computed<NodeSearchResult[]>(() => {
  const q = searchText.value
  if (!q || !ismData.value) return []
  return buildSearchResults({
    ismData: ismData.value,
    getNode: getIsmNode,
    enrichNodes: enrichmentsData.value?.nodes,
    getLinkedCourses: getLinkedCoursesForTag,
    query: q
  })
})

const searchedTags = computed<Set<string>>(() => {
  return new Set(searchResults.value.map((item) => item.code))
})

const searchedCount = computed(() => {
  return searchResults.value.length
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

const infoTabs = computed(() => [
  {
    key: 'overview' as const,
    label: '概览与四轴',
    hasHit: overviewHasSearchHit.value,
    dotClass: 'hit_dot',
    dotTitle: '当前搜索词命中此页'
  },
  {
    key: 'courses' as const,
    label: `课程与讲稿 (${courseTabCount.value})`,
    hasHit: coursesHasSearchHit.value,
    dotClass: 'hit_dot',
    dotTitle: '当前搜索词命中此页'
  },
  {
    key: 'editorial' as const,
    label: `校勘与典籍 (${editorialTabCount.value})`,
    hasHit: editorialHasSearchHit.value,
    dotClass: 'hit_dot',
    dotTitle: '当前搜索词命中此页'
  },
  {
    key: 'notes' as const,
    label: '我的笔记',
    hasHit: currentHasNote.value,
    dotClass: 'note_dot',
    dotTitle: '当前节点有笔记'
  }
])

const selectInfoTab = (tab: InfoTabKey) => {
  activeInfoTab.value = tab
}

const handleInfoTabKeydown = (event: KeyboardEvent, currentIndex: number) => {
  if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
  const count = INFO_TAB_ORDER.length
  let nextIndex: number
  if (event.key === 'ArrowRight') {
    nextIndex = (currentIndex + 1) % count
  } else if (event.key === 'ArrowLeft') {
    nextIndex = (currentIndex - 1 + count) % count
  } else if (event.key === 'Home') {
    nextIndex = 0
  } else if (event.key === 'End') {
    nextIndex = count - 1
  } else {
    return
  }
  event.preventDefault?.()
  const nextTab = INFO_TAB_ORDER[nextIndex]
  activeInfoTab.value = nextTab
  const targetEl = infoTabRefs.get(nextTab)
  if (targetEl && targetEl.isConnected !== false) {
    targetEl.focus()
  }
}

// WebSocket连接管理
const scheduleWebSocketReconnect = (generation: number) => {
  if (isComponentUnmounted || generation !== socketGeneration) return
  if (reconnectTimer !== null) window.clearTimeout(reconnectTimer)
  const timer = window.setTimeout(() => {
    if (isComponentUnmounted || generation !== socketGeneration || reconnectTimer !== timer) return
    reconnectTimer = null
    connectWebSocket()
  }, 3000)
  reconnectTimer = timer
}

const connectWebSocket = () => {
  if (isComponentUnmounted) return
  disconnectWebSocket()
  const generation = socketGeneration
  try {
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}${buildIsmismcubeApiUrl('/online')}`
    const currentSocket = new WebSocket(wsUrl)
    socket = currentSocket
    const ownsSocket = () => !isComponentUnmounted && generation === socketGeneration && socket === currentSocket
    const onOpen = () => {
      if (!ownsSocket()) return
      console.log("WebSocket连接成功")
    }
    const onMessage = (event: MessageEvent) => {
      if (!ownsSocket() || typeof event.data !== 'string') return
      const message = event.data
      if (message.startsWith('broadcast')) {
        try {
          const data = JSON.parse(message.substring(message.indexOf('{')))
          if (data && typeof data === 'object' && !Array.isArray(data) &&
            typeof data.online === 'number' && Number.isFinite(data.online) && Number.isInteger(data.online) && data.online >= 0) onlineCount.value = data.online
        } catch (error) {
          console.error("WebSocket JSON解析失败:", message, error)
        }
      } else if (message.startsWith('danmu')) {
        try {
          const data = JSON.parse(message.substring(message.indexOf('{')))
          if (data && typeof data === 'object' && !Array.isArray(data) && typeof data.content === 'string') spawnDanmu(data.content)
        } catch (error) {
          console.error("弹幕消息解析失败:", message, error)
        }
      } else {
        console.error("WebSocket消息解析失败:", message)
      }
    }
    const onError = (error: Event) => {
      if (!ownsSocket()) return
      console.error("WebSocket连接错误:", error)
    }
    const detach = () => {
      currentSocket.removeEventListener('open', onOpen)
      currentSocket.removeEventListener('message', onMessage)
      currentSocket.removeEventListener('error', onError)
      currentSocket.removeEventListener('close', onClose)
    }
    const onClose = (event: CloseEvent) => {
      if (!ownsSocket()) return
      detach()
      detachSocketListeners = null
      socket = null
      console.log("WebSocket连接关闭:", event.code, event.reason)
      if (event.code !== 1000) scheduleWebSocketReconnect(generation)
    }
    detachSocketListeners = detach
    currentSocket.addEventListener('open', onOpen)
    currentSocket.addEventListener('message', onMessage)
    currentSocket.addEventListener('error', onError)
    currentSocket.addEventListener('close', onClose)
  } catch (error) {
    if (isComponentUnmounted || generation !== socketGeneration) return
    detachSocketListeners?.()
    detachSocketListeners = null
    const failedSocket = socket
    socket = null
    failedSocket?.close(1000, '连接初始化失败')
    console.error("WebSocket连接失败:", error)
    scheduleWebSocketReconnect(generation)
  }
}

const disconnectWebSocket = () => {
  // Invalidate first, including callbacks queued before removeEventListener.
  socketGeneration++
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  const previousSocket = socket
  socket = null
  const detach = detachSocketListeners
  detachSocketListeners = null
  detach?.()
  previousSocket?.close(1000, '页面卸载')
}

// 计算属性
let detachTabSync: (() => void) | null = null

type StaticLoaderKey = 'ism' | 'enrichments' | 'courses' | 'courseBodies'

const JSON_REQUEST_TIMEOUT_MS = 15_000
let isComponentUnmounted = false
const loaderControllers = new Map<StaticLoaderKey, AbortController>()
const loaderTokens = new Map<StaticLoaderKey, number>()
let pageViewSession: PageViewSession | null = null
let indicatorDrag: IndicatorDragController | null = null

interface StaticJsonRequestConfig<T> {
  key: StaticLoaderKey
  path: string
  statusRef: { value: LoadStatus }
  errorRef: { value: string }
  logLabel: string
  timeoutMessage: string
  errorMessage: string
  validate?: (payload: unknown) => boolean
  onSuccess: (payload: T) => void
}

const runStaticJsonRequest = async <T>({
  key,
  path,
  statusRef,
  errorRef,
  logLabel,
  timeoutMessage,
  errorMessage,
  validate,
  onSuccess
}: StaticJsonRequestConfig<T>): Promise<boolean> => {
  if (isComponentUnmounted || statusRef.value === 'loading' || statusRef.value === 'ready') {
    return false
  }

  const token = (loaderTokens.get(key) ?? 0) + 1
  loaderTokens.set(key, token)
  loaderControllers.get(key)?.abort('superseded')
  const controller = new AbortController()
  loaderControllers.set(key, controller)

  const isCurrent = () => !isComponentUnmounted && loaderTokens.get(key) === token

  statusRef.value = 'loading'
  errorRef.value = ''

  try {
    const payload = await fetchJsonWithTimeout<unknown>(buildIsmismcubeStaticUrl(path), {
      signal: controller.signal,
      timeoutMs: JSON_REQUEST_TIMEOUT_MS
    })
    if (!isCurrent()) return false
    if (validate && !validate(payload)) throw new Error(`Invalid UI structure in ${logLabel}`)
    if (loaderControllers.get(key) === controller) {
      loaderControllers.delete(key)
    }
    onSuccess(payload as T)
    statusRef.value = 'ready'
    return true
  } catch (error) {
    if (loaderControllers.get(key) === controller) {
      loaderControllers.delete(key)
    }
    if (!isCurrent()) return false
    if (error instanceof JsonRequestAbortedError) {
      statusRef.value = 'idle'
      return false
    }
    console.error(`Failed to load ${logLabel}:`, error)
    statusRef.value = 'error'
    errorRef.value = error instanceof JsonRequestTimeoutError ? timeoutMessage : errorMessage
    return false
  }
}

const loadEnrichments = () => runStaticJsonRequest<CubeEnrichmentsPayload>({
  key: 'enrichments',
  path: '/cube-enrichments.json',
  statusRef: enrichStatus,
  errorRef: enrichError,
  logLabel: 'cube-enrichments.json',
  validate: validateEnrichmentsPayload,
  timeoutMessage: '讲稿与校勘索引加载超时（15秒），请重试。',
  errorMessage: '讲稿与校勘索引加载失败，请重试。',
  onSuccess: (payload) => {
    enrichmentsData.value = payload
  }
})

const loadCourses = () => runStaticJsonRequest<CoursesPayload>({
  key: 'courses',
  path: '/courses.json',
  statusRef: coursesStatus,
  errorRef: coursesError,
  logLabel: 'courses.json',
  validate: validateCoursesPayload,
  timeoutMessage: '补充课程目录加载超时（15秒），请稍后重试。',
  errorMessage: '补充课程目录加载失败，请稍后重试。',
  onSuccess: (payload) => {
    coursesList.value = payload.courses
  }
})

const loadCourseBodies = () => runStaticJsonRequest<CourseBodiesMap>({
  key: 'courseBodies',
  path: '/course-bodies.json',
  statusRef: bodiesStatus,
  errorRef: bodiesError,
  logLabel: 'course-bodies.json',
  validate: validateCourseBodiesPayload,
  timeoutMessage: '课程摘要正文加载超时（15秒），请重试。',
  errorMessage: '课程摘要正文加载失败，请重试。',
  onSuccess: (payload) => {
    courseBodiesMap.value = payload
  }
})

const loadIsm = async () => {
  const loaded = await runStaticJsonRequest<Record<string, any>>({
    key: 'ism',
    path: '/ism.json',
    statusRef: ismStatus,
    errorRef: ismLoadError,
    logLabel: 'ism.json',
    validate: validateIsmPayload,
    timeoutMessage: '数据加载超时（15秒），请检查网络后重试\n或\n强制重新加载此页面(windows快捷键 Ctrl + F5)',
    errorMessage: '数据加载失败\n\n请检测网络后重试\n或\n强制重新加载此页面(windows快捷键 Ctrl + F5)',
    onSuccess: (payload) => {
      ismData.value = payload
      handleRoute()
    }
  })
  if (loaded && !isComponentUnmounted) {
    void Promise.allSettled([loadEnrichments(), loadCourses()])
  }
}

// 总初始化
const initial = async () => {
  await loadIsm()
  if (isComponentUnmounted) return
  await pageViewSession?.start()
}

const handleRoute = () => {
  const ismTag = route.params.ismTag as string
  if (!ismTag || ismTag === '') {
    document.title = "主义主义魔方"
  } else if (ismData.value && ismData.value[ismTag]) {
    document.title = "主义主义魔方-" + ismData.value[ismTag].ch_name
  }
}

const navigateWithTransition = (action: () => void) => {
  if (typeof document !== 'undefined' && typeof (document as Document & { startViewTransition?: unknown }).startViewTransition === 'function') {
    void runViewTransition(action)
  } else {
    action()
  }
}

const selectMobilePane = (pane: 'reader' | 'cube') => {
  mobilePane.value = pane
  if (pane === 'reader' && isLeftPartClosed.value) {
    isLeftPartClosed.value = false
  }
}

const pinISM = (ismTag: string) => {
  courseJumpFocusToken++
  pendingCourseJumpTarget = null
  const currentIsmTag = route.params.ismTag as string
  navigateWithTransition(() => {
    if (currentIsmTag === ismTag) {
      router.push('/')
    } else {
      router.push('/' + ismTag)
    }
  })
}

const handleSpatialHover = (code: string) => {
  hoveredIsmTag.value = code ? code : null
  if (!code) {
    handleRoute()
  }
}

const handleSpatialSelect = (code: string) => {
  courseJumpFocusToken++
  pendingCourseJumpTarget = null
  hoveredIsmTag.value = null
  if (!code) {
    navigateWithTransition(() => router.push('/'))
    return
  }
  const targetDepth = code.split('-').filter(Boolean).length
  if (routeIsmTag.value === code || targetDepth >= 4) {
    selectMobilePane('reader')
  }
  if (routeIsmTag.value !== code) {
    navigateWithTransition(() => router.push('/' + code))
  }
}

const handleCubeNavigationSelect = (code: string) => {
  hoveredIsmTag.value = null
  selectMobilePane('reader')
  pinISM(code)
}

const openCommandPalette = () => {
  courseJumpFocusToken++
  pendingCourseJumpTarget = null
  courseDrawerOpen.value = false
  readingRouteOpen.value = false
  codeGuideOpen.value = false
  searchResultsOpen.value = false
  commandPaletteOpen.value = true
}

const closeCommandPalette = () => {
  commandPaletteOpen.value = false
}

const handleCommandJumpNode = (code: string) => {
  void handleModalReaderJump(code, 'overview', closeCommandPalette)
}

const handleCommandOpenCourse = (courseId: string) => {
  closeCommandPalette()
  openCourseDrawer(courseId)
}

const handleCommandFullSearch = (query: string) => {
  closeCommandPalette()
  searchInputText.value = query
  openSearchResults()
}

const handleCommandAction = (actionId: 'route' | 'courses' | 'guide' | 'theme' | 'ai' | 'view-toggle') => {
  closeCommandPalette()
  if (actionId === 'route') openReadingRoute()
  else if (actionId === 'courses') openCourseDrawer()
  else if (actionId === 'guide') openCodeGuide()
  else if (actionId === 'theme') cycleThemeMode()
  else if (actionId === 'ai') goToAI()
  else if (actionId === 'view-toggle') {
    spatialViewMode.value = spatialViewMode.value === 'cube' ? 'matrix' : 'cube'
    selectMobilePane('cube')
  }
}

watch(spatialViewMode, (mode) => {
  try {
    localStorage.setItem(SPATIAL_VIEW_MODE_STORAGE_KEY, mode)
  } catch {
    // 忽略本地存储异常
  }
})

const openCourseDrawer = (courseId?: string, category: DrawerCategoryKey = 'dollar_series') => {
  courseJumpFocusToken++
  pendingCourseJumpTarget = null
  commandPaletteOpen.value = false
  readingRouteOpen.value = false
  codeGuideOpen.value = false
  searchResultsOpen.value = false
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

const openReadingRoute = () => {
  courseJumpFocusToken++
  pendingCourseJumpTarget = null
  commandPaletteOpen.value = false
  courseDrawerOpen.value = false
  codeGuideOpen.value = false
  searchResultsOpen.value = false
  readingRouteOpen.value = true
}

const closeReadingRoute = () => {
  readingRouteOpen.value = false
}

const handleRouteJump = (code: string) => {
  if (!canJumpToNode(code)) return
  void handleModalReaderJump(code, 'overview', closeReadingRoute)
}

const markGuideSeen = () => {
  guideSeen.value = true
  try {
    localStorage.setItem(GUIDE_SEEN_STORAGE_KEY, '1')
  } catch {
    // 忽略本地存储异常
  }
}

const openCodeGuide = () => {
  courseJumpFocusToken++
  pendingCourseJumpTarget = null
  commandPaletteOpen.value = false
  courseDrawerOpen.value = false
  readingRouteOpen.value = false
  searchResultsOpen.value = false
  codeGuideOpen.value = true
}

const closeCodeGuide = () => {
  codeGuideOpen.value = false
  markGuideSeen()
}

const openSearchResults = () => {
  courseJumpFocusToken++
  pendingCourseJumpTarget = null
  applySearchNow()
  commandPaletteOpen.value = false
  courseDrawerOpen.value = false
  readingRouteOpen.value = false
  codeGuideOpen.value = false
  searchResultsOpen.value = true
}

const closeSearchResults = () => {
  searchResultsOpen.value = false
}

const handleSearchResultJump = (code: string, tab: SearchMatchTabKey) => {
  if (!canJumpToNode(code)) return
  void handleModalReaderJump(code, tab, closeSearchResults)
}

const canJumpToNode = (code: string): boolean => {
  return Boolean(getIsmNode(code))
}

const isReadableTargetVisible = (el: HTMLElement | null | undefined): el is HTMLElement => {
  if (!el || !el.isConnected) return false
  if (typeof el.getClientRects === 'function' && el.getClientRects().length === 0) return false
  if (typeof getComputedStyle === 'function' && getComputedStyle(el).visibility === 'hidden') return false
  return true
}

const focusCourseJumpTarget = (tab: InfoTabKey): boolean => {
  const tabEl = infoTabRefs.get(tab)
  if (isReadableTargetVisible(tabEl)) {
    tabEl.focus()
    return true
  }
  if (isReadableTargetVisible(nodeHeadingRef.value)) {
    nodeHeadingRef.value.focus()
    return true
  }
  return false
}

const handleModalReaderJump = async (code: string, targetTab: InfoTabKey, close: () => void) => {
  if (!canJumpToNode(code)) return
  const token = ++courseJumpFocusToken
  featureRevealFocusToken++
  pendingCourseJumpTarget = code
  hoveredIsmTag.value = null
  activeInfoTab.value = targetTab
  selectMobilePane('reader')
  close()
  try {
    await router.push('/' + code)
  } catch {
    // 忽略取消或重复导航异常，交由下方状态守卫校验
  }
  await nextTick()
  if (pendingCourseJumpTarget === code) {
    pendingCourseJumpTarget = null
  }
  if (isComponentUnmounted || token !== courseJumpFocusToken) return
  if (routeIsmTag.value !== code || activeIsmTag.value !== code || !activeIsmData.value) return
  if (
    courseDrawerOpen.value ||
    readingRouteOpen.value ||
    codeGuideOpen.value ||
    searchResultsOpen.value ||
    commandPaletteOpen.value ||
    document.querySelector?.('[aria-modal="true"]')
  ) {
    return
  }
  const active = document.activeElement
  const hasExternalFocus = Boolean(
    active &&
    active !== document.body &&
    active !== document.documentElement &&
    (active as { isConnected?: boolean }).isConnected
  )
  if (hasExternalFocus) return
  focusCourseJumpTarget(targetTab)
}

const handleCourseJump = (code: string) => handleModalReaderJump(code, 'overview', closeCourseDrawer)

const handleInlineJump = async (code: string) => {
  if (!canJumpToNode(code)) return
  const source = document.activeElement as HTMLElement | null
  const token = ++courseJumpFocusToken
  featureRevealFocusToken++
  pendingCourseJumpTarget = code
  hoveredIsmTag.value = null
  activeInfoTab.value = 'overview'
  selectMobilePane('reader')
  closeCourseDrawer()
  closeCommandPalette()
  try {
    await router.push('/' + code)
  } catch {
    // Verify the settled destination below, including cancelled navigation.
  }
  await nextTick()
  if (pendingCourseJumpTarget === code) pendingCourseJumpTarget = null
  if (isComponentUnmounted || token !== courseJumpFocusToken) return
  if (routeIsmTag.value !== code || activeIsmTag.value !== code || !activeIsmData.value) return
  if (courseDrawerOpen.value || readingRouteOpen.value || codeGuideOpen.value || searchResultsOpen.value ||
    commandPaletteOpen.value || document.querySelector?.('[aria-modal="true"]')) return
  const active = document.activeElement
  if (active && active !== source && active !== document.body && active !== document.documentElement &&
    (active as HTMLElement).isConnected) return
  // Surviving, enabled step buttons remain useful for repeated navigation.
  if (source && source !== document.body && source !== document.documentElement && isReadableTargetVisible(source) &&
    !('disabled' in source && source.disabled)) return
  if (isReadableTargetVisible(nodeHeadingRef.value)) nodeHeadingRef.value.focus()
}

const jumpToNodeWithTab = (code: string, tab: InfoTabKey) => {
  if (!getIsmNode(code)) return
  courseJumpFocusToken++
  featureRevealFocusToken++
  pendingCourseJumpTarget = null
  hoveredIsmTag.value = null
  activeInfoTab.value = tab
  selectMobilePane('reader')
  closeCourseDrawer()
  closeCommandPalette()
  router.push('/' + code)
}

const jumpToNode = (code: string) => {
  jumpToNodeWithTab(code, 'overview')
}

const jumpToNoteNode = (code: string) => {
  jumpToNodeWithTab(code, 'notes')
}

const saveEvidenceMarkersPreference = () => {
  try {
    localStorage.setItem(SHOW_EVIDENCE_MARKERS_STORAGE_KEY, String(showEvidenceMarkers.value))
  } catch {
    // 忽略本地存储异常
  }
}

const saveSelfTestPreference = () => {
  try {
    localStorage.setItem(SELF_TEST_STORAGE_KEY, String(selfTestMode.value))
  } catch {
    // 忽略本地存储异常
  }
}

const revealFeatures = async () => {
  if (!selfTestMode.value || featuresRevealed.value) return
  const targetCode = activeIsmTag.value
  const targetRouteCode = routeIsmTag.value
  if (!targetCode || !activeIsmData.value || nonEmptyFeatures.value.length === 0) return
  const source = typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null
  const token = ++featureRevealFocusToken
  featuresRevealed.value = true
  await nextTick()
  if (isComponentUnmounted || token !== featureRevealFocusToken) return
  if (!selfTestMode.value || !featuresRevealed.value) return
  if (
    activeInfoTab.value !== 'overview' ||
    routeIsmTag.value !== targetRouteCode ||
    activeIsmTag.value !== targetCode ||
    !activeIsmData.value ||
    nonEmptyFeatures.value.length === 0
  ) {
    return
  }
  if (typeof document === 'undefined') return
  if (
    courseDrawerOpen.value ||
    readingRouteOpen.value ||
    codeGuideOpen.value ||
    searchResultsOpen.value ||
    commandPaletteOpen.value ||
    document.querySelector?.('[aria-modal="true"]')
  ) {
    return
  }
  const active = document.activeElement
  const hasExternalFocus = Boolean(
    active &&
    active !== source &&
    active !== document.body &&
    active !== document.documentElement &&
    (active as { isConnected?: boolean }).isConnected
  )
  if (hasExternalFocus) return
  const target = featureSectionRef.value
  if (!isReadableTargetVisible(target)) return
  target.focus({ preventScroll: true })
}

const saveInfoFontScale = (scale: number) => {
  try {
    localStorage.setItem(INFO_FONT_SCALE_STORAGE_KEY, String(scale))
  } catch {
    // 忽略本地存储异常
  }
}

const resolveInitialInfoFontSize = (): number => {
  try { return readReaderScale(localStorage) } catch { return 1 }
}

const increaseFontSize = () => {
  ismInfoFontSize.value = stepReaderScale(ismInfoFontSize.value, 1)
  saveInfoFontScale(ismInfoFontSize.value)
}

const decreaseFontSize = () => {
  ismInfoFontSize.value = stepReaderScale(ismInfoFontSize.value, -1)
  saveInfoFontScale(ismInfoFontSize.value)
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

const toggleReaderOverview = () => {
  if (isComponentUnmounted) return
  if (!isLeftPartClosed.value && leftPartRef.value?.contains(document.activeElement)) {
    sizeIndicatorRef.value?.focus({ preventScroll: true })
  }
  isLeftPartClosed.value = !isLeftPartClosed.value
}

const handleIndicatorClick = (event: MouseEvent) => {
  // Pointer clicks already commit through the drag owner's mouseup decision.
  if (event.detail === 0) toggleReaderOverview()
}

const setIndicatorActive = (event: MouseEvent) => {
  indicatorDrag?.start(event)
}

// Bound simultaneous visual effects, not message content or the server protocol.
const MAX_ACTIVE_DANMUS = 40
let nextDanmuId = 0
const removeDanmu = (id: number) => {
  activeDanmus.value = activeDanmus.value.filter(danmu => danmu.id !== id)
}

const spawnDanmu = (text: unknown) => {
  if (isComponentUnmounted || !danmuEnabled.value || typeof text !== 'string') return
  const trimmed = text.trim()
  if (trimmed === '') return
  if (!danmuOverlayRef.value) return
  const containerHeight = danmuOverlayRef.value.clientHeight
  const danmuHeight = 40
  const deadZoneHeight = 20
  const maxTop = Math.max(containerHeight - danmuHeight - deadZoneHeight, 0) || 1
  const top = deadZoneHeight + Math.random() * maxTop
  const duration = 6 + Math.random() * 2
  const id = ++nextDanmuId
  const danmuItem: DanmuItem = {
    id,
    text: trimmed,
    top,
    duration
  }
  activeDanmus.value = [...activeDanmus.value, danmuItem].slice(-MAX_ACTIVE_DANMUS)
}

const danmuPending = ref(false)
const danmuStatus = ref('')
let danmuRevision = 0
let danmuGeneration = 0
let danmuController: AbortController | null = null
watch(danmuText, () => { danmuRevision++ }, { flush: 'sync' })

const toggleDanmu = () => {
  danmuEnabled.value = !danmuEnabled.value
  if (!danmuEnabled.value) activeDanmus.value = []
}

const cancelDanmuRequest = () => {
  danmuGeneration++
  const controller = danmuController
  danmuController = null
  controller?.abort('component unmounted')
}

const sendDanmu = async (event?: KeyboardEvent) => {
  if (event && (event.isComposing || event.keyCode === 229 || event.repeat ||
    event.ctrlKey || event.metaKey || event.altKey || event.shiftKey)) return
  if (isComponentUnmounted || !danmuEnabled.value || danmuPending.value) return
  const content = danmuText.value.trim()
  if (!content) { danmuStatus.value = '请输入弹幕内容。'; return }
  const revision = danmuRevision
  const generation = ++danmuGeneration
  const controller = new AbortController()
  danmuController = controller
  danmuPending.value = true
  danmuStatus.value = '正在发送…'
  const current = () => !isComponentUnmounted && generation === danmuGeneration && danmuController === controller
  try {
    await postDanmu(buildIsmismcubeApiUrl('/send_danmu'), content, { signal: controller.signal, timeoutMs: 15_000 })
    if (!current()) return
    if (danmuRevision === revision) {
      danmuText.value = ''
      danmuStatus.value = '已发送。'
    } else danmuStatus.value = '已发送；新草稿已保留。'
  } catch (error) {
    if (!current()) return
    danmuStatus.value = error instanceof DanmuTimeoutError
      ? '发送响应超时，服务器可能已收到；草稿已保留，请确认后再决定是否重发。'
      : '发送失败，草稿已保留，请稍后重试。'
  } finally {
    if (current()) {
      danmuPending.value = false
      danmuController = null
    }
  }
}

let searchDebounceTimer: number | null = null

const applySearchNow = () => {
  if (searchDebounceTimer !== null) {
    window.clearTimeout(searchDebounceTimer)
    searchDebounceTimer = null
  }
  searchText.value = normalizeSearchQuery(searchInputText.value)
}

const clearSearch = () => {
  if (searchDebounceTimer !== null) {
    window.clearTimeout(searchDebounceTimer)
    searchDebounceTimer = null
  }
  searchInputText.value = ''
  searchText.value = ''
  searchResultsOpen.value = false
}

const retryReaderResource = (event: MouseEvent, load: () => unknown) => {
  if (isComponentUnmounted) return
  if (event.currentTarget === document.activeElement && isReadableTargetVisible(readerContentRef.value)) {
    readerContentRef.value.focus()
  }
  void load()
}

const retryFailedSearchIndexes = (event?: MouseEvent) => {
  if (isComponentUnmounted) return
  if (event?.currentTarget === document.activeElement && isReadableTargetVisible(searchInputRef.value)) {
    searchInputRef.value.focus()
  }
  if (enrichStatus.value === 'error') {
    void loadEnrichments()
  }
  if (coursesStatus.value === 'error') {
    void loadCourses()
  }
}

const handleSearchInputEnter = (event: KeyboardEvent) => {
  if (event.isComposing) return
  applySearchNow()
  if (!searchText.value) return
  event.preventDefault()
  openSearchResults()
}

watch(searchInputText, (val) => {
  if (searchDebounceTimer !== null) {
    window.clearTimeout(searchDebounceTimer)
    searchDebounceTimer = null
  }
  const normalized = normalizeSearchQuery(val)
  if (!normalized) {
    searchText.value = ''
    return
  }
  searchDebounceTimer = window.setTimeout(() => {
    searchText.value = normalized
    searchDebounceTimer = null
  }, 120)
})

// 监听路由变化
watch(() => route.params.ismTag, (newTag) => {
  featureRevealFocusToken++
  const tag = typeof newTag === 'string' ? newTag : ''
  if (pendingCourseJumpTarget !== null && tag !== pendingCourseJumpTarget) {
    courseJumpFocusToken++
    pendingCourseJumpTarget = null
  }
  handleRoute()
})

watch(activeIsmTag, () => {
  featureRevealFocusToken++
  featuresRevealed.value = false
})

watch(selfTestMode, (enabled) => {
  featureRevealFocusToken++
  if (!enabled) {
    featuresRevealed.value = false
  }
})

watch(activeInfoTab, () => {
  featureRevealFocusToken++
})

const isEditableEventTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof Element)) return false
  if (target.closest('input, textarea, select')) return true
  if (target instanceof HTMLElement && target.isContentEditable) return true
  const ce = target.closest('[contenteditable]')
  return Boolean(ce && ce.getAttribute('contenteditable') !== 'false')
}

const handleWindowKeydown = (event: KeyboardEvent) => {
  if ((event.ctrlKey || event.metaKey) && !event.altKey && (event.key === 'k' || event.key === 'K')) {
    event.preventDefault()
    if (commandPaletteOpen.value) {
      closeCommandPalette()
    } else {
      openCommandPalette()
    }
    return
  }
  if (event.ctrlKey || event.metaKey || event.altKey) return
  if (event.defaultPrevented) return
  if (isEditableEventTarget(event.target)) return
  if (courseDrawerOpen.value || readingRouteOpen.value || codeGuideOpen.value || searchResultsOpen.value || commandPaletteOpen.value) return

  const routeCode = typeof route.params.ismTag === 'string' ? route.params.ismTag : ''
  if (!routeCode || !canJumpToNode(routeCode)) return

  let targetCode: string | null = null
  if (event.key === '[') {
    targetCode = getAdjacentSiblingCodes(routeCode, canJumpToNode).prev
  } else if (event.key === ']') {
    targetCode = getAdjacentSiblingCodes(routeCode, canJumpToNode).next
  } else if (event.key === 'u' || event.key === 'U') {
    const parent = getParentCode(routeCode)
    targetCode = parent && canJumpToNode(parent) ? parent : null
  } else {
    return
  }

  if (!targetCode) return
  jumpToNode(targetCode)
  event.preventDefault()
}

// 生命周期
onMounted(() => {
  isComponentUnmounted = false
  indicatorDrag?.dispose()
  indicatorDrag = typeof window !== 'undefined' && typeof document !== 'undefined'
    ? createIndicatorDrag({
      window,
      document,
      getIndicator: () => sizeIndicatorRef.value,
      getAdjuster: () => sizeAdjusterRef.value,
      getRatio: () => sizeIndicatorRatio.value,
      setRatio: (ratio) => {
        sizeIndicatorRatio.value = ratio
      },
      toggleOverview: toggleReaderOverview
    })
    : null
  pageViewSession?.cancel('remounted')
  pageViewSession = createPageViewSession({
    url: buildIsmismcubeApiUrl('/page_view'),
    timeoutMs: JSON_REQUEST_TIMEOUT_MS,
    onPageView: (count) => {
      if (!isComponentUnmounted) {
        pageView.value = count
      }
    },
    onConnectWs: () => {
      if (!isComponentUnmounted) {
        connectWebSocket()
      }
    },
    onError: (error) => {
      console.error('Failed to load page view:', error)
    }
  })
  ismInfoFontSize.value = resolveInitialInfoFontSize()
  try {
    const savedMode = localStorage.getItem(SPATIAL_VIEW_MODE_STORAGE_KEY)
    if (savedMode === 'matrix' || savedMode === 'cube') {
      spatialViewMode.value = savedMode
    }
    const saved = localStorage.getItem(SHOW_EVIDENCE_MARKERS_STORAGE_KEY)
    if (saved === 'false' || saved === '0') {
      showEvidenceMarkers.value = false
    } else if (saved === 'true' || saved === '1') {
      showEvidenceMarkers.value = true
    }
    const savedSelfTest = localStorage.getItem(SELF_TEST_STORAGE_KEY)
    if (savedSelfTest === 'true' || savedSelfTest === '1') {
      selfTestMode.value = true
    } else if (savedSelfTest === 'false' || savedSelfTest === '0') {
      selfTestMode.value = false
    }
  } catch {
    // 忽略本地存储异常
  }
  notesState.value = loadNotes()
  loadRouteProgress()
  detachTabSync?.()
  detachTabSync = subscribeTabSync((message) => {
    if (isComponentUnmounted) return
    if (message.type === 'notes-updated') {
      notesState.value = loadNotes()
    } else if (message.type === 'route-updated') {
      loadRouteProgress()
    }
  })
  try {
    guideSeen.value = Boolean(localStorage.getItem(GUIDE_SEEN_STORAGE_KEY))
  } catch {
    guideSeen.value = true
  }
  window.addEventListener('keydown', handleWindowKeydown)
  initial()
})

onBeforeUnmount(() => {
  indicatorDrag?.dispose()
  indicatorDrag = null
})

onUnmounted(() => {
  isComponentUnmounted = true
  activeDanmus.value = []
  cancelDanmuRequest()
  detachTabSync?.()
  detachTabSync = null
  courseJumpFocusToken++
  featureRevealFocusToken++
  pendingCourseJumpTarget = null
  pageViewSession?.cancel('component unmounted')
  pageViewSession = null
  for (const controller of loaderControllers.values()) {
    controller.abort('component unmounted')
  }
  loaderControllers.clear()
  window.removeEventListener('keydown', handleWindowKeydown)
  if (searchDebounceTimer !== null) {
    window.clearTimeout(searchDebounceTimer)
    searchDebounceTimer = null
  }
  disconnectWebSocket()
})
</script>

<style scoped>
#ismismcube-container {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100dvh;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  grid-template-columns: minmax(320px, 44%) 14px minmax(0, 1fr);
  background: var(--surface-canvas);
  color: var(--ink-primary);
  overflow: hidden;
}

@media (prefers-reduced-motion: no-preference) {
  #ismismcube-container {
    transition: grid-template-columns 0.28s var(--ease-out-expo);
  }
}

#ismismcube-container.is_collapsed {
  grid-template-columns: 0px 14px minmax(0, 1fr);
}

/* 顶部统一工作台顶栏 */
#app_topbar {
  grid-row: 1;
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
  padding: 0.5rem 0.9rem;
  background: var(--surface-elevated);
  border-bottom: 1px solid var(--border-subtle);
  box-shadow: var(--shadow-xs);
  z-index: 20;
  min-width: 0;
}

.topbar_brand {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-wrap: wrap;
  min-width: 0;
}

.brand_home_btn {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.22rem 0.45rem 0.22rem 0.22rem;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--ink-primary);
  cursor: pointer;
  text-align: left;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.brand_home_btn:hover {
  background: var(--surface-hover);
  border-color: var(--border-subtle);
}

.brand_mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: #ffffff;
  font-weight: 800;
  font-size: 0.85rem;
  letter-spacing: -0.02em;
  flex-shrink: 0;
}

.brand_copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.brand_title {
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.15;
  color: var(--ink-primary);
}

.brand_subtitle {
  font-size: 0.7rem;
  color: var(--ink-muted);
  line-height: 1.15;
}

.cube_nav_panel {
  flex-shrink: 0;
}

.topbar_nav {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
}

#courses_button {
  box-sizing: content-box;
  height: 1.95rem;
  line-height: 1.95rem;
  padding: 0 0.72rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-subtle);
  background: var(--surface-card);
  color: var(--ink-primary);
  font-size: 0.82rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

#courses_button:hover {
  background: var(--surface-hover);
  border-color: var(--accent);
  color: var(--accent-text);
}

#route_button,
#guide_button,
.topbar_cmd_btn,
.topbar_chip_btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  height: 1.95rem;
  padding: 0 0.72rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-subtle);
  background: var(--surface-card);
  color: var(--ink-primary);
  font-size: 0.82rem;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

#route_button:hover,
#guide_button:hover,
.topbar_cmd_btn:hover,
.topbar_chip_btn:hover {
  background: var(--surface-hover);
  border-color: var(--accent);
  color: var(--accent-text);
}

.topbar_tools {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.topbar_cmd_btn kbd {
  padding: 0.08rem 0.32rem;
  border-radius: 4px;
  border: 1px solid var(--border-subtle);
  background: var(--surface-sunken);
  color: var(--ink-muted);
  font-size: 0.72rem;
  font-family: var(--font-mono);
}

.provenance_chip {
  background: var(--tone-scoped-bg);
  border-color: var(--tone-scoped-border);
  color: var(--tone-scoped-ink);
  font-weight: 600;
}

@supports (anchor-name: --provenance-anchor) {
  #provenance_popover_btn {
    anchor-name: --provenance-anchor;
  }

  #provenance_popover {
    position-anchor: --provenance-anchor;
    inset: auto;
    top: calc(anchor(bottom) + 8px);
    right: anchor(right);
    margin: 0;
  }
}

.provenance_popover_card {
  max-width: min(24rem, calc(100vw - 24px));
  padding: 0.9rem 1rem;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-strong);
  background: var(--surface-elevated);
  color: var(--ink-primary);
  box-shadow: var(--shadow-lg);
}

.provenance_popover_card::backdrop {
  background: transparent;
}

.popover_head {
  font-size: 0.9rem;
  margin-bottom: 0.45rem;
}

.popover_body {
  margin: 0 0 0.65rem;
  font-size: 0.84rem;
  line-height: 1.55;
  color: var(--ink-secondary);
}

.popover_stats {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding-top: 0.5rem;
  border-top: 1px dashed var(--border-subtle);
  font-size: 0.78rem;
  color: var(--ink-muted);
}

.mobile_pane_tabs {
  display: none;
  padding: 0.16rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-subtle);
  background: var(--surface-sunken);
  gap: 0.16rem;
}

.mobile_pane_btn {
  padding: 0.25rem 0.75rem;
  border: none;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--ink-secondary);
  font-size: 0.82rem;
  cursor: pointer;
}

.mobile_pane_btn.active {
  background: var(--surface-elevated);
  color: var(--accent-text);
  font-weight: 600;
  box-shadow: var(--shadow-xs);
}

/* 中央折叠与缩放拖拽滑轨（DOM 在 #left_part 之前以满足键盘顺序） */
#size_adjuster {
  grid-row: 2;
  grid-column: 2;
  position: relative;
  height: calc(100% - 3.5rem);
  align-self: start;
  background: var(--surface-sunken);
  border-inline: 1px solid var(--border-subtle);
  user-select: none;
  z-index: 5;
}

#size_indicator {
  appearance: none;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: 12px;
  height: 3.5rem;
  padding: 0;
  margin: 0;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-strong);
  background: var(--surface-elevated);
  color: var(--ink-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: var(--shadow-xs);
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

#size_indicator:hover {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent-text);
}

#size_indicator:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.indicator_grip {
  font-size: 0.8rem;
  font-weight: 700;
  line-height: 1;
}

/* 左侧阅读与检索工作区 */
#left_part {
  grid-row: 2;
  grid-column: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--surface-panel);
  overflow: hidden;
  container-type: inline-size;
}

#left_part.collapsed {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}

.left_workbench_bar {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.7rem 0.9rem;
  background: var(--surface-elevated);
  border-bottom: 1px solid var(--border-subtle);
}

.search_box_row {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

#search_input {
  width: 100%;
  box-sizing: border-box;
  height: 2.2rem;
  padding: 0 0.75rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-strong);
  background: var(--surface-canvas);
  color: var(--ink-primary);
  font-size: 0.88rem;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

#search_input::placeholder {
  color: var(--ink-muted);
}

#search_input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--focus-ring-soft);
}

#search_status_line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.35rem 0.6rem;
  font-size: 0.76rem;
  color: var(--ink-muted);
}

.search_status_summary,
.search_status_actions {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.clear_search_link {
  padding: 0.14rem 0.48rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-subtle);
  background: var(--surface-card);
  color: var(--accent-text);
  font-size: 0.74rem;
  font-weight: 600;
  cursor: pointer;
}

.clear_search_link:hover {
  background: var(--accent-soft);
  border-color: var(--accent);
}

.left_utility_row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.left_action_group {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.38rem;
}

#ai_button,
#download_button,
#return_button {
  padding: 0.3rem 0.65rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  background: var(--surface-card);
  color: var(--ink-primary);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

#ai_button {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent-text);
  font-weight: 600;
}

#ai_button:hover {
  background: var(--accent);
  color: #ffffff;
}

#download_button:hover:not(:disabled),
#return_button:hover {
  background: var(--surface-hover);
  border-color: var(--border-strong);
}

#download_button:disabled {
  opacity: 0.48;
  cursor: not-allowed;
}

.reader_metrics {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  font-size: 0.76rem;
  color: var(--ink-muted);
}

#page_view,
#online_count {
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
}

#page_view img {
  width: 0.95rem;
  height: 0.95rem;
  opacity: 0.78;
}

/* 阅读器主体 */
#ism_info_wrapper {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

#ism_info {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  color: var(--ink-primary);
}

.reader_font_toolbar {
  position: absolute;
  top: 0.55rem;
  right: 0.85rem;
  z-index: 4;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.18rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-subtle);
  background: color-mix(in oklch, var(--surface-elevated) 90%, transparent);
  backdrop-filter: blur(8px);
  box-shadow: var(--shadow-xs);
}

#increase_fontsize_button,
#decrease_fontsize_button {
  padding: 0.2rem 0.55rem;
  border: none;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--ink-secondary);
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
}

#increase_fontsize_button:hover:not(:disabled),
#decrease_fontsize_button:hover:not(:disabled) {
  background: var(--surface-hover);
  color: var(--accent-text);
}

#increase_fontsize_button:disabled,
#decrease_fontsize_button:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

#ism_info_content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 1.15rem 1rem 2rem;
  outline: none;
  line-height: 1.65;
}

.info_error_box {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.65rem;
  padding: 1rem;
  border-radius: var(--radius-lg);
  border: 1px solid var(--tone-problem-border);
  background: var(--tone-problem-bg);
  color: var(--tone-problem-ink);
  white-space: pre-line;
}

.retry_btn_inline {
  padding: 0.32rem 0.8rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-strong);
  background: var(--surface-elevated);
  color: var(--ink-primary);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
}

.retry_btn_inline:hover:not(:disabled) {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent-text);
}

.info_intro_box {
  padding-top: 1.2rem;
}

.first_visit_guide_banner {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.9rem 1rem;
  margin-bottom: 1.1rem;
  border-radius: var(--radius-lg);
  border: 1px solid var(--accent);
  background: var(--accent-soft);
}

.first_visit_guide_text {
  margin: 0;
  font-size: 0.92em;
  color: var(--ink-primary);
}

.first_visit_guide_actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.intro_guide_btn {
  padding: 0.38rem 0.85rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--accent);
  background: var(--accent);
  color: #ffffff;
  font-size: 0.84em;
  font-weight: 600;
  cursor: pointer;
}

.intro_guide_dismiss_btn {
  padding: 0.38rem 0.85rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-subtle);
  background: var(--surface-elevated);
  color: var(--ink-secondary);
  font-size: 0.84em;
  cursor: pointer;
}

.intro_guide_row {
  margin-top: 1.2rem;
}

.info_intro_box :deep(h1),
.info_intro_box :deep(h2),
.info_intro_box :deep(h3) {
  color: var(--ink-primary);
  margin: 0.9em 0 0.45em;
  line-height: 1.35;
}

.info_intro_box :deep(p),
.info_intro_box :deep(li) {
  color: var(--ink-secondary);
  line-height: 1.72;
}

.info_intro_box :deep(a) {
  color: var(--accent-text);
}

.info_intro_box :deep(hr) {
  border: none;
  border-top: 1px solid var(--border-subtle);
  margin: 1.2rem 0;
}

/* 节点头部与状态标签 */
.node_header {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding-bottom: 0.85rem;
  border-bottom: 1px solid var(--border-subtle);
}

.node_coord_row {
  display: flex;
  align-items: center;
  gap: 0.32rem;
  font-family: var(--font-mono);
}

.coord_box {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.75rem;
  height: 1.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
  background: var(--surface-elevated);
  font-size: 0.95em;
}

.coord_dash {
  color: var(--ink-muted);
  font-weight: 600;
}

.route_node_banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.55rem 0.8rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--accent);
  background: var(--accent-soft);
  font-size: 0.84em;
}

.route_banner_text {
  font-weight: 600;
  color: var(--accent-text);
}

.route_banner_actions {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
}

.route_banner_toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  cursor: pointer;
  color: var(--ink-primary);
}

.route_banner_next_btn {
  padding: 0.25rem 0.65rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--accent);
  background: var(--accent);
  color: #ffffff;
  font-size: 0.85em;
  font-weight: 600;
  cursor: pointer;
}

.node_status_banner {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.status_pill {
  display: inline-flex;
  align-items: center;
  padding: 0.18rem 0.55rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-subtle);
  font-size: 0.76em;
  font-weight: 600;
}

.pill_manual {
  background: var(--tone-revised-bg);
  border-color: var(--tone-revised-border);
  color: var(--tone-revised-ink);
}

.pill_ai,
.pill_ai_warn {
  background: var(--tone-caution-bg);
  border-color: var(--tone-caution-border);
  color: var(--tone-caution-ink);
}

.pill_reviewed {
  background: var(--tone-revised-bg);
  border-color: var(--tone-revised-border);
  color: var(--tone-revised-ink);
}

.pill_partial {
  background: var(--tone-scoped-bg);
  border-color: var(--tone-scoped-border);
  color: var(--tone-scoped-ink);
}

.pill_pending,
.pill_neutral {
  background: var(--surface-sunken);
  color: var(--ink-muted);
}

.pill_unverified {
  background: var(--tone-problem-bg);
  border-color: var(--tone-problem-border);
  color: var(--tone-problem-ink);
}

.summary_evidence_line {
  font-size: 0.8em;
  color: var(--ink-muted);
}

.node_titles {
  margin-top: 0.15rem;
}

.node_ch_name {
  font-size: 1.55em;
  font-weight: 700;
  line-height: 1.25;
  color: var(--ink-primary);
  outline: none;
}

.node_en_name {
  margin-top: 0.2rem;
  font-size: 0.92em;
  color: var(--ink-muted);
  font-style: italic;
}

/* 节点内子标签栏 */
.info_tabs {
  position: sticky;
  top: -1.15rem;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
  padding: 0.6rem 0;
  margin: 0.4rem 0 0.8rem;
  background: color-mix(in oklch, var(--surface-panel) 94%, transparent);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--border-subtle);
}

.info_tab_btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.36rem 0.78rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-subtle);
  background: var(--surface-elevated);
  color: var(--ink-secondary);
  font-size: 0.84em;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.info_tab_btn:hover {
  background: var(--surface-hover);
  color: var(--ink-primary);
}

.info_tab_btn.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #ffffff;
  font-weight: 600;
}

.hit_dot,
.note_dot {
  font-size: 1.15em;
  line-height: 1;
}

.hit_dot {
  color: var(--tone-caution-ink);
}

.note_dot {
  color: var(--tone-revised-ink);
}

.info_tab_btn.active .hit_dot,
.info_tab_btn.active .note_dot {
  color: #ffffff;
}

.tab_panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* 概览核查工具栏与主要特征 */
.evidence_toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.65rem 1rem;
  padding: 0.6rem 0.8rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  background: var(--surface-card);
  font-size: 0.84em;
}

.evidence_toggle_label {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  cursor: pointer;
  color: var(--ink-primary);
  font-weight: 500;
}

.evidence_legend_details {
  font-size: 0.92em;
}

.evidence_legend_summary {
  cursor: pointer;
  color: var(--accent-text);
  font-weight: 600;
}

.evidence_legend_body {
  margin-top: 0.55rem;
  padding: 0.65rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
  background: var(--surface-elevated);
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.evidence_legend_row {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.legend_tone_chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.1rem 0.45rem;
  border-radius: var(--radius-pill);
  border: 1px solid transparent;
  font-size: 0.85em;
  font-weight: 600;
}

.evidence_legend_desc {
  color: var(--ink-secondary);
}

.evidence_legend_footnote {
  padding-top: 0.35rem;
  border-top: 1px dashed var(--border-subtle);
  color: var(--ink-muted);
  font-size: 0.88em;
}

.feature_section {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 0.85rem 0.95rem;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-subtle);
  background: var(--surface-elevated);
  outline: none;
}

.self_test_prompt_box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.self_test_prompt_text {
  color: var(--ink-secondary);
  font-size: 0.92em;
}

.self_test_reveal_btn {
  padding: 0.35rem 0.85rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--accent);
  background: var(--accent);
  color: #ffffff;
  font-size: 0.84em;
  font-weight: 600;
  cursor: pointer;
}

.feature_row {
  color: var(--ink-primary);
  line-height: 1.65;
}

.core_related_section {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 0.8rem 0.9rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  background: var(--surface-card);
  font-size: 0.9em;
}

.related_row a,
.info_card a {
  color: var(--accent-text);
  word-break: break-all;
}

/* 课程与校勘卡片 */
.section_block {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.section_title {
  font-size: 0.95em;
  font-weight: 700;
  color: var(--ink-primary);
}

.empty_hint {
  padding: 0.8rem 0.9rem;
  border-radius: var(--radius-md);
  border: 1px dashed var(--border-subtle);
  color: var(--ink-muted);
  font-size: 0.88em;
}

.error_hint {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  border-color: var(--tone-problem-border);
  background: var(--tone-problem-bg);
  color: var(--tone-problem-ink);
}

.info_card {
  display: flex;
  flex-direction: column;
  gap: 0.42rem;
  padding: 0.8rem 0.95rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  background: var(--surface-elevated);
  box-shadow: var(--shadow-xs);
}

.card_badges {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.mini_badge {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.12rem 0.48rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-subtle);
  background: var(--surface-sunken);
  color: var(--ink-secondary);
  font-size: 0.74em;
  font-weight: 600;
}

.mini_badge.kind,
.mini_badge.series {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent-text);
}

.mini_badge.warn_soft {
  background: var(--tone-problem-bg);
  border-color: var(--tone-problem-border);
  color: var(--tone-problem-ink);
}

.mini_badge.rel_explicit,
.mini_badge.res_resolved {
  background: var(--tone-revised-bg);
  border-color: var(--tone-revised-border);
  color: var(--tone-revised-ink);
}

.mini_badge.rel_editorial,
.mini_badge.res_qualified {
  background: var(--tone-scoped-bg);
  border-color: var(--tone-scoped-border);
  color: var(--tone-scoped-ink);
}

.card_main_link {
  font-size: 0.95em;
  font-weight: 600;
}

.card_actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.bv_code {
  font-family: var(--font-mono);
  font-size: 0.78em;
  color: var(--ink-muted);
}

.mini_action_btn {
  padding: 0.32rem 0.75rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-subtle);
  background: var(--surface-card);
  color: var(--accent-text);
  font-size: 0.8em;
  font-weight: 600;
  cursor: pointer;
}

.mini_action_btn:hover {
  background: var(--accent-soft);
  border-color: var(--accent);
}

.card_meta_line {
  font-size: 0.88em;
  color: var(--ink-secondary);
}

.muted_meta {
  font-size: 0.78em;
  color: var(--ink-muted);
}

.review_stats_bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem 0.85rem;
  padding: 0.55rem 0.8rem;
  border-radius: var(--radius-md);
  background: var(--surface-sunken);
  color: var(--ink-secondary);
  font-size: 0.82em;
  font-weight: 600;
}

.editorial_list {
  margin: 0;
  padding-left: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  color: var(--ink-secondary);
  font-size: 0.9em;
}

.drawer_cta_wrap {
  padding-top: 0.25rem;
}

/* 右侧空间浏览器与弹幕工作区 */
#right_part {
  grid-row: 2;
  grid-column: 3;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--surface-canvas);
  overflow: hidden;
}

.right_part_toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.55rem 0.9rem;
  padding: 0.5rem 0.9rem;
  background: var(--surface-panel);
  border-bottom: 1px solid var(--border-subtle);
}

#cube_zoom_controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1 1 13rem;
  min-width: 0;
  font-size: 0.82rem;
  color: var(--ink-secondary);
}

#cube_zoom_controls label,
#cube_zoom_controls output {
  flex-shrink: 0;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

#cube_zoom_range {
  flex: 1 1 0;
  min-width: 4.5rem;
  max-width: 14rem;
  margin: 0;
  accent-color: var(--accent);
}

#cube_zoom_range:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 3px;
}

#danmu_button_container {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex: 1 1 15rem;
  max-width: 24rem;
  min-width: 0;
}

#danmu_toggle_button {
  flex-shrink: 0;
  padding: 0.28rem 0.68rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-subtle);
  background: var(--surface-elevated);
  color: var(--ink-primary);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
}

#danmu_toggle_button[aria-pressed='true'] {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent-text);
  font-weight: 600;
}

#danmu_toggle_button:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

#danmu_input {
  flex: 1;
  min-width: 0;
  height: 1.9rem;
  padding: 0 0.65rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-strong);
  background: var(--surface-canvas);
  color: var(--ink-primary);
  font-size: 0.8rem;
}

#danmu_input.disabled {
  opacity: 0.48;
  cursor: not-allowed;
}

#right_part_scroll {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

#danmu_overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 30;
}

.danmu_fly {
  position: absolute;
  left: 100%;
  white-space: nowrap;
  padding: 0.22rem 0.7rem;
  border-radius: var(--radius-pill);
  background: color-mix(in oklch, var(--surface-elevated) 85%, transparent);
  border: 1px solid var(--border-subtle);
  color: var(--ink-primary);
  font-size: 0.88rem;
  font-weight: 600;
  box-shadow: var(--shadow-sm);
  animation-name: danmu-scroll;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
}

.danmu_fly.disabled {
  display: none;
}

@keyframes danmu-scroll {
  from { transform: translateX(0); }
  to { transform: translateX(calc(-100vw - 100%)); }
}

#danmu_status {
  position: fixed;
  z-index: 100;
  left: 50%;
  bottom: max(18px, 1.2rem);
  transform: translateX(-50%);
  width: max-content;
  max-width: calc(100vw - 24px);
  pointer-events: none;
  padding: 0.4rem 0.85rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-strong);
  background: var(--surface-elevated);
  color: var(--ink-primary);
  font-size: 0.82rem;
  box-shadow: var(--shadow-md);
  white-space: normal;
  overflow-wrap: anywhere;
}

@media (max-width: 900px) {
  #ismismcube-container,
  #ismismcube-container.is_collapsed {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
  }

  #size_adjuster {
    display: none;
  }

  .mobile_pane_tabs {
    display: inline-flex;
  }

  #ismismcube-container.mobile-pane-reader #right_part {
    display: none;
  }

  #ismismcube-container.mobile-pane-reader #left_part {
    grid-row: 2;
    grid-column: 1;
    display: flex;
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
  }

  #ismismcube-container.mobile-pane-cube #left_part {
    display: none;
  }

  #ismismcube-container.mobile-pane-cube #right_part {
    grid-row: 2;
    grid-column: 1;
    display: flex;
  }

  .brand_subtitle {
    display: none;
  }

  #app_topbar {
    padding: 0.45rem 0.6rem;
    gap: 0.4rem;
  }

  #courses_button,
  #route_button,
  #guide_button,
  .topbar_cmd_btn,
  .topbar_chip_btn {
    padding: 0 0.55rem;
    font-size: 0.78rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  #ismismcube-container,
  #size_indicator,
  .brand_home_btn,
  .info_tab_btn {
    transition: none;
  }

  .danmu_fly {
    animation-duration: 0.01ms !important;
  }
}
</style>
