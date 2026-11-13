"""Validate research batches and generate a readable guide and JSON index.

Does not rewrite the upstream catalogue. Run again after reviewing a batch.
"""
import json
import re
import sys
from collections import Counter
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def text_of(note):
    return note if isinstance(note, str) else note["text"]


def validate_refs(value, sources, context):
    if isinstance(value, dict):
        for key, item in value.items():
            if key in ("source_ids", "reading_source_ids", "evidence_source_ids"):
                if not isinstance(item, list):
                    raise ValueError(f"{context}.{key}: expected list")
                for source_id in item:
                    if source_id not in sources:
                        raise ValueError(f"{context}: unknown source {source_id}")
            elif key == "source_id" and item not in sources:
                raise ValueError(f"{context}: unknown source {item}")
            validate_refs(item, sources, context)
    elif isinstance(value, list):
        for item in value:
            validate_refs(item, sources, context)


def referenced_sources(value):
    found = set()
    if isinstance(value, dict):
        for key, item in value.items():
            if key in ("source_ids", "reading_source_ids", "evidence_source_ids"):
                found.update(item)
            elif key == "source_id":
                found.add(item)
            found.update(referenced_sources(item))
    elif isinstance(value, list):
        for item in value:
            found.update(referenced_sources(item))
    return found


