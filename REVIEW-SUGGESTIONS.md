# 未提交改动 Review 与修改建议

## 2026-11-15 持续推进（当前进行中）

用户再次纠正停止方式：批次通过只作为检查点，不作为等待“继续”的理由。沿用f51fa12及全部既有未提交成果，不重做已通过的旧路线；工程skill已列出/可读/正文手动读取。最初队列为逐节点笔记冲突对比、访问量初始化超时/卸载与缩放柄清理，均已推进到后续验收记录。主控持续选题、Hydrogen与Sol分工实现/交叉review，写入范围互斥，测试保持10秒/256MB父进程限制。

**当前检查点（本轮实证队列已验收）：** 连续完成阅读折叠、键盘缩放、AI重复Enter、主页动态效果偏好、笔记恢复焦点、短屏手柄、笔记离页、进度离页及键盘帮助九项，含浏览器失败后的返修。逻辑最后整仓23项受限回归通过；最后帮助仅操作文本变化，另经独立review/类型/构建和203/204手机截图验收。当前主页ismismcube-DiWp3y1S.js SHA256为DF5D11519B015FC5FD1C02C5F4567AB077672A14C31F8D1C24EB8FA6DECC94AF，共享routes-CKJUKUK2.js为B44EAFDC2D5CD995BCA6ADD7430CC0E60A1C2A5D7B089F45825E080307B54B54，AI ai-X42sMzbi.js为33AC71922F1E6583F6F69D30F0F93B02987A7DB70BCF2AB234676EDE59281AED。最终跨组件review无新blocker，导入导出/连接/快捷键复核未找到新实证修复项。Hydrogen资格EOF/0turn仍阻塞且未重试；真实beforeunload确认框未在自动化环境观察到，不宣称关闭必保全。全部本地未提交/未推送部署；research/public无改动。TaskSpace4已finish，已核实归属的2016/2017测试服务及子进程退出，复核残留进程0/监听0。

