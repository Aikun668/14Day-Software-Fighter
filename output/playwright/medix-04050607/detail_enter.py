from pathlib import Path
p=Path('frontend-web/src/pages/clinician/PatientDetailPage.tsx');s=p.read_text(encoding='utf-8').replace('<Form requiredMark={false} form=', '<Form onKeyDown={event => { if (event.key === \'Enter\' && (event.target as HTMLElement).closest(\'.ant-picker\')) event.preventDefault() }} requiredMark={false} form=');p.write_text(s,encoding='utf-8')
