"""Inspect the upstream catalogue without changing or certifying its content.

Run: python scripts/audit-corpus.py > research/audit-current.json
"""
import hashlib
import itertools
import json
import re
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.stdout.reconfigure(encoding="utf-8")
raw = (ROOT / "public/ism.json").read_bytes()
duplicates = []


def object_pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            duplicates.append(key)
        result[key] = value
    return result


data = json.loads(raw, object_pairs_hook=object_pairs)
entries = {k: v for k, v in data.items() if re.fullmatch(r"[1-4](?:-[1-4]){0,3}", k)}
expected = {
    "-".join(p)
    for depth in range(1, 5)
    for p in itertools.product("1234", repeat=depth)
}
groups = {}
empty_features, missing_video, axis_placeholders, unsupported_status = [], [], [], []
video_users = defaultdict(list)
document_only_original_links = []
axis_length_mismatches = []
for code, entry in entries.items():
    if not isinstance(entry, dict):
        raise ValueError(f"{code}: expected an object")
    for field in ("axis_list", "feature_list", "related_list"):
        if not isinstance(entry.get(field), list) or not all(isinstance(s, str) for s in entry[field]):
            raise ValueError(f"{code}.{field}: expected a string list")
    status = entry.get("summary_status")
    if len(entry['axis_list']) != len(code.split('-')):
        axis_length_mismatches.append({'code': code, 'actual': len(entry['axis_list']), 'expected': len(code.split('-'))})
    if status not in (None, "manual", "ai"):
        unsupported_status.append({"code": code, "status": status})
    if not any(s.strip() for s in entry["feature_list"]):
        empty_features.append(code)
    placeholders = [s for s in entry["axis_list"] if re.fullmatch(r"\s*(?:场域论|本体论|认识论|目的论)[1-4]\s*[:：]?\s*", s)]
    if placeholders:
        axis_placeholders.append({"code": code, "values": placeholders})
    original_links = [s for s in entry["related_list"] if "原视频" in s and re.search(r"https?://", s)]
    if not original_links:
        missing_video.append(code)
    elif not any(re.search(r'BV[0-9A-Za-z]{10}', link) for link in original_links):
        document_only_original_links.append({'code': code, 'links': original_links})
    for link in original_links:
        for bv in re.findall(r"BV[0-9A-Za-z]{10}", link):
            video_users[bv].append(code)
for prefix in "1234":
    subset = {k: v for k, v in entries.items() if k.split("-")[0] == prefix}
    groups[prefix] = {
        "entries": len(subset),
        "summary_status": dict(Counter(v.get("summary_status") or "unmarked" for v in subset.values())),
        "empty_features": sum(k in empty_features for k in subset),
    }
result = {
    "catalogue_source": "https://github.com/spaceater/ismismcube-frontend",
    "input_path": "public/ism.json",
    "input_last_commit": subprocess.check_output(["git", "log", "-1", "--format=%H", "--", "public/ism.json"], cwd=ROOT, text=True).strip(),
    "input_sha256": hashlib.sha256(raw).hexdigest(),
    "scope": "Structural inspection only. No video playback or philosophical validation; manual/ai are upstream labels, not quality certificates.",
    "entry_count": len(entries),
    "depth_counts": dict(Counter(str(len(k.split('-'))) for k in entries)),
    "summary_status": dict(Counter(v.get("summary_status") or "unmarked" for v in entries.values())),
    "groups": groups,
    "missing_codes": sorted(expected - entries.keys()),
    "other_top_level_keys": sorted(set(data) - entries.keys()),
    "duplicate_json_keys": duplicates,
    "unsupported_status": unsupported_status,
    "empty_feature_codes": empty_features,
    "axis_placeholder_entries": axis_placeholders,
    "axis_length_mismatches": axis_length_mismatches,
    "missing_original_video_codes": missing_video,
    "original_link_field_interpretation": "The original-video label may contain a transcript-document URL rather than a playable video; inspect document_only_original_links separately.",
    "document_only_original_links": document_only_original_links,
    "distinct_original_bvids": len(video_users),
    "shared_original_video_ids": {bv: sorted(set(codes)) for bv, codes in video_users.items() if len(set(codes)) > 1},
    "shared_video_interpretation": "Review candidates only: a shared video may legitimately cover several nodes.",
}
print(json.dumps(result, ensure_ascii=False, indent=2))
