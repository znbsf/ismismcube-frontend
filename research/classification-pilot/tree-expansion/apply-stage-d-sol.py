"""Apply stage-D source reviews to Sol-owned research nodes; keep the gap audit."""

import json
from pathlib import Path

HERE = Path(__file__).resolve().parent


def citation(author, work, version, locator, url, supports, limits, scope=None):
    return {
        "author": author, "work": work, "version": version,
        "locator": locator, "url": url, "read_scope": scope or locator,
        "supports": supports, "limits": limits,
        "relation": "editorial_counterargument_or_limit",
    }


ARISTOTLE_PHYSICS_INFINITE = citation(
    "Aristotle", "Physics", "Greek Ross edition; English R. P. Hardie and R. K. Gaye at Aristotle Reader",
    "III.5, 204b–205a", "https://aristotle.johnhboyer.com/Phys/book/3/",
    "质疑无限可感物体作为诸元素之外的共同本源，并要求说明其与有限元素共存。",
    "这是对无界物体的一种自然学反论，不反驳一切关于无界者的形而上学解释。",
)
ARISTOTLE_META_SINGLE = citation(
    "Aristotle", "Metaphysics", "Greek Ross edition; English W. D. Ross at Aristotle Reader",
    "I.8, 988b22–989a", "https://aristotle.johnhboyer.com/Meta/book/1/",
    "单一物质元素说未解释运动原因、实体本质及元素间如何转化。",
    "并非对某一个‘气’学说的直接判决；只检验单一物质原则的局部解释力。",
)
ARISTOTLE_META_NOUS = citation(
    "Aristotle", "Metaphysics", "Greek Ross edition; English W. D. Ross at Aristotle Reader",
    "I.4, 985a17–21", "https://aristotle.johnhboyer.com/Meta/book/1/",
    "批评阿那克萨戈拉仅在解释无着时诉诸努斯，未一贯说明自然过程。",
    "不否定努斯作为原则的一切可能用法；这是有明确对象的古代反论。",
)
PLATO_APOLOGY = citation(
    "Plato", "Apology", "Greek/English at Ad Fontes; English translator not stated on consulted page",
    "29c–30a", "https://adfonteslibrary.org/work-plato-apology",
    "苏格拉底在城邦要求停止哲学时明确表示仍要继续，并将神命置于这种命令之上。",
    "不能从此推出所有法律均可不守；是《克里同》守法论的有界反问。",
)
PLATO_PARMENIDES = citation(
    "Plato", "Parmenides", "Greek/English at Ad Fontes; English translator not stated on consulted page",
    "130e–133a", "https://adfonteslibrary.org/work-plato-parmenides",
    "对分离理念如何由多个可感物共同分有提出整体/部分与相似性回归难题。",
    "对话内批评不等于柏拉图废除全部理念，也不直接讨论社会权力分配。",
)
ARISTOTLE_EQUITY = citation(
    "Aristotle", "Nicomachean Ethics", "W. D. Ross English translation, MIT Internet Classics Archive",
    "V.10, 1137a31–1138a3", "https://classics.mit.edu/Aristotle/nicomachaen.5.v.html",
    "一般法则会漏掉特殊情形，需要公平判断来修正规则的过度概括。",
    "这是对普遍规则机械应用的局部限制，不能证明所有中道伦理都服务既有权力。",
)
PLATO_SOPHIST = citation(
    "Plato", "Sophist", "Greek/English at Ad Fontes; English translator not stated on consulted page",
    "248e–249d", "https://adfonteslibrary.org/work-plato-sophist",
    "拒绝把存在全说成静止，也拒绝全说成运动，要求两者均获位置。",
    "对不动一者的概念挑战不等于已证明任一特定物理变化理论。",
)
ARISTOTLE_SOUL = citation(
    "Aristotle", "De Anima", "Greek W. D. Ross 1961; J. A. Smith English 1931 at Aristotle Reader",
    "I.3, 407b13–26", "https://aristotle.johnhboyer.com/DA/book/1/",
    "批评灵魂可不顾身体条件而任意进入任何身体的毕达哥拉斯式说法。",
    "不直接讨论恩培多克勒每一轮回残篇，也不否定所有人格延续理论。",
)
ARISTOTLE_META_ATOMS = citation(
    "Aristotle", "Metaphysics", "Greek Ross edition; English W. D. Ross at Aristotle Reader",
    "I.4, 985b4–20", "https://aristotle.johnhboyer.com/Meta/book/1/",
    "指出原子形状、次序和位置的说明仍没有解释运动从何发生。",
    "这不是对现代原子论的实验否证，且不等于所有新性质都不可由组合说明。",
)
CICERO_FATE = citation(
    "Cicero", "De fato / On Fate", "Latin original and two direct English translations, Mouseia digital edition",
    "§§46–48, chapter 20", "https://en.mouseia.org/texts/cicero-fato/chapter-20",
    "质疑无因偏转为何能生出自愿行动，而不只是另一个无法说明的运动。",
    "是西塞罗对伊壁鸠鲁派的论辩，不解决现代自由意志问题。",
)
EPICTETUS_CYNIC = citation(
    "Epictetus", "Discourses", "George Long English translation, Wikisource transcription",
    "III.22, opening cloak-and-staff passage", "https://en.wikisource.org/wiki/The_Discourses_of_Epictetus%3B_with_the_Encheiridion_and_Fragments/Book_3/Chapter_22",
    "指出只穿斗篷、持杖、公开辱骂的外在表演不足以成为犬儒哲人。",
    "不是直接反对狄奥根尼所有公开实践，而是从斯多亚立场给出真伪区分。",
)

