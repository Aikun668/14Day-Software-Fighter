from pathlib import Path
import hashlib,json
p=Path('docs/evidence/medix-04050607-alignment-v1')
files={str(f.relative_to(p)).replace('\\','/'):hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted(p.rglob('*')) if f.is_file() and f.name!='MANIFEST.json'}
manifest={'version':'medix-04050607-alignment-v1','status':'independent-review-passed-user-review-pending','pages':['04','05','06','07'],'files':files}
(p/'MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
assert all(hashlib.sha256((p/f).read_bytes()).hexdigest()==sha for f,sha in files.items())
print('Delivery manifest verified:',len(files),'files')
