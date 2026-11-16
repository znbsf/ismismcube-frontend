<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <main class="error_page">
    <section class="error_card" aria-labelledby="error_title">
      <h1 id="error_title">页面不存在</h1>
      <p>这个地址没有对应的页面。请检查网址，或返回首页继续浏览。</p>
      <RouterLink class="home_link" to="/">返回首页</RouterLink>
    </section>
  </main>
</template>

<style scoped>
.error_page {
  box-sizing: border-box;
  min-width: 0;
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: clamp(16px, 4vw, 40px);
  background: var(--surface-canvas);
  color: var(--ink-primary);
  font-size: max(16px, 1rem);
  line-height: 1.6;
}
.error_card {
  box-sizing: border-box;
  width: 100%;
  max-width: 34rem;
  min-width: 0;
  padding: clamp(24px, 5vw, 44px);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl);
  background: var(--surface-elevated);
  box-shadow: var(--shadow-md);
  text-align: center;
  overflow-wrap: anywhere;
}
h1 { margin: 0 0 0.5em; font-size: 1.85em; line-height: 1.25; }
p { margin: 0 0 1.5em; color: var(--ink-secondary); }
.home_link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  max-width: 100%;
  box-sizing: border-box;
  padding: 10px 22px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--accent);
  background: var(--accent);
  color: var(--ink-inverse);
  font-weight: 500;
  text-decoration: none;
  transition: background-color 0.15s ease, transform 0.15s ease;
}
.home_link:hover { background: var(--accent-hover); }
.home_link:focus-visible { outline: none; box-shadow: var(--focus-ring); }
</style>
