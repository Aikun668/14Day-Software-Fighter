from pathlib import Path
p=Path('output/playwright/medix-04050607/interactions.py');s=p.read_text(encoding='utf-8-sig');s=s.replace("expect(page.get_by_text('演示服务暂不可用',exact=True)).to_be_visible()", "expect(page.locator('.ml-detail-grid [role=alert]')).to_contain_text('演示服务暂不可用')");p.write_text(s,encoding='utf-8')