VASUBANDHU_TIME = citation(
    "Sarvāstivādin position, reported by Vasubandhu", "Abhidharmakośabhāṣya",
    "Louis de La Vallée Poussin French; Leo M. Pruden English, vol. III, Asian Humanities Press",
    "Chapter V, discussion of existence of past and future dharmas, PDF pp. 63–70",
    "https://lukashevichus.site/knigi/Vasubandhu%20Abhidharma%20ValleePoussin%20Pruden%203.pdf",
    "有部论证过去与未来法必须在某种意义上存在，才可解释记忆、业果和因果关联。",
    "此为世亲所报告、随后批驳的有部论点，不能归为世亲本人的结论；只支持三世实有的局部问题。",
)
VASUBANDHU_TIME["relation"] = "reported_primary_position_not_authors_endorsement"
VASUBANDHU_SEED = citation(
    "Vasubandhu", "Abhidharmakośabhāṣya",
    "Louis de La Vallée Poussin French; Leo M. Pruden English, vol. III, Asian Humanities Press",
    "Chapter V, seed discussion, PDF pp. 26–27",
    "https://lukashevichus.site/knigi/Vasubandhu%20Abhidharma%20ValleePoussin%20Pruden%203.pdf",
    "以种子为从既往烦恼和行为留下的能力，解释后来效果；借记忆和稻种作比。",
    "不能证明一切隐藏因果均可追认，也不直接证明课程完整格位。",
)
VASUBANDHU_SEED["relation"] = "local_positive_primary"
LANKA_MIND = citation(
    "Laṅkāvatāra Sūtra", "Laṅkāvatāra Sūtra", "D. T. Suzuki English translation from Sanskrit; online transcription",
    "Chapter II, discussion of wrong discrimination, pp. 150–151; Sagāthakam vv. 32–33",
    "https://kinhsach.chuakhainguyen.com/Books/T16n0670/The%20Lankavatara%20Sutra%20(Suzuki)/lanka-nondiacritical.htm",
    "把外境的多样性说成心之显现，并讨论对象与认识的二分如何生起。",
    "只支持唯识/唯心局部命题，不等于课程对现代摩尔等的全部组合；译者注明部分相邻段落译法存疑。",
)
LANKA_MIND["relation"] = "local_positive_primary"
LANKA_CHALLENGE = citation(
    "Laṅkāvatāra Sūtra", "Laṅkāvatāra Sūtra", "D. T. Suzuki English translation from Sanskrit; online transcription",
    "Sagāthakam vv. 563–565",
    "https://kinhsach.chuakhainguyen.com/Books/T16n0670/The%20Lankavatara%20Sutra%20(Suzuki)/lanka-nondiacritical.htm",
    "经文呈现反问：若无外境，心如何无所缘而起；随后以真如、唯心回应。",
    "这是文本内部提出的异议，不是独立实验校验理论，也不能证明所有外境均不存在。",
)
XUNZI_RITES = citation(
    "荀子", "礼论篇", "传世汉文，维基文库转录；底本未核",
    "篇首‘礼起于何也’至‘制礼义以分之’",
    "https://zh.wikisource.org/zh-hant/%E8%8D%80%E5%AD%90/%E7%A6%AE%E8%AB%96%E7%AF%87",
    "欲望、物资与争夺之间需有礼义分配和协调，单凭自然欲求不足以组织公共生活。",
    "荀子以礼义为解法，不直接反驳杨朱或老子全部论点。",
)
MOZI_CARE = citation(
    "墨子", "兼爱中", "传世汉文，维基文库转录；底本未核",
    "‘以兼相爱、交相利之法易之’及上下段",
    "https://zh.wikisource.org/zh-hant/%E5%A2%A8%E5%AD%90/%E5%85%BC%E6%84%9B%E4%B8%AD",
    "提出以相爱互利改变相害局面，强调可见的行动与制度倡导。",
    "并非直接反驳庄子或当代解构论；只作公共行动的局部反方依据。",
)
XUNZI_NAMES = citation(
    "荀子", "正名篇", "传世汉文，维基文库转录；底本未核",
    "‘名定而实辨’至‘约定俗成谓之宜’",
    "https://zh.wikisource.org/zh-hant/%E8%8D%80%E5%AD%90/%E6%AD%A3%E5%90%8D%E7%AF%87",
    "共享名称使异同可辨、意思可通，约定的名称并非全无公共作用。",
    "荀子也承认名依约定，不能用来证明名称天然对应本质；非直接反后现代文本。",
)
PLATO_POETRY = citation(
    "Plato", "Republic", "Benjamin Jowett English translation, 3rd ed., Project Gutenberg #55201",
    "X, 605–606",
    "https://www.gutenberg.org/files/55201/55201-h/55201-h.htm",
    "质疑诗的摹仿会强化哀痛而削弱理性节制。",
    "柏拉图并非在讨论现代创伤写作或医疗援助；只是对诗性重写的一项局部风险论证。",
)
JAMES_MYSTIC = citation(
    "William James", "The Varieties of Religious Experience", "1902 lectures; Project Gutenberg English transcription",
    "Lectures XVI–XVII, conclusion on mystical states",
    "https://www.gutenberg.org/files/621/621-h/621-h.html",
    "神秘体验单凭其神秘性不自带公共权威，只能提出值得考虑的假说。",
    "詹姆斯并不一概否定神秘体验；此处只限制以不可说来免除说明责任。",
)
HUME_EVIL = citation(
    "David Hume", "Dialogues Concerning Natural Religion", "Project Gutenberg English transcription; original 1779",
    "Part X, Philo's question about misery and divine benevolence",
    "https://www.gutenberg.org/files/4583/4583-h/4583-h.htm",
    "指出现实苦难与全能、全善的神性相容性需要论证。",
    "不是对任何死后盼望的心理否定，也不直接分析当代制度。",
)
HUME_EVIL["relation"] = "editorial_counterargument_or_limit"
LOCKE_EXTERNAL = citation(
    "John Locke", "An Essay Concerning Human Understanding", "2nd ed. 1690 text, Project Gutenberg #10616",
    "IV.xi §§1–3, sensation and existence of other things",
    "https://www.gutenberg.org/cache/epub/10616/pg10616.html.utf8",
    "借实际感官作用论证外部对象的存在可有知识地位，而非只悬为实体推测。",
    "洛克承认证明程度低于直观与演绎，不能用他证明外物的绝对确定性。",
)
SMITH_SPECTATOR = citation(
    "Adam Smith", "The Theory of Moral Sentiments", "Project Gutenberg #67363, English original, 1759/revised edition",
    "Part III, chapter 3, impartial spectator and correction of self-love",
    "https://www.gutenberg.org/files/67363/old/67363-h/67363-h.htm",
    "同情和自爱会偏斜判断，需要借公正旁观者观点校正。",
    "并非否定同情的伦理作用；只限制把未经校正的同情当充分公正规则。",
)
SPENCER_EVOLUTION = citation(
    "Herbert Spencer", "First Principles", "1862 work; Project Gutenberg #55046 transcription of later revised English edition",
    "Part II, §§97–99 and §§143–145 on integration, differentiation and dissolution",
    "https://www.gutenberg.org/cache/epub/55046/pg55046-images.html",
    "把多类变化纳入物质整合、分化与解离的演化图式。",
    "只支持斯宾塞的自然主义进化框架，不证明课程所称自然神论或社会进步的全部格位。",
)
SPENCER_EVOLUTION["relation"] = "local_positive_primary"
JAMES_SPENCER = citation(
    "William James", "Memories and Studies", "1911 English collection, Project Gutenberg #20768",
    "essay 'Herbert Spencer', critique of mechanical evolution formula",
    "https://www.gutenberg.org/cache/epub/20768/pg20768-images.html",
    "批评把物质整合公式无差别推广到生命、心理与社会历史。",
    "针对斯宾塞具体公式，不否定演化研究，也不证明偶然与制度责任的全部论点。",
)
MILL_LIBERTY = citation(
    "John Stuart Mill", "On Liberty", "1859 English original, Project Gutenberg #34901",
    "Chapter III, experiments of living and harm to others",
    "https://www.gutenberg.org/cache/epub/34901/pg34901-images.html",
    "个人应有生活实验空间，止于伤害他人，生存效率不能直接穷尽人生选择。",
    "不直接讨论达尔文自然选择的科学正确性，只反对将其误用为唯一规范目的。",
)
BLOCK_QUALIA = citation(
    "Ned Block", "Troubles with Functionalism", "Minnesota Studies in Philosophy of Science 9 (1978), pp. 261–325; author-listed university PDF",
    "Part II, absent qualia / homunculi headed system argument, around p. 278",
    "https://home.csulb.edu/~cwallis/382/readings/482/block.troubles%20with%20functionalism.pdf",
    "功能或行为组织相同仍可能缺少主观感质，这构成同表现推出同体验的反问。",
    "这不证明具体他人无感受，也不直接讨论日常行为主义的全部版本。",
)
MARX_PRACTICE = citation(
    "Karl Marx", "Theses on Feuerbach", "1845 manuscript, Engels-edited 1888 publication; Marxists Internet Archive English",
    "Thesis XI, concluding sentence",
    "https://www.marxists.org/archive/marx/works/1845/theses/theses.htm",
    "仅作个人解脱的解释并不替代对现实关系的改变。",
    "这是行动要求，不足以独立证明某种佛教经验必然忽视制度。",
)
STIRNER_EGO = citation(
    "Max Stirner", "The Ego and Its Own", "1844 German; 1907 Steven T. Byington English translation at MIA",
    "opening 'All Things Are Nothing to Me' and Part II on own cause",
    "https://www.marxists.org/reference/archive/stirner/ego-and-its-own.htm",
    "把自己的事业和价值判断安置在独特的自我之上，质疑外在神圣要求。",
    "斯蒂纳没有论证世界由我制造，也不等于课程所批评的粗俗唯我论；仅是自我中心主张的有限相邻原典。",
)
STIRNER_EGO["relation"] = "near_positive_comparison_only"
DURKHEIM_TOTEM = citation(
    "Émile Durkheim", "The Elementary Forms of Religious Life", "1912 French; Joseph Ward Swain English 1915, Project Gutenberg #41360",
    "Book II, chapter VII, totemic emblem as visible form of collective sacred force",
    "https://www.gutenberg.org/files/41360/41360-h/41360-h.htm",
    "宗教物件可在群体生活中承载超出实用功能的神圣、保护和义务意义。",
    "这是涂尔干的社会学解释，不证明物件实际有超自然保护力，也不等同课程完整象征主义。",
)
DURKHEIM_TOTEM["relation"] = "local_positive_comparison"
SPINOZA_NECESSITY = citation(
    "Benedict de Spinoza", "Ethics", "1677 Latin; R. H. M. Elwes English translation, Project Gutenberg #3800",
    "Part I, proposition 29",
    "https://www.gutenberg.org/files/3800/3800-h/3800-h.htm",
    "主张事物的存在和行动由神/自然的必然性所定，不由偶然支配。",
    "斯宾诺莎由必然性导向理解与能动性，不能据此称他主张消极认命；只支持‘安排/必然’局部。",
)
SPINOZA_NECESSITY["relation"] = "local_positive_comparison"
MARX_THESES_II_III = citation(
    "Karl Marx", "Theses on Feuerbach", "1845 manuscript; Engels-edited 1888 version, MIA English",
    "Theses II–III on truth in practice and changing circumstances",
    "https://www.marxists.org/archive/marx/works/1845/theses/theses.htm",
    "把思想的真实性与共同实践、改变环境及自我改变联系起来。",
    "不证明课程关于自我超越的完整本体图景；只支持从独思转向实践检验。",
)
MARX_THESES_II_III["relation"] = "local_positive_comparison"
NIETZSCHE_RANK = citation(
    "Friedrich Nietzsche", "Beyond Good and Evil", "1886 German; Helen Zimmern English, Project Gutenberg #4363",
    "§257, aristocratic society, distance and rank",
    "https://www.gutenberg.org/files/4363/4363-h/4363-h.htm",
    "把等级距离与人类类型的提升相联，明确赞同价值和地位的高低差别。",
    "其论述没有把自然科学秩序直接证明为政治等级，也不证明课程全部格位。",
)
NIETZSCHE_RANK["relation"] = "local_positive_comparison"
KANT_HUMANITY = citation(
    "Immanuel Kant", "Fundamental Principles of the Metaphysic of Morals", "1785 German; Thomas Kingsmill Abbott English, Project Gutenberg #5682",
    "Second Section, humanity formula",
    "https://www.gutenberg.org/files/5682/5682-h/5682-h.htm",
    "理性者应作为目的被对待，不能仅作他人目的的工具；关系需要尊重其自主性。",
    "康德未直接讨论该课程的爱情神圣论；这里只反驳允许伴侣支配的推论。",
)
MARX_CIRCUMSTANCES = citation(
    "Karl Marx", "Theses on Feuerbach", "1845 manuscript; Engels-edited 1888 version, MIA English",
    "Thesis III, circumstances changed by people",
    "https://www.marxists.org/archive/marx/works/1845/theses/theses.htm",
    "强调环境与教育条件可由共同实践改变，不能把结构性困境只交给个人调心。",
    "不是对所有个体修养的否定，也不直接评判该课程完整立场。",
)
KANT_BEAUTY_GOOD = citation(
    "Immanuel Kant", "Critique of Judgement", "1790 German; J. H. Bernard English, Project Gutenberg #48433",
    "Analytic of the Beautiful, §7–8, beauty versus good",
    "https://www.gutenberg.org/cache/epub/48433/pg48433-images.html",
    "审美判断与关于善的概念判断不能直接等同。",
    "不排除艺术作品具有道德意义；仅限制‘美即善’的直接跳跃。",
)
HUME_ROWERS = citation(
    "David Hume", "An Enquiry Concerning the Principles of Morals", "1751 English original, Project Gutenberg #4320",
    "Appendix III, two rowers/common convention passage",
    "https://www.gutenberg.org/files/4320/4320-h/4320-h.htm",
    "共同事业需彼此履行责任，一人搭便车会使集体利益无法成立。",
    "不是具体公共设施成本核算模型，只是合作惯例的局部反方。",
)
NIETZSCHE_REVENGE = citation(
    "Friedrich Nietzsche", "On the Genealogy of Morals", "1887 German; Horace B. Samuel English, Project Gutenberg #52319",
    "Second Essay §11, law and private revenge",
    "https://www.gutenberg.org/files/52319/old/52319-h/52319-h.htm",
    "区分受害者私人复仇与公共法律判断，指出后者试图阻断报复循环。",
    "这是对复仇的反方而非正方；不能作为课程复仇主义正面引证。",
)
FREUD_NORMAL = citation(
    "Sigmund Freud", "The Ego and the Id", "1923 German; Joan Riviere English translation, Project Gutenberg #79682",
    "chapter III, analytic dissection of normal and abnormal phenomena",
    "https://www.gutenberg.org/files/79682/79682-h/79682-h.htm",
    "将正常与异常心理现象放在同一分析框架，借自我、超我和本我区分精神冲突。",
    "弗洛伊德此处并非给任何日常说话者下诊断，也没有证明正常/反常界线须支配个人价值。",
)
FREUD_NORMAL["relation"] = "local_positive_primary"
LACAN_OTHER = citation(
    "Jacques Lacan", "The Subversion of the Subject and the Dialectic of Desire", "Écrits English translation Bruce Fink, Norton 2005; University of Helsinki course excerpt",
    "Écrits English pp. 690 / 815, 'Che vuoi?' question",
    "https://studies.helsinki.fi/api/courses/cur/file/pub/system/files/attachments/2022-11/Lacan_subversion%20of%20Sthe%20subject.pdf?hmac=d0fe7aad1b9c40ce41b8fae1de40dfa9dd845960681b473fd4b59e4ee870dd7a",
    "论述欲望与他者之欲的关系，以及‘他想从我这里得到什么’的主体提问。",
    "仅支持拉康问题结构，不等同日常猜心术；也不能推出所有人际沟通都不可澄清。",
)
LACAN_OTHER["relation"] = "local_positive_primary"
POPPER_PSYCHOANALYSIS = citation(
    "Karl Popper", "Conjectures and Refutations", "1963 English original; Rosenfels hosted PDF scan",
    "chapter I, pp. 34–36, Freud/Adler confirmation example",
    "https://www.rosenfels.org/Popper.pdf",
    "指出若相反行为都能用同一解释补救，临床确认就缺少区分力。",
    "波普尔批评的是某些心理分析解释的检验方式，不是证明爱欲或无意识概念本身不存在。",
)
MOZI_THREE_TESTS = citation(
    "墨子", "非命上", "传世汉文，维基文库转录；底本未核",
    "篇首‘言必有三表’至‘观其中国家百姓人民之利’",
    "https://zh.wikisource.org/zh-hant/%E5%A2%A8%E5%AD%90/%E9%9D%9E%E5%91%BD%E4%B8%8A",
    "主张言说要接受历史、耳目经验和公共利益三类检验，不能仅靠事后圆说。",
    "墨子直接讨论命论，不是对道家‘适时介入’的直接论战；只是明确的检验要求。",
)
NIETZSCHE_REVENGE_PRO = citation(
    "Friedrich Nietzsche", "Human, All-Too-Human, Part II", "German 1880; Paul V. Cohn English, Project Gutenberg #37841",
    "'The Wanderer and His Shadow' §33, revenge of readjustment, pp. 213–215",
    "https://dev.gutenberg.org/files/37841/37841-h/37841-h.html",
    "伤害后的报复可以为恢复受损的荣誉而愿承担额外危险，并非简单追回损失。",
    "尼采是在分析复仇心理，并非提倡此课程的复仇目的，也不证明报偿计算的全部结构。",
)
NIETZSCHE_REVENGE_PRO["relation"] = "local_positive_analysis_not_endorsement"
ANAXIMENES_AIR = citation(
    "Plutarch and Aetius reporting Anaximenes", "Presocratic testimonia on Anaximenes",
    "Ancient testimonia, English compilation at Ad Fontes; translator not specified on page",
    "Plutarch Strom. 3 / Aetius I.3, condensation and rarefaction testimonia",
    "https://adfonteslibrary.org/presocratics",
    "保存以一气的疏密变化解释火、风、云、水、地等形态的古代报告。",
    "阿那克西美尼本人的完整著作不存；此为后世见证，且不证明课程对气质的全部赋义。",
)
ANAXIMENES_AIR["relation"] = "ancient_primary_testimonium_local"
DIOGENES_LIFE = citation(
    "Diogenes Laërtius reporting Diogenes of Sinope", "Lives of Eminent Philosophers, Book VI",
    "Ancient biographical testimony, English translation at Fordham Sourcebooks; translator not displayed in consulted section",
    "Book VI, Life of Diogenes, §§71–73 around public conduct and nature versus convention",
    "https://sourcebooks.fordham.edu/ancient/diogeneslaertius-book6-cynics.asp",
    "保存第欧根尼以操练少需要、公开挑战习俗、重自由的古代记述。",
    "并非第欧根尼自撰原著，隔世传记有轶事可靠性限制；不支持课程完整犬儒目的格。",
)
DIOGENES_LIFE["relation"] = "ancient_primary_testimonium_local"
CARNAP_PHYSICAL = citation(
    "Rudolf Carnap", "Psychology in Physical Language", "Erkenntnis 3 (1932/33), English translation in Stanford hosted reader; translator not stated in excerpt",
    "§6 opening, protocol and physical language intertranslation",
    "https://web.stanford.edu/~paulsko/papers/Carn.pdf",
    "主张将个人记录译入可主体间通用的物理语言，以便科学陈述互相核对。",
    "是卡尔纳普物理主义方案的局部依据，不证明课程‘相对语法主义’全部组合。",
)
CARNAP_PHYSICAL["relation"] = "local_positive_primary"
MILL_DISSENT = citation(
    "John Stuart Mill", "On Liberty", "1859 English original, Project Gutenberg #34901",
    "Chapter II, liberty of thought and discussion; Chapter III, experiments of living",
    "https://www.gutenberg.org/cache/epub/34901/pg34901-images.html",
    "多数人的既成共识可能压制少数异议；公共讨论要保留不同意见的可表达性。",
    "密尔不是直接批评科学共享语法，不能由此否定为核对记录建立约定语言。",
)
STALIN_DIALECTICS = citation(
    "Joseph Stalin", "Dialectical and Historical Materialism", "1938 English translation at MIA; translator not stated",
    "sections 1–2, dialectical method and materialist conception; section 3 on historical materialism",
    "https://www.marxists.org/reference/archive/stalin/works/1938/09.htm",
    "将物质运动、相互联系与社会思想和物质生活的关系组织成官方辩证唯物主义论述。",
    "只证明该历史文本确实表述此方法，不证明其科学效力或行政实践正当。",
)
STALIN_DIALECTICS["relation"] = "local_positive_primary"
MAO_ANTI_DOGMA = citation(
    "Mao Zedong", "On Practice", "1937 Chinese lecture/article; MIA English translation, translator unstated",
    "opening note and conclusion on practice as truth criterion",
    "https://www.marxists.org/reference/archive/mao/selected-works/volume-1/mswv1_16.htm",
    "在马克思主义内部明确反对摘句教条，要求计划经实际实践检验和修改。",
    "不是对某一行政权力垄断的直接史实判决；仅支持反例须进入方法的内在反方。",
)
XUNZI_NAMES_PRO = citation(
    "荀子", "正名篇", "传世汉文，维基文库转录；底本未核",
    "‘名无固宜，约之以命’及‘名定而实辨’",
    "https://zh.wikisource.org/zh-hant/%E8%8D%80%E5%AD%90/%E6%AD%A3%E5%90%8D%E7%AF%87",
    "名称经约定而有公共辨别作用，不能把名称本身当事物固有本质。",
    "荀子并非现代符号实用主义者；只是对公共命名机制的局部古典比较。",
)
XUNZI_NAMES_PRO["relation"] = "ancient_local_comparison"
MARX_IDEAS = citation(
    "Karl Marx and Friedrich Engels", "The German Ideology", "1845–46 manuscript; MIA English transcription",
    "Part I, 'Ruling Class and Ruling Ideas'",
    "https://www.marxists.org/archive/marx/works/1845/german-ideology/ch01b.htm",
    "主导思想的生产和传播与掌握物质、精神生产手段的阶级相关，抽象大名称可能遮蔽这种关系。",
    "不能用它断言每一套共同语法皆为统治工具，也不替代逐案证据。",
)
WEBER_MEANING = citation(
    "Max Weber", "The Theory of Social and Economic Organization", "German 1922 posthumous; A. M. Henderson and Talcott Parsons English 1947 PDF",
    "The Fundamental Concepts of Sociology, §1, social action and subjective meaning",
    "https://wiswo.org/books/_resources/book-reference-pdfs/Weber-1947-The%20Theory%20of%20Social%20and%20Economic%20Organization.pdf",
    "社会行动的解释需要把行动者赋予的意义纳入，而不能只给外在规律。",
    "韦伯并不否认因果解释或统计方法；只反对把它们当作充分的人类行动说明。",
)
HEGEL_LOVE = citation(
    "G. W. F. Hegel", "Elements of the Philosophy of Right", "1820 German; T. M. Knox English translation at MIA",
    "§158 and Addition, love as unity with another",
    "https://www.marxists.org/reference/archive/hegel/works/pr/prfamily.htm",
    "爱情使自我在与他者的关系中理解自身，包含独立性与统一性的张力。",
    "黑格尔讨论家庭伦理，不证明爱情本身能超越所有社会强制或完成课程的宇宙精神图景。",
)
HEGEL_LOVE["relation"] = "local_positive_comparison"
BERGSON_LIFE = citation(
    "Henri Bergson", "Creative Evolution", "1907 French; Arthur Mitchell English, Project Gutenberg #26163",
    "Chapter I, mechanism, duration and mathematical treatment of life",
    "https://www.gutenberg.org/files/26163/26163-h/26163-h.htm",
    "论证生命历程的生成性不能直接穷尽于物理量的数学处理。",
    "不否定测量和力学的有效范围，也非对牛顿引力定律的实验反证。",
)
LOCKE_CONSENT = citation(
    "John Locke", "Second Treatise of Government", "1690 English original, Project Gutenberg #7370",
    "Chapter VIII §95, consent to political power",
    "https://www.gutenberg.org/files/7370/7370-h/7370-h",
    "政治权力的正当性要论证自由平等者的同意，不从物理空间同质性直接推出。",
    "洛克没有针对牛顿绝对空间论战；是将政治平等另立规范依据的对照。",
)
RUSSELL_FACTS = citation(
    "Bertrand Russell", "Our Knowledge of the External World", "1914 English original, Project Gutenberg #37090",
    "Lecture IV, atomic propositions and logical form; remark on first acquisition of atomic facts",
    "https://www.gutenberg.org/files/37090/37090-h/37090-h.htm",
    "即使重视逻辑形式，最初取得事实知识也不能只靠逻辑。",
    "罗素并非直接批评其逻辑原子论；这是对过度形式化的内在限制，不等于已说明权力语境。",
)
DECI_REWARDS = citation(
    "Edward L. Deci and Richard M. Ryan", "The Support of Autonomy and the Control of Behavior",
    "Journal of Personality and Social Psychology 53 (1987), author hosted PDF",
    "pp. 1026–27, 'Rewards' subsection",
    "https://selfdeterminationtheory.org/SDT/documents/1987_DeciRyan_JPSP.pdf",
    "总结受控奖励往往削弱对原活动的内在兴趣，但不同奖励结构效果有差别。",
    "这不证明所有奖项有害，也不说明课程比赛立场的全部目的格。",
)
HUME_MIRACLES = citation(
    "David Hume", "An Enquiry Concerning Human Understanding", "1748 English original, Project Gutenberg #9662",
    "Section X, Part I, testimony and miracles",
    "https://www.gutenberg.org/cache/epub/9662/pg9662-images.html",
    "特殊启示或见证也须接受与既有经验强度相称的证据权衡。",
    "休谟没有直接讨论灵知派；不证明所有宗教体验均为错觉。",
)
MARK_PASSION = citation(
    "Gospel according to Mark", "New Testament, Mark 15", "King James Version English 1611, Project Gutenberg Bible edition",
    "Mark 15:33–39, crucifixion and death",
    "https://www.gutenberg.org/cache/epub/10/pg10-images.html",
    "受难叙事以具体身体、呼喊与死亡呈现人与神关系。",
    "原叙事不直接证明课程关于从受苦理解神人距离的整个哲学解释；经文作者和历史核证另有争议。",
)
MARK_PASSION["relation"] = "primary_narrative_local"
SMITH_FORTUNE = citation(
    "Adam Smith", "The Theory of Moral Sentiments", "1759 English original with later revisions, Project Gutenberg #67363",
    "Part II, section III, chapter I, effect of fortune upon merit and demerit",
    "https://www.gutenberg.org/files/67363/old/67363-h/67363-h.htm",
    "结果与运气改变人们对功过的评价，同样意图未必得到同样境遇。",
    "斯密并未直接讨论课程的贵贱等级；此处只限制以结果归咎个体品格。",
)
MARX_PRACTICE_TEST = citation(
    "Karl Marx", "Theses on Feuerbach", "1845 manuscript; Engels-edited 1888 publication, MIA English",
    "Thesis II, practice as test of thought's reality and power",
    "https://www.marxists.org/archive/marx/works/1845/theses/theses.htm",
    "关于可行与真实的想象需经现实实践检验，不能只在观念里自我确认。",
    "马克思并未批判一切文学随笔；这里只针对把想象当已实现方案的推断。",
)
NIETZSCHE_VALUES = citation(
    "Friedrich Nietzsche", "Thus Spoke Zarathustra", "1883–85 German; Thomas Common English, Project Gutenberg #1998",
    "Part I, 'The Way of the Creating One', companions creating new values",
    "https://www.gutenberg.org/files/1998/1998-h/1998-h.htm",
    "在旧价值被批判后仍要求创造新价值，否定‘揭露即一切意义都须尽毁’的必然推论。",
    "文学哲学文本不提供具体修复制度的方案；非对该课程反美化格位的直接论战。",
)
MILL_HARM = citation(
    "John Stuart Mill", "On Liberty", "1859 English original, Project Gutenberg #34901",
    "Chapter I, liberty limited by harm to others",
    "https://www.gutenberg.org/cache/epub/34901/pg34901-images.html",
    "自由行动必须正视对他人的伤害；反规训本身不能豁免安全与责任。",
    "不能用此取消有同意和安全条件的自愿实践。",
)
HUME_EXTERNAL_GOD = citation(
    "David Hume", "An Enquiry Concerning Human Understanding", "1748 English original, Project Gutenberg #9662",
    "Section XII, Part I, external world and argument for God",
    "https://www.gutenberg.org/cache/epub/9662/pg9662-images.html",
    "指出一旦外在世界的证据受怀疑，凭外物推出神及其属性的论证也受牵连。",
    "休谟不是针对贝克莱全部经文论证逐句驳斥；这里只构成神学担保的局部反问。",
)
KANT_UNIVERSAL_END = citation(
    "Immanuel Kant", "Fundamental Principles of the Metaphysic of Morals", "1785 German; Thomas Kingsmill Abbott English, Project Gutenberg #5682",
    "Second Section, humanity formula, every rational being as end",
    "https://www.gutenberg.org/files/5682/5682-h/5682-h.htm",
    "尊重义务及于每个理性者，不只限于已有共同体的‘我们’。",
    "康德的普遍主义并非罗蒂式团结的直接反驳；只提出成员边界的实质反问。",
)
MARX_RELATIONS = citation(
    "Karl Marx", "Theses on Feuerbach", "1845 manuscript, Engels-edited 1888, W. Lough English 1969 at MIA",
    "Thesis VI, human essence as ensemble of social relations",
    "https://www.marxists.org/archive/marx/works/1845/theses/theses.htm",
    "人的现实生活嵌在社会关系中，单诉内心信仰不足以说明共同责任。",
    "并非直接反对路德的信仰论或宗教自由；只是公共关系的局部反方依据。",
)
MARX_CONDITIONS = citation(
    "Karl Marx and Friedrich Engels", "The German Ideology", "1845–46 manuscript, MIA English translation",
    "Part I, 'First Premises of Materialist Method' and division of labour section",
    "https://www.marxists.org/archive/marx/works/1845/german-ideology/ch01a.htm",
    "现实个体在具体物质和社会条件中生活；困境不能一律归给无时间性的意志本身。",
    "不否认个体愿望参与痛苦，也不能仅凭此文本判定具体制度怎样改革。",
)
MILL_EQUAL_UTILITY = citation(
    "John Stuart Mill", "Utilitarianism", "1863 English original, Project Gutenberg #11224",
    "Chapter V, justice and equality of each person's happiness",
    "https://www.gutenberg.org/files/11224/11224-h/11224-h.htm",
    "即便以效用为标准，仍须等量考虑每个人的幸福，不能让少数受益者垄断何为有效。",
    "密尔是在功利主义内部提出规范要求，不证明现实效用评估已做到公平。",
)
YIJING_SHENGSHENG = citation(
    "《周易·系辞上传》作者未定", "《周易·系辞上传》", "传世中文文本；中国古典文学网页本，底本未注明",
    "第五章，一阴一阳／日新／生生／通变诸句",
    "https://www.zggdwx.com/zhouyi/69.html",
    "阴阳交替、日新、生生与通变被并置，可作为变化中有连续性的局部正方依据。",
    "该章并未证明每一次历史事件严格循环，也不能把阴阳直接等同社会进步；仅支持变化模式的局部命题。",
    "网页第五章全文，第7—15行；未核纸本底本。",
)
YIJING_SHENGSHENG["relation"] = "local_primary_comparison"
NEWTON_ACTIVE = citation(
    "Isaac Newton", "Opticks, Third Book", "1718 London second edition with additions; Newton Project normalized electronic transcription",
    "Book III, Part I, Query 31, printed pp. 373–376",
    "https://www.newtonproject.ox.ac.uk/view/texts/normalized/NATP00051",
    "牛顿认为摩擦等使运动衰减，因而提出维持和补充运动的主动原理；可支持秩序维持问题的局部起点。",
    "原文是提问式自然哲学推论，并未证明上帝逐刻主动调校宇宙，不能视为该课程整格的实证。",
    "Query 31 网页第399—412行；核对网页所列1718版及规范化转录说明。",
)
NEWTON_ACTIVE["relation"] = "local_primary_comparison"
KANT_REGULATIVE_APPROACH = citation(
    "Immanuel Kant", "Critique of Pure Reason", "1781/1787 German; J. M. D. Meiklejohn English, Project Gutenberg #4280",
    "Transcendental Dialectic, Appendix, regulative use of ideas (A672–704/B700–732; exact pagination of this translation not verified)",
    "https://www.gutenberg.org/files/4280/4280-h/4280-h.htm",
    "理性的系统统一是指导经验研究的目标，沿经验前进可逐渐接近而不能完成。",
    "这是认识论的规约目标，不能推出世界本身必无限进步或存在课程格位的终局。",
    "网页第3090—3108、3158—3162、3265—3270行。",
)
KANT_REGULATIVE_APPROACH["relation"] = "local_primary_comparison"
KANT_EXPERIENCE_LIMIT = citation(
    "Immanuel Kant", "Critique of Pure Reason", "1781/1787 German; J. M. D. Meiklejohn English, Project Gutenberg #4280",
    "Transcendental Dialectic, Appendix, inactive/perverted reason discussion",
    "https://www.gutenberg.org/files/4280/4280-h/4280-h.htm",
    "把规约理念实体化会停止对经验原因的调查；理论追求不能免于经验检验。",
    "是对无检验推测的限制，不否定一切理性目标或本格全部变体。",
    "网页第3253—3270行。",
)
NEWTON_LAWS = citation(
    "Isaac Newton", "Philosophiae Naturalis Principia Mathematica", "1726 third Latin edition; Andrew Motte 1729 English, restored transcription",
    "Axioms or Laws of Motion, Laws I–III, printed pp. 19–21",
    "https://emend.press/principia.html",
    "静止和运动在受力条件下服从可说明的共同法则，提供自然变化可由规则解释的局部依据。",
    "运动定律不证明所有现实具有永恒不变的形而上秩序；近代物理适用范围也有边界。",
    "网页第378—396行与第176—182行的天体推论。",
)
NEWTON_LAWS["relation"] = "local_primary_comparison"
MARX_PRACTICE_CHANGE = citation(
    "Karl Marx", "Theses on Feuerbach", "1845 manuscript; 1888 Engels edition; MIA English text",
    "Theses I–III, especially III on changed circumstances and human activity",
    "https://www.marxists.org/archive/marx/works/1845/theses/theses.htm",
    "人可以在实践中改变环境和教育条件，寻找原因并不等于接受现状。",
    "此段检验决定论式消极推论，不否认研究结构原因的重要。",
    "I–III 全段；网页/PDF平行核读。",
)
HEGEL_IDENTITY_DIFFERENCE = citation(
    "G. W. F. Hegel", "Science of Logic", "1812–1816 German; MIA English translation, translator not stated on cited page",
    "Book II, Doctrine of Essence, Chapter II, Remark 3, §§955–958",
    "https://www.marxists.org/reference/archive/hegel/works/hl/hl431.htm",
    "同一与差异的对立并非偶然并列，矛盾可被理解为内在运动的契机。",
    "逻辑学的论证不自动说明任一具体社会冲突皆能实现和解，也不证明课程全部轴。",
    "网页第97—117行。",
)
HEGEL_IDENTITY_DIFFERENCE["relation"] = "local_primary_comparison"
LIEZI_YANGZHU = citation(
    "《列子》编者未定；篇中托杨朱言", "《列子·杨朱》", "传世中文文本；快学网原文夹译本，古籍底本未注明",
    "《杨朱》原文：杨朱论原宪、子贡贫富与‘乐生／逸身’段",
    "https://www.kxue.com/gushi/guwen/521620.html",
    "把身体现实与活着的快乐置于贫富名声口号之前，可供课程此格的现实生命关切作局部对照。",
    "篇中并非否定所有公共治理，也不证明课程为这段所概括的整套世界观；文本成书年代与杨朱历史本人不能等同。",
    "网页第109—123行，区别原文与网站译文。",
)
LIEZI_YANGZHU["relation"] = "local_primary_comparison"
MARX_FORMULA_CRITIQUE = citation(
    "Karl Marx", "The Poverty of Philosophy", "1847 French; MIA English translation, translator not stated on cited page",
    "Chapter II, section 1, critique of Proudhon's absolute method and thesis–antithesis–synthesis formula",
    "https://www.marxists.org/archive/marx/works/1847/poverty-philosophy/ch02.htm",
    "把经济关系换成自动套用的三段逻辑，可能丢掉对象的具体历史关系。",
    "马克思此处针对蒲鲁东的方法，不能当作他对黑格尔全部辩证法的否定。",
    "网页第44—56行及该节后续。",
)
QUINE_SIMPLICITY_LIMIT = citation(
    "W. V. O. Quine", "Two Dogmas of Empiricism", "1951 Philosophical Review; 1953/1961 book variants marked in online transcription",
    "§6, empirical field/web of belief and simplicity of laws",
    "https://ditext.com/quine/quine.html",
    "简单性只是理论调整的一项考虑，整体信念网络还须与经验保持联系，不能仅求简而任意裁去事实关联。",
    "奎因没有直接评价本课程的具体简单主义，也没有给出自动可操作的复杂度阈值。",
    "网页第154—181行，含版本异文说明第5—7行。",
)
LYOTARD_GAMES = citation(
    "Jean-François Lyotard", "The Postmodern Condition: A Report on Knowledge", "1979 French; Geoff Bennington and Brian Massumi English, 1984; MIA excerpt",
    "§3 'The Method: Language Games', pages in full book not verified from excerpt",
    "https://www.marxists.org/reference/subject/philosophy/works/fr/lyotard.htm",
    "陈述、命令、提问等言语行为有不同规则和关系，不能简单由一个总尺度替代其差别。",
    "摘录不足以证明一切公共争论都不可比较，也不是停止任何共同决断的许可。",
    "网页第58—73行，核为原著英译摘录而非站点综述。",
)
LYOTARD_GAMES["relation"] = "local_primary_comparison"
NIETZSCHE_ANTIQUARIAN_LIMIT = citation(
    "Friedrich Nietzsche", "On the Use and Abuse of History for Life", "1874 German; Adrian Collins English in Thoughts Out of Season II, Project Gutenberg #38226",
    "Part III, antiquarian history and its degeneration",
    "https://www.gutenberg.org/cache/epub/38226/pg38226-images.html",
    "敬古可维系生活，但若把旧时代凝固为不可改变的模板，会窒息新的生活。",
    "尼采区分有用的历史保存与盲目复古；不能据此说一切传统都是错误。",
    "正文网页第176—188行及后续关于古物崇拜退化的段落；未把前言编者语当原著。",
)
OSTROM_LOCAL_RULES = citation(
    "Elinor Ostrom", "Design Principles of Robust Property Rights Institutions: What Have We Learned?", "2008 Lincoln Institute of Land Policy chapter PDF",
    "pp. 32–34 and 40, design principles 2–3 and collective choice discussion",
    "https://www.lincolninst.edu/app/uploads/2024/04/2076_1399_LP2008-ch02-Design-Principles-of-Robust-Property-Rights-Institutions_0.pdf",
    "资源治理规则须适应地方生态与利益分配，并使受影响者参与修订；远方管理者可能不了解变化。",
    "奥斯特罗姆讨论共有资源制度，非直接反对所有生态整体主义或证明地方知识总优。",
    "PDF转文本第264—299、376—383行，核对章节题名与作者。",
)
HABERMAS_DELIBERATION = citation(
    "Jürgen Habermas", "Political Communication in Media Society: Does Democracy Still Enjoy an Epistemic Dimension?", "Communication Theory 16 (2006), pp. 411–426; author PDF at MIT",
    "pp. 411–414, institutional design and public deliberation",
    "https://www.mit.edu/~shaslang/mprg/HabermasPCMS.pdf",
    "不同话语仍需借平等参与、公开论证和制度反馈形成共同可追责的公共决断；若没有桥接，决定可能退回权力。",
    "哈贝马斯提出规范模型及其经验条件，不能据此否定所有多元语言游戏，也不能断言现实媒体已达这些条件。",
    "PDF第3—48、85—91行，核对作者与刊物页码。",
)
MILINDA_IDENTITY_CHALLENGE = citation(
    "《弥兰陀王问经》传统作者未定；文中提问者弥兰陀王", "The Questions of King Milinda", "Pali dialogue; T. W. Rhys Davids English, Sacred Books of the East 35 (1890), online transcription",
    "Book III, Chapter 5, questions 5 and 7, printed pp. 111–112",
    "https://obo.genaud.net/dhamma-vinaya/pts/miln/miln.09.rhyt.pts.htm",
    "弥兰陀王明确追问无实体迁移却有再生时，后身为何仍担先前行为的责任。",
    "同章以点灯和芒果因果连续作答；不能把此反问说成经文已承认业报不成立。",
    "网页第100—120、140—160行，分清问者与答者。",
)
MILINDA_DEEDS_CHALLENGE = citation(
    "《弥兰陀王问经》传统作者未定；文中提问者弥兰陀王", "The Questions of King Milinda", "Pali dialogue; T. W. Rhys Davids English, Sacred Books of the East 35 (1890), online transcription",
    "Book III, Chapter 5, question 8, printed p. 112–113",
    "https://obo.genaud.net/dhamma-vinaya/pts/miln/miln.09.rhyt.pts.htm",
    "弥兰陀王追问已造之业能否指出位置；这提出把过去业当解释时可辨认性的难题。",
    "经文答以未结果之树和生命连续，非现代可证伪性理论；反问并非作者最终结论。",
    "网页第168—183行。",
)
STIRNER_OWN_CAUSE = citation(
    "Max Stirner", "The Ego and His Own / Der Einzige und sein Eigentum", "1844 German; Steven T. Byington English, 1907, Project Gutenberg #34580",
    "Opening section 'All Things are Nothing to Me', printed pp. 3–6",
    "https://www.gutenberg.org/files/34580/34580-h/34580-h.htm",
    "拒绝把神、国家、人类等外加事业当然当作自己的关切，可为‘不关我事’一端作局部对照。",
    "施蒂纳主动拆解权威和价值形成，恰不支持课程该分支所批评的未经反思照用现成尺度；不能称他就是该类。",
    "网页第177—200行；译者署名第161—166行。",
)
STIRNER_OWN_CAUSE["relation"] = "partial_comparison_not_classification"
ARISTOTLE_DEMOCRITUS_TESTIMONY = citation(
    "Aristotle reporting Leucippus and Democritus", "Metaphysics", "Greek Ross text; W. D. Ross English translation in bilingual online edition",
    "Book I.4, 985b4–20, testimony about full/void and shape/order/position",
    "https://aristotle.johnhboyer.com/Meta/book/1/",
    "古代原子说借充实与虚空及形状、次序、位置解释复合物的差异，支持本格原子组合机制的一端。",
    "这是亚里士多德的同时代后继者转述，不是德谟克利特手稿；同段恰批评它未说明运动从何而来，更不证明新目的层级。",
    "网页第875—913行，希腊文与英译对读；与反方共页但采用同段不同论证面，分别说明。",
)
ARISTOTLE_DEMOCRITUS_TESTIMONY["relation"] = "ancient_primary_testimonium_local"
NIETZSCHE_FALSE_ANALOGY = citation(
    "Friedrich Nietzsche", "On the Use and Abuse of History for Life", "1874 German; Adrian Collins English in Thoughts Out of Season II, Project Gutenberg #38226",
    "Part II, monumental history, printed pp. 19–21",
    "https://www.gutenberg.org/cache/epub/38226/pg38226-images.html",
    "把过去事件强配成会重演的固定范式，会省略动机与条件差异，形成事后套用的虚假类比。",
    "尼采批评的是纪念碑式历史误用，不直接反驳古代《易》的阴阳变化论；此为编者外部检验。",
    "正文网页第158—168行；排除前言编者语。",
)
IBSEN_NORA_MEANING = citation(
    "Henrik Ibsen", "A Doll's House", "1879 Norwegian; R. Farquharson Sharp English, Project Gutenberg #15492",
    "Act III, Nora and Helmer final conversation, printed pp. 106–110",
    "https://www.gutenberg.org/files/15492/15492-h/15492-h.htm",
    "诺拉指出自己被当成玩偶，继而坚持自己理解生活、受教育与重新作决定的责任，提供受压者重建意义的文学反例。",
    "戏剧人物不是理论论证；易卜生没有直接反驳课程的反审美/虚无综合格，更不能从诺拉一例推出所有受害者路径。",
    "网页第2337—2417行；核为戏剧第三幕原文而非评论。",
)
IBSEN_NORA_MEANING["relation"] = "editorial_literary_counterexample_not_direct_debate"
WHITMAN_LILACS = citation(
    "Walt Whitman", "When Lilacs Last in the Dooryard Bloom'd", "1865 poem; later Leaves of Grass collected text, Project Gutenberg #1322, specific collected edition not stated",
    "Sections 1–3 and 14–16, mourning, bird song, and retained memory",
    "https://www.gutenberg.org/files/1322/1322-h/1322-h.htm",
    "诗以紫丁香、星与鸟歌反复编织丧痛和记忆，既承认悲伤持续又让关系获得可表达的形式。",
    "这是一首诗的具体实践，不是诗性本体论证明；不能把诗中某一词直接等同课程整格。",
    "网页第10216—10254、10379—10508行，核为作品原文。",
)
WHITMAN_LILACS["relation"] = "local_literary_primary_example_not_full_theory"
JAMES_PLURALISM = citation(
    "William James", "A Pluralistic Universe", "1909 English lectures; Global Grey complete text transcription, scanned print pagination not rechecked",
    "Lectures 2 and 8, critique of all-inclusive absolute and pluralistic universe",
    "https://www.globalgreyebooks.com/online-ebooks/william-james_pluralistic-universe_complete-text.html",
    "诸部分可相关而保留外部与自主性，绝对整体若吞没个体差异会丢失有限经验。",
    "詹姆斯批评绝对一元论，不直接反驳爱默生每一种‘超灵’读法；需按具体整体论强弱判断。",
    "网页第183—185、882—886、915—916行。",
)
KANT_ASSENT_BOUNDARY = citation(
    "Immanuel Kant", "Fundamental Principles of the Metaphysic of Morals / Groundwork", "1785 German; Thomas Kingsmill Abbott English, Project Gutenberg #5682",
    "Second Section, humanity formula and lying promise example, Akademie pagination not supplied in ebook",
    "https://www.gutenberg.org/files/5682/5682-h/5682-h.htm",
    "把他人当作独立目的意味着不能以对方无法同意的欺骗或侵权方式使用对方；明确同意与权利界限不能被‘欲望谜题’取代。",
    "康德未讨论拉康式欲望结构，也不说心理分析本身无效；这只是伦理边界的外部反问。",
    "网页第418—432行，特别是谎言、自由和财产权例。",
)
DENNETT_COMPETING_SELF = citation(
    "Daniel C. Dennett", "The Self as a Responding—and Responsible—Artifact", "2003 Annals of the New York Academy of Sciences 1001:39–50; author's final draft hosted by Tufts, paginated to publication",
    "abstract and pp. 39–40, 46–47: competing processes, evolved self-monitoring and communication",
    "https://dl.tufts.edu/downloads/1831cw57f?filename=br86bf394.pdf",
    "统一的自我可被解释为多种过程竞争后形成的有限协调；交往中对行动方案的监控与竞争在演化故事中产生。",
    "仅支持竞争过程与演化出自我监控的局部模型；未证明本课程该格的所有规则、突变层级、完整四维或生物学事实。作者将相关起源说明称作 Just So Story。",
    "PDF 第1—2、7—9页，原文页39—40、46—47；重点网页解析第19—24、73—79、333—365、389—438行。",
)
DENNETT_COMPETING_SELF["relation"] = "local_primary_model_not_full_course_code"

