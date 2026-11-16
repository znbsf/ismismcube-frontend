<template>
  <div id="ai-container">
    <div id="main-container">
      <div id="control-panel" :class="{ collapsed: isControlPanelClosed }" :inert="isControlPanelClosed" ref="controlPanelRef"
        @wheel.passive="interruptPanelDemo" @touchstart.passive="interruptPanelDemo" @pointerdown="interruptPanelDemo"
        @focusin="interruptPanelDemo" @keydown="handlePanelScrollKey">
        <div id="button-area">
          <button id="ismismcube-button" type="button" aria-label="返回主页（主义主义魔方）" @click="goIsmismcube">返回主页</button>
          <button id="return-button" type="button" aria-label="在新窗口打开更多内容" @click="openMoreContent">更多内容</button>
          <button id="save-button" type="button" aria-label="保存对话到本地文件" @click="saveChat"
            :disabled="taskStatus !== 'none' || history.length === 0" :class="{ disabled: taskStatus !== 'none' || history.length === 0 }">保存对话</button>
        </div>
        <div class="divider-line"></div>
        <div id="server-area">
          <div id="connection-status" :class="{
            connected: isWebSocketConnected,
           disconnected: !isWebSocketConnected
          }">{{ isWebSocketConnected ? '服务器已连接' : '服务器连接失败-正在重试' }}</div>
          <div id="queue-info">
            <div id="executed-info">
              <span>已完成:</span>
              <span class="highlight">{{ executedTaskCount == -1 ? '-' : executedTaskCount }}</span>
            </div>
            <div id="waiting-info">
              <span>排队中:</span>
              <span class="highlight">{{ waitingCount == -1 ? '-' : waitingCount }}</span>
            </div>
            <div id="executing-info">
              <span>运行中:</span>
              <span class="highlight">{{ executingCount == -1 ? '-' : executingCount }}</span>
            </div>
          </div>
        </div>
        <div class="divider-line"></div>
        <div id="task-area">
          <div id="task-status">
            <template v-if="taskStatus === 'queue'">
              <div id="queue-status">
                <div id="progress-fill" :style="{ width: waitingProgress + '%' }"></div>
                <div id="progress-text">正在排队</div>
              </div>
            </template>
            <template v-else-if="taskStatus === 'running'">
              <div id="running-status">正在生成对话</div>
            </template>
            <template v-else>
              <div id="none-status">没有排队中的对话</div>
            </template>
          </div>
          <div id="task-info">
            <template v-if="taskStatus === 'queue'">
              <span>排队位置: <span class="highlight">{{ queuePosition===-1 ? waitingCount : queuePosition+1 }}</span> / <span class="highlight">{{ waitingCount===-1 ? '-' : waitingCount }}</span></span>
            </template>
              <template v-else-if="taskStatus === 'running'">
                <div>接收速度: <span class="highlight">{{ fragmentSpeed.toFixed(1) }}</span> 片段/秒</div>
              </template>
            <template v-else>
              <div>可用模型:</div>
              <div id="models-list" role="group" aria-label="选择 AI 模型">
                <template v-if="serverConfig.available_models.length == 0">
                  <div class="model-item">无可用模型</div>
                </template>
                <template v-else>
                  <button v-for="model in serverConfig.available_models"
                    type="button" :aria-pressed="selectedModel === model"
                    :key="model"
                    class="model-item"
                    :class="{ selected: selectedModel == model }"
                    @click="selectModel(model)"
                  >
                    {{ model }}
                  </button>
                </template>
              </div>
              <span class="model-link">
                <a href="https://space.bilibili.com/9168596" target="_blank">本地部署ai应用</a>
                <span>与</span>
                <a href="https://3dxt006znrxma34e9ked1jmanp9ljjg.taobao.com" target="_blank">购买ai整机</a>
              </span>
            </template>
          </div>
        </div>
        <div class="divider-line"></div>
        <div id="introduction-area">
          <div class="intro-item">本网页提供AI对话服务，你可以在左侧选择模型，在右侧的输入栏中输入问题并点击发送按钮，发起一个对话任务。</div>
          <div class="intro-item">本网页最多支持<span class="highlight">{{ serverConfig.max_concurrent_tasks == 0 ? '-' : serverConfig.max_concurrent_tasks }}</span>个对话任务同时运行。如果当前运行中的对话数量小于<span class="highlight">{{ serverConfig.max_concurrent_tasks == 0 ? '-' : serverConfig.max_concurrent_tasks }}</span>个，你提交的对话任务会立刻开始运行并生成回答；否则，你发起的对话任务会进入排队状态。</div>
          <div class="intro-item">当你的对话任务正在排队或运行时，你不能发起新的对话。</div>
        </div>
        <div class="divider-line"></div>
        <div id="notice-area">
          <div class="intro-item">刷新或关闭此网页后，当前页面的对话记录不会保留。如需保存，点击左侧“保存对话”按钮。</div>
          <div class="intro-item">刷新页面、断开网络或关闭浏览器可能中断正在排队或运行的对话任务。</div>
        </div>
        <div class="divider-line"></div>
        <div id="warning-area">
          <div class="intro-item">本网站仅作学习探讨之用，请自行辨别回复内容的正确性。</div>
          <div class="intro-item">本网站制作者、模型训练者以及任何相关个人或组织不对回复的内容承担任何责任。</div>
        </div>
        <div class="divider-line"></div>
        <div id="contact-area">
          <div><a href='https://b23.tv/JACBxVp' target='_blank' rel='noopener noreferrer'>原项目相关 B 站链接</a></div>
          <div><a href='https://github.com/znbsf/ismismcube-frontend/tree/research/source-audit' target='_blank' rel='noopener noreferrer'>本项目 GitHub 仓库与研究分支</a></div>
        </div>
      </div>
      <button id="control-panel-toggle" ref="controlPanelToggleRef" type="button" @click="toggleControlPanel"
        aria-controls="control-panel" :aria-expanded="!isControlPanelClosed"
        :aria-label="isControlPanelClosed ? '展开 AI 控制面板' : '折叠 AI 控制面板'"
        :class="{ collapsed: isControlPanelClosed }">
        <svg v-if="!isControlPanelClosed" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <div id="message-panel" :class="{ widened: isControlPanelClosed }">
        <header id="ai-stage-header" aria-label="AI 对话状态栏">
          <div class="stage_title_group">
            <span class="stage_badge">AI 哲思顾问</span>
            <span class="stage_model_pill">{{ selectedModel || '暂未选择模型' }}</span>
          </div>
          <div class="stage_actions_group">
            <span class="stage_conn_pill" :class="{ connected: isWebSocketConnected }">
              {{ isWebSocketConnected ? '实时连接正常' : '连接中断 · 重试中' }}
            </span>
            <button
              id="ai-theme-button"
              type="button"
              class="stage_theme_btn"
              :title="`当前外观：${themeLabel}（点击切换亮色 / 暗色 / 跟随系统）`"
              @click="cycleThemeMode"
            >
              {{ themeLabel }}
            </button>
          </div>
        </header>
        <div id="message-area-wrapper">
          <div id="message-area-overlay">
            <div v-if="isContentOverflowing" id="generating-indicator">
              <button type="button" @click="scrollToBottom" aria-label="滚动到底部查看最新内容">{{ taskStatus === 'running' ? '↓ 更多内容正在生成中...' : '↓ 查看最新内容' }}</button>
            </div>
          </div>
          <div id="message-area" ref="messageAreaRef" role="region" aria-label="AI 对话内容" tabindex="-1" @scroll="checkContentOverflow"
            @wheel.passive="interruptMessageScroll" @touchstart.passive="interruptMessageScroll"
            @pointerdown="interruptMessageScroll" @keydown="handleMessageScrollKey">
            <div v-if="history.length === 0" class="message assistant welcome-block">
              <div class="content assistant markdown" v-html="renderMarkdown(`你好，我是AI助手。请在左侧选择模型，在下方输入问题并点击发送按钮，向我发起一个对话。`)"></div>
              <div class="starter_chips_grid" role="group" aria-label="常见探讨方向示例">
                <button
                  v-for="starter in starterPrompts"
                  :key="starter.label"
                  type="button"
                  class="starter_chip_btn"
                  @click="applyStarterPrompt(starter.prompt)"
                >
                  <span class="starter_chip_title">{{ starter.label }}</span>
                  <span class="starter_chip_desc">{{ starter.prompt }}</span>
                </button>
              </div>
            </div>
            <div v-for="(msg, i) in history" :key="i" class="message" :class="[msg.role, { 'faded': editingIndex !== -1 && i > editingIndex }]">
              <template v-if="msg.role === 'user'">
                <AdaptiveTextarea v-if="editingIndex === i"
                  v-model="editingContent"
                  class="content user editing"
                  max-width="calc(100% - 3rem)"
                  @keydown.enter="confirmEditing"
                  @keydown.escape="handleEditEscape"
                  @vue:mounted="(vnode: any) => selectAndFocus(vnode)"
                  ref="editingElement"
                />
                <div v-else
                  class="content user"
                >{{ msg.content }}</div>
                <template v-if="taskStatus === 'none'">
                  <button v-if="editingIndex !== i" type="button" class="edit-icon" :data-edit-index="i" @click="startEdit(i)" :aria-label="`编辑第 ${i + 1} 条消息`"
                    :disabled="editingIndex !== -1" :title="editingIndex !== -1 ? '请先完成或取消当前编辑' : '编辑此消息'">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </button>
                  <div v-else class="edit-buttons" @keydown.escape="handleEditEscape">
                    <button type="button" class="edit-button cancel-button" @click="exitEditing" aria-label="取消编辑" title="取消">
                      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </button>
                    <button type="button" class="edit-button confirm-button" @click="confirmEditing" aria-label="确认编辑并重新发送"
                      :disabled="!isWebSocketConnected || taskStatus !== 'none' || !editingContent.trim()" title="确认">
                      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </button>
                  </div>
                </template>
              </template>
              <template v-else>
                <div class="model-label">{{ msg.role }}</div>
                <div class="content assistant markdown" v-html="renderMarkdown(msg.content)"></div>
              </template>
            </div>
          </div>
        </div>
        <p v-if="taskError" class="task_error_notice" role="alert">{{ taskError }}</p>
        <p v-if="taskNotice" class="task_stream_notice" role="status">{{ taskNotice }}</p>
        <p v-if="editingIndex !== -1" class="edit_pending_hint" role="status">请先完成或取消当前编辑</p>
        <div id="input-area">
          <AdaptiveTextarea
            id="input-textarea"
            v-model="inputText"
            @keydown.enter="handleSendEnter"
            min-height="3rem"
            max-height="10rem"
            :placeholder="isWebSocketConnected ? '输入你的问题...' : '等待服务器连接...'"
            :disabled="editingIndex !== -1"
            ref="inputRef"
          />
          <button id="send-stop-button" type="button" @click="handleSendOrStop"
            :disabled="taskStatus === 'none' && (!isWebSocketConnected || editingIndex !== -1)"
            :aria-label="taskStatus === 'none' ? '发送消息' : '停止生成'"
            :class="{ disabled: taskStatus === 'none' && (!isWebSocketConnected || editingIndex !== -1), send: taskStatus === 'none', stop: taskStatus !== 'none' }">{{ taskStatus === 'none' ? '发送' : '停止' }}</button>
          <button
            id="settings-button"
            ref="settingsButtonRef"
            type="button"
            aria-label="对话设置"
            aria-haspopup="dialog"
            :aria-expanded="showSettingsModal"
            @click="openSettingsModal"
            title="对话设置"
          >
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M18.75 12.75h1.5a.75.75 0 0 0 0-1.5h-1.5a.75.75 0 0 0 0 1.5ZM12 6a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 12 6ZM12 18a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 12 18ZM3.75 6.75h1.5a.75.75 0 1 0 0-1.5h-1.5a.75.75 0 0 0 0 1.5ZM5.25 18.75h-1.5a.75.75 0 0 1 0-1.5h1.5a.75.75 0 0 1 0 1.5ZM3 12a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 3 12ZM9 3.75a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5ZM12.75 12a2.25 2.25 0 1 1 4.5 0 2.25 2.25 0 0 1-4.5 0ZM9 15.75a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
    <!-- 对话设置弹窗 -->
    <div v-if="showSettingsModal" id="settings-modal-overlay" @click="closeSettingsModal">
      <div
        id="settings-modal"
        ref="settingsModalRef"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        tabindex="-1"
        @click.stop
        @keydown="handleSettingsModalKeydown"
      >
        <div id="settings-header">
          <h3 id="settings-modal-title">对话设置</h3>
          <button
            id="close-settings"
            type="button"
            aria-label="关闭对话设置"
            title="关闭"
            @click="closeSettingsModal"
          >
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
        <div id="settings-content">
          <div class="setting-item system-prompt-item">
            <label for="setting-prompt">系统提示词 (System Prompt):</label>
            <textarea
              id="setting-prompt"
              v-model="tempChatConfig.prompt"
              class="system-prompt-input"
              placeholder="输入系统提示词..."
            ></textarea>
          </div>
          <div class="setting-item">
            <span id="setting-content-size-label" class="setting-label">最大上下文Token记忆长度 (Context Size):</span>
            <span class="setting-value readonly-value" aria-labelledby="setting-content-size-label">{{ serverChatConfig.content_size }}</span>
          </div>
          <div class="setting-item">
            <span id="setting-max-tokens-label" class="setting-label">最大生成Token数量 (Number Predict):</span>
            <span class="setting-value readonly-value" aria-labelledby="setting-max-tokens-label">{{ serverChatConfig.max_tokens }}</span>
          </div>
          <div class="setting-item">
            <label for="setting-temperature">温度 (Temperature):</label>
            <div class="slider-container">
              <input
                id="setting-temperature"
                type="range"
                v-model.number="tempChatConfig.temperature"
                min="0"
                max="1"
                step="0.01"
                class="slider"
              />
              <span class="setting-value">{{ tempChatConfig.temperature.toFixed(2) }}</span>
            </div>
          </div>
          <div class="setting-item">
            <label for="setting-top-p">Top-p采样 (Top-p Sampling):</label>
            <div class="slider-container">
              <input
                id="setting-top-p"
                type="range"
                v-model.number="tempChatConfig.top_p"
                min="0"
                max="1"
                step="0.01"
                class="slider"
              />
              <span class="setting-value">{{ tempChatConfig.top_p.toFixed(2) }}</span>
            </div>
          </div>
          <div class="setting-item">
            <label for="setting-frequency-penalty">频率惩罚 (Frequency Penalty):</label>
            <div class="slider-container">
              <input
                id="setting-frequency-penalty"
                type="range"
                v-model.number="tempChatConfig.frequency_penalty"
                min="-2"
                max="2"
                step="0.01"
                class="slider"
              />
              <span class="setting-value">{{ tempChatConfig.frequency_penalty.toFixed(2) }}</span>
            </div>
          </div>
          <div class="setting-item">
            <label for="setting-presence-penalty">存在惩罚 (Presence Penalty):</label>
            <div class="slider-container">
              <input
                id="setting-presence-penalty"
                type="range"
                v-model.number="tempChatConfig.presence_penalty"
                min="-2"
                max="2"
                step="0.01"
                class="slider"
              />
              <span class="setting-value">{{ tempChatConfig.presence_penalty.toFixed(2) }}</span>
            </div>
          </div>
          <div class="setting-item">
            <label for="setting-repeat-penalty">重复惩罚 (Repeat Penalty):</label>
            <div class="slider-container">
              <input
                id="setting-repeat-penalty"
                type="range"
                v-model.number="tempChatConfig.repeat_penalty"
                min="0"
                max="2"
                step="0.01"
                class="slider"
              />
              <span class="setting-value">{{ tempChatConfig.repeat_penalty.toFixed(2) }}</span>
            </div>
          </div>
          <div class="settings-actions">
            <button type="button" class="settings-button reset" @click="resetSettings">恢复</button>
            <button type="button" class="settings-button cancel" @click="closeSettingsModal">取消</button>
            <button type="button" class="settings-button save" @click="saveSettings">保存</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, reactive, computed, nextTick } from 'vue'
