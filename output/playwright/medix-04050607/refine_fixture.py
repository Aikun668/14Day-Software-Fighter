from pathlib import Path
p=Path('output/playwright/medix-04050607/capture.py');s=p.read_text(encoding='utf-8-sig')
a=s.index('   totals=[24,28,26,32,30,34,36]');b=s.index("   if self.mode=='zero':",a)
s=s[:a]+'''   totals=[24,28,26,32,30,34,36]; cells=[]
   for i in range(10):
    cs=[dict(day=d,N=2 if i==0 else 4 if i<8 else 5,M=0,coverage_rate=0,missing=0) for d in days];cells.append(cs)
   for j,d in enumerate(days):
    first=[2,1,2,2,1,2,2][j%7];cells[0][j]['M']=first;remain=totals[j%7]-first
    for k in range(9):
     i=1+(k+j*3)%9;v=min(cells[i][j]['N'],remain);cells[i][j]['M']=v;remain-=v
   rows=[]
   for i in range(10):
    person=self.patients[i];cs=cells[i]
    for c in cs:c.update(coverage_rate=round(c['M']/c['N']*100,1),missing=c['N']-c['M'])
    N=sum(c['N'] for c in cs);M=sum(c['M'] for c in cs)
    rows.append(dict(patient_id=person['id'],patient_code=person['patient_code'],display_name=person['display_name'],N=N,M=M,coverage_rate=round(M/N*100,1),missing_count=N-M,cells=cs))
''' +s[b:]
# Actual CDP fonts, not inferred CSS family names.
s=s.replace("shot(page,'04-patient-detail.png')", "shot(page,'04-patient-detail.png');results['fonts_detail']=fonts(page,['.ml-detail-identity h1','.ml-detail-identity > span','.ml-detail-matrix tbody th'])")
s=s.replace("shot(page,'05-plans.png')", "shot(page,'05-plans.png');results['fonts_plans']=fonts(page,['.ml-plan-form label','.ml-history-meta','.ml-time-item input'])")
a=s.index('def main():')
s=s[:a]+'''def fonts(page,selectors):
 cdp=page.context.new_cdp_session(page);cdp.send('DOM.enable');cdp.send('CSS.enable');root=cdp.send('DOM.getDocument')['root']['nodeId'];out={}
 for sel in selectors:
  node=cdp.send('DOM.querySelector',{'nodeId':root,'selector':sel})['nodeId'];out[sel]=cdp.send('CSS.getPlatformFontsForNode',{'nodeId':node})
 cdp.detach();return out
''' +s[a:]
p.write_text(s,encoding='utf-8')
