# 未提交改动 Review 与修改建议

- 范围：`ismismcube-frontend` 工作区相对 `HEAD (9ddce6c)` 的未提交改动——`vite.config.ts`、`src/pages/ismismcube/ismismcube.vue`、新增的 `CourseDrawer.vue` / `HighlightText.vue` / `src/types` / `src/utils`、`scripts/build-research.py`、`scripts/check-research.py`，以及它们生成的 `public/*.json`。
- 日期：2026-11-14
- 未覆盖：`research/*.md` 与各批次 JSON 的**内容正确性**（哲学/文献层面）没有审；只查了数据与前端之间的结构一致性。

## 已执行的检查

| 检查 | 结果 |
| --- | --- |
| `npx vue-tsc --noEmit -p tsconfig.app.json` | 通过，无报错 |
| `python scripts/check-research.py` | 通过（注意它会改写文件，见第 11 条；我已把 `research/validation.json` 恢复为运行前的内容） |
| 用 Python 交叉比对 `ism.json` / `cube-enrichments.json` / `courses.json` / `course-bodies.json` 的键与枚举值 | 发现第 2、3、4、6 条 |
| 用 Node 单独执行 `resolveInside` | 复现第 1 条 |
| `vite build`、浏览器实际操作 | **未执行**；第 5、7、9 条来自读代码，没有在页面上复现 |

## 总览

| # | 级别 | 问题 | 位置 |
| --- | --- | --- | --- |
| 1 | 高 | Windows 下可跨盘符读取任意文件 | `vite.config.ts:39` |
| 2 | 高 | “误述/抵牾”状态标签键名对不上，30 条显示英文原始键 | `src/utils/ismFormat.ts:113` |
| 3 | 高 | 课程正文状态标签对不上，341/402 门课显示英文原始键 | `src/utils/ismFormat.ts:133` |
| 4 | 高 | 85 个本分支新补的节点被标成“原站 AI 初始汇总” | `ismismcube.vue:129` |
| 5 | 中 | 校勘索引加载失败后永远显示“加载中” | `ismismcube.vue:940` |
| 6 | 中 | `$-…` 节点跳转按钮点了只关抽屉、不跳转 | `CourseDrawer.vue:116`、`ismismcube.vue:1056` |
| 7 | 中 | 有检索词时每次悬停都重算全部 340 节点的匹配 | `ismismcube.vue:918` |
| 8 | 中 | 首屏多拉约 2.9 MB JSON，其中大量字段前端不用 | `ismismcube.vue:944` |
| 9 | 中 | 抽屉里残留的筛选词会让“打开课程摘要”打开错的课 | `CourseDrawer.vue:341` |
| 10 | 低 | `VITE_PROXY_STATIC=1` 对本地已有文件不生效 | `vite.config.ts:60,160` |
| 11 | 中 | 校验脚本会改写受版本控制的文件，且构建状态只看文件是否存在 | `scripts/check-research.py:305-310` |
| 12 | 低 | 行尾 CRLF 与 `.editorconfig` 的 LF 不一致 | 仓库配置 |
| 13 | 低 | 其他小项 | 见正文 |

---

## 1. Windows 下 `resolveInside` 可跨盘符读取任意文件（高）

**原因**

`vite.config.ts:39-47` 用 `relative()` 的结果是否以 `..` 开头来判断越界。在 Windows 上，目标与基准目录不在同一盘符时，`path.relative()` 直接返回绝对路径（如 `D:\secret.txt`），既不以 `..` 开头，`resolve(baseDir, rel) === candidate` 也成立，于是放行。

实测（基准目录在 C 盘）：

```
"/D:\\secret.txt" => D:\secret.txt      ← 放行
"/D:/secret.txt"  => D:\secret.txt      ← 放行
"/E:"             => E:\                ← 放行
"/../package.json"=> public\package.json（已被 normalize 收回，安全）
"/C:\\Windows\\win.ini" => null         （同盘符，被拦截）
```

开发服务器配置了 `host: '0.0.0.0'`，所以同一局域网内的任何人都能用 `GET /static/ismismcube/D:%5C路径` 读取本机其他盘符上的文件。`configurePreviewServer` 走同一函数，同样受影响。只影响 dev/preview，不影响线上静态部署。

**修改方案**