import { createAiTaskOwner, type AiTaskSession } from '../../utils/aiTaskSession'
import { fetchJsonWithTimeout, JsonRequestTimeoutError } from '../../utils/jsonRequest'
import { createAiStreamStatus } from '../../utils/aiStreamStatus'
import { createAiChatSettings, type AiChatSettings, type EditableAiSettings } from '../../utils/aiChatSettings'
import { createScrollAnimationOwner } from '../../utils/scrollAnimation'
import { useRouter } from 'vue-router'
import AdaptiveTextarea from '@/components/adaptiveTextarea.vue'
import { renderSafeMarkdown as renderMarkdown } from '../../utils/renderMarkdown'
import { buildApiUrl } from '../../config/api.ts'
import { useThemeMode } from '../../utils/themeMode'

const buildAiApiUrl = (path: string): string => {
  return buildApiUrl(`/ai${path.startsWith('/') ? '' : '/'}${path}`)
}

const { themeLabel, cycleThemeMode } = useThemeMode()

const starterPrompts = [
  { label: '四轴坐标入门', prompt: '请用通俗清晰的结构解释「主义主义魔方」中场域论、本体论、认识论与目的论四个坐标轴分别在回答什么哲学问题？' },
  { label: '一元论 vs 二元论', prompt: '在魔方的本体论轴上，1（一元论）与 2（二元论）在面对“主体与客体如何关联”时最本质的分歧是什么？' },
  { label: '存在主义与结构主义', prompt: '对比分析存在主义立场与结构主义立场在自由意志与社会决定结构上的张力。' }
]

