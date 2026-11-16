"""Render C1's two independently owned JSON files into one readable guide."""

import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
nodes = []
for filename in ("sol-tree-C1.json", "terra-tree-C1.json"):
    nodes.extend(json.loads((HERE / filename).read_text(encoding="utf-8"))["nodes"])
nodes.sort(key=lambda n: tuple(map(int, n["code"].split("-"))))


def source_lines(items, label):
    if not items:
        return [f"- **{label}原典缺口：**尚无与此论点准确对应并经核读的一手文本。反方论证若存在，属于编者待检验的重构。"]
    lines = []
    for s in items:
        who = s.get("author", "作者未明")
        work = s.get("work", "作品未明")
        details = []
        for title, key in (("版本", "version"), ("段落", "locator"), ("核读", "read_scope"), ("仅支持", "supports"), ("不支持", "limits")):
            if s.get(key):
                details.append(f"{title}：{s[key]}")
        lines.append(f"- **{label}原典局部对照：**[{who}《{work}》]({s['url']})。" + "；".join(details) + "。")
    return lines


out = [
    "# 阶段 C1：四级 1/3 字头 128 个格位",
    "",
    "本页由 [Sol 的64类](sol-tree-C1.json)和 [Terra 的64类](terra-tree-C1.json)生成。四维原措辞来自 `public/ism.json`，这里给通俗解释。每个四级格位只因第四维目的不同而从同父分开，精确归码必须核实全部已定义格位。画像描述可能的论证和行动方式，不诊断人的稳定人格。日常例句均为 synthetic；原典只支撑标出的局部命题，空缺如实保留。",
    "",
    "阅读顺序：先看完整发言的实际问题与承诺，再看候选及转向条件，最后以最强反方检验内在张力。四篇新的完整日常发言见 [EXAMPLES-C1](EXAMPLES-C1.md)，双方复核及证据缺口见 [REVIEW-C1](REVIEW-C1.md)。",
    "",
]
last_parent = None
for n in nodes:
    code = n["code"]
    sp = n["stance_profile"]
    if n["parent"] != last_parent:
        last_parent = n["parent"]
        out.extend([f"## {last_parent} 的四个目的格", ""])
    out.extend([f"### {code}｜{n['name']}", ""])
    out.extend([
        f"**定位与生活方式：**{sp['portrait']}", "",
        f"**核心承诺：**{'；'.join(sp['core_commitments'])}", "",
        f"**要解决的矛盾：**{sp['problem_conflict']}", "",
    ])
    for axis in sp["axes_plain"]:
        out.append(f"- **{axis['dimension']}：**{axis['text']}")
    out.extend(["", f"**日常情境（synthetic）：**{sp['synthetic_example']['text']}", ""])
    rule = sp.get("decision_rule", {})
    if rule:
        out.extend([
            f"**候选条件：**{rule.get('candidate_if', '')}", "",
            f"**排除或转向同父格位：**{rule.get('redirect_or_exclude_if', '')}", "",
        ])
    else:
        out.extend([f"**候选与排除：**{sp.get('candidate_and_exclusion', '')}", ""])
    opp = sp["strong_opponent"]
    out.extend([
        f"**最强反方：**{opp['argument']}", "",
        f"**公平回应：**{opp.get('possible_response') or opp.get('fair_reply', '')}", "",
        f"**关系：**{opp.get('relation', '编者重构，非原作者直接论战。')}", "",
        f"**内在张力：**{sp['internal_tension']}", "",
        f"**有条件点评：**{sp['dialectical_assessment']}", "",
        f"**同父差异：**{sp['neighbor_distinction']}", "",
        f"**自我辨认：**{' / '.join(sp['self_questions'])}", "",
    ])
    out.extend(source_lines(n["pro_sources"], "正方"))
    out.extend(source_lines(n["con_sources"], "反方"))
    for s in n.get("comparison_sources", []):
        out.append(f"- **邻近原典边界对照（不计正方）：**[{s['author']}《{s['work']}》]({s['url']})。定位：{s['locator']}；相近处：{s['supports'].rstrip('。；')}；不能推出：{s['limits'].rstrip('。；')}。")
    out.extend([f"- **证据状态：**{n['evidence_status'].get('primary', '未标')}。{n['evidence_status'].get('note', '')}", ""])

(HERE / "MAJOR-BRANCHES-C1.md").write_text("\n".join(out).rstrip() + "\n", encoding="utf-8")
example_intro = "# 阶段 C1：四篇新完整日常发言的立场分析\n\n四篇均以公开原帖中同一作者的完整正文为边界，保留链接和起止锚点。先重构问题及承诺，再谈候选定位和反方；没有一篇据此确认为完整四位码。下方合并两位执行者各自核读、互审的报告。\n\n"
parts = []
for filename in ("examples-sol-C1.md", "examples-terra-C1.md"):
    content = (HERE / filename).read_text(encoding="utf-8")
    parts.append(content)
(HERE / "EXAMPLES-C1.md").write_text(example_intro + "\n\n---\n\n".join(parts).rstrip() + "\n", encoding="utf-8")
print("rendered", len(nodes), "C1 nodes")
