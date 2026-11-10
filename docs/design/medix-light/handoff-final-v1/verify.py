"""Read-only complete Medix documentation validation; source drift optional."""
from pathlib import Path
import argparse
import hashlib
import json
import re
import stat

HERE = Path(__file__).resolve().parent
BASE = HERE.parent
ROOT = HERE.parents[3]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def verify(check_source=False, portable=False):
    errors = []
    docs = sorted(BASE.rglob('*.md'))
    links = 0
    for doc in docs:
        body = doc.read_text(encoding='utf-8')
        if '\ufffd' in body:
            errors.append('Invalid UTF-8 text: ' + str(doc))
        for target in re.findall(r'\[[^\]]*\]\(([^)]+)\)', body):
            if target.startswith(('https:', 'http:', '#')):
                continue
            links += 1
            path = doc.parent / target.split('#')[0]
            if not path.exists():
                if path == HERE / 'FREEZE.json' and not (HERE / 'FREEZE.json').exists():
                    continue
                errors.append(f'Broken link: {doc.name} -> {target}')
    refs = json.loads((HERE / 'REFERENCE-MANIFEST.json').read_text(encoding='utf-8'))
    for entry in refs['files']:
        for p in [HERE / entry['file'], ROOT / entry['source']]:
            if not p.exists() or sha(p) != entry['sha256']:
                errors.append('Reference mismatch: ' + str(p))
    for entry in refs['dependencies']:
        p = ROOT / entry['file']
        if not p.exists() or sha(p) != entry['sha256']:
            errors.append('Dependency mismatch: ' + str(p))
    manifests = sorted(BASE.rglob('FREEZE.json'))
    hashed = 0
    for manifest_path in manifests:
        data = json.loads(manifest_path.read_text(encoding='utf-8'))
        for entry in data['files']:
            p = manifest_path.parent / entry['file']
            hashed += 1
            if not p.exists() or sha(p) != entry['sha256'].upper():
                errors.append('Frozen mismatch: ' + str(p))
            elif not portable and getattr(p.stat(), 'st_file_attributes', 1) & stat.FILE_ATTRIBUTE_READONLY == 0:
                errors.append('Not read-only: ' + str(p))
        if not portable and getattr(manifest_path.stat(), 'st_file_attributes', 1) & stat.FILE_ATTRIBUTE_READONLY == 0:
            errors.append('Manifest not read-only: ' + str(manifest_path))
        if manifest_path.parent == HERE:
            listed = {e['file'] for e in data['files']}
            actual = {p.relative_to(HERE).as_posix() for p in HERE.rglob('*') if p.is_file() and p != manifest_path}
            if listed != actual:
                errors.append('Final package file inventory mismatch')
    drift = []
    if check_source:
        baseline = json.loads((HERE / 'SOURCE-BASELINE.json').read_text(encoding='utf-8'))
        for name, expected in baseline['files'].items():
            p = ROOT / name
            if not p.exists() or sha(p) != expected:
                drift.append(name)
        if drift:
            errors.append('Protected baseline drift; inspect concurrent edits, never auto-revert')
    registry = (HERE / 'PAGE-REGISTRY.md').read_text(encoding='utf-8')
    covered = sorted(set(re.findall(r'^\|(\d{2})\|', registry, re.M)))
    if covered != [f'{i:02}' for i in range(16)]:
        errors.append('Page registry incomplete')
    return {'status': 'pass' if not errors else 'fail', 'readonly_checked': not portable, 'markdown_files': len(docs),
            'relative_links': links, 'page_ids': covered, 'reference_images': len(refs['files']),
            'dependency_files': len(refs['dependencies']), 'freeze_manifests': len(manifests),
            'frozen_entries_checked': hashed, 'source_drift': drift, 'errors': errors}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--check-source', action='store_true')
    parser.add_argument('--portable', action='store_true', help='Verify hashes and links when extraction did not preserve read-only attributes')
    args = parser.parse_args()
    result = verify(args.check_source, args.portable)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    raise SystemExit(0 if result['status'] == 'pass' else 1)