- 键盘帮助验收：CodeGuide只改usage_list操作说明，哲学正文/来源/footer不变；独立review确认与功能一致，203/204在320x568文字15.23px、列表clientWidth=scrollWidth=256、内容可滚，截图目视完整且Escape回guide_button。
- 阅读进度离页保护：200生产quota勾选1/13、storednull与SPA到AI均未prevent；App在notes同步flush后同时检查routeProgressHasPending，未改进度delta/reset或自动重试。201/202失败/SPA均prevent，重试写入split:1后解除；actualApp+真实store测试覆盖readerror无动作、勾选与reset失败、两类pending同时存在与部分恢复不能误解除。沿用原生对话框环境缺口，不重复浏览器确认尝试。
- 笔记离页保护：195失败草稿storednull但beforeunload未prevent；App常驻监听先通过notesLeaveGuard同步flush活跃编辑器，再只对notesUnsavedInMemory请求原生确认；Node局部guard及pagehide/visibility保留同步flush。196/197打开笔记、卸载页签、SPA到AI均prevent=true，重试落盘后false。组件测试覆盖App先执行/旧pending+新dirty存储恢复不假提示/卸载解绑。独立review撤回双flush可隐式重试的假设：第一次失败已dirty=false，连续两次flush实际只一次写。198键盘刷新与199原生点击导航均未观察到自动化浏览器确认框（199 userActivation=true仍导航），不以合成事件替代原生对话框保证；标准beforeunload只请求浏览器提示，强杀/浏览器抑制不保证保全。
- 笔记恢复焦点闭环：189生产retry成功BODY失焦；NodeNotes稳定region同步接住仅来自当前持焦按钮的retry/apply/初始化/读外部动作，确认取消和外部焦点保持。190/193实际Enter重试和冲突apply均focus root，草稿/存储正确；实际组件测试覆盖成功失败/取消/卸载，存储语义未改。
- 短屏手柄返修：191在320x568、End250%后handlebottom716.66越屏；去掉fixed轨道旧36rem下限，height=max(0,100vh-4rem)，handle maxheight100vh。192/194在320x568/568x320/32px根字体端点底边分别568/320/568，真实拖动向上更新比例且不误折叠，Space重开；双Sol交叉review/23项整仓通过。
- AI重复Enter闭环：183生产原生autoRepeat:true单次误发并清草稿（不宣称长按必连续POST）；Sol仅在两个Enter入口Shift/IME/229后拦repeat并preventDefault，未改变Ctrl/Meta/Alt兼容行为。184/185重复事件0POST保草稿/历史，普通Enter与确认按钮仍发；独立review及23项整仓检查通过。
- 主页动态效果偏好：186reduce仍4个1000ms切换动画；精确CSS media query关闭左右面板和手柄transition，未动弹幕。187/188冷reduce零动画，End缩放250%保持；normal恢复1s，动画中切reduce即停止，切回normal不自动重演。CSS-only无需镜像单测，独立review/类型/构建通过。
- 键盘缩放闭环：right_part首个非滚动栏新增原生range100–250/step1，与原连续drag ratio共享，百分比仅显示取整。181/182宽1024与320（先折叠阅读）原生Tab进入range，End=250%/scale2.5，Home+Right=101%/scale1.01，拖动同步114%但保留实际scale1.13931；栏宽320、文字14.33px，截图目视完整。Sol针对回归与独立review及主控整仓检查通过，不改drag helper、双pane最小宽度或加入持久化。
- 阅读折叠闭环：177基线DIV不可键盘聚焦、隐藏阅读区Tab仍进AI。Sol原生button/inert初稿通过组件回归但178窄屏失败；179确认focus使容器横滚565.5，折叠后手柄x=-396.5。返修为独立fixed手柄并限制视口边缘、内部focus preventScroll，不写全局滚动或改变40rem布局。178/180宽1024和320实测Enter/Space、Tab跳过隐藏区、指针单次toggle、drag比例与清理均通过；原drag helper未改。
- 阅读位置闭环：自动结束/失败只在近底24px范围跟随，上方阅读位置100保持；结束后仍可明确点击“查看最新内容”，焦点落稳定对话区。独立review发现原生滚动条pointer未取消，返修补pointerdown；主控实际CDP点击轨道后不被旧动画拉回。脚本128/130/131及新构建132通过。
- 面板演示闭环：pointer/wheel/touch/原生focusin/滚动键或折叠操作取消500ms演示timer及现行owner，迟timer/RAF不写。原生Tab验收通过；工具p.focus能改变activeElement但未可靠派发focusin，不能据此认定产品失败。空闲演示保留，消息owner独立。受限回归和构建通过。
- 减少动态效果：初始reduce不启动面板演示，CSS动画/过渡归零且设置弹窗仍显示；显式到末尾单次写入并交接焦点。偏好变更取消正在运行的动画，返回normal不重启演示，卸载移除监听。开发138/产物139通过，独立Sol review及19项整仓检查通过。
- 统计请求闭环：production脚本140/141在page_view:null后公告组件消失，#app仅剩注释。Sol复用原15秒JSON helper并校验非负整数、公告生命周期取消；开发142和新构建144已验两页null/object/negative占位、0有效、1234展示、header/body期限abort/0timer/1GET及SPA卸载迟结果隔离。公告正文未改；独立Sol review及20项整仓受限检查通过。
- 编辑切换闭环：Sol只读发现startEdit直接覆盖已有editingContent；主控143 production两条消息先编辑0写UNSAVED，再编辑2后回0，仅剩original question 0且无提交/取消。Sol禁用其他编辑入口并保护业务函数，可见提示先完成或取消；主控145/146开发及新构建验证原稿不被覆盖、HTTP503恢复草稿仍保护、Escape后可切。另一Sol review及20项整仓回归通过。
- 控制帧闭环：Sol实际业务harness与主控147 production同证，非文本广播startsWith抛异常；字符串flag9后flag10被字典顺序拒绝；task+part&extra=1解析为id=task part并多extra参数。Sol编码opaque ID并校验广播，计数接受非负整数；flag保留有限非负小数兼容，不假设无后端schema支持的整数约束。主控148/150开发及新构建验证非法广播不throw/不毒化后续9.5与10.25/不打断任务，ID含+&?#中文仍完整单参数；独立review及20项整仓检查通过。
- 公告布局闭环：主控149在320×568实际测得github-link clientW240/scrollW452，文字x40..491.5被github-block x40..280的hidden裁切。Sol仅修局部CSS换行及可用宽高，不改原文、链接或统计逻辑；独立review通过，151/152开发与新构建320竖屏/568横屏/桌面及32px根字号均无横溢出、完整链接矩形在box内。截图目视链接完整，内容增加时卡片自然增高，不强保高度而裁切。
- 弹幕发送闭环：Sol真实业务mock与主控153 production同证，composing Enter误发1POST，等待时新稿被旧success清空，后续同文双Enter再发2POST。Sol加IME/229/repeat/modifier/单飞、sync草稿revision、15秒response-only期限及卸载先失效abort；204成功不读JSON/失败不读挂起text，不自动重试。154/157开发与新构建验证A→B→A保稿、toggle/切节点保持单飞、late旧结果不干扰新请求、卸载0timer/0alert。155发现小屏status在右栏被裁x270..473，返修移主根fixed低于modal；156/158为x12..308、13px、底504低于按钮top554、无横溢出，截图已目视。独立Sol review、21项整仓检查及构建通过。新增check-danmu已登记runner，reader-tabs fixture只接入真实无顶层副作用的新helper模块。
- 主页接收闭环：159旧产物显示page_view=-2.5、online对象文本、弹幕关闭仍有121个隐藏动画且含[object Object]。Sol校验非负整数统计及textstring，只启用时接收视觉事件、关闭清空、本地最多最新40项、递增ID精确清理，不修改后台消息内容/普通hover暂停/发送协议。160/162开发及新构建验证关闭120→0、开启120→40且80..119、animationend减1、重开无积压、0有效。独立review和21项整仓通过。
- 错误页闭环：仓库无/static/error/error.html，error.vue却只渲染该iframe。161 preview陌生URL实测frame body空文本并再次嵌同一iframe，frame标题反向覆盖顶层为主页；不能推广为线上服务器结果，也未声称无限递归。Sol改原生Vue说明+首页RouterLink，不改catch-all/服务HTTP状态；独立review、22项回归及构建通过。163/164开发/产物冷加载与SPA陌生URL均0iframe/0缺失资源请求、标题页面不存在、Enter链接回首页；320正常/双倍字号和桌面无横溢出，截图已目视。
- 静态结构第一批闭环：Sol实际挂载loader与主控165 production同证，courses.json={}被当空目录ready、无error/retry，页面仍称340节点已建索引；cube-enrichments.json={}或nodes:null后主组件渲染失败，#app只剩注释。Sol赋值前验证两资源的UI所需结构及被直接消费的嵌套字段，允许未知metadata/可选null/合法空集合；错误进入既有重试状态。23项受限检查、public结构兼容、独立review、构建通过；166/167开发和新构建坏结构保持页面且可恢复402课程/340索引。courses总3请求含用户打开drawer显式再load，再索引重试，不是自动重试。不扩称为研究内容语义/来源核验，不改正式JSON。
- 静态结构第二批闭环：168旧产物ism null正文空无error/retry，course-bodies null打开drawer令全页空。Sol按UI消费路径补基础节点string arrays、正文summary/source_ids及混合editorial/readings等结构，空body map和未知metadata允许；实际identity_verification为record且仅插值，不误禁为string。四份public兼容、实际mounted坏数据→retry、独立review、23项整仓与构建通过；169/171开发/产物base与body均保页面、明确失败、各2次请求后恢复，未改正式JSON。
- 课程重试焦点闭环：170开发版和171新产物明确keyboard.Enter重试正文后，detail已恢复但activeElement为BODY，modal仍开且inside=false。Sol在当前按钮持焦的明确重试时同步转稳定panel/详情标题后emit，无新增迟focus回调。172/173开发/产物1024目录及摘要均loading/success持焦modal，320等待中主动转外部search_input后成功不抢回；独立review、23项回归及构建通过。未重做此前关闭恢复/课程跳节点已验收路径。
- 其余重试闭环：174 production明确keyboard.Enter基础数据/顶部索引/搜索弹窗重试，恢复后均BODY，搜索modal inside=false。Sol同步交接reader稳定region/已有search输入/modal panel，只改明确重试入口，后台加载不聚焦。实际组件加载/成功/再失败/外部移焦/关闭卸载通过；reader fixture仅加可选staticRequest，原4个fetch mock/runTests边界及动态复用兼容。175/176开发/产物base焦点ism_info_content、index为search_input、search在panel内；独立review、23项整仓及构建通过。
- 阅读折叠新基线：177 production手柄为DIV/tabIndex=-1，focus无效；真实鼠标折叠后从root按Tab进入ai_button，rect.right=-562且left_part非inert。正在把开关移出内容树保证恢复入口常可达，隐藏内容inert；原鼠标点击/拖动分流不变，nativeclick只处理detail0防双切换。键盘缩放为独立待补能力，不误用slider语义标记复合按钮。