interface ServerConfig {
  available_models: string[]
  max_concurrent_tasks: number
}

const router = useRouter()
const taskStatus = ref<'none' | 'queue' | 'running'>('none')
const taskError = ref('')
const taskNotice = ref('')
const isWebSocketConnected = ref(false)
const serverConfig = ref<ServerConfig>({
  available_models: [],
  max_concurrent_tasks: 0
})
const selectedModel = ref<string>('')
const chatSettings = createAiChatSettings()
const pickEditableSettings = (settings: EditableAiSettings): EditableAiSettings => ({
  prompt: settings.prompt,
  temperature: settings.temperature,
  top_p: settings.top_p,
  frequency_penalty: settings.frequency_penalty,
  presence_penalty: settings.presence_penalty,
  repeat_penalty: settings.repeat_penalty
})
const serverChatConfig = ref<AiChatSettings>(chatSettings.serviceDefaults)
const userChatConfig = ref<AiChatSettings>(chatSettings.effective)
const history = ref<Array<{ role: string, content: string }>>([])
const controlPanelRef = ref<HTMLDivElement>()
const controlPanelToggleRef = ref<HTMLButtonElement>()
const messageAreaRef = ref<HTMLDivElement>()
const settingsButtonRef = ref<HTMLButtonElement | null>(null)
const settingsModalRef = ref<HTMLDivElement | null>(null)
const inputRef = ref<{ $el?: HTMLElement } | null>(null)
const inputText = ref('')
const applyStarterPrompt = (prompt: string) => {
  if (editingIndex.value !== -1) return
  inputText.value = prompt
  nextTick(() => {
    const textareaEl = (inputRef.value as { $el?: HTMLElement } | undefined)?.$el?.querySelector('textarea')
    if (textareaEl instanceof HTMLTextAreaElement) {
      textareaEl.focus()
    }
  })
}
const editingContent = ref('')
const editingIndex = ref(-1)
const lastBroadcastFlag = ref(-1)
const executedTaskCount = ref(-1)
const waitingCount = ref(-1)
const executingCount = ref(-1)
const queuePosition = ref(-1)
const streamStatus = createAiStreamStatus()
const fragmentCount = ref(0)
const fragmentSpeed = ref(0.0)
const isContentOverflowing = ref(false)
const showSettingsModal = ref(false)
const isControlPanelClosed = ref(false)
const tempChatConfig = ref<EditableAiSettings>(pickEditableSettings(chatSettings.effective))
let pageDisposed = false
const taskOwner = createAiTaskOwner()
const broadcastOwner = createAiTaskOwner()
const scrollOwner = createScrollAnimationOwner({ isActive: () => !pageDisposed })
const pageController = new AbortController()
let panelScrollTimer: ReturnType<typeof setTimeout> | null = null
let broadcastSocket: WebSocket | null = null
let taskSocket: WebSocket | null = null
let taskReconnectStartTime: number | null = null
const AI_SUBMIT_TIMEOUT_MS = 15_000
const TASK_RECONNECT_TIMEOUT = 10000 // 10秒超时

const waitingProgress = computed(() => {
  if (queuePosition.value === -1 || waitingCount.value === 0) return 100
  return Math.max(0, Math.min(100, ((waitingCount.value - 1 - queuePosition.value) / (waitingCount.value - 1)) * 100))
})

const goIsmismcube = () => router.push('/')

const openMoreContent = () => {
  window.open("https://www.maybered.com", "_blank")
}

const selectModel = (model: string) => {
  selectedModel.value = model
}

let panelFocusToken = 0
const toggleControlPanel = async () => {
  interruptPanelDemo()
  const token = ++panelFocusToken
  if (!isControlPanelClosed.value) {
    if (document.activeElement && controlPanelRef.value?.contains(document.activeElement)) {
      controlPanelToggleRef.value?.focus()
    }
    isControlPanelClosed.value = true
    return
  }
  const active = document.activeElement
  isControlPanelClosed.value = false
  await nextTick()
  if (pageDisposed || token !== panelFocusToken || isControlPanelClosed.value || !controlPanelRef.value?.isConnected) return
  if (document.activeElement !== active && document.activeElement !== document.body) return
  const selected = controlPanelRef.value.querySelector<HTMLElement>('button.model-item[aria-pressed="true"]:not([disabled])')
  const first = controlPanelRef.value.querySelector<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled])')
  const target = selected ?? first
  target?.focus()
}

let settingsFocusToken = 0

const getSettingsFocusableElements = (): HTMLElement[] => {
  const modal = settingsModalRef.value
  if (!modal) return []
  return Array.from(
    modal.querySelectorAll<HTMLElement>(
      'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
    )
  )
}

const syncSettingsRefs = () => {
  serverChatConfig.value = chatSettings.serviceDefaults
  userChatConfig.value = chatSettings.effective
}

const openSettingsModal = async () => {
  if (pageDisposed) return
  const token = ++settingsFocusToken
  tempChatConfig.value = chatSettings.openDraft()
  showSettingsModal.value = true
  await nextTick()
  if (pageDisposed || token !== settingsFocusToken || !showSettingsModal.value) return
  const focusable = getSettingsFocusableElements()
  ;(focusable[0] ?? settingsModalRef.value)?.focus()
}

const resetSettings = () => {
  const reset = chatSettings.resetDraft()
  if (reset) {
    tempChatConfig.value = reset
  }
}

const finishClosingSettingsModal = async () => {
  const token = ++settingsFocusToken
  const activeBeforeClose = document.activeElement
  const wasExternalBeforeClose =
    activeBeforeClose !== null &&
    activeBeforeClose !== document.body &&
    activeBeforeClose !== settingsButtonRef.value &&
    !(settingsModalRef.value?.contains(activeBeforeClose) ?? false)
  showSettingsModal.value = false
  await nextTick()
  if (pageDisposed || token !== settingsFocusToken || showSettingsModal.value) return
  if (wasExternalBeforeClose) return
  const currentActive = document.activeElement
  if (
    currentActive !== null &&
    currentActive !== document.body &&
    currentActive !== activeBeforeClose
  ) {
    return
  }
  settingsButtonRef.value?.focus()
}

const closeSettingsModal = () => {
  chatSettings.cancelDraft()
  tempChatConfig.value = pickEditableSettings(chatSettings.effective)
  void finishClosingSettingsModal()
}

const saveSettings = () => {
  const result = chatSettings.saveDraft(pickEditableSettings(tempChatConfig.value))
  if (!result.ok) return
  syncSettingsRefs()
  tempChatConfig.value = pickEditableSettings(chatSettings.effective)
  void finishClosingSettingsModal()
}

const handleSettingsModalKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    if (event.isComposing || event.keyCode === 229) return
    event.preventDefault()
    event.stopPropagation()
    closeSettingsModal()
    return
  }
  if (event.key !== 'Tab') return
  const focusable = getSettingsFocusableElements()
  if (focusable.length === 0) {
    event.preventDefault()
    settingsModalRef.value?.focus()
    return
  }
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  const active = document.activeElement as HTMLElement | null
  if (!active || !settingsModalRef.value?.contains(active) || active === settingsModalRef.value) {
    event.preventDefault()
    ;(event.shiftKey ? last : first).focus()
    return
  }
  if (event.shiftKey && active === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

const startEdit = (index: number) => {
  if (editingIndex.value !== -1 || taskStatus.value !== 'none' || history.value[index]?.role !== 'user') return
  restoredEditFocus = null
  editingIndex.value = index
  editingContent.value = history.value[index].content
}

const selectAndFocus = (vnode: any) => {
  if (pageDisposed) return
  const restoration = restoredEditFocus
  restoredEditFocus = null
  if (restoration) {
    if (restoration.token !== editFocusToken || !restoration.allowed || editingIndex.value < 0 ||
      showSettingsModal.value || document.querySelector?.('[aria-modal="true"]')) return
    if (document.activeElement !== restoration.source && document.activeElement !== document.body) return
  }
  const element = vnode.el
  if (element) {
    element.focus()
    element.select()
  }
}

let editFocusToken = 0
type PendingEditTransaction = {
  originalHistory: Array<{ role: string; content: string }>
  index: number
  draft: string
  session: AiTaskSession | null
}
let pendingEditTransaction: PendingEditTransaction | null = null
let restoredEditFocus: { token: number; source: Element | null; allowed: boolean } | null = null
const hasPendingEdit = (session: AiTaskSession): boolean =>
  pendingEditTransaction?.session === session && session.active()

const restorePendingEdit = (): boolean => {
  const transaction = pendingEditTransaction
  if (!transaction?.session?.active() || pageDisposed) return false
  pendingEditTransaction = null
  const source = document.activeElement
  const token = ++editFocusToken
  restoredEditFocus = {
    token, source,
    allowed: source === document.body || source === document.documentElement ||
      source === document.querySelector?.('#send-stop-button')
  }
  history.value = transaction.originalHistory.map(message => ({ ...message }))
  editingIndex.value = transaction.index
  editingContent.value = transaction.draft
  taskNotice.value = ''
  const notice = '编辑重发尚未收到正文，已恢复原完整对话并保留编辑草稿，可修改后重试。'
  taskError.value = taskError.value ? `${taskError.value}\n${notice}` : notice
  void nextTick(() => {
    if (restoredEditFocus?.token === token) restoredEditFocus = null
  })
  return true
}

const exitEditing = async () => {
  restoredEditFocus = null
  const index = editingIndex.value
  const token = ++editFocusToken
  const active = document.activeElement
  editingIndex.value = -1
  editingContent.value = ''
  await nextTick()
  if (pageDisposed || token !== editFocusToken || editingIndex.value !== -1) return
  if (document.activeElement !== active && document.activeElement !== document.body) return
  document.querySelector<HTMLElement>(`[data-edit-index="${index}"]`)?.focus()
}

const confirmEditing = async (event?: KeyboardEvent | MouseEvent) => {
  if (event?.shiftKey) return
  if (event && ('isComposing' in event && event.isComposing || 'keyCode' in event && event.keyCode === 229)) return
  if (event && 'repeat' in event && event.repeat) { event.preventDefault(); return }
  event?.preventDefault()
  const index = editingIndex.value
  if (pageDisposed || index < 0 || taskStatus.value !== 'none' || !isWebSocketConnected.value ||
    history.value[index]?.role !== 'user' || !editingContent.value.trim()) return
  const token = ++editFocusToken
  restoredEditFocus = null
  const active = document.activeElement
  const transaction: PendingEditTransaction = {
    originalHistory: history.value.map(message => ({ ...message })),
    index, draft: editingContent.value, session: null
  }
  history.value = transaction.originalHistory.slice(0, index + 1).map(message => ({ ...message }))
  history.value[index].content = editingContent.value.trim()
  editingIndex.value = -1
  editingContent.value = ''
  void callAI(transaction)
  await nextTick()
  if (pageDisposed || token !== editFocusToken) return
  if (document.activeElement !== active && document.activeElement !== document.body) return
  document.querySelector<HTMLElement>('#send-stop-button')?.focus()
}

const handleSendEnter = (event: KeyboardEvent) => {
  if (event.shiftKey || event.isComposing || event.keyCode === 229) return
  if (event.repeat) { event.preventDefault(); return }
  event.preventDefault()
  sendMessage()
}

const handleEditEscape = (event: KeyboardEvent) => {
  if (event.isComposing || event.keyCode === 229) return
  event.preventDefault()
  void exitEditing()
}

let scrollToBottomToken = 0
const prefersReducedMotion = ref(false)
let motionMedia: MediaQueryList | null = null
let removeMotionListener: (() => void) | null = null
let motionGeneration = 0
const cleanupReducedMotion = () => {
  motionGeneration++
  removeMotionListener?.()
  removeMotionListener = null
  motionMedia = null
}
const setupReducedMotion = () => {
  cleanupReducedMotion()
  prefersReducedMotion.value = false
  if (pageDisposed || typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
  try {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    motionMedia = media
    const generation = motionGeneration
    const apply = (matches: boolean) => {
      if (pageDisposed || generation !== motionGeneration || motionMedia !== media) return
      prefersReducedMotion.value = matches
      if (matches) {
        interruptPanelDemo()
        interruptMessageScroll()
      }
    }
    const change = (event: MediaQueryListEvent) => apply(event.matches)
    if (typeof media.addEventListener === 'function' && typeof media.removeEventListener === 'function') {
      media.addEventListener('change', change)
      removeMotionListener = () => media.removeEventListener('change', change)
    } else if (typeof media.addListener === 'function' && typeof media.removeListener === 'function') {
      media.addListener(change)
      removeMotionListener = () => media.removeListener(change)
    }
    apply(media.matches)
  } catch {
    cleanupReducedMotion()
  }
}

const scrollToBottom = async (event?: MouseEvent) => {
  const element = messageAreaRef.value
  const source = event?.currentTarget as HTMLElement | null | undefined
  const restoreFocus = Boolean(source && document.activeElement === source)
  if (pageDisposed || !element) return
  // Only explicit activation may interrupt someone reading an earlier answer.
  if (!event && element.scrollHeight - element.clientHeight - element.scrollTop > 24) {
    checkContentOverflow()
    return
  }
  const token = ++scrollToBottomToken
  await nextTick()
  if (pageDisposed || token !== scrollToBottomToken || messageAreaRef.value !== element || !element.isConnected) return
  if (restoreFocus && source?.isConnected && document.activeElement === source) {
    element.focus({ preventScroll: true })
  }
  scrollOwner.animate(element, () => element.scrollHeight - element.clientHeight, prefersReducedMotion.value ? 0 : 1000, checkContentOverflow)
}

const interruptMessageScroll = () => {
  scrollToBottomToken++
  if (messageAreaRef.value) scrollOwner.cancel(messageAreaRef.value)
  checkContentOverflow()
}

const handleMessageScrollKey = (event: KeyboardEvent) => {
  if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return
  const target = event.target as HTMLElement | null
  if (target?.closest?.('input, textarea, select, button, [contenteditable]')) return
  if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) interruptMessageScroll()
}

let panelDemoCancelled = false
const interruptPanelDemo = () => {
  panelDemoCancelled = true
  if (panelScrollTimer !== null) {
    clearTimeout(panelScrollTimer)
    panelScrollTimer = null
  }
  if (controlPanelRef.value) scrollOwner.cancel(controlPanelRef.value)
}

const handlePanelScrollKey = (event: KeyboardEvent) => {
  if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return
  const target = event.target as HTMLElement | null
  if (target?.closest?.('input, textarea, select, button, [contenteditable]')) return
  if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) interruptPanelDemo()
}

const schedulePanelDemo = () => {
  if (pageDisposed || panelDemoCancelled) return
  if (panelScrollTimer !== null) clearTimeout(panelScrollTimer)
  panelScrollTimer = setTimeout(() => {
    panelScrollTimer = null
    if (!pageDisposed && !panelDemoCancelled) scrollControlPanel()
  }, 500)
}

