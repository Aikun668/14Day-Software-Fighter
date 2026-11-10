from pathlib import Path
from datetime import datetime, timezone
import hashlib, json, shutil

HERE = Path(__file__).resolve().parent
FIRST = HERE.parent / 'review-batch-01-v1'
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
manifest = json.loads((FIRST / 'MANIFEST.json').read_text(encoding='utf-8'))
for name, digest in manifest['files'].items():
    assert sha(FIRST / name) == digest, name
archive = FIRST / 'revisions' / 'before-user-approval'
archive.mkdir(parents=True, exist_ok=True)
for name in ['MANIFEST.json', 'MANIFEST.sha256', 'RULES.md', 'REVIEW.md', 'index.html', 'INDEPENDENT-REVIEW.md', 'preview-checks.json', 'verify-preview.py']:
    shutil.copy2(FIRST / name, archive / name)
approved_at = datetime.now(timezone.utc).isoformat()
approval = {'approved_at': approved_at, 'scope': '01-05 static visual images only', 'user_statement': 'OK啊，做得非常好啊，没毛病，就这样', 'status': 'user-approved-frozen', 'files': {row['file']: row['sha256'] for row in manifest['final_images']}, 'protection': 'Windows read-only image attributes plus SHA-256'}
(FIRST / 'FREEZE.json').write_text(json.dumps(approval, ensure_ascii=False, indent=2), encoding='utf-8')
(FIRST / 'APPROVAL.md').write_text('# 第一批视觉确认与冻结\n\n用户已确认：登录、首次改密、今日、型号指导、操作自检五张。批准依据为本轮用户“OK啊，做得非常好啊，没毛病，就这样”。\n\n五个顶层PNG保留原字节并设只读；校验值见FREEZE.json。生图过程、独立审查和旧预览检查仍保留，早期“待确认”表示当时状态。当前批准状态以本文件、FREEZE.json与最新MANIFEST.json为准。\n\n本次批准只覆盖图片，不代表APP代码或后续五张已通过。\n', encoding='utf-8')
rules = (FIRST / 'RULES.md').read_text(encoding='utf-8').replace('独立静态视觉复验通过，待用户视觉确认。', '用户视觉确认通过，五张PNG已冻结。').replace('本批只形成候选视觉基线，待用户确认后冻结；旧网页冻结图与 APP 当前实拍不覆盖。', '本批已形成用户确认的APP视觉基线，五张PNG已冻结；旧网页冻结图与APP当前实拍不覆盖。')
(FIRST / 'RULES.md').write_text(rules, encoding='utf-8')
review = (FIRST / 'REVIEW.md').read_text(encoding='utf-8').replace('用户视觉确认待完成。', '用户视觉确认通过，已冻结。').replace('当前交付候选', '当前批准集合').replace('这批图尚未经用户视觉确认，不覆盖网页冻结图；用户确认后才作为 APP 实施基线。', '这批图已获用户视觉确认，作为APP实施视觉基线；不覆盖网页冻结图。')
(FIRST / 'REVIEW.md').write_text(review, encoding='utf-8')
index = (FIRST / 'index.html').read_text(encoding='utf-8').replace('视觉稿待确认', '已确认 · 已冻结')
(FIRST / 'index.html').write_text(index, encoding='utf-8')
audit = (FIRST / 'INDEPENDENT-REVIEW.md').read_text(encoding='utf-8')
audit = audit.replace('# APP 第一批独立视觉审查', '# APP 第一批独立视觉审查\n\n后续状态更新：本轮用户已批准这五张图片并冻结，见 [APPROVAL.md](APPROVAL.md)。下文为批准前的独立审查原始结论。', 1)
(FIRST / 'INDEPENDENT-REVIEW.md').write_text(audit, encoding='utf-8')
verifier = (FIRST / 'verify-preview.py').read_text(encoding='utf-8').replace("'user_visual_approval': 'pending'", "'user_visual_approval': 'approved' if (DEST / 'FREEZE.json').exists() else 'pending'")
(FIRST / 'verify-preview.py').write_text(verifier, encoding='utf-8')
manifest.update({'user_visual_approval': 'approved', 'frozen': True, 'approved_at': approved_at, 'approval_record': 'FREEZE.json'})
manifest['files'] = {file.relative_to(FIRST).as_posix(): sha(file) for file in sorted(FIRST.rglob('*')) if file.is_file() and file.name not in ['MANIFEST.json', 'MANIFEST.sha256']}
(FIRST / 'MANIFEST.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
(FIRST / 'MANIFEST.sha256').write_text(sha(FIRST / 'MANIFEST.json') + '  MANIFEST.json\n', encoding='utf-8')
print(json.dumps({'approved_images': len(approval['files']), 'approved_at': approved_at}, ensure_ascii=False))