新入口依据：笔记当前冲突恢复需丢整页草稿，补逐节点明确选择且应用前复核快照；page_view请求和JSON body无期限且卸载后可回写；缩放柄只在mouseup清理，Sol抽取源码已证失焦后全页pointerEvents=none及卸载后旧listener访问空DOM。后两者为先前未覆盖的生命周期路径，不重复静态JSON已验收场景。旧已验收摘要如下，当前新增项以本节后续记录为准。

- 三抽屉关闭焦点：主控真实DOM受控同批close后search/guide显式移焦，旧ReadingRoute/CodeGuide/SearchResults都会抢回入口。Sol修复后普通关闭/外部移焦通过，但主控发现route→guide旧恢复干扰新modal，已返修并补同parent四方向测试。浏览器四方向新modal均持焦点且overflow=hidden；Hydrogen小diff复审无blocker。未改变搜索/研究正文。
- AI编辑重发保全：主控构建产物确认HTTP503时原回答消失、仅剩替换问题且错误文案误称已保留。Sol新增session归属事务，首个非空白正文前失败/停止/空结束恢复原完整历史和编辑草稿，首正文后采用新分支。针对测试及另一Sol复审通过；主控浏览器HTTP失败/empty finish/stop保留原与后续回答、草稿，成功新分支不被旧HTTP迟失败回滚；设置弹窗中失败不抢走modal焦点。尚未重新构建前不以旧产物声称修复。
- 模型配置刷新：主控有效列表删除synthetic-two后，界面仅one未选中而请求仍two。Hydrogen协调有效选择/首项/空列表清除，并把dispatch模型沿任务socket及重连传到回答标签；Sol独立小diffreview通过。主控浏览器确认正在生成的request+label保持two、下一请求one、invalid null忽略，空列表沿既有省略model行为；未确认后端默认模型协议，也不新增禁发。测试改用真实createMessage函数，不再依赖固定model stub。
- 输入组件闭环：基线宽1024且侧栏收起，120字clientH81/scrollH81；缩320后输入宽168、clientH仍81/scrollH275且overflowhidden。Sol补RO/window尺寸重测、真实盒模型/overflow及卸载取消，独立Sol review通过。首次浏览器把输入与等待/读数塞同一evaluate，未可靠等待渲染，误判首宽裁切；改分阶段等待后完整，撤回无证据的临时transition禁用。最终宽81/81、窄176/275可滚、回宽81/81，文本和selection[3,9]不变、无RO错误、卸载disconnect；过渡期5次几何通知不当作自激，受限mock验证稳定通知不重新调度。
- 路线/搜索导航交接：普通关闭仍回入口，明确前往结果后复用课程命令聚焦目标阅读页签，搜索保留命中tab；两个抽屉只在导航关闭时抑制旧opener恢复。Sol实现及另一Sol独立review通过，Hydrogen该轮资格EOF/0token未执行，未记为review完成。主控开发版及新产物route2→1/search→1-1聚焦info_tab_overview通过，组件回归覆盖校勘tab与外部移焦。
- 最新产物SHA256：ai-BR2xan-R.js为10EAB70A6AD4B69A8CBD72974491819473100436A2D3B7059F605463D94FEDC4；ismismcube-DgIObZEr.js为77AB0ACA042E38D44636953343872572E6F30055A90E422876FB48738EC5A624。Hydrogen此前输入诊断print超时无输出，不作为结论；对应已由Sol review与真实布局验收补齐。
- 提交阶段期限：构建旧基线body挂起26.5秒仍queue/abortfalse，仅手动stop结束。Hydrogen新任务资格再EOF/0turn未写，连续失败后不重复服务请求，由Sol实现、另一Sol独立review；复用原jsonRequest，不改helper或自动重试POST。主控真实时钟header挂起到观察36.5秒已abort/none/1POST；受控15000ms body callback恢复编辑原历史+draft，晚HTTP/body零旧socket；有效ID后queue无提交timer。受限mock覆盖14999/15000边界、60秒有效queue不终止及stop/unmount清timer。新产物ai-sPAzwSSU.js SHA256 B836573A11AB1D8897D9DFF225D1A087B5D2CDBAE8C3A0E271C53576831EADBB，preview受控body期限验证通过；不声称超时证明服务器未接收任务。
- 阅读位置新基线：真实长回答scroll范围1147，用户位置100，服务器finish后无用户动作开始动画到123.5并向底部移动。原脚本等scrollHeight>2000与实际1603不符的超时仅是fixture阈值错误，已用实际范围复现；正在限定无显式点击的自动滚动仅近底跟随、保留结束后“查看最新内容”及用户输入取消动画。