const scrollControlPanel = () => {
  const element = controlPanelRef.value
  if (pageDisposed || panelDemoCancelled || !element || !element.isConnected) return
  scrollOwner.animate(element, () => element.scrollHeight - element.clientHeight, 1000, () => {
    if (pageDisposed || panelDemoCancelled || controlPanelRef.value !== element || !element.isConnected) return
    scrollOwner.animate(element, 0, 1000)
  })
}

const checkContentOverflow = () => {
  void nextTick(() => {
    if (pageDisposed) return
    const element = messageAreaRef.value
    isContentOverflowing.value = Boolean(element?.isConnected && history.value.length > 0 &&
      element.scrollHeight > element.clientHeight && element.scrollHeight - element.scrollTop - element.clientHeight > 24)
  })
}

const createMessage = (model = selectedModel.value) => {
  const lastMessage = history.value[history.value.length - 1]
  const needNewMessage = !lastMessage || lastMessage.role === 'user'
  if (needNewMessage) {
    history.value.push(reactive({ role: model || 'assistant', content: '' }))
  }
}

const saveChat = () => {
  if (history.value.length === 0) {
    alert('没有对话记录可以保存')
    return
  }
  if (taskStatus.value !== 'none') {
    alert('当前对话正在生成中，无法保存对话记录')
    return
  }
  const now = new Date()
  const firstUserMessage = history.value.find(msg => msg.role === 'user')
  let filename = 'chat.txt'
  if (firstUserMessage) {
    const cleanText = firstUserMessage.content.replace(/[\/:*?"<>|]/g, '').trim()
    filename = cleanText.length > 20 ? cleanText.substring(0, 20) + '....txt' : cleanText + '.txt'
  }
  const currentUrl = window.location.href
  let content = `[AI对话记录]\n`
  content += `网址: ${currentUrl}\n`
  const usedModels = [...new Set(history.value.filter(msg => msg.role !== 'user').map(msg => msg.role))]
  const modelInfo = usedModels.length > 0 ? usedModels.join(', ') : '未知模型'
  content += `模型: [${modelInfo}]\n`
  content += `保存时间: ${now.toLocaleString('zh-CN')}\n`
  content += `对话条数: ${history.value.length}\n`
  content += `--------------------------------\n`
  history.value.forEach((msg, index) => {
    content += `[${index + 1}] ${msg.role}:\n`
    content += `${msg.content}\n\n`
  })
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const updateFragmentSpeed = (content: string) => {
  streamStatus.record(content)
  const snapshot = streamStatus.snapshot()
  fragmentCount.value = snapshot.fragments
  fragmentSpeed.value = snapshot.fragmentsPerSecond
}

const resetStreamStats = () => {
  streamStatus.reset()
  fragmentCount.value = 0
  fragmentSpeed.value = 0
}

const connectBroadcastSocket = () => {
  const session = broadcastOwner.begin()
  if (!session || pageDisposed) return
  try {
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}${buildAiApiUrl('/chat_broadcast')}`
    const socket = new WebSocket(wsUrl)
    broadcastSocket = socket
    const ownsSocket = () => session.active() && broadcastSocket === socket
    session.cleanup(() => {
      socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null
      if (broadcastSocket === socket) broadcastSocket = null
      socket.close(1000, '页面卸载')
    })
    socket.onopen = () => {
      if (!ownsSocket()) return
      console.log("WebSocket连接成功")
      isWebSocketConnected.value = true
    }
    socket.onmessage = (event) => {
      if (!ownsSocket()) return
      const message = event.data
      if (typeof message !== 'string') return
      if (message.startsWith('broadcast')) {
        try {
          const data = JSON.parse(message.substring(message.indexOf('{')))
          if (!data || typeof data !== 'object' || Array.isArray(data)) return
          if (data.broadcast_flag !== undefined) {
            if (typeof data.broadcast_flag !== 'number' || !Number.isFinite(data.broadcast_flag) || data.broadcast_flag < 0) return
            if (data.broadcast_flag <= lastBroadcastFlag.value) {
              return
            }
            lastBroadcastFlag.value = data.broadcast_flag
          }
          if (typeof data.waiting_count === 'number' && Number.isFinite(data.waiting_count) && Number.isInteger(data.waiting_count) && data.waiting_count >= 0) {
            waitingCount.value = data.waiting_count
          }
          if (typeof data.executing_count === 'number' && Number.isFinite(data.executing_count) && Number.isInteger(data.executing_count) && data.executing_count >= 0) {
            executingCount.value = data.executing_count
          }
        } catch (error) {
          console.error("WebSocket JSON解析失败:", message, error)
        }
      }
      else if (message.startsWith('server-config')) {
        try {
          const data = JSON.parse(message.substring(message.indexOf('{')))
          if (data && typeof data === 'object' && !Array.isArray(data)) {
            const availableModels: unknown = data.available_models
            if (Array.isArray(availableModels) && availableModels.every((model): model is string => typeof model === 'string')) {
              const validModels = [...new Set(availableModels.filter(model => model.trim().length > 0))]
              serverConfig.value.available_models = validModels
              selectedModel.value = validModels.includes(selectedModel.value)
                ? selectedModel.value
                : (validModels[0] ?? '')
            }
            if (typeof data.max_concurrent_tasks === 'number' && Number.isFinite(data.max_concurrent_tasks) && Number.isInteger(data.max_concurrent_tasks) && data.max_concurrent_tasks >= 0) {
              serverConfig.value.max_concurrent_tasks = data.max_concurrent_tasks
            }
          }
        } catch (error) {
          console.error("WebSocket JSON解析失败:", message, error)
        }
      }
      else if (message.startsWith('chat-config')) {
        try {
          const data = JSON.parse(message.substring(message.indexOf('{')))
          chatSettings.updateServiceDefaults(data)
          syncSettingsRefs()
        } catch (error) {
          console.error("WebSocket JSON解析失败:", message, error)
        }
      }
      else {
        console.error("WebSocket消息解析失败:", event.data)
      }
    }
    socket.onerror = (error) => {
      if (!ownsSocket()) return
      console.error("WebSocket连接错误:", error)
      isWebSocketConnected.value = false
    }
    socket.onclose = (event) => {
      if (!ownsSocket()) return
      console.log("WebSocket连接关闭:", event.code, event.reason)
      socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null
      broadcastSocket = null
      isWebSocketConnected.value = false
      if (event.code !== 1000) {
        console.log("3秒后尝试重连WebSocket")
        session.later(() => {
          connectBroadcastSocket()
        }, 3000)
      }
    }
  } catch (error) {
    if (!session.active()) return
    console.error("WebSocket连接失败:", error)
    isWebSocketConnected.value = false
    session.later(() => {
      connectBroadcastSocket()
    }, 3000)
  }
}

const disconnectBroadcastSocket = () => {
  broadcastOwner.stop()
  isWebSocketConnected.value = false
}

const connectTaskSocket = (websocketId: string, session: AiTaskSession, taskModel = selectedModel.value) => {
  if (!session.active() || pageDisposed) return
  if (taskReconnectStartTime !== null && Date.now() - taskReconnectStartTime > TASK_RECONNECT_TIMEOUT) {
    console.error("任务WebSocket重连超时，停止重连")
    taskError.value = 'AI 连接恢复超时，收到的内容已保留。请稍后重新发送。'
    disconnectTaskSocket()
    return
  }
  try {
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}${buildAiApiUrl(`/chat_task?id=${encodeURIComponent(websocketId)}`)}`
    const socket = new WebSocket(wsUrl)
    taskSocket = socket
    const ownsSocket = () => session.active() && taskSocket === socket
    const detach = () => { socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null }
    session.cleanup(() => {
      detach()
      if (taskSocket === socket) taskSocket = null
      socket.close(1000, '任务结束')
    })
    socket.onopen = () => {
      if (!ownsSocket()) return
      console.log("任务WebSocket连接成功")
      queuePosition.value = waitingCount.value
    }
    socket.onmessage = (event) => {
      if (!ownsSocket()) return
      if (typeof event.data !== 'string') {
        taskError.value = 'AI 响应格式异常，本次生成已停止，收到的内容已保留。可重新发送。'
        disconnectTaskSocket()
        scrollToBottom()
        return
      }
      const lines = event.data.split('\n')
      for (let message of lines) {
        if (!ownsSocket()) return
        if (message.trim() === '') continue
        if (message.startsWith('broadcast')) {
          try {
            const data = JSON.parse(message.substring(message.indexOf('{')))
            if (data.queue_position !== undefined) {
              if (queuePosition.value > data.queue_position) {
                queuePosition.value = data.queue_position
              }
              taskStatus.value = 'queue'
            }
          } catch (error) {
            console.error("任务WebSocket JSON解析失败:", message, error)
          }
        }
        else if (message.startsWith('error')) {
          taskError.value = 'AI 服务返回错误，已保留收到的内容。可调整问题后重新发送。'
          disconnectTaskSocket()
          scrollToBottom()
          return
        }
        else if (message.startsWith('data')) {
          taskStatus.value = 'running'
          if (message.trim().endsWith('[DONE]')) {
            streamStatus.finish()
            disconnectTaskSocket()
            scrollToBottom()
            return
          }
          try {
            const data = JSON.parse(message.substring(message.indexOf('{')))
            if (data?.error) {
              taskError.value = 'AI 服务返回错误，已保留收到的内容。可调整问题后重新发送。'
              disconnectTaskSocket()
              scrollToBottom()
              return
            }
            if (!data || typeof data !== 'object' || Array.isArray(data) ||
              (data.choices !== undefined && !Array.isArray(data.choices))) throw new Error('Invalid choices')
            if (Array.isArray(data.choices)) {
              for (const item of data.choices) {
                if (!item || typeof item !== 'object' || Array.isArray(item) ||
                  (item.finish_reason !== undefined && item.finish_reason !== null && typeof item.finish_reason !== 'string') ||
                  (item.delta !== undefined && item.delta !== null && (typeof item.delta !== 'object' || Array.isArray(item.delta))) ||
                  (item.delta?.content !== undefined && item.delta.content !== null && typeof item.delta.content !== 'string')) {
                  throw new Error('Invalid choice payload')
                }
              }
            }
            if (data.choices && data.choices.length > 0) {
              const choice = data.choices[0]
              // A nonempty text delta restores generation progress. Handshake,
              // role/queue announcements and empty usage chunks do not reset retries.
              if (typeof choice.delta?.content === 'string' && choice.delta.content.length > 0) taskReconnectStartTime = null
              if (choice.delta && typeof choice.delta.content === 'string' && choice.delta.content) {
                if (choice.delta.content.trim() && hasPendingEdit(session)) pendingEditTransaction = null
                createMessage(taskModel)
                const lastMessage = history.value[history.value.length - 1]
                if (lastMessage && lastMessage.role !== 'user') {
                  lastMessage.content += choice.delta.content
                  updateFragmentSpeed(choice.delta.content)
                  checkContentOverflow()
                }
              }
              if (choice.finish_reason) {
                const notice = streamStatus.finish(choice.finish_reason)
                if (notice) taskNotice.value = notice.trim()
                disconnectTaskSocket()
                scrollToBottom()
                return
              }
            }
          } catch(error) {
            taskError.value = 'AI 响应格式异常，本次生成已停止，收到的内容已保留。可重新发送。'
            disconnectTaskSocket()
            scrollToBottom()
            return
          }
        }
        else {
          console.error("任务WebSocket消息解析失败:", event.data)
        }
      }
    }
    socket.onerror = (error) => {
      if (!ownsSocket()) return
      console.error("任务WebSocket连接错误:", error)
      if (hasPendingEdit(session)) {
        taskError.value = '编辑重发连接出错，尚未收到回答。'
        disconnectTaskSocket()
        scrollToBottom()
      }
    }
    socket.onclose = (event) => {
      if (!ownsSocket()) return
      console.log("任务WebSocket连接关闭:", event.code, event.reason)
      detach()
      taskSocket = null
      if (hasPendingEdit(session)) {
        taskError.value = '编辑重发连接提前结束，尚未收到回答。'
        disconnectTaskSocket()
        scrollToBottom()
        return
      }
      // 如果不是正常关闭，尝试重连
      if (event.code !== 1000) {
        if (taskReconnectStartTime === null) taskReconnectStartTime = Date.now()
        session.later(() => {
          connectTaskSocket(websocketId, session, taskModel)
        }, 1000)
      }
      else {
        taskError.value = 'AI 连接提前结束，收到的内容已保留。可重新发送。'
        disconnectTaskSocket()
        scrollToBottom()
      }
    }
  } catch (error) {
    if (!session.active()) return
    console.error("任务WebSocket连接失败:", error)
    if (hasPendingEdit(session)) {
      taskError.value = '编辑重发连接失败，尚未收到回答。'
      disconnectTaskSocket()
      return
    }
    if (taskReconnectStartTime === null) taskReconnectStartTime = Date.now()
    session.later(() => {
      connectTaskSocket(websocketId, session, taskModel)
    }, 1000)
  }
}

const disconnectTaskSocket = () => {
  restorePendingEdit()
  taskOwner.stop()
  taskReconnectStartTime = null
  queuePosition.value = -1
  taskStatus.value = 'none'
  checkContentOverflow()
}

const handleSendOrStop = () => {
  if (taskStatus.value === 'none') {
    sendMessage()
  } else {
    stopTask()
  }
}

const sendMessage = () => {
  if (taskStatus.value !== 'none' || !isWebSocketConnected.value || editingIndex.value !== -1) return
  if (!inputText.value.trim()) {
    alert('请先输入问题')
    return
  }
  history.value.push({ role: 'user', content: inputText.value.trim() })
  inputText.value = ''
  callAI()
}

const stopTask = () => {
  disconnectTaskSocket()
  resetStreamStats()
}

const callAI = async (editTransaction?: PendingEditTransaction) => {
  const session = taskOwner.begin()
  if (!session || pageDisposed) return
  const taskModel = selectedModel.value
  pendingEditTransaction = editTransaction ?? null
  if (editTransaction) {
    editTransaction.session = session
    session.cleanup(() => {
      if (pendingEditTransaction === editTransaction) pendingEditTransaction = null
    })
  }
  taskError.value = ''
  taskNotice.value = ''
  queuePosition.value = -1
  taskStatus.value = 'queue'
  taskReconnectStartTime = null
  resetStreamStats()
  try {
    const { prompt, ...sampling } = chatSettings.requestSettings
    const result = await fetchJsonWithTimeout<{ websocket_id?: unknown }>(buildAiApiUrl('/send_chat'), {
      timeoutMs: AI_SUBMIT_TIMEOUT_MS,
      method: 'POST',
      signal: session.signal,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...(taskModel ? { model: taskModel } : {}),
        messages: [
          ...(typeof prompt === 'string' && prompt.trim() ? [{
            role: 'system',
            content: prompt
          }] : []),
          ...history.value.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content
          }))
        ],
        ...sampling,
        stream: true
      })
    })
    if (!session.active()) return
    const websocketId = result?.websocket_id
    if (typeof websocketId !== 'string' || !websocketId.trim()) {
      throw new Error('未获取到websocket_id')
    }
    connectTaskSocket(websocketId, session, taskModel)
  } catch (error) {
    if (!session.active()) return
    console.error('AI Error:', error)
    taskError.value = error instanceof JsonRequestTimeoutError
      ? '提交响应超时，服务器可能已接收请求。请确认后再决定是否重试；已有对话已保留。'
      : 'AI 服务暂时不可用，未收到新的回答。请稍后重试；已有对话已保留。'
    restorePendingEdit()
    taskOwner.stop()
    taskStatus.value = 'none'
    resetStreamStats()
    checkContentOverflow()
  }
}

