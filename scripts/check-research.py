"""Check provenance, exact patch replay and generated artefacts. Does not certify content.

Run build-research.py first. Writes research/validation.json after all checks pass.
"""
import copy
import argparse
import hashlib
import importlib.util
import json
import subprocess
import sys
import tempfile
from collections import Counter
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('build', ROOT / 'scripts/build-research.py')
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)


def require(condition, message):
    if not condition:
        raise ValueError(message)


def fixture_checks():
    source = {'id': 's', 'url': 'https://example.org/transcript', 'kind': 'community_compiled_transcript',
              'title': 'Fixture', 'verification_scope': 'Synthetic validator fixture only'}
    entry = {'code': '4', 'evidence_level': 'transcript_secondary',
             'course_summary': [{'text': 'Fixture', 'source_ids': ['s'], 'locator': 'Page 1'}],
             'axis_explanations': [{'axis_index': 0, 'text': 'Fixture axis', 'source_ids': ['s'], 'locator': 'Page 1'}]}
    base = {'sources': [source], 'entries': [entry]}
    passed = []
    with tempfile.TemporaryDirectory(prefix='ismism-validation-') as directory:
        root = Path(directory)
        (root / 'research/batches').mkdir(parents=True)
        (root / 'public').mkdir()
        (root / 'research/sources.json').write_text('{"sources": []}', encoding='utf-8')

        def run(name, mutate, rejected=True, current='A'):
            payload = copy.deepcopy(base)
            mutate(payload)
            (root / 'public/ism.json').write_text(json.dumps({'4': {'ch_name': current}}), encoding='utf-8')
            (root / 'research/batches/fixture.json').write_text(json.dumps(payload), encoding='utf-8')
            try:
                result = build.assemble(root)
            except ValueError:
                require(rejected, f'Valid fixture rejected: {name}')
            else:
                require(not rejected, f'Invalid fixture accepted: {name}')
                if name == 'continuous_patch_chain':
                    require([c['application_status'] for c in result['corrections']] ==
                            ['applied_then_superseded', 'applied'], 'Wrong patch-chain status')
            passed.append(name)

        run('missing_source', lambda p: p['entries'][0]['course_summary'][0].update(source_ids=['missing']))
        run('missing_summary_locator', lambda p: p['entries'][0]['course_summary'][0].pop('locator'))
        run('title_only_evidence', lambda p: p['entries'][0].update(evidence_level='title_only'))
        run('title_only_source', lambda p: p['sources'][0].update(kind='course_video_page'))
        run('axis_index_out_of_range', lambda p: p['entries'][0]['axis_explanations'][0].update(axis_index=1))
        run('axis_missing_locator', lambda p: p['entries'][0]['axis_explanations'][0].pop('locator'))
        run('explicit_reading_without_course_evidence', lambda p: p['entries'][0].update(reading_links=[
            {'source_id': 's', 'locator': '1', 'reason': 'Fixture', 'relation': 'lecture_explicit_reference'}]))

        def chain(payload, broken=False):
            payload['corrections'] = [
                {'code': '4', 'field_path': ['ch_name'], 'before': 'A', 'after': 'B', 'status': 'ready', 'evidence_source_ids': ['s']},
                {'code': '4', 'field_path': ['ch_name'], 'before': 'X' if broken else 'B', 'after': 'C', 'status': 'ready', 'evidence_source_ids': ['s']}]

        run('continuous_patch_chain', chain, rejected=False, current='C')
        run('discontinuous_patch_chain', lambda p: chain(p, True), current='C')
        run('patch_field_drift', chain, current='D')

        bv = 'BV1HL4y1x7eb'
        (root / 'research/course-catalogue.json').write_text(json.dumps({'courses': [
            {'id': bv, 'kind': 'dollar_series', 'related_codes': ['$']}]}), encoding='utf-8')
        def body(payload, **changes):
            record = {'id': bv, 'series_code': '$', 'evidence_level': 'transcript_secondary',
                      'body_status': 'asr_text_reviewed_not_audio_verified', 'review_scope': 'Synthetic fixture',
                      'course_summary': copy.deepcopy(entry['course_summary']), 'audio_verified': False}
            record.update(changes)
            payload['course_entries'] = [record]
        run('course_body_valid', body, rejected=False)
        run('course_body_uncatalogued', lambda p: body(p, id='BV1Er4y1v78m'))
        run('course_body_title_only', lambda p: body(p, evidence_level='title_only'))
        run('course_body_audio_conflict', lambda p: body(p, audio_verified=True))
        def no_locator(payload):
            body(payload)
            payload['course_entries'][0]['course_summary'][0].pop('locator')
        run('course_body_missing_locator', no_locator)
    return passed