- 主控新基线：浏览器触发缩放柄mousedown后blur，body.pointerEvents仍none/cursor仍pointer；已正常释放恢复测试页。AI全mock浏览器发送→停止→释放旧HTTP，仍创建old-stopped-task连接，确认取消门禁缺失。无真实AI请求或消息发送。
- Hydrogen启动一次资格检查EOF，未执行代码；唯一一次重试成功，未改账号/代理/全局权限。pageViewSession已实现至多一次POST、15秒fetch+body期限、卸载取消，主控15项受限检查通过；浏览器模拟body永久挂起后15秒abort与单次WS回退通过，晚结果忽略，卸载取消且不新建online连接通过。
- Sol笔记逐节点对比已实现并通过其针对回归和类型检查，另一Sol只读review未见丢稿或旧选择覆盖；主控多节点选择/外部再次变化/手机验收待进行。采用完整快照核对+一次setItem，仍不代表跨标签原子事务。
- Sol AI会话失效已实现，主控全mock浏览器停止后旧HTTP不建socket、A停B开旧回调不污染、DONE尾行忽略、卸载迟HTTP不复活通过。另一Solreview新增实证广播断线时stop入口被拦、finish_reason同块最终文字被丢，已返修；旧结果不代替返修后验收。

- 后续笔记验收闭环：主控浏览器两冲突分别选本地/外部，保留双方无关节点；外部再次变化时拒绝旧选择并刷新对比，不覆盖磁盘。320px冷启动逐项对比13px、单列无溢出。Hydrogen发现普通保存成功后旧对比可复活、失败重试成功后表单不刷新两处问题，Sol返修；主控复验外部当前节点正确进入表单且后续编辑不回滚、成功后新故障不复活旧对比。仍不声称localStorage事务原子化。
- 缩放与键盘验收闭环：失焦恢复原body pointerEvents/userSelect和root cursor；真实鼠标拖动改变比例且不误折叠，拖动中Enter导航AI后样式恢复。主页面更多/下载/AI为原生按钮，Space下载合成JSON340节点、Enter导航通过。
- AI追加返修闭环：广播断线仍可停止并取消HTTP，结束块保留最终token且忽略同帧尾数据。Hydrogen发现编辑确认可绕过离线/运行门禁，Sol增加历史变更前校验及IME保护；主控全mock浏览器离线与IME保留原回答/草稿、不新增请求，Escape归还编辑按钮焦点，正常Enter重发才截断历史并聚焦停止按钮，键盘模型选择进入请求payload，Space导出本地文本内容核对通过。未请求真实AI。
- 新一轮明确入口：AI renderMarkdown未经净化进入v-html，Sol只读复核onerror/javascript链接保留；主控合成data图片onerror仅写本页标记，延迟观察确认执行。交Sol修复最终HTML净化及异常文本转义，使用既有DOMPurify依赖，不升级依赖；安全Markdown/think样式与SSR兼容待独立验收。
- Markdown主控验收：新文档冷加载后流式输出事件属性为0、javascript链接href移除、无害执行标记保持false，粗体/代码块/think及原背景保留；独立真实DOM调用还验证SVG/style清除、未闭合think安全显示及无DOM转义回退。全mock WebSocket也屏蔽了Vite热更新，首次未重载的旧页面仍运行旧函数，不能作为新源码结果；已显式冷加载重验。Hydrogen继续只读复审。Shift+Enter发送区/编辑区均真实插入换行且不请求，按钮上Escape取消后回原编辑入口通过。
- 下一轮设置：主控浏览器重复确认恢复后取消、广播后自定义prompt均变回SERVER_DEFAULT。Sol提供独立默认值/覆盖值/草稿事务模块，Hydrogen接入设置弹窗与请求体并补键盘焦点。12项受限npm test通过；完整构建发现新helper Object.hasOwn与当前tsconfig lib不兼容，退回使用兼容属性检查，不提升项目目标。后续整合构建待完成。
- 设置集成已由Hydrogen交付：13项受限检查、项目类型与三页预渲染构建通过（Hydrogen执行）。主控全mock冷加载实测未收到配置时请求省略假0、恢复后取消保留已保存提示词、广播不改打开草稿/已保存覆盖但更新服务端只读限制、未覆盖采样字段采用新默认、恢复并保存后跟随最新默认、非法广播不使页面崩溃。Enter开dialog、首尾Tab循环、Escape返回设置按钮通过；320px冷加载无横溢出、标签14.4px、弹窗内容可滚动，动画结束截图已目视核对。
- Markdown交叉review追加代码原文失真：Hydrogen/Sol均发现代码块内think被全局替换。Sol移除占位策略，使用marked原生HTML/代码区分，末尾仍DOMPurify净化；主控真实DOM确认行内/围栏think原文保留、普通think/粗体正常、危险属性清除、未闭合think安全闭合。未引入新依赖。
- 下一轮流式语义：Sol实际业务mock复现未知上限0时2块生成2次警告，finish_reason=length却可无提示；接收片段计数被错误称token。正在接入独立stream状态，仅length提示一次、保留结束块文字，速度明确为片段/秒。主页面online socket另发现匿名addEventListener未被onmessage=null移除，Sol正在验证并修复连接身份/卸载隔离。
- 流式与online本轮验收：主控浏览器stop保持末块、不误报限制，length保留末块且单次提示，尾行不进入正文，单位明确片段/秒；online离开页面移除四类监听器并关闭连接，手工调用已排队旧message/close后重挂载在线人数保持12、不产生旧弹幕。Hydrogen对online实现未见功能问题，仅指出其读取时runner尚未登记；主控随后已登记并执行，全量15项每项10秒/256MB通过，完整构建和三页预渲染及diff-check通过。
- 构建产物smoke（随后错误保全修改之前）：localhost:2017实际加载ai-W1Ousf40.js；设置恢复后取消保留系统提示词，请求省略未知采样值，think代码原文/正文保留、onerror移除且标记不执行、length提示一次；导航主页与冷加载/3成功、402课程。该产物另用于复现“部分回答后坏JSON会覆盖正文”，因此并不宣称所有AI故障路径已通过。该问题已交Sol下一轮修复独立错误状态，不向下一轮请求混入客户端诊断。
- 部分回答返修浏览器通过：80段合成回答后坏JSON保留完整正文，诊断不含原协议且固定输入区上方可见；下一请求包含真实assistant正文、不含错误，HTTP失败不制造假assistant。length提示也移到独立状态以避免污染下一轮上下文。Hydrogen复审正常错误路径通过，另确认提前close1000静默截断、握手后反复断开可无限重连、二进制/显著错误schema卡任务，已继续返修，不作为已通过路径。
- AI控制面板：基线折叠后内部返回按钮仍可聚焦，开关为div。Sol改原生按钮+inert+展开焦点保护；主控320px同脚本Space折叠、隐藏按钮不可聚焦、Tab到输入区、Space展开到选中模型、无横溢出通过，桌面Enter展开通过。一次手工CDP Enter按键未触发浏览器按钮默认行为，检查状态后改用正式keyboard.press及手机Space分别验证，未据此修改产品代码。
- 协议边界返修主控浏览器通过：提前close1000、Blob二进制帧、choices为字符串均终止并独立提示、原正文保留；合法空choices/usage、role及空content继续处理。真实时钟反复握手后1006约10.3秒/10连接后提示恢复超时；5个主动测试任务只有5次POST，没有自动重发。Sol受限实际open/close循环还覆盖正常长生成不耗恢复预算、收到正文后新窗口；状态消息与仅握手不清预算。
- 下一项滚动有受控基线：原scrollElement从0插值，主控浏览器固定16ms帧后scrollTop600变2；Sol独立RAF mock同证并行动画/卸载后继续写入。普通浏览器首帧观察受调度影响未捕获上跳，故不把它作为稳定复现；受控实际业务函数证据足以修复。正在提供每元素可取消owner、当前值插值、DOM更新后测量及卸载清理，Hydrogen接入后独立验收。
- 滚动闭环：Sol helper、Hydrogen页面集成、另一Sol只读review通过。主控受控真实页面首帧600→600不再上跳；卸载后保留旧RAF手工调用，拦截旧scrollTop setter确认0次写入。新增更多内容button首次验收会消失后焦点落BODY，Sol返修到稳定role=region对话区；主控Enter滚到底后焦点message-area、服务自动完成仍保留input焦点通过。主控独立全量16项受限检查、完整类型/构建/三页预渲染与diff-check通过，AI bundle更新为ai-4yolna2Q.js；后续阅读修改另验。
- 新阅读批次基线：/1四个tab无aria-selected/controls，ArrowRight仍停概览；课程页BV1JT4y1K7dp打开摘要后键盘跳关联节点1，切概览但焦点BODY。由Sol只读发现、主控实际浏览器复现，已交Hydrogen补tab语义/方向键及课程跳转的明确焦点交接。原抽屉普通关闭、笔记切页保存与小屏行为须保留；不修改研究内容。
- AI最终产物补验：localhost:2017加载ai-4yolna2Q.js（SHA256 8C4B5A9E18E2CB47C2DD764148E21DB4E9208C6523946481E0EDC57BEBF91692），面板inert/键盘、设置恢复取消保留系统词、请求省略未知参数、think代码与正文、危险属性移除及无执行、长回答更多内容Enter滚底并留焦message-area、服务提前close1000后正文完整并提示全部通过。仍仅合成HTTP/WS，未联系真实AI后端。当前进入阅读批次，未推送或部署。
- 阅读候选浏览器通过：左右/Home/End/循环、一个tabstop、aria-selected与tabpanel关联；内存隔离的合成笔记输入后同一JS轮次ArrowRight切走，立即保存并重挂载恢复；课程同节点与/2→/1跨节点跳转聚焦概览，普通关闭还原可见摘要入口，跳转期间主动转焦search_input不会被夺焦。320px冷启动无横溢出，页签约12.9px。Sol只读复核确认焦点意图仅handleCourseJump，不改变搜索/路线/笔记通用跳转。
- Hydrogen阅读任务先6分钟、后同会话收窄为验证3分钟，两次CLI均按时限退出；实现与新增check-reader-tabs保留，但不能据退出宣称验证通过。已核实无agy.exe残留，不终止共享Antigravity桌面进程。停止重复同轮请求，交Sol接手受限测试及必要测试修复，主控待独立全量检查；不覆盖已有修改。
- 阅读测试交接闭环：Sol仅修两处fixture（DOM.value先赋值再派发input；默认$分类切到全部再找目标），产品源码未改；reader-tabs/courses/项目类型检查有界通过。主控独立全量17项受限检查、完整构建及三页预渲染、diff-check通过，主bundle为ismismcube-q_THHjkM.js。跨节点课程跳转/2→/1及外部主动焦点也实测通过。
- 后续层级导航新基线：/1-1-1在祖先1按钮上Enter跳到/1，祖先按钮随路径缩短移除，activeElement回BODY。正在只读复核阅读区内联导航的最小焦点交接范围；不能无条件改通用jump以免影响已验收notes/search/route路径。

