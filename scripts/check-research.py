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
        def metadata_body(payload):
            body(payload)
            payload['sources'][0]['kind'] = 'course_video_metadata'
        run('course_metadata_cannot_support_body', metadata_body)
        def course_correction(payload, **changes):
            record = {'id': bv, 'before': {'kind': 'dollar_series'}, 'after': {'kind': 'preview'},
                      'evidence_source_ids': ['s'], 'rationale': 'Synthetic identity correction'}
            record.update(changes)
            payload['course_corrections'] = [record]
        run('course_metadata_correction_valid', course_correction, rejected=False)
        run('course_metadata_correction_drift', lambda p: course_correction(p, before={'kind': 'review'}))
        run('course_metadata_correction_unknown_id', lambda p: course_correction(p, id='BV1Er4y1v78m'))
        run('course_metadata_correction_invalid_field', lambda p: course_correction(p, before={'url': 'A'}, after={'url': 'B'}))
        run('course_metadata_correction_missing_source', lambda p: course_correction(p, evidence_source_ids=[]))
        correction = {'id': bv, 'before': {'kind': 'review'}, 'after': {'kind': 'lecture'},
                      'evidence_source_ids': ['s'], 'rationale': 'Fixture'}
        original = [{'id': bv, 'kind': 'review'}]
        once = build.correct_courses(original, [correction])
        require(build.correct_courses(once, [correction]) == once and original[0]['kind'] == 'review',
                'Course correction must be idempotent and not mutate its input')
        passed.append('course_metadata_correction_idempotent')
        second = {**correction, 'before': {'kind': 'lecture'}, 'after': {'kind': 'extra'}}
        twice = build.correct_courses(original, [correction, second])
        require(twice[0]['kind'] == 'extra' and build.correct_courses(twice, [correction, second]) == twice,
                'Continuous course correction chain must replay idempotently')
        require(twice[0]['metadata_correction_history'] == [correction, second], 'Course correction history lost')
        passed.append('course_metadata_continuous_chain_idempotent')
        def broken_course_chain(payload):
            course_correction(payload)
            payload['course_corrections'].append({**second, 'before': {'kind': 'lecture'}})
        run('course_metadata_discontinuous_chain', broken_course_chain)
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
    ai, ai_md = build.ai_review(ROOT, knowledge)
    require(manual['counts']['all_fields_recorded_nodes'] == manual['counts']['manual_nodes'] == 213,
            'Original manual review coverage regressed')
    require(ai['counts']['all_fields_recorded_nodes'] == ai['counts']['ai_nodes'] == 42,
            'Original AI review coverage regressed')
    require(set(knowledge['course_entries']) == {c['id'] for c in knowledge['courses']},
            'A supplementary course lacks an evidence-scoped body record')
    expected = {
        'public/research.json': json.dumps(knowledge, ensure_ascii=False, indent=2) + '\n',
        'public/coverage.json': json.dumps(coverage, ensure_ascii=False, indent=2) + '\n',
        'research/READING-GUIDE.md': build.render(knowledge),
        'research/BIBLIOGRAPHY.md': build.render_readings(knowledge),
        'research/COURSES.md': build.render_courses(knowledge),
        'research/COVERAGE.md': coverage_md,
        'public/manual-review.json': json.dumps(manual, ensure_ascii=False, indent=2) + '\n',
        'research/MANUAL-REVIEW.md': manual_md,
        'public/ai-review.json': json.dumps(ai, ensure_ascii=False, indent=2) + '\n',
        'research/AI-REVIEW.md': ai_md,
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
    local_result = {'status': 'not_requested'}
    if source_cache:
        cache = Path(source_cache)
        manifest = build.read_json(cache / 'manifest.json')
        records = list(manifest['files'])
        extra_manifests = [cache / 'asr-manifest.json', *sorted(cache.glob('extras-*-manifest.json'))]
        for extra_manifest in extra_manifests:
            if not extra_manifest.exists():
                continue
            extra = build.read_json(extra_manifest)
            require(extra['commit'] == manifest['commit'], f'Cache commit mismatch: {extra_manifest.name}')
            records.extend(extra['files'])
        require(len({r['path'] for r in records}) == len(records), 'Duplicate cache records')
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
        local_checked = []
        for source in knowledge['sources'].values():
            if source.get('kind') == 'local_automatic_speech_transcript':
                run = source['generation']
                raw = (cache.parent / 'local-asr' / (run['bvid'] + '.jsonl')).read_bytes()
                require(hashlib.sha256(raw).hexdigest() == run['transcript_sha256'], 'Local transcript hash mismatch')
                audio = cache.parent / 'local-asr' / (run['bvid'] + '.m4a')
                require(hashlib.sha256(audio.read_bytes()).hexdigest() == run['audio_sha256'], 'Local audio hash mismatch')
                segments = [json.loads(line) for line in raw.decode('utf-8').splitlines()]
                require(len(segments) == run['segments'] and run['status'] == 'complete', 'Local ASR incomplete')
                require(all(0 <= s['start'] < s['end'] <= run['duration_seconds'] for s in segments), 'Invalid ASR timestamps')
                require(all(a['end'] <= b['start'] for a, b in zip(segments, segments[1:])), 'ASR time ordering changed')
                require(segments[-1]['end'] > run['duration_seconds'] - 5, 'ASR does not reach video ending')
                local_checked.append({'source_id': source['id'], 'segments': len(segments), 'last_end': segments[-1]['end']})
            if source.get('kind') == 'video_board_frames' and source.get('evidence_files'):
                for record in source['evidence_files']:
                    require(hashlib.sha256((cache / record['name']).read_bytes()).hexdigest() == record['sha256'],
                            'Board evidence hash mismatch')
                local_checked.append({'source_id': source['id'], 'files': len(source['evidence_files'])})
            if source.get('kind') == 'local_asr_identity_comparison':
                run = source['generation']
                folder = cache.parent / 'identity-asr'
                raw = (folder / 'samples.jsonl').read_bytes()
                require(hashlib.sha256(raw).hexdigest() == run['samples_sha256'], 'Identity ASR hash mismatch')
                require(hashlib.sha256((folder / (run['bvid'] + '.m4a')).read_bytes()).hexdigest() == run['audio_sha256'],
                        'Identity audio hash mismatch')
                segments = [json.loads(line) for line in raw.decode('utf-8').splitlines()]
                require(len(segments) == run['segments'], 'Identity sample segment count mismatch')
                require(all(any(start - .01 <= s['start'] < s['end'] <= end + .01 for start, end in run['sample_ranges'])
                            for s in segments), 'Identity sample outside declared windows')
                local_checked.append({'source_id': source['id'], 'segments': len(segments), 'sample_ranges': run['sample_ranges']})
        local_result = {'status': 'hashes_and_transcript_structure_verified', 'records': local_checked,
                        'scope': 'Evidence identity and ASR time coverage only; no audio or full-board certification.'}
    report = {
        'checked_on': '2026-11-13', 'scope': 'Local structure, provenance references, patch replay and deterministic rendering. Not audio or philosophical certification.',
        'input_sha256': audit['input_sha256'], 'base_commit': ledger['upstream_base'],
        'field_transitions_replayed': len(ledger['changes']), 'replayed_data_matches': True,
        'generated_files_match': list(expected), 'fixture_checks_passed': tests,
        'coverage_counts': coverage['counts'], 'research_counts': knowledge['counts'],
        'manual_review_counts': manual['counts'],
        'ai_review_counts': ai['counts'],
        'reading_source_count': len({r['source_id'] for r in readings}),
        'source_cache_check': cache_result,
        'local_evidence_check': local_result,
        'course_body_status_counts': dict(Counter(e['body_status'] for e in knowledge['course_entries'].values())),
        'course_metadata_corrections': len(knowledge['course_corrections']),
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
