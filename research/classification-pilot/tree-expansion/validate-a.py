"""Stage A structural checks. This does not judge philosophical correctness."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
ism = json.loads((ROOT / 'public/ism.json').read_text(encoding='utf-8'))
enr = json.loads((ROOT / 'public/cube-enrichments.json').read_text(encoding='utf-8'))['nodes']
dims = ('场域论', '本体论', '认识论', '目的论')
nodes = []
for filename in ('sol-tree.json', 'terra-tree.json'):
    data = json.loads((HERE / filename).read_text(encoding='utf-8'))
    assert data['schema_version'] == 'tree-expansion-A.1', filename
    assert len(data['nodes']) == 10, filename
    nodes.extend(data['nodes'])

expected = {str(i) for i in range(1, 5)} | {f'{i}-{j}' for i in range(1, 5) for j in range(1, 5)}
codes = [n['code'] for n in nodes]
assert len(codes) == len(set(codes)) == 20 and set(codes) == expected
for n in nodes:
    code = n['code']; depth = len(code.split('-'))
    assert n['name'] == ism[code]['ch_name'], code
    assert n['depth'] == depth, code
    assert n['parent'] == (code.split('-')[0] if depth == 2 else None), code
    assert n['course_evidence']['lecture_url'] in [t['url'] for t in enr[code]['transcripts']], code
    raw = ism[code]['axis_list']
    assert len(raw) == depth, code
    course_axes = n['course_evidence']['course_axes']
    plain_axes = n['stance_profile']['axes_plain']
    assert len(course_axes) == len(plain_axes) == 4, code
    for idx, dim in enumerate(dims):
        c, p = course_axes[idx], plain_axes[idx]
        assert c['dimension'] == p['dimension'] == dim, code
        if idx < depth:
            assert c['status'] == p['status'] == 'course_defined', code
            assert c['course_wording'] == raw[idx] and p['text'], code
        else:
            assert c['status'] == p['status'] == 'undefined_at_this_depth', code
            assert c['course_wording'] is None and p['text'] is None, code
    s = n['stance_profile']
    assert all(s[k] for k in ('position_title','portrait','core_commitments','problem_conflict',
                             'synthetic_example','strong_opponent','internal_tension',
                             'dialectical_assessment','self_questions','neighbor_distinction')), code
    assert s['synthetic_example']['synthetic'] is True, code
    assert s['strong_opponent']['argument'], code
    assert s['strong_opponent'].get('possible_response') or s['strong_opponent'].get('fair_reply'), code
    assert s['strong_opponent'].get('relation'), code
    assert n['con_sources'], code
    for key in ('pro_sources','con_sources'):
        for src in n[key]:
            assert all(src.get(k) for k in ('author','work','version','locator','url','read_scope','supports','limits')), code
            assert src['url'].startswith('https://'), code

assert [n for n in nodes if not n['pro_sources'] and n['code'] not in {'1-3','1-4'}] == []
assert next(n for n in nodes if n['code']=='4-4')['evidence_status']['primary']=='partial_only'
for filename in ('README.md','MAJOR-BRANCHES.md','EXAMPLES-A.md','REVIEW-A.md',
                 'examples-sol-A.md','examples-terra-A.md','review-terra-A.md'):
    assert (HERE/filename).is_file(), filename
print('Stage A structure OK: 20 unique nodes, 4 parent branches, 16 children; axes match ism.json; two acknowledged positive-primary gaps (1-3, 1-4).')
