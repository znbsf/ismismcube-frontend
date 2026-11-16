import { computed, ref } from 'vue'
import { runViewTransition } from './viewTransition'

export type ThemeMode = 'system' | 'light' | 'dark'
export const THEME_STORAGE_KEY = 'ismismcube.theme.v1'

const systemPrefersDark = ref(false)
const themeMode = ref<ThemeMode>('system')
let mediaQuery: MediaQueryList | null = null
let initialized = false

const isValidTheme = (value: unknown): value is ThemeMode =>
  value === 'system' || value === 'light' || value === 'dark'

const applyThemeToDom = (mode: ThemeMode) => {
  if (typeof document === 'undefined' || !document.documentElement?.dataset) return
  document.documentElement.dataset.theme = mode
}

const syncSystemMedia = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
  try {
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    systemPrefersDark.value = Boolean(mediaQuery.matches)
    const onChange = (event: MediaQueryListEvent) => {
      systemPrefersDark.value = Boolean(event.matches)
    }
    mediaQuery.addEventListener?.('change', onChange)
  } catch {
    systemPrefersDark.value = false
  }
}

export const resolvedTheme = computed<'light' | 'dark'>(() => {
  if (themeMode.value === 'dark') return 'dark'
  if (themeMode.value === 'light') return 'light'
  return systemPrefersDark.value ? 'dark' : 'light'
})

export function useThemeMode() {
  if (!initialized) {
    initialized = true
    syncSystemMedia()
    try {
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(THEME_STORAGE_KEY) : null
      if (isValidTheme(saved)) {
        themeMode.value = saved
      }
    } catch {
      // Ignore storage read blocks in restricted browsing contexts.
    }
    applyThemeToDom(themeMode.value)
  }

  const setThemeMode = (next: ThemeMode) => {
    const commit = () => {
      themeMode.value = next
      applyThemeToDom(next)
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(THEME_STORAGE_KEY, next)
        }
      } catch {
        // Ignore quota/sandboxed storage errors.
      }
    }
    void runViewTransition(commit)
  }

  const cycleThemeMode = () => {
    const order: ThemeMode[] = ['system', 'light', 'dark']
    const currentIdx = order.indexOf(themeMode.value)
    setThemeMode(order[(currentIdx + 1) % order.length])
  }

  const themeLabel = computed(() => {
    if (themeMode.value === 'light') return '浅色'
    if (themeMode.value === 'dark') return '深色'
    return '跟随系统'
  })

  return {
    themeMode,
    resolvedTheme,
    themeLabel,
    setThemeMode,
    cycleThemeMode
  }
}
