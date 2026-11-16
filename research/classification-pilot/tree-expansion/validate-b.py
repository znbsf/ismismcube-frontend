"""Structural Stage B checks; source interpretation still needs human review."""

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
ism = json.loads((ROOT / "public/ism.json").read_text(encoding="utf-8"))
enrichments = json.loads((ROOT / "public/cube-enrichments.json").read_text(encoding="utf-8"))["nodes"]
dims = ("场域论", "本体论", "认识论", "目的论")
nodes = []
for filename, prefix in (("sol-tree-B.json", ("1", "2")), ("terra-tree-B.json", ("3", "4"))):
    data = json.loads((HERE / filename).read_text(encoding="utf-8"))
    assert len(data["nodes"]) == 32, filename
    assert all(node["code"][0] in prefix for node in data["nodes"]), filename
    nodes.extend(data["nodes"])

expected = {f"{i}-{j}-{k}" for i in range(1, 5) for j in range(1, 5) for k in range(1, 5)}
codes = [node["code"] for node in nodes]
assert len(codes) == len(set(codes)) == 64 and set(codes) == expected

positive_gaps = []
counter_gaps = []
for node in nodes:
    code = node["code"]
    assert node["name"] == ism[code]["ch_name"], code
    assert node["depth"] == 3 and node["parent"] == "-".join(code.split("-")[:2]), code
    raw_axes = ism[code]["axis_list"]
    assert len(raw_axes) == 3, code
    course_axes = node["course_evidence"]["course_axes"]
    plain_axes = node["stance_profile"]["axes_plain"]
    assert len(course_axes) == len(plain_axes) == 4, code
    for index, dim in enumerate(dims):
        course, plain = course_axes[index], plain_axes[index]
        assert course["dimension"] == plain["dimension"] == dim, code
        if index < 3:
            assert course["course_wording"] == raw_axes[index], code
            assert course["status"] == plain["status"] == "course_defined" and plain["text"], code
        else:
            assert course["course_wording"] is None and plain["text"] is None, code
            assert course["status"] == plain["status"] == "undefined_at_this_depth", code
    evidence = node["course_evidence"]
    official_urls = {item["url"] for item in enrichments[code]["transcripts"]}
    referenced = [evidence.get("lecture_url", "")]
    referenced += re.findall(r"https://[^)\s]+", " ".join(evidence.get("transcript_citations", [])))
    referenced += re.findall(r"https://[^)\s]+", " ".join(evidence.get("transcript_reference", [])))
    assert official_urls.intersection(referenced), f"{code}: course transcript link missing"
    stance = node["stance_profile"]
    assert all(stance.get(key) for key in (
        "position_title", "portrait", "core_commitments", "problem_conflict",
        "synthetic_example", "strong_opponent", "internal_tension",
        "dialectical_assessment", "self_questions", "neighbor_distinction",
    )), code
    assert stance["synthetic_example"].get("synthetic") is True, code
    opponent = stance["strong_opponent"]
    assert opponent.get("argument") and (opponent.get("possible_response") or opponent.get("fair_reply")), code
    assert opponent.get("relation"), code
    for side in ("pro_sources", "con_sources"):
        if not node[side]:
            (positive_gaps if side == "pro_sources" else counter_gaps).append(code)
            assert "gap" in node["evidence_status"]["primary"], code
        for source in node[side]:
            assert all(source.get(key) for key in (
                "author", "work", "version", "locator", "url", "read_scope", "supports", "limits"
            )), (code, side)
            assert source["url"].startswith("https://"), (code, side)

for filename in (
    "MAJOR-BRANCHES-B.md", "EXAMPLES-B.md", "REVIEW-B.md",
    "examples-sol-B.md", "examples-terra-B.md", "review-terra-B.md"
):
    assert (HERE / filename).is_file(), filename

guide = (HERE / "MAJOR-BRANCHES-B.md").read_text(encoding="utf-8")
assert guide.count("### ") == 64
assert all(f"### {node['code']}｜{node['name']}" in guide for node in nodes)
independent_counter_gaps = [
    node["code"] for node in nodes
    if node["evidence_status"]["primary"] == "independent_counter_source_gap"
]
print(f"Stage B structure OK: 64 unique 3-part nodes; positive gaps {positive_gaps}; empty counter arrays {counter_gaps}; independent counter source gaps {independent_counter_gaps}.")
