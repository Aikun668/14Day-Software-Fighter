from pathlib import Path
p=Path('output/playwright/medix-04050607/interactions.py');s=p.read_text(encoding='utf-8-sig');s=s.replace("results['one_time_password_survives_failed_refresh']=True;f.fail=set()", "results['one_time_password_survives_failed_refresh']=True;f.fail=set();page.get_by_role('button',name='重试',exact=True).click();expect(page.locator('.ml-detail-identity')).to_be_visible()");p.write_text(s,encoding='utf-8')
p=Path('output/playwright/medix-04050607/capture.py');s=p.read_text(encoding='utf-8');mark="   if start!='2026-11-02':body.update"
a=s.index(mark)
s=s[:a]+'''   if self.mode in ['many-missing','rounding1','rounding5']:
    N=14 if self.mode=='many-missing' else 16;M=0 if self.mode=='many-missing' else 1 if self.mode=='rounding1' else 5
    body.update(N=N,M=M,coverage_rate=round(M/N*100,1),duplicate_slots=[],source_breakdown={'PATIENT_REPORT':M},missing_slots=[{'slot_id':f'missing-{i}','scheduled_at':f'2026-11-{2+i%7:02}T08:00:00+08:00'} for i in range(N-M)],points=[dict(day=f'2026-11-{2+i:02}',N=N if i==0 else 0,M=M if i==0 else 0,coverage_rate=round(M/N*100,1) if i==0 else None) for i in range(7)])
''' +s[a:];p.write_text(s,encoding='utf-8')
