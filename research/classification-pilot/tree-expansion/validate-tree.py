"""Check the 340-code research coverage and local guide links, not philosophical validity."""

import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
files = (
    ("sol-tree.json", 10), ("terra-tree.json", 10),
    ("sol-tree-B.json", 32), ("terra-tree-B.json", 32),
    ("sol-tree-C1.json", 64), ("terra-tree-C1.json", 64),
    ("sol-tree-C2.json", 64), ("terra-tree-C2.json", 64),
)
all_nodes = []
for filename, expected_count in files:
    data = json.loads((HERE / filename).read_text(encoding="utf-8"))
    nodes = data["nodes"]
    assert len(nodes) == expected_count, (filename, len(nodes))
    all_nodes.extend(nodes)

codes = [node["code"] for node in all_nodes]
assert len(codes) == len(set(codes)) == 340
for depth, expected in ((1, 4), (2, 16), (3, 64), (4, 256)):
    assert sum(node["depth"] == depth for node in all_nodes) == expected, depth

expected_codes = {str(i) for i in range(1, 5)}
expected_codes |= {f"{i}-{j}" for i in range(1, 5) for j in range(1, 5)}
expected_codes |= {f"{i}-{j}-{k}" for i in range(1, 5) for j in range(1, 5) for k in range(1, 5)}
expected_codes |= {f"{i}-{j}-{k}-{m}" for i in range(1, 5) for j in range(1, 5) for k in range(1, 5) for m in range(1, 5)}
assert set(codes) == expected_codes

for node in all_nodes:
    if node["depth"] > 1:
        assert node["parent"] == node["code"].rsplit("-", 1)[0]
        assert node["parent"] in expected_codes
    comparison = node.get("comparison_sources", [])
    assert isinstance(comparison, list), node["code"]
    pro_urls = {source.get("url") for source in node["pro_sources"]}
    for source in comparison:
        assert source.get("url", "").startswith(("https://", "http://")), node["code"]
        assert source["url"] not in pro_urls, (node["code"], "comparison counted as pro")

gaps = {
    "positive_empty": sum(not node["pro_sources"] for node in all_nodes),
    "counter_empty": sum(not node["con_sources"] for node in all_nodes),
    "both_empty": sum(not node["pro_sources"] and not node["con_sources"] for node in all_nodes),
}
for md in ("README.md", "MAJOR-BRANCHES.md", "MAJOR-BRANCHES-B.md", "MAJOR-BRANCHES-C1.md", "MAJOR-BRANCHES-C2.md", "EXAMPLES-A.md", "EXAMPLES-B.md", "EXAMPLES-C1.md", "EXAMPLES-C2.md", "REVIEW-A.md", "REVIEW-B.md", "REVIEW-C1.md", "REVIEW-C2.md", "review-sol-D.md", "review-terra-D.md"):
    text = (HERE / md).read_text(encoding="utf-8")
    for target in re.findall(r"\]\(([^)]+)\)", text):
        if target.startswith(("https://", "http://", "#")):
            continue
        assert (HERE / target.split("#", 1)[0]).exists(), (md, target)

print("Tree structure OK: 340 unique codes, depths 4/16/64/256, parents and local links valid.")
print("Empty source arrays:", gaps)
