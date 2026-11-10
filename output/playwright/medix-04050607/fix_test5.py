from pathlib import Path
p=Path('output/playwright/medix-04050607/interactions.py');s=p.read_text(encoding='utf-8-sig').replace("def report(page):\n old.go(page,'/stats');", "def report(page):\n old.go(page,'/plans');old.go(page,'/stats');");p.write_text(s,encoding='utf-8')
