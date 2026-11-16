"""Record bounded primary-text checks for Sol gaps left after Stage D.

This does not turn a near comparison into a source for an unsupported claim.
"""

import json
from pathlib import Path

HERE = Path(__file__).resolve().parent

CHECKS = {
    ("1-4-4", "pro"): [
        ("Max Stirner, The Ego and His Own", "opening, 'I have set my cause upon nothing', pp. 3–6", "https://www.gutenberg.org/files/34580/34580-h/34580-h.htm", "施蒂纳明确反省并拆解高于个人的权威，恰与本格不追问、沿用现成尺度的课程机制相反；只作为1-4总论局部比较。"),
    ],
    ("1-1-1-4", "pro"): [
        ("Nietzsche, On the Genealogy of Morals", "Third Essay §28", "https://www.gutenberg.org/files/52319/old/52319-h/52319-h.htm", "谈苦难的无意义与禁欲理想的赋义，不主张把意义缩成暂时的感觉经历。"),
    ],
    ("1-2-2-2", "pro"): [
        ("Émile Durkheim, The Elementary Forms of the Religious Life", "Book II, chapters I and VII, totem and collective representations", "https://www.gutenberg.org/files/41360/41360-h/41360-h.htm", "图腾将符号、神圣与群体联系起来，但未提出先拆散标志再拼成一个神圣全貌的课程路径。"),
    ],
    ("1-3-3-4", "pro"): [
        ("Nietzsche, Human, All-Too-Human, volume I", "aphorisms on marriage and women, around pp. 309–310 of ebook", "https://www.gutenberg.org/files/51935/old/51935-h/51935-h.htm", "有针对性别的概括，也谈婚姻失望；未论证一次关系受挫便应推出全体女性的贬抑，不能把两段拼接为作者论证。"),
    ],
    ("1-3-4-4", "pro"): [
        ("F. T. Marinetti, The Founding and Manifesto of Futurism", "1909 manifesto, numbered theses 4, 7, 9–10 and museum passage", "https://www.italianfuturism.org/manifestos/foundingmanifesto/comment-page-2/", "原文同时攻击旧博物馆与女权并表达蔑视女性，但赞颂速度之美和创造；是反旧审美，不是课程所说美与意义的虚无性全盘消解。"),
    ],
    ("1-4-1-3", "pro"): [
        ("Nietzsche, Beyond Good and Evil", "Part IX §257", "https://www.gutenberg.org/files/4363/4363-h/4363-h.htm", "明确有贵族等级差和支配论，但没有以沉默避免大众暴力来维护精英和平这一目的格。"),
    ],
    ("2-1-4-2", "con"): [
        ("Sextus Empiricus, Outlines of Pyrrhonism", "Book I, chapter XI, fourfold observance of everyday life", "https://users.manchester.edu/Facstaff/SSNaragon/Online/texts/316/Sextus%20Empiricus%2C%20Pyrrhonism.pdf", "原文给出自然、感受、习俗与技艺作为行动指引，支持怀疑论者自己的实践回应；不能反转成他主张暂停判断必然缺风险准则。"),
    ],
    ("2-1-4-3", "pro"): [
        ("Nietzsche, On the Uses and Abuses of History for Life", "Part III, antiquarian history, paragraphs on preserving homes and traditions and its limits", "https://web.viu.ca/johnstoi/nietzsche/history.htm", "细述敬重并保存旧习俗的倾向，也说明它会排斥新生并僵化；没有主张把已失去的秩序按旧图复原，故只作邻近倾向与反面限制。"),
    ],
    ("2-3-3-1", "con"): [
        ("Leibniz, Theodicy", "sections discussing pre-established harmony, prayer and freedom", "https://www.gutenberg.org/cache/epub/17147/pg17147-images.html", "作者反而辩护预定秩序与祈祷、善行及自由的相容性，不能当作他提出的独立反方。"),
        ("Voltaire, Candide", "final chapter and Pangloss's discussion of pre-established harmony", "https://emend.press/candide.html", "以灾难和劳动讽刺最善世界，但没有直接推出本条所写‘祈求与道德责任失去改变力’的组合反诘。"),
    ],
}


def main():
    path = HERE / "stage-d-sol-audit.json"
    audit = json.loads(path.read_text(encoding="utf-8"))
    pending = {(e["code"], e["side"]) for e in audit["entries"] if e["decision"] == "pending"}
    assert pending == set(CHECKS), (pending - set(CHECKS), set(CHECKS) - pending)
    for entry in audit["entries"]:
        key = (entry["code"], entry["side"])
        if key not in CHECKS:
            continue
        entry["candidates"] = [dict(work=w, locator=loc, url=url, finding=finding) for w, loc, url, finding in CHECKS[key]]
        entry["decision"] = "retained_gap_after_primary_check"
        entry["reason"] = "所核原段未支持本节点该侧的具体命题；保留来源空缺，不以相邻立场或作者名补位。"
    path.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