const fetchExecutedTaskCount = async () => {
  try {
    const result = await fetchJsonWithTimeout<{ executed_task?: unknown } | null>(buildAiApiUrl('/executed_task'), {
      method: 'GET', signal: pageController.signal, timeoutMs: 15_000,
    })
    if (pageDisposed) return
    const count = result?.executed_task
    executedTaskCount.value = typeof count === 'number' && Number.isFinite(count) && Number.isInteger(count) && count >= 0 ? count : -1
  } catch (error) {
    if (pageDisposed) return
    console.error('获取已执行任务总数失败:', error)
    executedTaskCount.value = -1
  }
}

onMounted(() => {
  setupReducedMotion()
  connectBroadcastSocket()
  fetchExecutedTaskCount()
  schedulePanelDemo()
})

onUnmounted(() => {
  pageDisposed = true
  cleanupReducedMotion()
  editFocusToken++
  restoredEditFocus = null
  settingsFocusToken++
  scrollToBottomToken++
  scrollOwner.dispose()
  taskOwner.dispose()
  broadcastOwner.dispose()
  pageController.abort()
  if (panelScrollTimer !== null) {
    clearTimeout(panelScrollTimer)
    panelScrollTimer = null
  }
  disconnectBroadcastSocket()
  disconnectTaskSocket()
})
</script>