## 2026-11-15 持续开发：可靠性与阅读交互批次已验收

当前接手基线为 `f51fa12`，工作区初始干净；上一批成果已被合成本地提交，远端研究分支仍为 `9ddce6c`，本地领先6提交。以下2026-11-14“未提交”说明保留为当时状态，不表示当前状态。用户要求主控持续自行选题、指挥Hydrogen与Sol开发/review/验收，不以完成固定轮数作为停止点。

**本批最终状态（01:16，香港时间）：** 下述发现均已闭环，全部改动保留本地未提交候选，未推送或部署。Hydrogen实现/交叉review、Sol实现/交叉review、主控浏览器验收持续轮转，并由后续证据追加了晚到导入、正文可读性、路线多标签与恢复流程。最终8项`npm test`在每项10秒/256MB堆限制下全部通过，类型检查、构建及三页预渲染通过，`git diff --check`通过。Node最低版本按锁定Vite声明写入package与lock根元数据，README补充本地检查及后端边界；没有依赖升级或全局环境修改。

**实际构建产物：** 主页面bundle为`build/ismismcube-Crtm3z9Q.js`，SHA256 `C0F7D84EA1B8B4A6E6146FCCF342FAE3535653097D84B1513ADC6672DBCC97A8`。localhost:2017预览实测深链接`/3`加载340节点索引/402课程、合成笔记刷新恢复、课程4段摘要、路线进度刷新保持通过；390×844冷启动正文15.55px、导航36px、阅读区626px、无横向溢出，截图已目视检查。开发服务localhost:2016的合成故障与交互记录不替代该产物检查，也不代表生产后端或真实移动设备已验收。

