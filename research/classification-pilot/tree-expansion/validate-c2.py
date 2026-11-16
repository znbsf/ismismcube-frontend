"""Check C2 structure and provenance links; this cannot judge philosophy."""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
ism = json.loads((ROOT / "public/ism.json").read_text(encoding="utf-8"))
enrich = json.loads((ROOT / "public/cube-enrichments.json").read_text(encoding="utf-8"))["nodes"]
dims = ("场域论", "本体论", "认识论", "目的论")
nodes = []
for filename, prefix in (("sol-tree-C2.json", "2"), ("terra-tree-C2.json", "4")):
    data = json.loads((HERE / filename).read_text(encoding="utf-8"))
    assert len(data["nodes"]) == 64, filename
    assert all(n["code"].startswith(prefix + "-") for n in data["nodes"]), filename
    nodes.extend(data["nodes"])

expected = {f"{prefix}-{j}-{k}-{m}" for prefix in (2, 4) for j in range(1, 5) for k in range(1, 5) for m in range(1, 5)}
codes = [n["code"] for n in nodes]
assert len(codes) == len(set(codes)) == 128 and set(codes) == expected
gaps = {"pro": [], "con": []}
for n in nodes:
    code = n["code"]
    assert n["depth"] == 4 and n["parent"] == code.rsplit("-", 1)[0], code
    assert n["name"] == ism[code]["ch_name"], code
    raw = ism[code]["axis_list"]
    course = n["course_evidence"]["course_axes"]
    plain = n["stance_profile"]["axes_plain"]
    assert len(raw) == len(course) == len(plain) == 4, code
    for i, d in enumerate(dims):
        assert course[i]["dimension"] == plain[i]["dimension"] == d, code
        assert course[i]["course_wording"] == raw[i], code
        assert course[i]["status"] == plain[i]["status"] == "course_defined", code
        assert plain[i]["text"], code
    transcript_urls = {x["url"] for x in enrich[code].get("transcripts", [])}
    ce = n["course_evidence"]
    cited = {ce.get("lecture_url", "")}
    for key in ("transcript_citations", "transcript_reference"):
        cited.update(re.findall(r"https://[^)\s]+", " ".join(ce.get(key, []))))
    assert transcript_urls.intersection(cited), (code, "course URL")
    sp = n["stance_profile"]
    for key in ("position_title", "portrait", "core_commitments", "problem_conflict", "synthetic_example", "strong_opponent", "internal_tension", "dialectical_assessment", "self_questions", "neighbor_distinction"):
        assert sp.get(key), (code, key)
    assert sp["synthetic_example"].get("synthetic") is True, code
    assert sp["strong_opponent"].get("argument") and (sp["strong_opponent"].get("fair_reply") or sp["strong_opponent"].get("possible_response")), code
    assert sp["strong_opponent"].get("relation"), code
    rule = sp.get("decision_rule")
    assert rule and rule.get("candidate_if") and rule.get("redirect_or_exclude_if"), (code, "decision rule")
    for side, short in (("pro_sources", "pro"), ("con_sources", "con")):
        if not n[side]:
            gaps[short].append(code)
            assert "gap" in n["evidence_status"]["primary"], (code, side)
        for s in n[side]:
            for key in ("author", "work", "version", "locator", "url", "read_scope", "supports", "limits"):
                assert s.get(key), (code, side, key)
            assert s["url"].startswith("https://"), (code, side, "URL")
    if not n["pro_sources"] and not n["con_sources"]:
        assert n["evidence_status"]["primary"] in ("positive_and_counter_gap", "both_gap"), code

for parent in sorted({n["parent"] for n in nodes}):
    siblings = [n for n in nodes if n["parent"] == parent]
    assert len(siblings) == 4, parent
    assert len({n["stance_profile"]["portrait"] for n in siblings}) == 4, parent
    assert len({n["stance_profile"]["axes_plain"][3]["text"] for n in siblings}) == 4, parent

for filename in ("MAJOR-BRANCHES-C2.md", "EXAMPLES-C2.md", "REVIEW-C2.md", "examples-sol-C2.md", "examples-terra-C2.md", "review-terra-C2.md"):
    assert (HERE / filename).is_file(), filename
guide = (HERE / "MAJOR-BRANCHES-C2.md").read_text(encoding="utf-8")
assert guide.count("### ") == 128
assert all(f"### {n['code']}｜{n['name']}" in guide for n in nodes)
print(f"C2 structure OK: 128 four-part nodes; positive gaps {len(gaps['pro'])}; counter gaps {len(gaps['con'])}.")