```ts
import { isAbsolute, relative, resolve, sep } from 'path'

function resolveInside(baseDir: string, relPath: string): string | null {
  if (relPath.includes('\0')) return null
  const candidate = resolve(baseDir, '.' + sep + relPath.replace(/^[/\\]+/, ''))
  const rel = relative(baseDir, candidate)
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) return null
  return candidate
}
```

关键是加 `isAbsolute(rel)`。另外建议把 `server.host` 默认改回 `localhost`，需要局域网调试时再用 `vite --host`。

**验证办法**

1. 在另一盘符放一个测试文件，`npm run dev` 后请求 `curl -i "http://localhost:2000/static/ismismcube/D:%5Ctest.txt"`，修改前返回文件内容，修改后应落到 Vite 的 404/回退页。
2. `curl -i http://localhost:2000/static/ismismcube/ism.json` 仍返回 200。
3. `npm run build && npm run preview` 下重复 1、2。

---

## 2. “误述/抵牾”状态标签键名不一致（高）

**原因**

`scripts/build-research.py` 产出的规范状态是 `contradicted_or_misstated`，`src/utils/ismFormat.ts:113` 的标签表写的是 `contradicted_or_misattributed`。`cube-enrichments.json` 的 highlights 里有 30 条是这个状态，界面“校勘与典籍”页会回退显示英文原始键 `contradicted_or_misstated`。

**修改方案**

把 `CANONICAL_STATUS_LABELS` 的键改成 `contradicted_or_misstated`。

为防止再次漂移，在 `check-research.py` 里加一条断言：从 `ismFormat.ts` 里解析出 `CANONICAL_STATUS_LABELS` / `RESOLUTION_STATE_LABELS` / `BODY_STATUS_LABELS` / `COURSE_KIND_LABELS` 的键，要求覆盖生成数据里实际出现的所有取值。更彻底的做法是让 `build-research.py` 把中文标签一并写进 `cube-enrichments.json`，前端不再维护第二份。

**验证办法**

1. 修改后打开一个含该状态的节点（可用下面脚本找），“校勘与典籍”页的徽标应显示中文。
2. 新增的断言在改键名前失败、改后通过。

```bash
python -c "import json;d=json.load(open('public/cube-enrichments.json',encoding='utf-8'));print([k for k,n in d['nodes'].items() if n['review_summary'] and any(h['canonical_status']=='contradicted_or_misstated' for h in n['review_summary']['highlights'])][:5])"
```

---

## 3. 课程正文状态标签与数据不符（高）

**原因**

`courses.json` 里 `body_status` 的实际取值与 `BODY_STATUS_LABELS`（`ismFormat.ts:133-140`）对比：

| 数据中的取值 | 课程数 | 标签表里有吗 |
| --- | ---: | --- |
| `not_reviewed` | 329 | 没有 |
| `asr_text_reviewed_not_audio_verified` | 60 | 有 |
| `compiled_text_reviewed_not_audio_verified` | 5 | 没有 |
| `reused_reviewed_node_summary_not_audio_verified` | 4 | 没有 |
| `local_asr_text_reviewed_not_audio_verified` | 1 | 有 |
| `partial_board_summary_no_audio` | 1 | 有 |
| `reused_compiled_text_not_audio_verified` | 1 | 没有 |
| `compiled_text_reviewed_identity_sample_matched_not_audio_verified` | 1 | 没有 |

结果是 402 门课里 341 门的状态徽标显示英文原始键（节点“课程与讲稿”页和抽屉详情页都受影响）。反过来，标签表里的 `transcript_text_reviewed_not_audio_verified`、`video_unavailable_or_deleted`、`catalogue_only` 三个键在数据里从未出现。

**修改方案**

按数据实际取值补齐标签（如 `not_reviewed: '仅目录元数据（未核正文）'`、`compiled_text_reviewed_not_audio_verified: '二手汇编稿已核读（未核原音）'` 等），删掉三个无用键。防漂移手段同第 2 条。

**验证办法**

1. 打开抽屉“全部课程”，随便点一门正课，状态徽标应为中文。
2. 第 2 条里的覆盖断言对 `body_status` 通过。

---

## 4. 85 个新补节点被标为“原站 AI 初始汇总”（高）

**原因**

`ismismcube.vue:129` 只按 `summary_status === 'manual'` 二分，其余一律显示“原站 AI 初始汇总”。现在 `ism.json` 里 `ai` 状态有 127 个节点，而按 README 与 `ai-review.json`，原站旧 AI 摘要只有 42 条；另外 85 个是本分支补齐的原空白节点（它们有 `summary_evidence`、没有 `review_summary`）。把这 85 条标成“原站”与项目自己强调的来源边界相矛盾。