ADDITIONS = {
    ("1-1-3-2", "pro"): DENNETT_COMPETING_SELF,
    ("1-4-3-4", "con"): KANT_ASSENT_BOUNDARY,
    ("2-2-3-3", "con"): JAMES_PLURALISM,
    ("1-3-4-4", "con"): IBSEN_NORA_MEANING,
    ("2-2-3-1", "con"): NIETZSCHE_FALSE_ANALOGY,
    ("2-1-3-2", "pro"): ARISTOTLE_DEMOCRITUS_TESTIMONY,
    ("2-2-1-1", "con"): MILINDA_IDENTITY_CHALLENGE,
    ("2-2-1-3", "con"): MILINDA_DEEDS_CHALLENGE,
    ("2-1-4-4", "con"): HABERMAS_DELIBERATION,
    ("1-4-2-3", "con"): OSTROM_LOCAL_RULES,
    ("2-1-4-4", "pro"): LYOTARD_GAMES,
    ("2-1-4-3", "con"): NIETZSCHE_ANTIQUARIAN_LIMIT,
    ("2-4-3-4", "con"): QUINE_SIMPLICITY_LIMIT,
    ("2-2-2-3", "pro"): LIEZI_YANGZHU,
    ("2-3-1-4", "con"): MARX_FORMULA_CRITIQUE,
    ("2-3-1-1", "pro"): KANT_REGULATIVE_APPROACH,
    ("2-3-1-1", "con"): KANT_EXPERIENCE_LIMIT,
    ("2-3-1-3", "con"): MARX_PRACTICE_CHANGE,
    ("2-3-1-4", "pro"): HEGEL_IDENTITY_DIFFERENCE,
    ("2-2-3-1", "pro"): YIJING_SHENGSHENG,
    ("2-3-4-2", "pro"): NEWTON_ACTIVE,
    ("2-1-1-1", "con"): ARISTOTLE_PHYSICS_INFINITE,
    ("2-1-1-2", "con"): ARISTOTLE_META_SINGLE,
    ("2-1-1-3", "con"): ARISTOTLE_META_NOUS,
    ("2-1-2-1", "con"): PLATO_APOLOGY,
    ("2-1-2-2", "con"): PLATO_PARMENIDES,
    ("2-1-2-3", "con"): ARISTOTLE_EQUITY,
    ("2-1-2-4", "con"): PLATO_SOPHIST,
    ("2-1-3-1", "con"): ARISTOTLE_SOUL,
    ("2-1-3-2", "con"): ARISTOTLE_META_ATOMS,
    ("2-1-3-3", "con"): CICERO_FATE,
    ("2-1-3-4", "con"): EPICTETUS_CYNIC,
    ("2-2-1-2", "pro"): VASUBANDHU_TIME,
    ("2-2-1-3", "pro"): VASUBANDHU_SEED,
    ("2-2-1-4", "pro"): LANKA_MIND,
    ("2-2-1-4", "con"): LANKA_CHALLENGE,
    ("2-2-2-3", "con"): XUNZI_RITES,
    ("2-2-2-4", "con"): MOZI_CARE,
    ("2-2-4-1", "con"): MOZI_CARE,
    ("2-2-4-4", "con"): XUNZI_NAMES,
    ("2-2-3-4", "con"): PLATO_POETRY,
    ("2-3-2-1", "con"): HUME_EVIL,
    ("2-3-2-2", "con"): JAMES_MYSTIC,
    ("2-4-1-2", "con"): LOCKE_EXTERNAL,
    ("2-4-1-4", "con"): SMITH_SPECTATOR,
    ("2-4-2-3", "pro"): SPENCER_EVOLUTION,
    ("2-4-2-3", "con"): JAMES_SPENCER,
    ("2-4-2-4", "con"): MILL_LIBERTY,
    ("2-4-3-3", "con"): BLOCK_QUALIA,
    ("2-4-4-4", "con"): MARX_PRACTICE,
    ("1-2-2-3", "pro"): DURKHEIM_TOTEM,
    ("1-2-4-1", "pro"): SPINOZA_NECESSITY,
    ("1-3-1-3", "pro"): MARX_THESES_II_III,
    ("1-3-3-3", "pro"): NIETZSCHE_RANK,
    ("1-4-1-2", "pro"): NIETZSCHE_RANK,
    ("1-2-4-4", "con"): KANT_HUMANITY,
    ("1-3-2-1", "con"): MARX_CIRCUMSTANCES,
    ("1-3-4-1", "con"): KANT_BEAUTY_GOOD,
    ("1-4-4-1", "con"): HUME_ROWERS,
    ("1-4-3-2", "pro"): FREUD_NORMAL,
    ("1-4-3-4", "pro"): LACAN_OTHER,
    ("1-4-3-3", "con"): POPPER_PSYCHOANALYSIS,
    ("2-2-2-2", "con"): MOZI_THREE_TESTS,
    ("2-1-1-2", "pro"): ANAXIMENES_AIR,
    ("2-1-3-4", "pro"): DIOGENES_LIFE,
    ("2-4-3-1", "pro"): CARNAP_PHYSICAL,
    ("2-4-3-1", "con"): MILL_DISSENT,
    ("2-4-4-2", "pro"): STALIN_DIALECTICS,
    ("2-4-4-2", "con"): MAO_ANTI_DOGMA,
    ("2-4-4-3", "con"): MARX_IDEAS,
    ("2-4-2-2", "con"): WEBER_MEANING,
    ("1-3-2-3", "pro"): HEGEL_LOVE,
    ("2-3-4-1", "con"): BERGSON_LIFE,
    ("2-3-4-4", "con"): LOCKE_CONSENT,
    ("2-3-3-3", "con"): RUSSELL_FACTS,
    ("1-4-4-3", "con"): DECI_REWARDS,
    ("1-2-1-3", "con"): HUME_MIRACLES,
    ("1-3-3-2", "con"): SMITH_FORTUNE,
    ("1-3-4-2", "con"): MARX_PRACTICE_TEST,
    ("1-4-1-4", "con"): NIETZSCHE_VALUES,
    ("1-4-2-4", "con"): MILL_HARM,
    ("2-4-1-3", "con"): HUME_EXTERNAL_GOD,
    ("2-2-4-3", "con"): KANT_UNIVERSAL_END,
    ("2-3-2-3", "con"): MARX_RELATIONS,
    ("2-3-3-4", "con"): MARX_CONDITIONS,
    ("2-4-4-1", "con"): MILL_EQUAL_UTILITY,
}