**仍保留的边界：** localStorage写前合并解决顺序交错操作，不是严格同时写入的原子事务；未加入实时跨标签刷新。存储持续失败时草稿只在当前页面内存，需用户导出，不保证关页后保留。静态JSON有15秒期限，原`/page_view`后端请求不在该修改范围。未修改研究数据/内容正确性结论。

**资源清理：** 已结束本批Ego TaskSpace，正常退出所有本批Hydrogen调用；停止已核实命令归属的Vite开发/预览进程48728/39888，停后进程与2016/2017监听数均为0。没有遗留后台测试或开发任务。

以下为本批证据与返修过程；其中“正在/待验收”描述当时状态，以本节最终状态为准。

- 分工：agy CLI `gemini-4-hydrogen-high` 负责课程抽屉；独立 `gpt-6.1-sol` 负责笔记存储保护，随后交叉review；主控独占浏览器并整合状态。agy模型目录未列Sol，所以不虚称Sol经agy运行。
- 旧证据复用：沿用上一批单页笔记保存、搜索、路线等通过结论；新入口是多标签写入、读取异常、小屏冷启动、挂起而非明确失败的网络请求、键盘访问主魔方。
- 已复现：同源两个标签页分别加载后，A保存节点1，B保存节点2，存储只剩节点2。此前单页测试不能覆盖此场景。
- 新的小屏观察：同一脚本内固定320×568并冷加载，课程标题约4.73px、正文约5.03px。根字号由screen计算得到5.92px；既有“打开后缩窗”结果不代表冷启动可读性。Ego跨调用/高层交互可能恢复原窗口视口，后续移动验收必须同时记录innerWidth、screen.width和根字号，环境不符时不作产品结论。
- 当前计划：笔记写前基线比较与损坏原值保全；课程目标选择/小屏/键盘；再推进请求超时恢复与魔方键盘入口。每项先限制写入范围，实质问题返修后再复验。CLI单轮6–8分钟，单个Node检查20秒，超时停止已核实所属进程；不重复此前无界自制renderer失败路线。
- 主控浏览器已验证：不同节点的顺序交错保存保留双方；同节点冲突保留磁盘较新值和本页草稿；读取外部版本取消/确认、损坏原值不覆盖、原始备份下载、初始化取消/确认和合法备份恢复通过。localStorage读改写不具备跨标签原子性，严格同时写入的竞争仍是边界。Hydrogen交叉review发现恢复后blocked状态不解除及原始备份陈旧问题，Sol正在返修，相关恢复结论待补验。
- 课程主控浏览器验收：同脚本320×568冷启动、screen.width=320、根字号5.9167px；抽屉全屏且无横溢出，正文13px，标题约12.53px；选择课程聚焦详情标题、返回列表聚焦当前项、换课滚动归零通过，截图已目视检查。Sol补充内存renderer异步目标与快速关闭回归通过，仍不等同真实移动设备。
- 测试失控与重开依据：初版check-courses将循环DOM对象用于身份断言，失败诊断展开造成已核实子进程56448占用约36.8GB；主控停止该进程及自动重试，终止所属agy进程57776，核实退出。Sol改用布尔身份断言、修正焦点检查的nextTick时序和renderer连接语义；新增父进程20秒/512MB堆/256KB输出上限，首个失败即停止。重开仅验证上述实质修订，Sol以更严10秒/256MB运行三项检查均约1秒内通过；禁止再次无界直接运行。新requests检查也纳入同一入口。
- 笔记恢复返修已补验：存储恢复为空后显式重试保留原草稿并落盘；旧坏值被新坏值替换后初始化拒绝覆盖、旧下载确认失效，新下载内容确为新原值；重新读取合法外部数据解除错误。均为主控浏览器观察。
- 四份静态JSON超时已验收：模拟fetch忽略abort永久挂起，基础数据15秒后明确报错，手动重试恢复402课程，迟到旧结果不覆盖；课程目录、摘要正文和校勘索引分别超时后可重试，恢复4段摘要及340节点索引。helper的15项纯逻辑检查另覆盖body挂起、取消与清理。仅静态JSON纳入时限，原/page_view服务请求仍未纳入，此处不声称全部网络请求有界。
- 主控独立npm test四项通过（10秒/256MB限制），Node24构建与三页预渲染通过，diff-check通过；核实无残留check-*测试进程。随后继续键盘导航组件及主页面集成，这部分仍待review/浏览器与整合检查。所有新测试仅使用localhost:2016合成数据，未触及真实个人笔记。
- 后续review实证P1：异步file.text尚未完成时卸载笔记组件，重挂载编辑保存后旧导入会把新笔记回滚且无冲突。Sol添加组件存活与导入世代校验、等待中合并当前状态，并补卸载/倒序读取/恢复操作回归。主控浏览器已验证晚到导入不再覆盖重挂载后的新内容，Hydrogen正在交叉复审。
- 键盘节点导航已实测Enter/Space逐级进入1→1-1→1-1-1→1-1-1-1，焦点落稳定当前说明，最多9个按钮；手机无横向溢出。但320×568下导航占275px而正文仅171px，故返修为默认折叠的紧凑入口，不能仅以键盘行为通过接受此布局。
- 下一项正文可读性有主控基线：320×568冷启动root5.9167px，正文10.65px，连续放大仍10.65px；两个div字体控件约7.9×7.9px。Sol正在保留旧偏好基础上修正字号映射及原生键盘按钮，需补真实小屏/刷新/输入/缩放验收。
- 导航/字号返修已验收：默认折叠仅36px，正文区域约409px；展开内容限高219px并可滚动；四级Enter/Space、Escape归还开关、同一JS事件轮次编辑后导航仍保存旧节点且保持笔记页签、hover不重排固定节点通过。字号默认正文15.55px，最小正文/textarea13px、控件36px、加减/刷新保持/键盘通过。六项npm test通过；导航卸载用例曾因模拟renderer未复位移除子树内焦点而失败，Sol修正模拟语义且保留断言后通过。字号及导航集成构建通过，后续变化另验。
- 路线进度后续：主控两页基线再现先勾split:1、后页勾split:2只剩后者。Sol改按明确动作合并，主控已实测两项均保留，取消重置不改值；确认重置后旧标签再勾split:1-3仅该项存在，不复活已清步骤。Hydrogen继续review失败重试/损坏存储恢复入口，相关UI未最终验收；仍不声称localStorage严格同时操作原子化。
- 路线恢复最终验收：写入故障提示准确、无需改勾选的显式重试合并外部步骤且焦点回关闭；坏存储在0完成时仍可确认重置，取消保留原值，确认清除且焦点稳定；外部修复后的只读重试采用新进度且不制造待保存动作。主控浏览器及组件回归均通过。协作中Hydrogen在Sol持有的新抽屉测试追加用例，发现后暂停写入、核对并保留两方断言，待Hydrogen退出才由Sol独立运行；未覆盖既有测试。

