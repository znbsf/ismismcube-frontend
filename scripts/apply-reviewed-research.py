"""Apply explicitly selected, reviewed batches; default is a preview.

python scripts/apply-reviewed-research.py --batches FILE.json ... --write
This does not approve batches or perform philosophical review.
"""
import argparse
import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('research_build', ROOT / 'scripts/build-research.py')
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)


def apply(names, write=False):
    knowledge = build.assemble(ROOT)
    data = build.read_json(ROOT / 'public/ism.json')
    ledger = build.read_json(ROOT / 'research/applied-changes.json')
    initial_count = len(ledger['changes'])

    def record(code, path, after, reason, refs, batch):
        target = data[code]
        for part in path[:-1]:
            target = target[part]
        key = path[-1]
        exists = key in target if isinstance(target, dict) else key < len(target)
        before = target[key] if exists else None
        if exists and before == after:
            return
        change = {'code': code, 'field_path': path, 'before': before, 'after': after,
                  'reason': reason, 'evidence_source_ids': list(dict.fromkeys(refs)),
                  'batch_file': batch, 'application_status': 'applied'}
        if not exists:
            change['before_exists'] = False
        ledger['changes'].append(change)
        target[key] = after

    for name in names:
        if Path(name).name != name or not name.endswith('.json'):
            raise ValueError('Pass batch filenames only')
        batch = build.read_json(ROOT / 'research/batches' / name)
        for correction in batch.get('corrections', []):
            if correction.get('status') != 'ready':
                continue
            code, path = correction['code'], correction['field_path']
            # Earlier transitions may have been superseded by a later applied patch.
            if any(c['code'] == code and c['field_path'] == path and
                   c['before'] == correction['before'] and c['after'] == correction['after']
                   for c in ledger['changes']):
                continue
            current = data[code]
            for part in path:
                current = current[part]
            if current != correction['before']:
                raise ValueError(f'Patch before-value mismatch: {code} {path}')
            record(code, path, correction['after'], correction['rationale'],
                   correction['evidence_source_ids'], name)
        for entry in batch.get('entries', []):
            code = entry['code']
            assembled_entry = next(c for c in knowledge['entries'][code]['contributions'] if c['batch_file'] == name)
            applied_batches = {c.get('batch_file') for c in ledger['changes']}
            if any(b in applied_batches for b in assembled_entry.get('superseded_by', [])):
                continue
            refs = sorted(build.referenced_sources(entry))
            if entry.get('course_summary') and code.startswith('4'):
                claims = entry['course_summary']
                features = [chr(0x2460 + i) + ('【依二手讲稿局部核读整理，未核原音】' if i == 0 else '') + c['text']
                            for i, c in enumerate(claims)]
                record(code, ['feature_list'], features, '将已核读的分讲论点写入空白或早期预览摘要；保留AI与二手文本标识。', refs, name)
                record(code, ['summary_status'], 'ai', '新增整理由模型完成，不能改称人工审定。', refs, name)
                evidence = {'level': entry['evidence_level'], 'coverage': 'located_passages',
                            'source_ids': sorted(build.referenced_sources(claims)),
                            'audio_verified': False, 'batch_file': name}
                record(code, ['summary_evidence'], evidence, '保留摘要的证据层级和实际覆盖范围。', refs, name)
            superseded_indices = {a['axis_index'] for a in assembled_entry.get('axis_explanations', [])
                                  if any(b in applied_batches for b in a.get('superseded_by', []))}
            axes = [a for a in entry.get('axis_explanations', []) if a['axis_index'] not in superseded_indices]
            if axes:
                values = list(data[code]['axis_list'])
                for axis in axes:
                    text = axis['text']
                    status = axis.get('status', '')
                    if status and status not in ('verified', 'supported', 'text_supported'):
                        head, separator, rest = text.partition('：')
                        text = head + separator + '【限定说明，见校勘记录】' + rest
                    index = axis['axis_index']
                    if index == len(values):
                        values.append(text)
                    elif index < len(values):
                        values[index] = text
                    else:
                        raise ValueError(f'Cannot skip an axis slot: {code}')
                record(code, ['axis_list'], values, '以分讲正文或明确标注的父讲继承说明替换格位占位；保留有疑问项的限定。', refs, name)
                evidence_by_index = {a['axis_index']: a for a in data[code].get('axis_evidence', [])}
                evidence_by_index.update({a['axis_index']: a for a in axes})
                record(code, ['axis_evidence'], [evidence_by_index[i] for i in sorted(evidence_by_index)],
                       '逐格保存文本定位、继承关系与待核状态；局部更新保留其余格位证据。', refs, name)
            related = list(data[code]['related_list'])
            for note in entry.get('editorial_notes', []):
                value = '编者校勘注：' + build.text_of(note)
                if value not in related:
                    related.append(value)
            for reading in entry.get('reading_links', []):
                source = knowledge['sources'][reading['source_id']]
                label = '课程提及典籍（依二手讲稿）' if reading['relation'] == 'lecture_explicit_reference' else '延伸阅读（编者关联）'
                value = label + source['title'].replace('：', '—') + '：' + source['url']
                if value not in related:
                    related.append(value)
            for sid in sorted(build.referenced_sources(entry.get('course_summary', []))):
                source = knowledge['sources'][sid]
                value = '分讲正文（二手整理）' + source['title'].replace('：', '—') + '：' + source['url']
                if not any(source['url'] in old for old in related):
                    related.append(value)
            record(code, ['related_list'], related, '接入可回查的分讲正文、校勘注和阅读关联；不改变原视频入口。', refs, name)
    count = len(ledger['changes']) - initial_count
    if write:
        (ROOT / 'public/ism.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        (ROOT / 'research/applied-changes.json').write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return {'field_changes': count, 'written': write}


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--batches', nargs='+', required=True)
    parser.add_argument('--write', action='store_true')
    args = parser.parse_args()
    print(json.dumps(apply(args.batches, args.write)))