def assemble(root):
    catalogue = read_json(root / "public/ism.json")
    inputs = [("sources.json", read_json(root / "research/sources.json"))]
    course_file = root / "research/course-catalogue.json"
    if course_file.exists():
        inputs.append((course_file.name, read_json(course_file)))
    inputs += [(p.name, read_json(p)) for p in sorted((root / "research/batches").glob("*.json"))]
    sources, entries, corrections, reconciliations, course_entries = {}, {}, [], [], {}
    for filename, payload in inputs:
        for source in payload.get("sources", []):
            source_id = source["id"]
            if source_id in sources:
                raise ValueError(f"Duplicate source ID: {source_id}")
            url = urlsplit(source["url"])
            if url.scheme not in ("https", "http") or not url.netloc:
                raise ValueError(f"Invalid source URL: {source_id}")
            if not source.get("verification_scope"):
                raise ValueError(f"Missing reading scope: {source_id}")
            sources[source_id] = {**source, "batch_file": filename}
    for filename, payload in inputs:
        validate_refs(payload, sources, filename)
        for contribution in payload.get('course_entries', []):
            bv = contribution['id']
            if not re.fullmatch(r'BV[0-9A-Za-z]{10}', bv) or bv in course_entries:
                raise ValueError(f'Invalid or duplicate course body: {bv}')
            if not contribution.get('evidence_level') or not contribution.get('course_summary'):
                raise ValueError(f'Course body needs evidence and summary: {bv}')
            if any(word in contribution['evidence_level'] for word in ('title_only', 'catalogue_only')):
                raise ValueError(f'Insufficient course-body evidence: {bv}')
            if not contribution.get('series_code') or not contribution.get('body_status') or not contribution.get('review_scope'):
                raise ValueError(f'Course body needs identity and review scope: {bv}')
            if contribution.get('audio_verified') and 'not_audio_verified' in contribution['body_status']:
                raise ValueError(f'Conflicting audio-review status: {bv}')
            for claim in contribution['course_summary']:
                if not claim.get('text') or not claim.get('source_ids') or not claim.get('locator'):
                    raise ValueError(f'Course body claim needs text, sources and locator: {bv}')
                if all(sources[s].get('kind') in ('catalogue', 'course_video_page', 'search_snippet') for s in claim['source_ids']):
                    raise ValueError(f'Titles cannot support course body: {bv}')
            for reading in contribution.get('reading_links', []):
                if not reading.get('locator') or not reading.get('reason'):
                    raise ValueError(f'Course reading needs locator and reason: {bv}')
                if reading.get('relation') == 'lecture_explicit_reference' and not reading.get('evidence_source_ids'):
                    raise ValueError(f'Course reading attribution needs evidence: {bv}')
            course_entries[bv] = {**contribution, 'batch_file': filename}
        for contribution in payload.get("entries", []):
            code = contribution["code"]
            if code not in catalogue or not re.fullmatch(r"[1-4](?:-[1-4]){0,3}", code):
                raise ValueError(f"Unknown catalogue code: {code}")
            for claim in contribution.get("course_summary", []):
                if not isinstance(claim, dict) or not claim.get("text") or not claim.get("source_ids") or not claim.get("locator"):
                    raise ValueError(f"{code}: course claim must have text, sources and locator")
                if not contribution.get("evidence_level"):
                    raise ValueError(f"{code}: course claim must declare evidence level")
                if any(word in contribution["evidence_level"] for word in ("title_only", "catalogue_only", "parent_lecture_reference_only")):
                    raise ValueError(f"{code}: insufficient evidence level for a course summary")
                if all(sources[s].get("kind") in ("course_video_page", "catalogue", "search_snippet") for s in claim["source_ids"]):
                    raise ValueError(f"{code}: titles/catalogues alone cannot support a course summary")
            for axis in contribution.get("axis_explanations", []):
                index = axis.get("axis_index")
                if not isinstance(index, int) or not 0 <= index < len(code.split('-')):
                    raise ValueError(f"{code}: invalid axis index")
                if not axis.get("text") or not axis.get("source_ids") or not axis.get("locator"):
                    raise ValueError(f"{code}: axis explanation needs text, source and locator")
            for reading in contribution.get("reading_links", []):
                if not reading.get("locator") or not reading.get("reason"):
                    raise ValueError(f"{code}: reading link needs locator and reason")
                if reading.get("relation") == "lecture_explicit_reference" and not reading.get("evidence_source_ids"):
                    raise ValueError(f"{code}: explicit course reference needs course evidence")
            entry = entries.setdefault(code, {"code": code, "title": catalogue[code]["ch_name"], "contributions": []})
            entry["contributions"].append({**contribution, "batch_file": filename})
        corrections.extend({**c, "batch_file": filename} for c in payload.get("corrections", []))
        reconciliations.extend({**r, "batch_file": filename} for r in payload.get("correction_reconciliations", []))
    for resolution in reconciliations:
        matches = [c for c in corrections if c['batch_file'] == resolution['target_batch']
                   and c['code'] == resolution['code'] and c['field_path'] == resolution['field_path']]
        if len(matches) != 1 or matches[0]['status'] != resolution['previous_status']:
            raise ValueError('Reconciliation must identify one historical correction with matching status')
        matches[0]['resolution'] = resolution
    for entry in entries.values():
        for contribution in entry["contributions"]:
            replacements = [c["batch_file"] for c in entry["contributions"]
                            if contribution["batch_file"] in c.get("supersedes_batches", [])]
            contribution["superseded_by"] = replacements
            for axis in contribution.get('axis_explanations', []):
                replacing = [c['batch_file'] for c in entry['contributions']
                             for old in c.get('supersedes_axes', [])
                             if old['batch_file'] == contribution['batch_file'] and old['axis_index'] == axis['axis_index']]
                if replacing:
                    axis['superseded_by'] = replacing
    courses = read_json(course_file).get("courses", []) if course_file.exists() else []
    known_bv = {c['id'] for c in courses}
    if set(course_entries) - known_bv:
        raise ValueError('Course body has no catalogued identity')
    for course in courses:
        if course['id'] in course_entries:
            course['body_status'] = course_entries[course['id']]['body_status']
            course['body_ref'] = course['id']
            if course['kind'] == 'dollar_series':
                course['related_codes'] = [course_entries[course['id']]['series_code']]
    ids = [c["id"] for c in courses]
    if len(ids) != len(set(ids)):
        raise ValueError("Duplicate course identity")
    validate_refs(courses, sources, "course catalogue")
    correction_chains = {}
    for correction in corrections:
        if correction["code"] not in catalogue:
            raise ValueError("Correction has unknown code")
        if correction.get("status") == "ready" and not correction.get("evidence_source_ids"):
            raise ValueError("Ready correction needs evidence")
        if correction.get("status") == "ready":
            key = (correction['code'], tuple(correction['field_path']))
            correction_chains.setdefault(key, []).append(correction)
    for (code, field_path), chain in correction_chains.items():
            current = catalogue[code]
            try:
                for part in field_path:
                    current = current[part]
            except (KeyError, IndexError, TypeError) as error:
                raise ValueError(f"Invalid correction path: {code}") from error
            states = [chain[0]['before']]
            for correction in chain:
                if correction['before'] != states[-1]:
                    raise ValueError(f"Discontinuous correction chain: {code}")
                states.append(correction['after'])
            matches = [i for i, value in enumerate(states) if value == current]
            if not matches:
                raise ValueError(f"Correction field has drifted: {code}")
            applied_count = max(matches)
            for i, correction in enumerate(chain):
                correction['application_status'] = 'applied' if i < applied_count else 'not_applied'
                if i < applied_count - 1:
                    correction['application_status'] = 'applied_then_superseded'
    used_sources = referenced_sources(entries) | referenced_sources(corrections) | referenced_sources(courses) | referenced_sources(course_entries)
    sources = {key: value for key, value in sources.items() if key in used_sources}
    return {
        "schema_version": 1,
        "checked_on": "2026-11-13",
        "scope": "课程文本整理、原典对照及编者阅读关联。条目中的证据层级分别保留；不代表原音听校或人工审定。",
        "sources": sources,
        "entries": dict(sorted(entries.items())),
        "corrections": corrections,
        "courses": courses,
        "course_entries": course_entries,
        "counts": {
            "entries_with_contributions": len(entries),
            "entries_with_course_summaries": sum(any(c.get("course_summary") and not c.get("superseded_by") for c in e["contributions"]) for e in entries.values()),
            "source_records": len(sources),
            "unique_source_urls": len({s["url"].rstrip('/') for s in sources.values()}),
            "correction_records": len(corrections),
            "extra_courses": len(courses),
            "extra_course_bodies": len(course_entries),
        },
    }


