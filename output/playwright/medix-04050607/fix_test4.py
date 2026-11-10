from pathlib import Path
p=Path('output/playwright/medix-04050607/capture.py');s=p.read_text(encoding='utf-8');s=s.replace("sys.path.insert(0,str(Path('output/playwright/medix-0123').resolve()))\n",'');p.write_text(s,encoding='utf-8')
p=Path('output/playwright/medix-04050607/interactions.py');s=p.read_text(encoding='utf-8-sig');s=s.replace("page.get_by_role('combobox',name=label,exact=True)","page.get_by_label(label,exact=True)");s=s.replace("page=ctx.new_page();page.on", "page=ctx.new_page();page.set_default_timeout(8000);page.on");p.write_text(s,encoding='utf-8')