---

## 2026-11-14 连续开发批次（Codex 总控 / Hydrogen High 实现）

用户授权主控自行选择后续重点并连续执行开发、review、验收和返修。本批基于同一 `e97baad` 工作区继续，保留全部既有改动，未提交/推送/部署。

1. **继续学习：已验收。** 抽屉显示首个未完成步骤，点击只跳转；全部完成后显示完成状态并保留重读。存储写入失败有提示，恢复写入后解除。独立 Chromium 检查了首步/次步、13步全部完成、重置、模拟存储故障与恢复、320×568视口滚动；构建通过。
2. **笔记可靠性：已验收，并完成一次追加修复。** 修前实测输入后立即刷新丢失草稿；存储失败再切换页签会恢复旧磁盘内容并清除错误提示。修后立即刷新与重挂载均保留新内容，恢复存储后重试成功；非法编号导入被拒绝，较新本地笔记不被旧备份覆盖，实际下载JSON备份并核对了内容。新增 `node scripts/check-notes.mjs`，主控独立执行通过，覆盖生命周期flush、监听器清理、失败后内存保留、导入合并和导出。review追加发现全部笔记跳转强制进入概览；Hydrogen修复独立笔记导航，主控在400ms保存前切节点验证旧节点保存及新节点笔记页保持，普通路线跳转仍进入概览。最终构建通过。
3. **检索结果：已验收，并完成测试脚本返修。** 新增搜索结果抽屉，显示编号/中英文名称/匹配位置，按精确编号、精确名称等优先级排序，跳转命中的概览/课程/校勘页签。列表、数量和魔方着色共用结果集。主控实测立即输入带空格编号并Enter采用新查询；`4-4-4-4`精确项排首，`笛卡尔`16项，课程/校勘跳转正确；零结果与空白不残留；`1`查询340项完整渲染且着色数量一致；320×568无横向溢出且可滚动；方向键、Tab循环、Escape返回入口通过。阻断两份补充索引后明确提示部分结果，解除阻断并点击重试，命中从11项恢复16项。

