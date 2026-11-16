"""Render the Stage B reading guide from the two independently owned node files."""

import json
from pathlib import Path


BASE = Path(__file__).parent
FILES = ("sol-tree-B.json", "terra-tree-B.json")
nodes = []
for filename in FILES:
    nodes.extend(json.loads((BASE / filename).read_text(encoding="utf-8"))["nodes"])
nodes.sort(key=lambda node: tuple(map(int, node["code"].split("-"))))


def source_lines(sources, side):
    if not sources:
        return [f"- **{side}原典缺口：**尚未找到能准确支持该课程局部主张的一手文本；不以邻近思想填空。"]
    lines = []
    for source in sources:
        label = f'{source.get("author", "作者未记载")}《{source.get("work", "作品未记载")}》'
        link = f'[{label}]({source["url"]})' if source.get("url") else label
        detail = "；".join(
            f"{title}：{source[key]}"
            for title, key in (
                ("版本", "version"),
                ("定位", "locator"),
                ("本次核读", "read_scope"),
                ("局部支持", "supports"),
                ("不能推出", "limits"),
            )
            if source.get(key)
        )
        lines.append(f"- **{side}原典：**{link}。{detail}。")
    return lines


out = [
    "# 阶段 B：三级 64 个立场的阅读版",
    "",
    "本页由 [Sol 1/2 字头数据](sol-tree-B.json) 与 [Terra 3/4 字头数据](terra-tree-B.json) 生成。每类的目的格在三级尚未定义，保留为空。课程格位来自原库和固定讲稿；原典只支持各条明示的局部命题，不能据此反推完整课程码。名称可能带有课程的批评性判断，画像是对一种论证的重构，不是对现实发言者的人格诊断。例句均为 synthetic。",
    "",
    "使用时先读一段完整发言，重构它试图解决的问题和实际承诺；然后选最接近的候选，比较同父兄弟，并让反方检验尚未解释的环节。精确编号与有用的立场点评分开。阶段示例见 [四篇新长发言](EXAMPLES-B.md)，审查和缺口见 [REVIEW-B.md]。",
    "",
]

previous_parent = None
for node in nodes:
    code = node["code"]
    parent = node["parent"]
    if parent != previous_parent:
        out.extend([f"## {parent} 分支", ""])
        previous_parent = parent
    stance = node["stance_profile"]
    out.extend([f"### {code}｜{node['name']}", ""])
    out.extend(
        [
            f"**这种立场怎样看世界与行动：**{stance['portrait']}",
            "",
            f"**核心承诺：**{'；'.join(stance['core_commitments'])}",
            "",
            f"**主要矛盾：**{stance['problem_conflict']}",
            "",
        ]
    )
    for axis in stance["axes_plain"]:
        if axis.get("text"):
            out.append(f"- **{axis['dimension']}：**{axis['text']}")
    out.extend(["", f"**日常例句（synthetic）：**{stance['synthetic_example']['text']}", ""])
    opponent = stance["strong_opponent"]
    out.extend(
        [
            f"**最强反方：**{opponent['argument']}",
            "",
            f"**可能回应：**{opponent.get('possible_response') or opponent.get('fair_reply')}",
            "",
            f"**关系说明：**{opponent.get('relation', '编者重构，不主张双方作者直接论战。')}",
            "",
            f"**内在张力：**{stance['internal_tension']}",
            "",
            f"**有条件点评：**{stance['dialectical_assessment']}",
            "",
            f"**同父边界：**{stance['neighbor_distinction']}",
            "",
            f"**自我辨认：**{' / '.join(stance['self_questions'])}",
            "",
        ]
    )
    out.extend(source_lines(node["pro_sources"], "正方"))
    out.extend(source_lines(node["con_sources"], "反方"))
    status = node["evidence_status"]
    out.extend([f"- **证据状态：**{status.get('primary', '未记载')}。{status.get('note', '')}", ""])

(BASE / "MAJOR-BRANCHES-B.md").write_text("\n".join(out).rstrip() + "\n", encoding="utf-8")
print(f"rendered {len(nodes)} nodes")
