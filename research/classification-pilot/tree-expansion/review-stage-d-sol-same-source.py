"""Mark internal tests and remove one duplicated counter citation.

The two sides of an entry are not necessarily independent historical voices.
"""

import json
from pathlib import Path

HERE = Path(__file__).resolve().parent

INTERNAL_CODES = {
    "1-3-2", "2-1-4", "2-1-3-2", "2-1-4-1", "2-2-1-4",
    "2-3-1-1", "2-3-4-3",
}

def main():
    reviewed = []
    for filename in ("sol-tree.json", "sol-tree-B.json", "sol-tree-C1.json", "sol-tree-C2.json"):
        path = HERE / filename
        data = json.loads(path.read_text(encoding="utf-8"))
        for n in data["nodes"]:
            code = n["code"]
            if code == "2-2-4-2":
                old = n["con_sources"]
                assert not old or old[0]["url"] in (n["pro_sources"][0]["url"], "https://www.newadvent.org/fathers/12021.htm")
                n["stance_profile"]["strong_opponent"]["argument"] = "若任何解释都可自称圣言，怎样用爱神与爱人而非解释者自己的偏好核对它？"
                n["stance_profile"]["strong_opponent"]["possible_response"] = "公开解释理由，并以爱神与邻人的目的、作者意图及相邻经文校验；受影响者仍可指出实际伤害。"
                n["stance_profile"]["strong_opponent"]["fair_reply"] = n["stance_profile"]["strong_opponent"]["possible_response"]
                n["con_sources"] = [{
                    "author": "Augustine of Hippo", "work": "On Christian Doctrine",
                    "version": "Latin original late fourth/early fifth century; English translation by J. F. Shaw at New Advent",
                    "locator": "Book I, chapters 35–37, especially chapter 36 §§40–41",
                    "url": "https://www.newadvent.org/fathers/12021.htm",
                    "read_scope": "网页第180—193行，解经目的、双重之爱及错误解经的纠正",
                    "supports": "解经若不增进对神与邻人的爱，便未恰当地理解经文；即使善意的误读也应受作者意图和相邻经文检验。",
                    "limits": "这是一种基督教内部的解经规范，不证明所有世俗诠释都须依神学；没有直接讨论本课程牺牲回归神圣的完整四格。",
                    "relation": "editorial_external_counterargument_not_direct_debate",
                }]
                n["evidence_status"]["primary"] = "partial_bidirectional_sources"
                n["evidence_status"].pop("independent_counter_source_gap", None)
                n["evidence_status"]["note"] = (
                    "《马可福音》2:27 在原数据中正反两侧重复引用，"
                    "只支持以人的需要审视规条；反方改用奥古斯丁《论基督教教义》第一卷第三十五至三十七章的解经检验。"
                )
                reviewed.append({"code": code, "action": "replaced_duplicated_counter_source", "reason": n["evidence_status"]["note"],
                                 "checked_candidate": {"work": "Mark 2:27", "url": n["pro_sources"][0]["url"],
                                                       "locator": "2:27", "finding": "同一句只能作正方局部与内部限制，未支持反方受害者保护命题。"},
                                 "replacement": {"work": "Augustine, On Christian Doctrine", "url": "https://www.newadvent.org/fathers/12021.htm", "locator": "Book I, chapters 35–37"}})
            elif code in INTERNAL_CODES:
                assert n["pro_sources"] and n["con_sources"]
                assert n["pro_sources"][0]["url"] == n["con_sources"][0]["url"]
                n["evidence_status"]["independent_counter_source_gap"] = True
                marker = "正反两侧取自同一原典内部的不同说法或条件检验；尚缺独立外部反方来源。"
                if marker not in n["evidence_status"].get("note", ""):
                    n["evidence_status"]["note"] = n["evidence_status"].get("note", "").rstrip() + " " + marker
                reviewed.append({"code": code, "action": "marked_same_primary_internal_test", "reason": marker,
                                 "source_url": n["pro_sources"][0]["url"]})
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (HERE / "stage-d-sol-weak-source-review.json").write_text(
        json.dumps({"schema_version": 1, "scope": "existing sources reused on both sides of a Sol node", "entries": reviewed}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

if __name__ == "__main__":
    main()
