<template>
  <textarea
    ref="textareaRef"
    v-model="inputValue"
    rows="1"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readonly"
    :class="['adaptive-textarea', { 'disabled': disabled, 'readonly': readonly }]"
    :style="textareaStyle"
    v-bind="attrs"
    @input="handleInput"
    @focus="(e) => emit('focus', e)"
    @blur="(e) => emit('blur', e)"
    @keydown="(e) => emit('keydown', e)"
  ></textarea>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, useAttrs } from 'vue'

interface Props {
  modelValue?: string
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  minWidth?: string
  maxWidth?: string
  minHeight?: string
  maxHeight?: string
}

interface Emits {
  (e: 'update:modelValue', value: string): void
  (e: 'input', value: string): void
  (e: 'focus', event: FocusEvent): void
  (e: 'blur', event: FocusEvent): void
  (e: 'keydown', event: KeyboardEvent): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: '',
  disabled: false,
  readonly: false,
  minWidth: '0px',
  maxWidth: '100%',
  minHeight: '0px',
  maxHeight: '100%'
})

const emit = defineEmits<Emits>()

const attrs = useAttrs()
const textareaRef = ref<HTMLTextAreaElement>()
const inputValue = ref(props.modelValue)
let resizeRafId: number | null = null
let resizeGeneration = 0
let disposed = false
let resizeObserver: ResizeObserver | null = null
let lastLayout = ''

const supportsNativeFieldSizing =
  typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('field-sizing', 'content')

const textareaStyle = computed(() => {
  return {
    minWidth: props.minWidth,
    maxWidth: props.maxWidth,
    minHeight: props.minHeight,
    maxHeight: props.maxHeight,
    ...(supportsNativeFieldSizing ? { overflowY: 'auto' as const } : {})
  }
})

// 监听外部元素对组件modelValue的修改
watch(() => props.modelValue, (newValue) => {
  inputValue.value = newValue
  scheduleResize()
})

watch(() => [props.minWidth, props.maxWidth, props.minHeight, props.maxHeight, props.placeholder], () => scheduleResize())

watch(inputValue, (newValue) => {
  emit('update:modelValue', newValue)
  emit('input', newValue)
})

// 使用 Canvas 进行文本宽度测量，避免频繁创建 DOM
let canvasContext: CanvasRenderingContext2D | null = null
const getMeasureCanvas = (): CanvasRenderingContext2D | null => {
  if (canvasContext) return canvasContext
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  return (canvasContext = ctx)
}

// 将任意 CSS 长度转换为像素，复用单一测量元素以降低开销
let measureDiv: HTMLDivElement | null = null
const getMeasureDiv = (container: HTMLElement): HTMLDivElement => {
  if (measureDiv && measureDiv.parentElement === container) return measureDiv
  if (measureDiv && measureDiv.parentNode) {
    measureDiv.parentNode.removeChild(measureDiv)
    measureDiv = null
  }
  const el = document.createElement('div')
  el.style.position = 'absolute'
  el.style.visibility = 'hidden'
  el.style.left = '-99999px'
  el.style.top = '0'
  el.style.height = '0'
  el.style.border = '0'
  el.style.padding = '0'
  el.style.margin = '0'
  container.appendChild(el)
  measureDiv = el
  return el
}

const toPx = (val: string, container: HTMLElement, axis: 'width' | 'height' = 'width'): number => {
  if (!val) return 0
  if (val === 'none') return Infinity
  if (val === 'auto') return 0
  if (val.endsWith('px')) return parseFloat(val)
  if (/^-?[\d.]+%$/.test(val)) {
    const size = axis === 'width' ? container.clientWidth : container.clientHeight
    return size * parseFloat(val) / 100
  }
  const el = getMeasureDiv(container)
  el.style.width = axis === 'width' ? val : '0'
  el.style.height = axis === 'height' ? val : '0'
  return el.getBoundingClientRect()[axis]
}

const layoutKey = (): string => {
  const textarea = textareaRef.value
  if (!textarea?.isConnected) return ''
  const parent = textarea.parentElement?.getBoundingClientRect()
  const rect = textarea.getBoundingClientRect()
  // Own height writes are deliberately excluded. Parent geometry is captured
  // after those writes so their ResizeObserver notifications are ignored too.
  return `${parent?.width}:${parent?.height}:${rect.width}`
}