**第三项测试返修记录：** 初版 `scripts/check-search.mjs` 卡住，导致agy达到10分钟时限并终止其后台检查；主控也复现卡住并停止自己的检查进程。返修为模拟DOM节点加`markRaw`、修正renderer节点移动/移除及焦点入口身份，删除源码字符串包含式“检查”。返修未改产品功能。主控在每个脚本20秒超时保护下独立运行 `node scripts/check-search.mjs` 与 `node scripts/check-notes.mjs`，两者均正常退出通过；最终产品代码的独立构建和`git diff --check`通过。开发中热更新时观察到方向键异常，完整刷新后无法复现，最终版本方向键验收通过，未据此追加产品修复。

**联动验收：** 输入笔记后在400ms防抖前经搜索跳转，原节点草稿仍被保存；从继续学习回到原节点，笔记完整，路线进度未自动标记。所有观察均为本地开发服务及模拟故障；没有以构建通过替代交互验收。

浏览器测试使用本轮专用 localhost:2015 origin 的合成笔记和进度，不涉及真实个人笔记；存储故障仅为页面内临时模拟并已恢复，索引请求阻断也已解除。所有构建临时使用本机已有 Node 24.22.1，没有修改系统安装。真实移动设备、后端和生产部署仍未验收。本批三个开发重点均已完成，全部保留为本地未提交候选；没有提交、推送、发布或部署。

---

## 2026-11-14 阅读路线与编号导读：Hydrogen 实现 / Codex 验收

本节是当前增量状态；下文针对 `9ddce6c` 的审查保留为历史记录，不代表所有问题仍存在。

- 基线：`research/source-audit`，HEAD `e97baad`，接手时已有主页面修改及四个未跟踪的阅读路线/导读文件。本轮保留既有工作；没有提交、推送或部署。
- 分工：Codex 定义范围、独立审查和浏览器验收；agy CLI `gemini-4-hydrogen-high` 实现。仅使用当前 CLI 会话的命令权限，未修改全局权限或依赖。
- 范围：阅读路线、编号导读、进度保存、主页面集成；不修改研究数据，不做全站或哲学内容审定。首访自动模态导读改为可忽略提示；补齐焦点回退、节点未就绪时的跳转禁用、小屏布局与损坏进度数据处理。
- 第二轮返修：真实 Chromium 中，重置进度后禁用的重置按钮仍是 `document.activeElement`；仅检查焦点是否在弹窗内不足以恢复焦点。Hydrogen 改为在下一次 DOM 更新且抽屉仍打开时显式聚焦关闭按钮，Codex 已复测通过。
- 独立检查：13 个路线编号均存在；最终 `npm run build`（含 TypeScript 与三页预渲染）和 `git diff --check` 通过。构建使用本机已有 Node 24.22.1，仅调整该命令的 PATH；系统 Node 20.12.2 低于 Vite 声明要求，未更改全局安装。
- 浏览器观察：跳转到 `/1`、悬停其它节点隐藏路线横幅且不改进度、刷新恢复勾选、重置、Tab/Shift+Tab 循环、Escape 返回入口通过；首访提示不自动弹窗，提示内打开导读再关闭后焦点回到 `guide_button`。最终返修后复测了重置焦点、保存恢复与键盘返回。
- 布局：390px 阅读路线与 320px 编号导读截图已目视检查；320px 下两弹窗 DOM 宽度检查无横向溢出。这是桌面 Chromium 视口模拟，不是真机验收。
- 边界：Hydrogen 报告其内存模拟进度校验通过；该项不是 Codex 独立运行。浏览器验收针对本地开发服务，生产部署和后端不在本轮范围。`research/README.md` 中“前端源码未改”属于旧资料批次描述，不应作为当前代码状态。
- 后续：本批保留在工作区供下一轮开发或提交。继续使用“限定任务 → 实现 → 独立 review/实测 → 有缺陷则返修”的方式；没有未完成的后台开发任务。

---

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