<style scoped>
#ai-container {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100dvh;
  padding: 0.75rem;
  box-sizing: border-box;
  background: var(--surface-canvas);
  color: var(--ink-primary);
  overflow: hidden;
}

#main-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: 19.5rem minmax(0, 1fr);
  border-radius: var(--radius-xl);
  border: 1px solid var(--border-subtle);
  background: var(--surface-panel);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  transition: grid-template-columns 0.25s var(--ease-out-expo);
}

#main-container:has(#control-panel.collapsed) {
  grid-template-columns: 0px minmax(0, 1fr);
}

/* 左侧控制与队列说明栏 */
#control-panel {
  grid-column: 1;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 0.95rem 1.25rem 0.95rem 0.95rem;
  background: var(--surface-elevated);
  border-right: 1px solid var(--border-subtle);
  font-size: 0.84rem;
  line-height: 1.5;
  color: var(--ink-secondary);
}

#control-panel.collapsed {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  padding: 0;
  border-right: none;
}

#button-area {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.4rem;
}

#ismismcube-button,
#return-button,
#save-button {
  padding: 0.42rem 0.5rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  background: var(--surface-card);
  color: var(--ink-primary);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

#ismismcube-button {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent-text);
}

#ismismcube-button:hover {
  background: var(--accent);
  color: #ffffff;
}

#return-button:hover,
#save-button:hover:not(:disabled) {
  background: var(--surface-hover);
  border-color: var(--border-strong);
}

#save-button:disabled,
#save-button.disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.divider-line {
  height: 1px;
  background: var(--border-subtle);
  flex-shrink: 0;
}

#server-area {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

#connection-status {
  padding: 0.4rem 0.7rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  text-align: center;
  font-size: 0.8rem;
  font-weight: 600;
}

#connection-status.connected {
  background: var(--tone-revised-bg);
  border-color: var(--tone-revised-border);
  color: var(--tone-revised-ink);
}

#connection-status.disconnected {
  background: var(--tone-problem-bg);
  border-color: var(--tone-problem-border);
  color: var(--tone-problem-ink);
}

#queue-info {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.35rem;
}

#executed-info,
#waiting-info,
#executing-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.4rem 0.3rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
  background: var(--surface-card);
  font-size: 0.75rem;
}

.highlight {
  font-weight: 700;
  color: var(--accent-text);
  font-variant-numeric: tabular-nums;
}

.warning {
  font-weight: 700;
  color: var(--tone-problem-ink);
}

#task-area {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

#queue-status {
  position: relative;
  height: 1.75rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-subtle);
  background: var(--surface-sunken);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

#progress-fill {
  position: absolute;
  inset-block: 0;
  left: 0;
  background: var(--accent-soft);
  transition: width 0.25s ease;
}

#progress-text {
  position: relative;
  z-index: 1;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--accent-text);
}

#running-status,
#none-status {
  padding: 0.36rem 0.65rem;
  border-radius: var(--radius-pill);
  text-align: center;
  font-size: 0.8rem;
  font-weight: 600;
}

#running-status {
  background: var(--accent-soft);
  color: var(--accent-text);
}

#none-status {
  background: var(--surface-sunken);
  color: var(--ink-muted);
}

#task-info {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

#models-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.38rem;
}

.model-item {
  padding: 0.34rem 0.68rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-subtle);
  background: var(--surface-card);
  color: var(--ink-primary);
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.model-item:hover {
  background: var(--surface-hover);
  border-color: var(--border-strong);
}

.model-item.selected {
  background: var(--tone-revised-bg);
  border-color: var(--tone-revised-border);
  color: var(--tone-revised-ink);
  font-weight: 700;
}

.model-link,
#contact-area {
  font-size: 0.78rem;
  color: var(--ink-muted);
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.model-link {
  flex-direction: row;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.model-link a,
#contact-area a {
  color: var(--accent-text);
}

#introduction-area,
#notice-area,
#warning-area {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font-size: 0.8rem;
}

/* 左侧面板收起切换按钮 */
#control-panel-toggle {
  position: absolute;
  top: 50%;
  left: 19.5rem;
  transform: translate(-50%, -50%);
  z-index: 15;
  width: 1.5rem;
  height: 3.5rem;
  padding: 0;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-strong);
  background: var(--surface-elevated);
  color: var(--ink-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition: left 0.25s var(--ease-out-expo), background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

#control-panel-toggle.collapsed {
  left: 0.85rem;
}

#control-panel-toggle:hover {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent-text);
}

#control-panel-toggle:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

#control-panel-toggle svg {
  width: 1rem;
  height: 1rem;
}

/* 右侧主聊天区域 */
#message-panel {
  grid-column: 2;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--surface-canvas);
  overflow: hidden;
}

#ai-stage-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.45rem 0.75rem;
  padding: 0.65rem 1.1rem;
  background: var(--surface-elevated);
  border-bottom: 1px solid var(--border-subtle);
}

.stage_title_group,
.stage_actions_group {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.stage_badge {
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--ink-primary);
}

.stage_model_pill,
.stage_conn_pill {
  padding: 0.18rem 0.6rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-subtle);
  background: var(--surface-sunken);
  color: var(--ink-secondary);
  font-size: 0.76rem;
  font-weight: 600;
}

.stage_conn_pill {
  background: var(--tone-problem-bg);
  border-color: var(--tone-problem-border);
  color: var(--tone-problem-ink);
}

.stage_conn_pill.connected {
  background: var(--tone-revised-bg);
  border-color: var(--tone-revised-border);
  color: var(--tone-revised-ink);
}

.stage_theme_btn {
  padding: 0.24rem 0.7rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-subtle);
  background: var(--surface-card);
  color: var(--ink-primary);
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
}

.stage_theme_btn:hover {
  background: var(--surface-hover);
  border-color: var(--accent);
  color: var(--accent-text);
}

#message-area-wrapper {
  position: relative;
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: 1fr;
  overflow: hidden;
}

#message-area-overlay {
  z-index: 4;
  grid-row: 1;
  grid-column: 1;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  padding-bottom: 0.85rem;
}

#generating-indicator {
  pointer-events: auto;
}

#generating-indicator button {
  padding: 0.38rem 0.9rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--accent);
  background: var(--surface-elevated);
  color: var(--accent-text);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: var(--shadow-md);
}

#generating-indicator button:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

#message-area {
  z-index: 1;
  grid-row: 1;
  grid-column: 1;
  overflow-y: auto;
  padding: 1.35rem clamp(0.9rem, 3vw, 2.2rem);
  display: flex;
  flex-direction: column;
  gap: 1.35rem;
  outline: none;
}

.message {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.message.user {
  align-items: flex-end;
}

.message.assistant {
  align-items: flex-start;
}

.message.faded {
  opacity: 0.45;
  transition: opacity 0.25s ease;
}

.welcome-block {
  gap: 0.9rem;
}

.starter_chips_grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr));
  gap: 0.65rem;
  width: min(100%, 54rem);
}

.starter_chip_btn {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.8rem 0.95rem;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-subtle);
  background: var(--surface-elevated);
  color: var(--ink-primary);
  text-align: left;
  cursor: pointer;
  box-shadow: var(--shadow-xs);
  transition: transform 0.14s ease, border-color 0.14s ease, box-shadow 0.14s ease;
}

.starter_chip_btn:hover {
  transform: translateY(-2px);
  border-color: var(--accent);
  box-shadow: var(--shadow-sm);
}

.starter_chip_title {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--accent-text);
}

.starter_chip_desc {
  font-size: 0.8rem;
  line-height: 1.45;
  color: var(--ink-secondary);
}

.content {
  max-width: min(100%, 52rem);
  padding: 0.85rem 1.1rem;
  border-radius: var(--radius-lg);
  font-size: 0.95rem;
  line-height: 1.7;
  border: 1px solid var(--border-subtle);
  background: var(--surface-elevated);
  color: var(--ink-primary);
  box-shadow: var(--shadow-xs);
  white-space: pre-wrap;
  word-break: break-word;
}