const resizeTextarea = () => {
  const textarea = textareaRef.value
  if (disposed || !textarea?.isConnected) return
  const textareaStyle = getComputedStyle(textarea)
  // 测量宽度
  const measureCanvas = getMeasureCanvas()
  if (measureCanvas) measureCanvas.font = textareaStyle.font
  const raw = (textarea.value || textarea.placeholder || '').split('\n')
  let maxLineWidth = 0
  // const horizontalPadding = parseFloat(textareaStyle.paddingLeft) + parseFloat(textareaStyle.paddingRight)
  for (const line of raw) {
    const lineWidth = measureCanvas?.measureText(line || ' ').width ?? textarea.clientWidth
    // maxLineWidth = Math.max(maxLineWidth, lineWidth + horizontalPadding)
    maxLineWidth = Math.max(maxLineWidth, lineWidth)
  }
  const container = textarea.parentElement || document.body
  const number = (value: string) => Number.parseFloat(value) || 0
  const horizontalPadding = number(textareaStyle.paddingLeft) + number(textareaStyle.paddingRight)
  const horizontalBorder = number(textareaStyle.borderLeftWidth) + number(textareaStyle.borderRightWidth)
  const borderBox = textareaStyle.boxSizing === 'border-box'
  const minWidth = toPx(textareaStyle.minWidth || props.minWidth, container)
  const maxWidth = toPx(textareaStyle.maxWidth || props.maxWidth, container)
  const naturalWidth = maxLineWidth + (borderBox ? horizontalPadding + horizontalBorder : 0)
  const newWidth = Math.min(Math.max(naturalWidth, minWidth), maxWidth)
  textarea.style.width = `${newWidth}px`
  // 计算高度
  const minHeight = toPx(textareaStyle.minHeight || props.minHeight, container, 'height')
  const maxHeight = toPx(textareaStyle.maxHeight || props.maxHeight, container, 'height')
  textarea.style.overflowY = 'hidden'
  textarea.style.height = 'auto'
  // This read forces layout at the final CSS/flex-constrained textarea width,
  // not the canvas width requested above.
  const verticalPadding = number(textareaStyle.paddingTop) + number(textareaStyle.paddingBottom)
  const verticalBorder = number(textareaStyle.borderTopWidth) + number(textareaStyle.borderBottomWidth)
  const contentHeight = Math.max(0, textarea.scrollHeight + (borderBox ? verticalBorder : -verticalPadding))
  let newHeight = Math.max(contentHeight, minHeight)
  if (newHeight > maxHeight) newHeight = maxHeight
  textarea.style.height = `${newHeight}px`
  // Ancestor flex layout may constrain height further. Always keep overflowing
  // text scrollable at the actual used dimensions.
  textarea.style.overflowY = textarea.scrollHeight > textarea.clientHeight + 1 ? 'auto' : 'hidden'
  lastLayout = layoutKey()
}

const scheduleResize = () => {
  if (disposed || supportsNativeFieldSizing || typeof requestAnimationFrame !== 'function') return
  // 前一次执行还没有完成，直接取消前一次执行
  if (resizeRafId !== null) cancelAnimationFrame(resizeRafId)
  const generation = ++resizeGeneration
  resizeRafId = requestAnimationFrame(() => {
    if (disposed || generation !== resizeGeneration) return
    // 执行完成后设置为null
    resizeRafId = null
    resizeTextarea()
  })
}

const handleInput = (event: Event) => {
  const target = event.target as HTMLTextAreaElement
  inputValue.value = target.value
  scheduleResize()
}

onMounted(() => {
  disposed = false
  if (supportsNativeFieldSizing) return
  lastLayout = layoutKey()
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      if (!disposed && layoutKey() !== lastLayout) scheduleResize()
    })
    if (textareaRef.value) {
      resizeObserver.observe(textareaRef.value)
      if (textareaRef.value.parentElement) resizeObserver.observe(textareaRef.value.parentElement)
    }
  }
  window.addEventListener('resize', scheduleResize)
  scheduleResize()
})

onUnmounted(() => {
  disposed = true
  resizeGeneration++
  resizeObserver?.disconnect()
  resizeObserver = null
  window.removeEventListener('resize', scheduleResize)
  if (resizeRafId !== null) cancelAnimationFrame(resizeRafId)
  resizeRafId = null
  if (measureDiv && measureDiv.parentNode) {
    measureDiv.parentNode.removeChild(measureDiv)
    measureDiv = null
  }
})
</script>

<style scoped>
.adaptive-textarea {
  border: none;
  resize: none;
  overflow: hidden;
  font: inherit;
}

@supports (field-sizing: content) {
  .adaptive-textarea {
    field-sizing: content;
    overflow-y: auto;
  }
}

.adaptive-textarea:disabled {
  cursor: not-allowed;
}

</style>