def render(knowledge):
    sources = knowledge["sources"]
    lines = ["# 主义主义资料导读", "", knowledge["scope"], "", "由 `scripts/build-research.py` 从已读批次记录生成；编辑各批次 JSON 后重新生成。", "", "## 条目索引", ""]
    for code, entry in knowledge["entries"].items():
        lines.append(f"- [{code} {entry['title']}](#{code.replace('-', '')})")
    for code, entry in knowledge["entries"].items():
        lines += ["", f'<a id="{code.replace("-", "")}"></a>', f"## {code} {entry['title']}", ""]
        for contribution in entry["contributions"]:
            if contribution.get("superseded_by"):
                continue
            replaced_axes = [axis for axis in contribution.get('axis_explanations', []) if axis.get('superseded_by')]
            for axis in replaced_axes:
                replacements = '、'.join(f'[{name}](batches/{name})' for name in axis['superseded_by'])
                lines += [f"历史说明：本批第{axis['axis_index'] + 1}格已由{replacements}更新。下列涉及该格的旧归纳或待核措辞保留为历史记录，不是当前结论。", '']
            if contribution.get("evidence_level"):
                lines += [f"证据层级：`{contribution['evidence_level']}`。", ""]
            for claim in contribution.get("course_summary", []):
                refs = "、".join(f"[{sources[s]['title']}]({sources[s]['url']})" for s in claim["source_ids"])
                lines += [claim["text"], "", f"依据：{refs}；定位：{claim['locator']}。", ""]
            for axis in contribution.get("axis_explanations", []):
                if axis.get('superseded_by'):
                    continue
                refs = "、".join(f"[{sources[s]['title']}]({sources[s]['url']})" for s in axis["source_ids"])
                lines += [axis["text"], "", f"轴说明依据：{refs}；定位：{axis['locator']}。", ""]
            if contribution.get("review_status"):
                status = contribution['review_status']
                if isinstance(status, dict):
                    status = '；'.join(f'{k}={v}' for k, v in status.items())
                lines += [f"复核状态：{status}。", ""]
            for checked in contribution.get("checked_claims", []):
                if isinstance(checked, str):
                    lines += ["核查记录：" + checked, ""]
                else:
                    links = '、'.join(f"[{sources[s]['title']}]({sources[s]['url']})" for s in checked.get('source_ids', []))
                    lines += [f"核查：{checked.get('claim', checked.get('text', ''))}；状态：{checked.get('status', '')}。", "", f"依据：{links}；定位：{checked.get('locator', '见批次记录')}。", ""]
                    if checked.get('finding'):
                        lines += [checked['finding'], '']
                    for subclaim in checked.get('subclaim_checks', []):
                        links = '、'.join(f"[{sources[s]['title']}]({sources[s]['url']})" for s in subclaim.get('source_ids', []))
                        lines += [f"分项核查：{subclaim['claim']}。{subclaim['finding']}", '',
                                  f"依据：{links}；定位：{subclaim['locator']}。", '']
            for note in contribution.get("editorial_notes", []):
                refs = [] if isinstance(note, str) else note.get("source_ids", [])
                links = "、".join(f"[{sources[s]['title']}]({sources[s]['url']})" for s in refs)
                lines += ["编者注：" + text_of(note) + (f" 参考：{links}。" if links else ""), ""]
                if isinstance(note, dict) and note.get("locator"):
                    lines += [f"定位：{note['locator']}。", ""]
            for reading in contribution.get("reading_links", []):
                source = sources[reading["source_id"]]
                relation = reading["relation"]
                if relation not in ("editorial_reading", "lecture_explicit_reference"):
                    raise ValueError(f"Unknown reading relation: {relation}")
                label = "编者关联阅读" if relation == "editorial_reading" else "课程明确引用（依所列证据）"
                lines += [f"- {label}：[{source['title']}]({source['url']})。定位：{reading['locator']}。{reading['reason']}"]
                if reading.get("verification_scope"):
                    lines.append(f"  核查范围：{reading['verification_scope']}")
                if reading.get("evidence_source_ids"):
                    refs = '、'.join(f"[{sources[s]['title']}]({sources[s]['url']})" for s in reading['evidence_source_ids'])
                    lines += [f"  课程提及依据：{refs}"]
            if contribution.get("open_questions"):
                lines += ["", "待核："] + [f"- {q}" for q in contribution["open_questions"]] + [""]
    lines += ["", "## 校勘记录", ""]
    for correction in knowledge["corrections"]:
        links = "、".join(f"[{sources[s]['title']}]({sources[s]['url']})" for s in correction.get("evidence_source_ids", []))
        lines += [f"### {correction['code']}", "", f"字段：`{correction.get('field_path')}`；审查状态：`{correction['status']}`；应用状态：`{correction.get('application_status', 'not_applicable')}`。", "", f"修改前：{correction.get('before', '')}", "", f"修改后：{correction.get('after', '')}", "", correction.get("rationale", ""), "", f"依据：{links}。", ""]
        if correction.get('resolution'):
            resolution = correction['resolution']
            refs = '、'.join(f"[{sources[s]['title']}]({sources[s]['url']})" for s in resolution['source_ids'])
            lines += [f"后续处理：`{resolution['resolution_status']}`；旧替换方案未应用。{resolution['reason']}", '',
                      f"依据：{refs}；定位：{resolution['locator']}。", '']
    lines += ["", "## 来源与实际阅读范围", ""]
    for source_id, source in sources.items():
        lines += [f"### {source_id}", "", f"[{source['title']}]({source['url']})", ""]
        for field, label in (("author", "作者"), ("language", "语种"), ("edition", "版本"), ("translator", "译者"), ("locator", "定位")):
            if field in source:
                lines += [f"{label}：{source[field] if source[field] is not None else '未核实'}。", ""]
        lines += [source["verification_scope"], ""]
    return "\n".join(lines).rstrip() + "\n"