OPPONENT_REVISIONS = {
    "2-1-2-2": "若超感理念由多个可感对象分有，理念是作为整体还是部分在各对象中？相似的解释会不会要求再引入一个理念？",
    "2-1-3-1": "灵魂迁转若不顾身体类型，怎样说明特定灵魂与它进入的身体相适配？",
    "2-2-1-3": "过去的业不可见，怎样辨认其作用所系，避免仅凭后来的结果追认？",
    "2-1-1-1": "若无界者被设为可感而无穷的物体，它如何与其他有限元素共存？",
    "2-1-1-2": "只用一种气或物质说明差异时，运动的起因与元素互变由什么解释？",
    "2-1-2-1": "苏格拉底在《申辩》中宁愿不服从停止哲学的城邦命令，守法义务是否有边界？",
    "2-1-2-3": "普遍中道若按一般规则应用，遇到特殊情形应如何修正？",
    "2-1-3-2": "原子形状、次序和位置若解释组合，运动本身从何发生？",
    "2-1-3-4": "犬儒的外在装束和公开冒犯若成表演，怎样与真正的伦理操练区分？",
    "2-2-2-4": "若没有固定操守，人仍能否承诺不相害并实际兑现互助？",
    "2-2-4-1": "去结构化的解释若消解真实互害，为何仍需互爱互利的公共行动？",
    "2-2-4-4": "撤掉总标准之后，怎样保留可共用的名称以辨认伤害与协调行动？",
    "2-2-3-4": "诗性重写苦难会不会反而强化哀痛，使判断和必要行动后退？",
    "2-3-2-1": "若把今生苦难的完满解答推向死后，现实之恶与全善神性之间的难题怎样回答？",
    "2-3-2-2": "不可说的经验可以提出假说，但为何仅凭神秘性质便拥有不容追问的权威？",
    "2-4-1-2": "如果把外物持存全留在实体推测，实际感觉为何不能给出有分量的存在知识？",
    "2-4-1-4": "亲疏会扭曲同情；把自己放在公正旁观者位置后，原先判断是否还成立？",
    "2-4-2-3": "同一套物质整合公式如何解释生命、心理与社会变化各自的目标和机制？",
    "2-4-2-4": "自然选择说明生命存留，为什么规范选择也必须只以生存效率为终点？",
    "2-4-3-3": "同一行为或功能表现是否足以证明存在相同的主观感受？",
    "2-4-4-4": "个人解脱之外，可改变的现实关系是否仍须采取共同实践？",
    "1-2-4-4": "爱的信任能否保留对方作为目的的自主地位，而不把对方当成可支配的手段？",
    "1-3-2-1": "仅调整心态时，那些可由人改变的环境和教育条件会否被搁置？",
    "1-3-4-1": "美感和善的判断依据不同；感到美时怎样另行评估行为是否正当？",
    "1-4-4-1": "共同设施若要成立，每个受益者是否都须履行分担责任？",
    "1-4-3-3": "一套爱欲解释若把相反行为都算作自己的确认，什么观察会真的迫使它修正？",
    "2-2-2-2": "所谓适时介入应凭什么历史、经验与公共效果来区分成败，避免事后皆称合道？",
    "2-4-3-1": "共用记录语言有助核对；当多数共识压低少数人的不同解释时，异议如何保留？",
    "2-4-4-2": "若把预定理论当唯一正确方法，实践中出现的反例如何进入修正？",
    "2-4-4-3": "公共名称可通事，但谁控制名称的制作与传播，会不会把支配关系说成自然？",
    "2-4-2-2": "社会规律若有统计相关，行动者自己赋予行为的意义是否仍须解释？",
    "2-3-3-3": "逻辑形式能整理命题，却如何提供最初的事实材料？",
    "2-3-4-1": "重量与力学有明确用途，但生命生成中不可预先化约的变化如何进入解释？",
    "2-3-4-4": "物理空间性质并不决定政治权力；自由平等者为何服从某人仍需同意的论证。",
    "1-4-4-3": "奖品可能让人做事，但它是否削弱本来愿做的活动；奖励如何设计才不成控制？",
    "1-2-1-3": "即使声称灵知高于感官，什么证据能区分它与同样有力的误认或想象？",
    "1-3-3-2": "同样努力若遇到不同运气或资源，贵贱评价还可否直接归给个人品质？",
    "1-3-4-2": "想象让人看见可能性，但哪一步实践能检验它是否可行？",
    "1-4-1-4": "揭露旧价值之后，是否仍可创造可承担的新价值，而非将意义一概销毁？",
    "1-4-2-4": "反规训的自由如何核对他人同意和实际伤害？",
    "2-4-1-3": "若外物本身的存在成为疑点，借它们推论神的担保会不会同受牵连？",
    "2-2-4-3": "若共同体只由‘我们’的叙事界定，尚未进入的人为何也应被当作目的尊重？",
    "2-3-2-3": "内心信仰如何进入人与人之间可承担的现实关系？",
    "2-3-3-4": "痛苦的意志面向之外，具体劳动与社会条件怎样形成并可改变困境？",
    "2-4-4-1": "谁的效用被计算；每个人的幸福是否都获同等份量？",
}

