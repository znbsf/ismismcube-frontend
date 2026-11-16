__主义主义简要总结可视化网站！__
__visualized webpage summary of *ISMISM*!__

本分支已补齐原有空白摘要与格位说明，并逐字段校对213条原人工摘要和42条旧AI摘要。请先看[原理入门与阅读路线](research/START-HERE.md)、[实际完成范围](research/README.md)、[逐条资料导读](research/READING-GUIDE.md)和[典籍索引](research/BIBLIOGRAPHY.md)。[73项补充课程正文导读](research/COURSE-READINGS.md)包括`$`系列、预习、复习与番外，其中一项无声视频仅有部分板书说明。校对范围分别见[人工摘要记录](research/MANUAL-REVIEW.md)与[旧AI摘要记录](research/AI-REVIEW.md)；全部保留来源和未核原音的边界。

*****
通过网址 **https://www.ismismtag.com** 访问网站

相关视频：**https://www.bilibili.com/video/BV1VXiGekEHK**
*****
Visit **https://www.ismismtag.com** for full content

Video: **https://www.bilibili.com/video/BV1VXiGekEHK**

## 本地开发与检查

Node.js 要求：`^20.19.0 || >=22.12.0`，与锁定的 Vite 7.1.3 的 `engines.node` 一致。Node 20.12 不满足要求，可使用满足该范围的 Node 24。运行前先用 `node --version` 确认当前终端实际使用的版本，已有多个版本时可仅为当前终端选择兼容版本，无需修改全局环境。

在本目录执行：

```sh
npm ci
npm test
npm run build
npm run dev
```

`npm test` 运行 `scripts/run-checks.mjs` 中登记的本地回归检查，每项由独立 Node 子进程执行，并设有时间和内存上限。检查采用内存存储、模拟请求或组件 renderer，不启动开发服务，不访问真实后端，也不能替代浏览器交互验收。新增检查需登记到该入口才能随 `npm test` 执行。

`npm run build` 先执行 TypeScript/Vue 类型检查，再由 Vite 构建并预渲染页面，输出到 `build/`。测试通过与构建通过应分别确认。`npm run preview` 可检查已构建产物。

`npm run dev` 默认提供 `http://localhost:2000`，课程等静态 JSON 默认取自本仓库 `public/`。开发配置把 `/api` 代理到 `http://127.0.0.1:1998`；访问量、在线状态、弹幕等动态功能需要对应后端。这里没有随 `npm test` 自动启动的 mock 后端：浏览器验收如使用额外本地 mock 服务或请求拦截，应单独启动和说明，其结果仅覆盖合成数据与模拟故障。设置 `VITE_PROXY_STATIC=1` 后，静态路径还会代理到 `http://127.0.0.1:1999`，普通本地阅读无需开启。
