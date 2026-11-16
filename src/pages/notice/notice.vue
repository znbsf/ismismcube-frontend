<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { buildApiUrl } from '../../config/api.ts'
import { fetchJsonWithTimeout } from '../../utils/jsonRequest'

const pageView = ref(-1)
const controller = new AbortController()
let disposed = false

onMounted(async () => {
  try {
    // 仅读取累计访问数（GET 只读，浏览公告不会新增访问）
    const data = await fetchJsonWithTimeout<{ page_view?: unknown } | null>(buildApiUrl('/ismismcube/page_view'), {
      method: 'GET', signal: controller.signal, timeoutMs: 15_000,
    })
    if (disposed) return
    const count = data?.page_view
    pageView.value = typeof count === 'number' && Number.isFinite(count) && Number.isInteger(count) && count >= 0 ? count : -1
  } catch (error) {
    if (disposed) return
    pageView.value = -1
    console.error('Failed to load page view:', error)
  }
})

onUnmounted(() => {
  disposed = true
  controller.abort('notice unmounted')
})
</script>

<template>
  <main class="notice-page">
    <div class="notice-box">
      <div class="cube-mark" aria-hidden="true"></div>

      <h1 class="site-title">
        <span class="title-cn">主义主义魔方</span>
        <span class="title-en">ISMISMCUBE</span>
      </h1>

      <p class="notice-text">这里是主义主义魔方项目的公告页面。项目源码与研究资料可在下方查看。</p>

      <hr class="divider" aria-hidden="true">

      <p class="visit-line">
        网站累计访问 <span class="visit-number">{{ pageView === -1 ? '-' : pageView.toLocaleString() }}</span> 次。<br>
        更多内容：<a class="more-url" href="https://www.maybered.com" target="_blank" rel="noopener noreferrer">https://www.maybered.com</a>
      </p>

      <div class="github-block">
        <p class="github-label">本网站源代码及相关数据已在 GitHub 开源：</p>
        <a
          class="github-link"
          href="https://github.com/znbsf/ismismcube-frontend/tree/research/source-audit"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span class="github-url">https://github.com/znbsf/ismismcube-frontend/tree/research/source-audit</span>
        </a>
      </div>
    </div>
  </main>
</template>

<style scoped>
.notice-page {
  box-sizing: border-box;
  min-height: 100dvh;
  min-width: 0;
  display: flex;
  padding: clamp(1rem, 4vw, 2.5rem);
  background-color: var(--surface-canvas);
  color: var(--ink-primary);
}

.notice-box {
  box-sizing: border-box;
  width: min(36rem, 100%);
  min-width: 0;
  margin: auto;
  padding: clamp(1.5rem, 5vw, 2.75rem) clamp(1.25rem, 5vw, 3rem);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl);
  background: var(--surface-elevated);
  box-shadow: var(--shadow-md);
  text-align: center;
  overflow-wrap: anywhere;
}

.cube-mark {
  width: 2.5rem;
  height: 2.5rem;
  margin: 0.25rem auto 1.25rem;
  background-image: radial-gradient(var(--accent) 1.5px, transparent 1.5px);
  background-size: 0.625rem 0.625rem;
  opacity: 0.85;
}

.site-title {
  font-size: clamp(1.85rem, 5vw, 2.75rem);
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: 0.06em;
  color: var(--ink-primary);
}

.title-en {
  display: block;
  margin-top: 0.4rem;
  font-family: var(--font-serif);
  font-size: 0.52em;
  font-weight: 400;
  letter-spacing: 0.24em;
  color: var(--ink-muted);
}

.notice-text {
  margin-top: 1.35rem;
  font-size: 1.05rem;
  line-height: 1.85;
  color: var(--ink-primary);
}

.divider {
  width: 100%;
  border: none;
  border-top: 1px solid var(--border-subtle);
  margin: 1.4rem auto;
}

.visit-line {
  margin-top: 0.5rem;
  font-size: 1rem;
  line-height: 1.85;
  color: var(--ink-secondary);
}

.visit-number {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  color: var(--accent-text);
}

.more-url {
  color: var(--accent-text);
  text-decoration: underline;
  text-underline-offset: 3px;
  word-break: break-all;
}

.github-block {
  margin-top: 1.6rem;
  max-width: 100%;
  min-width: 0;
}

.github-label {
  margin-bottom: 0.35rem;
  font-size: 0.95rem;
  color: var(--ink-muted);
}

.github-link {
  display: inline-block;
  max-width: 100%;
  white-space: normal;
  overflow-wrap: anywhere;
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--accent-text);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.github-link:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
  border-radius: var(--radius-xs);
}

@media (orientation: portrait) {
  .notice-page {
    padding: 1rem;
  }

  .notice-box {
    width: 100%;
    padding: 1.5rem 1.25rem;
  }
}
</style>