def render_readings(knowledge):
    books = {}
    for code, entry in knowledge['entries'].items():
        for contribution in entry['contributions']:
            if contribution.get('superseded_by'):
                continue
            for reading in contribution.get('reading_links', []):
                books.setdefault(reading['source_id'], []).append((code, entry['title'], reading))
    for bv, entry in knowledge.get('course_entries', {}).items():
        for reading in entry.get('reading_links', []):
            books.setdefault(reading['source_id'], []).append((bv, entry['series_code'] + ' ' + entry['title'], reading))
    lines = ['# 典籍与学术资料索引', '', '按书目反查课程。课程明确提及与编者建议分开；链接可能是节选、译文或学术综述，实际核读范围见每项说明。', '']
    for sid, links in books.items():
        source = knowledge['sources'][sid]
        lines += [f"## {source['title']}", '', f"[公开阅读入口]({source['url']})", '']
        for field, label in [('author', '作者'), ('kind', '来源类型'), ('edition', '版本'), ('translator', '译者')]:
            if field in source:
                lines += [f"{label}：{source[field] or '未核实'}。", '']
        lines += [source['verification_scope'], '']
        for code, title, reading in links:
            label = '课程明确提及' if reading['relation'] == 'lecture_explicit_reference' else '编者关联'
            target = f'COURSE-READINGS.md#{code}' if code.startswith('BV') else f"READING-GUIDE.md#{code.replace('-', '')}"
            lines += [f"- [{code} {title}]({target})（{label}）：{reading['locator']}。{reading['reason']}"]
        lines += ['']
    return '\n'.join(lines).rstrip() + '\n'