def main(source_cache=None):
    knowledge = build.assemble(ROOT)
    require(all(c.get('application_status') in ('applied', 'applied_then_superseded')
                for c in knowledge['corrections'] if c['status'] == 'ready'), 'Unapplied reviewed correction')
    current = build.read_json(ROOT / 'public/ism.json')
    ledger = build.read_json(ROOT / 'research/applied-changes.json')
    baseline = json.loads(subprocess.check_output(['git', 'show', ledger['upstream_base'] + ':public/ism.json'], cwd=ROOT))
    replay = copy.deepcopy(baseline)
    for number, patch in enumerate(ledger['changes'], 1):
        build.validate_refs(patch, knowledge['sources'], f'ledger #{number}')
        target = replay[patch['code']]
        for key in patch['field_path'][:-1]:
            target = target[key]
        key = patch['field_path'][-1]
        exists = key in target if isinstance(target, dict) else key < len(target)
        require(exists == patch.get('before_exists', True), f'Ledger existence mismatch #{number}')
        require((target[key] if exists else None) == patch['before'], f'Ledger before mismatch #{number}')
        target[key] = patch['after']
    require(replay == current, 'Replayed ledger differs from public data')
    require(current['introduction'] == baseline['introduction'], 'Introduction changed outside scope')
    for code, item in baseline.items():
        if code == 'introduction':
            continue
        originals = [s for s in item['related_list'] if s.startswith('原视频')]
        require(all(s in current[code]['related_list'] for s in originals), f'Original entry lost: {code}')

    audit = json.loads(subprocess.check_output([sys.executable, 'scripts/audit-corpus.py'], cwd=ROOT))
    for field in ('missing_codes', 'duplicate_json_keys', 'unsupported_status', 'empty_feature_codes',
                  'axis_placeholder_entries', 'axis_length_mismatches', 'missing_original_video_codes'):
        require(not audit[field], f'Catalogue check failed: {field}')
    require(audit['entry_count'] == 340, 'Unexpected catalogue size')

    coverage, coverage_md = build.coverage(ROOT, knowledge)
    manual, manual_md = build.manual_review(ROOT, knowledge)
    expected = {
        'public/research.json': json.dumps(knowledge, ensure_ascii=False, indent=2) + '\n',
        'public/coverage.json': json.dumps(coverage, ensure_ascii=False, indent=2) + '\n',
        'research/READING-GUIDE.md': build.render(knowledge),
        'research/BIBLIOGRAPHY.md': build.render_readings(knowledge),
        'research/COURSES.md': build.render_courses(knowledge),
        'research/COVERAGE.md': coverage_md,
        'public/manual-review.json': json.dumps(manual, ensure_ascii=False, indent=2) + '\n',
        'research/MANUAL-REVIEW.md': manual_md,
        'public/course-bodies.json': json.dumps(knowledge['course_entries'], ensure_ascii=False, indent=2) + '\n',
        'research/COURSE-READINGS.md': build.render_course_bodies(knowledge),
        'public/courses.json': json.dumps(build.full_course_catalogue(ROOT, knowledge), ensure_ascii=False, indent=2) + '\n',
    }
    for filename, text in expected.items():
        require((ROOT / filename).read_text(encoding='utf-8') == text, f'Stale generated file: {filename}')

    courses = build.read_json(ROOT / 'public/courses.json')['courses']
    require(len({c['id'] for c in courses}) == len(courses), 'Duplicate BV identity')
    require(all(c.get('video_check', {}).get('status') == 'metadata_verified' for c in courses), 'Unverified course metadata')
    readings = [r for e in knowledge['entries'].values() for c in e['contributions']
                if not c.get('superseded_by') for r in c.get('reading_links', [])]
    readings += [r for e in knowledge['course_entries'].values() for r in e.get('reading_links', [])]
    tests = fixture_checks()
    cache_result = {'status': 'not_requested'}
    if source_cache:
        cache = Path(source_cache)
        manifest = build.read_json(cache / 'manifest.json')
        records = list(manifest['files'])
        asr_manifest = cache / 'asr-manifest.json'
        if asr_manifest.exists():
            asr = build.read_json(asr_manifest)
            require(asr['commit'] == manifest['commit'], 'ASR cache commit mismatch')
            records.extend(asr['files'])
        by_hash = {}
        for record in records:
            raw = (cache / record['path']).read_bytes()
            digest = hashlib.sha256(raw).hexdigest()
            blob = hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()
            require(digest == record['sha256'] and blob == record['git_blob_sha'], f'Cache hash mismatch: {record["path"]}')
            by_hash[digest] = record
        source_checks = 0
        for source in knowledge['sources'].values():
            if 'github.com/weathour/ismism-system/blob/' in source['url']:
                require(source.get('sha256') in by_hash, f'Source hash absent from cache: {source["id"]}')
                require('/' + manifest['commit'] + '/' in source['url'], f'Source commit mismatch: {source["id"]}')
                path = unquote(urlsplit(source['url']).path).split('/blob/' + manifest['commit'] + '/', 1)[1]
                require(path == by_hash[source['sha256']]['path'], f'Source URL/hash identity mismatch: {source["id"]}')
                source_checks += 1
        index = build.read_json(ROOT / 'public/transcripts.json')
        for chapters in index['entries'].values():
            for chapter in chapters:
                require(chapter['sha256'] in by_hash, 'Transcript index hash absent from cache')
        cache_result = {'status': 'sha256_and_git_blob_verified', 'commit': manifest['commit'],
                        'cached_files': len(records), 'hashed_research_sources': source_checks,
                        'scope': 'File identity only; not a claim of full-text reading.'}
    report = {
        'checked_on': '2026-11-13', 'scope': 'Local structure, provenance references, patch replay and deterministic rendering. Not audio or philosophical certification.',
        'input_sha256': audit['input_sha256'], 'base_commit': ledger['upstream_base'],
        'field_transitions_replayed': len(ledger['changes']), 'replayed_data_matches': True,
        'generated_files_match': list(expected), 'fixture_checks_passed': tests,
        'coverage_counts': coverage['counts'], 'research_counts': knowledge['counts'],
        'manual_review_counts': manual['counts'],
        'reading_source_count': len({r['source_id'] for r in readings}),
        'source_cache_check': cache_result,
        'reading_relations': dict(Counter(r['relation'] for r in readings)),
        'video_metadata_records': len(courses), 'video_playback_checked': False,
        'original_bv_ids': audit['distinct_original_bvids'],
        'document_only_original_links': audit['document_only_original_links'],
        'frontend_build_run': False, 'reason_no_frontend_build': 'Only catalogue data and research tooling changed; application source and dependencies unchanged.'
    }
    (ROOT / 'research/audit-current.json').write_text(json.dumps(audit, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (ROOT / 'research/validation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-cache', help='Optional local weathour cache directory, kept outside this repository')
    main(parser.parse_args().source_cache)