同一位置，旧版在 AI 条目上有醒目的红字“注意: 以下内容由 AI 总结”，新版降成了一个普通徽标，提示力度变弱。

**修改方案**

用 enrichment 区分三种来源，例如：

```ts
const originLabel = computed(() => {
  if (activeIsmData.value?.summary_status === 'manual') return '原站手工条目'
  if (!activeEnrichment.value) return 'AI 汇总'
  return activeEnrichment.value.review_summary ? '原站 AI 初始汇总' : '本分支据二手讲稿补写（AI）'
})
```

更稳妥的是在 `build_cube_enrichments` 里直接写出明确的 `summary_origin`（`upstream_manual` / `upstream_ai` / `branch_filled`），前端只做映射。AI 类徽标建议保留原先的警示色。

**验证办法**

1. 取一个 `review_summary` 为 `null` 的节点（85 个之一）和一个旧 AI 节点（3-3/3-4 下），分别确认徽标文案不同。
2. 在校验脚本中断言三类数量为 213 / 42 / 85。

---

## 5. 校勘索引加载失败后一直显示“加载中”（中）

**原因**

`loadEnrichmentsAndCourses`（`ismismcube.vue:940-967`）里：

- `cube-enrichments.json` 返回非 2xx 时什么都不做，`enrichmentsData` 保持 `null`。模板把 `null` 一律当作“正在加载”：`讲稿核校明细加载中`、`正在加载讲稿索引...`、`正在加载校勘记录...` 会永久停留。
- `course-bodies.json` 失败同样静默。
- 三个响应在同一个 `try` 里依次 `.json()`，前一个解析抛错会让后面的都不处理。

**修改方案**

三个文件各自独立加载、各自有 `loading / error / ready` 状态；模板里“加载中”只在 loading 时显示，失败时显示“校勘索引加载失败”并给重试入口。可用 `Promise.allSettled` 加一个小的 `fetchJson` 辅助函数。

**验证办法**

1. 临时把 `public/cube-enrichments.json` 改名，刷新：节点面板应显示失败提示而不是“加载中”，课程抽屉仍可正常使用。
2. 往该文件写入非法 JSON，刷新：课程目录仍能加载。
3. 恢复文件后一切正常。

---

## 6. `$-…` 节点跳转按钮无效（中）

**原因**

`courses.json` 里有 43 处 `catalogue_code` / `related_codes` 是 `$-1`、`$-1-1-2` 这类 `$` 系列编号，它们不在 `ism.json` 里，路由也不匹配。`CourseDrawer.vue:116-127` 仍把它们渲染成“关联魔方节点”按钮；点击后 `jumpToNode`（`ismismcube.vue:1056-1063`）先关掉抽屉，再因为节点不存在而什么都不做。用户看到的是：点了按钮，抽屉消失，页面没变。

**修改方案**

给 `CourseDrawer` 传入可跳转的节点集合（或一个 `canJump(code)` 函数），不存在的编号渲染成普通文字标签而非按钮；`jumpToNode` 里把“关抽屉”挪到节点存在的分支内。

**验证办法**

抽屉“$ 系列”页任选一门课：`$-…` 编号不再是按钮；若同时关联了真实节点（如 `1-1`），点击能跳转并关闭抽屉。

---

## 7. 有检索词时悬停卡顿风险（中，读代码判断，未实测）

**原因**

`getIsmClass`（`ismismcube.vue:918-928`）在模板里对全部节点各调用一次，每次都调 `isSearchResult`。`hoveredIsmTag` 是响应式的，鼠标每进出一个格子整个组件就重渲染一次，于是 340 个节点的匹配全部重算。新版的匹配还要扫 enrichment 的 readings / transcripts / 关联课程标题，单次成本比旧版高很多。`searchedCount` 又独立再算一遍。

**修改方案**

把匹配结果收进一个 computed，只依赖检索词和数据：

```ts
const searchedTags = computed<Set<string>>(() => {
  const set = new Set<string>()
  if (!searchText.value || !ismData.value) return set
  for (const key of Object.keys(ismData.value)) {
    if (key !== 'introduction' && isSearchResult(key)) set.add(key)
  }
  return set
})
```