def render_courses(knowledge):
    labels = {'lecture':'其他讲次/版本', 'dollar_series':'$字头', 'review':'复习课', 'preview':'预习课', 'exercise':'练习课', 'extra':'番外', 'overview':'总纲'}
    lines = ['# 补充课程目录', '', '按视频BV号区分讲次和版本。编号关系来自标题目录，不表示已经阅读或核听正文。公开视频元数据检查也不等于播放验收。', '', '| 类型 | 课程 | 编号关联 | 核查 |', '| --- | --- | --- | --- |']
    for c in knowledge['courses']:
        title = c.get('video_check', {}).get('title', c['title']).replace('|', '／')
        status = c.get('video_check', {}).get('status', 'catalogue_only')
        lines += [f"| {labels.get(c['kind'], c['kind'])} | [{title}]({c['url']}) | {', '.join(c.get('related_codes', []))} | {status}；正文{c['body_status']} |"]
    lines += ['', '目录依据：']
    for sid in sorted(referenced_sources(knowledge['courses'])):
        s = knowledge['sources'][sid]
        lines += [f"- [{s['title']}]({s['url']})：{s['verification_scope']}"]
    if knowledge['course_entries']:
        lines += ['', '## 已整理的补充课程正文', '', '[按讲次阅读正文摘要与逐项出处](COURSE-READINGS.md)。']
    return '\n'.join(lines).rstrip() + '\n'


def render_course_bodies(knowledge):
    lines = ['# 补充课程正文导读', '', '按BV号和原有系列编号保留身份。ASR转录摘要不是原音听校；课程对黑格尔等人的解释与原著原意需要分别核对。', '']
    for bv, entry in knowledge.get('course_entries', {}).items():
        lines += [f"- [{entry['series_code']} {entry['title']}](#{bv})"]
    for bv, entry in knowledge.get('course_entries', {}).items():
        lines += ['', f'<a id="{bv}"></a>', f"## {entry['series_code']} {entry['title']}", '',
                  f"[原视频](https://www.bilibili.com/video/{bv})；状态：`{entry['body_status']}`。{entry['review_scope']}", '']
        for claim in entry['course_summary']:
            refs = '、'.join(f"[{knowledge['sources'][s]['title']}]({knowledge['sources'][s]['url']})" for s in claim['source_ids'])
            lines += [claim['text'], '', f"依据：{refs}；定位：{claim['locator']}。", '']
        for note in entry.get('editorial_notes', []):
            lines += ['编者注：' + text_of(note), '']
        for reading in entry.get('reading_links', []):
            source = knowledge['sources'][reading['source_id']]
            label = '编者关联' if reading['relation'] == 'editorial_reading' else '课程提及（依所列证据）'
            lines += [f"{label}：[{source['title']}]({source['url']})；{reading['locator']}。{reading['reason']}", '']
    return '\n'.join(lines).rstrip() + '\n'


