import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const positiveInteger = (value, fallback, maximum) => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 && parsed <= maximum ? parsed : fallback
}
const timeout = positiveInteger(process.env.CHECK_TIMEOUT_MS, 20000, 20000)
const heapMb = positiveInteger(process.env.CHECK_HEAP_MB, 512, 512)

// Tests run in separate processes: a wedged event loop cannot bypass this
// parent-side deadline, and assertion diagnostics cannot consume unbounded RAM.
for (const script of ['check-notes.mjs', 'check-search.mjs', 'check-courses.mjs', 'check-requests.mjs', 'check-navigation.mjs', 'check-reader-font.mjs', 'check-progress.mjs', 'check-route-drawer.mjs', 'check-page-view.mjs', 'check-indicator-drag.mjs', 'check-ai-session.mjs', 'check-markdown.mjs', 'check-ai-settings.mjs', 'check-ai-stream.mjs', 'check-online-session.mjs', 'check-scroll-animation.mjs', 'check-reader-tabs.mjs', 'check-self-test.mjs', 'check-adaptive-textarea.mjs', 'check-notice.mjs', 'check-danmu.mjs', 'check-error-page.mjs', 'check-static-payload.mjs']) {
  const started = Date.now()
  const result = spawnSync(process.execPath, [`--max-old-space-size=${heapMb}`, `scripts/${script}`], {
    cwd: root,
    encoding: 'utf8',
    timeout,
    killSignal: 'SIGKILL',
    maxBuffer: 256 * 1024,
    windowsHide: true
  })
  process.stdout.write(result.stdout ?? '')
  process.stderr.write(result.stderr ?? '')
  if (result.error || result.status !== 0) {
    console.error(`${script}: FAIL (${Date.now() - started}ms; ${result.error?.code ?? result.signal ?? `exit ${result.status}`})`)
    process.exitCode = 1
    break
  }
  console.log(`${script}: PASS (${Date.now() - started}ms; heap ${heapMb}MB)`)
}