`getIsmClass` 改查 `searchedTags.value.has(tag)`，`searchedCount` 改为 `searchedTags.value.size`。输入框可再加 150 ms 左右的防抖。

**验证办法**

输入一个常见词（如“主义”），在 Chrome Performance 面板录制鼠标快速划过魔方的过程，对比修改前后脚本耗时；或在 `isSearchResult` 里临时计数，确认悬停不再触发调用。

---

## 8. 首屏额外加载约 2.9 MB JSON（中）

**原因**

进入页面即拉取三个新文件（`ismismcube.vue:944-948`），加上原有的 `ism.json`：

| 文件 | 原始 | 去缩进 | gzip |
| --- | ---: | ---: | ---: |
| `ism.json` | 881 KB | 793 KB | 247 KB |
| `cube-enrichments.json` | 2190 KB | 1590 KB | 291 KB |
| `courses.json` | 510 KB | 400 KB | 48 KB |
| `course-bodies.json` | 213 KB | 175 KB | 59 KB |

若线上静态服务没开压缩，首屏流量从约 0.9 MB 变成约 3.8 MB。`cube-enrichments.json` 里 `contribution_reviews`、`status_tags`、`raw_status`、`batches`、`sha256`、`match_basis`、`text_review_status`、`source_ids` 等字段前端完全没用到；`build_cube_enrichments` 的注释写着“不膨胀负载”，但输出用了 `indent=2`。

**修改方案**

1. 面向前端的 JSON 用 `separators=(',', ':')` 输出，并删掉未使用的字段。
2. `course-bodies.json` 改为首次打开抽屉或点“打开课程摘要”时再加载。
3. 确认线上对 `.json` 开启 gzip/brotli。
4. 进一步可把 enrichment 拆成“轻量索引 + 按一级编号分片”，按需取。

**验证办法**

DevTools Network 面板禁用缓存刷新首页，对比修改前后 JSON 的传输体积与请求数；确认不打开抽屉时没有 `course-bodies.json` 请求；`check-research.py` 的“生成文件一致”校验仍通过。

---

## 9. 抽屉残留筛选词导致打开错误的课程（中，读代码判断）

**原因**

`CourseDrawer.vue:341-353` 在带 `initialCourseId` 打开时重置了 `activeCategory` 和 `onlyWithBody`，但没清 `drawerQuery`。抽屉用 `v-if` 只隐藏内容、组件实例不销毁，上次输入的筛选词还在。若目标课程不匹配该词，`selectedCourse`（308-311 行）回退到列表第一项，用户点的是 A 课，看到的是 B 课。

**修改方案**

在该 watch 的 `initId` 分支里加 `drawerQuery.value = ''`。

**验证办法**

打开抽屉输入“康德”后关闭；到一个与康德无关的节点点“打开课程摘要”，抽屉应显示该课程而不是筛选结果的第一项。

---

## 10. `VITE_PROXY_STATIC=1` 对本地已有文件不生效（低）

**原因**

插件的 `configureServer` 中间件注册在 Vite 内置代理之前。只要 `public/` 下有同名文件，请求就被本地文件响应，`vite.config.ts:160-172` 配的代理到 `127.0.0.1:1999` 只对本地不存在的文件生效。想用后端数据联调时会悄悄读到本地副本。

**修改方案**

环境变量开启时不注册本地静态中间件：

```ts
configureServer(server) {
  if (process.env.VITE_PROXY_STATIC === '1') return
  ...
}
```

**验证办法**

在 1999 端口起一个返回不同内容的静态服务，`VITE_PROXY_STATIC=1 npm run dev` 后请求 `/static/ismismcube/ism.json`，应拿到 1999 的内容。

---

## 11. 校验脚本会改写受版本控制的文件（中）

**原因**

- `check-research.py:309-310` 每次运行都写 `research/validation.json` 和 `research/audit-current.json`。不带 `--source-cache` 运行时，`source_cache_check` 会从 `sha256_and_git_blob_verified`（430 个缓存文件、464 个哈希）被覆盖成 `not_requested`，之前的核验记录就丢了。我这次运行就碰到了，已恢复原文件。
- `frontend_build_run` 只判断 `build/index.html` 是否存在（305-307 行），并据此写下“vue-tsc、vite build、预渲染已验证”。`build/` 被 `.gitignore` 忽略，一份旧的构建产物也会让报告声称已验证当前源码。

**修改方案**