def manual_review(root, knowledge):
    """Count real field records; coverage never implies all claims are confirmed."""
    catalogue = read_json(root / 'public/ism.json')
    rows, statuses = [], Counter()
    for code, item in catalogue.items():
        if code == 'introduction' or item.get('summary_status') != 'manual':
            continue
        expected = {(name, i) for name in ('feature_list', 'axis_list') for i in range(len(item[name]))}
        checks = []
        for contribution in knowledge['entries'].get(code, {}).get('contributions', []):
            if not contribution['batch_file'].startswith('06-manual-') or contribution.get('superseded_by'):
                continue
            for check in contribution.get('checked_claims', []):
                path = tuple(check.get('field_path', []))
                if path not in expected:
                    raise ValueError(f'Manual check has invalid field: {code} {path}')
                if not check.get('source_ids') or not check.get('locator') or not check.get('finding'):
                    raise ValueError(f'Manual check lacks evidence/finding: {code} {path}')
                for subclaim in check.get('subclaim_checks', []):
                    if not all(subclaim.get(k) for k in ('claim', 'finding', 'source_ids', 'locator')):
                        raise ValueError(f'Manual subclaim lacks evidence/finding: {code} {path}')
                checks.append({**check, 'batch_file': contribution['batch_file']})
                statuses[check['status']] += 1
        recorded = {tuple(c['field_path']) for c in checks}
        rows.append({'code': code, 'title': item['ch_name'], 'expected_fields': len(expected),
                     'recorded_fields': len(recorded), 'missing_fields': [list(p) for p in sorted(expected - recorded)],
                     'checks': checks,
                     'applied_corrections': [c for c in knowledge['corrections'] if c['code'] == code
                                             and c['batch_file'].startswith('06-manual-')
                                             and c.get('application_status') in ('applied', 'applied_then_superseded')]})
    counts = {'manual_nodes': len(rows), 'all_fields_recorded_nodes': sum(not r['missing_fields'] for r in rows),
              'expected_fields': sum(r['expected_fields'] for r in rows),
              'recorded_fields': sum(r['recorded_fields'] for r in rows),
              'claim_checks': sum(len(r['checks']) for r in rows), 'claim_statuses': dict(sorted(statuses.items()))}
    report = {'scope': '逐字段文本比对覆盖；支持、限定、未定位与修订分别保留。覆盖完整不等于全部命题通过，更不等于原音或原典审定。',
              'counts': counts, 'entries': rows}
    lines = ['# 原人工摘要逐字段校对', '', report['scope'], '',
             f"共 {counts['manual_nodes']} 节点；{counts['all_fields_recorded_nodes']} 节点已记录全部字段；{counts['recorded_fields']}/{counts['expected_fields']} 字段，拆分为 {counts['claim_checks']} 条命题记录。", '',
             '| 编号 | 字段覆盖 | 已应用修订 | 缺少核查字段 |', '| --- | ---: | ---: | --- |']
    for row in rows:
        missing = ', '.join(f'{p[0]}[{p[1]}]' for p in row['missing_fields']) or '无；具体支持程度见逐条记录'
        lines.append(f"| [{row['code']} {row['title']}](READING-GUIDE.md#{row['code'].replace('-', '')}) | {row['recorded_fields']}/{row['expected_fields']} | {len(row['applied_corrections'])} | {missing} |")
    lines += ['', '## 命题状态原样统计', '', '| 状态 | 数量 |', '| --- | ---: |']
    lines += [f'| {status} | {count} |' for status, count in sorted(statuses.items())]
    lines += ['', '全部字段、定位、发现和应用记录见 [结构化记录](../public/manual-review.json)。未定位细节不会因所在字段有其他句子得到支持而被标成通过。']
    return report, '\n'.join(lines).rstrip() + '\n'


def full_course_catalogue(root, knowledge):
    catalogue = read_json(root / 'public/courses.json')
    for course in catalogue['courses']:
        if course['id'] in knowledge['course_entries']:
            body = knowledge['course_entries'][course['id']]
            course.update(body_status=body['body_status'], body_ref=course['id'])
            if course['kind'] == 'dollar_series':
                course['related_codes'] = [body['series_code']]
    return catalogue