OPPONENT_REPLIES = {
    "2-1-2-2": "理念可被用来说明多个事物的共性，但分有究竟如何发生不能只靠重命名；须解释整体、部分与再次引入理念的回归问题。",
    "2-1-3-1": "灵魂迁转若是事实断言，就须说明身体条件如何限制迁入；伦理修习本身不能替这个适配机制提供证据。",
    "2-1-1-1": "无界者可先作为共同本源的解释假说；若主张它本身是可感物体，仍须补出它与有限元素共存的机制。",
    "2-1-1-2": "一种物质原则能统一说明材料来源，但运动起因和元素互变需要另给机制，不能仅重复‘万物由气来’。",
    "2-4-3-1": "保留公开表达少数解释的渠道，让异议能以共同可核的资料挑战现有分类；是否改记录项还须逐案论证。",
}

COMPARISON_ONLY = {
    "1-3": (STIRNER_EGO, "仅论自己的事业，不主张世界由我造。"),
    "1-4": (STIRNER_OWN_CAUSE, "主动反省权威，与未经反思沿用现成尺度相反。"),
    "1-2-1-4": (MARK_PASSION, "受难叙事没有论证课程所称模态位格一元论。"),
    "1-4-4-4": (NIETZSCHE_REVENGE_PRO, "作者分析复仇动机，不倡导以牺牲完成复仇。"),
    "2-2-3-4": (WHITMAN_LILACS, "诗歌实践表达哀悼，不能直接支持诗性形而上学或死亡驱力承诺。"),
    "2-3-1-2": (NEWTON_LAWS, "运动定律不支持以我思连接星体/生命及无限前进而终归静止的课程图景。"),
    "2-4-4-3": (XUNZI_NAMES_PRO, "约定名称的辨别作用不支持以大名称锚定科学与意识形态的承诺。"),
}