.content.user {
  background: var(--accent-soft);
  border-color: color-mix(in oklch, var(--accent) 40%, var(--border-subtle));
  border-bottom-right-radius: 4px;
}

.content.assistant {
  border-bottom-left-radius: 4px;
}

.model-label {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--ink-muted);
  margin-bottom: 0.28rem;
  padding-inline: 0.25rem;
}

.edit-button,
.copy-button {
  margin-top: 0.35rem;
  padding: 0.22rem 0.45rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-subtle);
  background: var(--surface-elevated);
  color: var(--ink-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.edit-button svg,
.copy-button svg {
  width: 0.9rem;
  height: 0.9rem;
}

.edit-button:hover,
.copy-button:hover {
  color: var(--accent-text);
  border-color: var(--accent);
}

.edit-actions {
  margin-top: 0.45rem;
  display: flex;
  gap: 0.45rem;
}

.confirm-button,
.cancel-button {
  padding: 0.3rem 0.8rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-subtle);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
}

.confirm-button {
  background: var(--accent);
  border-color: var(--accent);
  color: #ffffff;
}

.cancel-button {
  background: var(--surface-elevated);
  color: var(--ink-secondary);
}

/* Markdown 内容排版 */
.markdown {
  white-space: normal !important;
  overflow-wrap: break-word;
}

.markdown :deep(p) {
  margin: 0.5em 0;
}

.markdown :deep(p:first-child) {
  margin-top: 0;
}

.markdown :deep(p:last-child) {
  margin-bottom: 0;
}

.markdown :deep(think) {
  display: block;
  margin: 0.6em 0;
  padding: 0.65rem 0.85rem;
  border-radius: var(--radius-md);
  border-left: 3px solid var(--accent);
  background: var(--surface-sunken);
  color: var(--ink-muted);
  font-size: 0.88em;
  line-height: 1.6;
}

.markdown :deep(pre) {
  overflow-x: auto;
  padding: 0.8rem 0.95rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  background: var(--surface-sunken);
  font-family: var(--font-mono);
  font-size: 0.86em;
}

.markdown :deep(code) {
  font-family: var(--font-mono);
  font-size: 0.88em;
  padding: 0.1em 0.32em;
  border-radius: 4px;
  background: var(--surface-sunken);
}

.markdown :deep(pre code) {
  padding: 0;
  background: transparent;
}

.markdown :deep(blockquote) {
  margin: 0.65em 0;
  padding: 0.35em 0.85em;
  border-left: 3px solid var(--border-strong);
  color: var(--ink-secondary);
}

.markdown :deep(ul),
.markdown :deep(ol) {
  padding-left: 1.4em;
  margin: 0.5em 0;
}

.markdown :deep(table) {
  border-collapse: collapse;
  max-width: 100%;
  display: block;
  overflow-x: auto;
}

.markdown :deep(th),
.markdown :deep(td) {
  padding: 0.4rem 0.65rem;
  border: 1px solid var(--border-subtle);
}

/* 状态提示与底部输入区 */
.task_error_notice,
.task_stream_notice,
.edit_pending_hint {
  margin: 0.35rem 1.1rem 0;
  padding: 0.45rem 0.8rem;
  border-radius: var(--radius-md);
  font-size: 0.82rem;
}

.task_error_notice {
  background: var(--tone-problem-bg);
  border: 1px solid var(--tone-problem-border);
  color: var(--tone-problem-ink);
}

.task_stream_notice,
.edit_pending_hint {
  background: var(--tone-scoped-bg);
  border: 1px solid var(--tone-scoped-border);
  color: var(--tone-scoped-ink);
}

#input-area {
  flex-shrink: 0;
  display: flex;
  align-items: flex-end;
  gap: 0.55rem;
  padding: 0.8rem 1.1rem;
  background: var(--surface-elevated);
  border-top: 1px solid var(--border-subtle);
}

#input-textarea {
  flex: 1;
  min-width: 0;
  padding: 0.65rem 0.85rem;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-strong);
  background: var(--surface-canvas);
  color: var(--ink-primary);
  font-size: 0.94rem;
  line-height: 1.5;
}

#send-stop-button {
  flex-shrink: 0;
  height: 2.75rem;
  padding: 0 1.15rem;
  border-radius: var(--radius-lg);
  border: 1px solid transparent;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
}

#send-stop-button.send {
  background: var(--accent);
  color: #ffffff;
}

#send-stop-button.stop {
  background: var(--tone-problem-bg);
  border-color: var(--tone-problem-border);
  color: var(--tone-problem-ink);
}

#send-stop-button:disabled,
#send-stop-button.disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

#settings-button {
  flex-shrink: 0;
  width: 2.75rem;
  height: 2.75rem;
  padding: 0;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-subtle);
  background: var(--surface-card);
  color: var(--ink-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

#settings-button:hover {
  background: var(--surface-hover);
  border-color: var(--accent);
  color: var(--accent-text);
}

#settings-button svg {
  width: 1.25rem;
  height: 1.25rem;
}

/* 对话设置弹窗 */
#settings-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: var(--surface-overlay);
  backdrop-filter: blur(5px);
}

#settings-modal {
  width: min(36rem, 100%);
  max-height: 90dvh;
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-xl);
  border: 1px solid var(--border-strong);
  background: var(--surface-elevated);
  color: var(--ink-primary);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  outline: none;
}

#settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.9rem 1.15rem;
  border-bottom: 1px solid var(--border-subtle);
}

#settings-modal-title {
  margin: 0;
  font-size: 1.02rem;
  font-weight: 700;
}

#close-settings {
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-subtle);
  background: var(--surface-card);
  color: var(--ink-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

#close-settings svg {
  width: 1rem;
  height: 1rem;
}

#settings-content {
  overflow-y: auto;
  padding: 1rem 1.15rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.86rem;
}

.system-prompt-input {
  width: 100%;
  min-height: 5.5rem;
  box-sizing: border-box;
  padding: 0.6rem 0.75rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-strong);
  background: var(--surface-canvas);
  color: var(--ink-primary);
  font-family: inherit;
  font-size: 0.86rem;
  resize: vertical;
}

.readonly-value {
  padding: 0.35rem 0.65rem;
  border-radius: var(--radius-sm);
  background: var(--surface-sunken);
  color: var(--ink-secondary);
  font-family: var(--font-mono);
}

.slider-container {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.slider {
  flex: 1;
  accent-color: var(--accent);
}

.setting-value {
  min-width: 3.2rem;
  text-align: right;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.settings-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.55rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-subtle);
}

.settings-button {
  padding: 0.42rem 0.95rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-subtle);
  background: var(--surface-card);
  color: var(--ink-primary);
  font-size: 0.84rem;
  font-weight: 600;
  cursor: pointer;
}

.settings-button.save {
  background: var(--accent);
  border-color: var(--accent);
  color: #ffffff;
}

@media (max-width: 900px), (orientation: portrait) {
  #ai-container {
    padding: 0;
  }

  #main-container {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) auto;
    border-radius: 0;
    border: none;
  }

  #main-container:has(#control-panel.collapsed) {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) 0px;
  }

  #message-panel {
    grid-column: 1;
    grid-row: 1;
  }

  #control-panel {
    grid-column: 1;
    grid-row: 2;
    max-height: 36dvh;
    border-right: none;
    border-top: 1px solid var(--border-subtle);
  }

  #control-panel.collapsed {
    height: 0;
    max-height: 0;
    padding: 0;
    border-top: none;
    overflow: hidden;
  }

  #control-panel-toggle {
    top: auto;
    bottom: 36dvh;
    left: 0.9rem;
    transform: rotate(-90deg);
    transition: bottom 0.25s var(--ease-out-expo);
  }

  #control-panel-toggle.collapsed {
    bottom: 0.7rem;
    left: 0.9rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  #ai-container,
  #ai-container :deep(*),
  #ai-container::before,
  #ai-container::after,
  #ai-container :deep(*::before),
  #ai-container :deep(*::after) {
    animation: none !important;
    transition: none !important;
    scroll-behavior: auto !important;
  }
  .model-item.selected { background-color: green; }
}
</style>
