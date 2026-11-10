from pathlib import Path
p=Path('frontend-web/src/pages/clinician/StatsPage.tsx');s=p.read_text(encoding='utf-8').replace('<RightOutlined />','<RightOutlined aria-hidden />').replace('<DownOutlined />','<DownOutlined aria-hidden />');p.write_text(s,encoding='utf-8')
p=Path('frontend-web/src/pages/clinician/PatientDetailPage.tsx');s=p.read_text(encoding='utf-8').replace('<EditOutlined />','<EditOutlined aria-hidden />').replace('<FileTextOutlined />','<FileTextOutlined aria-hidden />');p.write_text(s,encoding='utf-8')
