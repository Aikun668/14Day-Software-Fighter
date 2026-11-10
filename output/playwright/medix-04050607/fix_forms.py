from pathlib import Path
p=Path('frontend-web/src/pages/clinician/PatientDetailPage.tsx');s=p.read_text(encoding='utf-8').replace('<Form form=', '<Form requiredMark={false} form=');p.write_text(s,encoding='utf-8')