def coverage(root, knowledge):
    catalogue = read_json(root / 'public/ism.json')
    index = read_json(root / 'public/transcripts.json')
    rows = []
    for code, item in catalogue.items():
        if code == 'introduction':
            continue
        contributions = [c for c in knowledge['entries'].get(code, {}).get('contributions', []) if not c.get('superseded_by')]
        chapters = index['entries'].get(code, [])
        if not chapters:
            raise ValueError(f'Missing transcript index: {code}')
        row = {'code': code, 'title': item['ch_name'], 'summary_origin': item.get('summary_status'),
               'has_summary_text': any(item['feature_list']),
               'axis_text_count': sum(not re.fullmatch(r'(场域论|本体论|认识论|目的论)[1-4]', a.strip()) for a in item['axis_list']),
               'axis_count': len(item['axis_list']), 'transcript_chapters': chapters,
               'new_located_summary': any(c.get('course_summary') for c in contributions),
               'reading_links': sum(len(c.get('reading_links', [])) for c in contributions),
               'review_batches': [c['batch_file'] for c in contributions if c.get('review_status')],
               'axis_qualifications': [a for c in contributions for a in c.get('axis_explanations', [])
                                       if a.get('status') and a['status'] not in ('verified', 'supported', 'text_supported')
                                       and not a.get('superseded_by')],
               'audio_verified': False}
        rows.append(row)
    counts = {'catalogue_nodes': len(rows), 'summary_text_present': sum(r['has_summary_text'] for r in rows),
              'axis_text_present': sum(r['axis_text_count'] for r in rows), 'axis_slots': sum(r['axis_count'] for r in rows),
              'transcript_indexed_nodes': sum(bool(r['transcript_chapters']) for r in rows),
              'new_located_summaries': sum(r['new_located_summary'] for r in rows),
              'nodes_with_reading_links': sum(r['reading_links'] > 0 for r in rows),
              'reading_links': sum(r['reading_links'] for r in rows),
              'nodes_with_review_records': sum(bool(r['review_batches']) for r in rows),
              'qualified_axis_records': sum(len(r['axis_qualifications']) for r in rows), 'audio_verified_nodes': 0}
    result = {'scope':'字段完整性与研究覆盖分别计数；非空不表示准确，原音核校仍未完成。', 'counts':counts, 'entries':rows}
    lines = ['# 全库覆盖与正文入口', '', result['scope'], '', '| 项目 | 数量 |', '| --- | ---: |']
    labels = {'catalogue_nodes':'编号', 'summary_text_present':'有摘要文字', 'axis_text_present':'有格位说明文字', 'axis_slots':'格位总数', 'transcript_indexed_nodes':'有分讲正文入口的编号', 'new_located_summaries':'本轮依据具体文本补写摘要', 'nodes_with_reading_links':'有典籍关联的编号', 'reading_links':'典籍关联数', 'nodes_with_review_records':'有复核记录的编号', 'qualified_axis_records':'带限定状态的新增轴说明', 'audio_verified_nodes':'本轮原音核校通过'}
    lines += [f"| {labels[key]} | {value} |" for key, value in counts.items()]
    lines += ['', '## 按编号回查', '', 'manual/ai 为原站整理方式标签。分讲链接按文件名编号匹配，复习课和同讲多部分保留，不据此断言版本逐字一致。', '', '| 编号与名称 | 摘要标签 | 格位文字 | 正文 | 典籍关联 | 复核记录 |', '| --- | --- | --- | --- | ---: | --- |']
    for row in rows:
        links = '；'.join(f"[{c['row']} {'复习' if c['kind']=='review' else '讲次'}]({c['url']})" for c in row['transcript_chapters'])
        reviews = '、'.join(row['review_batches']) or '未逐条复核'
        lines += [f"| {row['code']} {row['title']} | {row['summary_origin']} | {row['axis_text_count']}/{row['axis_count']} | {links} | {row['reading_links']} | {reviews} |"]
    return result, '\n'.join(lines).rstrip() + '\n'


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    knowledge = assemble(ROOT)
    guide = render(knowledge)
    (ROOT / "public/research.json").write_text(json.dumps(knowledge, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (ROOT / "research/READING-GUIDE.md").write_text(guide, encoding="utf-8")
    (ROOT / "research/BIBLIOGRAPHY.md").write_text(render_readings(knowledge), encoding="utf-8")
    (ROOT / "research/COURSES.md").write_text(render_courses(knowledge), encoding="utf-8")
    (ROOT / 'research/COURSE-READINGS.md').write_text(render_course_bodies(knowledge), encoding='utf-8')
    (ROOT / 'public/course-bodies.json').write_text(json.dumps(knowledge['course_entries'], ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (ROOT / 'public/courses.json').write_text(json.dumps(full_course_catalogue(ROOT, knowledge), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    manual, manual_text = manual_review(ROOT, knowledge)
    (ROOT / 'public/manual-review.json').write_text(json.dumps(manual, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (ROOT / 'research/MANUAL-REVIEW.md').write_text(manual_text, encoding='utf-8')
    if (ROOT / 'public/transcripts.json').exists():
        report, coverage_text = coverage(ROOT, knowledge)
        (ROOT / 'public/coverage.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        (ROOT / 'research/COVERAGE.md').write_text(coverage_text, encoding='utf-8')
    print(json.dumps(knowledge["counts"], ensure_ascii=False))
