"""Read-only package validation. Run: python <this-file> [--check-source]."""
from pathlib import Path
import argparse
import hashlib
import json
import re
import stat

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def validate(check_source=False):
    errors = []
    links = 0
    docs = sorted(HERE.glob('*.md'))
    for path in docs:
        body = path.read_text(encoding='utf-8')
        if '\ufffd' in body:
            errors.append(f'Invalid text: {path.name}')
        for target in re.findall(r'\[[^\]]*\]\(([^)]+)\)', body):
            if target.startswith(('http:', 'https:', '#')):
                continue
            links += 1
            if not (path.parent / target.split('#')[0]).exists():
                errors.append(f'Broken link: {path.name} -> {target}')
    refs = json.loads((HERE / 'REFERENCE-MANIFEST.json').read_text(encoding='utf-8'))
    for entry in refs['files']:
        for path in [HERE / entry['file'], ROOT / entry['source']]:
            if not path.exists() or digest(path) != entry['sha256']:
                errors.append(f'Reference mismatch: {path}')
    for entry in refs['dependencies']:
        path = ROOT / entry['file']
        if not path.exists() or digest(path) != entry['sha256']:
            errors.append(f'Dependency changed: {path}')
    frozen_count = 0
    manifest_path = HERE / 'FREEZE.json'
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
        listed = {entry['file'] for entry in manifest['files']}
        actual = {str(p.relative_to(HERE)).replace('\\', '/') for p in HERE.rglob('*') if p.is_file() and p != manifest_path}
        if listed != actual:
            errors.append('Frozen inventory differs from actual files')
        for entry in manifest['files']:
            path = HERE / entry['file']
            if not path.exists() or digest(path) != entry['sha256']:
                errors.append(f'Frozen file mismatch: {entry["file"]}')
            frozen_count += 1
        for path in [manifest_path] + [HERE / entry['file'] for entry in manifest['files']]:
            if path.exists():
                attrs = getattr(path.stat(), 'st_file_attributes', None)
                if attrs is not None and not (attrs & stat.FILE_ATTRIBUTE_READONLY):
                    errors.append(f'Not read-only: {path.name}')
    else:
        # Pre-freeze pass still checks all substantive content.
        errors = [e for e in errors if not e.endswith('-> FREEZE.json')]
    drift = []
    if check_source:
        baseline = json.loads((HERE / 'SOURCE-BASELINE.json').read_text(encoding='utf-8'))
        for name, expected in baseline['files'].items():
            path = ROOT / name
            if not path.exists() or digest(path) != expected.upper():
                drift.append(name)
        if drift:
            errors.append('Source/baseline drift; inspect concurrent changes, do not revert automatically')
    return {
        'status': 'pass' if not errors else 'fail',
        'markdown_files': len(docs), 'relative_links': links,
        'reference_images': len(refs['files']),
        'dependency_files': len(refs['dependencies']),
        'frozen_payload_files': frozen_count,
        'source_drift': drift, 'errors': errors,
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--check-source', action='store_true', help='Expected to drift when implementation starts')
    args = parser.parse_args()
    result = validate(args.check_source)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    raise SystemExit(0 if result['status'] == 'pass' else 1)
