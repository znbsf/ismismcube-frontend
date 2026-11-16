import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { createRenderer, createSSRApp, h, markRaw, nextTick } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import * as routerRuntime from 'vue-router'
import { parse, compileScript, compileStyle } from 'vue/compiler-sfc'

const require = createRequire(import.meta.url)
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
const source = fs.readFileSync(new URL('../src/pages/error/error.vue', import.meta.url), 'utf8')
const descriptor = parse(source).descriptor
const component = { exports: {} }
new Function('require', 'exports', compile(compileScript(descriptor, { id: 'error-page-check', inlineTemplate: true }).content))(
  id => id === 'vue-router' ? routerRuntime : require(id), component.exports)
const ErrorPage = component.exports.default
const routesModule = { exports: {} }
new Function('require', 'exports', compile(fs.readFileSync(new URL('../src/routes.ts', import.meta.url), 'utf8')))(require, routesModule.exports)
const Placeholder = { render: () => h('main', '已到达有效页面') }
const router = () => createRouter({ history: createMemoryHistory(), routes: routesModule.exports.resolvedRoutes.map(route => ({
  ...route, component: route.name === 'notFound' ? ErrorPage : Placeholder,
})) })
const node = (type, text = '') => markRaw({ type, text, props: {}, children: [], parent: null })
const all = (root, predicate) => [...(predicate(root) ? [root] : []), ...root.children.flatMap(child => all(child, predicate))]
const text = root => root.text + root.children.map(text).join('')
const { createApp } = createRenderer({
  createElement: node, createText: value => node('#text', value), createComment: value => node('#comment', value),
  patchProp(el, key, _old, value) { el.props[key] = value },
  insert(el, parent, anchor) {
    if (el.parent) el.parent.children.splice(el.parent.children.indexOf(el), 1)
    el.parent = parent
    const index = anchor ? parent.children.indexOf(anchor) : -1
    parent.children.splice(index < 0 ? parent.children.length : index, 0, el)
  },
  remove(el) { if (el.parent) el.parent.children.splice(el.parent.children.indexOf(el), 1); el.parent = null },
  setText(el, value) { el.text = value }, setElementText(el, value) { el.children = []; el.text = value },
  parentNode: el => el.parent, nextSibling: el => el.parent?.children[el.parent.children.indexOf(el) + 1] ?? null,
})
{
  const routing = router()
  await routing.push('/missing-error-test'); await routing.isReady()
  const app = createApp({ render: () => h(RouterView) }); app.use(routing)
  const root = node('root'); app.mount(root); await nextTick()
  assert.equal(routing.currentRoute.value.name, 'notFound')
  assert.equal(routing.currentRoute.value.meta.title, '页面不存在')
  assert.equal(routing.currentRoute.value.path, '/missing-error-test', 'error page never auto-redirects')
  assert.equal(all(root, el => el.type === 'iframe').length, 0, 'actual rendered page has no nested document')
  assert.equal(text(all(root, el => el.type === 'h1')[0]), '页面不存在')
  const link = all(root, el => el.type === 'a')[0]
  assert.equal(link.props.href, '/')
  assert.equal(text(link), '返回首页')
  await link.props.onClick({ button: 0, preventDefault() {}, currentTarget: { getAttribute: () => null } })
  await nextTick(); await nextTick()
  assert.equal(routing.currentRoute.value.name, 'home')
  assert.ok(text(root).includes('已到达有效页面'))
  await routing.push('/1-2-3-4'); await nextTick()
  assert.equal(routing.currentRoute.value.name, 'ismDetail', 'existing valid-node route recognition is unchanged')
  app.unmount()
}
{
  assert.equal(typeof window, 'undefined', 'SSR check runs without a browser window')
  const routing = router()
  await routing.push('/another/missing/page'); await routing.isReady()
  const app = createSSRApp({ render: () => h(RouterView) }); app.use(routing)
  const html = await renderToString(app)
  assert.ok(html.includes('<main') && html.includes('<h1') && html.includes('页面不存在'))
  assert.ok(html.includes('href="/"') && html.includes('返回首页'))
  assert.ok(!html.includes('<iframe'))
  assert.equal(routing.currentRoute.value.meta.title, '页面不存在')
}
assert.equal(compileStyle({ source: descriptor.styles[0].content, filename: 'error.vue', id: 'error-page-check', scoped: true }).errors.length, 0)
console.log('Error page checks passed (actual component + memory router + SSR; no browser/network)')