1. 默认只校验不写文件，加 `--write-report` 才落盘；或者不带 `--source-cache` 时保留报告里原有的 `source_cache_check`。
2. 构建状态改成可核对的事实：比较 `build/index.html` 与 `src/`、`vite.config.ts`、`package-lock.json` 的最新修改时间，过期则记 `stale`；或让脚本实际执行 `npm run build` 并记录退出码。文案不要写“verified”，除非本次确实跑了。

**验证办法**

1. 不带参数运行脚本后 `git diff --stat research/validation.json` 应为空。
2. 改动任一 `src` 文件但不重新构建，再跑脚本，报告应显示构建产物过期而非已验证。

---

## 12. 行尾不一致（低）

**原因**

`.editorconfig` 要求 LF，但 `vite.config.ts`、`ismismcube.vue`、两个 Python 脚本和生成的 JSON 在工作区都是 CRLF（`git ls-files --eol` 显示 `i/lf w/crlf`）。目前靠本机的 `core.autocrlf=true` 在提交时转换，所以不带 `-w` 的 `git diff` 显示 `vite.config.ts` 改了 259 行，实际是 205 行。换一台 `autocrlf=false` 的机器就会把 CRLF 提交进去。Python 的 `write_text` 在 Windows 上也会把 `\n` 写成 `\r\n`，生成文件的字节数因平台而异。

**修改方案**

加 `.gitattributes`：

```
* text=auto eol=lf
*.ico binary
```

生成脚本的 `write_text(..., newline='\n')`（Python 3.10+）。

**验证办法**

`git add --renormalize .` 后 `git ls-files --eol` 全部为 `w/lf`；在 Windows 上重跑 `build-research.py`，`git status` 无行尾引起的变化。

---

## 13. 其他小项（低）

| 项 | 原因 | 修改方案 | 验证办法 |
| --- | --- | --- | --- |
| 检索范围前后不一致 | `isSearchResult` 不查校勘结论、编者注、待核问题，但 `editorialHasSearchHit` 查。结果：这些内容里的词不会让节点高亮，却会在已打开节点的页签上亮命中点 | 两处共用一个“节点可检索文本”函数 | 搜一个只出现在校勘结论里的词，节点高亮与页签命中点一致 |
| `sendFile` 没处理读流错误 | `vite.config.ts:35` 的 `createReadStream().pipe(res)` 没有 `error` 监听，文件在 `stat` 后被删或被占用时会抛未捕获异常 | 加 `stream.on('error', () => res.destroy())` | 请求过程中删除文件，dev server 不崩溃 |
| preview 回退忽略预渲染页 | 预览中间件对 `/ai`、`/notice` 直接返回根 `index.html`，不是 `build/ai/index.html`，本地预览看不到预渲染结果 | 回退前先尝试 `build/<path>/index.html` | `npm run preview` 下查看 `/ai` 的源码为预渲染内容 |
| 一处修订会把同字段所有核查项标为已解决 | `field_review` 按 `(code, field_path)` 关联修订；159 个字段有多条核查共用同一处修订（最多 9 条），其中只要改过一次，全部记为 `resolved_in_catalogue`，新加的 `open_needs_attention == 0` 门槛因此容易满足 | 修订记录里显式列出它回应的核查项（如 `resolves: [claim 序号]`），未被点名的保持原状态 | 构造 fixture：同字段两条问题只修一条，另一条应仍为 open |
| 抽屉的无障碍 | 声明了 `aria-modal="true"`，但打开时不移焦点、不限制 Tab、背景仍可滚动 | 打开时聚焦搜索框，关闭时还原焦点，简单做 Tab 循环 | 键盘操作：打开后 Tab 不会跑到抽屉外 |
| `getIsmName` 里的空操作 | `.replace('"', '"').replace('"', '"')` 两边都是 ASCII 引号，什么也没做（`HEAD` 里就是这样，应是早先弯引号被编辑器替换掉） | 确认本意后改成 `replace(/[“”"]/g, '')` 或删除 | 含引号的节点名显示符合预期 |

## 建议的处理顺序

1. 第 1 条（安全）和第 2、3、4 条（界面上直接可见的错误文案）先改，改动都很小。
2. 第 5、6、9 条是交互缺陷，一起改。
3. 第 7、8 条是性能，改完用 Network / Performance 面板对比。
4. 第 11、12 条是工具链，提交前处理，避免把误导性的 `validation.json` 和 CRLF 带进历史。