def apply():
    audit_path = HERE / "stage-d-sol-audit.json"
    audit = json.loads(audit_path.read_text(encoding="utf-8"))
    by_code = {(entry["code"], entry["side"]): entry for entry in audit["entries"]}
    for filename in ("sol-tree.json", "sol-tree-B.json", "sol-tree-C1.json", "sol-tree-C2.json"):
        path = HERE / filename
        data = json.loads(path.read_text(encoding="utf-8"))
        for node in data["nodes"]:
            code = node["code"]
            changed = False
            if code in COMPARISON_ONLY:
                source, mismatch = COMPARISON_ONLY[code]
                comparison = dict(source)
                assert not node["pro_sources"] or node["pro_sources"][0]["url"] == comparison["url"]
                node["pro_sources"] = []
                node["comparison_sources"] = [comparison]
                node["evidence_status"]["primary"] = "positive_gap"
                node["evidence_status"]["note"] = "正方原典仍缺：" + mismatch + " 已核原段只保留边界对照，不计正方支撑。"
                if code in ("1-3", "1-4"):
                    node["evidence_status"]["positive_gap_scope"] = (
                        "已核课程固定入口、伯克利与苏格拉底等相邻或反方文本，"
                        "并核施蒂纳《唯一者及其所有物》开篇；施蒂纳与本课程完整机制不符，"
                        "只列 comparison_sources。未获得能自认该课程格位的正面原典。"
                    )
                entry = by_code[(code, "pro")]
                entry["candidates"] = [{"work": comparison["work"], "locator": comparison["locator"], "url": comparison["url"], "finding": comparison["limits"]}]
                entry["decision"] = "retained_positive_gap_comparison_only"
                entry["reason"] = mismatch + " 保留已核原段于 comparison_sources，正方数组恢复空缺。"
                changed = True
            if code in OPPONENT_REVISIONS:
                node["stance_profile"]["strong_opponent"]["argument"] = OPPONENT_REVISIONS[code]
                changed = True
            if code in OPPONENT_REPLIES:
                node["stance_profile"]["strong_opponent"]["possible_response"] = OPPONENT_REPLIES[code]
                node["stance_profile"]["strong_opponent"]["fair_reply"] = OPPONENT_REPLIES[code]
                changed = True
            for side, field in (("pro", "pro_sources"), ("con", "con_sources")):
                source = ADDITIONS.get((code, side))
                if not source:
                    continue
                assert not node[field] or node[field][0]["url"] == source["url"], (code, side, "would overwrite existing source")
                node[field] = [dict(source)]
                changed = True
                entry = by_code[(code, side)]
                entry["candidates"] = [{"work": source["work"], "locator": source["locator"], "url": source["url"], "finding": source["supports"]}]
                entry["decision"] = "filled_partial_primary"
            if changed:
                pro_missing = not node["pro_sources"]
                con_missing = not node["con_sources"]
                node["evidence_status"]["primary"] = (
                    "positive_and_counter_gap" if pro_missing and con_missing else
                    "positive_gap" if pro_missing else "counter_gap" if con_missing else
                    "partial_bidirectional_sources"
                )
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    audit_path.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    apply()
