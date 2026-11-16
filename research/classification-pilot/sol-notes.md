# Sol：第1、2字头分类试点说明

本稿只对课程既有格位做通俗判别试点，未改原库定义。八类覆盖自然演化／文化演化、功能主义／行为主义／社会行为主义、实体整体论／泛一元论，以及笛卡尔／贝克莱／休谟三种易被“理性、精神、经验”关键词误并的认识路径。`1-1-4` 只有课程前三格，第四格在 JSON 中为 `null`。其余四格解释也只按该分支的现有文字，不把编号数字当通用译码。`course_evidence` 是课程目录及固定社区讲稿入口；`primary` 是联网核读的原典局部，通常是编者关联。均未核原音。

## 交叉检验的真实文本候选

以下是**作者著作或论文原文**的候选输入，不是自然口头发言，也不是本稿的 synthetic 正例。表中引号内文字就是可直接投喂的最小英文输入，后附其段落定位；若扩展为整段，交叉检验方须另存实际输入。中文说明均为本稿转述。初检目标是问分类器会否因单词误判、会否保留无法判定和多标签，不把作者的人格或整部著作贴上单一编号。

| 候选 | 实际可输入的原文锚点与段落定位 | 来源及预期压力点 |
| --- | --- | --- |
| A | “The principle, which I have designated by this term” 第IV章“Divergence of Character”首段。 | [达尔文《物种起源》1859第IV章](https://en.wikisource.org/wiki/On_the_Origin_of_Species_(1859)/Chapter_IV)：代词依赖上文，作为弃判压力项；短句本身应允许证据不足。 |
| B | “I do not wish to give the impression that I think there is no mystery about consciousness.” §6(4)末段，期刊p.447附近。 | [图灵1950论文](https://www.cs.toronto.edu/~frank/csc2501/Readings/R1_Turing/Turing-1950.pdf)：检验是否把模仿游戏直接等同主观体验或完整功能主义。 |
| C | “The time seems to have come when psychology must discard all reference to consciousness” 正文中段，以该句开段。 | [华生1913论文](https://psychclassics.yorku.ca/Watson/views.htm)：比开篇方法宣言更强地排斥意识作为观察对象；检验1-1-4与1-1-4-4的边界。 |
| D | “The self has the characteristic that it is an object to itself” §18原书p.136–137附近。 | [米德《心灵、自我与社会》§18](https://brocku.ca/MeadProject/Mead/pubs2/mindself/Mead_1934_18.html)：自我与身体可分；若只看到“behavioristic”不能忽略自我生成机制。 |
| E | “God is the indwelling and not the transient cause of all things.” 第一部命题XVIII。 | [斯宾诺莎《伦理学》，Elwes英译](https://www.gutenberg.org/cache/epub/919/pg919.html)：与仅说万物互联的泛整体论区分；目的格不能由此句单独判出。 |
| F | “This is a point I cannot determine, and do not now enter into any dispute regarding it.” 第二沉思§7。 | [笛卡尔《第一哲学沉思集》第二沉思](https://en.wikisource.org/wiki/Meditations_on_First_Philosophy/Meditation_II)：代词依赖上文，作为弃判压力项；检验是否误把暂时悬置身体等同已证明心物二元。 |
| G | “THERE MAY BE SOME OTHER SPIRIT THAT PERCEIVES THEM THOUGH WE DO NOT.” 正文§48。 | [贝克莱《人类知识原理》，Gutenberg #4723](https://www.gutenberg.org/cache/epub/4723/pg4723-images.html)：对“我闭眼，桌子消失”的常见错读构成反证。 |
| H | “Custom, then, is the great guide of human life.” 第V节第一部分习惯段。 | [休谟《人类理解研究》，Gutenberg #9662](https://www.gutenberg.org/files/9662/9662-h/9662-h.htm)：检验因果期待是否被误写为理性演绎或彻底不能行动。 |
| I | “unless profitable variations do occur, natural selection can do nothing.” 第IV章开头，自然选择作用条件段。 | [达尔文《物种起源》1859第IV章](https://en.wikisource.org/wiki/On_the_Origin_of_Species_(1859)/Chapter_IV)：有明确机制但不含上升等级，检验细类证据不足。 |
| J | “I am, I exist, is necessarily true each time it is expressed by me” 第二沉思§3–4，我思确定性段。 | [笛卡尔《第一哲学沉思集》第二沉思](https://en.wikisource.org/wiki/Meditations_on_First_Philosophy/Meditation_II)：可辨方法性怀疑后的确定性，但神的担保仍未知。 |

## 风险与审核点

1. 课程给达尔文、图灵等人物的格位，不等于这些作者原文接受课程全部四格。尤其1-1-1-2的等级进化不能从达尔文推出；1-1-3-1的多重实现也不能只由图灵模仿游戏推出。
2. 华生的心理学方法宣言不能证明课程关于国家、暴力或具体机构的历史断言。米德§18也未证明“爱玩梗者”归类或没有终极目的。
3. 斯宾诺莎原文是 Elwes 英译，笛卡尔所用 Wikisource 页的译者和纸本版次未核；对用词敏感的结论应再核较可靠版本。贝克莱、休谟的文本也仅局部核读。
4. 十段均为公开著作原文候选，尚无可靠逐字口头发言输入。因此本阶段只能检验书面论证片段的分类行为，不能声称已在真实日常发言上通过。实际交叉判读结果见 `terra-evaluation.json`，不能据此计算准确率。
