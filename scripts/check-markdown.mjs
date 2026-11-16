import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import * as marked from 'marked'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const source = fs.readFileSync(new URL('../src/utils/renderMarkdown.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true,
} }).outputText
const mod = { exports: {} }
new Function('require', 'exports', compiled)(id => id === 'marked' ? marked : require(id), mod.exports)
const { renderSafeMarkdown } = mod.exports

// This Node environment has no DOM. Exercise the real installed DOMPurify's
// unsupported path, rather than pretending a fake DOM proves sanitization.
for (const payload of [
  '<img src=x onerror="window.__syntheticXss=true">',
  '<script>alert(1)</script>',
  '<think onclick="alert(1)">thought</think>',
  '<svg onload="alert(1)"></svg>',
  '[bad](javascript:alert(1))',
]) {
  const html = renderSafeMarkdown(payload)
  assert.ok(html.startsWith('<pre>'))
  assert.ok(!html.includes('<img') && !html.includes('<script') && !html.includes('<think') && !html.includes('<svg'))
}
assert.equal(renderSafeMarkdown('<b>&"\'</b>'), '<pre>&lt;b&gt;&amp;&quot;&#39;&lt;/b&gt;</pre>')

let calls = 0
const instrumented = {
  isSupported: true,
  sanitize(html, config) {
    calls++
    assert.ok(html.includes('<think>'), 'real think HTML reaches the final sanitizer')
    assert.ok(!html.includes('think-placeholder'))
    assert.ok(html.includes('<strong>bold</strong>'), 'real marked parses safe Markdown')
    assert.ok(html.includes('<code>code</code>'))
    assert.deepEqual(config.ADD_TAGS, ['think'])
    assert.deepEqual(config.USE_PROFILES, { html: true })
    assert.ok(config.FORBID_ATTR.includes('style'))
    assert.ok(config.FORBID_TAGS.includes('style'))
    return '<think>safe output</think>'
  },
}
assert.equal(renderSafeMarkdown('**bold** and `code`\n\n<think>\n\nreason\n\n</think>', instrumented), '<think>safe output</think>')
assert.equal(calls, 1, 'the sanitizer result is the final returned HTML')
const failing = { isSupported: true, sanitize() { throw Error('DOM unavailable') } }
assert.equal(renderSafeMarkdown('<img onerror="bad()">', failing), '<pre>&lt;img onerror=&quot;bad()&quot;&gt;</pre>')
assert.equal(renderSafeMarkdown(null), '<pre></pre>')
assert.equal(renderSafeMarkdown(undefined, failing), '<pre></pre>')

// An instrumentation purifier observes the real parser output; it does not
// pretend to prove browser DOM sanitization.
const capture = { isSupported: true, sanitize: html => html }
const inline = renderSafeMarkdown('Example: `<think>reason</think>`', capture)
assert.equal(inline, '<p>Example: <code>&lt;think&gt;reason&lt;/think&gt;</code></p>\n')
const literal = '<think>\n**literal**\n</think>'
const fenced = renderSafeMarkdown(`\`\`\`html\n${literal}\n\`\`\``, capture)
assert.equal(fenced, '<pre><code class="language-html">&lt;think&gt;\n**literal**\n&lt;/think&gt;\n</code></pre>\n')
const indented = renderSafeMarkdown('    <think>reason</think>', capture)
assert.equal(indented, '<pre><code>&lt;think&gt;reason&lt;/think&gt;\n</code></pre>\n')
assert.equal([inline, fenced, indented].some(html => html.includes('think-placeholder')), false)
const thought = renderSafeMarkdown('<think>\n\n**reason**\n\n</think>', capture)
assert.ok(thought.includes('<think>') && thought.includes('<strong>reason</strong>') && thought.includes('</think>'))
const streamingThought = renderSafeMarkdown('<think>\nreason', capture)
assert.ok(streamingThought.startsWith('<think>') && streamingThought.includes('reason'))
assert.equal(renderSafeMarkdown(null, capture), '')
console.log('Markdown checks passed (real marked, real DOMPurify SSR fallback, final-sanitize ordering)')
console.log('Browser DOM sanitization still requires browser acceptance; no DOM library is installed locally.')
